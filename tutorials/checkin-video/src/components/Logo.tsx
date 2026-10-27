import { color, fontFamily, SPACE_NAME } from "../theme";

export const Logo: React.FC<{ size?: number; showName?: boolean; nameColor?: string }> = ({
  size = 72,
  showName = true,
  nameColor = color.white,
}) => (
  <div style={{ display: "flex", alignItems: "center", gap: size * 0.28 }}>
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        background: `linear-gradient(135deg, ${color.indigo}, ${color.violet})`,
        color: color.white,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily,
        fontWeight: 800,
        fontSize: size * 0.48,
        boxShadow: "0 12px 30px rgba(79,70,229,0.45)",
      }}
    >
      C
    </div>
    {showName ? (
      <span style={{ fontFamily, fontWeight: 700, fontSize: size * 0.42, color: nameColor, letterSpacing: -0.5 }}>
        {SPACE_NAME}
      </span>
    ) : null}
  </div>
);
