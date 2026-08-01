import React from "react";
import { useRegisterOpenModal } from "../utils/modalRegistry";

// بخش ۸ (روادمپ): پاپ‌آپ‌های فیلتر/سورت/دراپ‌داون قبلاً هرکدوم position:absolute نسبت
// به دکمه‌ی خودشون بودن (top:"100%")، که نزدیک لبه‌ی صفحه از کادر بیرون می‌زدن.
// این رَپر مشترک، دقیقاً مدل JalaliDatePicker رو تکرار می‌کنه: یه بک‌گراند نیمه‌شفاف
// ثابت (که با کلیک روش می‌بنده) + خودِ پاپ‌آپ همیشه وسط صفحه (fixed + translate)،
// مستقل از این‌که دکمه‌ی بازکننده کجای صفحه باشه.
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
