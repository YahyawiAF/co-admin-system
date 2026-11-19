"use client";

import { useId, type ReactNode } from "react";

export type CompanionKind = "kodi" | "lingo" | "mathou";
export type CompanionMood = "idle" | "happy" | "wow" | "sad" | "sleep";

/** The three starters: each one evolves twice during the survey. */
export const COMPANIONS: Record<CompanionKind, { names: [string, string, string]; type: string; a: string; b: string; tip: string; cheek: string }> = {
  kodi: { names: ["Kodi", "Kodix", "Kodimax"], type: "Code", a: "#818cf8", b: "#6d28d9", tip: "#fbbf24", cheek: "#f9a8d4" },
  lingo: { names: ["Lingo", "Linguo", "Lingozor"], type: "Langues", a: "#5eead4", b: "#0e7490", tip: "#f472b6", cheek: "#fda4af" },
  mathou: { names: ["Mathou", "Mathor", "Mathozaure"], type: "Maths", a: "#fcd34d", b: "#ea580c", tip: "#4f46e5", cheek: "#fb7185" },
};
export const COMPANION_KINDS = Object.keys(COMPANIONS) as CompanionKind[];

const INK = "#0f172a";
const OUT = { stroke: INK, strokeWidth: 2.5, strokeLinejoin: "round" as const };
const STAR = (x: number, y: number) => `M${x} ${y}l2.6 5.4 6 .8-4.4 4.1 1.1 5.9-5.3-2.9-5.3 2.9 1.1-5.9-4.4-4.1 6-.8z`;

/** Original pocket creature drawn in SVG: kind (look), stage 0–2 (evolution), mood (face). */
export function Companion({ kind, stage, mood = "idle", className }: { kind: CompanionKind; stage: number; mood?: CompanionMood; className?: string }) {
  const P = COMPANIONS[kind];
  const g = `cg${useId().replace(/:/g, "")}`;
  const fill = `url(#${g})`;
  const s = Math.max(0, Math.min(2, stage));
  const scale = [0.8, 0.92, 1][s];

  const eye = (x: number, dy = 0) => (
    <g className="sg-blink" key={x}>
      <ellipse cx={x} cy={66} rx={7} ry={8.5} fill="#fff" {...OUT} />
      <ellipse cx={x + 1} cy={67 + dy} rx={4} ry={5} fill={INK} />
      <circle cx={x + 2.6} cy={64.5 + dy} r={1.7} fill="#fff" />
    </g>
  );

  let face: ReactNode;
  let arms: ReactNode = (
    <>
      <ellipse cx={30} cy={80} rx={6} ry={9} transform="rotate(20 30 80)" fill={fill} {...OUT} />
      <ellipse cx={90} cy={80} rx={6} ry={9} transform="rotate(-20 90 80)" fill={fill} {...OUT} />
    </>
  );
  if (mood === "happy") {
    face = (
      <>
        <path d="M41 68 q7 -10 14 0 M65 68 q7 -10 14 0" fill="none" stroke={INK} strokeWidth={3.2} strokeLinecap="round" />
        <path d="M52 76 q8 12 16 0 z" fill={INK} />
        <ellipse cx={60} cy={81} rx={4} ry={2.4} fill="#fb7185" />
      </>
    );
    arms = (
      <>
        <ellipse cx={27} cy={62} rx={6} ry={10} transform="rotate(-35 27 62)" fill={fill} {...OUT} />
        <ellipse cx={93} cy={62} rx={6} ry={10} transform="rotate(35 93 62)" fill={fill} {...OUT} />
      </>
    );
  } else if (mood === "wow") {
    face = (
      <>
        <path d={STAR(48, 58)} fill={P.tip} {...OUT} strokeWidth={1.6} />
        <path d={STAR(72, 58)} fill={P.tip} {...OUT} strokeWidth={1.6} />
        <ellipse cx={60} cy={79} rx={4} ry={5} fill={INK} />
      </>
    );
  } else if (mood === "sad") {
    face = (
      <>
        {eye(48, 2)}
        {eye(72, 2)}
        <path d="M40 56 l10 3 M80 56 l-10 3" stroke={INK} strokeWidth={2.5} strokeLinecap="round" />
        <path d="M53 80 q3.5 -4 7 0 q3.5 4 7 0" fill="none" stroke={INK} strokeWidth={2.5} strokeLinecap="round" />
        <path d="M90 44 q-6 10 0 12 q6 -2 0 -12z" fill="#7dd3fc" {...OUT} strokeWidth={1.8} />
      </>
    );
  } else if (mood === "sleep") {
    face = (
      <>
        <path d="M42 67 q6 4 12 0 M66 67 q6 4 12 0" fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" />
        <ellipse cx={60} cy={79} rx={3} ry={2.4} fill={INK} />
        <text className="sg-zz" x={92} y={40} fontSize={18} fill="#4f46e5">z</text>
        <text className="sg-zz" x={102} y={26} fontSize={24} fill="#4f46e5" style={{ animationDelay: ".4s" }}>Z</text>
      </>
    );
  } else {
    face = (
      <>
        {eye(48)}
        {eye(72)}
        <path d="M54 77 q6 6 12 0" fill="none" stroke={INK} strokeWidth={2.5} strokeLinecap="round" />
      </>
    );
  }

  return (
    <svg viewBox="0 0 120 112" aria-hidden className={className} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id={g} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={P.a} />
          <stop offset="1" stopColor={P.b} />
        </linearGradient>
      </defs>
      <ellipse cx={60} cy={106} rx={30} ry={4} fill={INK} opacity={0.12} />
      <g transform={`translate(60 104) scale(${scale}) translate(-60 -104)`}>
        {s === 2 ? (
          <g className="sg-aura">
            <circle cx={60} cy={66} r={52} fill={P.tip} opacity={0.16} />
            <path d="M60 8l3 8 8 3-8 3-3 8-3-8-8-3 8-3z M108 60l2 5 5 2-5 2-2 5-2-5-5-2 5-2z M14 76l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill={P.tip} {...OUT} strokeWidth={1.5} />
          </g>
        ) : null}
        {s >= 1 ? (
          <>
            <path d={s === 2 ? "M34 62 C0 30 -6 86 30 90 Z" : "M34 66 C12 50 8 80 30 86 Z"} fill={P.tip} {...OUT} />
            <path d={s === 2 ? "M86 62 C120 30 126 86 90 90 Z" : "M86 66 C108 50 112 80 90 86 Z"} fill={P.tip} {...OUT} />
          </>
        ) : null}
        <path d="M84 90 C104 94 112 76 102 62" fill="none" stroke={INK} strokeWidth={9} strokeLinecap="round" />
        <path d="M84 90 C104 94 112 76 102 62" fill="none" stroke={fill} strokeWidth={5} strokeLinecap="round" />
        <path d="M102 50l3.5 7.5 8 1-6 5.5 1.5 8-7-4-7 4 1.5-8-6-5.5 8-1z" fill={P.tip} {...OUT} strokeWidth={2} />

        {kind === "kodi" ? (
          <>
            <path d="M42 50 L32 16 L58 42 Z" fill={fill} {...OUT} />
            <path d="M78 50 L88 16 L62 42 Z" fill={fill} {...OUT} />
            <path d="M35 26 L32 16 L41 23 Z M85 26 L88 16 L79 23 Z" fill={P.tip} />
          </>
        ) : kind === "lingo" ? (
          <>
            <circle cx={38} cy={44} r={13} fill={fill} {...OUT} />
            <circle cx={82} cy={44} r={13} fill={fill} {...OUT} />
            <circle cx={38} cy={44} r={6} fill={P.tip} />
            <circle cx={82} cy={44} r={6} fill={P.tip} />
          </>
        ) : (
          <>
            <path d="M40 50 L40 18 L60 42 Z" fill={fill} {...OUT} />
            <path d="M80 50 L80 18 L60 42 Z" fill={fill} {...OUT} />
            <path d="M40 28 V18 L48 27 Z M80 28 V18 L72 27 Z" fill={P.tip} />
          </>
        )}

        <ellipse cx={46} cy={100} rx={10} ry={5.5} fill={fill} {...OUT} />
        <ellipse cx={74} cy={100} rx={10} ry={5.5} fill={fill} {...OUT} />
        <ellipse cx={60} cy={70} rx={33} ry={31} fill={fill} {...OUT} />
        <ellipse cx={60} cy={83} rx={19} ry={14} fill="#fff7ed" opacity={0.9} />
        {arms}
        <ellipse cx={38} cy={76} rx={5} ry={3} fill={P.cheek} />
        <ellipse cx={82} cy={76} rx={5} ry={3} fill={P.cheek} />
        {face}

        {kind === "kodi" ? (
          <>
            <path d="M60 41 V28" stroke={INK} strokeWidth={2.5} />
            <rect className="sg-ant" x={55} y={19} width={10} height={10} rx={2} fill={P.tip} {...OUT} strokeWidth={2} />
          </>
        ) : kind === "lingo" ? (
          <g transform="translate(84 6)">
            <rect width={30} height={18} rx={7} fill="#fff" {...OUT} strokeWidth={2} />
            <path d="M6 17 L4 24 L12 17" fill="#fff" {...OUT} strokeWidth={2} />
            <text x={15} y={13} textAnchor="middle" fontSize={11} fontWeight={800} fill={INK}>
              {["Hi!", "Salut", "Hola"][s]}
            </text>
          </g>
        ) : (
          <text x={60} y={58} textAnchor="middle" fontSize={12} fontWeight={800} fill={INK} opacity={0.55}>
            π
          </text>
        )}
        {s === 2 ? <path d="M46 40 L49 28 L55 36 L60 24 L65 36 L71 28 L74 40 Z" fill={P.tip} {...OUT} strokeWidth={2} /> : null}
      </g>
    </svg>
  );
}
