import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BossQuestion, Chapter, PlayResult } from "../types";
import { sfx } from "../lib/sfx";
import { cn } from "../utils/cn";

const VW = 960;
const VH = 420;
const GROUND_Y = 340;
const WORLD_W = 3200;
const GRAV = 0.62;
const MAXSPD = 4.7;
const ACC = 0.95;
const FRICTION = 0.82;
const JUMP = -12.4;

type Rect = { x: number; y: number; w: number; h: number };

interface Solid extends Rect { kind: "ground" | "platform" | "block"; used?: boolean }
interface Hazard extends Rect {}
interface Atom { x: number; y: number; taken: boolean; ph: number }
interface Enemy { x: number; y: number; w: number; h: number; x1: number; x2: number; dir: number; dead: boolean }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; c: string }

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildLevel(chapterId: number) {
  const rnd = mulberry32(chapterId * 77713 + 1234);
  const solids: Solid[] = [];
  const hazards: Hazard[] = [];
  const atoms: Atom[] = [];
  const enemies: Enemy[] = [];
  const checkpoints: number[] = [];

  // ---- พื้นดินเป็นช่วง ๆ มีหลุมกรด ----
  let x = 0;
  while (x < WORLD_W - 420) {
    const w = 300 + rnd() * 320;
    solids.push({ x, y: GROUND_Y, w, h: VH - GROUND_Y + 20, kind: "ground" });
    checkpoints.push(x);
    const gap = x < 500 ? 0 : 90 + rnd() * 90;
    if (gap > 0) hazards.push({ x: x + w - 6, y: GROUND_Y + 16, w: gap + 12, h: VH - GROUND_Y });
    x += w + gap;
  }
  const lastW = WORLD_W - x + 40;
  solids.push({ x, y: GROUND_Y, w: lastW, h: VH - GROUND_Y + 20, kind: "ground" });
  checkpoints.push(x);

  // ---- แพลตฟอร์มลอย ----
  for (let px = 420; px < WORLD_W - 260; px += 300 + rnd() * 260) {
    const w = 110 + rnd() * 120;
    const y = 190 + rnd() * 70;
    solids.push({ x: px, y, w, h: 22, kind: "platform" });
    // อะตอมบนแพลตฟอร์ม
    atoms.push({ x: px + w / 2, y: y - 40, taken: false, ph: rnd() * 6 });
    if (rnd() < 0.55) atoms.push({ x: px + w / 2 + 42, y: y - 78, taken: false, ph: rnd() * 6 });
  }

  // ---- อะตอมบนพื้น ----
  for (const s of solids) {
    if (s.kind !== "ground") continue;
    const n = Math.max(1, Math.floor(s.w / 230));
    for (let k = 0; k < n; k++) {
      atoms.push({ x: s.x + 90 + k * 200, y: GROUND_Y - 52, taken: false, ph: rnd() * 6 });
    }
  }

  // ---- บล็อกคำถาม 3 ก้อน ----
  const blocks: Solid[] = [760, 1780, 2680].map((bx) => {
    const b: Solid = { x: bx, y: 196, w: 46, h: 46, kind: "block" };
    return b;
  });
  solids.push(...blocks);

  // ---- ศัตรูตะกอน ----
  const groundSegs = solids.filter((s) => s.kind === "ground");
  for (let k = 0; k < 3; k++) {
    const seg = groundSegs[Math.min(groundSegs.length - 1, 1 + k * 2)];
    const ex = seg.x + 80 + rnd() * Math.max(40, seg.w - 220);
    enemies.push({
      x: ex,
      y: GROUND_Y - 34,
      w: 38,
      h: 34,
      x1: seg.x + 40,
      x2: seg.x + seg.w - 80,
      dir: rnd() < 0.5 ? 1 : -1,
      dead: false,
    });
  }

  return { solids, hazards, atoms, enemies, checkpoints, blocks };
}

interface Player {
  x: number; y: number; w: number; h: number;
  vx: number; vy: number;
  onGround: boolean; coyote: number; buffer: number; jumps: number;
  face: 1 | -1; invuln: number; squash: number; spin: number;
}

export function Platformer({
  chapter,
  onDone,
  onExit,
}: {
  chapter: Chapter;
  onDone: (r: PlayResult) => void;
  onExit: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const level = useMemo(() => buildLevel(chapter.id), [chapter.id]);
  const npcName = chapter.code;

  const [status, setStatus] = useState<"ready" | "playing" | "question" | "win" | "lose">("ready");
  const [hud, setHud] = useState({ atoms: 0, total: level.atoms.length, hearts: 3, progress: 0 });
  const [question, setQuestion] = useState<BossQuestion | null>(null);
  const [qFeedback, setQFeedback] = useState<number | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  const statusRef = useRef(status);
  statusRef.current = status;
  const keys = useRef({ left: false, right: false, jump: false });
  const stateRef = useRef({
    player: {
      x: 40, y: GROUND_Y - 60, w: 28, h: 36, vx: 0, vy: 0,
      onGround: false, coyote: 0, buffer: 0, jumps: 2,
      face: 1 as 1 | -1, invuln: 0, squash: 0, spin: 0,
    } as Player,
    cam: 0,
    hearts: 3,
    atoms: 0,
    checkpoint: 40,
    particles: [] as Particle[],
    qBlockIndex: 0,
    tick: 0,
    respawnFlash: 0,
    combo: 0,
    comboTimer: 0,
  });

  const pool = useMemo(() => chapter.questions.filter((q) => q.difficulty === 1), [chapter]);
  const qIdxRef = useRef(0);
  const qOrder = useMemo(() => {
    const arr = pool.map((_, i) => i);
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [pool]);

  /* ------------------------- INPUT ------------------------- */
  useEffect(() => {
    const map: Record<string, keyof typeof keys.current> = {
      ArrowLeft: "left", a: "left", A: "left",
      ArrowRight: "right", d: "right", D: "right",
      ArrowUp: "jump", w: "jump", W: "jump", " ": "jump",
    };
    const down = (e: KeyboardEvent) => {
      const k = map[e.key];
      if (k) {
        keys.current[k] = true;
        if (e.key === " " || e.key.startsWith("Arrow")) e.preventDefault();
      }
      if (e.key === "Enter" && statusRef.current === "ready") start();
    };
    const up = (e: KeyboardEvent) => {
      const k = map[e.key];
      if (k) keys.current[k] = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const touch = (k: keyof typeof keys.current, v: boolean) => () => {
    keys.current[k] = v;
  };

  /* ------------------------- START / RESET ------------------------- */
  const resetPlayer = (atCheckpoint: boolean) => {
    const s = stateRef.current;
    if (atCheckpoint) {
      s.player.x = s.checkpoint;
      s.player.y = GROUND_Y - 90;
    } else {
      s.player.x = 40;
      s.player.y = GROUND_Y - 60;
      s.checkpoint = 40;
    }
    s.player.vx = 0;
    s.player.vy = 0;
    s.player.invuln = 70;
    s.respawnFlash = 16;
  };

  const start = useCallback(() => {
    const s = stateRef.current;
    s.hearts = 3;
    s.atoms = 0;
    s.particles = [];
    level.atoms.forEach((a) => (a.taken = false));
    level.enemies.forEach((e) => (e.dead = false));
    level.blocks.forEach((b) => (b.used = false));
    resetPlayer(false);
    s.cam = 0;
    setStatus("playing");
    setBanner("GO!");
    sfx.waveStart();
    setTimeout(() => setBanner(null), 1200);
  }, [level]);

  /* ------------------------- QUESTION HANDLER ------------------------- */
  const openQuestion = () => {
    const idx = qOrder[qIdxRef.current % Math.max(1, qOrder.length)];
    qIdxRef.current += 1;
    setQuestion(pool[idx] ?? chapter.questions[0]);
    setQFeedback(null);
    setStatus("question");
  };

  const answerQuestion = (i: number) => {
    if (!question || qFeedback !== null) return;
    setQFeedback(i);
    const s = stateRef.current;
    if (i === question.answer) {
      sfx.correct();
      s.atoms += 3;
      for (let k = 0; k < 24; k++)
        s.particles.push({
          x: s.player.x + 14, y: s.player.y, vx: (Math.random() - 0.5) * 7,
          vy: -Math.random() * 7, life: 40, c: "#a3e635",
        });
    } else {
      sfx.wrong();
      s.hearts -= 1;
    }
    setTimeout(() => {
      setQuestion(null);
      setQFeedback(null);
      if (stateRef.current.hearts <= 0) {
        setStatus("lose");
        sfx.gameOver();
      } else {
        setStatus("playing");
      }
    }, 1500);
  };

  /* ------------------------- MAIN LOOP ------------------------- */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = VW * dpr;
    canvas.height = VH * dpr;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);
    let raf = 0;

    const rectsOverlap = (a: Rect, b: Rect) =>
      a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

    const burst = (x: number, y: number, c: string, n = 10) => {
      for (let k = 0; k < n; k++)
        stateRef.current.particles.push({
          x, y, vx: (Math.random() - 0.5) * 5, vy: -Math.random() * 4.5,
          life: 26 + Math.random() * 18, c,
        });
    };

    const hurt = () => {
      const s = stateRef.current;
      if (s.player.invuln > 0) return;
      s.hearts -= 1;
      s.player.invuln = 80;
      s.player.vy = -7;
      s.player.vx = -s.player.face * 6;
      s.respawnFlash = 10;
      sfx.hurt();
      burst(s.player.x + 14, s.player.y + 18, "#f472b6", 14);
      if (s.hearts <= 0) {
        setStatus("lose");
        sfx.gameOver();
      }
    };

    const update = () => {
      const s = stateRef.current;
      const p = s.player;
      s.tick++;

      // ---- การเคลื่อนที่ ----
      if (keys.current.left) {
        p.vx -= ACC;
        p.face = -1;
      }
      if (keys.current.right) {
        p.vx += ACC;
        p.face = 1;
      }
      if (!keys.current.left && !keys.current.right) p.vx *= FRICTION;
      p.vx = Math.max(-MAXSPD, Math.min(MAXSPD, p.vx));
      if (Math.abs(p.vx) < 0.05) p.vx = 0;

      // ---- กระโดด (coyote time + jump buffer) ----
      if (keys.current.jump) p.buffer = 7;
      else p.buffer = Math.max(0, p.buffer - 1);
      if (p.coyote > 0) p.coyote--;
      if (p.buffer > 0) {
        if (p.coyote > 0) {
          // กระโดดแรกจากพื้น
          p.vy = JUMP;
          p.onGround = false;
          p.coyote = 0;
          p.buffer = 0;
          p.jumps = 1;
          p.squash = -0.35;
          sfx.jump();
          burst(p.x + p.w / 2, p.y + p.h, "#ffffff88", 6);
        } else if (p.jumps > 0) {
          // กระโดดคู่กลางอากาศ!
          p.vy = JUMP * 0.86;
          p.jumps -= 1;
          p.buffer = 0;
          p.squash = -0.4;
          p.spin = 22;
          sfx.jump();
          burst(p.x + p.w / 2, p.y + p.h, "#22d3ee", 12);
        }
      }
      if (p.spin > 0) p.spin -= 1;
      if (!keys.current.jump && p.vy < -4) p.vy *= 0.55; // ปล่อยเร็ว = กระโดดสั้น

      p.vy = Math.min(15, p.vy + GRAV);

      // ---- เคลื่อนที่แกน X ----
      p.x += p.vx;
      for (const r of level.solids) {
        if (!rectsOverlap(p, r)) continue;
        if (p.vx > 0) p.x = r.x - p.w;
        else if (p.vx < 0) p.x = r.x + r.w;
        p.vx = 0;
      }
      p.x = Math.max(0, Math.min(WORLD_W - p.w, p.x));

      // ---- เคลื่อนที่แกน Y ----
      const wasAir = !p.onGround;
      p.onGround = false;
      p.y += p.vy;
      for (const r of level.solids) {
        if (!rectsOverlap(p, r)) continue;
        if (p.vy > 0) {
          p.y = r.y - p.h;
          p.onGround = true;
          if (wasAir && p.squash === 0) {
            p.squash = 0.3;
            sfx.land();
            burst(p.x + p.w / 2, p.y + p.h, "#ffffff66", 5);
          }
          p.vy = 0;
        } else if (p.vy < 0) {
          p.y = r.y + r.h;
          p.vy = 1;
          if (r.kind === "block" && !r.used) {
            r.used = true;
            burst(r.x + r.w / 2, r.y + r.h, "#fbbf24", 18);
            sfx.coin();
            openQuestion();
          }
        }
      }
      if (p.onGround) {
        p.coyote = 9;
        p.jumps = 2;
        p.spin = 0;
      }
      p.squash *= 0.82;
      if (p.invuln > 0) p.invuln--;
      if (s.respawnFlash > 0) s.respawnFlash--;

      // ---- กล้อง ----
      const target = Math.max(0, Math.min(WORLD_W - VW, p.x + p.w / 2 - VW * 0.42));
      s.cam += (target - s.cam) * 0.12;

      // ---- เช็คพอยต์ ----
      for (const c of level.checkpoints) if (p.x >= c) s.checkpoint = c;

      // ---- อะตอม ----
      for (const a of level.atoms) {
        if (a.taken) continue;
        a.ph += 0.08;
        const box = { x: a.x - 15, y: a.y - 15 + Math.sin(a.ph) * 4, w: 30, h: 30 };
        if (rectsOverlap(p, box)) {
          a.taken = true;
          s.atoms++;
          sfx.coin();
          burst(a.x, a.y, chapter.hue, 12);
          // คอมโบเก็บอะตอมต่อเนื่อง
          s.combo = s.comboTimer > 0 ? s.combo + 1 : 1;
          s.comboTimer = 60;
          if (s.combo >= 3) burst(a.x, a.y - 22, "#fbbf24", 10);
        }
      }
      if (s.comboTimer > 0) {
        s.comboTimer--;
        if (s.comboTimer === 0) s.combo = 0;
      }

      // ---- กรด / ตกหลุม ----
      for (const hz of level.hazards) if (rectsOverlap(p, hz)) hurt();
      if (p.y > VH + 60) {
        if (p.invuln > 0) {
          /* กำลังอมตะ ไม่นับ */
        }
        s.hearts -= 1;
        sfx.hurt();
        if (s.hearts <= 0) {
          setStatus("lose");
          sfx.gameOver();
        } else resetPlayer(true);
      }

      // ---- ศัตรู ----
      for (const e of level.enemies) {
        if (e.dead) continue;
        e.x += e.dir * 1.25;
        if (e.x < e.x1) { e.x = e.x1; e.dir = 1; }
        if (e.x + e.w > e.x2) { e.x = e.x2 - e.w; e.dir = -1; }
        if (rectsOverlap(p, e)) {
          const stomping = p.vy > 1.5 && p.y + p.h - e.y < 22;
          if (stomping) {
            e.dead = true;
            p.vy = -9;
            sfx.bossHit();
            burst(e.x + e.w / 2, e.y, "#fca5a5", 16);
          } else hurt();
        }
      }

      // ---- อนุภาค ----
      s.particles = s.particles.filter((pt) => {
        pt.x += pt.vx;
        pt.y += pt.vy;
        pt.vy += 0.28;
        pt.life--;
        return pt.life > 0;
      });

      // ---- ถึงธง ----
      if (p.x + p.w > WORLD_W - 90) {
        setStatus("win");
        sfx.fanfare();
      }
    };

    /* ------------------------- DRAW ------------------------- */
    const draw = () => {
      const s = stateRef.current;
      const cam = s.cam;

      // ท้องฟ้า
      const sky = ctx.createLinearGradient(0, 0, 0, VH);
      sky.addColorStop(0, "#1b1145");
      sky.addColorStop(0.55, "#2a1a5e");
      sky.addColorStop(1, "#0b1030");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, VW, VH);

      // ดาว
      ctx.fillStyle = "rgba(255,255,255,.7)";
      for (let k = 0; k < 40; k++) {
        const sx = (k * 137 + 40 - cam * 0.15) % VW;
        const sy = (k * 61) % 220;
        const tw = 0.5 + Math.sin(s.tick * 0.05 + k) * 0.5;
        ctx.globalAlpha = 0.25 + tw * 0.5;
        ctx.fillRect(sx < 0 ? sx + VW : sx, sy, 2, 2);
      }
      ctx.globalAlpha = 1;

      // ภูเขาพารัลแลกซ์
      for (let layer = 0; layer < 2; layer++) {
        const off = cam * (layer === 0 ? 0.25 : 0.45);
        ctx.fillStyle = layer === 0 ? "#241a52" : "#2f2266";
        ctx.beginPath();
        ctx.moveTo(-100, VH);
        for (let hx = -100; hx <= VW + 100; hx += 60) {
          const h = 110 + Math.sin((hx + off * 1.4 + layer * 90) * 0.008) * 60;
          ctx.lineTo(hx, VH - GROUND_Y + 40 - h * 0.55);
        }
        ctx.lineTo(VW + 100, VH);
        ctx.closePath();
        ctx.fill();
      }

      // หมอก / บอลลูนพารัลแลกซ์
      for (let k = 0; k < 7; k++) {
        const bx = ((k * 340 - cam * 0.6) % (WORLD_W) + WORLD_W) % WORLD_W - 200;
        const by = 60 + ((k * 53) % 120) + Math.sin(s.tick * 0.02 + k) * 8;
        ctx.globalAlpha = 0.14;
        ctx.fillStyle = chapter.hue;
        ctx.beginPath();
        ctx.arc(bx, by, 26 + (k % 3) * 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      ctx.save();
      ctx.translate(-cam, 0);

      // พื้น + แพลตฟอร์ม
      for (const r of level.solids) {
        if (r.x + r.w < cam - 60 || r.x > cam + VW + 60) continue;
        if (r.kind === "ground") {
          const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
          g.addColorStop(0, "#4c3524");
          g.addColorStop(1, "#2b1d14");
          ctx.fillStyle = g;
          ctx.fillRect(r.x, r.y, r.w, r.h);
          ctx.fillStyle = chapter.hue;
          ctx.fillRect(r.x, r.y, r.w, 8);
          ctx.fillStyle = "rgba(255,255,255,.25)";
          ctx.fillRect(r.x, r.y, r.w, 3);
        } else if (r.kind === "platform") {
          ctx.fillStyle = "#3b2f6b";
          roundRect(ctx, r.x, r.y, r.w, r.h, 7);
          ctx.fill();
          ctx.fillStyle = chapter.hue;
          roundRect(ctx, r.x, r.y, r.w, 8, 7);
          ctx.fill();
        } else {
          // บล็อกคำถาม
          const bobY = r.used ? 0 : Math.sin(s.tick * 0.07) * 3;
          ctx.fillStyle = r.used ? "#5b5470" : "#fbbf24";
          roundRect(ctx, r.x, r.y + bobY, r.w, r.h, 8);
          ctx.fill();
          ctx.strokeStyle = "#0a0a18";
          ctx.lineWidth = 3;
          roundRect(ctx, r.x, r.y + bobY, r.w, r.h, 8);
          ctx.stroke();
          ctx.fillStyle = r.used ? "#2b2740" : "#0a0a18";
          ctx.font = "bold 24px 'Chakra Petch', monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(r.used ? "✓" : "?", r.x + r.w / 2, r.y + bobY + r.h / 2 + 1);
        }
      }

      // กรด
      for (const hz of level.hazards) {
        const g = ctx.createLinearGradient(0, hz.y, 0, hz.y + hz.h);
        g.addColorStop(0, "#a3e635");
        g.addColorStop(1, "#4d7c0f");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(hz.x, hz.y + hz.h);
        ctx.lineTo(hz.x, hz.y + 6);
        for (let wx = 0; wx <= hz.w; wx += 10) {
          ctx.lineTo(hz.x + wx, hz.y + 6 + Math.sin((wx + s.tick * 3) * 0.08) * 4);
        }
        ctx.lineTo(hz.x + hz.w, hz.y + hz.h);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = "#fbbf24";
        ctx.fillRect(hz.x, hz.y, hz.w, 4);
        ctx.globalAlpha = 1;
      }

      // อะตอม
      for (const a of level.atoms) {
        if (a.taken) continue;
        const ay = a.y + Math.sin(a.ph) * 5;
        ctx.save();
        ctx.translate(a.x, ay);
        ctx.rotate(a.ph * 0.5);
        ctx.strokeStyle = chapter.hue;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.ellipse(0, 0, 16, 6, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(0, 0, 16, 6, Math.PI / 2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        const g = ctx.createRadialGradient(a.x - 3, ay - 3, 1, a.x, ay, 11);
        g.addColorStop(0, "#ffffff");
        g.addColorStop(1, chapter.hue);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(a.x, ay, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#0a0a18";
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }

      // ศัตรู
      for (const e of level.enemies) {
        if (e.dead) continue;
        const bounce = Math.sin(s.tick * 0.15) * 2;
        ctx.fillStyle = "#f472b6";
        roundRect(ctx, e.x, e.y + bounce, e.w, e.h, 10);
        ctx.fill();
        ctx.strokeStyle = "#0a0a18";
        ctx.lineWidth = 3;
        roundRect(ctx, e.x, e.y + bounce, e.w, e.h, 10);
        ctx.stroke();
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(e.x + 12, e.y + 14 + bounce, 5, 0, Math.PI * 2);
        ctx.arc(e.x + 26, e.y + 14 + bounce, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#0a0a18";
        ctx.beginPath();
        ctx.arc(e.x + 12 + e.dir * 2, e.y + 14 + bounce, 2.4, 0, Math.PI * 2);
        ctx.arc(e.x + 26 + e.dir * 2, e.y + 14 + bounce, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }

      // ธงเป้าหมาย
      const flagX = WORLD_W - 70;
      ctx.fillStyle = "#e2e8f0";
      ctx.fillRect(flagX, GROUND_Y - 130, 7, 130);
      ctx.fillStyle = "#fbbf24";
      ctx.beginPath();
      ctx.moveTo(flagX + 7, GROUND_Y - 128);
      for (let fy = 0; fy < 60; fy += 6) {
        ctx.lineTo(flagX + 7 + 44 - fy * 0.5 + Math.sin(s.tick * 0.12 + fy * 0.2) * 4, GROUND_Y - 128 + fy);
      }
      ctx.lineTo(flagX + 7, GROUND_Y - 68);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#0a0a18";
      ctx.font = "bold 13px 'Chakra Petch', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("BOSS →", flagX + 26, GROUND_Y - 150);

      // อนุภาค
      for (const pt of s.particles) {
        ctx.globalAlpha = Math.min(1, pt.life / 30);
        ctx.fillStyle = pt.c;
        ctx.fillRect(pt.x - 2, pt.y - 2, 4, 4);
      }
      ctx.globalAlpha = 1;

      // ป้ายคอมโบเก็บอะตอมต่อเนื่อง
      if (s.combo >= 2 && s.comboTimer > 0) {
        const sc = 1 + Math.sin(s.tick * 0.3) * 0.08;
        ctx.save();
        ctx.translate(s.player.x + s.player.w / 2, s.player.y - 26);
        ctx.scale(sc, sc);
        ctx.font = "bold 16px 'Chakra Petch', monospace";
        ctx.textAlign = "center";
        ctx.lineWidth = 4;
        ctx.strokeStyle = "#0a0a18";
        ctx.strokeText("COMBO x" + s.combo, 0, 0);
        ctx.fillStyle = s.combo >= 5 ? "#f472b6" : "#fbbf24";
        ctx.fillText("COMBO x" + s.combo, 0, 0);
        ctx.restore();
      }

      // ผู้เล่น
      const p = s.player;
      const sq = p.squash;
      const ph = p.h * (1 - sq);
      const pw = p.w * (1 + sq);
      const py = p.y + (p.h - ph);
      const blink = p.invuln > 0 && Math.floor(s.tick / 4) % 2 === 0;
      if (!blink) {
        // ร่างกาย (เสื้อกาวน์)
        ctx.fillStyle = "#f8fafc";
        roundRect(ctx, p.x, py, pw, ph, 8);
        ctx.fill();
        ctx.strokeStyle = "#0a0a18";
        ctx.lineWidth = 3;
        roundRect(ctx, p.x, py, pw, ph, 8);
        ctx.stroke();
        // หัว
        ctx.fillStyle = "#fcd5b5";
        roundRect(ctx, p.x + 4, py - 12, pw - 8, 16, 6);
        ctx.fill();
        ctx.stroke();
        // ผม
        ctx.fillStyle = "#3b2f6b";
        roundRect(ctx, p.x + 3, py - 15, pw - 6, 8, 4);
        ctx.fill();
        // แว่นตา
        ctx.fillStyle = "#22d3ee";
        ctx.fillRect(p.x + (p.face === 1 ? pw - 15 : 4), py - 8, 11, 6);
        ctx.strokeStyle = "#0a0a18";
        ctx.lineWidth = 2;
        ctx.strokeRect(p.x + (p.face === 1 ? pw - 15 : 4), py - 8, 11, 6);
        // ขา
        ctx.fillStyle = "#22d3ee";
        const legPhase = p.onGround && Math.abs(p.vx) > 0.6 ? Math.sin(s.tick * 0.35) * 4 : 0;
        ctx.fillRect(p.x + 4, py + ph - 4, 8, 6 + Math.max(0, legPhase));
        ctx.fillRect(p.x + pw - 12, py + ph - 4, 8, 6 + Math.max(0, -legPhase));
      }

      ctx.restore();

      // แฟลชตอนโดนทำร้าย
      if (s.respawnFlash > 0) {
        ctx.fillStyle = `rgba(244,63,94,${(s.respawnFlash / 16) * 0.4})`;
        ctx.fillRect(0, 0, VW, VH);
      }
    };

    const loop = () => {
      if (statusRef.current === "playing") update();
      if (statusRef.current !== "question") draw();
      // อัปเดต HUD เมื่อค่าเปลี่ยน
      const s = stateRef.current;
      setHud((prev) => {
        const prog = Math.round((s.player.x / (WORLD_W - 90)) * 100);
        if (prev.atoms === s.atoms && prev.hearts === s.hearts && prev.progress === prog) return prev;
        return { atoms: s.atoms, total: level.atoms.length, hearts: s.hearts, progress: prog };
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, chapter.hue]);

  /* ------------------------- FINISH ------------------------- */
  const finish = (ok: boolean) => {
    const s = stateRef.current;
    onDone({
      atoms: s.atoms,
      totalAtoms: level.atoms.length,
      hearts: Math.max(0, s.hearts),
      bonus: ok ? 1 : 0,
    });
  };

  return (
    <div className="mx-auto max-w-5xl px-3 pb-14 pt-5 sm:px-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className="rounded-xl border-[3px] border-[#0a0a18] px-2.5 py-1.5 font-px text-[8px] text-[#0a0a18]"
            style={{ background: "#a3e635" }}
          >
            MINI-GAME
          </span>
          <h2 className="font-tech text-base font-bold text-white sm:text-lg">
            ตะลุยด่านเก็บอะตอม — {npcName}
          </h2>
        </div>
        <button type="button" onClick={() => { sfx.back(); onExit(); }} className="btn-ghost px-3 py-2 font-px text-[8px]">
          ◀ แผนที่
        </button>
      </div>

      {/* HUD */}
      <div className="card mb-3 flex flex-wrap items-center justify-between gap-3 px-3 py-2.5">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            {[0, 1, 2].map((k) => (
              <span key={k} className={cn("text-xl transition-all", k < hud.hearts ? "scale-100" : "scale-75 opacity-25 grayscale")}>
                ❤️
              </span>
            ))}
          </div>
          <div className="flex items-center gap-1.5 rounded-lg border-2 border-white/12 bg-black/30 px-2.5 py-1">
            <span className="text-base">{chapter.emoji}</span>
            <span className="font-px text-[9px] text-[#a3e635] tnum">
              {hud.atoms}/{hud.total}
            </span>
          </div>
          <div className="hidden items-center gap-1.5 rounded-lg border-2 border-white/12 bg-black/30 px-2.5 py-1 sm:flex">
            <span className="text-base">❓</span>
            <span className="font-px text-[9px] text-[#fbbf24]">
              {level.blocks.filter((b) => b.used).length}/{level.blocks.length}
            </span>
          </div>
        </div>
        <div className="flex min-w-[140px] flex-1 items-center gap-2 sm:max-w-xs">
          <span className="font-px text-[7px] text-white/40">START</span>
          <div className="bar-track h-3 flex-1">
            <div className="bar-fill" style={{ width: `${hud.progress}%`, background: "#22d3ee" }} />
          </div>
          <span className="font-px text-[7px] text-white/40">BOSS</span>
        </div>
      </div>

      {/* GAME CANVAS */}
      <div className="card crt-lines relative overflow-hidden p-2 sm:p-3">
        <canvas
          ref={canvasRef}
          className="block w-full rounded-xl border-[3px] border-[#0a0a18] bg-[#120b2e]"
          style={{ aspectRatio: `${VW} / ${VH}`, touchAction: "none" }}
        />

        {banner && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="banner-in font-px text-[24px] text-[#fbbf24] sm:text-[40px]">{banner}</span>
          </div>
        )}

        {/* READY / LOSE / WIN OVERLAY */}
        {status !== "playing" && status !== "question" && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0a0620]/88 p-4 backdrop-blur-[2px]">
            <div className="pop-in w-full max-w-md text-center">
              {status === "ready" && (
                <>
                  <div className="mb-2 text-5xl">🕹️</div>
                  <h3 className="font-px text-[13px] text-[#a3e635]">STAGE {chapter.id}: START?</h3>
                  <p className="mt-3 font-tech text-[13px] leading-relaxed text-white/75">
                    เก็บอะตอม <b className="text-[#a3e635]">{level.atoms.length} อนุภาค</b> แล้ววิ่งไปให้ถึงธง
                    <b className="text-[#fbbf24]"> BOSS →</b> ที่ปลายทาง
                    <br />
                    เดินบนกรดสีเขียวไม่ได้ · เหยียบศัตรูตะกอนจากด้านบน · ชนก้อน <b className="text-[#fbbf24]">?</b>{" "}
                    เพื่อตอบคำถามรับอะตอมพิเศษ
                  </p>
                  <div className="mt-3 rounded-xl border-2 border-white/12 bg-black/30 p-2.5 font-tech text-[11px] text-white/60">
                    💻 คอม: <b>← →</b> เดิน · <b>SPACE / W / ↑</b> กระโดด &nbsp;|&nbsp; 📱 มือถือ: ใช้ปุ่มด้านล่าง
                  </div>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    <button type="button" onClick={start} className="btn-arcade px-5 py-3 font-px text-[11px]" style={{ ["--c" as string]: "#a3e635" }}>
                      ▶ เริ่มเกม
                    </button>
                    <button
                      type="button"
                      onClick={() => { sfx.click(); finish(false); }}
                      className="btn-ghost px-4 py-3 font-px text-[9px]"
                    >
                      ข้ามไปสู้บอส →
                    </button>
                  </div>
                </>
              )}
              {status === "lose" && (
                <>
                  <div className="mb-2 text-5xl">💔</div>
                  <h3 className="font-px text-[13px] text-[#f472b6]">OUT OF HEARTS</h3>
                  <p className="mt-3 font-tech text-[13px] text-white/70">
                    เก็บอะตอมได้ {stateRef.current.atoms}/{level.atoms.length} — ลองอีกครั้งนะ หรือข้ามไปสู้บอสเลย
                  </p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    <button type="button" onClick={start} className="btn-arcade px-5 py-3 font-px text-[11px]" style={{ ["--c" as string]: "#fbbf24" }}>
                      🔁 ลองอีกครั้ง
                    </button>
                    <button type="button" onClick={() => finish(false)} className="btn-ghost px-4 py-3 font-px text-[9px]">
                      ข้ามไปสู้บอส →
                    </button>
                  </div>
                </>
              )}
              {status === "win" && (
                <>
                  <div className="mb-2 text-5xl">🏁</div>
                  <h3 className="font-px text-[13px] text-[#a3e635]">STAGE CLEAR!</h3>
                  <p className="mt-3 font-tech text-[13px] text-white/75">
                    เก็บอะตอมได้ <b className="text-[#a3e635]">{stateRef.current.atoms}</b> อนุภาค · เหลือหัวใจ{" "}
                    <b className="text-[#f472b6]">{Math.max(0, stateRef.current.hearts)}</b> ดวง
                    <br />
                    <span className="text-white/50">ยิ่งเก็บมาก ยิ่งได้ไอเทมไปสู้บอสเยอะ!</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => { sfx.click(); finish(true); }}
                    className="btn-arcade mt-4 px-6 py-3.5 font-px text-[12px]"
                    style={{ ["--c" as string]: "#f472b6" }}
                  >
                    ⚔️ ไปสู้บอส
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* QUESTION OVERLAY */}
        {status === "question" && question && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0a0620]/92 p-3">
            <div className="pop-in w-full max-w-lg">
              <div className="rounded-xl border-[3px] border-[#0a0a18] bg-[#fbbf24] px-3 py-1.5 text-center font-px text-[9px] text-[#0a0a18]">
                ❓ ก้อนคำถามเคมี — ตอบถูกรับอะตอม 3 อนุภาค!
              </div>
              <div className="card mt-3 p-4">
                <p className="font-tech text-[15px] font-bold leading-relaxed text-white">{question.q}</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {question.choices.map((c, i) => {
                    const isAns = i === question.answer;
                    const picked = qFeedback === i;
                    return (
                      <button
                        key={c}
                        type="button"
                        disabled={qFeedback !== null}
                        onClick={() => answerQuestion(i)}
                        className={cn(
                          "rounded-xl border-[3px] border-[#0a0a18] px-3 py-2.5 text-left font-tech text-[13px] transition-all",
                          qFeedback === null
                            ? "bg-white/8 text-white hover:bg-white/16"
                            : isAns
                              ? "bg-[#a3e635] text-[#0a0a18]"
                              : picked
                                ? "bg-[#f472b6] text-white"
                                : "bg-white/5 text-white/35",
                        )}
                      >
                        <span className="mr-2 font-px text-[8px] text-[#fbbf24]">
                          {String.fromCharCode(65 + i)}
                        </span>
                        {c}
                      </button>
                    );
                  })}
                </div>
                {qFeedback !== null && (
                  <p className="mt-3 font-tech text-[12px] text-white/60">
                    {qFeedback === question.answer ? "✔ ถูกต้อง! +3 อะตอม" : "✘ ผิด และเสียหัวใจ 1 ดวง"}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* TOUCH CONTROLS */}
      <div className="mt-3 grid grid-cols-3 gap-2 sm:hidden">
        <button
          type="button"
          onPointerDown={touch("left", true)}
          onPointerUp={touch("left", false)}
          onPointerLeave={touch("left", false)}
          onPointerCancel={touch("left", false)}
          className="btn-arcade touch-none py-5 font-px text-[14px]"
          style={{ ["--c" as string]: "#22d3ee" }}
        >
          ◀
        </button>
        <button
          type="button"
          onPointerDown={touch("jump", true)}
          onPointerUp={touch("jump", false)}
          onPointerLeave={touch("jump", false)}
          onPointerCancel={touch("jump", false)}
          className="btn-arcade touch-none py-5 font-px text-[11px]"
          style={{ ["--c" as string]: "#a3e635" }}
        >
          JUMP ⤒
        </button>
        <button
          type="button"
          onPointerDown={touch("right", true)}
          onPointerUp={touch("right", false)}
          onPointerLeave={touch("right", false)}
          onPointerCancel={touch("right", false)}
          className="btn-arcade touch-none py-5 font-px text-[14px]"
          style={{ ["--c" as string]: "#22d3ee" }}
        >
          ▶
        </button>
      </div>

      <p className="mt-3 hidden text-center font-tech text-[11px] text-white/35 sm:block">
        💻 คีย์บอร์ด: <b>← →</b> หรือ <b>A / D</b> เดิน · <b>SPACE</b> / <b>W</b> / <b>↑</b> กระโดด (กดค้าง = กระโดดสูง)
        · บนมือถือใช้ปุ่มสัมผัสด้านล่าง
      </p>
    </div>
  );
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
