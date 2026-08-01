// ============================================================
// utils/formatters.js - توابع فرمت‌کننده
// ============================================================

export function formatPriceInput(value) {
  if (value === null || value === undefined || value === "") return "";
  const str = String(value).replace(/,/g, "");
  if (!str) return "";
  const num = parseFloat(str);
  if (isNaN(num)) return str;
  const parts = str.split(".");
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.length > 1 ? intPart + "." + parts[1] : intPart;
}

export function parsePriceInput(value) {
  if (!value) return 0;
  const clean = String(value).replace(/,/g, "").trim();
  return parseFloat(clean) || 0;
}

export function formatPhoneInput(value) {
  if (!value) return "";
  const digits = String(value).replace(/\D/g, "");
  if (digits.length === 0) return "";
  const parts = [];
  if (digits.length <= 4) {
    parts.push(digits);
  } else if (digits.length <= 7) {
    parts.push(digits.slice(0, 4));
    parts.push(digits.slice(4));
  } else {
    parts.push(digits.slice(0, 4));
    parts.push(digits.slice(4, 7));
    parts.push(digits.slice(7, 11));
  }
  return parts.join(" ");
}

export function parsePhoneInput(value) {
  if (!value) return "";
  return String(value).replace(/\s/g, "");
}

export function getJalaliTimestamp() {
  const now = new Date();
  const dFormat = new Intl.DateTimeFormat('fa-IR', { calendar: 'persian', year: 'numeric', month: '2-digit', day: '2-digit' });
  const tFormat = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  
  const normalize = (str) => str.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
  
  const dStr = normalize(dFormat.format(now)).replace(/\//g, '');
  const tStr = tFormat.format(now).replace(/:/g, '');
  
  return `${dStr}-${tStr}`;
}
