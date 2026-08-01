import React from "react";

// پالت رنگی متنوع برای برش‌ها — قرمز عمداً کنار گذاشته شده چون برای خطای کمبود/همپوشانی رزرو است
const PIECE_PALETTE = [
  "#38BDF8", // آبی روشن (به‌روز شده)
  "#4ADE80", // سبز
  "#FBBF24", // کهربایی
  "#A78BFA", // بنفش
  "#F472B6", // صورتی
  "#2DD4BF", // فیروزه‌ای
  "#FB923C", // نارنجی
  "#818CF8", // نیلی
  "#34D399", // زمردی
  "#FACC15", // زرد
  "#60A5FA", // آبی
  "#C084FC", // بنفش روشن
];

function colorForPiece(p) {
  const key = `${p.w}x${p.h}`;
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return PIECE_PALETTE[hash % PIECE_PALETTE.length];
}

export const NestingVisualizer = ({ layout, stockW, stockH, sheetIdx, mode }) => {
  if (!layout || !stockW || !stockH) return null;
  const VW = 600;
  const VH = Math.round(VW * (stockH / stockW));
  const scaleX = VW / stockW,
    scaleY = VH / stockH;
  const TEAL = "#38BDF8"; // آبی روشن به‌روز‌شده (fallback)

  // برش دستگاه: خط‌های سرتاسری‌ای که ردیف‌ها (شلف‌ها) رو از هم جدا می‌کنن —
  // این‌ها همون برش‌های اول و بزرگ هستن که دستگاه کل عرض پنل رو یک‌جا می‌بره،
  // برخلاف برش‌های کوچیک‌تر بین تکه‌های داخل یک ردیف که سرتاسری نیستن
  const shelfBoundaries = [];
  if (mode === "machine") {
    const ys = Array.from(new Set(layout.placements.map((p) => p.y))).sort((a, b) => a - b);
    ys.forEach((y) => {
      if (y > 0.001) shelfBoundaries.push(y);
    });
  }

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 9.5, color: layout.overflow ? "#e08a8a" : "#888", marginBottom: 5, display: "flex", alignItems: "center", gap: 6 }}>
        {layout.overflow ? (
           <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", background: "#3a1d1d", border: "1px solid #8B1A1A", borderRadius: 6, width: "100%" }}>
             <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
             <span style={{ fontWeight: 500 }}>خطای کمبود متریال (پنل مساحتی برای ${stockW}×${stockH})</span>
           </div>
        ) : `صفحه ${sheetIdx + 1} — ${stockW}×${stockH} سانتی‌متر`}
      </div>
      <div style={{ background: layout.overflow ? "#3a1d1d" : "#161616", border: layout.overflow ? "1px solid #8B1A1A" : "1px solid #222", borderRadius: 4, padding: 6, display: "flex", justifyContent: "center" }}>
        <svg viewBox={`0 0 ${VW} ${VH}`} style={{ width: "100%", maxWidth: "100%", height: "auto", display: "block" }}>
          <rect x={0.5} y={0.5} width={VW - 1} height={VH - 1} fill={layout.overflow ? "#3a1414" : "#111"} stroke={layout.overflow ? "#8a0000" : "#333"} strokeWidth={3} />
          <rect x={0.5} y={0.5} width={VW - 1} height={VH - 1} fill="none" stroke="#999" strokeWidth={1} />
          {shelfBoundaries.map((y, idx) => (
            <line
              key={`shelf-${idx}`}
              x1={0}
              y1={y * scaleY}
              x2={VW}
              y2={y * scaleY}
              stroke="#888"
              strokeWidth={1}
              strokeDasharray="7,5"
              opacity={0.5}
            />
          ))}
          {layout.placements.map((p, i) => {
            const px = p.x * scaleX,
              py = p.y * scaleY,
              pw = p.w * scaleX,
              ph = p.h * scaleY;
            const gap = 1.5;
            const gx = px + gap / 2,
              gy = py + gap / 2,
              gw = Math.max(0, pw - gap),
              gh = Math.max(0, ph - gap);

            const pieceColor = colorForPiece(p);

            if (p.isCircle) {
              const cx = gx + gw / 2;
              const cy = gy + gh / 2;
              const rr = Math.min(gw, gh) / 2;
              return (
                <g key={i}>
                  <rect x={gx} y={gy} width={gw} height={gh} fill="none" stroke="#666" strokeWidth={1.5} strokeDasharray="3,3" />
                  <circle cx={cx} cy={cy} r={rr} fill={p.overflow ? "#ff6b6b88" : pieceColor} stroke="#000" strokeWidth={2.5} />
                  {gw > 40 && gh > 20 && (
                    <text x={cx} y={cy + 5} textAnchor="middle" fill="#0a3a3a" fontSize={14} fontWeight="700" style={{ userSelect: "none" }}>
                      {p.label}
                    </text>
                  )}
                </g>
              );
            }
            if (p.isSemiCircle) {
              const isRotated = p.rotated;
              // Semicircle's bounding box is Diameter x Radius (2R x R)
              // If rotated, it becomes Radius x Diameter (R x 2R)
              let pathD = "";
              if (isRotated) {
                // Semicircle on vertical axis (Diameter along height)
                pathD = `M ${gx} ${gy} A ${gw} ${gh / 2} 0 0 1 ${gx} ${gy + gh} Z`;
              } else {
                // Semicircle on horizontal axis (Diameter along width)
                pathD = `M ${gx} ${gy + gh} A ${gw / 2} ${gh} 0 0 1 ${gx + gw} ${gy + gh} Z`;
              }

              return (
                <g key={i}>
                  {/* Restore dotted bounding rectangle logic */}
                  <rect x={gx} y={gy} width={gw} height={gh} fill="none" stroke="#666" strokeWidth={1.5} strokeDasharray="3,3" />
                  <path d={pathD} fill={p.overflow ? "#ff6b6b88" : pieceColor} stroke="#000" strokeWidth={2.5} />
                  {gw > 40 && gh > 20 && (
                    <text x={gx + gw / 2} y={gy + gh / 2 + 5} textAnchor="middle" fill="#0a3a3a" fontSize={14} fontWeight="700" style={{ userSelect: "none" }}>
                      {p.label}
                    </text>
                  )}
                </g>
              );
            }
            return (
              <g key={i}>
                <rect x={gx} y={gy} width={gw} height={gh} fill={p.overflow ? "#ff6b6b88" : pieceColor} stroke="#000" strokeWidth={2.5} />
                {gw > 56 && gh > 28 && (
                  <text x={gx + gw / 2} y={gy + gh / 2 + 5} textAnchor="middle" fill="#0a3a3a" fontSize={14} fontWeight="700" style={{ userSelect: "none" }}>
                    {p.w}x{p.h}
                  </text>
                )}
                {!(gw > 56 && gh > 28) && gh > 56 && gw > 28 && (
                  <text
                    x={gx + gw / 2}
                    y={gy + gh / 2 + 5}
                    textAnchor="middle"
                    fill="#0a3a3a"
                    fontSize={14}
                    fontWeight="700"
                    style={{ userSelect: "none" }}
                    transform={`rotate(90 ${gx + gw / 2} ${gy + gh / 2})`}
                  >
                    {p.w}x{p.h}
                  </text>
                )}
                {p.overflow && gw > 32 && (
                  <text x={gx + 5} y={gy + 20} fill="#8a0000" fontSize={12} fontWeight="700">!</text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};
