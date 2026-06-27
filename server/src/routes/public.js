import { Router } from "express";
import { prisma } from "../prisma.js";
import { asyncHandler } from "../utils/http.js";

export const publicRouter = Router();

publicRouter.get(
  "/status",
  asyncHandler(async (_req, res) => {
    const env = {
      databaseUrl: Boolean(process.env.DATABASE_URL),
      directUrl: Boolean(process.env.DIRECT_URL),
      jwtSecret: Boolean(process.env.JWT_SECRET),
      aiProvider: process.env.AI_PROVIDER || "built-in"
    };
    let database = { connected: false, message: "Not checked" };

    try {
      await prisma.$queryRaw`SELECT 1`;
      const [users, students, instructors] = await Promise.all([
        prisma.user.count(),
        prisma.student.count(),
        prisma.instructor.count()
      ]);
      database = { connected: true, users, students, instructors };
    } catch (error) {
      database = {
        connected: false,
        message: error?.message || "Database connection failed"
      };
    }

    res.json({
      ok: database.connected && env.databaseUrl && env.jwtSecret,
      environment: process.env.VERCEL ? "vercel" : process.env.NETLIFY ? "netlify" : "local",
      env,
      database
    });
  })
);

publicRouter.get(
  "/overview",
  asyncHandler(async (_req, res) => {
    const [studentCount, instructorCount, batches, subjects] = await Promise.all([
      prisma.student.count(),
      prisma.instructor.count(),
      prisma.batch.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.subject.findMany({
        include: { instructors: { include: { instructor: true } }, batch: true },
        orderBy: { code: "asc" }
      })
    ]);

    res.json({
      institution: "Sri Gowthami Educational Institutions",
      studentCount,
      instructorCount,
      courses: batches.map((batch) => ({
        name: batch.name,
        course: batch.course,
        branch: batch.branch,
        year: batch.year,
        semester: batch.semester,
        section: batch.section
      })),
      curriculum: subjects.map((subject) => ({
        code: subject.code,
        name: subject.name,
        credits: subject.credits,
        course: subject.batch.course,
        branch: subject.batch.branch,
        instructors: subject.instructors.map((link) => link.instructor.fullName)
      }))
    });
  })
);
