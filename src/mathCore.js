// ============================================================
// mathCore.js - Refarsh Clean
// ============================================================

export const toNum = (v) => {
  if (v == null || v === "") return 0;
  const n = Number(String(v).replace(/,/g, ""));
  return isNaN(n) ? 0 : n;
};

export function fmt(n) {
  if (n == null || isNaN(n)) return "—";
  return Math.round(n).toLocaleString("fa-IR");
}

export function fmtCode(n) {
  return String(n).padStart(4, "0");
}

export function gregorianToJalali(gy, gm, gd) {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  const jy2 = (gm > 2) ? (gy + 1) : gy;
  let sys_g_day = 355666 + (365 * gy) + Math.floor((jy2 + 3) / 4) - Math.floor((jy2 + 99) / 100) + Math.floor((jy2 + 399) / 400) + gd + g_d_m[gm - 1];
  let jy = -1595 + (33 * Math.floor(sys_g_day / 12053));
  sys_g_day %= 12053;
  jy += 4 * Math.floor(sys_g_day / 1461);
  sys_g_day %= 1461;
  if (sys_g_day > 365) {
    jy += Math.floor((sys_g_day - 1) / 365);
    sys_g_day = (sys_g_day - 1) % 365;
  }
  const jm = (sys_g_day < 186) ? (1 + Math.floor(sys_g_day / 31)) : (7 + Math.floor((sys_g_day - 186) / 30));
  const jd = 1 + ((sys_g_day < 186) ? (sys_g_day % 31) : ((sys_g_day - 186) % 30));
  return [jy, jm, jd];
}

export function toPersianDigits(str) {
  const p = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
  return String(str).replace(/[0-9]/g, (w) => p[+w]);
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function fmtDate(iso) {
  if (!iso) return "—";
  try {
    const parts = String(iso).split("T")[0].split("-");
    if (parts.length !== 3) return "—";
    const gy = parseInt(parts[0], 10);
    const gm = parseInt(parts[1], 10);
    const gd = parseInt(parts[2], 10);
    const [jy, jm, jd] = gregorianToJalali(gy, gm, gd);
    const jmStr = String(jm).padStart(2, "0");
    const jdStr = String(jd).padStart(2, "0");
    return toPersianDigits(`${jy}/${jmStr}/${jdStr}`);
  } catch { return "—"; }
}

export function parseDims(dimsStr) {
  if (!dimsStr) return null;
  const s = String(dimsStr).trim();
  const oMatch = s.match(/^(\d+(?:\.\d+)?)\s*[oO]$/);
  if (oMatch) return { w: parseFloat(oMatch[1]), h: null, shape: "circle" };
  const dMatch = s.match(/^(\d+(?:\.\d+)?)\s*[dD]$/);
  if (dMatch) return { w: parseFloat(dMatch[1]), h: null, shape: "semi-circle" };
  const rMatch = s.toLowerCase().replace("×", "x").match(/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)/);
  if (rMatch) return { w: parseFloat(rMatch[1]), h: parseFloat(rMatch[2]), shape: "rectangle" };
  return null;
}

export function dimsArea(input) {
  if (!input) return 0;
  if (typeof input === "object" && !Array.isArray(input)) {
    const shape = input.shape || input.dimShape;
    const w = toNum(input.dimW || input.w);
    const h = toNum(input.dimH || input.h);
    if (shape === "circle") {
      if (!w) return 0;
      const r = w / 2;
      return Math.PI * r * r;
    }
    if (shape === "semi-circle") {
      if (!w) return 0;
      const r = w / 2;
      return (Math.PI * r * r) / 2;
    }
    if (w && h) return w * h;
    const parsed = parseDims(input.dims || "");
    if (!parsed) return 0;
    return dimsArea(parsed);
  }
  const d = parseDims(String(input));
  if (!d) return 0;
  if (d.shape === "circle") {
    const r = d.w / 2;
    return Math.PI * r * r;
  }
  if (d.shape === "semi-circle") {
    const r = d.w / 2;
    return (Math.PI * r * r) / 2;
  }
  return d.w * (d.h || 0);
}

// نمایش ابعاد همیشه با عدد بزرگ‌تر اول (طول×عرض) — چه دیتای قدیمی برعکس ذخیره
// شده باشه چه جدید؛ موقع سیو هم dims/dimW/dimH به همین ترتیب نرمالایز می‌شن،
// این تابع فقط برای نمایش امن (دیتای قدیمی) لازمه.
export function formatProductDims(product) {
  if (!product) return "";
  const dims = product.dims || "";
  if (!dims) return "";
  const upper = dims.toUpperCase();
  if (upper.endsWith("D") || upper.endsWith("O")) return dims;
  let w = product.dimW, h = product.dimH;
  if (w === undefined || w === null || w === "" || h === undefined || h === null || h === "") {
    const parsed = parseDims(dims);
    if (parsed && parsed.w != null && parsed.h != null) { w = parsed.w; h = parsed.h; }
  }
  if (w === undefined || w === null || w === "" || h === undefined || h === null || h === "") return dims;
  return toNum(h) > toNum(w) ? `${h}×${w}` : `${w}×${h}`;
}

// نمایش خوانا/انسانی ابعاد برای بزرگ‌نمایی محصول: «64D» → «نیم‌دایره به قطر 64»، «55O» → «دایره به قطر 55».
// برای ابعاد مستطیلی معمولی (طول×عرض) دست‌نخورده برمی‌گرده.
export function formatDimsHuman(dimsText) {
  if (!dimsText) return "";
  const s = String(dimsText).trim();
  const upper = s.toUpperCase();
  const dMatch = upper.match(/^(\d+(?:\.\d+)?)\s*D$/);
  if (dMatch) return `نیم‌دایره به قطر ${dMatch[1]}`;
  const oMatch = upper.match(/^(\d+(?:\.\d+)?)\s*O$/);
  if (oMatch) return `دایره به قطر ${oMatch[1]}`;
  return s;
}

// «(۴عدد)» کنار ابعاد برای محصولات ستی (qty > 1)؛ برای qty=1 چیزی برنمی‌گردونه
export function qtySuffix(product) {
  const q = toNum(product?.qty);
  return q > 1 ? ` (${toPersianDigits(q)}عدد)` : "";
}

export function getProductArea(product) {
  if (!product) return 0;
  const qty = toNum(product.qty) || 1;
  if (product.shape === "circle") {
    const w = toNum(product.dimW || product.w);
    if (!w) return 0;
    const r = w / 2;
    return Math.PI * r * r * qty;
  }
  if (product.shape === "semi-circle") {
    const w = toNum(product.dimW || product.w);
    if (!w) return 0;
    const r = w / 2;
    return (Math.PI * r * r) / 2 * qty;
  }
  return dimsArea(product.dims || "") * qty;
}

// محیط محصول (برای متریال‌های خطی/دورگیر) — مستطیل: ۲×(طول+عرض)، نیم‌دایره: قوس + قطر، دایره‌ی کامل: ۲πr
export function getProductPerimeter(product) {
  if (!product) return 0;
  if (product.shape === "circle") {
    const w = toNum(product.dimW || product.w);
    if (!w) return 0;
    return Math.PI * w;
  }
  if (product.shape === "semi-circle") {
    const w = toNum(product.dimW || product.w);
    if (!w) return 0;
    const r = w / 2;
    return Math.PI * r + w;
  }
  const w = toNum(product.dimW || product.w);
  const h = toNum(product.dimH || product.h);
  if (w && h) return 2 * (w + h);
  const parsed = parseDims(product.dims || "");
  if (!parsed || !parsed.h) return 0;
  return 2 * (parsed.w + parsed.h);
}

export function normalizeNumericInput(value) {
  let v = String(value == null ? "" : value);
  v = v.replace(/[^\d.]/g, "");
  v = v.replace(/^0+(\d)/, "$1");
  return v;
}

export function calcProfitFromPrice(finalPrice, cost) {
  const c = toNum(cost);
  if (c <= 0) return 0;
  return Math.round(((toNum(finalPrice) - c) / c) * 100 * 10) / 10;
}

export function calcPriceFromProfit(profitPercent, cost) {
  const c = toNum(cost);
  return Math.round(c * (1 + toNum(profitPercent) / 100));
}

export function safeDivide(a, b) {
  const bNum = toNum(b);
  return bNum === 0 ? 0 : toNum(a) / bNum;
}

export function calcROI(netProfit, totalMaterialCost) {
  return safeDivide(netProfit, totalMaterialCost) * 100;
}

export function roundPct(value) {
  const v = toNum(value);
  const corrected = Math.round((v + Number.EPSILON) * 10) / 10;
  return Math.abs(corrected - Math.round(corrected)) < 0.05 ? Math.round(corrected) : corrected;
}

// ── Safe expression evaluator ──
export function safeEvalExpr(expr) {
  const tokens = String(expr).match(/\d+\.?\d*|[+\-*/()%]/g) || [];
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];

  function parseExpr() {
    let val = parseTerm();
    while (peek() === "+" || peek() === "-") {
      const op = next();
      const rhs = parseTerm();
      val = op === "+" ? val + rhs : val - rhs;
    }
    return val;
  }
  function parseTerm() {
    let val = parseFactor();
    while (peek() === "*" || peek() === "/") {
      const op = next();
      const rhs = parseFactor();
      if (op === "/") val = rhs !== 0 ? val / rhs : 0;
      else val = val * rhs;
    }
    return val;
  }
  function parseFactor() {
    if (peek() === "(") { next(); const val = parseExpr(); if (peek() === ")") next(); return applyPercent(val); }
    if (peek() === "-") { next(); return -parseFactor(); }
    const t = next();
    return applyPercent(parseFloat(t) || 0);
  }
  function applyPercent(val) {
    if (peek() === "%") { next(); return val / 100; }
    return val;
  }
  if (tokens.length === 0) return null;
  try {
    const result = parseExpr();
    return isFinite(result) ? result : null;
  } catch (e) { return null; }
}

// ── Service ROI ──
export function serviceROI(profit, finalPrice) {
  const fp = toNum(finalPrice);
  return fp <= 0 ? 0 : Math.round((toNum(profit) / fp) * 100 * 10) / 10;
}
// فرمت دسته‌بندی فرش: «فرش (نام)، (طرح (طرح)) (قدمت) ساله» — مثال: «فرش یزد، (طرح کاشان) 50 ساله»
// طرح و قدمت فیلدهای جدا (mat.pattern / mat.ageYears)ن، نه بخشی از اسم — قبلاً این تابع فقط
// اسم رو می‌گرفت و سعی می‌کرد الگوی «(طرح ...)» و «...ساله» رو از توی خودِ متن اسم پیدا کنه که
// عملاً هیچ‌وقت جواب نمی‌داد چون این دوتا از اول جدا از اسم ذخیره می‌شن.
export function formatFabricGroupLabel(rawName, pattern, ageYears) {
  const trimmed = (rawName || "").trim();
  if (!trimmed) return trimmed;
  const name = trimmed.startsWith("فرش") ? trimmed.slice(3).trim().replace(/^[،,]\s*/, "") : trimmed;
  const patternTrimmed = (pattern || "").trim();
  const ageNum = ageYears != null ? Number(ageYears) : null;
  const hasAge = ageNum != null && !isNaN(ageNum) && ageNum > 0;
  if (name && patternTrimmed && hasAge) {
    return `فرش ${name}، (طرح ${patternTrimmed}) ${ageNum} ساله`;
  }
  if (name && patternTrimmed) {
    return `فرش ${name}، (طرح ${patternTrimmed})`;
  }
  if (name && hasAge) {
    return `فرش ${name}، ${ageNum} ساله`;
  }
  // کاربر دیگه خودش کلمه‌ی «فرش» رو اول اسم متریال تایپ نمی‌کنه، پس اگه از قبل
  // نداشت خودکار اضافه می‌شه (فقط برای دسته‌بندی محصولات، اسم خودِ متریال دست‌نخورده می‌مونه)
  return trimmed.startsWith("فرش") ? trimmed : `فرش ${trimmed}`;
}

/** نام دسته محصول از روی id فرش زنده (نه نام قدیمی ذخیره‌شده) */
export function resolveProductGroupName(product, materials = []) {
  if (!product) return "";
  const fabricId =
    product.fabricMaterialId ||
    (product.lineItems || []).find((li) => {
      const m = (materials || []).find((x) => x.id === li.materialId);
      return m && m.type === "fabric";
    })?.materialId;
  if (fabricId) {
    const m = (materials || []).find((x) => x.id === fabricId);
    if (m?.name) return formatFabricGroupLabel(m.name, m.pattern, m.ageYears);
  }
  return product.group || "";
}

export function resolveProductFabricId(product, materials = []) {
  if (!product) return null;
  if (product.fabricMaterialId) return product.fabricMaterialId;
  const li = (product.lineItems || []).find((item) => {
    const m = (materials || []).find((x) => x.id === item.materialId);
    return m && m.type === "fabric";
  });
  return li?.materialId || null;
}
