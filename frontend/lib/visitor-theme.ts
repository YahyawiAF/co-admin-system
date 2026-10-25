"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Visitor app themes ("Mon thème"). Every `indigo-*` / `violet-*` class in the app reads
 * CSS variables (tailwind.config.ts), so a theme only swaps these RGB triplets.
 * Adding a theme = adding an entry here; nothing else to touch.
 */
type Scale = Record<
  50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950,
  string
>;

export type VisitorThemeId =
  | "indigo"
  | "ocean"
  | "menthe"
  | "sunset"
  | "sakura"
  | "violet";

/** What a locked theme needs (checked against the member's points snapshot). */
export type ThemeLock =
  | { kind: "level"; level: "habitue" | "pilier" | "legende"; label: string }
  | { kind: "trophy"; trophyId: string; label: string };

export type VisitorTheme = {
  id: VisitorThemeId;
  name: string;
  primary: Scale;
  secondary: Scale;
  /** Page background behind the cards */
  bg: string;
  lock?: ThemeLock;
};

const INDIGO: Scale = { 50: "238 242 255", 100: "224 231 255", 200: "199 210 254", 300: "165 180 252", 400: "129 140 248", 500: "99 102 241", 600: "79 70 229", 700: "67 56 202", 800: "55 48 163", 900: "49 46 129", 950: "30 27 75" };
const VIOLET: Scale = { 50: "245 243 255", 100: "237 233 254", 200: "221 214 254", 300: "196 181 253", 400: "167 139 250", 500: "139 92 246", 600: "124 58 237", 700: "109 40 217", 800: "91 33 182", 900: "76 29 149", 950: "46 16 101" };
/* 600 = Collabora blue #1976d2 */
const OCEAN: Scale = { 50: "239 246 255", 100: "219 234 254", 200: "191 219 254", 300: "147 197 253", 400: "96 165 250", 500: "59 130 246", 600: "25 118 210", 700: "21 101 192", 800: "30 64 175", 900: "30 58 138", 950: "23 37 84" };
const SKY: Scale = { 50: "240 249 255", 100: "224 242 254", 200: "186 230 253", 300: "125 211 252", 400: "56 189 248", 500: "14 165 233", 600: "2 132 199", 700: "3 105 161", 800: "7 89 133", 900: "12 74 110", 950: "8 47 73" };
/* Darker steps on 600+ so white text stays readable (≥ 4.5:1) */
const TEAL: Scale = { 50: "240 253 250", 100: "204 251 241", 200: "153 246 228", 300: "94 234 212", 400: "45 212 191", 500: "20 184 166", 600: "15 118 110", 700: "17 94 89", 800: "19 78 74", 900: "19 78 74", 950: "4 47 46" };
const EMERALD: Scale = { 50: "236 253 245", 100: "209 250 229", 200: "167 243 208", 300: "110 231 183", 400: "52 211 153", 500: "16 185 129", 600: "4 120 87", 700: "6 95 70", 800: "6 78 59", 900: "6 78 59", 950: "2 44 34" };
const ORANGE: Scale = { 50: "255 247 237", 100: "255 237 213", 200: "254 215 170", 300: "253 186 116", 400: "251 146 60", 500: "249 115 22", 600: "194 65 12", 700: "154 52 18", 800: "124 45 18", 900: "67 20 7", 950: "67 20 7" };
const ROSE: Scale = { 50: "255 241 242", 100: "255 228 230", 200: "254 205 211", 300: "253 164 175", 400: "251 113 133", 500: "244 63 94", 600: "225 29 72", 700: "190 18 60", 800: "159 18 57", 900: "136 19 55", 950: "76 5 25" };
const PINK: Scale = { 50: "253 242 248", 100: "252 231 243", 200: "251 207 232", 300: "249 168 212", 400: "244 114 182", 500: "236 72 153", 600: "190 24 93", 700: "157 23 77", 800: "131 24 67", 900: "80 7 36", 950: "80 7 36" };
const PURPLE: Scale = { 50: "250 245 255", 100: "243 232 255", 200: "233 213 255", 300: "216 180 254", 400: "192 132 252", 500: "168 85 247", 600: "147 51 234", 700: "126 34 206", 800: "107 33 168", 900: "88 28 135", 950: "59 7 100" };
const FUCHSIA: Scale = { 50: "253 244 255", 100: "250 232 255", 200: "245 208 254", 300: "240 171 252", 400: "232 121 249", 500: "217 70 239", 600: "192 38 211", 700: "162 28 175", 800: "134 25 143", 900: "112 26 117", 950: "74 4 78" };

export const VISITOR_THEMES: VisitorTheme[] = [
  { id: "indigo", name: "Indigo", primary: INDIGO, secondary: VIOLET, bg: "#f3f6fb" },
  { id: "ocean", name: "Océan", primary: OCEAN, secondary: SKY, bg: "#eff6fc" },
  { id: "menthe", name: "Menthe", primary: TEAL, secondary: EMERALD, bg: "#effaf6" },
  {
    id: "sunset",
    name: "Sunset",
    primary: ORANGE,
    secondary: ROSE,
    bg: "#fff7f2",
    lock: { kind: "level", level: "habitue", label: "Niveau Habitué (10 sessions)" },
  },
  {
    id: "sakura",
    name: "Sakura",
    primary: PINK,
    secondary: PURPLE,
    bg: "#fdf2f8",
    lock: { kind: "trophy", trophyId: "cafe_5", label: "Trophée Habitué café (5 commandes)" },
  },
  {
    id: "violet",
    name: "Violet",
    primary: VIOLET,
    secondary: FUCHSIA,
    bg: "#f6f3ff",
    lock: { kind: "level", level: "pilier", label: "Niveau Pilier (50 sessions)" },
  },
];

const LEVEL_ORDER = ["nouveau", "habitue", "pilier", "legende"];

export function isThemeUnlocked(
  theme: VisitorTheme,
  player?: { level?: { id: string } | null; trophies?: { id: string; unlocked: boolean }[] } | null
) {
  const lock = theme.lock;
  if (!lock) return true;
  if (!player) return false;
  if (lock.kind === "level") {
    return LEVEL_ORDER.indexOf(player.level?.id ?? "nouveau") >= LEVEL_ORDER.indexOf(lock.level);
  }
  return !!player.trophies?.some((t) => t.id === lock.trophyId && t.unlocked);
}

export function themeById(id: string | null | undefined) {
  return VISITOR_THEMES.find((t) => t.id === id) ?? VISITOR_THEMES[0];
}

/** "79 70 229" → "243 75% 59%" (shadcn `--primary` is HSL without hsl()). */
function rgbTripletToHsl(triplet: string) {
  const [r, g, b] = triplet.split(" ").map((n) => Number(n) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h =
      max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/** CSS custom properties for a theme (set on <html> so portals/sheets follow too). */
export function themeCssVars(theme: VisitorTheme): Record<string, string> {
  const vars: Record<string, string> = {
    "--v-bg": theme.bg,
    // shadcn buttons / rings in the visitor app follow the theme too
    "--primary": rgbTripletToHsl(theme.primary[600]),
    "--ring": rgbTripletToHsl(theme.primary[600]),
  };
  for (const [k, v] of Object.entries(theme.primary)) vars[`--indigo-${k}`] = v;
  for (const [k, v] of Object.entries(theme.secondary)) vars[`--violet-${k}`] = v;
  return vars;
}

const storageKey = (org: string) => `visitor-theme:${org}`;
const EVENT = "visitor-theme-change";

function readStored(org: string): VisitorThemeId {
  try {
    return themeById(localStorage.getItem(storageKey(org))).id;
  } catch {
    return "indigo";
  }
}

/** Chosen theme for this org (saved on this device for now). */
export function useVisitorTheme(org: string) {
  const [id, setId] = useState<VisitorThemeId>("indigo");

  useEffect(() => {
    setId(readStored(org));
    const on = () => setId(readStored(org));
    window.addEventListener(EVENT, on);
    window.addEventListener("storage", on);
    return () => {
      window.removeEventListener(EVENT, on);
      window.removeEventListener("storage", on);
    };
  }, [org]);

  const choose = useCallback(
    (next: VisitorThemeId) => {
      try {
        localStorage.setItem(storageKey(org), next);
      } catch {
        /* private mode: theme lasts this visit only */
      }
      setId(next);
      window.dispatchEvent(new Event(EVENT));
    },
    [org]
  );

  return { theme: themeById(id), choose };
}

/** Applies the theme to <html> while the visitor app is mounted. */
export function useApplyVisitorTheme(org: string) {
  const { theme } = useVisitorTheme(org);
  useEffect(() => {
    const root = document.documentElement;
    const vars = themeCssVars(theme);
    for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
    root.dataset.visitorTheme = theme.id;
    return () => {
      for (const k of Object.keys(vars)) root.style.removeProperty(k);
      delete root.dataset.visitorTheme;
    };
  }, [theme]);
  return theme;
}
