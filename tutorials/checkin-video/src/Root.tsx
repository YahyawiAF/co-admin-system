import { Composition, staticFile } from "remotion";
import type { Markers } from "./captions";
import { CheckinTutorial, totalFrames, type TutorialProps } from "./CheckinTutorial";
import { FPS, HEIGHT, WIDTH } from "./theme";

export const Root: React.FC = () => (
  <Composition
    id="CheckinTutorial"
    component={CheckinTutorial}
    width={WIDTH}
    height={HEIGHT}
    fps={FPS}
    durationInFrames={300}
    defaultProps={{ markers: null } as TutorialProps}
    calculateMetadata={async ({ props }) => {
      // Written by record.ts next to the screen recording.
      const markers: Markers = await fetch(staticFile("markers.json")).then((r) => r.json());
      return { durationInFrames: totalFrames(markers), props: { ...props, markers } };
    }}
  />
);
