// ============================================================
// AccountingTab.jsx - Refarsh Clean (با رفع خطای todayISO)
// ============================================================
import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { scrollAppToTop } from "../utils/scrollToTop";
import {
  TrendingUp, TrendingDown, Wallet, PiggyBank,
  Calculator, ChevronDown, ChevronUp,
  Upload, Download, X, Copy, Check, FolderOpen, Save, FileText,
  Search, Edit3, Trash2, Calendar, Eye, Printer, Gift, Clock, ShoppingCart,
} from "lucide-react";
import * as XLSX from "xlsx";
import { toNum, fmt, fmtCode, fmtDate, todayISO, safeEvalExpr, calcROI, safeDivide, serviceROI, formatProductDims, qtySuffix, toPersianDigits } from "../mathCore";
import { JalaliDatePicker } from "./JalaliDatePicker";
import { FilterPopup } from "./FilterPopup";
import InvoicePrint from "./InvoicePrint";
import InvoicesTab from "./InvoicesTab";
import { useRegisterOpenModal } from "../utils/modalRegistry";

const T = {
  card: {
    background: "#161616",
    border: "1px solid #232323",
    borderRadius: 10,
    padding: "12px 14px",
    marginBottom: 9,
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: 11,
    color: "#888",
    padding: "4px 0",
  },
  sectionLabel: {
    fontSize: 9.5,
    color: "#555",
    fontWeight: 600,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    margin: "14px 0 7px",
  },
  iconBtn: {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    padding: "4px 6px",
    display: "flex",
    alignItems: "center",
  },
  chip: {
    background: "#1c1c1c",
    border: "1px solid #2a2a2a",
    color: "#888",
    fontSize: 10,
    padding: "2px 9px",
    borderRadius: 11,
    cursor: "pointer",
    fontFamily: "inherit",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    whiteSpace: "nowrap",
    minHeight: 22,
    height: 22,
    boxSizing: "border-box",
  },
};

// ── Floating Calculator ──
function FloatingCalc({ onClose }) {
  const [expr, setExpr] = useState("");
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState([]);

  const TOKEN_MAP = { "×": "*", "÷": "/" };

  const appendToken = (t) => {
    setExpr((e) => e + (TOKEN_MAP[t] ?? t));
    setResult(null);
  };
  const evaluate = () => {
    if (!expr.trim()) return;
    const r = safeEvalExpr(expr);
    setResult(r);
    if (r != null) {
      setHistory((h) => [`${expr} = ${Math.round(r * 10000) / 10000}`, ...h].slice(0, 3));
    }
  };
  const clearAll = () => {
    setExpr("");
    setResult(null);
  };
  const backspace = () => {
    setExpr((e) => e.slice(0, -1));
    setResult(null);
  };

  const copyResult = useCallback(() => {
    const val = result != null ? String(Math.round(result * 1000000) / 1000000) : expr;
    const legacyCopy = (text) => {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.cssText = "position:fixed;opacity:0;";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      try {
        document.execCommand("copy");
      } catch (_) {}
      document.body.removeChild(ta);
    };
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(val).catch(() => legacyCopy(val));
    } else {
      legacyCopy(val);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }, [result, expr]);

  const KEY_ROWS = [
    ["(", ")", "%", "⌫"],
    ["7", "8", "9", "÷"],
    ["4", "5", "6", "×"],
    ["1", "2", "3", "-"],
    ["0", ".", "=", "+"],
  ];

  const keyStyle = (k) => {
    const isOp = ["÷", "×", "+", "-", "%", "(", ")"].includes(k);
    const isEq = k === "=";
    const isCl = k === "C";
    const isBs = k === "⌫";
    return {
      background: isEq ? "#8B1A1A" : isCl ? "#2a1414" : isBs ? "#1e1414" : isOp ? "#1e1e1e" : "#1c1c1c",
      border: `1px solid ${isEq ? "#8B1A1A" : "#2a2a2a"}`,
      color: isEq ? "#fff" : isCl ? "#e08a8a" : isBs ? "#c09090" : isOp ? "#c09090" : "#F5F0EB",
      borderRadius: 8,
      padding: "12px 0",
      fontFamily: "inherit",
      fontSize: 16,
      cursor: "pointer",
    };
  };

  const handleKey = (k) => {
    if (k === "=") evaluate();
    else if (k === "C") clearAll();
    else if (k === "⌫") backspace();
    else appendToken(k);
  };

  return (
    <div
      style={{
        background: "#181414",
        border: "1px solid #2a1c1c",
        borderRadius: 14,
        padding: 14,
        width: "100%",
        maxWidth: 310,
      }}
      dir="ltr"
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10,
        }}
      >
        <span style={{ fontSize: 10.5, color: "#666", fontFamily: "inherit" }}>
          ماشین‌حساب کارگاه
        </span>
        {onClose && (
          <button style={T.iconBtn} onClick={onClose}>
            <X size={14} color="#555" />
          </button>
        )}
      </div>

      <div
        style={{
          background: "#0e0e0e",
          borderRadius: 10,
          padding: "10px 12px 8px",
          marginBottom: 10,
          minHeight: 58,
        }}
      >
        <div
          style={{
            fontSize: 18,
            color: "#F5F0EB",
            overflowX: "auto",
            whiteSpace: "nowrap",
            textAlign: "right",
            minHeight: 26,
            direction: "ltr",
          }}
        >
          {expr || "۰"}
        </div>
        {result != null && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 5,
              paddingTop: 5,
              borderTop: "1px solid #1e1e1e",
            }}
          >
            <span style={{ fontSize: 15, color: "#5fd180", fontWeight: 700, direction: "ltr" }}>
              = {Math.round(result * 10000) / 10000}
            </span>
            <button
              style={{
                background: copied ? "#1d3a24" : "transparent",
                border: `1px solid ${copied ? "#2d5a38" : "#2a2a2a"}`,
                borderRadius: 6,
                cursor: "pointer",
                color: copied ? "#5fd180" : "#888",
                fontSize: 10.5,
                fontFamily: "inherit",
                display: "flex",
                alignItems: "center",
                gap: 4,
                padding: "3px 8px",
                transition: "all 0.2s",
              }}
              onClick={copyResult}
            >
              {copied ? <Check size={11} /> : <Copy size={11} />}
              {copied ? "کپی شد" : "کپی"}
            </button>
          </div>
        )}
      </div>

      {history.length > 0 &&
        history.map((h, i) => (
          <div
            key={i}
            style={{
              fontSize: 9.5,
              color: "#3a3a3a",
              textAlign: "right",
              direction: "ltr",
              lineHeight: 1.6,
            }}
          >
            {h}
          </div>
        ))}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginTop: 8 }}>
        {KEY_ROWS.flat().map((k, i) => (
          <button key={i} style={keyStyle(k)} onClick={() => handleKey(k)}>
            {k}
          </button>
        ))}
        <button style={{ ...keyStyle("C"), gridColumn: "1 / -1", padding: "9px 0" }} onClick={clearAll}>
          C — پاک
        </button>
      </div>
    </div>
  );
}

function MonthlyChart({ monthlyProfit }) {
  const [activeIdx, setActiveIdx] = useState(null);

  // سال‌هایی که واقعاً داده دارن (استخراج از sortKey مثل "1404-07")، مرتب‌شده
  const years = useMemo(() => {
    const set = new Set((monthlyProfit || []).map((m) => m.sortKey.split("-")[0]));
    return Array.from(set).sort();
  }, [monthlyProfit]);

  const [selectedYear, setSelectedYear] = useState(null);
  const effectiveYear = selectedYear || years[years.length - 1] || null;
  const yearIdx = years.indexOf(effectiveYear);

  if (!monthlyProfit?.length) {
    return (
      <div style={{ fontSize: 10, color: "#333", padding: "10px 0", textAlign: "center" }}>
        داده‌ای برای نمودار وجود ندارد — تاریخ فروش را در محصولات وارد کن
      </div>
    );
  }

  const yearData = monthlyProfit.filter((m) => m.sortKey.startsWith(effectiveYear + "-"));
  const maxAbs = Math.max(...yearData.map((m) => Math.abs(m.profit)), 1);
  const BAR_MAX_H = 68;

  return (
    <div>
      {years.length > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 8 }}>
          <button
            disabled={yearIdx <= 0}
            onClick={() => { setSelectedYear(years[yearIdx - 1]); setActiveIdx(null); }}
            style={{ background: "transparent", border: "none", color: yearIdx <= 0 ? "#333" : "#aaa", fontSize: 15, cursor: yearIdx <= 0 ? "default" : "pointer", padding: "0 6px" }}
          >
            &#8249;
          </button>
          <span style={{ fontSize: 11.5, color: "#ddd", fontWeight: 600, minWidth: 44, textAlign: "center" }}>
            {toPersianDigits(effectiveYear)}
          </span>
          <button
            disabled={yearIdx >= years.length - 1}
            onClick={() => { setSelectedYear(years[yearIdx + 1]); setActiveIdx(null); }}
            style={{ background: "transparent", border: "none", color: yearIdx >= years.length - 1 ? "#333" : "#aaa", fontSize: 15, cursor: yearIdx >= years.length - 1 ? "default" : "pointer", padding: "0 6px" }}
          >
            &#8250;
          </button>
        </div>
      )}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 4,
          overflowX: "auto",
          paddingBottom: 6,
          scrollbarWidth: "none",
          minHeight: BAR_MAX_H + 28,
          WebkitOverflowScrolling: "touch",
        }}
      >
        {yearData.map((m, i) => {
          const isActive = activeIdx === i;
          const barH = Math.max(4, (Math.abs(m.profit) / maxAbs) * BAR_MAX_H);
          const isPositive = m.profit >= 0;
          const label = m.monthName;
          return (
            <button
              key={m.month}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
                background: "transparent",
                border: "none",
                cursor: "pointer",
                flexShrink: 0,
                minWidth: 26,
                padding: 0,
              }}
              onClick={() => setActiveIdx((a) => (a === i ? null : i))}
            >
              <div style={{ height: BAR_MAX_H, display: "flex", alignItems: "flex-end" }}>
                <div
                  style={{
                    width: 16,
                    height: barH,
                    background: isActive ? "#F5F0EB" : isPositive ? "#8B1A1A" : "#2a1414",
                    borderRadius: "3px 3px 0 0",
                    border: isActive ? "none" : `1px solid ${isPositive ? "#5a1a1a" : "#1e1e1e"}`,
                    transition: "background 0.15s",
                  }}
                />
              </div>
              <span style={{ fontSize: 8, color: isActive ? "#aaa" : "#444" }}>{label}</span>
            </button>
          );
        })}
      </div>
      {activeIdx != null && yearData[activeIdx] && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 4,
            fontSize: 10.5,
            marginTop: 6,
            paddingTop: 8,
            borderTop: "1px solid #1e1e1e",
            color: "#aaa",
          }}
        >
          <span style={{ color: "#666" }}>{yearData[activeIdx].month}</span>
          <span>درآمد: {fmt(yearData[activeIdx].revenue)} ت</span>
          <span>هزینه: {fmt(yearData[activeIdx].cost)} ت</span>
          <span
            style={{
              color: yearData[activeIdx].profit >= 0 ? "#5fd180" : "#e08a8a",
              fontWeight: 600,
            }}
          >
            سود: {fmt(yearData[activeIdx].profit)} ت
          </span>
        </div>
      )}
    </div>
  );
}

function DrillDown({ products, customers, label, accentColor }) {
  const [open, setOpen] = useState(false);
  const scrollRef = useRef(null);
  const custMap = useMemo(() => {
    const m = {};
    (customers || []).forEach((c) => (m[c.id] = c));
    return m;
  }, [customers]);

  if (!products?.length) return null;

  return (
    <div>
      <button
        style={{
          width: "100%",
          background: "transparent",
          border: "none",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          cursor: "pointer",
          padding: "5px 0",
          fontFamily: "inherit",
          transition: "opacity 0.15s",
        }}
        onClick={() => setOpen((o) => !o)}
      >
        <span style={{ fontSize: 10.5, color: accentColor || "#888" }}>{label}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ fontSize: 9.5, color: "#444" }}>{products.length} آیتم</span>
          {open ? <ChevronUp size={12} color="#444" /> : <ChevronDown size={12} color="#444" />}
        </span>
      </button>

      <div
        style={{
          maxHeight: open ? 9999 : 0,
          overflow: "hidden",
          transition: "max-height 0.18s ease-out",
          position: "relative",
        }}
      >
        <div
          ref={scrollRef}
          style={{
            marginTop: 6,
            paddingTop: 6,
            borderTop: "1px solid #1e1e1e",
            display: "flex",
            flexDirection: "column",
            gap: 4,
            maxHeight: 320,
            overflowY: "auto",
          }}
        >
          {products.map((p) => {
            const isAtCust = p.location && p.location !== "warehouse";
            const cust = isAtCust ? custMap[p.location] : null;
            const locLabel = isAtCust ? (cust?.kind === "gallery" ? `پیش ${cust.name}` : `مشتری: ${cust?.name || "نامشخص"}`) : "انبار";
            const locColor = isAtCust ? cust?.color || "#a89bd4" : "#5fd180";
            // قیمت نهایی با احتساب تخفیف (نه قیمت خام) — چون یه محصول تخفیف‌خورده یا
            // هدیه (تخفیف ۱۰۰٪) نباید مثل قیمت کامل حساب بشه
            const finalPrice = p.discountedPrice != null ? toNum(p.discountedPrice) : toNum(p.salePrice);
            const isGift = toNum(p.discountPercent) >= 100 || (p.discountedPrice != null && toNum(p.discountedPrice) <= 0 && toNum(p.salePrice) > 0);
            const profit = finalPrice - p.totalCost;
            return (
              <div key={p.id} style={{ background: "#1a1414", borderRadius: 7, padding: "6px 9px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 9, color: "#8B1A1A", fontWeight: 700, flexShrink: 0 }}>
                    #{fmtCode(p.code)}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      color: "#ddd",
                      flex: 1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {p.name}
                  </span>
                  {isGift && (
                    <span style={{ fontSize: 8, background: "#3a1d33", color: "#f2a3e0", borderRadius: 6, padding: "1px 5px", flexShrink: 0 }}>
                      هدیه
                    </span>
                  )}
                  <span
                    style={{
                      fontSize: 8.5,
                      padding: "1px 6px",
                      borderRadius: 6,
                      flexShrink: 0,
                      background: `${locColor}22`,
                      color: locColor,
                    }}
                  >
                    {locLabel}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 9.5, color: "#666" }}>
                  {p.dims && <span>{formatProductDims(p)}{qtySuffix(p)}</span>}
                  <span>هزینه: {fmt(p.totalCost)} ت</span>
                  <span>قیمت: {fmt(finalPrice)} ت{toNum(p.discountPercent) > 0 && !isGift ? ` (${p.discountPercent}٪ تخفیف)` : ""}</span>
                  {!isGift && <span style={{ color: profit >= 0 ? "#5fd180" : "#e08a8a" }}>سود: {fmt(profit)} ت</span>}
                </div>
              </div>
            );
          })}
        </div>

        {open && products.length > 5 && (
          <button
            style={{
              position: "absolute",
              bottom: 4,
              left: "50%",
              transform: "translateX(-50%)",
              background: "#1c1c1c",
              border: "1px solid #333",
              borderRadius: "50%",
              width: 26,
              height: 26,
              color: "#888",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              fontSize: 11,
              boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
              opacity: 0.85,
            }}
            onClick={() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })}
          >
            ↓
          </button>
        )}
      </div>
    </div>
  );
}

function MetricCard({ icon, value, label, valueColor }) {
  return (
    <div style={T.card}>
      <div style={{ marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: valueColor || "#F5F0EB", marginBottom: 3 }}>
        {value}
        <span style={{ fontSize: 10, fontWeight: 400, color: "#555", marginRight: 3 }}>ت</span>
      </div>
      <div style={{ fontSize: 9, color: "#555", lineHeight: 1.5 }}>{label}</div>
    </div>
  );
}

function AccountRow({ label, value, color }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        fontSize: 11,
        color: "#777",
        padding: "5px 0",
        borderBottom: "1px solid #1a1a1a",
      }}
    >
      <span>{label}</span>
      <span style={{ color: color || "#aaa", fontWeight: 500 }}>{value}</span>
    </div>
  );
}

function IoButton({ icon, label, onClick, accent }) {
  return (
    <button
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 5,
        background: accent ? "#1c1414" : "#161616",
        border: `1px solid ${accent ? "#3a1c1c" : "#2a2a2a"}`,
        color: accent ? "#d88888" : "#999",
        padding: "9px 0",
        borderRadius: 7,
        fontSize: 10.5,
        fontFamily: "inherit",
        cursor: "pointer",
      }}
      onClick={onClick}
    >
      {icon} {label}
    </button>
  );
}

function ExportInfoModal({ onClose }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.88)",
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: "88%",
          maxWidth: 360,
          background: "#181818",
          border: "1px solid #2a2a2a",
          borderRadius: 14,
          padding: 20,
        }}
        dir="rtl"
      >
        <div style={{ fontSize: 13, fontWeight: 600, color: "#F5F0EB", marginBottom: 10 }}>
          محل ذخیره فایل‌های بکاپ
        </div>
        <div style={{ fontSize: 11, color: "#777", lineHeight: 1.8, marginBottom: 16 }}>
          <div style={{ marginBottom: 8 }}>
            📁 <strong style={{ color: "#aaa" }}>فایل اکسل (.xlsx)</strong>
            <br />
            در پوشه <span style={{ color: "#7aa8d8" }}>دانلودها (Downloads)</span> ذخیره می‌شود.
          </div>
          <div style={{ marginBottom: 8 }}>
            💾 <strong style={{ color: "#aaa" }}>بکاپ JSON</strong>
            <br />
            در پوشه <span style={{ color: "#7aa8d8" }}>دانلودها (Downloads)</span> با نام timestamped ذخیره می‌شود.
          </div>
          <div>
            🔄 <strong style={{ color: "#aaa" }}>ایمپورت</strong>
            <br />
            فایل‌ها را <span style={{ color: "#5fd180" }}>MERGE</span> می‌کند — هیچ اطلاعاتی پاک نمی‌شود.
          </div>
        </div>
        <button
          style={{
            width: "100%",
            background: "#8B1A1A",
            border: "none",
            color: "#fff",
            borderRadius: 8,
            padding: "10px 0",
            fontFamily: "inherit",
            fontSize: 11,
            cursor: "pointer",
          }}
          onClick={onClose}
        >
          متوجه شدم
        </button>
      </div>
    </div>
  );
}

// ── AllInvoicesSection ──
function AllInvoicesSection({ invoices, totalCount, onShowAll, onViewInvoice, onPrintInvoice }) {
  const [expandedInvoiceId, setExpandedInvoiceId] = useState(null);

  const toggleExpand = (id) => {
    setExpandedInvoiceId((prev) => {
      const next = prev === id ? null : id;
      return next;
    });
  };

  return (
    <div style={T.card} data-no-swipe="true">
      <div style={{ fontSize: 11, color: "#777", fontWeight: 600, marginBottom: 10, display: "flex", alignItems: "center", justifySpace: "space-between", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <FileText size={14} />
          <span>۵ فاکتور اخیر برنامه (از کل {totalCount} فاکتور)</span>
        </div>
        <button
          style={{
            ...T.chip,
            color: "#7aa8d8",
            border: "1px solid #1a324d",
            background: "#0d1a29",
            padding: "5px 10px",
          }}
          onClick={onShowAll}
        >
          <FolderOpen size={11} style={{ marginLeft: 4 }} />
          نمایش همه فاکتورها
        </button>
      </div>

      {invoices.length === 0 ? (
        <div style={{ fontSize: 11, color: "#444", textAlign: "center", padding: "12px 0" }}>
          هیچ فاکتوری تاکنون ثبت نشده است.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {invoices.map((inv) => {
            const isExpanded = expandedInvoiceId === inv.id;
            return (
              <div
                key={inv.id}
                style={{
                  background: "#121212",
                  border: "1px solid #1f1f1f",
                  borderRadius: 8,
                  overflow: "hidden",
                }}
              >
                {/* Header */}
                <div
                  style={{
                    padding: "10px 12px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                  onClick={() => toggleExpand(inv.id)}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: "#eee" }}>
                      فاکتور مشتری: {inv.buyerName}
                    </div>
                    <div style={{ fontSize: 9.5, color: "#666" }}>
                      تاریخ: {fmtDate(inv.date)} · {inv.items.length} آیتم
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ display: "flex", gap: 4, marginRight: 8, marginLeft: 8 }} onClick={(e) => e.stopPropagation()}>
                      <button
                        style={{
                          ...T.chip,
                          color: "#7aa8d8",
                          border: "1px solid #1a324d",
                          background: "#0d1a29",
                          fontSize: 9,
                          padding: "4px 8px",
                          display: "flex",
                          alignItems: "center",
                          gap: 3
                        }}
                        onClick={() => onViewInvoice?.(inv)}
                        title="مشاهده فاکتور"
                      >
                        <Eye size={10} />
                        <span>مشاهده</span>
                      </button>
                      <button
                        style={{
                          ...T.chip,
                          color: "#5fd180",
                          border: "1px solid #1d3a24",
                          background: "#0d1f14",
                          fontSize: 9,
                          padding: "4px 8px",
                          display: "flex",
                          alignItems: "center",
                          gap: 3
                        }}
                        onClick={() => onPrintInvoice?.(inv)}
                        title="چاپ فاکتور"
                      >
                        <Printer size={10} />
                        <span>چاپ</span>
                      </button>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#5fd180" }}>
                        {fmt(inv.total)} ت
                      </div>
                      <div style={{ fontSize: 8.5, color: inv.allSettled ? "#5fd180" : "#e08a8a" }}>
                        {inv.allSettled ? "✓ تسویه شده" : "✗ تسویه نشده"}
                      </div>
                    </div>
                    {isExpanded ? <ChevronUp size={14} color="#666" /> : <ChevronDown size={14} color="#666" />}
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div
                    style={{
                      background: "#0d0d0d",
                      borderTop: "1px solid #1f1f1f",
                      padding: "10px 12px",
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {inv.items.map((p) => (
                        <div
                          key={p.id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: 10.5,
                            color: "#aaa",
                            paddingBottom: 4,
                            borderBottom: "1px solid #161616",
                          }}
                        >
                          <span>#{fmtCode(p.code)} {p.name}</span>
                          {toNum(p.discountPercent) >= 100 ? (
                            <span style={{ fontSize: 10, background: "#3a1d33", color: "#f2a3e0", borderRadius: 5, padding: "0 6px", fontWeight: 600, display:"inline-flex", alignItems:"center", gap:3 }}><Gift size={11} /> هدیه</span>
                          ) : (
                            <span style={{ color: "#eee" }}>{fmt(toNum(p.discountedPrice != null ? p.discountedPrice : p.salePrice))} ت</span>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Actions bar inside invoice card */}
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, borderTop: "1px solid #1c1c1c", paddingTop: 8, marginTop: 8 }}>
                      <button
                        style={{
                          ...T.chip,
                          color: "#7aa8d8",
                          border: "1px solid #1a324d",
                          background: "#0d1a29",
                          fontSize: 9.5,
                          padding: "5px 10px",
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewInvoice?.(inv);
                        }}
                      >
                        <Eye size={11} style={{ marginLeft: 4 }} />
                        مشاهده فاکتور
                      </button>
                      <button
                        style={{
                          ...T.chip,
                          color: "#5fd180",
                          border: "1px solid #1d3a24",
                          background: "#0d1f14",
                          fontSize: 9.5,
                          padding: "5px 10px",
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onPrintInvoice?.(inv);
                        }}
                      >
                        <Printer size={11} style={{ marginLeft: 4 }} />
                        چاپ / خروجی PDF
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── AllInvoicesModal ──
function AllInvoicesModal({ invoices, onClose, setData, notify, customers, onViewInvoice, onPrintInvoice, productTotals, businessCard, invoiceDrafts }) {
  // این مودال هیچ‌وقت توی رجیستری مودال‌های تودرتو ثبت نمی‌شد، پس سوایپ
  // بین تب‌های اصلی از زیرش رد می‌شد و باعث می‌شد کشیدن انگشت روی فیلترها/
  // لیست فاکتورها به‌جای تعامل با خودش، تب رو عوض کنه
  useRegisterOpenModal(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [sortOrder, setSortOrder] = useState("date");
  const [showSortPopup, setShowSortPopup] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [addingItemInvId, setAddingItemInvId] = useState(null);
  const [addItemQuery, setAddItemQuery] = useState("");

  // با دابل‌کلیک روی دکمه‌ی رفرش هدر، فیلترهای این تب هم مثل بقیه‌ی
  // تب‌ها (محصولات/متریال/گالری) به حالت پیش‌فرض برگردن — قبلاً این تب اصلاً
  // گوش نمی‌داد (Ash 🟡)
  useEffect(() => {
    if (!refreshResetTick) return;
    setSearchQuery("");
    setFilterDate("");
    setSortOrder("date");
  }, [refreshResetTick]);

  // States for the inline editing form
  const [editBuyerName, setEditBuyerName] = useState("");
  const [editBuyerPhone, setEditBuyerPhone] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editSettled, setEditSettled] = useState(true);

  const toggleExpand = (id) => {
    setExpandedId((prev) => {
      const next = prev === id ? null : id;
      return next;
    });
  };

  const startEditing = (inv, e) => {
    e.stopPropagation();
    setEditingId(inv.id);
    setEditBuyerName(inv.buyerName || "");
    const phone = inv.items?.[0]?.buyerPhone || "";
    setEditBuyerPhone(phone);
    setEditDate(inv.date || "");
    setEditSettled(inv.allSettled);
  };

  const handleSaveEdit = (invId) => {
    if (!editBuyerName.trim()) {
      alert("لطفاً نام خریدار را وارد کنید");
      return;
    }

    if (setData) {
      setData((d) => {
        let customersList = [...(d.customers || [])];
        let custId = null;

        // Find or create customer
        if (editBuyerName.trim() && editBuyerName.trim() !== "پیش خودم") {
          const existingIdx = customersList.findIndex((c) => c.kind === "customer" && c.name.toLowerCase() === editBuyerName.trim().toLowerCase());
          if (existingIdx !== -1) {
            const existing = customersList[existingIdx];
            custId = existing.id;
            // اگه شماره‌ی مشتری خالی بود یا با شماره‌ی ویرایش‌شده فرق داشت، خودِ رکورد
            // مشتری هم آپدیت بشه تا فاکتورهای بعدی و کارت‌ویزیت هم سینک بمونن
            if (editBuyerPhone && editBuyerPhone !== existing.phone) {
              customersList = customersList.map((c, i) => i === existingIdx ? { ...c, phone: editBuyerPhone } : c);
            }
          } else {
            const nc = {
              id: "cust_" + Math.random().toString(36).substr(2, 9),
              name: editBuyerName.trim(),
              phone: editBuyerPhone || "",
              note: "",
              color: "#a89bd4",
              kind: "customer",
            };
            customersList = [...customersList, nc];
            custId = nc.id;
          }
        }

        const updatedProducts = d.products.map((p) => {
          const buyerId = p.buyerCustomerId || p.location || "warehouse";
          const dateStr = p.saleDate?.substring(0, 10);
          const groupKey = `${buyerId}_${dateStr}`;
          if (groupKey === invId) {
            return {
              ...p,
              buyerCustomerId: custId,
              buyerName: editBuyerName.trim(),
              buyerPhone: editBuyerPhone,
              saleDate: editDate,
              settled: editSettled,
              settleDate: editSettled ? (p.settleDate || editDate || todayISO()) : null,
              location: custId || "warehouse",
            };
          }
          return p;
        });

        return { ...d, products: updatedProducts, customers: customersList };
      });
      if (notify) notify("فاکتور با موفقیت ویرایش شد");
    }
    setEditingId(null);
  };

  // یه قلم رو از فاکتور حذف می‌کنه — یعنی همون محصول رو به انبار/موجود برمی‌گردونه،
  // بدون این‌که به بقیه‌ی اقلام همون فاکتور دست بزنه
  const handleRemoveItemFromInvoice = (productId, e) => {
    e && e.stopPropagation();
    if (!window.confirm("این محصول از فاکتور حذف و به انبار (موجود) برگردونده بشه؟")) return;
    setData((d) => ({
      ...d,
      products: d.products.map((p) => p.id === productId ? {
        ...p,
        status: "available",
        location: "warehouse",
        buyerCustomerId: null,
        buyerName: "",
        buyerPhone: "",
        saleDate: null,
        settled: false,
        settleDate: null,
      } : p),
    }));
    notify && notify("محصول از فاکتور حذف و به انبار برگردوندن شد");
  };

  // یه محصول موجود (فروخته‌نشده) رو به همون گروه خریدار/تاریخِ این فاکتور اضافه
  // می‌کنه — یعنی وضعیتش sold می‌شه و buyer/date همین فاکتور رو می‌گیره
  const handleAddItemToInvoice = (inv, product) => {
    setData((d) => ({
      ...d,
      products: d.products.map((p) => p.id === product.id ? {
        ...p,
        status: "sold",
        buyerCustomerId: inv.buyerId && inv.buyerId !== "warehouse" ? inv.buyerId : null,
        buyerName: inv.buyerName || "",
        buyerPhone: inv.items?.[0]?.buyerPhone || "",
        saleDate: inv.date,
        settled: !!inv.allSettled,
        settleDate: inv.allSettled ? todayISO() : null,
        location: inv.buyerId && inv.buyerId !== "warehouse" ? inv.buyerId : "warehouse",
      } : p),
    }));
    setAddingItemInvId(null);
    setAddItemQuery("");
    notify && notify("محصول به فاکتور اضافه شد");
  };

  const handleDeleteInvoice = (invId, e) => {
    e.stopPropagation();
    if (window.confirm("آیا از حذف این فاکتور و بازگرداندن محصولات آن به انبار مطمئن هستید؟")) {
      if (setData) {
        setData((d) => {
          const updatedProducts = d.products.map((p) => {
            const buyerId = p.buyerCustomerId || p.location || "warehouse";
            const dateStr = p.saleDate?.substring(0, 10);
            const groupKey = `${buyerId}_${dateStr}`;
            if (groupKey === invId) {
              return {
                ...p,
                status: "available",
                location: "warehouse",
                buyerCustomerId: null,
                buyerName: "",
                buyerPhone: "",
                saleDate: null,
                settled: false,
                settleDate: null,
              };
            }
            return p;
          });
          return { ...d, products: updatedProducts };
        });
        if (notify) notify("فاکتور با موفقیت حذف شد و محصولات به انبار بازگشتند");
      }
    }
  };

  // Filter based on search input and date
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return invoices.filter((inv) => {
      const matchesSearch = !q || (() => {
        const codeMatch = inv.items.some((item) => String(item.code).includes(q));
        const buyerMatch = inv.buyerName?.toLowerCase().includes(q);
        const productMatch = inv.items.some((item) => item.name?.toLowerCase().includes(q));
        return codeMatch || buyerMatch || productMatch;
      })();
      const matchesDate = !filterDate || inv.date === filterDate;
      return matchesSearch && matchesDate;
    });
  }, [invoices, searchQuery, filterDate]);

  // Sort
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (sortOrder === "az") {
        return a.buyerName?.localeCompare(b.buyerName, "fa") || 0;
      }
      if (sortOrder === "date") {
        return b.date.localeCompare(a.date);
      }
      if (sortOrder === "items") {
        return b.items.length - a.items.length;
      }
      if (sortOrder === "code") {
        return b.total - a.total; // sorts by amount/total
      }
      return 0;
    });
  }, [filtered, sortOrder]);

  const cycleSortOrder = () => {
    const states = ["code", "az", "date", "items"];
    const currIdx = states.indexOf(sortOrder);
    const nextIdx = (currIdx + 1) % states.length;
    setSortOrder(states[nextIdx]);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 310, display: "flex", flexDirection: "column" }} dir="rtl">
      <div style={{ width: "100%", maxWidth: 520, margin: "0 auto", background: "#141414", borderRadius: "16px 16px 0 0", flex: 1, display: "flex", flexDirection: "column", overflowY: "auto", marginTop: "auto" }}>
        
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 14px 10px", borderBottom: "1px solid #232323", position: "sticky", top: 0, background: "#141414", zIndex: 10 }}>
          <button style={T.iconBtn} onClick={onClose}><X size={16} color="#888" /></button>
          <FileText size={16} color="#f2c94c" style={{ marginRight: 8, marginLeft: 4 }} />
          <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#F5F0EB" }}>تمامی فاکتورها ({sorted.length} مورد)</span>
          <button
            style={{ ...T.chip, padding: "6px 10px", fontSize: 10, background: "#0d1a29", border: "1px solid #1a324d", color: "#7aa8d8" }}
            onClick={() => setShowAdvanced(true)}
            title="نمای پیشرفته‌ی فاکتورها (آمار، فیلتر بیشتر)"
          >
            نمای پیشرفته
          </button>
        </div>

        {/* Search & Sort Row */}
        <div style={{ padding: "10px 14px", borderBottom: "1px solid #232323", display: "flex", gap: 6, alignItems: "center", background: "#111" }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", background: "#1c1c1c", border: "1px solid #2a2a2a", borderRadius: 8, padding: "6px 10px", gap: 6 }}>
            <Search size={13} color="#555" />
            <input onFocus={(e) => e.target.select()}
              style={{ background: "transparent", border: "none", outline: "none", color: "#ddd", fontSize: 11, flex: 1, fontFamily: "inherit" }}
              placeholder="جستجو (خریدار، کد، محصول)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                style={{ background: "transparent", border: "none", color: "#888", cursor: "pointer", fontSize: 10 }}
                onClick={() => setSearchQuery("")}
              >
                ✕
              </button>
            )}
          </div>
          <div style={{ position: "relative" }}>
            <button
              style={{
                ...T.chip,
                padding: "2px 11px",
                fontSize: 10.5,
                background: "transparent",
                border: "1px solid #2a2a2a",
                color: "#888",
              }}
              onClick={() => setShowSortPopup((v) => !v)}
              title="تغییر نحوه مرتب‌سازی"
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                {sortOrder === "code" && <span>123⇅</span>}
                {sortOrder === "az" && <span>Az⇅</span>}
                {sortOrder === "date" && <Clock size={12} />}
                {sortOrder === "items" && <ShoppingCart size={12} />}
              </span>
            </button>
            <FilterPopup open={showSortPopup} onClose={() => setShowSortPopup(false)} width={160}>
              {[
                { key: "date", label: "تاریخ", Icon: Clock },
                { key: "code", label: "مبلغ (123)", Icon: null },
                { key: "az", label: "نام خریدار (Az)", Icon: null },
                { key: "items", label: "تعداد اقلام", Icon: ShoppingCart },
              ].map((opt) => (
                <button
                  key={opt.key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    width: "100%",
                    padding: "8px 10px",
                    background: sortOrder === opt.key ? "#2a1414" : "transparent",
                    border: "none",
                    borderRadius: 4,
                    color: sortOrder === opt.key ? "#d88888" : "#ddd",
                    fontSize: 11,
                    fontFamily: "inherit",
                    cursor: "pointer",
                    textAlign: "right",
                  }}
                  onClick={() => { setSortOrder(opt.key); setShowSortPopup(false); }}
                >
                  {opt.Icon && <opt.Icon size={12} />}
                  {opt.label}
                </button>
              ))}
            </FilterPopup>
          </div>
        </div>

        {/* Date Filter Row */}
        <div style={{ padding: "0 14px 10px", borderBottom: "1px solid #232323", display: "flex", gap: 6, alignItems: "center", background: "#111" }}>
          <div style={{ flex: 1 }}>
            <JalaliDatePicker value={filterDate} onChange={(val) => setFilterDate(val)} allowEmpty={true} />
          </div>
          {(searchQuery || filterDate) && (
            <button
              onClick={() => { setSearchQuery(""); setFilterDate(""); }}
              style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "#8B1A1A", fontSize: 10, cursor: "pointer", fontWeight: "bold", whiteSpace: "nowrap" }}
            >
              ✕ حذف فیلترها
            </button>
          )}
        </div>

        {/* Invoice List Container */}
        <div style={{ padding: "12px 14px", flex: 1, overflowY: "auto" }}>
          {sorted.length === 0 ? (
            <div style={{ fontSize: 11, color: "#444", textAlign: "center", padding: "24px 0" }}>
              هیچ فاکتوری یافت نشد.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {sorted.map((inv) => {
                const isExpanded = expandedId === inv.id;
                const isEditing = editingId === inv.id;
                return (
                  <div
                    key={inv.id}
                    style={{
                      background: "#181818",
                      border: "1px solid #232323",
                      borderRadius: 10,
                      overflow: "hidden",
                    }}
                  >
                    {/* Invoice Item Row Header */}
                    <div
                      style={{
                        padding: "10px 12px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        cursor: "pointer",
                        userSelect: "none",
                      }}
                      onClick={() => toggleExpand(inv.id)}
                    >
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <div style={{ fontSize: 11.5, fontWeight: 600, color: "#eee" }}>
                          فاکتور مشتری: {inv.buyerName}
                        </div>
                        <div style={{ fontSize: 9.5, color: "#666" }}>
                          تاریخ: {fmtDate(inv.date)} · {inv.items.length} آیتم
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ display: "flex", gap: 4, marginRight: 8, marginLeft: 8 }} onClick={(e) => e.stopPropagation()}>
                          <button
                            style={{
                              ...T.chip,
                              color: "#7aa8d8",
                              border: "1px solid #1a324d",
                              background: "#0d1a29",
                              fontSize: 9,
                              padding: "4px 8px",
                              display: "flex",
                              alignItems: "center",
                              gap: 3
                            }}
                            onClick={() => onViewInvoice?.(inv)}
                            title="مشاهده فاکتور"
                          >
                            <Eye size={10} />
                            <span>مشاهده</span>
                          </button>
                          <button
                            style={{
                              ...T.chip,
                              color: "#5fd180",
                              border: "1px solid #1d3a24",
                              background: "#0d1f14",
                              fontSize: 9,
                              padding: "4px 8px",
                              display: "flex",
                              alignItems: "center",
                              gap: 3
                            }}
                            onClick={() => onPrintInvoice?.(inv)}
                            title="چاپ فاکتور"
                          >
                            <Printer size={10} />
                            <span>چاپ</span>
                          </button>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "#5fd180" }}>
                            {fmt(inv.total)} ت
                          </div>
                          <div style={{ fontSize: 8.5, color: inv.allSettled ? "#5fd180" : "#e08a8a" }}>
                            {inv.allSettled ? "✓ تسویه شده" : "✗ تسویه نشده"}
                          </div>
                        </div>
                        {isExpanded ? <ChevronUp size={14} color="#666" /> : <ChevronDown size={14} color="#666" />}
                      </div>
                    </div>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div style={{ background: "#0f0f0f", borderTop: "1px solid #232323", padding: "10px 12px" }}>
                        
                        {isEditing ? (
                          /* Edit Invoice Form */
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            <div style={{ fontSize: 10, color: "#888", fontWeight: 600 }}>ویرایش مشخصات فاکتور</div>
                            
                            <div>
                              <div style={{ fontSize: 9, color: "#555", marginBottom: 3 }}>نام خریدار</div>
                              <input onFocus={(e) => e.target.select()}
                                style={{ background: "#1c1c1c", color: "#ddd", padding: "6px 10px", fontSize: 11, border: "1px solid #2a2a2a", borderRadius: 6, width: "100%", boxSizing: "border-box", margin: 0, fontFamily: "inherit" }}
                                value={editBuyerName}
                                onChange={(e) => setEditBuyerName(e.target.value)}
                              />
                            </div>

                            <div>
                              <div style={{ fontSize: 9, color: "#555", marginBottom: 3 }}>شماره تلفن خریدار</div>
                              <input onFocus={(e) => e.target.select()}
                                style={{ background: "#1c1c1c", color: "#ddd", padding: "6px 10px", fontSize: 11, border: "1px solid #2a2a2a", borderRadius: 6, width: "100%", boxSizing: "border-box", margin: 0, fontFamily: "inherit" }}
                                value={editBuyerPhone}
                                onChange={(e) => setEditBuyerPhone(e.target.value)}
                              />
                            </div>

                            <div>
                              <div style={{ fontSize: 9, color: "#555", marginBottom: 3 }}>تاریخ فاکتور</div>
                              <JalaliDatePicker
                                value={editDate}
                                onChange={(val) => setEditDate(val)}
                              />
                            </div>

                            <div>
                              <div style={{ fontSize: 9, color: "#555", marginBottom: 3 }}>وضعیت تسویه</div>
                              <div style={{ display: "flex", gap: 6 }}>
                                <button
                                  style={{
                                    ...T.chip,
                                    flex: 1,
                                    justifyContent: "center",
                                    padding: "6px 0",
                                    background: editSettled ? "#1d3a24" : "transparent",
                                    border: editSettled ? "1px solid #2d5a38" : "1px solid #2a2a2a",
                                    color: editSettled ? "#5fd180" : "#888"
                                  }}
                                  onClick={() => setEditSettled(true)}
                                >
                                  تسویه شده
                                </button>
                                <button
                                  style={{
                                    ...T.chip,
                                    flex: 1,
                                    justifyContent: "center",
                                    padding: "6px 0",
                                    background: !editSettled ? "#3a1d1d" : "transparent",
                                    border: !editSettled ? "1px solid #5a2d2d" : "1px solid #2a2a2a",
                                    color: !editSettled ? "#e08a8a" : "#888"
                                  }}
                                  onClick={() => setEditSettled(false)}
                                >
                                  تسویه نشده
                                </button>
                              </div>
                            </div>

                            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                              <button
                                style={{
                                  ...T.chip,
                                  flex: 1,
                                  background: "#8B1A1A",
                                  color: "#fff",
                                  justifyContent: "center",
                                  padding: "8px 0"
                                }}
                                onClick={() => handleSaveEdit(inv.id)}
                              >
                                ذخیره تغییرات
                              </button>
                              <button
                                style={{
                                  ...T.chip,
                                  flex: 1,
                                  justifyContent: "center",
                                  padding: "8px 0"
                                }}
                                onClick={() => setEditingId(null)}
                              >
                                لغو
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* View Details & Actions */
                          <>
                            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
                              {inv.items.map((p) => (
                                <div
                                  key={p.id}
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    fontSize: 10.5,
                                    color: "#aaa",
                                    paddingBottom: 4,
                                    borderBottom: "1px solid #1c1c1c",
                                  }}
                                >
                                  <span>#{fmtCode(p.code)} {p.name}</span>
                                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    {toNum(p.discountPercent) >= 100 ? (
                                      <span style={{ fontSize: 10, background: "#3a1d33", color: "#f2a3e0", borderRadius: 5, padding: "0 6px", fontWeight: 600, display:"inline-flex", alignItems:"center", gap:3 }}><Gift size={11} /> هدیه</span>
                                    ) : (
                                      <span style={{ color: "#eee" }}>{fmt(toNum(p.discountedPrice != null ? p.discountedPrice : p.salePrice))} ت</span>
                                    )}
                                    <button
                                      onClick={(e) => handleRemoveItemFromInvoice(p.id, e)}
                                      style={{ background: "transparent", border: "none", color: "#8B1A1A", cursor: "pointer", padding: 2 }}
                                      title="حذف این قلم از فاکتور (برگشت به انبار)"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* افزودن محصول به این فاکتور */}
                            {addingItemInvId === inv.id ? (
                              <div style={{ marginBottom: 10, position: "relative" }} onClick={(e) => e.stopPropagation()}>
                                <input onFocus={(e) => e.target.select()}
                                  autoFocus
                                  style={{ background: "#1c1c1c", color: "#ddd", padding: "6px 10px", fontSize: 10.5, border: "1px solid #2a2a2a", borderRadius: 6, width: "100%", boxSizing: "border-box", margin: 0, fontFamily: "inherit", height: 30 }}
                                  placeholder="جستجوی نام یا کد محصول موجود..."
                                  value={addItemQuery}
                                  onChange={(e) => setAddItemQuery(e.target.value)}
                                />
                                {addItemQuery.trim() && (
                                  <div style={{ position: "absolute", top: "100%", right: 0, left: 0, background: "#1c1c1c", border: "1px solid #2a2a2a", borderRadius: 8, marginTop: 4, zIndex: 20, maxHeight: 200, overflowY: "auto" }}>
                                    {(productTotals || [])
                                      .filter((p) => p.status === "available" && (p.name?.toLowerCase().includes(addItemQuery.trim().toLowerCase()) || String(p.code).includes(addItemQuery.trim())))
                                      .slice(0, 8)
                                      .map((p) => (
                                        <button
                                          key={p.id}
                                          onClick={() => handleAddItemToInvoice(inv, p)}
                                          style={{ display: "flex", width: "100%", justifyContent: "space-between", padding: "8px 10px", background: "transparent", border: "none", borderBottom: "1px solid #232323", color: "#ddd", fontSize: 10, fontFamily: "inherit", cursor: "pointer", textAlign: "right" }}
                                        >
                                          <span>#{fmtCode(p.code)} {p.name}</span>
                                          <span style={{ color: "#5fd180" }}>{fmt(toNum(p.discountedPrice ?? p.salePrice))} ت</span>
                                        </button>
                                      ))}
                                  </div>
                                )}
                                <button
                                  onClick={() => { setAddingItemInvId(null); setAddItemQuery(""); }}
                                  style={{ fontSize: 9.5, color: "#666", background: "none", border: "none", marginTop: 4, cursor: "pointer" }}
                                >
                                  انصراف
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={(e) => { e.stopPropagation(); setAddingItemInvId(inv.id); }}
                                style={{ ...T.chip, fontSize: 9.5, padding: "5px 10px", color: "#5fd180", border: "1px solid #1d3a24", background: "#0d1f13", marginBottom: 10 }}
                              >
                                + افزودن محصول به این فاکتور
                              </button>
                            )}

                            {/* Actions bar inside invoice card */}
                            <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, borderTop: "1px solid #1c1c1c", paddingTop: 8 }}>
                              <button
                                style={{
                                  ...T.chip,
                                  color: "#7aa8d8",
                                  border: "1px solid #1a324d",
                                  background: "#0d1a29",
                                  fontSize: 9.5,
                                  padding: "5px 10px",
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onViewInvoice?.(inv);
                                }}
                              >
                                <Eye size={11} style={{ marginLeft: 4 }} />
                                مشاهده فاکتور
                              </button>
                              <button
                                style={{
                                  ...T.chip,
                                  color: "#5fd180",
                                  border: "1px solid #1d3a24",
                                  background: "#0d1f14",
                                  fontSize: 9.5,
                                  padding: "5px 10px",
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onPrintInvoice?.(inv);
                                }}
                              >
                                <Printer size={11} style={{ marginLeft: 4 }} />
                                چاپ / خروجی PDF
                              </button>
                              <button
                                style={{
                                  ...T.chip,
                                  color: "#aaa",
                                  fontSize: 9.5,
                                  padding: "5px 10px",
                                }}
                                onClick={(e) => startEditing(inv, e)}
                              >
                                <Edit3 size={11} style={{ marginLeft: 4 }} />
                                ویرایش
                              </button>
                              <button
                                style={{
                                  ...T.chip,
                                  color: "#e08a8a",
                                  border: "1px solid #3a1d1d",
                                  background: "#1c0d0d",
                                  fontSize: 9.5,
                                  padding: "5px 10px",
                                }}
                                onClick={(e) => handleDeleteInvoice(inv.id, e)}
                              >
                                <Trash2 size={11} style={{ marginLeft: 4 }} />
                                حذف فاکتور
                              </button>
                            </div>
                          </>
                        )}

                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

      {showAdvanced && (
        <div style={{ position: "fixed", inset: 0, background: "#0a0a0a", zIndex: 320, display: "flex", flexDirection: "column", overflowY: "auto" }} dir="rtl">
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 14px", borderBottom: "1px solid #232323", position: "sticky", top: 0, background: "#141414", zIndex: 10 }}>
            <button style={T.iconBtn} onClick={() => setShowAdvanced(false)}><X size={16} color="#888" /></button>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#F5F0EB" }}>نمای پیشرفته‌ی فاکتورها</span>
          </div>
          <div style={{ padding: 14 }}>
            <InvoicesTab
              productTotals={productTotals}
              customers={customers}
              setData={setData}
              notify={notify}
              businessCard={businessCard}
              invoiceDrafts={invoiceDrafts}
            />
          </div>
        </div>
      )}
    </div>
    </div>
  );
}

export default function AccountingTab({
  stickyTop = 60,
  acc,
  customers,
  productTotals,
  onExportExcel,
  onExportJson,
  onImportExcelClick,
  onImportJsonClick,
  setData,
  notify,
  businessCard,
  invoiceDrafts,
  refreshResetTick,
}) {
  const [showCalc, setShowCalc] = useState(false);
  useEffect(() => {
    if (showCalc) scrollAppToTop();
  }, [showCalc]);
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const [showAllModal, setShowAllModal] = useState(false);
  const [activePrintInvoice, setActivePrintInvoice] = useState(null);
  const [autoPrint, setAutoPrint] = useState(false);

  const handleViewInvoice = (inv, printImmediately = false) => {
    const mappedItems = inv.items.map(p => {
      const orig = toNum(p.salePrice);
      let finalP = orig;
      let disc = 0;
      let isGift = false;
      if (p.discountedPrice != null && toNum(p.discountedPrice) < orig) {
        finalP = toNum(p.discountedPrice);
        disc = orig - finalP;
        isGift = finalP <= 0;
      } else if (p.discount && toNum(p.discount) > 0) {
        disc = toNum(p.discount);
        finalP = Math.max(0, orig - disc);
        isGift = finalP <= 0;
      } else if (p.discountPercent && toNum(p.discountPercent) > 0) {
        disc = (orig * toNum(p.discountPercent)) / 100;
        finalP = Math.max(0, orig - disc);
        isGift = toNum(p.discountPercent) >= 100;
      }
      return {
        name: p.name,
        code: fmtCode(p.code),
        image: p.image || (p.images && p.images[0]) || "",
        dims: formatProductDims(p) + qtySuffix(p),
        isGift,
        originalPrice: orig,
        finalPrice: finalP,
        discountPct: disc > 0 && orig > 0 ? Math.round((disc / orig) * 100) : 0,
        isSettled: p.settled
      };
    });

    const totalOrig = mappedItems.reduce((acc, item) => acc + item.originalPrice, 0);
    const totalFinal = mappedItems.reduce((acc, item) => acc + item.finalPrice, 0);
    const totalDisc = totalOrig - totalFinal;

    const matchingCustomer = customers?.find(c => c.name?.trim().toLowerCase() === inv.buyerName?.trim().toLowerCase());
    const isDirectSale = inv.buyerName === "پیش خودم" || !inv.buyerName?.trim();
    const customerObj = matchingCustomer ? {
      ...matchingCustomer,
      name: matchingCustomer.name || "",
      // اولویت با شماره/آدرس/جنسیتِ ثبت‌شده روی خودِ این فاکتور است (چون ممکنه توی فرم
      // ویرایش فاکتور دستی عوض شده باشه)؛ اطلاعات مشتری فقط fallback است
      phone: inv.items?.[0]?.buyerPhone || matchingCustomer.phone || "",
      address: inv.items?.[0]?.buyerAddress || matchingCustomer.address || "",
      gender: inv.items?.[0]?.buyerGender || matchingCustomer.gender || "unknown"
    } : {
      kind: "warehouse",
      name: isDirectSale ? "" : inv.buyerName,
      phone: inv.items?.[0]?.buyerPhone || "",
      address: inv.items?.[0]?.buyerAddress || "",
      gender: inv.items?.[0]?.buyerGender || "unknown"
    };

    const invoiceData = {
      id: 1000 + Math.floor(Math.random() * 9000),
      type: matchingCustomer?.kind === "gallery" ? "accounting" : "sales",
      date: fmtDate(inv.date),
      customer: customerObj,
      items: mappedItems,
      totals: {
        total: totalOrig,
        discount: totalDisc,
        final: totalFinal,
      }
    };

    setAutoPrint(printImmediately);
    setActivePrintInvoice(invoiceData);
  };

  const invoices = useMemo(() => {
    const sold = (productTotals || []).filter((p) => p.status === "sold" && p.saleDate);
    const groups = {};
    sold.forEach((p) => {
      const buyerId = p.buyerCustomerId || p.location || "warehouse";
      const dateStr = p.saleDate.substring(0, 10);
      const key = `${buyerId}_${dateStr}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    });

    const custMap = {};
    (customers || []).forEach((c) => (custMap[c.id] = c));

    return Object.keys(groups)
      .map((key) => {
        const parts = key.split("_");
        const buyerId = parts[0];
        const dateStr = parts.slice(1).join("_");
        const items = groups[key];
        const buyerName =
          buyerId === "warehouse"
            ? "پیش خودم"
            : custMap[buyerId]?.name || buyerId || "ناشناس";
        return {
          id: key,
          date: dateStr,
          buyerId,
          buyerName,
          items,
          total: items.reduce((s, p) => s + (p.discountedPrice != null ? toNum(p.discountedPrice) : toNum(p.salePrice)), 0),
          allSettled: items.every((p) => p.settled),
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [productTotals, customers]);

  const roi =
    acc.materialSpend > 0
      ? calcROI(acc.netProfit, acc.materialSpend)
      : acc.netProfit > 0
      ? serviceROI(acc.netProfit, acc.revenueSold)
      : null;

  return (
    <div style={{ padding: "16px 0 80px 0" }} dir="rtl">
      {showCalc && (
        <div style={{ marginBottom: 14, display: "flex", justifyContent: "center" }}>
          <FloatingCalc onClose={() => setShowCalc(false)} />
        </div>
      )}

      {/* Circular Calculator Button */}
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
          transition: "transform 0.1s",
        }}
        onClick={() => {
          setShowCalc((prev) => {
            const next = !prev;
            if (next) scrollAppToTop();
            return next;
          });
        }}
      >
        <Calculator size={22} />
      </button>

      <div
        style={{
          background: "linear-gradient(135deg,#1a1010 0%,#161616 100%)",
          border: "1px solid #2a1c1c",
          borderRadius: 12,
          padding: "20px 16px",
          marginBottom: 12,
          textAlign: "center",
          position: "relative",
        }}
      >
        <div style={{ fontSize: 10, color: "#555", marginBottom: 6, letterSpacing: "0.06em" }}>
          سود خالص قطعی
        </div>
        <div
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: acc.netProfit >= 0 ? "#5fd180" : "#e08a8a",
          }}
        >
          {fmt(acc.netProfit)}
          <span style={{ fontSize: 14, fontWeight: 400, color: "#555", marginRight: 5 }}>تومان</span>
        </div>
        {roi != null && (
          <div
            style={{
              fontSize: 11.5,
              color: "#a89bd4",
              marginTop: 8,
              letterSpacing: "0.04em",
            }}
          >
            ROI: {roi.toFixed(1)}٪ &nbsp;—&nbsp; نرخ بازگشت سرمایه
          </div>
        )}
      </div>


      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
        <MetricCard
          icon={<TrendingUp size={16} color="#5fd180" />}
          value={fmt(acc.revenueSold)}
          label="درآمد فروش‌رفته‌ها"
          valueColor="#5fd180"
        />
        <MetricCard
          icon={<Wallet size={16} color="#e08a8a" />}
          value={fmt(acc.totalOutstanding)}
          label="طلب تسویه‌نشده"
          valueColor="#e08a8a"
        />
        <MetricCard
          icon={<PiggyBank size={16} color="#f2c94c" />}
          value={fmt(acc.projectedRevenue)}
          label="درآمد پیش‌بینی‌شده (موجودی)"
          valueColor="#f2c94c"
        />
        <MetricCard
          icon={<TrendingDown size={16} color="#d4a373" />}
          value={fmt(acc.materialSpend)}
          label="کل هزینه متریال و ابزار"
          valueColor="#d4a373"
        />
      </div>

      <div style={{ ...T.card, borderColor: "#1d3a24" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 6,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#5fd180" }} />
            <span style={{ fontSize: 11.5, color: "#5fd180", fontWeight: 600 }}>
              فروخته شده · تسویه شده
            </span>
          </div>
          <span style={{ fontSize: 13, color: "#5fd180", fontWeight: 700 }}>
            {fmt(acc.settledOnlyRevenue)} ت
          </span>
        </div>
        <div style={{ ...T.row, borderBottom: "1px solid #1e1e1e", paddingBottom: 6, marginBottom: 6 }}>
          <span>{acc.soldSettledItems?.length || 0} آیتم</span>
          <span style={{ color: acc.settledOnlyProfit >= 0 ? "#5fd180" : "#e08a8a" }}>
            سود: {fmt(acc.settledOnlyProfit)} ت
          </span>
        </div>
        <DrillDown
          products={acc.soldSettledItems || []}
          customers={customers}
          label="مشاهده جزئیات محصولات"
          accentColor="#5fd180"
        />
      </div>

      <div style={{ ...T.card, borderColor: "#3a1d1d" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 6,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#e08a8a" }} />
            <span style={{ fontSize: 11.5, color: "#e08a8a", fontWeight: 600 }}>
              فروخته شده · تسویه نشده
            </span>
          </div>
          <span style={{ fontSize: 13, color: "#e08a8a", fontWeight: 700 }}>
            {fmt(acc.totalOutstanding)} ت
          </span>
        </div>
        <div style={{ ...T.row, borderBottom: "1px solid #1e1e1e", paddingBottom: 6, marginBottom: 6 }}>
          <span>{acc.unsettledCount || 0} آیتم در انتظار تسویه</span>
          <span style={{ color: "#666" }}>طلب معوقه</span>
        </div>
        <DrillDown
          products={acc.unsettledItems || []}
          customers={customers}
          label="مشاهده جزئیات طلب‌ها"
          accentColor="#e08a8a"
        />
      </div>

      {(acc.giftItems || []).length > 0 && (
        <div style={{ ...T.card, borderColor: "#4a2a44" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 6,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#f2a3e0" }} />
              <span style={{ fontSize: 11.5, color: "#f2a3e0", fontWeight: 600 }}>
                هدیه داده شده
              </span>
            </div>
            <span style={{ fontSize: 13, color: "#f2a3e0", fontWeight: 700 }}>
              {fmt((acc.giftItems || []).reduce((s, p) => s + toNum(p.totalCost), 0))} ت هزینه
            </span>
          </div>
          <div style={{ ...T.row, borderBottom: "1px solid #1e1e1e", paddingBottom: 6, marginBottom: 6 }}>
            <span>{(acc.giftItems || []).length} آیتم هدیه‌شده</span>
            <span style={{ color: "#666" }}>به‌عنوان سود ثبت نمی‌شه، جدا از فروش واقعی</span>
          </div>
          <DrillDown
            products={acc.giftItems || []}
            customers={customers}
            label="مشاهده جزئیات هدیه‌ها"
            accentColor="#f2a3e0"
          />
        </div>
      )}

      <div style={{ ...T.card, borderColor: "#3a3010" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 6,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#f2c94c" }} />
            <span style={{ fontSize: 11.5, color: "#f2c94c", fontWeight: 600 }}>
              موجودی انبار — سرمایه در جریان
            </span>
          </div>
          <span style={{ fontSize: 13, color: "#f2c94c", fontWeight: 700 }}>
            {fmt(acc.projectedRevenue)} ت
          </span>
        </div>
        <div style={{ ...T.row, borderBottom: "1px solid #1e1e1e", paddingBottom: 6, marginBottom: 6 }}>
          <span>{acc.availableCount || 0} آیتم موجود</span>
          <span>هزینه تمام‌شده: {fmt(acc.projectedCost)} ت</span>
        </div>
        <DrillDown
          products={acc.unsoldItems || []}
          customers={customers}
          label="مشاهده جزئیات موجودی"
          accentColor="#f2c94c"
        />
      </div>

      <div style={T.card}>
        <div style={{ fontSize: 11, color: "#777", fontWeight: 600, marginBottom: 10 }}>
          نمودار سود ماهانه
        </div>
        <MonthlyChart monthlyProfit={acc.monthlyProfit} />
      </div>

      <AllInvoicesSection 
        invoices={invoices.slice(0, 5)} 
        totalCount={invoices.length} 
        onShowAll={() => setShowAllModal(true)} 
        onViewInvoice={(inv) => handleViewInvoice(inv, false)}
        onPrintInvoice={(inv) => handleViewInvoice(inv, true)}
      />

      {showAllModal && (
        <AllInvoicesModal
          invoices={invoices}
          onClose={() => setShowAllModal(false)}
          setData={setData}
          notify={notify}
          customers={customers}
          onViewInvoice={(inv) => handleViewInvoice(inv, false)}
          onPrintInvoice={(inv) => handleViewInvoice(inv, true)}
          productTotals={productTotals}
          businessCard={businessCard}
          invoiceDrafts={invoiceDrafts}
        />
      )}

      {activePrintInvoice && (
        <InvoicePrint
          invoiceData={activePrintInvoice}
          businessCard={businessCard}
          autoPrint={autoPrint}
          onClose={() => setActivePrintInvoice(null)}
        />
      )}

      <div style={T.card}>
        <AccountRow label="جمع کل هزینه (همه محصولات)" value={fmt(acc.totalCostAll)} />
        <AccountRow label="هزینه فروش‌رفته‌ها" value={fmt(acc.costSold)} />
        <AccountRow
          label="پیش‌بینی سود (موجودی)"
          value={fmt(acc.projectedProfit)}
          color={acc.projectedProfit >= 0 ? "#5fd180" : "#e08a8a"}
        />
        <AccountRow label="تعداد محصول فروخته شده" value={`${acc.soldCount} آیتم`} />
        <AccountRow label="تعداد محصول موجود" value={`${acc.availableCount} آیتم`} />
        {roi != null && (
          <AccountRow label="ROI — نرخ بازگشت سرمایه" value={`${roi.toFixed(2)}٪`} color="#a89bd4" />
        )}
      </div>



      <div
        style={{
          background: "#131320",
          border: "1px solid #1e1e38",
          borderRadius: 9,
          padding: "11px 13px",
          marginBottom: 12,
          fontSize: 9.5,
          color: "#6a6aaa",
          lineHeight: 1.7,
        }}
      >
        <div style={{ fontWeight: 600, color: "#a89bd4", marginBottom: 4 }}>ROI چیست؟</div>
        نرخ بازگشت سرمایه — به‌ازای هر تومان هزینه متریال، چقدر سود کسب شده.
        <br />
        فرمول: (سود خالص ÷ کل هزینه متریال) × ۱۰۰
        {roi != null && (
          <span style={{ color: "#c0b0e0", marginRight: 4 }}>= {roi.toFixed(2)}٪</span>
        )}
      </div>

      <div style={{ height: 20 }} />
      {infoModalOpen && <ExportInfoModal onClose={() => setInfoModalOpen(false)} />}
    </div>
  );
}