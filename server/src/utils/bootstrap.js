import bcrypt from "bcryptjs";
import { prisma } from "../prisma.js";

const defaultPassword = "Password123!";

const demoAccounts = [
  {
    email: "student@smartedu.test",
    role: "STUDENT",
    profile: {
      fullName: "Aarav Nair",
      studentCode: "STU-1001",
      rollNumber: "01",
      gender: "Male",
      dateOfBirth: new Date("2005-04-15"),
      phone: "+91 90000 20000",
      parentName: "Guardian Aarav",
      parentContact: "+91 90000 30000",
      address: "Campus Road, Knowledge City",
      admissionNumber: "ADM-1001",
      residenceType: "Day Scholar"
    }
  },
  {
    email: "samaira@smartedu.test",
    role: "STUDENT",
    profile: {
      fullName: "Samaira Ali",
      studentCode: "STU-1002",
      rollNumber: "02",
      gender: "Female",
      dateOfBirth: new Date("2005-05-10"),
      phone: "+91 90000 20002",
      parentName: "Guardian Samaira",
      parentContact: "+91 90000 30002",
      address: "Campus Road, Knowledge City",
      admissionNumber: "ADM-1002",
      residenceType: "Day Scholar"
    }
  },
  {
    email: "diya@smartedu.test",
    role: "STUDENT",
    profile: {
      fullName: "Diya Menon",
      studentCode: "STU-1003",
      rollNumber: "03",
      gender: "Female",
      dateOfBirth: new Date("2005-06-12"),
      phone: "+91 90000 20003",
      parentName: "Guardian Diya",
      parentContact: "+91 90000 30003",
      address: "Campus Road, Knowledge City",
      admissionNumber: "ADM-1003",
      residenceType: "Hostel"
    }
  },
  {
    email: "instructor@smartedu.test",
    role: "INSTRUCTOR",
    profile: {
      fullName: "Dr. Meera Sharma",
      employeeCode: "FAC-1001",
      department: "Computer Science",
      phone: "+91 90000 10001"
    }
  },
  {
    email: "farah@smartedu.test",
    role: "INSTRUCTOR",
    profile: {
      fullName: "Prof. Farah Siddiqui",
      employeeCode: "FAC-1004",
      department: "Systems",
      phone: "+91 90000 10004"
    }
  },
  {
    email: "anil@smartedu.test",
    role: "INSTRUCTOR",
    profile: {
      fullName: "Prof. Anil Varma",
      employeeCode: "FAC-1005",
      department: "Networks",
      phone: "+91 90000 10005"
    }
  }
];

async function ensureBatch() {
  let batch = await prisma.batch.findFirst({
    where: { name: "CSE 2026 A", course: "B.Tech", branch: "Computer Science" }
  });

  if (!batch) {
    batch = await prisma.batch.create({
      data: {
        name: "CSE 2026 A",
        course: "B.Tech",
        branch: "Computer Science",
        year: 2,
        semester: 4,
        section: "A"
      }
    });
  }

  return batch;
}

async function ensureUser(email, role, passwordHash) {
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      role,
      passwordHash,
      isActive: true
    },
    create: {
      email,
      role,
      passwordHash
    }
  });

  return user;
}

async function ensureStudent(userId, batchId) {
  const existing = await prisma.student.findUnique({ where: { userId } });
  if (existing) return existing;

  return prisma.student.create({
    data: {
      userId,
      batchId,
      fullName: "Aarav Nair",
      studentCode: "STU-1001",
      rollNumber: "01",
      gender: "Male",
      dateOfBirth: new Date("2005-04-15"),
      phone: "+91 90000 20000",
      parentName: "Guardian Aarav",
      parentContact: "+91 90000 30000",
      address: "Campus Road, Knowledge City",
      admissionNumber: "ADM-1001",
      residenceType: "Day Scholar"
    }
  });
}

async function ensureInstructor(userId, profile) {
  const existing = await prisma.instructor.findUnique({ where: { userId } });
  if (existing) return existing;

  return prisma.instructor.create({
    data: {
      userId,
      fullName: profile.fullName,
      employeeCode: profile.employeeCode,
      department: profile.department,
      phone: profile.phone
    }
  });
}

async function ensureReports(studentId) {
  const reportCount = await prisma.report.count();
  if (reportCount > 0) return;

  await prisma.report.createMany({
    data: [
      {
        studentId,
        type: "PROGRESS",
        title: "Midterm Performance Review",
        period: "Term 1",
        content: "Aarav has demonstrated strong performance in DSA and DBMS, with improvement opportunities in attendance. Continue to revise concepts weekly.",
        dataJson: JSON.stringify({ attendance: 85, gpa: 8.6 })
      },
      {
        studentId,
        type: "FEEDBACK",
        title: "Teacher Feedback Summary",
        period: "Term 1",
        content: "Strong understanding of core concepts. Improve time management for practical assignments and exam preparation.",
        dataJson: JSON.stringify({ teacher: "Dr. Meera Sharma" })
      }
    ]
  });
}

async function ensureAiContent(userId, studentId) {
  const aiChatCount = await prisma.aiChat.count();
  if (aiChatCount === 0) {
    await prisma.aiChat.createMany({
      data: [
        {
          userId,
          prompt: "Compare my scores with the class average and suggest improvements.",
          response: "Your overall performance is strong in DSA and DBMS. Focus on attendance and review networking concepts weekly."
        }
      ]
    });
  }

  const feedbackCount = await prisma.aiFeedback.count();
  if (feedbackCount === 0) {
    await prisma.aiFeedback.createMany({
      data: [
        {
          studentId,
          content: "Maintain your DSA consistency and improve DBMS query accuracy through practice.",
          dataJson: JSON.stringify({ focus: ["DSA", "DBMS"], recommendation: "Weekly revision quiz" })
        }
      ]
    });
  }
}

export async function ensureDemoAccounts() {
  const passwordHash = await bcrypt.hash(defaultPassword, 12);
  const batch = await ensureBatch();

  let studentUserId = null;
  let studentId = null;

  for (const account of demoAccounts) {
    const user = await ensureUser(account.email, account.role, passwordHash);
    if (account.role === "STUDENT") {
      const student = await ensureStudent(user.id, batch.id, account.profile);
      if (!studentUserId) {
        studentUserId = user.id;
        studentId = student.id;
      }
    } else {
      await ensureInstructor(user.id, account.profile);
    }
  }

  if (studentUserId && studentId) {
    await ensureReports(studentId);
    await ensureAiContent(studentUserId, studentId);
  }

  return { password: defaultPassword, accounts: demoAccounts.map(({ email }) => email) };
}

export async function ensureDemoLoginAccount(email, password) {
  const account = demoAccounts.find((item) => item.email === email);
  if (!account || password !== defaultPassword) return null;

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await ensureUser(account.email, account.role, passwordHash);

  if (account.role === "STUDENT") {
    await ensureStudent(user.id, (await ensureBatch()).id);
  } else {
    await ensureInstructor(user.id);
  }

  return user;
}
