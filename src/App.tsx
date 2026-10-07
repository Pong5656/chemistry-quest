import { useCallback, useEffect, useState } from "react";
import { chapters, getChapter } from "./data";
import { npcs } from "./data/npcs";
import type { Inventory, PlayResult, Zone } from "./types";
import { loadProgress, markProgress, emptyProgress, type ProgressMap } from "./lib/progress";
import {
  loadPlayer,
  addXP,
  levelProgress,
  BADGES,
  type Player,
} from "./lib/player";
import { isMuted, toggleMute, sfx } from "./lib/sfx";
import { Confetti, LevelUpToast, BadgeToast } from "./components/Confetti";
import { WorldMap } from "./components/WorldMap";
import { NpcLesson } from "./components/NpcLesson";
import { ConceptCheck } from "./components/ConceptCheck";
import { Platformer } from "./components/Platformer";
import { BossFight } from "./components/BossFight";
import { SciCalc } from "./components/SciCalc";
import { PeriodicTable } from "./components/PeriodicTable";
import { cn } from "./utils/cn";

const STEPS: { key: Zone; label: string; icon: string; color: string }[] = [
  { key: "learn", label: "เรียนกับ NPC", icon: "🧑‍🏫", color: "#fbbf24" },
  { key: "check", label: "พัซเซิล", icon: "🧩", color: "#22d3ee" },
  { key: "play", label: "มินิเกม", icon: "🕹️", color: "#a3e635" },
  { key: "boss", label: "บอสสอบ", icon: "⚔️", color: "#f472b6" },
];

const EMPTY_INV: Inventory = { hp: 0, shield: 0, fifty: 0, table: 0, time: 0 };

export default function App() {
  const [zone, setZone] = useState<Zone>("map");
  const [chapterId, setChapterId] = useState(1);
  const [progress, setProgress] = useState<ProgressMap>({});
  const [inventory, setInventory] = useState<Inventory>(EMPTY_INV);
  const [playResult, setPlayResult] = useState<PlayResult | null>(null);
  const [unlockAll, setUnlockAll] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const [muted, setMuted] = useState(isMuted());
  const [runKey, setRunKey] = useState(0);
  const [player, setPlayer] = useState<Player>(() => loadPlayer());
  const [toast, setToast] = useState<
    | { kind: "level"; level: number; title: string }
    | { kind: "badge"; icon: string; name: string; desc: string }
    | null
  >(null);
  const [confetti, setConfetti] = useState(0);

  useEffect(() => setProgress(loadProgress()), []);

  const lv = levelProgress(player.xp);

  /** เก็บ XP + ผลสถิติ + แจ้งเลเวลอัพ/เหรียญตรา */
  const gain = useCallback(
    (xp: number, stat?: Parameters<typeof addXP>[2]) => {
      const res = addXP(player, xp, stat);
      setPlayer(res.player);
      if (res.leveledUp) {
        setToast({ kind: "level", level: res.newLevel, title: levelProgress(res.player.xp).title });
        setConfetti((c) => c + 1);
        sfx.fanfare();
        setTimeout(() => setToast(null), 1900);
      } else if (res.newBadges.length) {
        const b = res.newBadges[0];
        setToast({ kind: "badge", icon: b.icon, name: b.name, desc: b.desc });
        setConfetti((c) => c + 1);
        sfx.unlock();
        setTimeout(() => setToast(null), 1900);
      }
      return res;
    },
    [player],
  );

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [zone, chapterId]);

  const chapter = getChapter(chapterId);
  const npc = npcs[chapterId];

  const enter = (id: number) => {
    setChapterId(id);
    setInventory(EMPTY_INV);
    setPlayResult(null);
    setRunKey((k) => k + 1);
    setZone("learn");
  };

  const patch = useCallback(
    (p: Parameters<typeof markProgress>[2]) => {
      setProgress((prev) => markProgress(prev, chapterId, p));
    },
    [chapterId],
  );

  const finishBoss = useCallback(
    (win: boolean, score: number, total: number) => {
      const prev = progress[chapterId] ?? emptyProgress();
      const firstWin = win && !prev.boss;
      patch({ boss: win || prev.boss, bestScore: Math.max(prev.bestScore, score), total });
      gain(
        (win ? 150 : 40) + score * 20 + (firstWin ? 100 : 0),
        {
          bossCorrect: score,
          bosses: win ? 1 : 0,
          perfectRuns: win && score === total ? 1 : 0,
        },
      );
      if (win) {
        setConfetti((c) => c + 1);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chapterId, progress, patch, player],
  );

  const onPlayDone = (r: PlayResult) => {
    gain(r.atoms * 5 + r.hearts * 10, { atoms: r.atoms });
    // แปลงอะตอมที่เก็บได้เป็นไอเทมเสริม
    const bonusPotion = Math.floor(r.atoms / 5);
    const merged: Inventory = {
      hp: inventory.hp + bonusPotion,
      shield: inventory.shield + (r.hearts >= 2 ? 1 : 0),
      fifty: inventory.fifty + (r.bonus ? 1 : 0),
      table: inventory.table,
      time: inventory.time + r.hearts,
    };
    setInventory(merged);
    setPlayResult(r);
    patch({ play: true, bestAtoms: Math.max(progress[chapterId]?.bestAtoms ?? 0, r.atoms) });
    setZone("boss");
  };

  return (
    <div className="bg-arcade min-h-screen">
      {/* ================= HEADER ================= */}
      <header className="sticky top-0 z-40 border-b-[3px] border-[#0a0a18] bg-[#0b0a22]/92 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2.5 px-3 py-2.5 sm:px-4">
          <button
            type="button"
            onClick={() => {
              sfx.back();
              setZone("map");
            }}
            className="flex items-center gap-2"
          >
            <span className="text-xl">⚗️</span>
            <span className="font-px text-[10px] sm:text-[12px]">
              <span className="text-[#fbbf24]">CHEM</span>
              <span className="text-[#22d3ee]">QUEST</span>
            </span>
          </button>

          {/* STEPPER */}
          {zone !== "map" && (
            <div className="order-3 flex w-full items-center gap-1 overflow-x-auto no-scrollbar sm:order-none sm:w-auto">
              {STEPS.map((s) => {
                const active = zone === s.key;
                const done =
                  (s.key === "learn" && progress[chapterId]?.terminal) ||
                  (s.key === "check" && progress[chapterId]?.check) ||
                  (s.key === "play" && progress[chapterId]?.play) ||
                  (s.key === "boss" && progress[chapterId]?.boss);
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => {
                      if (s.key === "play" && !inventory.hp && !inventory.shield && !inventory.fifty) {
                        setInventory({ hp: 1, shield: 1, fifty: 1, table: 1, time: 1 });
                      }
                      setZone(s.key);
                    }}
                    className={cn(
                      "flex shrink-0 items-center gap-1.5 rounded-lg border-2 border-[#0a0a18] px-2 py-1.5 font-px text-[6px] transition-all sm:text-[7px]",
                      active
                        ? "text-[#0a0a18]"
                        : done
                          ? "bg-[#14532d] text-[#a3e635]"
                          : "bg-white/6 text-white/35 hover:bg-white/12",
                    )}
                    style={active ? { background: s.color, boxShadow: "0 3px 0 rgba(0,0,0,.5)" } : undefined}
                  >
                    <span>{done && !active ? "✔" : s.icon}</span>
                    <span className="hidden sm:inline">{s.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                sfx.click();
                setShowTable(true);
              }}
              className="btn-ghost px-2.5 py-2 font-px text-[7px]"
              title="ตารางธาตุ"
            >
              📖
            </button>
            <button
              type="button"
              onClick={() => setMuted(toggleMute())}
              className="btn-ghost px-2.5 py-2 font-px text-[7px]"
              title={muted ? "เปิดเสียง" : "ปิดเสียง"}
            >
              {muted ? "🔇" : "🔊"}
            </button>
            {zone === "map" ? (
              <button
                type="button"
                onClick={() => {
                  sfx.click();
                  enter(1);
                }}
                className="btn-arcade px-3 py-2 font-px text-[8px]"
                style={{ ["--c" as string]: "#a3e635" }}
              >
                ▶ PLAY
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  sfx.back();
                  setZone("map");
                }}
                className="btn-arcade px-3 py-2 font-px text-[8px]"
                style={{ ["--c" as string]: "#94a3b8" }}
              >
                MAP
              </button>
            )}
          </div>
        </div>

        {/* แถบ XP ผู้เล่น */}
        <div className="border-t-2 border-black/40 bg-black/35 px-3 py-1.5 sm:px-4">
          <div className="mx-auto flex max-w-6xl items-center gap-3">
            <span className="shrink-0 rounded-md border-2 border-[#0a0a18] bg-[#fbbf24] px-1.5 py-0.5 font-px text-[7px] text-[#0a0a18]">
              LV.{lv.level}
            </span>
            <div className="bar-track h-3 min-w-0 flex-1">
              <div
                className="bar-fill bar-stripes"
                style={{ width: `${lv.pct}%`, background: "linear-gradient(90deg,#fbbf24,#f472b6)" }}
              />
            </div>
            <span className="hidden shrink-0 font-tech text-[10px] text-white/55 sm:block">{lv.title}</span>
            <span className="shrink-0 font-px text-[7px] text-white/40 tnum">
              {lv.cur}/{lv.need} XP
            </span>
            <span className="flex shrink-0 items-center gap-1">
              {BADGES.filter((b) => player.badges.includes(b.id))
                .slice(-5)
                .map((b) => (
                  <span key={b.id} title={`${b.name} — ${b.desc}`} className="text-sm">
                    {b.icon}
                  </span>
                ))}
              <span className="font-px text-[7px] text-white/35">
                {player.badges.length}/{BADGES.length}
              </span>
            </span>
          </div>
        </div>

        {/* แถบข้อมูลบท */}
        {zone !== "map" && (
          <div
            className="border-t-2 border-black/30 px-3 py-1.5 sm:px-4"
            style={{ background: `linear-gradient(90deg, ${chapter.hue}25, transparent)` }}
          >
            <div className="mx-auto flex max-w-6xl items-center gap-2 overflow-hidden">
              <span className="shrink-0 font-px text-[7px]" style={{ color: chapter.hue }}>
                {chapter.code}
              </span>
              <span className="truncate font-tech text-[11px] font-bold text-white/80">{chapter.title}</span>
              <span className="ml-auto hidden shrink-0 font-tech text-[10px] text-white/40 sm:block">
                {npc.avatar} {npc.name}
              </span>
            </div>
          </div>
        )}
      </header>

      {/* ================= MAIN ================= */}
      <main className="relative z-[1]">
        {zone === "map" && (
          <WorldMap
            progress={progress}
            unlockAll={unlockAll}
            onToggleUnlockAll={() => setUnlockAll((v) => !v)}
            onEnter={enter}
            level={lv.level}
            title={lv.title}
            badges={player.badges}
          />
        )}

        {zone === "learn" && (
          <NpcLesson
            chapter={chapter}
            onProgress={(beats, checksCorrect) => {
              gain(beats * 3 + checksCorrect * 15, {
                beats,
                checksCorrect,
                lessons: progress[chapterId]?.terminal ? 0 : 1,
              });
            }}
            onDone={() => {
              patch({ briefing: true, terminal: true });
              setZone("check");
            }}
            onExit={() => setZone("map")}
          />
        )}

        {zone === "check" && (
          <ConceptCheck
            key={`chk-${chapterId}-${runKey}`}
            chapter={chapter}
            onDone={(inv) => {
              setInventory(inv);
              gain(80);
              setConfetti((c) => c + 1);
              patch({ check: true });
              setZone("play");
            }}
            onExit={() => setZone("map")}
          />
        )}

        {zone === "play" && (
          <Platformer
            key={`ply-${chapterId}-${runKey}`}
            chapter={chapter}
            onDone={onPlayDone}
            onExit={() => setZone("map")}
          />
        )}

        {zone === "boss" && (
          <BossFight
            key={`boss-${chapterId}-${runKey}`}
            chapter={chapter}
            inventory={inventory}
            onFinish={finishBoss}
            onExit={() => setZone("map")}
            onRetry={() => {
              setInventory((v) => ({
                hp: Math.max(v.hp, 1) + (playResult ? Math.floor(playResult.atoms / 5) : 0),
                shield: Math.max(v.shield, 1),
                fifty: Math.max(v.fifty, 1),
                table: Math.max(v.table, 1),
                time: Math.max(v.time, 1),
              }));
              setRunKey((k) => k + 1);
            }}
            onNext={() => {
              const nextCh = chapters.find((c) => c.id === chapterId + 1);
              if (nextCh) enter(nextCh.id);
              else setZone("map");
            }}
            hasNext={chapterId < chapters.length}
          />
        )}
      </main>

      {/* ================= FOOTER ================= */}
      {zone !== "map" && (
        <div className="relative z-[1] mx-auto max-w-6xl px-4 pb-10 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-white/10 pt-4">
            <div className="flex flex-wrap gap-1.5">
              {chapters.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => enter(c.id)}
                  title={c.title}
                  className={cn(
                    "h-8 w-8 rounded-lg border-2 border-[#0a0a18] font-px text-[8px] transition-all hover:-translate-y-0.5",
                    c.id === chapterId ? "text-[#0a0a18]" : "bg-white/8 text-white/45",
                  )}
                  style={c.id === chapterId ? { background: c.hue, boxShadow: "0 3px 0 rgba(0,0,0,.5)" } : undefined}
                >
                  {c.id}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {chapterId > 1 && (
                <button
                  type="button"
                  onClick={() => enter(chapterId - 1)}
                  className="btn-ghost px-3 py-2 font-px text-[8px]"
                >
                  ◀ ด่านก่อน
                </button>
              )}
              {chapterId < chapters.length && (
                <button
                  type="button"
                  onClick={() => enter(chapterId + 1)}
                  className="btn-ghost px-3 py-2 font-px text-[8px]"
                >
                  ด่านถัดไป ▶
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {zone !== "boss" && <SciCalc />}
      {showTable && <PeriodicTable onClose={() => setShowTable(false)} />}

      {confetti > 0 && <Confetti key={confetti} />}
      {toast?.kind === "level" && <LevelUpToast level={toast.level} title={toast.title} />}
      {toast?.kind === "badge" && (
        <BadgeToast icon={toast.icon} name={toast.name} desc={toast.desc} />
      )}
    </div>
  );
}
