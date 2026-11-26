import type { NextFunction, Request, Response } from "express";

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

function readLimit(): { windowMs: number; max: number } {
  const windowMs = Number(process.env.AI_RATE_LIMIT_WINDOW_MS) || 5 * 60 * 1000;
  const max = Number(process.env.AI_RATE_LIMIT_MAX) || 30;
  return { windowMs, max };
}

function actorKey(req: Request): string {
  const user = (req as Request & { user?: { id?: string } }).user;
  return user?.id ?? req.ip ?? "anonymous";
}

export function aiRateLimit(route: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const { windowMs, max } = readLimit();
    const now = Date.now();
    const key = `${actorKey(req)}:${route}`;
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    if (bucket.count >= max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(retryAfterSeconds));
      res.status(429).json({
        message: "Too many AI requests. Please wait a moment and try again.",
      });
      return;
    }

    bucket.count += 1;
    next();
  };
}
