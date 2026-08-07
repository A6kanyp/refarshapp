// ============================================================
// dataModels.js - Refarsh Clean (نسخه نهایی با فیلدهای جدید)
// ============================================================

export const STORAGE_KEY = "refarsh_app_data_v6";
export const SCHEMA_VERSION = 6;

export const GALLERY_COLOR_PALETTE = [
  "#A6CEE3", "#1F78B4", "#B2DF8A", "#33A02C",
  "#FB9999", "#E31A1C", "#FDBF6F", "#FF7F00",
  "#CAB2D6", "#00FFFF", "#FFFF00", "#FFAA00",
];

export const MATERIAL_TYPES = [
  { key: "purchased", label: "خریداری شده" },
  { key: "made", label: "ساخته شده" },
  { key: "hardware_tool", label: "ابزار" },
];

export const PRODUCT_STATES = {
  DRAFT: "draft",
  BUILT: "built",
  AVAILABLE: "available",
  SOLD: "sold",
};

export const DEFAULT_COST_LABELS = [
  "تابلو فرش", "قاب", "شاسی", "MDF پشت", "میخ/چسب", "بسته‌بندی",
];

export function uid() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 9)}`;
}

export function emptyBusinessCard() {
  return {
    id: uid(),
    creditAllowed: true,
    name: "",
    phone: "",
    address: "",
    website: "",
    instagram: "",
    linkedin: "",
    telegram: "",
    whatsapp: "",
    email: "",
    note: "",
    isMine: false,
  };
}

export function emptyProduct() {
  return {
    id: uid(),
    code: "",
    group: "",
    name: "",
    dims: "",
    dimW: null,
    dimH: null,
    description: "", // توضیحات دلخواه چندخطی، زیر ابعاد توی کاتالوگ/محصولات نمایش داده می‌شه
    qty: 1,
    shape: "rectangle",
    images: [], // آرایه‌ای از نام فایل‌های تصاویر
    image: null, // تصویر اصلی (نام فایل یا base64)
    lineItems: [],
    salePrice: 0,
    profitPct: 30,
    status: "available",
    location: "warehouse",
    settled: false,
    buyerName: "",
    buyerCustomerId: null,
    buyerPhone: "",
    saleDate: null,
    settleDate: null,
    discountPercent: 0,
    discountedPrice: 0,
    createdAt: new Date().toISOString(),
    galleryOwnerName: "",
    expanded: false,
    fabricCoveragePct: 100,
    // فیلد جدید برای ذخیره‌سازی موقت مصرف در حین ویرایش
    _tempConsumptions: {},
    // برچسب «کالیگرافی» — یه تگ اضافه، جایگزین نوع اصلی محصول (productTypeId) نمی‌شه.
    // یه محصول می‌تونه هم‌زمان توی نوع اصلی‌ش (مثلاً تابلوفرش) دسته‌بندی بمونه و هم
    // این تگ روش باشه (برای فیلتر/گروه‌بندی جداگانه‌ی «کالیگرافی»)
    isCalligraphy: false,
  };
}

export function emptyMaterial() {
  return {
    id: uid(),
    creditAllowed: true,
    name: "",
    type: "", // fabric, linear, area, ratio, fixed
    category: "",
    totalCost: 0,
    remainingCost: 0,
    totalQty: null, // مجموع تعداد/واحد خریداری‌شده در طول عمر متریال (استخر مقدار)
    remainingQty: null, // باقیمانده تعداد/واحد قابل استفاده (استخر مقدار)
    procurements: [],
    batches: [],
    sticks: [],
    isHardwareTool: false,
    includeInCost: true,
    hidden: false,
    purchaseDate: null,
    purchaseQty: 1,
    // فیلدهای اختصاصی هر نوع
    dimW: null,
    dimH: null,
    unitLength: null,
    ratioValue: 1,
    fixedQty: 1,
    defaultPct: 100,
  };
}

export function emptyCustomer() {
  return {
    id: uid(),
    creditAllowed: true,
    name: "",
    galleryOwnerName: "",
    phone: "",
    kind: "customer",
    color: GALLERY_COLOR_PALETTE[0],
    note: "",
  };
}

export function emptyLineItem(label = "") {
  return {
    id: uid(),
    label: label,
    cost: 0,
    materialId: null,
    pct: null, // درصد مصرف (برای نوع ratio)
    batchId: null,
    useAreaRatio: false,
    includeWastage: false,
    manualArea: null,
    deductedCost: null, // مبلغ کسر شده از متریال
    deductedQty: null, // مقدار (تعداد/متراژ) کسر شده از استخر متریال - برای بازگشت دقیق هنگام آزادسازی
    deductedAt: null, // تاریخ کسر (اگر null باشد یعنی pending)
    pendingUnlock: false, // در صف آزادسازی توسط دکمه رفرش
    bulkSessionId: null, // شناسه‌ی دسته‌ی قفل‌شده (برای گروه‌بندی و جداکننده در نمایش بولک)
    pendingSessionId: null, // شناسه‌ی سشن بولک قبل از قفل شدن (تا زمان قفل، این شناسه حفظ می‌شود و به bulkSessionId تبدیل می‌شود)
    woodCuts: null,
    woodLocked: false,
    // فیلد جدید برای ذخیره‌سازی درصد دستی در حالت resize
    customPct: null,
  };
}

export function emptyBatch() {
  return {
    id: uid(),
    label: "",
    width: 0,
    height: 0,
    totalCost: 0,
    date: "",
    locked: false,
    linkedProductIds: [],
  };
}

export function emptyStick() {
  return {
    id: uid(),
    length: 0,
    qty: 1,
    date: null, // بخش ۱۱: تاریخ خرید مستقل هر چوب (هم‌راستا با date روی batch)
  };
}

export function emptyProductType() {
  return {
    id: uid(),
    name: "",
  };
}

export function emptyWorkshopLink() {
  return {
    id: uid(),
    productId: null,
    materialId: null,
    frameId: null,
  };
}

export function getDefaultData() {
  return {
    __schemaVersion: SCHEMA_VERSION,
    products: [],
    materials: [],
    customers: [],
    equipment: [],
    workshopLinks: [],
    myBusinessCard: { ...emptyBusinessCard(), name: "استودیو فرش و دکور ریفرش", isMine: true },
    businessCards: [],
    woodCuttingSessions: [],
    auditLog: [],
    productTypes: [],
    invoiceDrafts: [],
    // صف قفل/آزادسازی — قبلاً فقط توی حافظه (useRef) بود و با رفرش/بستن اپ پاک
    // می‌شد؛ طبق دستور صریح مالک الان توی خودِ دیتابیس ذخیره می‌شه (پس با
    // ایمپورت/اکسپورت JSON هم حفظ می‌شه) تا بشه حتی ماه‌ها بعد چندین قدم Undo زد
    lockLog: [],
    unlockLog: [],
  };
}

export function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultData();
    const parsed = JSON.parse(raw);
    return migrateData(parsed);
  } catch (e) {
    console.warn("loadData failed:", e);
    return getDefaultData();
  }
}

export function saveData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    console.warn("saveData failed:", e);
    return false;
  }
}


/** متریال قدیمی بدون بچ/شاخه/خرید: یک «خرید اولیه» بساز تا بولک و پرتی کار کند */
export function ensureInitialStock(m) {
  if (!m || typeof m !== "object") return m;
  const out = { ...m };
  const n = (v) => {
    if (v == null || v === "") return 0;
    const x = Number(String(v).replace(/,/g, ""));
    return isNaN(x) ? 0 : x;
  };
  const totalCost = n(out.totalCost);
  let qty = out.totalQty != null ? n(out.totalQty) : (out.purchaseQty != null ? n(out.purchaseQty) : 0);
  if (qty <= 0) qty = 1;

  if (out.totalQty == null) out.totalQty = qty;
  if (out.remainingCost == null) out.remainingCost = totalCost;
  if (out.remainingQty == null) {
    if (totalCost > 0 && out.remainingCost != null) {
      out.remainingQty = Math.max(0, (n(out.remainingCost) / totalCost) * n(out.totalQty));
    } else {
      out.remainingQty = out.totalQty;
    }
  }

  if ((out.type === "fabric" || out.type === "area") && (!Array.isArray(out.batches) || out.batches.length === 0) && totalCost > 0) {
    const w = n(out.dimW);
    const h = n(out.dimH);
    out.batches = [{
      id: uid(),
      label: "خرید اولیه",
      width: w,
      height: h,
      qty: Math.max(1, Math.round(qty) || 1),
      totalCost: totalCost,
      date: out.purchaseDate || "",
      locked: false,
      linkedProductIds: [],
    }];
  }

  if (out.type === "linear" && (!Array.isArray(out.sticks) || out.sticks.length === 0)) {
    const len = n(out.unitLength) || 100;
    out.sticks = [{
      id: uid(),
      length: len,
      qty: Math.max(1, Math.round(qty) || 1),
      date: out.purchaseDate || null,
    }];
  }

  if ((out.type === "ratio" || out.type === "fixed") && (!Array.isArray(out.procurements) || out.procurements.length === 0) && totalCost > 0) {
    out.procurements = [{
      id: uid(),
      date: out.purchaseDate || new Date().toISOString().slice(0, 10),
      total: totalCost,
      unitPrice: qty > 0 ? totalCost / qty : totalCost,
      qty: Math.max(1, Math.round(qty) || 1),
    }];
  }

  return out;
}

export function migrateData(data) {
  const base = getDefaultData();
  const merged = { ...base, ...data, __schemaVersion: SCHEMA_VERSION };
  merged.products = (merged.products || []).map((p) => {
    const def = emptyProduct();
    const out = { ...def, ...p };
    if (!out.id) out.id = uid();
    if (out.status === "warehouse") out.status = "available";
    if (!out.images) out.images = [];
    if (!out.image && out.images && out.images.length > 0) {
      out.image = out.images[0];
    }
    const rawLines = Array.isArray(out.lineItems) ? out.lineItems : [];
    out.lineItems = rawLines.map((li) => ({ ...li, id: li.id || uid() }));
    // قیمت‌هایی که با «درصد سود» ذخیره‌شده‌اند ولی با cost*markup نمی‌خوانند = دستی واقعی
    // (بکاپ کاربر: ~۳۶ محصول با profitPct=30 ولی salePrice بازار)
    if (out.salePriceManual !== true && out.profitPct != null) {
      const cost = Number(out.totalCost) || 0;
      const sale = Number(out.salePrice) || 0;
      const pct = Number(out.profitPct);
      if (cost > 0 && sale > 0 && !isNaN(pct)) {
        const expected = cost * (1 + pct / 100);
        const diff = Math.abs(sale - expected);
        if (diff > Math.max(1000, cost * 0.05)) {
          out.salePriceManual = true;
          out.profitPct = null;
        }
      }
    }
    return out;
  });
  merged.materials = (merged.materials || []).map((m) => {
    let out = { ...emptyMaterial(), ...m };
    if (!out.id) out.id = uid();
    if (Array.isArray(out.batches)) {
      out.batches = out.batches.map((b) => ({ ...emptyBatch(), ...b, id: b.id || uid() }));
    }
    if (Array.isArray(out.sticks)) {
      out.sticks = out.sticks.map((s) => ({ ...emptyStick(), ...s, id: s.id || uid() }));
    }
    if (Array.isArray(out.procurements)) {
      out.procurements = out.procurements.map((p) => (p.id ? p : { ...p, id: uid() }));
    }
    out = ensureInitialStock(out);
    return out;
  });
  merged.customers = (merged.customers || []).map((c) => {
    const out = { ...emptyCustomer(), ...c };
    if (!out.id) out.id = uid();
    return out;
  });
  merged.businessCards = (merged.businessCards || []).map((b) => ({ ...b, id: b.id || uid() }));
  if (merged.myBusinessCard && !merged.myBusinessCard.id) {
    merged.myBusinessCard = { ...merged.myBusinessCard, id: uid() };
  }
  merged.woodCuttingSessions = (merged.woodCuttingSessions || []).map((s) => ({ ...s, id: s.id || uid() }));
  merged.invoiceDrafts = (merged.invoiceDrafts || []).map((d) => ({ ...d, id: d.id || uid() }));
  merged.productTypes = (merged.productTypes || []).map((t) => ({ ...t, id: t.id || uid() }));
  merged.equipment = (merged.equipment || []).map((e) => ({ ...e, id: e.id || uid() }));
  merged.equipment = merged.equipment || [];
  merged.workshopLinks = merged.workshopLinks || [];
  if (!merged.myBusinessCard) merged.myBusinessCard = { ...emptyBusinessCard(), name: "استودیو فرش و دکور ریفرش", isMine: true };
  if (!merged.businessCards) merged.businessCards = [];
  if (!merged.productTypes) merged.productTypes = [];
  return merged;
}

export function mergeById(existing, incoming, options = {}) {
  const map = {};
  existing.forEach((item) => (map[item.id] = item));
  incoming.forEach((item) => {
    if (map[item.id]) {
      // اگر replaceArrays=true باشد، آرایه‌ها را جایگزین کن
      if (options.replaceArrays) {
        const { lineItems, images, ...rest } = item;
        const existingItem = map[item.id];
        map[item.id] = {
          ...existingItem,
          ...rest,
          lineItems: lineItems || existingItem.lineItems || [],
          images: images || existingItem.images || [],
        };
      } else {
        map[item.id] = { ...map[item.id], ...item };
      }
    } else {
      map[item.id] = { ...item };
    }
  });
  return Object.values(map);
}

export function refundVanishedDeductions(oldProduct, newProduct, materials) {
  if (!oldProduct || !newProduct) return materials;
  const oldLines = oldProduct.lineItems || [];
  const newLines = newProduct.lineItems || [];
  const refundMap = {};
  oldLines.forEach((oldLi) => {
    if (!oldLi.deductedAt || !oldLi.deductedCost || !oldLi.materialId) return;
    const stillExists = newLines.some((nl) => nl.id === oldLi.id && nl.deductedAt);
    if (!stillExists) {
      refundMap[oldLi.materialId] = (refundMap[oldLi.materialId] || 0) + oldLi.deductedCost;
    }
  });
  if (Object.keys(refundMap).length === 0) return materials;
  return materials.map((m) => {
    const refund = refundMap[m.id] || 0;
    if (!refund) return m;
    const current = m.remainingCost != null ? m.remainingCost : m.totalCost;
    const total = m.totalCost || 0;
    const newRemaining = Math.min(total, current + refund);
    return { ...m, remainingCost: newRemaining };
  });
}