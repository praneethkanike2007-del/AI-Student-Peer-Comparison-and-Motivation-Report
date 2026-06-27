import jwt from "jsonwebtoken";
import { prisma } from "../prisma.js";
import { HttpError } from "../utils/http.js";

const JWT_SECRET = process.env.JWT_SECRET || "smartedu-default-jwt-secret-2026";
const userCache = new Map();
const userCacheMs = Number(process.env.AUTH_CACHE_MS || 5 * 60 * 1000);

export const signToken = (user) =>
  jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d"
  });

export async function requireAuth(req, _res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) throw new HttpError(401, "Authentication required");
    const payload = jwt.verify(token, JWT_SECRET);
    const cached = userCache.get(payload.sub);
    let user = cached && Date.now() - cached.time < userCacheMs ? cached.user : null;
    if (!user) {
      user = await prisma.user.findUnique({
        where: { id: payload.sub },
        include: { student: true, instructor: true }
      });
      if (user) userCache.set(payload.sub, { time: Date.now(), user });
    }
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
