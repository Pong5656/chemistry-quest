export interface ChapterProgress {
  briefing: boolean;
  terminal: boolean;
  check: boolean;
  play: boolean;
  boss: boolean;
  bestScore: number;
  total: number;
  bestAtoms: number;
}

export type ProgressMap = Record<number, ChapterProgress>;

const KEY = "chemquest8bit.progress.v2";

export const emptyProgress = (): ChapterProgress => ({
  briefing: false,
  terminal: false,
  check: false,
  play: false,
  boss: false,
  bestScore: 0,
  total: 0,
  bestAtoms: 0,
});

export const ZONE_STEPS: (keyof ChapterProgress)[] = [
  "briefing",
  "terminal",
  "check",
  "play",
  "boss",
];

export function loadProgress(): ProgressMap {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed ? (parsed as ProgressMap) : {};
  } catch {
    return {};
  }
}

export function saveProgress(map: ProgressMap) {
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function markProgress(
  map: ProgressMap,
  id: number,
  patch: Partial<ChapterProgress>,
): ProgressMap {
  const next: ProgressMap = { ...map };
  next[id] = { ...emptyProgress(), ...(map[id] ?? {}), ...patch };
  saveProgress(next);
  return next;
}

export function completionPct(p?: ChapterProgress): number {
  if (!p) return 0;
  const done = ZONE_STEPS.filter((k) => p[k]).length;
  return Math.round((done / ZONE_STEPS.length) * 100);
}

export function isUnlocked(map: ProgressMap, id: number, unlockAll: boolean): boolean {
  if (unlockAll || id <= 1) return true;
  return !!map[id - 1]?.boss;
}
