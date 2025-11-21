const openapi = {
  openapi: "3.0.0",
  info: {
    title: "Prashiskshan API",
    version: "0.1.0",
    description: "OpenAPI documentation for the Prashiskshan internship management backend.",
  },
  servers: [{ url: "/api", description: "Local API base (mounted under /api)" }],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
    schemas: {
      StudentRegistration: {
        type: "object",
        required: ["email", "password", "profile"],
        properties: {
          email: { type: "string", format: "email" },
          password: { type: "string" },
          phone: { type: "string" },
          preferences: { type: "object" },
          profile: {
            type: "object",
            properties: {
              name: { type: "string" },
              department: { type: "string" },
              year: { type: "integer", description: "Year of study (1-5)" },
              college: { type: "string" },
            },
          },
        },
        example: {
          email: "student@example.com",
          password: "strongPassword123",
          phone: "9876543210",
          profile: {
            name: "Priya Rao",
            department: "Computer Science",
            year: 3,
            college: "ABC Institute of Technology",
          },
          preferences: { remoteOnly: false },
        },
      },
      ValidationError: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          error: { type: "string" },
          details: {
            type: "array",
            items: {
              type: "object",
              properties: { field: { type: "string" }, message: { type: "string" } },
            },
          },
        },
        example: {
          success: false,
          error: "ValidationError",
          details: [
            { field: "profile.year", message: "Year must be between 1 and 5" },
            { field: "phone", message: "Phone must be a valid Indian mobile number" },
          ],
        },
      },
      CompanyRegistration: {
        type: "object",
        required: ["email", "password", "companyName", "website", "phone", "address", "documents"],
        properties: {
          email: { type: "string", format: "email" },
          password: { type: "string" },
          companyName: { type: "string" },
          website: { type: "string", format: "uri" },
          phone: { type: "string" },
          address: { type: "string" },
          documents: {
            type: "object",
            required: ["cinNumber"],
            properties: {
              cinNumber: { type: "string", description: "Company CIN/registration number" },
              gstNumber: { type: "string" },
            },
          },
          pointOfContact: {
            type: "object",
            properties: {
              name: { type: "string" },
              email: { type: "string", format: "email" },
              phone: { type: "string" },
            },
          },
        },
        example: {
          email: "hr@company.com",
          password: "securePassword!234",
          companyName: "Example Corp",
          website: "https://example.com",
          phone: "9876543210",
          address: "12 Corporate Park, Mumbai",
          documents: { cinNumber: "U12345MH2025PTC000000", gstNumber: "27AAAAA0000A1Z5" },
          pointOfContact: { name: "Ramesh Kumar", email: "ramesh@example.com", phone: "9876543210" },
        },
      },
      LoginRequest: {
        type: "object",
        required: ["idToken"],
        properties: { idToken: { type: "string" } },
      },
    },
  },
  paths: {
    "/health": {
      get: {
        summary: "Health check",
        responses: { 200: { description: "OK" } },
      },
    },
    "/auth/students/register": {
      post: {
        summary: "Register a new student",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/StudentRegistration" },
              examples: {
                valid: { value: { email: "student@example.com", password: "strongPassword123", profile: { name: "Priya Rao", department: "Computer Science", year: 3, college: "ABC Institute" }, phone: "9876543210" } },
                invalidYear: { value: { email: "s@example.com", password: "pwd", profile: { name: "A", department: "CS", year: 6, college: "X" }, phone: "12345" } },
              },
            },
          },
        },
        responses: {
          "201": { description: "Student created" },
          "400": { description: "Bad request", content: { "application/json": { schema: { $ref: "#/components/schemas/ValidationError" } } } },
        },
      },
    },
    "/auth/companies/register": {
      post: {
        summary: "Register a new company",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CompanyRegistration" },
              examples: {
                valid: { value: { email: "hr@company.com", password: "securePassword!234", companyName: "Example Corp", website: "https://example.com", phone: "9876543210", address: "12 Corporate Park", documents: { cinNumber: "U12345MH2025PTC000000" }, pointOfContact: { name: "Ramesh Kumar", email: "ramesh@example.com", phone: "9876543210" } } },
                missingCin: { value: { email: "hr@company.com", password: "pwd", companyName: "Example", website: "https://example.com", phone: "9876543210", address: "Addr", documents: {} } },
              },
            },
          },
        },
        responses: { 
          "201": { description: "Company created" },
          "400": { description: "Bad request", content: { "application/json": { schema: { $ref: "#/components/schemas/ValidationError" } } } },
        },
      },
    },
    "/auth/login": {
      post: {
        summary: "Login (verify Firebase idToken)",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/LoginRequest" } } },
        },
        responses: { 200: { description: "Authenticated" }, 400: { description: "Bad request" } },
      },
    },
    "/auth/me": {
      get: {
        summary: "Get current user profile",
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: "Current profile" }, 401: { description: "Unauthorized" } },
      },
      patch: {
        summary: "Update current user profile",
        security: [{ BearerAuth: [] }],
        requestBody: { content: { "application/json": { schema: { type: "object" } } } },
        responses: { 200: { description: "Updated" } },
      },
    },
    "/auth/profile/image": {
      post: {
        summary: "Upload profile image",
        security: [{ BearerAuth: [] }],
        requestBody: { content: { "multipart/form-data": { schema: { type: "object", properties: { file: { type: "string", format: "binary" } } } } } },
        responses: { 200: { description: "Image uploaded" } },
      },
    },
    "/auth/profile/resume": {
      post: {
        summary: "Upload resume (PDF)",
        security: [{ BearerAuth: [] }],
        requestBody: { content: { "multipart/form-data": { schema: { type: "object", properties: { file: { type: "string", format: "binary" } } } } } },
        responses: { 200: { description: "Resume uploaded" }, 400: { description: "Bad request" } },
      },
    },
    "/auth/account": {
      delete: {
        summary: "Soft-delete current user account",
        security: [{ BearerAuth: [] }],
        responses: { 204: { description: "Deleted" } },
      },
    },
    "/_tests": {
      get: {
        summary: "Integration status and optional probes",
        description: "Returns whether integrations are configured. Use query `probe=true` to attempt live probes (may perform network calls).",
        parameters: [
          { name: "probe", in: "query", schema: { type: "boolean" }, description: "When true, the server will attempt small live probes (may take up to 5s)" },
        ],
        responses: {
          200: {
            description: "Integration summary",
            content: {
              "application/json": {
                schema: { type: "object" },
              },
            },
          },
        },
      },
    },
    "/_status": {
      get: {
        summary: "Server status and Firebase credential diagnostics",
        description: "Returns whether the server is using the Firebase emulator or real Firebase, and which credential source is active (env, firebase.json, or GOOGLE_APPLICATION_CREDENTIALS).",
        responses: {
          200: {
            description: "Status information",
            content: {
              "application/json": {
                schema: { type: "object" },
              },
            },
          },
        },
      },
    },
  },
};

export default openapi;
