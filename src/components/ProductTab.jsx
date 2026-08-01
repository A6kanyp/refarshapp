// ============================================================
// ProductTab.jsx - Refarsh Clean (نسخه نهایی با تصاویر پویا)
// ============================================================
import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Plus, X, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  Trash2, Edit3, ImagePlus, Search,
  Star, Share2, ShoppingBag, Package, Lock, Unlock, Save,
  Link2, Unlink, RotateCcw, MapPin, CheckCircle2, Store, Landmark, Undo2,
  Copy, Camera, Printer, Gift, Eye, EyeOff, Tag, Clock
} from "lucide-react";
import html2canvas from "html2canvas";
import { toNum, fmt, fmtCode, fmtDate, todayISO, parseDims, dimsArea, getProductArea, normalizeNumericInput, calcProfitFromPrice, calcPriceFromProfit, formatProductDims, formatDimsHuman, qtySuffix } from "../mathCore";

import { SCRATCH_KEYS, saveScratch, loadScratch, clearScratch } from "../scratchpad";
import { saveFile, shareText } from "../utils/nativeSave";
import { compressImageFile } from "../utils/imageCompress";
import { saveImageToFolder, IMAGE_CATEGORIES, useResolvedImageSrc } from "../utils/imageStorage";
import { handleEnterNavigate } from "../utils/formNav";
import { pushBackHandler } from "../utils/backButton";
import {
  emptyProduct, emptyLineItem, DEFAULT_COST_LABELS,
  GALLERY_COLOR_PALETTE, uid, refundVanishedDeductions, emptyProductType,
} from "../dataModels";
import { useToast } from "../contexts/ToastContext.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { formatPriceInput, parsePriceInput, formatPhoneInput, parsePhoneInput, getJalaliTimestamp } from "../utils/formatters";
import { JalaliDatePicker } from "./JalaliDatePicker";
import { FilterPopup } from "./FilterPopup";
import InvoicePrint from "./InvoicePrint";
import { useRegisterOpenModal } from "../utils/modalRegistry";

// ── ProductImage ──
// بخش «بازطراحی ذخیره‌سازی عکس‌ها» (Wall 🟣): جایگزین همون <img src={getImageUrl(x)}/>
// قدیمی، ولی چون عکس‌های جدید دیگه base64 نیستن (فقط اسم فایل توی رکورده) و
// خواندن فایل از پوشه‌ی محلی/IndexedDB به‌طور ذاتی async هست، این کامپوننت
// حل‌شدن src رو مدیریت می‌کنه. برای عکس‌های قدیمی (که هنوز data:/http مستقیم
// ذخیره شدن) مستقیم همون رشته رو نشون می‌ده — سازگاری به عقب حفظ می‌شه.
function ProductImage({ filename, alt = "", style, loading, className, ...rest }) {
  const isLegacyInline = !!filename && (filename.startsWith("data:") || filename.startsWith("http") || filename.startsWith("/"));
  const resolvedSrc = useResolvedImageSrc(isLegacyInline ? null : filename, IMAGE_CATEGORIES.PRODUCT);
  if (!filename) return null;
  const src = isLegacyInline ? filename : resolvedSrc;
  // resolvedSrc===null یعنی هنوز در حال resolve؛ undefined/خالی بعد از resolve = فایل نیست
  if (!isLegacyInline && resolvedSrc === undefined) {
    return <div className={className} style={{ ...style, background: "#161616" }} />;
  }
  if (!src) {
    // فایل در پوشه/IndexedDB پیدا نشد — علامت زرد کوچک بدون تغییر چیدمان والد
    return (
      <div className={className} style={{ ...style, background: "#161616", position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span title="فایل عکس در پوشه پیدا نشد" style={{ position: "absolute", top: 4, left: 4, width: 16, height: 16, borderRadius: "50%", background: "#e0b93c", color: "#1a1a1a", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>!</span>
      </div>
    );
  }
  return <img src={src} alt={alt} style={style} loading={loading} className={className} {...rest} />;
}

// ── استایل‌های مشترک ──
const S = {
  input: { width:"100%", background:"#1c1c1c", border:"1px solid #2a2a2a", borderRadius:6, padding:"7px 10px", color:"#ddd", fontFamily:"inherit", fontSize:11, outline:"none", boxSizing:"border-box" },
  iconBtn: { background:"transparent", border:"none", cursor:"pointer", padding:"4px 6px", display:"flex", alignItems:"center" },
  chip: { background:"#1c1c1c", border:"1px solid #2a2a2a", color:"#888", fontSize:10, padding:"6px 9px", borderRadius:12, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap", display:"inline-flex", alignItems:"center", justifyContent:"center", minHeight:32, height:32, boxSizing:"border-box" },
  chipActive: { background:"#2a1414", border:"1px solid #8B1A1A", color:"#d88888" },
  chipYellow: { background:"#3a2a10", border:"1px solid #d4b400", color:"#f2c94c" },
  sectionLabel: { fontSize:10, color:"#666", fontWeight:600, letterSpacing:1, textTransform:"uppercase", margin:"14px 0 7px" },
  overlay: { position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", zIndex:100, display:"flex", flexDirection:"column" },
  sheet: { width:"100%", maxWidth:520, margin:"0 auto", background:"#141414", borderRadius:"16px 16px 0 0", flex:1, display:"flex", flexDirection:"column", overflowY:"auto", marginTop:"auto" },
  sheetHeader: { display:"flex", alignItems:"center", gap:8, padding:"12px 14px 10px", borderBottom:"1px solid #232323", position:"sticky", top:0, background:"#141414", zIndex:10 },
};

// ── ثابت‌های مرتب‌سازی ──
const SORT_MODES = [
  { key: "az", kind: "text", ascText: "Az", descText: "Za", label: "الفبا" },
  { key: "code", kind: "text", ascText: "123", descText: "321", label: "کد محصول" },
  { key: "stock", kind: "icon", Icon: ShoppingBag, label: "وضعیت موجودی" },
  { key: "date", kind: "icon", Icon: Clock, label: "تاریخ" },
];

function cycleSort(current) {
  const base = String(current || "").replace(/_desc$/, "");
  const keys = SORT_MODES.map((m) => m.key);
  const idx = keys.indexOf(base);
  return keys[(idx + 1) % keys.length];
}

// ── دکمه سورت ──
function SortButton({ sortOrder, setSortOrder, modes, style, groupedView, onToggleGrouped, groupByTypeActive, onGroupByType }) {
  const [showPopup, setShowPopup] = useState(false);
  const wrapRef = useRef(null);
  const baseOrder = String(sortOrder || "").replace(/_desc$/, "");
  const isDesc = String(sortOrder || "").endsWith("_desc");

  useEffect(() => {
    if (!showPopup) return;
    const handleClickOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setShowPopup(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showPopup]);

  const current = modes.find((m) => m.key === baseOrder) || modes[0];

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
    <div style={{ position: "relative" }} ref={wrapRef}>
      <button
        style={{
          ...S.chip,
          padding: "6px 10px",
          fontSize: 10,
          position: "relative",
          ...style,
        }}
        onClick={() => setShowPopup((v) => !v)}
      >
        {renderMode(current, true)}
      </button>

      <FilterPopup open={showPopup} onClose={() => setShowPopup(false)} width={170}>
        {onToggleGrouped && (
          <>
            <button
              style={{
                display: "block",
                width: "100%",
                padding: "8px 10px",
                background: groupedView ? "#2a1414" : "transparent",
                border: "none",
                borderRadius: 4,
                color: groupedView ? "#d88888" : "#ddd",
                fontSize: 11,
                fontFamily: "inherit",
                cursor: "pointer",
                textAlign: "right",
              }}
              onClick={() => { if (!groupedView) onToggleGrouped(); }}
            >
              دسته‌بندی
            </button>
            <button
              style={{
                display: "block",
                width: "100%",
                padding: "8px 10px",
                background: !groupedView ? "#2a1414" : "transparent",
                border: "none",
                borderRadius: 4,
                color: !groupedView ? "#d88888" : "#ddd",
                fontSize: 11,
                fontFamily: "inherit",
                cursor: "pointer",
                textAlign: "right",
              }}
              onClick={() => { if (groupedView) onToggleGrouped(); }}
            >
              یکجا
            </button>
            {onGroupByType && (
              // گزینه‌ی جدید: گروه‌بندی بر اساس نوع محصول (نه دسته‌بندی/فرش) — آیتم ۱۲ (Ash 🟡)
              <button
                style={{
                  display: "block",
                  width: "100%",
                  padding: "8px 10px",
                  background: groupByTypeActive ? "#2a1414" : "transparent",
                  border: "none",
                  borderRadius: 4,
                  color: groupByTypeActive ? "#d88888" : "#ddd",
                  fontSize: 11,
                  fontFamily: "inherit",
                  cursor: "pointer",
                  textAlign: "right",
                }}
                onClick={onGroupByType}
              >
                گروه‌بندی بر اساس نوع محصول
              </button>
            )}
            <div style={{ borderTop: "1px solid #2a2a2a", margin: "4px 0" }} />
          </>
        )}
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
            }}
          >
            {mode.label && <span>{mode.label}</span>}
            {renderMode(mode, baseOrder === mode.key)}
          </button>
        ))}
      </FilterPopup>
    </div>
  );
}

// ── هوک سفارشی مدیریت فیلتر مکان ──
function useLocationFilter(galleryCustomers) {
  const [selectedWarehouse, setSelectedWarehouse] = useState(false);
  const [selectedGalleries, setSelectedGalleries] = useState([]);
  const [showLocationMenu, setShowLocationMenu] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowLocationMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleWarehouse = () => setSelectedWarehouse(!selectedWarehouse);
  const toggleGallery = (gId) => {
    setSelectedGalleries((prev) =>
      prev.includes(gId) ? prev.filter((id) => id !== gId) : [...prev, gId]
    );
  };
  const toggleAllGalleries = () => {
    const allIds = galleryCustomers.map((g) => g.id);
    if (selectedGalleries.length === allIds.length && allIds.every(id => selectedGalleries.includes(id))) {
      setSelectedGalleries([]);
    } else {
      setSelectedGalleries(allIds);
    }
  };
  const isLocationSelected = () => selectedWarehouse || selectedGalleries.length > 0;
  const getLocationLabel = () => {
    const allGalleryIds = galleryCustomers.map(g => g.id);
    const everythingSelected = selectedWarehouse && 
                             (allGalleryIds.length === 0 || allGalleryIds.every(id => selectedGalleries.includes(id)));
    
    if (everythingSelected) return "همه";
    if (!isLocationSelected()) return "همه";

    const parts = [];
    if (selectedWarehouse) parts.push("انبار");
    if (selectedGalleries.length > 0) {
      const names = selectedGalleries
        .map((id) => galleryCustomers.find((g) => g.id === id)?.name)
        .filter(Boolean);
      parts.push(...names);
    }
    return parts.length > 0 ? parts.join(" + ") : "همه";
  };
  const resetLocationFilter = () => {
    setSelectedWarehouse(false);
    setSelectedGalleries([]);
    setShowLocationMenu(false);
  };

  return {
    selectedWarehouse,
    selectedGalleries,
    showLocationMenu,
    menuRef,
    toggleWarehouse,
    toggleGallery,
    toggleAllGalleries,
    isLocationSelected,
    getLocationLabel,
    resetLocationFilter,
    setShowLocationMenu,
  };
}

// ── HighlightMatch ──
function HighlightMatch({ text, query }) {
  if (!query) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <span style={{ color:"#f2c94c", fontWeight:700 }}>{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </>
  );
}

// ── AutoSuggest عمومی ──
function GenericAutoSuggest({ value, onChange, options, placeholder, filterKey = "name", style = {} }) {
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const matches = useMemo(() => {
    if (!value.trim()) return options.slice(0, 6);
    const q = value.toLowerCase();
    const starts = options.filter((o) => String(o[filterKey]).toLowerCase().startsWith(q));
    const includes = options.filter((o) => !starts.includes(o) && String(o[filterKey]).toLowerCase().includes(q));
    return [...starts, ...includes].slice(0, 6);
  }, [value, options, filterKey]);

  const selectMatch = (item) => {
    onChange(item);
    setOpen(false);
    setActiveIdx(-1);
  };

  const onKeyDown = (e) => {
    if (!open || !matches.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => Math.min(matches.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx((i) => Math.max(0, i - 1)); }
    else if (e.key === "Enter" && activeIdx >= 0) { e.preventDefault(); selectMatch(matches[activeIdx]); }
    else if (e.key === "Escape") { setOpen(false); }
  };

  return (
    <div style={{ position:"relative" }}>
      <input style={{ ...S.input, ...style }} value={value ?? ""}
        onChange={(e) => { onChange({ name: e.target.value }); setOpen(true); setActiveIdx(-1); }}
        onFocus={(e) => { e.target.select(); setOpen(true); }} onBlur={() => setTimeout(() => setOpen(false), 200)}
        onKeyDown={onKeyDown}
        placeholder={placeholder} />
      {open && matches.length > 0 && (
        <div style={{ position:"absolute", top:"100%", left:0, right:0, background:"#1c1c1c", border:"1px solid #2a2a2a", borderRadius:6, zIndex:20, maxHeight:200, overflowY:"auto" }}>
          {matches.map((item, i) => (
            <div key={item.id || i} style={{ padding:"7px 10px", fontSize:11, color:"#ddd", cursor:"pointer", background: i === activeIdx ? "#262626" : "transparent" }}
              onMouseDown={() => selectMatch(item)}
              onMouseEnter={() => setActiveIdx(i)}>
              <HighlightMatch text={String(item[filterKey])} query={value} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── ProductCard ──
function ProductCard({ p, customers, materials, onEdit, onDelete, onImageUpload, onOpenLightbox, onToggleExpand, onSetStatus, onReturnToAvailable, onMoveToGallery, onToggleHideFromCatalog, expanded }) {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const cust = customers.find((c) => c.id === p.location);
  const locationColor = p.location === "warehouse" ? "#a89bd4" : (cust?.color || "#a89bd4");
  const locationLabel = p.location === "warehouse"
    ? "پیش خودم"
    : (cust?.kind === "gallery" 
        ? `پیش ${cust?.name || "گالری"}` 
        : `مشتری: ${cust?.gender === "خانم" ? "خانم" : cust?.gender === "آقا" ? "آقای" : ""} ${cust?.name || "مشتری"}`.trim());
  const isSold = p.status === "sold";
  const isSettled = p.settled === true;

  const buyerCust = p.buyerCustomerId ? customers.find(c => c.id === p.buyerCustomerId) : null;
  const buyerGenderPrefix = buyerCust?.gender === "خانم" ? "خانم " : buyerCust?.gender === "آقا" ? "آقای " : "";
  const buyerDisplayName = buyerCust ? `${buyerGenderPrefix}${buyerCust.name}` : p.buyerName;

  const galleryCustomers = customers.filter(c => c.kind === "gallery");
  const [showGalleryPicker, setShowGalleryPicker] = useState(false);

  return (
    <div style={{ background:"#161616", border:"1px solid #232323", borderRadius:10, marginBottom:7, overflow:"hidden", opacity: p.hiddenFromCatalog ? 0.55 : 1 }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", cursor:"pointer" }} onClick={() => onToggleExpand(p.id)}>
        <div style={{ width:40, height:40, borderRadius:6, background:"#111", overflow:"hidden", flexShrink:0, cursor:"pointer", position:"relative" }}
          onClick={(e) => { e.stopPropagation(); if (p.image) onOpenLightbox(p.id); }}>
          {p.image ? (
            <ProductImage filename={p.image} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
          ) : (
            <div style={{ width:"100%", height:"100%", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <label style={{ cursor:"pointer" }} onClick={(e) => e.stopPropagation()}>
                <ImagePlus size={16} color="#444" />
                <input type="file" accept="image/*" style={{ display:"none" }} onChange={(e) => onImageUpload(e, p.id)} />
              </label>
            </div>
          )}
        </div>

        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <span style={{ fontSize:9.5, color:"#8B1A1A", fontWeight:600 }}>#{fmtCode(p.code)}</span>
            <span style={{ fontSize:12, color:"#F5F0EB", fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.name}</span>
            {(!String(p.code ?? "").toString().trim() || !String(p.name || "").trim()) && (
              <span title="فیلد الزامی خالی (کد یا نام)" style={{ width:14, height:14, borderRadius:"50%", background:"#e0b93c", color:"#1a1a1a", fontSize:10, fontWeight:700, display:"inline-flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>!</span>
            )}
          </div>
          <div style={{ display:"flex", gap:6, marginTop:3, flexWrap:"wrap" }}>
            {p.dims && <span style={{ fontSize:9.5, color:"#666" }}>{formatProductDims(p)}{qtySuffix(p)}</span>}
            <span style={{ fontSize:9, padding:"1px 7px", borderRadius:8, background:"#1c1c1c", color:locationColor }}>{locationLabel}</span>
            {isSold && (
              <span style={{ fontSize:9, padding:"1px 7px", borderRadius:8, background: isSettled ? "#1d3a24" : "#3a1d1d", color: isSettled ? "#5fd180" : "#e08a8a" }}>
                {isSettled ? "تسویه شده" : "تسویه نشده"}
              </span>
            )}
            {p.isDraft && (
              <span style={{ fontSize:9, padding:"1px 7px", borderRadius:8, background:"#3a2a10", color:"#f2c94c", border:"1px solid #d4b400" }}>
                پیش‌نویس
              </span>
            )}
          </div>
        </div>

        <div style={{ textAlign:"left" }}>
          {toNum(p.discountPercent) > 0 ? (
            <>
              <div style={{ fontSize:10, color:"#e08a8a", textDecoration:"line-through" }}>{fmt(toNum(p.salePrice))} ت</div>
              <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                <span style={{ fontSize:8, background:"#1d3a24", color:"#5fd180", borderRadius:5, padding:"0 4px" }}>{p.discountPercent}٪</span>
                {toNum(p.discountPercent) >= 100 ? (
                  <span style={{ fontSize:10, background:"#3a1d33", color:"#f2a3e0", borderRadius:5, padding:"1px 6px", fontWeight:600, display:"inline-flex", alignItems:"center", gap:3 }}><Gift size={11} /> هدیه</span>
                ) : (
                  <span style={{ fontSize:11, color:"#F5F0EB", fontWeight:600 }}>{fmt(toNum(p.discountedPrice ?? p.salePrice))} ت</span>
                )}
              </div>
            </>
          ) : (
            <div style={{ fontSize:11, color:"#F5F0EB" }}>{fmt(toNum(p.salePrice))} ت</div>
          )}
          <div style={{ fontSize:9, color:"#666" }}>قیمت فروش</div>
        </div>

        {expanded ? <ChevronUp size={14} color="#555" /> : <ChevronDown size={14} color="#555" />}
      </div>

      {expanded && (
        <div style={{ padding:"0 12px 10px", borderTop:"1px solid #1e1e1e" }}>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:"#777", padding:"8px 0 4px" }}>
            <span>هزینه تمام‌شده: {fmt(p.totalCost)} ت</span>
            <span>سود: {fmt(toNum(p.discountedPrice ?? p.salePrice) - p.totalCost)} ت</span>
          </div>

          {p.saleDate && <div style={{ fontSize:9.5, color:"#555", marginTop:4 }}>تاریخ فروش: {fmtDate(p.saleDate)}</div>}
          {buyerDisplayName && !isSettled && <div style={{ fontSize:9.5, color:"#e08a8a" }}>خریدار: {buyerDisplayName}</div>}

          <div style={{ display: "flex", gap: 4, marginTop: 8, alignItems: "flex-end", justifyContent: "space-between" }}>
            {onSetStatus && (
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", flex: 1 }}>
                {p.isDraft && (
                  <button style={{ ...S.chip, fontSize: 9.5, color: "#5fd180", border: "1px solid #2d5a38", background: "#1d3a24" }} onClick={() => onSetStatus(p.id, "built")}>
                    ✓ ساخته شد
                  </button>
                )}
                {!p.isDraft && p.status === "available" && p.location === "warehouse" && (
                  <>
                    <button style={{ ...S.chip, fontSize: 9.5, color: "#888", background: "transparent", border: "1px solid #2a2a2a" }} onClick={() => onSetStatus(p.id, "sold")}>
                      فروخته شد
                    </button>
                    {onMoveToGallery && galleryCustomers.length > 0 && (
                      <>
                        {!showGalleryPicker ? (
                          <button style={{ ...S.chip, fontSize: 9.5, color: "#a89bd4" }} onClick={(e) => { e.stopPropagation(); setShowGalleryPicker(true); }}>
                            <Landmark size={10} style={{ marginLeft: 3 }} /> به گالری
                          </button>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: 4, width: "100%" }}>
                            <span style={{ fontSize: 9, color: "#666" }}>انتخاب گالری:</span>
                            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", maxHeight: 130, overflowY: "auto", padding: 2 }}>
                              {galleryCustomers.map((gc) => (
                                <button
                                  key={gc.id}
                                  style={{ ...S.chip, fontSize: 9, color: gc.color || "#a89bd4", border: "1px solid " + (gc.color || "#a89bd4") }}
                                  onClick={(e) => { e.stopPropagation(); onMoveToGallery(p.id, gc.id); setShowGalleryPicker(false); }}
                                >
                                  {gc.name}
                                </button>
                              ))}
                            </div>
                            <button style={{ ...S.chip, fontSize: 9, color: "#555", alignSelf: "flex-start" }} onClick={(e) => { e.stopPropagation(); setShowGalleryPicker(false); }}>لغو</button>
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}
                {p.status === "available" && p.location !== "warehouse" && (
                  <>
                    <button style={{ ...S.chip, fontSize: 9.5, color: "#7aa8d8" }} onClick={() => onSetStatus(p.id, "available", { clearLocation: true })}>
                      <Undo2 size={10} style={{ marginLeft: 3 }} /> برگشت به انبار
                    </button>
                    <button style={{ ...S.chip, fontSize: 9.5, color: "#888", background: "transparent", border: "1px solid #2a2a2a" }} onClick={() => onSetStatus(p.id, "sold")}>
                      فروخته شد
                    </button>
                  </>
                )}
                {p.status === "sold" && (
                  <>
                    {!isSettled && (
                      <button
                        style={{ ...S.chip, fontSize: 9.5, color: "#888", border: "1px solid #2a2a2a", background: "transparent" }}
                        onClick={() => onSetStatus(p.id, "settled")}
                      >
                        تسویه شده
                      </button>
                    )}
                    {isSettled && (
                      <button
                        style={{ ...S.chip, fontSize: 9.5, color: "#888", border: "1px solid #2a2a2a", background: "transparent" }}
                        onClick={() => onSetStatus(p.id, "unsettled")}
                      >
                        تسویه نشده
                      </button>
                    )}
                    {onReturnToAvailable && (
                      <button style={{ ...S.chip, fontSize: 9.5, color: "#7aa8d8" }} onClick={() => onReturnToAvailable(p.id)}>
                        <Undo2 size={10} style={{ marginLeft: 3 }} /> برگشت به موجودی
                      </button>
                    )}
                  </>
                )}
              </div>
            )}

            <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
              {onToggleHideFromCatalog && (
                <button
                  style={{ ...S.chip, color: p.hiddenFromCatalog ? "#e0a35a" : "#aaa", padding: "4px 6px" }}
                  title={p.hiddenFromCatalog ? "الان از کاتالوگ عمومی مخفیه — نمایش بده" : "از کاتالوگ عمومی مخفی کن"}
                  onClick={() => onToggleHideFromCatalog(p.id)}
                >
                  {p.hiddenFromCatalog ? <EyeOff size={12} /> : <Eye size={12} />}
                </button>
              )}
              <button style={{ ...S.chip, color: "#aaa", padding: "4px 6px" }} onClick={() => onEdit(p)}><Edit3 size={12} /></button>
              <button style={{ ...S.chip, color: "#e08a8a", padding: "4px 6px" }} onClick={() => onDelete(p.id)}><Trash2 size={12} /></button>
            </div>
          </div>

          {(p.lineItems || []).filter((li) => li.resolvedCost > 0).length > 0 && (
            <div style={{ marginTop: 8, borderTop: "1px solid #1e1e1e", paddingTop: 6 }}>
              <button
                onClick={(e) => { e.stopPropagation(); setShowBreakdown((s) => !s); }}
                style={{ display: "flex", alignItems: "center", gap: 4, background: "transparent", border: "none", color: "#666", fontSize: 9.5, cursor: "pointer", fontFamily: "inherit", padding: 0 }}
              >
                {showBreakdown ? <ChevronUp size={10} /> : <ChevronDown size={10} />} ریزهزینه‌ها
              </button>
              {showBreakdown && (p.lineItems || []).filter((li) => li.resolvedCost > 0).map((li) => {
                // نام باید همیشه از روی شناسه‌ی زنده‌ی متریال خونده بشه، نه از
                // li.label که فقط یه عکس فوری از اسمِ *لحظه‌ی لینک‌شدنه* و اگه
                // بعداً متریال rename بشه، این label دیگه sync نمی‌شه (چون فقط
                // موقع ساخت آیتم یه بار ست می‌شه و بعدش هیچ‌جا رفرش نمی‌شه)
                const liveMat = li.materialId ? (materials || []).find((m) => m.id === li.materialId) : null;
                const displayName = liveMat ? liveMat.name : li.label;
                return (
                  <div key={li.id} style={{ display:"flex", justifyContent:"space-between", fontSize:9.5, color:"#555", padding:"2px 0" }}>
                    <span>{displayName}{li.customPct != null && ` (${Number(li.customPct).toFixed(1)}٪)`}</span><span>{fmt(li.resolvedCost)} ت</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── ImageLightbox ──
export function ImageLightbox({ products, currentId, onNavigate, onClose, onAddToBasket, basket, productTypes = [], materials = [] }) {
  useRegisterOpenModal(true);
  const [imgIdx, setImgIdx] = useState(0);
  const [scale, setScale] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [localStarred, setLocalStarred] = useState(() =>
    basket ? basket.some((b) => b.id === currentId) : false
  );

  const containerRef = useRef(null);
  const ptrsRef = useRef({});
  const lastDistRef = useRef(null);
  const lastPanRef = useRef(null);
  const lastTapRef = useRef(0);
  const scaleRef = useRef(1);
  const offsetRef = useRef({ x: 0, y: 0 });
  const swipeStartRef = useRef(null);

  const product = products.find((p) => p.id === currentId);
  const allImages = product ? [product.image, ...(product.images || []).filter(img => img !== product.image)].filter(Boolean) : [];
  const currentImg = allImages[imgIdx] || null;
  const prodIdx = products.findIndex((p) => p.id === currentId);
  const isStarred = localStarred;

  const handleStarToggle = () => {
    setLocalStarred((s) => !s);
    if (onAddToBasket && product) onAddToBasket(product);
  };

  useEffect(() => {
    setScale(1);
    setOffsetX(0);
    setOffsetY(0);
    scaleRef.current = 1;
    offsetRef.current = { x: 0, y: 0 };
    setImgIdx(0);
    setLocalStarred(basket ? basket.some((b) => b.id === currentId) : false);
  }, [currentId, basket]);

  const applyTransform = (sc, ox, oy) => {
    scaleRef.current = sc;
    offsetRef.current = { x: ox, y: oy };
    setScale(sc);
    setOffsetX(ox);
    setOffsetY(oy);
  };

  const handleZoom = (newScale, clientX, clientY) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dFx = clientX - centerX;
    const dFy = clientY - centerY;

    const sOld = scaleRef.current;
    const sNew = newScale;

    let newOffsetX = 0;
    let newOffsetY = 0;

    if (sNew > 1) {
      newOffsetX = dFx - (dFx - offsetRef.current.x) * (sNew / sOld);
      newOffsetY = dFy - (dFy - offsetRef.current.y) * (sNew / sOld);

      const maxOffX = Math.max(0, (rect.width * sNew - rect.width) / 2);
      const maxOffY = Math.max(0, (rect.height * sNew - rect.height) / 2);
      newOffsetX = Math.max(-maxOffX, Math.min(maxOffX, newOffsetX));
      newOffsetY = Math.max(-maxOffY, Math.min(maxOffY, newOffsetY));
    } else {
      newOffsetX = 0;
      newOffsetY = 0;
    }

    applyTransform(sNew, newOffsetX, newOffsetY);
  };

  const onPointerDown = (e) => {
    ptrsRef.current[e.pointerId] = { x: e.clientX, y: e.clientY };
    const activeCount = Object.keys(ptrsRef.current).length;

    if (activeCount === 1) {
      lastPanRef.current = { x: e.clientX, y: e.clientY };
      swipeStartRef.current = { x: e.clientX, y: e.clientY };
      const now = Date.now();
      if (now - lastTapRef.current < 300) {
        const newScale = scaleRef.current > 1 ? 1 : 2.5;
        handleZoom(newScale, e.clientX, e.clientY);
        lastTapRef.current = 0;
      } else {
        lastTapRef.current = now;
      }
    }

    if (activeCount === 2) {
      const pts = Object.values(ptrsRef.current);
      lastDistRef.current = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      swipeStartRef.current = null;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e) => {
    ptrsRef.current[e.pointerId] = { x: e.clientX, y: e.clientY };
    const ptrs = Object.values(ptrsRef.current);

    if (ptrs.length === 2) {
      const dist = Math.hypot(ptrs[0].x - ptrs[1].x, ptrs[0].y - ptrs[1].y);
      if (lastDistRef.current != null && dist > 0) {
        const ratio = dist / lastDistRef.current;
        const newScale = Math.max(1, Math.min(6, scaleRef.current * ratio));
        
        const midX = (ptrs[0].x + ptrs[1].x) / 2;
        const midY = (ptrs[0].y + ptrs[1].y) / 2;
        
        handleZoom(newScale, midX, midY);
      }
      lastDistRef.current = dist;
    } else if (ptrs.length === 1 && lastPanRef.current) {
      if (scaleRef.current > 1) {
        const dx = e.clientX - lastPanRef.current.x;
        const dy = e.clientY - lastPanRef.current.y;
        const newX = offsetRef.current.x + dx;
        const newY = offsetRef.current.y + dy;
        
        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          const maxOffX = Math.max(0, (rect.width * scaleRef.current - rect.width) / 2);
          const maxOffY = Math.max(0, (rect.height * scaleRef.current - rect.height) / 2);
          applyTransform(
            scaleRef.current,
            Math.max(-maxOffX, Math.min(maxOffX, newX)),
            Math.max(-maxOffY, Math.min(maxOffY, newY))
          );
        } else {
          const maxOff = 200 * (scaleRef.current - 1);
          applyTransform(
            scaleRef.current,
            Math.max(-maxOff, Math.min(maxOff, newX)),
            Math.max(-maxOff, Math.min(maxOff, newY))
          );
        }
      }
      lastPanRef.current = { x: e.clientX, y: e.clientY };
    }
  };

  const onPointerUp = (e) => {
    delete ptrsRef.current[e.pointerId];
    const remaining = Object.keys(ptrsRef.current).length;

    if (remaining < 2) lastDistRef.current = null;
    if (remaining === 0) {
      lastPanRef.current = null;
      if (swipeStartRef.current && scaleRef.current <= 1) {
        const dx = e.clientX - swipeStartRef.current.x;
        const dy = e.clientY - swipeStartRef.current.y;
        // فقط سوایپ افقی واضح (نه اسکرول عمودی اتفاقی)
        if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.2) {
          if (dx < 0) {
            // انگشت به چپ → عکس بعدی همین محصول، وگرنه محصول بعدی
            if (imgIdx < allImages.length - 1) {
              setImgIdx((i) => i + 1);
              applyTransform(1, 0, 0);
            } else if (prodIdx < products.length - 1) {
              onNavigate(products[prodIdx + 1].id);
            }
          } else {
            // انگشت به راست → عکس قبلی همین محصول، وگرنه محصول قبلی
            if (imgIdx > 0) {
              setImgIdx((i) => i - 1);
              applyTransform(1, 0, 0);
            } else if (prodIdx > 0) {
              onNavigate(products[prodIdx - 1].id);
            }
          }
        }
      }
      swipeStartRef.current = null;
    }
  };

  const onWheel = (e) => {
    e.preventDefault();
    const zoomFactor = 1.08;
    const ratio = e.deltaY < 0 ? zoomFactor : 1 / zoomFactor;
    const newScale = Math.max(1, Math.min(6, scaleRef.current * ratio));
    handleZoom(newScale, e.clientX, e.clientY);
  };

  if (!product) return null;
  return (
    <div style={{ ...S.overlay, background: "#000", zIndex: 150 }}
      data-no-swipe="true"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "rgba(0,0,0,0.82)", position: "sticky", top: 0, zIndex: 5 }}>
        <button style={S.iconBtn} onClick={onClose} onPointerDown={(e) => e.stopPropagation()}>
          <X size={18} color="#fff" />
        </button>
        <span style={{ flex: 1, fontSize: 12, color: "#ccc" }}>#{fmtCode(product.code)} · {product.name}</span>
        {onAddToBasket && product.status !== "sold" && (
          <button
            style={{ ...S.iconBtn, width: 44, height: 44, borderRadius: "50%", background: "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={handleStarToggle}
          >
            <Star size={28} color="#f2c94c" fill={isStarred ? "#f2c94c" : "none"} />
          </button>
        )}
      </div>

      {(imgIdx > 0 || prodIdx > 0) && (
        <button onPointerDown={(e) => e.stopPropagation()} onClick={() => {
          if (imgIdx > 0) { setImgIdx((i) => i - 1); applyTransform(1, 0, 0); }
          else if (prodIdx > 0) onNavigate(products[prodIdx - 1].id);
        }}
          style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", background: "rgba(0,0,0,0.55)", border: "none", borderRadius: "50%", width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 6 }}>
          <ChevronLeft size={18} color="#ddd" />
        </button>
      )}
      {(imgIdx < allImages.length - 1 || prodIdx < products.length - 1) && (
        <button onPointerDown={(e) => e.stopPropagation()} onClick={() => {
          if (imgIdx < allImages.length - 1) { setImgIdx((i) => i + 1); applyTransform(1, 0, 0); }
          else if (prodIdx < products.length - 1) onNavigate(products[prodIdx + 1].id);
        }}
          style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "rgba(0,0,0,0.55)", border: "none", borderRadius: "50%", width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 6 }}>
          <ChevronRight size={18} color="#ddd" />
        </button>
      )}

      <div 
        ref={containerRef}
        onWheel={onWheel}
        style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", touchAction: "none", userSelect: "none" }}
      >
        {currentImg ? (
          <ProductImage
            filename={currentImg}
            alt=""
            draggable={false}
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
              transform: `translate(${offsetX}px, ${offsetY}px) scale(${scale})`,
              transition: scale === 1 && offsetX === 0 && offsetY === 0 ? "transform 0.25s cubic-bezier(0.25, 1, 0.5, 1)" : "none",
              transformOrigin: "center",
              willChange: "transform",
            }}
          />
        ) : (
          <div style={{ color: "#444", fontSize: 14 }}>بدون عکس</div>
        )}
      </div>

      <div style={{ background: "linear-gradient(transparent, rgba(0,0,0,0.92))", padding: "20px 16px 14px", position: "sticky", bottom: 0 }}>
        {(() => {
          const qty = Math.max(1, toNum(product.qty) || 1);
          const mats = Array.isArray(materials) ? materials : [];
          let fabricMat = product.fabricMaterialId
            ? mats.find((m) => m.id === product.fabricMaterialId)
            : null;
          // اگر فقط نام گروه/فرش داریم، از روی نام متریال فرش پیدا کن
          if (!fabricMat) {
            const groupName = String(product.group || product.fabricName || "").trim();
            if (groupName) {
              fabricMat = mats.find((m) => m.type === "fabric" && String(m.name || "").trim() === groupName)
                || mats.find((m) => m.type === "fabric" && groupName.includes(String(m.name || "").trim()) && String(m.name || "").trim().length > 2);
            }
          }
          // از lineItems هم فرش را پیدا کن
          if (!fabricMat && Array.isArray(product.lineItems)) {
            for (const li of product.lineItems) {
              const m = mats.find((x) => x.id === li.materialId && x.type === "fabric");
              if (m) { fabricMat = m; break; }
            }
          }
          const hasFabricCat = !!fabricMat;
          const fabricName = fabricMat?.name || String(product.group || product.fabricName || "").trim() || "";
          // طرح: فیلد pattern متریال یا بچ؛ یا استخراج از نام مثل «طرح شاخه شکسته»
          let fabricPattern = fabricMat?.pattern
            || (fabricMat?.batches || []).map((b) => b.pattern).find((x) => x && String(x).trim())
            || "";
          if (!fabricPattern && fabricName) {
            const m = fabricName.match(/طرح\s*([^)۰-۹0-9]+?)(?:\s*[)۰-۹0-9]|$)/);
            if (m) fabricPattern = m[1].trim();
          }
          // قدمت: فیلد یا استخراج «50ساله» از نام
          let fabricAge = fabricMat?.ageYears != null ? toNum(fabricMat.ageYears) : null;
          if ((fabricAge == null || fabricAge <= 0) && fabricName) {
            const m = fabricName.match(/(\d+)\s*ساله/);
            if (m) fabricAge = toNum(m[1]);
          }
          // hasFabricCat: یا متریال پیدا شد یا حداقل نام گروه فرش داریم
          const showFabricBlock = !!(fabricMat || (product.group || product.fabricName || product.fabricMaterialId));
          const typeName = (productTypes || []).find((t) => t.id === product.productTypeId)?.name
            || product.productTypeName
            || "";
          const dimsText = formatProductDims(product) || product.dims || "";
          const dimsLabel = typeName ? `ابعاد ${typeName}` : (dimsText ? "ابعاد محصول" : "");
          const sale = toNum(product.salePrice);
          const disc = toNum(product.discountPercent);
          const afterDisc = product.discountedPrice != null ? toNum(product.discountedPrice)
            : (disc > 0 ? Math.round(sale * (1 - disc / 100)) : sale);
          const hasDisc = disc > 0 && afterDisc < sale;
          return (
            <div style={{ marginBottom: 8 }}>
              {showFabricBlock && fabricName && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 12.5, color: "#F5F0EB", fontWeight: 700, lineHeight: 1.55 }}>
                    اصالت فرش: {fabricName}
                  </div>
                  {fabricPattern && String(fabricPattern).trim() && (
                    <div style={{ fontSize: 12.5, color: "#F5F0EB", fontWeight: 700, lineHeight: 1.55 }}>
                      طرح فرش: {fabricPattern}
                    </div>
                  )}
                  {fabricAge != null && fabricAge > 0 && (
                    <div style={{ fontSize: 12.5, color: "#F5F0EB", fontWeight: 700, lineHeight: 1.55 }}>
                      قدمت تخمینی فرش: {fabricAge} سال
                    </div>
                  )}
                  <div style={{ height: 10 }} />
                </div>
              )}
              <div style={{ fontSize: 13, color: "#F5F0EB", fontWeight: 700, marginBottom: 4, lineHeight: 1.5 }}>
                {product.name}
                {qty > 1 && <span style={{ color: "#ccc", fontWeight: 600 }}> ({qty} عدد)</span>}
              </div>
              {dimsText && (
                <div style={{ fontSize: 12, color: "#ddd", fontWeight: 600, marginBottom: 4 }}>
                  {dimsLabel}: {formatDimsHuman(dimsText)}
                </div>
              )}
              {product.description && (
                <div style={{ fontSize: 11.5, color: "#ccc", marginBottom: 8, whiteSpace: "pre-wrap", lineHeight: 1.65, fontWeight: 500 }}>
                  {product.description}
                </div>
              )}
              {/* یک ردیف خط خالی بین آخرین مشخصات محصول و ردیف بها (خواسته‌ی کاربر) */}
              <div style={{ height: 10 }} />
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontWeight: 700 }}>
                <span style={{ fontSize: 12, color: "#aaa", fontWeight: 600 }}>بها:</span>
                {hasDisc ? (
                  <>
                    <span style={{ fontSize: 12, color: "#888", textDecoration: "line-through" }}>{fmt(sale)} ت</span>
                    <span style={{ fontSize: 10, background: "#1d3a24", color: "#5fd180", border: "1px solid #3a7a4a", borderRadius: 6, padding: "2px 7px", fontWeight: 700 }}>
                      {disc}% تخفیف
                    </span>
                    <span style={{ fontSize: 13, color: "#F5F0EB" }}>{fmt(afterDisc)} تومان</span>
                  </>
                ) : (
                  <span style={{ fontSize: 13, color: "#F5F0EB" }}>{fmt(sale)} تومان</span>
                )}
              </div>
            </div>
          );
        })()}
        {allImages.length > 1 && (
          <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "none" }}>
            {allImages.map((img, i) => (
              <div key={i}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => { setImgIdx(i);
                  applyTransform(1, 0, 0); }}
                style={{ width: 44, height: 44, borderRadius: 6, overflow: "hidden", border: `2px solid ${i === imgIdx ? "#8B1A1A" : "#333"}`, flexShrink: 0, cursor: "pointer" }}>
                <ProductImage filename={img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── BasketPanel ──
export function BasketPanel({ basket, onRemove, onConfirm, onClose, customers, onTransfer, allProducts = [], onAdd, businessCard }) {
  useRegisterOpenModal(true);
  const [mode, setMode] = useState("sale"); // "sale" | "transfer"
  const [customerName, setCustomerName] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [isSettled, setIsSettled] = useState(true);
  const [selectedGallery, setSelectedGallery] = useState(null);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showProductList, setShowProductList] = useState(false);
  const [prodSearch, setProdSearch] = useState("");
  const [errors, setErrors] = useState({});
  const [saleDate, setSaleDate] = useState(() => todayISO());
  const [showPrint, setShowPrint] = useState(false);

  const availableToAdd = allProducts.filter(p => 
    p.status !== "sold" && 
    !basket.some(b => b.id === p.id) &&
    (prodSearch.trim() === "" || p.name.includes(prodSearch) || String(p.code).includes(prodSearch))
  );

  const baseTotal = basket.reduce((s, p) => s + toNum(p.salePrice), 0);
  const total = baseTotal - discountAmount;

  const handleDiscountPercentChange = (e) => {
    const raw = e.target.value;
    if (raw === "") {
      setDiscountPercent(0);
      setDiscountAmount(0);
      return;
    }
    const pct = parseFloat(raw) || 0;
    const amt = Math.round((baseTotal * pct) / 100);
    setDiscountPercent(pct);
    setDiscountAmount(amt);
  };

  const handleDiscountAmountChange = (e) => {
    const raw = e.target.value;
    if (raw === "") {
      setDiscountPercent(0);
      setDiscountAmount(0);
      return;
    }
    const amt = parsePriceInput(raw) || 0;
    const pct = baseTotal > 0 ? Math.round((amt / baseTotal) * 100 * 10) / 10 : 0;
    setDiscountAmount(amt);
    setDiscountPercent(Math.min(100, pct));
  };

  const { showToast } = useToast();
  const basketRef = useRef(null);

  const getFactorText = () => {
    const lines = basket.map((p) => `#${fmtCode(p.code)} ${p.name} ${formatProductDims(p)}${qtySuffix(p)} — ${fmt(toNum(p.salePrice))} تومان`);
    if (discountAmount > 0) lines.push(`تخفیف: ${fmt(discountAmount)} تومان`);
    lines.push(`جمع: ${fmt(total)} تومان`);
    return lines.join("\n");
  };

  const copyFactorText = async () => {
    try {
      await navigator.clipboard.writeText(getFactorText());
      showToast("فاکتور متنی کپی شد");
    } catch (e) {
      showToast("خطا در کپی");
    }
  };

  
  const shareFactor = async () => {
    const result = await shareText({ title: "فاکتور", text: getFactorText() });
    if (result === "clipboard") showToast("اشتراک‌گذاری مستقیم ممکن نبود؛ متن فاکتور در کلیپ‌بورد کپی شد");
    else if (result === "failed") showToast("خطا در اشتراک‌گذاری");
    else showToast("فاکتور ارسال شد");
  };

  
  const exportFactorPhoto = async () => {
    if (!basketRef.current) return;
    try {
      const canvas = await html2canvas(basketRef.current, { backgroundColor: "#141414", scale: 2 });
      const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
      const itemName = customerName || basket.map(p => p.name).join('-').substring(0, 30);
      const safeItemName = itemName.replace(/[^a-zA-Z0-9\u0600-\u06FF\s-]/g, '').trim().replace(/\s+/g, '_');
      await saveFile(dataUrl, `Factor_${safeItemName}_${getJalaliTimestamp()}.jpg`);
      showToast("فاکتور بصورت عکس ذخیره شد");
    } catch (e) {
      showToast("خطا در تولید عکس");
    }
  };

  const handleCustomerChange = (item) => {
    setErrors(prev => ({ ...prev, customerName: false }));
    if (item) {
      setCustomerName(item.name);
      setSelectedCustomer(item);
      if (item.creditAllowed === false) {
        setIsSettled(true);
      }
    } else {
      setCustomerName("");
      setSelectedCustomer(null);
    }
  };

  const handleConfirmAction = () => {
    if (mode === "sale") {
      if (!customerName.trim()) {
        setErrors({ customerName: true });
        showToast("خطا: نام مشتری الزامی است", "error");
        return;
      }
      const matchedCust = customers.find(c => c.name === customerName && c.kind === "customer");
      if (!isSettled && matchedCust && matchedCust.creditAllowed === false) {
        showToast("خطا: این مشتری امکان خرید اعتباری ندارد و فاکتور باید حتماً تسویه شده باشد.", "error");
        return;
      }
      setLoading(true);
      const enrichedBasket = discountAmount > 0
        ? basket.map((p) => {
            const share = toNum(p.salePrice) / baseTotal;
            const disc = Math.round(discountAmount * share);
            return {
              ...p,
              discountPercent: discountPercent,
              discountAmount: disc,
              discountedPrice: toNum(p.salePrice) - disc,
            };
          })
        : basket;
      onConfirm && onConfirm(enrichedBasket, customerName, isSettled, saleDate);
      setLoading(false);
    } else {
      if (!selectedGallery) {
        setErrors({ gallery: true });
        showToast("خطا: انتخاب گالری مقصد الزامی است", "error");
        return;
      }
      setLoading(true);
      onTransfer && onTransfer(basket, selectedGallery.id);
      setLoading(false);
    }
  };

  return (
    <div style={{ ...S.overlay, zIndex: 160 }}>
      <div data-enter-nav onKeyDown={handleEnterNavigate} style={{ ...S.sheet, maxHeight: "85vh" }}>
        <div style={S.sheetHeader}>
          <button style={S.iconBtn} onClick={onClose}><X size={16} color="#888" /></button>
          <ShoppingBag size={16} color="#f2c94c" style={{ marginRight: 8, marginLeft: 4 }} />
          <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#F5F0EB" }}>سبد خرید ({basket.length} آیتم)</span>
        </div>
        
        <div style={{ display: "flex", background: "#1a1a1a", borderBottom: "1px solid #2a2a2a" }}>
          <button
            style={{
              flex: 1, padding: "10px 0", fontSize: 11, fontFamily: "inherit",
              background: mode === "sale" ? "#222" : "transparent",
              color: mode === "sale" ? "#f2c94c" : "#666",
              border: "none", borderBottom: mode === "sale" ? "2px solid #f2c94c" : "none",
              cursor: "pointer"
            }}
            onClick={() => setMode("sale")}
          >
            فروش به مشتری
          </button>
          <button
            style={{
              flex: 1, padding: "10px 0", fontSize: 11, fontFamily: "inherit",
              background: mode === "transfer" ? "#222" : "transparent",
              color: mode === "transfer" ? "#a89bd4" : "#666",
              border: "none", borderBottom: mode === "transfer" ? "2px solid #a89bd4" : "none",
              cursor: "pointer"
            }}
            onClick={() => setMode("transfer")}
          >
            ارجاع به گالری
          </button>
        </div>

        <div style={{ padding: "12px 14px 0" }}>
          {mode === "sale" ? (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 9.5, color: "#666", marginBottom: 4 }}>نام مشتری <span style={{ color: "#e08a8a" }}>(الزامی)</span></div>
              <div style={errors.customerName ? { border: "1px solid #ef4444", borderRadius: 8, padding: "1px" } : {}}>
                <CustomerSmartSelect
                  value={customerName}
                  onChange={handleCustomerChange}
                  options={customers.filter(c => c.kind === "customer")}
                  placeholder="نام مشتری..."
                />
              </div>
            </div>
          ) : (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 9.5, color: "#666", marginBottom: 6 }}>انتخاب گالری مقصد <span style={{ color: "#e08a8a" }}>(الزامی)</span></div>
              <div style={{ border: errors.gallery ? "1px solid #ef4444" : "none", borderRadius: 8, padding: errors.gallery ? 6 : 0 }}>
                <SmartLocationSelect
                  value={selectedGallery?.id || null}
                  includeWarehouse={false}
                  placeholder="انتخاب گالری مقصد"
                  options={customers.filter(c => c.kind === "gallery")}
                  onChange={(id) => {
                    setErrors(prev => ({ ...prev, gallery: false }));
                    setSelectedGallery(customers.find(c => c.id === id) || null);
                  }}
                />
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: "0 14px 12px", flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }} ref={basketRef}>
          
          <div style={{ paddingBottom: 12, borderBottom: "1px solid #333", marginBottom: 12 }}>
            <button
              style={{ ...S.chip, color: "#7aa8d8", padding: "6px 12px" }}
              onClick={() => setShowProductList(!showProductList)}
            >
              {showProductList ? <X size={11} style={{ marginLeft: 4 }} /> : <Plus size={11} style={{ marginLeft: 4 }} />}
              {showProductList ? "بستن لیست" : "افزودن کالا به سبد"}
            </button>

            {showProductList && (
              <div style={{ marginTop: 10, background: "#111", borderRadius: 8, padding: 8, border: "1px solid #222" }}>
                <input onFocus={(e) => e.target.select()}
                  style={{ ...S.input, marginBottom: 8 }}
                  placeholder="جستجوی محصول..."
                  value={prodSearch}
                  onChange={(e) => setProdSearch(e.target.value)}
                />
                <div style={{ maxHeight: 200, overflowY: "auto" }}>
                  {availableToAdd.length === 0 ? (
                    <div style={{ fontSize: 10, color: "#555", textAlign: "center", padding: 10 }}>محصولی یافت نشد</div>
                  ) : (
                    availableToAdd.map(p => (
                      <div
                        key={p.id}
                        style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 4px", borderBottom: "1px solid #1e1e1e", cursor: "pointer" }}
                        onClick={() => onAdd(p)}
                      >
                                                <div style={{ width: 30, height: 30, borderRadius: 4, background: "#000", overflow: "hidden" }}>
                          {p.image && <ProductImage filename={p.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 10.5, color: "#ccc" }}>#{fmtCode(p.code)} {p.name}</div>
                          <div style={{ fontSize: 9, color: "#666" }}>{formatProductDims(p)}{qtySuffix(p)}</div>
                        </div>
                        <div style={{ fontSize: 10, color: "#F5F0EB" }}>{fmt(toNum(p.salePrice))}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div style={{ flex: 1 }}>
            {basket.map((p) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: "1px solid #1e1e1e" }}>
                {p.image && <ProductImage filename={p.image} alt="" style={{ width: 36, height: 36, borderRadius: 5, objectFit: "cover" }} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11.5, color: "#ddd" }}>#{fmtCode(p.code)} {p.name}</div>
                  <div style={{ fontSize: 10, color: "#666" }}>{formatProductDims(p)}{qtySuffix(p)}</div>
                </div>
                <span style={{ fontSize: 12, color: "#F5F0EB" }}>{fmt(toNum(p.salePrice))} ت</span>
                <button style={S.iconBtn} onClick={() => onRemove(p.id)}><X size={12} color="#e08a8a" /></button>
              </div>
            ))}
          </div>

          {mode === "sale" ? (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", fontWeight: 600, fontSize: 13, color: "#F5F0EB", borderTop: "1px solid #333", marginTop: 12 }}>
                <span>جمع کل</span>
                <span>{fmt(total)} تومان</span>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8 }}>
                <div style={{ flex: 2 }}>
                  <div style={{ fontSize: 8.5, color: "#666", marginBottom: 2 }}>تخفیف مبلغی (تومان)</div>
                  <input onFocus={(e) => e.target.select()} style={S.input} type="text" placeholder="۰" value={discountAmount ? formatPriceInput(discountAmount) : ""} onChange={handleDiscountAmountChange} />
                </div>
                <div style={{ flex: 1, position: "relative" }}>
                  <div style={{ fontSize: 8.5, color: "#666", marginBottom: 2 }}>تخفیف درصدی</div>
                  <input onFocus={(e) => e.target.select()} style={{ ...S.input, paddingLeft: 20 }} type="text" placeholder="۰" value={discountPercent || ""} onChange={handleDiscountPercentChange} />
                  <span style={{ position: "absolute", left: 8, bottom: 8, fontSize: 10, color: "#555" }}>%</span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 9.5, color: "#666", marginBottom: 4 }}>تاریخ فاکتور</div>
                  <JalaliDatePicker value={saleDate} onChange={(val) => setSaleDate(val)} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 9.5, color: "#666", marginBottom: 4 }}>وضعیت تسویه</div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button
                      style={{ ...S.chip, flex: 1, justifyContent: "center", ...(isSettled ? { background: "#1d3a24", border: "1px solid #2d5a38", color: "#5fd180" } : { background: "transparent", color: "#888", border: "1px solid #2a2a2a" }) }}
                      onClick={() => setIsSettled(true)}
                    >
                      تسویه شد
                    </button>
                    <button
                      style={{
                        ...S.chip,
                        flex: 1,
                        justifyContent: "center",
                        ...(!isSettled ? { background: "#3a1d1d", border: "1px solid #5a2d2d", color: "#e08a8a" } : { background: "transparent", color: "#888", border: "1px solid #2a2a2a" }),
                        ...(selectedCustomer?.creditAllowed === false ? { opacity: 0.5, cursor: "not-allowed" } : {})
                      }}
                      disabled={selectedCustomer?.creditAllowed === false}
                      onClick={() => {
                        if (selectedCustomer?.creditAllowed !== false) {
                          setIsSettled(false);
                        }
                      }}
                    >
                      تسویه نشده
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : null}

          <div style={{ display: "flex", gap: 6, marginTop: 20, position: "sticky", bottom: -12, background: "#161616", padding: "10px 0 12px", borderTop: "1px solid #2a2a2a" }}>
            <button 
              type="button"
              style={{ width: 36, height: 36, background: "#161616", border: "1px solid #333", color: "#aaa", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }} 
              onClick={() => setShowPrint(true)} 
              title="پیش‌نمایش فاکتور"
            >
              <Printer size={16} />
            </button>
            <button
              style={{
                flex: 1, background: mode === "sale" ? "#8B1A1A" : "#5a4b8a", border: "none", color: "#fff", padding: "10px 0", borderRadius: 7,
                fontFamily: "inherit", fontSize: 13, cursor: "pointer", opacity: loading ? 0.6 : 1, fontWeight: 600
              }}
              onClick={handleConfirmAction} disabled={loading}
            >
              {loading ? "در حال ثبت..." : (mode === "sale" ? "تأیید فروش" : "تأیید ارجاع")}
            </button>
          </div>

          {showPrint && (() => {
            const mappedItems = basket.map(p => {
              const orig = toNum(p.salePrice);
              return {
                name: p.name,
                code: fmtCode(p.code),
                image: p.image,
                dims: formatProductDims(p) + qtySuffix(p),
                originalPrice: orig,
                finalPrice: orig,
                discountPct: 0,
                isSettled: isSettled,
                isAvailableInGallery: mode === "transfer"
              };
            });

            const totalOrig = baseTotal;
            const totalFinal = total;
            const totalDisc = discountAmount;

            const invoiceData = {
              id: 1000 + Math.floor(Math.random() * 9000),
              type: selectedGallery ? "accounting" : "sales",
              date: fmtDate(saleDate || todayISO()),
              customer: selectedGallery ? {
                id: selectedGallery.id,
                name: selectedGallery.name,
                phone: selectedGallery.phone,
                address: selectedGallery.address,
                gender: selectedGallery.gender,
                kind: "gallery",
                galleryOwnerName: selectedGallery.galleryOwnerName
              } : selectedCustomer ? {
                id: selectedCustomer.id,
                name: selectedCustomer.name,
                phone: selectedCustomer.phone,
                address: selectedCustomer.address,
                gender: selectedCustomer.gender,
                kind: selectedCustomer.kind || "customer",
                galleryOwnerName: selectedCustomer.galleryOwnerName
              } : {
                kind: "warehouse",
                name: customerName || "",
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
                onClose={() => setShowPrint(false)}
              />
            );
          })()}
        </div>
      </div>
    </div>
  );
}


// ── SmartLocationSelect ──
function SmartLocationSelect({ value, onChange, options, includeWarehouse = true, placeholder = "انتخاب گالری" }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef(null);
  // قبلاً همین که پنل باز می‌شد، فوکوس مستقیم روی اینپوت جستجو می‌رفت و کیبورد
  // گوشی خودکار باز می‌شد و لیست رو می‌پوشوند. الان فقط لیست باز می‌شه و
  // کیبورد فقط با لمس مستقیم ردیف جستجو باز می‌شه.

  const filtered = search.trim() ? options.filter(o => o.name.toLowerCase().includes(search.toLowerCase())) : options;

  return (
    <div style={{ position: "relative" }}>
      <button 
        type="button"
        style={{ width: "100%", background: "#1c1c1c", border: "1px solid #2a2a2a", borderRadius: 8, padding: "8px 12px", textAlign: "right", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", color: value === "warehouse" ? "#a89bd4" : "#ddd", fontSize: 11, fontFamily: "inherit" }} 
        onClick={() => setOpen(!open)}
      >
        <span>{value === "warehouse" ? "انبار (پیش‌فرض)" : (options.find(o => o.id === value)?.name || placeholder)}</span>
        <ChevronDown size={14} />
      </button>
      <FilterPopup open={open} onClose={() => setOpen(false)} width={280} maxHeight={260}>
        <div style={{ padding: "8px", borderBottom: "1px solid #333", display: "flex", alignItems: "center", gap: 6 }}>
          <Search size={14} color="#888" />
          <input onFocus={(e) => e.target.select()}
            ref={inputRef}
            type="text"
            placeholder="جستجو گالری..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ background: "transparent", border: "none", outline: "none", color: "#ddd", width: "100%", fontSize: 11, fontFamily: "inherit" }}
          />
        </div>
        <div style={{ overflowY: "auto", maxHeight: 200 }}>
          {includeWarehouse && !search.trim() && (
            <div
              style={{ padding: "10px", fontSize: 11, cursor: "pointer", borderBottom: "1px solid #2a2a2a", color: "#a89bd4", background: value === "warehouse" ? "#2a2a2a" : "transparent" }}
              onClick={() => { onChange("warehouse"); setOpen(false); setSearch(""); }}
            >
              انبار (پیش‌فرض)
            </div>
          )}
          {filtered.map(o => (
            <div
              key={o.id}
              style={{ padding: "10px", fontSize: 11, cursor: "pointer", borderBottom: "1px solid #2a2a2a", background: value === o.id ? "#2a2a2a" : "transparent", color: "#ddd", display: "flex", alignItems: "center", gap: 6 }}
              onClick={() => { onChange(o.id); setOpen(false); setSearch(""); }}
            >
              {o.color && <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: o.color, flexShrink: 0 }} />}
              {o.name}
            </div>
          ))}
          {filtered.length === 0 && search.trim() && (
            <div style={{ padding: "10px", fontSize: 11, color: "#888", textAlign: "center" }}>گالری پیدا نشد</div>
          )}
        </div>
      </FilterPopup>
    </div>
  );
}

// ── CustomerSmartSelect ── مثل SmartLocationSelect (پاپ‌آپ مشترک FilterPopup)
// ولی برای انتخاب مشتری؛ چون قبلاً فیلد «نام مشتری» از این گروهِ پاپ‌آپ
// یکپارچه جا افتاده بود و یه GenericAutoSuggest ساده (دراپ‌داون پایه‌ای زیر
// اینپوت) بود، نه همون تجربه‌ی هم‌شکل با انتخاب گالری. قابلیت تایپ نام مشتریِ
// جدید (که وجود نداره) هم حفظ شده — به‌شکل یه گزینه‌ی «+ افزودن مشتری جدید»
function CustomerSmartSelect({ value, onChange, options, placeholder = "انتخاب مشتری" }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef(null);
  // قبلاً همین که پنل باز می‌شد، فوکوس مستقیم روی اینپوت جستجو می‌رفت و کیبورد
  // گوشی خودکار باز می‌شد و لیست رو می‌پوشوند. الان فقط لیست باز می‌شه و
  // کیبورد فقط با لمس مستقیم ردیف جستجو باز می‌شه — دقیقاً مثل SmartLocationSelect

  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  const filtered = search.trim() ? options.filter(o => (o.name || "").toLowerCase().includes(search.toLowerCase())) : options;
  const exactMatch = options.some(o => (o.name || "").trim().toLowerCase() === search.trim().toLowerCase());

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        style={{ width: "100%", background: "#1c1c1c", border: "1px solid #2a2a2a", borderRadius: 8, padding: "8px 12px", textAlign: "right", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", color: value ? "#ddd" : "#666", fontSize: 11, fontFamily: "inherit" }}
        onClick={() => setOpen(!open)}
      >
        <span>{value || placeholder}</span>
        <ChevronDown size={14} />
      </button>
      <FilterPopup open={open} onClose={() => setOpen(false)} width={280} maxHeight={260}>
        <div style={{ padding: "8px", borderBottom: "1px solid #333", display: "flex", alignItems: "center", gap: 6 }}>
          <Search size={14} color="#888" />
          <input onFocus={(e) => e.target.select()}
            ref={inputRef}
            type="text"
            placeholder="جستجو یا نام مشتری جدید..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ background: "transparent", border: "none", outline: "none", color: "#ddd", width: "100%", fontSize: 11, fontFamily: "inherit" }}
          />
        </div>
        <div style={{ overflowY: "auto", maxHeight: 200 }}>
          {search.trim() && !exactMatch && (
            <div
              style={{ padding: "10px", fontSize: 11, cursor: "pointer", borderBottom: "1px solid #2a2a2a", color: "#5fd180", display: "flex", alignItems: "center", gap: 6 }}
              onClick={() => { onChange({ name: search.trim() }); setOpen(false); }}
            >
              <Plus size={12} /> افزودن مشتری جدید: «{search.trim()}»
            </div>
          )}
          {filtered.map(o => (
            <div
              key={o.id}
              style={{ padding: "10px", fontSize: 11, cursor: "pointer", borderBottom: "1px solid #2a2a2a", background: value === o.name ? "#2a2a2a" : "transparent", color: "#ddd" }}
              onClick={() => { onChange(o); setOpen(false); }}
            >
              {o.name}
            </div>
          ))}
          {filtered.length === 0 && !search.trim() && (
            <div style={{ padding: "10px", fontSize: 11, color: "#888", textAlign: "center" }}>مشتری‌ای ثبت نشده</div>
          )}
        </div>
      </FilterPopup>
    </div>
  );
}
export function ProductEditor({
  product, materials, customers,
  onSave, onClose, nextCode,
  onLinkBatch, onUnlinkBatch,
  areaBatchCostByProduct, ratioByAreaCostByProduct,
  onUndeductLine, onUndeductWood,
  productTypes, setData, products,
  closeRequestRef,
}) {
  useRegisterOpenModal(true);
  const { showToast } = useToast();
  const [local, _setLocal] = useState(() => {
    const scratch = loadScratch(SCRATCH_KEYS.product);
    if (scratch && scratch.id === (product.id || null)) return { ...product, ...scratch, lineItems: (scratch.lineItems || product.lineItems || []).map((li) => ({ ...li })) };
    // محصول جدید (بدون اسم) → پیش‌فرض روی آخرین نوع محصول ثبت‌شده
    if (!product.name && !product.productTypeId) {
      let lastTypeId = null;
      try { lastTypeId = localStorage.getItem("last_product_type_id"); } catch (_) {}
      if (lastTypeId) return { ...product, productTypeId: lastTypeId, lineItems: (product.lineItems || []).map((li) => ({ ...li })) };
    }
    return { ...product, lineItems: (product.lineItems || []).map((li) => ({ ...li })) };
  });
  const [draftSaved, setDraftSaved] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [typeEditingId, setTypeEditingId] = useState(null);
  const [typeNameInput, setTypeNameInput] = useState("");
  const [pickerForLine, setPickerForLine] = useState(null);
  const [batchPickerFor, setBatchPickerFor] = useState(null);
  const [isSold, setIsSold] = useState(local.status === "sold");
  const [showSettleOptions, setShowSettleOptions] = useState(isSold);
  const [selectedGallery, setSelectedGallery] = useState(() => {
    if (local.location && local.location !== "warehouse") {
      return customers.find((c) => c.id === local.location && c.kind === "gallery") || null;
    }
    return null;
  });
  const [errors, setErrors] = useState({});
  const { getToken } = useAuth() || {};
  const [selectedBuyer, setSelectedBuyer] = useState(() => {
    if (local.buyerCustomerId) {
      return customers.find((c) => c.id === local.buyerCustomerId) || null;
    }
    return null;
  });

  // بخش ۳ (تأیید خروج): اسنپ‌شات اولیه‌ی فرم رو می‌گیریم؛ اگه با X ببندی و local
  // نسبت به لحظه‌ی بازشدن فرق کرده باشه، اول تاییدیه می‌گیریم نه بستن مستقیم
  const initialSnapshotRef = useRef(local);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const isDirty = () => JSON.stringify(local) !== JSON.stringify(initialSnapshotRef.current);
  const requestClose = () => {
    if (isDirty()) setShowDiscardConfirm(true);
    else onClose();
  };
  useEffect(() => {
    if (closeRequestRef) closeRequestRef.current = requestClose;
    return () => { if (closeRequestRef) closeRequestRef.current = null; };
  });

  const setLocalWithScratch = (updater) => {
    _setLocal((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      return next;
    });
  };

  const resolveCost = (li) => {
    if (li.materialId) {
      const mat = materials.find((m) => m.id === li.materialId);
      if (mat && (mat.type === "area" || mat.type === "fabric")) {
        if (li.deductedAt) return toNum(li.deductedCost);
        const pp = areaBatchCostByProduct?.[local.id];
        const r = pp?.[li.materialId];
        if (r != null) return r;
        // اگه هنوز توی areaBatchCostByProduct نیومده (مثلاً محصول تازه‌ست و هنوز
        // به state اصلی ذخیره نشده)، مثل قبل یه تخمین لحظه‌ای بزن — ولی همین که
        // ذخیره بشه، این عدد باید دقیقاً با areaBatchCostByProduct یکی بشه
        if (mat.type === "fabric" && li.useAutoPct !== false) {
          const productArea = getProductArea(local);
          const coverage = toNum(local.fabricCoveragePct ?? 100) / 100;
          const fabricArea = toNum(mat.dimW) * toNum(mat.dimH);
          const base = toNum(mat.totalCost);
          if (fabricArea > 0 && productArea > 0) {
            return ((productArea * coverage) / fabricArea) * base;
          }
        }
        return toNum(li.cost);
      }
    }
    if (li.materialId && li.useAreaRatio) {
      const pp = ratioByAreaCostByProduct?.[local.id];
      const r = pp?.[li.materialId];
      return r != null ? r : toNum(li.cost);
    }
    if (li.materialId && li.pct != null) {
      if (li.deductedAt) return toNum(li.deductedCost);
      const mat = materials.find((m) => m.id === li.materialId);
      if (!mat) return toNum(li.cost);
      // باگ واقعی بود: اینجا همیشه mat.totalCost (کل اولیه) رو مبنا می‌گرفت، در
      // حالی که نسخه‌ی معتبر (resolveLineCost توی App.jsx، که «هزینه تمام‌شده»ی
      // نمایش‌داده‌شده روی کارت محصول ازش میاد) وقتی remainingCost موجود باشه از
      // *همون* استفاده می‌کنه (چون درصد یعنی سهم از باقیمانده‌ی در دسترس، نه از
      // کل اولیه). همین اختلاف باعث می‌شد عدد «جمع هزینه» توی فرم افزودن/ویرایش
      // با «هزینه تمام‌شده»ی کارت محصول یکی نباشه
      const base = mat.remainingCost != null ? toNum(mat.remainingCost) : toNum(mat.totalCost);
      return (toNum(li.pct) / 100) * base;
    }
    return toNum(li.cost);
  };

  const totalCost = (local.lineItems || []).filter(li => !li._toRemove).reduce((s, li) => s + resolveCost(li), 0);

  const updateLine = (id, patch) => setLocalWithScratch((l) => ({ ...l, lineItems: l.lineItems.map((li) => li.id === id ? { ...li, ...patch } : li) }));
  const removeLine = (id) => setLocalWithScratch((l) => ({ 
    ...l, 
    lineItems: l.lineItems.map((li) => {
      if (li.id === id) {
        if (li.deductedAt) return { ...li, pendingUnlock: true, _toRemove: true };
        return { ...li, _toRemove: true };
      }
      return li;
    })
  }));
  const addLine = () => {
    setLocalWithScratch((l) => ({ ...l, lineItems: [...l.lineItems, emptyLineItem("")] }));
  };

  const handleSave = () => {
    const newErrors = {};
    if (!local.name?.trim()) newErrors.name = true;
    const isRoundShape = local.shape === "semi-circle" || local.shape === "circle";
    if (isRoundShape && !local.dimW) newErrors.dimW = true;
    if (!isRoundShape && (!local.dimW || !local.dimH)) {
      if (!local.dimW) newErrors.dimW = true;
      if (!local.dimH) newErrors.dimH = true;
    }
    if (!local.salePrice || toNum(local.salePrice) <= 0) {
      newErrors.salePrice = true;
    }

    const code = local.code != null ? local.code : nextCode;
    const dupe = (products || []).some((p) => p.id !== local.id && toNum(p.code) === toNum(code));
    if (dupe) newErrors.code = true;

    // Enforce mandatory buyer details if sold & unsettled
    if (local.status === "sold" && !local.settled) {
      if (!local.buyerName?.trim()) newErrors.buyerName = true;
      if (!local.buyerPhone?.trim()) newErrors.buyerPhone = true;
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      if (newErrors.buyerName || newErrors.buyerPhone) {
        showToast("خطا: برای محصول فروخته‌شده و تسویه‌نشده، وارد کردن نام خریدار و شماره تماس او الزامی است", "error");
      } else if (newErrors.code) {
        showToast("خطا: این کد قبلاً برای محصول دیگه‌ای ثبت شده", "error");
      } else {
        showToast("خطا: پر کردن فیلدهای الزامی (نام محصول، ابعاد، قیمت) اجباری است", "error");
      }
      return;
    }

    let finalLocation = local.location;
    if (local.location !== "warehouse" && !local.location) {
      finalLocation = "warehouse";
    }
    let finalDimW = local.dimW, finalDimH = local.dimH, finalDims = local.dims;
    if (local.shape !== "circle" && local.shape !== "semi-circle" && local.dimW && local.dimH) {
      const a = toNum(local.dimW), b = toNum(local.dimH);
      // طبق تصمیم تازه‌ی کاربر (برعکسِ تصمیم قبلی همین نشست): حالا باید عدد
      // کوچیک‌تر اول باشه، بزرگ‌تر دوم — نه برعکس
      if (a > b) {
        finalDimW = local.dimH;
        finalDimH = local.dimW;
      }
      finalDims = `${finalDimW}×${finalDimH}`;
    }
    onSave({ ...local, code, location: finalLocation, dimW: finalDimW, dimH: finalDimH, dims: finalDims, qty: toNum(local.qty) || 1, totalCost });
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      // بخش «بازطراحی ذخیره‌سازی عکس‌ها» (Wall 🟣): قبلاً اینجا عکس به یه
      // endpoint سرور (`/api/upload`) فرستاده می‌شد که هم با معماری جدید
      // (پوشه‌ی محلی روی خودِ گوشی/سیستم) ناسازگار بود، هم یه آسیب‌پذیری
      // امنیتی واقعی داشت (destPath بدون اعتبارسنجی از کلاینت) — حذف شد.
      // الان عکس فشرده می‌شه (مثل قبل) و مستقیم توی پوشه‌ی محلی ذخیره می‌شه؛
      // فقط اسم فایل (نه خودِ عکس) توی رکورد محصول می‌مونه.
      const compressedDataUrl = await compressImageFile(file);
      const safeName = (local.name || "Product").replace(/[^a-zA-Z0-9\u0600-\u06FF\s-]/g, '').trim().replace(/\s+/g, '_');
      const desiredFilename = `${safeName}_${getJalaliTimestamp()}.jpg`;
      const savedFilename = await saveImageToFolder(compressedDataUrl, IMAGE_CATEGORIES.PRODUCT, desiredFilename);

      setLocalWithScratch((l) => {
        const images = l.images || [];
        if (!l.image) {
          return { ...l, image: savedFilename, images: [savedFilename, ...images] };
        }
        return { ...l, images: [...images, savedFilename] };
      });
      showToast("تصویر در پوشه‌ی محلی ذخیره شد");
    } catch (err) {
      console.error("Image upload failed:", err);
      showToast("خطا در ذخیره‌ی عکس", "error");
    }
  };

  const handleRemoveImage = (idx) => {
    setLocalWithScratch((l) => {
      const all = (l.images || []).filter((_, i) => i !== idx);
      const newImage = all.length > 0 ? all[0] : null;
      return { ...l, image: newImage, images: all };
    });
  };

  const fabricMaterials = materials.filter(m => m.type === "fabric");
  // باگ: local.fabricMaterialId فقط وقتی از همین فرم (handleFabricChange) ست
  // می‌شد پر بود؛ محصولاتی که فرش‌شون فقط از طریق lineItems لینک شده بودن
  // (مثلاً از یک نسخه‌ی قدیمی‌تر داده، یا از طریق تخصیص بولک متریال)
  // fabricMaterialId نداشتن، پس فرم همیشه «بدون فرش» نشون می‌داد با اینکه
  // توی دسته‌بندی/لیست‌آیتم‌ها واقعاً یک فرش لینک بود. الان اگه
  // fabricMaterialId خالی بود، از روی lineItems هم بازیابی می‌شه.
  const fabricLineItem = (local.lineItems || []).find((li) => {
    const mat = li.materialId ? materials.find((m) => m.id === li.materialId) : null;
    return mat && mat.type === "fabric";
  });
  const effectiveFabricId = local.fabricMaterialId || fabricLineItem?.materialId || null;
  const selectedFabric = fabricMaterials.find(m => m.id === effectiveFabricId) || null;

  // اگه فرش از lineItems پیدا شد ولی local.fabricMaterialId خالی بود، همین
  // الان پرش کن تا بقیه‌ی منطق (مثل حذف با X) هم درست کار کنه
  useEffect(() => {
    if (!local.fabricMaterialId && fabricLineItem?.materialId) {
      setLocalWithScratch((l) => (l.fabricMaterialId ? l : { ...l, fabricMaterialId: fabricLineItem.materialId }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local.fabricMaterialId, fabricLineItem?.materialId]);

  const handleFabricChange = (item) => {
    if (item) {
      setLocalWithScratch((l) => {
        const oldFabricId = l.fabricMaterialId;
        let found = false;
        const nextLines = (l.lineItems || []).map((li) => {
          const mat = li.materialId ? materials.find((m) => m.id === li.materialId) : null;
          if (li.materialId === oldFabricId || (mat && mat.type === "fabric")) {
            found = true;
            return {
              ...li,
              materialId: item.id,
              label: `فرش مصرفی: ${item.name}`,
              useAutoPct: true,
            };
          }
          return li;
        });

        if (!found) {
          nextLines.push({
            id: uid(),
            label: `فرش مصرفی: ${item.name}`,
            cost: 0,
            materialId: item.id,
            pct: null,
            useAutoPct: true,
          });
        }

        return {
          ...l,
          fabricMaterialId: item.id,
          group: item.name,
          lineItems: nextLines,
        };
      });
    } else {
      setLocalWithScratch((l) => {
        const oldFabricId = l.fabricMaterialId;
        const nextLines = (l.lineItems || []).filter((li) => {
          const mat = li.materialId ? materials.find((m) => m.id === li.materialId) : null;
          return li.materialId !== oldFabricId && !(mat && mat.type === "fabric");
        });
        return {
          ...l,
          fabricMaterialId: null,
          group: "",
          lineItems: nextLines,
        };
      });
    }
  };

  const galleryCustomers = customers.filter(c => c.kind === "gallery");

  const handleGalleryChange = (item) => {
    if (item) {
      setLocalWithScratch((l) => ({
        ...l,
        location: item.id,
        galleryName: item.name,
      }));
      setSelectedGallery(item);
    } else {
      setLocalWithScratch((l) => ({
        ...l,
        location: "warehouse",
        galleryName: "",
      }));
      setSelectedGallery(null);
    }
  };

  const profitPresets = [70, 100, 150, 250, 300];
  const [manualProfitPct, setManualProfitPct] = useState(local.profitPct || "");

  const handleProfitPreset = (pct) => {
    const sp = totalCost > 0 ? calcPriceFromProfit(pct, totalCost) : toNum(local.salePrice);
    const disc = toNum(local.discountPercent);
    const dp = disc > 0 ? Math.round(sp * (1 - disc / 100)) : sp;
    setLocalWithScratch((l) => ({
      ...l,
      salePrice: sp,
      profitPct: pct,
      salePriceManual: true,
      discountedPrice: dp,
    }));
    setManualProfitPct(pct);
  };

  const handleSalePriceChange = (e) => {
    const raw = e.target.value;
    if (raw === "") {
      setManualProfitPct("");
      setLocalWithScratch((l) => ({ ...l, salePrice: 0, profitPct: null, discountedPrice: 0 }));
      return;
    }
    const num = parsePriceInput(raw);
    // نکته‌ی مهم: profitPct رو null می‌ذاریم (نه یه عدد مشتق‌شده) — چون تایپ
    // مستقیم قیمت یعنی این محصول «کاملاً دستی»ه. قبلاً یه درصد معادل محاسبه
    // و ذخیره می‌شد که باعث می‌شد syncPercentPricedProducts (که هر Refresh
    // اجرا می‌شه) این قیمت «دستی» رو بعداً با هزینه‌ی روزِ متریال دوباره
    // بازمحاسبه و بی‌صدا عوض کنه — یعنی قیمت دستی هیچ‌وقت واقعاً ثابت نمی‌موند
    const pct = totalCost > 0 ? calcProfitFromPrice(num, totalCost) : 0;
    const disc = toNum(local.discountPercent);
    const dp = disc > 0 ? Math.round(num * (1 - disc / 100)) : num;
    setErrors(e => ({...e, salePrice: false}));
    setLocalWithScratch((l) => ({
      ...l,
      salePrice: num,
      profitPct: null,
      salePriceManual: true,
      discountedPrice: dp,
    }));
    // فقط برای نمایش (چند درصده این قیمت نسبت به هزینه‌ی الان) — این عدد
    // دیگه توی داده ذخیره نمی‌شه، پس چیزی رو بعداً خودکار عوض نمی‌کنه
    setManualProfitPct(pct);
  };

  const handleDiscountChange = (e) => {
    const raw = e.target.value;
    if (raw === "") {
      setLocalWithScratch((l) => ({ ...l, discountPercent: 0, discountedPrice: toNum(local.salePrice) }));
      return;
    }
    const disc = Math.min(100, Math.max(0, parseFloat(raw) || 0));
    const sp = toNum(local.salePrice);
    const dp = disc > 0 ? Math.round(sp * (1 - disc / 100)) : sp;
    setLocalWithScratch((l) => ({ ...l, discountPercent: disc, discountedPrice: dp }));
  };

  const handleManualProfitChange = (e) => {
    const raw = e.target.value;
    if (raw === "") {
      setManualProfitPct("");
      setLocalWithScratch((l) => ({ ...l, profitPct: null }));
      return;
    }
    const pct = parseFloat(raw) || 0;
    const sp = totalCost > 0 ? calcPriceFromProfit(pct, totalCost) : toNum(local.salePrice);
    const disc = toNum(local.discountPercent);
    const dp = disc > 0 ? Math.round(sp * (1 - disc / 100)) : sp;
    setLocalWithScratch((l) => ({
      ...l,
      profitPct: pct,
      salePrice: sp,
      salePriceManual: true,
      discountedPrice: dp,
    }));
    setManualProfitPct(pct);
  };

  const handleToggleSold = () => {
    if (isSold) {
      setLocalWithScratch((l) => ({
        ...l,
        status: "available",
        saleDate: null,
        settled: false,
        settleDate: null,
        buyerCustomerId: null,
        buyerName: "",
        buyerPhone: "",
        location: l.location === l.buyerCustomerId ? "warehouse" : l.location,
      }));
      setIsSold(false);
      setShowSettleOptions(false);
    } else {
      setLocalWithScratch((l) => ({
        ...l,
        status: "sold",
        isDraft: false,
        saleDate: l.saleDate || todayISO(),
        location: l.buyerCustomerId || l.location,
      }));
      setIsSold(true);
      setShowSettleOptions(true);
    }
  };

  const handleSettledChange = (val) => {
    setLocalWithScratch((l) => ({
      ...l,
      settled: val,
      settleDate: val ? (l.settleDate || todayISO()) : null,
    }));
  };

  const handleSaleDateChange = (e) => {
    setLocalWithScratch((l) => ({ ...l, saleDate: e.target.value }));
  };

  const handleBuyerChange = (item) => {
    if (item) {
      setLocalWithScratch((l) => ({
        ...l,
        buyerName: item.name,
        buyerCustomerId: item.id,
        buyerPhone: item.phone || "",
        location: l.status === "sold" ? item.id : l.location,
      }));
      setSelectedBuyer(item);
    } else {
      setLocalWithScratch((l) => ({
        ...l,
        buyerName: "",
        buyerCustomerId: null,
        buyerPhone: "",
        location: l.status === "sold" ? "warehouse" : l.location,
      }));
      setSelectedBuyer(null);
    }
  };

  const handleBuyerPhoneChange = (e) => {
    const raw = e.target.value;
    const clean = parsePhoneInput(raw);
    setLocalWithScratch((l) => ({ ...l, buyerPhone: clean }));
  };

  const buyerList = customers.filter(c => c.kind === "customer");

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", zIndex: 120, display: "flex", flexDirection: "column" }} dir="rtl">
      <div data-enter-nav onKeyDown={handleEnterNavigate} style={{ flex: 1, overflowY: "auto", background: "#141414", maxWidth: 520, width: "100%", margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 14px", borderBottom: "1px solid #232323", position: "sticky", top: 0, background: "#141414", zIndex: 10 }}>
          <button style={S.iconBtn} onClick={requestClose}><X size={16} color="#aaa" /></button>
          <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#F5F0EB" }}>{local.name ? "ویرایش محصول" : "محصول جدید"}</span>
          <button
            style={{
              background: "#8B1A1A",
              border: "none",
              color: "#fff",
              borderRadius: 8,
              padding: "7px 14px",
              fontSize: 11,
              cursor: "pointer",
              fontFamily: "inherit",
              flexShrink: 0,
            }}
            onClick={() => { handleSave(); clearScratch(SCRATCH_KEYS.product); }}
          >
            ذخیره
          </button>
        </div>

        <div style={{ padding: "12px 14px" }}>
          <div style={S.sectionLabel}>تصاویر محصول (اول = آیکون)</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 12, overflowX: "auto", paddingBottom: 4, WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}>
            {(local.images || (local.image ? [local.image] : [])).map((img, i) => (
              <div key={i} style={{ width: 60, height: 60, background: "#111", borderRadius: 8, overflow: "hidden", flexShrink: 0, position: "relative", border: i === 0 ? "2px solid #8B1A1A" : "1px solid #2a2a2a" }}>
                <ProductImage filename={img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} loading="lazy" />
                {i === 0 && (
                  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(139,26,26,0.8)", fontSize: 8, color: "#fff", textAlign: "center", padding: "1px 0" }}>آیکون</div>
                )}
                <button style={{ position: "absolute", top: 2, right: 2, background: "rgba(0,0,0,0.7)", border: "none", borderRadius: "50%", color: "#fff", width: 16, height: 16, fontSize: 9, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                  onClick={() => handleRemoveImage(i)}>✕</button>
              </div>
            ))}
            <label style={{ width: 60, height: 60, background: "#1c1c1c", border: "1px dashed #333", borderRadius: 8, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, gap: 3 }}>
              <ImagePlus size={16} color="#444" />
              <span style={{ fontSize: 8, color: "#444" }}>افزودن</span>
              <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleImageUpload} />
            </label>
          </div>

          <div style={{ display: "flex", gap: 6, marginBottom: 8, alignItems: "flex-end" }}>
            {/* بخش ۵۱: انتخاب نوع محصول — طبق درخواست از پایین فرم (کنار «انتخاب فرش») به همین خط بالا، سمت راست/اول منتقل شد؛ چون نوع معمولاً کوتاهه (۱-۲ کلمه)، دیگه لازم نیست تمام‌عرض باشه */}
            <div style={{ width: 76, flexShrink: 0, position: "relative" }}>
              <div style={{ fontSize: 9.5, color: "#666", marginBottom: 4 }}>نوع</div>
              <button
                type="button"
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%",
                  background: "#1c1c1c", border: "1px solid #2a2a2a", borderRadius: 6, padding: "7px 6px",
                  color: local.productTypeId ? "#ddd" : "#666", fontSize: 10.5, fontFamily: "inherit", cursor: "pointer",
                }}
                onClick={() => setShowTypePicker((s) => !s)}
              >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{(productTypes || []).find((t) => t.id === local.productTypeId)?.name || "بدون نوع"}</span>
                <ChevronDown size={11} style={{ flexShrink: 0 }} />
              </button>

              <FilterPopup open={showTypePicker} onClose={() => setShowTypePicker(false)} width={220} maxHeight={280}>
                  <button
                    type="button"
                    style={{ display: "block", width: "100%", textAlign: "right", padding: "7px 8px", background: "transparent", border: "none", color: "#666", fontSize: 11, fontFamily: "inherit", cursor: "pointer", borderRadius: 4 }}
                    onClick={() => {
                      setLocalWithScratch((l) => ({ ...l, productTypeId: null }));
                      try { localStorage.removeItem("last_product_type_id"); } catch (_) {}
                      setShowTypePicker(false);
                    }}
                  >
                    بدون نوع
                  </button>

                  {(productTypes || []).map((t) => (
                    <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      {typeEditingId === t.id ? (
                        <>
                          <input onFocus={(e) => e.target.select()}
                            style={{ flex: 1, background: "#111", border: "1px solid #333", borderRadius: 4, color: "#ddd", fontSize: 11, padding: "6px 8px", fontFamily: "inherit" }}
                            value={typeNameInput}
                            onChange={(e) => setTypeNameInput(e.target.value)}
                            autoFocus
                          />
                          <button type="button" style={{ ...S.iconBtn, color: "#5fd180" }} onClick={() => {
                            const name = typeNameInput.trim();
                            if (!name) return;
                            setData((d) => ({ ...d, productTypes: (d.productTypes || []).map((tt) => tt.id === t.id ? { ...tt, name } : tt) }));
                            setTypeEditingId(null);
                          }}><CheckCircle2 size={13} /></button>
                          <button type="button" style={{ ...S.iconBtn, color: "#666" }} onClick={() => setTypeEditingId(null)}><X size={13} /></button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            style={{ flex: 1, textAlign: "right", padding: "7px 8px", background: local.productTypeId === t.id ? "#2a1414" : "transparent", border: "none", color: local.productTypeId === t.id ? "#d88888" : "#ddd", fontSize: 11, fontFamily: "inherit", cursor: "pointer", borderRadius: 4 }}
                            onClick={() => {
                              setLocalWithScratch((l) => ({ ...l, productTypeId: t.id }));
                              try { localStorage.setItem("last_product_type_id", t.id); } catch (_) {}
                              setShowTypePicker(false);
                            }}
                          >
                            {t.name}
                          </button>
                          <button type="button" style={{ ...S.iconBtn, color: "#666" }} onClick={() => { setTypeEditingId(t.id); setTypeNameInput(t.name); }}><Edit3 size={12} /></button>
                          <button
                            type="button"
                            style={{ ...S.iconBtn, color: "#e08a8a" }}
                            title="حذف نوع (اگه محصولی از این نوع داشته باشه حذف نمی‌شه)"
                            onClick={() => {
                              const inUse = (products || []).some((p) => p.productTypeId === t.id) || local.productTypeId === t.id;
                              if (inUse) {
                                showToast?.("این نوع روی حداقل یک محصول استفاده شده، قابل حذف نیست", "error");
                                return;
                              }
                              setData((d) => ({ ...d, productTypes: (d.productTypes || []).filter((tt) => tt.id !== t.id) }));
                            }}
                          ><Trash2 size={12} /></button>
                        </>
                      )}
                    </div>
                  ))}

                  <div style={{ display: "flex", gap: 4, marginTop: 4, borderTop: "1px solid #2a2a2a", paddingTop: 6 }}>
                    <input
                      style={{ flex: 1, background: "#111", border: "1px solid #333", borderRadius: 4, color: "#ddd", fontSize: 11, padding: "6px 8px", fontFamily: "inherit" }}
                      placeholder="+ نوع جدید..."
                      value={typeEditingId === "new" ? typeNameInput : ""}
                      onFocus={(e) => { setTypeEditingId("new"); e.target.select(); }}
                      onChange={(e) => { setTypeEditingId("new"); setTypeNameInput(e.target.value); }}
                    />
                    <button
                      type="button"
                      style={{ ...S.iconBtn, color: "#5fd180" }}
                      onClick={() => {
                        const name = typeNameInput.trim();
                        if (!name) return;
                        const newType = { ...emptyProductType(), name };
                        setData((d) => ({ ...d, productTypes: [...(d.productTypes || []), newType] }));
                        setLocalWithScratch((l) => ({ ...l, productTypeId: newType.id }));
                        try { localStorage.setItem("last_product_type_id", newType.id); } catch (_) {}
                        setTypeEditingId(null);
                        setTypeNameInput("");
                        setShowTypePicker(false);
                      }}
                    ><Plus size={13} /></button>
                  </div>
              </FilterPopup>
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 9.5, color: "#666", marginBottom: 4 }}>نام محصول</div>
              <input onFocus={(e) => e.target.select()} style={{ ...S.input, borderColor: errors.name ? "#ef4444" : "#232323", background: errors.name ? "#2a1414" : "#1c1c1c" }} value={local.name} onChange={(e) => { setErrors(e => ({...e, name: false})); setLocalWithScratch({ ...local, name: e.target.value }); }} />
            </div>
            <div style={{ width: 64 }}>
              <div style={{ fontSize: 9.5, color: "#666", marginBottom: 4 }}>کد</div>
              <input style={{ ...S.input, textAlign: "center", color: errors.code ? "#ef4444" : "#8B1A1A", borderColor: errors.code ? "#ef4444" : "#232323", background: errors.code ? "#2a1414" : "#1c1c1c" }} value={local.code != null ? fmtCode(local.code) : fmtCode(nextCode)} onChange={(e) => { const d = e.target.value.replace(/\D/g, "");
                setErrors(er => ({ ...er, code: false }));
                setLocalWithScratch({ ...local, code: d ? Number(d) : null }); }} />
            </div>
          </div>
          {errors.code && (
            <div style={{ fontSize: 9.5, color: "#ef4444", marginTop: -4, marginBottom: 8 }}>
              این کد قبلاً برای محصول دیگه‌ای ثبت شده — یه کد دیگه بذار
            </div>
          )}

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 9.5, color: "#666", marginBottom: 4 }}>
              {selectedFabric ? "انتخاب فرش و درصد مصرف" : "انتخاب فرش"}
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <div style={{ flex: 1 }}>
                <SmartLocationSelect
                  value={selectedFabric ? selectedFabric.id : null}
                  includeWarehouse={false}
                  placeholder="انتخاب فرش..."
                  options={fabricMaterials}
                  onChange={(id) => handleFabricChange(fabricMaterials.find((m) => m.id === id) || null)}
                />
              </div>

              {selectedFabric && (
                <div style={{ display: "flex", alignItems: "center", gap: 3, background: "#1c1c1c", border: "1px solid #2a2a2a", borderRadius: 6, height: 31, padding: "0 6px" }}>
                  <input
                    style={{ background: "transparent", border: "none", outline: "none", color: "#ddd", fontSize: 11, width: 35, textAlign: "center", fontFamily: "inherit" }}
                    type="text"
                    placeholder="۱۰۰"
                    value={local.fabricCoveragePct ?? 100}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === "") {
                        setLocalWithScratch({ ...local, fabricCoveragePct: "" });
                        return;
                      }
                      const n = Number(raw);
                      if (!isNaN(n)) setLocalWithScratch({ ...local, fabricCoveragePct: n });
                    }}
                    onBlur={(e) => {
                      if (e.target.value === "" || isNaN(Number(e.target.value))) {
                        setLocalWithScratch({ ...local, fabricCoveragePct: 100 });
                      }
                    }}
                  />
                  <span style={{ fontSize: 10, color: "#888" }}>٪</span>
                </div>
              )}

              <button
                type="button"
                style={{
                  ...S.iconBtn,
                  background: "#1c1c1c",
                  border: "1px solid #2a2a2a",
                  borderRadius: 6,
                  height: 31,
                  width: 32,
                  justifyContent: "center",
                  color: selectedFabric ? "#8B1A1A" : "#444",
                  cursor: "pointer",
                  flexShrink: 0
                }}
                onClick={() => {
                  handleFabricChange(null);
                }}
                title="بدون فرش"
              >
                <X size={14} />
              </button>
            </div>
            
            {selectedFabric ? (
              <div style={{ fontSize: 9, color: "#5fd180", marginTop: 3 }}>
                ✓ فرش «{selectedFabric.name}» به عنوان متریال متصل شد — محاسبات مساحت مصرفی فعال است
              </div>
            ) : (
              <div style={{ fontSize: 9, color: "#888", marginTop: 3 }}>بدون فرش (هیچ فرشی انتخاب نشده است)</div>
            )}
          </div>

          {(() => {
            const isSemi = local.shape === "semi-circle" || (local.dims || "").toUpperCase().endsWith("D");
            const isCircle = local.shape === "circle" || (local.dims || "").toUpperCase().endsWith("O");
            const isRound = isSemi || isCircle;
            const curW = local.dimW !== undefined ? local.dimW : (parseDims(local.dims || "")?.w ?? "");
            const curH = local.dimH !== undefined ? local.dimH : (parseDims(local.dims || "")?.h ?? "");

            // shapeMode: "rectangle" | "semi-circle" | "circle"
            const commitDims = (w, h, shapeMode) => {
              if (shapeMode === "semi-circle") {
                setLocalWithScratch((l) => ({ ...l, dims: `${w}D`, shape: "semi-circle", dimW: w, dimH: "" }));
              } else if (shapeMode === "circle") {
                setLocalWithScratch((l) => ({ ...l, dims: `${w}o`, shape: "circle", dimW: w, dimH: "" }));
              } else {
                setLocalWithScratch((l) => ({ ...l, dims: `${w}×${h}`, shape: "rectangle", dimW: w, dimH: h }));
              }
            };

            return (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 9.5, color: "#666", marginBottom: 4 }}>ابعاد</div>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 6 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 8.5, color: "#444", marginBottom: 2 }}>{isRound ? "قطر" : "طول"}</div>
                    <input onFocus={(e) => e.target.select()}
                      style={{ ...S.input, textAlign: "center", borderColor: errors.dimW ? "#ef4444" : "#232323", background: errors.dimW ? "#2a1414" : "#1c1c1c" }}
                      type="text"
                      placeholder="سانت"
                      value={curW !== undefined && curW !== null ? curW : ""}
                      onChange={(e) => {
                        const v = normalizeNumericInput(e.target.value);
                        setErrors(err => ({...err, dimW: false}));
                        setLocalWithScratch((l) => {
                          const suffix = isCircle ? "o" : isSemi ? "D" : null;
                          const newDims = suffix ? `${v}${suffix}` : `${v}×${curH}`;
                          const shape = isCircle ? "circle" : isSemi ? "semi-circle" : "rectangle";
                          return { ...l, dimW: v, dims: newDims, shape };
                        });
                      }}
                    />
                  </div>
                  <div style={{ display: "flex", gap: 3, flexShrink: 0, marginTop: 14 }}>
                    <button style={{ background: isRound ? "#2a1414" : "transparent", border: isRound ? "1px solid #8B1A1A" : "1px solid #2a2a2a", borderRadius: 6, padding: "4px 8px", cursor: "pointer", color: isRound ? "#d88888" : "#555", fontSize: 14, fontWeight: 700, minWidth: 26, fontFamily: "inherit" }}
                      onClick={() => commitDims(curW, curH, isRound ? "rectangle" : "semi-circle")}
                      title={isRound ? "تبدیل به مستطیل" : "تبدیل به نیم‌دایره"}>
                      {isRound ? "D" : "×"}
                    </button>
                    {isRound && (
                      <button style={{ background: isCircle ? "#14241a" : "transparent", border: isCircle ? "1px solid #2e7d4f" : "1px solid #2a2a2a", borderRadius: 6, padding: "4px 8px", cursor: "pointer", color: isCircle ? "#7fd8a0" : "#555", fontSize: 14, fontWeight: 700, minWidth: 26, fontFamily: "inherit" }}
                        onClick={() => commitDims(curW, curH, isCircle ? "semi-circle" : "circle")}
                        title={isCircle ? "تبدیل به نیم‌دایره" : "تبدیل به دایره‌ی کامل"}>
                        O
                      </button>
                    )}
                  </div>
                  {!isRound ? (
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 8.5, color: "#444", marginBottom: 2 }}>عرض</div>
                      <input onFocus={(e) => e.target.select()}
                        style={{ ...S.input, textAlign: "center", borderColor: errors.dimH ? "#ef4444" : "#232323", background: errors.dimH ? "#2a1414" : "#1c1c1c" }}
                        type="text"
                        placeholder="سانت"
                        value={curH ?? ""}
                        onChange={(e) => {
                          const v = normalizeNumericInput(e.target.value);
                          setErrors(err => ({...err, dimH: false}));
                          setLocalWithScratch((l) => ({ ...l, dimH: v, dims: `${curW}×${v}`, shape: "rectangle" }));
                        }}
                      />
                    </div>
                  ) : (
                    <div style={{ flex: 1, fontSize: 9.5, color: "#555", display: "flex", alignItems: "center", marginTop: 14 }}>
                      {isCircle ? "دایره‌ی کامل" : "نیم‌دایره"} {curW ? `— قطر ${curW} سانت` : ""}
                    </div>
                  )}
                  <span style={{ fontSize: 9.5, color: "#555", whiteSpace: "nowrap", marginTop: 14 }}>سانت</span>
                  <div style={{ width: 54, flexShrink: 0 }}>
                    <div style={{ fontSize: 8.5, color: "#444", marginBottom: 2 }}>تعداد</div>
                    <input
                      style={{ ...S.input, textAlign: "center" }}
                      type="text"
                      placeholder="۱"
                      value={local.qty ?? 1}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, "");
                        setLocalWithScratch((l) => ({ ...l, qty: raw === "" ? "" : parseInt(raw, 10) }));
                      }}
                      onBlur={(e) => {
                        const n = parseInt(e.target.value, 10);
                        setLocalWithScratch((l) => ({ ...l, qty: !n || n < 1 ? 1 : n }));
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })()}

          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 9.5, color: "#666", marginBottom: 4 }}>توضیحات دلخواه (اختیاری)</div>
            <textarea
              style={{ ...S.input, minHeight: 56, resize: "vertical", fontFamily: "inherit", lineHeight: 1.5, padding: "8px 10px" }}
              placeholder="هر متنی این‌جا بنویسی، دقیقاً همون‌جوری (چندخطی هم اگه بود) زیر ابعاد توی کاتالوگ و محصولات نمایش داده می‌شه"
              value={local.description || ""}
              onFocus={(e) => e.target.select()}
              onChange={(e) => setLocalWithScratch((l) => ({ ...l, description: e.target.value }))}
            />
          </div>

          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 9.5, color: "#666", marginBottom: 4 }}>موقعیت محصول</div>
            <SmartLocationSelect 
              value={local.location || "warehouse"}
              options={galleryCustomers}
              onChange={(newLoc) => {
                if (newLoc === "warehouse") {
                  setLocalWithScratch({ ...local, location: "warehouse", galleryName: "" });
                  setSelectedGallery(null);
                } else {
                  const g = galleryCustomers.find(c => c.id === newLoc);
                  handleGalleryChange(g);
                }
              }}
            />
          </div>

          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 9.5, color: "#666", marginBottom: 4 }}>وضعیت محصول</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button
                style={{
                  ...S.chip,
                  background: "transparent",
                  border: isSold ? "1px solid #d4b400" : "1px solid #2a2a2a",
                  color: isSold ? "#f2c94c" : "#888",
                  padding: "8px 16px",
                  fontSize: 11,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
                onClick={handleToggleSold}
              >
                {isSold ? "✓ فروخته شد" : "فروخته شد"}
              </button>
              
              {!isSold && (
                <button
                  style={{
                    ...S.chip,
                    background: "transparent",
                    border: local.isDraft ? "1px solid #d4b400" : "1px solid #2a2a2a",
                    color: local.isDraft ? "#f2c94c" : "#888",
                    padding: "8px 16px",
                    fontSize: 11,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                  onClick={() => setLocalWithScratch({ ...local, isDraft: !local.isDraft })}
                >
                  {local.isDraft ? "✓ در دست ساخت" : "در دست ساخت"}
                </button>
              )}

              {isSold && showSettleOptions && (
                <>
                  <button
                    style={{
                      ...S.chip,
                      ...(!local.settled ? S.chipActive : {}),
                      padding: "8px 16px",
                      fontSize: 11,
                    }}
                    onClick={() => handleSettledChange(false)}
                  >
                    تسویه نشده
                  </button>
                  <button
                    style={{
                      ...S.chip,
                      ...(local.settled ? { background: "#1d3a24", border: "1px solid #2d5a38", color: "#5fd180" } : {}),
                      padding: "8px 16px",
                      fontSize: 11,
                    }}
                    onClick={() => handleSettledChange(true)}
                  >
                    تسویه شده
                  </button>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 4, width: "100%" }}>
                    <span style={{ fontSize: 9.5, color: "#666" }}>تاریخ فروش:</span>
                    <JalaliDatePicker value={local.saleDate || todayISO()} onChange={(val) => setLocalWithScratch(l => ({ ...l, saleDate: val }))} />
                  </div>
                </>
              )}
            </div>
          </div>

          {isSold && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 9.5, color: errors.buyerName ? "#ef4444" : "#666", marginBottom: 4 }}>خریدار (الزامی برای غیرتسویه)</div>
              <div style={errors.buyerName ? { border: "1px solid #ef4444", borderRadius: 8, padding: "1px" } : {}}>
                <CustomerSmartSelect
                  value={selectedBuyer ? selectedBuyer.name : (local.buyerName || "")}
                  onChange={(item) => {
                    if (errors.buyerName) setErrors(prev => ({ ...prev, buyerName: false }));
                    handleBuyerChange(item);
                  }}
                  options={buyerList}
                  placeholder="نام خریدار..."
                />
              </div>
              <input onFocus={(e) => e.target.select()}
                style={{
                  ...S.input,
                  marginTop: 4,
                  borderColor: errors.buyerPhone ? "#ef4444" : "#2a2a2a",
                  background: errors.buyerPhone ? "#2a1414" : "#1c1c1c",
                }}
                type="tel"
                placeholder="شماره تلفن (الزامی برای غیرتسویه)"
                value={formatPhoneInput(local.buyerPhone || "")}
                onChange={(e) => {
                  if (errors.buyerPhone) setErrors(prev => ({ ...prev, buyerPhone: false }));
                  handleBuyerPhoneChange(e);
                }}
              />
            </div>
          )}

          <div style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", gap: 6 }}>
              <div style={{ flex: 2 }}>
                <div style={{ fontSize: 9.5, color: "#666", marginBottom: 4 }}>قیمت فروش (تومان)</div>
                <input onFocus={(e) => e.target.select()}
                  style={{ ...S.input, borderColor: errors.salePrice ? "#ef4444" : "#232323", background: errors.salePrice ? "#2a1414" : "#1c1c1c" }}
                  type="text"
                  value={local.salePrice ? formatPriceInput(local.salePrice) : ""}
                  onChange={handleSalePriceChange}
                />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 9.5, color: "#666", marginBottom: 4 }}>تخفیف درصد</div>
                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  <input onFocus={(e) => e.target.select()}
                    style={{ ...S.input, textAlign: "center", paddingLeft: 20 }}
                    type="text"
                    placeholder="۰"
                    value={local.discountPercent || ""}
                    onChange={handleDiscountChange}
                  />
                  <span style={{ position: "absolute", left: 8, fontSize: 10, color: "#555" }}>٪</span>
                </div>
              </div>
            </div>

            {toNum(local.discountPercent) > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                <span style={{ fontSize: 10, color: "#e08a8a", textDecoration: "line-through" }}>
                  {formatPriceInput(local.salePrice)}
                </span>
                <span style={{ fontSize: 9.5, background: "#1d3a24", color: "#5fd180", borderRadius: 6, padding: "1px 6px" }}>
                  {local.discountPercent}٪
                </span>
                {toNum(local.discountPercent) >= 100 ? (
                  <span style={{ fontSize: 11, background: "#3a1d33", color: "#f2a3e0", borderRadius: 6, padding: "1px 8px", fontWeight: 600, display:"inline-flex", alignItems:"center", gap:3 }}><Gift size={12} /> هدیه</span>
                ) : (
                  <span style={{ fontSize: 11, color: "#5fd180", fontWeight: 600 }}>
                    {formatPriceInput(local.discountedPrice)}
                  </span>
                )}
              </div>
            )}

            {totalCost > 0 && toNum(local.salePrice) > 0 && (
              <div style={{ fontSize: 9, color: toNum(local.salePrice) >= totalCost ? "#5fd180" : "#e08a8a", marginTop: 3 }}>
                سود: {fmt(toNum(local.salePrice) - totalCost)} تومان ({calcProfitFromPrice(toNum(local.salePrice), totalCost).toFixed(1)}٪)
              </div>
            )}
          </div>

          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 9.5, color: "#666", marginBottom: 5 }}>پیش‌فرض سود</div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
              {profitPresets.map((pct) => (
                <button key={pct} style={{ ...S.chip, fontSize: 9.5 }} onClick={() => handleProfitPreset(pct)}>{pct}٪</button>
              ))}
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <input onFocus={(e) => e.target.select()}
                  style={{ ...S.input, width: 65, fontSize: 10, textAlign: "center", paddingLeft: 18 }}
                  type="text"
                  placeholder="دستی"
                  value={manualProfitPct !== null && manualProfitPct !== "" ? manualProfitPct : ""}
                  onChange={handleManualProfitChange}
                />
                <span style={{ position: "absolute", left: 6, fontSize: 10, color: "#555" }}>٪</span>
              </div>
            </div>
          </div>

          <div style={S.sectionLabel}>متریال‌های مصرفی</div>
          {(local.lineItems || []).filter(li => !li._toRemove).map((li) => {
            const linkedMat = li.materialId ? materials.find((m) => m.id === li.materialId) : null;
            let autoPct = null;
            if (linkedMat && linkedMat.type !== "fabric") {
              autoPct = linkedMat.type === "area" ? 100 : 100; 
            }
            // برای فرش: محاسبه خودکار بر اساس ابعاد
            if (linkedMat && linkedMat.type === "fabric" && local.dims) {
              const productArea = getProductArea(local);
              const coverage = toNum(local.fabricCoveragePct ?? 100) / 100;
              const fabricArea = toNum(linkedMat.dimW) * toNum(linkedMat.dimH);
              if (fabricArea > 0 && productArea > 0) {
                autoPct = Math.round(((productArea * coverage) / fabricArea) * 100 * 10) / 10;
              }
            }
            return (
              <div key={li.id} style={{ background: "#1a1a1a", borderRadius: 8, padding: "9px 10px", marginBottom: 6, opacity: li.pendingUnlock ? 0.7 : 1 }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input onFocus={(e) => e.target.select()} style={{ ...S.input, flex: 1.2 }} placeholder="عنوان" value={li.label} onChange={(e) => updateLine(li.id, { label: e.target.value })} />
                  {li.materialId ? (
                    <div style={{ ...S.input, flex: 1, color: "#888", fontSize: 10 }}>{fmt(resolveCost(li))} ت</div>
                  ) : (
                    <input onFocus={(e) => e.target.select()} style={{ ...S.input, flex: 1 }} type="text" placeholder="۰" value={li.cost ? formatPriceInput(li.cost) : ""} onChange={(e) => updateLine(li.id, { cost: parsePriceInput(e.target.value) })} />
                  )}
                  <button style={S.iconBtn} onClick={() => {
                    if (li.materialId) {
                      if ((li.deductedAt && !li.pendingUnlock) || li.woodLocked) return;
                      if (li.pendingUnlock) {
                        updateLine(li.id, { _toRemove: true });
                      } else {
                        updateLine(li.id, { materialId: null, pct: null, batchId: null });
                      }
                    } else {
                      setPickerForLine(li.id);
                    }
                  }}>
                    {li.materialId ? <Unlink size={12} color={(li.deductedAt && !li.pendingUnlock) ? "#444" : "#8B1A1A"} /> : <Link2 size={12} color="#555" />}
                  </button>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, minWidth: 42 }}>
                    <span style={{ fontSize: 7, color: "#666" }}>تعداد مصرفی</span>
                    <input
                      style={{ ...S.input, width: 38, padding: "3px", textAlign: "center", fontSize: 10, border: "1px solid #333" }}
                      type="text"
                      value={li.consumedCount ?? 1}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === "") { updateLine(li.id, { consumedCount: "" }); return; }
                        const n = parseInt(raw, 10);
                        if (!isNaN(n)) updateLine(li.id, { consumedCount: n });
                      }}
                      onBlur={(e) => {
                        const n = parseInt(e.target.value, 10);
                        updateLine(li.id, { consumedCount: isNaN(n) || n < 1 ? 1 : n });
                      }}
                    />
                  </div>
                  <button style={S.iconBtn} onClick={() => removeLine(li.id)}><Trash2 size={12} color="#555" /></button>
                </div>

                {linkedMat && linkedMat.type === "fabric" && !li.deductedAt && !li.pendingUnlock && (
                  <div style={{ marginTop: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 9.5, color: "#666", flex: 1 }}>نحوه مصرف از «{linkedMat.name}»</span>
                      <button 
                        style={{ ...S.chip, fontSize: 9, ...(li.useAutoPct !== false ? S.chipActive : {}) }} 
                        onClick={() => {
                          updateLine(li.id, { useAutoPct: true, pct: autoPct });
                        }}
                      >خودکار</button>
                      <button 
                        style={{ ...S.chip, fontSize: 9, ...(li.useAutoPct === false ? S.chipActive : {}) }} 
                        onClick={() => updateLine(li.id, { useAutoPct: false })}
                      >
                        دستی
                      </button>
                    </div>
                    {li.useAutoPct === false ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                        <input onFocus={(e) => e.target.select()} style={{ ...S.input, ...(resolveCost(li) > (linkedMat?.remainingCost ?? 0) ? { borderColor: "#8B1A1A" } : {}), width: 60 }} type="text" placeholder="%" value={li.pct ?? ""} onChange={(e) => updateLine(li.id, { pct: toNum(e.target.value) })} />
                        <span style={{ color: "#666", fontSize: 10 }}>%</span>
                        <span style={{ fontSize: 9, color: "#555" }}>یا</span>
                        <input onFocus={(e) => e.target.select()} style={{ ...S.input, ...(resolveCost(li) > (linkedMat?.remainingCost ?? 0) ? { borderColor: "#8B1A1A" } : {}), width: 80 }} type="text" placeholder="مبلغ" value={li.manualCost ? formatPriceInput(li.manualCost) : ""} onChange={(e) => updateLine(li.id, { manualCost: parsePriceInput(e.target.value), cost: parsePriceInput(e.target.value) })} />
                        <span style={{ fontSize: 9, color: "#555" }}>تومان</span>
                      </div>
                    ) : (
                      <div style={{ fontSize: 9, color: "#5fd180", marginTop: 3 }}>
                        درصد خودکار: {autoPct !== null ? autoPct : (li.pct ?? 0)}%
                        {local.dims && linkedMat.dimW && linkedMat.dimH && ` (مساحت مصرفی ${(getProductArea(local) * (toNum(local.fabricCoveragePct ?? 100) / 100)).toFixed(0)} / مساحت فرش ${(toNum(linkedMat.dimW) * toNum(linkedMat.dimH)).toFixed(0)})`}
                      </div>
                    )}
                  </div>
                )}

                {linkedMat && linkedMat.type !== "fabric" && !li.deductedAt && !li.pendingUnlock && (
                  <div style={{ marginTop: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 9.5, color: "#666", flex: 1 }}>نحوه مصرف از «{linkedMat.name}»</span>
                      <button style={{ ...S.chip, fontSize: 9, ...(li.useAutoPct !== false ? S.chipActive : {}) }} onClick={() => updateLine(li.id, { useAutoPct: true, pct: autoPct })}>خودکار</button>
                      <button style={{ ...S.chip, fontSize: 9, ...(li.useAutoPct === false ? S.chipActive : {}) }} onClick={() => updateLine(li.id, { useAutoPct: false })}>دستی</button>
                    </div>
                    {li.useAutoPct === false ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                        <input onFocus={(e) => e.target.select()} style={{ ...S.input, ...(resolveCost(li) > (linkedMat?.remainingCost ?? 0) ? { borderColor: "#8B1A1A" } : {}), width: 60 }} type="text" placeholder="%" value={li.pct ?? ""} onChange={(e) => updateLine(li.id, { pct: toNum(e.target.value) })} />
                        <span style={{ color: "#666", fontSize: 10 }}>%</span>
                        <span style={{ fontSize: 9, color: "#555" }}>یا</span>
                        <input onFocus={(e) => e.target.select()} style={{ ...S.input, ...(resolveCost(li) > (linkedMat?.remainingCost ?? 0) ? { borderColor: "#8B1A1A" } : {}), width: 80 }} type="text" placeholder="مبلغ" value={li.manualCost ? formatPriceInput(li.manualCost) : ""} onChange={(e) => updateLine(li.id, { manualCost: parsePriceInput(e.target.value), cost: parsePriceInput(e.target.value) })} />
                        <span style={{ fontSize: 9, color: "#555" }}>تومان</span>
                      </div>
                    ) : (
                      <div style={{ fontSize: 9, color: "#5fd180", marginTop: 3 }}>درصد خودکار: {autoPct !== null ? autoPct.toFixed(1) : "محاسبه..."}%</div>
                    )}
                  </div>
                )}

                {linkedMat && li.deductedAt && !li.pendingUnlock && (
                  <div style={{ marginTop: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 9.5, color: "#6fbf90" }}>
                      <Lock size={9} style={{ verticalAlign: -1 }} /> قفل شده {fmtDate(li.deductedAt)}
                      {/* سهم واقعی از بولک — قبلاً هیچ درصدی برای آیتم‌های قفل‌شده نمایش داده
                          نمی‌شد (نه غلط، فقط اصلاً نبود)؛ بولک به کل دسته ۱۰۰٪ اختصاص می‌ده،
                          نه به یه محصول خاص، پس سهم واقعیِ همین محصول از customPct خونده می‌شه */}
                      {li.customPct != null && ` · سهم: ${Number(li.customPct).toFixed(1)}٪`}
                    </span>
                    <button style={{ ...S.iconBtn, fontSize: 9 }} onClick={() => updateLine(li.id, { pendingUnlock: true })}><Unlock size={11} color="#8B1A1A" /></button>
                  </div>
                )}

                {linkedMat && li.pendingUnlock && (
                  <div style={{ marginTop: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 9.5, color: "#e0a35a" }}><Unlock size={9} style={{ verticalAlign: -1 }} /> در انتظار آزادسازی — با نگه‌داشتن دکمه رفرش آزاد می‌شود</span>
                  </div>
                )}

                {linkedMat && !li.deductedAt && !li.pendingUnlock && (toNum(li.pct) > 0 || toNum(li.cost) > 0) && (
                  <div style={{ marginTop: 4 }}>
                    <span style={{ fontSize: 9.5, color: "#e0a35a" }}><Unlock size={9} style={{ verticalAlign: -1 }} /> معلق — با نگه‌داشتن دکمه رفرش قفل می‌شود</span>
                  </div>
                )}
              </div>
            );
          })}
          <button style={{ ...S.chip, color: "#7aa8d8", marginBottom: 12, padding: "6px 12px" }} onClick={addLine}>
            <Plus size={11} style={{ marginLeft: 4 }} /> افزودن متریال
          </button>

          <div style={{ flex: 1 }}></div>

          <div style={{ 
            background: "#111", 
            borderRadius: 8, 
            padding: "10px 12px", 
            display: "flex", 
            justifyContent: "space-between", 
            fontSize: 11, 
            color: "#aaa", 
            marginBottom: 0,
            position: "sticky",
            bottom: 0,
            zIndex: 5,
            border: "1px solid #222",
            boxShadow: "0 -4px 10px rgba(0,0,0,0.3)",
            marginTop: 12
          }}>
            <span>جمع هزینه: {fmt(totalCost)} ت</span>
            <span style={{ 
              color: (toNum(local.salePrice) - totalCost) > 0 ? "#5fd180" : (toNum(local.salePrice) - totalCost) < 0 ? "#e08a8a" : "#aaa",
              fontWeight: (toNum(local.salePrice) - totalCost) !== 0 ? 600 : 400
            }}>
              سود: {fmt(toNum(local.salePrice) - totalCost)} ت
            </span>
          </div>
        </div>
      </div>

      {pickerForLine && (
        <div style={{ ...S.overlay, zIndex: 130 }} onClick={(e) => e.target === e.currentTarget && setPickerForLine(null)}>
          <div style={{ ...S.sheet, maxHeight: "60vh" }}>
            <div style={S.sheetHeader}>
              <span style={{ flex: 1, fontSize: 12, color: "#ddd" }}>انتخاب متریال</span>
              <button style={S.iconBtn} onClick={() => setPickerForLine(null)}><X size={12} color="#888" /></button>
            </div>
            <div style={{ padding: "8px 12px", overflowY: "auto" }}>
              {materials.filter((m) => !m.hidden).map((m) => (
                <button key={m.id} style={{ width: "100%", background: "#1c1c1c", border: "1px solid #2a2a2a", borderRadius: 7, padding: "9px 12px", marginBottom: 5, textAlign: "right", color: "#ddd", fontSize: 11, fontFamily: "inherit", cursor: "pointer", display: "flex", justifyContent: "space-between" }}
                  onClick={() => {
                    if ((m.type === "area") && (m.batches || []).length > 0) {
                      setBatchPickerFor({ lineId: pickerForLine, material: m });
                      setPickerForLine(null);
                    } else if (m.type === "ratio") {
                      updateLine(pickerForLine, { materialId: m.id, label: m.name, pct: toNum(m.defaultPct) || null, batchId: null });
                      setPickerForLine(null);
                    } else {
                      updateLine(pickerForLine, { materialId: m.id, label: m.name, batchId: null, pct: 100 });
                      setPickerForLine(null);
                    }
                  }}>
                  <span>{m.name}</span>
                  <span style={{ fontSize: 9.5, color: "#666" }}>{m.type}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {batchPickerFor && (
        <div style={{ ...S.overlay, zIndex: 135 }} onClick={(e) => e.target === e.currentTarget && setBatchPickerFor(null)}>
          <div style={{ ...S.sheet, maxHeight: "50vh" }}>
            <div style={S.sheetHeader}>
              <span style={{ flex: 1, fontSize: 12, color: "#ddd" }}>انتخاب بچ از «{batchPickerFor.material.name}»</span>
              <button style={S.iconBtn} onClick={() => setBatchPickerFor(null)}><X size={12} color="#888" /></button>
            </div>
            <div style={{ padding: "8px 12px", overflowY: "auto" }}>
              {(batchPickerFor.material.batches || []).map((b) => (
                <button key={b.id} style={{ width: "100%", background: "#1c1c1c", border: "1px solid #2a2a2a", borderRadius: 7, padding: "9px 12px", marginBottom: 5, textAlign: "right", color: "#ddd", fontSize: 11, fontFamily: "inherit", cursor: "pointer" }}
                  onClick={() => {
                    onLinkBatch(batchPickerFor.material.id, b.id, local.id);
                    updateLine(batchPickerFor.lineId, { materialId: batchPickerFor.material.id, batchId: b.id, label: batchPickerFor.material.name, pct: null });
                    setBatchPickerFor(null);
                  }}>
                  {b.label || "بچ بدون عنوان"} · {b.width}×{b.height} سانتی‌متر
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      {showDiscardConfirm && (
        <div style={{ ...S.overlay, zIndex: 200, alignItems: "center", justifyContent: "center" }} onClick={(e) => e.stopPropagation()}>
          <div style={{ width: "88%", maxWidth: 340, background: "#181818", border: "1px solid #2a2a2a", borderRadius: 14, padding: 20 }} dir="rtl">
            <div style={{ fontSize: 13, fontWeight: 600, color: "#F5F0EB", marginBottom: 8 }}>لغو کنید؟</div>
            <div style={{ fontSize: 11, color: "#777", lineHeight: 1.65, marginBottom: 18 }}>تغییراتی که ذخیره نکردی از دست می‌ره.</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={{ flex: 1, background: "transparent", border: "1px solid #2a2a2a", color: "#777", borderRadius: 8, padding: "10px 0", fontFamily: "inherit", fontSize: 11, cursor: "pointer" }} onClick={() => setShowDiscardConfirm(false)}>ادامه ویرایش</button>
              <button style={{ flex: 1, background: "#8B1A1A", border: "none", color: "#fff", borderRadius: 8, padding: "10px 0", fontFamily: "inherit", fontSize: 11, cursor: "pointer" }} onClick={() => { setShowDiscardConfirm(false); onClose(); }}>لغو کن</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── CatalogTab ──
export function CatalogTab({
  stickyTop = 60,
  products,
  customers,
  materials = [],
  setData,
  notify,
  sortOrder = "code",
  setSortOrder,
  basket = [],
  setBasket,
  showBasket = false,
  setShowBasket,
  addToBasket,
  removeFromBasket,
  myBusinessCard,
  productTypes = [],
}) {
  const confirmPurchase = (items, customerName, settled = true) => {
    setData((d) => {
      let customersList = [...(d.customers || [])];
      let custId = null;
      if (customerName.trim()) {
        const existing = customersList.find((c) => c.kind === "customer" && c.name.toLowerCase() === customerName.toLowerCase());
        if (existing) {
          custId = existing.id;
        } else {
          const nc = {
            id: uid(),
            name: customerName.trim(),
            phone: "",
            note: "",
            color: GALLERY_COLOR_PALETTE[customersList.length % GALLERY_COLOR_PALETTE.length],
            kind: "customer",
          };
          customersList = [...customersList, nc];
          custId = nc.id;
        }
      }

      const newProducts = d.products.map((p) => {
        const inBasket = items.find((x) => x.id === p.id);
        if (!inBasket) return p;
        return {
          ...p,
          status: "sold",
          location: custId || "warehouse",
          buyerCustomerId: custId,
          buyerName: !custId ? customerName.trim() : "",
          saleDate: p.saleDate || todayISO(),
          settled: !!settled,
          settleDate: settled ? todayISO() : null,
        };
      });
      return { ...d, products: newProducts, customers: customersList };
    });
    setBasket([]);
    setShowBasket(false);
    if (notify) notify(`${items.length} محصول با موفقیت ثبت شد`);
  };

  const handleBatchTransfer = (items, galleryId) => {
    setData((d) => ({
      ...d,
      products: d.products.map((p) => {
        const inBasket = items.find((x) => x.id === p.id);
        if (!inBasket) return p;
        return { ...p, location: galleryId, status: "available", buyerCustomerId: null, buyerName: "", buyerPhone: "", transferDate: new Date().toISOString() };
      }),
    }));
    setBasket([]);
    setShowBasket(false);
    if (notify) notify(`${items.length} محصول به گالری منتقل شد`);
  };

  const [statusFilter, setStatusFilter] = useState([]); // آرایه‌ی چند-انتخابی؛ خالی = همه
  const [showCatalogStatusMenu, setShowCatalogStatusMenu] = useState(false);
  const [typeFilter, setTypeFilter] = useState([]); // چند-انتخابی: آرایه‌ی شناسه‌ی انواع؛ خالی = همه
  const [showTypeFilterMenu, setShowTypeFilterMenu] = useState(false);
  const [lightboxId, setLightboxId] = useState(null);
  const [search, setSearch] = useState("");

  const galleryCustomers = customers.filter((c) => c.kind === "gallery");

  const {
    selectedWarehouse,
    selectedGalleries,
    showLocationMenu,
    menuRef,
    toggleWarehouse,
    toggleGallery,
    toggleAllGalleries,
    isLocationSelected,
    getLocationLabel,
    resetLocationFilter,
    setShowLocationMenu,
  } = useLocationFilter(galleryCustomers);

  const sortFn = (a, b) => {
    const baseSort = String(sortOrder || "").replace(/_desc$/, "");
    const isDesc = String(sortOrder || "").endsWith("_desc");
    let cmp;
    switch (baseSort) {
      case "az": cmp = a.name?.localeCompare(b.name, "fa") || 0; break;
      case "date": cmp = (b.saleDate || "").localeCompare(a.saleDate || ""); break;
      case "stock": cmp = (b.status === "sold" ? 0 : 1) - (a.status === "sold" ? 0 : 1); break;
      default: cmp = toNum(a.code) - toNum(b.code);
    }
    return isDesc ? -cmp : cmp;
  };

  const filtered = useMemo(() => {
    return (products || [])
      .filter((p) => {
        if (p.isDraft) return false;
        if (p.hiddenFromCatalog) return false;
        if ((typeFilter || []).length > 0 && !(typeFilter || []).includes(p.productTypeId)) return false;
        if (search.trim() && !p.name?.includes(search) && !String(p.code).includes(search) && !(p.dims && p.dims.includes(search))) return false;
        if (statusFilter.length > 0 && !statusFilter.includes(p.status)) return false;
        let locMatch = false;
        if (!isLocationSelected()) {
          locMatch = true;
        } else {
          if (selectedWarehouse && p.location === "warehouse") locMatch = true;
          if (selectedGalleries.length > 0 && selectedGalleries.includes(p.location)) locMatch = true;
        }
        return locMatch;
      })
      .sort(sortFn);
  }, [products, search, statusFilter, selectedWarehouse, selectedGalleries, sortOrder]);

  const allProductsForLightbox = products.filter((p) => p.image);

  return (
    <div style={{ padding: "0 0 100px" }} dir="rtl">

      <div
        style={{
          position: "sticky",
          top: stickyTop,
          zIndex: 20,
          background: "#0a0a0a",
          padding: "6px 0 8px",
          marginBottom: 8,
          marginTop: 0,
          boxShadow: "0 12px 20px #0a0a0a, 0 -2px 0 #0a0a0a",
          borderBottom: "1px solid #141414",
        }}
      >
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", background: "#161616", border: "1px solid #232323", borderRadius: 8, padding: "6px 10px", gap: 6 }}>
            <Search size={13} color="#555" style={{ flexShrink: 0 }} />
            <input onFocus={(e) => e.target.select()}
              style={{ background: "transparent", border: "none", outline: "none", color: "#ddd", fontSize: 11, flex: 1, minWidth: 0, fontFamily: "inherit" }}
              placeholder="جستجو (نام، کد، ابعاد)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                style={{ background: "transparent", border: "none", color: "#888", cursor: "pointer", padding: "0 2px", display: "flex", alignItems: "center" }}
                onClick={() => setSearch("")}
              >
                <X size={13} />
              </button>
            )}
          </div>


          <div style={{ position: "relative" }}>
            <button
              style={{
                ...S.chip,
                padding: "6px 8px",
                fontSize: 10,
                position: "relative",
                background: statusFilter.length > 0 ? "#2a1414" : "#1c1c1c",
                border: statusFilter.length > 0 ? "1px solid #8B1A1A" : "1px solid #2a2a2a",
                color: statusFilter.length > 0 ? "#d88888" : "#888",
              }}
              onClick={() => setShowCatalogStatusMenu((v) => !v)}
              title="وضعیت"
            >
              <CheckCircle2 size={12} />
            </button>
            <FilterPopup open={showCatalogStatusMenu} onClose={() => setShowCatalogStatusMenu(false)} width={160}>
              {[
                { key: "__all__", label: "همه" },
                { key: "available", label: "موجود" },
                { key: "sold", label: "ناموجود" },
              ].map((opt) => {
                const isSelected = opt.key === "__all__" ? statusFilter.length === 0 : statusFilter.includes(opt.key);
                return (
                  <button
                    key={opt.key}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "right",
                      padding: "8px 10px",
                      background: isSelected ? "#2a1414" : "transparent",
                      border: "none",
                      color: isSelected ? "#d88888" : "#ddd",
                      fontSize: 11,
                      fontFamily: "inherit",
                      cursor: "pointer",
                      borderRadius: 4,
                    }}
                    onClick={() => {
                      if (opt.key === "__all__") { setStatusFilter([]); return; }
                      setStatusFilter((prev) => prev.includes(opt.key) ? prev.filter((k) => k !== opt.key) : [...prev, opt.key]);
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </FilterPopup>
          </div>
          <div style={{ position: "relative" }} ref={menuRef}>
            <button
              style={{
                ...S.chip,
                padding: "6px 10px",
                fontSize: 10,
                position: "relative",
                background: isLocationSelected() ? "#2a1414" : "#1c1c1c",
                border: isLocationSelected() ? "1px solid #8B1A1A" : "1px solid #2a2a2a",
                color: isLocationSelected() ? "#d88888" : "#888",
              }}
              onClick={() => setShowLocationMenu(!showLocationMenu)}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}><MapPin size={11} style={isLocationSelected() ? { marginLeft: 4 } : {}} /> {isLocationSelected() && getLocationLabel()}</div>
            </button>
            <FilterPopup open={showLocationMenu} onClose={() => setShowLocationMenu(false)} width={240} maxHeight={320}>
                <div
                  style={{
                    padding: "8px 10px",
                    fontSize: 11,
                    color: selectedWarehouse ? "#d88888" : "#ddd",
                    cursor: "pointer",
                    background: selectedWarehouse ? "#2a1414" : "transparent",
                    borderRadius: 4,
                    marginBottom: 2,
                  }}
                  onClick={toggleWarehouse}
                >
                  پیش خودم (انبار)
                </div>
                <div
                  style={{
                    padding: "8px 10px",
                    fontSize: 11,
                    color: selectedGalleries.length === galleryCustomers.length && galleryCustomers.length > 0 ? "#d88888" : "#555",
                    cursor: "pointer",
                    background: selectedGalleries.length === galleryCustomers.length && galleryCustomers.length > 0 ? "#2a1414" : "transparent",
                    borderRadius: 4,
                    marginBottom: 2,
                    opacity: galleryCustomers.length === 0 ? 0.5 : 1,
                  }}
                  onClick={galleryCustomers.length > 0 ? toggleAllGalleries : undefined}
                >
                  پیش گالری
                </div>
                {galleryCustomers.map((g) => {
                  const isSelected = selectedGalleries.includes(g.id);
                  return (
                    <div
                      key={g.id}
                      style={{
                        padding: "8px 10px 8px 20px",
                        fontSize: 11,
                        color: isSelected ? "#d88888" : "#ddd",
                        cursor: "pointer",
                        background: isSelected ? "#2a1414" : "transparent",
                        borderRadius: 4,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                      onClick={() => toggleGallery(g.id)}
                    >
                      <span
                        style={{
                          display: "inline-block",
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          background: g.color || "#888",
                          flexShrink: 0,
                        }}
                      />
                      {g.name}
                    </div>
                  );
                })}
                {galleryCustomers.length === 0 && (
                  <div style={{ padding: "6px", color: "#555", fontSize: 10 }}>هیچ گالری ثبت نشده</div>
                )}
                <button
                  style={{
                    display: "block",
                    width: "100%",
                    marginTop: 6,
                    padding: "4px 0",
                    background: "transparent",
                    border: "none",
                    borderTop: "1px solid #2a2a2a",
                    color: "#888",
                    fontSize: 10,
                    fontFamily: "inherit",
                    cursor: "pointer",
                    textAlign: "center",
                  }}
                  onClick={resetLocationFilter}
                >
                  ✕ پاک کردن فیلتر
                </button>
            </FilterPopup>
          </div>

          {(productTypes || []).length > 0 && (
            <div style={{ position: "relative" }}>
              <button
                title={(typeFilter || []).length > 0 ? (typeFilter || []).map((id) => productTypes.find((t) => t.id === id)?.name).filter(Boolean).join("، ") : "همه"}
                style={{
                  ...S.chip,
                  padding: "6px 10px",
                  fontSize: 10,
                  background: (typeFilter || []).length > 0 ? "#2a1414" : "#1c1c1c",
                  border: (typeFilter || []).length > 0 ? "1px solid #8B1A1A" : "1px solid #2a2a2a",
                  color: (typeFilter || []).length > 0 ? "#d88888" : "#888",
                }}
                onClick={() => setShowTypeFilterMenu((s) => !s)}
              >
                <Tag size={13} />
              </button>
              <FilterPopup open={showTypeFilterMenu} onClose={() => setShowTypeFilterMenu(false)} width={160}>
                  <button
                    style={{ display: "block", width: "100%", textAlign: "right", padding: "8px 8px", background: (typeFilter || []).length === 0 ? "#2a1414" : "transparent", border: "none", color: (typeFilter || []).length === 0 ? "#d88888" : "#ddd", fontSize: 11, fontFamily: "inherit", cursor: "pointer", borderRadius: 4 }}
                    onClick={() => setTypeFilter([])}
                  >
                    همه
                  </button>
                  {productTypes.map((t) => {
                    const isSelected = (typeFilter || []).includes(t.id);
                    return (
                      <button
                        key={t.id}
                        style={{ display: "block", width: "100%", textAlign: "right", padding: "8px 8px", background: isSelected ? "#2a1414" : "transparent", border: "none", color: isSelected ? "#d88888" : "#ddd", fontSize: 11, fontFamily: "inherit", cursor: "pointer", borderRadius: 4 }}
                        onClick={() => {
                          setTypeFilter((prev) => prev.includes(t.id) ? prev.filter((id) => id !== t.id) : [...prev, t.id]);
                          // پاپ‌آپ عمداً بسته نمی‌شه، فقط با کلیک بیرون بسته می‌شه (چند-انتخابیه)
                        }}
                      >
                        {t.name}
                      </button>
                    );
                  })}
              </FilterPopup>
            </div>
          )}

          <SortButton sortOrder={sortOrder} setSortOrder={setSortOrder} modes={SORT_MODES} style={{}} />
        </div>
      </div>

      <div
        className="grid grid-cols-2 landscape:grid-cols-3 xl:grid-cols-4"
        style={{ gap: 8 }}
      >
        {filtered.map((p, idx) => {
          const inBasket = basket?.some((b) => b.id === p.id) || false;
          const isSold = p.status === "sold";
          return (
            <div
              key={p.id}
              style={{
                background: "#161616",
                border: "1px solid #232323",
                borderRadius: 10,
                overflow: "hidden",
                position: "relative",
              }}
              onClick={() => setLightboxId(p.id)}
            >
              <div style={{ width: "100%", aspectRatio: "1 / 1", background: "#111", position: "relative" }}>
                {p.image ? (
                  <ProductImage
                    filename={p.image}
                    alt=""
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    loading={idx < 3 ? "eager" : "lazy"}
                  />
                ) : (
                  <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Package size={28} color="#333" />
                  </div>
                )}

                {!isSold && (
                  <button
                    style={{
                      position: "absolute",
                      bottom: 6,
                      left: 6,
                      background: "rgba(0,0,0,0.7)",
                      border: "none",
                      borderRadius: "50%",
                      width: 40,
                      height: 40,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (addToBasket) addToBasket(p);
                    }}
                  >
                    <Star size={22} color={inBasket ? "#f2c94c" : "#bbb"} fill={inBasket ? "#f2c94c" : "none"} />
                  </button>
                )}

                {isSold && (
                  <div style={{ position: "absolute", top: 6, right: 6, background: "rgba(139,26,26,0.85)", color: "#fff", fontSize: 8, padding: "2px 6px", borderRadius: 8 }}>
                    فروخته شد
                  </div>
                )}
              </div>
              <div style={{ padding: "8px 10px" }}>
                <div style={{ fontSize: 9, color: "#8B1A1A" }}>#{fmtCode(p.code)}</div>
                <div style={{ fontSize: 11, color: "#ddd", fontWeight: 500, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {p.name}
                </div>
                <div style={{ marginBottom: 2 }}>
                  <span style={{ fontSize: 9.5, color: "#666" }}>{formatProductDims(p)}{qtySuffix(p)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 4 }}>
                  {toNum(p.discountPercent) > 0 ? (
                    <>
                      <span style={{ fontSize: 8.5, color: "#e08a8a", textDecoration: "line-through" }}>{fmt(toNum(p.salePrice))}</span>
                      <span style={{ fontSize: 7.5, background: "#1d3a24", color: "#5fd180", borderRadius: 4, padding: "0 3px" }}>{p.discountPercent}٪</span>
                      {toNum(p.discountPercent) >= 100 ? (
                        <span style={{ fontSize: 9, background: "#3a1d33", color: "#f2a3e0", borderRadius: 4, padding: "1px 4px", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 2 }}><Gift size={9} /> هدیه</span>
                      ) : (
                        <span style={{ fontSize: 10.5, color: "#F5F0EB" }}>{fmt(toNum(p.discountedPrice ?? p.salePrice))} ت</span>
                      )}
                    </>
                  ) : (
                    <span style={{ fontSize: 10.5, color: "#F5F0EB" }}>{fmt(toNum(p.salePrice))} ت</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: "center", color: "#444", fontSize: 12, padding: "40px 0" }}>محصولی پیدا نشد</div>
      )}

      {lightboxId && (
        <ImageLightbox
          products={allProductsForLightbox.length ? allProductsForLightbox : products}
          currentId={lightboxId}
          onNavigate={setLightboxId}
          productTypes={productTypes || []}
          materials={materials || []}
          onClose={() => setLightboxId(null)}
          onAddToBasket={addToBasket}
          basket={basket}
        />
      )}

      {showBasket && (
        <BasketPanel
          basket={basket || []}
          customers={customers}
          onRemove={removeFromBasket}
          onConfirm={confirmPurchase}
          onTransfer={handleBatchTransfer}
          onClose={() => setShowBasket && setShowBasket(false)}
          allProducts={products}
          onAdd={addToBasket}
          businessCard={myBusinessCard}
        />
      )}
    </div>
  );
}

// ── ProductTab اصلی ──
export default function ProductTab({
  productTotals,
  groupedProducts,
  setData,
  customers,
  materials,
  productTypes,
  onRequestDelete,
  areaBatchCostByProduct,
  ratioByAreaCostByProduct,
  onLinkBatch,
  onUnlinkBatch,
  onUndeductLine,
  onUndeductWood,
  onImageUpload,
  nextCode,
  sortMode,
  setSortMode,
  sortOrder = "code",
  setSortOrder,
  notify,
  stickyTop = 88,
  onModalToggle,
  myBusinessCard,
  refreshResetTick,
}) {
  const [search, setSearch] = useState("");
  const [editingProduct, setEditingProduct] = useState(null);
  const [lightboxId, setLightboxId] = useState(null);
  const [basket, setBasket] = useState([]);
  const [showBasket, setShowBasket] = useState(false);
  const [filterStatus, setFilterStatus] = useState([]);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const toggleFilterStatus = (key) => {
    setFilterStatus((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]);
  };
  const [typeFilter, setTypeFilter] = useState([]); // چند-انتخابی: آرایه‌ی شناسه‌ی انواع؛ خالی = همه
  const [showTypeFilterMenu, setShowTypeFilterMenu] = useState(false);
  const [expandedProductId, setExpandedProductId] = useState(null);

  // Refresh (تک‌ضربه) → ریست کامل فیلترها/چیدمان تب محصولات به پیش‌فرض
  useEffect(() => {
    if (!refreshResetTick) return;
    setSearch("");
    setFilterStatus([]);
    setTypeFilter([]);
    setShowTypeFilterMenu(false);
    setShowStatusMenu(false);
    setCollapsedGroups({});
  }, [refreshResetTick]);

  useEffect(() => {
    if (onModalToggle) {
      onModalToggle(!!editingProduct || !!lightboxId || !!showBasket);
    }
  }, [editingProduct, lightboxId, showBasket, onModalToggle]);

  // دکمه‌ی Back گوشی: هرکدوم از این‌ها که باز باشه (به ترتیب اولویت بستن)،
  // با Back فقط همون بسته بشه
  useEffect(() => {
    if (!lightboxId) return;
    return pushBackHandler(() => setLightboxId(null));
  }, [lightboxId]);

  // اگه فرم محصول دیرتی باشه، دکمه‌ی Back سخت‌افزاری هم باید همون تاییدیه‌ی
  // «لغو کنید؟» رو نشون بده، نه این‌که مستقیم و بی‌سروصدا ببنده
  const productEditorCloseRef = useRef(null);
  useEffect(() => {
    if (!editingProduct) return;
    return pushBackHandler(() => {
      if (productEditorCloseRef.current) productEditorCloseRef.current();
      else setEditingProduct(null);
    });
  }, [editingProduct]);

  useEffect(() => {
    if (!showBasket) return;
    return pushBackHandler(() => setShowBasket(false));
  }, [showBasket]);

  const galleryCustomers = customers.filter((c) => c.kind === "gallery");

  const {
    selectedWarehouse,
    selectedGalleries,
    showLocationMenu,
    menuRef,
    toggleWarehouse,
    toggleGallery,
    toggleAllGalleries,
    isLocationSelected,
    getLocationLabel,
    resetLocationFilter,
    setShowLocationMenu,
  } = useLocationFilter(galleryCustomers);

  const groups = groupedProducts || {};

  const addToBasket = (p) => {
    const isAlreadyIn = basket.find((x) => x.id === p.id);
    setBasket((b) => isAlreadyIn ? b.filter((x) => x.id !== p.id) : [...b, p]);
    notify && notify(isAlreadyIn ? "از سبد حذف شد" : "به سبد افزوده شد");
  };
  const removeFromBasket = (id) => setBasket((b) => b.filter((x) => x.id !== id));

  const confirmPurchase = (items, customerName, settled = true, saleDate = null) => {
    setData((d) => {
      let customersList = [...(d.customers || [])];
      let custId = null;
      if (customerName.trim()) {
        const existing = customersList.find((c) => c.kind === "customer" && c.name.toLowerCase() === customerName.toLowerCase());
        if (existing) {
          custId = existing.id;
        } else {
          const nc = {
            id: uid(),
            name: customerName.trim(),
            phone: "",
            note: "",
            color: GALLERY_COLOR_PALETTE[customersList.length % GALLERY_COLOR_PALETTE.length],
            kind: "customer",
          };
          customersList = [...customersList, nc];
          custId = nc.id;
        }
      }
      const finalSaleDate = saleDate || todayISO();
      const ids = new Set(items.map((p) => p.id));
      const updatedProducts = d.products.map((p) =>
        ids.has(p.id) ? { ...p, status: "sold", saleDate: finalSaleDate, buyerName: customerName, buyerCustomerId: custId, location: custId || p.location, settled } : p
      );
      return { ...d, products: updatedProducts, customers: customersList };
    });
    setBasket([]);
    setShowBasket(false);
    notify && notify("عملیات فروش ثبت شد");
  };

  const handleBatchTransfer = (items, galleryId) => {
    setData((d) => {
      const ids = new Set(items.map((p) => p.id));
      return {
        ...d,
        products: d.products.map((p) => ids.has(p.id) ? { ...p, location: galleryId, status: "available", buyerCustomerId: null, buyerName: "", buyerPhone: "", transferDate: new Date().toISOString() } : p)
      };
    });
    setBasket([]);
    setShowBasket(false);
    notify && notify(`${items.length} قطعه به گالری منتقل شد`);
  };

  const handleSaveProduct = (prod) => {
    setData((d) => {
      const exists = d.products.some((p) => p.id === prod.id);
      const maxCode = d.products.reduce((m, p) => Math.max(m, toNum(p.code)), 0);
      let code = prod.code ?? (maxCode + 1);
      let customersList = [...(d.customers || [])];
      if (prod.buyerName?.trim()) {
        const name = prod.buyerName.trim();
        if (!prod.buyerCustomerId) {
          const ex = customersList.find((c) => c.kind === "customer" && c.name.toLowerCase() === name.toLowerCase());
          if (ex) {
            prod = { ...prod, buyerCustomerId: ex.id };
          } else {
            const nc = {
              id: uid(),
              name,
              phone: prod.buyerPhone || "",
              note: "",
              color: GALLERY_COLOR_PALETTE[customersList.length % GALLERY_COLOR_PALETTE.length],
              kind: "customer",
            };
            customersList = [...customersList, nc];
            prod = { ...prod, buyerCustomerId: nc.id };
          }
        }
      }

    // اگر فروخته شده است، موقعیت مکانی محصول را به شناسه خریدار تغییر می‌دهیم تا در لیست مشتری نمایش داده شود
    if (prod.status === "sold" && prod.buyerCustomerId) {
      prod.location = prod.buyerCustomerId;
    } else if (prod.status === "available" && prod.location && !customersList.find(c => c.id === prod.location && c.kind === "gallery")) {
      // اگر از حالت فروخته شده به موجود برگشت و لوکیشن هنوز مشتری بود، به انبار برگردد
      if (!customersList.find(c => c.id === prod.location && c.kind === "gallery")) {
         prod.location = "warehouse";
      }
    }

      if (exists) {
        return { ...d, customers: customersList, products: d.products.map((p) => (p.id === prod.id ? { ...prod, code } : p)) };
      }
      return { ...d, customers: customersList, products: [...d.products, { ...prod, code }] };
    });
    setEditingProduct(null);
    notify && notify("محصول ذخیره شد");
  };

  const handleReturnToAvailable = (productId) => {
    setData((d) => ({
      ...d,
      products: d.products.map((p) =>
        p.id === productId ? { ...p, status: "available", settled: false, saleDate: null, settleDate: null, buyerCustomerId: null, buyerName: "", buyerPhone: "" } : p
      ),
    }));
    notify && notify("محصول به موجودی برگشت");
  };

  const handleToggleHideFromCatalog = (productId) => {
    setData((d) => ({
      ...d,
      products: d.products.map((p) =>
        p.id === productId ? { ...p, hiddenFromCatalog: !p.hiddenFromCatalog } : p
      ),
    }));
    const product = (productTotals || []).find((p) => p.id === productId);
    notify && notify(product && !product.hiddenFromCatalog ? "از کاتالوگ عمومی مخفی شد" : "توی کاتالوگ عمومی نمایش داده می‌شه");
  };

  const handleMoveToGallery = (productId, galleryId) => {
    setData((d) => ({
      ...d,
      products: d.products.map((p) =>
        p.id === productId ? { ...p, location: galleryId } : p
      ),
    }));
    notify && notify("محصول به گالری منتقل شد");
  };

  const productListForLightbox = Object.values(groups).flat().filter((p) => p.image);

  const filterFn = (p) => {
    if (search.trim() && !p.name?.includes(search) && !String(p.code).includes(search) && !(p.dims && p.dims.includes(search)))
      return false;
    const activeFilters = ((filterStatus || []).length === 0 || (filterStatus || []).length >= 3) ? [] : filterStatus;
    if (activeFilters.length > 0) {
      const matchesAny = activeFilters.some((key) => {
        if (key === "available") return p.status === "available";
        if (key === "unsettled") return p.status === "sold" && !p.settled;
        if (key === "settled") return p.status === "sold" && !!p.settled;
        return false;
      });
      if (!matchesAny) return false;
    }
    if ((typeFilter || []).length > 0 && !(typeFilter || []).includes(p.productTypeId)) return false;
    let locMatch = false;
    if (!isLocationSelected()) {
      locMatch = true;
    } else {
      if (selectedWarehouse && p.location === "warehouse") locMatch = true;
      if (selectedGalleries.length > 0 && selectedGalleries.includes(p.location)) locMatch = true;
    }
    return locMatch;
  };

  const [collapsedGroups, setCollapsedGroups] = useState({});
  const toggleGroup = (name) => setCollapsedGroups(prev => ({ ...prev, [name]: !prev[name] }));
  const [floatingCatLabel, setFloatingCatLabel] = useState("");
  const groupSectionRefs = useRef({});
  const [groupedView, setGroupedView] = useState(() => {
    try {
      return localStorage.getItem("product_grouped_view") !== "false"; // پیش‌فرض روشن
    } catch (_) {
      return true;
    }
  });
  const toggleGroupedView = () => {
    const next = !groupedView;
    setGroupedView(next);
    try {
      localStorage.setItem("product_grouped_view", String(next));
    } catch (_) {}
  };

  // لیبل شناور دسته (فرش) هنگام اسکرول — همون منطق تب متریال
  useEffect(() => {
    if (!groupedView) { setFloatingCatLabel(""); return; }
    const onScroll = () => {
      const panelEl = document.querySelector('div[style*="position: fixed"]');
      const scrollY = panelEl ? panelEl.scrollTop : (window.scrollY || document.documentElement.scrollTop || 0);
      if (scrollY <= 0) { setFloatingCatLabel(""); return; }

      const entries = Object.entries(groupSectionRefs.current || {});
      const headerBottom = (typeof stickyTop !== "undefined" ? stickyTop : 88) + 96;
      let current = "";
      let best = -Infinity;
      for (const [name, el] of entries) {
        if (!el) continue;
        const top = el.getBoundingClientRect().top;
        if (top < headerBottom && top > best) { best = top; current = name; }
      }
      if (current) {
        const el = groupSectionRefs.current[current];
        const top = el ? el.getBoundingClientRect().top : -Infinity;
        if (top >= headerBottom) current = "";
      }
      setFloatingCatLabel(current);
    };
    window.addEventListener("scroll", onScroll, true);
    document.addEventListener("scroll", onScroll, true);
    const panel = document.querySelector('div[style*="position: fixed"]');
    if (panel) panel.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    const t = setInterval(onScroll, 400);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      document.removeEventListener("scroll", onScroll, true);
      if (panel) panel.removeEventListener("scroll", onScroll);
      clearInterval(t);
    };
  }, [groupedView, stickyTop]);

  // Refresh (تک‌ضربه) → ریست کامل‌تر مرتب‌سازی + حالت گروه‌بندی + نمای گروهی
  useEffect(() => {
    if (!refreshResetTick) return;
    if (setSortOrder) setSortOrder("code");
    if (setSortMode) setSortMode("code");
    setGroupedView(true);
    try { localStorage.setItem("product_grouped_view", "true"); } catch (_) {}
  }, [refreshResetTick]);

  return (
    <div style={{ padding: "0 0 100px 0" }} dir="rtl">
      <div
        style={{
          position: "sticky",
          top: stickyTop,
          zIndex: 8,
          background: "#0a0a0a",
          boxShadow: "0 8px 16px #0a0a0a",
          borderBottom: "1px solid #0a0a0a",
          padding: "8px 0 12px",
          marginBottom: 12,
        }}
      >
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", background: "#161616", border: "1px solid #232323", borderRadius: 8, padding: "6px 10px", gap: 6 }}>
            <Search size={13} color="#555" style={{ flexShrink: 0 }} />
            <input onFocus={(e) => e.target.select()}
              style={{ background: "transparent", border: "none", outline: "none", color: "#ddd", fontSize: 11, flex: 1, minWidth: 0, fontFamily: "inherit" }}
              placeholder="جستجو (نام، کد، ابعاد)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                style={{ background: "transparent", border: "none", color: "#888", cursor: "pointer", padding: "0 2px", display: "flex", alignItems: "center" }}
                onClick={() => setSearch("")}
              >
                <X size={13} />
              </button>
            )}
          </div>


          <div style={{ position: "relative" }}>
            <button
              style={{
                ...S.chip,
                padding: "6px 8px",
                fontSize: 10,
                position: "relative",
                background: ((filterStatus || []).length > 0 && (filterStatus || []).length < 3) ? "#2a1414" : "#1c1c1c",
                border: ((filterStatus || []).length > 0 && (filterStatus || []).length < 3) ? "1px solid #8B1A1A" : "1px solid #2a2a2a",
                color: ((filterStatus || []).length > 0 && (filterStatus || []).length < 3) ? "#d88888" : "#888",
              }}
              onClick={() => setShowStatusMenu((v) => !v)}
              title="وضعیت"
            >
              <CheckCircle2 size={12} />
            </button>
            <FilterPopup open={showStatusMenu} onClose={() => setShowStatusMenu(false)} width={170}>
              {(() => {
                const isAllActive = (filterStatus || []).length === 0 || (filterStatus || []).length >= 3;
                return [
                  { key: "__all__", label: "همه" },
                  { key: "available", label: "موجود" },
                  { key: "settled", label: "تسویه‌شده" },
                  { key: "unsettled", label: "تسویه‌نشده" },
                ].map((opt) => {
                  const isSelected = opt.key === "__all__" ? isAllActive : !isAllActive && (filterStatus || []).includes(opt.key);
                  return (
                    <button
                      key={opt.key}
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "right",
                        padding: "8px 10px",
                        background: isSelected ? "#2a1414" : "transparent",
                        border: "none",
                        color: isSelected ? "#d88888" : "#ddd",
                        fontSize: 11,
                        fontFamily: "inherit",
                        cursor: "pointer",
                        borderRadius: 4,
                      }}
                      onClick={() => {
                        if (opt.key === "__all__") { setFilterStatus([]); return; }
                        toggleFilterStatus(opt.key);
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                });
              })()}
            </FilterPopup>
          </div>
          <div style={{ position: "relative" }} ref={menuRef}>
            <button
              style={{
                ...S.chip,
                padding: "6px 10px",
                fontSize: 10,
                position: "relative",
                background: isLocationSelected() ? "#2a1414" : "#1c1c1c",
                border: isLocationSelected() ? "1px solid #8B1A1A" : "1px solid #2a2a2a",
                color: isLocationSelected() ? "#d88888" : "#888",
              }}
              onClick={() => setShowLocationMenu(!showLocationMenu)}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}><MapPin size={11} style={isLocationSelected() ? { marginLeft: 4 } : {}} /> {isLocationSelected() && getLocationLabel()}</div>
            </button>
            <FilterPopup open={showLocationMenu} onClose={() => setShowLocationMenu(false)} width={240} maxHeight={320}>
                <div
                  style={{
                    padding: "8px 10px",
                    fontSize: 11,
                    color: selectedWarehouse ? "#d88888" : "#ddd",
                    cursor: "pointer",
                    background: selectedWarehouse ? "#2a1414" : "transparent",
                    borderRadius: 4,
                    marginBottom: 2,
                  }}
                  onClick={toggleWarehouse}
                >
                  پیش خودم (انبار)
                </div>
                <div
                  style={{
                    padding: "8px 10px",
                    fontSize: 11,
                    color: selectedGalleries.length === galleryCustomers.length && galleryCustomers.length > 0 ? "#d88888" : "#555",
                    cursor: "pointer",
                    background: selectedGalleries.length === galleryCustomers.length && galleryCustomers.length > 0 ? "#2a1414" : "transparent",
                    borderRadius: 4,
                    marginBottom: 2,
                    opacity: galleryCustomers.length === 0 ? 0.5 : 1,
                  }}
                  onClick={galleryCustomers.length > 0 ? toggleAllGalleries : undefined}
                >
                  پیش گالری
                </div>
                {galleryCustomers.map((g) => {
                  const isSelected = selectedGalleries.includes(g.id);
                  return (
                    <div
                      key={g.id}
                      style={{
                        padding: "8px 10px 8px 20px",
                        fontSize: 11,
                        color: isSelected ? "#d88888" : "#ddd",
                        cursor: "pointer",
                        background: isSelected ? "#2a1414" : "transparent",
                        borderRadius: 4,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                      onClick={() => toggleGallery(g.id)}
                    >
                      <span
                        style={{
                          display: "inline-block",
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          background: g.color || "#888",
                          flexShrink: 0,
                        }}
                      />
                      {g.name}
                    </div>
                  );
                })}
                {galleryCustomers.length === 0 && (
                  <div style={{ padding: "6px", color: "#555", fontSize: 10 }}>هیچ گالری ثبت نشده</div>
                )}
                <button
                  style={{
                    display: "block",
                    width: "100%",
                    marginTop: 6,
                    padding: "4px 0",
                    background: "transparent",
                    border: "none",
                    borderTop: "1px solid #2a2a2a",
                    color: "#888",
                    fontSize: 10,
                    fontFamily: "inherit",
                    cursor: "pointer",
                    textAlign: "center",
                  }}
                  onClick={resetLocationFilter}
                >
                  ✕ پاک کردن فیلتر
                </button>
            </FilterPopup>
          </div>

          {(productTypes || []).length > 0 && (
            <div style={{ position: "relative" }}>
              <button
                title={(typeFilter || []).length > 0 ? (typeFilter || []).map((id) => productTypes.find((t) => t.id === id)?.name).filter(Boolean).join("، ") : "همه"}
                style={{
                  ...S.chip,
                  padding: "6px 10px",
                  fontSize: 10,
                  background: (typeFilter || []).length > 0 ? "#2a1414" : "#1c1c1c",
                  border: (typeFilter || []).length > 0 ? "1px solid #8B1A1A" : "1px solid #2a2a2a",
                  color: (typeFilter || []).length > 0 ? "#d88888" : "#888",
                }}
                onClick={() => setShowTypeFilterMenu((s) => !s)}
              >
                <Tag size={13} />
              </button>
              <FilterPopup open={showTypeFilterMenu} onClose={() => setShowTypeFilterMenu(false)} width={160}>
                  <button
                    style={{ display: "block", width: "100%", textAlign: "right", padding: "8px 8px", background: (typeFilter || []).length === 0 ? "#2a1414" : "transparent", border: "none", color: (typeFilter || []).length === 0 ? "#d88888" : "#ddd", fontSize: 11, fontFamily: "inherit", cursor: "pointer", borderRadius: 4 }}
                    onClick={() => setTypeFilter([])}
                  >
                    همه
                  </button>
                  {productTypes.map((t) => {
                    const isSelected = (typeFilter || []).includes(t.id);
                    return (
                      <button
                        key={t.id}
                        style={{ display: "block", width: "100%", textAlign: "right", padding: "8px 8px", background: isSelected ? "#2a1414" : "transparent", border: "none", color: isSelected ? "#d88888" : "#ddd", fontSize: 11, fontFamily: "inherit", cursor: "pointer", borderRadius: 4 }}
                        onClick={() => {
                          setTypeFilter((prev) => prev.includes(t.id) ? prev.filter((id) => id !== t.id) : [...prev, t.id]);
                          // پاپ‌آپ عمداً بسته نمی‌شه، فقط با کلیک بیرون بسته می‌شه (چند-انتخابیه)
                        }}
                      >
                        {t.name}
                      </button>
                    );
                  })}
              </FilterPopup>
            </div>
          )}

          <SortButton
            sortOrder={sortOrder}
            setSortOrder={setSortOrder}
            modes={SORT_MODES}
            style={{}}
            groupedView={groupedView}
            onToggleGrouped={toggleGroupedView}
            groupByTypeActive={groupedView && sortMode === "type"}
            onGroupByType={() => {
              if (setSortMode) setSortMode("type");
              if (!groupedView) toggleGroupedView();
            }}
          />
          <button
            style={{
              ...S.chip,
              padding: "7px 10px",
              position: "relative",
              background: basket.length > 0 ? "#2a1414" : "#1c1c1c",
              border: basket.length > 0 ? "1px solid #8B1A1A" : "1px solid #2a2a2a",
            }}
            onClick={() => setShowBasket(true)}
          >
            <ShoppingBag size={13} />
            {basket.length > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: -4,
                  right: -4,
                  background: "#8B1A1A",
                  color: "#fff",
                  fontSize: 8,
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {basket.length}
              </span>
            )}
          </button>
        </div>

        {groupedView && floatingCatLabel ? (
          <div
            onClick={() => {
              const el = groupSectionRefs.current[floatingCatLabel];
              if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            style={{
              marginTop: 8,
              zIndex: 14,
              width: "fit-content",
              maxWidth: "70%",
              minHeight: 28,
              height: 28,
              background: "rgba(40,40,40,0.92)",
              color: "#bbb",
              fontSize: 10,
              padding: "0 14px",
              borderRadius: 12,
              pointerEvents: "auto",
              textAlign: "center",
              backdropFilter: "blur(4px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid #2a2a2a",
              boxSizing: "border-box",
              marginRight: "auto",
              marginLeft: "auto",
            }}
          >
            {floatingCatLabel}
          </div>
        ) : null}
      </div>

      {groupedView ? (
        <>
          {Object.entries(groups)
            .sort(([a], [b]) => {
              if (a === "در دست ساخت") return 1;
              if (b === "در دست ساخت") return -1;
              if (a === "بدون فرش") return 1;
              if (b === "بدون فرش") return -1;
              if (a === "بدون دسته") return 1;
              if (b === "بدون دسته") return -1;
              if (a === "بدون نوع") return 1;
              if (b === "بدون نوع") return -1;
              if (sortMode === "fabric" || sortMode === "code" || sortMode === "type") return 0; // ترتیب از قبل بر اساس کمترین کد محصول در groupedProducts محاسبه شده
              return a.localeCompare(b, "fa");
            })
            .map(([groupName, prods]) => {
            const filteredProds = prods.filter(filterFn);
            if (!filteredProds.length) return null;
            const isCollapsed = collapsedGroups[groupName];
            return (
              <div key={groupName} style={{ marginBottom: 4 }}>
                <GroupHeader
                  title={groupName}
                  count={filteredProds.length}
                  isOpen={!isCollapsed}
                  onToggle={() => toggleGroup(groupName)}
                  sectionRef={(el) => {
                    if (el) groupSectionRefs.current[groupName] = el;
                    else delete groupSectionRefs.current[groupName];
                  }}
                />
                {!isCollapsed && filteredProds.map((p) => (
                  <ProductCard
                    key={p.id}
                    p={p}
                    customers={customers}
                    materials={materials}
                    expanded={expandedProductId === p.id}
                    onEdit={setEditingProduct}
                    onDelete={onRequestDelete}
                    onImageUpload={onImageUpload}
                    onOpenLightbox={setLightboxId}
                    onToggleExpand={(id) => setExpandedProductId((prev) => {
                      const next = prev === id ? null : id;
                      return next;
                    })}
                    onSetStatus={(id, status, opts = {}) =>
                      setData((d) => ({
                        ...d,
                        products: d.products.map((pp) => {
                          if (pp.id !== id) return pp;
                          if (status === "draft") return { ...pp, status: "draft", location: "warehouse", isDraft: true };
                          if (status === "built") return { ...pp, status: "available", location: "warehouse", isDraft: false };
                          if (status === "available") {
                            const location = opts.clearLocation ? "warehouse" : pp.location;
                            return { ...pp, status: "available", settled: false, location, isDraft: false, buyerCustomerId: null, buyerName: "", buyerPhone: "" };
                          }
                          if (status === "sold") {
                            const loc = pp.buyerCustomerId || pp.location;
                            return { ...pp, status: "sold", saleDate: pp.saleDate || todayISO(), location: loc };
                          }
                          if (status === "settled") {
                            const loc = pp.buyerCustomerId || pp.location;
                            return { ...pp, status: "sold", settled: true, settleDate: todayISO(), location: loc };
                          }
                          if (status === "unsettled") {
                            const loc = pp.buyerCustomerId || pp.location;
                            return { ...pp, status: "sold", settled: false, location: loc };
                          }
                          return pp;
                        }),
                      }))
                    }
                    onReturnToAvailable={handleReturnToAvailable}
                    onToggleHideFromCatalog={handleToggleHideFromCatalog}
                    onMoveToGallery={handleMoveToGallery}
                  />
                ))}
              </div>
            );
          })}
        </>
      ) : (
        <div>
          {(() => {
            const baseSort = String(sortOrder || "").replace(/_desc$/, "");
            const isDesc = String(sortOrder || "").endsWith("_desc");
            const flatCmp = (a, b) => {
              if (!!a.isDraft !== !!b.isDraft) return a.isDraft ? 1 : -1;
              let cmp;
              if (baseSort === "az") cmp = a.name.localeCompare(b.name, "fa");
              else if (baseSort === "date") {
                const da = a.saleDate || a.settleDate, db = b.saleDate || b.settleDate;
                if (da && db) cmp = db.localeCompare(da);
                else if (da) cmp = -1;
                else if (db) cmp = 1;
                else cmp = toNum(b.code) - toNum(a.code);
              } else if (baseSort === "stock") {
                cmp = (b.status === "sold" ? 0 : 1) - (a.status === "sold" ? 0 : 1);
              } else {
                cmp = toNum(a.code) - toNum(b.code);
              }
              return isDesc ? -cmp : cmp;
            };
            const flatProds = Object.values(groups).flat().filter(filterFn).sort(flatCmp);
            if (!flatProds.length) return <div style={{ fontSize: 10.5, color: "#444", padding: "16px 0", textAlign: "center" }}>آیتمی وجود ندارد</div>;
            return flatProds.map((p) => (
              <ProductCard
                key={p.id}
                p={p}
                customers={customers}
                materials={materials}
                expanded={expandedProductId === p.id}
                onEdit={setEditingProduct}
                onDelete={onRequestDelete}
                onImageUpload={onImageUpload}
                onOpenLightbox={setLightboxId}
                onToggleExpand={(id) => setExpandedProductId((prev) => {
                  const next = prev === id ? null : id;
                  return next;
                })}
                onSetStatus={(id, status, opts = {}) =>
                  setData((d) => ({
                    ...d,
                    products: d.products.map((pp) => {
                      if (pp.id !== id) return pp;
                      if (status === "draft") return { ...pp, status: "draft", location: "warehouse", isDraft: true };
                      if (status === "built") return { ...pp, status: "available", location: "warehouse", isDraft: false };
                      if (status === "available") {
                        const location = opts.clearLocation ? "warehouse" : pp.location;
                        return { ...pp, status: "available", settled: false, location, isDraft: false, buyerCustomerId: null, buyerName: "", buyerPhone: "" };
                      }
                      if (status === "sold") {
                        const loc = pp.buyerCustomerId || pp.location;
                        return { ...pp, status: "sold", saleDate: pp.saleDate || todayISO(), location: loc };
                      }
                      if (status === "settled") {
                        const loc = pp.buyerCustomerId || pp.location;
                        return { ...pp, status: "sold", settled: true, settleDate: todayISO(), location: loc };
                      }
                      if (status === "unsettled") {
                        const loc = pp.buyerCustomerId || pp.location;
                        return { ...pp, status: "sold", settled: false, location: loc };
                      }
                      return pp;
                    }),
                  }))
                }
                onReturnToAvailable={handleReturnToAvailable}
                    onToggleHideFromCatalog={handleToggleHideFromCatalog}
                onMoveToGallery={handleMoveToGallery}
              />
            ));
          })()}
        </div>
      )}

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
        onClick={() => setEditingProduct({ ...emptyProduct(), code: null })}
      >
        <Plus size={22} />
      </button>

      {editingProduct && (
        <ProductEditor
          product={editingProduct}
          materials={materials || []}
          customers={customers || []}
          onSave={handleSaveProduct}
          onClose={() => setEditingProduct(null)}
          closeRequestRef={productEditorCloseRef}
          nextCode={nextCode || 1}
          onLinkBatch={onLinkBatch}
          onUnlinkBatch={onUnlinkBatch}
          areaBatchCostByProduct={areaBatchCostByProduct}
          ratioByAreaCostByProduct={ratioByAreaCostByProduct}
          onUndeductLine={onUndeductLine}
          onUndeductWood={onUndeductWood}
          productTypes={productTypes || []}
          setData={setData}
          products={productTotals || []}
        />
      )}

      {lightboxId && (
        <ImageLightbox
          products={productListForLightbox.length ? productListForLightbox : Object.values(groups).flat()}
          currentId={lightboxId}
          onNavigate={setLightboxId}
          productTypes={productTypes || []}
          materials={materials || []}
          onClose={() => setLightboxId(null)}
          onAddToBasket={addToBasket}
          basket={basket}
        />
      )}

      {showBasket && (
        <BasketPanel
          basket={basket}
          onRemove={removeFromBasket}
          onConfirm={confirmPurchase}
          onTransfer={handleBatchTransfer}
          onClose={() => setShowBasket(false)}
          customers={customers}
          allProducts={productTotals}
          onAdd={addToBasket}
          businessCard={myBusinessCard}
        />
      )}
    </div>
  );
}

function GroupHeader({ title, count, isOpen, onToggle, sectionRef }) {
  return (
    <button
      ref={sectionRef}
      style={{
        width: "100%",
        background: "transparent",
        border: "none",
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 2px",
        cursor: "pointer",
        marginBottom: 4,
      }}
      onClick={onToggle}
    >
      <span style={{ fontSize: 10.5, color: "#666", fontWeight: 600 }}>{title}</span>
      <span style={{ fontSize: 9, color: "#444", background: "#1a1a1a", borderRadius: 8, padding: "1px 6px" }}>{count}</span>
      <span style={{ marginRight: "auto" }}>{isOpen ? <ChevronUp size={12} color="#444" /> : <ChevronDown size={12} color="#444" />}</span>
    </button>
  );
}