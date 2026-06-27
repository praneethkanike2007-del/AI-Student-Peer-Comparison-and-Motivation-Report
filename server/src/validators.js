import { z } from "zod";

export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse({ body: req.body, params: req.params, query: req.query });
  if (!result.success) {
    return res.status(422).json({ message: "Validation failed", issues: result.error.flatten() });
  }
  req.validated = result.data;
  next();
};

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(6)
  })
});

export const registerSchema = z.object({
  body: z.object({
    fullName: z.string().min(2).max(80),
    email: z.string().email(),
    password: z.string().min(6).max(100),
    phone: z.string().max(20).optional().default("")
  })
});

export const instructorStudentCreateSchema = z.object({
  body: z.object({
    fullName: z.string().min(2).max(80),
    email: z.string().email(),
    password: z.string().min(6).max(100).default("Password123!"),
    batchId: z.string().min(1),
    studentCode: z.string().min(3).max(30),
    rollNumber: z.string().min(1).max(20),
    gender: z.string().min(2).max(30).default("Not specified"),
    dateOfBirth: z.preprocess((value) => value === "" ? undefined : value, z.string().min(8).optional()),
    phone: z.string().max(20).optional().default(""),
    parentName: z.string().max(80).optional().default("Not provided"),
    parentContact: z.string().max(20).optional().default(""),
    address: z.string().max(200).optional().default("Not provided"),
    admissionNumber: z.string().min(3).max(40),
    residenceType: z.string().max(40).optional().default("Day Scholar")
  })
});

export const studentIdParamSchema = z.object({
  params: z.object({ id: z.string().min(1) })
});

export const attendanceSchema = z.object({
  body: z.object({
    subjectId: z.string().min(1),
    date: z.string().min(8),
    topic: z.string().optional(),
    records: z.array(
      z.object({
        studentId: z.string().min(1),
        status: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]),
        note: z.string().optional()
      })
    )
  })
});

export const marksSchema = z.object({
  body: z.object({
    subjectId: z.string().min(1),
    title: z.string().min(2),
    type: z.enum(["INTERNAL", "ASSIGNMENT", "SEMESTER", "PRACTICAL"]),
    maxMarks: z.number().positive(),
    heldOn: z.string().min(8),
    published: z.boolean().default(false),
    marks: z.array(z.object({ studentId: z.string().min(1), score: z.number().min(0) }))
  })
});

export const publishSchema = z.object({
  body: z.object({ published: z.boolean() }),
  params: z.object({ examId: z.string().min(1) })
});

export const updateMarksSchema = z.object({
  params: z.object({ examId: z.string().min(1) }),
  body: z.object({
    marks: z.array(z.object({ studentId: z.string().min(1), score: z.number().min(0) }))
  })
});

export const chatSchema = z.object({
  body: z.object({
    question: z.string().min(3).max(2000),
    mode: z.enum(["auto", "explain", "steps", "summary", "practice", "exam"]).default("auto")
  })
});

export const reportSchema = z.object({
  body: z.object({ period: z.string().min(3).max(80).default("Current term") })
});

export const remarkSchema = z.object({
  params: z.object({ studentId: z.string().min(1) }),
  body: z.object({ content: z.string().min(3), visibleToStudent: z.boolean().default(false) })
});
