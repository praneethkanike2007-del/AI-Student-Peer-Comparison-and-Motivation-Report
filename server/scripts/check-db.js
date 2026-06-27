import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

try {
  await prisma.$queryRaw`SELECT 1`;
  const [users, students, instructors] = await Promise.all([
    prisma.user.count(),
    prisma.student.count(),
    prisma.instructor.count()
  ]);
  console.log("Database check passed.");
  console.log(`Users: ${users}`);
  console.log(`Students: ${students}`);
  console.log(`Instructors: ${instructors}`);
} catch (error) {
  console.error("Database check failed:");
  console.error(error?.message || error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
