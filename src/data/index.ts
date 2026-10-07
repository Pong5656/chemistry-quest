import type { Chapter } from "../types";
import { ch1 } from "./ch01";
import { ch2 } from "./ch02";
import { ch3 } from "./ch03";
import { ch4 } from "./ch04";
import { ch5 } from "./ch05";
import { ch6 } from "./ch06";
import { ch7 } from "./ch07";
import { ch8 } from "./ch08";
import { ch9 } from "./ch09";
import { ch10 } from "./ch10";
import { ch11 } from "./ch11";
import { ch12 } from "./ch12";
import { ch13 } from "./ch13";
import { ch14 } from "./ch14";

export const chapters: Chapter[] = [
  ch1, ch2, ch3, ch4, ch5, ch6, ch7, ch8, ch9, ch10, ch11, ch12, ch13, ch14,
];

export const volumes: { name: string; range: [number, number] }[] = [
  { name: "ม.4 เล่ม 1", range: [1, 3] },
  { name: "ม.4 เล่ม 2", range: [4, 6] },
  { name: "ม.5 เล่ม 1", range: [7, 9] },
  { name: "ม.5 เล่ม 2", range: [10, 11] },
  { name: "ม.6 เล่ม 1", range: [12, 13] },
  { name: "ม.6 เล่ม 2", range: [14, 14] },
];

export function getChapter(id: number): Chapter {
  return chapters.find((c) => c.id === id) ?? chapters[0];
}
