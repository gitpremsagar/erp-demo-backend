import type { ChangeType } from "@prisma/client";
import { nowInIndia } from "./indiaTime";

export function changeTypeFromDelta(changeInStock: number): ChangeType {
  if (changeInStock > 0) return "INCREASE";
  if (changeInStock < 0) return "DECREASE";
  throw new Error("changeInStock must be non-zero");
}

/** Current moment with explicit Asia/Kolkata wall clock (see `nowInIndia`). */
export function defaultChangeDateIst(): Date {
  return nowInIndia();
}

/**
 * Re-anchor a Date to the same calendar instant expressed in IST (+05:30),
 * avoiding ambiguous local-server interpretation.
 */
export function toChangeDateIst(date: Date): Date {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    f.formatToParts(date).filter((x) => x.type !== "literal").map((x) => [x.type, x.value])
  ) as {
    year: string;
    month: string;
    day: string;
    hour: string;
    minute: string;
    second: string;
  };
  const iso = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}.000+05:30`;
  return new Date(iso);
}

export function buildStockRecordChangeFields(params: {
  changeInStock: number;
  changeDate: Date;
}): { changeType: ChangeType; changeDate: Date } {

  return {
    changeType: changeTypeFromDelta(params.changeInStock),
    changeDate: toChangeDateIst(params.changeDate),
  };
}
