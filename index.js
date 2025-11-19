// Load environment variables
import "dotenv/config";
import express from "express";
import cors from "cors";
import expressSession from "express-session";
import { PrismaSessionStore } from "@quixo3/prisma-session-store";
import compression from "compression";
import process from "node:process";

// Utilities
import prisma, { initializeDatabase } from "./utils/prisma.js";
import { setupSwagger } from "./utils/swagger.js";

// Middleware
import logMiddleware from "./middleware/log.middleware.js";
import { authMiddleware } from "./middleware/auth.middleware.js";
import endpointAccessMiddleware from "./middleware/endpointAccess.middleware.js";
import cacheMiddleware from "./middleware/cache.middleware.js";

// Controllers
import alapadatokRouter from "./controllers/alapadatok.controller.js";
import tanugyi_adatok from "./controllers/tanugyi_adatok.controller.js";
import kompetencia from "./controllers/kompetencia.controller.js";
import tanulo_letszam from "./controllers/tanulo_letszam.controller.js";
import felvettek_szama from "./controllers/felvettek_szama.controller.js";
import userRouter from "./controllers/user.controller.js";
import authRouter from "./controllers/auth.controller.js";
import cacheRouter from "./controllers/cache.controller.js";
import logRouter from "./controllers/log.controller.js";
import tableRouter from "./controllers/tablelist.controller.js";
import egyOktatoraJutoTanuloRouter from "./controllers/egy_oktatora_juto_tanulo.controller.js";
import szmszRouter from "./controllers/szmsz.controller.js";
import versenyekRouter from "./controllers/versenyek.controller.js";
import dobbantoRouter from "./controllers/dobbanto.controller.js";
import elegedettsegRouter from "./controllers/elegedettseg.controller.js";
import elegedettsegMeresRouter from "./controllers/elegedettseg_meres.controller.js";
import elhelyezkedesRouter from "./controllers/elhelyezkedes.controller.js";
import hhEsHHHRouter from "./controllers/hh_es_hhh_nevelesu_tanulok.controller.js";
import lemorzsolodasRouter from "./controllers/lemorzsolodas.controller.js";
import intezmenyiNeveltsegRouter from "./controllers/intezmenyi_neveltseg.controller.js";
import muhelyiskolaRouter from "./controllers/muhelyiskola.controller.js";
import nszfhRouter from "./controllers/nszfh.controller.js";
import sajatosNevelesuTanulokRouter from "./controllers/sajatos_nevelesu_tanulok.controller.js";
import szakmaiVizsgaEredmenyekRouter from "./controllers/szakmai_vizsga_eredmenyek.controller.js";
import vizsgaeredmenyekRouter from "./controllers/vizsgaeredmenyek.controller.js";
import oktatoEgyebTevRouter from "./controllers/oktato_egyeb_tev.controller.js";
import alkalmazottakMunkauyRouter from "./controllers/alkalmazottak_munkaugy.controller.js";
import szakiranyRouter from "./controllers/szakirany.controller.js";
import szakmaRouter from "./controllers/szakma.controller.js";
import healthRouter from "./controllers/health.controller.js";

const corsConfig = {
  origin: [
    "http://localhost:5173",
    "http://172.16.0.100:5174",
    "http://10.0.1.7:5173",
    "http://10.0.1.10:5173",
    "https://indikator.pollak.info",
    "http://localhost:5000", // Allow API Gateway to call this service
    "http://192.168.1.6:5173",
  ],
};

const app = express();
const port = process.env.PORT || 5300;
const SESSION_SECRET = process.env.SESSION_SECRET || "supersecretkey";

// Add compression middleware to improve response time
app.use(compression());

app.use(
  expressSession({
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      secure: false,
      sameSite: "none",
    },
    secret: SESSION_SECRET,
    resave: false, // Changed to false for better performance
    saveUninitialized: false, // Changed to false for better performance
    store: new PrismaSessionStore(prisma, {
      checkPeriod: 2 * 60 * 1000, //ms
      dbRecordIdIsSessionId: true,
      dbRecordIdFunction: undefined,
    }),
  })
);

app.use(cors(corsConfig));

// Middleware for logging requests
app.use(logMiddleware);

// Add HTTP caching middleware
app.use(
  cacheMiddleware({
    maxAge: 300, // 5 minutes
    private: true,
    staleWhileRevalidate: 60,
  })
);

// First, mount the auth routes separately to avoid middleware collision
// For auth routes, we need the body parsers but not the authentication middleware
// NOTE: In gateway mode, auth routes are handled by the gateway → login service
// Keep these for backward compatibility when running standalone
app.use("/api/v1/auth", express.json());
app.use("/api/v1/auth", express.urlencoded({ extended: false }));
app.use("/api/v1/auth", authRouter); // Mount auth routes BEFORE the apiRouter

// Health check endpoints (public, no authentication required)
app.use("/health", healthRouter); // Also available at root level for easier access

// Apply middleware to all protected routes at once to reduce setup overhead
const apiRouter = express.Router();

// Only parse JSON for routes that need it
apiRouter.use(express.json({ limit: "50mb" }));
apiRouter.use(express.urlencoded({ limit: "50mb", extended: false }));
apiRouter.use(authMiddleware);

// Cache monitoring endpoint
apiRouter.use("/cache", cacheRouter);

// Log management endpoint
apiRouter.use("/logs", logRouter);

// Define API routes with their specific middleware
apiRouter.use("/alapadatok", alapadatokRouter);

// Apply endpoint access middleware to protected routes
const protectedRouter = express.Router();
protectedRouter.use(endpointAccessMiddleware);

protectedRouter.use("/tanugyi_adatok", tanugyi_adatok);
protectedRouter.use("/tanulo_letszam", tanulo_letszam);
protectedRouter.use("/kompetencia", kompetencia);
protectedRouter.use("/felvettek_szama", felvettek_szama);
protectedRouter.use("/users", userRouter);
protectedRouter.use("/tablelist", tableRouter);
protectedRouter.use("/egy_oktatora_juto_tanulo", egyOktatoraJutoTanuloRouter);
protectedRouter.use("/szmsz", szmszRouter);
protectedRouter.use("/versenyek", versenyekRouter);
protectedRouter.use("/dobbanto", dobbantoRouter);
protectedRouter.use("/elegedettseg_meres", elegedettsegMeresRouter);
protectedRouter.use("/elegedettseg", elegedettsegRouter);
protectedRouter.use("/elhelyezkedes", elhelyezkedesRouter);
protectedRouter.use("/hh_es_hhh", hhEsHHHRouter);
protectedRouter.use("/intezmenyi_neveltseg", intezmenyiNeveltsegRouter);
protectedRouter.use("/lemorzsolodas", lemorzsolodasRouter);
protectedRouter.use("/muhelyiskola", muhelyiskolaRouter);
protectedRouter.use("/nszfh", nszfhRouter);
protectedRouter.use(
  "/sajatos_nevelesu_tanulok",
  sajatosNevelesuTanulokRouter
);
protectedRouter.use(
  "/szakmai_vizsga_eredmenyek",
  szakmaiVizsgaEredmenyekRouter
);
protectedRouter.use("/vizsgaeredmenyek", vizsgaeredmenyekRouter);
protectedRouter.use("/oktato-egyeb-tev", oktatoEgyebTevRouter);
protectedRouter.use("/alkalmazottak_munkaugy", alkalmazottakMunkauyRouter);
protectedRouter.use("/szakirany", szakiranyRouter);
protectedRouter.use("/szakma", szakmaRouter);

// Mount the protected router under the API router
apiRouter.use(protectedRouter);

// Mount the api router with base prefix, excluding the /auth path which is already handled
app.use("/api/v1", apiRouter);

// Set up Swagger API documentation (requires authentication)
setupSwagger(app);

app.use("/api/v1/auth", authRouter);

// Initialize database connection and start server
const startServer = async () => {
  try {
    // Allow degraded start based on environment variable
    const allowDegradedStart = process.env.ALLOW_DEGRADED_START === "true";

    // Test database connection with retry logic
    const dbResult = await initializeDatabase({ allowDegradedStart });

    if (dbResult.degraded) {
      console.warn(
        "⚠️  Server starting in degraded mode - some features may be unavailable"
      );
    }

    app.listen(port, () => {
      const status = dbResult.degraded ? "🟡" : "🚀";
      const mode = dbResult.degraded ? " (DEGRADED MODE)" : "";
      console.log(
        `${status} Server running at http://localhost:${port}${mode}`
      );
      console.log(
        `📚 API documentation available at http://localhost:${port}/api-docs (requires authentication)`
      );

      if (dbResult.degraded) {
        console.log(
          "🔧 Database connection will be retried automatically on each request"
        );
        console.log(`📊 Health endpoints available:`);
        console.log(`   • Basic health: http://localhost:${port}/health/basic`);
        console.log(
          `   • Database health: http://localhost:${port}/health/database`
        );
        console.log(`   • Full health: http://localhost:${port}/health`);
      }
    });
  } catch (error) {
    console.error(
      "❌ Failed to start server due to database connection issues:",
      error.message
    );
    console.error(
      "💡 Tip: Set ALLOW_DEGRADED_START=true to start server without database"
    );
    process.exit(1);
  }
};

// Start the server
startServer();
