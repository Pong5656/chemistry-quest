import { useEffect, useState } from "react";
import { evaluate, formatNumber } from "../lib/calc";
import { sfx } from "../lib/sfx";
import { cn } from "../utils/cn";

const BASIC: string[][] = [
  ["C", "⌫", "%", "÷"],
  ["7", "8", "9", "×"],
  ["4", "5", "6", "−"],
  ["1", "2", "3", "+"],
  ["0", ".", "(", ")"],
];

const SCI: string[][] = [
  ["sqrt(", "log(", "ln(", "^"],
  ["sin(", "cos(", "tan(", "EXP"],
  ["π", "10^(", "abs(", "e"],
];

export function SciCalc() {
  const [expr, setExpr] = useState("");
  const [ans, setAns] = useState("0");
  const [err, setErr] = useState("");
  const [mode, setMode] = useState<"basic" | "sci">("sci");
  const [open, setOpen] = useState(false);

  const push = (s: string) => {
    setErr("");
    setExpr((e) => e + s);
  };

  const press = (k: string) => {
    setErr("");
    if (k === "C") {
      setExpr("");
      setAns("0");
      sfx.back();
      return;
    }
    if (k === "⌫") {
      sfx.hover();
      setExpr((e) => {
        if (!e) return e;
        const m = e.match(/(sqrt\(|log\(|ln\(|sin\(|cos\(|tan\(|abs\(|10\^\(|E)$/);
        if (m) return e.slice(0, -m[1].length);
        return e.slice(0, -1);
      });
      return;
    }
    if (k === "EXP") {
      sfx.hover();
      setExpr((e) => e + "E");
      return;
    }
    if (k === "=") {
      try {
        let clean = expr.replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-");
        const opens = (clean.match(/\(/g) || []).length;
        const closes = (clean.match(/\)/g) || []).length;
        if (opens > closes) clean += ")".repeat(opens - closes);
        clean = clean.replace(/[+\-*/^]+$/, "");
        const val = evaluate(clean);
        setAns(formatNumber(val));
        setExpr(clean);
        sfx.coin();
      } catch (ex) {
        setErr(ex instanceof Error ? ex.message : "ผิดพลาด");
        sfx.wrong();
      }
      return;
    }
    sfx.hover();
    push(k);
  };

  // รองรับคีย์บอร์ดเมื่อเปิดเครื่องคิดเลขอยู่
  useEffect(() => {
    if (!open) return;
    const onKey = (ev: KeyboardEvent) => {
      const k = ev.key;
      if (/^[0-9.]$/.test(k)) push(k);
      else if ("+-*/^()".includes(k) && k.length === 1) push(k === "*" ? "×" : k === "/" ? "÷" : k);
      else if (k === "Enter" || k === "=") {
        ev.preventDefault();
        press("=");
      } else if (k === "Backspace") press("⌫");
      else if (k === "Escape") {
        setExpr("");
        setAns("0");
        setErr("");
      } else if (k.toLowerCase() === "s") press("sqrt(");
      else if (k.toLowerCase() === "l") press("log(");
      else return;
      ev.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          sfx.click();
          setOpen(true);
        }}
        className="btn-arcade fixed bottom-4 right-4 z-40 px-3.5 py-3 font-px text-[8px]"
        style={{ ["--c" as string]: "#22d3ee" }}
        title="เครื่องคิดเลขวิทยาศาสตร์"
      >
        🧮 <span className="hidden sm:inline">SCI-CALC</span>
      </button>
    );
  }

  return (
    <div className="card crt-lines fixed bottom-4 right-4 z-40 w-[min(92vw,336px)] overflow-hidden p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-px text-[7px] text-[#22d3ee]">8-BIT SCI-CALC</span>
        <button
          type="button"
          onClick={() => {
            sfx.back();
            setOpen(false);
          }}
          className="rounded-lg border-2 border-[#0a0a18] bg-[#f472b6] px-2 py-0.5 font-px text-[8px] text-[#0a0a18]"
        >
          ✕
        </button>
      </div>

      <div className="mb-2 flex gap-1.5">
        <button
          type="button"
          onClick={() => setMode("basic")}
          className={cn(
            "flex-1 rounded-lg border-2 border-[#0a0a18] py-1.5 font-px text-[7px] transition-all",
            mode === "basic" ? "bg-[#fbbf24] text-[#0a0a18]" : "bg-white/8 text-white/45",
          )}
        >
          BASIC
        </button>
        <button
          type="button"
          onClick={() => setMode("sci")}
          className={cn(
            "flex-1 rounded-lg border-2 border-[#0a0a18] py-1.5 font-px text-[7px] transition-all",
            mode === "sci" ? "bg-[#a3e635] text-[#0a0a18]" : "bg-white/8 text-white/45",
          )}
        >
          SCIENTIFIC
        </button>
      </div>

      <div className="mb-2 rounded-xl border-[3px] border-[#0a0a18] bg-[#04121c] px-2.5 py-2">
        <div className="min-h-[18px] break-all text-right font-tech text-xs text-[#5eead4]">{expr || "\u00a0"}</div>
        <div className="mt-1 break-all text-right font-px text-[12px] text-white">
          {err ? <span className="text-[#f472b6]">{err}</span> : ans}
        </div>
      </div>

      {mode === "sci" && (
        <div className="mb-1.5 grid grid-cols-4 gap-1.5">
          {SCI.flat().map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => press(k)}
              className="rounded-lg border-2 border-[#0a0a18] bg-[#4c1d95] py-2 font-tech text-[10px] font-bold text-white transition-all hover:brightness-125 active:translate-y-[2px]"
            >
              {k.replace("(", "")}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-4 gap-1.5">
        {BASIC.flat().map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => press(k)}
            className={cn(
              "rounded-lg border-2 border-[#0a0a18] py-2.5 font-px text-[11px] text-[#0a0a18] transition-all hover:brightness-110 active:translate-y-[2px]",
              "÷×−+%" .includes(k)
                ? "bg-[#fb923c]"
                : k === "C"
                  ? "bg-[#f472b6]"
                  : k === "⌫"
                    ? "bg-[#fbbf24]"
                    : "bg-[#7dd3fc]",
            )}
          >
            {k}
          </button>
        ))}
      </div>

      <div className="mt-1.5 grid grid-cols-2 gap-1.5">
        <button
          type="button"
          onClick={() => {
            sfx.hover();
            setExpr((e) => e + ans);
          }}
          className="rounded-lg border-2 border-[#0a0a18] bg-white/10 py-2 font-px text-[8px] text-white hover:bg-white/20"
        >
          ANS
        </button>
        <button
          type="button"
          onClick={() => press("=")}
          className="rounded-lg border-2 border-[#0a0a18] bg-[#a3e635] py-2 font-px text-[10px] text-[#0a0a18] hover:brightness-110"
        >
          =
        </button>
      </div>

      <p className="mt-2 font-tech text-[10px] leading-snug text-white/40">
        💡 EXP = ×10ⁿ (เช่น 6.02 EXP 23) · sqrt( แล้วตามด้วยตัวเลขหรือวงเล็บ · รองรับคีย์บอร์ด
      </p>
    </div>
  );
}
