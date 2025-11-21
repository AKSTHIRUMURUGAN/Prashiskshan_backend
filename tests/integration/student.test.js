import request from "supertest";
import express from "express";
import studentRouter from "../../src/routes/student.js";
import { createTestStudent, createTestCompany, getAuthToken } from "../helpers/testHelpers.js";
import Internship from "../../src/models/Internship.js";
import Application from "../../src/models/Application.js";
import Logbook from "../../src/models/Logbook.js";
import InterviewSession from "../../src/models/InterviewSession.js";

const app = express();
app.use(express.json());
app.use("/students", studentRouter);

describe("Student Routes - CRUD Operations", () => {
  let student, firebaseUser, authToken, company, internship;

  beforeEach(async () => {
    const studentData = await createTestStudent();
    student = studentData.student;
    firebaseUser = studentData.firebaseUser;
    authToken = await getAuthToken(firebaseUser);

    const companyData = await createTestCompany();
    company = companyData.company;

    internship = await Internship.create({
      internshipId: `INTERN-${Date.now()}`,
      companyId: company._id,
      title: "Software Development Intern",
      description: "Join our team as a software development intern",
      department: "Computer Science",
      requiredSkills: ["JavaScript", "Node.js"],
      duration: "3 months",
      stipend: 15000,
      location: "Mumbai",
      workMode: "hybrid",
      startDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      applicationDeadline: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      slots: 5,
      status: "approved",
      postedBy: company.companyId,
      postedAt: new Date(),
    });
  });

  describe("GET /students/dashboard - Read Dashboard", () => {
    it("should get student dashboard", async () => {
      const response = await request(app)
        .get("/students/dashboard")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.student).toBeDefined();
      expect(response.body.data.stats).toBeDefined();
    });
  });

  describe("GET /students/internships - Browse Internships", () => {
    it("should list available internships", async () => {
      const response = await request(app)
        .get("/students/internships")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.items)).toBe(true);
    });

    it("should filter internships by department", async () => {
      const response = await request(app)
        .get("/students/internships?department=Computer Science")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
    });
  });

  describe("GET /students/internships/recommended - Get Recommendations", () => {
    it("should get recommended internships", async () => {
      const response = await request(app)
        .get("/students/internships/recommended")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe("POST /students/applications - Create Application", () => {
    it("should apply to internship", async () => {
      const applicationData = {
        internshipId: internship._id.toString(),
        coverLetter: "I am very interested in this position and believe I have the skills required.",
      };

      const response = await request(app)
        .post("/students/applications")
        .set("Authorization", `Bearer ${authToken}`)
        .send(applicationData);

      expect([200, 201]).toContain(response.status);
      expect(response.body.success).toBe(true);
      expect(response.body.data.application).toBeDefined();
    });

    it("should fail with invalid internship ID", async () => {
      const response = await request(app)
        .post("/students/applications")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          internshipId: "invalid-id",
          coverLetter: "Test cover letter",
        });

      expect(response.status).toBe(400);
    });
  });

  describe("GET /students/applications - Read Applications", () => {
    it("should get all student applications", async () => {
      await Application.create({
        applicationId: `APP-${Date.now()}`,
        studentId: student._id,
        internshipId: internship._id,
        companyId: company._id,
        department: "Computer Science",
        coverLetter: "Test application",
      });

      const response = await request(app)
        .get("/students/applications")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.applications)).toBe(true);
    });
  });

  describe("DELETE /students/applications/:applicationId - Delete Application", () => {
    it("should withdraw application", async () => {
      const application = await Application.create({
        applicationId: `APP-${Date.now()}`,
        studentId: student._id,
        internshipId: internship._id,
        companyId: company._id,
        department: "Computer Science",
        coverLetter: "Test application",
        status: "pending",
      });

      const response = await request(app)
        .delete(`/students/applications/${application._id}`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe("POST /students/modules/start - Create Module Progress", () => {
    it("should start a module", async () => {
      const response = await request(app)
        .post("/students/modules/start")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          moduleCode: "CS101",
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe("POST /students/modules/complete - Update Module", () => {
    it("should complete a module", async () => {
      student.moduleProgress.push({
        code: "CS101",
        status: "in_progress",
        startedAt: new Date(),
      });
      await student.save();

      const response = await request(app)
        .post("/students/modules/complete")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          moduleCode: "CS101",
          score: 85,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe("POST /students/interviews/start - Create Interview", () => {
    it("should start interview practice", async () => {
      const response = await request(app)
        .post("/students/interviews/start")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          domain: "Backend Development",
          difficulty: "beginner",
        });

      expect([200, 201]).toContain(response.status);
    });
  });

  describe("POST /students/interviews/answer - Update Interview", () => {
    it("should submit interview answer", async () => {
      const session = await InterviewSession.create({
        sessionId: `INT-${Date.now()}`,
        studentId: student._id,
        domain: "Backend Development",
        difficulty: "beginner",
        status: "active",
        conversationHistory: [
          {
            role: "model",
            parts: [{ text: "Tell me about yourself" }],
          },
        ],
        questionCount: 1,
      });

      const response = await request(app)
        .post("/students/interviews/answer")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          sessionId: session.sessionId,
          answer: "I am a computer science student with experience in Node.js",
        });

      expect([200, 201]).toContain(response.status);
    });
  });

  describe("POST /students/logbooks - Create Logbook", () => {
    it("should submit logbook", async () => {
      const logbookData = {
        internshipId: internship._id.toString(),
        weekNumber: 1,
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        hoursWorked: 40,
        activities: "Worked on backend API development, implemented REST endpoints, wrote unit tests",
        tasksCompleted: ["API endpoints", "Database schema"],
        skillsUsed: ["Node.js", "Express", "MongoDB"],
        learnings: "Learned about RESTful API design and database optimization",
        challenges: "Understanding complex database queries",
      };

      const response = await request(app)
        .post("/students/logbooks")
        .set("Authorization", `Bearer ${authToken}`)
        .send(logbookData);

      expect([200, 201]).toContain(response.status);
      expect(response.body.success).toBe(true);
    });
  });

  describe("GET /students/logbooks - Read Logbooks", () => {
    it("should get all student logbooks", async () => {
      await Logbook.create({
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
      });

      const response = await request(app)
        .get("/students/logbooks")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.logbooks)).toBe(true);
    });
  });

  describe("GET /students/credits - Read Credits", () => {
    it("should get credits summary", async () => {
      const response = await request(app)
        .get("/students/credits")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe("POST /students/reports/nep - Generate Report", () => {
    it("should generate NEP report", async () => {
      const response = await request(app)
        .post("/students/reports/nep")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          internshipId: internship._id.toString(),
        });

      expect([200, 202]).toContain(response.status);
    });
  });
});
