// ============================================================
// MaterialTab.jsx - Refarsh Clean (نسخه نهایی با Bulk Apply کامل)
// ============================================================
import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Plus, Search, Edit3, Trash2, ChevronDown, ChevronUp,
  Eye, EyeOff, Lock, Unlock, X, RotateCcw, Package, CheckCircle2, Clock, ShoppingBag, Tag
} from "lucide-react";
import { toNum, fmt, fmtDate, todayISO, getProductArea } from "../mathCore";
import { emptyMaterial, emptyBatch, emptyStick, uid } from "../dataModels";
import { formatPriceInput, parsePriceInput } from "../utils/formatters";
import { pushBackHandler } from "../utils/backButton";
import { usePendingChanges } from "../contexts/PendingChangesContext";
import { useToast } from "../contexts/ToastContext.jsx";
import { useRegisterOpenModal } from "../utils/modalRegistry";

import { JalaliDatePicker } from "./JalaliDatePicker";
import { FilterPopup } from "./FilterPopup";

const S = {
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
  chip: {
    background: "#1c1c1c",
    border: "1px solid #2a2a2a",
    color: "#888",
    fontSize: 10,
    padding: "6px 9px",
    borderRadius: 12,
    cursor: "pointer",
    fontFamily: "inherit",
    whiteSpace: "nowrap",
    minHeight: 32,
    height: 32,
    boxSizing: "border-box",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
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
  matCard: {
    background: "#161616",
    border: "1px solid #232323",
    borderRadius: 9,
    marginBottom: 7,
    overflow: "hidden",
  },
  sectionTitle: {
    fontSize: 10,
    color: "#666",
    fontWeight: 600,
    letterSpacing: 1,
    textTransform: "uppercase",
    padding: "14px 0 6px",
  },
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.85)",
    zIndex: 110,
    display: "flex",
    flexDirection: "column",
  },
  sheet: {
    width: "100%",
    maxWidth: 520,
    margin: "0 auto",
    background: "#141414",
    borderRadius: "16px 16px 0 0",
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflowY: "auto",
    marginTop: "auto",
  },
  sheetHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "12px 14px 10px",
    borderBottom: "1px solid #232323",
    position: "sticky",
    top: 0,
    background: "#141414",
    zIndex: 10,
  },
};

// ── ثابت‌های مرتب‌سازی ──
const SORT_MODES = [
  { key: "az", kind: "text", ascText: "Az", descText: "Za" },
  { key: "date", kind: "icon", Icon: Clock },
  { key: "stock", kind: "icon", Icon: ShoppingBag },
  { key: "code", kind: "text", ascText: "123", descText: "321" },
];

function cycleSort(current) {
  const base = String(current || "").replace(/_desc$/, "");
  const keys = SORT_MODES.map((m) => m.key);
  const idx = keys.indexOf(base);
  return keys[(idx + 1) % keys.length];
}

function SortButton({ sortOrder, setSortOrder, modes, style, groupedView, onToggleGrouped }) {
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

  // مثل GalleryTab: به‌جای آیکون عمومی ⇅ + برچسب + فلش جدا، خودِ متن/آیکون جهت رو نشون می‌ده
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
              دسته‌بندی‌شده
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
              یکجا (لیست ساده)
            </button>
            <div style={{ borderTop: "1px solid #2a2a2a", margin: "4px 0" }} />
          </>
        )}
        {modes.map((mode) => (
          <button
            key={mode.key}
            style={{
              display: "block",
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
          </button>
        ))}
      </FilterPopup>
    </div>
  );
}

// ── هوک سفارشی مدیریت فیلتر موجودی ──
function useStockFilter() {
  const [stockFilter, setStockFilter] = useState("all");
  const [showStockMenu, setShowStockMenu] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowStockMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getStockLabel = () => {
    if (stockFilter === "all") return "همه";
    if (stockFilter === "available") return "موجود";
    if (stockFilter === "finished") return "تمام‌شده";
    return "همه";
  };

  return {
    stockFilter,
    setStockFilter,
    showStockMenu,
    setShowStockMenu,
    menuRef,
    getStockLabel,
  };
}

// ── BulkApplyMaterialPage (بازنویسی کامل با منطق هوشمند و بدون چک‌باکس) ──
export function BulkApplyMaterialPage({ material, products = [], allMaterials = [], setData, onApply, onClose }) {
  useRegisterOpenModal(true);
  if (!products || !Array.isArray(products) || products.length === 0) {
    return (
      <div style={S.overlay}>
        <div style={S.sheet}>
          <div style={S.sheetHeader}>
            <button style={S.iconBtn} onClick={onClose}>
              <X size={14} color="#aaa" />
            </button>
            <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#F5F0EB" }}>
              تخصیص «{material.name}» به محصولات
            </span>
          </div>
          <div style={{ padding: "20px", textAlign: "center", color: "#888" }}>
            {products && products.length === 0 ? "هیچ محصولی برای تخصیص وجود ندارد" : "خطا در بارگذاری محصولات"}
          </div>
        </div>
      </div>
    );
  }

  const isAreaType = material.type === "area" || material.type === "fabric";
  const isRatioType = material.type === "ratio" || material.type === "fixed";

  // کلید یکتای سشن برای یک لاین‌آیتم قفل‌شده — اگر bulkSessionId نداشته باشد (آیتم‌های قدیمی)
  // بر اساس تاریخ قفل شدنش گروه‌بندی می‌شود. این تابع باید همه‌جا (نمایش، ویرایش درصد، حذف) یکسان استفاده شود.
  const getSessionKey = (li) => li.bulkSessionId || `legacy-${li.deductedAt}`;

  const getProductAreaSafe = (p) => {
    let area = getProductArea(p);
    if (area <= 0) area = 1;
    return area;
  };

  const initialLinked = products.filter((p) =>
    (p.lineItems || []).some((li) => li.materialId === material.id && !li.deductedAt)
  );

  // محصولاتی که قبلاً برای این متریال قفل شده‌اند — این‌ها دیگر در استخر ۱۰۰٪ اصلی شرکت نمی‌کنند
  // و هرکدام فقط داخل «سشن» قفل‌شده‌ی خودشان قابل تنظیم هستند
  const lockedLinked = products.filter((p) =>
    (p.lineItems || []).some((li) => li.materialId === material.id && li.deductedAt && !li.pendingUnlock)
  );
  const lockedSessions = useMemo(() => {
    const groups = {};
    lockedLinked.forEach((p) => {
      const li = (p.lineItems || []).find(l => l.materialId === material.id && l.deductedAt && !l.pendingUnlock);
      if (!li) return;
      const key = getSessionKey(li);
      if (!groups[key]) groups[key] = [];
      groups[key].push({ product: p, li });
    });
    return Object.entries(groups).map(([sessionId, items]) => ({ sessionId, items }));
  }, [lockedLinked, material.id]);

  // ── وضعیت‌ها ──
  const [allocatedRemainingPct, setAllocatedRemainingPct] = useState(() => {
    if (initialLinked.length === 0) return 100;
    let sum = 0;
    initialLinked.forEach(p => {
      const li = (p.lineItems || []).find(l => l.materialId === material.id);
      sum += toNum(li?.customPct ?? li?.pct ?? 0);
    });
    return sum > 0 ? Math.min(100, Math.round(sum)) : 100;
  });

  // بخش جدید: برای متریال‌های شمارشی (ثابت/نسبتی)، «چند واحد از کل تعداد» می‌خوایم
  // استفاده کنیم. قبلاً یه state جدا (quantitySelected) بود که هیچ‌جا رندر
  // نمی‌شد (فیلدش اصلاً وجود نداشت، پس «قابل تایپ نبود» چون اصلاً نبود) و
  // quantityFraction محاسبه‌شده‌ش هم هیچ‌جا استفاده نمی‌شد. الان به‌جاش از
  // همون allocatedRemainingPct (که کل منطق هزینه/درصد بقیه‌ی این ماژول رو
  // هدایت می‌کنه) مشتق می‌شه تا دو منبع حقیقت جدا نداشته باشیم؛ فیلد تعداد
  // فقط یه رابط تایپی جایگزین برای همون درصده
  const isRatioTypeMaterial = material.type === "ratio" || material.type === "fixed";
  // باگ واقعی بود: اینجا از material.totalQty (کل تاریخیِ همیشه‌خریداری‌شده)
  // استفاده می‌شد، نه remainingQty (چیزی که *الان* واقعاً در دسترسه). برای
  // متریالی که قبلاً بخشی‌ش مصرف/قفل شده، این باعث می‌شد «تعداد» پیش‌فرض و
  // حداکثرش اشتباه (بیشتر از واقعیت) نشون داده بشه
  const materialTotalQty = toNum(material.remainingQty != null ? material.remainingQty : material.totalQty) || 1;
  const quantitySelected = isRatioTypeMaterial
    ? Math.round((allocatedRemainingPct / 100) * materialTotalQty)
    : materialTotalQty;
  const handleQuantitySelectedChange = (val) => {
    const q = Math.max(0, Math.min(materialTotalQty, toNum(val)));
    const pct = materialTotalQty > 0 ? Math.round((q / materialTotalQty) * 100) : 0;
    handleAllocatedRemainingPctChange(String(pct));
  };

  const [selectedIds, setSelectedIds] = useState(() => {
    return initialLinked.map((p) => p.id);
  });

  const [distributionMode, setDistributionMode] = useState(() => {
    if (initialLinked.length > 0) {
      // اگه همه‌ی لینک‌های قبلی با یه حالت توزیع مشخص (مساوی/نسبت‌مساحت) ذخیره شده بودن، همونو یادآوری کن
      const modes = new Set();
      initialLinked.forEach(p => {
        const li = (p.lineItems || []).find(l => l.materialId === material.id);
        if (li?.distributionMode) modes.add(li.distributionMode);
      });
      if (modes.size === 1) return [...modes][0];
      return "manual";
    }
    // برای انواع مساحتی/فرش/خطی/نسبتی، پیش‌فرض منطقی‌تر توزیع بر اساس نسبت
    // مساحت واقعی محصولاته، نه تقسیم مساوی؛ فقط برای نوع ابزار/ثابت (که
    // مساحت معنی نداره) توزیع مساوی پیش‌فرض می‌مونه
    const usesAreaRatio = material.type === "area" || material.type === "fabric" || material.type === "linear" || material.type === "ratio";
    return usesAreaRatio ? "area" : "equal";
  });

  const [productSubBudgetPcts, setProductSubBudgetPcts] = useState(() => {
    if (initialLinked.length === 0) return {};
    let pcts = {};
    let totalSum = 0;
    initialLinked.forEach(p => {
      const li = (p.lineItems || []).find(l => l.materialId === material.id);
      const pct = toNum(li?.customPct ?? li?.pct ?? 0);
      pcts[p.id] = pct;
      totalSum += pct;
    });
    
    if (totalSum > 0) {
      let scaled = {};
      let distributed = 0;
      initialLinked.forEach(p => {
        const share = Math.round((pcts[p.id] / totalSum) * 100);
        scaled[p.id] = share;
        distributed += share;
      });
      let diff = 100 - distributed;
      if (diff !== 0) {
        const step = diff > 0 ? 1 : -1;
        let limit = Math.abs(diff);
        let idx = 0;
        const ids = initialLinked.map(p => p.id);
        while (limit > 0) {
          scaled[ids[idx]] += step;
          limit--;
          idx = (idx + 1) % ids.length;
        }
      }
      return scaled;
    } else {
      const share = Math.floor(100 / initialLinked.length);
      let remainder = 100 - (share * initialLinked.length);
      let res = {};
      initialLinked.forEach((p, idx) => {
        res[p.id] = share + (idx < remainder ? 1 : 0);
      });
      return res;
    }
  });

  const [searchQuery, setSearchQuery] = useState("");
  // چندانتخابی بچ — «بدون بچ» نداریم (ensureInitialStock همیشه بچ اولیه می‌سازد)
  const initialBatchIds = () => {
    const bs = material.batches || [];
    if (bs.length) return [bs[0].id];
    const sticks = material.sticks || [];
    if (sticks.length) return [sticks[0].id];
    return [];
  };
  const [selectedBatchIds, setSelectedBatchIds] = useState(initialBatchIds);
  const batchId = selectedBatchIds[0] || null; // سازگاری با onApply فعلی (اولین بچ)
  const [isWaste, setIsWaste] = useState(material.isWaste ?? false);
  const [expandedLockedSessions, setExpandedLockedSessions] = useState({});
  const [isUsableRemaining, setIsUsableRemaining] = useState(material.isUsableRemaining ?? true);
  const [applyMessage, setApplyMessage] = useState("");
  // همیشه نوار درصد و حالت سه‌گانه — حتی با انتخاب بچ (قبلاً فقط «بدون بچ» نشان می‌داد)
  const showSliders = selectedIds.length > 0;

  // فیلتر «دسته‌بندی فرش» کنار سرچ محصولات: هر محصول بر اساس اینکه از کدوم
  // متریال نوع «فرش» استفاده می‌کنه دسته‌بندی می‌شه (همون منطقی که تب محصولات
  // برای گروه‌بندی «بر اساس فرش» استفاده می‌کنه)، چندانتخابی
  const NO_FABRIC_KEY = "__no_fabric__";
  const getProductFabricKey = (p) => {
    const li = (p.lineItems || []).find((l) => {
      const m = allMaterials.find((x) => x.id === l.materialId);
      return m?.type === "fabric";
    });
    return li ? li.materialId : NO_FABRIC_KEY;
  };
  const fabricOptions = useMemo(() => {
    const opts = allMaterials
      .filter((m) => m.type === "fabric")
      .map((m) => ({ id: m.id, name: m.name }));
    return [...opts, { id: NO_FABRIC_KEY, name: "بدون فرش" }];
  }, [allMaterials]);
  const [fabricFilter, setFabricFilter] = useState([]); // خالی = فیلتر غیرفعال (همه)
  const [showFabricFilter, setShowFabricFilter] = useState(false);
  const toggleFabricFilter = (id) => {
    setFabricFilter((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  // محاسبه کارهای تعادلی درصدی (بدون اعشار)
  const balancePercentages = (itemsMap, changedId, newValue, totalBudget = 100) => {
    const keys = Object.keys(itemsMap);
    if (keys.length <= 1) {
      return { [changedId]: totalBudget };
    }
        
    let val = Math.round(newValue);
    val = Math.max(0, Math.min(totalBudget, val));
        
    const otherKeys = keys.filter(k => k !== changedId);
    let currentOtherSum = otherKeys.reduce((s, k) => s + itemsMap[k], 0);
    const neededOtherSum = totalBudget - val;
        
    let nextMap = { ...itemsMap, [changedId]: val };
        
    if (neededOtherSum === 0) {
      otherKeys.forEach(k => { nextMap[k] = 0; });
    } else if (currentOtherSum === 0) {
      const share = Math.floor(neededOtherSum / otherKeys.length);
      let remainder = neededOtherSum - (share * otherKeys.length);
      otherKeys.forEach((k, idx) => {
        nextMap[k] = share + (idx < remainder ? 1 : 0);
      });
    } else {
      let diff = neededOtherSum - currentOtherSum;
      let step = diff > 0 ? 1 : -1;
      let limit = Math.abs(diff);
      
      let activeKeys = [...otherKeys];
      while (limit > 0 && activeKeys.length > 0) {
          let nextActiveKeys = [];
          for (let i = 0; i < activeKeys.length && limit > 0; i++) {
              let k = activeKeys[i];
              if (step < 0 && nextMap[k] === 0) {
                  continue;
              }
              if (step > 0 && nextMap[k] >= totalBudget) {
                  continue;
              }
              nextMap[k] += step;
              limit--;
              nextActiveKeys.push(k);
          }
          if (nextActiveKeys.length === 0) {
              break;
          }
          activeKeys = nextActiveKeys;
      }
    }
    return nextMap;
  };

  const recalculatePcts = (ids, mode) => {
    if (ids.length === 0) return {};
    if (ids.length === 1) return { [ids[0]]: 100 };
    
    let result = {};
    if (mode === "area") {
      let totalArea = 0;
      const areas = {};
      const counts = {};
      ids.forEach((id) => {
        const p = products.find((x) => x.id === id);
        const area = p ? getProductAreaSafe(p) : 1;
        const count = p ? (toNum(p.count) || 1) : 1;
        areas[id] = area;
        counts[id] = count;
        totalArea += (area * count);
      });
      // درصد خام هر محصول رو بر مبنای «کل سهمش» (نه واحدش) حساب می‌کنیم، بعد با
      // روش «باقی‌مانده‌ی بزرگ‌تر» گرد می‌کنیم تا جمع کل دقیقاً ۱۰۰٪ بشه — قبلاً
      // فقط سهم هر واحد گرد می‌شد و جمع نهایی می‌تونست ۹۸ یا ۱۰۱ از آب دربیاد.
      const rawTotals = {};
      ids.forEach((id) => {
        rawTotals[id] = totalArea > 0 ? ((areas[id] * counts[id]) / totalArea) * 100 : (100 / ids.length);
      });
      const floored = {};
      let flooredSum = 0;
      ids.forEach((id) => {
        floored[id] = Math.floor(rawTotals[id] * 100) / 100;
        flooredSum += floored[id];
      });
      const centsLeft = Math.round((100 - flooredSum) * 100);
      const sortedByRemainder = [...ids].sort(
        (a, b) => (rawTotals[b] - floored[b]) - (rawTotals[a] - floored[a])
      );
      for (let c = 0; c < centsLeft; c++) {
        const id = sortedByRemainder[c % sortedByRemainder.length];
        floored[id] = Math.round((floored[id] + 0.01) * 100) / 100;
      }
      ids.forEach((id) => {
        result[id] = counts[id] > 0 ? Math.round((floored[id] / counts[id]) * 100) / 100 : floored[id];
      });
    } else {
      const share = Math.floor(100 / ids.length);
      let remainder = 100 - (share * ids.length);
      ids.forEach((id, idx) => {
        result[id] = share + (idx < remainder ? 1 : 0);
      });
    }
    return result;
  };

  const handleAddProduct = (id) => {
    setSelectedIds(prev => {
      const next = [...prev, id];
      const cached = material.lastAllocationPcts?.[id];
      let nextPcts = recalculatePcts(next, distributionMode === "manual" ? "equal" : distributionMode);
      if (cached != null) {
        // این محصول قبلاً به این متریال لینک بوده — همان سهم قبلی‌اش را برگردان،
        // نه تقسیم مساوی مجدد؛ بقیه‌ی سهم‌ها را متناسب برای جا دادن آن تنظیم کن.
        const remaining = Math.max(0, 100 - cached);
        const others = next.filter(x => x !== id);
        const othersCurrentSum = others.reduce((s, x) => s + (nextPcts[x] || 0), 0);
        nextPcts = { ...nextPcts, [id]: cached };
        others.forEach(x => {
          nextPcts[x] = othersCurrentSum > 0 ? Math.round(((nextPcts[x] || 0) / othersCurrentSum) * remaining) : Math.round(remaining / others.length);
        });
      }
      setProductSubBudgetPcts(nextPcts);
      if (distributionMode === "manual") {
        setDistributionMode("equal");
      }
      return next;
    });
  };

  const handleRemoveProduct = (id) => {
    setSelectedIds(prev => {
      const next = prev.filter(x => x !== id);
      const nextPcts = recalculatePcts(next, distributionMode === "manual" ? "equal" : distributionMode);
      setProductSubBudgetPcts(nextPcts);
      if (distributionMode === "manual") {
        setDistributionMode("equal");
      }
      return next;
    });
  };

  const handleSliderChange = (productId, val) => {
    setDistributionMode("manual");
    const updated = balancePercentages(productSubBudgetPcts, productId, toNum(val));
    setProductSubBudgetPcts(updated);
  };

  const handleModeChange = (mode) => {
    setDistributionMode(mode);
    if (mode !== "manual") {
      const nextPcts = recalculatePcts(selectedIds, mode);
      setProductSubBudgetPcts(nextPcts);
    }
  };

  const handleAllocatedRemainingPctChange = (val) => {
    const v = Math.max(0, Math.min(100, toNum(val)));
    setAllocatedRemainingPct(v);
  };

  const handleApply = () => {
    const initialIdsSet = new Set(initialLinked.map(p => p.id));
    const finalSelectedSet = new Set(selectedIds);

    const removedIds = [...initialIdsSet].filter(id => !finalSelectedSet.has(id));

    const linkedUpdates = [];
    const productIds = [];
    const perProductPctOverride = {};

    selectedIds.forEach(id => {
      const subPct = productSubBudgetPcts[id] ?? 0;
      const actualPct = subPct * (allocatedRemainingPct / 100);

      if (initialIdsSet.has(id)) {
        linkedUpdates.push({ productId: id, pct: actualPct });
      } else {
        productIds.push(id);
        perProductPctOverride[id] = actualPct;
      }
    });

    if (productIds.length === 0 && linkedUpdates.length === 0 && removedIds.length === 0) {
      setApplyMessage("هیچ تغییری برای اعمال وجود ندارد");
      return;
    }

    const finalPctsCache = {};
    selectedIds.forEach(id => {
      finalPctsCache[id] = productSubBudgetPcts[id] ?? 0;
    });

    onApply({
      material,
      productIds,
      pct: allocatedRemainingPct,
      includeWastage: isWaste,
      isUsableRemaining,
      batchId,
      perProductPctOverride,
      linkedUpdates,
      removedIds,
      lastAllocationPcts: finalPctsCache,
      distributionMode,
    });

    onClose();
  };

  // ── تنظیم زنده‌ی درصد بین اعضای یک سشن قفل‌شده — فقط بین خودشان جابه‌جا می‌شود، نیازی به رفرش ندارد ──
  const adjustSessionShare = (sessionId, changedProductId, newPct) => {
    if (!setData) return;
    setData(d => {
      const products2 = d.products.map(p => ({ ...p, lineItems: (p.lineItems || []).map(li => ({ ...li })) }));
      const siblings = [];
      products2.forEach(p => {
        p.lineItems.forEach(li => {
          if (li.materialId === material.id && getSessionKey(li) === sessionId && li.deductedAt && !li.pendingUnlock) {
            siblings.push({ p, li });
          }
        });
      });
      const sessionTotalCost = siblings.reduce((s, x) => s + toNum(x.li.deductedCost), 0);
      if (sessionTotalCost <= 0 || siblings.length === 0) return d;

      const pctMap = {};
      siblings.forEach(({ p, li }) => { pctMap[p.id] = Math.round((toNum(li.deductedCost) / sessionTotalCost) * 100); });
      const nextMap = balancePercentages(pctMap, changedProductId, newPct, 100);

      siblings.forEach(({ p, li }) => {
        const share = (nextMap[p.id] ?? 0) / 100;
        const newCost = sessionTotalCost * share;
        const pIdx = products2.findIndex(x => x.id === p.id);
        const liIdx = products2[pIdx].lineItems.findIndex(x => x.id === li.id);
        products2[pIdx].lineItems[liIdx] = { ...products2[pIdx].lineItems[liIdx], deductedCost: newCost, customPct: nextMap[p.id] ?? 0 };
      });
      return { ...d, products: products2 };
    });
  };

  // ── حذف یک محصول از سشن قفل‌شده — سهمش در صف آزادسازی قرار می‌گیرد (با نگه‌داشتن دکمه رفرش واقعاً آزاد می‌شود)
  // و باقیمانده‌ی سشن (نه کل استخر متریال) بین اعضای دیگر همان سشن بازتقسیم می‌شود ──
  const queueSessionRelease = (sessionId, productId) => {
    if (!setData) return;
    setData(d => {
      const products2 = d.products.map(p => ({ ...p, lineItems: (p.lineItems || []).map(li => ({ ...li })) }));
      const siblings = [];
      products2.forEach(p => {
        p.lineItems.forEach(li => {
          if (li.materialId === material.id && getSessionKey(li) === sessionId && li.deductedAt && !li.pendingUnlock) {
            siblings.push({ p, li });
          }
        });
      });
      const target = siblings.find(x => x.p.id === productId);
      if (!target) return d;
      const remaining = siblings.filter(x => x.p.id !== productId);
      const prevTotal = siblings.reduce((s, x) => s + toNum(x.li.deductedCost), 0);
      const newSessionTotal = prevTotal - toNum(target.li.deductedCost);

      const tPIdx = products2.findIndex(x => x.id === target.p.id);
      const tLiIdx = products2[tPIdx].lineItems.findIndex(x => x.id === target.li.id);
      products2[tPIdx].lineItems[tLiIdx] = { ...products2[tPIdx].lineItems[tLiIdx], pendingUnlock: true, deductedAt: null };

      const prevRemainingSum = remaining.reduce((s, x) => s + toNum(x.li.deductedCost), 0);
      remaining.forEach(({ p, li }) => {
        const ratio = prevRemainingSum > 0 ? toNum(li.deductedCost) / prevRemainingSum : (1 / remaining.length);
        const newCost = newSessionTotal * ratio;
        const pIdx2 = products2.findIndex(x => x.id === p.id);
        const liIdx2 = products2[pIdx2].lineItems.findIndex(x => x.id === li.id);
        products2[pIdx2].lineItems[liIdx2] = {
          ...products2[pIdx2].lineItems[liIdx2],
          deductedCost: newCost,
          customPct: newSessionTotal > 0 ? Math.round((newCost / newSessionTotal) * 100) : 0,
        };
      });
      return { ...d, products: products2 };
    });
  };

  const selectedProductsList = products.filter(p => selectedIds.includes(p.id));
  const availableProductsList = products.filter(p => !selectedIds.includes(p.id) &&
    (!searchQuery.trim() || p.name?.includes(searchQuery) || String(p.code).includes(searchQuery) || (p.dims && p.dims.includes(searchQuery))) &&
    (fabricFilter.length === 0 || fabricFilter.includes(getProductFabricKey(p)))
  );

  const remainingCostVal = toNum(material.remainingCost);

  return (
    <div style={S.overlay}>
      <div style={{ ...S.sheet, maxWidth: 540 }} dir="rtl">
        <div style={S.sheetHeader}>
          <button style={S.iconBtn} onClick={onClose}>
            <X size={15} color="#aaa" />
          </button>
          <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#F5F0EB" }}>
            تخصیص «{material.name}»
          </span>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={onClose}
              style={{ background: "transparent", border: "1px solid #2a2a2a", color: "#888", padding: "6px 12px", borderRadius: 4, fontSize: 11, cursor: "pointer" }}
            >
              لغو
            </button>
            <button
              onClick={handleApply}
              style={{ background: "#8B1A1A", border: "none", color: "#fff", padding: "6px 16px", borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: "pointer" }}
            >
              ذخیره ({selectedIds.length})
            </button>
          </div>
        </div>

        <div style={{ padding: "14px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
          {/* اطلاعات متریال */}
          <div style={{ background: "#1a1a1a", border: "1px solid #252525", borderRadius: 8, padding: "10px 12px" }}>
            <div style={{ fontSize: 10, color: "#666", marginBottom: 4 }}>اطلاعات متریال</div>
            <div style={{ fontSize: 11, color: "#ddd", display: "flex", flexWrap: "wrap", gap: "8px 12px" }}>
              <strong>{material.name}</strong>
              <span style={{ color: "#888" }}>
                نوع: {material.type === 'fabric' ? 'فرش' : material.type === 'linear' ? 'خطی' : material.type === 'area' ? 'مساحتی' : material.type === 'ratio' ? 'نسبتی' : 'ثابت'}
              </span>
              <span style={{ color: "#e08a8a" }}>باقیمانده فعال: {fmt(remainingCostVal)} ت</span>
              <span style={{ color: "#5fd180" }}>کل هزینه: {fmt(toNum(material.totalCost))} ت</span>
            </div>
          </div>

          {/* محصولات قفل‌شده — گروه‌بندی‌شده بر اساس سشن قفل، مستقل از استخر تخصیص جدید */}
          {lockedSessions.length > 0 && (
            <div style={{ background: "#1a1512", border: "1px solid #3a2a20", borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ fontSize: 10, color: "#e0a35a", marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}>
                <Lock size={10} /> محصولات قفل‌شده (مستقل از تخصیص جدید)
              </div>
              {lockedSessions.map((session, sIdx) => {
                const sessionTotal = session.items.reduce((s, x) => s + toNum(x.li.deductedCost), 0);
                const isSessionOpen = !!expandedLockedSessions[session.sessionId];
                return (
                  <div key={session.sessionId}>
                    {sIdx > 0 && <div style={{ borderTop: "1px dashed #3a2a20", margin: "8px 0" }} />}
                    <div
                      style={{ fontSize: 8.5, color: "#8a6a4a", marginBottom: 4, display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
                      onClick={() => setExpandedLockedSessions((prev) => ({ ...prev, [session.sessionId]: !prev[session.sessionId] }))}
                    >
                      <span>سشن قفل — {session.items.length} محصول — جمع {fmt(sessionTotal)} ت</span>
                      {isSessionOpen ? <ChevronUp size={12} color="#8a6a4a" /> : <ChevronDown size={12} color="#8a6a4a" />}
                    </div>
                    {isSessionOpen && session.items.map(({ product, li }) => {
                      const pct = sessionTotal > 0 ? Math.round((toNum(li.deductedCost) / sessionTotal) * 100) : 0;
                      return (
                        <div key={product.id} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                          <span style={{ flex: 1, fontSize: 10.5, color: "#ddd", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{product.name}</span>
                          <span style={{ fontSize: 9.5, color: "#888", minWidth: 62, textAlign: "left" }}>{fmt(toNum(li.deductedCost))} ت</span>
                          <input
                            style={{ ...S.input, width: 44, padding: "3px 4px", fontSize: 10, textAlign: "center" }}
                            type="text"
                            value={pct}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => adjustSessionShare(session.sessionId, product.id, toNum(e.target.value))}
                            disabled={session.items.length <= 1}
                          />
                          <span style={{ fontSize: 9, color: "#666" }}>%</span>
                          <button
                            style={{ ...S.iconBtn, padding: 3 }}
                            title="حذف از این تخصیص (با نگه‌داشتن دکمه رفرش آزاد می‌شود)"
                            onClick={() => queueSessionRelease(session.sessionId, product.id)}
                          >
                            <X size={11} color="#8B1A1A" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}

          {/* قبلاً این دو تا چک‌باکس مستقل بودن (می‌شد هر دو یا هیچ‌کدوم تیک بخوره که
              منطقی نبود)، و فقط برای مساحتی/فرش نشون داده می‌شدن نه نسبتی/خطی.
              الان یک سوییچ دوحالته‌ی منسجم شدن و برای هر ۴ نوع مساحتی/فرش/خطی/نسبتی
              نشون داده می‌شن. طبق درخواست، این دو دکمه دیگه بخش/کپشن جدا ندارن —
              دقیقاً روبروی (سمت چپِ) متن «درصد مورد استفاده از باقیمانده فعال»
              نشستن، توی همون ردیف؛ فیلد «تعداد» هم به‌جای ردیف جدا، الان دقیقاً
              ابتدای همون خطِ نوار لغزنده‌ی درصده، با یه کادر جمع‌وجور */}
          {showSliders && (
            <div style={{ background: "#161616", border: "1px solid #222", borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 10.5, fontWeight: 500, color: "#ccc" }}>درصد مورد استفاده از باقیمانده فعال</span>
                {(isAreaType || material.type === "fabric" || material.type === "linear") && (
                  <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                    <button
                      type="button"
                      style={{
                        padding: "3px 8px", borderRadius: 5, cursor: "pointer", fontFamily: "inherit", fontSize: 9,
                        background: !isWaste ? "#1d3a24" : "#1c1c1c",
                        border: !isWaste ? "1px solid #3a7a4a" : "1px solid #2a2a2a",
                        color: !isWaste ? "#5fd180" : "#888",
                      }}
                      onClick={() => { setIsWaste(false); setIsUsableRemaining(true); }}
                    >
                      باقی بماند
                    </button>
                    <button
                      type="button"
                      style={{
                        padding: "3px 8px", borderRadius: 5, cursor: "pointer", fontFamily: "inherit", fontSize: 9,
                        background: isWaste ? "#3a2414" : "#1c1c1c",
                        border: isWaste ? "1px solid #7a5a2a" : "1px solid #2a2a2a",
                        color: isWaste ? "#e0a35a" : "#888",
                      }}
                      onClick={() => { setIsWaste(true); setIsUsableRemaining(false); }}
                    >
                      پرتی شود
                    </button>
                  </div>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {isRatioTypeMaterial && (
                  <input
                    type="text"
                    inputMode="numeric"
                    title={`تعداد از کل ${materialTotalQty}`}
                    value={quantitySelected}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => handleQuantitySelectedChange(e.target.value.replace(/\D/g, ""))}
                    style={{
                      width: 44,
                      flexShrink: 0,
                      background: "#1c1c1c",
                      border: "1px solid #2a2a2a",
                      borderRadius: 4,
                      padding: "3px 4px",
                      color: "#fff",
                      fontSize: 10,
                      textAlign: "center",
                      fontFamily: "inherit",
                      outline: "none"
                    }}
                  />
                )}
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={allocatedRemainingPct}
                  onChange={(e) => handleAllocatedRemainingPctChange(e.target.value)}
                  style={{ flex: 1, height: 4, cursor: "pointer", accentColor: "#8B1A1A" }}
                />
                <input
                  type="text"
                  inputMode="numeric"
                  value={allocatedRemainingPct}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => {
                    const cleaned = e.target.value.replace(/\D/g, "");
                    handleAllocatedRemainingPctChange(cleaned);
                  }}
                  style={{
                    width: 50,
                    background: "#1c1c1c",
                    border: "1px solid #2a2a2a",
                    borderRadius: 4,
                    padding: "3px 6px",
                    color: "#fff",
                    fontSize: 10,
                    textAlign: "center",
                    fontFamily: "inherit",
                    outline: "none"
                  }}
                />
                <span style={{ fontSize: 9, color: "#666" }}>%</span>
              </div>
              <div style={{ fontSize: 9, color: "#666", marginTop: 6 }}>
                مبلغ کل تخصیص برای محصولات: {fmt((remainingCostVal * allocatedRemainingPct) / 100)} تومان
              </div>
            </div>
          )}

          {/* محصولات موجود کارگاه برای افزودن */}
          <div style={{ marginTop: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#ccc", marginBottom: 6 }}>
              محصولات موجود کارگاه برای افزودن ({availableProductsList.length} مورد)
            </div>

            {/* جستجوگر کوچک + فیلتر دسته‌بندی فرش */}
            <div style={{ display: "flex", gap: 6, marginBottom: showFabricFilter ? 4 : 8 }}>
              <div style={{ display: "flex", alignItems: "center", background: "#161616", border: "1px solid #232323", borderRadius: 6, padding: "4px 8px", gap: 6, flex: 1 }}>
                <Search size={12} color="#444" />
                <input onFocus={(e) => e.target.select()}
                  style={{ background: "transparent", border: "none", outline: "none", color: "#ddd", fontSize: 10.5, flex: 1, fontFamily: "inherit" }}
                  placeholder="جستجوی سریع محصول..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    style={{ background: "transparent", border: "none", color: "#888", cursor: "pointer", display: "flex", alignItems: "center", padding: "0 2px" }}
                    onClick={() => setSearchQuery("")}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
              {fabricOptions.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowFabricFilter((s) => !s)}
                  style={{
                    display: "flex", alignItems: "center", gap: 4, fontSize: 10, fontFamily: "inherit", cursor: "pointer",
                    padding: "4px 10px", borderRadius: 6, whiteSpace: "nowrap",
                    background: fabricFilter.length > 0 ? "#3a2a20" : "#161616",
                    border: fabricFilter.length > 0 ? "1px solid #6b4a2a" : "1px solid #232323",
                    color: fabricFilter.length > 0 ? "#e0a35a" : "#888",
                  }}
                >
                  فرش {fabricFilter.length > 0 ? `(${fabricFilter.length})` : ""}
                  <ChevronDown size={11} />
                </button>
              )}
            </div>
            {showFabricFilter && fabricOptions.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8, padding: "6px 2px" }}>
                {fabricOptions.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => toggleFabricFilter(opt.id)}
                    style={{
                      ...S.chip,
                      ...(fabricFilter.includes(opt.id) ? S.chipActive : {}),
                      fontSize: 9.5,
                    }}
                  >
                    {opt.name}
                  </button>
                ))}
                {fabricFilter.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setFabricFilter([])}
                    style={{ ...S.chip, fontSize: 9.5, color: "#e08a8a" }}
                  >
                    پاک کردن فیلتر
                  </button>
                )}
              </div>
            )}

            {availableProductsList.length === 0 ? (
              <div style={{ fontSize: 10, color: "#555", textAlign: "center", padding: "12px 0" }}>
                هیچ محصولی برای افزودن یافت نشد
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 180, overflowY: "auto", border: "1px solid #1c1c1c", borderRadius: 8, padding: 6 }}>
                {availableProductsList.map((product) => (
                  <div
                    key={product.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "6px",
                      background: "#121212",
                      borderRadius: 6,
                      borderBottom: "1px solid #1a1a1a"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 9, color: "#666", width: 24, flexShrink: 0 }}>#{product.code}</span>
                      <span style={{ fontSize: 11, color: "#ccc", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{product.name}</span>
                      {product.dims && <span style={{ fontSize: 9.5, color: "#555", flexShrink: 0 }}>({product.dims})</span>}
                    </div>
                    <button
                      type="button"
                      style={{
                        background: "#1d3a24",
                        border: "none",
                        color: "#5fd180",
                        borderRadius: 4,
                        padding: "3px 8px",
                        fontSize: 10,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 3
                      }}
                      onClick={() => handleAddProduct(product.id)}
                    >
                      <Plus size={10} /> افزودن به لیست
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* نوع توزیع */}
          {showSliders && selectedIds.length > 0 && (
            <div>
              <div style={{ fontSize: 10, color: "#666", marginBottom: 6 }}>نحوه تقسیم بین محصولات انتخاب‌شده</div>
              <div style={{ display: "flex", gap: 6 }}>
                {[
                  ["equal", "توزیع مساوی"],
                  ["area", "نسبت مساحت"],
                  ["manual", "دستی (اسلایدر)"]
                ].map(([v, l]) => (
                  <button
                    key={v}
                    type="button"
                    style={{
                      ...S.chip,
                      ...(distributionMode === v ? S.chipActive : {}),
                      fontSize: 10.5,
                      padding: "6px 12px"
                    }}
                    onClick={() => handleModeChange(v)}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* انتخاب بچ (برای مساحتی) */}
          {((isAreaType && (material.batches || []).length > 0) || (material.type === "linear" && (material.sticks || []).length > 0)) && (
            <div style={{ background: "#111", border: "1px solid #222", borderRadius: 8, padding: "10px" }}>
              <div style={{ fontSize: 10, color: "#aaa", marginBottom: 6 }}>انتخاب بچ محصول</div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {/* بدون گزینه «بدون بچ» — چندانتخابی بچ‌ها */}
                {(material.batches || []).map((b, bi) => {
                  const active = selectedBatchIds.includes(b.id);
                  const qty = b.qty != null ? b.qty : 1;
                  const cost = b.totalCost != null ? b.totalCost : 0;
                  const dim = (b.width != null && b.height != null) ? `${b.width}×${b.height}` : "";
                  return (
                    <button
                      key={b.id}
                      type="button"
                      style={{ ...S.chip, ...(active ? S.chipActive : {}) }}
                      onClick={() => {
                        setSelectedBatchIds((prev) => {
                          if (prev.includes(b.id)) {
                            const next = prev.filter((id) => id !== b.id);
                            return next.length ? next : prev; // حداقل یکی بماند
                          }
                          return [...prev, b.id];
                        });
                      }}
                    >
                      {`بچ${bi + 1}`}{dim ? `:${dim}` : ""} · تعداد {qty} · {fmt(toNum(cost))} ت
                    </button>
                  );
                })}
                {(material.type === "linear") && (material.sticks || []).map((s, si) => {
                  const active = selectedBatchIds.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      style={{ ...S.chip, ...(active ? S.chipActive : {}) }}
                      onClick={() => {
                        setSelectedBatchIds((prev) => {
                          if (prev.includes(s.id)) {
                            const next = prev.filter((id) => id !== s.id);
                            return next.length ? next : prev;
                          }
                          return [...prev, s.id];
                        });
                      }}
                    >
                      {`شاخه${si + 1}`}: {toNum(s.length)}cm ×{toNum(s.qty) || 1}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* محصولات انتخاب شده */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#ccc", marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
              <span>محصولات در لیست تخصیص ({selectedProductsList.length} عدد)</span>
              {distributionMode === "manual" && selectedProductsList.length > 0 && (
                <span style={{ fontSize: 9.5, color: "#aaa" }}>
                  جمع سهم کسر: ۱۰۰٪
                </span>
              )}
            </div>

            {selectedProductsList.length === 0 ? (
              <div style={{
                fontSize: 11,
                color: "#555",
                padding: "20px",
                textAlign: "center",
                border: "1px dashed #222",
                borderRadius: 8,
                background: "#0c0c0c"
              }}>
                هیچ محصولی انتخاب نشده است. از لیست پایین محصولات دلخواه را به سبد تخصیص اضافه کنید.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {(() => {
                  // طبق درخواست: عرض ستونِ نام باید بر اساس بلندترین نامِ *انتخاب‌شده*
                  // خودکار تنظیم بشه (نه یه فاصله‌ی همیشه-بزرگ ثابت) — وقتی محصول
                  // انتخابی نام کوتاه داره، فاصله‌ی الکی نباید بیفته
                  const nameColCh = Math.min(28, Math.max(4, ...selectedProductsList.map(p => (p.name || "").length)));
                  return selectedProductsList.map((product) => {
                  const subPct = productSubBudgetPcts[product.id] ?? 0;
                  const actualPct = subPct * (allocatedRemainingPct / 100);
                  const actualCost = (actualPct / 100) * remainingCostVal;

                  let batchCostVal = 0;
                  let batchSharePct = 0;
                  if (isAreaType && batchId) {
                    const batch = material.batches?.find(b => b.id === batchId);
                    if (batch) {
                      const batchCost = toNum(batch.totalCost);
                      const allSelectedIds = selectedIds;
                      let totalArea = 0;
                      const areas = {};
                      allSelectedIds.forEach(pid => {
                        const prod = products.find(x => x.id === pid);
                        let area = 0;
                        if (prod) {
                          area = getProductAreaSafe(prod);
                        }
                        areas[pid] = area;
                        totalArea += area;
                      });
                      const share = totalArea > 0 ? (areas[product.id] || 0) / totalArea : (1 / allSelectedIds.length);
                      batchCostVal = batchCost * share;
                      batchSharePct = share * 100;
                    }
                  }

                  return (
                    <div
                      key={product.id}
                      style={{
                        background: "#0c111d",
                        border: "1px solid #16243a",
                        borderRadius: 6,
                        padding: "6px 10px",
                        display: "flex",
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                        minHeight: 38
                      }}
                    >
                      {/* سمت راست: کد + نام + ابعاد */}
                      <div style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
                        <span style={{ fontSize: 9, color: "#5080b0", fontWeight: "bold", flexShrink: 0 }}>#{product.code}</span>
                        <span style={{ fontSize: 10.5, fontWeight: 500, color: "#eee", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: `${nameColCh}ch`, flexShrink: 0 }} title={product.name}>
                          {product.name}
                        </span>
                        {product.dims && <span style={{ fontSize: 9, color: "#666", flexShrink: 0 }}>({product.dims})</span>}
                      </div>

                      {/* سمت چپ (روبرو، در امتداد همون خط): نوار درصد + عدد درصد + × حذف — چون
                          ستون نام دیگه فضای اضافی رو قاپ نمی‌زنه، این گروه فضای آزادشده رو
                          می‌گیره و نوار لغزنده هم بزرگ‌تر و راحت‌تر برای لمس شد */}
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
                        {showSliders ? (
                          <>
                            <input
                              type="range"
                              min="0"
                              max="100"
                              step="1"
                              value={subPct}
                              onChange={(e) => handleSliderChange(product.id, e.target.value)}
                              style={{
                                flex: 1,
                                minWidth: 40,
                                height: 3,
                                cursor: "pointer",
                                accentColor: "#5080b0",
                                background: "#222"
                              }}
                            />
                            <input
                              type="text"
                              inputMode="numeric"
                              value={subPct}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => {
                                const cleaned = e.target.value.replace(/\D/g, "");
                                handleSliderChange(product.id, cleaned);
                              }}
                              style={{
                                width: 30,
                                background: "#121212",
                                border: "1px solid #222",
                                borderRadius: 4,
                                padding: "2px",
                                color: "#fff",
                                fontSize: 10,
                                textAlign: "center",
                                fontFamily: "inherit",
                                outline: "none"
                              }}
                            />
                            <span style={{ fontSize: 9, color: "#aaa" }}>٪</span>
                          </>
                        ) : (
                          <div style={{ fontSize: 9.5, color: "#aaa", display: "flex", gap: 6, alignItems: "center" }}>
                            <span style={{ color: "#777" }}>سهم: {batchSharePct.toFixed(1)}٪</span>
                            <span style={{ color: "#5fd180" }}>{fmt(Math.round(batchCostVal))} ت</span>
                          </div>
                        )}

                        <button
                          type="button"
                          style={{
                            border: "none",
                            color: "#e08a8a",
                            cursor: "pointer",
                            fontSize: 10,
                            display: "flex",
                            alignItems: "center",
                            gap: 3,
                            padding: "3px 5px",
                            borderRadius: 4,
                            background: "#2a1414"
                          }}
                          onClick={() => handleRemoveProduct(product.id)}
                        >
                          <X size={10} />
                        </button>
                      </div>
                    </div>
                  );
                  });
                })()}
              </div>
            )}
          </div>


        </div>
      </div>
    </div>
  );
}

// ── کارت متریال ──
function MaterialCard({
  mat,
  products,
  onEdit,
  onDelete,
  expanded,
  onToggle,
  onToggleHidden,
  onAddPurchase,
  onAddBatch,
  onUpdateBatch,
  onDeleteBatch,
  onLockBatch,
  onUnlockBatch,
  onAddStick,
  onUpdateStick,
  onDeleteStick,
  onUpdateProcurement,
  onDeleteProcurement,
  onBulkApply,
}) {
  const { pendingBulkChanges } = usePendingChanges();
  const [newPurchaseAmt, setNewPurchaseAmt] = useState("");
  const [newPurchaseUnit, setNewPurchaseUnit] = useState("");
  const [newPurchaseQty, setNewPurchaseQty] = useState("1");
  const [newPurchaseDate, setNewPurchaseDate] = useState(todayISO());
  const [newBatch, setNewBatch] = useState({ label: "", width: "", height: "", qty: "1", unitPrice: "", totalCost: "", date: todayISO() });
  const [expandedBatchId, setExpandedBatchId] = useState(null);
  const [expandedProcId, setExpandedProcId] = useState(null);
  const [newStick, setNewStick] = useState({ length: "", qty: 1, date: todayISO() });
  const [showLinkedProducts, setShowLinkedProducts] = useState(false);

  // محاسبه هوشمند کل پتانسیل و مصرف متریال
  const total = useMemo(() => {
    if ((mat.type === "area" || mat.type === "fabric") && mat.batches && mat.batches.length > 0) {
      return mat.batches.reduce((sum, b) => sum + toNum(b.totalCost), 0);
    }
    return toNum(mat.totalCost) || (mat.procurements || []).reduce((sum, p) => sum + toNum(p.total), 0);
  }, [mat]);

    const { consumedCost, lockedCost, draftCost, pendingUnlockCost } = useMemo(() => {
    let locked = 0;
    let draft = 0;
    let pendingUnlock = 0;
    const poolBase = mat.remainingCost != null ? toNum(mat.remainingCost) : toNum(mat.totalCost);
    (products || []).forEach(p => {
      (p.lineItems || []).forEach(li => {
        if (li.materialId !== mat.id) return;

        if (li.pendingUnlock) {
          // در صف آزادسازی — دیگر جزو مصرف فعلی حساب نمی‌شود، ولی برای پیش‌نمایش
          // «این مقدار به‌زودی آزاد می‌شود» جدا نگه داشته می‌شود
          pendingUnlock += toNum(li.deductedCost != null ? li.deductedCost : li.cost || 0);
          return;
        }

        if (li.deductedAt) {
          locked += toNum(li.deductedCost != null ? li.deductedCost : li.cost || 0);
          return;
        }

        // معلق (زرد): اول li.cost ثبت‌شده از بولک (فرش/مساحتی با بچ و خطی)
        // اگر cost نبود، از درصد یا هندسه فرش بدون بچ استفاده کن
        if (toNum(li.cost) > 0) {
          draft += toNum(li.cost);
        } else if (li.customPct != null && toNum(li.customPct) > 0) {
          draft += (toNum(li.customPct) / 100) * poolBase;
        } else if (li.pct != null && toNum(li.pct) > 0) {
          draft += (toNum(li.pct) / 100) * poolBase;
        } else if (mat.type === "fabric" && !li.batchId) {
          const productArea = getProductArea(p);
          const coverage = toNum(p.fabricCoveragePct ?? 100) / 100;
          const fabricArea = toNum(mat.dimW) * toNum(mat.dimH);
          const pct = (fabricArea > 0 && productArea > 0) ? ((productArea * coverage) / fabricArea) * 100 : 100;
          draft += (pct / 100) * poolBase;
        }
      });
    });

    // اعتبارهای آماده‌ی آزادسازیِ ذخیره‌شده روی خود متریال (مثلاً بعد از حذف محصول)
    const releaseCredits = (mat.pendingReleaseCredits || []).reduce((s, c) => s + toNum(c.cost), 0);
    const totalPendingUnlock = pendingUnlock + releaseCredits;

    // قفل واقعی (قرمز) — بدون معلق و بدون آبی
    let finalLocked = locked;
    let finalDraft = draft;

    // برای بچ‌های مساحتی قفل‌شده: اگر هزینهٔ بچ از مجموع لاین‌آیتم‌ها بیشتر باشد،
    // اختلاف را به قفل واقعی اضافه کن (نه به معلق)
    if (mat.type === "area" || mat.type === "fabric") {
      const batchesLockedCost = (mat.batches || [])
        .filter(b => b.locked)
        .reduce((sum, b) => sum + toNum(b.totalCost), 0);
      if (batchesLockedCost > finalLocked) {
        finalLocked = batchesLockedCost;
      }
    }
    return {
      consumedCost: finalLocked + totalPendingUnlock, // مصرف قطعی + رزرو آبی (نه زرد)
      lockedCost: finalLocked,
      draftCost: finalDraft,
      pendingUnlockCost: totalPendingUnlock,
    };
  }, [mat, products]);

  // باقیماندهٔ قابل‌استفاده = کل − قفل − آبی  (زرد/معلق کم نمی‌کند)
  const remaining = Math.max(0, total - lockedCost - pendingUnlockCost);
  const usedPct = total > 0 ? ((lockedCost + pendingUnlockCost) / total) * 100 : 0;
  const lockedPct = total > 0 ? (lockedCost / total) * 100 : 0;
  const draftPct = total > 0 ? (draftCost / total) * 100 : 0;
  const pendingUnlockPct = total > 0 ? (pendingUnlockCost / total) * 100 : 0;
  const rawLockedPct = Math.max(0, lockedPct);
  // ۱۰۰٪ مستهلک فقط وقتی قفل+آبی پر شده — معلق زرد باعث قرمز شدن نمی‌شود
  const isFullyDeprecated = mat.isHardwareTool && lockedPct >= 99.9;

  const statusColor = (() => {
    if (lockedPct <= 0 && draftPct <= 0 && pendingUnlockPct <= 0) return "#5fd180";
    if (lockedPct >= 99.9) return "#e08a8a"; // فقط قفل کامل → قرمز
    if (draftPct > 0) return "#f2a83f"; // معلق → نارنجی‌متمایل (قبلاً #f2c94c زیادی زرد بود)
    return "#f2a83f";
  })();

  const getTypeLabel = (type) => {
    const map = {
      fabric: "فرش",
      linear: "خطی",
      area: "مساحتی",
      ratio: "نسبتی",
      fixed: "ثابت",
    };
    return map[type] || type;
  };

  const isHardware = mat.type === "fixed" || mat.isHardwareTool;

  const getTypeStyle = (type, isHardware) => {
    if (isHardware || type === "fixed") {
      return { background: "#2d2a1e", color: "#f2c94c" }; // Yellow (abzar)
    }
    switch (type) {
      case "fabric":
        return { background: "#2d1616", color: "#f28b8b" }; // Red (farsh)
      case "linear":
        return { background: "#25162d", color: "#d68bf2" }; // Purple (khati)
      case "area":
        return { background: "#16252d", color: "#8be0f2" }; // Light Blue (masahati)
      case "ratio":
        return { background: "#162d1c", color: "#8bf2a3" }; // Green (nesbati)
      default:
        return { background: "#1e1e1e", color: "#888888" };
    }
  };

  // برای متریال خطی، مجموع طول و تعداد را محاسبه می‌کنیم
  const totalStickLength = (mat.sticks || []).reduce((s, st) => s + toNum(st.length) * toNum(st.qty), 0);
  const totalStickQty = (mat.sticks || []).reduce((s, st) => s + toNum(st.qty), 0);

  return (
    <div style={{ ...S.matCard, opacity: mat.hidden ? 0.45 : 1 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 12px",
          cursor: "pointer",
        }}
        onClick={onToggle}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: statusColor,
                flexShrink: 0,
              }}
              title={`مصرف: ${usedPct.toFixed(1)}%`}
            />
            <span style={{ fontSize: 12, color: mat.hidden ? "#555" : "#ddd", fontWeight: 500 }}>
              {mat.name}
              {mat.type === "fabric" && mat.ageYears != null && toNum(mat.ageYears) > 0 && (
                <span style={{ color: "#888", fontWeight: 400 }}> · {toNum(mat.ageYears)} ساله</span>
              )}
            </span>
            {(!String(mat.name || "").trim() || !String(mat.type || "").trim()) && (
              <span title="فیلد الزامی خالی (نام یا نوع)" style={{ width: 14, height: 14, borderRadius: "50%", background: "#e0b93c", color: "#1a1a1a", fontSize: 10, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>!</span>
            )}
            <span
              style={{
                fontSize: 8.5,
                padding: "1px 6px",
                borderRadius: 8,
                fontWeight: 500,
                ...getTypeStyle(mat.type, isHardware),
              }}
            >
              {getTypeLabel(mat.type)}
              {isHardware && " (ابزار)"}
            </span>
            {isFullyDeprecated && (
              <span
                style={{
                  fontSize: 8,
                  padding: "1px 5px",
                  borderRadius: 6,
                  background: "#2a2a1a",
                  color: "#f2c94c",
                }}
              >
                ۱۰۰٪ مستهلک
              </span>
            )}
            {mat.type === "linear" && (
              <span style={{ fontSize: 8, color: "#666" }}>
                {totalStickQty} شاخه · {totalStickLength.toFixed(0)} سانت
              </span>
            )}
          </div>
          <div style={{ fontSize: 9.5, color: "#666", marginTop: 4, lineHeight: 1.6 }}>
            کل: {fmt(total)} · باقی: {fmt(remaining)} تومان
          </div>
        </div>
        <button
          style={{ ...S.iconBtn, width: 32, height: 32, justifyContent: "center" }}
          onClick={(e) => {
            e.stopPropagation();
            onToggleHidden(mat.id);
          }}
        >
          {mat.hidden ? <EyeOff size={13} color="#555" /> : <Eye size={13} color="#555" />}
        </button>
        {expanded ? <ChevronUp size={14} color="#555" /> : <ChevronDown size={14} color="#555" />}
      </div>

      <div
        style={{
          margin: "0 12px 8px",
          height: 4,
          background: "#232323",
          borderRadius: 4,
          overflow: "hidden",
          display: "flex",
        }}
      >
        {/* قرمز = قفل قطعی | آبی = آماده‌ی آزادسازی (غیرقابل‌استفاده) | زرد = معلق (هنوز قابل‌تغییر) */}
        <div
          style={{
            height: "100%",
            width: `${Math.min(100, rawLockedPct)}%`,
            background: "#8B1A1A",
          }}
        />
        {pendingUnlockPct > 0 && (
          <div
            style={{
              height: "100%",
              width: `${Math.min(100 - rawLockedPct, pendingUnlockPct)}%`,
              background: "#4a9eda",
            }}
          />
        )}
        {draftPct > 0 && (
          <div
            style={{
              height: "100%",
              width: `${Math.min(Math.max(0, 100 - rawLockedPct - pendingUnlockPct), draftPct)}%`,
              background: "#f2a83f",
            }}
          />
        )}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8.5, margin: "0 12px 8px", gap: 4, flexWrap: "wrap" }}>
        {draftPct > 0 && (
          <div style={{ color: "#f2a83f" }}>
            {draftPct.toFixed(1)}% معلق
          </div>
        )}
        {pendingUnlockPct > 0 && (
          <div style={{ color: "#4a9eda" }}>
            {pendingUnlockPct.toFixed(1)}% آماده‌ی آزادسازی
          </div>
        )}
        <div style={{ color: "#e08a8a" }}>
          {lockedPct.toFixed(1)}% قفل‌شده
        </div>
      </div>

      {isFullyDeprecated && (
        <div style={{ padding: "0 12px 8px" }}>
          <button
            style={{
              width: "100%",
              background: "#2a2a1a",
              border: "1px solid #f2c94c44",
              color: "#f2c94c",
              borderRadius: 7,
              padding: "7px 0",
              fontFamily: "inherit",
              fontSize: 10.5,
              cursor: "pointer",
            }}
            onClick={() => {
              if (typeof onEdit === "function") onEdit({ ...mat, remainingCost: total });
            }}
          >
            🔄 احیای ابزار — بازنشانی استهلاک
          </button>
        </div>
      )}

      {expanded && (
        <div style={{ padding: "0 12px 12px", borderTop: "1px solid #1e1e1e", paddingTop: 8 }}>
          {/* طبق درخواست یکپارچه‌سازی: این بخش («تاریخچه خرید») برای فرش/مساحتی
              و خطی صرفاً یه لاگ خودکار و موازیه — هر بار که یه بچ (فرش/مساحتی)
              یا چوب (خطی) اضافه می‌شه، addMaterialPurchase هم‌زمان یه ردیف اینجا
              هم اضافه می‌کنه، بدون این‌که خودش منبع حقیقتی چیزی باشه (چوب/بچ
              واقعی، که به محصولات لینک می‌شه، جای دیگه‌ست). نتیجه‌ش این بود که
              کاربر ۲ تا بخش «تاریخچه» همپوشان و گیج‌کننده می‌دید. الان فقط برای
              نسبتی/ثابت («ابزار») نشون داده می‌شه — جایی که این واقعاً تنها
              منبع تاریخچه‌ست، نه یه کپی اضافه */}
          {(mat.type === "ratio" || mat.type === "fixed") && (
          <>
          <div style={{ fontSize: 9.5, color: "#666", marginBottom: 4 }}>بچ‌های موجود (خریدها)</div>
          {(mat.procurements || []).map((pr) => {
            const showQty = mat.type === "ratio" || mat.type === "fixed" || mat.type === "fabric";
            const isOpen = expandedProcId === pr.id;
            return (
              <div
                key={pr.id}
                style={{
                  background: "#121212",
                  border: "1px solid #232323",
                  borderRadius: 8,
                  padding: "7px 9px",
                  marginBottom: 5,
                }}
              >
                <div
                  style={{ display: "flex", gap: 6, alignItems: "center", cursor: pr.id ? "pointer" : "default" }}
                  onClick={() => pr.id && setExpandedProcId(isOpen ? null : pr.id)}
                >
                  {pr.id ? (isOpen ? <ChevronUp size={12} color="#888" /> : <ChevronDown size={12} color="#888" />) : <span style={{ width: 12 }} />}
                  <span style={{ fontSize: 9.5, color: "#777", flex: "0 0 auto" }}>{pr.date ? fmtDate(pr.date) : "—"}</span>
                  <span style={{ flex: 1 }} />
                  {showQty && pr.qty > 0 && (
                    <span style={{ fontSize: 9.5, color: "#777" }}>{pr.qty} عدد</span>
                  )}
                  <span style={{ fontSize: 9.5, color: "#aaa" }}>{fmt(toNum(pr.total))} ت</span>
                  {pr.id && (
                    <button
                      style={S.iconBtn}
                      onClick={(e) => { e.stopPropagation(); onDeleteProcurement?.(mat.id, pr.id); if (isOpen) setExpandedProcId(null); }}
                    >
                      <Trash2 size={12} color="#e08a8a" />
                    </button>
                  )}
                </div>
                {isOpen && (
                  <div style={{ marginTop: 7, paddingTop: 7, borderTop: "1px solid #1e1e1e" }}>
                    <div style={{ display: "flex", gap: 6, marginBottom: 5 }}>
                      <input
                        style={{ ...S.input, flex: 1, minWidth: 0 }}
                        type="text"
                        placeholder="تعداد"
                        value={pr.qty ?? ""}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => {
                          const q = toNum(e.target.value);
                          const u = toNum(pr.unitPrice) || (toNum(pr.qty) > 0 ? toNum(pr.total) / toNum(pr.qty) : 0);
                          const patch = { qty: q };
                          if (u > 0) {
                            patch.unitPrice = Math.round(u);
                            patch.total = Math.round(q * u);
                          }
                          onUpdateProcurement?.(mat.id, pr.id, patch);
                        }}
                      />
                      <input onFocus={(e) => e.target.select()}
                        style={{ ...S.input, flex: 1, minWidth: 0 }}
                        type="text"
                        placeholder="مبلغ واحد"
                        value={
                          pr.unitPrice
                            ? formatPriceInput(pr.unitPrice)
                            : (pr.total && pr.qty ? formatPriceInput(Math.round(toNum(pr.total) / Math.max(1, toNum(pr.qty)))) : "")
                        }
                        onChange={(e) => {
                          const u = e.target.value === "" ? null : parsePriceInput(e.target.value);
                          const q = Math.max(1, toNum(pr.qty) || 1);
                          const patch = { unitPrice: u };
                          if (u != null) patch.total = Math.round(q * u);
                          onUpdateProcurement?.(mat.id, pr.id, patch);
                        }}
                      />
                      <input onFocus={(e) => e.target.select()}
                        style={{ ...S.input, flex: 1, minWidth: 0 }}
                        type="text"
                        placeholder="مبلغ کل"
                        value={pr.total ? formatPriceInput(pr.total) : ""}
                        onChange={(e) => {
                          const raw = e.target.value;
                          const val = raw === "" ? 0 : parsePriceInput(raw);
                          const q = Math.max(1, toNum(pr.qty) || 1);
                          onUpdateProcurement?.(mat.id, pr.id, {
                            total: val,
                            unitPrice: q > 0 ? Math.round(val / q) : pr.unitPrice,
                          });
                        }}
                      />
                    </div>
                    <JalaliDatePicker
                      style={{ width: "100%" }}
                      value={pr.date || ""}
                      onChange={(val) => onUpdateProcurement?.(mat.id, pr.id, { date: val })}
                    />
                  </div>
                )}
              </div>
            );
          })}
          {(!mat.procurements || mat.procurements.length === 0) && (
            <div style={{ fontSize: 9.5, color: "#444", padding: "4px 0" }}>
              هیچ خریدی ثبت نشده
            </div>
          )}
          </>
          )}

          {mat.type !== "area" && mat.type !== "fabric" && (
          <div style={{ display: "flex", gap: 6, marginTop: 6, marginBottom: 8 }}>
            <input
              style={{ ...S.input, flex: 1, minWidth: 0 }}
              type="text"
              placeholder="تعداد"
              value={newPurchaseQty}
              onFocus={(e) => e.target.select()}
              onChange={(e) => {
                const q = toNum(e.target.value);
                const u = toNum(newPurchaseUnit);
                setNewPurchaseQty(e.target.value);
                if (u > 0) setNewPurchaseAmt(String(Math.round(q * u)));
              }}
            />
            <input onFocus={(e) => e.target.select()}
              style={{ ...S.input, flex: 1, minWidth: 0 }}
              type="text"
              placeholder="مبلغ واحد"
              value={newPurchaseUnit ? formatPriceInput(newPurchaseUnit) : ""}
              onChange={(e) => {
                const u = e.target.value === "" ? "" : String(parsePriceInput(e.target.value));
                const q = toNum(newPurchaseQty) || 1;
                setNewPurchaseUnit(u);
                if (u !== "") setNewPurchaseAmt(String(Math.round(q * toNum(u))));
              }}
            />
            <input onFocus={(e) => e.target.select()}
              style={{ ...S.input, flex: 1, minWidth: 0 }}
              type="text"
              placeholder="مبلغ کل"
              value={newPurchaseAmt ? formatPriceInput(newPurchaseAmt) : ""}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === "") {
                  setNewPurchaseAmt("");
                  return;
                }
                const total = parsePriceInput(raw);
                const q = toNum(newPurchaseQty) || 1;
                setNewPurchaseAmt(String(total));
                if (q > 0) setNewPurchaseUnit(String(Math.round(total / q)));
              }}
            />
            <JalaliDatePicker
              style={{ width: 110 }}
              value={newPurchaseDate}
              onChange={(val) => setNewPurchaseDate(val)}
            />
            <button
              style={{ ...S.chip, padding: "6px 12px", background: "#8B1A1A", color: "#fff", border: "none", flexShrink: 0 }}
              onClick={() => {
                const amt = toNum(newPurchaseAmt);
                const q = Math.max(1, toNum(newPurchaseQty) || 1);
                if (amt > 0) {
                  onAddPurchase(mat.id, amt, newPurchaseDate, q);
                  setNewPurchaseAmt("");
                  setNewPurchaseUnit("");
                  setNewPurchaseQty("1");
                  if (mat.hidden) {
                    onToggleHidden(mat.id);
                  }
                }
              }}
            >
              +
            </button>
          </div>
          )}

          {(mat.type === "area" || mat.type === "fabric") && (
            <div>
              <div style={S.sectionTitle}>بچ‌های موجود</div>
              {(mat.batches || []).map((b) => {
                const isOpen = expandedBatchId === b.id;
                return (
                <div
                  key={b.id}
                  style={{
                    background: "#121212",
                    border: "1px solid #232323",
                    borderRadius: 8,
                    padding: "9px 10px",
                    marginBottom: 6,
                  }}
                >
                  <div
                    style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}
                    onClick={() => setExpandedBatchId(isOpen ? null : b.id)}
                  >
                    {isOpen ? <ChevronUp size={13} color="#888" /> : <ChevronDown size={13} color="#888" />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, color: "#ddd", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {b.label || "بدون عنوان"}
                      </div>
                      <div style={{ fontSize: 9, color: "#666", marginTop: 2 }}>
                        {b.width || 0}×{b.height || 0} · {b.totalCost ? fmt(toNum(b.totalCost)) : 0} ت{b.date ? ` · ${fmtDate(b.date)}` : ""}
                        {b.locked && <span style={{ color: "#5fd180", marginRight: 6 }}> · قفل</span>}
                      </div>
                    </div>
                    <div style={{ position: 'relative' }}>
                    <button
                      style={S.iconBtn}
                      onClick={(e) => { e.stopPropagation(); (b.locked ? onUnlockBatch(mat.id, b.id) : onLockBatch(mat.id, b.id)); }}
                    >
                      {b.locked ? <Lock size={12} color="#5fd180" /> : <Unlock size={12} color="#888" />}
                    </button>
                    {pendingBulkChanges.some(c => c.materialId === mat.id && c.batchId === b.id) && (
                      <div style={{ position: 'absolute', top: 0, right: 0, width: 6, height: 6, backgroundColor: 'red', borderRadius: '50%' }} />
                    )}
                    </div>
                    <button style={S.iconBtn} onClick={(e) => { e.stopPropagation(); onDeleteBatch(mat.id, b.id); }}>
                      <Trash2 size={12} color="#e08a8a" />
                    </button>
                  </div>
                  {isOpen && (
                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #1e1e1e" }}>
                      <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                        <input onFocus={(e) => e.target.select()}
                          style={{ ...S.input, flex: 1 }}
                          placeholder="عنوان بچ"
                          value={b.label}
                          onChange={(e) => onUpdateBatch(mat.id, b.id, { label: e.target.value })}
                        />
                      </div>
                      <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                        <input onFocus={(e) => e.target.select()}
                          style={{ ...S.input, flex: 1 }}
                          type="text"
                          placeholder="عرض (سانت)"
                          value={b.width || ""}
                          onChange={(e) => onUpdateBatch(mat.id, b.id, { width: toNum(e.target.value) })}
                        />
                        <span style={{ color: "#555", alignSelf: "center" }}>×</span>
                        <input onFocus={(e) => e.target.select()}
                          style={{ ...S.input, flex: 1 }}
                          type="text"
                          placeholder="ارتفاع (سانت)"
                          value={b.height || ""}
                          onChange={(e) => onUpdateBatch(mat.id, b.id, { height: toNum(e.target.value) })}
                        />
                        <input
                          style={{ ...S.input, flex: 1, minWidth: 0 }}
                          type="text"
                          placeholder="تعداد"
                          value={b.qty || 1}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => {
                            const q = Math.max(1, toNum(e.target.value));
                            const u = toNum(b.unitPrice);
                            const patch = { qty: q };
                            if (u > 0) patch.totalCost = Math.round(q * u);
                            onUpdateBatch(mat.id, b.id, patch);
                          }}
                        />
                      </div>
                      <div style={{ display: "flex", gap: 5, marginBottom: 4 }}>
                        <input onFocus={(e) => e.target.select()}
                          style={{ ...S.input, flex: 1, minWidth: 0 }}
                          type="text"
                          placeholder="مبلغ واحد"
                          value={b.unitPrice ? formatPriceInput(b.unitPrice) : (b.totalCost && b.qty ? formatPriceInput(Math.round(toNum(b.totalCost) / Math.max(1, toNum(b.qty)))) : "")}
                          onChange={(e) => {
                            const u = e.target.value === "" ? null : parsePriceInput(e.target.value);
                            const q = Math.max(1, toNum(b.qty) || 1);
                            const patch = { unitPrice: u };
                            if (u != null) patch.totalCost = Math.round(q * u);
                            onUpdateBatch(mat.id, b.id, patch);
                          }}
                        />
                        <input onFocus={(e) => e.target.select()}
                          style={{ ...S.input, flex: 1, minWidth: 0 }}
                          type="text"
                          placeholder="مبلغ کل"
                          value={b.totalCost ? formatPriceInput(b.totalCost) : ""}
                          onChange={(e) => {
                            const total = e.target.value === "" ? null : parsePriceInput(e.target.value);
                            const q = Math.max(1, toNum(b.qty) || 1);
                            const patch = { totalCost: total };
                            if (total != null && q > 0) patch.unitPrice = Math.round(total / q);
                            onUpdateBatch(mat.id, b.id, patch);
                          }}
                        />
                      </div>
                      <div>
                        <div style={{ fontSize: 8.5, color: "#666", marginBottom: 4 }}>تاریخ بچ</div>
                        <JalaliDatePicker
                          value={b.date || todayISO()}
                          onChange={(val) => onUpdateBatch(mat.id, b.id, { date: val })}
                        />
                      </div>
                      {mat.type === "fabric" && (
                        <div style={{ marginTop: 6 }}>
                          <div style={{ fontSize: 8.5, color: "#666", marginBottom: 4 }}>طرح فرش (اختیاری)</div>
                          <input onFocus={(e) => e.target.select()}
                            style={{ ...S.input }}
                            type="text"
                            placeholder="طرح"
                            value={b.pattern || ""}
                            onChange={(e) => onUpdateBatch(mat.id, b.id, { pattern: e.target.value })}
                          />
                        </div>
                      )}
                      <div style={{ fontSize: 9, color: "#555", marginTop: 6 }}>
                        {(b.linkedProductIds || []).length} محصول لینک شده
                      </div>
                    </div>
                  )}
                </div>
              );})}
              <div
                style={{
                  background: "#0f0f0f",
                  border: "1px dashed #2a2a2a",
                  borderRadius: 8,
                  padding: 9,
                  marginBottom: 8,
                }}
              >
                <div style={{ fontSize: 9.5, color: "#666", marginBottom: 6 }}>بچ جدید (خرید) <span style={{ color: "#e08a8a" }}>(همه فیلدها الزامی)</span></div>
                <div style={{ display: "flex", gap: 5, marginBottom: 5, alignItems: "center" }}>
                  <input onFocus={(e) => e.target.select()}
                    style={{ ...S.input, flex: 1, minWidth: 0 }}
                    type="text"
                    placeholder="طول"
                    value={newBatch.width}
                    onChange={(e) => setNewBatch({ ...newBatch, width: e.target.value })}
                  />
                  <span style={{ color: "#555", fontSize: 11, flexShrink: 0 }}>×</span>
                  <input onFocus={(e) => e.target.select()}
                    style={{ ...S.input, flex: 1, minWidth: 0 }}
                    type="text"
                    placeholder="عرض"
                    value={newBatch.height}
                    onChange={(e) => setNewBatch({ ...newBatch, height: e.target.value })}
                  />
                  <input
                    style={{ ...S.input, flex: 1, minWidth: 0 }}
                    type="text"
                    placeholder="تعداد"
                    value={newBatch.qty}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const q = toNum(e.target.value);
                      const u = toNum(newBatch.unitPrice);
                      setNewBatch({
                        ...newBatch,
                        qty: e.target.value,
                        totalCost: u > 0 ? String(Math.round(q * u)) : newBatch.totalCost,
                      });
                    }}
                  />
                </div>
                <div style={{ display: "flex", gap: 5, marginBottom: 5 }}>
                  <input onFocus={(e) => e.target.select()}
                    style={{ ...S.input, flex: 1, minWidth: 0 }}
                    type="text"
                    placeholder="مبلغ واحد"
                    value={newBatch.unitPrice ? formatPriceInput(newBatch.unitPrice) : ""}
                    onChange={(e) => {
                      const u = parsePriceInput(e.target.value);
                      const q = toNum(newBatch.qty) || 1;
                      setNewBatch({
                        ...newBatch,
                        unitPrice: e.target.value === "" ? "" : String(u),
                        totalCost: e.target.value === "" ? newBatch.totalCost : String(Math.round(q * u)),
                      });
                    }}
                  />
                  <input onFocus={(e) => e.target.select()}
                    style={{ ...S.input, flex: 1, minWidth: 0 }}
                    type="text"
                    placeholder="مبلغ کل"
                    value={newBatch.totalCost ? formatPriceInput(newBatch.totalCost) : ""}
                    onChange={(e) => {
                      const total = parsePriceInput(e.target.value);
                      const q = toNum(newBatch.qty) || 1;
                      setNewBatch({
                        ...newBatch,
                        totalCost: e.target.value === "" ? "" : String(total),
                        unitPrice: e.target.value === "" || q <= 0 ? newBatch.unitPrice : String(Math.round(total / q)),
                      });
                    }}
                  />
                </div>
                <div style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap" }}>
                  <input onFocus={(e) => e.target.select()}
                    style={{ ...S.input, flex: 1, minWidth: 70 }}
                    placeholder="عنوان (اختیاری)"
                    value={newBatch.label}
                    onChange={(e) => setNewBatch({ ...newBatch, label: e.target.value })}
                  />
                  {mat.type === "fabric" && (
                    <input onFocus={(e) => e.target.select()}
                      style={{ ...S.input, flex: 1, minWidth: 70 }}
                      placeholder="طرح فرش (اختیاری)"
                      value={newBatch.pattern || ""}
                      onChange={(e) => setNewBatch({ ...newBatch, pattern: e.target.value })}
                    />
                  )}
                  <JalaliDatePicker
                    style={{ width: 110 }}
                    value={newBatch.date}
                    onChange={(val) => setNewBatch({ ...newBatch, date: val })}
                  />
                  <button
                    style={{ ...S.chip, padding: "6px 12px", background: "#8B1A1A", color: "#fff", border: "none", flexShrink: 0 }}
                    onClick={() => {
                      const bQty = Math.max(1, toNum(newBatch.qty) || 1);
                      const bUnitPrice = toNum(newBatch.unitPrice);
                      const bTotal = toNum(newBatch.totalCost);
                      const w = toNum(newBatch.width);
                      const h = toNum(newBatch.height);
                      if (w <= 0 || h <= 0) {
                        alert("لطفاً ابعاد (طول × عرض) معتبر وارد کنید");
                        return;
                      }
                      if (bUnitPrice <= 0 && bTotal <= 0) {
                        alert("لطفاً مبلغ واحد یا مبلغ کل را وارد کنید");
                        return;
                      }
                      const finalTotal = bTotal > 0 ? bTotal : Math.round(bUnitPrice * bQty);
                      const finalUnit = bUnitPrice > 0 ? bUnitPrice : (bQty > 0 ? Math.round(finalTotal / bQty) : 0);
                      onAddBatch(mat.id, {
                        label: (newBatch.label || "").trim() || `بچ ${w}×${h}`,
                        width: w,
                        height: h,
                        qty: bQty,
                        unitPrice: finalUnit,
                        totalCost: finalTotal,
                        date: newBatch.date || todayISO(),
                        pattern: (newBatch.pattern || "").trim() || null,
                        locked: false,
                        linkedProductIds: [],
                      });
                      if (finalTotal > 0 && onAddPurchase) {
                        onAddPurchase(mat.id, finalTotal, newBatch.date || todayISO(), bQty);
                      }
                      setNewBatch({ label: "", width: "", height: "", qty: "1", unitPrice: "", totalCost: "", pattern: "", date: todayISO() });
                    }}
                  >
                    + افزودن
                  </button>
                </div>
              </div>
            </div>
          )}

          {mat.type === "linear" && (
            <div>
              <div style={S.sectionTitle}>چوب‌های موجود</div>
              {(mat.sticks || []).map((s) => {
                const totalLength = toNum(s.length) * toNum(s.qty);
                return (
                  <div
                    key={s.id}
                    style={{
                      background: "#121212",
                      border: "1px solid #232323",
                      borderRadius: 8,
                      padding: "9px 10px",
                      marginBottom: 6,
                    }}
                  >
                    <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
                      <span style={{ fontSize: 10, color: "#666", flex: 1 }}>
                        {s.length} سانت × {s.qty} عدد = {totalLength} سانت
                        {s.date && <span style={{ color: "#555" }}> · {fmtDate(s.date)}</span>}
                      </span>
                      <button style={S.iconBtn} onClick={() => onDeleteStick(mat.id, s.id)}>
                        <Trash2 size={12} color="#e08a8a" />
                      </button>
                    </div>
                    <div style={{ display: "flex", gap: 6, marginBottom: 5 }}>
                      <input onFocus={(e) => e.target.select()}
                        style={{ ...S.input, flex: 1, minWidth: 0 }}
                        type="text"
                        placeholder="طول (سانت)"
                        value={s.length || ""}
                        onChange={(e) => onUpdateStick(mat.id, s.id, { length: toNum(e.target.value) })}
                      />
                      <input onFocus={(e) => e.target.select()}
                        style={{ ...S.input, flex: 1, minWidth: 0 }}
                        type="text"
                        placeholder="تعداد"
                        value={s.qty || ""}
                        onChange={(e) => {
                          const q = toNum(e.target.value);
                          const u = toNum(s.unitPrice);
                          const patch = { qty: q };
                          if (u > 0) patch.totalCost = Math.round(q * u);
                          onUpdateStick(mat.id, s.id, patch);
                        }}
                      />
                    </div>
                    <div style={{ display: "flex", gap: 6, marginBottom: 5 }}>
                      <input onFocus={(e) => e.target.select()}
                        style={{ ...S.input, flex: 1, minWidth: 0 }}
                        type="text"
                        placeholder="مبلغ واحد"
                        value={s.unitPrice ? formatPriceInput(s.unitPrice) : (s.totalCost && s.qty ? formatPriceInput(Math.round(toNum(s.totalCost) / Math.max(1, toNum(s.qty)))) : "")}
                        onChange={(e) => {
                          const u = e.target.value === "" ? null : parsePriceInput(e.target.value);
                          const q = Math.max(1, toNum(s.qty) || 1);
                          const patch = { unitPrice: u };
                          if (u != null) patch.totalCost = Math.round(q * u);
                          onUpdateStick(mat.id, s.id, patch);
                        }}
                      />
                      <input onFocus={(e) => e.target.select()}
                        style={{ ...S.input, flex: 1, minWidth: 0 }}
                        type="text"
                        placeholder="مبلغ کل"
                        value={s.totalCost ? formatPriceInput(s.totalCost) : ""}
                        onChange={(e) => {
                          const total = e.target.value === "" ? null : parsePriceInput(e.target.value);
                          const q = Math.max(1, toNum(s.qty) || 1);
                          const patch = { totalCost: total };
                          if (total != null && q > 0) patch.unitPrice = Math.round(total / q);
                          onUpdateStick(mat.id, s.id, patch);
                        }}
                      />
                    </div>
                    <div style={{ marginTop: 2 }}>
                      <JalaliDatePicker
                        value={s.date || ""}
                        onChange={(val) => onUpdateStick(mat.id, s.id, { date: val })}
                      />
                    </div>
                  </div>
                );
              })}
              <div
                style={{
                  background: "#0f0f0f",
                  border: "1px dashed #2a2a2a",
                  borderRadius: 8,
                  padding: 9,
                  marginBottom: 8,
                }}
              >
                <div style={{ fontSize: 9.5, color: "#666", marginBottom: 6 }}>چوب / بچ جدید</div>
                <div style={{ display: "flex", gap: 5, marginBottom: 5, alignItems: "center" }}>
                  <input onFocus={(e) => e.target.select()}
                    style={{ ...S.input, flex: 1, minWidth: 0 }}
                    type="text"
                    placeholder="طول (سانت)"
                    value={newStick.length}
                    onChange={(e) => setNewStick({ ...newStick, length: e.target.value })}
                  />
                  <input
                    style={{ ...S.input, flex: 1, minWidth: 0 }}
                    type="text"
                    placeholder="تعداد"
                    value={newStick.qty}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const q = toNum(e.target.value);
                      const u = toNum(newStick.unitPrice);
                      setNewStick({
                        ...newStick,
                        qty: e.target.value,
                        totalCost: u > 0 ? String(Math.round(q * u)) : newStick.totalCost,
                      });
                    }}
                  />
                  {(toNum(newStick.length) > 0 && toNum(newStick.qty) > 0) && (
                    <span style={{ fontSize: 9, color: "#7ec7e8", flexShrink: 0, whiteSpace: "nowrap" }}>
                      = {Math.round(toNum(newStick.length) * toNum(newStick.qty) * 10) / 10} سانت
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", gap: 5, marginBottom: 5 }}>
                  <input onFocus={(e) => e.target.select()}
                    style={{ ...S.input, flex: 1, minWidth: 0 }}
                    type="text"
                    placeholder="مبلغ واحد"
                    value={newStick.unitPrice ? formatPriceInput(newStick.unitPrice) : ""}
                    onChange={(e) => {
                      const u = parsePriceInput(e.target.value);
                      const q = toNum(newStick.qty) || 1;
                      setNewStick({
                        ...newStick,
                        unitPrice: e.target.value === "" ? "" : String(u),
                        totalCost: e.target.value === "" ? newStick.totalCost : String(Math.round(q * u)),
                      });
                    }}
                  />
                  <input onFocus={(e) => e.target.select()}
                    style={{ ...S.input, flex: 1, minWidth: 0 }}
                    type="text"
                    placeholder="مبلغ کل"
                    value={newStick.totalCost ? formatPriceInput(newStick.totalCost) : ""}
                    onChange={(e) => {
                      const total = parsePriceInput(e.target.value);
                      const q = toNum(newStick.qty) || 1;
                      setNewStick({
                        ...newStick,
                        totalCost: e.target.value === "" ? "" : String(total),
                        unitPrice: e.target.value === "" || q <= 0 ? newStick.unitPrice : String(Math.round(total / q)),
                      });
                    }}
                  />
                </div>
                <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                  <JalaliDatePicker
                    style={{ flex: 1 }}
                    value={newStick.date}
                    onChange={(val) => setNewStick({ ...newStick, date: val })}
                  />
                  <button
                    style={{ ...S.chip, padding: "6px 14px", background: "#8B1A1A", color: "#fff", border: "none", flexShrink: 0 }}
                    onClick={() => {
                      const length = toNum(newStick.length);
                      const qty = Math.max(1, toNum(newStick.qty) || 1);
                      const unitPrice = toNum(newStick.unitPrice);
                      const totalCost = toNum(newStick.totalCost);
                      if (length <= 0) {
                        alert("لطفاً طول معتبر وارد کنید");
                        return;
                      }
                      const finalTotal = totalCost > 0 ? totalCost : Math.round(unitPrice * qty);
                      const finalUnit = unitPrice > 0 ? unitPrice : (qty > 0 ? Math.round(finalTotal / qty) : 0);
                      onAddStick(mat.id, {
                        length,
                        qty,
                        unitPrice: finalUnit,
                        totalCost: finalTotal,
                        date: newStick.date || todayISO(),
                      });
                      if (finalTotal > 0 && onAddPurchase) {
                        onAddPurchase(mat.id, finalTotal, newStick.date || todayISO(), qty);
                      }
                      setNewStick({ length: "", qty: "1", unitPrice: "", totalCost: "", date: todayISO() });
                    }}
                  >
                    + افزودن
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* دکمه‌های بولک/ویرایش/حذف — بالای لیست محصولات لینک‌شده */}
          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
            <button
              style={{ ...S.chip, flex: 1, color: "#7aa8d8" }}
              onClick={() => onBulkApply(mat)}
            >
              افزودن به محصولات
            </button>
            <div style={{ display: "flex", gap: 4 }}>
              <button
                style={{ ...S.chip, color: "#aaa" }}
                onClick={() => onEdit(mat)}
              >
                <Edit3 size={12} />
              </button>
              <button
                style={{ ...S.chip, color: "#e08a8a" }}
                onClick={() => onDelete(mat.id)}
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>

          {/* لیست محصولات متصل — کولپس‌شده با قابلیت اکسپند (مثل ریزهزینه‌ها در تب محصولات) */}
          <div style={{ marginTop: 10, borderTop: "1px dashed #232323", paddingTop: 8, marginBottom: 8 }}>
            {(() => {
              const connectedProducts = (products || []).filter((p) =>
                (p.lineItems || []).some((li) => li.materialId === mat.id)
              );
              return (
                <>
                  <button
                    type="button"
                    onClick={() => setShowLinkedProducts((s) => !s)}
                    style={{
                      display: "flex", alignItems: "center", gap: 6, width: "100%",
                      background: "transparent", border: "none", cursor: "pointer", padding: 0, marginBottom: showLinkedProducts ? 6 : 0
                    }}
                  >
                    <span style={{ fontSize: 9.5, color: "#888", fontWeight: 500 }}>محصولات متصل به این متریال</span>
                    <span style={{ fontSize: 8.5, color: "#555", background: "#1a1a1a", borderRadius: 8, padding: "1px 6px" }}>
                      {connectedProducts.length}
                    </span>
                    <span style={{ marginRight: "auto" }}>
                      {showLinkedProducts ? <ChevronUp size={12} color="#555" /> : <ChevronDown size={12} color="#555" />}
                    </span>
                  </button>

                  {showLinkedProducts && (
                    connectedProducts.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {connectedProducts.map((p) => {
                        const li = p.lineItems.find((item) => item.materialId === mat.id);
                        const isLocked = !!li?.deductedAt;
                        return (
                          <div
                            key={p.id}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              background: "#121212",
                              borderRadius: 6,
                              padding: "4px 8px",
                              fontSize: 9.5,
                              border: "1px solid #1a1a1a"
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                              <span style={{ color: "#eee", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {p.name || "بدون نام"}
                              </span>
                              <span style={{ color: "#666", fontSize: 8 }}>({p.code || "بدون کد"})</span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                              {li?.pct != null && (
                                <span style={{ color: "#b5ccf2", fontSize: 8.5 }}>{li.pct}% مصرف</span>
                              )}
                              {isLocked ? (
                                <span style={{ color: "#5fd180", fontSize: 8, display: "flex", alignItems: "center", gap: 2 }}>
                                  <CheckCircle2 size={10} /> قفل شده
                                </span>
                              ) : (
                                <span style={{ color: "#e08a8a", fontSize: 8, display: "flex", alignItems: "center", gap: 2 }}>
                                  <Unlock size={10} /> معلق
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    ) : (
                      <div style={{ fontSize: 9, color: "#444", fontStyle: "italic" }}>به هیچ محصولی متصل نیست</div>
                    )
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

// ── MaterialEditorModal ──
function MaterialEditor({ material, setMaterial, onSave, onClose, isEdit, closeRequestRef }) {
  useRegisterOpenModal(true);
  const { showToast } = useToast();
  const [errors, setErrors] = useState({});

  // بخش ۳ (تأیید خروج): همون الگوی گالری/کارت‌ویزیت/محصول — اسنپ‌شات اولیه،
  // اگه دیرتی بود X یا Back سخت‌افزاری تاییدیه می‌گیرن نه بستن مستقیم
  const initialSnapshotRef = useRef(material);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const isDirty = () => JSON.stringify(material) !== JSON.stringify(initialSnapshotRef.current);
  const requestClose = () => {
    if (isDirty()) setShowDiscardConfirm(true);
    else onClose();
  };
  useEffect(() => {
    if (closeRequestRef) closeRequestRef.current = requestClose;
    return () => { if (closeRequestRef) closeRequestRef.current = null; };
  });

  const currentType = material.type || "";
  const isFabric = currentType === "fabric";
  const isLinear = currentType === "linear";
  const isArea = currentType === "area";
  const isRatio = currentType === "ratio";
  const isFixed = currentType === "fixed";

  const typeOptions = [
    { key: "fabric", label: "فرش" },
    { key: "linear", label: "خطی" },
    { key: "area", label: "مساحتی" },
    { key: "ratio", label: "نسبتی" },
    { key: "fixed", label: "ابزار" },
  ];

  const handleTypeChange = (typeKey) => {
    setErrors((prev) => ({ ...prev, type: false }));
    setMaterial({ ...material, type: typeKey });
  };

  const handleLocalSave = () => {
    const errs = {};
    if (!material.name?.trim()) {
      errs.name = true;
    }
    if (!material.type) {
      errs.type = true;
    }
    if (!isEdit) {
      if (!material.purchaseQty || toNum(material.purchaseQty) <= 0) {
        errs.purchaseQty = true;
      }
      if (!material.unitCost || toNum(material.unitCost) <= 0) {
        errs.unitCost = true;
      }
      if (!material.totalCost || toNum(material.totalCost) <= 0) {
        errs.totalCost = true;
      }
    }

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      showToast("خطا: لطفاً فیلدهای الزامی متریال را با دقت پر کنید", "error");
      return;
    }

    onSave();
  };

  return (
    <div style={S.overlay}>
      <div style={S.sheet}>
        <div style={S.sheetHeader}>
          <button style={S.iconBtn} onClick={requestClose}>
            <X size={14} color="#aaa" />
          </button>
          <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#F5F0EB" }}>
            {isEdit ? "ویرایش متریال" : "متریال جدید"}
          </span>
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
            }}
            onClick={handleLocalSave}
          >
            ذخیره
          </button>
        </div>
        <div style={{ padding: "12px 14px", overflowY: "auto" }}>
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 9.5, color: "#666", marginBottom: 4 }}>نام متریال <span style={{ color: "#e08a8a" }}>(الزامی)</span></div>
            <input onFocus={(e) => e.target.select()}
              style={{ ...S.input, borderColor: errors.name ? "#ef4444" : "#2a2a2a", background: errors.name ? "#2a1414" : "#1c1c1c" }}
              value={material.name}
              onChange={(e) => {
                setErrors((prev) => ({ ...prev, name: false }));
                setMaterial({ ...material, name: e.target.value });
              }}
            />
          </div>

          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 9.5, color: "#666", marginBottom: 4 }}>نوع <span style={{ color: "#e08a8a" }}>(الزامی)</span></div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", border: errors.type ? "1px solid #ef4444" : "none", borderRadius: 8, padding: errors.type ? 4 : 0 }}>
              {typeOptions.map((opt) => (
                <button
                  key={opt.key}
                  style={{
                    ...S.chip,
                    flex: 1,
                    minWidth: 50,
                    justifyContent: "center",
                    background: currentType === opt.key ? "#2a1414" : "#1c1c1c",
                    border: currentType === opt.key ? "1px solid #8B1A1A" : "1px solid #2a2a2a",
                    color: currentType === opt.key ? "#d88888" : "#777",
                  }}
                  onClick={() => handleTypeChange(opt.key)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Dimensions / Parameters and Quantity in a single horizontal row */}
          {(isFabric || isArea) && (
            <div style={{ marginBottom: 8 }}>
              {isFabric && (
                <>
                  <div style={{ marginBottom: 6 }}>
                    <div style={{ fontSize: 9.5, color: "#666", marginBottom: 4 }}>قدمت تخمینی (سال)</div>
                    <input onFocus={(e) => e.target.select()}
                      style={{ ...S.input }}
                      type="text"
                      placeholder="مثلاً ۵۰"
                      value={material.ageYears != null ? material.ageYears : ""}
                      onChange={(e) => setMaterial({ ...material, ageYears: e.target.value === "" ? null : toNum(e.target.value) })}
                    />
                  </div>
                  <div style={{ marginBottom: 6 }}>
                    <div style={{ fontSize: 9.5, color: "#666", marginBottom: 4 }}>طرح فرش <span style={{ color: "#555" }}>(اختیاری)</span></div>
                    <input onFocus={(e) => e.target.select()}
                      style={{ ...S.input }}
                      type="text"
                      placeholder="مثلاً شاخه شکسته"
                      value={material.pattern || ""}
                      onChange={(e) => setMaterial({ ...material, pattern: e.target.value })}
                    />
                  </div>
                </>
              )}
              <div style={{ display: isEdit ? "block" : "grid", gridTemplateColumns: "1.2fr 1fr", gap: 8 }}>
                <div>
                  <div style={{ fontSize: 9.5, color: "#666", marginBottom: 4 }}>ابعاد (سانتی‌متر)</div>
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <input onFocus={(e) => e.target.select()}
                      style={{ ...S.input, flex: 1, textAlign: "center" }}
                      type="text"
                      placeholder="طول"
                      value={material.dimW || ""}
                      onChange={(e) => setMaterial({ ...material, dimW: toNum(e.target.value) })}
                    />
                    <span style={{ color: "#555" }}>×</span>
                    <input onFocus={(e) => e.target.select()}
                      style={{ ...S.input, flex: 1, textAlign: "center" }}
                      type="text"
                      placeholder="عرض"
                      value={material.dimH || ""}
                      onChange={(e) => setMaterial({ ...material, dimH: toNum(e.target.value) })}
                    />
                  </div>
                </div>
                {!isEdit && (
                  <div>
                    <div style={{ fontSize: 9.5, color: "#666", marginBottom: 4 }}>تعداد خریداری‌شده <span style={{ color: "#e08a8a" }}>(الزامی)</span></div>
                    <input
                      style={{ ...S.input, borderColor: errors.purchaseQty ? "#ef4444" : "#2a2a2a", background: errors.purchaseQty ? "#2a1414" : "#1c1c1c" }}
                      type="text"
                      value={material.purchaseQty || ""}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => {
                        const qtyVal = toNum(e.target.value);
                        const uPrice = toNum(material.unitCost);
                        setErrors((prev) => ({ ...prev, purchaseQty: false }));
                        setMaterial({
                          ...material,
                          purchaseQty: qtyVal,
                          totalCost: qtyVal * uPrice
                        });
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {isLinear && (
            <div style={{ display: isEdit ? "block" : "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 9.5, color: "#666", marginBottom: 4 }}>طول هر شاخه (سانتی‌متر) <span style={{ color: "#e08a8a" }}>(الزامی)</span></div>
                <input onFocus={(e) => e.target.select()}
                  style={S.input}
                  type="text"
                  placeholder="مثلاً 200"
                  value={material.unitLength || ""}
                  onChange={(e) => setMaterial({ ...material, unitLength: toNum(e.target.value) })}
                />
              </div>
              {!isEdit && (
                <div>
                  <div style={{ fontSize: 9.5, color: "#666", marginBottom: 4 }}>تعداد خریداری‌شده <span style={{ color: "#e08a8a" }}>(الزامی)</span></div>
                  <input
                    style={{ ...S.input, borderColor: errors.purchaseQty ? "#ef4444" : "#2a2a2a", background: errors.purchaseQty ? "#2a1414" : "#1c1c1c" }}
                    type="text"
                    value={material.purchaseQty || ""}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const qtyVal = toNum(e.target.value);
                      const uPrice = toNum(material.unitCost);
                      setErrors((prev) => ({ ...prev, purchaseQty: false }));
                      setMaterial({
                        ...material,
                        purchaseQty: qtyVal,
                        totalCost: qtyVal * uPrice
                      });
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {(isRatio || isFixed) && (
            <div style={{ display: isEdit ? "block" : "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 9.5, color: "#666", marginBottom: 4 }}>{isRatio ? "مقدار (عدد)" : "تعداد پیش‌فرض"}</div>
                <input
                  style={S.input}
                  type="text"
                  placeholder="مثلاً 2"
                  value={isRatio ? (material.ratioValue || "") : (material.fixedQty || "")}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => {
                    const val = toNum(e.target.value);
                    if (isRatio) {
                      setMaterial({ ...material, ratioValue: val });
                    } else {
                      setMaterial({ ...material, fixedQty: val });
                    }
                  }}
                />
              </div>
              {!isEdit && (
                <div>
                  <div style={{ fontSize: 9.5, color: "#666", marginBottom: 4 }}>تعداد خریداری‌شده <span style={{ color: "#e08a8a" }}>(الزامی)</span></div>
                  <input
                    style={{ ...S.input, borderColor: errors.purchaseQty ? "#ef4444" : "#2a2a2a", background: errors.purchaseQty ? "#2a1414" : "#1c1c1c" }}
                    type="text"
                    value={material.purchaseQty || ""}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const qtyVal = toNum(e.target.value);
                      const uPrice = toNum(material.unitCost);
                      setErrors((prev) => ({ ...prev, purchaseQty: false }));
                      setMaterial({
                        ...material,
                        purchaseQty: qtyVal,
                        totalCost: qtyVal * uPrice
                      });
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {isLinear && (
            <div style={{ fontSize: 8.5, color: "#444", marginBottom: 8 }}>توجه: طول شاخه را منحصراً به سانتی‌متر (cm) وارد کنید. تعداد شاخه‌ها را هنگام افزودن چوب مشخص کنید.</div>
          )}

          {!isEdit && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8, marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 9.5, color: "#666", marginBottom: 4 }}>قیمت واحد (تومان) <span style={{ color: "#e08a8a" }}>(الزامی)</span></div>
                  <input onFocus={(e) => e.target.select()}
                    style={{ ...S.input, borderColor: errors.unitCost ? "#ef4444" : "#2a2a2a", background: errors.unitCost ? "#2a1414" : "#1c1c1c" }}
                    type="text"
                    value={material.unitCost ? formatPriceInput(material.unitCost) : ""}
                    onChange={(e) => {
                      const uPrice = parsePriceInput(e.target.value);
                      const qtyVal = toNum(material.purchaseQty);
                      setErrors((prev) => ({ ...prev, unitCost: false }));
                      setMaterial({
                        ...material,
                        unitCost: uPrice,
                        totalCost: qtyVal * uPrice
                      });
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 9.5, color: "#666", marginBottom: 4 }}>قیمت کل (تومان) <span style={{ color: "#e08a8a" }}>(الزامی)</span></div>
                <input onFocus={(e) => e.target.select()}
                  style={{ ...S.input, borderColor: errors.totalCost ? "#ef4444" : "#2a2a2a", background: errors.totalCost ? "#2a1414" : "#1c1c1c" }}
                  type="text"
                  value={material.totalCost ? formatPriceInput(material.totalCost) : ""}
                  onChange={(e) => {
                    const totalVal = parsePriceInput(e.target.value);
                    const qtyVal = toNum(material.purchaseQty);
                    const recalculatedUnitCost = qtyVal > 0 ? Math.round(totalVal / qtyVal) : toNum(material.unitCost);
                    setErrors((prev) => ({ ...prev, totalCost: false }));
                    setMaterial({
                      ...material,
                      totalCost: totalVal,
                      unitCost: recalculatedUnitCost
                    });
                  }}
                />
              </div>
            </>
          )}

          {isEdit && (isFixed || isRatio || isArea || isFabric) && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 9.5, color: "#666", marginBottom: 4 }}>
                موجودی فعلی ({isArea || isFabric ? "تعداد/مقدار" : "تعداد"}) — برای اصلاح دستی
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <div style={{ fontSize: 8.5, color: "#555", marginBottom: 3 }}>مجموع کل خریداری‌شده</div>
                  <input
                    style={S.input}
                    type="text"
                    inputMode="numeric"
                    placeholder="—"
                    value={material.totalQty ?? ""}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const val = e.target.value === "" ? null : toNum(e.target.value);
                      setMaterial({ ...material, totalQty: val });
                    }}
                  />
                </div>
                <div>
                  <div style={{ fontSize: 8.5, color: "#555", marginBottom: 3 }}>باقیمانده‌ی قابل‌استفاده</div>
                  <input
                    style={S.input}
                    type="text"
                    inputMode="numeric"
                    placeholder="—"
                    value={material.remainingQty ?? ""}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const val = e.target.value === "" ? null : toNum(e.target.value);
                      setMaterial({ ...material, remainingQty: val });
                    }}
                  />
                </div>
              </div>
              <div style={{ fontSize: 8, color: "#555", marginTop: 3 }}>
                این دو فیلد استخر تعداد فعلی متریال هستن؛ فقط برای اصلاح دستی (مثلاً اشتباه شمارش) استفاده کن — برای افزودن خرید جدید از «بچ جدید» یا «افزودن به موجودی» استفاده کن
              </div>
            </div>
          )}

          <div style={{ marginBottom: 8 }}>
            <JalaliDatePicker
              value={material.purchaseDate || todayISO()}
              onChange={(val) => setMaterial({ ...material, purchaseDate: val })}
            />
          </div>
        </div>
      </div>
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

// ── MaterialTab اصلی ──
export default function MaterialTab({
  materials,
  products,
  setData,
  onRequestDelete,
  onAddPurchase,
  onAddBatch,
  onUpdateBatch,
  onDeleteBatch,
  onLockBatch,
  onUnlockBatch,
  onAddStick,
  onUpdateStick,
  onDeleteStick,
  onUpdateProcurement,
  onDeleteProcurement,
  onBulkApply,
  notify,
  sortOrder = "code",
  setSortOrder,
  stickyTop = 88,
  pendingBulkChanges,
  refreshResetTick,
}) {
  const [search, setSearch] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const toggleGroup = (name) => setCollapsedGroups(prev => ({ ...prev, [name]: !prev[name] }));
  const [openId, setOpenId] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newMat, setNewMat] = useState(() => ({
    ...emptyMaterial(),
    purchaseDate: todayISO(),
  }));
  const [editingMat, setEditingMat] = useState(null);
  const [bulkFor, setBulkFor] = useState(null);
  // دکمه‌ی Back گوشی: هرکدوم از این پنل‌ها باز باشه، با Back فقط همون بسته بشه
  useEffect(() => {
    if (!bulkFor) return;
    return pushBackHandler(() => setBulkFor(null));
  }, [bulkFor]);
  // اگه فرم متریال دیرتی باشه، Back سخت‌افزاری هم باید همون تاییدیه‌ی «لغو کنید؟»
  // رو نشون بده، نه این‌که مستقیم و بی‌سروصدا ببنده (همون فیکسی که برای محصولات شد)
  const materialEditorCloseRef = useRef(null);
  useEffect(() => {
    if (!editingMat) return;
    return pushBackHandler(() => {
      if (materialEditorCloseRef.current) materialEditorCloseRef.current();
      else setEditingMat(null);
    });
  }, [editingMat]);
  useEffect(() => {
    if (!showAdd) return;
    return pushBackHandler(() => {
      if (materialEditorCloseRef.current) materialEditorCloseRef.current();
      else setShowAdd(false);
    });
  }, [showAdd]);
  const [matGroupFilter, setMatGroupFilter] = useState([]); // آرایه‌ی چند-انتخابی؛ خالی = همه
  const [floatingCatLabel, setFloatingCatLabel] = useState("");
  const groupSectionRefs = useRef({});
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const [groupedView, setGroupedView] = useState(() => {
    try {
      return localStorage.getItem("material_grouped_view") !== "false"; // پیش‌فرض روشن
    } catch (_) {
      return true;
    }
  });
  const toggleGroupedView = () => {
    const next = !groupedView;
    setGroupedView(next);
    try {
      localStorage.setItem("material_grouped_view", String(next));
    } catch (_) {}
  };
  const [showZeroBalance, setShowZeroBalance] = useState(() => {
    try {
      return localStorage.getItem("material_show_zero_balance") === "true";
    } catch (_) {
      return false;
    }
  });

  const { stockFilter, setStockFilter, showStockMenu, setShowStockMenu, menuRef, getStockLabel } =
    useStockFilter();

  // Refresh (تک‌ضربه) → ریست کامل فیلتر جستجو/موجودی/گروه‌بندی/هاید به پیش‌فرض
  useEffect(() => {
    if (!refreshResetTick) return;
    setSearch("");
    setStockFilter("all");
    setShowStockMenu(false);
    if (setSortOrder) setSortOrder("name");
    setMatGroupFilter([]);
    setShowTypeMenu(false);
    setCollapsedGroups({});
    setGroupedView(true);
    try { localStorage.setItem("material_grouped_view", "true"); } catch (_) {}
    setShowZeroBalance(false);
    try { localStorage.setItem("material_show_zero_balance", "false"); } catch (_) {}
  }, [refreshResetTick]);

  const toggleZeroBalance = () => {
    const next = !showZeroBalance;
    setShowZeroBalance(next);
    try {
      localStorage.setItem("material_show_zero_balance", String(next));
    } catch (_) {}
  };

  const sortFn = (a, b) => {
    const baseOrder = String(sortOrder || "").replace(/_desc$/, "");
    const isDesc = String(sortOrder || "").endsWith("_desc");
    let cmp;
    switch (baseOrder) {
      case "az":
        cmp = a.name?.localeCompare(b.name, "fa") || 0;
        break;
      case "date":
        cmp = (b.purchaseDate || b.createdAt || "").localeCompare(a.purchaseDate || a.createdAt || "");
        break;
      case "stock":
        cmp = (b.remainingCost || 0) - (a.remainingCost || 0);
        break;
      case "code":
      default:
        cmp = (a.id || "").localeCompare(b.id || "");
        break;
    }
    return isDesc ? -cmp : cmp;
  };

  const filtered = (materials || [])
    .filter((m) => {
      if (search.trim() && !m.name.toLowerCase().includes(search.trim().toLowerCase())) return false;
      if (matGroupFilter.length > 0 && !matGroupFilter.includes(m.type)) return false;

      const remaining = m.remainingCost != null ? toNum(m.remainingCost) : toNum(m.totalCost);
      if (stockFilter === "available" && remaining <= 0) return false;
      if (stockFilter === "finished" && remaining > 0) return false;

      return true;
    })
    .sort(sortFn);

  const counts = useMemo(() => {
    const all = materials || [];
    return {
      all: all.length,
      fabric: all.filter((m) => m.type === "fabric").length,
      linear: all.filter((m) => m.type === "linear").length,
      area: all.filter((m) => m.type === "area").length,
      ratio: all.filter((m) => m.type === "ratio").length,
      fixed: all.filter((m) => m.type === "fixed").length,
    };
  }, [materials]);

  const filterOptions = [
    { key: "all", label: "همه", count: counts.all },
    { key: "fabric", label: "فرش", count: counts.fabric },
    { key: "linear", label: "خطی", count: counts.linear },
    { key: "area", label: "مساحتی", count: counts.area },
    { key: "ratio", label: "نسبتی", count: counts.ratio },
    { key: "fixed", label: "ابزار", count: counts.fixed },
  ];

  // لیبل شناور دسته هنگام اسکرول
  useEffect(() => {
    if (!groupedView) { setFloatingCatLabel(""); return; }
    const onScroll = () => {
      const panelEl = document.querySelector('div[style*="position: fixed"]');
      const scrollY = panelEl ? panelEl.scrollTop : (window.scrollY || document.documentElement.scrollTop || 0);
      // بالای بالا: هیچ گروهی هنوز پشتِ هدر نرفته، لیبل شناور لازم نیست
      if (scrollY <= 0) { setFloatingCatLabel(""); return; }

      const entries = Object.entries(groupSectionRefs.current || {});
      const headerBottom = (typeof stickyTop !== "undefined" ? stickyTop : 88) + 96; // پایینِ بلوکِ هدرِ sticky (تقریبی)
      let current = "";
      let best = -Infinity;
      for (const [name, el] of entries) {
        if (!el) continue;
        const top = el.getBoundingClientRect().top;
        // فقط گروهی که هدر واقعیش زیر هدر sticky رفته (دیگه دیده نمی‌شه) کاندید می‌شه
        if (top < headerBottom && top > best) { best = top; current = name; }
      }
      // اگر گروهِ کاندید هنوز واقعاً روی صفحه دیده می‌شه (هدر خودش زیر sticky نرفته)، لیبل رو نشون نده
      if (current) {
        const el = groupSectionRefs.current[current];
        const top = el ? el.getBoundingClientRect().top : -Infinity;
        if (top >= headerBottom) current = "";
      }
      setFloatingCatLabel(current);
    };
    window.addEventListener("scroll", onScroll, true);
    document.addEventListener("scroll", onScroll, true);
    // پنل fixed هم اسکرول می‌شود
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
  }, [groupedView]);


  const handleToggle = (id) => setOpenId((o) => {
    const next = o === id ? null : id;
    return next;
  });

  const handleAddMaterial = () => {
    if (!newMat.name.trim()) {
      notify?.("لطفاً نام متریال را وارد کنید");
      return;
    }
    if (!newMat.type) {
      notify?.("لطفاً نوع متریال را انتخاب کنید");
      return;
    }
    const totalCost = toNum(newMat.totalCost);
    const purchaseDate = newMat.purchaseDate || todayISO();
    const initialQty = toNum(newMat.purchaseQty) > 0 ? toNum(newMat.purchaseQty) : 1;

    // بخش ۱۱ (آخرین چک‌باکس باقی‌مونده): «اولین بچ = همون خریدی که موقع
    // افزودن اولیه‌ی متریال ثبت می‌شه». قبلاً موقع افزودن متریال جدید فقط
    // totalCost/purchaseDate بالای خودِ متریال ست می‌شد و procurements/
    // batches/sticks خالی می‌موند؛ کاربر باید بعداً دستی یه «خرید» دیگه هم
    // برای همون مبلغ اول ثبت می‌کرد. الان دقیقاً همون کاری که onAddPurchase
    // برای خریدهای بعدی می‌کنه، همین‌جا هم برای همون خرید اول انجام می‌شه.
    const newMaterial = {
      ...newMat,
      id: uid(),
      totalCost,
      remainingCost: totalCost,
      totalQty: initialQty,
      remainingQty: initialQty,
      purchaseDate,
      hidden: false,
      procurements: totalCost > 0
        ? [{ id: uid(), date: purchaseDate, total: totalCost, unitPrice: initialQty > 0 ? totalCost / initialQty : totalCost, qty: initialQty }]
        : [],
    };

    if ((newMat.type === "area" || newMat.type === "fabric") && totalCost > 0) {
      newMaterial.batches = [{
        ...emptyBatch(),
        label: `خرید اولیه ${fmtDate(purchaseDate)}`,
        width: toNum(newMat.dimW) || 0,
        height: toNum(newMat.dimH) || 0,
        totalCost,
        date: purchaseDate,
      }];
    } else if (newMat.type === "linear" && totalCost > 0) {
      newMaterial.sticks = [{
        ...emptyStick(),
        length: toNum(newMat.unitLength) || 0,
        qty: initialQty,
        date: purchaseDate,
      }];
    }

    setData((d) => ({
      ...d,
      materials: [...d.materials, newMaterial],
    }));
    setNewMat({ ...emptyMaterial(), purchaseDate: todayISO() });
    setShowAdd(false);
    notify && notify("متریال اضافه شد");
  };

  const handleSaveEdit = () => {
    if (!editingMat.name.trim()) {
      notify?.("لطفاً نام متریال را وارد کنید");
      return;
    }
    if (!editingMat.type) {
      notify?.("لطفاً نوع متریال را انتخاب کنید");
      return;
    }
    setData((d) => {
      const prev = (d.materials || []).find((m) => m.id === editingMat.id);
      const oldName = prev?.name || "";
      const newName = editingMat.name.trim();
      const materials = d.materials.map((m) =>
        m.id === editingMat.id
          ? {
              ...m,
              name: newName,
              type: editingMat.type,
              purchaseDate: editingMat.purchaseDate,
              dimW: editingMat.dimW,
              dimH: editingMat.dimH,
              unitLength: editingMat.unitLength,
              ratioValue: editingMat.ratioValue,
              fixedQty: editingMat.fixedQty,
              ageYears: editingMat.ageYears,
              pattern: editingMat.pattern,
            }
          : m
      );
      // اگر فرش تغییر نام داد، دسته/گروه محصولات و نام فرش متصل هم آپدیت شود
      let products = d.products || [];
      if (editingMat.type === "fabric" && oldName && newName && oldName !== newName) {
        products = products.map((p) => {
          let changed = false;
          let next = { ...p };
          if (p.fabricMaterialId === editingMat.id) {
            next.group = newName;
            next.fabricName = newName;
            changed = true;
          } else if (p.group === oldName || p.fabricName === oldName) {
            next.group = newName;
            next.fabricName = newName;
            changed = true;
          }
          // لیبل lineItem مربوط به این فرش
          if (Array.isArray(p.lineItems)) {
            const lis = p.lineItems.map((li) => {
              if (li.materialId === editingMat.id) {
                return { ...li, label: li.label && String(li.label).includes(oldName) ? String(li.label).replace(oldName, newName) : (li.label || newName) };
              }
              return li;
            });
            if (lis.some((li, i) => li !== p.lineItems[i])) {
              next.lineItems = lis;
              changed = true;
            }
          }
          return changed ? next : p;
        });
      }
      return { ...d, materials, products };
    });
    setEditingMat(null);
    notify && notify("متریال ویرایش شد");
  };

  const renderFlatList = () => {
    const visibleFlat = showZeroBalance
      ? allFiltered
      : allFiltered.filter((m) => {
          if (m.hidden) return false;
          const rem = m.remainingCost != null ? toNum(m.remainingCost) : toNum(m.totalCost);
          const total = toNum(m.totalCost);
          if (rem <= 0 && total > 0) return false;
          return true;
        });
    const hiddenCountFlat = allFiltered.length - visibleFlat.length;

    if (visibleFlat.length === 0 && hiddenCountFlat === 0) {
      return <div style={{ fontSize: 10.5, color: "#444", padding: "16px 0", textAlign: "center" }}>آیتمی وجود ندارد</div>;
    }

    return (
      <div>
        {visibleFlat.map((m) => (
          <MaterialCard
            key={m.id}
            mat={m}
            products={products}
            expanded={openId === m.id}
            onToggle={() => handleToggle(m.id)}
            onEdit={(m) => setEditingMat({ ...m })}
            onDelete={(id) => {
              onRequestDelete && onRequestDelete(id);
            }}
            onToggleHidden={(id) =>
              setData((d) => ({
                ...d,
                materials: d.materials.map((mm) => (mm.id === id ? { ...mm, hidden: !mm.hidden } : mm)),
              }))
            }
            onAddPurchase={onAddPurchase}
            onAddBatch={onAddBatch}
            onUpdateBatch={onUpdateBatch}
            onDeleteBatch={onDeleteBatch}
            onLockBatch={onLockBatch}
            onUnlockBatch={onUnlockBatch}
            onAddStick={onAddStick}
            onUpdateStick={onUpdateStick}
            onDeleteStick={onDeleteStick}
            onUpdateProcurement={onUpdateProcurement}
            onDeleteProcurement={onDeleteProcurement}
            onBulkApply={(m) => setBulkFor(m)}
          />
        ))}
        {hiddenCountFlat > 0 && (
          <button
            style={{
              fontSize: 10,
              color: "#555",
              background: "transparent",
              border: "1px dashed #2a2a2a",
              borderRadius: 7,
              padding: "6px 12px",
              cursor: "pointer",
              fontFamily: "inherit",
              width: "100%",
              marginTop: 4,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
            onClick={toggleZeroBalance}
          >
            {showZeroBalance ? <Eye size={12} /> : <EyeOff size={12} />}
            {showZeroBalance ? "پنهان کردن موارد مخفی" : `${hiddenCountFlat} آیتم مخفی شده`}
          </button>
        )}
      </div>
    );
  };

  const renderGroup = (title, group) => {
    const isTuckedAway = (m) => {
      if (m.hidden) return true; // دستی هاید شده
      const rem = m.remainingCost != null ? toNum(m.remainingCost) : toNum(m.totalCost);
      const total = toNum(m.totalCost);
      return rem <= 0 && total > 0; // کاملاً تموم شده
    };
    const visibleGroup = (showZeroBalance ? group : group.filter((m) => !isTuckedAway(m)));
    const hiddenCount = group.length - visibleGroup.length;

    return (
      <div
        style={{ marginBottom: 16 }}
        ref={(el) => {
          if (el) groupSectionRefs.current[title] = el;
          else delete groupSectionRefs.current[title];
        }}
        data-mat-group={title}
      >
        <button
          style={{
            width: "100%",
            background: "transparent",
            border: "none",
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "14px 2px 6px",
            cursor: "pointer",
            textAlign: "right"
          }}
          onClick={() => toggleGroup(title)}
        >
          <span style={{ fontSize: 10, color: "#666", fontWeight: 600 }}>{title}</span>
          <span style={{ fontSize: 9, color: "#444", background: "#1a1a1a", borderRadius: 8, padding: "1px 6px" }}>
            {visibleGroup.length}
          </span>
          <span style={{ marginRight: "auto", display: "flex", alignItems: "center" }}>
            {collapsedGroups[title] ? <ChevronDown size={12} color="#444" /> : <ChevronUp size={12} color="#444" />}
          </span>
        </button>

        {!collapsedGroups[title] && (
          <>
        {visibleGroup.length === 0 && hiddenCount === 0 && (
          <div style={{ fontSize: 10.5, color: "#444", padding: "8px 0" }}>آیتمی وجود ندارد</div>
        )}
        {visibleGroup.map((m) => (
          <MaterialCard
            key={m.id}
            mat={m}
            products={products}
            expanded={openId === m.id}
            onToggle={() => handleToggle(m.id)}
            onEdit={(m) => setEditingMat({ ...m })}
            onDelete={(id) => {
              onRequestDelete && onRequestDelete(id);
            }}
            onToggleHidden={(id) =>
              setData((d) => ({
                ...d,
                materials: d.materials.map((mm) => (mm.id === id ? { ...mm, hidden: !mm.hidden } : mm)),
              }))
            }
            onAddPurchase={onAddPurchase}
            onAddBatch={onAddBatch}
            onUpdateBatch={onUpdateBatch}
            onDeleteBatch={onDeleteBatch}
            onLockBatch={onLockBatch}
            onUnlockBatch={onUnlockBatch}
            onAddStick={onAddStick}
            onUpdateStick={onUpdateStick}
            onDeleteStick={onDeleteStick}
            onUpdateProcurement={onUpdateProcurement}
            onDeleteProcurement={onDeleteProcurement}
            onBulkApply={(m) => setBulkFor(m)}
          />
        ))}
        {hiddenCount > 0 && (
          <button
            style={{
              fontSize: 10,
              color: "#555",
              background: "transparent",
              border: "1px dashed #2a2a2a",
              borderRadius: 7,
              padding: "6px 12px",
              cursor: "pointer",
              fontFamily: "inherit",
              width: "100%",
              marginTop: 4,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
            onClick={toggleZeroBalance}
          >
            {showZeroBalance ? <Eye size={12} /> : <EyeOff size={12} />}
            {showZeroBalance
              ? "پنهان کردن دوباره"
              : `${hiddenCount} آیتم مخفی شده`}
          </button>
        )}
                </>
        )}
      </div>
    );
  };

  const allFiltered = filtered;

  const fabricGroup = allFiltered.filter((m) => m.type === "fabric");
  const linearGroup = allFiltered.filter((m) => m.type === "linear");
  const areaGroup = allFiltered.filter((m) => m.type === "area");
  const ratioGroup = allFiltered.filter((m) => m.type === "ratio");
  const fixedGroup = allFiltered.filter((m) => m.type === "fixed");
  const uncategorizedGroup = allFiltered.filter((m) => !["fabric", "linear", "area", "ratio", "fixed"].includes(m.type));

  const isAllTypesSelected = matGroupFilter.length === 0;
  const showFabric = isAllTypesSelected || matGroupFilter.includes("fabric");
  const showLinear = isAllTypesSelected || matGroupFilter.includes("linear");
  const showArea = isAllTypesSelected || matGroupFilter.includes("area");
  const showRatio = isAllTypesSelected || matGroupFilter.includes("ratio");
  const showFixed = isAllTypesSelected || matGroupFilter.includes("fixed");
  const showUncategorized = isAllTypesSelected;

  return (
    <div style={{ padding: "0 0 100px 0" }} dir="rtl">
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
          <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", background: "#161616", border: "1px solid #232323", borderRadius: 8, padding: "6px 10px", gap: 6 }}>
            <Search size={13} color="#555" style={{ flexShrink: 0 }} />
            <input onFocus={(e) => e.target.select()}
              style={{ background: "transparent", border: "none", outline: "none", color: "#ddd", fontSize: 11, flex: 1, minWidth: 0, fontFamily: "inherit" }}
              placeholder="جستجو..."
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

          <div style={{ position: "relative", flexShrink: 0 }}>
            <button
              style={{
                ...S.chip,
                padding: "6px 8px",
                fontSize: 10,
                position: "relative",
                display: "flex",
                alignItems: "center",
                gap: 4,
                background: matGroupFilter.length > 0 ? "#2a1414" : "#1c1c1c",
                border: matGroupFilter.length > 0 ? "1px solid #8B1A1A" : "1px solid #2a2a2a",
                color: matGroupFilter.length > 0 ? "#d88888" : "#888",
              }}
              onClick={() => setShowTypeMenu((v) => !v)}
              title="نوع متریال"
            >
              <Tag size={12} style={{ flexShrink: 0 }} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 90 }}>
                {matGroupFilter.length === 0
                  ? "همه"
                  : filterOptions.filter((o) => matGroupFilter.includes(o.key)).map((o) => o.label).join("،")}
              </span>
            </button>
            <FilterPopup open={showTypeMenu} onClose={() => setShowTypeMenu(false)} width={170}>
              {filterOptions.map((opt) => {
                const isAllOpt = opt.key === "all";
                const isSelected = isAllOpt ? matGroupFilter.length === 0 : matGroupFilter.includes(opt.key);
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
                      if (isAllOpt) {
                        setMatGroupFilter([]);
                        return;
                      }
                      setMatGroupFilter((prev) => {
                        let next = prev.includes(opt.key) ? prev.filter((k) => k !== opt.key) : [...prev, opt.key];
                        const typeKeys = filterOptions.filter((o) => o.key !== "all").map((o) => o.key);
                        if (typeKeys.length > 0 && typeKeys.every((k) => next.includes(k))) next = [];
                        return next;
                      });
                    }}
                  >
                    {opt.label} ({opt.count})
                  </button>
                );
              })}
            </FilterPopup>
          </div>

          {allFiltered.some((m) => m.hidden || (() => {
            const rem = m.remainingCost != null ? toNum(m.remainingCost) : toNum(m.totalCost);
            const total = toNum(m.totalCost);
            return rem <= 0 && total > 0;
          })()) && (
            <button
              type="button"
              title={showZeroBalance ? "پنهان کردن موارد مخفی" : "نمایش موارد مخفی"}
              style={{
                ...S.chip,
                flexShrink: 0,
                padding: "6px 8px",
                display: "flex",
                alignItems: "center",
                gap: 3,
                ...(showZeroBalance ? { background: "#2a1414", border: "1px solid #8B1A1A", color: "#d88888" } : {}),
              }}
              onClick={toggleZeroBalance}
            >
              {showZeroBalance ? <Eye size={12} /> : <EyeOff size={12} />}
            </button>
          )}

          <div style={{ position: "relative" }} ref={menuRef}>
            <button
              style={{
                ...S.chip,
                padding: "6px 10px",
                fontSize: 10,
                position: "relative",
                background: stockFilter !== "all" ? "#2a1414" : "#1c1c1c",
                border: stockFilter !== "all" ? "1px solid #8B1A1A" : "1px solid #2a2a2a",
                color: stockFilter !== "all" ? "#d88888" : "#888",
              }}
              onClick={() => setShowStockMenu(!showStockMenu)}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Package size={11} style={stockFilter !== "all" ? { marginLeft: 4 } : {}} /> {stockFilter !== "all" && getStockLabel()}
              </div>
            </button>
            <FilterPopup open={showStockMenu} onClose={() => setShowStockMenu(false)} width={160}>
              {[
                { key: "all", label: "همه" },
                { key: "available", label: "موجود" },
                { key: "finished", label: "تمام شده" },
              ].map((opt) => (
                <div
                  key={opt.key}
                  style={{
                    padding: "8px 10px",
                    fontSize: 11,
                    color: stockFilter === opt.key ? "#d88888" : "#ddd",
                    cursor: "pointer",
                    background: stockFilter === opt.key ? "#2a1414" : "transparent",
                    borderRadius: 4,
                    marginBottom: 2,
                  }}
                  onClick={() => {
                    setStockFilter(opt.key);
                    setShowStockMenu(false);
                  }}
                >
                  {opt.label}
                </div>
              ))}
            </FilterPopup>
          </div>

          <SortButton sortOrder={sortOrder} setSortOrder={setSortOrder} modes={SORT_MODES} style={{}} groupedView={groupedView} onToggleGrouped={toggleGroupedView} />
        </div>

        {groupedView && floatingCatLabel ? (
          <div
            onClick={() => {
              const el = groupSectionRefs.current[floatingCatLabel];
              if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            style={{
              // دیگه sticky جدا نیست: همون بلوک هدر (که خودش sticky هست) رو حمل می‌کنه،
              // پس همیشه دقیقاً زیر ردیف Sort می‌شینه و هیچ‌وقت روی هدر جستجو نمیاد
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
          {showFabric && renderGroup("فرش", fabricGroup)}
          {showLinear && renderGroup("خطی", linearGroup)}
          {showArea && renderGroup("مساحتی", areaGroup)}
          {showRatio && renderGroup("نسبتی", ratioGroup)}
          {showFixed && renderGroup("ابزار", fixedGroup)}
          {showUncategorized && uncategorizedGroup.length > 0 && renderGroup("بدون دسته‌بندی (خطا)", uncategorizedGroup)}
        </>
      ) : (
        renderFlatList()
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
        }}
        onClick={() => setShowAdd(true)}
      >
        <Plus size={22} />
      </button>

      {showAdd && (
        <MaterialEditor
          material={newMat}
          setMaterial={setNewMat}
          onSave={handleAddMaterial}
          onClose={() => {
            setShowAdd(false);
            setNewMat({ ...emptyMaterial(), purchaseDate: todayISO() });
          }}
          closeRequestRef={materialEditorCloseRef}
        />
      )}
      {editingMat && (
        <MaterialEditor
          material={editingMat}
          setMaterial={setEditingMat}
          onSave={handleSaveEdit}
          onClose={() => setEditingMat(null)}
          isEdit
          closeRequestRef={materialEditorCloseRef}
        />
      )}
      {bulkFor && (
        <BulkApplyMaterialPage
          material={bulkFor}
          products={products}
          allMaterials={materials}
          setData={setData}
          onApply={onBulkApply}
          onClose={() => setBulkFor(null)}
        />
      )}
    </div>
  );
}