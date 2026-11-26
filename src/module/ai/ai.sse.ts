import type { Response } from "express";
import type { AiChatEvent } from "./ai.type";

export type AiEventSink = (event: AiChatEvent) => void;

export function initSse(res: Response): void {
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();
}

export function writeSseEvent(res: Response, event: AiChatEvent): void {
  if (res.writableEnded || res.destroyed) return;
  res.write(`event: ${event.type}\n`);
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

export function startSseHeartbeat(res: Response, intervalMs = 15000): () => void {
  const timer = setInterval(() => {
    if (!res.writableEnded && !res.destroyed) res.write(": ping\n\n");
  }, intervalMs);
  return () => clearInterval(timer);
}
