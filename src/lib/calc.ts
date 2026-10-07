/**
 * 8-Bit Sci-Calc Module — เครื่องคิดเลขวิทยาศาสตร์แบบเรียบง่าย
 * รองรับ: + - * / ^ ( ) sqrt log ln exp sin cos tan tanh π e EXP(×10^n)
 * ใช้ shunting-yard + RPN evaluator แบบละเอียด (ไม่ใช้ eval เพื่อความปลอดภัย)
 */

type Token =
  | { t: "num"; v: number }
  | { t: "op"; v: string }
  | { t: "fn"; v: string }
  | { t: "lp" }
  | { t: "rp" }
  | { t: "sep" };

const FUNCS: Record<string, (x: number) => number> = {
  sqrt: Math.sqrt,
  "√": Math.sqrt,
  log: (x) => Math.log10(x),
  log10: (x) => Math.log10(x),
  ln: (x) => Math.log(x),
  sin: (x) => Math.sin(x),
  cos: (x) => Math.cos(x),
  tan: (x) => Math.tan(x),
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  exp: Math.exp,
  abs: Math.abs,
  "10^": (x) => Math.pow(10, x),
};

const PREC: Record<string, number> = { "+": 1, "-": 1, "*": 2, "/": 2, "%": 2, "^": 4, "u-": 5 };
const RIGHT_ASSOC = new Set(["^", "u-"]);

function tokenize(input: string): Token[] {
  const s0 = input
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/−/g, "-")
    .replace(/√\s*/g, "sqrt")
    .replace(/π/g, "(3.141592653589793)");

  const s = s0.replace(/(?<![a-zA-Z0-9_])e(?![a-zA-Z0-9_(])/g, "(2.718281828459045)");

  const tokens: Token[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === " ") {
      i++;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j])) j++;
      // จัดการเลขแบบ E-notation จากปุ่ม EXP เช่น 6.02E23
      if (s[j] === "E" || s[j] === "e") {
        let k = j + 1;
        if (s[k] === "+" || s[k] === "-") k++;
        if (/[0-9]/.test(s[k] ?? "")) {
          while (k < s.length && /[0-9]/.test(s[k])) k++;
          j = k;
        }
      }
      tokens.push({ t: "num", v: parseFloat(s.slice(i, j)) });
      i = j;
      continue;
    }
    if (c === "(") {
      tokens.push({ t: "lp" });
      i++;
      continue;
    }
    if (c === ")") {
      tokens.push({ t: "rp" });
      i++;
      continue;
    }
    if (c === ",") {
      tokens.push({ t: "sep" });
      i++;
      continue;
    }
    // ฟังก์ชัน / ค่าคงตัวที่เป็นตัวอักษร
    if (/[a-zA-Z√^]/.test(c)) {
      if (c === "^") {
        tokens.push({ t: "op", v: "^" });
        i++;
        continue;
      }
      let j = i;
      while (j < s.length && /[a-zA-Z0-9_]/.test(s[j])) j++;
      let word = s.slice(i, j);
      i = j;
      // ตัดตัวเลขที่ติดกัน เช่น sqrt2 → sqrt(2)
      if (!FUNCS[word] && word.length > 1) {
        for (let len = word.length - 1; len >= 1; len--) {
          const head = word.slice(0, len);
          if (FUNCS[head]) {
            const rest = word.slice(len);
            if (rest !== "" && !isNaN(Number(rest))) {
              tokens.push({ t: "fn", v: head });
              tokens.push({ t: "lp" });
              tokens.push({ t: "num", v: Number(rest) });
              tokens.push({ t: "rp" });
              word = "";
            }
            break;
          }
        }
      }
      if (word === "") continue;
      if (FUNCS[word]) {
        tokens.push({ t: "fn", v: word });
        // อนุญาต sqrt9 โดยไม่มีวงเล็บ
        if (s[i] === "(") continue;
        tokens.push({ t: "lp" });
        // หาตัวเลขถัดไป
        let k = i;
        if (s[k] === "-" || s[k] === "+") k++;
        let m = k;
        while (m < s.length && /[0-9.]/.test(s[m])) m++;
        if (m > k) {
          if (s[i] === "-") {
            tokens.push({ t: "op", v: "u-" });
          }
          tokens.push({ t: "num", v: parseFloat(s.slice(k, m)) });
          i = m;
        }
        tokens.push({ t: "rp" });
        continue;
      }
      throw new Error(`ไม่รู้จักคำสั่ง: ${word}`);
    }
    if ("+-*/%".includes(c)) {
      tokens.push({ t: "op", v: c });
      i++;
      continue;
    }
    throw new Error(`อักขระไม่ถูกต้อง: ${c}`);
  }
  return tokens;
}

function toRPN(tokens: Token[]): Token[] {
  const out: Token[] = [];
  const stack: Token[] = [];
  let prev: Token | null = null;

  for (const tk of tokens) {
    if (tk.t === "num") {
      out.push(tk);
    } else if (tk.t === "fn") {
      stack.push(tk);
    } else if (tk.t === "sep") {
      while (stack.length && stack[stack.length - 1].t !== "lp") out.push(stack.pop()!);
      if (!stack.length) throw new Error("วงเล็บไม่สมดุล");
    } else if (tk.t === "op") {
      let op = tk.v;
      const isUnary =
        op === "-" &&
        (prev === null || (prev.t === "op") || prev.t === "lp" || prev.t === "sep");
      if (isUnary) op = "u-";
      while (stack.length) {
        const top = stack[stack.length - 1];
        if (top.t === "op") {
          const a = PREC[op];
          const b = PREC[top.v];
          if (b > a || (b === a && !RIGHT_ASSOC.has(op))) out.push(stack.pop()!);
          else break;
        } else if (top.t === "fn") {
          out.push(stack.pop()!);
        } else break;
      }
      stack.push({ t: "op", v: op });
    } else if (tk.t === "lp") {
      // การคูณแบบ implicit: 2(3+1) = 8
      if (prev && (prev.t === "num" || prev.t === "rp")) {
        const mulTok: Token = { t: "op", v: "*" };
        while (stack.length) {
          const top = stack[stack.length - 1];
          if (top.t === "op" && PREC[top.v] >= PREC["*"]) out.push(stack.pop()!);
          else break;
        }
        stack.push(mulTok);
      }
      stack.push(tk);
    } else if (tk.t === "rp") {
      while (stack.length && stack[stack.length - 1].t !== "lp") out.push(stack.pop()!);
      if (!stack.length) throw new Error("วงเล็บไม่สมดุล");
      stack.pop();
      if (stack.length && stack[stack.length - 1].t === "fn") out.push(stack.pop()!);
    }
    prev = tk;
  }
  while (stack.length) {
    const s = stack.pop()!;
    if (s.t === "lp") throw new Error("วงเล็บไม่สมดุล");
    out.push(s);
  }
  return out;
}

function evalRPN(rpn: Token[]): number {
  const st: number[] = [];
  for (const tk of rpn) {
    if (tk.t === "num") st.push(tk.v);
    else if (tk.t === "fn") {
      const f = FUNCS[tk.v];
      if (!f) throw new Error("ฟังก์ชันไม่ถูกต้อง");
      const x = st.pop();
      if (x === undefined) throw new Error("นิพจน์ไม่สมบูรณ์");
      st.push(f(x));
    } else if (tk.t === "op") {
      if (tk.v === "u-") {
        const x = st.pop();
        if (x === undefined) throw new Error("นิพจน์ไม่สมบูรณ์");
        st.push(-x);
        continue;
      }
      const b = st.pop();
      const a = st.pop();
      if (a === undefined || b === undefined) throw new Error("นิพจน์ไม่สมบูรณ์");
      switch (tk.v) {
        case "+": st.push(a + b); break;
        case "-": st.push(a - b); break;
        case "*": st.push(a * b); break;
        case "/":
          if (b === 0) throw new Error("หารด้วยศูนย์!");
          st.push(a / b);
          break;
        case "%": st.push(a % b); break;
        case "^": st.push(Math.pow(a, b)); break;
        default: throw new Error("ตัวดำเนินการไม่ถูกต้อง");
      }
    }
  }
  if (st.length !== 1) throw new Error("นิพจน์ไม่สมบูรณ์");
  return st[0];
}

export function evaluate(expr: string): number {
  if (!expr.trim()) throw new Error("ยังไม่ได้ป้อนนิพจน์");
  const tokens = tokenize(expr);
  if (!tokens.length) throw new Error("ยังไม่ได้ป้อนนิพจน์");
  return evalRPN(toRPN(tokens));
}

export function formatNumber(n: number): string {
  if (!isFinite(n)) return "∞";
  if (Number.isInteger(n) && Math.abs(n) < 1e15) return n.toString();
  const abs = Math.abs(n);
  if (abs !== 0 && (abs < 1e-6 || abs >= 1e12)) {
    return n.toExponential(6).replace(/e([+-])(\d+)/, "e$1$2");
  }
  const r = Number(n.toPrecision(12));
  return r.toString();
}
