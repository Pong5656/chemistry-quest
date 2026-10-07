/** ระบบผู้เล่น: XP · เลเวล · ฉายา · เหรียญตรา */
export interface PlayerStats {
  beats: number;
  checksCorrect: number;
  atoms: number;
  bossCorrect: number;
  bosses: number;
  lessons: number;
  perfectRuns: number;
}

export interface Player {
  xp: number;
  badges: string[];
  stats: PlayerStats;
}

const KEY = "chemquest.player.v1";

export const EMPTY_PLAYER: Player = {
  xp: 0,
  badges: [],
  stats: {
    beats: 0,
    checksCorrect: 0,
    atoms: 0,
    bossCorrect: 0,
    bosses: 0,
    lessons: 0,
    perfectRuns: 0,
  },
};

export const TITLES = [
  "นักเคมีจิ๋ว 🥚",
  "ผู้ช่วยห้องแล็บ 🧪",
  "นักเคมีฝึกหัด ⚗️",
  "นักเคมีประจำห้อง 🔬",
  "ครูตัวจิ๋ววิชาเคมี 🎓",
  "นักวิเคราะห์โมเลกุล 🧬",
  "จอมเวทธาตุ 🪄",
  "ปรมาจารย์สมการเคมี 📜",
  "ตำนานแห่งตารางธาตุ 👑",
  "เทพเคมีแห่งจักรวาล 🌌",
];

const LEVEL_STEP = 260;

export function levelOf(xp: number) {
  return Math.min(TITLES.length, Math.floor(xp / LEVEL_STEP) + 1);
}
export function levelFloor(level: number) {
  return (level - 1) * LEVEL_STEP;
}
export function levelProgress(xp: number) {
  const lv = levelOf(xp);
  const lo = levelFloor(lv);
  const hi = levelFloor(lv + 1);
  return {
    level: lv,
    title: TITLES[lv - 1],
    pct: Math.max(0, Math.min(100, Math.round(((xp - lo) / (hi - lo)) * 100))),
    cur: xp - lo,
    need: hi - lo,
  };
}

export interface Badge {
  id: string;
  name: string;
  icon: string;
  desc: string;
  test: (p: Player) => boolean;
}

export const BADGES: Badge[] = [
  { id: "first-step", name: "ก้าวแรกสู่เคมี", icon: "👣", desc: "เริ่มเรียนบทแรก", test: (p) => p.stats.beats >= 5 },
  { id: "reader", name: "นักอ่านตัวจริง", icon: "📚", desc: "อ่านบทเรียน 300 ช่วง", test: (p) => p.stats.beats >= 300 },
  { id: "check-10", name: "มือพระสอบตรง", icon: "🎯", desc: "ตอบเช็คความเข้าใจถูก 10 ข้อ", test: (p) => p.stats.checksCorrect >= 10 },
  { id: "check-50", name: "สนามซ้อมข้อสอบ", icon: "🏹", desc: "ตอบเช็คความเข้าใจถูก 50 ข้อ", test: (p) => p.stats.checksCorrect >= 50 },
  { id: "atom-50", name: "นักสะสมอะตอม", icon: "⚛️", desc: "เก็บอะตอม 50 อนุภาค", test: (p) => p.stats.atoms >= 50 },
  { id: "atom-200", name: "เจ้าของเหมืองอะตอม", icon: "⛏️", desc: "เก็บอะตอม 200 อนุภาค", test: (p) => p.stats.atoms >= 200 },
  { id: "boss-1", name: "จอมล่าบอส", icon: "⚔️", desc: "เอาชนะบอสครั้งแรก", test: (p) => p.stats.bosses >= 1 },
  { id: "boss-5", name: "นักผจญบอส", icon: "🗡️", desc: "เอาชนะบอส 5 ตัว", test: (p) => p.stats.bosses >= 5 },
  { id: "boss-all", name: "ผู้พิชิตเคมี ม.ปลาย", icon: "🏆", desc: "เอาชนะบอสครบ 14 ตัว", test: (p) => p.stats.bosses >= 14 },
  { id: "boss-correct-50", name: "มือปราบข้อสอบ", icon: "💥", desc: "ตอบบอสถูก 50 ข้อ", test: (p) => p.stats.bossCorrect >= 50 },
  { id: "perfect", name: "สมบูรณ์แบบ", icon: "💎", desc: "ชนะบอสแบบไม่พลาดเลย", test: (p) => p.stats.perfectRuns >= 1 },
  { id: "lv5", name: "เลเวล 5", icon: "⭐", desc: "เลื่อนขั้นเป็นเลเวล 5", test: (p) => levelOf(p.xp) >= 5 },
];

export function loadPlayer(): Player {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY_PLAYER, badges: [], stats: { ...EMPTY_PLAYER.stats } };
    const p = JSON.parse(raw);
    return {
      xp: p.xp ?? 0,
      badges: p.badges ?? [],
      stats: { ...EMPTY_PLAYER.stats, ...(p.stats ?? {}) },
    };
  } catch {
    return { ...EMPTY_PLAYER, badges: [], stats: { ...EMPTY_PLAYER.stats } };
  }
}

export function savePlayer(p: Player) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

export interface XpResult {
  player: Player;
  gained: number;
  leveledUp: boolean;
  newLevel: number;
  newBadges: Badge[];
}

export function addXP(base: Player, gained: number, stat?: Partial<PlayerStats>): XpResult {
  const before = levelOf(base.xp);
  const stats = { ...base.stats };
  for (const k of Object.keys(stat ?? {}) as (keyof PlayerStats)[]) {
    stats[k] += stat?.[k] ?? 0;
  }
  const player: Player = { ...base, xp: base.xp + gained, stats };
  const after = levelOf(player.xp);
  const owned = new Set(player.badges);
  const newBadges = BADGES.filter((b) => !owned.has(b.id) && b.test(player));
  if (newBadges.length) player.badges = [...player.badges, ...newBadges.map((b) => b.id)];
  savePlayer(player);
  return { player, gained, leveledUp: after > before, newLevel: after, newBadges };
}
