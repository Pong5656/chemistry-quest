export interface Slide {
  /** หัวข้อสไลด์ */
  title: string;
  /** เนื้อหาย่อหน้า (แต่ละ string = 1 bullet) */
  body: string[];
  /** สมการ / สูตรที่ต้องแสดงเด่น */
  formula?: string;
  /** เทคนิคลัด / ทริคจำ */
  tip?: string;
  /** ตารางเสริม (ถ้ามี) */
  table?: { head: string[]; rows: string[][] };
}

export type CheckType = "match" | "fill_blank" | "drag_drop" | "order" | "true_false";

export interface ConceptCheck {
  type: CheckType;
  question: string;
  pairs?: { left: string; right: string }[];
  options?: string[];
  answer?: string;
  explain?: string;
}

export interface BossQuestion {
  q: string;
  choices: string[];
  /** index ของ choice ที่ถูก (0-3) */
  answer: number;
  difficulty: 1 | 2 | 3;
  hint: string;
}

export interface BossInfo {
  name: string;
  title: string;
  sprite: string;
  color: string;
  hp: number;
  taunt: string;
  defeat: string;
}

export interface Chapter {
  id: number;
  code: string;
  title: string;
  subtitle: string;
  volume: string;
  emoji: string;
  hue: string;
  briefing: string[];
  terminal: Slide[];
  checks: ConceptCheck[];
  boss: BossInfo;
  questions: BossQuestion[];
}

export type Zone = "map" | "learn" | "check" | "play" | "boss";

export interface Inventory {
  hp: number;
  shield: number;
  fifty: number;
  table: number;
  time: number;
}

export interface PlayResult {
  atoms: number;
  totalAtoms: number;
  hearts: number;
  bonus: number;
}
