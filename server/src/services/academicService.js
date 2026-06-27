import { prisma } from "../prisma.js";
import { HttpError } from "../utils/http.js";

export function gradeFor(score, maxMarks) {
  const pct = maxMarks ? (score / maxMarks) * 100 : 0;
  if (pct >= 90) return "A+";
  if (pct >= 80) return "A";
  if (pct >= 70) return "B+";
  if (pct >= 60) return "B";
  if (pct >= 50) return "C";
  return "Needs Work";
}

export async function getStudentForUser(user) {
  if (!user.student) throw new HttpError(404, "Student profile not found");
  if (user.student.batch) return user.student;
  return prisma.student.findUnique({
    where: { id: user.student.id },
    include: { user: true, batch: true }
  });
}

export async function assertInstructorSubjectAccess(instructorId, subjectId) {
  const assignment = await prisma.subjectInstructor.findUnique({
    where: { subjectId_instructorId: { subjectId, instructorId } }
  });
  if (!assignment) throw new HttpError(403, "Subject is not assigned to this instructor");
}

export async function assertInstructorStudentAccess(instructorId, studentId) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { user: true, batch: { include: { subjects: { include: { instructors: true } } } } }
  });
  if (!student) throw new HttpError(404, "Student not found");
  const allowed = student.batch.subjects.some((subject) =>
    subject.instructors.some((link) => link.instructorId === instructorId)
  );
  if (!allowed) throw new HttpError(403, "Student is outside assigned batches");
  return student;
}

export async function attendanceSummary(studentId) {
  const records = await prisma.attendanceRecord.findMany({
    where: { studentId },
    include: { session: { include: { subject: true } } },
    orderBy: { session: { date: "desc" } }
  });
  const presentStatuses = new Set(["PRESENT", "LATE"]);
  const total = records.length;
  const present = records.filter((record) => presentStatuses.has(record.status)).length;
  const bySubject = Object.values(
    records.reduce((acc, record) => {
      const subject = record.session.subject.name;
      acc[subject] ||= { subject, total: 0, present: 0, percentage: 0 };
      acc[subject].total += 1;
      if (presentStatuses.has(record.status)) acc[subject].present += 1;
      acc[subject].percentage = Math.round((acc[subject].present / acc[subject].total) * 100);
      return acc;
    }, {})
  );
  const monthly = Object.values(
    records.reduce((acc, record) => {
      const month = record.session.date.toISOString().slice(0, 7);
      acc[month] ||= { month, total: 0, present: 0, percentage: 0 };
      acc[month].total += 1;
      if (presentStatuses.has(record.status)) acc[month].present += 1;
      acc[month].percentage = Math.round((acc[month].present / acc[month].total) * 100);
      return acc;
    }, {})
  );
  return {
    total,
    present,
    percentage: total ? Math.round((present / total) * 100) : 0,
    shortage: total ? Math.round((present / total) * 100) < 75 : false,
    bySubject,
    monthly,
    records
  };
}

export async function marksSummary(studentId, includeUnpublished = false) {
  const marks = await prisma.mark.findMany({
    where: { studentId, exam: includeUnpublished ? undefined : { published: true } },
    include: { exam: true, subject: true },
    orderBy: { updatedAt: "desc" }
  });
  const totalScore = marks.reduce((sum, mark) => sum + mark.score, 0);
  const totalMax = marks.reduce((sum, mark) => sum + mark.exam.maxMarks, 0);
  const bySubject = Object.values(
    marks.reduce((acc, mark) => {
      const id = mark.subjectId;
      acc[id] ||= { subject: mark.subject.name, score: 0, maxMarks: 0, percentage: 0 };
      acc[id].score += mark.score;
      acc[id].maxMarks += mark.exam.maxMarks;
      acc[id].percentage = Math.round((acc[id].score / acc[id].maxMarks) * 100);
      return acc;
    }, {})
  );
  return {
    totalScore,
    totalMax,
    percentage: totalMax ? Math.round((totalScore / totalMax) * 100) : 0,
    grade: gradeFor(totalScore, totalMax || 1),
    bySubject,
    marks
  };
}

export async function batchComparison(studentId) {
  const student = await prisma.student.findUnique({ where: { id: studentId }, include: { batch: true } });
  const peers = await prisma.student.findMany({ where: { batchId: student.batchId }, select: { id: true } });
  const marks = await prisma.mark.findMany({
    where: {
      studentId: { in: peers.map((peer) => peer.id) },
      exam: { published: true }
    },
    select: {
      studentId: true,
      score: true,
      exam: { select: { maxMarks: true } }
    }
  });
  const totals = new Map(peers.map((peer) => [peer.id, { id: peer.id, totalScore: 0, totalMax: 0, percentage: 0 }]));
  for (const mark of marks) {
    const total = totals.get(mark.studentId);
    total.totalScore += mark.score;
    total.totalMax += mark.exam.maxMarks;
  }
  const summaries = [...totals.values()].map((summary) => ({
    ...summary,
    percentage: summary.totalMax ? Math.round((summary.totalScore / summary.totalMax) * 100) : 0
  }));
  const ranked = summaries.sort((a, b) => b.percentage - a.percentage);
  const current = ranked.find((item) => item.id === studentId) || { percentage: 0 };
  const rank = ranked.findIndex((item) => item.id === studentId) + 1 || null;
  const average = ranked.length
    ? Math.round(ranked.reduce((sum, item) => sum + item.percentage, 0) / ranked.length)
    : 0;
  const status =
    current.percentage >= average + 5 ? "above average" : current.percentage < average - 5 ? "needs improvement" : "average";
  return {
    rank,
    batchSize: ranked.length,
    batchAverage: average,
    studentPercentage: current.percentage,
    status,
    anonymizedDistribution: ranked.map((item, index) => ({
      label: item.id === studentId ? "You" : `Peer ${index + 1}`,
      percentage: item.percentage
    }))
  };
}

export async function studentAcademicSnapshot(studentId) {
  const [attendance, marks, comparison, reports, feedback, notifications] = await Promise.all([
    attendanceSummary(studentId),
    marksSummary(studentId),
    batchComparison(studentId),
    prisma.report.findMany({ where: { studentId }, orderBy: { createdAt: "desc" }, take: 8 }),
    prisma.aiFeedback.findMany({ where: { studentId }, orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.notification.findMany({ where: { studentId }, orderBy: { createdAt: "desc" }, take: 6 })
  ]);
  return { attendance, marks, comparison, reports, feedback, notifications };
}
