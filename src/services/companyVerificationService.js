import Company from "../models/Company.js";
import { aiService } from "./aiService.js";
import { pdfService } from "./pdfService.js";
import { storageService } from "./storageService.js";
import { logger } from "../utils/logger.js";

export const checkWebsite = async (url) => {
  if (!url) return { reachable: false };
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, { method: "GET", signal: controller.signal });
    clearTimeout(timer);
    const body = await res.text();
    return {
      reachable: res.ok,
      status: res.status,
      sslEnabled: url.startsWith("https://"),
      hasContactPage: /contact/i.test(body),
      contentLength: body.length,
    };
  } catch (error) {
    return { reachable: false, error: error.message };
  }
};

export const calculateCompanyAge = (cinNumber) => {
  if (!cinNumber || cinNumber.length < 12) return null;
  const year = parseInt(cinNumber.slice(7, 11), 10);
  if (Number.isNaN(year)) return null;
  return new Date().getFullYear() - year;
};

export const flagSuspiciousPatterns = (company) => {
  const flags = [];
  const age = calculateCompanyAge(company.documents?.cinNumber);
  if (age !== null && age < 1) flags.push("Company registered less than a year ago");
  if (company.email && /@(gmail|yahoo|hotmail)\./i.test(company.email)) {
    flags.push("Company email not on custom domain");
  }
  if (!company.website) flags.push("Missing website");
  if (!company.documents?.gstCertificate) flags.push("Missing GST certificate");
  return flags;
};

export const companyVerificationService = {
  async verifyCompany(companyId) {
    const company = await Company.findOne({ companyId });
    if (!company) throw new Error("Company not found");

    const [website, suspiciousFlags] = await Promise.all([
      checkWebsite(company.website),
      Promise.resolve(flagSuspiciousPatterns(company)),
    ]);

    const prompt = `You are verifying a company. Use the provided data to assess risk.
Return JSON { riskLevel (low|medium|high), confidence (0-100), findings[], concerns[], redFlags[], recommendation (approve|reject|manual_review), reasoning, verificationChecklist: {documents:boolean, website:boolean, contact:boolean}}.

Company: ${company.companyName}
Website check: ${JSON.stringify(website)}
Documents: ${JSON.stringify(company.documents)}
AI suspicions: ${JSON.stringify(suspiciousFlags)}
`;

    const analysis = await aiService.generateStructuredJSON(prompt, { model: "pro", feature: "company_verification" });
    company.aiVerification = {
      riskLevel: analysis.riskLevel,
      confidence: analysis.confidence,
      findings: analysis.findings,
      concerns: analysis.concerns,
      recommendation: analysis.recommendation,
      analyzedAt: new Date(),
    };
    await company.save();
    return analysis;
  },

  async generateVerificationReport(companyId) {
    const company = await Company.findOne({ companyId });
    if (!company) throw new Error("Company not found");
    const sections = [
      { heading: "Company Overview", content: `${company.companyName}\nWebsite: ${company.website}` },
      { heading: "AI Verification", content: JSON.stringify(company.aiVerification, null, 2) },
      { heading: "Documents", content: JSON.stringify(company.documents, null, 2) },
    ];
    const pdfBuffer = await pdfService.generateReport({
      title: `Company Verification - ${company.companyName}`,
      sections,
    });
    const uploaded = await storageService.uploadFile(pdfBuffer, {
      filename: `company-verification-${company.companyId}.pdf`,
      contentType: "application/pdf",
      provider: "s3",
    });
    return uploaded.url;
  },
};


