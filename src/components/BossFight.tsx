import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BossQuestion, Chapter, Inventory } from "../types";
import { npcs } from "../data/npcs";
import { sfx } from "../lib/sfx";
import { SciCalc } from "./SciCalc";
import { cn } from "../utils/cn";

const BASE_DMG = [0, 9, 15, 23];
const PLAYER_DMG = [0, 9, 14, 20];
const TIME_LIMIT = [0, 35, 40, 50];
const BOSS_MAX_HP = 150;

interface QItem extends BossQuestion {
  /** ลำดับเดิมของตัวเลือก หลังสุ่ม */
  order: number[];
  correct: number;
}

function shuffle<T>(a: T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

/** เตรียมชุดข้อสอบ: เรียงตามคลื่นความยาก + สุ่มลำดับในคลื่น + สุ่มตัวเลือก */
function buildExam(chapter: Chapter): QItem[] {
  const byWave = [1, 2, 3].map(
    (d) => shuffle(chapter.questions.filter((q) => q.difficulty === d)),
  );
  // บรรจุให้ได้ ~22 ข้อ: wave1 7, wave2 8, wave3 เท่าที่มี (หรือเติมจากที่เหลือ)
  const picked = [...byWave[0].slice(0, 7), ...byWave[1].slice(0, 8), ...byWave[2]];
  const rest = shuffle(
    chapter.questions.filter((q) => !picked.includes(q)),
  );
  const final = [...picked, ...rest].slice(0, Math.min(22, chapter.questions.length));
  return final.map((q) => {
    const order = shuffle(q.choices.map((_, i) => i));
    return {
      ...q,
      order,
      choices: order.map((i) => q.choices[i]),
      correct: order.indexOf(q.answer),
    };
  });
}

interface Pop {
  id: number;
  text: string;
  color: string;
  side: "boss" | "player";
}

export function BossFight({
  chapter,
  inventory,
  onFinish,
  onExit,
  onRetry,
  onNext,
  hasNext,
}: {
  chapter: Chapter;
  inventory: Inventory;
  onFinish: (win: boolean, score: number, total: number) => void;
  onExit: () => void;
  onRetry: () => void;
  onNext: () => void;
  hasNext: boolean;
}) {
  const exam = useMemo(() => buildExam(chapter), [chapter]);
  const npc = npcs[chapter.id];
  const [phase, setPhase] = useState<"intro" | "fight" | "win" | "lose">("intro");
  const [qi, setQi] = useState(0);
  const [bossHP, setBossHP] = useState(BOSS_MAX_HP);
  const [playerHP, setPlayerHP] = useState(100);
  const [picked, setPicked] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);
  const [shield, setShield] = useState(false);
  const [cut, setCut] = useState<number[]>([]);
  const [hintOn, setHintOn] = useState(false);
  const [inv, setInv] = useState<Inventory>(inventory);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [pops, setPops] = useState<Pop[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const [banner, setBanner] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT[1]);
  const [shakeArena, setShakeArena] = useState(false);
  const [bossMood, setBossMood] = useState<"idle" | "attack" | "hurt">("idle");
  const [flash, setFlash] = useState<string | null>(null);
  const popId = useRef(0);

  const q = exam[qi];
  const wave = q?.difficulty ?? 1;
  const waveName =
    wave === 1 ? "WAVE 1 · พื้นฐาน" : wave === 2 ? "WAVE 2 · ประยุกต์" : "WAVE 3 · POSN / A-LEVEL";

  useEffect(() => {
    setPhase("intro");
    setQi(0);
    setBossHP(BOSS_MAX_HP);
    setPlayerHP(100);
    setScore(0);
    setCombo(0);
    setBestCombo(0);
    setLog([chapter.boss.taunt]);
    setInv(inventory);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapter.id]);

  useEffect(() => {
    if (qi < exam.length) {
      setTimeLeft(TIME_LIMIT[exam[qi].difficulty]);
      setPicked(null);
      setLocked(false);
      setCut([]);
      setHintOn(false);
      if (qi === 0) {
        setBanner("WAVE 1 START!");
        sfx.waveStart();
        setTimeout(() => setBanner(null), 1500);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qi]);

  // ประกาศคลื่นใหม่
  useEffect(() => {
    if (phase !== "fight" || qi === 0) return;
    const d = exam[qi].difficulty;
    const pd = qi > 0 ? exam[qi - 1].difficulty : 1;
    if (d !== pd) {
      setBanner(`WAVE ${d} START!`);
      sfx.waveStart();
      const t = setTimeout(() => setBanner(null), 1500);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qi, phase]);

  const pop = useCallback((text: string, color: string, side: "boss" | "player") => {
    const id = ++popId.current;
    setPops((p) => [...p, { id, text, color, side }]);
    setTimeout(() => setPops((p) => p.filter((x) => x.id !== id)), 1000);
  }, []);

  const addLog = (s: string) => setLog((l) => [s, ...l].slice(0, 6));

  const endBattle = (result: "win" | "lose") => {
    setPhase(result);
    if (result === "win") sfx.fanfare();
    else sfx.gameOver();
    onFinish(result === "win", score, exam.length);
  };

  const resolve = useCallback(
    (choice: number | null) => {
      setLocked(true);
      setPicked(choice);
      const correct = choice !== null && choice === q.correct;
      const mult = 1 + Math.min(combo, 6) * 0.1; // คอมโบเพิ่มดาเมจสูงสุด 1.6 เท่า

      if (correct) {
        const dmg = Math.round(BASE_DMG[q.difficulty] * mult);
        const nb = Math.max(0, bossHP - dmg);
        setBossHP(nb);
        setScore((s) => s + 1);
        setCombo((c) => {
          const nc = c + 1;
          setBestCombo((b) => Math.max(b, nc));
          return nc;
        });
        setBossMood("hurt");
        setFlash("#a3e635");
        pop(`-${dmg}`, "#a3e635", "boss");
        if (combo + 1 >= 3) pop(`COMBO x${combo + 1}!`, "#fbbf24", "boss");
        sfx.bossHit();
        addLog(`✔ ถูกต้อง! โจมตี ${dmg} ดาเมจ${combo + 1 >= 2 ? ` (คอมโบ ${combo + 1})` : ""}`);
        setTimeout(() => {
          setBossMood("idle");
          setFlash(null);
        }, 380);
        if (nb <= 0) {
          setTimeout(() => endBattle("win"), 450);
          return;
        }
      } else {
        let dmg = PLAYER_DMG[q.difficulty];
        setCombo(0);
        if (shield) {
          dmg = 0;
          setShield(false);
          pop("BLOCKED", "#22d3ee", "player");
          addLog("🛡️ Shield บล็อกการโจมตีทั้งหมด!");
          sfx.land();
        } else {
          setBossMood("attack");
          setShakeArena(true);
          setFlash("#f472b6");
          pop(`-${dmg}`, "#f472b6", "player");
          sfx.hurt();
          addLog(
            choice === null
              ? `⏰ หมดเวลา! คำตอบคือ ${q.choices[q.correct]} — โดนโจมตี ${dmg}`
              : `✘ ผิด คำตอบคือ ${q.choices[q.correct]} — โดนโจมตี ${dmg}`,
          );
          setTimeout(() => {
            setShakeArena(false);
            setBossMood("idle");
            setFlash(null);
          }, 420);
        }
        const np = Math.max(0, playerHP - dmg);
        setPlayerHP(np);
        if (np <= 0) {
          setTimeout(() => endBattle("lose"), 450);
          return;
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [q, bossHP, playerHP, combo, shield],
  );

  // ตัวจับเวลา
  useEffect(() => {
    if (phase !== "fight" || locked) return;
    const t = setInterval(() => {
      setTimeLeft((v) => {
        if (v <= 0.1) {
          clearInterval(t);
          resolve(null);
          return 0;
        }
        return +(v - 0.1).toFixed(1);
      });
    }, 100);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, locked, qi]);

  const next = () => {
    if (qi + 1 >= exam.length) {
      const pct = Math.round((score / exam.length) * 100);
      endBattle(bossHP <= 0 || pct >= 60 ? "win" : "lose");
      return;
    }
    sfx.click();
    setQi((x) => x + 1);
  };

  const useItem = (k: keyof Inventory) => {
    if (inv[k] <= 0 || phase !== "fight") return;
    if (k === "hp") {
      if (playerHP >= 100) return;
      setPlayerHP((h) => Math.min(100, h + 40));
      pop("+40 HP", "#a3e635", "player");
      addLog("🧪 ใช้ HP Potion ฟื้นฟู 40 HP");
      sfx.correct();
    }
    if (k === "shield") {
      setShield(true);
      addLog("🛡️ เปิด Shield — บล็อกการโจมตีครั้งถัดไป");
      sfx.unlock();
    }
    if (k === "fifty") {
      if (locked) return;
      const wrongs = q.choices.map((_, i) => i).filter((i) => i !== q.correct);
      const keep = shuffle(wrongs).slice(0, 1);
      setCut(wrongs.filter((w) => !keep.includes(w)));
      addLog("🎯 ใช้ 50:50 ตัดตัวเลือกที่ผิดออก 2 ข้อ");
      sfx.click();
    }
    if (k === "table") {
      setHintOn(true);
      addLog("📖 เปิดตารางธาตุพกพา — เผยคำใบ้จาก " + npc.name);
      sfx.unlock();
    }
    if (k === "time") {
      setTimeLeft((v) => v + 25);
      addLog("⏱️ ใช้ Time Freeze เพิ่มเวลาอีก 25 วินาที");
      sfx.unlock();
    }
    setInv((v) => ({ ...v, [k]: v[k] - 1 }));
  };

  const accuracy = Math.round((score / Math.max(1, qi + (locked ? 1 : 0))) * 100);
  const stars = accuracy >= 90 ? 3 : accuracy >= 70 ? 2 : accuracy >= 50 ? 1 : 0;

  /* ================= INTRO ================= */
  if (phase === "intro") {
    return (
      <div className="mx-auto max-w-3xl px-4 pb-14 pt-6">
        <div className="card overflow-hidden">
          <div
            className="relative px-5 py-8 text-center"
            style={{ background: `linear-gradient(160deg, ${chapter.boss.color}, ${chapter.boss.color}33)` }}
          >
            <div className="orb h-40 w-40 bg-white/60" style={{ left: "-2rem", top: "-2rem" }} />
            <div className="relative">
              <div className="bob mx-auto text-[76px]" style={{ filter: "drop-shadow(0 10px 0 rgba(0,0,0,.45))" }}>
                {chapter.boss.sprite}
              </div>
              <h2 className="mt-3 font-px text-[16px] text-[#0a0a18] sm:text-[20px]">{chapter.boss.name}</h2>
              <p className="mt-2 font-tech text-[13px] font-bold text-[#0a0a18]/80">{chapter.boss.title}</p>
              <p className="mx-auto mt-4 max-w-md font-tech text-[14px] font-bold leading-relaxed text-[#0a0a18]">
                “{chapter.boss.taunt}”
              </p>
            </div>
          </div>

          <div className="p-5">
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { k: "จำนวนข้อ", v: `${exam.length}`, i: "📝" },
                { k: "คลื่นความยาก", v: "3 คลื่น", i: "🌊" },
                { k: "BOSS HP", v: `${BOSS_MAX_HP}`, i: "👾" },
              ].map((s) => (
                <div key={s.k} className="card-soft flex items-center gap-2.5 p-3">
                  <span className="text-xl">{s.i}</span>
                  <div>
                    <div className="font-px text-[6px] text-white/45">{s.k}</div>
                    <div className="mt-1 font-px text-[10px] text-white">{s.v}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-xl border-2 border-[#22d3ee]/35 bg-[#22d3ee]/10 p-3.5">
              <p className="font-tech text-[12px] leading-relaxed text-white/85">
                <b className="text-[#22d3ee]">{npc.avatar} {npc.name} กระซิบว่า:</b> {npc.bossTip}
              </p>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="font-px text-[8px] text-white/45">🎒 ไอเทมที่มี:</span>
              {[
                ["hp", "🧪"],
                ["shield", "🛡️"],
                ["fifty", "🎯"],
                ["table", "📖"],
                ["time", "⏱️"],
              ].map(([k, ic]) => (
                <span key={k} className="rounded-lg border-2 border-white/15 bg-black/30 px-2 py-1 font-tech text-[11px] text-white/80">
                  {ic} ×{inv[k as keyof Inventory]}
                </span>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  sfx.waveStart();
                  setPhase("fight");
                  setQi(0);
                }}
                className="btn-arcade px-6 py-3.5 font-px text-[12px]"
                style={{ ["--c" as string]: "#f472b6" }}
              >
                ⚔️ เริ่มต่อสู้
              </button>
              <button type="button" onClick={() => { sfx.back(); onExit(); }} className="btn-ghost px-4 py-3.5 font-px text-[9px]">
                ◀ ย้อนกลับ
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ================= RESULT ================= */
  if (phase === "win" || phase === "lose") {
    const win = phase === "win";
    return (
      <div className="mx-auto max-w-2xl px-4 pb-14 pt-8">
        <div className="card pop-in overflow-hidden text-center">
          <div
            className="px-5 py-8"
            style={{
              background: win
                ? "linear-gradient(160deg,#a3e635,#22d3ee55)"
                : "linear-gradient(160deg,#f472b6,#78350f55)",
            }}
          >
            <div className="text-[64px]">{win ? "🏆" : "💀"}</div>
            <h2 className="mt-3 font-px text-[15px] text-[#0a0a18] sm:text-[19px]">
              {win ? "BOSS DEFEATED!" : "GAME OVER"}
            </h2>
            <div className="mt-3 flex justify-center gap-2">
              {[0, 1, 2].map((k) => (
                <span
                  key={k}
                  className={cn("text-3xl transition-all", k < stars ? "scale-110" : "scale-90 opacity-25 grayscale")}
                  style={{ animationDelay: `${k * 180}ms` }}
                >
                  ⭐
                </span>
              ))}
            </div>
          </div>

          <div className="p-5">
            <p className="font-tech text-[14px] leading-relaxed text-white/80">
              {win
                ? `“${chapter.boss.defeat}”`
                : `${chapter.boss.name} ยังแข็งแกร่งเกินไป… กลับไปทบทวนบทเรียนกับ ${npc.name} แล้วลองใหม่นะ!`}
            </p>

            <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {[
                { k: "คะแนน", v: `${score}/${exam.length}`, c: "#fbbf24" },
                { k: "ความแม่นยำ", v: `${accuracy}%`, c: "#22d3ee" },
                { k: "คอมโบสูงสุด", v: `${bestCombo}`, c: "#a3e635" },
                { k: "HP คงเหลือ", v: `${Math.round(playerHP)}`, c: "#f472b6" },
              ].map((s) => (
                <div key={s.k} className="card-soft p-3">
                  <div className="font-px text-[6px] text-white/45">{s.k}</div>
                  <div className="mt-1.5 font-px text-[11px] tnum" style={{ color: s.c }}>
                    {s.v}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-xl border-2 border-white/12 bg-black/25 p-3.5">
              <div className="font-px text-[7px] text-white/40">RANK</div>
              <div className="mt-2 font-px text-[12px]" style={{ color: "#fbbf24" }}>
                {accuracy >= 90
                  ? "S — นักเคมีระดับโอลิมปิก!"
                  : accuracy >= 75
                    ? "A — นักเคมีตัวจริง"
                    : accuracy >= 60
                      ? "B — เข้าใจแล้ว ยังต้องฝึก"
                      : accuracy >= 40
                        ? "C — ทบทวนเทคนิคลัดอีกครั้ง"
                        : "D — กลับไปอ่านบทเรียนก่อนนะ"}
              </div>
            </div>

            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  sfx.click();
                  onRetry();
                }}
                className="btn-arcade px-5 py-3 font-px text-[10px]"
                style={{ ["--c" as string]: "#fbbf24" }}
              >
                🔁 สู้ใหม่
              </button>
              {win && hasNext && (
                <button
                  type="button"
                  onClick={() => {
                    sfx.unlock();
                    onNext();
                  }}
                  className="btn-arcade px-5 py-3 font-px text-[10px]"
                  style={{ ["--c" as string]: "#a3e635" }}
                >
                  ด่านถัดไป ▶
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  sfx.back();
                  onExit();
                }}
                className="btn-ghost px-4 py-3 font-px text-[9px]"
              >
                ◀ แผนที่
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ================= FIGHT ================= */
  return (
    <div className="mx-auto max-w-5xl px-3 pb-14 pt-5 sm:px-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className="rounded-xl border-[3px] border-[#0a0a18] px-2.5 py-1.5 font-px text-[8px] text-[#0a0a18]"
            style={{ background: "#f472b6" }}
          >
            BOSS FIGHT
          </span>
          <h2 className="font-tech text-base font-bold text-white sm:text-lg">
            {chapter.boss.name} · {chapter.code}
          </h2>
        </div>
        <button type="button" onClick={() => { sfx.back(); onExit(); }} className="btn-ghost px-3 py-2 font-px text-[8px]">
          ◀ แผนที่
        </button>
      </div>

      {/* ===== ARENA ===== */}
      <div
        className={cn(
          "card crt-lines relative overflow-hidden p-3 sm:p-5",
          shakeArena && "shake",
          flash && "hurt-flash",
        )}
      >
        <div className="orb h-44 w-44" style={{ background: chapter.boss.color, left: "8%", top: "-2rem" }} />
        <div className="orb h-40 w-40 bg-cyan-400" style={{ right: "8%", bottom: "-2rem", animationDelay: "1.2s" }} />

        {/* HP BARS */}
        <div className="relative grid gap-4 sm:grid-cols-2">
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="font-px text-[8px] text-white/70">👩‍🔬 PLAYER</span>
              <span className="font-px text-[8px] text-[#a3e635] tnum">
                {Math.round(playerHP)}/100
              </span>
            </div>
            <div className="bar-track h-5">
              <div
                className="bar-fill"
                style={{ width: `${playerHP}%`, background: "linear-gradient(90deg,#a3e635,#22d3ee)" }}
              />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {shield && (
                <span className="rounded border-2 border-[#0a0a18] bg-[#22d3ee] px-1.5 py-0.5 font-px text-[6px] text-[#0a0a18]">
                  🛡️ SHIELD
                </span>
              )}
              {combo >= 2 && (
                <span className="rounded border-2 border-[#0a0a18] bg-[#fbbf24] px-1.5 py-0.5 font-px text-[6px] text-[#0a0a18]">
                  🔥 COMBO x{combo}
                </span>
              )}
              <span className="rounded border-2 border-white/15 bg-black/30 px-1.5 py-0.5 font-px text-[6px] text-white/60">
                🎯 {accuracy}%
              </span>
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="font-px text-[8px]" style={{ color: chapter.boss.color }}>
                {chapter.boss.sprite} {chapter.boss.name}
              </span>
              <span className="font-px text-[8px] tnum" style={{ color: chapter.boss.color }}>
                {bossHP}/{BOSS_MAX_HP}
              </span>
            </div>
            <div className="bar-track h-5">
              <div
                className="bar-fill"
                style={{
                  width: `${(bossHP / BOSS_MAX_HP) * 100}%`,
                  background: `linear-gradient(90deg,${chapter.boss.color},#f472b6)`,
                }}
              />
            </div>
            <div className="mt-2 flex gap-1.5">
              {[1, 2, 3].map((d) => (
                <span
                  key={d}
                  className={cn(
                    "rounded border-2 border-[#0a0a18] px-1.5 py-0.5 font-px text-[6px]",
                    wave === d ? "bg-[#f472b6] text-white" : "bg-black/30 text-white/35",
                  )}
                >
                  {"★".repeat(d)} WAVE {d}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* SPRITES */}
        <div className="relative mt-4 flex items-end justify-between gap-4 overflow-hidden px-2 py-3">
          <div className="relative">
            <span
              className={cn(
                "block select-none text-[52px] sm:text-[64px]",
                bossMood === "hurt" ? "shake" : "bob",
              )}
              style={{ filter: `drop-shadow(0 8px 0 rgba(0,0,0,.5)) drop-shadow(0 0 18px ${chapter.boss.color})` }}
            >
              {bossMood === "attack" ? "💥" : chapter.boss.sprite}
            </span>
            {pops
              .filter((p) => p.side === "boss")
              .map((p) => (
                <span
                  key={p.id}
                  className="dmg-pop pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 whitespace-nowrap font-px text-[14px]"
                  style={{ color: p.color, textShadow: "0 3px 0 #000" }}
                >
                  {p.text}
                </span>
              ))}
          </div>

          <div className="relative flex-1">
            <div className="path-dash mb-2" />
            <p className="text-center font-px text-[7px] text-white/25">VS</p>
          </div>

          <div className="relative">
            <span
              className={cn(
                "block select-none text-[52px] sm:text-[64px]",
                bossMood === "attack" ? "shake" : "floaty",
              )}
              style={{ filter: "drop-shadow(0 8px 0 rgba(0,0,0,.5)) drop-shadow(0 0 18px #22d3ee)" }}
            >
              🧑‍🔬
            </span>
            {pops
              .filter((p) => p.side === "player")
              .map((p) => (
                <span
                  key={p.id}
                  className="dmg-pop pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 whitespace-nowrap font-px text-[14px]"
                  style={{ color: p.color, textShadow: "0 3px 0 #000" }}
                >
                  {p.text}
                </span>
              ))}
          </div>
        </div>

        {banner && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span
              className="banner-in rounded-xl border-[4px] border-[#0a0a18] bg-[#fbbf24] px-5 py-3 font-px text-[16px] text-[#0a0a18] sm:text-[24px]"
              style={{ boxShadow: "0 8px 0 rgba(0,0,0,.5)" }}
            >
              {banner}
            </span>
          </div>
        )}
      </div>

      {/* ===== QUESTION ===== */}
      <div className="card mt-4 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b-[3px] border-[#0a0a18] bg-black/30 px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-lg border-2 border-[#0a0a18] bg-[#f472b6] px-2 py-1 font-px text-[8px] text-[#0a0a18]">
              Q{qi + 1}/{exam.length}
            </span>
            <span
              className="rounded-lg border-2 border-[#0a0a18] px-2 py-1 font-px text-[7px] text-[#0a0a18]"
              style={{
                background: wave === 1 ? "#a3e635" : wave === 2 ? "#fbbf24" : "#f472b6",
              }}
            >
              {waveName}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-px text-[7px] text-white/40">TIME</span>
            <div className="bar-track h-3 w-28 sm:w-40">
              <div
                className="bar-fill"
                style={{
                  width: `${Math.max(0, Math.min(100, (timeLeft / TIME_LIMIT[wave]) * 100))}%`,
                  background: timeLeft < 8 ? "#f472b6" : "#22d3ee",
                }}
              />
            </div>
            <span className={cn("font-px text-[9px] tnum", timeLeft < 8 ? "text-[#f472b6]" : "text-white/70")}>
              {Math.ceil(timeLeft)}s
            </span>
          </div>
        </div>

        <div className="p-4 sm:p-5">
          <p key={qi} className="slide-up font-tech text-[16px] font-bold leading-relaxed text-white sm:text-[17px]">
            {q.q}
          </p>

          <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
            {q.choices.map((c, i) => {
              const isAns = i === q.correct;
              const isPicked = picked === i;
              const removed = cut.includes(i);
              return (
                <button
                  key={`${qi}-${i}`}
                  type="button"
                  disabled={locked || removed}
                  onClick={() => {
                    sfx.click();
                    resolve(i);
                  }}
                  className={cn(
                    "slide-up rounded-xl border-[3px] border-[#0a0a18] px-3.5 py-3 text-left font-tech text-[13.5px] leading-snug transition-all",
                    removed && "opacity-25 line-through",
                    locked && isAns && "bg-[#a3e635] text-[#0a0a18] shadow-[0_5px_0_#3f6212]",
                    locked && isPicked && !isAns && "bg-[#f472b6] text-white",
                    !locked && !removed && "bg-white/8 text-white hover:-translate-y-0.5 hover:bg-white/16",
                    locked && !isAns && !isPicked && "bg-white/5 text-white/35",
                  )}
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <span className="mr-2 font-px text-[9px] text-[#fbbf24]">
                    {String.fromCharCode(65 + i)}
                  </span>
                  {c}
                </button>
              );
            })}
          </div>

          {hintOn && (
            <div className="pop-in mt-4 rounded-xl border-[3px] border-[#0a0a18] bg-gradient-to-br from-[#78350f] to-[#92400e] p-3.5">
              <div className="font-px text-[7px] text-[#fde68a]">
                ⚡ {npc.avatar} {npc.name} ใบ้ให้
              </div>
              <p className="mt-2 font-tech text-[13.5px] font-bold leading-relaxed text-[#fff7d6]">{q.hint}</p>
            </div>
          )}

          {locked && (
            <div className="pop-in mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-white/12 bg-black/25 p-3">
              <p className="font-tech text-[13px]">
                {picked === q.correct ? (
                  <span className="font-bold text-[#a3e635]">
                    ✔ ถูกต้อง! โจมตี {Math.round(BASE_DMG[wave] * (1 + Math.min(combo - 1, 6) * 0.1))} ดาเมจ
                  </span>
                ) : (
                  <span className="text-white/80">
                    {picked === null ? "⏰ หมดเวลา! " : "✘ ผิด — "}
                    คำตอบที่ถูกคือ <b className="text-[#a3e635]">{q.choices[q.correct]}</b>
                  </span>
                )}
              </p>
              <button
                type="button"
                onClick={next}
                className="btn-arcade px-5 py-2.5 font-px text-[9px]"
                style={{ ["--c" as string]: "#fbbf24" }}
              >
                {qi + 1 >= exam.length ? "จบการต่อสู้ ▶" : "ข้อถัดไป ▶"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ===== ITEMS + LOG ===== */}
      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="card p-4">
          <div className="font-px text-[8px] text-[#a3e635]">🎒 INVENTORY</div>
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
            {(
              [
                { k: "hp", icon: "🧪", n: "POTION", d: "+40 HP", c: "#a3e635" },
                { k: "shield", icon: "🛡️", n: "SHIELD", d: "บล็อก 1 ครั้ง", c: "#22d3ee" },
                { k: "fifty", icon: "🎯", n: "50:50", d: "ตัด 2 ตัวเลือก", c: "#fbbf24" },
                { k: "table", icon: "📖", n: "ตารางธาตุ", d: "ดูคำใบ้", c: "#a78bfa" },
                { k: "time", icon: "⏱️", n: "TIME+", d: "+25 วินาที", c: "#f472b6" },
              ] as const
            ).map((it) => (
              <button
                key={it.k}
                type="button"
                disabled={inv[it.k] <= 0 || phase !== "fight"}
                onClick={() => useItem(it.k)}
                className={cn(
                  "rounded-xl border-[3px] border-[#0a0a18] p-2.5 text-center transition-all",
                  inv[it.k] > 0 ? "bg-white/8 hover:-translate-y-0.5 hover:bg-white/16" : "opacity-35",
                )}
              >
                <div className="text-2xl">{it.icon}</div>
                <div className="mt-1 font-px text-[6px]" style={{ color: it.c }}>
                  {it.n}
                </div>
                <div className="mt-1 font-px text-[10px] text-white">×{inv[it.k]}</div>
                <div className="mt-0.5 font-tech text-[9px] text-white/45">{it.d}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="card p-4">
          <div className="font-px text-[8px] text-white/55">📜 BATTLE LOG</div>
          <ul className="mt-3 space-y-2">
            {log.length === 0 && <li className="font-tech text-[11px] text-white/30">…</li>}
            {log.map((l, i) => (
              <li
                key={i}
                className={cn(
                  "rounded-lg border-l-[3px] pl-2 font-tech text-[11.5px] leading-snug",
                  i === 0 ? "border-[#fbbf24] text-white/85" : "border-white/15 text-white/40",
                )}
              >
                {l}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <SciCalc />
    </div>
  );
}
