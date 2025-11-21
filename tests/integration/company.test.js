import request from "supertest";
import express from "express";
import companyRouter from "../../src/routes/company.js";
import { createTestCompany, createTestStudent, getAuthToken } from "../helpers/testHelpers.js";
import Internship from "../../src/models/Internship.js";
import Application from "../../src/models/Application.js";
import Logbook from "../../src/models/Logbook.js";

const app = express();
app.use(express.json());
app.use("/companies", companyRouter);

describe("Company Routes - CRUD Operations", () => {
  let company, firebaseUser, authToken, student, internship, application, logbook;

  beforeEach(async () => {
    const companyData = await createTestCompany({ status: "verified" });
    company = companyData.company;
    firebaseUser = companyData.firebaseUser;
    authToken = await getAuthToken(firebaseUser);

    const studentData = await createTestStudent();
    student = studentData.student;

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

    application = await Application.create({
      applicationId: `APP-${Date.now()}`,
      studentId: student._id,
      internshipId: internship._id,
      companyId: company._id,
      department: "Computer Science",
      coverLetter: "Test application",
      status: "mentor_approved",
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
      status: "pending_company_review",
    });
  });

  describe("GET /companies/dashboard - Read Dashboard", () => {
    it("should get company dashboard", async () => {
      const response = await request(app)
        .get("/companies/dashboard")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.metrics).toBeDefined();
    });
  });

  describe("GET /companies/profile - Read Profile", () => {
    it("should get company profile", async () => {
      const response = await request(app)
        .get("/companies/profile")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.company).toBeDefined();
    });
  });

  describe("PATCH /companies/profile - Update Profile", () => {
    it("should update company profile", async () => {
      const updateData = {
        phone: "+919999999999",
        address: "New Address, Mumbai",
      };

      const response = await request(app)
        .patch("/companies/profile")
        .set("Authorization", `Bearer ${authToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe("POST /companies/internships - Create Internship", () => {
    it("should create new internship", async () => {
      const internshipData = {
        title: "Data Science Intern",
        description: "Work on machine learning projects and data analysis tasks",
        department: "Computer Science",
        requiredSkills: ["Python", "Machine Learning", "Pandas"],
        duration: "6 months",
        stipend: 20000,
        location: "Bangalore",
        workMode: "remote",
        startDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        applicationDeadline: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
        slots: 3,
      };

      const response = await request(app)
        .post("/companies/internships")
        .set("Authorization", `Bearer ${authToken}`)
        .send(internshipData);

      expect([200, 201]).toContain(response.status);
      expect(response.body.success).toBe(true);
      expect(response.body.data.internship).toBeDefined();
    });
  });

  describe("GET /companies/internships - Read Internships", () => {
    it("should get all company internships", async () => {
      const response = await request(app)
        .get("/companies/internships")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.internships)).toBe(true);
    });
  });

  describe("PUT /companies/internships/:internshipId - Update Internship", () => {
    it("should update internship", async () => {
      const updateData = {
        title: "Updated Software Development Intern",
        description: "Updated description",
      };

      const response = await request(app)
        .put(`/companies/internships/${internship._id}`)
        .set("Authorization", `Bearer ${authToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe("DELETE /companies/internships/:internshipId - Delete Internship", () => {
    it("should delete internship", async () => {
      const response = await request(app)
        .delete(`/companies/internships/${internship._id}`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(204);
    });
  });

  describe("GET /companies/internships/:internshipId/applicants - Read Applicants", () => {
    it("should get applicants for internship", async () => {
      const response = await request(app)
        .get(`/companies/internships/${internship._id}/applicants`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.applications)).toBe(true);
    });
  });

  describe("POST /companies/applications/review - Update Applications", () => {
    it("should review applications", async () => {
      const reviewData = {
        updates: [
          {
            applicationId: application._id.toString(),
            status: "shortlisted",
            feedback: "Great candidate",
            nextSteps: "Technical interview scheduled",
          },
        ],
      };

      const response = await request(app)
        .post("/companies/applications/review")
        .set("Authorization", `Bearer ${authToken}`)
        .send(reviewData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe("POST /companies/applications/shortlist - Update Applications", () => {
    it("should shortlist candidates", async () => {
      const response = await request(app)
        .post("/companies/applications/shortlist")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          applicationIds: [application._id.toString()],
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe("POST /companies/applications/reject - Update Applications", () => {
    it("should reject candidates", async () => {
      const response = await request(app)
        .post("/companies/applications/reject")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          applicationIds: [application._id.toString()],
          reason: "Not a good fit",
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe("GET /companies/interns/progress - Read Intern Progress", () => {
    it("should get intern progress", async () => {
      const response = await request(app)
        .get("/companies/interns/progress")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe("POST /companies/logbooks/:logbookId/feedback - Update Logbook", () => {
    it("should provide logbook feedback", async () => {
      const feedbackData = {
        rating: 5,
        technicalPerformance: 5,
        communication: 4,
        initiative: 5,
        comments: "Excellent work",
        appreciation: "Great job on the API implementation",
        improvements: "Could improve documentation",
        tasksForNextWeek: ["Add unit tests", "Implement error handling"],
      };

      const response = await request(app)
        .post(`/companies/logbooks/${logbook._id}/feedback`)
        .set("Authorization", `Bearer ${authToken}`)
        .send(feedbackData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe("POST /companies/internships/:internshipId/complete - Update Internship", () => {
    it("should mark internship as complete", async () => {
      const response = await request(app)
        .post(`/companies/internships/${internship._id}/complete`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe("POST /companies/events - Create Event", () => {
    it("should create event", async () => {
      const eventData = {
        title: "Tech Talk: AI in Industry",
        description: "Learn about AI applications",
        date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        targetDepartments: ["Computer Science"],
      };

      const response = await request(app)
        .post("/companies/events")
        .set("Authorization", `Bearer ${authToken}`)
        .send(eventData);

      expect([200, 201]).toContain(response.status);
      expect(response.body.success).toBe(true);
    });
  });

  describe("POST /companies/challenges - Create Challenge", () => {
    it("should create challenge", async () => {
      const challengeData = {
        title: "Build a REST API",
        description: "Create a RESTful API with authentication",
        rewards: "Internship opportunity",
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      };

      const response = await request(app)
        .post("/companies/challenges")
        .set("Authorization", `Bearer ${authToken}`)
        .send(challengeData);

      expect([200, 201]).toContain(response.status);
      expect(response.body.success).toBe(true);
    });
  });
});

