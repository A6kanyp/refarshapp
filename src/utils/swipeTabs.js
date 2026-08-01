// ============================================================
// utils/swipeTabs.js - سوایپ چپ/راست برای رفتن بین تب‌ها (بخش ۳۶، جدید)
// ------------------------------------------------------------
// روی هر جای خالیِ محتوای یک تب که کاربر انگشتش رو افقی می‌کشه، تب
// بعدی/قبلی باز می‌شه (سوایپ به چپ → تب بعدی، سوایپ به راست → تب قبلی).
//
// فقط با touchstart/touchend کار می‌کنه (نه touchmove)، یعنی هیچ‌وقت
// جلوی اسکرول طبیعی صفحه یا وقتی خودِ یه فیلد را می‌کشی رو نمی‌گیره؛ فقط
// در پایان لمس، جابه‌جاییِ کلی رو می‌سنجه.
//
// نکته‌ی مهم (چیزی که کاربر گفت باگ نخوریم): اگه لمس از داخل چیزی شروع
// بشه که خودش افقی اسکرول می‌کنه و واقعاً چیزی برای اسکرول داره (مثلاً
// خودِ نوار تب‌ها، جدول عریض، کاروسل عکس، اسلایدر)، سوایپ کاملاً نادیده
// گرفته می‌شه تا اسکرول طبیعی همون‌جا خراب نشه.
// ============================================================
import { useRef, useCallback } from "react";

const SWIPE_THRESHOLD = 55;   // حداقل جابه‌جایی افقی (px) که به‌عنوان سوایپ حساب بشه
const DIRECTION_RATIO = 1.4;  // افقی باید حداقل این‌قدر از عمودی بیشتر باشه تا با اسکرول عمودی صفحه اشتباه نشه

function elementScrollsHorizontally(el) {
  if (!el || !el.style) return false;
  const style = window.getComputedStyle(el);
  const canScrollX = style.overflowX === "auto" || style.overflowX === "scroll";
  return canScrollX && el.scrollWidth > el.clientWidth + 1;
}

// از نقطه‌ی لمس تا سقفِ container بالا می‌ره؛ اگه یه المان بینابین خودش
// افقی قابل‌اسکرول بود (و واقعاً چیزی برای اسکرول داره)، یا صراحتاً با
// data-no-swipe="true" علامت‌گذاری شده (مناطق پرتراکم از دکمه/فیلتر که
// کشیدن انگشت روشون به‌راحتی به‌اشتباه سوایپ-تعویض‌تب حساب می‌شه، مثل
// ردیف فیلترهای فاکتور توی تب حسابداری)، true برمی‌گردونه
function isInsideHorizontalScroller(target, container) {
  let node = target;
  let guard = 0;
  while (node && node !== container && node !== document.body && guard < 40) {
    if (elementScrollsHorizontally(node)) return true;
    if (node.dataset && node.dataset.noSwipe === "true") return true;
    node = node.parentElement;
    guard++;
  }
  return false;
}

// tabIds: آرایه‌ی ترتیب تب‌ها (همون ترتیبی که سوایپ باید توش جلو/عقب بره)
// activeTab / setActiveTab: استیت فعلی تب
export function useSwipeTabNav(tabIds, activeTab, setActiveTab, disabled = false) {
  const startRef = useRef(null);
  const containerRef = useRef(null);
  const skipRef = useRef(false);

  const onTouchStart = useCallback((e) => {
    if (disabled || !e.touches || e.touches.length !== 1) {
      skipRef.current = true;
      startRef.current = null;
      return;
    }
    const touch = e.touches[0];
    skipRef.current = isInsideHorizontalScroller(touch.target, containerRef.current);
    startRef.current = skipRef.current ? null : { x: touch.clientX, y: touch.clientY };
  }, [disabled]);

  const onTouchEnd = useCallback((e) => {
    if (disabled || skipRef.current || !startRef.current) {
      startRef.current = null;
      skipRef.current = false;
      return;
    }
    const touch = e.changedTouches && e.changedTouches[0];
    if (!touch) { startRef.current = null; return; }

    const dx = touch.clientX - startRef.current.x;
    const dy = touch.clientY - startRef.current.y;
    startRef.current = null;

    if (Math.abs(dx) < SWIPE_THRESHOLD) return;
    if (Math.abs(dx) < Math.abs(dy) * DIRECTION_RATIO) return; // بیشتر عمودی بوده، پس اسکرول صفحه‌ست نه سوایپ

    const idx = tabIds.indexOf(activeTab);
    if (idx === -1) return;

    if (dx < 0 && idx > 0) setActiveTab(tabIds[idx - 1], "swipe");                   // سوایپ به چپ → تب قبلی (راست‌به‌چپ)
    else if (dx > 0 && idx < tabIds.length - 1) setActiveTab(tabIds[idx + 1], "swipe"); // سوایپ به راست → تب بعدی
  }, [tabIds, activeTab, setActiveTab, disabled]);

  return {
    containerRef,
    swipeHandlers: { onTouchStart, onTouchEnd },
  };
}

// ============================================================
// useTabSlideClass — بخش ۱۱ (انیمیشن اسکرول بین تب‌ها مثل تلگرام)
// ------------------------------------------------------------
// هر بار activeTab/mgmtTab عوض بشه (چه با سوایپ، چه با کلیک روی دکمه‌ی
// یه تب)، یه کلاس CSS برمی‌گردونه که مشخص می‌کنه محتوای تب جدید باید از
// چپ وارد بشه یا از راست — بر اساس این‌که ایندکسش توی tabIds نسبت به تب
// قبلی جلوتره یا عقب‌تر. محاسبه مستقیم توی بدنه‌ی رندر (نه useEffect)
// انجام می‌شه تا از همون فریم اولِ mount شدن محتوای جدید (که مصرف‌کننده
// باهاش یه key={activeTab} می‌ذاره تا remount بشه) جهت درست اعمال شده
// باشه، نه یه فریم دیرتر.
export function useTabSlideClass(tabIds, activeTab) {
  const prevIdxRef = useRef(tabIds.indexOf(activeTab));
  const dirRef = useRef("tab-slide-in-right");
  const curIdx = tabIds.indexOf(activeTab);
  if (curIdx !== -1 && curIdx !== prevIdxRef.current) {
    dirRef.current = curIdx > prevIdxRef.current ? "tab-slide-in-left" : "tab-slide-in-right";
    prevIdxRef.current = curIdx;
  }
  return dirRef.current;
}
