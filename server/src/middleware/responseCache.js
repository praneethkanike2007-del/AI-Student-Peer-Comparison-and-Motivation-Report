const cache = new Map();
const defaultTtlMs = Number(process.env.API_CACHE_MS || 5 * 60 * 1000);

function cacheKey(req) {
  return `${req.user?.id || "public"}:${req.method}:${req.originalUrl}`;
}

export function clearResponseCache() {
  cache.clear();
}

export function responseCache(req, res, next) {
  if (req.method !== "GET") {
    clearResponseCache();
    return next();
  }

  const key = cacheKey(req);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.time < defaultTtlMs) {
    res.set("x-smartedu-cache", "hit");
    return res.status(cached.status).json(cached.body);
  }

  const originalJson = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      cache.set(key, { time: Date.now(), status: res.statusCode, body });
    }
    res.set("x-smartedu-cache", "miss");
    return originalJson(body);
  };

  next();
}
