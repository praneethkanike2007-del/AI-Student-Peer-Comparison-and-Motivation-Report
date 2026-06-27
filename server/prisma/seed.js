import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const passwordHash = await bcrypt.hash("Password123!", 12);

async function upsertUser(email, role) {
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, role, passwordHash }
  });
}

async function main() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "Notification", "InstructorRemark", "Report", "AiFeedback", "AiChat", "Mark", "Exam", "AttendanceRecord", "AttendanceSession", "SubjectInstructor", "Subject", "Student", "Instructor", "Batch", "User" RESTART IDENTITY CASCADE'
  );

  const batch = await prisma.batch.create({
    data: { name: "CSE 2026 A", course: "B.Tech", branch: "Computer Science", year: 2, semester: 4, section: "A" }
  });

  const instructorData = [
    ["instructor@smartedu.test", "Dr. Meera Sharma", "FAC-1001", "Computer Science", "+91 90000 10001"],
    ["kavita@smartedu.test", "Prof. Kavita Rao", "FAC-1002", "Database Systems", "+91 90000 10002"],
    ["suresh@smartedu.test", "Dr. Suresh Kumar", "FAC-1003", "Mathematics", "+91 90000 10003"],
    ["farah@smartedu.test", "Prof. Farah Siddiqui", "FAC-1004", "Systems", "+91 90000 10004"],
    ["anil@smartedu.test", "Prof. Anil Varma", "FAC-1005", "Networks", "+91 90000 10005"]
  ];

  const instructors = new Map();
  for (const [email, fullName, employeeCode, department, phone] of instructorData) {
    const instructorUser = await upsertUser(email, "INSTRUCTOR");
    const instructor = await prisma.instructor.create({
      data: { userId: instructorUser.id, fullName, employeeCode, department, phone }
    });
    instructors.set(email, instructor);
  }

  const subjects = await Promise.all(
    [
      ["DSA204", "Data Structures", 4, "instructor@smartedu.test"],
      ["DBMS210", "Database Systems", 4, "kavita@smartedu.test"],
      ["MATH220", "Discrete Mathematics", 3, "suresh@smartedu.test"],
      ["OS230", "Operating Systems", 4, "farah@smartedu.test"],
      ["CN240", "Computer Networks", 3, "anil@smartedu.test"]
    ].map(([code, name, credits, instructorEmail]) =>
      prisma.subject.create({
        data: {
          batchId: batch.id,
          code,
          name,
          credits,
          instructors: { create: { instructorId: instructors.get(instructorEmail).id } }
        }
      })
    )
  );

  const studentData = [
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

  const students = [];
  for (const [email, fullName, code, roll, ...scores] of studentData) {
    const user = await upsertUser(email, "STUDENT");
    const student = await prisma.student.create({
      data: {
        userId: user.id,
        batchId: batch.id,
        fullName,
        studentCode: code,
        rollNumber: roll,
        gender: ["Riya", "Zoya", "Meera", "Nisha", "Ananya", "Sana", "Isha", "Tanya", "Priya", "Leela", "Samaira", "Diya"].some((name) => fullName.startsWith(name)) ? "Female" : "Male",
        dateOfBirth: new Date("2005-04-15"),
        phone: "+91 90000 20000",
        parentName: "Guardian " + fullName.split(" ")[0],
        parentContact: "+91 90000 30000",
        address: "Campus Road, Knowledge City",
        admissionNumber: "ADM-" + code.slice(-4),
        residenceType: roll === "03" ? "Hostel" : "Day Scholar",
        notifications: {
          create: [
            { title: "Marks published", body: "Your latest internal marks are available." },
            { title: "Attendance reminder", body: "Keep attendance above 75 percent in every subject." }
          ]
        }
      }
    });
    student.seedScores = scores;
    students.push(student);
  }

  for (let index = 0; index < subjects.length; index += 1) {
    const subject = subjects[index];
    const exam = await prisma.exam.create({
      data: {
        subjectId: subject.id,
        title: "Internal Assessment 1",
        type: "INTERNAL",
        maxMarks: 100,
        heldOn: new Date("2026-02-15"),
        published: true
      }
    });
    for (const student of students) {
      await prisma.mark.create({
        data: {
          examId: exam.id,
          subjectId: subject.id,
          studentId: student.id,
          score: student.seedScores[index],
          grade: student.seedScores[index] >= 80 ? "A" : student.seedScores[index] >= 70 ? "B+" : student.seedScores[index] >= 60 ? "B" : "C"
        }
      });
    }
  }

  const statuses = ["PRESENT", "PRESENT", "PRESENT", "ABSENT", "LATE"];
  for (const subject of subjects) {
    const subjectInstructor = await prisma.subjectInstructor.findFirst({ where: { subjectId: subject.id } });
    for (let day = 1; day <= 12; day += 1) {
      const session = await prisma.attendanceSession.create({
        data: {
          subjectId: subject.id,
          instructorId: subjectInstructor.instructorId,
          date: new Date(`2026-03-${String(day).padStart(2, "0")}`),
          topic: `${subject.name} lecture ${day}`
        }
      });
      for (const [studentIndex, student] of students.entries()) {
        await prisma.attendanceRecord.create({
          data: {
            sessionId: session.id,
            studentId: student.id,
            status: statuses[(day + studentIndex) % statuses.length]
          }
        });
      }
    }
  }

  await prisma.aiFeedback.create({
    data: {
      studentId: students[0].id,
      content: "Strong start. Maintain your DSA consistency and lift DBMS revision with weekly query practice.",
      dataJson: "{}"
    }
  });
}

main()
  .then(async () => {
    console.log("Seed complete");
    console.log("Student: student@smartedu.test / Password123!");
    console.log("Instructor: instructor@smartedu.test / Password123!");
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
