import request from "supertest";
import express from "express";
import adminRouter from "../../src/routes/admin.js";
import { createTestAdmin, createTestCompany, createTestStudent, createTestMentor, getAuthToken } from "../helpers/testHelpers.js";
import Company from "../../src/models/Company.js";
import Student from "../../src/models/Student.js";
import Mentor from "../../src/models/Mentor.js";
import Internship from "../../src/models/Internship.js";
import Application from "../../src/models/Application.js";
import Logbook from "../../src/models/Logbook.js";

const app = express();
app.use(express.json());
app.use("/admins", adminRouter);

describe("Admin Routes - CRUD Operations", () => {
  let admin, firebaseUser, authToken, company, student, mentor, internship, application, logbook;

  beforeEach(async () => {
    const adminData = await createTestAdmin();
    admin = adminData.admin;
    firebaseUser = adminData.firebaseUser;
    authToken = await getAuthToken(firebaseUser);

    const companyData = await createTestCompany({
      status: "pending_verification",
      aiVerification: {
        riskLevel: "low",
        confidence: 85,
        findings: ["Valid CIN number", "Active website"],
        concerns: [],
        recommendation: "approve",
      },
    });
    company = companyData.company;

    const studentData = await createTestStudent();
    student = studentData.student;

    const mentorData = await createTestMentor();
    mentor = mentorData.mentor;

    internship = await Internship.create({
      internshipId: `INTERN-${Date.now()}`,
      companyId: company._id,
      title: "Software Development Intern",
      description: "Join our team",
      department: "Computer Science",
      requiredSkills: ["JavaScript"],
      duration: "3 months",
      startDate: new Date(),
      applicationDeadline: new Date(),
      slots: 5,
      status: "approved",
      postedBy: company.companyId,
      postedAt: new Date(),
    });

    application = await Application.create({
      applicationId: `APP-${Date.now()}`,
      studentId: student._id,
      internshipId: internship._id,
      companyId: company._id,
      department: "Computer Science",
      coverLetter: "Test application",
      status: "accepted",
    });

    logbook = await Logbook.create({
      logbookId: `LOG-${Date.now()}`,
      studentId: student._id,
      internshipId: internship._id,
      companyId: company._id,
      weekNumber: 1,
      startDate: new Date(),
      endDate: new Date(),
      hoursWorked: 40,
      activities: "Test activities",
      skillsUsed: ["JavaScript"],
      learnings: "Test learnings",
      status: "approved",
      mentorReview: {
        status: "approved",
        creditsApproved: 1,
      },
    });
  });

  describe("GET /admins/dashboard - Read Dashboard", () => {
    it("should get admin dashboard with system statistics", async () => {
      const response = await request(app)
        .get("/admins/dashboard")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.totals).toBeDefined();
      expect(response.body.data.totals.students).toBeGreaterThanOrEqual(0);
      expect(response.body.data.totals.companies).toBeGreaterThanOrEqual(0);
      expect(response.body.data.totals.internships).toBeGreaterThanOrEqual(0);
    });
  });

  describe("GET /admins/companies/pending - Read Pending Companies", () => {
    it("should get all pending companies", async () => {
      const response = await request(app)
        .get("/admins/companies/pending")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.companies)).toBe(true);
    });

    it("should filter companies by risk level", async () => {
      const response = await request(app)
        .get("/admins/companies/pending?riskLevel=low")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe("GET /admins/companies/:companyId - Read Company Details", () => {
    it("should get company details", async () => {
      const response = await request(app)
        .get(`/admins/companies/${company.companyId}`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.company).toBeDefined();
      expect(response.body.data.company.companyId).toBe(company.companyId);
    });

    it("should return 404 for non-existent company", async () => {
      const response = await request(app)
        .get("/admins/companies/INVALID-ID")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe("POST /admins/companies/:companyId/verify - Update Company (Verify)", () => {
    it("should verify a company", async () => {
      const verifyData = {
        comments: "Company verified successfully. All documents are valid.",
      };

      const response = await request(app)
        .post(`/admins/companies/${company.companyId}/verify`)
        .set("Authorization", `Bearer ${authToken}`)
        .send(verifyData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.company.status).toBe("verified");

      const updatedCompany = await Company.findOne({ companyId: company.companyId });
      expect(updatedCompany.status).toBe("verified");
      expect(updatedCompany.adminReview.decision).toBe("approved");
    });
  });

  describe("POST /admins/companies/:companyId/reject - Update Company (Reject)", () => {
    it("should reject a company with reason", async () => {
      const rejectData = {
        reason: "Invalid CIN number or missing required documents",
      };

      const response = await request(app)
        .post(`/admins/companies/${company.companyId}/reject`)
        .set("Authorization", `Bearer ${authToken}`)
        .send(rejectData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.company.status).toBe("rejected");

      const updatedCompany = await Company.findOne({ companyId: company.companyId });
      expect(updatedCompany.status).toBe("rejected");
      expect(updatedCompany.adminReview.decision).toBe("rejected");
    });

    it("should fail without rejection reason", async () => {
      const response = await request(app)
        .post(`/admins/companies/${company.companyId}/reject`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(400);
    });
  });

  describe("POST /admins/companies/:companyId/suspend - Update Company (Suspend)", () => {
    it("should suspend a company", async () => {
      await Company.findOneAndUpdate({ companyId: company.companyId }, { status: "verified" });

      const suspendData = {
        reason: "Violation of platform policies",
      };

      const response = await request(app)
        .post(`/admins/companies/${company.companyId}/suspend`)
        .set("Authorization", `Bearer ${authToken}`)
        .send(suspendData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.company.status).toBe("suspended");

      const updatedCompany = await Company.findOne({ companyId: company.companyId });
      expect(updatedCompany.status).toBe("suspended");
    });
  });

  describe("POST /admins/students/import - Create Bulk Import", () => {
    it("should start bulk student import", async () => {
      const importData = {
        students: [
          {
            email: `student1${Date.now()}@test.com`,
            name: "Student One",
            department: "Computer Science",
            year: 2,
            college: "Test University",
          },
          {
            email: `student2${Date.now()}@test.com`,
            name: "Student Two",
            department: "Electronics",
            year: 3,
            college: "Test University",
          },
        ],
      };

      const response = await request(app)
        .post("/admins/students/import")
        .set("Authorization", `Bearer ${authToken}`)
        .send(importData);

      expect([200, 202]).toContain(response.status);
      expect(response.body.success).toBe(true);
      expect(response.body.data.jobId).toBeDefined();
    });

    it("should fail with empty students array", async () => {
      const response = await request(app)
        .post("/admins/students/import")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ students: [] });

      expect(response.status).toBe(400);
    });
  });

  describe("GET /admins/students/import/:jobId - Read Import Job Status", () => {
    it("should get import job status", async () => {
      const importData = {
        students: [
          {
            email: `student${Date.now()}@test.com`,
            name: "Test Student",
            department: "Computer Science",
            year: 2,
            college: "Test University",
          },
        ],
      };

      const importResponse = await request(app)
        .post("/admins/students/import")
        .set("Authorization", `Bearer ${authToken}`)
        .send(importData);

      const jobId = importResponse.body.data.jobId;

      await new Promise((resolve) => setTimeout(resolve, 1000));

      const response = await request(app)
        .get(`/admins/students/import/${jobId}`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.job).toBeDefined();
      expect(response.body.data.job.status).toBeDefined();
    });

    it("should return 404 for non-existent job", async () => {
      const response = await request(app)
        .get("/admins/students/import/INVALID-JOB-ID")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe("POST /admins/mentors/assign - Update Mentor Assignment", () => {
    it("should assign mentor to students", async () => {
      const assignData = {
        mentorId: mentor.mentorId,
        studentIds: [student.studentId],
      };

      const response = await request(app)
        .post("/admins/mentors/assign")
        .set("Authorization", `Bearer ${authToken}`)
        .send(assignData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.mentor).toBeDefined();

      const updatedMentor = await Mentor.findOne({ mentorId: mentor.mentorId });
      expect(updatedMentor.assignedStudents).toContainEqual(student._id);
    });

    it("should fail with missing mentorId", async () => {
      const response = await request(app)
        .post("/admins/mentors/assign")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ studentIds: [student.studentId] });

      expect(response.status).toBe(400);
    });
  });

  describe("POST /admins/credits/process - Process Credits", () => {
    it("should process credits for all students", async () => {
      const response = await request(app)
        .post("/admins/credits/process")
        .set("Authorization", `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.totalCredits).toBeDefined();
    });

    it("should process credits for specific student", async () => {
      const response = await request(app)
        .post("/admins/credits/process")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ studentId: student.studentId });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe("POST /admins/reports/system - Create System Report", () => {
    it("should generate system report", async () => {
      const reportData = {
        reportType: "admin",
      };

      const response = await request(app)
        .post("/admins/reports/system")
        .set("Authorization", `Bearer ${authToken}`)
        .send(reportData);

      expect([200, 202]).toContain(response.status);
      expect(response.body.success).toBe(true);
      expect(response.body.data.reportId).toBeDefined();
    });
  });

  describe("GET /admins/analytics/system - Read System Analytics", () => {
    it("should get system-wide analytics", async () => {
      const response = await request(app)
        .get("/admins/analytics/system")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.placements).toBeDefined();
    });
  });

  describe("GET /admins/analytics/college - Read College Analytics", () => {
    it("should get college analytics", async () => {
      const response = await request(app)
        .get("/admins/analytics/college")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.students).toBeDefined();
    });

    it("should filter by specific college", async () => {
      const response = await request(app)
        .get("/admins/analytics/college?college=Test University")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe("GET /admins/system/health - Read System Health", () => {
    it("should get system health status", async () => {
      const response = await request(app)
        .get("/admins/system/health")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.health).toBeDefined();
      expect(response.body.data.health.mongo).toBeDefined();
      expect(response.body.data.health.redis).toBeDefined();
      expect(response.body.data.health.uptime).toBeDefined();
    });
  });

  describe("GET /admins/ai/usage - Read AI Usage Stats", () => {
    it("should get AI usage statistics", async () => {
      const response = await request(app)
        .get("/admins/ai/usage")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.usage).toBeDefined();
      expect(response.body.data.costEstimateUSD).toBeDefined();
    });
  });

  describe("Authorization Tests", () => {
    it("should reject requests without authentication", async () => {
      const response = await request(app).get("/admins/dashboard");

      expect(response.status).toBe(401);
    });

    it("should reject requests from non-admin users", async () => {
      const { firebaseUser: studentFirebase } = await createTestStudent();
      const studentToken = await getAuthToken(studentFirebase);

      const response = await request(app)
        .get("/admins/dashboard")
        .set("Authorization", `Bearer ${studentToken}`);

      expect(response.status).toBe(403);
    });
  });
});
