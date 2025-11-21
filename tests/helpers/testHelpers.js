import request from "supertest";
import express from "express";
import Student from "../../src/models/Student.js";
import Mentor from "../../src/models/Mentor.js";
import Admin from "../../src/models/Admin.js";
import Company from "../../src/models/Company.js";
import { firebaseAdmin } from "../../src/config/firebase.js";

export const createTestApp = () => {
  const app = express();
  app.use(express.json());
  return app;
};

// Mock user storage for tests when Firebase isn't available
const mockUsers = new Map();
let firebaseAdminAvailable = null; // Cache Firebase Admin availability check
let mockModeLogged = false; // Track if we've logged that we're using mock mode

// Check if Firebase Admin is properly configured and usable
const isFirebaseAdminAvailable = async () => {
  if (firebaseAdminAvailable !== null) {
    return firebaseAdminAvailable;
  }
  
  if (!firebaseAdmin || !firebaseAdmin.auth) {
    firebaseAdminAvailable = false;
    return false;
  }
  
  try {
    // Check if we have a valid project ID (not the test default)
    let projectId = null;
    try {
      const apps = firebaseAdmin.apps;
      if (apps && apps.length > 0) {
        projectId = apps[0].options?.projectId;
      }
    } catch (error) {
      // If we can't access app options, assume not configured
      firebaseAdminAvailable = false;
      return false;
    }
    
    // If project ID is test-project or missing, Firebase Admin is not properly configured
    if (!projectId || projectId === "test-project") {
      firebaseAdminAvailable = false;
      return false;
    }
    
    // If we have a valid project ID, Firebase Admin might work
    // We'll still catch errors when actually using it
    firebaseAdminAvailable = true;
    return true;
  } catch (error) {
    firebaseAdminAvailable = false;
    return false;
  }
};

export const createMockFirebaseUser = async (email, uid = null) => {
  try {
    const userData = {
      email,
      password: "Test123!@#",
    };
    if (uid) {
      userData.uid = uid;
    }
    
    // Check if Firebase Admin is available before trying to use it
    const isAvailable = await isFirebaseAdminAvailable();
    
    // Try to use real Firebase Admin only if it's properly configured
    if (isAvailable && firebaseAdmin && firebaseAdmin.auth) {
      try {
        const user = await firebaseAdmin.auth().createUser(userData);
        return user;
      } catch (firebaseError) {
        if (firebaseError.code === "auth/email-already-exists") {
          try {
            return await firebaseAdmin.auth().getUserByEmail(email);
          } catch (getUserError) {
            // If getUserByEmail also fails, fall through to mock
          }
        }
        // If Firebase fails due to config issues, silently fall back to mock
        // Don't log warnings in test mode - it's expected
        if (firebaseError.message?.includes("configuration") || 
            firebaseError.message?.includes("identifier") ||
            firebaseError.code === "auth/configuration-not-found") {
          // Silently fall through to mock user creation
        } else {
          // For other errors, still try mock as fallback
        }
      }
    }
    
    // Create mock user (this is the normal path in test mode)
    if (!mockModeLogged && process.env.NODE_ENV === "test") {
      console.log("ℹ️  Test mode: Using mock Firebase users (Firebase Admin not configured)");
      mockModeLogged = true;
    }
    
    const mockUid = uid || `mock-uid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const mockUser = {
      uid: mockUid,
      email,
      emailVerified: false,
      disabled: false,
      metadata: {
        creationTime: new Date().toISOString(),
        lastSignInTime: null,
      },
    };
    mockUsers.set(email, mockUser);
    return mockUser;
  } catch (error) {
    // Final fallback: return mock user even on error
    const mockUid = uid || `mock-uid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    return {
      uid: mockUid,
      email,
      emailVerified: false,
      disabled: false,
      metadata: {
        creationTime: new Date().toISOString(),
        lastSignInTime: null,
      },
    };
  }
};

export const createTestStudent = async (overrides = {}) => {
  const firebaseUser = await createMockFirebaseUser(overrides.email || `student${Date.now()}@test.com`);
  const student = await Student.create({
    studentId: `STD-${Date.now()}`,
    firebaseUid: firebaseUser.uid,
    email: firebaseUser.email,
    profile: {
      name: "Test Student",
      department: "Computer Science",
      year: 3,
      college: "Test University",
      ...overrides.profile,
    },
    ...overrides,
  });
  return { student, firebaseUser };
};

export const createTestMentor = async (overrides = {}) => {
  const firebaseUser = await createMockFirebaseUser(overrides.email || `mentor${Date.now()}@test.com`);
  const mentor = await Mentor.create({
    mentorId: `MEN-${Date.now()}`,
    firebaseUid: firebaseUser.uid,
    email: firebaseUser.email,
    profile: {
      name: "Test Mentor",
      department: "Computer Science",
      ...overrides.profile,
    },
    ...overrides,
  });
  return { mentor, firebaseUser };
};

export const createTestAdmin = async (overrides = {}) => {
  const firebaseUser = await createMockFirebaseUser(overrides.email || `admin${Date.now()}@test.com`);
  const admin = await Admin.create({
    adminId: `ADM-${Date.now()}`,
    firebaseUid: firebaseUser.uid,
    email: firebaseUser.email,
    name: "Test Admin",
    ...overrides,
  });
  return { admin, firebaseUser };
};

export const createTestCompany = async (overrides = {}) => {
  const firebaseUser = await createMockFirebaseUser(overrides.email || `company${Date.now()}@test.com`);
  const company = await Company.create({
    companyId: `COM-${Date.now()}`,
    firebaseUid: firebaseUser.uid,
    companyName: "Test Company",
    website: "https://testcompany.com",
    email: firebaseUser.email,
    phone: "+919876543210",
    address: "123 Test St",
    documents: {
      cinNumber: `U12345${Date.now()}`,
    },
    pointOfContact: {
      name: "Test Contact",
      email: "contact@testcompany.com",
      phone: "+919876543210",
    },
    status: "verified",
    ...overrides,
  });
  return { company, firebaseUser };
};

export const getAuthToken = async (firebaseUser) => {
  const isAvailable = await isFirebaseAdminAvailable();
  
  if (isAvailable && firebaseAdmin && firebaseAdmin.auth) {
    try {
      const customToken = await firebaseAdmin.auth().createCustomToken(firebaseUser.uid);
      return customToken;
    } catch (error) {
      // Silently fall back to mock token in test mode
    }
  }
  // Return mock token (normal in test mode)
  return `mock-custom-token-${firebaseUser.uid}`;
};

export const sampleStudentData = {
  email: `student${Date.now()}@test.com`,
  password: "Test123!@#",
  profile: {
    name: "John Doe",
    department: "Computer Science",
    year: 3,
    college: "Test University",
    rollNumber: "CS2024001",
    phone: "+919876543210",
    bio: "Passionate about software development",
    skills: ["JavaScript", "Node.js", "React"],
    interests: ["Web Development", "AI"],
  },
};

export const sampleCompanyData = {
  email: `company${Date.now()}@test.com`,
  password: "Test123!@#",
  companyName: "Tech Solutions Inc",
  website: "https://techsolutions.com",
  phone: "+919876543210",
  address: "456 Business Park, Mumbai",
  documents: {
    cinNumber: `U72900${Date.now()}`,
    gstCertificate: "https://example.com/gst.pdf",
  },
  pointOfContact: {
    name: "Jane Smith",
    designation: "HR Manager",
    email: "hr@techsolutions.com",
    phone: "+919876543211",
  },
};

export const sampleInternshipData = {
  title: "Full Stack Development Intern",
  description: "Join our dynamic team as a full stack development intern. You'll work on cutting-edge web applications using modern technologies like React, Node.js, and MongoDB. This is a great opportunity to gain real-world experience in software development.",
  department: "Computer Science",
  requiredSkills: ["JavaScript", "Node.js", "React", "MongoDB"],
  optionalSkills: ["TypeScript", "Docker", "AWS"],
  duration: "6 months",
  stipend: 20000,
  location: "Bangalore",
  workMode: "hybrid",
  startDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  applicationDeadline: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
  slots: 5,
  responsibilities: [
    "Develop and maintain web applications",
    "Write clean, maintainable code",
    "Collaborate with cross-functional teams",
    "Participate in code reviews",
  ],
  learningOpportunities: [
    "Mentorship from senior developers",
    "Exposure to industry best practices",
    "Hands-on experience with modern tech stack",
  ],
  eligibilityRequirements: {
    minYear: 2,
    minReadinessScore: 60,
    requiredModules: ["CS101", "CS102"],
  },
};

export const sampleApplicationData = {
  coverLetter:
    "I am writing to express my strong interest in the Full Stack Development Intern position. With a solid foundation in JavaScript, Node.js, and React, I am excited about the opportunity to contribute to your team while further developing my skills. I have completed relevant coursework and have worked on several personal projects that demonstrate my passion for web development.",
  resumeUrl: "https://example.com/resume.pdf",
};

export const sampleLogbookData = {
  weekNumber: 1,
  startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  endDate: new Date().toISOString(),
  hoursWorked: 40,
  activities:
    "This week, I focused on understanding the project architecture and codebase. I set up the development environment, reviewed existing code, and attended team meetings. I also started working on implementing REST API endpoints for user authentication. I wrote unit tests for the authentication module and fixed several bugs in the existing codebase.",
  tasksCompleted: [
    "Set up development environment",
    "Implemented user authentication endpoints",
    "Wrote unit tests for auth module",
    "Fixed bugs in existing code",
  ],
  skillsUsed: ["Node.js", "Express", "MongoDB", "Jest", "REST API"],
  challenges:
    "Initially struggled with understanding the complex database schema, but with help from my mentor, I was able to grasp the relationships between different collections.",
  learnings:
    "Learned about JWT authentication implementation, database query optimization, and best practices for writing maintainable code. Also gained insights into the importance of comprehensive testing.",
};

export const sampleInterviewData = {
  domain: "Backend Development",
  difficulty: "intermediate",
};

export const sampleModuleData = {
  moduleCode: "CS301",
  moduleName: "Advanced Web Development",
  description: "Learn advanced concepts in web development",
  estimatedTime: "4 weeks",
  difficulty: "intermediate",
};

export const sampleMentorData = {
  email: `mentor${Date.now()}@test.com`,
  password: "Test123!@#",
  profile: {
    name: "Dr. Sarah Johnson",
    department: "Computer Science",
    designation: "Associate Professor",
    expertiseAreas: ["Web Development", "Database Systems", "Software Engineering"],
    bio: "Experienced mentor with 10+ years in academia and industry",
    phone: "+919876543212",
  },
};

export const sampleAdminData = {
  email: `admin${Date.now()}@test.com`,
  password: "Test123!@#",
  name: "Admin User",
  role: "admin",
};


