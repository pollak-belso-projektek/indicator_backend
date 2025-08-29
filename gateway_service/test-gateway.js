import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 5002;

// CORS configuration
app.use(
  cors({
    origin: ["http://localhost:3000", "http://localhost:3001"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-ID"],
  })
);

// Simple login service proxy without circuit breaker
const loginProxy = createProxyMiddleware({
  target: "http://localhost:5301",
  changeOrigin: true,
  logLevel: "debug",
  timeout: 10000, // 10 second timeout
  onError: (err, req, res) => {
    console.error("❌ Login proxy error:", err.message);
    if (!res.headersSent) {
      res
        .status(503)
        .json({ error: "Login service unavailable", details: err.message });
    }
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(
      `🔄 Proxying: ${req.method} ${req.originalUrl} → http://localhost:5301${req.originalUrl}`
    );

    // Log headers
    console.log(`� Request headers:`, req.headers);
  },
  onProxyRes: (proxyRes, req, res) => {
    console.log(`✅ Response: ${proxyRes.statusCode} from login service`);
  },
});

// Route auth requests to login service - NO body parsing middleware before proxy
app.use("/api/v1/auth", loginProxy);

// Parse JSON bodies ONLY for non-proxied routes
app.use(express.json());

// Test endpoint
app.get("/", (req, res) => {
  res.json({
    message: "Test Gateway Running",
    timestamp: new Date().toISOString(),
  });
});

// Route auth requests to login service
app.use("/api/v1/auth", loginProxy);

// Test endpoint
app.get("/", (req, res) => {
  res.json({
    message: "Test Gateway Running",
    timestamp: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Test Gateway running at http://localhost:${PORT}`);
});
