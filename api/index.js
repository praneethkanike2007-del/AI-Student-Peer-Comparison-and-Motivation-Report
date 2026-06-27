let appPromise;

export default async function handler(req, res) {
  try {
    appPromise ||= import("../server/src/app.js").then((module) => module.app);
    const app = await appPromise;
    return app(req, res);
  } catch (error) {
    console.error("API startup failed", error);
    res.status(500).json({
      message: "API startup failed",
      error: error?.message || String(error),
      env: {
        databaseUrl: Boolean(process.env.DATABASE_URL),
        directUrl: Boolean(process.env.DIRECT_URL),
        jwtSecret: Boolean(process.env.JWT_SECRET),
        aiProvider: process.env.AI_PROVIDER || "built-in"
      }
    });
  }
}
