import { color, fontFamily } from "../theme";

/** Dark phone body with status bar and dynamic island; children fill the screen. */
export const PhoneFrame: React.FC<{ screenWidth: number; screenHeight: number; children: React.ReactNode }> = ({
  screenWidth,
  screenHeight,
  children,
}) => {
  const bezel = 20;
  const statusH = 62;
  const radius = 84;
  return (
    <div
      style={{
        width: screenWidth + bezel * 2,
        height: screenHeight + statusH + bezel * 2,
        padding: bezel,
        borderRadius: radius + bezel,
        background: "linear-gradient(145deg, #2a2a3a, #0b0b14 40%, #1c1c28)",
        boxShadow: "0 50px 120px rgba(10, 6, 40, 0.65), 0 0 0 3px rgba(255,255,255,0.08), inset 0 0 0 2px rgba(255,255,255,0.06)",
      }}
    >
      <div style={{ width: screenWidth, height: screenHeight + statusH, borderRadius: radius, overflow: "hidden", background: "#f3f6fb", position: "relative" }}>
        <div
          style={{
            height: statusH,
            background: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 56px 0 64px",
            fontFamily,
            fontWeight: 700,
            fontSize: 26,
            color: "#0f172a",
          }}
        >
          <span>9:41</span>
          <StatusIcons />
        </div>
        <div style={{ position: "absolute", top: 14, left: "50%", marginLeft: -92, width: 184, height: 46, borderRadius: 23, background: "#05050a" }} />
        <div style={{ width: screenWidth, height: screenHeight, overflow: "hidden", position: "relative" }}>{children}</div>
      </div>
    </div>
  );
};

const StatusIcons: React.FC = () => (
  <svg width="120" height="26" viewBox="0 0 120 26" fill="#0f172a">
    {[0, 1, 2, 3].map((i) => (
      <rect key={i} x={i * 9} y={18 - i * 5} width={6} height={6 + i * 5} rx={1.5} />
    ))}
    <path d="M58 9a17 17 0 0 1 22 0l-2.4 2.6a13.5 13.5 0 0 0-17.2 0zM62.5 14a10.5 10.5 0 0 1 13 0l-2.5 2.6a7 7 0 0 0-8 0zM69 22l-3-3.2a4.4 4.4 0 0 1 6 0z" />
    <rect x="88" y="4" width="27" height="17" rx="5" fill="none" stroke="#0f172a" strokeWidth="2" opacity="0.5" />
    <rect x="91" y="7" width="21" height="11" rx="2.6" />
    <rect x="116.5" y="9.5" width="2.5" height="6" rx="1.2" opacity="0.5" />
  </svg>
);

export const PHONE_COLORS = color;
