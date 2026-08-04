// ============================================================
// GalleryTab.jsx - Refarsh Clean (نسخه نهایی با ScrollToTop داخلی)
// ============================================================
import React, { useState, useMemo, useRef, useEffect } from "react";
import { pushBackHandler } from "../utils/backButton";
import { Plus, Edit3, Trash2, Edit2, ChevronDown, ChevronUp, Phone, X, RotateCcw, Landmark, Undo2, Camera, Copy, Share2, Receipt, Printer, Search, CheckCircle2, Circle, Clock, ShoppingBag, Eye, EyeOff } from "lucide-react";
import { toNum, fmt, fmtCode, fmtDate, todayISO, formatProductDims, qtySuffix } from "../mathCore";
import { emptyCustomer, GALLERY_COLOR_PALETTE, uid } from "../dataModels";
import { formatPhoneInput, parsePhoneInput, getJalaliTimestamp } from "../utils/formatters";
import { scrollAppToTop } from "../utils/scrollToTop";
import html2canvas from "html2canvas";
import { JalaliDatePicker } from "./JalaliDatePicker";
import { FilterPopup } from "./FilterPopup";
import { useToast } from "../contexts/ToastContext.jsx";
import InvoicePrint from "./InvoicePrint";
import { useRegisterOpenModal } from "../utils/modalRegistry";
import { useResolvedImageSrc, IMAGE_CATEGORIES } from "../utils/imageStorage";

// عکس کوچیک محصول توی خط گالری/اکسپورت — قبلاً از یه getImageUrl قدیمی و
// import‌نشده استفاده می‌شد («getImageUrl is not defined»، همیشه کرش می‌کرد چون
// عکس‌ها دیگه data URL/مسیر مستقیم نیستن، فقط اسم فایل‌ان). الان از همون سیستم
// resolve واقعی (فایل محلی/IndexedDB) که ProductTab/InvoiceTemplate استفاده می‌کنن.
function GalleryProductThumb({ filename, size = 30 }) {
  const isLegacyInline = !!filename && (filename.startsWith("data:") || filename.startsWith("http") || filename.startsWith("/"));
  const resolvedSrc = useResolvedImageSrc(isLegacyInline ? null : filename, IMAGE_CATEGORIES.PRODUCT);
  const src = isLegacyInline ? filename : resolvedSrc;
  if (!filename || !src) return null;
  return <img src={src} alt="" style={{ width: size, height: size, borderRadius: 5, objectFit: "cover", flexShrink: 0 }} loading="lazy" />;
}

// raw window.confirm()/confirm() is unreliable inside the mobile app webview,
// so invoice-related confirmations use this in-app dialog instead.
function ConfirmDialog({ title, message, confirmLabel = "تایید", onConfirm, onCancel }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.84)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "88%", maxWidth: 340, background: "#181818", border: "1px solid #2a2a2a", borderRadius: 14, padding: 20 }} dir="rtl">
        <div style={{ fontSize: 13, fontWeight: 600, color: "#F5F0EB", marginBottom: 8 }}>{title}</div>
        <div style={{ fontSize: 11, color: "#777", lineHeight: 1.65, marginBottom: 18 }}>{message}</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={{ flex: 1, background: "transparent", border: "1px solid #2a2a2a", color: "#777", borderRadius: 8, padding: "10px 0", fontFamily: "inherit", fontSize: 11, cursor: "pointer" }} onClick={onCancel}>انصراف</button>
          <button style={{ flex: 1, background: "#8B1A1A", border: "none", color: "#fff", borderRadius: 8, padding: "10px 0", fontFamily: "inherit", fontSize: 11, cursor: "pointer" }} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
// ── Shared styles ──────────────────────────────────────────
const T = {
  input: {
    width: "100%",
    background: "#1c1c1c",
    border: "1px solid #2a2a2a",
    borderRadius: 6,
    padding: "7px 10px",
    color: "#ddd",
    fontFamily: "inherit",
    fontSize: 11,
    outline: "none",
    boxSizing: "border-box",
  },
  chip: { background:"#1c1c1c", border:"1px solid #2a2a2a", color:"#888", fontSize:10, padding:"2px 9px", borderRadius:11, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap", display:"inline-flex", alignItems:"center", justifyContent:"center", minHeight:22, height:22, boxSizing:"border-box" },
  chipActive: {
    background: "#2a1414",
    border: "1px solid #8B1A1A",
    color: "#d88888",
  },
  iconBtn: {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    padding: "4px 6px",
    display: "flex",
    alignItems: "center",
  },
  card: {
    background: "#161616",
    border: "1px solid #232323",
    borderRadius: 9,
    marginBottom: 7,
    overflow: "visible",
  },
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.88)",
    zIndex: 110,
    display: "flex",
    flexDirection: "column",
  },
  sheet: {
    width: "100%",
    maxWidth: 480,
    margin: "auto auto 0",
    background: "#181818",
    borderRadius: "16px 16px 0 0",
    maxHeight: "80vh",
    display: "flex",
    flexDirection: "column",
  },
  sheetHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "12px 14px 10px",
    borderBottom: "1px solid #232323",
    position: "sticky",
    top: 0,
    background: "#181818",
    zIndex: 10,
  },
};

const SORT_MODES = [
  { key: "az", kind: "text", ascText: "Az", descText: "Za", label: "الفبا" },
  { key: "date", kind: "icon", Icon: Clock, label: "تاریخ" },
  { key: "count", kind: "text", ascText: "123", descText: "321", label: "تعداد" },
  { key: "balance", kind: "icon", Icon: ShoppingBag, label: "موجودی" },
];

function cycleSort(current) {
  const base = String(current || "").replace(/_desc$/, "");
  const keys = SORT_MODES.map((m) => m.key);
  const idx = keys.indexOf(base);
  return keys[(idx + 1) % keys.length];
}

// ── SortButton ──
function SortButton({ sortOrder, setSortOrder, modes }) {
  const [showPopup, setShowPopup] = useState(false);
  const baseOrder = String(sortOrder || "").replace(/_desc$/, "");
  const isDesc = String(sortOrder || "").endsWith("_desc");

  const current = modes.find((m) => m.key === baseOrder) || modes[0];

  // طبق درخواست: به‌جای آیکون عمومی ⇅ + برچسب + فلش جدا (۳ نماد اضافی)،
  // خودِ متن/آیکون جهت رو نشون می‌ده — برای حالت‌های متنی (حروف/عدد) با
  // چرخوندن ترتیب (Az/Za، ۱۲۳/۳۲۱) + یه ⇅ ثابت، و برای حالت‌های آیکونی
  // (ساعت/سبد) با پیکان جهت (بدون ⇅)
  const renderMode = (mode, isActive) => {
    if (mode.kind === "text") {
      const text = isActive && isDesc ? mode.descText : mode.ascText;
      return <span>{text}⇅</span>;
    }
    const Icon = mode.Icon;
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
        <Icon size={12} />
        {isActive ? (isDesc ? "↓" : "↑") : ""}
      </span>
    );
  };

  return (
    <div style={{ position: "relative" }}>
      <button
        style={{
          ...T.chip,
          padding: "2px 10px",
          fontSize: 10,
          position: "relative",
        }}
        onClick={() => setShowPopup((v) => !v)}
      >
        {renderMode(current, true)}
      </button>

      <FilterPopup open={showPopup} onClose={() => setShowPopup(false)} width={160}>
        {modes.map((mode) => (
          <button
            key={mode.key}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              width: "100%",
              padding: "8px 10px",
              background: baseOrder === mode.key ? "#2a1414" : "transparent",
              border: "none",
              borderRadius: 4,
              color: baseOrder === mode.key ? "#d88888" : "#ddd",
              fontSize: 11,
              fontFamily: "inherit",
              cursor: "pointer",
              textAlign: "right",
            }}
            onClick={() => {
              if (baseOrder === mode.key) {
                setSortOrder?.(isDesc ? mode.key : `${mode.key}_desc`);
              } else {
                setSortOrder?.(mode.key);
              }
              // پاپ‌آپ عمداً بسته نمی‌شه، تا کاربر بتونه چندبار پشت‌سرهم بین گزینه‌ها سوییچ کنه
            }}
          >
            {renderMode(mode, baseOrder === mode.key)}
            {mode.label && <span>{mode.label}</span>}
          </button>
        ))}
      </FilterPopup>
    </div>
  );
}

// ── GalleryStatusFilter — چندحالته (مثل «موقعیت محصول»)، چند-انتخابی ──
function GalleryStatusFilter({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const OPTIONS = [
    { key: "debt", label: "بدهکار" },
    { key: "hasStock", label: "دارای موجودی" },
  ];
  const selected = Array.isArray(value) ? value : [];

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const toggle = (key) => {
    let next = selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key];
    // اگر همه گزینه‌ها انتخاب شدند = حالت «همه»
    if (next.length >= OPTIONS.length) next = [];
    onChange(next);
  };

  const label = selected.length === 0 || selected.length >= OPTIONS.length
    ? "همه"
    : selected.map((k) => OPTIONS.find((o) => o.key === k)?.label || k).filter(Boolean).join("، ");

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button
        type="button"
        style={{ ...T.chip, fontSize: 10, ...(selected.length > 0 ? { borderColor: "#8B1A1A", color: "#e08a8a" } : {}) }}
        onClick={() => setOpen((o) => !o)}
      >
        {label}
      </button>
      <FilterPopup open={open} onClose={() => setOpen(false)} width={160}>
        <button
          type="button"
          style={{ display: "block", width: "100%", textAlign: "right", padding: "8px 12px", background: selected.length === 0 ? "#2a1414" : "transparent", border: "none", color: selected.length === 0 ? "#e08a8a" : "#ccc", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}
          onClick={(e) => { e.stopPropagation(); onChange([]); /* منو باز بماند */ }}
        >
          همه
        </button>
        {OPTIONS.map((opt) => (
          <button
            type="button"
            key={opt.key}
            style={{ display: "block", width: "100%", textAlign: "right", padding: "8px 12px", background: selected.includes(opt.key) ? "#2a1414" : "transparent", border: "none", color: selected.includes(opt.key) ? "#e08a8a" : "#ccc", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}
            onClick={(e) => { e.stopPropagation(); toggle(opt.key); }}
          >
            {opt.label}
          </button>
        ))}
      </FilterPopup>
    </div>
  );
}
function ColorPicker({ value, onChange, mini = false }) {
  const [open, setOpen] = useState(false);
  const colors = GALLERY_COLOR_PALETTE;
  const rows = [colors.slice(0, 6), colors.slice(6, 12)];

  return (
    <div style={{ position: "relative" }}>
      <button
        style={{
          width: mini ? 20 : 28,
          height: mini ? 20 : 28,
          borderRadius: "50%",
          background: value || "#333",
          border: "2px solid #2a2a2a",
          cursor: "pointer",
          padding: 0
        }}
        onClick={() => setOpen(!open)}
      />
      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 100 }} onClick={() => setOpen(false)} />
          <div
            style={{
              position: "absolute",
              bottom: "100%",
              right: 0,
              marginBottom: 8,
              background: "#1c1c1c",
              border: "1px solid #2a2a2a",
              borderRadius: 12,
              padding: 10,
              zIndex: 101,
              display: "flex",
              flexDirection: "column",
              gap: 8,
              boxShadow: "0 4px 20px rgba(0,0,0,0.5)"
            }}
          >
            {rows.map((row, rIdx) => (
              <div key={rIdx} style={{ display: "flex", gap: 8 }}>
                {row.map((c) => (
                  <button
                    key={c}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      background: c,
                      border: value === c ? "2px solid #fff" : "1px solid rgba(255,255,255,0.1)",
                      cursor: "pointer",
                      padding: 0
                    }}
                    onClick={() => { onChange(c); setOpen(false); }}
                  />
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── NameAutoSuggest ────────────────────────────────────────
function NameAutoSuggest({ value, onChange, customers, kind }) {
  const [open, setOpen] = useState(false);
  const matches = useMemo(() => {
    if (!value.trim()) return customers.filter((c) => c.kind === kind).slice(0, 6);
    const q = value.toLowerCase();
    return customers.filter((c) => c.kind === kind && c.name.toLowerCase().includes(q)).slice(0, 6);
  }, [value, customers, kind]);

  return (
    <div style={{ position: "relative" }}>
      <input
        style={T.input}
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={(e) => { e.target.select(); setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        placeholder={kind === "gallery" ? "نام گالری / فروشگاه" : "نام مشتری"}
      />
      {open && matches.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            background: "#1c1c1c",
            border: "1px solid #2a2a2a",
            borderRadius: 7,
            zIndex: 30,
            maxHeight: 160,
            overflowY: "auto",
          }}
        >
          {matches.map((c) => (
            <div
              key={c.id}
              style={{
                padding: "8px 11px",
                fontSize: 11,
                color: "#ddd",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
                borderBottom: "1px solid #1e1e1e",
              }}
              onMouseDown={() => { onChange(c.name, c); setOpen(false); }}
            >
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: c.color || "#888", flexShrink: 0 }} />
              {c.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── SoldPrompt ─────────────────────────────────────────────
function SoldPrompt({ product, onConfirm, onCancel }) {
  const [settled, setSettled] = useState(false);
  const [saleDate, setSaleDate] = useState(todayISO());
  const [settleDate, setSettleDate] = useState(todayISO());
  return (
    <div style={{ ...T.overlay, zIndex: 160, alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "90%", maxWidth: 360, background: "#181818", border: "1px solid #2a2a2a", borderRadius: 14, padding: 20 }} dir="rtl">
        <div style={{ fontSize: 13, fontWeight: 600, color: "#F5F0EB", marginBottom: 4 }}>فروش رفت</div>
        <div style={{ fontSize: 10.5, color: "#666", marginBottom: 14 }}>#{fmtCode(product.code)} · {product.name}</div>
        <div style={{ fontSize: 9.5, color: "#555", marginBottom: 4 }}>تاریخ فروش</div>
        <JalaliDatePicker style={{ marginBottom: 10 }} value={saleDate} onChange={(val) => setSaleDate(val)} />
        <div style={{ fontSize: 9.5, color: "#555", marginBottom: 4 }}>وضعیت تسویه</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <button style={{ ...T.chip, flex: 1, justifyContent: "center", ...(!settled ? T.chipActive : {}) }} onClick={() => setSettled(false)}>تسویه نشده</button>
          <button style={{ ...T.chip, flex: 1, justifyContent: "center", ...(settled ? { background: "#1d3a24", border: "1px solid #2d5a38", color: "#5fd180" } : {}) }} onClick={() => setSettled(true)}>تسویه شده</button>
        </div>
        {settled && (
          <>
            <div style={{ fontSize: 9.5, color: "#555", marginBottom: 4 }}>تاریخ تسویه</div>
            <JalaliDatePicker style={{ marginBottom: 12 }} value={settleDate} onChange={(val) => setSettleDate(val)} />
          </>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <button style={{ flex: 1, background: "transparent", border: "1px solid #2a2a2a", color: "#888", borderRadius: 8, padding: "9px 0", fontFamily: "inherit", fontSize: 11, cursor: "pointer" }} onClick={onCancel}>انصراف</button>
          <button style={{ flex: 1, background: "#8B1A1A", border: "none", color: "#fff", borderRadius: 8, padding: "9px 0", fontFamily: "inherit", fontSize: 11, cursor: "pointer" }}
            onClick={() => onConfirm({ settled, saleDate, settleDate: settled ? settleDate : null })}>ثبت</button>
        </div>
      </div>
    </div>
  );
}

// ── CustomerEditor ─────────────────────────────────────────
function CustomerEditor({ customer, setCustomer, onSave, onClose, allCustomers }) {
  const [errors, setErrors] = useState({});
  const { showToast } = useToast();
  useRegisterOpenModal(true);

  // بخش ۳ (تأیید خروج): اگه با X/کلیک بیرون ببندی و فیلدی نسبت به لحظه‌ی بازشدن
  // تغییر کرده باشه، اول یه تاییدیه‌ی «لغو کنید؟» نشون بده، نه این‌که مستقیم ببنده
  const initialSnapshotRef = useRef(customer);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const isDirty = () => JSON.stringify(customer) !== JSON.stringify(initialSnapshotRef.current);
  const requestClose = () => {
    if (isDirty()) setShowDiscardConfirm(true);
    else onClose();
  };

  const isNew = !customer.id || !allCustomers.some(c => c.id === customer.id);

  return (
    <div style={{ ...T.overlay, zIndex: 130 }} onClick={(e) => e.target === e.currentTarget && requestClose()}>
      <div style={{ ...T.sheet, maxHeight: "85vh" }} dir="rtl">
        <div style={{ ...T.sheetHeader, background: "#181818" }}>
          <button style={T.iconBtn} onClick={requestClose}><X size={16} color="#aaa" /></button>
          <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#F5F0EB" }}>
            {isNew ? "ثبت جدید" : "ویرایش"} {customer.kind === "gallery" ? "گالری" : "مشتری"}
          </span>
          <button
            style={{
              background: "#8B1A1A",
              border: "none",
              color: "#fff",
              borderRadius: 8,
              padding: "7px 16px",
              fontSize: 11,
              cursor: "pointer",
              fontFamily: "inherit",
              fontWeight: 600,
            }}
            onClick={() => {
              const newErrors = {};
              if (!customer.name?.trim()) {
                newErrors.name = true;
              }
              if (customer.kind === "gallery") {
                if (!customer.phone?.trim()) {
                  newErrors.phone = true;
                }
                if (!customer.address?.trim()) {
                  newErrors.address = true;
                }
              }
              if (Object.keys(newErrors).length > 0) {
                setErrors(newErrors);
                showToast("لطفاً تمامی فیلدهای الزامی را پر کنید", "error");
                return;
              }
              onSave(customer);
            }}
          >
            ذخیره اطلاعات
          </button>
        </div>
        <div style={{ padding: "12px 14px", overflowY: "auto", flex: 1 }}>
          
          {/* Partitioned Tab Design */}
          <div style={{ display: "flex", background: "#1c1c1c", padding: 3, borderRadius: 8, border: "1px solid #232323", marginBottom: 12 }}>
            <button
              type="button"
              style={{
                flex: 1,
                padding: "8px 16px",
                borderRadius: 6,
                background: customer.kind === "gallery" ? "#a89bd4" : "transparent",
                color: customer.kind === "gallery" ? "#000" : "#888",
                border: "none",
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s ease",
                fontFamily: "inherit",
              }}
              onClick={() => {
                let next = { ...customer, kind: "gallery" };
                if (customer.kind === "customer") {
                  next.galleryOwnerName = customer.name;
                  next.name = "";
                }
                setCustomer(next);
                setErrors({});
              }}
            >
              گالری
            </button>
            <button
              type="button"
              style={{
                flex: 1,
                padding: "8px 16px",
                borderRadius: 6,
                background: customer.kind === "customer" ? "#f2c94c" : "transparent",
                color: customer.kind === "customer" ? "#000" : "#888",
                border: "none",
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s ease",
                fontFamily: "inherit",
              }}
              onClick={() => {
                let next = { ...customer, kind: "customer" };
                if (customer.kind === "gallery") {
                  next.name = customer.galleryOwnerName || customer.name;
                }
                setCustomer(next);
                setErrors({});
              }}
            >
              مشتری
            </button>
          </div>

          {customer.kind === "gallery" ? (
            <>
              <div style={{ fontSize: 9.5, color: "#888", marginBottom: 4 }}>نام گالری <span style={{ color: "#e08a8a" }}>(الزامی)</span></div>
              <input onFocus={(e) => e.target.select()}
                style={{ ...T.input, marginBottom: 8, borderColor: errors.name ? "#ef4444" : "#2a2a2a", background: errors.name ? "#2a1414" : "#1c1c1c" }}
                value={customer.name || ""}
                onChange={(e) => {
                  setErrors((prev) => ({ ...prev, name: false }));
                  setCustomer({ ...customer, name: e.target.value });
                }}
                placeholder="نام گالری"
              />
              <div style={{ fontSize: 9.5, color: "#888", marginBottom: 4 }}>نام مالک گالری</div>
              <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                <button
                  type="button"
                  style={{
                    background: "#1c1c1c",
                    border: "1px solid #2a2a2a",
                    borderRadius: 6,
                    padding: "0 14px",
                    color: "#ddd",
                    fontSize: 11,
                    fontFamily: "inherit",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minWidth: 54,
                  }}
                  onClick={() => setCustomer({ ...customer, gender: customer.gender === "خانم" ? "آقا" : "خانم" })}
                >
                  {customer.gender === "خانم" ? "خانم" : "آقا"}
                </button>
                <input onFocus={(e) => e.target.select()}
                  style={{ ...T.input, flex: 1, margin: 0 }}
                  value={customer.galleryOwnerName || ""}
                  onChange={(e) => {
                    setCustomer({ ...customer, galleryOwnerName: e.target.value });
                  }}
                  placeholder="نام مالک گالری"
                />
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 9.5, color: "#888", marginBottom: 4 }}>نام مشتری <span style={{ color: "#e08a8a" }}>(الزامی)</span></div>
              <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                <button
                  type="button"
                  style={{
                    background: "#1c1c1c",
                    border: "1px solid #2a2a2a",
                    borderRadius: 6,
                    padding: "0 14px",
                    color: "#ddd",
                    fontSize: 11,
                    fontFamily: "inherit",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minWidth: 54,
                  }}
                  onClick={() => setCustomer({ ...customer, gender: customer.gender === "خانم" ? "آقا" : "خانم" })}
                >
                  {customer.gender === "خانم" ? "خانم" : "آقا"}
                </button>
                <input onFocus={(e) => e.target.select()}
                  style={{ ...T.input, flex: 1, margin: 0, borderColor: errors.name ? "#ef4444" : "#2a2a2a", background: errors.name ? "#2a1414" : "#1c1c1c" }}
                  value={customer.name || ""}
                  onChange={(e) => {
                    setErrors((prev) => ({ ...prev, name: false }));
                    setCustomer({ ...customer, name: e.target.value });
                  }}
                  placeholder="نام مشتری"
                />
              </div>

              <div style={{ fontSize: 9.5, color: "#888", marginBottom: 4 }}>امکان خرید اعتباری (غیر نقد)</div>
              <button
                type="button"
                style={{
                  ...T.input,
                  marginBottom: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: customer.creditAllowed !== false ? "rgba(29, 58, 36, 0.4)" : "rgba(58, 29, 29, 0.4)",
                  borderColor: customer.creditAllowed !== false ? "#2d5a38" : "#5a2d2d",
                  color: customer.creditAllowed !== false ? "#5fd180" : "#e08a8a",
                  cursor: "pointer",
                  fontWeight: 600,
                  padding: "7px 10px",
                }}
                onClick={() => setCustomer({ ...customer, creditAllowed: customer.creditAllowed === false ? true : false })}
              >
                <span>وضعیت پرداخت</span>
                <span>{customer.creditAllowed !== false ? "فعال (امکان خرید نسیه)" : "غیرفعال (فقط نقد)"}</span>
              </button>
            </>
          )}

          <div style={{ fontSize: 9.5, color: "#888", marginBottom: 4 }}>
            شماره تلفن {customer.kind === "gallery" && <span style={{ color: "#e08a8a" }}>(الزامی)</span>}
          </div>
          <input onFocus={(e) => e.target.select()}
            style={{ ...T.input, marginBottom: 8, direction: "ltr", textAlign: "left", borderColor: errors.phone ? "#ef4444" : "#2a2a2a", background: errors.phone ? "#2a1414" : "#1c1c1c" }}
            type="tel"
            placeholder="۰۹۱۲ ۳۴۵ ۶۷۸۹"
            value={formatPhoneInput(customer.phone || "")}
            onChange={(e) => {
              setErrors((prev) => ({ ...prev, phone: false }));
              setCustomer({ ...customer, phone: parsePhoneInput(e.target.value) });
            }}
          />

          <div style={{ fontSize: 9.5, color: "#888", marginBottom: 4 }}>
            آدرس {customer.kind === "gallery" && <span style={{ color: "#e08a8a" }}>(الزامی)</span>}
          </div>
          <input onFocus={(e) => e.target.select()}
            style={{ ...T.input, marginBottom: 8, borderColor: errors.address ? "#ef4444" : "#2a2a2a", background: errors.address ? "#2a1414" : "#1c1c1c" }}
            value={customer.address || ""}
            onChange={(e) => {
              setErrors((prev) => ({ ...prev, address: false }));
              setCustomer({ ...customer, address: e.target.value });
            }}
            placeholder="آدرس"
          />

          <div style={{ fontSize: 9.5, color: "#888", marginBottom: 4 }}>یادداشت</div>
          <input onFocus={(e) => e.target.select()}
            style={{ ...T.input, marginBottom: 10 }}
            value={customer.note || ""}
            onChange={(e) => setCustomer({ ...customer, note: e.target.value })}
            placeholder="یادداشت"
          />

          <div style={{ fontSize: 9.5, color: "#888", marginBottom: 4 }}>رنگ نشانگر</div>
          <div style={{ display: "flex", flexWrap: "nowrap", gap: 4, marginTop: 4, overflowX: "auto", paddingBottom: 6 }}>
            {GALLERY_COLOR_PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                style={{
                  width: 22,
                  height: 22,
                  flexShrink: 0,
                  borderRadius: "50%",
                  background: c,
                  border: customer.color === c ? "2px solid #fff" : "1px solid rgba(255,255,255,0.15)",
                  cursor: "pointer",
                  padding: 0
                }}
                onClick={() => setCustomer({ ...customer, color: c })}
              />
            ))}
          </div>
        </div>
      </div>
      {showDiscardConfirm && (
        <ConfirmDialog
          title="لغو کنید؟"
          message="تغییراتی که ثبت نکردی از دست می‌ره."
          confirmLabel="لغو کن"
          onConfirm={() => { setShowDiscardConfirm(false); onClose(); }}
          onCancel={() => setShowDiscardConfirm(false)}
        />
      )}
    </div>
  );
}

// ── CustomerCard ──────────────────────────────────────────
function CustomerCard({
  stat,
  products,
  allCustomers,
  onEdit,
  onRequestDelete,
  onSetProductSold,
  onSetProductSettled,
  onReturnToWarehouse,
  onSetProductAvailable,
  onUpdateColor, businessCard, setData, notify,
  open,
  onToggle,
}) {
  const [soldPromptFor, setSoldPromptFor] = useState(null);
  const [showColorPick, setShowColorPick] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  
  const { showToast } = useToast();
  // تک‌گزینه‌ای (رادیویی) — دقیقاً مثل فیلتر وضعیت تب محصولات: یه لحظه فقط یکی از
  // «همه/موجود/تسویه‌نشده/تسویه‌شده» فعاله. قبلاً چندگزینه‌ای بود (هر دکمه جدا روشن/خاموش
  // می‌شد و «همه» یعنی هر سه با هم روشن) که رفتارش گیج‌کننده بود: از حالت «همه»، زدن
  // روی یه دکمه‌ی تکی به‌جای این‌که فقط همون یکی رو نشون بده، اون یکی رو از حالت روشن
  // در می‌آورد (چون toggle بود، نه select انحصاری).
  const isGallery = stat.kind === "gallery";
  // طبق درخواست: این فیلتر باید مثل GalleryStatusFilter (بدهکار/دارای موجودی)
  // چند-انتخابی باشه، نه تک‌انتخابی انحصاری. دکمه‌ی «همه» «هوشمنده»: فقط وقتی
  // فعال/هایلایت می‌شه که همه‌ی گزینه‌ها با هم انتخاب شده باشن یا هیچ‌کدوم
  // انتخاب نشده باشن (چون از نظر نتیجه یکی‌ان)؛ بقیه‌ی گزینه‌ها مستقل و
  // چند-انتخابی‌ان
  const [statusFilter, setStatusFilter] = useState([]); // آرایه‌ی چند-انتخابی از "available" | "unsettled" | "settled"
  const availableFilterKeys = isGallery ? ["available", "unsettled", "settled"] : ["unsettled", "settled"];
  const isAllSelected = statusFilter.length === 0 || statusFilter.length >= availableFilterKeys.length;
  const exportFilters = useMemo(() => ({
    available: isAllSelected || statusFilter.includes("available"),
    unsettled: isAllSelected || statusFilter.includes("unsettled"),
    settled: isAllSelected || statusFilter.includes("settled"),
  }), [statusFilter, isAllSelected]);
  const toggleFilter = (key) => setStatusFilter((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  const selectAllFilters = () => setStatusFilter([]);
  const exportRef = useRef(null);
  const [showInvoices, setShowInvoices] = useState(false);
  const col = stat.color || "#a89bd4";

  // قیمت با تخفیف (اگه واقعاً تخفیف خورده) رو نشون بده، نه قیمت خام قبل از تخفیف —
  // این توی لیست‌های اکسپند گالری قبلاً همیشه salePrice خام رو نشون می‌داد
  const renderPriceCell = (p, color) => {
    const orig = toNum(p.salePrice);
    const hasDiscount = p.discountedPrice != null && toNum(p.discountedPrice) < orig;
    const isGift = toNum(p.discountPercent) >= 100 || toNum(p.discountedPrice) === 0;
    if (!hasDiscount) {
      return <span style={{ fontSize: 11, color, flexShrink: 0, width: 60, textAlign: "left" }}>{fmt(orig)} ت</span>;
    }
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0, width: 60 }}>
        <span style={{ fontSize: 8, color: "#777", textDecoration: "line-through" }}>{fmt(orig)}</span>
        {isGift ? (
          <span style={{ fontSize: 10, background: "#3a1d33", color: "#f2a3e0", borderRadius: 5, padding: "0 5px", fontWeight: 600 }}>{"\u{1F381}\uFE0E"} هدیه</span>
        ) : (
          <span style={{ fontSize: 11, color, textAlign: "left" }}>{fmt(toNum(p.discountedPrice))} ت</span>
        )}
      </div>
    );
  };


  const productsSorted = useMemo(() => {
    if (!open) return { unsettled: [], held: [], settled: [] };
    const normalize = (p) => {
      if (p.location !== stat.id) return null;
      if (p.status === "sold" && !p.settled) return "unsettled";
      if (p.status !== "sold") return "available";
      return "settled";
    };
    const priority = { unsettled: 0, available: 1, settled: 2 };
    const all = products
      .map((p) => ({ ...p, _norm: normalize(p) }))
      .filter((p) => p._norm !== null)
      .sort((a, b) => priority[a._norm] - priority[b._norm]);
    return {
      unsettled: all.filter((p) => p._norm === "unsettled"),
      held: isGallery ? all.filter((p) => p._norm === "available") : [],
      settled: all.filter((p) => p._norm === "settled"),
    };
  }, [products, stat.id, open, isGallery]);

  const { held, unsettled, settled } = productsSorted;

  const handleMarkSold = (product, result) => {
    onSetProductSold(product.id, result.saleDate, stat.id);
    if (result.settled) onSetProductSettled(product.id, true, result.settleDate);
    setSoldPromptFor(null);
  };

  const handleReturnToWarehouse = (productId) => {
    onReturnToWarehouse(productId);
  };

  const handleSetAvailableInGallery = (productId) => {
    if (isGallery) {
      onSetProductAvailable(productId, stat.id);
    } else {
      onReturnToWarehouse(productId);
    }
  };

  return (
    <>
      <div style={{ ...T.card, opacity: stat.hidden ? 0.45 : 1 }}>
        {isGallery && <div style={{ height: 3, background: col, borderRadius: "9px 9px 0 0" }} />}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 12px",
            cursor: "pointer",
          }}
          onClick={onToggle}
        >
          <div style={{ position: "relative", flexShrink: 0 }}>
            <button
              style={{
                width: 24,
                height: 24,
                borderRadius: "50%",
                background: col,
                border: "2px solid #2a2a2a",
                cursor: "pointer",
                padding: 0,
                flexShrink: 0,
              }}
              onClick={(e) => { e.stopPropagation(); setShowColorPick((s) => !s); }}
            />
            {showColorPick && (
              <>
                <div
                  style={{
                    position: "fixed",
                    inset: 0,
                    zIndex: 110,
                    background: "transparent",
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowColorPick(false);
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    top: 30,
                    right: 0,
                    background: "#1c1c1c",
                    border: "1px solid #333",
                    borderRadius: 8,
                    padding: "6px",
                    zIndex: 120,
                    width: 116,
                    boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    {[0, 1, 2].map((rowIdx) => (
                      <div key={rowIdx} style={{ display: "flex", gap: 5, justifyContent: "center" }}>
                        {GALLERY_COLOR_PALETTE.slice(rowIdx * 4, (rowIdx + 1) * 4).map((c) => (
                          <button
                            key={c}
                            style={{
                              width: 20,
                              height: 20,
                              borderRadius: "50%",
                              background: c,
                              border: col === c ? "2px solid #fff" : "1px solid rgba(255,255,255,0.15)",
                              cursor: "pointer",
                              padding: 0,
                            }}
                            onClick={() => {
                              onUpdateColor(stat.id, c);
                              setShowColorPick(false);
                            }}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: isGallery ? col : "#ddd", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {isGallery ? (
                `${stat.name}${stat.galleryOwnerName ? ` (${stat.gender === "خانم" ? "خانم" : "آقای"} ${stat.galleryOwnerName})` : ""}`
              ) : (
                `${stat.gender === "خانم" ? "خانم " : stat.gender === "آقا" ? "آقای " : ""}${stat.name}`
              )}
            </div>
            <div style={{ fontSize: 9.5, color: "#555", display: "flex", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
              {stat.phone && (
                <span style={{ display: "flex", alignItems: "center", gap: 3, direction: "ltr", textAlign: "left" }}>
                  <Phone size={9} /> {formatPhoneInput(stat.phone)}
                </span>
              )}
            </div>
          </div>
          <button
            style={{ ...T.iconBtn, width: 32, height: 32, justifyContent: "center" }}
            title={stat.hidden ? "نمایش دادن (از حالت مخفی خارج کن)" : "مخفی کن (از لیست‌های انتخاب/ارجاع حذف می‌شه)"}
            onClick={(e) => {
              e.stopPropagation();
              if (setData) {
                setData((d) => ({
                  ...d,
                  customers: (d.customers || []).map((c) => (c.id === stat.id ? { ...c, hidden: !c.hidden } : c)),
                }));
              }
            }}
          >
            {stat.hidden ? <EyeOff size={12} color="#555" /> : <Eye size={12} color="#555" />}
          </button>
          <button
            style={{ ...T.iconBtn, width: 32, height: 32, justifyContent: "center" }}
            onClick={(e) => { e.stopPropagation(); onEdit(stat); }}
          >
            <Edit3 size={12} color="#555" />
          </button>
          <button
            style={{ ...T.iconBtn, width: 32, height: 32, justifyContent: "center" }}
            onClick={(e) => { e.stopPropagation(); onRequestDelete(stat.id); }}
          >
            <Trash2 size={12} color="#e08a8a" />
          </button>
          {open ? <ChevronUp size={13} color="#444" /> : <ChevronDown size={13} color="#444" />}
        </div>

        {open && (
          <div style={{ padding: "0 13px 12px", borderTop: "1px solid #1e1e1e" }}>
            
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "10px 0", justifyContent: "space-between" }}>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                <button
                  style={{ ...T.chip, ...(isAllSelected ? T.chipActive : {}) }}
                  onClick={selectAllFilters}
                >
                  همه
                </button>
                {isGallery && (
                  <button
                    style={{ ...T.chip, ...(!isAllSelected && exportFilters.available ? T.chipActive : {}) }}
                    onClick={() => toggleFilter("available")}
                  >
                    موجود
                  </button>
                )}
                <button
                  style={{ ...T.chip, ...(!isAllSelected && exportFilters.unsettled ? T.chipActive : {}) }}
                  onClick={() => toggleFilter("unsettled")}
                >
                  تسویه نشده
                </button>
                <button
                  style={{ ...T.chip, ...(!isAllSelected && exportFilters.settled ? T.chipActive : {}) }}
                  onClick={() => toggleFilter("settled")}
                >
                  تسویه شده
                </button>
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                <button style={{ width: 28, height: 28, background: "#161616", border: "1px solid #333", color: "#aaa", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }} onClick={() => setShowPrint(true)} title="چاپ فاکتور">
                  <Printer size={13} />
                </button>
                <button style={{ height: 28, padding: "0 8px", background: "#1a1414", border: "1px solid #3a1c1c", color: "#d88888", borderRadius: 6, display: "flex", alignItems: "center", gap: 4, cursor: "pointer", fontSize: 10, fontFamily: "inherit" }} onClick={() => { setShowInvoices(true); scrollAppToTop(); }} title="لیست فاکتورها">
                  <Receipt size={13} /> فاکتورها
                </button>
              </div>
            </div>

            <div ref={exportRef} style={{ background: "#141414", padding: 1, borderRadius: 8 }}>

            {/* ── موجود ── */}
            {exportFilters.available && held.length > 0 && (
              <>
                <div style={{ fontSize: 9.5, color: "#f2c94c", margin: "10px 0 6px", fontWeight: 600 }}>موجود ({held.length})</div>
                {held.map((p) => (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: "1px solid #1a1a1a" }}>
                    <GalleryProductThumb filename={p.image} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, color: "#ddd" }}>#{fmtCode(p.code)} {p.name}</div>
                    </div>
                    {renderPriceCell(p, "#F5F0EB")}
                    <button
                      style={{
                        background: "transparent",
                        border: "1px solid #2a2a2a",
                        color: "#888",
                        borderRadius: 7,
                        padding: "3px 7px",
                        fontSize: 9,
                        fontFamily: "inherit",
                        cursor: "pointer",
                        flexShrink: 0,
                      }}
                      onClick={() => setSoldPromptFor(p)}
                    >
                      فروش رفت
                    </button>
                    <button
                      style={{
                        background: "transparent",
                        border: "1px solid #2a2a2a",
                        color: "#7aa8d8",
                        borderRadius: 7,
                        padding: "3px 7px",
                        fontSize: 9,
                        fontFamily: "inherit",
                        cursor: "pointer",
                        flexShrink: 0,
                        display: "flex",
                        alignItems: "center",
                        whiteSpace: "nowrap",
                      }}
                      onClick={() => handleReturnToWarehouse(p.id)}
                    >
                      <Undo2 size={10} style={{ marginLeft: 3 }} /> برگشت به انبار
                    </button>
                  </div>
                ))}
              </>
            )}

            {/* ── تسویه نشده ── */}
            {exportFilters.unsettled && unsettled.length > 0 && (
              <>
                <div style={{ fontSize: 9.5, color: "#e08a8a", margin: "10px 0 6px", fontWeight: 600 }}>تسویه نشده ({unsettled.length})</div>
                {unsettled.map((p) => (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid #1a1a1a" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, color: "#e08a8a" }}>#{fmtCode(p.code)} {p.name}</div>
                      {p.saleDate && <div style={{ fontSize: 9, color: "#555" }}>{fmtDate(p.saleDate)}</div>}
                    </div>
                    {renderPriceCell(p, "#e08a8a")}
                    <button
                      style={{
                        background: "transparent",
                        border: "1px solid #2a2a2a",
                        color: "#888",
                        borderRadius: 7,
                        padding: "3px 7px",
                        fontSize: 9,
                        fontFamily: "inherit",
                        cursor: "pointer",
                        flexShrink: 0,
                      }}
                      onClick={() => onSetProductSettled(p.id, true, todayISO())}
                    >
                      تسویه شود
                    </button>
                    <button
                      style={{
                        background: "transparent",
                        border: "1px solid #2a2a2a",
                        color: "#7aa8d8",
                        borderRadius: 7,
                        padding: "3px 7px",
                        fontSize: 9,
                        fontFamily: "inherit",
                        cursor: "pointer",
                        flexShrink: 0,
                        display: "flex",
                        alignItems: "center",
                        whiteSpace: "nowrap",
                      }}
                      onClick={() => onSetProductAvailable(p.id, stat.id)}
                    >
                      <Undo2 size={10} style={{ marginLeft: 3 }} /> برگشت به موجودی
                    </button>
                  </div>
                ))}
              </>
            )}

            {/* ── تسویه شده ── */}
            {exportFilters.settled && settled.length > 0 && (
              <>
                <div style={{ fontSize: 9.5, color: "#5fd180", margin: "10px 0 6px", fontWeight: 600 }}>تسویه شده ({settled.length})</div>
                {settled.map((p) => (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid #1a1a1a" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, color: "#ddd" }}>#{fmtCode(p.code)} {p.name}</div>
                    </div>
                    {renderPriceCell(p, "#F5F0EB")}
                    <button
                      style={{
                        background: "transparent",
                        border: "1px solid #2a2a2a",
                        color: "#888",
                        borderRadius: 7,
                        padding: "3px 7px",
                        fontSize: 9,
                        fontFamily: "inherit",
                        cursor: "pointer",
                        flexShrink: 0,
                      }}
                      onClick={() => onSetProductSettled(p.id, false, null)}
                    >
                      لغو تسویه
                    </button>
                    <button
                      style={{
                        background: "transparent",
                        border: "1px solid #2a2a2a",
                        color: "#7aa8d8",
                        borderRadius: 7,
                        padding: "3px 7px",
                        fontSize: 9,
                        fontFamily: "inherit",
                        cursor: "pointer",
                        flexShrink: 0,
                        display: "flex",
                        alignItems: "center",
                        whiteSpace: "nowrap",
                      }}
                      onClick={() => onSetProductAvailable(p.id, stat.id)}
                    >
                      <Undo2 size={10} style={{ marginLeft: 3 }} /> برگشت به موجودی
                    </button>
                  </div>
                ))}
              </>
            )}

            </div>
            {held.length === 0 && unsettled.length === 0 && settled.length === 0 && (
              <div style={{ fontSize: 10.5, color: "#333", padding: "10px 0", textAlign: "center" }}>
                محصولی ثبت نشده
              </div>
            )}
          </div>
        )}
      </div>

      {soldPromptFor && (
        <SoldPrompt
          product={soldPromptFor}
          onConfirm={(r) => handleMarkSold(soldPromptFor, r)}
          onCancel={() => setSoldPromptFor(null)}
        />
      )}

      {showInvoices && (
        <InvoiceListModal 
          stat={stat}
          products={products}
          onClose={() => setShowInvoices(false)}
          onSetProductAvailable={onSetProductAvailable}
          setData={setData}
          notify={notify}
          businessCard={businessCard}
        />
      )}
      {showPrint && (() => {
        // Prepare invoice data
        // For gallery we print held + unsettled, for customer we print unsettled + settled based on what they want.
        // Actually let's just print whatever is currently filtered by exportFilters.
        const itemsToPrint = [];
        if (exportFilters.available) itemsToPrint.push(...held.map(p => ({ p, isAvailableInGallery: true })));
        if (exportFilters.unsettled) itemsToPrint.push(...unsettled.map(p => ({ p, isAvailableInGallery: false })));
        if (exportFilters.settled) itemsToPrint.push(...settled.map(p => ({ p, isAvailableInGallery: false })));

        const mappedItems = itemsToPrint.map(({ p, isAvailableInGallery }) => {
          const orig = toNum(p.salePrice);
          let finalP = orig;
          let disc = 0;
          let isGift = false;
          if (p.discountedPrice != null && toNum(p.discountedPrice) < orig) {
            finalP = toNum(p.discountedPrice);
            disc = orig - finalP;
            isGift = finalP <= 0;
          } else if (toNum(p.discountPercent) >= 100) {
            finalP = 0;
            disc = orig;
            isGift = true;
          }
          return {
            name: p.name,
            code: fmtCode(p.code),
            image: p.image,
            dims: formatProductDims(p) + qtySuffix(p),
            originalPrice: orig,
            finalPrice: finalP,
            isGift,
            discountPct: disc > 0 && orig > 0 ? Math.round((disc / orig) * 100) : 0,
            isSettled: p.settled,
            isAvailableInGallery
          };
        });

        const totalOrig = mappedItems.reduce((acc, i) => acc + i.originalPrice, 0);
        const totalFinal = mappedItems.reduce((acc, i) => acc + i.finalPrice, 0);
        const totalDisc = totalOrig - totalFinal;

        const invoiceData = {
          id: 1000 + Math.floor(Math.random() * 9000), // Random ID for now since we don't store invoices
          type: isGallery ? "accounting" : "sales",
          date: fmtDate(todayISO()),
          customer: { 
            name: isGallery ? stat.name : `${stat.gender === "خانم" ? "خانم " : stat.gender === "آقا" ? "آقای " : ""}${stat.name}`,
            phone: stat.phone,
            kind: stat.kind,
            gender: stat.gender,
            galleryOwnerName: stat.galleryOwnerName,
            galleryOwnerGender: stat.galleryOwnerGender
          },
          items: mappedItems,
          totals: {
            total: totalOrig,
            discount: totalDisc,
            final: totalFinal,
          }
        };

        return (
          <InvoicePrint 
            invoiceData={invoiceData}
            businessCard={businessCard}
            autoPrint={true}
            onClose={() => setShowPrint(false)}
          />
        );
      })()}
    </>
  );



}
// ── InvoiceListModal ──────────────────────────────────────────

function InvoiceListModal({ stat, products, onClose, onSetProductSold, onSetProductAvailable, businessCard, setData, notify }) {
  useRegisterOpenModal(true);
  const [activePrintInvoice, setActivePrintInvoice] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editBuyerName, setEditBuyerName] = useState("");
  const [editBuyerPhone, setEditBuyerPhone] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editSettled, setEditSettled] = useState(true);
  const { showToast } = useToast();
  
  const [selectedInvoices, setSelectedInvoices] = useState({});
  const [confirmDeleteInv, setConfirmDeleteInv] = useState(null);
  const [confirmReturnProduct, setConfirmReturnProduct] = useState(null);
  const [addItemQuery, setAddItemQuery] = useState("");
  const [editingId2, setEditingId2] = useState(null); // برای toggle پیکر افزودن محصول، مستقل از editingId (که برای ویرایش تاریخ/تسویه‌ست)

  // Get both sold and available products for this gallery
  const galleryProducts = products.filter(p => p.location === stat.id && (p.status === "sold" || p.status === "available"));
  
  const groups = {};
  
  // Available products are grouped by transfer date (within 1 hour)
  const availableProducts = galleryProducts.filter(p => p.status === "available");
  if (availableProducts.length > 0) {
    const sortedAvail = [...availableProducts].sort((a, b) => {
       const d1 = a.transferDate ? new Date(a.transferDate).getTime() : 0;
       const d2 = b.transferDate ? new Date(b.transferDate).getTime() : 0;
       return d1 - d2;
    });
    
    let currentGroup = null;
    let groupIdx = 1;
    sortedAvail.forEach(p => {
       const tTime = p.transferDate ? new Date(p.transferDate).getTime() : 0;
       if (!currentGroup || (tTime > 0 && Math.abs(tTime - currentGroup.maxTime) > 3600000) || (tTime === 0 && currentGroup.maxTime > 0)) {
          const gId = "available_" + groupIdx++;
          const tDate = p.transferDate ? fmtDate(p.transferDate) : "";
          const tTimeStr = p.transferDate ? new Date(p.transferDate).toLocaleTimeString("fa-IR", {hour: '2-digit', minute:'2-digit'}) : "";
          const dateLabel = tDate ? `موجود در گالری (${tDate}${tTimeStr ? ' ' + tTimeStr : ''})` : "موجود در گالری (قدیمی)";
          
          currentGroup = {
             id: gId,
             date: dateLabel,
             isAvailableGroup: true,
             items: [],
             total: 0,
             buyerName: stat.name,
             buyerPhone: stat.phone || "",
             allSettled: false,
             maxTime: tTime,
             sortTime: tTime
          };
          groups[gId] = currentGroup;
       }
       
       currentGroup.items.push({ ...p, isAvailableInGallery: true });
       currentGroup.total += (toNum(p.salePrice) || toNum(p.price));
       currentGroup.maxTime = Math.max(currentGroup.maxTime, tTime);
    });
  }

  // Sold products grouped by date
  galleryProducts.filter(p => p.status === "sold").forEach(p => {
    const d = p.saleDate ? p.saleDate.substring(0, 10) : "نامشخص";
    if (!groups[d]) {
      groups[d] = {
        id: d,
        date: d,
        isAvailableGroup: false,
        items: [],
        total: 0,
        buyerName: stat.name,
        buyerPhone: stat.phone || "",
        allSettled: true
      };
    }
    groups[d].items.push(p);
    groups[d].total += toNum(p.salePrice);
    if (!p.settled) groups[d].allSettled = false;
  });

  const invoices = Object.values(groups).sort((a, b) => {
    if (a.isAvailableGroup && !b.isAvailableGroup) return -1;
    if (!a.isAvailableGroup && b.isAvailableGroup) return 1;
    if (a.isAvailableGroup && b.isAvailableGroup) return (b.sortTime || 0) - (a.sortTime || 0);
    if (a.allSettled && !b.allSettled) return 1;
    if (!a.allSettled && b.allSettled) return -1;
    return b.date.localeCompare(a.date);
  });

  const handlePrintSelected = () => {
    const selected = invoices.filter(inv => selectedInvoices[inv.id]);
    if (selected.length === 0) {
      if (notify) notify("هیچ فاکتوری برای چاپ انتخاب نشده است.");
      return;
    }
    
    // Merge them
    let allItems = [];
    selected.forEach(inv => {
      allItems = [...allItems, ...inv.items];
    });
    
    // Sort items: Available first, then Debt/Unsettled, then Settled
    allItems.sort((a, b) => {
      const aIsAvailable = !!a.isAvailableInGallery;
      const bIsAvailable = !!b.isAvailableInGallery;
      if (aIsAvailable && !bIsAvailable) return -1;
      if (!aIsAvailable && bIsAvailable) return 1;
      
      const aIsSettled = !!a.settled;
      const bIsSettled = !!b.settled;
      if (!aIsSettled && bIsSettled) return -1;
      if (aIsSettled && !bIsSettled) return 1;
      
      return 0;
    });

    // The merged total will just sum all, but we handle the separation in InvoiceTemplate
    // هر آیتم باید دقیقاً همون شکلی رو داشته باشه که InvoiceTemplate می‌خواد
    // (finalPrice/originalPrice/discountPct/isGift) — وگرنه تخفیف/هدیه نشون داده نمی‌شه
    // (و قیمت‌ها می‌تونن صفر نشون داده بشن چون finalPrice خامِ محصول تعریف نشده)
    const mappedItems = allItems.map(p => {
      const orig = toNum(p.salePrice ?? p.price);
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
        ...p,
        name: p.name,
        code: fmtCode(p.code),
        image: p.image,
        dims: formatProductDims(p) + qtySuffix(p),
        originalPrice: orig,
        finalPrice: finalP,
        isGift,
        discountPct: disc > 0 && orig > 0 ? Math.round((disc / orig) * 100) : 0,
        isSettled: p.settled
      };
    });
    const total = mappedItems.reduce((sum, p) => sum + p.finalPrice, 0);
    const totalOrig = mappedItems.reduce((sum, p) => sum + p.originalPrice, 0);
    const mergedInvoice = {
      id: "MERGED-" + Date.now(),
      date: fmtDate(new Date().toISOString()),
      customer: {
        name: stat.name,
        phone: stat.phone,
        kind: stat.kind,
        gender: stat.gender,
        galleryOwnerName: stat.galleryOwnerName
      },
      items: mappedItems,
      totals: {
        total: totalOrig,
        discount: totalOrig - total,
        final: total
      }
    };
    
    setActivePrintInvoice(mergedInvoice);
  };

  const toggleSelect = (id) => {
    setSelectedInvoices(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // محصولات موجودِ قابل‌افزودن به یه فاکتور ثبت‌شده‌ی این گالری (از انبار/هرجای دیگه)
  const addItemResults = useMemo(() => {
    const q = addItemQuery.trim().toLowerCase();
    const pool = products.filter((p) => p.status === "available");
    const filtered = q ? pool.filter((p) => p.name?.toLowerCase().includes(q) || String(p.code).includes(q)) : pool;
    return filtered.slice(0, 30);
  }, [products, addItemQuery]);

  // یه محصول موجود رو مستقیم به یه فاکتور ثبت‌شده‌ی این گالری اضافه می‌کنه
  const handleAddItemToInvoice = (inv, product) => {
    if (!setData) return;
    const saleDate = (() => {
      const d = new Date(inv.date);
      return isNaN(d.getTime()) ? todayISO() : d.toISOString();
    })();
    setData((d) => ({
      ...d,
      products: d.products.map((p) =>
        p.id === product.id
          ? { ...p, status: "sold", location: stat.id, saleDate, settled: inv.allSettled, settleDate: inv.allSettled ? saleDate : null }
          : p
      ),
    }));
    if (notify) notify("محصول به فاکتور اضافه شد");
  };

  // تخفیف تک‌تک اقلام — مستقیم روی رکورد محصول می‌نویسه (discountPercent/discountedPrice)
  // پس تب محصولات و بقیه‌ی جاهایی که همین فاکتور رو نشون می‌دن هم آپدیت‌شده می‌بینن
  const handleItemDiscountChange = (product, rawValue) => {
    if (!setData) return;
    const disc = rawValue === "" ? 0 : Math.min(100, Math.max(0, parseFloat(rawValue) || 0));
    const sp = toNum(product.salePrice);
    const dp = disc > 0 ? Math.round(sp * (1 - disc / 100)) : sp;
    setData((d) => ({
      ...d,
      products: d.products.map((p) => (p.id === product.id ? { ...p, discountPercent: disc, discountedPrice: dp } : p)),
    }));
  };


  const handleEditClick = (inv) => {
    setEditingId(inv.id);
    setEditDate(inv.date === "موجود در گالری" ? "" : inv.date);
    setEditSettled(inv.allSettled);
  };

  const handleSaveInvoiceEdit = (invId) => {
    if (setData) {
      setData((d) => {
        const updatedProducts = d.products.map((p) => {
          const buyerId = p.buyerCustomerId || p.location || "warehouse";
          const dateStr = p.saleDate ? p.saleDate.substring(0, 10) : "نامشخص";
          
          let match = false;
          if (invId.startsWith("available")) {
            match = p.status === "available" && p.location === stat.id && inv.items.some(i => i.id === p.id);
          } else {
            match = dateStr === invId && buyerId === stat.id && p.status === "sold";
          }
          
          if (match) {
            // For available items, we only allow returning them to warehouse or changing status
            // But the UI currently allows editing date/settled for the whole group.
            if (p.status === "sold") {
               return {
                 ...p,
                 saleDate: editDate || p.saleDate,
                 settled: editSettled,
                 settleDate: editSettled ? (p.settleDate || editDate) : null,
               };
            }
          }
          return p;
        });
        return { ...d, products: updatedProducts };
      });
      if (notify) notify("تغییرات با موفقیت ذخیره شد");
    }
    setEditingId(null);
  };

  const doDeleteInvoice = (inv) => {
    if (setData) {
      setData(d => {
        const updatedProducts = d.products.map(p => {
          const isMatch = inv.items.some(item => item.id === p.id);
          if (isMatch) {
            return { ...p, status: "available", location: "warehouse", buyerCustomerId: null, buyerName: "", buyerPhone: "", saleDate: null, settled: false, settleDate: null };
          }
          return p;
        });
        return { ...d, products: updatedProducts };
      });
      showToast("محصولات به انبار برگشت داده شدند");
    }
  };

  const handleDeleteInvoice = (inv) => {
    setConfirmDeleteInv(inv);
  };

  const handleToggleItemStatus = (p) => {
     if (p.isAvailableInGallery) {
       // Cannot toggle settled status for available item
       return;
     }
     if (setData) {
       setData(d => {
         const updatedProducts = d.products.map(prod => {
           if (prod.id === p.id) {
             const newSettled = !prod.settled;
             return { ...prod, settled: newSettled, settleDate: newSettled ? (prod.saleDate || new Date().toISOString()) : null };
           }
           return prod;
         });
         return { ...d, products: updatedProducts };
       });
     }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", zIndex: 150, display: "flex", flexDirection: "column" }} dir="rtl">
      <div style={{ flex: 1, overflowY: "auto", background: "#141414", maxWidth: 520, width: "100%", margin: "0 auto", paddingBottom: 80 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 14px", borderBottom: "1px solid #232323", position: "sticky", top: 0, background: "#141414", zIndex: 10 }}>
          <button style={{ background: "transparent", border: "none", color: "#aaa" }} onClick={onClose}><X size={16} /></button>
          <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#F5F0EB" }}>فاکتورهای - {stat.name}</span>
          
          <button 
            style={{ padding: "6px 12px", background: "#8B1A1A", color: "#fff", border: "none", borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
            onClick={handlePrintSelected}
          >
            <Printer size={12} /> چاپ موارد انتخاب شده
          </button>
        </div>
        <div style={{ padding: 14 }}>
          {invoices.length === 0 ? (
             <div style={{ textAlign: "center", color: "#666", fontSize: 12, marginTop: 40 }}>هیچ فاکتوری یافت نشد.</div>
          ) : (
            invoices.map((inv, idx) => (
              <div id={'invoice-card-' + inv.id} key={idx} style={{ background: "#1c1c1c", borderRadius: 8, overflow: "hidden", marginBottom: 12, border: "1px solid #2a2a2a" }}>
                
                <div style={{ padding: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8, borderBottom: "1px solid #333", paddingBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", minWidth: 0 }} onClick={() => toggleSelect(inv.id)}>
                      {selectedInvoices[inv.id] ? <CheckCircle2 size={16} color="#8B1A1A" /> : <Circle size={16} color="#555" />}
                      <div style={{ fontSize: 12, color: "#ddd", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inv.isAvailableGroup ? "محصولات موجود در گالری" : fmtDate(inv.date)}</div>
                    </div>

                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                      {!inv.isAvailableGroup && (
                        <div style={{ fontSize: 11, color: inv.allSettled ? "#5fd180" : "#e08a8a" }}>
                          {inv.allSettled ? "تسویه شده" : "تسویه نشده"}
                        </div>
                      )}
                      {!inv.isAvailableGroup && (
                        <button style={{ background: "transparent", border: "none", color: "#ccc", cursor: "pointer", padding: 4 }} onClick={() => handleEditClick(inv)} title="ویرایش تاریخ/وضعیت کلی"><Edit2 size={13} /></button>
                      )}
                      <button style={{ background: "transparent", border: "none", color: "#e08a8a", cursor: "pointer", padding: 4 }} onClick={() => handleDeleteInvoice(inv)} title="حذف گروه و بازگشت به انبار">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                  
                  {editingId === inv.id ? (
                    <div style={{ background: "#141414", padding: 12, borderRadius: 8, margin: "12px 0" }}>
                      <div style={{ fontSize: 10, color: "#888", fontWeight: 600, marginBottom: 8 }}>ویرایش فاکتور</div>
                      <div style={{ marginBottom: 6 }}>
                        <div style={{ fontSize: 9, color: "#555", marginBottom: 3 }}>تاریخ فاکتور</div>
                        <JalaliDatePicker style={{ background: "#1c1c1c", color: "#ddd", padding: "6px 10px", fontSize: 11, border: "1px solid #2a2a2a", borderRadius: 6, width: "100%", boxSizing: "border-box", margin: 0, fontFamily: "inherit" }} value={editDate} onChange={(val) => setEditDate(val)} />
                      </div>
                      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: "#ccc", cursor: "pointer", marginTop: 8 }}>
                        <input
                          type="checkbox"
                          checked={editSettled}
                          onChange={(e) => setEditSettled(e.target.checked)}
                        />
                        فاکتور کامل تسویه شده است
                      </label>
                      <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
                        <button
                          style={{ padding: "6px 0", flex: 1, background: "#5fd180", color: "#000", border: "none", borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: "pointer" }}
                          onClick={() => handleSaveInvoiceEdit(inv.id)}
                        >
                          ذخیره تغییرات
                        </button>
                        <button
                          style={{ padding: "6px 0", flex: 1, background: "#2a2a2a", color: "#ccc", border: "none", borderRadius: 6, fontSize: 10, cursor: "pointer" }}
                          onClick={() => setEditingId(null)}
                        >
                          لغو
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ margin: "10px 0", padding: "10px", background: "#141414", borderRadius: 8 }}>
                      {inv.items.map(p => (
                         <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#ccc", marginBottom: 6, borderBottom: "1px solid #1e1e1e", paddingBottom: 6 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
                            <button style={{ background: "transparent", border: "none", color: "#8B1A1A", cursor: "pointer", padding: 2, flexShrink: 0 }} onClick={() => setConfirmReturnProduct(p)} title="بازگشت به انبار"><X size={10}/></button>
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>#{fmtCode(p.code)} {p.name}</span>
                            {!p.isAvailableInGallery && (
                               <button 
                                 style={{ background: p.settled ? "#21965320" : "#d87c1d20", color: p.settled ? "#219653" : "#d87c1d", border: "none", padding: "2px 6px", borderRadius: 4, fontSize: 9, cursor: "pointer", marginRight: 8, flexShrink: 0 }}
                                 onClick={() => handleToggleItemStatus(p)}
                               >
                                 {p.settled ? "تسویه" : "بدهکار"}
                               </button>
                            )}
                          </div>
                          {!p.isAvailableInGallery && (
                            <input
                              type="number" min={0} max={100} onFocus={(e) => e.target.select()}
                              value={toNum(p.discountPercent) || ""}
                              placeholder="0٪"
                              onChange={(e) => handleItemDiscountChange(p, e.target.value)}
                              title="درصد تخفیف این کالا"
                              style={{ width: 42, height: 24, padding: "2px 4px", textAlign: "center", fontSize: 10, background: "#1c1c1c", border: "1px solid #2a2a2a", borderRadius: 5, color: "#ddd", flexShrink: 0 }}
                            />
                          )}
                          <span style={{ flexShrink: 0, minWidth: 60, textAlign: "left" }}>{fmt(toNum(p.salePrice) || toNum(p.price))} ت</span>
                        </div>
                      ))}
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#fff", fontWeight: 600, marginTop: 10 }}>
                        <span>جمع کل:</span>
                        <span>{fmt(inv.total)} ت</span>
                      </div>

                      {!inv.isAvailableGroup && (
                        <div style={{ marginTop: 10 }}>
                          {editingId2 !== inv.id ? (
                            <button onClick={() => setEditingId2(inv.id)} style={{ width: "100%", justifyContent: "center", display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "1px solid #2a2a2a", color: "#888", borderRadius: 6, padding: "6px 0", fontSize: 10, cursor: "pointer" }}>
                              <Plus size={12} /> افزودن محصول به این فاکتور
                            </button>
                          ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                              <input
                                autoFocus placeholder="جستجوی محصول موجود..."
                                value={addItemQuery} onChange={(e) => setAddItemQuery(e.target.value)}
                                style={{ width: "100%", height: 30, background: "#1c1c1c", border: "1px solid #2a2a2a", borderRadius: 6, color: "#ddd", fontSize: 11, padding: "0 10px", boxSizing: "border-box" }}
                              />
                              <div style={{ maxHeight: 140, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
                                {addItemResults.length === 0 ? (
                                  <div style={{ fontSize: 9.5, color: "#555", padding: "6px 0" }}>محصول موجودی پیدا نشد</div>
                                ) : addItemResults.map((p) => (
                                  <div key={p.id}
                                    onClick={() => { handleAddItemToInvoice(inv, p); setEditingId2(null); setAddItemQuery(""); }}
                                    style={{ fontSize: 10, color: "#ccc", padding: "6px 8px", background: "#1c1c1c", borderRadius: 5, cursor: "pointer", display: "flex", justifyContent: "space-between" }}
                                  >
                                    <span>#{fmtCode(p.code)} {p.name}</span>
                                    <span style={{ color: "#5fd180" }}>{fmt(toNum(p.discountedPrice ?? p.salePrice))} ت</span>
                                  </div>
                                ))}
                              </div>
                              <button onClick={() => { setEditingId2(null); setAddItemQuery(""); }} style={{ alignSelf: "flex-end", background: "transparent", border: "1px solid #2a2a2a", color: "#888", borderRadius: 6, padding: "4px 10px", fontSize: 9.5, cursor: "pointer" }}>بستن</button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      {activePrintInvoice && (
        <InvoicePrint 
          invoiceData={activePrintInvoice}
          businessCard={businessCard}
          autoPrint={true}
          onClose={() => setActivePrintInvoice(null)}
        />
      )}
      {confirmDeleteInv && (
        <ConfirmDialog
          title="حذف فاکتور"
          message="آیا از حذف این گروه فاکتور اطمینان دارید؟ تمامی محصولات آن به انبار برمی‌گردند."
          confirmLabel="حذف"
          onConfirm={() => { doDeleteInvoice(confirmDeleteInv); setConfirmDeleteInv(null); }}
          onCancel={() => setConfirmDeleteInv(null)}
        />
      )}
      {confirmReturnProduct && (
        <ConfirmDialog
          title="بازگشت به انبار"
          message="آیا این محصول به انبار برگردد؟"
          confirmLabel="بازگشت به انبار"
          onConfirm={() => { onSetProductAvailable(confirmReturnProduct.id, "warehouse"); setConfirmReturnProduct(null); }}
          onCancel={() => setConfirmReturnProduct(null)}
        />
      )}
    </div>
  );
}

export default function GalleryTab({
  customers,
  products,
  onUpdateCustomer,
  onAddCustomer,
  onDeleteCustomer,
  onSetProductSold,
  onSetProductSettled,
  onReturnToWarehouse,
  onSetProductAvailable,
  businessCard,
  // fallback props from App.jsx
  customerStats,
  productTotals,
  setData,
  onRequestDeleteCustomer,
  notify,
  sortOrder,
  setSortOrder,
  refreshResetTick,
  stickyTop,
}) {
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [gallerySearch, setGallerySearch] = useState("");
  const [statusFilter, setStatusFilter] = useState([]); // چند-انتخابی: "debt" | "hasStock"

  // Refresh (تک‌ضربه) → ریست فیلترهای گالری + بستن ردیف‌های بازشده
  useEffect(() => {
    if (!refreshResetTick) return;
    setGallerySearch("");
    setStatusFilter([]);
    if (setSortOrder) setSortOrder("name");
    setExpandedCardId(null);
  }, [refreshResetTick]);
  useEffect(() => {
    if (!editingCustomer) return;
    return pushBackHandler(() => setEditingCustomer(null));
  }, [editingCustomer]);
  const [expandedCardId, setExpandedCardId] = useState(null);
  const handleToggleCard = (id) => setExpandedCardId((prev) => {
    const next = prev === id ? null : id;
    return next;
  });

  const actualCustomers = customers || customerStats || [];
  const actualProducts = products || productTotals || [];

  const resolvedOnAddCustomer = onAddCustomer || ((newCust) => {
    if (setData) {
      setData((d) => ({
        ...d,
        customers: [...(d.customers || []), newCust]
      }));
      if (notify) notify("مشتری جدید ثبت شد");
    }
  });

  const resolvedOnUpdateCustomer = onUpdateCustomer || ((updatedCust) => {
    if (setData) {
      setData((d) => ({
        ...d,
        customers: (d.customers || []).map((c) => c.id === updatedCust.id ? updatedCust : c)
      }));
      if (notify) notify("اطلاعات ویرایش شد");
    }
  });

  const resolvedOnDeleteCustomer = onDeleteCustomer || onRequestDeleteCustomer || ((id) => {
    if (setData) {
      setData((d) => ({
        ...d,
        customers: (d.customers || []).filter((c) => c.id !== id),
        products: (d.products || []).map((p) => p.location === id ? { ...p, location: "warehouse" } : p)
      }));
      if (notify) notify("مشتری حذف شد");
    }
  });

  const resolvedOnSetProductSold = onSetProductSold || ((productId, saleDate, customerId) => {
    if (setData) {
      setData((d) => ({
        ...d,
        products: (d.products || []).map((p) => p.id === productId ? { ...p, status: "sold", saleDate: saleDate || todayISO(), buyerCustomerId: customerId } : p)
      }));
    }
  });

  const resolvedOnSetProductSettled = onSetProductSettled || ((productId, settled, settleDate) => {
    if (setData) {
      setData((d) => ({
        ...d,
        products: (d.products || []).map((p) => p.id === productId ? { ...p, settled: !!settled, settleDate: settleDate || todayISO() } : p)
      }));
    }
  });

  const resolvedOnReturnToWarehouse = onReturnToWarehouse || ((productId) => {
    if (setData) {
      setData((d) => ({
        ...d,
        products: (d.products || []).map((p) => p.id === productId ? { ...p, location: "warehouse", status: "available", saleDate: null, settled: false, settleDate: null, buyerCustomerId: null, buyerName: "", buyerPhone: "" } : p)
      }));
    }
  });

  const resolvedOnSetProductAvailable = onSetProductAvailable || ((productId, galleryId) => {
    if (setData) {
      setData((d) => ({
        ...d,
        products: (d.products || []).map((p) => p.id === productId ? { ...p, status: "available", location: galleryId || "warehouse", saleDate: null, settled: false, settleDate: null, buyerCustomerId: null, buyerName: "", buyerPhone: "" } : p)
      }));
    }
  });

  const gallerySortFn = (a, b) => {
    const baseSort = String(sortOrder || "").replace(/_desc$/, "");
    const isDesc = String(sortOrder || "").endsWith("_desc");
    let cmp;
    switch (baseSort) {
      case "date":
        cmp = (b.createdAt || "").localeCompare(a.createdAt || "");
        break;
      case "count":
        cmp = (toNum(b.totalItems)) - (toNum(a.totalItems));
        break;
      case "balance":
        cmp = (toNum(b.outstanding)) - (toNum(a.outstanding));
        break;
      case "az":
      default:
        cmp = (a.name || "").localeCompare(b.name || "", "fa");
        break;
    }
    return isDesc ? -cmp : cmp;
  };

  const matchesSearchAndStatus = (c) => {
    if (gallerySearch.trim()) {
      const q = gallerySearch.trim().toLowerCase();
      const hay = `${c.name || ""} ${c.phone || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (statusFilter.length > 0) {
      const isDebt = toNum(c.outstanding) > 0;
      const hasStock = toNum(c.totalItems) > 0;
      const matchesAny = statusFilter.some((f) => (f === "debt" ? isDebt : f === "hasStock" ? hasStock : true));
      if (!matchesAny) return false;
    }
    return true;
  };

  const galleries = actualCustomers.filter(c => c.kind === "gallery").filter(matchesSearchAndStatus).slice().sort(gallerySortFn);
  const direct = actualCustomers.filter(c => c.kind === "customer").filter(matchesSearchAndStatus).slice().sort(gallerySortFn);

  const handleUpdateColor = (id, color) => {
    const c = actualCustomers.find(x => x.id === id);
    if (c) resolvedOnUpdateCustomer({ ...c, color });
  };

  return (
    <div style={{ padding: "0 0 100px 0", width: "100%", position: "relative" }} dir="rtl">
      
      <div
        style={{
          position: "sticky",
          top: stickyTop,
          zIndex: 8,
          background: "#0a0a0a",
          padding: "8px 0 12px",
          marginBottom: 12,
          display: "flex",
          gap: 6,
          alignItems: "center",
        }}
      >
        <div style={{ flex: 1, display: "flex", alignItems: "center", background: "#161616", border: "1px solid #232323", borderRadius: 8, padding: "0 10px", gap: 6, height: 32, minHeight: 32, boxSizing: "border-box" }}>
          <Search size={13} color="#555" />
          <input onFocus={(e) => e.target.select()}
            style={{ background: "transparent", border: "none", outline: "none", color: "#ddd", fontSize: 11, flex: 1, fontFamily: "inherit" }}
            placeholder="جستجو (نام، شماره)"
            value={gallerySearch}
            onChange={(e) => setGallerySearch(e.target.value)}
          />
          {gallerySearch && (
            <button
              style={{ background: "transparent", border: "none", color: "#888", cursor: "pointer", padding: "0 2px", display: "flex", alignItems: "center" }}
              onClick={() => setGallerySearch("")}
            >
              <X size={13} />
            </button>
          )}
        </div>
        <GalleryStatusFilter value={statusFilter} onChange={setStatusFilter} />
        <SortButton sortOrder={sortOrder} setSortOrder={setSortOrder} modes={SORT_MODES} />
      </div>

      <div style={{ padding: 0, display: "flex", flexDirection: "column", gap: 16 }}>
        
        {/* Gallery Box */}
        <div style={{ background: "#111", border: "1px solid #1f1f1f", borderRadius: 12, padding: "12px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#a89bd4" }} />
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "#a89bd4" }}>گالری‌ها</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {galleries.map(g => (
              <CustomerCard setData={setData} notify={notify} 
                key={g.id} stat={g} products={actualProducts} allCustomers={actualCustomers} businessCard={businessCard}
                onEdit={(c) => setEditingCustomer(c)} onRequestDelete={resolvedOnDeleteCustomer}
                onSetProductSold={resolvedOnSetProductSold} onSetProductSettled={resolvedOnSetProductSettled}
                onReturnToWarehouse={resolvedOnReturnToWarehouse} onSetProductAvailable={resolvedOnSetProductAvailable}
                onUpdateColor={handleUpdateColor}
                open={expandedCardId === g.id}
                onToggle={() => handleToggleCard(g.id)}
              />
            ))}
            {galleries.length === 0 && (
              <div style={{ textAlign: "center", color: "#444", padding: "14px 0", fontSize: 11 }}>هیچ گالری ثبت نشده</div>
            )}
          </div>
        </div>

        {/* Customer Box */}
        <div style={{ background: "#111", border: "1px solid #1f1f1f", borderRadius: 12, padding: "12px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#f2c94c" }} />
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "#f2c94c" }}>مشتریان</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {direct.map(c => (
              <CustomerCard setData={setData} notify={notify} 
                key={c.id} stat={c} products={actualProducts} allCustomers={actualCustomers} businessCard={businessCard}
                onEdit={(c) => setEditingCustomer(c)} onRequestDelete={resolvedOnDeleteCustomer}
                onSetProductSold={resolvedOnSetProductSold} onSetProductSettled={resolvedOnSetProductSettled}
                onReturnToWarehouse={resolvedOnReturnToWarehouse} onSetProductAvailable={resolvedOnSetProductAvailable}
                onUpdateColor={handleUpdateColor}
                open={expandedCardId === c.id}
                onToggle={() => handleToggleCard(c.id)}
              />
            ))}
            {direct.length === 0 && (
              <div style={{ textAlign: "center", color: "#444", padding: "14px 0", fontSize: 11 }}>هیچ مشتری ثبت نشده</div>
            )}
          </div>
        </div>

      </div>

      {editingCustomer && (
        <CustomerEditor
          customer={editingCustomer}
          setCustomer={setEditingCustomer}
          allCustomers={actualCustomers} businessCard={businessCard}
          onClose={() => setEditingCustomer(null)}
          onSave={(updated) => {
            if (updated.id && actualCustomers.some(c => c.id === updated.id)) {
              resolvedOnUpdateCustomer(updated);
            } else {
              resolvedOnAddCustomer(updated);
            }
            setEditingCustomer(null);
          }}
        />
      )}

      {/* Floating Add Button */}
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
          setEditingCustomer({
            ...emptyCustomer(),
            kind: "customer",
            gender: "آقا",
          });
        }}
      >
        <Plus size={22} />
      </button>

    </div>
  );
}
