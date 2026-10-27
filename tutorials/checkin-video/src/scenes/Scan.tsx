import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { CaptionBlock } from "../components/Caption";
import { ChapterBar } from "../components/ChapterBar";
import { FakeQr } from "../components/FakeQr";
import { Logo } from "../components/Logo";
import { SCAN_CAPTION } from "../captions";
import { color, fontFamily } from "../theme";

export const SCAN_FRAMES = 140;
/** Share of the first chapter bar filled by the end of this scene. */
export const SCAN_CHAPTER_SHARE = 0.3;

export const Scan: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const poster = spring({ frame: frame - 4, fps, config: { damping: 200, mass: 0.8 } });
  const finder = spring({ frame: frame - 26, fps, config: { damping: 14, mass: 0.6 } });
  const sweep = interpolate(frame, [36, 66, 96], [0, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.quad) });
  const found = spring({ frame: frame - 98, fps, config: { damping: 11, mass: 0.6 } });
  const opening = spring({ frame: frame - 108, fps, config: { damping: 200 } });
  const qr = 400;
  const box = qr + 90;
  const bracket = found > 0.05 ? color.green : "#ffffff";
  const corner = (rot: number, x: string, y: string) => (
    <div
      style={{
        position: "absolute",
        [x]: 0,
        [y]: 0,
        width: 90,
        height: 90,
        borderTop: `10px solid ${bracket}`,
        borderLeft: `10px solid ${bracket}`,
        borderTopLeftRadius: 30,
        transform: `rotate(${rot}deg)`,
      } as React.CSSProperties}
    />
  );
  return (
    <AbsoluteFill style={{ fontFamily }}>
      <ChapterBar chapter={0} progress={interpolate(frame, [0, SCAN_FRAMES], [0, SCAN_CHAPTER_SHARE], { extrapolateRight: "clamp" })} />
      <div style={{ position: "absolute", top: 196, left: 0, right: 0 }}>
        <CaptionBlock caption={SCAN_CAPTION} from={6} />
      </div>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 640,
          width: 680,
          marginLeft: -340,
          padding: "56px 0 60px",
          borderRadius: 48,
          background: "#ffffff",
          boxShadow: "0 40px 100px rgba(10,6,40,0.55)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          opacity: poster,
          transform: `translateY(${(1 - poster) * 80}px) rotate(${(1 - poster) * -3}deg)`,
        }}
      >
        <Logo size={64} nameColor="#0f172a" />
        <div style={{ marginTop: 26, fontSize: 46, fontWeight: 800, color: "#0f172a", letterSpacing: -1 }}>Scan to check in</div>
        <div style={{ marginTop: 6, fontSize: 28, fontWeight: 500, color: "#64748b" }}>Scannez pour pointer</div>
        <div style={{ position: "relative", marginTop: 46, width: box, height: box, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <FakeQr size={qr} />
          <div style={{ position: "absolute", inset: 0, opacity: finder, transform: `scale(${1.25 - finder * 0.25})` }}>
            {corner(0, "left", "top")}
            {corner(90, "right", "top")}
            {corner(270, "left", "bottom")}
            {corner(180, "right", "bottom")}
            <div
              style={{
                position: "absolute",
                left: 30,
                right: 30,
                top: 30 + sweep * (box - 60),
                height: 6,
                borderRadius: 3,
                background: color.indigo,
                boxShadow: `0 0 30px 8px rgba(99,102,241,0.55)`,
                opacity: found > 0.05 ? 0 : 1,
              }}
            />
          </div>
          <div
            style={{
              position: "absolute",
              width: 150,
              height: 150,
              borderRadius: "50%",
              background: color.green,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 20px 50px rgba(16,185,129,0.5), 0 0 0 14px rgba(255,255,255,0.9)",
              transform: `scale(${found})`,
            }}
          >
            <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </div>
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 1560,
          display: "flex",
          justifyContent: "center",
          opacity: opening,
          transform: `translateY(${(1 - opening) * 24}px)`,
        }}
      >
        <div style={{ padding: "20px 38px", borderRadius: 999, background: "rgba(255,255,255,0.14)", border: "1.5px solid rgba(255,255,255,0.25)", color: color.white, fontSize: 34, fontWeight: 700 }}>
          Opening the app…
        </div>
      </div>
    </AbsoluteFill>
  );
};
