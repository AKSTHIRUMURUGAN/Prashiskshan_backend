import request from "supertest";
import express from "express";
import authRouter from "../../src/routes/auth.js";
import { createTestStudent, createTestCompany, sampleStudentData, sampleCompanyData, getAuthToken } from "../helpers/testHelpers.js";
import Student from "../../src/models/Student.js";
import Company from "../../src/models/Company.js";

const app = express();
app.use(express.json());
app.use("/auth", authRouter);

describe("Auth Routes - CRUD Operations", () => {
  describe("POST /auth/students/register - Create Student", () => {
    it("should register a new student successfully", async () => {
      const studentData = {
        ...sampleStudentData,
        email: `newstudent${Date.now()}@test.com`,
      };

      const response = await request(app).post("/auth/students/register").send(studentData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.student).toBeDefined();
      expect(response.body.data.student.email).toBe(studentData.email);
      expect(response.body.data.student.profile.name).toBe(studentData.profile.name);
    });

    it("should fail with missing required fields", async () => {
      const invalidData = {
        email: "test@test.com",
        profile: {
          name: "Test",
        },
      };

      const response = await request(app).post("/auth/students/register").send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it("should fail with duplicate email", async () => {
      const { student } = await createTestStudent();
      const duplicateData = {
        ...sampleStudentData,
        email: student.email,
      };

      const response = await request(app).post("/auth/students/register").send(duplicateData);

      expect(response.status).toBe(409);
    });
  });

  describe("POST /auth/companies/register - Create Company", () => {
    it("should register a new company successfully", async () => {
      const companyData = {
        ...sampleCompanyData,
        email: `newcompany${Date.now()}@test.com`,
        documents: {
          ...sampleCompanyData.documents,
          cinNumber: `U72900${Date.now()}`,
        },
      };

      const response = await request(app).post("/auth/companies/register").send(companyData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.company).toBeDefined();
      expect(response.body.data.company.companyName).toBe(companyData.companyName);
    });

    it("should fail with missing CIN number", async () => {
      const invalidData = {
        ...sampleCompanyData,
        documents: {},
      };

      const response = await request(app).post("/auth/companies/register").send(invalidData);

      expect(response.status).toBe(400);
    });
  });

  describe("POST /auth/login - Login", () => {
    it("should login with valid token", async () => {
      const { student, firebaseUser } = await createTestStudent();
      const customToken = await getAuthToken(firebaseUser);

      const response = await request(app).post("/auth/login").send({
        idToken: customToken,
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
    });

    it("should fail with invalid token", async () => {
      const response = await request(app).post("/auth/login").send({
        idToken: "invalid-token",
      });

      expect(response.status).toBe(401);
    });
  });

  describe("GET /auth/me - Read Profile", () => {
    it("should get current user profile", async () => {
      const { student, firebaseUser } = await createTestStudent();
      const customToken = await getAuthToken(firebaseUser);

      const response = await request(app)
        .get("/auth/me")
        .set("Authorization", `Bearer ${customToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
    });

    it("should fail without authentication", async () => {
      const response = await request(app).get("/auth/me");

      expect(response.status).toBe(401);
    });
  });

  describe("PATCH /auth/me - Update Profile", () => {
    it("should update student profile", async () => {
      const { student, firebaseUser } = await createTestStudent();
      const customToken = await getAuthToken(firebaseUser);

      const updateData = {
        profile: {
          bio: "Updated bio",
          skills: ["JavaScript", "Python", "React"],
        },
      };

      const response = await request(app)
        .patch("/auth/me")
        .set("Authorization", `Bearer ${customToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.profile.bio).toBe(updateData.profile.bio);
    });

    it("should update company profile", async () => {
      const { company, firebaseUser } = await createTestCompany();
      const customToken = await getAuthToken(firebaseUser);

      const updateData = {
        phone: "+919999999999",
        address: "New Address",
      };

      const response = await request(app)
        .patch("/auth/me")
        .set("Authorization", `Bearer ${customToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe("POST /auth/password - Change Password", () => {
    it("should change password with valid token", async () => {
      const { firebaseUser } = await createTestStudent();
      const customToken = await getAuthToken(firebaseUser);

      const response = await request(app)
        .post("/auth/password")
        .set("Authorization", `Bearer ${customToken}`)
        .send({
          idToken: customToken,
          newPassword: "NewPassword123!@#",
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe("POST /auth/profile/image - Upload Profile Image", () => {
    it("should upload profile image", async () => {
      const { firebaseUser } = await createTestStudent();
      const customToken = await getAuthToken(firebaseUser);

      const response = await request(app)
        .post("/auth/profile/image")
        .set("Authorization", `Bearer ${customToken}`)
        .attach("file", Buffer.from("fake-image-data"), "test.jpg");

      expect([200, 201]).toContain(response.status);
    });
  });

  describe("POST /auth/profile/resume - Upload Resume", () => {
    it("should upload resume", async () => {
      const { firebaseUser } = await createTestStudent();
      const customToken = await getAuthToken(firebaseUser);

      const response = await request(app)
        .post("/auth/profile/resume")
        .set("Authorization", `Bearer ${customToken}`)
        .attach("file", Buffer.from("fake-pdf-data"), "resume.pdf");

      expect([200, 201]).toContain(response.status);
    });
  });

  describe("DELETE /auth/account - Delete Account", () => {
    it("should soft delete account", async () => {
      const { student, firebaseUser } = await createTestStudent();
      const customToken = await getAuthToken(firebaseUser);

      const response = await request(app)
        .delete("/auth/account")
        .set("Authorization", `Bearer ${customToken}`);

      expect(response.status).toBe(204);

      const deletedStudent = await Student.findById(student._id);
      expect(deletedStudent.status).toBe("deleted");
    });
  });
});
