import swaggerJSDoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";

const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Indicator API Gateway",
      version: "1.0.0",
      description:
        "Unified API Gateway for the Indicator microservices architecture",
      contact: {
        name: "API Support",
        email: "support@pollak.info",
      },
    },
    servers: [
      {
        url: "http://localhost:5000",
        description: "Development Gateway Server",
      },
      {
        url: "https://api.indikator.pollak.info",
        description: "Production Gateway Server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "JWT token obtained from /api/v1/auth/login",
        },
      },
      responses: {
        UnauthorizedError: {
          description: "Authentication information is missing or invalid",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  message: {
                    type: "string",
                    example: "Authorization header is missing",
                  },
                },
              },
            },
          },
        },
        ServiceUnavailable: {
          description: "Service is currently unavailable",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  error: {
                    type: "string",
                    example: "Service Unavailable",
                  },
                  message: {
                    type: "string",
                    example: "Login service is currently unavailable",
                  },
                  service: {
                    type: "string",
                    example: "login_service",
                  },
                },
              },
            },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ["./controllers/*.js", "./index.js"],
};

const swaggerSpec = swaggerJSDoc(swaggerOptions);

// Add service-specific documentation
swaggerSpec.paths = {
  ...swaggerSpec.paths,
  "/api/v1/auth/login": {
    post: {
      tags: ["Authentication"],
      summary: "User login",
      description:
        "Authenticate user and receive JWT tokens (Proxied to Login Service)",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["email", "password"],
              properties: {
                email: {
                  type: "string",
                  format: "email",
                  example: "user@example.com",
                },
                password: {
                  type: "string",
                  format: "password",
                  example: "password123",
                },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: "Authentication successful",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  email: { type: "string" },
                  name: { type: "string" },
                  accessToken: { type: "string" },
                  refreshToken: { type: "string" },
                },
              },
            },
          },
        },
        401: { description: "Invalid credentials" },
        503: { $ref: "#/components/responses/ServiceUnavailable" },
      },
    },
  },
  "/api/v1/auth/refresh": {
    post: {
      tags: ["Authentication"],
      summary: "Refresh access token",
      description:
        "Refresh JWT access token using refresh token (Proxied to Login Service)",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["refreshToken"],
              properties: {
                refreshToken: {
                  type: "string",
                  example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: "Token refresh successful",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  accessToken: { type: "string" },
                  refreshToken: { type: "string" },
                },
              },
            },
          },
        },
        401: { description: "Invalid refresh token" },
        503: { $ref: "#/components/responses/ServiceUnavailable" },
      },
    },
  },
};

export function setupSwagger(app) {
  const options = {
    customCss: `
      .topbar-wrapper .link { 
        content: url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJMMTMuMDkgOC4yNkwyMCA5TDEzLjA5IDE1Ljc0TDEyIDIyTDEwLjkxIDE1Ljc0TDQgOUwxMC45MSA4LjI2TDEyIDJaIiBmaWxsPSIjMzMzIi8+Cjwvc3ZnPgo='); 
        width: 120px; 
        height: auto; 
      }
    `,
    customSiteTitle: "Indicator API Gateway - Documentation",
  };

  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, options));

  // Raw OpenAPI spec endpoint
  app.get("/api-docs.json", (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(swaggerSpec);
  });
}
