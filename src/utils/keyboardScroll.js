// src/utils/keyboardScroll.js
// ------------------------------------------------------------
// روی موبایل، وقتی کاربر روی یه فیلد متنی/عددی توی فرم لمس می‌کنه و کیبورد
// باز می‌شه، خیلی وقتا خودِ فیلد زیر کیبورد گیر می‌کنه و دیده نمی‌شه. این یوتیل
// با گوش‌دادن به focusin/focusout (به‌جای دستکاری تک‌تک فرم‌ها) بعد از یه
// تاخیر کوتاه (تا انیمیشن باز شدن کیبورد تموم بشه) فیلد فعال رو وسط صفحه
// اسکرول می‌کنه؛ و وقتی کیبورد بسته می‌شه (فوکوس از همه‌ی فیلدها خارج می‌شه)
// موقعیت اسکرول قبل از باز شدن کیبورد رو برمی‌گردونه.
// ------------------------------------------------------------

const FOCUS_DELAY = 320; // زمان تقریبی انیمیشن باز شدن کیبورد
const BLUR_DELAY = 200; // فرصت برای اینکه فوکوس به فیلد بعدی بره بدون ریست شدن

let savedScrollY = null;
let focusTimer = null;
let blurTimer = null;

function isTextField(el) {
  if (!el || !el.tagName) return false;
  if (el.tagName === "TEXTAREA") return true;
  if (el.tagName === "INPUT") {
    const type = (el.getAttribute("type") || "text").toLowerCase();
    return ["text", "number", "tel", "search", "email", "password", "date", "url"].includes(type);
  }
  return false;
}

function onFocusIn(e) {
  if (!isTextField(e.target)) return;
  if (savedScrollY == null) savedScrollY = window.scrollY;
  clearTimeout(blurTimer);
  clearTimeout(focusTimer);
  const target = e.target;
  focusTimer = setTimeout(() => {
    try {
      target.scrollIntoView({ block: "center", behavior: "smooth" });
    } catch (_) {}
  }, FOCUS_DELAY);
}

function onFocusOut(e) {
  if (!isTextField(e.target)) return;
  clearTimeout(focusTimer);
  clearTimeout(blurTimer);
  blurTimer = setTimeout(() => {
    if (isTextField(document.activeElement)) return; // فوکوس رفته رو فیلد بعدی، کیبورد هنوز بازه
    if (savedScrollY != null) {
      const y = savedScrollY;
      savedScrollY = null;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  }, BLUR_DELAY);
}

export function initKeyboardScroll() {
  document.addEventListener("focusin", onFocusIn);
  document.addEventListener("focusout", onFocusOut);
  return () => {
    document.removeEventListener("focusin", onFocusIn);
    document.removeEventListener("focusout", onFocusOut);
    clearTimeout(focusTimer);
    clearTimeout(blurTimer);
  };
}
