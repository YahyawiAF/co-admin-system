import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { Caption } from "../captions";
import { color, fontFamily } from "../theme";

/** One caption block. `from` = frame it appears; `until` = frame it starts fading out. */
export const CaptionBlock: React.FC<{ caption: Caption; from: number; until?: number }> = ({ caption, from, until }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: frame - from, fps, config: { damping: 200, mass: 0.6 } });
  const exit = until === undefined ? 0 : interpolate(frame, [until, until + 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const subIn = spring({ frame: frame - from - 5, fps, config: { damping: 200, mass: 0.6 } });
  return (
    <div
      style={{
        position: "absolute",
        left: 72,
        right: 72,
        top: 0,
        opacity: enter * (1 - exit),
        transform: `translateY(${(1 - enter) * 34 - exit * 24}px)`,
        fontFamily,
      }}
    >
      <div
        style={{
          display: "inline-block",
          padding: "8px 22px",
          borderRadius: 999,
          background: "rgba(255,255,255,0.12)",
          border: "1.5px solid rgba(255,255,255,0.22)",
          color: color.indigoSoft,
          fontSize: 26,
          fontWeight: 700,
          letterSpacing: 2.5,
          textTransform: "uppercase",
        }}
      >
        {caption.chip}
      </div>
      <div style={{ marginTop: 20, color: color.white, fontSize: 64, fontWeight: 800, lineHeight: 1.08, letterSpacing: -1.5 }}>
        {caption.title}
      </div>
      <div
        style={{
          marginTop: 16,
          color: color.muted,
          fontSize: 34,
          fontWeight: 500,
          lineHeight: 1.3,
          opacity: subIn,
          transform: `translateY(${(1 - subIn) * 16}px)`,
        }}
      >
        {caption.sub}
      </div>
    </div>
  );
};
