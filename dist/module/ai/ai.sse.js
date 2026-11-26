"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initSse = initSse;
exports.writeSseEvent = writeSseEvent;
exports.startSseHeartbeat = startSseHeartbeat;
function initSse(res) {
    res.status(200);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();
}
function writeSseEvent(res, event) {
    if (res.writableEnded || res.destroyed)
        return;
    res.write(`event: ${event.type}\n`);
    res.write(`data: ${JSON.stringify(event)}\n\n`);
}
function startSseHeartbeat(res, intervalMs = 15000) {
    const timer = setInterval(() => {
        if (!res.writableEnded && !res.destroyed)
            res.write(": ping\n\n");
    }, intervalMs);
    return () => clearInterval(timer);
}
//# sourceMappingURL=ai.sse.js.map