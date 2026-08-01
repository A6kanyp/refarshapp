import React, { useState, useRef, useEffect } from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { toJalaali, jalaliToGregorianString, jalaliDaysInMonth } from "../utils/jalali";
import { toPersianDigits } from "../mathCore";
import { useRegisterOpenModal } from "../utils/modalRegistry";

const MONTH_NAMES = [
  "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
  "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"
];
const WEEKDAY_LETTERS = ["ش", "ی", "د", "س", "چ", "پ", "ج"];

function todayJalali() {
  const t = new Date();
  return toJalaali(t.getFullYear(), t.getMonth() + 1, t.getDate());
}

// جمعه = آخر هفته؛ getDay() جاوااسکریپت با یکشنبه=۰ شروع می‌شه، تقویم ما با شنبه=۰
function weekdayIndexOf(gy, gm, gd) {
  const jsDay = new Date(gy, gm - 1, gd).getDay(); // 0=Sun..6=Sat
  return (jsDay + 1) % 7; // 0=Sat..6=Fri
}

export function JalaliDatePicker({ value, onChange, style, allowEmpty = false }) {
  const [open, setOpen] = useState(false);
  // این دراپ‌داون تقویم روی خیلی جاها استفاده می‌شه (فیلتر تاریخ فاکتور، فرم‌های
  // مختلف)؛ بدون این ثبت، کشیدن انگشت روی خودِ تقویم (برای رفتن بین ماه‌ها یا
  // انتخاب روز) از پشتش به‌عنوان سوایپ-تعویض-تب حساب می‌شد
  useRegisterOpenModal(open);
  // «ماه‌ها» یا «سال‌ها»: وقتی روی نام ماه بزنیم لیست ماه‌ها، بعد روی سال بزنیم لیست سال‌ها باز می‌شه
  const [pickerMode, setPickerMode] = useState("days");
  const wrapRef = useRef(null);
  const popupRef = useRef(null);

  const parsed = (() => {
    if (!value) return null;
    const parts = String(value).split("-");
    if (parts.length !== 3) return null;
    const gy = parseInt(parts[0], 10), gm = parseInt(parts[1], 10), gd = parseInt(parts[2], 10);
    if (isNaN(gy) || isNaN(gm) || isNaN(gd)) return null;
    return toJalaali(gy, gm, gd);
  })();

  const today = todayJalali();
  const [viewYear, setViewYear] = useState(parsed ? parsed.jy : today.jy);
  const [viewMonth, setViewMonth] = useState(parsed ? parsed.jm : today.jm);

  useEffect(() => {
    if (open) {
      setViewYear(parsed ? parsed.jy : today.jy);
      setViewMonth(parsed ? parsed.jm : today.jm);
      setPickerMode("days");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      const insideTrigger = wrapRef.current && wrapRef.current.contains(e.target);
      const insidePopup = popupRef.current && popupRef.current.contains(e.target);
      if (!insideTrigger && !insidePopup) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("touchstart", onDocClick);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("touchstart", onDocClick);
    };
  }, [open]);

  useEffect(() => {
    if (pickerMode !== "years" || !yearListRef.current) return;
    const el = yearListRef.current.querySelector('[data-selected="1"]');
    if (el) el.scrollIntoView({ block: "center" });
  }, [pickerMode]);

  const pickDay = (d) => {
    const greg = jalaliToGregorianString(viewYear, viewMonth, d);
    onChange && onChange(greg);
    setOpen(false);
  };

  const clearDate = (e) => {
    e.stopPropagation();
    onChange && onChange("");
    setOpen(false);
  };

  // فلش سمت راست (›) = ماه بعد (جلو)، فلش سمت چپ (‹) = ماه قبل (عقب) — جهت خودِ فلش
  // با کاری که انجام می‌ده یکی باشه، مستقل از راست‌به‌چپ بودن صفحه
  const goPrevMonth = (e) => {
    e.stopPropagation();
    if (viewMonth === 1) { setViewMonth(12); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  };
  const goNextMonth = (e) => {
    e.stopPropagation();
    if (viewMonth === 12) { setViewMonth(1); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  };

  // برچسب فشرده‌ی دکمه‌ی بسته (فقط روز + ماه، بدون سال — طبق درخواست)
  const compactLabel = parsed ? toPersianDigits(`${parsed.jd} ${MONTH_NAMES[parsed.jm - 1]}`) : null;
  const label = compactLabel || (allowEmpty ? "بدون فیلتر تاریخ" : "انتخاب تاریخ");

  // ── ساخت گرید روزهای ماه ──
  const gDate1 = jalaliToGregorianString(viewYear, viewMonth, 1).split("-").map(Number);
  const leadEmpty = weekdayIndexOf(gDate1[0], gDate1[1], gDate1[2]);
  const daysInMonth = jalaliDaysInMonth(viewYear, viewMonth);
  const cells = [];
  for (let i = 0; i < leadEmpty; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const isSelected = (d) => parsed && parsed.jy === viewYear && parsed.jm === viewMonth && parsed.jd === d;
  const isToday = (d) => today.jy === viewYear && today.jm === viewMonth && today.jd === d;

  // لیست سال‌ها: از ۱۴۰۰ تا سال جاری (سال جاری همیشه ته لیست)
  const yearOptions = [];
  for (let y = 1400; y <= today.jy; y++) yearOptions.push(y);
  const yearListRef = useRef(null);

  // ── اسکرول/کشیدن روی عدد سال برای تغییر سریع (مثل price picker چرخشی) ──
  // کشیدن انگشت/ماوس به بالا روی خودِ عدد سال = سال بیشتر، به پایین = سال کمتر؛
  // اگه فقط تپ بود (بدون حرکت محسوس) لیست کامل سال‌ها باز می‌شه، مثل قبل.
  const YEAR_DRAG_STEP_PX = 22;
  const clampYear = (y) => Math.min(today.jy, Math.max(1400, y));
  const yearDragRef = useRef(null);
  const justDraggedYearRef = useRef(false);

  const handleYearPointerDown = (e) => {
    yearDragRef.current = { startY: e.clientY, startYear: viewYear, moved: false };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
  };
  const handleYearPointerMove = (e) => {
    const st = yearDragRef.current;
    if (!st) return;
    const deltaY = e.clientY - st.startY;
    if (Math.abs(deltaY) > 4) st.moved = true;
    const steps = -Math.round(deltaY / YEAR_DRAG_STEP_PX);
    const newYear = clampYear(st.startYear + steps);
    setViewYear((prev) => (prev === newYear ? prev : newYear));
  };
  const handleYearPointerUp = () => {
    const st = yearDragRef.current;
    yearDragRef.current = null;
    if (st && st.moved) justDraggedYearRef.current = true;
  };
  const handleYearWheel = (e) => {
    e.stopPropagation();
    e.preventDefault();
    const dir = e.deltaY < 0 ? 1 : -1;
    setViewYear((y) => clampYear(y + dir));
  };
  const handleYearClick = (e) => {
    e.stopPropagation();
    if (justDraggedYearRef.current) { justDraggedYearRef.current = false; return; }
    setPickerMode("years");
  };

  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%", direction: "rtl", ...style }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4,
          width: "auto", maxWidth: "100%", background: "#1c1c1c", color: value ? "#ddd" : "#888",
          border: "1px solid #333", borderRadius: 7, padding: "5px 9px",
          fontSize: 10.5, fontFamily: "inherit", cursor: "pointer"
        }}
      >
        <CalendarIcon size={11} strokeWidth={1.5} />
        <span style={{ whiteSpace: "nowrap" }}>{label}</span>
        {allowEmpty && value && (
          <span onClick={clearDate} style={{ color: "#e08a8a", fontSize: 12, padding: "0 3px" }}>×</span>
        )}
      </button>

      {open && (
        <>
          {/* بک‌گراند نیمه‌شفاف پشت تقویم، تا با زدن هرجای بیرون بسته بشه و از نظر بصری وسط صفحه حس بشه */}
          <div
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 300 }}
            onClick={() => setOpen(false)}
          />
          <div
            ref={popupRef}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "fixed", zIndex: 301, top: "50%", left: "50%", transform: "translate(-50%, -50%)",
              width: 260, maxWidth: "88vw", background: "#181818", border: "1px solid #333", borderRadius: 10,
              padding: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.5)", direction: "rtl"
            }}
          >
            {pickerMode === "days" && (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <button type="button" onClick={goNextMonth} style={navBtnStyle}>&#8250;</button>
                  <span style={{ display: "flex", gap: 4 }}>
                    <button type="button" onClick={(e) => { e.stopPropagation(); setPickerMode("months"); }} style={monthYearBtnStyle}>
                      {MONTH_NAMES[viewMonth - 1]}
                    </button>
                    <button
                      type="button"
                      onClick={handleYearClick}
                      onPointerDown={handleYearPointerDown}
                      onPointerMove={handleYearPointerMove}
                      onPointerUp={handleYearPointerUp}
                      onPointerCancel={handleYearPointerUp}
                      onWheel={handleYearWheel}
                      style={{ ...monthYearBtnStyle, cursor: "ns-resize", touchAction: "none" }}
                      title="بکش بالا/پایین یا اسکرول کن برای تغییر سریع سال — لمس ساده برای لیست کامل"
                    >
                      {toPersianDigits(viewYear)}
                    </button>
                  </span>
                  <button type="button" onClick={goPrevMonth} style={navBtnStyle}>&#8249;</button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
                  {WEEKDAY_LETTERS.map((w, i) => (
                    <div key={i} style={{ textAlign: "center", fontSize: 9.5, color: "#666" }}>{w}</div>
                  ))}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
                  {cells.map((d, i) => d === null ? (
                    <div key={i} />
                  ) : (
                    <button
                      type="button"
                      key={i}
                      onClick={() => pickDay(d)}
                      style={{
                        aspectRatio: "1", border: "none", borderRadius: 6, cursor: "pointer",
                        fontSize: 11.5, fontFamily: "inherit",
                        background: isSelected(d) ? "#8B1A1A" : "transparent",
                        color: isSelected(d) ? "#fff" : isToday(d) ? "#e8b84b" : "#ccc",
                        outline: isToday(d) && !isSelected(d) ? "1px solid #e8b84b" : "none",
                      }}
                    >
                      {toPersianDigits(d)}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); const t = todayJalali(); setViewYear(t.jy); setViewMonth(t.jm); pickDay(t.jd); }}
                  style={{ width: "100%", marginTop: 8, background: "#222", color: "#aaa", border: "1px solid #333", borderRadius: 6, padding: "6px 0", fontSize: 10.5, cursor: "pointer" }}
                >
                  امروز
                </button>
              </>
            )}

            {pickerMode === "months" && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
                {MONTH_NAMES.map((mName, idx) => (
                  <button
                    type="button"
                    key={mName}
                    onClick={(e) => { e.stopPropagation(); setViewMonth(idx + 1); setPickerMode("days"); }}
                    style={{
                      padding: "10px 4px", borderRadius: 6, cursor: "pointer", fontSize: 11, fontFamily: "inherit",
                      border: "1px solid " + (viewMonth === idx + 1 ? "#8B1A1A" : "#2a2a2a"),
                      background: viewMonth === idx + 1 ? "#3a1212" : "#1f1f1f",
                      color: viewMonth === idx + 1 ? "#e08a8a" : "#ccc",
                    }}
                  >
                    {mName}
                  </button>
                ))}
              </div>
            )}

            {pickerMode === "years" && (
              <div ref={yearListRef} style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 260, overflowY: "auto" }}>
                {yearOptions.map((y) => (
                  <button
                    type="button"
                    key={y}
                    data-selected={viewYear === y ? "1" : undefined}
                    onClick={(e) => { e.stopPropagation(); setViewYear(y); setPickerMode("days"); }}
                    style={{
                      width: "100%", padding: "9px 4px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontFamily: "inherit",
                      border: "1px solid " + (viewYear === y ? "#8B1A1A" : "#2a2a2a"),
                      background: viewYear === y ? "#3a1212" : "#1f1f1f",
                      color: viewYear === y ? "#e08a8a" : "#ccc",
                      scrollSnapAlign: "center",
                      flexShrink: 0,
                    }}
                  >
                    {toPersianDigits(y)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

const navBtnStyle = {
  background: "transparent", border: "none", color: "#aaa", fontSize: 14,
  cursor: "pointer", padding: "0 6px", lineHeight: 1
};

const monthYearBtnStyle = {
  background: "transparent", border: "none", color: "#eee", fontSize: 12, fontWeight: 700,
  cursor: "pointer", padding: "2px 4px", fontFamily: "inherit"
};
