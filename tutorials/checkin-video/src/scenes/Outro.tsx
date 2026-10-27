import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Logo } from "../components/Logo";
import { color, fontFamily } from "../theme";

export const OUTRO_FRAMES = 180;

const ROWS = [
  { n: "1", title: "Scan the QR at the entrance", sub: "The app opens in your browser" },
  { n: "2", title: "Type your phone number", sub: "Plus your name the first time" },
  { n: "3", title: "You're checked in", sub: "Auto rate, or fix a pass if you prefer" },
];

export const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const head = spring({ frame, fps, config: { damping: 12, mass: 0.7 } });
  const tip = spring({ frame: frame - 54, fps, config: { damping: 200 } });
  const logo = spring({ frame: frame - 70, fps, config: { damping: 200 } });
  return (
    <AbsoluteFill style={{ fontFamily, padding: "0 80px", justifyContent: "center" }}>
      <div style={{ fontSize: 112, fontWeight: 800, color: color.white, letterSpacing: -3, transform: `scale(${0.7 + head * 0.3})`, transformOrigin: "left center", opacity: Math.min(1, head * 1.5) }}>
        That's it!
      </div>
      <div style={{ marginTop: 64, display: "flex", flexDirection: "column", gap: 28 }}>
        {ROWS.map((r, i) => {
          const s = spring({ frame: frame - 14 - i * 9, fps, config: { damping: 200, mass: 0.7 } });
          return (
            <div
              key={r.n}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 32,
                padding: "30px 36px",
                borderRadius: 36,
                background: "rgba(255,255,255,0.1)",
                border: "1.5px solid rgba(255,255,255,0.18)",
                opacity: s,
                transform: `translateX(${(1 - s) * 80}px)`,
              }}
            >
              <div style={{ width: 84, height: 84, flexShrink: 0, borderRadius: 26, background: `linear-gradient(135deg, ${color.indigo}, ${color.violet})`, color: color.white, fontSize: 44, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {r.n}
              </div>
              <div>
                <div style={{ fontSize: 42, fontWeight: 800, color: color.white, letterSpacing: -0.5 }}>{r.title}</div>
                <div style={{ marginTop: 6, fontSize: 30, fontWeight: 500, color: color.muted }}>{r.sub}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 52, display: "flex", alignItems: "center", gap: 18, fontSize: 34, fontWeight: 600, color: color.indigoSoft, opacity: tip, transform: `translateY(${(1 - tip) * 20}px)` }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#a5b4fc" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M13 2L4 14h7l-1 8 9-12h-7z" />
        </svg>
        Next time: one tap on “Pointer mon arrivée”
      </div>
      <div style={{ position: "absolute", bottom: 130, left: 0, right: 0, display: "flex", justifyContent: "center", opacity: logo }}>
        <Logo size={72} />
      </div>
    </AbsoluteFill>
  );
};
