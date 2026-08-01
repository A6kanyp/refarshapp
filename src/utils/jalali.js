// ============================================================
// MODULE: jalali.js
// Description: Wrapper for jalaali-js with helper functions
// ============================================================

import { toJalaali as libToJalaali, toGregorian as libToGregorian, jalaaliMonthLength } from 'jalaali-js';

export function toJalaali(gy, gm, gd) {
  return libToJalaali(gy, gm, gd);
}

export function toGregorian(jy, jm, jd) {
  return libToGregorian(jy, jm, jd);
}

// Helper methods
const p2e = s => String(s).replace(/[۰-۹]/g, d => '0123456789'['۰۱۲۳۴۵۶۷۸۹'.indexOf(d)]);
const e2p = s => String(s).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
const padZ = (n) => String(n).padStart(2, "0");

const MONTH_NAMES_FA = [
  "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
  "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"
];

export function parseDateString(str) {
  if (!str) return null;
  const clean = p2e(str).trim();
  const parts = clean.split(/[-/]/);
  if (parts.length === 3) {
    const p1 = parseInt(parts[0], 10);
    const p2 = parseInt(parts[1], 10);
    const p3 = parseInt(parts[2], 10);
    if (!isNaN(p1) && !isNaN(p2) && !isNaN(p3)) {
      return { p1, p2, p3 };
    }
  }
  return null;
}

export function gregorianToJalaliString(gregorianStr) {
  if (!gregorianStr) return "";
  const parsed = parseDateString(gregorianStr);
  if (!parsed) return gregorianStr;
  
  // Usually Gregorian is YYYY-MM-DD (so p1 is year, p2 is month, p3 is day)
  const { p1, p2, p3 } = parsed;
  if (p1 > 1900) {
    const { jy, jm, jd } = toJalaali(p1, p2, p3);
    return `${jy}/${padZ(jm)}/${padZ(jd)}`;
  }
  return gregorianStr;
}

export function jalaliToGregorianString(jYear, jMonth, jDay) {
  const { gy, gm, gd } = toGregorian(parseInt(jYear, 10), parseInt(jMonth, 10), parseInt(jDay, 10));
  return `${gy}-${padZ(gm)}-${padZ(gd)}`;
}

export function formatJalaliReadable(gregorianStr, usePersianDigits = true) {
  if (!gregorianStr) return "";
  const parsed = parseDateString(gregorianStr);
  if (!parsed) return gregorianStr;
  
  let jy, jm, jd;
  if (parsed.p1 > 1900) {
    const res = toJalaali(parsed.p1, parsed.p2, parsed.p3);
    jy = res.jy;
    jm = res.jm;
    jd = res.jd;
  } else {
    // Already jalali
    jy = parsed.p1;
    jm = parsed.p2;
    jd = parsed.p3;
  }
  const mName = MONTH_NAMES_FA[jm - 1] || "";
  const result = `${jd} ${mName} ${jy}`;
  return usePersianDigits ? e2p(result) : result;
}

export function formatJalaliNumeric(gregorianStr, usePersianDigits = false) {
  const res = gregorianToJalaliString(gregorianStr);
  return usePersianDigits ? e2p(res) : res;
}

export function jalaliDaysInMonth(jy, jm) {
  return jalaaliMonthLength(jy, jm);
}
