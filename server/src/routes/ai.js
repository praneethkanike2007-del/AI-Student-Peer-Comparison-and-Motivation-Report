import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../utils/http.js";
import { getStudentForUser, studentAcademicSnapshot } from "../services/academicService.js";
import { answerDoubt, generatePeerReport, generateSmartFeedback, getAiProviderStatus } from "../services/aiService.js";
import { chatSchema, reportSchema, validate } from "../validators.js";

export const aiRouter = Router();

aiRouter.get(
  "/status",
  requireRole("STUDENT"),
  asyncHandler(async (_req, res) => {
    res.json(getAiProviderStatus());
  })
);

aiRouter.post(
  "/chat",
  requireRole("STUDENT"),
  validate(chatSchema),
  asyncHandler(async (req, res) => {
    const student = await getStudentForUser(req.user);
    const snapshot = { student, ...(await studentAcademicSnapshot(student.id)) };
    const response = await answerDoubt(req.validated.body.question, snapshot, req.validated.body.mode);
    const chat = await prisma.aiChat.create({
      data: { userId: req.user.id, prompt: req.validated.body.question, response }
    });
    res.status(201).json({ chat, ai: getAiProviderStatus() });
  })
);

aiRouter.post(
  "/feedback",
  requireRole("STUDENT"),
  asyncHandler(async (req, res) => {
    const student = await getStudentForUser(req.user);
    const snapshot = { student, ...(await studentAcademicSnapshot(student.id)) };
    const content = await generateSmartFeedback(snapshot);
    const feedback = await prisma.aiFeedback.create({
      data: { studentId: student.id, content, dataJson: JSON.stringify(snapshot) }
    });
    const report = await prisma.report.create({
      data: {
        studentId: student.id,
        type: "SMART_FEEDBACK",
        title: "Smart Academic Feedback",
        period: "Current term",
        content,
        dataJson: JSON.stringify(snapshot)
      }
    });
    res.status(201).json({ feedback, report });
  })
);

aiRouter.post(
  "/peer-report",
  requireRole("STUDENT"),
  validate(reportSchema),
  asyncHandler(async (req, res) => {
    const student = await getStudentForUser(req.user);
    const snapshot = { student, ...(await studentAcademicSnapshot(student.id)) };
    const content = await generatePeerReport(snapshot, req.validated.body.period);
    const report = await prisma.report.create({
      data: {
        studentId: student.id,
        type: "PEER_COMPARISON",
        title: "Anonymized Peer Comparison Report",
        period: req.validated.body.period,
        content,
        dataJson: JSON.stringify(snapshot)
      }
    });
    res.status(201).json({ report });
  })
);
