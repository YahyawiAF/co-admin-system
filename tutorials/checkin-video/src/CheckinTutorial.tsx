import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { AbsoluteFill } from "remotion";
import type { Markers } from "./captions";
import { Background } from "./components/Background";
import { Intro, INTRO_FRAMES } from "./scenes/Intro";
import { Outro, OUTRO_FRAMES } from "./scenes/Outro";
import { Scan, SCAN_FRAMES } from "./scenes/Scan";
import { Screen } from "./scenes/Screen";
import { FPS } from "./theme";

const T = 15; // cross-fade length in frames

export const screenFrames = (m: Markers) => Math.ceil(m.duration * FPS);
export const totalFrames = (m: Markers) => INTRO_FRAMES + SCAN_FRAMES + screenFrames(m) + OUTRO_FRAMES - 3 * T;

export type TutorialProps = { markers: Markers | null };

export const CheckinTutorial: React.FC<TutorialProps> = ({ markers }) => {
  if (!markers) return null;
  const timing = linearTiming({ durationInFrames: T });
  return (
    <AbsoluteFill>
      <Background />
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={INTRO_FRAMES}>
          <Intro />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={timing} />
        <TransitionSeries.Sequence durationInFrames={SCAN_FRAMES}>
          <Scan />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={timing} />
        <TransitionSeries.Sequence durationInFrames={screenFrames(markers)}>
          <Screen markers={markers} />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={timing} />
        <TransitionSeries.Sequence durationInFrames={OUTRO_FRAMES}>
          <Outro />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
