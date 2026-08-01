import React, { useState, useEffect, useRef } from "react";

export default function ScrollToTopButton({ activeTab, hide }) {
  const [visible, setVisible] = useState(false);
  const [tabChanging, setTabChanging] = useState(false);

  const buttonRef = useRef(null);

  useEffect(() => {
    setTabChanging(true);
    setVisible(false);
    const t = setTimeout(() => setTabChanging(false), 700);
    return () => clearTimeout(t);
  }, [activeTab]);

  // نکته: قبلاً اینجا یه اسکن دستی و دوره‌ای (هر ۳۰۰ میلی‌ثانیه) روی *همه‌ی*
  // divهای صفحه بود تا حدس بزنه مودالی باز هست یا نه (چک position/zIndex/رنگ
  // پس‌زمینه). این هم پرهزینه بود، هم باگ داشت: مقایسه‌ی رنگ فقط با فرمت
  // rgba(...) بود ولی رنگ‌های بدون شفافیت (مثل #0a0a0a) به‌صورت rgb(...)
  // (بدون a) محاسبه می‌شن، پس هیچ‌وقت match نمی‌شد؛ و هر عنصر fixed تمام‌عرض
  // (حتی یه هدر) به‌اشتباه «مودال» حساب می‌شد. این heuristic ناقص می‌تونست
  // به‌اشتباه دکمه رو کامل غیب کنه. الان به‌جاش از همون رجیستری رسمی مودال‌های
  // تودرتو استفاده می‌شه — `hide` که از App.jsx (`isAnyModalOpen`،
  // برآمده از `useNestedModalCount`) پاس داده می‌شه؛ دقیقاً همون منبع واحدی
  // که سوایپ بین تب‌ها هم برای همین تصمیم استفاده می‌کنه.

  useEffect(() => {
    let showTimer = null;

    const handleScroll = () => {
      let scrollTop = window.scrollY;
      let scrollHeight = document.documentElement.scrollHeight;
      let clientHeight = window.innerHeight;

      // Check if scrollable container DIV is being scrolled instead of window
      document.querySelectorAll("div").forEach((el) => {
        const style = window.getComputedStyle(el);
        if ((style.overflowY === "auto" || style.overflowY === "scroll") && el.scrollTop > 0) {
          scrollTop = el.scrollTop;
          scrollHeight = el.scrollHeight;
          clientHeight = el.clientHeight;
        }
      });

      const isLongEnough = scrollHeight > clientHeight + 100;
      const shouldShow = scrollTop > 150 && isLongEnough;

      if (!shouldShow) {
        // مخفی‌شدن باید فوری باشه، ولی نمایش رو با یه تاخیر کوتاه تایید می‌کنیم
        // که یه لرزش/بازگشت‌فنری موقت (وقتی صفحه اصلاً قابل‌اسکرول نیست ولی
        // کاربر انگشتش رو به پایین می‌کشه) اشتباهی دکمه رو ظاهر نکنه.
        if (showTimer) { clearTimeout(showTimer); showTimer = null; }
        setVisible(false);
      } else if (!showTimer) {
        showTimer = setTimeout(() => {
          showTimer = null;
          setVisible(true);
        }, 180);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    
    // Also bind scroll listeners to any scrollable element on the page
    const scrollContainers = [];
    document.querySelectorAll("div").forEach((el) => {
      const style = window.getComputedStyle(el);
      if (style.overflowY === "auto" || style.overflowY === "scroll") {
        el.addEventListener("scroll", handleScroll, { passive: true });
        scrollContainers.push(el);
      }
    });

    handleScroll();

    // Re-check scroll occasionally
    const scrollInterval = setInterval(handleScroll, 500);

    return () => {
      if (showTimer) clearTimeout(showTimer);
      window.removeEventListener("scroll", handleScroll);
      scrollContainers.forEach(el => {
        try {
          el.removeEventListener("scroll", handleScroll);
        } catch (_) {}
      });
      clearInterval(scrollInterval);
    };
  }, [activeTab]);

  const handleScrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    document.querySelectorAll("div").forEach((el) => {
      const style = window.getComputedStyle(el);
      if (style.overflowY === "auto" || style.overflowY === "scroll") {
        el.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  };

  const isActuallyVisible = visible && !hide && !tabChanging;

  return (
    <button
      ref={buttonRef}
      onClick={handleScrollToTop}
      style={{
        position: "fixed",
        bottom: 82,
        right: 24, // هم‌مرکز دقیق با دکمه‌ی شناور + (right:20, width:52 → مرکز از لبه: ۴۶px؛ این دکمه ۴۴px‌ه پس رایتش باید ۲۴ باشه)
        width: 44,
        height: 44,
        borderRadius: "50%",
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.18)",
        color: "#ccc",
        cursor: "pointer",
        zIndex: 9999, // keep above all normal elements but below modals
        boxShadow: "0 4px 16px rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "opacity 0.25s, visibility 0.25s, transform 0.2s",
        opacity: isActuallyVisible ? 1 : 0,
        visibility: isActuallyVisible ? "visible" : "hidden",
        pointerEvents: isActuallyVisible ? "auto" : "none",
      }}
      title="برو به بالا"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="18 15 12 9 6 15" />
      </svg>
    </button>
  );
}
