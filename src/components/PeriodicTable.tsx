import { useState } from "react";
import { cn } from "../utils/cn";

/** Z|สัญลักษณ์|ชื่อไทย|มวลอะตอม|หมู่|คาบ|หมวด */
const RAW = `1|H|ไฮโดรเจน|1.008|1|1|nm
2|He|ฮีเลียม|4.003|18|1|ng
3|Li|ลิเทียม|6.94|1|2|al
4|Be|เบริลเลียม|9.012|2|2|ae
5|B|โบรอน|10.81|13|2|md
6|C|คาร์บอน|12.011|14|2|nm
7|N|ไนโตรเจน|14.007|15|2|nm
8|O|ออกซิเจน|15.999|16|2|nm
9|F|ฟลูออรีน|18.998|17|2|hg
10|Ne|นีออน|20.180|18|2|ng
11|Na|โซเดียม|22.990|1|3|al
12|Mg|แมกนีเซียม|24.305|2|3|ae
13|Al|อะลูมิเนียม|26.982|13|3|pt
14|Si|ซิลิกอน|28.086|14|3|md
15|P|ฟอสฟอรัส|30.974|15|3|nm
16|S|กำมะถัน|32.06|16|3|nm
17|Cl|คลอรีน|35.45|17|3|hg
18|Ar|อาร์กอน|39.95|18|3|ng
19|K|โพแทสเซียม|39.098|1|4|al
20|Ca|แคลเซียม|40.078|2|4|ae
21|Sc|สแกนเดียม|44.956|3|4|tm
22|Ti|ไทเทเนียม|47.867|4|4|tm
23|V|วาเนเดียม|50.942|5|4|tm
24|Cr|โครเมียม|51.996|6|4|tm
25|Mn|แมงกานีส|54.938|7|4|tm
26|Fe|เหล็ก|55.845|8|4|tm
27|Co|โคบอลต์|58.933|9|4|tm
28|Ni|นิกเกิล|58.693|10|4|tm
29|Cu|ทองแดง|63.546|11|4|tm
30|Zn|สังกะสี|65.38|12|4|tm
31|Ga|แกลเลียม|69.723|13|4|pt
32|Ge|เจอร์เมเนียม|72.63|14|4|md
33|As|อาร์เซนิก|74.922|15|4|md
34|Se|ซีลีเนียม|78.971|16|4|nm
35|Br|โบรมีน|79.904|17|4|hg
36|Kr|คริปทอน|83.798|18|4|ng
37|Rb|รูบิเดียม|85.468|1|5|al
38|Sr|สตรอนเชียม|87.62|2|5|ae
39|Y|อิตเทรียม|88.906|3|5|tm
40|Zr|เซอร์โคเนียม|91.224|4|5|tm
41|Nb|ไนโอเบียม|92.906|5|5|tm
42|Mo|โมลิบดีนัม|95.95|6|5|tm
43|Tc|เทคนีเชียม|98|7|5|tm
44|Ru|รูทีเนียม|101.07|8|5|tm
45|Rh|โรเดียม|102.91|9|5|tm
46|Pd|แพลเลเดียม|106.42|10|5|tm
47|Ag|เงิน|107.87|11|5|tm
48|Cd|แคดเมียม|112.41|12|5|tm
49|In|อินเดียม|114.82|13|5|pt
50|Sn|ดีบุก|118.71|14|5|pt
51|Sb|พลวง|121.76|15|5|md
52|Te|เทลลูเรียม|127.60|16|5|md
53|I|ไอโอดีน|126.90|17|5|hg
54|Xe|ซีนอน|131.29|18|5|ng
55|Cs|ซีเซียม|132.91|1|6|al
56|Ba|แบเรียม|137.33|2|6|ae
57|La|แลนทานัม|138.91|3|9|ln
58|Ce|ซีเรียม|140.12|4|9|ln
59|Pr|พราซีโอดีเมียม|140.91|5|9|ln
60|Nd|นีโอดีเมียม|144.24|6|9|ln
61|Pm|โพรมีเทียม|145|7|9|ln
62|Sm|ซามาเรียม|150.36|8|9|ln
63|Eu|ยูโรเปียม|151.96|9|9|ln
64|Gd|แกโดลิเนียม|157.25|10|9|ln
65|Tb|เทอร์เบียม|158.93|11|9|ln
66|Dy|ดิสโพรเซียม|162.50|12|9|ln
67|Ho|โฮลเมียม|164.93|13|9|ln
68|Er|เออร์เบียม|167.26|14|9|ln
69|Tm|ทูเลียม|168.93|15|9|ln
70|Yb|อิตเทอร์เบียม|173.05|16|9|ln
71|Lu|ลูทีเทียม|174.97|17|9|ln
72|Hf|แฮฟเนียม|178.49|4|6|tm
73|Ta|แทนทาลัม|180.95|5|6|tm
74|W|ทังสเตน|183.84|6|6|tm
75|Re|เรเนียม|186.21|7|6|tm
76|Os|ออสเมียม|190.23|8|6|tm
77|Ir|อิริเดียม|192.22|9|6|tm
78|Pt|แพลทินัม|195.08|10|6|tm
79|Au|ทองคำ|196.97|11|6|tm
80|Hg|ปรอท|200.59|12|6|tm
81|Tl|แทลเลียม|204.38|13|6|pt
82|Pb|ตะกั่ว|207.2|14|6|pt
83|Bi|บิสมัท|208.98|15|6|pt
84|Po|โพโลเนียม|209|16|6|pt
85|At|แอสทาทีน|210|17|6|hg
86|Rn|เรดอน|222|18|6|ng
87|Fr|แฟรนเซียม|223|1|7|al
88|Ra|เรเดียม|226|2|7|ae
89|Ac|แอกทิเนียม|227|3|10|an
90|Th|ทอเรียม|232.04|4|10|an
91|Pa|โพรแทกทิเนียม|231.04|5|10|an
92|U|ยูเรเนียม|238.03|6|10|an
93|Np|เนปทูเนียม|237|7|10|an
94|Pu|พลูโทเนียม|244|8|10|an
95|Am|อะเมริเซียม|243|9|10|an
96|Cm|คูเรียม|247|10|10|an
97|Bk|เบอร์เกลเลียม|247|11|10|an
98|Cf|แคลิฟอร์เนียม|251|12|10|an
99|Es|ไอน์สไตเนียม|252|13|10|an
100|Fm|เฟอร์เมียม|257|14|10|an
101|Md|เมนเดลีเวียม|258|15|10|an
102|No|โนเบลเลียม|259|16|10|an
103|Lr|ลอว์เรนเซียม|266|17|10|an
104|Rf|รัทเทอร์ฟอร์เดียม|267|4|7|tm
105|Db|ดุบเนียม|268|5|7|tm
106|Sg|ซีบอร์เกียม|269|6|7|tm
107|Bh|โบเรียม|270|7|7|tm
108|Hs|ฮัสเซียม|277|8|7|tm
109|Mt|ไมต์เนเรียม|278|9|7|tm
110|Ds|ดาร์มสเตเดียม|281|10|7|tm
111|Rg|เรนต์เกเนียม|282|11|7|tm
112|Cn|คอเปอร์นิเซียม|285|12|7|tm
113|Nh|นิฮอเนียม|286|13|7|pt
114|Fl|เฟลเรอเวียม|289|14|7|pt
115|Mc|มอสโคเวียม|290|15|7|pt
116|Lv|ลิเวอร์มอเรียม|293|16|7|pt
117|Ts|เทนเนสซีน|294|17|7|hg
118|Og|โอกาเนสซอน|294|18|7|ng`;

export interface Element {
  z: number;
  sym: string;
  name: string;
  mass: string;
  group: number;
  period: number;
  cat: string;
}

export const elements: Element[] = RAW.split("\n").map((line) => {
  const [z, sym, name, mass, group, period, cat] = line.trim().split("|");
  return {
    z: +z,
    sym,
    name,
    mass,
    group: +group,
    period: +period,
    cat,
  };
});

const CAT: Record<string, { label: string; color: string }> = {
  al: { label: "โลหะแอลคาไล", color: "#ef476f" },
  ae: { label: "แอลคาไลน์เอิร์ท", color: "#f78c6b" },
  tm: { label: "ธาตุแทรนซิชัน", color: "#ffd166" },
  pt: { label: "โลหะหลังแทรนซิชัน", color: "#a78bfa" },
  md: { label: "ธาตุกึ่งโลหะ", color: "#4cc9f0" },
  nm: { label: "อโลหะ", color: "#06d6a0" },
  hg: { label: "แฮโลเจน", color: "#5eead4" },
  ng: { label: "แก๊สมีสกุล", color: "#b07cff" },
  ln: { label: "แลนทาไนด์", color: "#f472b6" },
  an: { label: "แอกทิไนด์", color: "#fb7185" },
};

export function PeriodicTable({ onClose }: { onClose: () => void }) {
  const [sel, setSel] = useState<Element | null>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/85 p-3 backdrop-blur-sm sm:p-6">
      <div className="card crt-lines my-auto w-full max-w-6xl bg-[#0d1226] p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-px text-[12px] text-[#ffd166] sm:text-[14px]">
              📖 PORTABLE PERIODIC TABLE
            </h2>
            <p className="mt-1 font-tech text-[11px] text-white/50">
              คลิกธาตุเพื่อดูรายละเอียด — ใช้ประกอบการทำโจทย์บอสได้ตลอดเวลา
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-arcade px-3 py-2 font-px text-[8px]"
            style={{ ["--c" as string]: "#f472b6" }}
          >
            ✕ ปิด
          </button>
        </div>

        <div className="mb-4 flex flex-wrap gap-1.5">
          {Object.entries(CAT).map(([k, v]) => (
            <span
              key={k}
              className="flex items-center gap-1.5 border-2 border-[#0b0f1e] bg-[#111838] px-1.5 py-0.5 font-tech text-[10px] text-white/70"
            >
              <i className="inline-block h-2.5 w-2.5 border border-[#0b0f1e]" style={{ background: v.color }} />
              {v.label}
            </span>
          ))}
        </div>

        <div className="overflow-x-auto pb-2">
          <div
            className="grid min-w-[820px] gap-[3px]"
            style={{
              gridTemplateColumns: "repeat(18, minmax(0,1fr))",
              gridTemplateRows: "repeat(10, minmax(0,1fr))",
            }}
          >
            {/* ช่องว่างแทนแลนทาไนด์/แอกทิไนด์ */}
            <div
              className="flex flex-col items-center justify-center border-2 border-dashed border-white/20 bg-[#111838] px-1 py-2 font-px text-[7px] text-white/45"
              style={{ gridColumn: 3, gridRow: 6 }}
            >
              57-71
            </div>
            <div
              className="flex flex-col items-center justify-center border-2 border-dashed border-white/20 bg-[#111838] px-1 py-2 font-px text-[7px] text-white/45"
              style={{ gridColumn: 3, gridRow: 7 }}
            >
              89-103
            </div>

            {elements.map((e) => {
              const info = CAT[e.cat];
              const active = sel?.z === e.z;
              return (
                <button
                  key={e.z}
                  type="button"
                  onClick={() => setSel(e)}
                  className={cn(
                    "group relative border-2 border-[#0b0f1e] px-0.5 py-1 text-center transition hover:z-10 hover:scale-110",
                    active && "z-20 scale-110 ring-2 ring-white",
                  )}
                  style={{
                    gridColumn: e.group,
                    gridRow: e.period,
                    backgroundColor: info.color,
                  }}
                  title={`${e.name} (${e.sym})`}
                >
                  <div className="font-px text-[6px] text-[#0b0f1e]/70">{e.z}</div>
                  <div className="font-px text-[10px] text-[#0b0f1e]">{e.sym}</div>
                  <div className="hidden font-tech text-[8px] text-[#0b0f1e]/80 sm:block">
                    {e.mass}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {sel && (
          <div
            className="popin mt-4 border-[3px] border-[#0b0f1e] p-4"
            style={{ backgroundColor: CAT[sel.cat].color + "22" }}
          >
            <div className="flex flex-wrap items-center gap-4">
              <div
                className="flex h-20 w-20 flex-col items-center justify-center border-[3px] border-[#0b0f1e]"
                style={{ backgroundColor: CAT[sel.cat].color }}
              >
                <span className="font-px text-[8px] text-[#0b0f1e]/70">{sel.z}</span>
                <span className="font-px text-[16px] text-[#0b0f1e]">{sel.sym}</span>
              </div>
              <div>
                <h3 className="font-px text-[13px] text-white">{sel.name}</h3>
                <p className="mt-2 font-tech text-[12px] text-white/70">
                  เลขอะตอม (Z) = <b className="text-[#ffd166]">{sel.z}</b> • มวลอะตอม ={" "}
                  <b className="text-[#ffd166]">{sel.mass} u</b> • หมู่{" "}
                  <b className="text-[#4cc9f0]">{sel.group}</b> • คาบ{" "}
                  <b className="text-[#4cc9f0]">{sel.period}</b>
                </p>
                <p className="mt-1 font-tech text-[12px] text-white/70">
                  หมวด: <b style={{ color: CAT[sel.cat].color }}>{CAT[sel.cat].label}</b> •
                  นิวตรอนโดยประมาณ = <b className="text-[#06d6a0]">{Math.round(+sel.mass) - sel.z}</b>
                </p>
                <p className="mt-2 font-tech text-[11px] text-white/45">
                  💡 ทริค: หมู่ธาตุหลัก (s,p-block) = จำนวนเวเลนซ์อิเล็กตรอน | คาบ = เลข n ชั้นนอกสุด
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
