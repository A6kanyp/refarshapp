// ============================================================
// WoodCuttingTab.jsx - Refarsh Clean (اصلاح خطاهای build)
// ============================================================
import React, { useState, useMemo, memo, useRef, useEffect } from "react";
import { Trash2, ChevronDown, ChevronUp, RotateCcw, Plus, Eye, EyeOff, Download, X, Package, Save, Upload, Image as ImageIcon, FileText, Clock } from "lucide-react";
import html2canvas from "html2canvas";
import { saveFile, REFARSH_SAVE_DIRS } from "../utils/nativeSave";
import { toNum, normalizeNumericInput, fmtCode, formatProductDims } from "../mathCore";
import { getJalaliTimestamp } from "../utils/formatters";
import { NestingVisualizer } from "./NestingVisualizer";
import {
  FRAME_TYPES,
  getFramePieces,
  getBackingSheetSize,
  nestBackingPanels,
  optimizeCutting,
  r2,
} from "../woodCuttingCore";
import { uid } from "../dataModels";
import { useToast } from "../contexts/ToastContext";
import { useRegisterOpenModal } from "../utils/modalRegistry";

const hideSpinStyles = `
  input[type="number"]::-webkit-outer-spin-button,
  input[type="number"]::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  input[type="number"] {
    -moz-appearance: textfield;
    appearance: textfield;
  }
`;

const T = {
  input: { background: "#1c1c1c", border: "1px solid #2a2a2a", borderRadius: 6, padding: "7px 9px", color: "#ddd", fontFamily: "inherit", fontSize: 11, outline: "none", boxSizing: "border-box" },
  chip: { background: "#1c1c1c", border: "1px solid #2a2a2a", color: "#777", fontSize: 10.5, padding: "5px 11px", borderRadius: 12, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4 },
  chipActive: { background: "#2a1414", border: "1px solid #8B1A1A", color: "#d88888" },
  sectionLabel: { fontSize: 9.5, color: "#555", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", margin: "14px 0 7px" },
  iconBtn: { background: "transparent", border: "none", cursor: "pointer", padding: "4px 6px", display: "flex", alignItems: "center" },
};

const modalOverlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.88)",
  zIndex: 300,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const modalContent = {
  width: "90%",
  maxWidth: 400,
  background: "#181818",
  border: "1px solid #2a2a2a",
  borderRadius: 14,
  padding: 20,
  maxHeight: "80vh",
  display: "flex",
  flexDirection: "column",
};

function Icon4Side({ size = 18, active }) {
  const c = active ? "#d88888" : "#666";
  return <svg width={size} height={size} viewBox="0 0 18 18" fill="none"><rect x="2" y="2" width="14" height="14" rx="1" stroke={c} strokeWidth="2.2" fill="none" /></svg>;
}
function Icon3Side({ size = 18, active }) {
  const c = active ? "#d88888" : "#666";
  return <svg width={size} height={size} viewBox="0 0 18 18" fill="none"><path d="M2 16 L2 2 L16 2 L16 16" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>;
}
function IconSingle({ size = 18, active }) {
  const c = active ? "#d88888" : "#666";
  return <svg width={size} height={size} viewBox="0 0 18 18" fill="none"><line x1="2" y1="9" x2="16" y2="9" stroke={c} strokeWidth="2.5" strokeLinecap="round" /></svg>;
}

const emptyFrame = (prevThickness = "") => ({
  id: uid(),
  type: FRAME_TYPES.FOUR_SIDE,
  w: "",
  h: "",
  thickness: prevThickness,
  qty: "1",
  isSemiCircle: false,
  isCircle: false,
});

function drawWoodGrain(xTL, xTR, xBL, xBR, thickness) {
  const midY1 = thickness * 0.25;
  const midY2 = thickness * 0.5;
  const midY3 = thickness * 0.75;
  
  const widthTL_TR = xTR - xTL;
  const widthBL_BR = xBR - xBL;
  
  return (
    <>
      <path 
        d={`M ${xTL + widthTL_TR * 0.05} ${midY1} Q ${xTL + widthTL_TR * 0.5} ${midY1 - thickness*0.05} ${xBL + widthBL_BR * 0.95} ${midY1}`}
        fill="none"
        stroke="rgba(255,255,255,0.14)"
        strokeWidth="0.08"
        pointerEvents="none"
      />
      <path 
        d={`M ${xTL + widthTL_TR * 0.1} ${midY2} Q ${xTL + widthTL_TR * 0.4} ${midY2 + thickness*0.05} ${xBL + widthBL_BR * 0.9} ${midY2}`}
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth="0.05"
        pointerEvents="none"
      />
      <path 
        d={`M ${xTL + widthTL_TR * 0.15} ${midY3} Q ${xTL + widthTL_TR * 0.6} ${midY3 - thickness*0.08} ${xBL + widthBL_BR * 0.85} ${midY3}`}
        fill="none"
        stroke="rgba(255,255,255,0.14)"
        strokeWidth="0.08"
        pointerEvents="none"
      />
    </>
  );
}

// ============================================================
// بازنویسی کامل رندر برش ۱D (این نشست، Logy 🟠) — گزارش کاربر:
// (۱) عرض چوب باید دقیقاً ۱۰۰٪ عرض صفحه باشه، بدون اسکرول
// (۲) اگه لیبل یه قطعه جا نشه، همه‌ی چوب‌ها با هم یه‌مقدار بزرگ‌تر بشن
// (۳) گپ بین برش‌های کج/صاف باید یکسان و مبتنی‌بر کرف واقعی باشه (قبلاً
//     خراب شده بود: گپ صاف‌به‌صاف همیشه ثابت=۲px بود، گپ مایتردار همیشه
//     ۲+ضخامت بود — هیچ‌کدوم به kerf واقعی کاری نداشتن)
// (۴) گپ باید دینامیک به کرف باشه: تا ۰.۳ سایز پیش‌فرض ثابت (پیکسلی)، بعد
//     از اون به‌نسبت واقعی طول چوب
// (۵) هر قطعه دقیقاً به‌نسبت طول واقعیش از کل طول چوب ترسیم بشه
// (۶) باگ ذخیره‌ی عکس: چون قبلاً با CSS clip-path رسم می‌شد و html2canvas
//     ازش پشتیبانی نمی‌کرد، یه hack موقتِ swap-به-SVG قبل از export انجام
//     می‌شد که لیبل رو جابه‌جا می‌کرد. الان کل ترسیم مثل ۲D مستقیم SVG است
//     (drawWoodGrain که پایینه دقیقاً برای همین از قبل نوشته شده بود ولی
//     هیچ‌جا صدا زده نمی‌شد — یعنی احتمالاً همون نسخه‌ی SVG قدیمی‌تر که
//     کاربر گفت "قبلاً درست بود" بوده)، پس دیگه نیازی به اون hack نیست.
// ============================================================

const PLANK_DEFAULT_GAP_PX = 3; // گپ پیش‌فرض وقتی کرف <= ۰.۳ سانت — فقط بصری، نه واقعاً متناسب با طول
const PLANK_KERF_GAP_THRESHOLD_CM = 0.3;
const PLANK_ROW_HEIGHT = 18;
const PLANK_BEVEL_PX = 3; // آفست ۴۵درجه‌ی مایتر — کوچیک و ثابت، مثل قبل

// تخمین عرض لازم برای این‌که متن لیبل (عدد طول) جا بشه — دقیق نیست (canvas
// measureText نیست) ولی برای این‌که بدونیم مقیاس کلی باید چقدر بزرگ بشه کافیه
function estimatePlankLabelWidthPx(text, fontSize = 10) {
  return String(text).length * fontSize * 0.62 + 10;
}

const plankSlopeOf = (miter, flip, isLeft) => {
  if (!miter) return 'flat';
  if (isLeft) return flip ? 'neg' : 'pos';
  return flip ? 'pos' : 'neg';
};

// محاسبه‌ی چیدمان یک ردیف: targetWidthPx یعنی «۱۰۰٪ عرض کادر × مقیاس سراسری»
// (مقیاس سراسری معمولاً ۱ است؛ فقط وقتی لیبل یه قطعه جایی جا نشه از بیرون
// بزرگ‌تر پاس داده می‌شه — نگاه کن به plankGlobalScale پایین‌تر توی کامپوننت اصلی)
function computePlankRowLayout(cuts, wasteLength, kerfVal, stockLength, targetWidthPx) {
  const K = r2(kerfVal || 0);
  const totalLen = toNum(stockLength) || (cuts.reduce((s, c) => s + toNum(c.length), 0) + wasteLength);
  const n = cuts.length;
  // گپ پایه، متناسب با کرف (حداقل ۳پیکسل، حداکثر ۶پیکسل) — طبق درخواست کاربر
  // (آیتم ۱۵ دامپ رودمپ): برش‌های کج/مایتردار باید نصف این گپ رو بگیرن، برش‌های
  // صاف (بدون مایتر) گپ کامل رو نگه می‌دارن
  const visibleGap = Math.max(3, Math.min(6, K <= PLANK_KERF_GAP_THRESHOLD_CM ? PLANK_DEFAULT_GAP_PX : (totalLen > 0 ? K * (targetWidthPx / totalLen) : PLANK_DEFAULT_GAP_PX)));
  const miterGap = visibleGap / 2;

  const jointGapPx = cuts.map((c, i) => {
    if (i === 0) return 0;
    const isMiterJoint = c.miterLeft === true;
    return isMiterJoint ? miterGap : visibleGap;
  });
  const wasteGapPx = wasteLength > 0 && n > 0 ? visibleGap : 0;
  const totalGapPx = jointGapPx.reduce((s, g) => s + g, 0) + (wasteLength > 0 ? wasteGapPx : 0);

  const available = Math.max(1, targetWidthPx - totalGapPx);
  const pxPerCm = totalLen > 0 ? available / totalLen : 0;

  const pieceWidths = cuts.map((c) => Math.max(0, toNum(c.length) * pxPerCm));
  const wastePx = wasteLength > 0 ? wasteLength * pxPerCm : 0;

  let rowWidthPx =
    pieceWidths.reduce((s, w) => s + w, 0) +
    jointGapPx.reduce((s, g) => s + g, 0) +
    (wasteLength > 0 ? wasteGapPx + wastePx : 0);

  if (rowWidthPx > 0.5 && Math.abs(rowWidthPx - targetWidthPx) > 0.5) {
    const scale = targetWidthPx / rowWidthPx;
    return {
      jointGapPx: jointGapPx.map((g) => g * scale),
      pieceWidths: pieceWidths.map((w) => w * scale),
      wastePx: wastePx * scale,
      wasteGapPx: wasteGapPx * scale,
      rowWidthPx: targetWidthPx,
      pxPerCm: pxPerCm * scale,
    };
  }

  return { jointGapPx, pieceWidths, wastePx, wasteGapPx, rowWidthPx: targetWidthPx, pxPerCm };
}

function PlankRow({ rowNumber, label, stockLength, cuts, kerfVal, wasteLength = 0, thickness = 2.5, targetWidthPx = 300 }) {
  if (!cuts || !cuts.length) return null;
  const height = PLANK_ROW_HEIGHT;
  const t = PLANK_BEVEL_PX;

  const getColor = (cutType) => {
    if (cutType === "double") return "#2196F3";
    if (cutType === "single") return "#4CAF50";
    return "#F44336";
  };

  const isWaste = wasteLength > 0 && wasteLength < r2(toNum(thickness) * 2);
  const remainingText = wasteLength > 0 ? (isWaste ? ` — هدررفت: ${wasteLength} سانت` : ` — باقیمانده: ${wasteLength} سانت`) : "";

  // راست‌به‌چپ بصری (RTL):
  // - باقیمانده/هدررفت سمت چپ
  // - اولین قطعه‌ی الگوریتم روی لبه‌ی راست چوب
  // آینه‌کردن مایترها تا اتصال V بین قطعات مجاور بعد از reverse درست بماند
  const displayCuts = [...cuts].reverse().map((c) => ({
    ...c,
    miterLeft: c.miterRight,
    miterRight: c.miterLeft,
    flipped: !c.flipped,
  }));

  const layoutW = Math.max(40, targetWidthPx);
  const { jointGapPx, pieceWidths, wastePx, wasteGapPx, rowWidthPx } = computePlankRowLayout(
    displayCuts, wasteLength, kerfVal, stockLength, layoutW
  );

  // باقیمانده سمت چپ، بعد قطعات (آرایه‌ی معکوس) → اولین قطعه روی راست
  let cursor = 0;
  const wasteX = 0;
  if (wasteLength > 0 && wastePx > 0) {
    cursor = wastePx + wasteGapPx;
  }
  const pieceX = displayCuts.map((_, i) => {
    cursor += jointGapPx[i];
    const x = cursor;
    cursor += pieceWidths[i];
    return x;
  });

  const vbW = Math.max(rowWidthPx, 1);

  const needsScroll = vbW > targetWidthPx + 2;

  return (
    <div style={{ marginBottom: 10, width: needsScroll ? vbW : "100%", maxWidth: needsScroll ? "none" : "100%", boxSizing: "border-box" }}>
      <div style={{ fontSize: 9.5, color: "#888", marginBottom: 4, display: "flex", justifyContent: "space-between", width: "100%", boxSizing: "border-box" }}>
        <span>چوب {rowNumber} — {stockLength} سانتی‌متر{remainingText}</span>
        {label && <span style={{ color: "#666" }}>{label}</span>}
      </div>
      <svg
        width={needsScroll ? vbW : "100%"}
        height={height}
        viewBox={`0 0 ${vbW} ${height}`}
        preserveAspectRatio={needsScroll ? "xMinYMid meet" : "none"}
        style={{ display: "block", width: needsScroll ? vbW : "100%", background: "#111", borderRadius: 4, border: "1px solid #222", boxSizing: "border-box" }}
      >
        {displayCuts.map((c, i) => {
          const color = getColor(c.cutType || "none");
          const miterLeft = c.miterLeft === true;
          const miterRight = c.miterRight === true;
          const flipped = c.flipped === true;
          const leftSlope = plankSlopeOf(miterLeft, flipped, true);
          const rightSlope = plankSlopeOf(miterRight, flipped, false);
          const w = pieceWidths[i];
          const x0 = pieceX[i];

          const L_top = leftSlope === 'pos' ? t : 0;
          const L_bot = leftSlope === 'neg' ? t : 0;
          const R_top = rightSlope === 'neg' ? w - t : w;
          const R_bot = rightSlope === 'pos' ? w - t : w;
          const points = `${x0 + L_top},0 ${x0 + R_top},0 ${x0 + R_bot},${height} ${x0 + L_bot},${height}`;

          const showLabel = w >= estimatePlankLabelWidthPx(c.length, 10) * 0.9;

          return (
            <g key={i}>
              <polygon points={points} fill={color} />
              {drawWoodGrain(x0 + L_top, x0 + R_top, x0 + L_bot, x0 + R_bot, height)}
              {showLabel && (
                <text x={x0 + w / 2} y={height / 2 + 3} textAnchor="middle" fill="#fff" fontSize={9} style={{ userSelect: "none" }}>
                  {c.length}
                </text>
              )}
            </g>
          );
        })}

        {wasteLength > 0 && (
          <g>
            <defs>
              <pattern id={`plank-waste-hatch-${rowNumber}`} width="8" height="8" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
                <rect width="8" height="8" fill="#1c1c1c" />
                <line x1="0" y1="0" x2="0" y2="8" stroke="#151515" strokeWidth="8" />
              </pattern>
            </defs>
            <rect x={wasteX} y={0} width={Math.max(0, wastePx)} height={height} fill={`url(#plank-waste-hatch-${rowNumber})`} stroke="#333" strokeDasharray="3,3" />
            {wastePx > estimatePlankLabelWidthPx(wasteLength, 9) && (
              <text x={wasteX + wastePx / 2} y={height / 2 + 3} textAnchor="middle" fill="#666" fontSize={9} fontWeight="700" style={{ userSelect: "none" }}>
                {wasteLength}
              </text>
            )}
          </g>
        )}
      </svg>
    </div>
  );
}

function FrameRow({ frame, onChange, onDelete, onLinkProduct }) {
  const isSingle = frame.type === FRAME_TYPES.SINGLE;
  const is3 = frame.type === FRAME_TYPES.THREE_SIDE;

  const w = toNum(frame.w);
  const h = toNum(frame.h);
  const t = r2(toNum(frame.thickness));
  const q = Math.max(1, toNum(frame.qty) || 1);
  let pieceCount = 0;
  if (frame.type === FRAME_TYPES.FOUR_SIDE && (w || h)) {
    pieceCount = 4 * q;
  } else if (frame.type === FRAME_TYPES.THREE_SIDE && (w || h)) {
    pieceCount = 3 * q;
  } else if (frame.type === FRAME_TYPES.SINGLE && w) {
    pieceCount = frame.isCircle ? 0 : q;
  }

  const isWError = !frame.w || toNum(frame.w) <= 0;
  const isHError = !isSingle && (!frame.h || toNum(frame.h) <= 0);
  const isTError = !frame.thickness || toNum(frame.thickness) <= 0;
  const isQError = !frame.qty || toNum(frame.qty) <= 0;

  return (
    <div style={{ background: "#161616", border: "1px solid #232323", borderRadius: 10, padding: "11px 12px", marginBottom: 8 }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {[
          { type: FRAME_TYPES.FOUR_SIDE, label: "۴ ضلعی", Icon: Icon4Side },
          { type: FRAME_TYPES.THREE_SIDE, label: "۳ ضلعی", Icon: Icon3Side },
          { type: FRAME_TYPES.SINGLE, label: "تک چوب", Icon: IconSingle }
        ].map(({ type, label, Icon }) => (
          <button key={type} style={{ ...T.chip, flex: 1, justifyContent: "center", ...(frame.type === type ? T.chipActive : {}) }}
            onClick={() => onChange({ ...frame, type })}>
            <Icon size={14} active={frame.type === type} />{label}
          </button>
        ))}
        <button style={{ ...T.chip, padding: "5px 8px", color: "#e08a8a" }} onClick={onDelete}><Trash2 size={13} /></button>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 8, alignItems: "center" }}>
        {!frame.linkedProductCode && (
          <button style={{ ...T.chip, fontSize: 9.5, padding: "4px 9px", color: "#7aa8d8", border: "1px solid #1a3a50" }} onClick={onLinkProduct}>
            🔗 ابعاد از محصول
          </button>
        )}
        {frame.linkedProductCode && (
          <span style={{ fontSize: 9, background: "#0d1f2d", border: "1px solid #1a3a50", color: "#7ec7e8", borderRadius: 6, padding: "2px 5px 2px 7px", display: "flex", alignItems: "center", gap: 4 }}>
            P-{fmtCode(frame.linkedProductCode)}
            <button 
              style={{ background: "none", border: "none", color: "#7ec7e8", cursor: "pointer", padding: 0, fontSize: 10, fontWeight: 700 }}
              onClick={() => onChange({ ...frame, linkedProductCode: null })}
            >
              ✕
            </button>
          </span>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", gap: 6, marginBottom: 8 }}>
        {!isSingle ? (
          <>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 9, color: "#555", marginBottom: 3 }}>{is3 ? "عرض" : "عرض (W)"}</div>
              <div style={{ position: "relative" }}>
                <input onFocus={(e) => e.target.select()} style={{ ...T.input, width: "100%", textAlign: "center", paddingLeft: 0, paddingRight: 0, borderColor: isWError ? "#ef4444" : "#2a2a2a", background: isWError ? "#2a1414" : "#121212" }} type="number" min="0" placeholder="سانت"
                  value={frame.w} onChange={(e) => onChange({ ...frame, w: normalizeNumericInput(e.target.value) })} />
                {is3 && <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: "#888", pointerEvents: "none" }}>x1</span>}
              </div>
            </div>
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: "50%",
                background: "transparent",
                border: is3 ? "1px solid #444" : "1px solid transparent",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 16,
                fontWeight: 700,
                color: is3 ? "#888" : "#555",
                cursor: is3 ? "pointer" : "default",
                zIndex: 1,
                marginLeft: -10,
                marginRight: -10,
                marginBottom: 2,
                flexShrink: 0,
                transition: "all 0.15s"
              }}
              onClick={() => {
                if (is3) {
                  onChange({ ...frame, w: frame.h, h: frame.w });
                }
              }}
              title={is3 ? "جابجایی طول و عرض" : ""}
            >
              ×
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 9, color: "#555", marginBottom: 3 }}>{is3 ? "ارتفاع" : "ارتفاع (H)"}</div>
              <div style={{ position: "relative" }}>
                <input onFocus={(e) => e.target.select()} style={{ ...T.input, width: "100%", textAlign: "center", paddingLeft: 0, paddingRight: 0, borderColor: isHError ? "#ef4444" : "#2a2a2a", background: isHError ? "#2a1414" : "#121212" }} type="number" min="0" placeholder="سانت"
                  value={frame.h} onChange={(e) => onChange({ ...frame, h: normalizeNumericInput(e.target.value) })} />
                {is3 && <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: "#888", pointerEvents: "none" }}>x2</span>}
              </div>
            </div>
          </>
        ) : (
          <div style={{ display: "flex", gap: 6, alignItems: "flex-end", flex: 2 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 9, color: "#555", marginBottom: 3 }}>{frame.isSemiCircle ? (frame.isCircle ? "قطر (دایره)" : "قطر") : "طول چوب"}</div>
              <input onFocus={(e) => e.target.select()} style={{ ...T.input, width: "100%", textAlign: "center", paddingLeft: 0, paddingRight: 0, borderColor: isWError ? "#ef4444" : "#2a2a2a", background: isWError ? "#2a1414" : "#121212" }} type="number" min="0" placeholder="سانت"
                value={frame.w} onChange={(e) => onChange({ ...frame, w: e.target.value })} />
            </div>
            <button style={{ ...T.chip, padding: "7px 10px", ...(frame.isSemiCircle && !frame.isCircle ? { background: "#2a1414", border: "1px solid #8B1A1A", color: "#d88888" } : {}), flexShrink: 0 }}
              onClick={() => onChange({ ...frame, isSemiCircle: !(frame.isSemiCircle && !frame.isCircle), isCircle: false })}>D</button>
            <button style={{ ...T.chip, padding: "7px 10px", ...(frame.isSemiCircle && frame.isCircle ? { background: "#2a1414", border: "1px solid #8B1A1A", color: "#d88888" } : {}), flexShrink: 0 }}
              onClick={() => onChange({ ...frame, isSemiCircle: !(frame.isSemiCircle && frame.isCircle), isCircle: !(frame.isSemiCircle && frame.isCircle) })}>O</button>
          </div>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9, color: "#555", marginBottom: 3 }}>ضخامت</div>
          <input onFocus={(e) => e.target.select()} style={{ ...T.input, width: "100%", borderColor: isTError ? "#ef4444" : "#2a2a2a", background: isTError ? "#2a1414" : "#121212" }} type="number" min="0" step="0.1" placeholder="سانت"
            value={frame.thickness} onChange={(e) => onChange({ ...frame, thickness: e.target.value })} />
        </div>
        <div style={{ width: 46 }}>
          <div style={{ fontSize: 9, color: "#555", marginBottom: 3 }}>تعداد</div>
          <input onFocus={(e) => e.target.select()} style={{ ...T.input, width: "100%", textAlign: "center", borderColor: isQError ? "#ef4444" : "#2a2a2a", background: isQError ? "#2a1414" : "#121212" }} type="number" min="1" placeholder="۱"
            value={frame.qty} onChange={(e) => onChange({ ...frame, qty: e.target.value })} />
        </div>
      </div>

      {pieceCount > 0 && (
        <div style={{ fontSize: 9.5, color: "#888", marginTop: 4, paddingTop: 6, borderTop: "1px solid #1a1a1a" }}>
          {pieceCount} قطعه
        </div>
      )}
    </div>
  );
}

function StatPill({ label, value }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 13, color: "#F5F0EB", fontWeight: 600 }}>{value}</div>
      <div style={{ fontSize: 9, color: "#555" }}>{label}</div>
    </div>
  );
}

// ── Main Export ──
export default function WoodCuttingTab({ stickyTop, materials, products, persistedState, onStateChange, onExport, onSaveSession, onDeleteSession, woodCuttingSessions }) {
  const { showToast } = useToast();

  const getSaved = () => {
    try {
      const v = localStorage.getItem("refarsh_woodcutting_session");
      return v ? JSON.parse(v) : null;
    } catch { return null; }
  };
  const savedSession = getSaved();

  // ── State ──
  const [frames, setFrames] = useState(() => savedSession?.frames || [emptyFrame("2.5")]);
  const [stockW, setStockW] = useState(() => savedSession?.stockW || "90");
  const [stockH, setStockH] = useState(() => savedSession?.stockH || "120");
  const [kerf, setKerf] = useState(() => savedSession?.kerf || "0.3");
  const [show1D, setShow1D] = useState(() => savedSession?.show1D !== undefined ? savedSession.show1D : true);
  const [show2D, setShow2D] = useState(() => savedSession?.show2D !== undefined ? savedSession.show2D : true);
  const [showProductPicker, setShowProductPicker] = useState(null);
  useRegisterOpenModal(!!showProductPicker);
  const [nestingMode, setNestingMode] = useState(() => savedSession?.nestingMode || "machine");

  // ── Stick rows ──
  const [stickRows, setStickRows] = useState(() => {
    const saved = savedSession?.stickRows;
    if (saved && Array.isArray(saved)) return saved;
    return [];
  });
  const [stickKerf, setStickKerf] = useState(() => savedSession?.stickKerf || "0.3");

  // ── Panel rows ──
  const [panelRows, setPanelRows] = useState(() => {
    const saved = savedSession?.panelRows;
    if (saved && Array.isArray(saved)) return saved;
    return [];
  });
  const [panelKerf, setPanelKerf] = useState(() => savedSession?.panelKerf || "0.3");

  // ── Picker modals ──
  const [showStickPicker, setShowStickPicker] = useState(false);
  const [showPanelPicker, setShowPanelPicker] = useState(false);

  const results1DRef = useRef(null);
  const results2DRef = useRef(null);
  const plankContainerRef = useRef(null);
  const [plankContainerWidth, setPlankContainerWidth] = useState(() => Math.max(280, (typeof window !== "undefined" ? window.innerWidth : 360) - 48));
  useEffect(() => {
    const measure = () => {
      const el = plankContainerRef.current;
      const w = el?.clientWidth || 0;
      setPlankContainerWidth(w > 40 ? w : Math.max(280, window.innerWidth - 48));
    };
    measure();
    const t1 = requestAnimationFrame(measure);
    const t2 = setTimeout(measure, 50);
    const t3 = setTimeout(measure, 200);
    const el = plankContainerRef.current;
    let ro;
    if (el && typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(measure);
      ro.observe(el);
    }
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      ro?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [show1D]);


  const handleSaveAsJpg = (ref, fileName) => {
    if (!ref.current) return Promise.resolve();

    // قبلاً این‌جا یه hack موقت بود که موقع export، تکه‌های مایتردار رو (که
    // با CSS clip-path رسم می‌شدن و html2canvas ازش پشتیبانی نمی‌کرد) با یه
    // SVG جایگزین می‌کرد، ولی این کار لیبل متن رو جابه‌جا می‌کرد (دقیقاً
    // باگی که کاربر گزارش داد: توی عکس ذخیره‌شده لیبل به سمت پایین می‌رفت و
    // وسط‌چین عمودی نبود). حالا که رندر ۱D به‌طور کامل SVG واقعیه (مثل ۲D)،
    // html2canvas خودش به‌درستی می‌گیرتش و کلاً نیازی به این hack نیست.

    // کل عرض/ارتفاع واقعی محتوا (حتی بخش‌های اسکرول‌شده) را بگیر
    const el = ref.current;
    const parent = el.parentElement;
    const prevParentOverflow = parent ? parent.style.overflowX : "";
    const prevElWidth = el.style.width;
    if (parent) parent.style.overflowX = "visible";
    el.style.width = "max-content";
    // force reflow
    const naturalWidth = Math.max(el.scrollWidth, el.offsetWidth, el.clientWidth);
    const naturalHeight = Math.max(el.scrollHeight, el.offsetHeight, el.clientHeight);

    return html2canvas(el, { 
      backgroundColor: "#0a0a0a",
      scale: 2,
      useCORS: true,
      logging: false,
      width: naturalWidth,
      height: naturalHeight,
      windowWidth: naturalWidth,
      windowHeight: naturalHeight,
      x: 0,
      y: 0,
      scrollX: 0,
      scrollY: 0,
    }).then(async (canvas) => {
      if (parent) parent.style.overflowX = prevParentOverflow;
      el.style.width = prevElWidth;
      const baseName = fileName.replace(/_1d|_2d/, match => match.toUpperCase());
      const subdir = baseName.includes("2d") || baseName.includes("2D") ? REFARSH_SAVE_DIRS.NEST_2D : REFARSH_SAVE_DIRS.NEST_1D;
      await saveFile(canvas.toDataURL("image/jpeg", 0.9), `${baseName}${getJalaliTimestamp()}.jpg`, { subdir });
      showToast(`عکس ${baseName.includes("2D") ? "۲D" : "۱D"} ذخیره شد`, "success");
    }).catch((e) => {
      if (parent) parent.style.overflowX = prevParentOverflow;
      el.style.width = prevElWidth;
      console.error("handleSaveAsJpg failed", e);
      showToast(`خطا در ذخیره عکس: ${e?.message || e}`, "error");
      throw e;
    });
  };

  // دکمه‌ی قرمز سراسری، مثل بقیه‌ی تب‌ها: هر دو نستینگ رو (اگه هردو باز/موجود بودن)
  // پشت‌سرهم ذخیره می‌کنه، وگرنه فقط همونی که فعلاً نمایش داده می‌شه.
  const [selectedStickIds, setSelectedStickIds] = useState([]);
  const [selectedPanelIds, setSelectedPanelIds] = useState([]);
  const [showLoadModal, setShowLoadModal] = useState(false);
  // کاربر: از لحظه‌ی زدن دکمه‌ی ذخیره‌ی عکس ۱D/۲D تا وقتی توست موفقیت میاد،
  // خودِ آیکون دکمه باید بچرخه (مثل دکمه‌ی سینک)
  const [savingTarget, setSavingTarget] = useState(null); // null | "1d" | "2d" | "both"
  const saveAsJpgWithSpinner = async (ref, fileName, targetKey) => {
    setSavingTarget(targetKey);
    try {
      await handleSaveAsJpg(ref, fileName);
    } catch (_) {
      // خودِ handleSaveAsJpg قبلاً toast خطا رو نشون داده، اینجا فقط از
      // unhandled rejection جلوگیری می‌کنیم
    } finally {
      setSavingTarget(null);
    }
  };

  const handleSaveAllAsJpg = async () => {
    const has1D = show1D && results1DRef.current;
    const has2D = show2D && results2DRef.current;
    if (!has1D && !has2D) {
      showToast("خطا: چیزی برای ذخیره به‌صورت تصویر نیست", "error");
      return;
    }
    setSavingTarget("both");
    try {
      if (has1D) { try { await handleSaveAsJpg(results1DRef, "nesting_1d"); } catch (_) {} }
      if (has2D) { try { await handleSaveAsJpg(results2DRef, "nesting_2d"); } catch (_) {} }
    } finally {
      setSavingTarget(null);
    }
  };

  const handleSaveLocalSession = () => {
    const hasValidFrame = frames?.some(f => f.w && toNum(f.w) > 0);
    const hasValidSticks = stickRows && stickRows.length > 0;
    const hasValidPanels = panelRows && panelRows.length > 0;

    if (!hasValidFrame && !hasValidSticks && !hasValidPanels) {
      showToast("خطا: جلسه خالی قابل ذخیره نیست. حداقل یک قاب، چوب یا پنل وارد کنید", "error");
      return;
    }
    onSaveSession({ frames, stockW, stockH, kerf, stickRows, stickKerf, panelRows, panelKerf, nestingMode });
  };

  const handleLoadSession = (session) => {
    if (!session || (!session.frames?.length && !session.stickRows?.length && !session.panelRows?.length)) {
      showToast("خطا در بارگذاری: داده‌های این جلسه معتبر یا کامل نیست", "error");
      return;
    }
    setFrames(session.frames || [emptyFrame()]);
    setStockW(session.stockW || "90");
    setStockH(session.stockH || "120");
    setKerf(session.kerf || "0.3");
    setStickRows(session.stickRows || []);
    setStickKerf(session.stickKerf || "0.3");
    setPanelRows(session.panelRows || []);
    setPanelKerf(session.panelKerf || "0.3");
    setNestingMode(session.nestingMode || "machine");
    setShowLoadModal(false);
    showToast("جلسه با موفقیت بارگذاری شد");
  };

  const kerfVal = r2(toNum(kerf));
  const stickKerfVal = r2(toNum(stickKerf));
  const panelKerfVal = r2(toNum(panelKerf));

  // ── Persist ──
  React.useEffect(() => {
    localStorage.setItem("refarsh_woodcutting_session", JSON.stringify({
      frames, stockW, stockH, kerf, show1D, show2D, stickRows, stickKerf, panelRows, panelKerf, nestingMode
    }));
    if (onStateChange) onStateChange({ frames, stockW, stockH, kerf, show1D, show2D, stickRows, stickKerf, panelRows, panelKerf, nestingMode });
  }, [frames, stockW, stockH, kerf, show1D, show2D, stickRows, stickKerf, panelRows, panelKerf, nestingMode, onStateChange]);

  // ── چوب‌های خطی ──
  const woodSticks = useMemo(() => {
    const result = [];
    stickRows.forEach(row => {
      const len = r2(toNum(row.length));
      const qty = Math.max(1, toNum(row.qty) || 1);
      if (len > 0) result.push({ length: len, qty, kerf: stickKerfVal });
    });
    return result;
  }, [stickRows, stickKerfVal]);

  // ── پنل‌های کاربر ──
  const userPanels = useMemo(() => {
    const result = [];
    panelRows.forEach(row => {
      const w = r2(toNum(row.w));
      const h = r2(toNum(row.h));
      if (w > 0 && h > 0) result.push({ w, h, qty: Math.max(1, toNum(row.qty) || 1) });
    });
    return result;
  }, [panelRows]);

  // ── قطعات قاب‌ها ──
  const allPieces = useMemo(() => {
    const result = [];
    frames.forEach((f) => {
      if (f.isCircle) return; // دایره‌ی کامل معنایی توی برش ۱D (تک‌چوب) نداره
      getFramePieces(
        f.type,
        toNum(f.w),
        toNum(f.h),
        r2(toNum(f.thickness)),
        toNum(f.qty) || 1,
        f.isSemiCircle || false
      ).forEach((p) => result.push({ ...p, frameId: f.id }));
    });
    return result;
  }, [frames]);

  // ── 1D ──
  const thicknessGroups = useMemo(() => {
    const groups = new Map();
    frames.forEach((f) => {
      const k = String(r2(toNum(f.thickness)));
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(f);
    });
    return groups;
  }, [frames]);

  const cuttingPlan = useMemo(() => {
    const plan = [];
    thicknessGroups.forEach((groupFrames, thicknessKey) => {
      const groupPieces = allPieces.filter((p) => groupFrames.some((f) => f.id === p.frameId));
      if (!groupPieces.length) return;

      const requiredPiecesList = groupPieces.map((p) => ({
        length: p.length,
        miterLeft: p.miterLeft || false,
        miterRight: p.miterRight || false,
        cutType: p.cutType || "none",
        thickness: parseFloat(thicknessKey),
      }));

      const result = optimizeCutting(
        woodSticks.map(s => ({ length: s.length, qty: s.qty })),
        requiredPiecesList,
        kerfVal
      );
      plan.push({ thicknessKey: parseFloat(thicknessKey), result });
    });
    return plan;
  }, [allPieces, woodSticks, kerfVal, thicknessGroups]);

  // هر ردیف حالا مستقل و به‌نسبت طول واقعی خودش دقیقاً ۱۰۰٪ عرض کادر
  // (plankContainerWidth) رسم می‌شه — نه یه مقیاس مشترک بر مبنای پرکارترین
  // چوب (که چوب‌های کوتاه‌تر رو باریک‌تر از ۱۰۰٪ نشون می‌داد). تنها استثنا:
  // اگه لیبل (عدد طول) کوچیک‌ترین قطعه‌ی یه ردیف با عرض طبیعی‌ش جا نشه، یه
  // «مقیاس سراسری» مشترک (روی همه‌ی ردیف‌ها یکسان، تا هم‌اندازه/یکدست
  // بمونن) اعمال می‌شه — دقیقاً به همون مقداری که لازمه تا اون یه لیبل جا
  // بشه، نه بیشتر. فقط همون‌جا (وقتی مقیاس از ۱ بیشتر بشه) کادر از ۱۰۰٪
  // بیرون می‌زنه و اسکرول افقی طبیعی واردعمل می‌شه.
  const PLANK_MAX_GLOBAL_SCALE = 4; // سقف معقول تا کشیده‌شدن مسخره نشه
  const plankGlobalScale = useMemo(() => {
    if (!plankContainerWidth) return 1;
    let maxRequired = 1;
    cuttingPlan.forEach(({ result }) => {
      (result.bins || []).forEach((bin) => {
        if (bin.unfulfilled || !bin.cuts?.length || !bin.stockLength) return;
        const wasteLength = bin.remaining > 0 ? r2(bin.remaining) : 0;
        const { pieceWidths } = computePlankRowLayout(bin.cuts, wasteLength, kerfVal, bin.stockLength, plankContainerWidth);
        bin.cuts.forEach((c, i) => {
          const needed = estimatePlankLabelWidthPx(c.length);
          if (pieceWidths[i] > 0 && pieceWidths[i] < needed) {
            const req = needed / pieceWidths[i];
            if (req > maxRequired) maxRequired = req;
          }
        });
      });
    });
    return Math.min(PLANK_MAX_GLOBAL_SCALE, maxRequired);
  }, [cuttingPlan, plankContainerWidth, kerfVal]);

  // ── 2D ──
  const nestingData = useMemo(() => {
    const panels = [];
    frames.forEach((f) => {
      if (f.type === FRAME_TYPES.SINGLE && f.isSemiCircle) {
        const d = toNum(f.w);
        if (!d) return;
        const t = r2(toNum(f.thickness));
        const addon = r2((t - 1) * 2);
        const sheetW = r2(d + addon);
        if (f.isCircle) {
          const sheetH = r2(d + addon);
          panels.push({ sheetW, sheetH, qty: toNum(f.qty) || 1, label: `${d}o`, isCircle: true });
          return;
        }
        const sheetH = r2(d / 2 + addon);
        panels.push({ sheetW, sheetH, qty: toNum(f.qty) || 1, label: `${d}D`, isSemiCircle: true });
        return;
      }
      const size = getBackingSheetSize(f.type, toNum(f.w), toNum(f.h), r2(toNum(f.thickness)));
      if (!size) return;
      panels.push({ sheetW: size.sheetW, sheetH: size.sheetH, qty: toNum(f.qty) || 1, label: `${f.w}×${f.h}`, isSemiCircle: false });
    });

    if (!panels.length) return null;

    return nestBackingPanels(panels, userPanels, panelKerfVal, nestingMode);
  }, [frames, userPanels, panelKerfVal, nestingMode]);

  const totalPieces = allPieces.length;
  const totalLen = r2(allPieces.reduce((s, p) => s + p.length, 0));

  const ToggleBtn = ({ label, value, onChange }) => (
    <button
      style={{
        ...T.chip,
        background: value ? "#2a1414" : "#1c1c1c",
        border: value ? "1px solid #8B1A1A" : "1px solid #2a2a2a",
        color: value ? "#d88888" : "#777",
        padding: "6px 12px",
        gap: 6,
      }}
      onClick={() => onChange(!value)}
    >
      {value ? <Eye size={14} /> : <EyeOff size={14} />}
      {label}
    </button>
  );

  const ColorGuide = () => (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 8, fontSize: 9.5, color: "#888" }}>
      <span><span style={{ display: "inline-block", width: 14, height: 14, borderRadius: 3, background: "#2196F3", verticalAlign: "middle", marginLeft: 4 }} /> دو طرف مایتر</span>
      <span><span style={{ display: "inline-block", width: 14, height: 14, borderRadius: 3, background: "#4CAF50", verticalAlign: "middle", marginLeft: 4 }} /> یک طرف مایتر</span>
      <span><span style={{ display: "inline-block", width: 14, height: 14, borderRadius: 3, background: "#F44336", verticalAlign: "middle", marginLeft: 4 }} /> بدون مایتر</span>
      <span><span style={{ display: "inline-block", width: 14, height: 14, borderRadius: 3, background: "#3a3a3a", border: "1px solid #555", verticalAlign: "middle", marginLeft: 4 }} /> باقیمانده</span>
    </div>
  );

  // ── RESET ALL ──
  const resetAll = () => {
    localStorage.removeItem("refarsh_woodcutting_session");
    const defaultState = {
      frames: [emptyFrame("2.5")],
      stockW: "90",
      stockH: "120",
      kerf: "0.3",
      stickRows: [],
      panelRows: [],
    };
    setFrames(defaultState.frames);
    setStockW(defaultState.stockW);
    setStockH(defaultState.stockH);
    setKerf(defaultState.kerf);
    setStickRows(defaultState.stickRows);
    setPanelRows(defaultState.panelRows);
  };

  // ── Stick handlers ──
  const addStickRow = () => setStickRows(prev => [...prev, { id: uid(), length: "", qty: "1" }]);
  const updateStickRow = (id, field, value) => setStickRows(prev => prev.map(row => row.id === id ? { ...row, [field]: value } : row));
  const deleteStickRow = (id) => setStickRows(prev => prev.filter(row => row.id !== id));

  const toggleStickSelection = (matId) => {
    setSelectedStickIds(prev => prev.includes(matId) ? prev.filter(id => id !== matId) : [...prev, matId]);
  };

  const importSelectedSticks = () => {
    const imported = [];
    materials.forEach(m => {
      if (selectedStickIds.includes(m.id) && m.type === "linear" && m.sticks) {
        m.sticks.forEach(s => {
          const len = r2(toNum(s.length));
          const qty = toNum(s.qty) || 1;
          if (len > 0) {
            const existing = imported.find(x => x.length === len);
            if (existing) existing.qty += qty;
            else imported.push({ id: uid(), length: len, qty });
          }
        });
      }
    });

    if (imported.length === 0) {
      alert("هیچ چوب معتبری برای وارد کردن انتخاب نشده است.");
      return;
    }

    const merged = [...stickRows];
    imported.forEach(imp => {
      const existing = merged.find(x => parseFloat(x.length) === imp.length);
      if (existing) existing.qty = (parseFloat(existing.qty) || 0) + imp.qty;
      else merged.push(imp);
    });
    setStickRows(merged);
    setShowStickPicker(false);
    setSelectedStickIds([]);
    alert(`${imported.length} نوع چوب خطی وارد شد.`);
  };

  // ── Panel handlers ──
  const addPanelRow = () => setPanelRows(prev => [...prev, { id: uid(), w: "", h: "", qty: "1" }]);
  const updatePanelRow = (id, field, value) => setPanelRows(prev => prev.map(row => row.id === id ? { ...row, [field]: value } : row));
  const deletePanelRow = (id) => setPanelRows(prev => prev.filter(row => row.id !== id));

  const togglePanelSelection = (matId) => {
    setSelectedPanelIds(prev => prev.includes(matId) ? prev.filter(id => id !== matId) : [...prev, matId]);
  };

  const importSelectedPanels = () => {
    const imported = [];
    materials.forEach(m => {
      if (selectedPanelIds.includes(m.id) && (m.type === "area" || m.type === "fabric") && m.batches) {
        m.batches.forEach(b => {
          const w = toNum(b.width);
          const h = toNum(b.height);
          if (w > 0 && h > 0) {
            imported.push({ id: uid(), w, h, qty: 1, isSemiCircle: false });
          }
        });
      }
    });

    if (imported.length === 0) {
      alert("هیچ پنل معتبری برای وارد کردن انتخاب نشده است.");
      return;
    }

    const merged = [...panelRows];
    imported.forEach(imp => {
      const existing = merged.find(x => parseFloat(x.w) === imp.w && parseFloat(x.h) === imp.h);
      if (existing) existing.qty = (parseFloat(existing.qty) || 0) + imp.qty;
      else merged.push(imp);
    });
    setPanelRows(merged);
    setShowPanelPicker(false);
    setSelectedPanelIds([]);
    alert(`${imported.length} نوع پنل وارد شد.`);
  };

  return (
    <>

      <style>{hideSpinStyles}</style>
      <div
        style={{
          position: "sticky",
          top: stickyTop,
          zIndex: 8,
          background: "#0a0a0a",
          padding: "8px 0 12px",
          marginBottom: 12,
        }}
      >
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <button style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "#161616", border: "1px solid #232323", borderRadius: 8, padding: "6px 10px", gap: 6, color: "#aaa", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }} onClick={handleSaveLocalSession}>
            <Save size={13} /> ذخیره جلسه
          </button>
          <button style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "#161616", border: "1px solid #232323", borderRadius: 8, padding: "6px 10px", gap: 6, color: "#aaa", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }} onClick={() => setShowLoadModal(true)}>
            <Upload size={13} /> بارگذاری
          </button>
        </div>
      </div>

      {/* دکمه‌ی شناور ذخیره‌ی تصویر — مثل دکمه‌ی قرمز + شناور، پایین صفحه (کنار دکمه‌ی افزودن اصلی) */}
      <button
        style={{
          position: "fixed",
          bottom: 20,
          right: 20,
          width: 52,
          height: 52,
          borderRadius: "50%",
          background: "#8B1A1A",
          border: "none",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 40,
          cursor: "pointer",
          boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
        }}
        title="ذخیره به‌صورت تصویر — هر کدوم از ۱D/۲D که فعال باشه"
        onClick={handleSaveAllAsJpg}
        disabled={savingTarget === "both"}
      >
        {savingTarget === "both" ? <RefreshCw size={20} className="animate-spin" /> : <ImageIcon size={20} />}
      </button>

      {showLoadModal && (
        <div style={modalOverlay}>
          <div style={modalContent}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#F5F0EB" }}>بارگذاری جلسه ذخیره شده</span>
              <button style={T.iconBtn} onClick={() => setShowLoadModal(false)}><X size={16} color="#aaa" /></button>
            </div>
            <div style={{ maxHeight: 300, overflowY: "auto" }}>
              {woodCuttingSessions && woodCuttingSessions.length > 0 ? (
                [...woodCuttingSessions].sort((a,b) => b.timestamp - a.timestamp).map((s, idx) => (
                  <div key={s.id || idx} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid #1a1a1a" }}>
                    <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => handleLoadSession(s)}>
                      <Clock size={14} color="#666" />
                      <div>
                        <div style={{ fontSize: 11, color: "#ddd" }}>جلسه {woodCuttingSessions.length - idx}</div>
                        <div style={{ fontSize: 9, color: "#555" }}>{new Date(s.timestamp).toLocaleString("fa-IR")}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 9, color: "#8B1A1A", marginRight: 8 }}>{s.frames?.length || 0} قاب</div>
                    <button style={{ ...T.iconBtn, color: "#8B1A1A" }} onClick={(e) => { e.stopPropagation(); onDeleteSession && onDeleteSession(s.id); }}>
                      <X size={14} />
                    </button>
                  </div>
                ))
              ) : (
                <div style={{ textAlign: "center", padding: "20px 0", fontSize: 11, color: "#555" }}>هیچ جلسه ذخیره شده‌ای یافت نشد.</div>
              )}
            </div>
          </div>
        </div>
      )}

      <div style={{ paddingBottom: 80 }} dir="rtl">
        {totalPieces > 0 && (
          <div style={{ display: "flex", gap: 8, marginBottom: 12, background: "#111", border: "1px solid #1e1e1e", borderRadius: 9, padding: "9px 12px" }}>
            <StatPill label="قطعات" value={totalPieces} />
            <StatPill label="جمع طول" value={`${totalLen} سانت`} />
            {woodSticks.length > 0 && cuttingPlan.length > 0 && (
              <StatPill label="چوب مصرفی" value={cuttingPlan.reduce((s, p) => s + p.result.usedSticks, 0)} />
            )}
          </div>
        )}

        {/* ── قاب‌ها ── */}
        <div style={T.sectionLabel}>قاب‌ها</div>
        {frames.map((f) => (
          <FrameRow key={f.id} frame={f}
            onChange={(upd) => setFrames(prev => prev.map(x => x.id === f.id ? upd : x))}
            onDelete={() => setFrames(prev => prev.filter(x => x.id !== f.id))}
            kerfVal={kerfVal}
            onLinkProduct={() => setShowProductPicker(f.id)}
          />
        ))}

        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {(() => {
            let canAddFrame = true;
            if (frames.length > 0) {
              const last = frames[frames.length - 1];
              const hasW = toNum(last.w) > 0;
              const hasH = toNum(last.h) > 0;
              const hasDim = last.type === FRAME_TYPES.SINGLE ? hasW : (hasW && hasH);
              const hasThickness = toNum(last.thickness) > 0;
              const hasQty = toNum(last.qty) > 0;
              canAddFrame = hasDim && hasThickness && hasQty;
            }
            return (
              <button 
                style={{ 
                  flex: 1, 
                  background: "#1c1c1c", 
                  border: "1px dashed #2a2a2a", 
                  color: canAddFrame ? "#7aa8d8" : "#444", 
                  borderRadius: 9, 
                  padding: "10px 0", 
                  fontFamily: "inherit", 
                  fontSize: 11, 
                  cursor: canAddFrame ? "pointer" : "not-allowed", 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center", 
                  gap: 6,
                  opacity: canAddFrame ? 1 : 0.6
                }}
                onClick={() => {
                  if (canAddFrame) {
                    const lastT = frames.length ? frames[frames.length - 1].thickness : null;
                    setFrames(prev => [...prev, emptyFrame(lastT || "2.5")]);
                  } else {
                    showToast("لطفا ابتدا فیلدهای الزامی (ابعاد، ضخامت، تعداد) قاب قبلی را کامل کنید", "error");
                  }
                }}>
                <Plus size={13} />افزودن قاب
              </button>
            );
          })()}
          <button
            style={{
              background: "#1c1414",
              border: "1px solid #3a1d1d",
              color: "#e08a8a",
              borderRadius: 9,
              padding: "10px 14px",
              fontFamily: "inherit",
              fontSize: 11,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
            onClick={resetAll}
          >
            <RotateCcw size={13} />ریست
          </button>
        </div>

        {showProductPicker && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
            <div style={{ width: "100%", maxWidth: 480, background: "#181818", borderRadius: "16px 16px 0 0", maxHeight: "70vh", overflow: "auto" }} dir="rtl">
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 14px", borderBottom: "1px solid #1e1e1e", position: "sticky", top: 0, background: "#181818" }}>
                <button style={{ background: "none", border: "none", color: "#666", cursor: "pointer", fontSize: 16 }} onClick={() => setShowProductPicker(null)}>✕</button>
                <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: "#F5F0EB" }}>انتخاب محصول برای وارد کردن ابعاد</span>
              </div>
              <div style={{ padding: "8px 14px 20px" }}>
                {(products || []).filter((p) => p.dims).map((p) => (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: "1px solid #1a1a1a", cursor: "pointer" }}
                      onClick={() => {
                        const parsed = p.dims ? p.dims.replace("×", "x").split("x") : [];
                        let w = parsed[0] ? parsed[0].trim() : "";
                        let h = parsed[1] ? parsed[1].trim() : "";
                        const isCircle = p.shape === "circle" || (p.dims || "").toUpperCase().endsWith("O");
                        const isSemi = !isCircle && (p.shape === "semi-circle" || (p.dims || "").toUpperCase().endsWith("D"));
                        let frameUpdate = { w, h, linkedProductCode: p.code };
                        if (isSemi || isCircle) {
                          frameUpdate = { 
                            ...frameUpdate, 
                            type: FRAME_TYPES.SINGLE, 
                            isSemiCircle: true,
                            isCircle,
                            w: w.replace(/-?[DO]/i, "").trim(), 
                            h: ""
                          };
                        } else {
                          frameUpdate = {
                            ...frameUpdate,
                            type: FRAME_TYPES.FOUR_SIDE,
                            isSemiCircle: false,
                            isCircle: false
                          };
                        }
                        setFrames(prev => prev.map(f => f.id === showProductPicker ? { ...f, ...frameUpdate } : f));
                        setShowProductPicker(null);
                      }}>
                    <span style={{ fontSize: 9, color: "#8B1A1A", flexShrink: 0 }}>#{fmtCode(p.code)}</span>
                    <span style={{ fontSize: 11, color: "#ddd", flex: 1 }}>{p.name}</span>
                    <span style={{ fontSize: 10, color: "#7ec7e8", flexShrink: 0 }}>{formatProductDims(p)} سانت</span>
                  </div>
                ))}
                {!(products || []).filter((p) => p.dims).length && (
                  <div style={{ fontSize: 11, color: "#444", padding: "20px 0", textAlign: "center" }}>محصولی با ابعاد ثبت‌شده وجود ندارد</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── چوب‌های خطی ── */}
        <div style={{ background: "#101010", border: "1px solid #1e1e1e", borderRadius: 10, padding: "12px 14px", marginTop: 36 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#aaa", display: "flex", alignItems: "center" }}>
              <Package size={13} style={{ marginLeft: 5 }} /> چوب‌های خطی (موجودی)
            </div>
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <span style={{ fontSize: 9, color: "#666" }}>کرِف:</span>
              <input onFocus={(e) => e.target.select()} style={{ ...T.input, width: 50, height: 28, fontSize: 10, textAlign: "center" }} type="number" step="0.01" min="0"
                value={stickKerf} onChange={e => setStickKerf(e.target.value)} />
              <span style={{ fontSize: 9, color: "#555" }}>سانت</span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
            <button style={{ ...T.chip, fontSize: 9, padding: "3px 8px", background: "#2a1414", border: "1px solid #8B1A1A", color: "#d88888" }} onClick={addStickRow}>
              <Plus size={12} /> افزودن سایز
            </button>
            <button style={{ ...T.chip, fontSize: 9, padding: "3px 8px" }} onClick={() => setShowStickPicker(true)}>
              <Download size={12} /> انتخاب از متریال
            </button>
          </div>

          {stickRows.length === 0 ? (
            <div style={{ fontSize: 10, color: "#444", padding: "10px 0", textAlign: "center", border: "1px dashed #2a2a2a", borderRadius: 6 }}>
              هیچ چوب خطی تعریف نشده — دکمه‌ی «افزودن سایز» را بزنید.
            </div>
          ) : (
            stickRows.map(row => (
              <div key={row.id} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
                <input onFocus={(e) => e.target.select()} style={{ ...T.input, width: "60%", height: 28, fontSize: 10 }} type="number" step="0.1" placeholder="طول (سانت)"
                  value={row.length} onChange={e => updateStickRow(row.id, "length", e.target.value)} />
                <input onFocus={(e) => e.target.select()} style={{ ...T.input, width: "25%", height: 28, fontSize: 10, textAlign: "center" }} type="number" min="1" placeholder="تعداد"
                  value={row.qty} onChange={e => updateStickRow(row.id, "qty", e.target.value)} />
                <button style={{ width: "15%", background: "transparent", border: "none", color: "#e08a8a", cursor: "pointer", padding: "4px", display: "flex", justifyContent: "center" }} onClick={() => deleteStickRow(row.id)}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* ── مودال انتخاب چوب خطی ── */}
        {showStickPicker && (
          <div style={modalOverlay}>
            <div style={modalContent}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#F5F0EB" }}>انتخاب چوب‌های خطی از متریال‌ها</span>
                <button style={T.iconBtn} onClick={() => { setShowStickPicker(false); setSelectedStickIds([]); }}><X size={16} color="#aaa" /></button>
              </div>
              <div style={{ maxHeight: 300, overflowY: "auto", marginBottom: 12 }}>
                {materials.filter(m => m.type === "linear").map(m => (
                  <label key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid #1a1a1a", cursor: "pointer" }}>
                    <input type="checkbox" checked={selectedStickIds.includes(m.id)} onChange={() => toggleStickSelection(m.id)} />
                    <span style={{ fontSize: 11, color: "#ddd" }}>{m.name}</span>
                    <span style={{ fontSize: 9.5, color: "#666", marginRight: "auto" }}>{m.sticks?.length || 0} نوع چوب</span>
                  </label>
                ))}
                {materials.filter(m => m.type === "linear").length === 0 && (
                  <div style={{ fontSize: 11, color: "#555", padding: "10px 0", textAlign: "center" }}>هیچ متریال خطی در سیستم موجود نیست.</div>
                )}
              </div>
              <button style={{ width: "100%", background: "#8B1A1A", border: "none", color: "#fff", borderRadius: 8, padding: "10px 0", cursor: "pointer", fontFamily: "inherit", fontSize: 11 }}
                onClick={importSelectedSticks}>
                وارد کردن موارد انتخاب‌شده
              </button>
            </div>
          </div>
        )}

        {/* ── برنامه برش ۱D ── */}
        {cuttingPlan.length > 0 && woodSticks.length > 0 && (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8, marginBottom: 4 }}>
              <div style={{ ...T.sectionLabel, margin: 0 }}>برنامه برش ۱D</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}><button style={{ ...T.iconBtn, color: "#8B1A1A" }} title="ذخیره به صورت تصویر" disabled={savingTarget === "1d" || savingTarget === "both"} onClick={() => saveAsJpgWithSpinner(results1DRef, "nesting_1d", "1d")}>{(savingTarget === "1d" || savingTarget === "both") ? <RefreshCw size={16} className="animate-spin" /> : <ImageIcon size={16} />}</button><ToggleBtn label="نمایش ۱D" value={show1D} onChange={setShow1D} /></div>
            </div>
{show1D && (
              <div ref={plankContainerRef} style={{ width: "100%", maxWidth: "100%", overflowX: "auto", boxSizing: "border-box", WebkitOverflowScrolling: "touch" }}>
              <div ref={results1DRef} style={{ width: "max-content", minWidth: "100%", margin: "0 auto", padding: "4px 2px", boxSizing: "border-box" }}>
                {cuttingPlan.map(({ thicknessKey, result }, index) => (
              <div key={thicknessKey} style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 9, padding: "10px 12px", marginBottom: 8 }}>
                {index === 0 && (
                  <div style={{ marginBottom: 12, borderBottom: "1px solid #1e1e1e", paddingBottom: 10 }}>
                    <ColorGuide />
                  </div>
                )}
                    
                <div style={{ fontSize: 10, color: "#666", marginBottom: 8 }}>
                  ضخامت {thicknessKey} — {result.usedSticks} چوب
                </div>
                {result.unfulfilledCount > 0 && (
                  // فونت/آیکون هم‌اندازه‌ی خطای کمبود ۲D شد (قبلاً 10px/۱۴px بود،
                  // بزرگ‌تر از ۲D بود و چون متن روی یک خط بود، عرض کادر ۱D رو با
                  // خودش می‌کشید بزرگ‌تر — الان maxWidth = عرض واقعی کادر (همون
                  // plankContainerWidth) گرفته و متن wrap می‌شه، پس دیگه چیزی رو
                  // کش نمیاد (Ash 🟡)
                  <div style={{ marginBottom: 10, padding: "6px 10px", background: "#3a1d1d", border: "1px solid #8B1A1A", borderRadius: 6, maxWidth: plankContainerWidth || "100%", boxSizing: "border-box" }}>
                    <span style={{ fontSize: 9.5, color: "#e08a8a", fontWeight: 500, display: "flex", alignItems: "flex-start", gap: 6 }}>
                      <svg width="12" height="12" style={{ flexShrink: 0, marginTop: 1 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
                      <span style={{ flex: 1, minWidth: 0, whiteSpace: "normal", wordBreak: "break-word" }}>
                        خطای کمبود متریال (بدون چوب مناسب) — {
                          Array.from(
                            result.bins.filter((b) => b.unfulfilled).reduce((acc, b) => {
                              const len = b.cuts[0]?.length;
                              acc.set(len, (acc.get(len) || 0) + 1);
                              return acc;
                            }, new Map())
                          ).map(([len, qty]) => `${len} سانت (${qty} عدد)`).join(" ، ")
                        }
                      </span>
                    </span>
                  </div>
                )}
                {(() => {
                  let prevStockLength = null;
                  return result.bins.filter((b) => !b.unfulfilled).map((bin, bi) => {
                  const cuts = bin.cuts.map((c) => ({
                    length: c.length,
                    miterLeft: c.miterLeft || false,
                    miterRight: c.miterRight || false,
                    cutType: c.cutType || "none",
                    flipped: c.flipped || false,
                    overlap: c.overlap || 0,
                  }));
                  // bin.remaining is tracked incrementally by the optimizer and
                  // already accounts for kerf AND any matched-miter overlap
                  // savings, so it's the accurate leftover — recomputing it
                  // with a naive sum ignored the overlap savings.
                  const endScrap = bin.stockLength ? Math.max(0, r2(bin.remaining)) : 0;
                  // خط نازک جداکننده بین چوب‌هایی با طول اصلی متفاوت (مثلاً
                  // ۱۵۰ سانتی بعد ۲۰۰ سانتی) — فقط یه راهنمای بصری کم‌رنگ که
                  // ذهن بفهمه از اینجا به بعد سایز چوب‌ها فرق کرده
                  const showDivider = prevStockLength != null && bin.stockLength && bin.stockLength !== prevStockLength;
                  prevStockLength = bin.stockLength || prevStockLength;
                  return (
                    <div key={bi} style={{ marginBottom: 2 }}>
                      {showDivider && (
                        <div style={{ borderTop: "1px dashed #333", margin: "8px 0" }} />
                      )}
                      <PlankRow
                          rowNumber={bi + 1}
                          stockLength={bin.stockLength}
                          cuts={cuts}
                          kerfVal={kerfVal}
                          wasteLength={endScrap}
                          thickness={thicknessKey}
                          targetWidthPx={Math.max(80, Math.max(0, (plankContainerWidth || 300) - 28) * 0.98)}
                        />
                    </div>
                  );
                  });
                })()}
              </div>
            ))}
              </div>
              </div>
            )}
          </>
        )}

        {/* ── پنل‌های صفحه پشت کار ── */}
        <div style={{ background: "#101010", border: "1px solid #1e1e1e", borderRadius: 10, padding: "12px 14px", marginTop: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#aaa", display: "flex", alignItems: "center" }}>
              <Package size={13} style={{ marginLeft: 5 }} /> پنل‌های صفحه پشت کار
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button
                onClick={() => setNestingMode(prev => prev === "machine" ? "manual" : "machine")}
                style={{
                  ...T.chip,
                  fontSize: 9.5,
                  padding: "4px 8px",
                  height: 28,
                  borderColor: nestingMode === "manual" ? "#8B1A1A" : "#2a2a2a",
                  background: nestingMode === "manual" ? "#2a1414" : "#121212",
                  color: nestingMode === "manual" ? "#d88888" : "#888",
                  transition: "all 0.15s ease-in-out"
                }}
              >
                {nestingMode === "machine" ? "⚙️ برش دستگاه" : "🪵 برش دستی"}
              </button>
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                <span style={{ fontSize: 9, color: "#666" }}>کرِف:</span>
                <input onFocus={(e) => e.target.select()} style={{ ...T.input, width: 50, height: 28, fontSize: 10, textAlign: "center" }} type="number" step="0.01" min="0"
                  value={panelKerf} onChange={e => setPanelKerf(e.target.value)} />
                <span style={{ fontSize: 9, color: "#555" }}>سانت</span>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
            <button style={{ ...T.chip, fontSize: 9, padding: "3px 8px", background: "#2a1414", border: "1px solid #8B1A1A", color: "#d88888" }} onClick={addPanelRow}>
              <Plus size={12} /> افزودن سایز
            </button>
            <button style={{ ...T.chip, fontSize: 9, padding: "3px 8px" }} onClick={() => setShowPanelPicker(true)}>
              <Download size={12} /> انتخاب از متریال
            </button>
          </div>

          {panelRows.length === 0 ? (
            <div style={{ fontSize: 10, color: "#444", padding: "10px 0", textAlign: "center", border: "1px dashed #2a2a2a", borderRadius: 6 }}>
              هیچ پنلی تعریف نشده — دکمه‌ی «افزودن سایز» را بزنید.
            </div>
          ) : (
            panelRows.map(row => (
              <div key={row.id} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
                <input onFocus={(e) => e.target.select()} style={{ ...T.input, width: "28%", height: 28, fontSize: 10 }} type="number" step="0.1" placeholder="عرض"
                  value={row.w} onChange={e => updatePanelRow(row.id, "w", e.target.value)} />
                <span style={{ color: "#444", fontSize: 12, width: "4%", textAlign: "center", display: "inline-block" }}>×</span>
                <input onFocus={(e) => e.target.select()} style={{ ...T.input, width: "28%", height: 28, fontSize: 10 }} type="number" step="0.1" placeholder="ارتفاع"
                  value={row.h} onChange={e => updatePanelRow(row.id, "h", e.target.value)} />
                <input onFocus={(e) => e.target.select()} style={{ ...T.input, width: "25%", height: 28, fontSize: 10, textAlign: "center" }} type="number" min="1" placeholder="تعداد"
                  value={row.qty} onChange={e => updatePanelRow(row.id, "qty", e.target.value)} />
                <button style={{ width: "15%", background: "transparent", border: "none", color: "#e08a8a", cursor: "pointer", padding: "4px", display: "flex", justifyContent: "center" }} onClick={() => deletePanelRow(row.id)}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* ── مودال انتخاب پنل ── */}
        {showPanelPicker && (
          <div style={modalOverlay}>
            <div style={modalContent}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#F5F0EB" }}>انتخاب پنل‌ها از متریال‌ها</span>
                <button style={T.iconBtn} onClick={() => { setShowPanelPicker(false); setSelectedPanelIds([]); }}><X size={16} color="#aaa" /></button>
              </div>
              <div style={{ maxHeight: 300, overflowY: "auto", marginBottom: 12 }}>
                {materials.filter(m => m.type === "area" || m.type === "fabric").map(m => (
                  <label key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid #1a1a1a", cursor: "pointer" }}>
                    <input type="checkbox" checked={selectedPanelIds.includes(m.id)} onChange={() => togglePanelSelection(m.id)} />
                    <span style={{ fontSize: 11, color: "#ddd" }}>{m.name}</span>
                    <span style={{ fontSize: 9.5, color: "#666", marginRight: "auto" }}>{m.batches?.length || 0} بچ</span>
                  </label>
                ))}
                {materials.filter(m => m.type === "area" || m.type === "fabric").length === 0 && (
                  <div style={{ fontSize: 11, color: "#555", padding: "10px 0", textAlign: "center" }}>هیچ متریال مساحتی در سیستم موجود نیست.</div>
                )}
              </div>
              <button style={{ width: "100%", background: "#8B1A1A", border: "none", color: "#fff", borderRadius: 8, padding: "10px 0", cursor: "pointer", fontFamily: "inherit", fontSize: 11 }}
                onClick={importSelectedPanels}>
                وارد کردن موارد انتخاب‌شده
              </button>
            </div>
          </div>
        )}

        {/* ── نستینگ ۲D ── */}
        {nestingData && panelRows.length > 0 && (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16, marginBottom: 8 }}>
              <div style={{ ...T.sectionLabel, margin: 0 }}>پانل صفحه پشت کار — نستینگ ۲D</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button style={{ ...T.iconBtn, color: "#8B1A1A" }} title="ذخیره به صورت تصویر" disabled={savingTarget === "2d" || savingTarget === "both"} onClick={() => saveAsJpgWithSpinner(results2DRef, "nesting_2d", "2d")}>{(savingTarget === "2d" || savingTarget === "both") ? <RefreshCw size={16} className="animate-spin" /> : <ImageIcon size={16} />}</button>
                <ToggleBtn label="نمایش ۲D" value={show2D} onChange={setShow2D} />
              </div>
            </div>
            {show2D && (
              <div ref={results2DRef} style={{ width: "100%", maxWidth: "100%", margin: "0 auto", boxSizing: "border-box" }}>
                <div style={{ display: "flex", gap: 10, marginBottom: 10, background: "#111", border: "1px solid #1e1e1e", borderRadius: 8, padding: "8px 12px" }}>
                  <StatPill label="صفحات مصرفی" value={nestingData.sheetCount} />
                  <StatPill label="پانل‌ها" value={nestingData.layouts.reduce((s, l) => s + l.placements.length, 0)} />
                </div>
                {nestingData.unfulfilled && nestingData.unfulfilled.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 0" }}>
                      <span style={{ fontSize: 9, color: "#e08a8a" }}>
                        ⛔ بدون پنل مناسب — {
                          Array.from(
                            nestingData.unfulfilled.reduce((acc, p) => {
                              acc.set(p.label, (acc.get(p.label) || 0) + 1);
                              return acc;
                            }, new Map())
                          ).map(([label, qty]) => `${label} (${qty} عدد)`).join(" ، ")
                        }
                      </span>
                    </div>
                  </div>
                )}
                {(() => {
                  let prevSheetKey = null;
                  return nestingData.layouts.map((layout, i) => {
                    const sheetKey = `${layout.stockW}x${layout.stockH}`;
                    const showDivider = prevSheetKey != null && sheetKey !== prevSheetKey;
                    prevSheetKey = sheetKey;
                    return (
                      <React.Fragment key={i}>
                        {showDivider && (
                          <div style={{ borderTop: "1px dashed #333", margin: "8px 0" }} />
                        )}
                        <NestingVisualizer layout={layout} stockW={layout.stockW} stockH={layout.stockH} sheetIdx={i} mode={nestingMode} />
                      </React.Fragment>
                    );
                  });
                })()}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}


