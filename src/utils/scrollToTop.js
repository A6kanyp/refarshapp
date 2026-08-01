// src/utils/scrollToTop.js
// ------------------------------------------------------------
// اسکرول به بالای صفحه هنگام سوییچ تب یا باز شدن هر «پنل» (اکسپند شدن یک ردیف،
// باز شدن جزئیات فاکتور/متریال/محصول/مشتری و...).
// این تابع هم window را اسکرول می‌کند و هم هر div با overflow قابل‌اسکرول را
// (چون بخش‌های زیادی از اپ داخل کانتینرهای overflow-y:auto اسکرول می‌شوند، نه
// خودِ window — مخصوصاً داخل پنل مدیریت که position:fixed دارد).
// ------------------------------------------------------------

function scrollAllUp() {
  window.scrollTo(0, 0);
  document.querySelectorAll("div").forEach((el) => {
    try {
      const style = window.getComputedStyle(el);
      if (style.overflowY === "auto" || style.overflowY === "scroll") {
        el.scrollTop = 0;
      }
    } catch (_) {
      if (el.scrollHeight > el.clientHeight) {
        el.scrollTop = 0;
      }
    }
  });
}

// چند بار با تاخیر تکرار می‌شود چون خیلی از پنل‌ها/آکاردئون‌ها با انیمیشن یا
// re-render تاخیری باز می‌شوند و اسکرول فوری قبل از اضافه‌شدن ارتفاعشان بی‌اثر است.
export function scrollAppToTop() {
  scrollAllUp();
  const timers = [50, 150, 350, 600].map((ms) => setTimeout(scrollAllUp, ms));
  return () => timers.forEach(clearTimeout);
}
