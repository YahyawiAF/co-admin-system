import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Logo } from "../components/Logo";
import { color, fontFamily } from "../theme";

export const INTRO_FRAMES = 100;

export const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 12, mass: 0.7 } });
  const words = ["How", "to", "check", "in"];
  const sub = spring({ frame: frame - 34, fps, config: { damping: 200 } });
  const pill = spring({ frame: frame - 46, fps, config: { damping: 14 } });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", fontFamily }}>
      <div style={{ transform: `scale(${0.6 + pop * 0.4})`, opacity: Math.min(1, pop * 1.4) }}>
        <Logo size={92} />
      </div>
      <div style={{ marginTop: 70, display: "flex", gap: 26, fontSize: 132, fontWeight: 800, color: color.white, letterSpacing: -4 }}>
        {words.map((w, i) => {
          const s = spring({ frame: frame - 12 - i * 5, fps, config: { damping: 200, mass: 0.6 } });
          return (
            <span key={w} style={{ display: "inline-block", opacity: s, transform: `translateY(${(1 - s) * 60}px)` }}>
              {w}
            </span>
          );
        })}
      </div>
      <div style={{ marginTop: 22, fontSize: 44, fontWeight: 500, color: color.muted, opacity: sub, transform: `translateY(${(1 - sub) * 20}px)` }}>
        with the visitor app
      </div>
      <div
        style={{
          marginTop: 64,
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "18px 34px",
          borderRadius: 999,
          background: "rgba(255,255,255,0.12)",
          border: "1.5px solid rgba(255,255,255,0.25)",
          color: color.white,
          fontSize: 34,
          fontWeight: 700,
          opacity: pill,
          transform: `scale(${interpolate(pill, [0, 1], [0.8, 1])})`,
        }}
      >
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#a5b4fc" strokeWidth="2.4" strokeLinecap="round">
          <circle cx="12" cy="13" r="8" />
          <path d="M12 9v4l2.5 2M9 2h6" />
        </svg>
        Takes about 10 seconds
      </div>
    </AbsoluteFill>
  );
};
