import "dotenv/config";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import morgan from "morgan";
import { authRouter } from "./routes/auth.js";
import { publicRouter } from "./routes/public.js";
import { studentRouter } from "./routes/student.js";
import { instructorRouter } from "./routes/instructor.js";
import { aiRouter } from "./routes/ai.js";
import { requireAuth } from "./middleware/auth.js";

export const app = express();

app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
    credentials: true
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 400 }));

app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api/public", publicRouter);
app.use("/api/auth", authRouter);
app.use("/api/student", requireAuth, studentRouter);
app.use("/api/instructor", requireAuth, instructorRouter);
app.use("/api/ai", requireAuth, aiRouter);

app.use((_req, res) => res.status(404).json({ message: "Route not found" }));

app.use((error, _req, res, _next) => {
  if (error.code === "P2002") {
    return res.status(409).json({
      message: "This account or student ID already exists. Please try again.",
      detail: process.env.NODE_ENV === "production" ? undefined : error.message
    });
  }
  const status = error.status || 500;
  res.status(status).json({
    message: status === 500 ? "Something went wrong" : error.message,
    detail: process.env.NODE_ENV === "production" ? undefined : error.message
  });
});
