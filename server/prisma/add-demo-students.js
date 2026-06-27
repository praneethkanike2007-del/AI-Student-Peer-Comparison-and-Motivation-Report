import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const passwordHash = await bcrypt.hash("Password123!", 12);

const demoStudents = [
  ["arjun@smartedu.test", "Arjun Reddy", "STU-1011", "11", 82, 76, 84],
  ["meera@smartedu.test", "Meera Iyer", "STU-1012", "12", 91, 88, 93],
  ["nisha@smartedu.test", "Nisha Verma", "STU-1013", "13", 68, 73, 65],
  ["vivaan@smartedu.test", "Vivaan Rao", "STU-1014", "14", 57, 61, 59],
  ["ananya@smartedu.test", "Ananya Das", "STU-1015", "15", 96, 90, 94],
  ["rahul@smartedu.test", "Rahul Joshi", "STU-1016", "16", 74, 80, 70],
  ["sana@smartedu.test", "Sana Sheikh", "STU-1017", "17", 85, 78, 82],
  ["dev@smartedu.test", "Dev Malhotra", "STU-1018", "18", 49, 55, 52],
  ["isha@smartedu.test", "Isha Roy", "STU-1019", "19", 88, 92, 86],
  ["omkar@smartedu.test", "Omkar Kulkarni", "STU-1020", "20", 63, 67, 60],
  ["tanya@smartedu.test", "Tanya Bansal", "STU-1021", "21", 79, 74, 77],
  ["yash@smartedu.test", "Yash Gupta", "STU-1022", "22", 92, 84, 89]
];

const femaleNames = new Set(["Meera", "Nisha", "Ananya", "Sana", "Isha", "Tanya"]);

function gradeFor(score) {
  if (score >= 90) return "A+";
  if (score >= 80) return "A";
  if (score >= 70) return "B+";
  if (score >= 60) return "B";
  if (score >= 50) return "C";
  return "Needs Work";
}

async function main() {
  const batch = await prisma.batch.findFirst({ include: { subjects: { orderBy: { code: "asc" } } } });
  if (!batch) throw new Error("No batch found. Run npm run seed first.");

  const exams = await prisma.exam.findMany({
    where: { subject: { batchId: batch.id } },
    include: { subject: true },
    orderBy: { subject: { code: "asc" } }
  });
  const sessions = await prisma.attendanceSession.findMany({
    where: { subject: { batchId: batch.id } },
    orderBy: [{ subject: { code: "asc" } }, { date: "asc" }]
  });

  let created = 0;
  let skipped = 0;

  for (const [email, fullName, studentCode, rollNumber, dsa, dbms, math] of demoStudents) {
    const existing = await prisma.user.findUnique({ where: { email }, include: { student: true } });
    if (existing?.student) {
      skipped += 1;
      continue;
    }

    const firstName = fullName.split(" ")[0];
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: "STUDENT",
        student: {
          create: {
            batchId: batch.id,
            fullName,
            studentCode,
            rollNumber,
            gender: femaleNames.has(firstName) ? "Female" : "Male",
            dateOfBirth: new Date("2005-04-15"),
            phone: `+91 90000 20${rollNumber.padStart(3, "0")}`,
            parentName: `Guardian ${firstName}`,
            parentContact: `+91 90000 30${rollNumber.padStart(3, "0")}`,
            address: "Campus Road, Knowledge City",
            admissionNumber: `ADM-${studentCode.slice(-4)}`,
            residenceType: Number(rollNumber) % 3 === 0 ? "Hostel" : "Day Scholar",
            notifications: {
              create: [
                { title: "Marks published", body: "Your latest internal marks are available." },
                { title: "Attendance reminder", body: "Keep attendance above 75 percent in every subject." }
              ]
            }
          }
        }
      },
      include: { student: true }
    });

    const scoresByCode = new Map([
      ["DSA204", dsa],
      ["DBMS210", dbms],
      ["MATH220", math]
    ]);

    for (const exam of exams) {
      const score = scoresByCode.get(exam.subject.code);
      if (typeof score !== "number") continue;
      await prisma.mark.upsert({
        where: { examId_studentId: { examId: exam.id, studentId: user.student.id } },
        update: { score, grade: gradeFor(score) },
        create: {
          examId: exam.id,
          subjectId: exam.subjectId,
          studentId: user.student.id,
          score,
          grade: gradeFor(score)
        }
      });
    }

    for (const [index, session] of sessions.entries()) {
      const pattern = ["PRESENT", "PRESENT", "PRESENT", "LATE", "ABSENT"];
      await prisma.attendanceRecord.upsert({
        where: { sessionId_studentId: { sessionId: session.id, studentId: user.student.id } },
        update: {},
        create: {
          sessionId: session.id,
          studentId: user.student.id,
          status: pattern[(index + Number(rollNumber)) % pattern.length]
        }
      });
    }

    created += 1;
  }

  console.log(`Demo students ready. Created: ${created}. Already existed: ${skipped}.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
