import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "node:path";
import fs from "node:fs";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

const corsOrigin = process.env.CORS_ORIGIN || "*";
app.use(
  cors({
    origin: corsOrigin === "*" ? true : corsOrigin.split(",").map((o) => o.trim()),
    credentials: true,
  }),
);

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// Root health check shortcuts
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "sentinel-api",
    timestamp: new Date().toISOString(),
  });
});

app.get("/healthz", (_req, res) => {
  res.json({ status: "ok" });
});

// Mount API routes
app.use("/api", router);

// Serve production static frontend if available (e.g. Docker container)
const baseDir = typeof import.meta.dirname === "string" ? import.meta.dirname : process.cwd();
const clientDistPath = path.resolve(baseDir, "../../sentinel-ai/dist/public");
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.use((req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/health")) return next();
    res.sendFile(path.join(clientDistPath, "index.html"));
  });
}

// Centralized error handling middleware
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  req.log.error({ err }, "Unhandled server error");

  if (res.headersSent) return;

  const isProduction = process.env.NODE_ENV === "production";
  const errorMessage =
    err instanceof Error
      ? isProduction
        ? "An internal server error occurred."
        : err.message
      : "Unknown server error";

  const statusCode =
    typeof (err as { status?: number })?.status === "number"
      ? (err as { status: number }).status
      : 500;

  res.status(statusCode).json({
    error: errorMessage,
  });
});

export default app;
