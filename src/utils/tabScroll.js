// ذخیره/بازیابی اسکرول تب‌های پنل مدیریت
// کانتینر اصلی: div ثابت با overflowY:auto (پنل مدیریت)

export function getPanelScrollEl() {
  // پنل مدیریت: position:fixed + overflowY auto روی کل صفحه
  const candidates = [];
  document.querySelectorAll("div").forEach((el) => {
    try {
      const s = window.getComputedStyle(el);
      if (
        s.position === "fixed" &&
        (s.overflowY === "auto" || s.overflowY === "scroll") &&
        el.scrollHeight > el.clientHeight + 20
      ) {
        candidates.push(el);
      }
    } catch (_) {}
  });
  // بزرگ‌ترین کانتینر (معمولاً خود پنل)
  if (candidates.length) {
    candidates.sort((a, b) => b.scrollHeight - a.scrollHeight);
    return candidates[0];
  }
  return document.scrollingElement || document.documentElement;
}

export function getPanelScrollTop() {
  const el = getPanelScrollEl();
  if (!el) return window.scrollY || 0;
  return el.scrollTop || 0;
}

export function setPanelScrollTop(y) {
  const top = Math.max(0, y || 0);
  const el = getPanelScrollEl();
  if (el) el.scrollTop = top;
  // fallback
  try {
    window.scrollTo(0, top);
  } catch (_) {}
}

export function scrollPanelToTop() {
  setPanelScrollTop(0);
  // چند بار با تاخیر (مثل scrollAppToTop) چون محتوای تب ممکن است دیر رندر شود
  [50, 150, 350].forEach((ms) => setTimeout(() => setPanelScrollTop(0), ms));
}
