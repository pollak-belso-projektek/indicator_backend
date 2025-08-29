import swaggerJSDoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";

const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Login Service API",
      version: "1.0.0",
      description: "Authentication microservice for the Indicator application",
    },
    servers: [
      {
        url: "http://localhost:5301",
        description: "Development server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
  },
  apis: [
    "./controllers/auth.controller.js",
    "./controllers/health.controller.js",
    "./index.js",
  ], // Path to the API docs
};

const swaggerSpec = swaggerJSDoc(swaggerOptions);

export function setupSwagger(app) {
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.get("/api-docs.json", (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(swaggerSpec);
  });
}
