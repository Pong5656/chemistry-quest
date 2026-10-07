import { useEffect, useMemo, useRef, useState } from "react";
import type { Chapter } from "../types";
import { npcs } from "../data/npcs";
import { buildBeats, ENCOURAGE, KIND_LABEL, PRAISE, speak, stopSpeaking } from "../lib/tutor";
import { sfx } from "../lib/sfx";
import { cn } from "../utils/cn";

type Speed = 0 | 1 | 2;
const SPEED_MS = [0, 2600, 1500];

export function NpcLesson({
  chapter,
  onProgress,
  onExit,
  onDone,
}: {
  chapter: Chapter;
  onProgress: (beats: number, checksCorrect: number) => void;
  onExit: () => void;
  onDone: () => void;
}) {
  const npc = npcs[chapter.id];
  const beats = useMemo(() => buildBeats(chapter), [chapter]);
  const [i, setI] = useState(0);
  const [showStep, setShowStep] = useState(0);
  const [praise, setPraise] = useState<string | null>(null);
  const [auto, setAuto] = useState(false);
  const [speed, setSpeed] = useState<Speed>(1);
  const [voice, setVoice] = useState(false);
  const [checksCorrect, setChecksCorrect] = useState(0);
  const [checkPick, setCheckPick] = useState<number | null>(null);
  const [understood, setUnderstood] = useState(0);
  const [replay, setReplay] = useState(0);
  const feedRef = useRef<HTMLDivElement>(null);

  const beat = beats[i];
  const isLast = i === beats.length - 1;
  const meta = KIND_LABEL[beat.kind];
  const typed = showStep > 0;

  useEffect(() => {
    setI(0);
    setShowStep(0);
    setChecksCorrect(0);
    setUnderstood(0);
    setCheckPick(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapter.id]);

  // แสดงเนื้อหาทีละส่วน
  useEffect(() => {
    setShowStep(0);
    const t = setTimeout(() => setShowStep(1), 120);
    return () => clearTimeout(t);
  }, [i, replay]);

  // เลื่อนไปยังข้อความล่าสุด
  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" });
  }, [i, showStep]);

  // อ่านออกเสียง
  useEffect(() => {
    if (!voice || !typed) return;
    const txt =
      beat.kind === "check"
        ? `คำถามเช็คความเข้าใจ ${beat.question?.q ?? ""}`
        : beat.kind === "formula"
          ? `${beat.text ?? ""} ${beat.formula ?? ""}`
          : beat.kind === "example" || beat.kind === "recap"
            ? `${beat.title ?? ""} ${beat.steps?.join(" ") ?? ""}`
            : beat.text ?? "";
    speak(txt, voice);
    return () => stopSpeaking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, typed, voice, replay]);

  const beatTextLen = (beat.text?.length ?? 0) + (beat.tip?.length ?? 0) + (beat.formula?.length ?? 0);
  const autoDelay = SPEED_MS[speed] + Math.min(3500, beatTextLen * 12);

  // โหมดเล่าอัตโนมัติ (เผยตัวอย่างทีละขั้นก่อนไปต่อ)
  useEffect(() => {
    if (!auto || !typed || beat.kind === "check") return;
    const t = setTimeout(() => {
      const more = (beat.steps?.length ?? 0) >= showStep && (beat.kind === "example" || beat.kind === "recap");
      if (more) {
        setShowStep((v) => v + 1);
        sfx.hover();
      } else {
        advance();
      }
    }, autoDelay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, typed, i, speed, autoDelay, showStep]);

  const advance = () => {
    if (beat.kind === "check" && checkPick === null) return; // ต้องตอบก่อน
    if (isLast) {
      stopSpeaking();
      onProgress(i + 1, checksCorrect);
      onDone();
      return;
    }
    sfx.click();
    setUnderstood((u) => Math.min(100, u + Math.round(100 / beats.length) + 1));
    setI((x) => x + 1);
    if (Math.random() < 0.45) setPraise(PRAISE[Math.floor(Math.random() * PRAISE.length)]);
    else setPraise(null);
  };

  const answerCheck = (n: number) => {
    if (checkPick !== null || !beat.question) return;
    setCheckPick(n);
    if (n === beat.question.answer) {
      sfx.correct();
      setChecksCorrect((c) => c + 1);
    } else {
      sfx.wrong();
    }
  };

  const answered = beat.kind === "check" && checkPick !== null;
  const canNext = beat.kind !== "check" || answered;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-14 pt-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className="rounded-xl border-[3px] border-[#0a0a18] px-2.5 py-1.5 font-px text-[8px] text-[#0a0a18]"
            style={{ background: chapter.hue }}
          >
            {chapter.code}
          </span>
          <h2 className="font-tech text-base font-bold text-white sm:text-lg">{chapter.title}</h2>
        </div>
        <button type="button" onClick={() => { stopSpeaking(); sfx.back(); onExit(); }} className="btn-ghost px-3 py-2 font-px text-[8px]">
          ◀ แผนที่
        </button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[290px_1fr]">
        {/* ================= NPC / ควบคุมการเรียน ================= */}
        <div className="lg:sticky lg:top-28 lg:self-start">
          <div className="card overflow-hidden">
            <div className="relative px-4 py-5 text-center" style={{ background: `linear-gradient(160deg, ${npc.color}, ${npc.color}44)` }}>
              <div className="relative">
                <div
                  className="bob mx-auto flex h-20 w-20 items-center justify-center rounded-3xl border-[3px] border-[#0a0a18] text-4xl shadow-[0_8px_0_rgba(0,0,0,.35)]"
                  style={{ background: "linear-gradient(180deg,#ffffffcc,#ffffff66)" }}
                >
                  {npc.avatar}
                </div>
                <h3 className="mt-3 font-px text-[9px] text-[#0a0a18]">{npc.name}</h3>
                <p className="mt-1.5 font-tech text-[11px] font-bold text-[#0a0a18]/80">{npc.title}</p>
              </div>
            </div>

            <div className="p-4">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="font-px text-[7px] text-white/45">ความเข้าใจ</span>
                <span className="font-px text-[8px] text-[#a3e635]">{understood}%</span>
              </div>
              <div className="bar-track h-3">
                <div className="bar-fill bar-stripes" style={{ width: `${understood}%`, background: "#a3e635" }} />
              </div>

              <div className="mt-3 flex items-center justify-between">
                <span className="font-px text-[7px] text-white/45">ความคืบหน้า</span>
                <span className="font-px text-[8px] text-white/70 tnum">
                  {i + 1}/{beats.length}
                </span>
              </div>
              <div className="bar-track mt-1.5 h-3">
                <div className="bar-fill" style={{ width: `${((i + 1) / beats.length) * 100}%`, background: chapter.hue }} />
              </div>

              {/* ปุ่มควบคุมการเรียน */}
              <div className="mt-4 space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    sfx.click();
                    setAuto((a) => !a);
                  }}
                  className={cn("w-full rounded-xl border-[3px] border-[#0a0a18] py-2.5 font-px text-[8px] transition-all", auto ? "bg-[#a3e635] text-[#0a0a18]" : "bg-white/8 text-white hover:bg-white/16")}
                >
                  {auto ? "⏸ หยุดเล่าอัตโนมัติ" : "▶ ให้ครูเล่าให้ฟัง"}
                </button>
                {auto && (
                  <div className="flex gap-1.5">
                    {(["ช้า", "ปกติ", "เร็ว"] as const).map((l, k) => (
                      <button
                        key={l}
                        type="button"
                        onClick={() => setSpeed(k as Speed)}
                        className={cn(
                          "flex-1 rounded-lg border-2 border-[#0a0a18] py-1.5 font-tech text-[11px]",
                          speed === k ? "bg-[#fbbf24] text-[#0a0a18]" : "bg-white/8 text-white/60",
                        )}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setVoice((v) => !v);
                    if (voice) stopSpeaking();
                    else sfx.click();
                  }}
                  className={cn("w-full rounded-xl border-[3px] border-[#0a0a18] py-2.5 font-px text-[8px] transition-all", voice ? "bg-[#22d3ee] text-[#0a0a18]" : "bg-white/8 text-white hover:bg-white/16")}
                >
                  {voice ? "🔊 เปิดเสียงอ่านแล้ว" : "🔇 กดเพื่อให้ครูอ่านให้ฟัง"}
                </button>
              </div>

              <div className="mt-4 rounded-xl border-2 border-white/10 bg-white/5 p-3">
                <div className="font-px text-[6px] text-white/40">เคล็ดลำที่ต้องจำ</div>
                <ul className="mt-2 space-y-1.5">
                  {npc.focus.map((f) => (
                    <li key={f} className="font-tech text-[11px] leading-snug text-white/70">
                      <span className="mr-1" style={{ color: npc.color }}>✦</span>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>

              <button
                type="button"
                onClick={() => {
                  stopSpeaking();
                  sfx.waveStart();
                  onProgress(i + 1, checksCorrect);
                  onDone();
                }}
                className="btn-arcade mt-4 w-full py-2.5 font-px text-[8px]"
                style={{ ["--c" as string]: "#fbbf24" }}
              >
                ข้ามไปทำพัซเซิล ▶▶
              </button>
            </div>
          </div>
        </div>

        {/* ================= บทเรียนแบบจับมือ ================= */}
        <div className="card flex flex-col overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b-[3px] border-[#0a0a18] bg-black/25 px-4 py-2.5">
            <span className="flex items-center gap-2 rounded-lg border-2 border-[#0a0a18] px-2 py-1 font-px text-[7px] text-[#0a0a18]" style={{ background: meta.color }}>
              {meta.icon} {meta.label}
            </span>
            <span className="font-tech text-[11px] text-white/45">
              สไลด์ {beat.slide + 1}/{chapter.terminal.length} · ตอบเช็คถูก {checksCorrect} ข้อ
            </span>
          </div>

          <div ref={feedRef} className="max-h-[62vh] min-h-[340px] space-y-4 overflow-y-auto p-4 sm:p-5">
            {/* หัวข้อสไลด์ */}
            {(beat.kind === "talk" || beat.kind === "recap") && beat.title && (
              <h3 key={`t-${i}`} className="slide-left font-px text-[12px] leading-relaxed sm:text-[14px]" style={{ color: chapter.hue }}>
                {beat.kind === "recap" ? "🏁 " : "📌 "}
                {beat.title}
              </h3>
            )}

            {/* กล่องบทสนทนาครู */}
            <div className="flex items-start gap-3">
              <div
                className="bob flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-[3px] border-[#0a0a18] text-2xl"
                style={{ background: `linear-gradient(180deg, ${npc.color}, ${npc.color}77)` }}
              >
                {npc.avatar}
              </div>
              <div className="bubble min-w-0 flex-1 p-3.5">
                {!typed ? (
                  <span className="dot-typing text-[#4b4b74]">
                    <i />
                    <i />
                    <i />
                  </span>
                ) : (
                  <p className="font-tech text-[13.5px] leading-relaxed text-[#20204a]">{beat.text}</p>
                )}
              </div>
            </div>

            {/* เนื้อหาหลัก */}
            {typed && (
              <>
                {beat.kind === "concept" && (
                  <div className="pop-in ml-3 rounded-2xl border-[3px] border-[#0a0a18] border-l-[8px] bg-white/8 p-4" style={{ borderLeftColor: meta.color }}>
                    <p className="font-tech text-[15px] leading-relaxed text-white sm:text-[16px]">{beat.text}</p>
                  </div>
                )}

                {beat.kind === "example" && (
                  <div className="pop-in ml-3 overflow-hidden rounded-2xl border-[3px] border-[#0a0a18] bg-[#0b2e1f]/70">
                    <div className="flex items-center gap-2 bg-[#166534] px-3 py-2">
                      <span className="font-px text-[7px] text-white">🧮 แก้โจทย์ทีละขั้น (กดดูทีละบรรทัด)</span>
                    </div>
                    <ol className="space-y-2 p-3">
                      {beat.steps?.map((s, k) => (
                        <li key={k}>
                          {k < showStep - 1 ? (
                            <div className="pop-in flex gap-2.5 rounded-xl border-2 border-[#a3e635]/40 bg-black/25 p-2.5">
                              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 border-[#0a0a18] bg-[#a3e635] font-px text-[8px] text-[#0a0a18]">
                                {k + 1}
                              </span>
                              <span className="font-tech text-[13.5px] leading-relaxed text-white/90">{s}</span>
                            </div>
                          ) : k === showStep - 1 ? (
                            <button
                              type="button"
                              onClick={() => {
                                sfx.hover();
                                setShowStep((v) => v + 1);
                              }}
                              className="flex w-full gap-2.5 rounded-xl border-2 border-dashed border-[#a3e635]/60 bg-black/20 p-2.5 text-left transition-all hover:bg-black/40"
                            >
                              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 border-[#0a0a18] bg-[#fbbf24] font-px text-[8px] text-[#0a0a18]">
                                {k + 1}
                              </span>
                              <span className="font-tech text-[13.5px] leading-relaxed text-white/60">
                                ▸ กดเพื่อดูขั้นที่ {k + 1}
                              </span>
                            </button>
                          ) : null}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {beat.kind === "formula" && (
                  <div className="pop-in ml-3 overflow-hidden rounded-2xl border-[3px] border-[#0a0a18] bg-gradient-to-br from-[#9d174d] to-[#831843] p-4">
                    <div className="font-px text-[7px] text-[#fbcfe8]">⚛️ สูตรที่ต้องจำ</div>
                    <div className="mt-2.5 font-tech text-[19px] font-bold leading-relaxed text-[#fde68a] sm:text-[22px]">
                      {beat.formula}
                    </div>
                  </div>
                )}

                {beat.kind === "table" && beat.table && (
                  <div className="pop-in ml-3 overflow-x-auto rounded-2xl border-[3px] border-[#0a0a18]">
                    <table className="w-full border-collapse text-left">
                      <thead>
                        <tr style={{ background: `linear-gradient(180deg, ${chapter.hue}, ${chapter.hue}aa)` }}>
                          {beat.table.head.map((h) => (
                            <th key={h} className="border-b-[3px] border-[#0a0a18] px-3 py-2.5 font-px text-[7px] text-[#0a0a18]">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {beat.table.rows.map((r, ri) => (
                          <tr key={ri} className={ri % 2 ? "bg-white/[.04]" : "bg-white/[.09]"}>
                            {r.map((cell, ci) => (
                              <td key={ci} className="border-b border-white/8 px-3 py-2.5 font-tech text-[13px] text-white/90">
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {beat.kind === "tip" && (
                  <div className="pop-in ml-3 overflow-hidden rounded-2xl border-[3px] border-[#0a0a18] bg-gradient-to-br from-[#78350f] to-[#92400e] p-4">
                    <div className="font-px text-[7px] text-[#fde68a]">⚡ ทริคลัดจากครู</div>
                    <p className="mt-2.5 font-tech text-[15px] font-bold leading-relaxed text-[#fff7d6]">{beat.tip}</p>
                  </div>
                )}

                {beat.kind === "recap" && (
                  <ol className="pop-in ml-3 space-y-2">
                    {beat.steps?.map((s, k) => (
                      <li key={k} className="flex gap-2.5 rounded-xl border-2 border-white/10 bg-white/5 p-3">
                        <span className="font-px text-[8px] text-[#a3e635]">{String(k + 1).padStart(2, "0")}</span>
                        <span className="font-tech text-[13.5px] leading-relaxed text-white/85">{s}</span>
                      </li>
                    ))}
                  </ol>
                )}

                {/* เช็คความเข้าใจ */}
                {beat.kind === "check" && beat.question && (
                  <div className="pop-in ml-3 overflow-hidden rounded-2xl border-[3px] border-[#0a0a18]">
                    <div className="flex items-center gap-2 bg-[#ea580c] px-3 py-2">
                      <span className="font-px text-[7px] text-white">🎯 ครูขอเช็คความเข้าใจหน่อยนะ</span>
                    </div>
                    <div className="p-3.5">
                      <p className="font-tech text-[14.5px] font-bold leading-relaxed text-white">{beat.question.q}</p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {beat.question.choices.map((c, n) => {
                          const isAns = n === beat.question!.answer;
                          return (
                            <button
                              key={c}
                              type="button"
                              disabled={answered}
                              onClick={() => answerCheck(n)}
                              className={cn(
                                "rounded-xl border-[3px] border-[#0a0a18] px-3 py-2.5 text-left font-tech text-[13px] transition-all",
                                answered && isAns
                                  ? "bg-[#a3e635] text-[#0a0a18]"
                                  : answered && checkPick === n
                                    ? "bg-[#f472b6] text-white"
                                    : "bg-white/8 text-white hover:bg-white/16",
                              )}
                            >
                              <span className="mr-2 font-px text-[8px] text-[#fbbf24]">{String.fromCharCode(65 + n)}</span>
                              {c}
                            </button>
                          );
                        })}
                      </div>
                      {answered && (
                        <div
                          className={cn(
                            "pop-in mt-3 rounded-xl border-2 p-3",
                            checkPick === beat.question.answer
                              ? "border-[#a3e635]/50 bg-[#a3e635]/12"
                              : "border-[#f472b6]/50 bg-[#f472b6]/12",
                          )}
                        >
                          <p className="font-tech text-[13px] leading-relaxed text-white/90">
                            {checkPick === beat.question.answer ? (
                              <><b className="text-[#a3e635]">ถูกต้อง! 🎉</b> {PRAISE[0]}</>
                            ) : (
                              <>
                                <b className="text-[#f472b6]">
                                  {ENCOURAGE[Math.floor(Math.random() * ENCOURAGE.length)]}
                                </b>
                                <br />
                                คำตอบที่ถูกคือ <b className="text-[#a3e635]">{beat.question.choices[beat.question.answer]}</b>
                              </>
                            )}
                          </p>
                          <p className="mt-2 font-tech text-[12px] leading-relaxed text-white/60">💡 {beat.question.hint}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* ปุ่มควบคุมล่าง */}
          <div className="border-t-[3px] border-[#0a0a18] bg-black/25 p-3.5">
            {praise && typed && (
              <p className="pop-in mb-2.5 text-center font-tech text-[12px] font-bold text-[#a3e635]">
                {npc.avatar} “{praise}”
              </p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    sfx.hover();
                    setReplay((r) => r + 1);
                  }}
                  className="btn-ghost px-3 py-2.5 font-px text-[8px]"
                  title="อธิบายอีกครั้ง"
                >
                  🔁 อธิบายอีกครั้ง
                </button>
                <button
                  type="button"
                  onClick={() => {
                    sfx.click();
                    if (i > 0) setI((x) => x - 1);
                  }}
                  disabled={i === 0}
                  className="btn-ghost px-3 py-2.5 font-px text-[8px] disabled:opacity-30"
                >
                  ◀ ย้อน
                </button>
              </div>

              {canNext ? (
                <button
                  type="button"
                  onClick={advance}
                  className="btn-arcade px-5 py-3 font-px text-[9px]"
                  style={{ ["--c" as string]: beat.kind === "check" ? "#a3e635" : chapter.hue }}
                >
                  {beat.kind === "check"
                    ? checkPick === beat.question?.answer
                      ? "เข้าใจแล้ว ไปต่อ ▶"
                      : "จำข้อนี้ไว้ ไปต่อ ▶"
                    : isLast
                      ? "เรียนจบแล้ว ไปทำพัซเซิล ▶"
                      : "เข้าใจแล้ว ไปต่อ ▶"}
                </button>
              ) : (
                <span className="rounded-xl border-2 border-dashed border-[#fbbf24]/50 px-4 py-3 font-tech text-[12px] text-[#fbbf24]">
                  ตอบคำถามก่อนนะ แล้วค่อยไปต่อ 👆
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
