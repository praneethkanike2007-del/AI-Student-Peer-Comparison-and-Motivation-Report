import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../utils/http.js";
import { batchComparison, getStudentForUser, studentAcademicSnapshot } from "../services/academicService.js";

export const studentRouter = Router();
studentRouter.use(requireRole("STUDENT"));

studentRouter.get(
  "/dashboard",
  asyncHandler(async (req, res) => {
    const student = await getStudentForUser(req.user);
    const snapshot = await studentAcademicSnapshot(student.id);
    res.json({ student, ...snapshot });
  })
);

studentRouter.get("/profile", asyncHandler(async (req, res) => res.json({ student: await getStudentForUser(req.user) })));

studentRouter.get(
  "/attendance",
  asyncHandler(async (req, res) => {
    const student = await getStudentForUser(req.user);
    const snapshot = await studentAcademicSnapshot(student.id);
    res.json(snapshot.attendance);
  })
);

studentRouter.get(
  "/marks",
  asyncHandler(async (req, res) => {
    const student = await getStudentForUser(req.user);
    const snapshot = await studentAcademicSnapshot(student.id);
    res.json(snapshot.marks);
  })
);

studentRouter.get(
  "/rank",
  asyncHandler(async (req, res) => {
    const student = await getStudentForUser(req.user);
    res.json(await batchComparison(student.id));
  })
);

studentRouter.get(
  "/reports",
  asyncHandler(async (req, res) => {
    const student = await getStudentForUser(req.user);
    const reports = await prisma.report.findMany({ where: { studentId: student.id }, orderBy: { createdAt: "desc" } });
    res.json({ reports });
  })
);

studentRouter.get(
  "/feedback",
  asyncHandler(async (req, res) => {
    const student = await getStudentForUser(req.user);
    const feedback = await prisma.aiFeedback.findMany({ where: { studentId: student.id }, orderBy: { createdAt: "desc" } });
    res.json({ feedback });
  })
);

studentRouter.get(
  "/assistant/history",
  asyncHandler(async (req, res) => {
    const chats = await prisma.aiChat.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: "desc" } });
    res.json({ chats });
  })
);
