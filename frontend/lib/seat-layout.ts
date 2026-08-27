import type { SpaceSeat } from "@/lib/types";

const SEAT_SIZE = 28;
const EDGE_GAP = 4;

export type SeatLayoutMode =
  | "left"
  | "right"
  | "top"
  | "bottom"
  | "left-right"
  | "top-bottom"
  | "around";

export const SEAT_LAYOUT_OPTIONS: {
  mode: SeatLayoutMode;
  label: string;
  hint: string;
}[] = [
  { mode: "left", label: "Gauche", hint: "Toutes à gauche" },
  { mode: "right", label: "Droite", hint: "Toutes à droite" },
  { mode: "top", label: "Haut", hint: "Toutes en haut" },
  { mode: "bottom", label: "Bas", hint: "Toutes en bas" },
  { mode: "left-right", label: "Gauche / Droite", hint: "Moitié chaque côté" },
  { mode: "top-bottom", label: "Haut / Bas", hint: "Moitié haut et bas" },
  { mode: "around", label: "Tout autour", hint: "Réparti sur 4 côtés" },
];

type Pos = { id: string; offsetX: number; offsetY: number };

function evenly(count: number, length: number, seatSize = SEAT_SIZE) {
  if (count <= 0) return [];
  if (count === 1) return [length / 2 - seatSize / 2];
  const pad = EDGE_GAP;
  const span = Math.max(length - seatSize - pad * 2, 0);
  return Array.from({ length: count }, (_, i) => pad + (span * i) / (count - 1));
}

function splitEven<T>(items: T[], parts: number): T[][] {
  const n = Math.max(1, parts);
  const buckets: T[][] = Array.from({ length: n }, () => []);
  items.forEach((item, i) => buckets[i % n].push(item));
  // Prefer contiguous halves for 2 sides
  if (n === 2) {
    const mid = Math.ceil(items.length / 2);
    return [items.slice(0, mid), items.slice(mid)];
  }
  if (n === 4) {
    const q = Math.ceil(items.length / 4);
    return [
      items.slice(0, q),
      items.slice(q, q * 2),
      items.slice(q * 2, q * 3),
      items.slice(q * 3),
    ];
  }
  return buckets;
}

/**
 * Place seats evenly around a table according to mode.
 */
export function layoutSeatsOnTable(
  seats: Pick<SpaceSeat, "id">[],
  width: number,
  height: number,
  mode: SeatLayoutMode
): Pos[] {
  if (!seats.length) return [];

  const w = Math.max(width, SEAT_SIZE);
  const h = Math.max(height, SEAT_SIZE);
  const leftX = -SEAT_SIZE - EDGE_GAP;
  const rightX = w + EDGE_GAP;
  const topY = -SEAT_SIZE - EDGE_GAP;
  const bottomY = h + EDGE_GAP;

  const alongLeft = (list: typeof seats): Pos[] => {
    const ys = evenly(list.length, h);
    return list.map((s, i) => ({ id: s.id, offsetX: leftX, offsetY: ys[i] }));
  };
  const alongRight = (list: typeof seats): Pos[] => {
    const ys = evenly(list.length, h);
    return list.map((s, i) => ({ id: s.id, offsetX: rightX, offsetY: ys[i] }));
  };
  const alongTop = (list: typeof seats): Pos[] => {
    const xs = evenly(list.length, w);
    return list.map((s, i) => ({ id: s.id, offsetX: xs[i], offsetY: topY }));
  };
  const alongBottom = (list: typeof seats): Pos[] => {
    const xs = evenly(list.length, w);
    return list.map((s, i) => ({
      id: s.id,
      offsetX: xs[i],
      offsetY: bottomY,
    }));
  };

  switch (mode) {
    case "left":
      return alongLeft(seats);
    case "right":
      return alongRight(seats);
    case "top":
      return alongTop(seats);
    case "bottom":
      return alongBottom(seats);
    case "left-right": {
      const [L, R] = splitEven(seats, 2);
      return [...alongLeft(L), ...alongRight(R)];
    }
    case "top-bottom": {
      const [T, B] = splitEven(seats, 2);
      return [...alongTop(T), ...alongBottom(B)];
    }
    case "around": {
      const [T, R, B, L] = splitEven(seats, 4);
      return [
        ...alongTop(T),
        ...alongRight(R),
        ...alongBottom(B),
        ...alongLeft(L),
      ];
    }
    default:
      return alongLeft(seats);
  }
}

/** @deprecated use layoutSeatsOnTable(..., "left-right") */
export function layoutSeatsLeftRight(
  seats: Pick<SpaceSeat, "id">[],
  width: number,
  height: number
) {
  return layoutSeatsOnTable(seats, width, height, "left-right");
}
