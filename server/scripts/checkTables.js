import { prisma } from '../src/prisma.js';

async function main() {
  const tables = [
    'user',
    'batch',
    'student',
    'instructor',
    'subject',
    'subjectInstructor',
    'exam',
    'attendanceSession',
    'attendanceRecord',
    'mark',
    'report',
    'aiChat',
    'aiFeedback',
    'notification'
  ];

  const result = {};
  for (const table of tables) {
    result[table] = await prisma[table].count();
  }

  console.log(JSON.stringify(result, null, 2));
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
