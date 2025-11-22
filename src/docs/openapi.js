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
        properties: {
          idToken: { type: "string", description: "Firebase ID token (JWT)" },
          firebaseUid: { type: "string", description: "Dev-only: login by firebase UID" },
          email: { type: "string", format: "email", description: "Email for server-side sign-in (email+password)" },
          password: { type: "string", description: "Password for server-side sign-in" },
        },
        example: { email: "student@example.com", password: "strongPassword123" },
      },
      SendPasswordResetRequest: {
        type: "object",
        required: ["email"],
        properties: { email: { type: "string", format: "email" } },
        example: { email: "student@example.com" },
      },
      GenericMessage: {
        type: "object",
        properties: { success: { type: "boolean" }, message: { type: "string" } },
        example: { success: true, message: "Password reset email sent" },
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
        responses: {
          200: { description: "Authenticated" },
          400: { description: "Bad request" },
          403: { description: "Email not verified", content: { "application/json": { schema: { $ref: "#/components/schemas/GenericMessage" }, examples: { unverified: { value: { success: false, message: "Email not verified. Please verify your email before logging in." } } } } } },
        },
      },
    },
    "/auth/send-verification": {
      post: {
        summary: "Send an email verification to the current user",
        description: "Sends a Firebase email verification link to the authenticated user's email. Requires authentication (cookie or Bearer token).",
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: "Verification email sent", content: { "application/json": { schema: { $ref: "#/components/schemas/GenericMessage" } } } },
          401: { description: "Unauthorized" },
          500: { description: "Server error" },
        },
      },
    },
    "/auth/send-password-reset": {
      post: {
        summary: "Request a password reset email",
        description: "Sends a Firebase password-reset link to the provided email address. Public endpoint but rate-limited.",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/SendPasswordResetRequest" } } },
        },
        responses: {
          200: { description: "Password reset email sent", content: { "application/json": { schema: { $ref: "#/components/schemas/GenericMessage" } } } },
          400: { description: "Bad request" },
          429: { description: "Too many requests" },
          500: { description: "Server error" },
        },
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
    "/_tests/s3-upload": {
      post: {
        summary: "Upload a small sample image to configured storage (S3 or R2)",
        description: "Stores a tiny PNG to the configured storage provider and returns a public URL. Query `provider` may be `s3` or `r2`.",
        parameters: [
          { name: "provider", in: "query", schema: { type: "string", enum: ["s3", "r2"] }, description: "Provider to use (s3 or r2). Defaults to s3." },
        ],
        requestBody: {
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                properties: {
                  file: { type: "string", format: "binary", description: "File to upload (image). If omitted, a 1x1 PNG sample is uploaded." },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Upload result",
            content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean" }, provider: { type: "string" }, url: { type: "string" }, key: { type: "string" } } } } },
          },
          500: { description: "Upload failed" },
        },
      },
    },
    "/_tests/send-email": {
      post: {
        summary: "Send a test email via a selected provider",
        description: "Send a simple test email. Set `provider` to `brevo` or `mailgun` to force a provider. If omitted, the server will use the first configured provider.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["to", "subject"],
                properties: {
                  provider: { type: "string", enum: ["brevo", "mailgun"], description: "Force a specific provider" },
                  to: { type: "string", format: "email" },
                  subject: { type: "string" },
                  html: { type: "string" },
                  text: { type: "string" },
                },
              },
              example: { provider: "brevo", to: "you@example.com", subject: "Probe email", text: "Hello from Prashiskshan" },
            },
          },
        },
        responses: {
          200: { description: "Email sent or queued", content: { "application/json": { schema: { type: "object" } } } },
          400: { description: "Missing fields" },
          502: { description: "Provider error" },
        },
      },
    },
    "/_tests/queues": {
      get: {
        summary: "List BullMQ queues and basic status",
        description: "Returns counts and simple metrics for configured queues. Useful for smoke testing BullMQ connectivity.",
        responses: {
          200: { description: "Queues status", content: { "application/json": { schema: { type: "object" } } } },
        },
      },
    },
    "/_tests/queues/{queueKey}/enqueue": {
      post: {
        summary: "Enqueue a test job to a named queue",
        parameters: [{ name: "queueKey", in: "path", required: true, schema: { type: "string" }, description: "One of the registered queue keys (email, sms, logbook, report, notification, completion, ai)" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  jobName: { type: "string", description: "Job name identifier (optional)" },
                  data: { type: "object", description: "Payload for the job" },
                  options: { type: "object", description: "Job options for BullMQ (attempts, delay, etc)" },
                },
                example: { jobName: "test-job", data: { hello: "world" }, options: { attempts: 1 } },
              },
            },
          },
        },
        responses: {
          200: { description: "Job enqueued", content: { "application/json": { schema: { type: "object" } } } },
          404: { description: "Unknown queue key" },
        },
      },
    },
    "/_tests/queues/{queueKey}/jobs": {
      get: {
        summary: "List jobs for a queue",
        parameters: [
          { name: "queueKey", in: "path", required: true, schema: { type: "string" } },
          { name: "types", in: "query", schema: { type: "string" }, description: "Comma-separated types: waiting,active,delayed,completed,failed" },
        ],
        responses: { 200: { description: "Jobs list" } },
      },
    },
    "/_tests/queues/{queueKey}/jobs/{jobId}/promote": {
      post: {
        summary: "Promote a delayed job to waiting",
        parameters: [
          { name: "queueKey", in: "path", required: true, schema: { type: "string" } },
          { name: "jobId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { 200: { description: "Promoted" }, 404: { description: "Not found" } },
      },
    },
    "/_tests/queues/{queueKey}/jobs/{jobId}/remove": {
      post: {
        summary: "Remove a job from the queue",
        parameters: [
          { name: "queueKey", in: "path", required: true, schema: { type: "string" } },
          { name: "jobId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { 200: { description: "Removed" }, 404: { description: "Not found" } },
      },
    },
    "/_tests/queues/{queueKey}/process-next": {
      post: {
        summary: "Process the next waiting job with a temporary worker (dev only unless enabled)",
        parameters: [{ name: "queueKey", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { content: { "application/json": { schema: { type: "object", properties: { jobName: { type: "string" } } } } } },
        responses: { 200: { description: "Processed or timed out" }, 403: { description: "Disabled in production" } },
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
