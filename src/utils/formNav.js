// src/utils/formNav.js
// ------------------------------------------------------------
// روی گوشی، وقتی هیچ رفتار خاصی برای Enter تعریف نشده باشه، دکمه‌ی Enter/Go
// کیبورد فقط input رو blur می‌کنه (کیبورد بسته می‌شه) که تجربه‌ی پرکردن فرم‌های
// چندفیلدی (مثل فرم محصول یا سبد خرید) رو کند و آزاردهنده می‌کنه. این تابع رو
// روی یک container با data-enter-nav می‌ذاریم (event delegation — نیازی نیست
// تک‌تک اینپوت‌ها دستکاری بشن) تا با Enter، فوکوس بره روی فیلد متنی/عددی بعدی
// همون فرم؛ روی آخرین فیلد هم Enter کیبورد رو می‌بنده (رفتار قبلی).
// ------------------------------------------------------------

const FOCUSABLE_SELECTOR =
  'input[type="text"], input[type="number"], input[type="tel"], input[type="search"], input[type="email"], input:not([type])';

export function handleEnterNavigate(e) {
  if (e.key !== "Enter") return;
  const target = e.target;
  if (!target || target.tagName !== "INPUT") return;
  const type = (target.type || "text").toLowerCase();
  if (!["text", "number", "tel", "search", "email"].includes(type)) return;

  const container = target.closest("[data-enter-nav]");
  if (!container) return;

  const focusable = Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
    (el) => !el.disabled && !el.readOnly && el.offsetParent !== null
  );
  const idx = focusable.indexOf(target);
  if (idx === -1) return;

  e.preventDefault();
  if (idx < focusable.length - 1) {
    const next = focusable[idx + 1];
    next.focus();
    try {
      next.select();
    } catch (_) {}
  } else {
    target.blur();
  }
}
