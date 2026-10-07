import type { BossQuestion, Chapter } from "../types";

export type BeatKind =
  | "talk"
  | "concept"
  | "example"
  | "formula"
  | "table"
  | "tip"
  | "check"
  | "recap";

export interface Beat {
  id: string;
  kind: BeatKind;
  slide: number;
  text?: string;
  title?: string;
  formula?: string;
  table?: { head: string[]; rows: string[][] };
  tip?: string;
  steps?: string[];
  question?: BossQuestion;
}

/** ประโยคเปิดของครู — สุภาพ ใจเย็น ไม่เร่งผู้เรียน */
const OPENERS = [
  "โอเคนะ เรามาไล่เรื่องนี้ทีละส่วน ช้า ๆ ไม่ต้องรีบ เดี๋ยวครูอธิบายให้ฟังละเอียด",
  "หัวข้อนี้หลายคนงงตอนแรก แต่ถ้าไล่ทีละคำจะเข้าใจทันทีเลยนะ ไปดูกัน",
  "เอาล่ะ ก่อนอ่านสูตร ขอเล่าภาพรวมให้ฟังก่อนว่ามันคืออะไร และเราต้องใช้มันเพื่ออะไร",
  "เรื่องนี้สำคัญมากในข้อสอบ เลยขออธิบายละเอียดหน่อย ตั้งใจตามครูนะ",
  "ถ้าหัวข้อก่อนหน้ายังไม่แน่น ไม่เป็นไร เราทบทวนพร้อมกันในหัวข้อนี้เลย",
  "ครูจะใช้ตัวอย่างง่าย ๆ ก่อน แล้วค่อยเพิ่มความยากทีหลังนะ",
];

/** ประโยคชมเมื่อผู้เรียนกด "เข้าใจแล้ว" */
export const PRAISE = [
  "เก่งมาก! ไปต่อกันเลยนะ",
  "ดีเลย เข้าใจแล้วนะ ครูเห็นแล้ว",
  "ยอดเยี่ยม! อีกนิดเดียว",
  "เยี่ยม! ความเข้าใจของเธอเพิ่มขึ้นเรื่อย ๆ นะ",
  "นั่นแหละ ต่อไปเลยครู",
  "เก่งมาก ข้อสอบแบบนี้เธอทำได้แน่นอน",
];

/** ประโยคให้กำลังใจเมื่อตอบเช็คความเข้าใจผิด */
export const ENCOURAGE = [
  "ไม่เป็นไรนะ เคมีคือวิชาที่ต้องฝึก อ่านคำอธิบายแล้วลองใหม่",
  "ผิดได้ไม่เป็นไรเลย แสดงว่าเราเจอจุดที่ต้องทบทวน — ดีแล้ว!",
  "อย่าท้อนะ ตรงนี้คนเก่ง ๆ ก็พลาดกันบ่อย ดูเฉลยกัน",
  "โอเค ครูอธิบายเพิ่มอีกรอบ ให้เข้าใจจริง ๆ นะ",
];

const EXAMPLE_RE = /^(ขั้น|ตัวอย่าง|วิธีทำ|คำนวณ|สมมติ|โจทย์|จากนั้น|จึง|ดังนั้น)/;

/** สร้างบทเรียนแบบ "จับมือ" จากข้อมูลสไลด์ของบท */
export function buildBeats(chapter: Chapter): Beat[] {
  const beats: Beat[] = [];
  const push = (b: Omit<Beat, "id">) => beats.push({ ...b, id: `${b.slide}-${b.kind}-${beats.length}` });

  const easyQs = chapter.questions.filter((q) => q.difficulty === 1);
  const midQs = chapter.questions.filter((q) => q.difficulty === 2);
  let qi = 0;
  const nextCheck = (pool: BossQuestion[]): BossQuestion | undefined =>
    pool.length ? pool[qi++ % pool.length] : undefined;

  chapter.terminal.forEach((s, si) => {
    push({ kind: "talk", slide: si, title: s.title, text: OPENERS[si % OPENERS.length] });

    let steps: string[] = [];
    const flush = () => {
      if (steps.length) {
        push({ kind: "example", slide: si, title: "แก้โจทย์ทีละขั้น", steps });
        steps = [];
      }
    };

    s.body.forEach((line) => {
      if (EXAMPLE_RE.test(line)) {
        steps.push(line);
      } else {
        flush();
        push({ kind: "concept", slide: si, text: line });
      }
    });
    flush();

    if (s.formula)
      push({
        kind: "formula",
        slide: si,
        formula: s.formula,
        text: "สูตรนี้ต้องจำให้ขึ้นใจนะ เดี๋ยวใช้บ่อยมากในโจทย์",
      });
    if (s.table) push({ kind: "table", slide: si, table: s.table, text: "ตารางนี้ช่วยให้จำง่ายขึ้น ลองไล่อ่านทีละแถว" });
    if (s.tip) push({ kind: "tip", slide: si, tip: s.tip, text: "ทริคลัดจากครู — ใช้ปุ่มนี้ตอนสอบจะประหยัดเวลามาก!" });

    // เช็คความเข้าใจสั้น ๆ ทุก ๆ 4 สไลด์
    if ((si + 1) % 4 === 0) {
      const q = nextCheck(easyQs.length ? easyQs : chapter.questions);
      if (q) push({ kind: "check", slide: si, question: q });
    }
  });

  // เช็คความเข้าใจระดับกลางก่อนจบ
  const finalQ = midQs.length ? midQs[0] : undefined;
  if (finalQ) push({ kind: "check", slide: chapter.terminal.length - 1, question: finalQ });

  push({
    kind: "recap",
    slide: chapter.terminal.length - 1,
    title: "สรุปก่อนไปต่อ",
    steps: chapter.briefing.slice(0, 5),
    text: "อ่านครบแล้ว! ก่อนไปทำพัซเซิล ลองย้อนดู 5 ข้อนี้อีกครั้งนะ",
  });

  return beats;
}

/** อ่านออกเสียงภาษาไทย (Web Speech API) */
export function speak(text: string, enabled: boolean) {
  if (!enabled || typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/[⭐⚡▸▚✦]/g, ""));
    u.lang = "th-TH";
    u.rate = 0.95;
    window.speechSynthesis.speak(u);
  } catch {
    /* ignore */
  }
}

export function stopSpeaking() {
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* ignore */
  }
}

export const KIND_LABEL: Record<BeatKind, { label: string; icon: string; color: string }> = {
  talk: { label: "ครูเล่าให้ฟัง", icon: "💬", color: "#fbbf24" },
  concept: { label: "เนื้อหาสำคัญ", icon: "📖", color: "#22d3ee" },
  example: { label: "ตัวอย่างทีละขั้น", icon: "🧮", color: "#a3e635" },
  formula: { label: "สูตรที่ต้องจำ", icon: "⚛️", color: "#f472b6" },
  table: { label: "ตารางเปรียบเทียบ", icon: "📊", color: "#a78bfa" },
  tip: { label: "ทริคลัด", icon: "⚡", color: "#fde047" },
  check: { label: "เช็คความเข้าใจ", icon: "🎯", color: "#fb923c" },
  recap: { label: "สรุปบท", icon: "🏁", color: "#a3e635" },
};
