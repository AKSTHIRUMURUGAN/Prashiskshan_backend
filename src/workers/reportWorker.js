import { Worker, QueueEvents } from "bullmq";
import bullConnection from "../config/bullmq.js";
import Student from "../models/Student.js";
import Internship from "../models/Internship.js";
import Company from "../models/Company.js";
import Application from "../models/Application.js";
import Logbook from "../models/Logbook.js";
import Report from "../models/Report.js";
import { pdfService } from "../services/pdfService.js";
import { storageService } from "../services/storageService.js";
import { aiService } from "../services/aiService.js";
import InternshipCompletion from "../models/InternshipCompletion.js";
import { addToQueue } from "../queues/index.js";
import { logger } from "../utils/logger.js";
import { estimateTokens } from "../services/aiService.js";

const REPORT_QUEUE = "report-generation";

const ensureDocument = (doc, label) => {
  if (!doc) {
    throw new Error(`${label} not found`);
  }
  return doc;
};

const uploadPdf = async (buffer, filename) =>
  storageService.uploadFile(buffer, {
    filename,
    contentType: "application/pdf",
  });

const fetchContext = async (studentId, internshipId) => {
  const [student, internship, logbooks] = await Promise.all([
    Student.findById(studentId),
    Internship.findById(internshipId).populate("companyId"),
    Logbook.find({ studentId, internshipId, status: { $in: ["approved", "completed"] } }).sort({ weekNumber: 1 }),
  ]);
  return { student, internship, logbooks };
};

const generateJsonWithTokens = async (prompt, options = {}) => {
  const response = await aiService.generateContent(`${prompt}\nReturn valid JSON only.`, options);
  const jsonString = (response.output || "").replace(/```json|```/g, "").trim();
  try {
    const parsed = JSON.parse(jsonString);
    return { parsed, tokens: response.tokens || { input: estimateTokens(prompt), output: estimateTokens(jsonString) } };
  } catch (error) {
    logger.error("AI JSON parse failed", { raw: response.output });
    throw new Error("AI response was not valid JSON");
  }
};

const handleNepReport = async (job) => {
  const { reportId, studentId, internshipId } = job.data || {};
  if (!studentId || !internshipId) throw new Error("studentId and internshipId are required");
  await job.updateProgress(5);

  await Report.findOneAndUpdate(
    { reportId },
    { status: "processing", type: "nep", reportId },
    { upsert: true, new: true },
  );

  const context = await fetchContext(studentId, internshipId);
  ensureDocument(context.student, "Student");
  ensureDocument(context.internship, "Internship");

  const totalHours = context.logbooks.reduce((sum, item) => sum + (item.hoursWorked || 0), 0);
  const creditsEarned = Math.floor(totalHours / 30) || 0;

  await job.updateProgress(35);

  const prompt = `Create an NEP-compliant internship report.
Return JSON with keys:
executiveSummary (string),
keyAchievements (array of strings),
skillsDeveloped (array of strings),
learningOutcomes (array of strings),
performanceHighlights (string).

Student profile: ${JSON.stringify(context.student.profile || {})}
Internship: ${context.internship.title} at ${context.internship.companyId?.companyName}
Total hours: ${totalHours}
Credits: ${creditsEarned}
Logbook highlights: ${context.logbooks
    .map((log) => `Week ${log.weekNumber}: ${log.activities?.slice(0, 200)}`)
    .join(" | ")}`;

  const { parsed: aiSections } = await generateJsonWithTokens(prompt, {
    feature: "report_generation",
    userId: studentId,
    role: "student",
    model: "flash",
  });

  await job.updateProgress(65);

  const sections = [
    { heading: "Executive Summary", content: aiSections.executiveSummary || "Summary unavailable." },
    {
      heading: "Key Achievements",
      content: (aiSections.keyAchievements || []).map((item, idx) => `${idx + 1}. ${item}`).join("\n"),
    },
    {
      heading: "Skills Developed",
      content: (aiSections.skillsDeveloped || []).join(", ") || "Not captured",
    },
    {
      heading: "Learning Outcomes",
      content: (aiSections.learningOutcomes || []).map((item, idx) => `${idx + 1}. ${item}`).join("\n"),
    },
    {
      heading: "Performance Highlights",
      content: aiSections.performanceHighlights || "Highlights pending mentor review.",
    },
    {
      heading: "Credit Summary",
      content: `Total Hours: ${totalHours}\nCredits Earned: ${creditsEarned}`,
    },
  ];

  const pdfBuffer = await pdfService.generateReport({
    title: `NEP Report - ${context.student.profile?.name || "Student"}`,
    sections,
    metadata: {
      studentId,
      internshipId,
      generatedAt: new Date().toISOString(),
    },
  });

  await job.updateProgress(85);

  const upload = await uploadPdf(pdfBuffer, `reports/${reportId || `nep-${Date.now()}`}.pdf`);

  await Report.findOneAndUpdate(
    { reportId },
    {
      status: "completed",
      fileUrl: upload.url,
      sections: sections.map((section) => ({ title: section.heading, content: section.content })),
      generatedAt: new Date(),
      metadata: { totalHours, creditsEarned },
    },
  );

  await addToQueue("notification", "notify-student", {
    mongoId: studentId,
    title: "NEP report ready",
    message: "Your NEP compliance report is ready to download.",
    priority: "medium",
    actionUrl: upload.url,
  });

  await job.updateProgress(100);
  return { reportId, url: upload.url };
};

const handleCompletionCertificate = async (job) => {
  const { reportId, studentId, internshipId, creditsEarned = 0 } = job.data || {};
  if (!studentId || !internshipId) throw new Error("studentId and internshipId are required");

  const [student, internship] = await Promise.all([
    Student.findById(studentId),
    Internship.findById(internshipId).populate("companyId"),
  ]);
  ensureDocument(student, "Student");
  ensureDocument(internship, "Internship");

  const pdfBuffer = await pdfService.generateCertificate({
    studentName: student.profile?.name || student.email,
    companyName: internship.companyId?.companyName || "Partner Company",
    internshipTitle: internship.title,
    credits: creditsEarned,
  });

  const upload = await uploadPdf(pdfBuffer, `certificates/${reportId || `certificate-${Date.now()}`}.pdf`);

  await InternshipCompletion.findOneAndUpdate(
    { studentId, internshipId },
    {
      certificates: { certificateUrl: upload.url },
      creditsEarned,
      status: "issued",
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  if (reportId) {
    await Report.findOneAndUpdate(
      { reportId },
      {
        status: "completed",
        fileUrl: upload.url,
        generatedAt: new Date(),
      },
    );
  }

  await addToQueue("notification", "notify-student", {
    mongoId: studentId,
    title: "Completion certificate ready",
    message: `Download your certificate for ${internship.title}.`,
    actionUrl: upload.url,
    priority: "high",
  });

  return { url: upload.url };
};

const handleRecommendationLetter = async (job) => {
  const { studentId, internshipId, reportId, recommendation } = job.data || {};
  if (!studentId || !internshipId) throw new Error("studentId and internshipId are required");

  const [student, internship] = await Promise.all([Student.findById(studentId), Internship.findById(internshipId)]);
  ensureDocument(student, "Student");
  ensureDocument(internship, "Internship");
  const company =
    (job.data?.companyId && (await Company.findById(job.data.companyId))) ||
    (internship.companyId && (await Company.findById(internship.companyId))) ||
    null;

  const prompt = `Write a professional recommendation letter for ${student.profile?.name} who completed the ${internship.title} internship at ${company?.companyName || "our organization"}.
Emphasize strengths, achievements, technical competencies, and overall conduct.
Tone: warm, professional, concise (3 paragraphs).`;
  const response = await aiService.generateContent(prompt, {
    feature: "recommendation_letter",
    userId: studentId,
    role: "company",
    model: "pro",
  });

  const pdfBuffer = await pdfService.generateReport({
    title: `Recommendation Letter - ${student.profile?.name}`,
    sections: [
      {
        heading: company?.companyName || "Prashiskshan Partner",
        content: recommendation || response.output,
      },
    ],
  });
  const upload = await uploadPdf(pdfBuffer, `letters/${reportId || `recommendation-${Date.now()}`}.pdf`);

  if (reportId) {
    await Report.findOneAndUpdate(
      { reportId },
      { status: "completed", fileUrl: upload.url, generatedAt: new Date() },
      { upsert: true },
    );
  }

  return { url: upload.url };
};

const handleAdminReport = async (job) => {
  const { reportId, dateRange } = job.data || {};
  await job.updateProgress(10);
  const [students, companies, internships, applications] = await Promise.all([
    Student.countDocuments(),
    Company.countDocuments(),
    Internship.countDocuments({ status: "approved" }),
    Application.countDocuments(),
  ]);
  await job.updateProgress(40);

  const prompt = `Provide a JSON summary with keys insights (array of strings), risks (array), recommendations (array) based on:
Students: ${students}, Companies: ${companies}, Approved internships: ${internships}, Applications: ${applications}.`;
  const { parsed: ai } = await generateJsonWithTokens(prompt, { feature: "admin_report", role: "admin" });
  await job.updateProgress(70);

  const sections = [
    { heading: "Key Metrics", content: `Students: ${students}\nCompanies: ${companies}\nApproved internships: ${internships}\nApplications: ${applications}` },
    { heading: "Insights", content: (ai.insights || []).map((item, idx) => `${idx + 1}. ${item}`).join("\n") || "No insights" },
    { heading: "Risks", content: (ai.risks || []).join("\n") || "No critical risks" },
    {
      heading: "Recommendations",
      content: (ai.recommendations || []).map((item, idx) => `${idx + 1}. ${item}`).join("\n") || "No recommendations",
    },
  ];

  const pdfBuffer = await pdfService.generateReport({
    title: "System Health Report",
    sections,
    metadata: { dateRange, generatedAt: new Date().toISOString() },
  });
  const upload = await uploadPdf(pdfBuffer, `reports/${reportId || `admin-${Date.now()}`}.pdf`);

  await Report.findOneAndUpdate(
    { reportId },
    { status: "completed", fileUrl: upload.url, generatedAt: new Date(), type: "admin" },
    { upsert: true },
  );

  await job.updateProgress(100);
  return { url: upload.url };
};

const processor = async (job) => {
  switch (job.name) {
    case "generate-nep-report":
      return handleNepReport(job);
    case "generate-completion-certificate":
      return handleCompletionCertificate(job);
    case "generate-recommendation-letter":
      return handleRecommendationLetter(job);
    case "generate-admin-report":
      return handleAdminReport(job);
    default:
      throw new Error(`Unsupported report job: ${job.name}`);
  }
};

export const reportWorker = new Worker(REPORT_QUEUE, processor, {
  connection: bullConnection,
  concurrency: 3,
  lockDuration: 120_000,
});

export const reportQueueEvents = new QueueEvents(REPORT_QUEUE, { connection: bullConnection });

reportQueueEvents.on("failed", ({ jobId, failedReason }) => {
  logger.error("Report job failed", { jobId, reason: failedReason });
});

reportQueueEvents.on("completed", ({ jobId }) => {
  logger.info("Report job completed", { jobId });
});

reportQueueEvents
  .waitUntilReady()
  .then(() => logger.info("Report queue events ready"))
  .catch((error) => logger.error("Report queue events error", { error: error.message }));

export default reportWorker;
