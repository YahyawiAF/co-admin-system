import { loadFont } from "@remotion/google-fonts/PlusJakartaSans";

export const { fontFamily } = loadFont("normal", {
  weights: ["400", "500", "600", "700", "800"],
  subsets: ["latin", "latin-ext"],
});

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;
export const SPACE_NAME = "Collabora Hub";

export const color = {
  bgTop: "#1e1b4b",
  bgMid: "#312e81",
  bgBottom: "#4c1d95",
  indigo: "#6366f1",
  indigoSoft: "#c7d2fe",
  violet: "#8b5cf6",
  green: "#10b981",
  white: "#ffffff",
  muted: "rgba(224, 231, 255, 0.72)",
  faint: "rgba(224, 231, 255, 0.28)",
};
