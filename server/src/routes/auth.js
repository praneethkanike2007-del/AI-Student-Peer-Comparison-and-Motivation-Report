import bcrypt from "bcryptjs";
import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireAuth, signToken } from "../middleware/auth.js";
import { ensureDemoLoginAccount } from "../utils/bootstrap.js";
import { asyncHandler, HttpError } from "../utils/http.js";
import { loginSchema, validate } from "../validators.js";

export const authRouter = Router();

authRouter.post(
  "/login",
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.validated.body;
    let user = await prisma.user.findUnique({ where: { email }, include: { student: true, instructor: true } });

    if (!user) {
      user = await ensureDemoLoginAccount(email, password);
    } else if (!(await bcrypt.compare(password, user.passwordHash))) {
      const fallbackUser = await ensureDemoLoginAccount(email, password);
      if (fallbackUser) {
        user = await prisma.user.findUnique({ where: { id: fallbackUser.id }, include: { student: true, instructor: true } });
      }
    }

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new HttpError(401, "This email is not a sample portal account. Use one of the sample accounts shown below.");
    }
    const profile = user.role === "STUDENT" ? user.student : user.instructor;
    res.json({
      token: signToken(user),
      user: { id: user.id, email: user.email, role: user.role, profile }
    });
  })
);

authRouter.get("/me", requireAuth, asyncHandler(async (req, res) => res.json({ user: req.user })));
