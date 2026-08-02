import React from "react";
import { useRegisterOpenModal } from "../utils/modalRegistry";

// بخش ۸ (روادمپ): پاپ‌آپ‌های فیلتر/سورت/دراپ‌داون قبلاً هرکدوم position:absolute نسبت
// به دکمه‌ی خودشون بودن (top:"100%")، که نزدیک لبه‌ی صفحه از کادر بیرون می‌زدن.
// این رَپر مشترک، دقیقاً مدل JalaliDatePicker رو تکرار می‌کنه: یه بک‌گراند نیمه‌شفاف
// ثابت (که با کلیک روش می‌بنده) + خودِ پاپ‌آپ همیشه وسط صفحه (fixed + translate)،
// مستقل از این‌که دکمه‌ی بازکننده کجای صفحه باشه.
// آیتم ۵ (دامپ جدید کاربر): پاپ‌آپ فیلتر «نوع» نباید یه مودالِ وسط‌صفحه با پس‌زمینه‌ی
// تیره باشه (اون برای Sort/دسته‌بندی خوبه)، باید «فلوتینگ» درست زیر دکمه‌ی خودش بمونه —
// بدون این‌که یه ردیف کامل از چیدمان رو اشغال کنه (یعنی overlay هست، نه این‌که فضای
// واقعی بین المان‌ها رو هل بده). یه کلیک‌گیرِ شفاف (بدون تیره‌شدن پس‌زمینه) برای
// بستن با کلیک بیرون داره.
export function AnchoredFloatingPopup({ open, onClose, anchorRef, children, width = 170, zIndex = 300 }) {
  useRegisterOpenModal(open);
  const [pos, setPos] = React.useState(null);
  React.useEffect(() => {
    if (!open || !anchorRef?.current) { setPos(null); return; }
    const compute = () => {
      const r = anchorRef.current?.getBoundingClientRect();
      if (!r) return;
      setPos({ top: r.bottom + 4, left: r.left });
    };
    compute();
    window.addEventListener("scroll", compute, true);
    window.addEventListener("resize", compute);
    const t = setInterval(compute, 200);
    return () => {
      window.removeEventListener("scroll", compute, true);
      window.removeEventListener("resize", compute);
      clearInterval(t);
    };
  }, [open, anchorRef]);
  if (!open || !pos) return null;
  return (
    <>
      <div style={{ position: "fixed", inset: 0, background: "transparent", zIndex }} onClick={onClose} />
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed",
          zIndex: zIndex + 1,
          top: pos.top,
          left: pos.left,
          width,
          maxWidth: "70vw",
          maxHeight: "60vh",
          overflowY: "auto",
          background: "#1c1c1c",
          border: "1px solid #2a2a2a",
          borderRadius: 10,
          padding: 8,
          boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
          direction: "rtl",
        }}
      >
        {children}
      </div>
    </>
  );
}

export function FilterPopup({ open, onClose, children, width = 220, maxWidth = "88vw", maxHeight = "70vh", zIndex = 300, align = "center" }) {
  // این کامپوننت همیشه mount می‌مونه (فقط وقتی open=false باشه null برمی‌گردونه)،
  // پس ثبت‌شدن توی رجیستری باید مستقیم روی خودِ prop باشه، نه mount/unmount —
  // وگرنه سوایپ بین تب‌ها از پشت این پاپ‌آپ (و همه‌ی جاهایی که ازش استفاده
  // می‌کنن، مثل فیلترهای تاریخ فاکتور) رد می‌شد و به‌جای بستن پاپ‌آپ، تب عوض می‌شد
  useRegisterOpenModal(open);
  if (!open) return null;

  const popupPositionStyle =
    align === "center"
      ? { top: "50%", left: "50%", transform: "translate(-50%, -50%)" }
      : { top: "50%", left: "50%", transform: "translate(-50%, -50%)" }; // فعلاً فقط حالت وسط‌چین پشتیبانی می‌شه

  return (
    <>
      <div
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex }}
        onClick={onClose}
      />
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed",
          zIndex: zIndex + 1,
          ...popupPositionStyle,
          width,
          maxWidth,
          maxHeight,
          overflowY: "auto",
          background: "#1c1c1c",
          border: "1px solid #2a2a2a",
          borderRadius: 10,
          padding: 8,
          boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
          direction: "rtl",
        }}
      >
        {children}
      </div>
    </>
  );
}
