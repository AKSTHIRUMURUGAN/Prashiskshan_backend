import request from "supertest";
import express from "express";
import mentorRouter from "../../src/routes/mentor.js";
import { createTestMentor, createTestStudent, createTestCompany, getAuthToken } from "../helpers/testHelpers.js";
import Internship from "../../src/models/Internship.js";
import Application from "../../src/models/Application.js";
import Logbook from "../../src/models/Logbook.js";

const app = express();
app.use(express.json());
app.use("/mentors", mentorRouter);

describe("Mentor Routes - CRUD Operations", () => {
  let mentor, firebaseUser, authToken, student, company, internship, application, logbook;

  beforeEach(async () => {
    const mentorData = await createTestMentor({
      profile: { department: "Computer Science" },
    });
    mentor = mentorData.mentor;
    firebaseUser = mentorData.firebaseUser;
    authToken = await getAuthToken(firebaseUser);

    const studentData = await createTestStudent({
      profile: { department: "Computer Science" },
    });
    student = studentData.student;

    const companyData = await createTestCompany();
    company = companyData.company;

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
      status: "pending",
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
      status: "submitted",
    });
  });

  describe("GET /mentors/dashboard - Read Dashboard", () => {
    it("should get mentor dashboard", async () => {
      const response = await request(app)
        .get("/mentors/dashboard")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.stats).toBeDefined();
    });
  });

  describe("GET /mentors/applications/pending - Read Pending Applications", () => {
    it("should get pending applications", async () => {
      const response = await request(app)
        .get("/mentors/applications/pending")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.applications)).toBe(true);
    });
  });

  describe("GET /mentors/applications/:applicationId - Read Application Details", () => {
    it("should get application details", async () => {
      const response = await request(app)
        .get(`/mentors/applications/${application._id}`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.application).toBeDefined();
    });
  });

  describe("POST /mentors/applications/:applicationId/approve - Update Application", () => {
    it("should approve application", async () => {
      const response = await request(app)
        .post(`/mentors/applications/${application._id}/approve`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          comments: "Great candidate",
          recommendedPreparation: ["Review Node.js", "Practice algorithms"],
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe("POST /mentors/applications/:applicationId/reject - Update Application", () => {
    it("should reject application", async () => {
      const response = await request(app)
        .post(`/mentors/applications/${application._id}/reject`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          comments: "Needs more experience",
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe("GET /mentors/logbooks/pending - Read Pending Logbooks", () => {
    it("should get pending logbooks", async () => {
      const response = await request(app)
        .get("/mentors/logbooks/pending")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.logbooks)).toBe(true);
    });
  });

  describe("GET /mentors/logbooks/:logbookId - Read Logbook Details", () => {
    it("should get logbook details", async () => {
      const response = await request(app)
        .get(`/mentors/logbooks/${logbook._id}`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.logbook).toBeDefined();
    });
  });

  describe("POST /mentors/logbooks/:logbookId/approve - Update Logbook", () => {
    it("should approve logbook", async () => {
      const response = await request(app)
        .post(`/mentors/logbooks/${logbook._id}/approve`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          comments: "Good work",
          creditsApproved: 1,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe("POST /mentors/logbooks/:logbookId/revision - Update Logbook", () => {
    it("should request logbook revision", async () => {
      const response = await request(app)
        .post(`/mentors/logbooks/${logbook._id}/revision`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          comments: "Please add more details",
          suggestions: ["Include specific examples", "Add technical details"],
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe("GET /mentors/skill-gaps - Read Skill Gap Analysis", () => {
    it("should get skill gap analysis", async () => {
      const response = await request(app)
        .get("/mentors/skill-gaps")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe("GET /mentors/department/performance - Read Performance", () => {
    it("should get department performance", async () => {
      const response = await request(app)
        .get("/mentors/department/performance")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe("POST /mentors/interventions - Create Intervention", () => {
    it("should create intervention", async () => {
      const interventionData = {
        title: "Python Workshop",
        description: "Workshop for Python programming",
        targetStudents: [student.studentId],
        modules: ["PY101", "PY102"],
      };

      const response = await request(app)
        .post("/mentors/interventions")
        .set("Authorization", `Bearer ${authToken}`)
        .send(interventionData);

      expect([200, 201]).toContain(response.status);
      expect(response.body.success).toBe(true);
    });
  });

  describe("GET /mentors/interventions - Read Interventions", () => {
    it("should get all interventions", async () => {
      const response = await request(app)
        .get("/mentors/interventions")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe("GET /mentors/students/:studentId/progress - Read Student Progress", () => {
    it("should get student progress", async () => {
      const response = await request(app)
        .get(`/mentors/students/${student.studentId}/progress`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.student).toBeDefined();
    });
  });
});
