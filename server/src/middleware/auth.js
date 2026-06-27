import jwt from "jsonwebtoken";
import { prisma } from "../prisma.js";
import { HttpError } from "../utils/http.js";

export const signToken = (user) =>
  jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d"
  });

export async function requireAuth(req, _res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) throw new HttpError(401, "Authentication required");
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { student: true, instructor: true }
    });
    if (!user || !user.isActive) throw new HttpError(401, "Invalid session");
    req.user = user;
    next();
  } catch (error) {
    next(error.status ? error : new HttpError(401, "Invalid or expired token"));
  }
}

export const requireRole = (...roles) => (req, _res, next) => {
  if (!roles.includes(req.user.role)) {
    return next(new HttpError(403, "You do not have permission for this action"));
  }
  next();
};
