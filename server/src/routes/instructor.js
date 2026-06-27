import bcrypt from "bcryptjs";
import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireRole } from "../middleware/auth.js";
import { asyncHandler, HttpError } from "../utils/http.js";
import {
  assertInstructorStudentAccess,
  assertInstructorSubjectAccess,
  attendanceSummary,
  batchComparison,
  gradeFor,
  marksSummary,
  studentAcademicSnapshot
} from "../services/academicService.js";
import { attendanceSchema, instructorStudentCreateSchema, marksSchema, publishSchema, remarkSchema, studentIdParamSchema, updateMarksSchema, validate } from "../validators.js";
import { generatePeerReport } from "../services/aiService.js";

export const instructorRouter = Router();
instructorRouter.use(requireRole("INSTRUCTOR"));

async function assignedSubjectIds(instructorId) {
  const links = await prisma.subjectInstructor.findMany({ where: { instructorId } });
  return links.map((link) => link.subjectId);
}

async function assignedStudents(instructorId) {
  const subjectIds = await assignedSubjectIds(instructorId);
  const subjects = await prisma.subject.findMany({ where: { id: { in: subjectIds } }, select: { batchId: true } });
  return prisma.student.findMany({
    where: { batchId: { in: [...new Set(subjects.map((subject) => subject.batchId))] } },
    include: { user: true, batch: true },
    orderBy: { rollNumber: "asc" }
  });
}

async function assignedBatches(instructorId) {
  const subjectIds = await assignedSubjectIds(instructorId);
  const subjects = await prisma.subject.findMany({
    where: { id: { in: subjectIds } },
    include: { batch: true }
  });
  return [...new Map(subjects.map((subject) => [subject.batch.id, subject.batch])).values()];
}

instructorRouter.get(
  "/dashboard",
  asyncHandler(async (req, res) => {
    const instructorId = req.user.instructor.id;
    const students = await assignedStudents(instructorId);
    const snapshots = [];
    for (const student of students) {
      snapshots.push({
        attendance: await attendanceSummary(student.id),
        marks: await marksSummary(student.id, true)
      });
    }
    const ranked = students.map((student, index) => ({ student, snapshot: snapshots[index] }));
    const byMarks = [...ranked].sort((a, b) => b.snapshot.marks.percentage - a.snapshot.marks.percentage);
    const reportUsage = await prisma.report.count({ where: { studentId: { in: students.map((student) => student.id) } } });
    res.json({
      totalStudents: students.length,
      attendanceAverage: Math.round(ranked.reduce((sum, item) => sum + item.snapshot.attendance.percentage, 0) / (students.length || 1)),
      marksAverage: Math.round(ranked.reduce((sum, item) => sum + item.snapshot.marks.percentage, 0) / (students.length || 1)),
      lowAttendance: ranked.filter((item) => item.snapshot.attendance.percentage < 75).slice(0, 5),
      lowPerformers: ranked.filter((item) => item.snapshot.marks.percentage < 60).slice(0, 5),
      topPerformers: byMarks.slice(0, 5),
      reportUsage
    });
  })
);

instructorRouter.get(
  "/students",
  asyncHandler(async (req, res) => {
    const [students, batches] = await Promise.all([
      assignedStudents(req.user.instructor.id),
      assignedBatches(req.user.instructor.id)
    ]);
    res.json({ students, batches });
  })
);

instructorRouter.post(
  "/students",
  validate(instructorStudentCreateSchema),
  asyncHandler(async (req, res) => {
    const { email, password, batchId, fullName, studentCode, rollNumber, gender, dateOfBirth, phone, parentName, parentContact, address, admissionNumber, residenceType } = req.validated.body;
    const allowedBatches = await assignedBatches(req.user.instructor.id);
    if (!allowedBatches.some((batch) => batch.id === batchId)) {
      throw new HttpError(403, "Cannot add a student outside your assigned batch");
    }
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new HttpError(409, "An account already exists with this email");

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: "STUDENT",
        student: {
          create: {
            batchId,
            fullName,
            studentCode,
            rollNumber,
            gender,
            dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : new Date("2005-01-01"),
            phone,
            parentName,
            parentContact,
            address,
            admissionNumber,
            residenceType,
            notifications: {
              create: [
                { title: "Welcome to the portal", body: "Your student account has been created by the institution." }
              ]
            }
          }
        }
      },
      include: { student: { include: { user: true, batch: true } } }
    });

    res.status(201).json({ student: user.student, message: "Student added successfully" });
  })
);

instructorRouter.get(
  "/students/:id",
  validate(studentIdParamSchema),
  asyncHandler(async (req, res) => {
    const student = await assertInstructorStudentAccess(req.user.instructor.id, req.validated.params.id);
    const snapshot = await studentAcademicSnapshot(student.id);
    const remarks = await prisma.instructorRemark.findMany({ where: { studentId: student.id }, orderBy: { createdAt: "desc" } });
    res.json({ student, ...snapshot, remarks });
  })
);

instructorRouter.delete(
  "/students/:id",
  validate(studentIdParamSchema),
  asyncHandler(async (req, res) => {
    const student = await assertInstructorStudentAccess(req.user.instructor.id, req.validated.params.id);
    await prisma.user.delete({ where: { id: student.userId } });
    res.json({ message: "Student removed successfully" });
  })
);

instructorRouter.get(
  "/subjects",
  asyncHandler(async (req, res) => {
    const links = await prisma.subjectInstructor.findMany({
      where: { instructorId: req.user.instructor.id },
      include: { subject: { include: { batch: true } } }
    });
    res.json({ subjects: links.map((link) => link.subject) });
  })
);

instructorRouter.get(
  "/attendance/history",
  asyncHandler(async (req, res) => {
    const subjectIds = await assignedSubjectIds(req.user.instructor.id);
    const sessions = await prisma.attendanceSession.findMany({
      where: { subjectId: { in: subjectIds } },
      include: {
        subject: { include: { batch: true } },
        records: { include: { student: true } }
      },
      orderBy: { date: "desc" },
      take: 40
    });
    res.json({
      sessions: sessions.map((session) => {
        const present = session.records.filter((record) => ["PRESENT", "LATE"].includes(record.status)).length;
        return {
          ...session,
          present,
          absent: session.records.length - present,
          percentage: session.records.length ? Math.round((present / session.records.length) * 100) : 0
        };
      })
    });
  })
);

instructorRouter.post(
  "/attendance",
  validate(attendanceSchema),
  asyncHandler(async (req, res) => {
    const { subjectId, date, topic, records } = req.validated.body;
    await assertInstructorSubjectAccess(req.user.instructor.id, subjectId);
    await Promise.all(records.map((record) => assertInstructorStudentAccess(req.user.instructor.id, record.studentId)));
    const session = await prisma.attendanceSession.upsert({
      where: { subjectId_date: { subjectId, date: new Date(date) } },
      create: { subjectId, instructorId: req.user.instructor.id, date: new Date(date), topic },
      update: { topic }
    });
    await Promise.all(
      records.map((record) =>
        prisma.attendanceRecord.upsert({
          where: { sessionId_studentId: { sessionId: session.id, studentId: record.studentId } },
          create: { sessionId: session.id, studentId: record.studentId, status: record.status, note: record.note },
          update: { status: record.status, note: record.note }
        })
      )
    );
    res.status(201).json({ session, message: "Attendance saved" });
  })
);

instructorRouter.post(
  "/marks",
  validate(marksSchema),
  asyncHandler(async (req, res) => {
    const { subjectId, title, type, maxMarks, heldOn, published, marks } = req.validated.body;
    await assertInstructorSubjectAccess(req.user.instructor.id, subjectId);
    await Promise.all(marks.map((mark) => assertInstructorStudentAccess(req.user.instructor.id, mark.studentId)));
    const invalid = marks.find((mark) => mark.score > maxMarks);
    if (invalid) throw new HttpError(422, "Score cannot exceed max marks");
    const exam = await prisma.exam.create({ data: { subjectId, title, type, maxMarks, heldOn: new Date(heldOn), published } });
    await Promise.all(
      marks.map((mark) =>
        prisma.mark.create({
          data: { examId: exam.id, subjectId, studentId: mark.studentId, score: mark.score, grade: gradeFor(mark.score, maxMarks) }
        })
      )
    );
    res.status(201).json({ exam, message: "Marks saved" });
  })
);

instructorRouter.get(
  "/marks/history",
  asyncHandler(async (req, res) => {
    const subjectIds = await assignedSubjectIds(req.user.instructor.id);
    const exams = await prisma.exam.findMany({
      where: { subjectId: { in: subjectIds } },
      include: {
        subject: { include: { batch: true } },
        marks: { include: { student: true } }
      },
      orderBy: { heldOn: "desc" },
      take: 40
    });
    res.json({
      exams: exams.map((exam) => {
        const average = exam.marks.length
          ? Math.round(exam.marks.reduce((sum, mark) => sum + (mark.score / exam.maxMarks) * 100, 0) / exam.marks.length)
          : 0;
        return { ...exam, average };
      })
    });
  })
);

instructorRouter.patch(
  "/marks/:examId",
  validate(updateMarksSchema),
  asyncHandler(async (req, res) => {
    const exam = await prisma.exam.findUnique({ where: { id: req.validated.params.examId } });
    if (!exam) throw new HttpError(404, "Exam not found");
    await assertInstructorSubjectAccess(req.user.instructor.id, exam.subjectId);
    const invalid = req.validated.body.marks.find((mark) => mark.score > exam.maxMarks);
    if (invalid) throw new HttpError(422, "Score cannot exceed max marks");
    await Promise.all(
      req.validated.body.marks.map(async (mark) => {
        await assertInstructorStudentAccess(req.user.instructor.id, mark.studentId);
        return prisma.mark.upsert({
          where: { examId_studentId: { examId: exam.id, studentId: mark.studentId } },
          create: {
            examId: exam.id,
            subjectId: exam.subjectId,
            studentId: mark.studentId,
            score: mark.score,
            grade: gradeFor(mark.score, exam.maxMarks)
          },
          update: { score: mark.score, grade: gradeFor(mark.score, exam.maxMarks) }
        });
      })
    );
    res.json({ message: "Marks updated" });
  })
);

instructorRouter.patch(
  "/marks/:examId/publish",
  validate(publishSchema),
  asyncHandler(async (req, res) => {
    const exam = await prisma.exam.findUnique({ where: { id: req.validated.params.examId } });
    if (!exam) throw new HttpError(404, "Exam not found");
    await assertInstructorSubjectAccess(req.user.instructor.id, exam.subjectId);
    const updated = await prisma.exam.update({ where: { id: exam.id }, data: { published: req.validated.body.published } });
    res.json({ exam: updated });
  })
);

instructorRouter.get(
  "/analytics",
  asyncHandler(async (req, res) => {
    const students = await assignedStudents(req.user.instructor.id);
    const rows = await Promise.all(
      students.map(async (student) => ({
        student: { id: student.id, name: student.fullName, rollNumber: student.rollNumber },
        attendance: await attendanceSummary(student.id),
        marks: await marksSummary(student.id, true),
        comparison: await batchComparison(student.id)
      }))
    );
    res.json({ rows });
  })
);

instructorRouter.get(
  "/reports",
  asyncHandler(async (req, res) => {
    const students = await assignedStudents(req.user.instructor.id);
    const reports = await prisma.report.findMany({
      where: { studentId: { in: students.map((student) => student.id) } },
      include: { student: true },
      orderBy: { createdAt: "desc" }
    });
    res.json({ reports });
  })
);

instructorRouter.post(
  "/students/:studentId/peer-report",
  asyncHandler(async (req, res) => {
    const student = await assertInstructorStudentAccess(req.user.instructor.id, req.params.studentId);
    const snapshot = { student, ...(await studentAcademicSnapshot(student.id)) };
    const period = req.body?.period || "Instructor review period";
    const content = await generatePeerReport(snapshot, period);
    const report = await prisma.report.create({
      data: {
        studentId: student.id,
        type: "PEER_COMPARISON",
        title: "Instructor Generated Peer Comparison Report",
        period,
        content,
        dataJson: JSON.stringify(snapshot)
      }
    });
    res.status(201).json({ report });
  })
);

instructorRouter.post(
  "/students/:studentId/remarks",
  validate(remarkSchema),
  asyncHandler(async (req, res) => {
    await assertInstructorStudentAccess(req.user.instructor.id, req.validated.params.studentId);
    const remark = await prisma.instructorRemark.create({
      data: {
        studentId: req.validated.params.studentId,
        instructorId: req.user.instructor.id,
        content: req.validated.body.content,
        visibleToStudent: req.validated.body.visibleToStudent
      }
    });
    res.status(201).json({ remark });
  })
);
