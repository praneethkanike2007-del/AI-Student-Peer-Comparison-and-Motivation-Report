import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const passwordHash = await bcrypt.hash("Password123!", 12);

const instructors = [
  ["instructor@smartedu.test", "Dr. Meera Sharma", "FAC-1001", "Computer Science", "+91 90000 10001", "DSA204"],
  ["kavita@smartedu.test", "Prof. Kavita Rao", "FAC-1002", "Database Systems", "+91 90000 10002", "DBMS210"],
  ["suresh@smartedu.test", "Dr. Suresh Kumar", "FAC-1003", "Mathematics", "+91 90000 10003", "MATH220"],
  ["farah@smartedu.test", "Prof. Farah Siddiqui", "FAC-1004", "Systems", "+91 90000 10004", "OS230"],
  ["anil@smartedu.test", "Prof. Anil Varma", "FAC-1005", "Networks", "+91 90000 10005", "CN240"]
];

const subjects = [
  ["DSA204", "Data Structures", 4, "FAC-1001"],
  ["DBMS210", "Database Systems", 4, "FAC-1002"],
  ["MATH220", "Discrete Mathematics", 3, "FAC-1003"],
  ["OS230", "Operating Systems", 4, "FAC-1004"],
  ["CN240", "Computer Networks", 3, "FAC-1005"]
];

const students = [
  ["student@smartedu.test", "Aarav Nair", "STU-1001", "01", 88, 81, 79, 84, 82],
  ["riya@smartedu.test", "Riya Patel", "STU-1002", "02", 75, 69, 72, 70, 74],
  ["kabir@smartedu.test", "Kabir Menon", "STU-1003", "03", 94, 86, 91, 89, 92],
  ["zoya@smartedu.test", "Zoya Khan", "STU-1004", "04", 62, 58, 66, 61, 64],
  ["arjun@smartedu.test", "Arjun Reddy", "STU-1011", "11", 82, 76, 84, 80, 78],
  ["meera@smartedu.test", "Meera Iyer", "STU-1012", "12", 91, 88, 93, 90, 89],
  ["nisha@smartedu.test", "Nisha Verma", "STU-1013", "13", 68, 73, 65, 70, 67],
  ["vivaan@smartedu.test", "Vivaan Rao", "STU-1014", "14", 57, 61, 59, 55, 60],
  ["ananya@smartedu.test", "Ananya Das", "STU-1015", "15", 96, 90, 94, 93, 95],
  ["rahul@smartedu.test", "Rahul Joshi", "STU-1016", "16", 74, 80, 70, 77, 72],
  ["sana@smartedu.test", "Sana Sheikh", "STU-1017", "17", 85, 78, 82, 86, 80],
  ["dev@smartedu.test", "Dev Malhotra", "STU-1018", "18", 49, 55, 52, 50, 54],
  ["isha@smartedu.test", "Isha Roy", "STU-1019", "19", 88, 92, 86, 91, 87],
  ["omkar@smartedu.test", "Omkar Kulkarni", "STU-1020", "20", 63, 67, 60, 62, 65],
  ["tanya@smartedu.test", "Tanya Bansal", "STU-1021", "21", 79, 74, 77, 81, 76],
  ["yash@smartedu.test", "Yash Gupta", "STU-1022", "22", 92, 84, 89, 88, 90],
  ["priya@smartedu.test", "Priya Nandan", "STU-1023", "23", 83, 85, 80, 82, 84],
  ["manav@smartedu.test", "Manav Singh", "STU-1024", "24", 71, 64, 69, 68, 66],
  ["leela@smartedu.test", "Leela Thomas", "STU-1025", "25", 89, 87, 85, 90, 88],
  ["adarsh@smartedu.test", "Adarsh Jain", "STU-1026", "26", 58, 62, 57, 60, 59],
  ["samaira@smartedu.test", "Samaira Ali", "STU-1027", "27", 94, 91, 92, 90, 93],
  ["nihal@smartedu.test", "Nihal Chandra", "STU-1028", "28", 76, 72, 75, 74, 73],
  ["diya@smartedu.test", "Diya Menon", "STU-1029", "29", 86, 83, 88, 85, 87],
  ["karthik@smartedu.test", "Karthik Pillai", "STU-1030", "30", 67, 70, 64, 66, 69]
];

const femaleNames = new Set(["Riya", "Zoya", "Meera", "Nisha", "Ananya", "Sana", "Isha", "Tanya", "Priya", "Leela", "Samaira", "Diya"]);

function gradeFor(score) {
  if (score >= 90) return "A+";
  if (score >= 80) return "A";
  if (score >= 70) return "B+";
  if (score >= 60) return "B";
  if (score >= 50) return "C";
  return "Needs Work";
}

async function main() {
  const batch = await prisma.batch.findFirst({ orderBy: { createdAt: "asc" } });
  if (!batch) throw new Error("No batch found. Run npm run seed first.");

  const instructorByCode = new Map();
  for (const [email, fullName, employeeCode, department, phone] of instructors) {
    const user = await prisma.user.upsert({
      where: { email },
      update: { role: "INSTRUCTOR", passwordHash },
      create: { email, role: "INSTRUCTOR", passwordHash }
    });
    const instructor = await prisma.instructor.upsert({
      where: { employeeCode },
      update: { userId: user.id, fullName, department, phone },
      create: { userId: user.id, fullName, employeeCode, department, phone }
    });
    instructorByCode.set(employeeCode, instructor);
  }

  const subjectByCode = new Map();
  for (const [code, name, credits, employeeCode] of subjects) {
    const subject = await prisma.subject.upsert({
      where: { batchId_code: { batchId: batch.id, code } },
      update: { name, credits },
      create: { batchId: batch.id, code, name, credits }
    });
    await prisma.subjectInstructor.deleteMany({ where: { subjectId: subject.id } });
    await prisma.subjectInstructor.create({
      data: { subjectId: subject.id, instructorId: instructorByCode.get(employeeCode).id }
    });
    subjectByCode.set(code, subject);
  }

  const studentRows = [];
  for (const [email, fullName, studentCode, rollNumber, ...scores] of students) {
    const user = await prisma.user.upsert({
      where: { email },
      update: { role: "STUDENT", passwordHash },
      create: { email, role: "STUDENT", passwordHash }
    });
    const firstName = fullName.split(" ")[0];
    const student = await prisma.student.upsert({
      where: { studentCode },
      update: {
        userId: user.id,
        batchId: batch.id,
        fullName,
        rollNumber,
        gender: femaleNames.has(firstName) ? "Female" : "Male",
        phone: `+91 90000 20${rollNumber.padStart(3, "0")}`,
        parentName: `Guardian ${firstName}`,
        parentContact: `+91 90000 30${rollNumber.padStart(3, "0")}`,
        address: "Campus Road, Knowledge City",
        residenceType: Number(rollNumber) % 3 === 0 ? "Hostel" : "Day Scholar"
      },
      create: {
        userId: user.id,
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
    });
    studentRows.push({ student, scores });
  }

  const subjectCodes = subjects.map(([code]) => code);
  for (let index = 0; index < subjectCodes.length; index += 1) {
    const subject = subjectByCode.get(subjectCodes[index]);
    const exam = await prisma.exam.findFirst({ where: { subjectId: subject.id, title: "Internal Assessment 1" } })
      || await prisma.exam.create({
        data: {
          subjectId: subject.id,
          title: "Internal Assessment 1",
          type: "INTERNAL",
          maxMarks: 100,
          heldOn: new Date("2026-02-15"),
          published: true
        }
      });
    for (const row of studentRows) {
      const score = row.scores[index];
      await prisma.mark.upsert({
        where: { examId_studentId: { examId: exam.id, studentId: row.student.id } },
        update: { score, grade: gradeFor(score) },
        create: { examId: exam.id, subjectId: subject.id, studentId: row.student.id, score, grade: gradeFor(score) }
      });
    }
  }

  const statuses = ["PRESENT", "PRESENT", "PRESENT", "LATE", "ABSENT"];
  for (const [subjectIndex, code] of subjectCodes.entries()) {
    const subject = subjectByCode.get(code);
    const link = await prisma.subjectInstructor.findFirst({ where: { subjectId: subject.id } });
    for (let day = 1; day <= 12; day += 1) {
      const session = await prisma.attendanceSession.upsert({
        where: { subjectId_date: { subjectId: subject.id, date: new Date(`2026-03-${String(day).padStart(2, "0")}`) } },
        update: { instructorId: link.instructorId, topic: `${subject.name} lecture ${day}` },
        create: {
          subjectId: subject.id,
          instructorId: link.instructorId,
          date: new Date(`2026-03-${String(day).padStart(2, "0")}`),
          topic: `${subject.name} lecture ${day}`
        }
      });
      for (const [studentIndex, row] of studentRows.entries()) {
        await prisma.attendanceRecord.upsert({
          where: { sessionId_studentId: { sessionId: session.id, studentId: row.student.id } },
          update: {},
          create: {
            sessionId: session.id,
            studentId: row.student.id,
            status: statuses[(day + studentIndex + subjectIndex) % statuses.length]
          }
        });
      }
    }
  }

  console.log(`Institution data ready: ${studentRows.length} students, ${subjects.length} subjects, ${instructors.length} instructors.`);
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
