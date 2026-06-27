import bcrypt from "bcryptjs";
import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireAuth, signToken } from "../middleware/auth.js";
import { ensureDemoLoginAccount } from "../utils/bootstrap.js";
import { asyncHandler, HttpError } from "../utils/http.js";
import { loginSchema, validate } from "../validators.js";

export const authRouter = Router();
const loginHashRounds = Number(process.env.BCRYPT_ROUNDS || 8);

function refreshPasswordHashIfSlow(user, password) {
  try {
    if (bcrypt.getRounds(user.passwordHash) <= loginHashRounds) return;
    bcrypt.hash(password, loginHashRounds)
      .then((passwordHash) => prisma.user.update({ where: { id: user.id }, data: { passwordHash } }))
      .catch(() => {});
  } catch {
    // Keep login responsive even if an old or malformed hash cannot be inspected.
  }
}

authRouter.post(
  "/login",
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.validated.body;
    let user = await prisma.user.findUnique({ where: { email }, include: { student: { include: { batch: true } }, instructor: true } });
    let passwordOk = false;

    if (!user) {
      user = await ensureDemoLoginAccount(email, password);
    } else {
      passwordOk = await bcrypt.compare(password, user.passwordHash);
    }

    if (user && !passwordOk) {
      const fallbackUser = await ensureDemoLoginAccount(email, password);
      if (fallbackUser) {
        user = await prisma.user.findUnique({ where: { id: fallbackUser.id }, include: { student: { include: { batch: true } }, instructor: true } });
        passwordOk = false;
      }
    }

    if (user && !passwordOk) {
      passwordOk = await bcrypt.compare(password, user.passwordHash);
    }

    if (!user || !passwordOk) {
      throw new HttpError(401, "This email is not a sample portal account. Use one of the sample accounts shown below.");
    }
    refreshPasswordHashIfSlow(user, password);
    const profile = user.role === "STUDENT" ? user.student : user.instructor;
    res.json({
      token: signToken(user),
      user: { id: user.id, email: user.email, role: user.role, profile }
    });
  })
);

authRouter.get("/me", requireAuth, asyncHandler(async (req, res) => res.json({ user: req.user })));
