import { AbsoluteFill, useCurrentFrame } from "remotion";
import { color } from "../theme";

/** Deep indigo gradient with slowly drifting glows. */
export const Background: React.FC = () => {
  const f = useCurrentFrame();
  const blob = (x: number, y: number, size: number, hue: string, speed: number, phase: number) => (
    <div
      style={{
        position: "absolute",
        left: x + Math.sin(f * speed + phase) * 60,
        top: y + Math.cos(f * speed * 0.8 + phase) * 50,
        width: size,
        height: size,
        borderRadius: "50%",
        background: hue,
        filter: "blur(120px)",
        opacity: 0.55,
      }}
    />
  );
  return (
    <AbsoluteFill
      style={{ background: `linear-gradient(165deg, ${color.bgTop} 0%, ${color.bgMid} 48%, ${color.bgBottom} 100%)`, overflow: "hidden" }}
    >
      {blob(-200, 120, 700, "#4f46e5", 0.012, 0)}
      {blob(560, 900, 760, "#7c3aed", 0.01, 2)}
      {blob(100, 1500, 600, "#2563eb", 0.014, 4)}
      <AbsoluteFill
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.07) 1.5px, transparent 1.5px)",
          backgroundSize: "36px 36px",
          maskImage: "linear-gradient(180deg, transparent, black 30%, black 70%, transparent)",
        }}
      />
    </AbsoluteFill>
  );
};
