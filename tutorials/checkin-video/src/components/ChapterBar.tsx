import { CHAPTERS } from "../captions";
import { color, fontFamily } from "../theme";

/** Four-part progress bar; `progress` is 0..1 within the current chapter. */
export const ChapterBar: React.FC<{ chapter: number; progress: number }> = ({ chapter, progress }) => (
  <div style={{ position: "absolute", top: 86, left: 72, right: 72, display: "flex", gap: 14, fontFamily }}>
    {CHAPTERS.map((label, i) => {
      const fill = i < chapter ? 1 : i === chapter ? progress : 0;
      return (
        <div key={label} style={{ flex: 1 }}>
          <div style={{ height: 8, borderRadius: 4, background: color.faint, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${fill * 100}%`, borderRadius: 4, background: `linear-gradient(90deg, ${color.indigoSoft}, #ffffff)` }} />
          </div>
          <div
            style={{
              marginTop: 12,
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: 0.5,
              color: i === chapter ? color.white : color.faint,
              transition: "none",
            }}
          >
            {label}
          </div>
        </div>
      );
    })}
  </div>
);
