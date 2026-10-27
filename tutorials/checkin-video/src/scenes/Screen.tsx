import { AbsoluteFill, Easing, interpolate, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { CaptionBlock } from "../components/Caption";
import { ChapterBar } from "../components/ChapterBar";
import { PhoneFrame } from "../components/PhoneFrame";
import { CAPTIONS, ZOOMS, type Markers } from "../captions";
import { SCAN_CHAPTER_SHARE } from "./Scan";

const SCREEN_W = 728;

/** The real screen recording in a phone, with captions synced to the recorder markers. */
export const Screen: React.FC<{ markers: Markers }> = ({ markers }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const list = markers.markers.filter((m) => CAPTIONS[m.name]);
  const screenH = Math.round((SCREEN_W * markers.height) / markers.width);

  let idx = 0;
  list.forEach((m, i) => {
    if (m.at <= t) idx = i;
  });
  const current = list[idx];
  const cap = CAPTIONS[current.name];
  const startFrame = (i: number) => Math.round(list[i].at * fps);

  // Chapter progress: from the first marker of this chapter to the first of the next.
  const chapterStart = list.find((m) => CAPTIONS[m.name].chapter === cap.chapter)!.at;
  const next = list.find((m) => CAPTIONS[m.name].chapter > cap.chapter);
  const chapterEnd = next ? next.at : markers.duration;
  let progress = Math.min(1, (t - chapterStart) / Math.max(0.1, chapterEnd - chapterStart));
  if (cap.chapter === 0) progress = SCAN_CHAPTER_SHARE + (1 - SCAN_CHAPTER_SHARE) * progress;

  // Gentle zooms on key moments.
  let scale = 1;
  let origin = "50% 50%";
  for (const m of list) {
    const z = ZOOMS[m.name];
    if (!z) continue;
    const local = t - m.at;
    const amt = interpolate(local, [z.start, z.start + 0.7, z.end - 0.7, z.end], [0, 1, 1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.cubic),
    });
    if (amt > 0) {
      scale = 1 + (z.scale - 1) * amt;
      origin = z.origin;
    }
  }

  const phoneIn = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });

  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          top: 560,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          transform: `translateY(${(1 - phoneIn) * 120}px) scale(${scale})`,
          transformOrigin: origin,
          opacity: phoneIn,
        }}
      >
        <PhoneFrame screenWidth={SCREEN_W} screenHeight={screenH}>
          <OffthreadVideo src={staticFile("screen.mp4")} muted style={{ width: SCREEN_W, height: screenH, display: "block" }} />
        </PhoneFrame>
      </div>
      {/* Keeps captions readable when the phone zooms up behind them. */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 560, background: "linear-gradient(180deg, rgba(30,27,75,0.95) 70%, rgba(30,27,75,0))" }} />
      <ChapterBar chapter={cap.chapter} progress={progress} />
      <div style={{ position: "absolute", top: 196, left: 0, right: 0 }}>
        {idx > 0 && frame < startFrame(idx) + 10 ? (
          <CaptionBlock key={list[idx - 1].name} caption={CAPTIONS[list[idx - 1].name]} from={-30} until={startFrame(idx)} />
        ) : null}
        <CaptionBlock key={current.name} caption={cap} from={idx === 0 ? 6 : startFrame(idx) + 4} />
      </div>
    </AbsoluteFill>
  );
};
