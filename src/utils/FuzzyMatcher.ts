export interface FuzzyStop {
  id: number;
  stopageEn: string;
  stopageBn: string;
}

export function cleanWord(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u0980-\u09FF\s]/g, ' ')
    .replace(/\s+/g, ' ');
}

export function levenshteinDistance(a: string, b: string): number {
  const tmp: number[][] = [];
  for (let i = 0; i <= a.length; i++) {
    tmp[i] = [i];
  }
  for (let j = 0; j <= b.length; j++) {
    tmp[0][j] = j;
  }
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      tmp[i][j] = Math.min(
        tmp[i - 1][j] + 1,
        tmp[i][j - 1] + 1,
        tmp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return tmp[a.length][b.length];
}

export function fuzzyMatchStop(stop: FuzzyStop, query: string): number {
  const qClean = cleanWord(query);
  const qNorm = qClean.replace(/\s+/g, '');
  if (!qNorm) return 0;

  const enClean = cleanWord(stop.stopageEn || '');
  const enNorm = enClean.replace(/\s+/g, '');

  const bnClean = cleanWord(stop.stopageBn || '');
  const bnNorm = bnClean.replace(/\s+/g, '');

  let bestScore = 0;

  // English scoring
  if (enNorm) {
    let score = 0;
    if (enNorm === qNorm) {
      score = 100; // Exact match
    } else if (enNorm.startsWith(qNorm)) {
      score = 85; // Starts with
    } else if (enClean.split(' ').some(w => w.startsWith(qClean))) {
      score = 75; // Word starts with
    } else if (enNorm.includes(qNorm)) {
      score = 50; // Contains substring
    } else {
      // Subsequence check (characters in correct order)
      let qIdx = 0;
      for (let i = 0; i < enNorm.length && qIdx < qNorm.length; i++) {
        if (enNorm[i] === qNorm[qIdx]) {
          qIdx++;
        }
      }
      if (qIdx === qNorm.length) {
        score = Math.floor(30 + (qNorm.length / enNorm.length) * 20);
      } else {
        // Levenshtein fallback for minor typos
        const dist = levenshteinDistance(qNorm, enNorm);
        const maxLen = Math.max(qNorm.length, enNorm.length);
        if (dist <= 2 || (maxLen > 4 && dist <= 3)) {
          const sim = 1 - dist / maxLen;
          score = Math.floor(sim * 40);
        }
      }
    }
    bestScore = Math.max(bestScore, score);
  }

  // Bengali scoring
  if (bnNorm) {
    let score = 0;
    if (bnNorm === qNorm) {
      score = 100; // Exact match
    } else if (bnNorm.startsWith(qNorm)) {
      score = 85; // Starts with
    } else if (bnClean.split(' ').some(w => w.startsWith(qClean))) {
      score = 75; // Word starts with
    } else if (bnNorm.includes(qNorm)) {
      score = 50; // Contains substring
    } else {
      // Subsequence check
      let qIdx = 0;
      for (let i = 0; i < bnNorm.length && qIdx < qNorm.length; i++) {
        if (bnNorm[i] === qNorm[qIdx]) {
          qIdx++;
        }
      }
      if (qIdx === qNorm.length) {
        score = Math.floor(30 + (qNorm.length / bnNorm.length) * 20);
      } else {
        // Levenshtein fallback
        const dist = levenshteinDistance(qNorm, bnNorm);
        const maxLen = Math.max(qNorm.length, bnNorm.length);
        if (dist <= 2 || (maxLen > 4 && dist <= 3)) {
          const sim = 1 - dist / maxLen;
          score = Math.floor(sim * 40);
        }
      }
    }
    bestScore = Math.max(bestScore, score);
  }

  return bestScore;
}

export function fuzzyFilterStopsList<T extends FuzzyStop>(
  stops: T[],
  query: string,
  limit: number = 10
): T[] {
  if (!query || !query.trim()) return [];

  const scored = stops.map(stop => ({
    stop,
    score: fuzzyMatchStop(stop, query)
  }));

  return scored
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || a.stop.stopageEn.localeCompare(b.stop.stopageEn))
    .map(item => item.stop)
    .slice(0, limit);
}
