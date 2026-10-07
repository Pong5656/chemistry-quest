import { useMemo, useState } from "react";
import type { Chapter, ConceptCheck as Check, Inventory } from "../types";
import { npcs } from "../data/npcs";
import { sfx } from "../lib/sfx";
import { cn } from "../utils/cn";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const TYPE_LABEL: Record<string, string> = {
  match: "จับคู่ข้อมูล",
  fill_blank: "เติมคำ",
  drag_drop: "เลือกคำตอบ",
  order: "เรียงลำดับ",
  true_false: "จริง / เท็จ",
};

export function ConceptCheck({
  chapter,
  onDone,
  onExit,
}: {
  chapter: Chapter;
  onDone: (inv: Inventory) => void;
  onExit: () => void;
}) {
  const npc = npcs[chapter.id];
  const [idx, setIdx] = useState(0);
  const [solved, setSolved] = useState(false);
  const [wrong, setWrong] = useState<string | null>(null);
  const [pickedLeft, setPickedLeft] = useState<number | null>(null);
  const [matched, setMatched] = useState<Record<number, string>>({});
  const [correct, setCorrect] = useState(0);
  const [showReward, setShowReward] = useState(false);

  const check: Check = chapter.checks[idx];
  const rights = useMemo(
    () => (check.pairs ? shuffle(check.pairs.map((p) => p.right)) : []),
    [idx, check],
  );

  const reset = () => {
    setSolved(false);
    setWrong(null);
    setPickedLeft(null);
    setMatched({});
  };

  const inventory: Inventory = {
    hp: 1 + (correct >= chapter.checks.length - 1 ? 1 : 0),
    shield: correct >= Math.ceil(chapter.checks.length / 2) ? 2 : 1,
    fifty: 1 + (correct === chapter.checks.length ? 1 : 0),
    table: 1,
    time: correct === chapter.checks.length ? 2 : 1,
  };

  const finish = () => {
    sfx.fanfare();
    setShowReward(true);
  };

  const next = () => {
    sfx.click();
    if (idx + 1 >= chapter.checks.length) {
      finish();
      return;
    }
    setIdx((x) => x + 1);
    reset();
  };

  const answerChoice = (opt: string) => {
    if (solved) return;
    if (opt === check.answer) {
      setSolved(true);
      setCorrect((c) => c + 1);
      setWrong(null);
      sfx.correct();
    } else {
      setWrong(opt);
      sfx.wrong();
      setTimeout(() => setWrong(null), 700);
    }
  };

  const pickRight = (r: string) => {
    if (solved || pickedLeft === null) return;
    const target = check.pairs![pickedLeft].right;
    if (r === target) {
      const nm = { ...matched, [pickedLeft]: r };
      setMatched(nm);
      setPickedLeft(null);
      sfx.coin();
      if (Object.keys(nm).length === check.pairs!.length) {
        setSolved(true);
        setCorrect((c) => c + 1);
        sfx.correct();
      }
    } else {
      setWrong(r);
      sfx.wrong();
      setTimeout(() => setWrong(null), 700);
    }
  };

  /* ---------------- REWARD SCREEN ---------------- */
  if (showReward) {
    return (
      <div className="mx-auto max-w-xl px-4 pb-16 pt-8">
        <div className="card pop-in overflow-hidden text-center">
          <div className="bg-gradient-to-br from-[#a3e635] to-[#22d3ee66] px-5 py-7">
            <div className="text-[60px]">🎁</div>
            <h2 className="mt-2 font-px text-[13px] text-[#0a0a18] sm:text-[16px]">PUZZLE CLEARED!</h2>
            <p className="mt-3 font-tech text-[13px] font-bold text-[#0a0a18]/80">
              ตอบถูก {correct}/{chapter.checks.length} ข้อ — รับไอเทมไปตะลุยด่านและสู้บอส!
            </p>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
              {[
                { k: "POTION", i: "🧪", n: inventory.hp, c: "#a3e635" },
                { k: "SHIELD", i: "🛡️", n: inventory.shield, c: "#22d3ee" },
                { k: "50:50", i: "🎯", n: inventory.fifty, c: "#fbbf24" },
                { k: "TABLE", i: "📖", n: inventory.table, c: "#a78bfa" },
                { k: "TIME+", i: "⏱️", n: inventory.time, c: "#f472b6" },
              ].map((it, k) => (
                <div
                  key={it.k}
                  className="pop-in rounded-xl border-[3px] border-[#0a0a18] bg-white/8 p-2.5"
                  style={{ animationDelay: `${k * 100}ms` }}
                >
                  <div className="text-2xl">{it.i}</div>
                  <div className="mt-1 font-px text-[6px]" style={{ color: it.c }}>
                    {it.k}
                  </div>
                  <div className="mt-1 font-px text-[10px] text-white">×{it.n}</div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => onDone(inventory)}
              className="btn-arcade mt-5 w-full py-3.5 font-px text-[11px]"
              style={{ ["--c" as string]: "#a3e635" }}
            >
              🕹️ ไปตะลุยด่านต่อ
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ---------------- PUZZLE ---------------- */
  return (
    <div className="mx-auto max-w-3xl px-4 pb-14 pt-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className="rounded-xl border-[3px] border-[#0a0a18] px-2.5 py-1.5 font-px text-[8px] text-[#0a0a18]"
            style={{ background: "#22d3ee" }}
          >
            CONTROL PANEL
          </span>
          <h2 className="font-tech text-base font-bold text-white sm:text-lg">ทดสอบความเข้าใจก่อนขึ้นด่าน</h2>
        </div>
        <button type="button" onClick={() => { sfx.back(); onExit(); }} className="btn-ghost px-3 py-2 font-px text-[8px]">
          ◀ แผนที่
        </button>
      </div>

      <div className="card mb-3 flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            {chapter.checks.map((_, k) => (
              <span
                key={k}
                className={cn(
                  "h-2.5 rounded-full transition-all",
                  k === idx ? "w-7" : "w-2.5",
                  k < idx ? "bg-[#a3e635]" : k === idx ? "bg-[#fbbf24]" : "bg-white/20",
                )}
              />
            ))}
          </div>
          <span className="font-px text-[8px] text-white/50 tnum">
            {idx + 1}/{chapter.checks.length}
          </span>
        </div>
        <span className="font-tech text-[11px] text-white/45">
          ✅ ตอบถูก <b className="text-[#a3e635]">{correct}</b> · ไม่จำกัดเวลา
        </span>
      </div>

      <div className="card overflow-hidden">
        <div
          className="flex items-center gap-3 border-b-[3px] border-[#0a0a18] px-4 py-3"
          style={{ background: `linear-gradient(90deg, ${chapter.hue}33, transparent)` }}
        >
          <span className="text-2xl">{npc.avatar}</span>
          <div className="min-w-0 flex-1">
            <p className="font-px text-[7px]" style={{ color: npc.color }}>
              {npc.name}
            </p>
            <p className="mt-1 truncate font-tech text-[11px] text-white/55">
              ประเภท: {TYPE_LABEL[check.type]} — ลองทำดูสิ ผิดได้ ไม่ถูกลงโทษ
            </p>
          </div>
        </div>

        <div className="p-4 sm:p-6">
          <p key={idx} className="slide-up font-tech text-[16px] font-bold leading-relaxed text-white">
            {check.question}
          </p>

          {/* ---- MATCH ---- */}
          {check.type === "match" && (
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <div className="font-px text-[7px] text-white/35">คอลัมน์ A</div>
                {check.pairs!.map((p, li) => {
                  const isMatched = matched[li] !== undefined;
                  const active = pickedLeft === li;
                  return (
                    <button
                      key={li}
                      type="button"
                      disabled={isMatched || solved}
                      onClick={() => {
                        sfx.click();
                        setPickedLeft(active ? null : li);
                      }}
                      className={cn(
                        "w-full rounded-xl border-[3px] border-[#0a0a18] px-3 py-3 text-left font-tech text-[13px] transition-all",
                        isMatched
                          ? "bg-[#a3e635]/25 text-[#a3e635]"
                          : active
                            ? "-translate-y-0.5 bg-[#fbbf24] text-[#0a0a18] shadow-[0_5px_0_rgba(0,0,0,.5)]"
                            : "bg-white/8 text-white hover:bg-white/16",
                      )}
                    >
                      {isMatched ? "✔ " : "▸ "}
                      {p.left}
                      {isMatched && (
                        <span className="mt-1 block font-tech text-[11px] text-[#a3e635]">→ {matched[li]}</span>
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="space-y-2">
                <div className="font-px text-[7px] text-white/35">คอลัมน์ B</div>
                {rights.map((r) => {
                  const used = Object.values(matched).includes(r);
                  return (
                    <button
                      key={r}
                      type="button"
                      disabled={used || solved}
                      onClick={() => pickRight(r)}
                      className={cn(
                        "w-full rounded-xl border-[3px] border-[#0a0a18] px-3 py-3 text-left font-tech text-[13px] transition-all",
                        used ? "bg-white/4 text-white/20" : "bg-white/8 text-white hover:-translate-y-0.5 hover:bg-white/16",
                        wrong === r && "shake border-[#f472b6] bg-[#f472b6]/25",
                      )}
                    >
                      {r}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ---- CHOICE ---- */}
          {check.type !== "match" && (
            <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
              {(check.options ?? []).map((opt, i) => {
                const isRight = solved && opt === check.answer;
                return (
                  <button
                    key={opt}
                    type="button"
                    disabled={solved}
                    onClick={() => answerChoice(opt)}
                    className={cn(
                      "slide-up rounded-xl border-[3px] border-[#0a0a18] px-3.5 py-3 text-left font-tech text-[13.5px] transition-all",
                      isRight
                        ? "bg-[#a3e635] text-[#0a0a18] shadow-[0_5px_0_#3f6212]"
                        : "bg-white/8 text-white hover:-translate-y-0.5 hover:bg-white/16",
                      wrong === opt && "shake border-[#f472b6] bg-[#f472b6]/30",
                    )}
                    style={{ animationDelay: `${i * 60}ms` }}
                  >
                    <span className="mr-2 font-px text-[9px] text-[#fbbf24]">
                      {String.fromCharCode(65 + i)}
                    </span>
                    {opt}
                  </button>
                );
              })}
            </div>
          )}

          {solved && (
            <div className="pop-in mt-5 rounded-xl border-[3px] border-[#0a0a18] bg-gradient-to-br from-[#14532d] to-[#166534] p-4">
              <div className="font-px text-[9px] text-[#a3e635]">✔ ถูกต้อง!</div>
              {check.explain && (
                <p className="mt-2.5 font-tech text-[13.5px] leading-relaxed text-white/90">{check.explain}</p>
              )}
            </div>
          )}

          <div className="mt-6 flex items-center justify-between gap-3">
            <span className="font-tech text-[11px] text-white/40">
              {npc.avatar} {npc.name.split(" ").pop()} คอยให้คำแนะนำอยู่
            </span>
            <button
              type="button"
              disabled={!solved}
              onClick={next}
              className={cn("btn-arcade px-5 py-3 font-px text-[10px]", !solved && "opacity-40")}
              style={{ ["--c" as string]: solved ? "#a3e635" : "#4a5578" }}
            >
              {idx + 1 >= chapter.checks.length ? "รับรางวัล 🎁" : "ข้อต่อไป ▶"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
