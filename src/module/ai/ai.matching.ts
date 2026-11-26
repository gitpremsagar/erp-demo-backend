import { normalizeCode, normalizeText, similarity } from "./ai.utils";

export interface MatchCandidate {
  id: string;
  name: string;
  productCode?: string;
}

export interface MatchOutcome<T extends MatchCandidate> {
  match: T | null;
  candidates: T[];
  confidence: "exact" | "fuzzy" | "none";
  reason: string;
}

function topCandidates<T extends MatchCandidate>(
  raw: string,
  candidates: T[],
  limit = 5
): T[] {
  const scored = candidates
    .map((candidate) => ({
      candidate,
      score: Math.max(
        similarity(raw, candidate.name),
        candidate.productCode ? similarity(raw, candidate.productCode) : 0
      ),
    }))
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((entry) => entry.candidate);
}

export function matchCandidate<T extends MatchCandidate>(
  rawValue: unknown,
  candidates: T[]
): MatchOutcome<T> {
  const raw = String(rawValue ?? "").trim();
  if (!raw) {
    return {
      match: null,
      candidates: [],
      confidence: "none",
      reason: "Empty value",
    };
  }

  const normalizedRaw = normalizeText(raw);
  const rawCode = normalizeCode(raw);

  // 1) Exact product-code match (also catches rows where the code is one token).
  if (rawCode) {
    const codeMatches = candidates.filter(
      (candidate) =>
        candidate.productCode &&
        normalizeCode(candidate.productCode) === rawCode
    );
    if (codeMatches.length === 1) {
      return {
        match: codeMatches[0],
        candidates: codeMatches,
        confidence: "exact",
        reason: "Exact product code",
      };
    }
    if (codeMatches.length > 1) {
      return {
        match: null,
        candidates: codeMatches.slice(0, 5),
        confidence: "none",
        reason: "Multiple products share this code",
      };
    }
  }

  // 2) Exact normalized name.
  const exactNameMatches = candidates.filter(
    (candidate) => normalizeText(candidate.name) === normalizedRaw
  );
  if (exactNameMatches.length === 1) {
    return {
      match: exactNameMatches[0],
      candidates: exactNameMatches,
      confidence: "exact",
      reason: "Exact product name",
    };
  }
  if (exactNameMatches.length > 1) {
    return {
      match: null,
      candidates: exactNameMatches.slice(0, 5),
      confidence: "none",
      reason: "Multiple products share this name",
    };
  }

  // 3) Fuzzy match with a confidence margin.
  const scored = candidates
    .map((candidate) => {
      const nameScore = similarity(raw, candidate.name);
      const codeScore = candidate.productCode
        ? similarity(raw, candidate.productCode)
        : 0;
      const containment =
        normalizedRaw.includes(normalizeText(candidate.name)) ||
        normalizeText(candidate.name).includes(normalizedRaw);
      return {
        candidate,
        score: Math.max(nameScore, codeScore, containment ? 0.9 : 0),
      };
    })
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return {
      match: null,
      candidates: [],
      confidence: "none",
      reason: "No products available",
    };
  }

  const best = scored[0];
  const second = scored[1];
  const margin = best.score - (second?.score ?? 0);

  if (best.score >= 0.86 && margin >= 0.06) {
    return {
      match: best.candidate,
      candidates: scored.slice(0, 5).map((entry) => entry.candidate),
      confidence: "fuzzy",
      reason: `Fuzzy match (${Math.round(best.score * 100)}% similar)`,
    };
  }

  return {
    match: null,
    candidates: topCandidates(raw, candidates),
    confidence: "none",
    reason:
      best.score >= 0.7
        ? "Ambiguous match - choose the correct product"
        : "No close product match",
  };
}
