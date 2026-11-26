"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiRateLimit = aiRateLimit;
const buckets = new Map();
function readLimit() {
    const windowMs = Number(process.env.AI_RATE_LIMIT_WINDOW_MS) || 5 * 60 * 1000;
    const max = Number(process.env.AI_RATE_LIMIT_MAX) || 30;
    return { windowMs, max };
}
function actorKey(req) {
    const user = req.user;
    return user?.id ?? req.ip ?? "anonymous";
}
function aiRateLimit(route) {
    return (req, res, next) => {
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
//# sourceMappingURL=ai.rateLimit.js.map