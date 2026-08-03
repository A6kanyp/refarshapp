// ============================================================
// App.jsx - Refarsh Clean (نسخه نهایی با تمام اصلاحات)
// ============================================================
import React, { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef } from "react";
import * as XLSX from "xlsx";
import { LogOut, Users, RotateCcw, Fingerprint, Lock, Unlock, Undo2 } from "lucide-react";

import { toNum, fmt, fmtCode, fmtDate, todayISO, getProductArea, getProductPerimeter, safeDivide, gregorianToJalali, toPersianDigits, calcPriceFromProfit, resolveProductGroupName, formatFabricGroupLabel } from "./mathCore";
import { BiometricAuth, BiometryErrorType } from "@aparajita/capacitor-biometric-auth";
import {
  loadData, saveData, mergeById, refundVanishedDeductions,
  emptyProduct, emptyMaterial, emptyCustomer, emptyBusinessCard,
  DEFAULT_COST_LABELS, GALLERY_COLOR_PALETTE, uid, STORAGE_KEY, SCHEMA_VERSION,
} from "./dataModels";
import { APP_VERSION } from "./core/version";
import { SCRATCH_KEYS } from "./scratchpad";
import { processStateUpdate, performSynchronization } from "./utils/syncManager";
import { saveFile } from "./utils/nativeSave";
import { scrollAppToTop } from "./utils/scrollToTop";
import { getPanelScrollTop, setPanelScrollTop, scrollPanelToTop } from "./utils/tabScroll";
import { useNestedModalCount } from "./utils/modalRegistry";
import { initKeyboardScroll } from "./utils/keyboardScroll";
import { useSwipeTabNav, useTabSlideClass } from "./utils/swipeTabs";
import { compressImageFile } from "./utils/imageCompress";
import { saveImageToFolder, IMAGE_CATEGORIES } from "./utils/imageStorage";
import { pushBackHandler, consumeBack } from "./utils/backButton";
import { useAuth } from "./contexts/AuthContext.jsx";
import { usePendingChanges } from "./contexts/PendingChangesContext.jsx";
import { useToast } from "./contexts/ToastContext.jsx";

import GlobalHeader, { RefarshLogo } from "./components/GlobalHeader";
import { FilterPopup } from "./components/FilterPopup";
import BusinessCardModal from "./components/BusinessCardModal";
import ProductTab, { CatalogTab } from "./components/ProductTab";
import MaterialTab from "./components/MaterialTab";
import WoodCuttingTab from "./components/WoodCuttingTab";
import GalleryTab from "./components/GalleryTab";
import AccountingTab from "./components/AccountingTab";
import InvoicesTab from "./components/InvoicesTab";
import SyncTab from "./components/SyncTab";
import ScrollToTopButton from "./components/ScrollToTopButton";

const VALID_PIN_CODES = ["2744", "7539"];

function normalizeDigits(str) {
  return str
    .replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d))
    .replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d))
    .replace(/[^0-9]/g, "");
}

function PinScreen({ onUnlock, onCancel }) {
  const [input, setInput] = useState("");
  const [shake, setShake] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const inputRef = useRef(null);

  // بیومتریک (اثرانگشت/فیس) — روش جایگزینِ سریع‌تر برای رمز ۴رقمی. اگه دستگاه
  // پشتیبانی نکنه یا کاربر ثبت نکرده باشه، این بخش کاملاً بی‌اثر می‌مونه و فقط
  // همون رمز عادی کار می‌کنه — هیچ‌وقت قفل رو سخت‌تر نمی‌کنه، فقط راه میان‌بر اضافه می‌کنه
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioBusy, setBioBusy] = useState(false);
  const autoTriedRef = useRef(false);

  const tryBiometric = async () => {
    if (bioBusy) return;
    setBioBusy(true);
    try {
      await BiometricAuth.authenticate({
        reason: "برای باز کردن پنل مدیریت هویت خود را تأیید کنید",
        cancelTitle: "استفاده از رمز",
        allowDeviceCredential: false,
      });
      onUnlock();
    } catch (err) {
      // کاربر انصراف داده یا احراز هویت رد شده — مشکلی نیست، همون صفحه‌ی رمز
      // باقی می‌مونه تا با پین وارد بشه
    } finally {
      setBioBusy(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await BiometricAuth.checkBiometry();
        if (cancelled) return;
        setBioAvailable(!!result?.isAvailable);
        if (result?.isAvailable && !autoTriedRef.current) {
          autoTriedRef.current = true;
          tryBiometric();
        }
      } catch (_) {
        // پلاگین روی وب یا دستگاه‌های بدون پشتیبانی ممکنه خطا بده — نادیده
        // گرفته می‌شه، صفحه‌ی رمز عادی همیشه در دسترسه
        if (!cancelled) setBioAvailable(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 80); }, []);

  const handleChange = (e) => {
    const raw = e.target.value;
    const normalized = normalizeDigits(raw).slice(0, 4);
    setInput(normalized);
    if (normalized.length === 4) {
      if (VALID_PIN_CODES.includes(normalized)) {
        onUnlock();
        setInput("");
        setAttempts(0);
      } else {
        const next = attempts + 1;
        setAttempts(next);
        setShake(true);
        setTimeout(() => { setShake(false); setInput(""); if (next >= 3) setAttempts(0); }, 700);
      }
    }
  };

  const dots = Array.from({ length: 4 }, (_, i) => (
    <div key={i} style={{
      width: 16, height: 16, borderRadius: "50%",
      background: i < input.length ? "#8B1A1A" : "#2a2a2a",
      border: "1.5px solid",
      borderColor: i < input.length ? "#8B1A1A" : "#3a3a3a",
      transition: "background 0.15s",
    }} />
  ));

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 400, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 28 }} dir="rtl">
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#F5F0EB", letterSpacing: "0.15em" }}>REFARSH STUDIO</div>
        <div style={{ fontSize: 10, color: "#555" }}>رمز پنل مدیریت را وارد کنید</div>
        {attempts >= 2 && <div style={{ fontSize: 9.5, color: "#e08a8a" }}>⚠ {3 - attempts} تلاش باقی</div>}
      </div>
      <div style={{ display: "flex", gap: 18, animation: shake ? "pinShake 0.5s" : "none" }}>{dots}</div>
      <input ref={inputRef} type="password" inputMode="numeric" pattern="[0-9]*" maxLength={4} value={input} onChange={handleChange} autoComplete="off" style={{ position: "absolute", opacity: 0, width: 1, height: 1, pointerEvents: "none" }} />
      <button style={{ background: "#1c1c1c", border: "1px solid #2a2a2a", color: "#888", borderRadius: 10, padding: "11px 36px", fontFamily: "inherit", fontSize: 11, cursor: "pointer" }} onClick={() => inputRef.current?.focus()}>ضربه بزنید برای ورود رمز</button>
      {bioAvailable && (
        <button
          onClick={tryBiometric}
          disabled={bioBusy}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "1px solid #2a2a2a", color: "#a89bd4", borderRadius: 10, padding: "9px 22px", fontFamily: "inherit", fontSize: 10.5, cursor: bioBusy ? "default" : "pointer", opacity: bioBusy ? 0.6 : 1 }}
        >
          <Fingerprint size={15} /> ورود با اثرانگشت
        </button>
      )}
      {onCancel && <button style={{ background: "transparent", border: "none", color: "#555", fontSize: 10.5, cursor: "pointer", fontFamily: "inherit" }} onClick={onCancel}>انصراف</button>}
      <style>{`@keyframes pinShake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-10px)}40%,80%{transform:translateX(10px)}}`}</style>
    </div>
  );
}

function RefreshLockButton({ onQuickRefresh, onHoldRefresh, onUndoRefresh, onResetFilters, hasPending }) {
  const holdTimer = useRef(null);
  const didHold = useRef(false);
  const [showHoldPopup, setShowHoldPopup] = useState(false);
  // آیتم جدید: با یه ضربه‌ی ساده (نه نگه‌داشتن)، آیکون رفرش ۳ ثانیه دایره‌ای
  // بچرخه — فقط یه فیدبک بصری که «کاری انجام شد»، مستقل از منطق واقعیِ
  // quickRefresh (Ash 🟡). دابل‌کلیک (ریست فیلترها) هم مشابه ولی ۴ ثانیه،
  // سریع‌تر، و با اینرسی (شروع تند، کم‌کم کند و متوقف) — با یه keyframe جدا
  // که مسافت بیشتر (۵ دور) رو با easing کندشونده (نه linear) طی می‌کنه، پس
  // خودش به‌طور طبیعی هم سریع‌تر شروع می‌شه هم با اینرسی می‌ایسته، بدون نیاز
  // به فیزیک واقعی توی JS
  const [spinMode, setSpinMode] = useState(null); // null | "tap" | "doubleTap"
  const spinTimeoutRef = useRef(null);

  const triggerSpin = (mode, durationMs) => {
    clearTimeout(spinTimeoutRef.current);
    setSpinMode(mode);
    spinTimeoutRef.current = setTimeout(() => setSpinMode(null), durationMs);
  };

  const onPtrDown = () => {
    didHold.current = false;
    holdTimer.current = setTimeout(() => { didHold.current = true; setShowHoldPopup(true); }, 550);
  };
  const onPtrUp = () => {
    clearTimeout(holdTimer.current);
    if (didHold.current) return; // این فشار خودش یک هولد بود، به‌عنوان کلیک حساب نشود
    // طبق درخواست صریح کاربر (که Ash توی GlobalHeader.jsx هم اعمال کرد):
    // دابل‌کلیک دیگه کار خاصی نمی‌کنه — Undo فقط از پاپ‌آپ نگه‌داشتن در
    // دسترسه. قبلاً اینجا ضربه‌ی دوم (اگه به‌اندازه‌ی کافی سریع بود)
    // onUndoRefresh رو صدا می‌زد که با اون رفتار ناهماهنگ بود
    // دابل‌کلیک → ریست فیلتر
    const now = Date.now();
    if (!RefreshLockButton._lastTap) RefreshLockButton._lastTap = 0;
    if (now - RefreshLockButton._lastTap < 350) {
      RefreshLockButton._lastTap = 0;
      onResetFilters?.();
      triggerSpin("doubleTap", 4000);
    } else {
      RefreshLockButton._lastTap = now;
      onQuickRefresh?.();
      triggerSpin("tap", 3000);
    }
  };
  const onPtrCancel = () => clearTimeout(holdTimer.current);
  useEffect(() => () => clearTimeout(spinTimeoutRef.current), []);

  const spinStyle =
    spinMode === "tap" ? { animation: "ashRefreshSpin 1s linear 3" } :
    spinMode === "doubleTap" ? { animation: "ashRefreshSpinFast 4s cubic-bezier(0.15,0.65,0.35,1) 1" } :
    undefined;

  // چیدمان ۴ دکمه‌ی مربعی طبق آخرین توضیح دقیق کاربر: ردیف بالا = قفل (راست) و
  // آزاد (چپ)، ردیف پایین = Undo (راست) و رفرش (چپ). چون کل اپ RTL هست، ترتیب
  // طبیعی DOM (بدون هیچ override دستی گرید) دقیقاً همین نتیجه رو می‌ده —
  // نسخه‌ی قبلی یه `gridColumn: 1` اضافه و اشتباه روی دکمه‌ی رفرش داشت که کل
  // چیدمان رو به‌هم می‌ریخت (باعث می‌شد به ردیف/ستون اشتباه پرت بشه)
  const squareBtnStyle = {
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
    width: 56, height: 56, borderRadius: 10, cursor: "pointer", fontFamily: "inherit", fontSize: 10, border: "1px solid #2a2a2a",
  };

  return (
    <>
      <style>{`@keyframes ashRefreshSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}@keyframes ashRefreshSpinFast{from{transform:rotate(0deg)}to{transform:rotate(1800deg)}}`}</style>
      <button onPointerDown={onPtrDown} onPointerUp={onPtrUp} onPointerCancel={onPtrCancel}
        style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: "50%", background: hasPending ? "#3a1212" : "#1c1c1c", border: "1px solid " + (hasPending ? "#8B1A1A" : "#2a2a2a"), color: hasPending ? "#e08a8a" : "#888", cursor: "pointer", flexShrink: 0 }}
        title="ضربه = رفرش نمایش | دو ضربه = ریست فیلترها | نگه‌دار = باز شدن منوی قفل/آزادسازی">
        <RotateCcw size={16} color={hasPending ? "#e08a8a" : "#888"} style={spinStyle} />
        {hasPending && <span style={{ position: "absolute", top: 3, right: 3, width: 6, height: 6, borderRadius: "50%", background: "#e08a8a" }} />}
      </button>

      <FilterPopup open={showHoldPopup} onClose={() => setShowHoldPopup(false)} width={150}>
        <div style={{ padding: 10 }}>
          <div style={{ fontSize: 10, color: "#888", textAlign: "center", marginBottom: 8 }}>چه کاری انجام بشه؟</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <button
              style={{ ...squareBtnStyle, background: "#1d3a24", color: "#5fd180" }}
              onClick={() => { setShowHoldPopup(false); onHoldRefresh?.("lock"); }}
            >
              <Lock size={16} />
              قفل
            </button>
            <button
              style={{ ...squareBtnStyle, background: "#3a2414", color: "#e0a35a" }}
              onClick={() => { setShowHoldPopup(false); onHoldRefresh?.("unlock"); }}
            >
              <Unlock size={16} />
              آزاد
            </button>
            <button
              style={{ ...squareBtnStyle, background: "#1c1c1c", color: "#888" }}
              onClick={() => { setShowHoldPopup(false); onUndoRefresh?.(); }}
            >
              <Undo2 size={16} />
              Undo
            </button>
            <button
              style={{ ...squareBtnStyle, background: "#1c1c1c", color: "#ccc" }}
              onClick={() => {
                setShowHoldPopup(false);
                onQuickRefresh?.();
                triggerSpin("tap", 3000);
              }}
            >
              <RotateCcw size={16} style={spinStyle} />
              رفرش
            </button>
          </div>
        </div>
      </FilterPopup>
    </>
  );
}

// ── ManagementPanelModal ──
function ManagementPanelModal({ onClose, children, onQuickRefresh, onHoldRefresh, onUndoRefresh, onResetFilters, hasPending, onOpenBusinessCardManager, activeTab, isAnyModalOpen, hideScrollButton, refreshResetTick, refreshProblemTabs = [] }) {
  const [isPanelUnlocked, setIsPanelUnlocked] = useState(false);
  const headerRef = useRef(null);

  // useLayoutEffect (نه useEffect) عمداً: باید قبل از رنگ‌آمیزی صفحه توسط
  // مرورگر اجرا بشه، وگرنه یه فریم گذرا هست که مقدار fallback (۵۲px) به‌جای
  // ارتفاع واقعی استفاده می‌شه — همون فریمی که باعث می‌شد هدر sticky بچه‌ها
  // (تب محصولات/متریال/...) یه لحظه جای اشتباه بچسبن و یه شکاف/لایه‌ی زیری
  // دیده بشه، مخصوصاً موقع اسکرول سریع یا سوییچ بین تب‌ها
  useLayoutEffect(() => {
    if (!isPanelUnlocked || !headerRef.current) return;
    const updateHeight = () => {
      const h = headerRef.current.offsetHeight;
      document.documentElement.style.setProperty("--panel-header-height", `${h}px`);
    };
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(headerRef.current);
    return () => observer.disconnect();
  }, [isPanelUnlocked]);

  const handleUnlock = () => setIsPanelUnlocked(true);
  // آیتم ۶: قبلاً «خروج» بدون هیچ تاییدی مستقیم پنل رو می‌بست — الان اول یه
  // پاپ‌آپ وسط صفحه تایید می‌گیره (همون الگوی «تأیید خروج» که فرم‌های محصول/
  // متریال/گالری برای تغییرات ذخیره‌نشده استفاده می‌کنن)
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const handleExit = () => setShowExitConfirm(true);
  const confirmExit = () => { setShowExitConfirm(false); setIsPanelUnlocked(false); onClose(); };

  // آیتم ۹ (دامپ اخیر کاربر): دکمه‌ی بک سخت‌افزاری/سوایپ لبه پنل رو بدون تایید
  // می‌بست، چون یه هندلر جدا توی App.jsx مستقیم `onClose` (بستن واقعی پنل) رو
  // صدا می‌زد — درحالی‌که دکمه‌ی «خروج» همیشه از `handleExit` (باز کردن پاپ‌آپ
  // تایید) رد می‌شد. اون هندلر بیرونی حذف شد؛ الان دقیقاً همینجا، داخل خودِ
  // پنل، دو تا هندلر جداگونه ثبت می‌شه که رفتارشون کاملاً هم‌راستا با بقیه‌ی
  // پاپ‌آپ‌های تاییدِ اپه (بک = بستن بالاترین چیزِ باز):
  // ۱) اگه پاپ‌آپ تایید از قبل باز نیست → بک باید همون کاری رو بکنه که خودِ
  //    دکمه‌ی «خروج» می‌کنه (یعنی اول پاپ‌آپ تایید رو باز کنه، نه بستن مستقیم پنل)
  // ۲) اگه پاپ‌آپ تایید باز است → بک باید فقط همون پاپ‌آپ رو ببنده (لغو تایید)،
  //    نه این‌که تاییدش کنه و پنل واقعاً بسته بشه
  useEffect(() => {
    if (!isPanelUnlocked || showExitConfirm) return;
    return pushBackHandler(handleExit);
  }, [isPanelUnlocked, showExitConfirm]);

  useEffect(() => {
    if (!showExitConfirm) return;
    return pushBackHandler(() => setShowExitConfirm(false));
  }, [showExitConfirm]);

  if (!isPanelUnlocked) return <PinScreen onUnlock={handleUnlock} onCancel={onClose} />;

  return (
    <div style={{ position: "fixed", inset: 0, background: "#0a0a0a", zIndex: 300, overflowY: "auto" }} dir="rtl">
      <div ref={headerRef} style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 14px",
        borderBottom: "1px solid #1e1e1e",
        background: "#0a0a0a",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "#1c1c1c",
              border: "1px solid #2a2a2a",
              color: "#e08a8a",
              borderRadius: 8,
              padding: "7px 12px",
              fontFamily: "inherit",
              fontSize: 11,
              cursor: "pointer",
            }}
            onClick={handleExit}
          >
            <LogOut size={13} />
            خروج
          </button>
          {onOpenBusinessCardManager && (
            <button
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: "#1c1c1c",
                border: "1px solid #2a2a2a",
                color: "#7aa8d8",
                borderRadius: 8,
                padding: "7px 12px",
                fontFamily: "inherit",
                fontSize: 11,
                cursor: "pointer",
              }}
              onClick={onOpenBusinessCardManager}
            >
              <Users size={13} />
              کارت‌ها
            </button>
          )}
        </div>

        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flex: "1 1 auto",
          justifyContent: "center",
        }}>
          <RefarshLogo size={28} />
          <div style={{ whiteSpace: "nowrap" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#F5F0EB", letterSpacing: "0.12em" }}>
              REFARSH STUDIO
            </div>
            <div style={{ fontSize: 9, color: "#888", marginTop: 1, lineHeight: 1.3, whiteSpace: "nowrap" }}>
              پنل مدیریت
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {onQuickRefresh && (
            <RefreshLockButton
              onQuickRefresh={onQuickRefresh}
              onHoldRefresh={onHoldRefresh}
              onUndoRefresh={onUndoRefresh}
              onResetFilters={onResetFilters}
              hasPending={hasPending}
            />
          )}
        </div>
      </div>

      <div style={{ padding: "0 14px 14px 14px" }}>
        {React.cloneElement(children, { onQuickRefresh, onHoldRefresh, onUndoRefresh, hasPending, refreshResetTick, refreshProblemTabs })}
      </div>

      <ScrollToTopButton activeTab={activeTab} hide={hideScrollButton} />

      {showExitConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: "88%", maxWidth: 340, background: "#181818", border: "1px solid #2a2a2a", borderRadius: 14, padding: 20 }} dir="rtl">
            <div style={{ fontSize: 13, fontWeight: 600, color: "#F5F0EB", marginBottom: 8 }}>از پنل مدیریت خارج شوید؟</div>
            <div style={{ fontSize: 11, color: "#777", lineHeight: 1.65, marginBottom: 18 }}>برای ورود دوباره باید PIN رو وارد کنی.</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={{ flex: 1, background: "transparent", border: "1px solid #2a2a2a", color: "#777", borderRadius: 8, padding: "10px 0", fontFamily: "inherit", fontSize: 11, cursor: "pointer" }} onClick={() => setShowExitConfirm(false)}>انصراف</button>
              <button style={{ flex: 1, background: "#8B1A1A", border: "none", color: "#fff", borderRadius: 8, padding: "10px 0", fontFamily: "inherit", fontSize: 11, cursor: "pointer" }} onClick={confirmExit}>خروج</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── MgmtTabs ──
function MgmtTabs({ productTotals, groupedProducts, materialsWithRemaining, customerStats, data, setData, notify, nextCode, sortMode, setSortMode, sortOrder, setSortOrder, sortOrderMaterials, setSortOrderMaterials, sortOrderGallery, setSortOrderGallery, areaBatchCostByProduct, ratioByAreaCostByProduct, accounting, onLinkBatch, onUnlinkBatch, onUndeductLine, onUndeductWood, onImageUpload, onRequestDeleteProduct, onRequestDeleteMaterial, onRequestDeleteCustomer, addMaterialPurchase, updateProcurement, deleteProcurement, deleteMaterial, addBatch, updateBatch, deleteBatch, lockBatch, unlockBatch, addStick, updateStick, deleteStick, bulkApplyMaterial, deleteCustomer, handleExportExcel, handleExportPreviewExcel, handleExportJson, xlsxImportRef, jsonImportRef, onQuickRefresh, onHoldRefresh, onUndoRefresh, hasPending, woodCuttingSessions, onSaveSession, onDeleteSession, onExportWoodCutting, onModalToggle, hideFloatingSync, myBusinessCard, nestedModalCount, refreshResetTick, refreshProblemTabs = [] }) {
  const [mgmtTab, setMgmtTab] = useState("products");
  const tabsRef = useRef(null);

  // همین دلیل بالا (useLayoutEffect به‌جای useEffect) اینجا هم صادقه
  useLayoutEffect(() => {
    if (!tabsRef.current) return;
    const updateHeight = () => {
      const h = tabsRef.current.offsetHeight;
      document.documentElement.style.setProperty("--mgmt-tabs-height", `${h}px`);
    };
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(tabsRef.current);
    return () => observer.disconnect();
  }, []);

  const TABS = [
    { id: "products", label: "محصولات" },
    { id: "materials", label: "متریال" },
    { id: "woodCutting", label: "برش" },
    { id: "gallery", label: "گالری" },
    { id: "accounting", label: "حسابداری" },
    { id: "sync", label: "همگام‌سازی" },
  ];

  const stickyTop = "calc(var(--panel-header-height, 52px) + var(--mgmt-tabs-height, 44px) - 1px)";

  // بخش ۳۶: سوایپ چپ/راست بین تب‌های پنل مدیریت
  const MGMT_TAB_ORDER = ["products", "materials", "woodCutting", "gallery", "accounting", "sync"];
  // اسکرول هر تب + منبع سوییچ (کلیک vs سوایپ)
  const tabScrollPosRef = useRef({});
  const switchMgmtTab = useCallback((id, source = "click") => {
    // قبل از ترک تب فعلی، اسکرولش را ذخیره کن
    tabScrollPosRef.current[mgmtTab] = getPanelScrollTop();
    setMgmtTab(id);
    if (source === "swipe") {
      // بازگردانی اسکرول تب مقصد (بعد از رندر)
      const y = tabScrollPosRef.current[id] || 0;
      requestAnimationFrame(() => {
        setPanelScrollTop(y);
        setTimeout(() => setPanelScrollTop(y), 50);
        setTimeout(() => setPanelScrollTop(y), 180);
      });
    } else {
      // کلیک روی تب → برو بالا (فیلترها می‌مانند چون تب unmount نمی‌شود)
      scrollPanelToTop();
    }
  }, [mgmtTab]);
  const { containerRef: mgmtSwipeRef, swipeHandlers: mgmtSwipeHandlers } = useSwipeTabNav(MGMT_TAB_ORDER, mgmtTab, switchMgmtTab, nestedModalCount > 0);
  const mgmtTabSlideClass = useTabSlideClass(MGMT_TAB_ORDER, mgmtTab);

  return (
    <div dir="rtl">
      <div className="management-tabs" ref={tabsRef} style={{
        display: "flex",
        gap: 4,
        marginBottom: 12,
        overflowX: "auto",
        scrollbarWidth: "none", msOverflowStyle: "none",
        // scrollbar hidden
        position: "sticky",
        top: "var(--panel-header-height, 52px)",
        zIndex: 40,
        background: "#0a0a0a",
        padding: "8px 14px",
        margin: "0 -14px",
        borderBottom: "1px solid #1e1e1e",
      }}>
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            style={{
              flex: "0 0 auto",
              padding: "7px 12px",
              borderRadius: 12,
              border: "1px solid",
              borderColor: mgmtTab === id ? "#8B1A1A" : "#1c1c1c",
              background: mgmtTab === id ? "#8B1A1A" : "#161616",
              color: mgmtTab === id ? "#fff" : "#888",
              fontSize: 10.5,
              minWidth: 0,
              whiteSpace: "nowrap",
              textAlign: "center",
              fontFamily: "inherit",
              cursor: "pointer",
              position: "relative",
            }}
            onClick={() => switchMgmtTab(id, "click")}
          >
            {label}
            {refreshProblemTabs.includes(id) && (
              <span
                title="فیلد الزامی خالی — با رفرش بررسی شد"
                style={{
                  position: "absolute",
                  top: -4,
                  right: -4,
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  background: "#e0b93c",
                  color: "#1a1a1a",
                  fontSize: 9,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  lineHeight: 1,
                  border: "1px solid #0a0a0a",
                }}
              >
                !
              </span>
            )}
          </button>
        ))}
      </div>

      <div ref={mgmtSwipeRef} {...mgmtSwipeHandlers}>
      <div className={mgmtTabSlideClass}>
      <div style={{ display: mgmtTab === "products" ? "block" : "none" }}>
        <ProductTab
          stickyTop={stickyTop}
          productTotals={productTotals}
          groupedProducts={groupedProducts}
          setData={setData}
          customers={data.customers || []}
          materials={materialsWithRemaining}
          productTypes={data.productTypes || []}
          onRequestDelete={onRequestDeleteProduct}
          areaBatchCostByProduct={areaBatchCostByProduct}
          ratioByAreaCostByProduct={ratioByAreaCostByProduct}
          onLinkBatch={onLinkBatch}
          onUnlinkBatch={onUnlinkBatch}
          onUndeductLine={onUndeductLine}
          onUndeductWood={onUndeductWood}
          onImageUpload={onImageUpload}
          nextCode={nextCode}
          sortMode={sortMode}
          setSortMode={setSortMode}
          sortOrder={sortOrder}
          setSortOrder={setSortOrder}
          notify={notify}
          onModalToggle={onModalToggle}
          refreshResetTick={refreshResetTick}
        />
      </div>
      <div style={{ display: mgmtTab === "materials" ? "block" : "none" }}><MaterialTab stickyTop={stickyTop} materials={materialsWithRemaining} products={productTotals} setData={setData} onRequestDelete={onRequestDeleteMaterial} onAddPurchase={addMaterialPurchase} onUpdateProcurement={updateProcurement} onDeleteProcurement={deleteProcurement} onAddBatch={addBatch} onUpdateBatch={updateBatch} onDeleteBatch={deleteBatch} onLockBatch={lockBatch} onUnlockBatch={unlockBatch} onAddStick={addStick} onUpdateStick={updateStick} onDeleteStick={deleteStick} onBulkApply={bulkApplyMaterial} sortOrder={sortOrderMaterials} setSortOrder={setSortOrderMaterials} notify={notify} refreshResetTick={refreshResetTick} /></div>
      <div style={{ display: mgmtTab === "woodCutting" ? "block" : "none" }}><WoodCuttingTab stickyTop={stickyTop} materials={materialsWithRemaining} products={productTotals} woodCuttingSessions={woodCuttingSessions} onSaveSession={onSaveSession} onDeleteSession={onDeleteSession} onExport={onExportWoodCutting} /></div>
      <div style={{ display: mgmtTab === "gallery" ? "block" : "none" }}><GalleryTab businessCard={myBusinessCard} stickyTop={stickyTop} customerStats={customerStats} productTotals={productTotals} setData={setData} onRequestDeleteCustomer={onRequestDeleteCustomer} sortOrder={sortOrderGallery} setSortOrder={setSortOrderGallery} notify={notify} refreshResetTick={refreshResetTick} /></div>
      <div style={{ display: mgmtTab === "accounting" ? "block" : "none" }}><AccountingTab stickyTop={stickyTop} acc={accounting} customers={data.customers || []} productTotals={productTotals} onExportExcel={handleExportExcel} onExportJson={handleExportJson} onImportExcelClick={() => xlsxImportRef.current?.click()} onImportJsonClick={() => jsonImportRef.current?.click()} setData={setData} notify={notify} businessCard={myBusinessCard} invoiceDrafts={data.invoiceDrafts || []} refreshResetTick={refreshResetTick} /></div>
      <div style={{ display: mgmtTab === "sync" ? "block" : "none" }}><SyncTab stickyTop={stickyTop} data={data} setData={setData} notify={notify} onExportExcel={handleExportExcel} onExportPreviewExcel={handleExportPreviewExcel} onExportJson={handleExportJson} onImportExcelClick={() => xlsxImportRef.current?.click()} onImportJsonClick={() => jsonImportRef.current?.click()} hideFloatingSync={hideFloatingSync} /></div>
      </div>
      </div>
    </div>
  );
}


function ConfirmDialog({ title, message, confirmLabel, onConfirm, onCancel }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.84)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "88%", maxWidth: 340, background: "#181818", border: "1px solid #2a2a2a", borderRadius: 14, padding: 20 }} dir="rtl">
        <div style={{ fontSize: 13, fontWeight: 600, color: "#F5F0EB", marginBottom: 8 }}>{title}</div>
        <div style={{ fontSize: 11, color: "#777", lineHeight: 1.65, marginBottom: 18 }}>{message}</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={{ flex: 1, background: "transparent", border: "1px solid #2a2a2a", color: "#777", borderRadius: 8, padding: "10px 0", fontFamily: "inherit", fontSize: 11, cursor: "pointer" }} onClick={onCancel}>انصراف</button>
          <button style={{ flex: 1, background: "#8B1A1A", border: "none", color: "#fff", borderRadius: 8, padding: "10px 0", fontFamily: "inherit", fontSize: 11, cursor: "pointer" }} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

function ExcelImportConfirmDialog({ pendingData, onConfirmReplace, onConfirmMerge, onCancel }) {
  const { products = [], materials = [], customers = [], sessions = [] } = pendingData || {};

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 440, background: "#1c1c1c", border: "1px solid #2d2d2d", borderRadius: 16, padding: 24, boxShadow: "0 10px 30px rgba(0,0,0,0.5)" }} dir="rtl">
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <div style={{ background: "rgba(224, 138, 138, 0.1)", color: "#e08a8a", padding: 8, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#F5F0EB" }}>تایید ایمپورت فایل اکسل پشتیبان</div>
        </div>

        <div style={{ fontSize: 11, color: "#aaa", lineHeight: 1.7, marginBottom: 20 }}>
          یک فایل پشتیبان شامل اطلاعات زیر بارگذاری شده است. نحوه اعمال این تغییرات روی بانک اطلاعاتی فعلی را انتخاب کنید:
          <div style={{ margin: "12px 0", padding: "10px 14px", background: "#151515", borderRadius: 10, border: "1px solid #222", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 11 }}>
            <div style={{ color: "#888" }}>تعداد محصولات: <span style={{ color: "#F5F0EB", fontWeight: 600 }}>{products.length}</span></div>
            <div style={{ color: "#888" }}>تعداد متریال‌ها: <span style={{ color: "#F5F0EB", fontWeight: 600 }}>{materials.length}</span></div>
            <div style={{ color: "#888" }}>تعداد مشتریان: <span style={{ color: "#F5F0EB", fontWeight: 600 }}>{customers.length}</span></div>
            <div style={{ color: "#888" }}>جلسات برش: <span style={{ color: "#F5F0EB", fontWeight: 600 }}>{sessions.length}</span></div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button 
            style={{ 
              background: "#1d2a44", 
              border: "1px solid #2b3d63", 
              color: "#8faeff", 
              borderRadius: 10, 
              padding: "12px 16px", 
              fontFamily: "inherit", 
              fontSize: 12, 
              fontWeight: 600, 
              cursor: "pointer", 
              display: "flex", 
              flexDirection: "column", 
              alignItems: "flex-start", 
              gap: 4, 
              textAlign: "right",
              transition: "all 0.2s" 
            }} 
            onClick={onConfirmMerge}
          >
            <span style={{ fontSize: 12, color: "#a5c0ff" }}>✓ ادغام هوشمند (Smart Merge)</span>
            <span style={{ fontSize: 10, fontWeight: 400, color: "#6e84bd" }}>اطلاعات به صورت هوشمند ادغام شده و داده‌های تکراری بروزرسانی می‌شوند (بدون پاک شدن بانک اطلاعاتی فعلی)</span>
          </button>

          <button 
            style={{ 
              background: "#421616", 
              border: "1px solid #5e1f1f", 
              color: "#ff9191", 
              borderRadius: 10, 
              padding: "12px 16px", 
              fontFamily: "inherit", 
              fontSize: 12, 
              fontWeight: 600, 
              cursor: "pointer", 
              display: "flex", 
              flexDirection: "column", 
              alignItems: "flex-start", 
              gap: 4, 
              textAlign: "right",
              transition: "all 0.2s" 
            }} 
            onClick={onConfirmReplace}
          >
            <span style={{ fontSize: 12, color: "#ffa3a3" }}>⚠ جایگزینی کامل (Replace)</span>
            <span style={{ fontSize: 10, fontWeight: 400, color: "#b56c6c" }}>داده‌های فعلی به طور کامل پاک شده و اطلاعات فایل اکسل جدید به عنوان نسخه مرجع لود می‌شوند</span>
          </button>

          <button 
            style={{ 
              background: "transparent", 
              border: "1px solid #2d2d2d", 
              color: "#888", 
              borderRadius: 10, 
              padding: "10px 0", 
              fontFamily: "inherit", 
              fontSize: 11, 
              cursor: "pointer", 
              marginTop: 6 
            }} 
            onClick={onCancel}
          >
            انصراف
          </button>
        </div>
      </div>
    </div>
  );
}

// ── App ──
// ============================================================
// موتور قفل/آزادسازی — یک تابع خالص (بدون وابستگی به React) که یک بار روی
// یک اسنپ‌شات از materials/products اجرا می‌شود و نتیجه را برمی‌گرداند.
// این تابع بیرون از setData فراخوانی می‌شود تا شمارش نهایی (برای توست) همیشه
// دقیقاً با چیزی که واقعاً ذخیره می‌شود یکی باشد و به زمان‌بندی داخلی React
// برای اجرای آپدیتر وابسته نباشد (که می‌توانست باعث نمایش «چیزی برای قفل
// شدن نیست» شود درحالی‌که عملیات واقعاً موفق بود).
// ============================================================
// ── نسخه‌ی مستقل (بدون هوک) از منطق areaBatchCostByProduct/ratioByAreaCostByProduct/
// resolveLineCost بالاتر توی کامپوننت — چون آن‌ها useMemo/useCallback هستن و فقط
// روی state رندرشده‌ی فعلی کار می‌کنن، نمی‌شه از داخل یک آپدیتر setData صداشون زد.
// این نسخه‌ها عیناً همون منطق رو دارن، فقط به‌جای بستن روی data.materials/data.products
// از render، آرگومان می‌گیرن — تا بشه بلافاصله بعد از تغییر قیمت متریال (خرید/بچ جدید،
// ویرایش/حذف خرید یا بچ) یا موقع کلیک رفرش، قیمت محصولات درصدی رو هم‌زمان بازمحاسبه کرد.
function computeAreaBatchCostByProductPure(materials, products) {
  const result = {};
  materials.forEach((m) => {
    if (m.type !== "area" && m.type !== "fabric") return;
    const realBatches = m.batches || [];
    const directLinked = products.filter((p) =>
      (p.lineItems || []).some((li) => li.materialId === m.id && !li.batchId && !li.deductedAt)
    );
    const virtualBatch = directLinked.length > 0 ? {
      id: "__virtual__",
      width: m.dimW,
      height: m.dimH,
      totalCost: m.remainingCost != null ? toNum(m.remainingCost) : toNum(m.totalCost),
    } : null;
    const batchesToProcess = virtualBatch ? [...realBatches, virtualBatch] : realBatches;
    batchesToProcess.forEach((batch) => {
      const isVirtual = batch.id === "__virtual__";
      // فیکس واقعی: فرم افزودن بچ یه فیلد «تعداد بچ» داره (مثلاً ۳ رول یکسان)،
      // ولی قبلاً این عدد فقط برای تاریخچه‌ی خرید ثبت می‌شد و هیچ‌وقت روی خودِ
      // بچ ذخیره نمی‌شد؛ در نتیجه مساحت کل بچ همیشه فقط عرض×طولِ یه واحد
      // حساب می‌شد، انگار همیشه فقط ۱ عدد بوده. الان batch.qty واقعاً ذخیره
      // می‌شه (پیش‌فرض ۱ برای داده‌های قدیمی) و اینجا در مساحت ضرب می‌شه
      const batchArea = toNum(batch.width) * toNum(batch.height) * (toNum(batch.qty) || 1);
      if (batchArea <= 0) return;
      const batchCost = batch.totalCost != null ? toNum(batch.totalCost) : toNum(m.totalCost) / Math.max(1, (m.batches || []).length);
      const linkedProds = isVirtual
        ? directLinked
        : (batch.linkedProductIds || []).map((pid) => products.find((p) => p.id === pid)).filter(Boolean);
      const getArea = (p) => {
        const li = (p.lineItems || []).find((l) => isVirtual ? (l.materialId === m.id && !l.batchId) : (l.batchId === batch.id && l.materialId === m.id));
        return li?.manualArea != null ? toNum(li.manualArea) : getProductArea(p);
      };
      const usedArea = linkedProds.reduce((s, p) => s + getArea(p), 0);
      const leftoverArea = Math.max(0, batchArea - usedArea);
      const costPerArea = batchCost / batchArea;
      const wastageProds = linkedProds.filter((p) => {
        const li = (p.lineItems || []).find((l) => isVirtual ? (l.materialId === m.id && !l.batchId) : (l.batchId === batch.id && l.materialId === m.id));
        return li?.includeWastage;
      });
      const totalWastageArea = wastageProds.reduce((s, p) => s + getArea(p), 0);
      linkedProds.forEach((p) => {
        const li = (p.lineItems || []).find((l) => isVirtual ? (l.materialId === m.id && !l.batchId) : (l.batchId === batch.id && l.materialId === m.id));
        const ownArea = getArea(p);
        const getsWaste = li?.includeWastage;
        const wasteShare = (getsWaste && totalWastageArea > 0) ? (ownArea / totalWastageArea) * leftoverArea : 0;
        const totalArea = ownArea + wasteShare;
        if (!result[p.id]) result[p.id] = {};
        result[p.id][m.id] = totalArea * costPerArea;
      });
    });
  });
  return result;
}

function computeRatioByAreaCostByProductPure(materials, products) {
  const byMat = {};
  products.forEach((p) => {
    (p.lineItems || []).forEach((li) => {
      if (!li.materialId || !li.useAreaRatio) return;
      if (!byMat[li.materialId]) byMat[li.materialId] = [];
      byMat[li.materialId].push(p);
    });
  });
  const result = {};
  Object.entries(byMat).forEach(([materialId, prods]) => {
    const mat = materials.find((m) => m.id === materialId);
    if (!mat) return;
    const totalArea = prods.reduce((s, p) => s + getProductArea(p), 0);
    if (!totalArea) return;
    prods.forEach((p) => {
      const share = getProductArea(p) / totalArea;
      if (!result[p.id]) result[p.id] = {};
      result[p.id][materialId] = share * (mat.remainingCost != null ? toNum(mat.remainingCost) : toNum(mat.totalCost));
    });
  });
  return result;
}

function resolveLineCostPure(materials, areaBatchMap, ratioMap, p, li) {
  if (li.deductedAt) return toNum(li.deductedCost);
  if (li.materialId && areaBatchMap[p.id]?.[li.materialId] != null) {
    return areaBatchMap[p.id][li.materialId];
  }
  if (li.materialId && li.useAreaRatio) {
    const r = ratioMap[p.id]?.[li.materialId];
    return r != null ? r : toNum(li.cost);
  }
  if (li.materialId && li.pct != null) {
    const mat = materials.find((m) => m.id === li.materialId);
    if (!mat) return toNum(li.cost);
    const base = mat.remainingCost != null ? toNum(mat.remainingCost) : toNum(mat.totalCost);
    return (toNum(li.pct) / 100) * base;
  }
  // متریال «فرش» (fabric): درصد مصرف موقع قفل واقعی از رو مساحت محصول/مساحت فرش
  // محاسبه می‌شه (نه از یه li.pct ذخیره‌شده)، پس قبل از قفل شدن اینجا هیچ‌وقت
  // هزینه‌ای محاسبه نمی‌شد و متریال معلق فرش توی حسابداری زنده صفر نشون داده
  // می‌شد. الان همون فرمول دقیق پاس قفل رو اینجا هم زنده اجرا می‌کنیم.
  if (li.materialId && !li.batchId && !li.useAreaRatio) {
    const mat = materials.find((m) => m.id === li.materialId);
    if (mat && mat.type === "fabric") {
      const productArea = getProductArea(p);
      const coverage = toNum(p.fabricCoveragePct ?? 100) / 100;
      const fabricArea = toNum(mat.dimW) * toNum(mat.dimH);
      const pct = (fabricArea > 0 && productArea > 0) ? ((productArea * coverage) / fabricArea) * 100 : 100;
      const base = mat.remainingCost != null ? toNum(mat.remainingCost) : toNum(mat.totalCost);
      if (pct > 0) return (pct / 100) * base;
    }
  }
  return toNum(li.cost);
}

// قیمت فروش محصولاتی که با «درصد سود» (profitPct) قیمت‌گذاری شدن رو با
// هزینه‌ی به‌روزِ متریال بازمحاسبه می‌کنه؛ محصولات دستی (بدون profitPct) دست‌نخورده می‌مونن.
function syncPercentPricedProducts(materials, products) {
  // فقط محصولاتی که قیمت‌شان صریحاً «از درصد سود» است بازمحاسبه می‌شوند.
  // salePriceManual یا profitPct=null = قیمت دستی — دست نخور.
  const areaBatchMap = computeAreaBatchCostByProductPure(materials, products);
  const ratioMap = computeRatioByAreaCostByProductPure(materials, products);
  let changed = false;
  const next = products.map((p) => {
    if (p.salePriceManual === true || p.profitPct == null) return p;
    const totalCost = (p.lineItems || []).reduce((s, li) => s + resolveLineCostPure(materials, areaBatchMap, ratioMap, p, li), 0);
    const newSalePrice = calcPriceFromProfit(toNum(p.profitPct), totalCost);
    if (newSalePrice === toNum(p.salePrice)) return p;
    changed = true;
    const disc = toNum(p.discountPercent);
    const newDiscounted = disc > 0 ? Math.round(newSalePrice * (1 - disc / 100)) : newSalePrice;
    return { ...p, salePrice: newSalePrice, discountedPrice: newDiscounted };
  });
  return changed ? next : products;
}

function runLockUnlockPass(srcMaterials, srcProducts, pendingBulkChangesList, mode = "both") {
  let materials = srcMaterials.map(m => ({ ...m, sticks: m.sticks ? m.sticks.map(s => ({ ...s })) : [] }));
  let products = srcProducts.map(p => ({ ...p, lineItems: (p.lineItems || []).map(li => ({ ...li })) }));

  let lockedCount = 0;
  let releasedCount = 0;
  // هر آیتم قفل/آزادشده در این پاس، جدا از بقیه، اینجا ثبت می‌شه — برای اینکه
  // Undo بتونه فقط «آخرین یکی» رو برگردونه، نه کل پاس رو با هم (چون یه پاس
  // می‌تونه چندین آیتم مستقل رو با هم قفل/آزاد کنه). ترتیب مهمه: همون ترتیبی
  // که پایین اجرا می‌شن، پس واگرد باید از انتهای این لیست شروع بشه.
  const operations = [];

  const deductFromMaterial = (materialId, cost, qty) => {
    const mIdx = materials.findIndex(m => m.id === materialId);
    if (mIdx === -1) return false;
    const m = materials[mIdx];
    const currentRemainingCost = m.remainingCost != null ? toNum(m.remainingCost) : toNum(m.totalCost);
    if (currentRemainingCost <= 0) return false;
    const currentRemainingQty = m.remainingQty != null ? toNum(m.remainingQty) : toNum(m.purchaseQty || 0);
    const newRemainingCost = Math.max(0, currentRemainingCost - cost);
    const newRemainingQty = Math.max(0, currentRemainingQty - (qty || 0));
    materials[mIdx] = { ...m, remainingCost: newRemainingCost, remainingQty: newRemainingQty, hidden: newRemainingCost <= 0 ? true : m.hidden };
    return true;
  };

  const refundToMaterial = (materialId, cost, qty) => {
    const mIdx = materials.findIndex(m => m.id === materialId);
    if (mIdx === -1) return;
    const m = materials[mIdx];
    const currentRemainingCost = m.remainingCost != null ? toNum(m.remainingCost) : toNum(m.totalCost);
    const total = toNum(m.totalCost);
    const currentRemainingQty = m.remainingQty != null ? toNum(m.remainingQty) : toNum(m.purchaseQty || 0);
    const totalQty = m.totalQty != null ? toNum(m.totalQty) : toNum(m.purchaseQty || 0);
    materials[mIdx] = {
      ...m,
      remainingCost: Math.min(total, currentRemainingCost + toNum(cost || 0)),
      remainingQty: Math.min(Math.max(totalQty, currentRemainingQty), currentRemainingQty + toNum(qty || 0)),
      hidden: false,
    };
  };

  const fallbackSessionId = uid();

  // ── ۳. صف قفل/آزادسازی بچ‌های تکی (دکمه قفل/باز روی هر بچ متریال مساحتی) ──
  // شکل واقعی هر آیتم این صف: { materialId, batchId, action: 'lock' | 'unlock' }
  pendingBulkChangesList.forEach((change) => {
    const mIdx = materials.findIndex(m => m.id === change.materialId);
    if (mIdx === -1) return;
    const m = materials[mIdx];
    const bIdx = (m.batches || []).findIndex(b => b.id === change.batchId);
    if (bIdx === -1) return;
    const batch = m.batches[bIdx];

    if (change.action === "lock" && mode !== "unlock") {
      if (batch.locked) return;
      const batchArea = toNum(batch.width) * toNum(batch.height) * (toNum(batch.qty) || 1);
      const itemOps = [];

      // آیتم‌های قفل‌نشده‌ی همین بچ که قراره همین الان قفل بشن
      const toLock = [];
      (batch.linkedProductIds || []).forEach((pid) => {
        const pIdx = products.findIndex(p => p.id === pid);
        if (pIdx === -1) return;
        const p = products[pIdx];
        const liIdx = p.lineItems.findIndex(li => li.materialId === change.materialId && li.batchId === change.batchId && !li.deductedAt);
        if (liIdx === -1) return;
        const li = p.lineItems[liIdx];
        const area = li.manualArea != null ? toNum(li.manualArea) : getProductArea(p);
        toLock.push({ pid, pIdx, liIdx, li, area });
      });

      // مبلغ/مساحتِ از قبل قفل‌شده‌ی همین بچ (اگه بخشی از محصولات این بچ زودتر جدا قفل شده باشن)
      let alreadyLockedCost = 0, alreadyLockedArea = 0;
      products.forEach((p) => (p.lineItems || []).forEach((li) => {
        if (li.materialId === change.materialId && li.batchId === change.batchId && li.deductedAt) {
          alreadyLockedCost += toNum(li.deductedCost || 0);
          alreadyLockedArea += li.manualArea != null ? toNum(li.manualArea) : getProductArea(p);
        }
      }));

      const remainingCapacityCost = Math.max(0, toNum(batch.totalCost) - alreadyLockedCost);
      const remainingCapacityArea = Math.max(0, batchArea - alreadyLockedArea);
      const totalAreaToLock = toLock.reduce((s, x) => s + x.area, 0);
      // آیتم ۱۳ (روادمپ): همون فرمولِ لحظه‌ی نمایش زنده رو موقع قفل‌کردن هم استفاده می‌کنیم —
      // اگه سهم فیزیکیِ محصولاتِ درحال‌قفل‌شدن از ظرفیتِ باقیمانده‌ی بچ بیشتر بشه (پرتی خودکار)،
      // یا اگه صراحتاً حالت «پرتی» روی این آیتم‌ها انتخاب شده، به نسبت مساحت از باقیمانده‌ی
      // بچ سهم می‌گیرن؛ وگرنه دقیقاً سهم فیزیکی خودشون (لایو/باقی بماند). این مقدار همون لحظه
      // برای همیشه توی deductedCost فریز می‌شه و دیگه (نه با تغییر بعدی هزینه‌ی متریال، نه با
      // رفرش) بازمحاسبه نمی‌شه — فقط با Undo دقیقاً به prevLi (مقدار قبل از قفل) برمی‌گرده.
      const anyWastage = toLock.some((x) => x.li.includeWastage);
      const overAllocated = totalAreaToLock > remainingCapacityArea + 0.0001;
      const useWasteFormula = anyWastage || overAllocated;
      const costPerArea = batchArea > 0 ? toNum(batch.totalCost) / batchArea : 0;

      toLock.forEach(({ pid, pIdx, liIdx, li, area }) => {
        const prevLi = { ...products[pIdx].lineItems[liIdx] };
        let amount;
        if (useWasteFormula) {
          const share = totalAreaToLock > 0 ? area / totalAreaToLock : (1 / Math.max(1, toLock.length));
          amount = remainingCapacityCost * share;
        } else {
          amount = area * costPerArea;
        }
        products[pIdx].lineItems[liIdx] = {
          ...products[pIdx].lineItems[liIdx],
          deductedAt: todayISO(),
          deductedCost: amount,
          bulkSessionId: products[pIdx].lineItems[liIdx].pendingSessionId || fallbackSessionId,
          pendingSessionId: null,
        };
        itemOps.push({ productId: pid, lineItemId: prevLi.id, prevLi });
        lockedCount++;
      });
      materials[mIdx] = { ...m, batches: m.batches.map((b, i) => i === bIdx ? { ...b, locked: true } : b) };
      if (itemOps.length) operations.push({ kind: "batchBulkLock", materialId: change.materialId, batchId: change.batchId, itemOps });
    } else if (change.action === "unlock" && mode !== "lock") {
      if (!batch.locked) return;
      const itemOps = [];
      (batch.linkedProductIds || []).forEach((pid) => {
        const pIdx = products.findIndex(p => p.id === pid);
        if (pIdx === -1) return;
        const p = products[pIdx];
        const liIdx = p.lineItems.findIndex(li => li.materialId === change.materialId && li.batchId === change.batchId && li.deductedAt);
        if (liIdx === -1) return;
        const prevLi = { ...products[pIdx].lineItems[liIdx] };
        products[pIdx].lineItems[liIdx] = { ...products[pIdx].lineItems[liIdx], deductedAt: null, deductedCost: null, bulkSessionId: null };
        itemOps.push({ productId: pid, lineItemId: prevLi.id, prevLi });
        releasedCount++;
      });
      materials[mIdx] = { ...m, batches: m.batches.map((b, i) => i === bIdx ? { ...b, locked: false } : b), hidden: false };
      if (itemOps.length) operations.push({ kind: "batchBulkUnlock", materialId: change.materialId, batchId: change.batchId, itemOps });
    }
  });

  // ── ۴. مرحله اول: قفل کردن (LOCK) — همیشه قبل از آزادسازی اجرا می‌شود ──
  if (mode !== "unlock") {
  // ۴.۱) آیتم‌های مبتنی بر استخر قیمت/مقدار (نسبتی، ثابت، فرش، مساحتی-بدون-بچ)
  const byMaterial = {};
  products.forEach(p => {
    p.lineItems.forEach(li => {
      if (!li.materialId || li.deductedAt || li.pendingUnlock) return;
      const mat = materials.find(m => m.id === li.materialId);
      if (!mat) return;

      if (mat.type === "fabric") {
        const productArea = getProductArea(p);
        const coverage = toNum(p.fabricCoveragePct ?? 100) / 100;
        const fabricArea = toNum(mat.dimW) * toNum(mat.dimH);
        const pct = (fabricArea > 0 && productArea > 0) ? ((productArea * coverage) / fabricArea) * 100 : 100;
        if (pct > 0) (byMaterial[mat.id] = byMaterial[mat.id] || []).push({ p, li, pct });
        return;
      }
      if (li.pct != null && toNum(li.pct) > 0) {
        (byMaterial[mat.id] = byMaterial[mat.id] || []).push({ p, li, pct: toNum(li.pct) });
        return;
      }
      if (li.pct == null && !li.batchId && !li.useAreaRatio && toNum(li.cost) > 0 && (li.woodCuts || []).length === 0) {
        (byMaterial[mat.id] = byMaterial[mat.id] || []).push({ p, li, absCost: toNum(li.cost) });
      }
    });
  });

  Object.entries(byMaterial).forEach(([materialId, items]) => {
    const mIdx = materials.findIndex(m => m.id === materialId);
    if (mIdx === -1) return;
    const m = materials[mIdx];
    const poolCost = m.remainingCost != null ? toNum(m.remainingCost) : toNum(m.totalCost);
    const poolQty = m.remainingQty != null ? toNum(m.remainingQty) : toNum(m.purchaseQty || 0);
    const unitPrice = poolQty > 0 ? poolCost / poolQty : 0;

    let usedCost = 0, usedQty = 0;
    items.forEach(({ p, li, pct, absCost }) => {
      const lockedCost = absCost != null ? absCost : (pct / 100) * poolCost;
      const lockedQty = unitPrice > 0 ? lockedCost / unitPrice : 0;
      const pIdx = products.findIndex(x => x.id === p.id);
      if (pIdx === -1) return;
      const liIdx = products[pIdx].lineItems.findIndex(x => x.id === li.id);
      if (liIdx === -1) return;
      const prevLi = { ...products[pIdx].lineItems[liIdx] };
      products[pIdx].lineItems[liIdx] = {
        ...products[pIdx].lineItems[liIdx],
        deductedAt: todayISO(),
        deductedCost: lockedCost,
        deductedQty: lockedQty,
        bulkSessionId: li.pendingSessionId || uid(),
        pendingSessionId: null,
      };
      usedCost += lockedCost;
      usedQty += lockedQty;
      lockedCount++;
      operations.push({ kind: "poolLock", productId: p.id, lineItemId: prevLi.id, prevLi, materialId, cost: lockedCost, qty: lockedQty });
    });

    materials[mIdx] = {
      ...m,
      remainingCost: Math.max(0, poolCost - usedCost),
      remainingQty: Math.max(0, poolQty - usedQty),
      hidden: (poolCost - usedCost) <= 0 ? true : m.hidden,
    };
  });

  // ۴.۲) چوب‌ها (خطی)
  products = products.map((p) => {
    const lineItems = p.lineItems.map((li) => {
      if (!li.materialId || li.deductedAt || li.pendingUnlock) return li;
      if ((li.woodCuts || []).length > 0 && !li.woodLocked) {
        const mat = materials.find(m => m.id === li.materialId);
        if (mat && mat.type === "linear" && mat.sticks) {
          const sticks = mat.sticks.map(s => ({ ...s }));
          let allFound = true;
          const stickDeltas = [];
          li.woodCuts.forEach(cut => {
            const s = sticks.find(x => x.id === cut.stickId);
            if (s && toNum(s.qty) > 0) {
              s.qty = toNum(s.qty) - 1;
              stickDeltas.push({ stickId: cut.stickId, length: s.length, qty: 1 });
            }
            else { allFound = false; }
          });
          if (allFound) {
            materials = materials.map(m => m.id === mat.id ? { ...m, sticks: sticks.filter(s => toNum(s.qty) > 0) } : m);
            lockedCount++;
            const prevLi = { ...li };
            operations.push({ kind: "woodLock", productId: p.id, lineItemId: li.id, prevLi, materialId: mat.id, stickDeltas });
            return { ...li, deductedAt: todayISO(), deductedCost: toNum(li.cost) || 0, woodLocked: true, bulkSessionId: li.pendingSessionId || uid(), pendingSessionId: null };
          }
        }
      }
      return li;
    });
    return { ...p, lineItems };
  });

  // ۴.۳) بچ‌های مساحتی/فرش — گروه‌بندی بر اساس بچ. سهم هر محصولِ تازه بر مبنای مساحت از
  // «باقیمانده‌ی همان بچ» (نه کل بچ) محاسبه و از استخر remainingCost متریال هم کسر می‌شود.
  const byBatch = {};
  products.forEach(p => {
    p.lineItems.forEach(li => {
      if (!li.materialId || li.deductedAt || li.pendingUnlock || !li.batchId) return;
      const mat = materials.find(m => m.id === li.materialId);
      if (!mat) return;
      const batch = (mat.batches || []).find(b => b.id === li.batchId);
      if (!batch) return;
      const key = mat.id + "::" + batch.id;
      (byBatch[key] = byBatch[key] || { matId: mat.id, batchId: batch.id, items: [] }).items.push({ p, li });
    });
  });

  Object.values(byBatch).forEach(({ matId, batchId: bId, items }) => {
    const mIdx = materials.findIndex(m => m.id === matId);
    if (mIdx === -1) return;
    const mat = materials[mIdx];
    const bIdx = (mat.batches || []).findIndex(b => b.id === bId);
    if (bIdx === -1) return;
    const batch = mat.batches[bIdx];

    let alreadyDeducted = 0;
    let alreadyUsedArea = 0;
    products.forEach(p => (p.lineItems || []).forEach(li => {
      if (li.materialId === matId && li.batchId === bId && li.deductedAt) {
        alreadyDeducted += toNum(li.deductedCost || 0);
        alreadyUsedArea += getProductArea(p);
      }
    }));
    const batchRemaining = Math.max(0, toNum(batch.totalCost) - alreadyDeducted);
    if (batchRemaining <= 0) return;

    let totalNewArea = 0;
    items.forEach(({ p }) => { totalNewArea += getProductArea(p); });
    if (totalNewArea <= 0) return;

    // دکمه‌ی «پرتی شود» قبلاً هیچ اثری روی مبلغ واقعیِ قفل‌شده نداشت — باقیمانده‌ی
    // بچ همیشه فقط به نسبت مساحت خودِ محصولات تقسیم می‌شد، صرف‌نظر از این‌که
    // includeWastage تیک خورده باشه یا نه (فقط توی پیش‌نمایش لحاظ می‌شد، نه توی
    // قفل واقعی). الان اگه ابعاد بچ (width/height) معتبر باشه، دقیقاً همون منطق
    // پیش‌نمایش (computeAreaBatchCostByProductPure) اینجا هم اجرا می‌شه: باقیمانده‌ی
    // فیزیکیِ بچ (بعد از کسر مساحت مصرفیِ قبلی و همین دور) بین آیتم‌های
    // «پرتی‌شود»-دارِ همین دور تقسیم و به هزینه‌شون اضافه می‌شه. اگه ابعاد بچ
    // معتبر نباشه (خیلی از خریدهای قدیمی‌تر شاید نداشته باشن)، برای امنیت به
    // همون روش قبلی (تقسیم به‌نسبت از کل باقیمانده‌ی هزینه) برمی‌گرده — چون
    // بدون ابعاد نمی‌شه مساحت واقعی هدررفت رو محاسبه کرد.
    // تقسیم هدررفت بین آیتم‌های «پرتی‌شود»: به نسبت مساحت خودشون (نه مساوی) —
    // چون تقسیم مساوی می‌تونست قیمت یه محصول خیلی کوچیک رو نامتناسب بالا ببره؛
    // محصول بزرگ‌تر سهم بیشتری از هدررفت می‌گیره، کوچیک‌تر سهم کمتری
    const batchArea = toNum(batch.width) * toNum(batch.height) * (toNum(batch.qty) || 1);
    let consumedThisRound = 0;
    if (batchArea > 0) {
      const costPerArea = toNum(batch.totalCost) / batchArea;
      const leftoverArea = Math.max(0, batchArea - alreadyUsedArea - totalNewArea);
      const wastageItems = items.filter(({ li }) => li.includeWastage);
      const totalWastageArea = wastageItems.reduce((sum, { p }) => sum + getProductArea(p), 0);
      items.forEach(({ p, li }) => {
        const ownArea = getProductArea(p);
        const getsWaste = !!li.includeWastage;
        const wasteShare = (getsWaste && totalWastageArea > 0) ? (ownArea / totalWastageArea) * leftoverArea : 0;
        const totalAreaForItem = ownArea + wasteShare;
        const amount = totalAreaForItem * costPerArea;
        if (amount <= 0) return;
        const pIdx = products.findIndex(x => x.id === p.id);
        if (pIdx === -1) return;
        const liIdx = products[pIdx].lineItems.findIndex(x => x.id === li.id);
        if (liIdx === -1) return;
        const prevLi = { ...products[pIdx].lineItems[liIdx] };
        deductFromMaterial(matId, amount, 0);
        products[pIdx].lineItems[liIdx] = {
          ...products[pIdx].lineItems[liIdx],
          deductedAt: todayISO(),
          deductedCost: amount,
          bulkSessionId: li.pendingSessionId || uid(),
          pendingSessionId: null,
        };
        consumedThisRound += amount;
        lockedCount++;
        operations.push({ kind: "batchAreaLock", productId: p.id, lineItemId: prevLi.id, prevLi, materialId: matId, cost: amount, batchId: bId, batchJustCompleted: false });
      });
    } else {
      items.forEach(({ p, li }) => {
        const productArea = getProductArea(p);
        const share = productArea / totalNewArea;
        const amount = batchRemaining * share;
        if (amount <= 0) return;
        const pIdx = products.findIndex(x => x.id === p.id);
        if (pIdx === -1) return;
        const liIdx = products[pIdx].lineItems.findIndex(x => x.id === li.id);
        if (liIdx === -1) return;
        const prevLi = { ...products[pIdx].lineItems[liIdx] };
        deductFromMaterial(matId, amount, 0);
        products[pIdx].lineItems[liIdx] = {
          ...products[pIdx].lineItems[liIdx],
          deductedAt: todayISO(),
          deductedCost: amount,
          bulkSessionId: li.pendingSessionId || uid(),
          pendingSessionId: null,
        };
        consumedThisRound += amount;
        lockedCount++;
        operations.push({ kind: "batchAreaLock", productId: p.id, lineItemId: prevLi.id, prevLi, materialId: matId, cost: amount, batchId: bId, batchJustCompleted: false });
      });
    }

    if (alreadyDeducted + consumedThisRound >= toNum(batch.totalCost) - 0.01) {
      const mIdx2 = materials.findIndex(m => m.id === matId);
      if (mIdx2 !== -1) {
        materials[mIdx2] = {
          ...materials[mIdx2],
          batches: materials[mIdx2].batches.map(b => b.id === bId ? { ...b, locked: true } : b),
        };
        // آخرین عملیاتی که همین حالا برای این بچ ثبت شد رو علامت می‌زنیم که «تکمیل‌کننده‌ی بچ» بوده،
        // تا اگه دقیقاً همین یکی Undo شد، پرچم locked بچ هم برگرده false (نه بقیه‌ی آیتم‌های قبلی بچ)
        for (let i = operations.length - 1; i >= 0; i--) {
          if (operations[i].kind === "batchAreaLock" && operations[i].batchId === bId) {
            operations[i].batchJustCompleted = true;
            break;
          }
        }
      }
    }
  });

  } // پایان بخش ۴ (فقط وقتی mode !== "unlock")

  // ── ۵. مرحله دوم: آزادسازی (UNLOCK) ──
  if (mode !== "lock") {
  products = products.map((p) => {
    let lineItems = p.lineItems.map((li) => {
      if (!li.materialId || !li.pendingUnlock) return li;

      const prevLi = { ...li };
      const stickDeltas = [];

      if (li.deductedCost != null || li.deductedQty != null) {
        refundToMaterial(li.materialId, li.deductedCost, li.deductedQty);
      }
      if (li.woodLocked && li.woodCuts) {
        const mIdx2 = materials.findIndex(m => m.id === li.materialId);
        if (mIdx2 !== -1) {
          const m = materials[mIdx2];
          const sticks = [...(m.sticks || [])];
          li.woodCuts.forEach(cut => {
            const s = sticks.find(x => x.id === cut.stickId);
            if (s) s.qty = toNum(s.qty) + 1;
            else sticks.push({ id: cut.stickId || uid(), length: cut.length, qty: 1 });
            stickDeltas.push({ stickId: cut.stickId, length: cut.length, qty: 1 });
          });
          materials[mIdx2] = { ...m, sticks };
        }
      }
      releasedCount++;
      operations.push({
        kind: "unlock",
        productId: p.id,
        lineItemId: li.id,
        prevLi,
        materialId: li.materialId,
        refundCost: li.deductedCost,
        refundQty: li.deductedQty,
        stickDeltas,
      });

      // بعد از آزادسازی، لینک از محصول حذف می‌شود (دیگر معلق زرد نمی‌شود)
      return { ...li, _toRemove: true };
    });
    lineItems = lineItems.filter(li => !li._toRemove);
    return { ...p, lineItems };
  });

  // اعتبارهای آبی ذخیره‌شده روی متریال (حذف محصول و ...)
  materials = materials.map((m) => {
    const credits = m.pendingReleaseCredits || [];
    if (!credits.length) return m;
    let sticks = (m.sticks || []).map(s => ({ ...s }));
    let remainingCost = m.remainingCost != null ? toNum(m.remainingCost) : toNum(m.totalCost);
    const total = toNum(m.totalCost);
    let remainingQty = m.remainingQty != null ? toNum(m.remainingQty) : toNum(m.purchaseQty || 0);
    credits.forEach((c) => {
      remainingCost = Math.min(total, remainingCost + toNum(c.cost));
      remainingQty = remainingQty + toNum(c.qty || 0);
      if (c.woodLocked && c.woodCuts) {
        c.woodCuts.forEach(cut => {
          const s = sticks.find(x => x.id === cut.stickId);
          if (s) s.qty = toNum(s.qty) + 1;
          else sticks.push({ id: cut.stickId || uid(), length: cut.length, qty: 1 });
        });
      }
      releasedCount++;
      operations.push({
        kind: "creditUnlock",
        materialId: m.id,
        credit: c,
      });
    });
    return {
      ...m,
      sticks,
      remainingCost,
      remainingQty,
      pendingReleaseCredits: [],
      hidden: remainingCost <= 0 ? m.hidden : false,
    };
  });
  } // پایان بخش ۵ (فقط وقتی mode !== "lock")

  return { materials, products, lockedCount, releasedCount, operations };
}

// واگرد دقیق «فقط یک» عملیات قفل/آزادسازی (نه کل پاس) — دقیقاً همون منطق
// deductFromMaterial/refundToMaterial بالا رو برعکس اعمال می‌کنه، به‌علاوه‌ی
// برگردوندن خودِ فیلدهای line item به حالت قبلش (prevLi) و اصلاح موجودی چوب‌ها.
function reverseOperation(srcMaterials, srcProducts, op) {
  let materials = srcMaterials.map(m => ({ ...m, sticks: m.sticks ? m.sticks.map(s => ({ ...s })) : [], batches: m.batches ? m.batches.map(b => ({ ...b })) : m.batches }));
  let products = srcProducts.map(p => ({ ...p, lineItems: (p.lineItems || []).map(li => ({ ...li })) }));

  const restoreLi = (productId, lineItemId, prevLi) => {
    const pIdx = products.findIndex(p => p.id === productId);
    if (pIdx === -1) return;
    const liIdx = products[pIdx].lineItems.findIndex(li => li.id === lineItemId);
    if (liIdx === -1) {
      // باگ واقعی بود: بعد از یه unlock واقعی، خودِ لاین‌آیتم کاملاً از محصول
      // حذف می‌شه (نه فقط pendingUnlock می‌شه) — پس اینجا هیچ‌وقت پیدا نمی‌شد و
      // این تابع بی‌صدا هیچ کاری نمی‌کرد. یعنی موجودی متریال (deductCostQty)
      // برمی‌گشت ولی خودِ محصول دیگه هیچ ردی از این متریال نداشت — undo از نظر
      // کاربر «کار نمی‌کرد». الان اگه لاین‌آیتم پیدا نشه، دوباره به محصول اضافه‌ش می‌کنیم.
      products[pIdx] = { ...products[pIdx], lineItems: [...products[pIdx].lineItems, { ...prevLi }] };
      return;
    }
    products[pIdx].lineItems[liIdx] = { ...prevLi };
  };

  const refundCostQty = (materialId, cost, qty) => {
    const mIdx = materials.findIndex(m => m.id === materialId);
    if (mIdx === -1) return;
    const m = materials[mIdx];
    const currentRemainingCost = m.remainingCost != null ? toNum(m.remainingCost) : toNum(m.totalCost);
    const total = toNum(m.totalCost);
    const currentRemainingQty = m.remainingQty != null ? toNum(m.remainingQty) : toNum(m.purchaseQty || 0);
    const totalQty = m.totalQty != null ? toNum(m.totalQty) : toNum(m.purchaseQty || 0);
    materials[mIdx] = {
      ...m,
      remainingCost: Math.min(total, currentRemainingCost + toNum(cost || 0)),
      remainingQty: Math.min(Math.max(totalQty, currentRemainingQty), currentRemainingQty + toNum(qty || 0)),
      hidden: false,
    };
  };

  const deductCostQty = (materialId, cost, qty) => {
    const mIdx = materials.findIndex(m => m.id === materialId);
    if (mIdx === -1) return;
    const m = materials[mIdx];
    const currentRemainingCost = m.remainingCost != null ? toNum(m.remainingCost) : toNum(m.totalCost);
    const currentRemainingQty = m.remainingQty != null ? toNum(m.remainingQty) : toNum(m.purchaseQty || 0);
    const newRemainingCost = Math.max(0, currentRemainingCost - toNum(cost || 0));
    const newRemainingQty = Math.max(0, currentRemainingQty - toNum(qty || 0));
    materials[mIdx] = { ...m, remainingCost: newRemainingCost, remainingQty: newRemainingQty, hidden: newRemainingCost <= 0 ? true : m.hidden };
  };

  const restoreSticks = (materialId, stickDeltas) => {
    const mIdx = materials.findIndex(m => m.id === materialId);
    if (mIdx === -1) return;
    const m = materials[mIdx];
    const sticks = [...(m.sticks || [])];
    (stickDeltas || []).forEach(({ stickId, length, qty }) => {
      const s = sticks.find(x => x.id === stickId);
      if (s) s.qty = toNum(s.qty) + qty;
      else sticks.push({ id: stickId || uid(), length, qty });
    });
    materials[mIdx] = { ...m, sticks };
  };

  const consumeSticks = (materialId, stickDeltas) => {
    const mIdx = materials.findIndex(m => m.id === materialId);
    if (mIdx === -1) return;
    const m = materials[mIdx];
    let sticks = (m.sticks || []).map(s => ({ ...s }));
    (stickDeltas || []).forEach(({ stickId, qty }) => {
      const s = sticks.find(x => x.id === stickId);
      if (s) s.qty = Math.max(0, toNum(s.qty) - qty);
    });
    sticks = sticks.filter(s => toNum(s.qty) > 0);
    materials[mIdx] = { ...m, sticks };
  };

  switch (op.kind) {
    case "batchBulkLock": {
      (op.itemOps || []).forEach(({ productId, lineItemId, prevLi }) => restoreLi(productId, lineItemId, prevLi));
      const mIdx = materials.findIndex(m => m.id === op.materialId);
      if (mIdx !== -1) materials[mIdx] = { ...materials[mIdx], batches: materials[mIdx].batches.map(b => b.id === op.batchId ? { ...b, locked: false } : b) };
      break;
    }
    case "batchBulkUnlock": {
      (op.itemOps || []).forEach(({ productId, lineItemId, prevLi }) => restoreLi(productId, lineItemId, prevLi));
      const mIdx = materials.findIndex(m => m.id === op.materialId);
      if (mIdx !== -1) materials[mIdx] = { ...materials[mIdx], batches: materials[mIdx].batches.map(b => b.id === op.batchId ? { ...b, locked: true } : b) };
      break;
    }
    case "poolLock": {
      refundCostQty(op.materialId, op.cost, op.qty);
      restoreLi(op.productId, op.lineItemId, op.prevLi);
      break;
    }
    case "woodLock": {
      restoreSticks(op.materialId, op.stickDeltas);
      restoreLi(op.productId, op.lineItemId, op.prevLi);
      break;
    }
    case "batchAreaLock": {
      refundCostQty(op.materialId, op.cost, 0);
      if (op.batchJustCompleted) {
        const mIdx = materials.findIndex(m => m.id === op.materialId);
        if (mIdx !== -1) materials[mIdx] = { ...materials[mIdx], batches: materials[mIdx].batches.map(b => b.id === op.batchId ? { ...b, locked: false } : b) };
      }
      restoreLi(op.productId, op.lineItemId, op.prevLi);
      break;
    }
    case "unlock": {
      deductCostQty(op.materialId, op.refundCost, op.refundQty);
      if (op.stickDeltas && op.stickDeltas.length) consumeSticks(op.materialId, op.stickDeltas);
      restoreLi(op.productId, op.lineItemId, op.prevLi);
      break;
    }
    case "creditUnlock": {
      // معکوس: دوباره اعتبار آبی را روی متریال بگذار و از remaining کم کن
      const mIdx = materials.findIndex(m => m.id === op.materialId);
      if (mIdx !== -1) {
        const m = materials[mIdx];
        const c = op.credit || {};
        const cost = toNum(c.cost);
        const qty = toNum(c.qty);
        const curRem = m.remainingCost != null ? toNum(m.remainingCost) : toNum(m.totalCost);
        const curQty = m.remainingQty != null ? toNum(m.remainingQty) : toNum(m.purchaseQty || 0);
        let sticks = (m.sticks || []).map(s => ({ ...s }));
        if (c.woodLocked && c.woodCuts) {
          c.woodCuts.forEach(cut => {
            const s = sticks.find(x => x.id === cut.stickId);
            if (s) s.qty = Math.max(0, toNum(s.qty) - 1);
          });
          sticks = sticks.filter(s => toNum(s.qty) > 0);
        }
        materials[mIdx] = {
          ...m,
          remainingCost: Math.max(0, curRem - cost),
          remainingQty: Math.max(0, curQty - qty),
          sticks,
          pendingReleaseCredits: [...(m.pendingReleaseCredits || []), c],
        };
      }
      break;
    }
    default:
      break;
  }

  return { materials, products };
}

export default function App() {
  const { showToast } = useToast();
  const notify = useCallback((msg) => showToast(msg), [showToast]);
  const { token } = useAuth() || {};
  const [data, _setData] = useState(() => {
    try {
      const loaded = loadData();
      if (loaded.products && Array.isArray(loaded.products)) {
        loaded.products = loaded.products.map((p) => {
          if (!p.shape) p.shape = "rectangle";
          if (!p.dimW && p.dims) {
            const parsed = String(p.dims).replace("×", "x").split("x");
            if (parsed[0]) p.dimW = parseFloat(parsed[0]) || null;
            if (parsed[1]) p.dimH = parseFloat(parsed[1]) || null;
          }
          // مهاجرت: عدد بزرگ‌تر همیشه اول (dimW)، کوچیک‌تر دوم (dimH) — Big×Small.
          // این نرمالایز برای همه‌ی محصولات مستطیلی (نه دایره/نیم‌دایره) روی کل
          // دیتای موجود هم اجرا می‌شه، نه فقط موقع ذخیره‌ی بعدی
          if (p.shape !== "circle" && p.shape !== "semi-circle" && p.dimW != null && p.dimH != null) {
            const w = parseFloat(p.dimW), h = parseFloat(p.dimH);
            if (!isNaN(w) && !isNaN(h) && w < h) {
              p.dimW = h;
              p.dimH = w;
              p.dims = `${h}×${w}`;
            }
          }
          return p;
        });
      }
      return loaded;
    } catch (err) {
      console.warn("App: loadData failed, using defaults:", err);
      return { products: [], materials: [], customers: [], equipment: [], workshopLinks: [] };
    }
  });

  const setData = useCallback((update) => {
    _setData((prev) => {
      const next = typeof update === "function" ? update(prev) : update;
      return processStateUpdate(prev, next);
    });
  }, []);

  const [activeTab, setActiveTab] = useState("catalog");
  // بخش ۳۶: سوایپ چپ/راست بین تب‌های اصلی برنامه — تب «کاتالوگ» عمداً از این
  // زنجیره حذف شده: نباید بشه با سوایپ از کاتالوگ وارد بقیه‌ی تب‌ها (که
  // اطلاعات کاری/حساسن) شد، و برعکس از تب «محصولات» با سوایپ به عقب نباید
  // به کاتالوگ برگشت. وقتی activeTab برابر «catalog» باشه، ایندکسش توی این
  // آرایه -1 می‌شه و هوک سوایپ به‌طور طبیعی هیچ کاری نمی‌کنه.
  // ⚠️ نکته‌ی مهم: خودِ useSwipeTabNav (که به isAnyModalOpen نیاز داره) عمداً
  // اینجا صدا زده نمی‌شه — چون isAnyModalOpen چند صد خط پایین‌تر تعریف می‌شه و
  // استفاده‌ی زودتر از موعدش باعث کرش «Cannot access 'isAnyModalOpen' before
  // initialization» (Temporal Dead Zone) می‌شد. خودِ فراخوانی پایین‌تر، درست
  // بعد از تعریف isAnyModalOpen، انجام می‌شه.
  const MAIN_TAB_ORDER = ["products", "materials", "woodCutting", "gallery", "accounting", "invoices"];
  const mainTabSlideClass = useTabSlideClass(MAIN_TAB_ORDER, activeTab);
  const [showManagementPanel, setShowManagementPanel] = useState(false);
  const [sortMode, setSortMode] = useState("code");
  const [sortOrder, setSortOrder] = useState("code");
  const [sortOrderMaterials, setSortOrderMaterials] = useState("code");
  const [sortOrderGallery, setSortOrderGallery] = useState("count");
  const [confirmDeleteProduct, setConfirmDeleteProduct] = useState(null);
  const [confirmDeleteMaterial, setConfirmDeleteMaterial] = useState(null);
  const [confirmDeleteCustomer, setConfirmDeleteCustomer] = useState(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [pendingExcelImport, setPendingExcelImport] = useState(null);


  // ── کارت ویزیت ──
  const [myBusinessCard, setMyBusinessCard] = useState(() => data.myBusinessCard || emptyBusinessCard());
  const [businessCards, setBusinessCards] = useState(() => data.businessCards || []);
  const [showBusinessCardEditor, setShowBusinessCardEditor] = useState(false);

  useEffect(() => {
    setMyBusinessCard(data.myBusinessCard || emptyBusinessCard());
    setBusinessCards(data.businessCards || []);
  }, [data]);

  // بخش جدید: اسکرول خودکار فیلد فعال بالای کیبورد موبایل + برگردوندن اسکرول موقع بسته‌شدن کیبورد
  useEffect(() => initKeyboardScroll(), []);

  const handleSaveBusinessCards = (myCard, cards) => {
    setData((prev) => ({
      ...prev,
      myBusinessCard: myCard,
      businessCards: cards,
    }));
    notify("کارت ویزیت ذخیره شد");
  };

  // ── سبد خرید ──
  const [basket, setBasket] = useState([]);
  const [showBasket, setShowBasket] = useState(false);

  // ── PWA Installation & Offline Support ──
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsInstallable(false);
      showToast("برنامه با موفقیت روی دستگاه شما نصب شد!", "success");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    // Initial check if standalone (PWA installed)
    if (window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone) {
      setIsInstallable(false);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, [showToast]);

  const handleInstallApp = async () => {
    if (!deferredPrompt) {
      showToast("امکان نصب خودکار در این مرورگر وجود ندارد. لطفاً از منوی مرورگر گزینه‌‌ی 'Install' یا 'Add to Home Screen' را انتخاب کنید.", "info");
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      showToast("در حال نصب برنامه...", "success");
    }
    setDeferredPrompt(null);
    setIsInstallable(false);
  };

  const nestedModalCount = useNestedModalCount();
  const isAnyModalOpen = useMemo(() => {
    return (
      showBasket || 
      showManagementPanel || 
      showBusinessCardEditor || 
      !!confirmDeleteProduct || 
      !!confirmDeleteMaterial || 
      !!confirmDeleteCustomer ||
      isProductModalOpen ||
      !!pendingExcelImport ||
      nestedModalCount > 0
    );
  }, [
    showBasket, 
    showManagementPanel, 
    showBusinessCardEditor, 
    confirmDeleteProduct, 
    confirmDeleteMaterial, 
    confirmDeleteCustomer,
    isProductModalOpen,
    pendingExcelImport,
    nestedModalCount
  ]);

  // فراخوانی هوک سوایپ بین تب‌ها: عمداً همین‌جا (بعد از تعریف isAnyModalOpen
  // بالا) صدا زده می‌شه، نه بالاتر — نگاه کن به توضیح کنار تعریف MAIN_TAB_ORDER
  const { containerRef: mainSwipeRef, swipeHandlers: mainSwipeHandlers } = useSwipeTabNav(MAIN_TAB_ORDER, activeTab, setActiveTab, isAnyModalOpen);

  // نسخه‌ی مخصوص دکمه‌ی اسکرول-به-بالای *داخل* پنل مدیریت: چون خودِ `ManagementPanelModal`
  // با `showManagementPanel` باز می‌شه، اگه از همون `isAnyModalOpen` (که خودِ
  // showManagementPanel رو هم داره) برای مخفی‌کردنِ دکمه‌ی داخلش استفاده کنیم، این
  // دکمه هیچ‌وقت (توی هیچ‌کدوم از تب‌های محصولات/متریال/گالری/حسابداری، که همه
  // داخل همین پنلن) نمایش داده نمی‌شه — چون همیشه true بوده. این نسخه دقیقاً
  // همون‌هاست ولی بدون خودِ showManagementPanel.
  const isAnyModalOpenInsidePanel = useMemo(() => {
    return (
      showBasket ||
      showBusinessCardEditor ||
      !!confirmDeleteProduct ||
      !!confirmDeleteMaterial ||
      !!confirmDeleteCustomer ||
      isProductModalOpen ||
      !!pendingExcelImport ||
      nestedModalCount > 0
    );
  }, [
    showBasket,
    showBusinessCardEditor,
    confirmDeleteProduct,
    confirmDeleteMaterial,
    confirmDeleteCustomer,
    isProductModalOpen,
    pendingExcelImport,
    nestedModalCount
  ]);

  // ثبت مودال/پنل‌های سطح App.jsx روی استک دکمه‌ی Back — هرکدوم که آخر باز
  // شده باشه، با Back فقط همون بسته می‌شه (نه کل اپ)
  useEffect(() => {
    if (!pendingExcelImport) return;
    return pushBackHandler(() => setPendingExcelImport(null));
  }, [pendingExcelImport]);

  useEffect(() => {
    if (!confirmDeleteCustomer) return;
    return pushBackHandler(() => setConfirmDeleteCustomer(null));
  }, [confirmDeleteCustomer]);

  useEffect(() => {
    if (!confirmDeleteMaterial) return;
    return pushBackHandler(() => setConfirmDeleteMaterial(null));
  }, [confirmDeleteMaterial]);

  useEffect(() => {
    if (!confirmDeleteProduct) return;
    return pushBackHandler(() => setConfirmDeleteProduct(null));
  }, [confirmDeleteProduct]);

  useEffect(() => {
    if (!showBusinessCardEditor) return;
    return pushBackHandler(() => setShowBusinessCardEditor(false));
  }, [showBusinessCardEditor]);

  useEffect(() => {
    if (!showBasket) return;
    return pushBackHandler(() => setShowBasket(false));
  }, [showBasket]);

  // آیتم ۹: هندلر بک این پنل از اینجا حذف شد — قبلاً مستقیم `setShowManagementPanel(false)`
  // می‌کرد و پاپ‌آپ تایید خروج (`showExitConfirm` داخل خودِ ManagementPanelModal) رو
  // دور می‌زد. الان دقیقاً همون هندلینگ داخل خودِ ManagementPanelModal ثبت می‌شه، جایی
  // که به state تاییدِ خروج دسترسی داره.

  // دکمه‌ی Back سخت‌افزاری اندروید / سوایپ لبه: اول به مودال بازِ ثبت‌شده
  // (استک بالا) فرصت می‌ده خودش رو ببنده؛ اگه چیزی باز نبود و روی تب پیش‌فرض
  // (کاتالوگ) نیستیم، برمی‌گرده تب پیش‌فرض؛ اگه همونجا هم هیچی نبود، با یک
  // بار Back توست «برای خروج دوباره بک بزنید» نشون می‌ده و فقط با دوبار Back
  // پشت‌سرهم (کمتر از ۲ ثانیه فاصله) از اپ خارج می‌شه. قبلاً هیچ‌کدوم از این
  // رفتارها پیاده نشده بود و هر بار Back بلافاصله (به‌صورت پیش‌فرض اندروید)
  // کل اپ رو می‌بست.
  useEffect(() => {
    let removeListener = null;
    let lastBackAt = 0;
    let cancelled = false;

    const isTextField = (el) => {
      if (!el || !el.tagName) return false;
      if (el.tagName === "TEXTAREA") return true;
      if (el.tagName === "INPUT") {
        const type = (el.getAttribute("type") || "text").toLowerCase();
        return ["text", "number", "tel", "search", "email", "password", "date", "url"].includes(type);
      }
      return false;
    };

    const handleBack = () => {
      // اگه داخل یک فیلد در حال تایپیم، Back فقط کیبورد رو ببنده، نه پنل/تب/اپ رو
      if (isTextField(document.activeElement)) {
        document.activeElement.blur();
        return;
      }
      if (consumeBack()) return;
      if (activeTab !== "catalog") {
        setActiveTab("catalog");
        return;
      }
      const now = Date.now();
      if (now - lastBackAt < 2000) {
        import("@capacitor/app").then(({ App: CapApp }) => CapApp.exitApp()).catch(() => {});
      } else {
        lastBackAt = now;
        notify("برای خروج دوباره دکمه‌ی برگشت را بزنید");
      }
    };

    import("@capacitor/core")
      .then(({ Capacitor }) => {
        if (cancelled || !Capacitor.isNativePlatform()) return null;
        return import("@capacitor/app");
      })
      .then((mod) => {
        if (cancelled || !mod) return;
        return mod.App.addListener("backButton", handleBack);
      })
      .then((listener) => {
        if (cancelled) {
          listener?.remove?.();
        } else {
          removeListener = listener;
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      removeListener?.remove?.();
    };
  }, [activeTab, notify]);


  const addToBasket = useCallback((product) => {
    setBasket((prev) => {
      const exists = prev.find((p) => p.id === product.id);
      if (exists) return prev.filter((p) => p.id !== product.id);
      return [...prev, product];
    });
  }, []);

  const removeFromBasket = useCallback((id) => {
    setBasket((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const toggleBasket = useCallback(() => setShowBasket((prev) => !prev), []);

  const xlsxImportRef = useRef(null);
  const jsonImportRef = useRef(null);
  const saveTimer = useRef(null);

  const debouncedSave = useCallback((d) => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveData(d), 300);
  }, []);

  useEffect(() => { debouncedSave(data); }, [data, debouncedSave]);

  // ── Background Sync Engine (Offline-First Auto Sync) ──
  const latestDataRef = useRef(data);
  useEffect(() => {
    latestDataRef.current = data;
  }, [data]);

  useEffect(() => {
    // Silent background sync check every 30 seconds
    const interval = setInterval(() => {
      if (navigator.onLine && token) {
        if (token) performSynchronization(latestDataRef.current, token)
          .then((res) => {
            if (res.success && res.mergedData) {
              _setData(res.mergedData);
            }
          })
          .catch(() => {});
      }
    }, 30000);

    // Initial check on mount
    const onMountTimer = setTimeout(() => {
      if (navigator.onLine && token) {
        if (token) performSynchronization(latestDataRef.current, token)
          .then((res) => {
            if (res.success && res.mergedData) {
              _setData(res.mergedData);
            }
          })
          .catch(() => {});
      }
    }, 3000);

    // Re-sync instantly when regaining internet connection
    const handleOnlineSync = () => {
      if (token) performSynchronization(latestDataRef.current, token)
        .then((res) => {
          if (res.success && res.mergedData) {
            _setData(res.mergedData);
          }
        })
        .catch(() => {});
    };
    window.addEventListener("online", handleOnlineSync);

    return () => {
      clearInterval(interval);
      clearTimeout(onMountTimer);
      window.removeEventListener("online", handleOnlineSync);
    };
  }, [token]);

  // ── تغییرات موقت Bulk Apply ──
  const [pendingBulkChanges, setPendingBulkChanges] = useState(() => {
    try {
      const saved = sessionStorage.getItem("refarsh_pending_bulk");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  useEffect(() => {
    try {
      sessionStorage.setItem("refarsh_pending_bulk", JSON.stringify(pendingBulkChanges));
    } catch (_) {}
  }, [pendingBulkChanges]);

  useEffect(() => {
    return scrollAppToTop();
  }, [activeTab]);

  // سوییچ بین حالت عادی و پنل مدیریت هم نوعی «باز شدن پنل» است
  useEffect(() => {
    return scrollAppToTop();
  }, [showManagementPanel]);

  // ── Pipelines ──
  const materialPendingUsage = useMemo(() => {
    const usage = {};
    data.products.forEach((p) => {
      (p.lineItems || []).forEach((li) => {
        if (!li.materialId || li.deductedAt) return;
        if (li.batchId || li.useAreaRatio) return; // این‌ها جدا و از طریق سهم بچ/نسبت مساحت حساب می‌شوند
        const mat = data.materials.find((m) => m.id === li.materialId);
        if (!mat) return;

        let cost;
        if (li.pct != null) {
          const base = mat.remainingCost != null ? toNum(mat.remainingCost) : toNum(mat.totalCost);
          cost = (toNum(li.pct) / 100) * base;
        } else if (li.customPct != null) {
          // پرش از بازمحاسبه‌ی هندسی (مساحت محصول ÷ مساحت متریال): درصد واقعی مصرف
          // همان چیزی است که در صفحه‌ی «تخصیص بولک» انتخاب و در li.cost ثبت شده —
          // نباید اینجا دوباره و مستقل از آن حساب شود، وگرنه درصد انتخابی کاربر نادیده گرفته می‌شود.
          cost = toNum(li.cost);
        } else {
          return;
        }

        if (!usage[li.materialId]) usage[li.materialId] = { pendingCost: 0, pendingCount: 0 };
        usage[li.materialId].pendingCost += cost;
        usage[li.materialId].pendingCount += 1;
      });
    });
    return usage;
  }, [data.products, data.materials]);

  const materialsWithRemaining = useMemo(() => {
    return (data.materials || []).map((m) => {
      const remainingCost = m.remainingCost != null ? toNum(m.remainingCost) : toNum(m.totalCost);
      const usedCost = Math.max(0, toNum(m.totalCost) - remainingCost);
      const usedPct = toNum(m.totalCost) > 0 ? (usedCost / toNum(m.totalCost)) * 100 : 0;
      const pending = materialPendingUsage[m.id] || { pendingCost: 0, pendingCount: 0 };
      return { ...m, remainingCost, usedCost, usedPct, ...pending };
    });
  }, [data.materials, materialPendingUsage]);

  const areaBatchCostByProduct = useMemo(() => {
    const result = {};
    data.materials.forEach((m) => {
      if (m.type !== "area" && m.type !== "fabric") return;

      const realBatches = m.batches || [];
      // اگر متریال بچ صریح ندارد ولی محصولاتی بدون batchId مستقیم به آن وصل شده‌اند،
      // خودِ متریال (با dimW×dimH و totalCost کامل) را یک «بچ ضمنی» در نظر می‌گیریم تا
      // منطق «پرتی حساب شود» برای حالت بدون‌بچ هم یکسان و درست کار کند.
      const directLinked = data.products.filter((p) =>
        (p.lineItems || []).some((li) => li.materialId === m.id && !li.batchId && !li.deductedAt)
      );
      const virtualBatch = directLinked.length > 0 ? {
        id: "__virtual__",
        width: m.dimW,
        height: m.dimH,
        totalCost: m.remainingCost != null ? toNum(m.remainingCost) : toNum(m.totalCost),
      } : null;

      const batchesToProcess = virtualBatch ? [...realBatches, virtualBatch] : realBatches;

      batchesToProcess.forEach((batch) => {
        const isVirtual = batch.id === "__virtual__";
        const batchArea = toNum(batch.width) * toNum(batch.height) * (toNum(batch.qty) || 1);
        if (batchArea <= 0) return;
        const batchCost = batch.totalCost != null ? toNum(batch.totalCost) : toNum(m.totalCost) / Math.max(1, (m.batches || []).length);
        const linkedProds = isVirtual
          ? directLinked
          : (batch.linkedProductIds || []).map((pid) => data.products.find((p) => p.id === pid)).filter(Boolean);
        const getLi = (p) => (p.lineItems || []).find((l) => isVirtual ? (l.materialId === m.id && !l.batchId) : (l.batchId === batch.id && l.materialId === m.id));
        const getArea = (p) => {
          const li = getLi(p);
          return li?.manualArea != null ? toNum(li.manualArea) : getProductArea(p);
        };
        const costPerArea = batchCost / batchArea;

        // آیتم‌های قفل‌شده (deductedAt) هزینه‌شون یک‌بار برای همیشه فریز شده و از resolveLineCost
        // مستقیم deductedCost خودشون رو می‌گیرن، نه از اینجا — ولی مساحت/هزینه‌شون باید از ظرفیت
        // باقیمانده‌ی بچ برای بقیه (هنوز قفل‌نشده‌ها) کم بشه
        const lockedProds = linkedProds.filter((p) => getLi(p)?.deductedAt);
        const unlockedProds = linkedProds.filter((p) => !getLi(p)?.deductedAt);
        const lockedArea = lockedProds.reduce((s, p) => s + getArea(p), 0);
        const lockedCostActual = lockedProds.reduce((s, p) => s + toNum(getLi(p)?.deductedCost || 0), 0);
        const remainingCapacityArea = Math.max(0, batchArea - lockedArea);
        const remainingCapacityCost = Math.max(0, batchCost - lockedCostActual);
        const unlockedUsedArea = unlockedProds.reduce((s, p) => s + getArea(p), 0);

        // آیتم ۵ (روادمپ): اگه سهم فیزیکیِ محصولاتِ هنوز-قفل‌نشده از ظرفیت واقعیِ باقیمانده‌ی
        // بچ بیشتر بشه (بیش از ۱۰۰٪)، به‌جای محاسبه‌ی مستقیم (که می‌تونه جمعاً از هزینه‌ی
        // باقیمانده‌ی بچ بیشتر بشه)، خودکار به روش «پرتی» (تقسیم نسبی باقیمانده بین همه بر اساس
        // مساحت‌شون) سوییچ می‌کنه — همیشه جمع هزینه‌ها دقیقاً برابر باقیمانده‌ی بچه، نه بیشتر.
        // اگه زیر ۱۰۰٪ بود، دقیقاً همون منطق لایوِ قبلی (سهم فیزیکی + پخش leftover بین آیتم‌های
        // «پرتی شود») دست‌نخورده باقی می‌مونه.
        const overAllocated = unlockedUsedArea > remainingCapacityArea + 0.0001;

        const leftoverArea = Math.max(0, batchArea - (lockedArea + unlockedUsedArea));
        const wastageProds = unlockedProds.filter((p) => getLi(p)?.includeWastage);
        const totalWastageArea = wastageProds.reduce((s, p) => s + getArea(p), 0);

        unlockedProds.forEach((p) => {
          const li = getLi(p);
          const ownArea = getArea(p);
          if (!result[p.id]) result[p.id] = {};
          if (overAllocated) {
            const share = unlockedUsedArea > 0 ? ownArea / unlockedUsedArea : (1 / Math.max(1, unlockedProds.length));
            result[p.id][m.id] = remainingCapacityCost * share;
          } else {
            const getsWaste = li?.includeWastage;
            const wasteShare = (getsWaste && totalWastageArea > 0) ? (ownArea / totalWastageArea) * leftoverArea : 0;
            const totalAreaForP = ownArea + wasteShare;
            result[p.id][m.id] = totalAreaForP * costPerArea;
          }
        });
      });
    });
    return result;
  }, [data.materials, data.products]);

  const ratioByAreaCostByProduct = useMemo(() => {
    const byMat = {};
    data.products.forEach((p) => {
      (p.lineItems || []).forEach((li) => {
        if (!li.materialId || !li.useAreaRatio) return;
        if (!byMat[li.materialId]) byMat[li.materialId] = [];
        byMat[li.materialId].push(p);
      });
    });
    const result = {};
    Object.entries(byMat).forEach(([materialId, prods]) => {
      const mat = data.materials.find((m) => m.id === materialId);
      if (!mat) return;
      const totalArea = prods.reduce((s, p) => s + getProductArea(p), 0);
      if (!totalArea) return;
      prods.forEach((p) => {
        const share = getProductArea(p) / totalArea;
        if (!result[p.id]) result[p.id] = {};
        result[p.id][materialId] = share * (mat.remainingCost != null ? toNum(mat.remainingCost) : toNum(mat.totalCost));
      });
    });
    return result;
  }, [data.materials, data.products]);

  const resolveLineCost = useCallback((p, li) => {
    if (li.deductedAt) return toNum(li.deductedCost);
    if (li.materialId && areaBatchCostByProduct[p.id]?.[li.materialId] != null) {
      return areaBatchCostByProduct[p.id][li.materialId];
    }
    if (li.materialId && li.useAreaRatio) {
      const r = ratioByAreaCostByProduct[p.id]?.[li.materialId];
      return r != null ? r : toNum(li.cost);
    }
    if (li.materialId && li.pct != null) {
      const mat = data.materials.find((m) => m.id === li.materialId);
      if (!mat) return toNum(li.cost);
      const base = mat.remainingCost != null ? toNum(mat.remainingCost) : toNum(mat.totalCost);
      return (toNum(li.pct) / 100) * base;
    }
    if (li.materialId && !li.batchId && !li.useAreaRatio) {
      const mat = data.materials.find((m) => m.id === li.materialId);
      if (mat && mat.type === "fabric") {
        const productArea = getProductArea(p);
        const coverage = toNum(p.fabricCoveragePct ?? 100) / 100;
        const fabricArea = toNum(mat.dimW) * toNum(mat.dimH);
        const pct = (fabricArea > 0 && productArea > 0) ? ((productArea * coverage) / fabricArea) * 100 : 100;
        const base = mat.remainingCost != null ? toNum(mat.remainingCost) : toNum(mat.totalCost);
        if (pct > 0) return (pct / 100) * base;
      }
    }
    return toNum(li.cost);
  }, [areaBatchCostByProduct, ratioByAreaCostByProduct, data.materials]);

  const productTotals = useMemo(() => {
    return (data.products || []).map((p) => {
      const annotated = (p.lineItems || []).map((li) => ({ ...li, resolvedCost: resolveLineCost(p, li) }));
      const totalCost = annotated.reduce((s, li) => s + li.resolvedCost, 0);
      return { ...p, lineItems: annotated, totalCost, profit: toNum(p.salePrice) - totalCost };
    });
  }, [data.products, resolveLineCost]);

  // ── تشخیص pending changes ──
  const hasPendingMaterialChanges = useMemo(() => {
    if ((pendingBulkChanges || []).length > 0) return true;
    if ((data.materials || []).some((m) => (m.pendingReleaseCredits || []).length > 0)) return true;

    return (data.products || []).some((p) =>
      (p?.lineItems || []).some((li) => {
        if (!li.materialId) return false;
        if (li.pendingUnlock) return true;
        if (li.deductedAt) return false;

        if (li.pct != null && toNum(li.pct) > 0) return true;

        if (li.pct == null && !li.batchId && !li.useAreaRatio && toNum(li.cost) > 0 && (li.woodCuts || []).length === 0) {
          const mat = data.materials.find((m) => m.id === li.materialId);
          if (mat && mat.type !== "fabric") return true;
        }

        if ((li.woodCuts || []).length > 0 && !li.woodLocked) return true;

        if (li.batchId) {
          const mat = data.materials.find((m) => m.id === li.materialId);
          if (mat) {
            const batch = mat.batches?.find(b => b.id === li.batchId);
            if (batch) return true;
          }
        }

        return false;
      })
    );
  }, [data.products, data.materials, pendingBulkChanges]);

  const groupedProducts = useMemo(() => {
    const custList = data.customers || [];
    const orderFn = (a, b) => {
      // Drafts always at the end
      if (!!a.isDraft !== !!b.isDraft) return a.isDraft ? 1 : -1;

      const baseSort = String(sortOrder || "").replace(/_desc$/, "");
      const isDesc = String(sortOrder || "").endsWith("_desc");
      let cmp;
      if (baseSort === "az") cmp = a.name.localeCompare(b.name, "fa");
      else if (baseSort === "date") {
        const da = a.saleDate || a.settleDate, db = b.saleDate || b.settleDate;
        if (da && db) cmp = db.localeCompare(da);
        else if (da) cmp = -1;
        else if (db) cmp = 1;
        else cmp = toNum(b.code) - toNum(a.code);
      } else if (baseSort === "stock") {
        cmp = (b.status === "sold" ? 0 : 1) - (a.status === "sold" ? 0 : 1);
      } else {
        cmp = toNum(a.code) - toNum(b.code);
      }
      return isDesc ? -cmp : cmp;
    };
    if (sortMode === "sold") {
      const sold = productTotals.filter((p) => p.status === "sold").sort(orderFn);
      const groups = {};
      sold.forEach((p) => {
        if (p.isDraft) {
          const g = "در دست ساخت";
          if (!groups[g]) groups[g] = [];
          groups[g].push(p);
          return;
        }
        const cust = custList.find((c) => c.id === p.location);
        const g = `فروش رفته ◂ ${cust ? cust.name : "بدون فروشگاه"} ◂ ${p.settled ? "تسویه‌شده" : "تسویه‌نشده"}`;
        if (!groups[g]) groups[g] = [];
        groups[g].push(p);
      });
      return groups;
    }
    if (sortMode === "unsold") {
      const unsold = productTotals.filter((p) => p.status !== "sold").sort(orderFn);
      const groups = {};
      unsold.forEach((p) => {
        if (p.isDraft) {
          const g = "در دست ساخت";
          if (!groups[g]) groups[g] = [];
          groups[g].push(p);
          return;
        }
        const cust = custList.find((c) => c.id === p.location);
        const g = (p.location && p.location !== "warehouse") ? `فروش نرفته ◂ پیش ${cust ? cust.name : "فروشگاه نامشخص"}` : "فروش نرفته ◂ پیش خودم";
        if (!groups[g]) groups[g] = [];
        groups[g].push(p);
      });
      return groups;
    }
    if (sortMode === "fabric") {
      const groups = {};
      productTotals.forEach((p) => {
        if (p.isDraft) {
          const g = "در دست ساخت";
          if (!groups[g]) groups[g] = [];
          groups[g].push(p);
          return;
        }
        const li = (p.lineItems || []).find((l) => {
          const m = data.materials.find((x) => x.id === l.materialId);
          return m?.type === "fabric";
        });
        const mat = li ? data.materials.find((m) => m.id === li.materialId) : null;
        const g = mat ? formatFabricGroupLabel(mat.name, mat.pattern, mat.ageYears) : "بدون فرش";
        if (!groups[g]) groups[g] = [];
        groups[g].push(p);
      });
      Object.keys(groups).forEach((g) => groups[g].sort(orderFn));
      const orderedKeys = Object.keys(groups).sort((ga, gb) => {
        const aSpecial = ga === "بدون فرش" || ga === "در دست ساخت";
        const bSpecial = gb === "بدون فرش" || gb === "در دست ساخت";
        if (aSpecial !== bSpecial) return aSpecial ? 1 : -1;
        if (aSpecial && bSpecial) return ga === "در دست ساخت" ? 1 : (gb === "در دست ساخت" ? -1 : 0);
        const minA = Math.min(...groups[ga].map((p) => toNum(p.code)));
        const minB = Math.min(...groups[gb].map((p) => toNum(p.code)));
        return minA - minB;
      });
      const orderedGroups = {};
      orderedKeys.forEach((k) => { orderedGroups[k] = groups[k]; });
      return orderedGroups;
    }
    if (sortMode === "type") {
      // گروه‌بندی بر اساس نوع محصول (productTypeId) — دقیقاً همون الگوی
      // گروه‌بندی بر اساس فرش (sortMode === "fabric") بالا: هر گروه بر
      // اساس کمترین کد محصولِ داخلش مرتب می‌شه، «بدون نوع» و «در دست
      // ساخت» همیشه در انتها می‌مونن (Ash 🟡 — آیتم ۱۲)
      const groups = {};
      productTotals.forEach((p) => {
        if (p.isDraft) {
          const g = "در دست ساخت";
          if (!groups[g]) groups[g] = [];
          groups[g].push(p);
          return;
        }
        const typeName = p.productTypeId ? data.productTypes?.find((t) => t.id === p.productTypeId)?.name : null;
        const g = typeName || "بدون نوع";
        if (!groups[g]) groups[g] = [];
        groups[g].push(p);
      });
      Object.keys(groups).forEach((g) => groups[g].sort(orderFn));
      const rank = (g) => (g === "در دست ساخت" ? 2 : g === "بدون نوع" ? 1 : 0);
      const orderedKeys = Object.keys(groups).sort((ga, gb) => {
        const ra = rank(ga), rb = rank(gb);
        if (ra !== rb) return ra - rb;
        if (ra !== 0) return 0;
        const minA = Math.min(...groups[ga].map((p) => toNum(p.code)));
        const minB = Math.min(...groups[gb].map((p) => toNum(p.code)));
        return minA - minB;
      });
      const orderedGroups = {};
      orderedKeys.forEach((k) => { orderedGroups[k] = groups[k]; });
      return orderedGroups;
    }
    if (sortMode === "stock") {
      const groups = { "موجود": [], "فروخته شده": [] };
      productTotals.forEach((p) => {
        if (p.isDraft) {
          const g = "در دست ساخت";
          if (!groups[g]) groups[g] = [];
          groups[g].push(p);
          return;
        }
        if (p.status === "sold") groups["فروخته شده"].push(p);
        else groups["موجود"].push(p);
      });
      Object.keys(groups).forEach((g) => groups[g].sort(orderFn));
      return groups;
    }
    const groups = {};
    productTotals.slice().sort(orderFn).forEach((p) => {
      if (p.isDraft) {
        const g = "در دست ساخت";
        if (!groups[g]) groups[g] = [];
        groups[g].push(p);
        return;
      }
      // نام زنده متریال فرش (اگر عوض شده باشد) اولویت دارد روی group ذخیره‌شده
      const g = resolveProductGroupName(p, data.materials || []) || p.group || "بدون دسته";
      if (!groups[g]) groups[g] = [];
      groups[g].push(p);
    });
    // ترتیب دسته‌بندی‌ها: هر دسته بر اساس کمترین کد محصولِ داخلش بالاتر می‌آید
    // (نه بر اساس نام)؛ «بدون دسته» و بعد از آن «در دست ساخت» همیشه در انتها می‌مانند.
    const rank = (g) => (g === "در دست ساخت" ? 2 : g === "بدون دسته" ? 1 : 0);
    const orderedKeys = Object.keys(groups).sort((ga, gb) => {
      const ra = rank(ga), rb = rank(gb);
      if (ra !== rb) return ra - rb;
      if (ra !== 0) return 0;
      const minA = Math.min(...groups[ga].map((p) => toNum(p.code)));
      const minB = Math.min(...groups[gb].map((p) => toNum(p.code)));
      return minA - minB;
    });
    const orderedGroups = {};
    orderedKeys.forEach((k) => { orderedGroups[k] = groups[k]; });
    return orderedGroups;
  }, [productTotals, sortMode, sortOrder, data.customers, data.materials, data.productTypes]);

  const accounting = useMemo(() => {
    const sold = productTotals.filter((p) => p.status === "sold");
    const available = productTotals.filter((p) => p.status !== "sold");
    const finalPriceOf = (p) => (p.discountedPrice != null ? toNum(p.discountedPrice) : toNum(p.salePrice));
    const revenueSold = sold.reduce((s, p) => s + finalPriceOf(p), 0);
    const costSold = sold.reduce((s, p) => s + p.totalCost, 0);
    const projectedRevenue = available.reduce((s, p) => s + toNum(p.salePrice), 0);
    const projectedCost = available.reduce((s, p) => s + p.totalCost, 0);
    const netProfit = revenueSold - costSold;
    const totalCostAll = productTotals.reduce((s, p) => s + p.totalCost, 0);
    const equipIncluded = (data.equipment || []).filter((e) => e.includeInCost).reduce((s, e) => s + toNum(e.unitPrice) * toNum(e.qty), 0);
    const materialSpend = data.materials.reduce((s, m) => s + toNum(m.totalCost), 0) + equipIncluded;
    const custMap = {};
    (data.customers || []).forEach((c) => (custMap[c.id] = c));
    const unsettled = sold.filter((p) => p.location !== "warehouse" && !p.settled);
    const totalOutstanding = unsettled.reduce((s, p) => s + finalPriceOf(p), 0);
    const unsettledItemsDecorated = unsettled.map((p) => ({ ...p, galleryName: custMap[p.location]?.name || "گالری", galleryColor: custMap[p.location]?.color || "#a89bd4" }));
    const soldItemsDecorated = sold.map((p) => {
      const isAt = p.location && p.location !== "warehouse";
      if (isAt) {
        const cust = custMap[p.location];
        return { ...p, soldByLabel: cust?.name || "گالری", soldByColor: cust?.color || "#a89bd4" };
      }
      return { ...p, soldByLabel: p.buyerName || "—", soldByColor: "#5fd180" };
    });
    const isGiftItem = (p) => toNum(p.discountPercent) >= 100 || (p.discountedPrice != null && toNum(p.discountedPrice) <= 0 && toNum(p.salePrice) > 0);
    const soldSettledItemsAll = soldItemsDecorated.filter((p) => !p.location || p.location === "warehouse" || p.settled);
    const soldSettledItems = soldSettledItemsAll.filter((p) => !isGiftItem(p));
    const giftSettledItems = soldSettledItemsAll.filter(isGiftItem);
    const giftUnsettledItems = unsettledItemsDecorated.filter(isGiftItem);
    const giftItems = [...giftSettledItems, ...giftUnsettledItems];
    const settledOnlyRevenue = soldSettledItems.reduce((s, p) => s + finalPriceOf(p), 0);
    const settledOnlyCost = soldSettledItems.reduce((s, p) => s + p.totalCost, 0);
    const settledOnlyProfit = settledOnlyRevenue - settledOnlyCost;
    const monthlyMap = {};
    const JALALI_MONTH_NAMES = [
      "فروردین", "اردیبهشت", "خرداد",
      "تیر", "مرداد", "شهریور",
      "مهر", "آبان", "آذر",
      "دی", "بهمن", "اسفند"
    ];
    const today = new Date();
    const [currentJy] = gregorianToJalali(today.getFullYear(), today.getMonth() + 1, today.getDate());
    for(let i = 1; i <= 12; i++) {
      const mStr = String(i).padStart(2, "0");
      monthlyMap[`${currentJy}-${mStr}`] = { revenue: 0, cost: 0, jy: currentJy, jm: i };
    }
    sold.forEach((p) => {
      if (!p.saleDate) return;
      const parts = String(p.saleDate).split("T")[0].split("-");
      if (parts.length !== 3) return;
      const gy = parseInt(parts[0], 10);
      const gm = parseInt(parts[1], 10);
      const gd = parseInt(parts[2], 10);
      const [jy, jm, jd] = gregorianToJalali(gy, gm, gd);
      const jmStr = String(jm).padStart(2, "0");
      const key = `${jy}-${jmStr}`;
      if (!monthlyMap[key]) monthlyMap[key] = { revenue: 0, cost: 0, jy, jm };
      monthlyMap[key].revenue += finalPriceOf(p);
      monthlyMap[key].cost += p.totalCost;
    });
    const monthlyProfit = Object.entries(monthlyMap).map(([key, v]) => {
      const monthName = JALALI_MONTH_NAMES[v.jm - 1] || "—";
      const displayMonth = `${monthName} ${toPersianDigits(v.jy)}`;
      return {
        month: displayMonth,
        monthName: monthName,
        monthShort: monthName,
        revenue: v.revenue,
        cost: v.cost,
        profit: v.revenue - v.cost,
        sortKey: key
      };
    }).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    return { totalCostAll, revenueSold, costSold, projectedRevenue, projectedCost, netProfit, materialSpend, soldCount: sold.length, availableCount: available.length, projectedProfit: projectedRevenue - projectedCost, totalOutstanding, unsettledCount: unsettled.length, unsettledItems: unsettledItemsDecorated.filter((p) => !isGiftItem(p)), unsoldItems: available, soldItems: soldItemsDecorated, soldSettledItems, settledOnlyRevenue, settledOnlyCost, settledOnlyProfit, giftItems, monthlyProfit };
  }, [productTotals, data.materials, data.equipment, data.customers]);

  const customerStats = useMemo(() => {
    return (data.customers || []).map((c) => {
      const items = productTotals.filter((p) => p.location === c.id);
      const withThem = items.filter((p) => p.status !== "sold");
      const soldByThem = items.filter((p) => p.status === "sold");
      const unsettledArr = soldByThem.filter((p) => !p.settled);
      const outstanding = unsettledArr.reduce((s, p) => s + toNum(p.salePrice), 0);
      return { ...c, totalItems: items.length, withThemCount: withThem.length, soldCount: soldByThem.length, unsettledCount: unsettledArr.length, outstanding };
    });
  }, [data.customers, productTotals]);

  // ── Bulk Apply ──
  const bulkApplyMaterial = useCallback(({
    material,
    productIds = [],
    pct = 100,
    includeWastage = false,
    batchId = null,
    batchIds = null,
    label = "",
    perProductPctOverride = null,
    consumeRemaining = true,
    linkedUpdates = [],
    removedIds = [],
    lastAllocationPcts = null,
    distributionMode = null,
  }) => {
    if (!productIds.length && !linkedUpdates.length && !removedIds.length) {
      notify("موردی برای تغییر وجود ندارد");
      return;
    }

    // سقف ۱۰۰٪: هرگز نباید بیش از کل درصد/موجودی متریال تخصیص داده شود
    const totalRequestedPct = productIds.reduce((s, id) => s + toNum(perProductPctOverride?.[id] ?? 0), 0)
      + linkedUpdates.reduce((s, u) => s + toNum(u.pct ?? 0), 0);
    if (totalRequestedPct > 100.01) {
      notify("جمع درصدهای تخصیص‌یافته نمی‌تواند بیشتر از ۱۰۰٪ باشد");
      return;
    }

    // شناسه‌ی این «سشن بولک» — هر بار ذخیره در صفحه‌ی بولک یک سشن جدید و مستقل می‌سازد
    // (تعداد سشن‌ها نامحدود است و مستقل از تعداد دفعات نگه‌داشتن دکمه رفرش)
    const bulkSubmissionId = uid();

    setData((d) => {
      // 1. Copy materials list
      const materials = d.materials.map(m => ({ ...m }));
      let totalRefund = 0;

      // چندبچی: ترتیب انتخاب کاربر = ترتیب پرشدن («اول بچ اول پر بشه، بعد بره
      // سراغ بعدی» — طبق تصمیم صریح کاربر). batchId تکی (قدیمی) هم پشتیبانی
      // می‌شه تا هیچ صدازننده‌ی قدیمی‌ای نشکنه.
      const resolvedBatchIds = (Array.isArray(batchIds) && batchIds.length) ? batchIds : (batchId ? [batchId] : []);
      const isBatchArea = (material.type === "area" || material.type === "fabric") && resolvedBatchIds.length > 0;
      let totalArea = 0;
      const areas = {};
      // برای هر بچِ انتخاب‌شده، باقیمانده‌ی واقعی‌اش (بعد از کسر آنچه قبلاً از
      // همون بچ برای محصولات دیگر که الان قفل‌اند کسر شده) — به همون ترتیبی که
      // کاربر بچ‌ها رو انتخاب کرده، تا استخر ترکیبی + منطق پرشدن پشت‌سرهم درست کار کنه
      let batchFillList = [];
      let combinedRemainingForPreview = 0;
      let combinedTotalCost = 0;
      let combinedPhysArea = 0;
      // آیتم ۵/۱۳ (روادمپ، فیکس Logy — تعمیم‌داده‌شده به چندبچی): اگه توی حالت
      // «باقی بماند» جمعِ سهم فیزیکی محصولات از ظرفیت فیزیکیِ واقعیِ باقیمانده‌ی
      // *همه‌ی* بچ‌های انتخابی (نه کل ظرفیت‌شون) بیشتر بشه، نباید مجموع هزینه از
      // ۱۰۰٪ باقیمانده بیشتر بشه — خودکار به فرمول «پرتی» سوییچ می‌کنیم
      let batchOverAllocated = false;
      if (isBatchArea) {
        const allSelectedIds = [...productIds, ...linkedUpdates.map(u => u.productId)];
        allSelectedIds.forEach(pid => {
          const prod = d.products.find(x => x.id === pid);
          let area = 0;
          if (prod) {
            area = getProductArea(prod);
            if (area <= 0) area = 1;
          }
          areas[pid] = area;
          totalArea += area;
        });
        let combinedRemainingPhysArea = 0;
        batchFillList = resolvedBatchIds.map(bId => {
          const batch = material.batches?.find(b => b.id === bId);
          if (!batch) return null;
          let alreadyDeducted = 0;
          d.products.forEach(p => (p.lineItems || []).forEach(li => {
            if (li.materialId === material.id && li.batchId === bId && li.deductedAt) {
              alreadyDeducted += toNum(li.deductedCost || 0);
            }
          }));
          const remaining = Math.max(0, toNum(batch.totalCost) - alreadyDeducted);
          const physArea = toNum(batch.width) * toNum(batch.height) * Math.max(1, toNum(batch.qty) || 1);
          // ظرفیت فیزیکیِ باقیمانده‌ی واقعیِ همین بچ (نه کل ظرفیتش) — چون بخشی از
          // بچ ممکنه قبلاً قفل و مصرف شده باشه
          const remainingPhysArea = physArea * (remaining / Math.max(0.0001, toNum(batch.totalCost)));
          combinedRemainingForPreview += remaining;
          combinedTotalCost += toNum(batch.totalCost);
          combinedPhysArea += physArea;
          combinedRemainingPhysArea += remainingPhysArea;
          return { batchId: bId, batch, remaining, consumedNow: 0 };
        }).filter(Boolean);
        batchOverAllocated = totalArea > combinedRemainingPhysArea + 0.0001;
      }
      // پرکردن پشت‌سرهم: از باقیمانده‌ی اولین بچ توی لیست کم می‌کنه، وقتی تموم شد
      // می‌ره سراغ بعدی — یه هزینه‌ی واحد ممکنه بین چند بچ تقسیم و چند لاین‌آیتم بشه
      const splitCostAcrossBatches = (costNeeded) => {
        let remainingToAllocate = Math.max(0, toNum(costNeeded));
        const portions = [];
        for (const entry of batchFillList) {
          if (remainingToAllocate <= 0) break;
          const avail = Math.max(0, entry.remaining - entry.consumedNow);
          if (avail <= 0) continue;
          const take = Math.min(avail, remainingToAllocate);
          entry.consumedNow += take;
          portions.push({ batchId: entry.batchId, cost: take });
          remainingToAllocate -= take;
        }
        // اگه استخر انتخابی کفاف نداد (نباید پیش بیاد چون سقف‌ها قبلاً چک شدن)، باقیمانده رو
        // به آخرین بچِ لیست می‌چسبونیم که چیزی گم نشه
        if (remainingToAllocate > 0.001 && batchFillList.length) {
          const last = batchFillList[batchFillList.length - 1];
          portions.push({ batchId: last.batchId, cost: remainingToAllocate });
        }
        return portions.length ? portions : [{ batchId: resolvedBatchIds[0] || null, cost: costNeeded }];
      };

      // مبتنی بر طول واقعیِ چوب‌های موجود برای متریال خطی، وقتی «پرتی شود/باقی
      // بماند» انتخاب شده — قبلاً این نوع فقط درصدی از استخر هزینه بود و اصلاً
      // به طول فیزیکی چوب‌های موجود کاری نداشت
      const isBulkLinear = material.type === "linear";
      let totalAvailableLength = 0;
      let totalNewLength = 0;
      let totalWastageLength = 0;
      const lengths = {};
      if (isBulkLinear) {
        totalAvailableLength = (material.sticks || []).reduce((s, st) => s + toNum(st.qty) * toNum(st.length), 0);
        const allSelectedIds = [...productIds, ...linkedUpdates.map(u => u.productId)];
        allSelectedIds.forEach(pid => {
          const prod = d.products.find(x => x.id === pid);
          let len = 0;
          if (prod) {
            len = getProductPerimeter(prod) * (toNum(prod.qty) || 1);
            if (len <= 0) len = 1;
          }
          lengths[pid] = len;
          totalNewLength += len;
          if (includeWastage) totalWastageLength += len;
        });
      }
      const leftoverLength = Math.max(0, totalAvailableLength - totalNewLength);
      const costPerLength = totalAvailableLength > 0
        ? (material.remainingCost != null ? toNum(material.remainingCost) : toNum(material.totalCost)) / totalAvailableLength
        : 0;

      // 2. Map and update products
      const products = d.products.map((p) => {
        let lineItems = (p.lineItems || []).map(li => ({ ...li }));

        // A. Remove material if listed in removedIds
        if (removedIds.includes(p.id)) {
          lineItems = lineItems.map(li => {
            if (li.materialId === material.id) {
              if (li.deductedAt) {
                return { ...li, pendingUnlock: true };
              } else {
                return { ...li, _toRemove: true };
              }
            }
            return li;
          }).filter(li => !li._toRemove);
        }

        // B. Update percentage if listed in linkedUpdates
        const extraLineItemsForP = [];
        const update = linkedUpdates.find(u => u.productId === p.id);
        if (update) {
          lineItems = lineItems.map((li) => {
            if (li.materialId !== material.id) return li;
            if (li.deductedAt) return li; // Skip locked items

            if (isBatchArea) {
              if (batchFillList.length) {
                const prodArea = areas[p.id] || 0;
                let cost;
                if (includeWastage || batchOverAllocated) {
                  // پرتی (یا باقی بماند ولی مجموع سهم فیزیکی از باقیمانده‌ی واقعی استخر ترکیبی بیشتر شده): کل باقیمانده بین محصولات به نسبت مساحت‌شان
                  const share = totalArea > 0 ? prodArea / totalArea : (1 / Math.max(1, productIds.length + linkedUpdates.length));
                  cost = combinedRemainingForPreview * share;
                } else {
                  // باقی بماند: سهم فیزیکی محصول از مساحتِ کل بچ‌های انتخابی (میانگین وزنی هزینه‌ی هر متر)
                  const unitCost = combinedPhysArea > 0 ? (combinedTotalCost / combinedPhysArea) : 0;
                  cost = prodArea * unitCost;
                  cost = Math.min(cost, combinedRemainingForPreview);
                }
                const portions = splitCostAcrossBatches(cost);
                const [firstPortion, ...restPortions] = portions;
                const updatedFirst = {
                  ...li,
                  cost: firstPortion.cost,
                  batchId: firstPortion.batchId,
                  includeWastage: !!includeWastage,
                  pct: null,
                  customPct: null,
                  useAreaRatio: false,
                  pendingSessionId: bulkSubmissionId,
                };
                if (restPortions.length) {
                  extraLineItemsForP.push(...restPortions.map(portion => ({
                    id: uid(),
                    label: li.label,
                    cost: portion.cost,
                    materialId: material.id,
                    pct: null,
                    batchId: portion.batchId,
                    useAreaRatio: false,
                    includeWastage: !!includeWastage,
                    manualArea: null,
                    deductedCost: null,
                    deductedAt: null,
                    woodCuts: null,
                    woodLocked: false,
                    customPct: null,
                    pendingSessionId: bulkSubmissionId,
                  })));
                }
                return updatedFirst;
              }
            }

            const newPct = toNum(update.pct);
            const base = material.remainingCost != null ? toNum(material.remainingCost) : toNum(material.totalCost);
            let cost = (newPct / 100) * base;
            if (isBulkLinear) {
              const ownLength = lengths[p.id] || 0;
              const wasteShare = (includeWastage && totalWastageLength > 0) ? (ownLength / totalWastageLength) * leftoverLength : 0;
              cost = (ownLength + wasteShare) * costPerLength;
            }

            return {
              ...li,
              customPct: newPct,
              pct: material.type === "ratio" ? newPct : li.pct,
              cost: material.type === "ratio" ? li.cost : cost,
              batchId: null,
              includeWastage: (material.type === "area" || material.type === "fabric" || material.type === "linear") ? !!includeWastage : false,
              useAreaRatio: false,
              pendingSessionId: bulkSubmissionId,
              distributionMode: distributionMode || li.distributionMode || null,
            };
          });
          if (extraLineItemsForP.length) lineItems = [...lineItems, ...extraLineItemsForP];
        }

        // C. Add new line item if listed in productIds
        if (productIds.includes(p.id)) {
          const exists = lineItems.some(li => li.materialId === material.id && !li.deductedAt);
          if (!exists) {
            const matType = material.type;
            if (isBatchArea) {
              if (batchFillList.length) {
                const prodArea = areas[p.id] || 0;
                let cost;
                if (includeWastage || batchOverAllocated) {
                  const share = totalArea > 0 ? prodArea / totalArea : (1 / Math.max(1, productIds.length + linkedUpdates.length));
                  cost = combinedRemainingForPreview * share;
                } else {
                  const unitCost = combinedPhysArea > 0 ? (combinedTotalCost / combinedPhysArea) : 0;
                  cost = Math.min(prodArea * unitCost, combinedRemainingForPreview);
                }

                const portions = splitCostAcrossBatches(cost);
                portions.forEach(portion => {
                  lineItems.push({
                    id: uid(),
                    label: label || material.name,
                    cost: portion.cost,
                    materialId: material.id,
                    pct: null,
                    batchId: portion.batchId,
                    useAreaRatio: false,
                    includeWastage: !!includeWastage,
                    manualArea: null,
                    deductedCost: null,
                    deductedAt: null,
                    woodCuts: null,
                    woodLocked: false,
                    customPct: null,
                    pendingSessionId: bulkSubmissionId,
                  });
                });
              }
            } else {
              // Percentage-based budget distribution (ratio, fixed, or area/fabric without batch)
              const pctVal = perProductPctOverride?.[p.id] != null ? toNum(perProductPctOverride[p.id]) : (toNum(pct) / productIds.length);
              const pp = Math.round(pctVal * 10) / 10;
              const base = material.remainingCost != null ? toNum(material.remainingCost) : toNum(material.totalCost);
              let cost = (pp / 100) * base;

              if (isBulkLinear) {
                const ownLength = lengths[p.id] || 0;
                const wasteShare = (includeWastage && totalWastageLength > 0) ? (ownLength / totalWastageLength) * leftoverLength : 0;
                cost = (ownLength + wasteShare) * costPerLength;
              }

              lineItems.push({
                id: uid(),
                label: label || material.name,
                cost: matType === "ratio" ? 0 : cost,
                materialId: material.id,
                pct: matType === "ratio" ? pp : null,
                batchId: null,
                useAreaRatio: false,
                includeWastage: (matType === "area" || matType === "fabric" || matType === "linear") ? !!includeWastage : false,
                manualArea: null,
                deductedCost: null,
                deductedAt: null,
                woodCuts: null,
                woodLocked: false,
                customPct: pp,
                pendingSessionId: bulkSubmissionId,
                distributionMode: distributionMode || null,
              });
            }
          }
        }

        return { ...p, lineItems };
      });

      // 3. Update material remainingCost if refund is due
      const mIdx = materials.findIndex(m => m.id === material.id);
      if (mIdx !== -1) {
        const m = materials[mIdx];
        if (totalRefund > 0) {
          const current = m.remainingCost != null ? toNum(m.remainingCost) : toNum(m.totalCost);
          m.remainingCost = Math.min(toNum(m.totalCost), current + totalRefund);
        }
        if (lastAllocationPcts) {
          materials[mIdx] = { ...materials[mIdx], lastAllocationPcts: { ...(m.lastAllocationPcts || {}), ...lastAllocationPcts } };
        }
      }

      // 4. Update the batches' linkedProductIds if it's area/fabric and batch(es) selected
      if ((material.type === "area" || material.type === "fabric") && resolvedBatchIds.length) {
        const mIdx = materials.findIndex(m => m.id === material.id);
        if (mIdx !== -1) {
          const m = materials[mIdx];
          const finalLinkedIds = [...productIds, ...linkedUpdates.map(u => u.productId)];
          const batches = (m.batches || []).map(b => {
            if (resolvedBatchIds.includes(b.id)) {
              return { ...b, linkedProductIds: finalLinkedIds };
            } else {
              const filtered = (b.linkedProductIds || []).filter(pid => !finalLinkedIds.includes(pid) && !removedIds.includes(pid));
              return { ...b, linkedProductIds: filtered };
            }
          });
          materials[mIdx] = { ...m, batches };
        }
      }

      return { ...d, products, materials };
    });

    notify("تغییرات با موفقیت ذخیره شد — برای اعمال نهایی و قفل شدن متریال، روی دکمه رفرش نگه دارید");
  }, [setData, notify]);

  // ============================================================
  // ── موتور دکمه رفرش (بازنویسی کامل) ──
  // کلیک ساده = فقط رفرش نمایش (بدون اثر روی داده)
  // نگه‌داشتن ۵۵۰ms = قفل کردن آیتم‌های آماده + آزادسازی آیتم‌های در صف آزادسازی
  // دو ضربه سریع (کمتر از ۴۰۰ms) = بازگردانی (Undo) آخرین عملیات قفل/آزادسازی
  // ============================================================

  // بخش ۱ (Refresh — کلیک ساده): قبلاً فقط از localStorage دوباره می‌خوند
  // (کش، نه سینک واقعی). الان اگه لاگین باشه اول یه سینک واقعی با سرور می‌زنه
  // (همون performSynchronization که تب همگام‌سازی استفاده می‌کنه)، بعد
  // دوباره از دیتای تازه (سرور یا لوکال، هرکدوم به‌روزتره) قیمت‌های درصدی رو
  // ری‌سینک می‌کنه. بعدش فیلدهای الزامی خالی رو روی محصولات/متریال/گالری
  // چک می‌کنه و اگه جایی خالی بود، به‌جای پیام معمولی، یه توست هشدار با
  // اسم تب‌های خطادار نشون می‌ده.
  //
  // refreshResetTick (از Logy 🟠): هر بار کلیک ساده زده بشه این عدد یکی زیاد
  // می‌شه؛ تب‌های محصولات/متریال/گالری با useEffect روی همین گوش می‌دن تا
  // فیلترهای فعالشون (جستجو، وضعیت، نوع، ...) رو بازنشانی کنن
  const [refreshResetTick, setRefreshResetTick] = useState(0);

  // بخش ۱ (Refresh — علامت !): کدهای تب‌های خطادار (نه فقط برچسب فارسی‌شون) رو
  // نگه می‌داریم تا نوار تب‌ها (هم GlobalHeader هم پنل مدیریت) بتونن یه نشونه‌ی
  // زرد ماندگار روی خودِ دکمه‌ی تب بذارن، نه فقط توی متن توست
  const [refreshProblemTabs, setRefreshProblemTabs] = useState([]);

  const handleQuickRefresh = useCallback(async () => {
    try {
      let base = loadData() || {};
      if (token) {
        try {
          const result = await performSynchronization(latestDataRef.current, token);
          if (result?.success && result.mergedData && typeof result.mergedData === "object") {
            base = result.mergedData;
          }
        } catch (_) {}
      }

      const materials = Array.isArray(base.materials) ? base.materials.filter(Boolean) : [];
      const products = Array.isArray(base.products) ? base.products.filter(Boolean) : [];
      const customers = Array.isArray(base.customers) ? base.customers.filter(Boolean) : [];
      // رفرش ساده قیمت فروش را دست نمی‌زند
      setData({ ...base, materials, products, customers });
      // فیلترها با کلیک ساده ریست نمی‌شوند — فقط با دابل‌کلیک روی Refresh

      const problemTabs = [];
      if (products.some((p) => !String(p?.code ?? "").trim() || !String(p?.name ?? "").trim())) {
        problemTabs.push({ key: "products", label: "محصولات" });
      }
      if (materials.some((m) => !String(m?.name ?? "").trim() || !String(m?.type ?? "").trim())) {
        problemTabs.push({ key: "materials", label: "متریال" });
      }
      if (customers.some((c) => !String(c?.name ?? "").trim())) {
        problemTabs.push({ key: "gallery", label: "گالری" });
      }

      setRefreshProblemTabs(problemTabs.map((t) => t.key));

      if (problemTabs.length > 0) {
        showToast({ text: `⚠️ فیلد الزامی خالی در: ${problemTabs.map((t) => t.label).join("، ")}`, type: "error", fontSize: 9 });
      } else {
        notify("اطلاعات قابل نمایش بروزرسانی شد");
      }
    } catch (err) {
      console.error("handleQuickRefresh", err);
      notify("خطا در بروزرسانی — دوباره تلاش کنید");
    }
  }, [setData, notify, token, showToast]);

  // دابل‌کلیک روی Refresh: ریست فیلتر/سورت همه تب‌ها بجز برش
  const handleResetFilters = useCallback(() => {
    setRefreshResetTick((t) => t + 1);
    setSortOrder("code");
    setSortOrderMaterials("name");
    setSortOrderGallery("name");
    showToast?.({ text: "فیلترها و مرتب‌سازی ریست شد", type: "success", fontSize: 9 });
  }, [showToast]);

  // پشته‌ی عملیات‌های قفل/آزادسازیِ آخرین پاسِ رفرش، برای Undo آیتم‌به‌آیتم
  // (نه یه اسنپ‌شات از کل state — چون یه پاس می‌تونه چند آیتم مستقل رو با هم
  // قفل/آزاد کنه و دابل‌تپ فقط باید «آخرین یکی» رو برگردونه، نه همه رو با هم)
  const undoOperationsRef = useRef([]);

  const handleHoldRefresh = useCallback((mode = "both") => {
    // ── ۱. شناسایی آیتم‌های آماده قفل و آماده آزادسازی (فقط برای پیام «چیزی نیست») ──
    let hasLockCandidates = false;
    let hasUnlockCandidates = false;
    if ((data.materials || []).some((m) => (m.pendingReleaseCredits || []).length > 0)) {
      hasUnlockCandidates = true;
    }
    data.products.forEach((p) => {
      (p.lineItems || []).forEach((li) => {
        if (!li.materialId) return;
        if (li.pendingUnlock) { hasUnlockCandidates = true; return; }
        if (li.deductedAt) return;

        const mat = data.materials.find((m) => m.id === li.materialId);
        if (mat && mat.type === "fabric") { hasLockCandidates = true; return; }
        if (li.pct != null && toNum(li.pct) > 0) { hasLockCandidates = true; return; }
        if (li.pct == null && !li.batchId && !li.useAreaRatio && toNum(li.cost) > 0 && (li.woodCuts || []).length === 0) {
          if (mat && mat.type !== "fabric") { hasLockCandidates = true; return; }
        }
        if ((li.woodCuts || []).length > 0 && !li.woodLocked) { hasLockCandidates = true; return; }
        if (li.batchId) {
          if (mat) {
            const batch = mat.batches?.find(b => b.id === li.batchId);
            if (batch) hasLockCandidates = true;
          }
        }
      });
    });

    const hasBulkPending = pendingBulkChanges.length > 0;
    const relevantCandidates = mode === "lock" ? hasLockCandidates : mode === "unlock" ? hasUnlockCandidates : (hasLockCandidates || hasUnlockCandidates);

    if (!relevantCandidates && !hasBulkPending) {
      showToast({ text: mode === "lock" ? "چیزی برای قفل شدن نیست" : mode === "unlock" ? "چیزی برای آزادسازی نیست" : "چیزی برای قفل شدن نیست", type: "error", fontSize: 9 });
      return;
    }

    // ── ۲. اجرای واقعیِ محاسبه — به‌صورت خالص و همگام، مستقل از زمان‌بندی React ──
    const result = runLockUnlockPass(data.materials, data.products, pendingBulkChanges, mode);

    // فیکس واقعی (گزارش کاربر: بعد از یه Undo، سود حسابداری به‌طرز عجیبی
    // خراب می‌شد و بیشتر متریال‌های همون پاس آزاد نمی‌شدن): قبلاً یه Undo
    // فقط *آخرین عملیات تکی* رو برمی‌گردوند، نه کل پاسی که کاربر با یه بار
    // نگه‌داشتن انجام داده بود. اگه یه پاس چند محصول رو باهم قفل/آزاد می‌کرد،
    // یه کلیک Undo فقط یکیشونو برمی‌گردوند و بقیه قفل/نیمه‌قفل می‌موندن — یه
    // حالت بینابینی و ناسازگار که باعث اعداد غلط توی حسابداری می‌شد. الان هر
    // عملیات با یه passId مشترک (یکی برای کل همین پاس) تگ می‌شه تا Undo
    // بتونه کل پاس رو یک‌جا و درست برگردونه
    const passId = uid();
    const taggedOps = (result.operations || []).map((op) => ({ ...op, __passId: passId }));

    // پشته‌ی Undo: قبلاً اینجا با = جایگزین می‌شد (نه اضافه)، یعنی فقط آخرین
    // پاسِ قفل/آزادسازی قابل‌بازگشت بود — هر پاس قبلی‌تر که با هولد دیگه‌ای
    // انجام می‌شد، عملیات‌های پاس قبلش کاملاً از بین می‌رفت. الان به یه پشته‌ی
    // واقعیِ تجمیعی تبدیل شد (سقف ۵۰ عملیات) تا واقعاً بشه چند قدم Undo رفت،
    // نه فقط داخل یه پاس
    undoOperationsRef.current = [...undoOperationsRef.current, ...taggedOps].slice(-50);

    setPendingBulkChanges([]);
    setData((d) => ({ ...d, materials: result.materials, products: result.products }));

    // ── ۳. توست نهایی — بر اساس نتیجه‌ی واقعیِ همان محاسبه‌ای که ذخیره شد ──
    const { lockedCount, releasedCount } = result;
    if (lockedCount === 0 && releasedCount === 0) {
      showToast({ text: "چیزی برای قفل شدن نیست", type: "error", fontSize: 9 });
    } else if (lockedCount > 0 && releasedCount > 0) {
      showToast({ text: `${toPersianDigits(lockedCount)} آیتم قفل شد\n${toPersianDigits(releasedCount)} آیتم آزاد شد`, type: "success", fontSize: 9 });
    } else if (lockedCount > 0) {
      showToast({ text: `${toPersianDigits(lockedCount)} آیتم قفل شد`, type: "success", fontSize: 9 });
    } else {
      showToast({ text: `${toPersianDigits(releasedCount)} آیتم آزاد شد`, type: "success", fontSize: 9 });
    }
  }, [data.products, data.materials, pendingBulkChanges, showToast, setData]);

  // ── بازگردانی (Undo) — دو ضربه سریع روی دکمه رفرش پس از یک عملیات قفل/آزادسازی ──
  // قبلاً فقط «آخرین» عملیات ثبت‌شده رو برمی‌گردوند (نه کل پاس رو با هم)؛
  // این باعث می‌شد اگه یه پاس چند محصول رو باهم قفل/آزاد کرده بود، یه Undo
  // فقط یکیشونو برگردونه و بقیه توی یه حالت ناقص/ناسازگار بمونن (که خودش
  // باعث اعداد غلط توی حسابداری می‌شد). الان با passId مشترک، کل عملیات‌های
  // همون پاس (نه فقط یکی) یک‌جا و به‌ترتیب معکوس برمی‌گردن.
  const handleUndoRefresh = useCallback(() => {
    const ops = undoOperationsRef.current;
    if (!ops || ops.length === 0) {
      showToast({ text: "چیزی برای بازگردانی وجود ندارد", type: "error", fontSize: 9 });
      return;
    }
    const lastPassId = ops[ops.length - 1].__passId;
    // همه‌ی عملیات‌های همین پاس (که پشت‌سرهم توی پشته‌ان چون با هم اضافه شدن)
    let splitIdx = ops.length;
    while (splitIdx > 0 && ops[splitIdx - 1].__passId === lastPassId) splitIdx--;
    const passOps = ops.slice(splitIdx);

    let materials = data.materials;
    let products = data.products;
    // به‌ترتیب معکوس (آخرین عملیاتِ همون پاس اول برگرده) تا وابستگی‌های
    // ترتیبی (مثلاً چند خط از یه بچ) درست باز بشن
    for (let i = passOps.length - 1; i >= 0; i--) {
      const r = reverseOperation(materials, products, passOps[i]);
      materials = r.materials;
      products = r.products;
    }
    undoOperationsRef.current = ops.slice(0, splitIdx);
    setData((d) => ({ ...d, materials, products }));
    showToast({ text: passOps.length > 1 ? `${toPersianDigits(passOps.length)} مورد بازگردانی شد` : "عملیات بازگردانی انجام شد", type: "success", fontSize: 9 });
  }, [data.materials, data.products, setData, showToast]);


  const holdRefresh = useCallback(async () => {
    if (pendingBulkChanges.length === 0) {
      if (!token) {
        showToast({ text: "برای همگام‌سازی ابتدا باید وارد حساب کاربری شوید.", type: "error", fontSize: 9 });
        return;
      }
      showToast({ text: "۰ موردی تغییر نکرد", type: "error", fontSize: 9 });
      return;
    }
    const locks = pendingBulkChanges.filter(c => c.action === 'lock').length;
    const unlocks = pendingBulkChanges.filter(c => c.action === 'unlock').length;
    try {
      await performSynchronization(latestDataRef.current, token, pendingBulkChanges);
      setPendingBulkChanges([]);
      showToast({ text: `${locks + unlocks} مورد قفل شد/آزاد شد`, type: "success", fontSize: 9 });
    } catch (e) {
      showToast({ text: "خطا در همگام‌سازی", type: "error", fontSize: 9 });
    }
  }, [pendingBulkChanges, showToast]);

  const quickRefresh = useCallback(() => {
    let pendingCount = 0;
    data.products.forEach((p) => {
      (p.lineItems || []).forEach((li) => {
        if (!li.materialId) return;
        if (!li.deductedAt) pendingCount++;
      });
    });
    const totalPending = pendingCount + pendingBulkChanges.length;
    if (totalPending > 0) {
      showToast({ text: `${totalPending} مورد قفل شد/آزاد شد`, type: "success", fontSize: 9 });
    } else {
      showToast({ text: "۰ موردی تغییر نکرد", type: "error", fontSize: 9 });
    }
  }, [data.products, pendingBulkChanges, showToast]);

  // ── CRUD ──
  const handleImageUpload = useCallback((e, productId) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const product = data.products.find((p) => p.id === productId);
    const codeStr = fmtCode(product?.code != null ? product.code : 0);
    const startIdx = (product?.images || []).length;
    // آیتم ۸ (روادمپ): این مسیر (افزودن سریع عکس از روی کارت محصول، نه فرم ویرایش)
    // قبلاً دیتای خام base64 رو مستقیم توی p.image/p.images ذخیره می‌کرد (نه فایل
    // توی پوشه‌ی محلی)، و فقط تک‌عکسی بود. الان دقیقاً هماهنگ با فرم ویرایش محصول:
    // چندانتخابی + اسم فایل بر اساس کد محصول (نه اسم فارسی که ممکنه موقع لود فاکتور
    // مشکل ایجاد کنه) + ذخیره‌ی واقعی توی پوشه‌ی محلی عکس‌ها
    Promise.all(files.map((f, i) =>
      compressImageFile(f).then((dataUrl) => {
        const seq = String(startIdx + i + 1).padStart(2, "0");
        return saveImageToFolder(dataUrl, IMAGE_CATEGORIES.PRODUCT, `${codeStr}${seq}.jpg`);
      })
    ))
      .then((savedFilenames) => {
        setData((d) => ({
          ...d,
          products: d.products.map((p) => {
            if (p.id !== productId) return p;
            const images = p.images || [];
            return { ...p, image: p.image || savedFilenames[0], images: [...images, ...savedFilenames] };
          })
        }));
      })
      .catch((err) => {
        console.error("Image compress/upload failed:", err);
      });
  }, [data.products]);

  const addMaterialPurchase = useCallback((id, amount, date, qty) => {
    const amt = toNum(amount);
    if (amt <= 0) return;
    const purchDate = date || todayISO();
    const q = toNum(qty) > 0 ? toNum(qty) : 1;
    setData((d) => {
      const materials = d.materials.map((m) => {
        if (m.id !== id) return m;
        const prevTotalQty = m.totalQty != null ? toNum(m.totalQty) : toNum(m.purchaseQty || 0);
        const prevRemainingQty = m.remainingQty != null ? toNum(m.remainingQty) : prevTotalQty;
        return {
          ...m,
          totalCost: toNum(m.totalCost) + amt,
          // خرید جدید به «باقیمانده استخر» اضافه می‌شود؛ اگر بخشی از خرید قبلی قفل/مصرف شده باشد،
          // قیمت واحد زنده باقیمانده به‌صورت میانگین‌وزنی بین خرید قدیم و جدید محاسبه می‌شود
          remainingCost: (m.remainingCost != null ? toNum(m.remainingCost) : toNum(m.totalCost)) + amt,
          totalQty: prevTotalQty + q,
          remainingQty: prevRemainingQty + q,
          purchaseQty: prevTotalQty + q,
          purchaseDate: purchDate,
          procurements: [...(m.procurements || []), { id: uid(), date: purchDate, total: amt, unitPrice: q > 0 ? amt / q : amt, qty: q }],
        };
      });
      return { ...d, materials, products: syncPercentPricedProducts(materials, d.products) };
    });
    notify("خرید جدید به متریال اضافه شد");
  }, [notify]);

  const deleteMaterial = useCallback((id) => {
    setData((d) => ({
      ...d,
      materials: d.materials.filter((m) => m.id !== id),
      products: d.products.map((p) => ({ ...p, lineItems: (p.lineItems || []).map((li) => li.materialId === id ? { ...li, materialId: null, pct: null, batchId: null } : li) }))
    }));
    notify("متریال حذف شد");
  }, [notify]);

  const updateProcurement = (mId, prId, patch) => setData((d) => {
    const materials = d.materials.map((m) => {
      if (m.id !== mId) return m;
      const list = m.procurements || [];
      const idx = list.findIndex((p) => p.id === prId);
      if (idx === -1) return m;
      const old = list[idx];
      const oldTotal = toNum(old.total);
      const oldQty = toNum(old.qty) || 1;
      const newTotal = patch.total != null ? toNum(patch.total) : oldTotal;
      const newQty = patch.qty != null ? (toNum(patch.qty) || 1) : oldQty;
      const deltaTotal = newTotal - oldTotal;
      const deltaQty = newQty - oldQty;
      const updated = { ...old, ...patch, total: newTotal, qty: newQty, unitPrice: newQty > 0 ? newTotal / newQty : newTotal };
      const newProcurements = [...list];
      newProcurements[idx] = updated;
      const prevTotalCost = toNum(m.totalCost);
      const prevRemainingCost = m.remainingCost != null ? toNum(m.remainingCost) : prevTotalCost;
      const prevTotalQty = m.totalQty != null ? toNum(m.totalQty) : 0;
      const prevRemainingQty = m.remainingQty != null ? toNum(m.remainingQty) : prevTotalQty;
      return {
        ...m,
        procurements: newProcurements,
        totalCost: prevTotalCost + deltaTotal,
        remainingCost: Math.max(0, prevRemainingCost + deltaTotal),
        totalQty: prevTotalQty + deltaQty,
        remainingQty: Math.max(0, prevRemainingQty + deltaQty),
      };
    });
    return { ...d, materials, products: syncPercentPricedProducts(materials, d.products) };
  });
  const deleteProcurement = (mId, prId) => setData((d) => {
    const materials = d.materials.map((m) => {
      if (m.id !== mId) return m;
      const list = m.procurements || [];
      const target = list.find((p) => p.id === prId);
      if (!target) return m;
      const prevTotalCost = toNum(m.totalCost);
      const prevRemainingCost = m.remainingCost != null ? toNum(m.remainingCost) : prevTotalCost;
      const prevTotalQty = m.totalQty != null ? toNum(m.totalQty) : 0;
      const prevRemainingQty = m.remainingQty != null ? toNum(m.remainingQty) : prevTotalQty;
      const total = toNum(target.total);
      const qty = toNum(target.qty) || 0;
      return {
        ...m,
        procurements: list.filter((p) => p.id !== prId),
        totalCost: Math.max(0, prevTotalCost - total),
        remainingCost: Math.max(0, prevRemainingCost - total),
        totalQty: Math.max(0, prevTotalQty - qty),
        remainingQty: Math.max(0, prevRemainingQty - qty),
      };
    });
    return { ...d, materials, products: syncPercentPricedProducts(materials, d.products) };
  });

  const addBatch = (mId, b) => setData((d) => {
    const materials = d.materials.map((m) => m.id === mId ? { ...m, batches: [...(m.batches || []), { ...b, id: uid() }] } : m);
    return { ...d, materials, products: syncPercentPricedProducts(materials, d.products) };
  });
  const updateBatch = (mId, bId, patch) => setData((d) => {
    const materials = d.materials.map((m) => m.id === mId ? { ...m, batches: (m.batches || []).map((b) => b.id === bId ? { ...b, ...patch } : b) } : m);
    return { ...d, materials, products: syncPercentPricedProducts(materials, d.products) };
  });
  const deleteBatch = (mId, bId) => setData((d) => {
    // باگ واقعی (گزارش کاربر): قبلاً این تابع فقط بچ رو از آرایه پاک می‌کرد، بدون
    // این‌که به لاین‌آیتم‌های محصولاتی که به همین بچ قفل شده بودن (batchId) کاری
    // داشته باشه — یعنی هزینه‌ی قفل‌شده «مستقیم آزاد» می‌شد (نه آبی/معلق برای
    // آزادسازی دستی)، و از اون به بعد هم اون لاین‌آیتم‌ها به یه بچ ناموجود اشاره
    // می‌کردن (orphan) و هیچ‌وقت درست Undo/رفرش نمی‌شدن. الان دقیقاً مثل حذف کامل
    // محصول (`deleteProduct`) عمل می‌کنه: لاین‌آیتم قفل‌شده به پشتِ صفِ آزادسازی
    // (آبی، `pendingReleaseCredits`) می‌ره، نه این‌که فوری و بی‌سروصدا محو بشه.
    const mIdx = d.materials.findIndex((m) => m.id === mId);
    if (mIdx === -1) return d;
    const m = d.materials[mIdx];
    const batch = (m.batches || []).find((b) => b.id === bId);
    if (!batch) return d;

    let credits = [...(m.pendingReleaseCredits || [])];
    const products = d.products.map((p) => {
      let changed = false;
      const lineItems = (p.lineItems || []).map((li) => {
        if (li.materialId !== mId || li.batchId !== bId) return li;
        if (li.deductedAt || li.pendingUnlock) {
          const cost = toNum(li.deductedCost != null ? li.deductedCost : li.cost || 0);
          if (cost > 0 || (li.woodCuts && li.woodCuts.length)) {
            credits.push({
              id: uid(),
              cost,
              qty: toNum(li.deductedQty || 0),
              fromProductId: p.id,
              fromProductName: p.name || "",
              woodCuts: li.woodCuts || null,
              woodLocked: !!li.woodLocked,
              batchId: bId,
            });
          }
          changed = true;
          return { ...li, pendingUnlock: true, deductedAt: null, _orphanedBatch: true };
        }
        // معلق (زرد، قفل‌نشده) با حذف بچ فقط از بین می‌رود — چیزی برای آزادسازی نیست
        changed = true;
        return { ...li, _toRemove: true };
      }).filter((li) => !li._toRemove);
      return changed ? { ...p, lineItems } : p;
    });

    const materials = d.materials.map((mm, i) => {
      if (i !== mIdx) return mm;
      return { ...mm, batches: (mm.batches || []).filter((b) => b.id !== bId), pendingReleaseCredits: credits };
    });
    return { ...d, materials, products: syncPercentPricedProducts(materials, products) };
  });
  const lockBatch = (mId, bId) => {
    updateBatch(mId, bId, { locked: true });
    setPendingBulkChanges(prev => [...prev, { materialId: mId, batchId: bId, action: 'lock', timestamp: Date.now() }]);
  };
  const unlockBatch = (mId, bId) => {
    updateBatch(mId, bId, { locked: false });
    setPendingBulkChanges(prev => [...prev, { materialId: mId, batchId: bId, action: 'unlock', timestamp: Date.now() }]);
  };

  const addStick = (mId, s) => setData((d) => ({ ...d, materials: d.materials.map((m) => m.id === mId ? { ...m, sticks: [...(m.sticks || []), { ...s, date: s.date || todayISO(), id: uid() }] } : m) }));
  const updateStick = (mId, sId, p) => setData((d) => ({ ...d, materials: d.materials.map((m) => m.id === mId ? { ...m, sticks: (m.sticks || []).map((s) => s.id === sId ? { ...s, ...p } : s) } : m) }));
  const deleteStick = (mId, sId) => setData((d) => ({ ...d, materials: d.materials.map((m) => m.id === mId ? { ...m, sticks: (m.sticks || []).filter((s) => s.id !== sId) } : m) }));

  const linkProductToBatch = (mId, bId, pId) => setData((d) => ({ ...d, materials: d.materials.map((m) => m.id !== mId ? m : { ...m, batches: (m.batches || []).map((b) => b.id !== bId ? b : { ...b, linkedProductIds: (b.linkedProductIds || []).includes(pId) ? b.linkedProductIds : [...(b.linkedProductIds || []), pId] }) }) }));
  const unlinkProductFromBatch = (mId, bId, pId) => setData((d) => ({ ...d, materials: d.materials.map((m) => m.id !== mId ? m : { ...m, batches: (m.batches || []).map((b) => b.id !== bId ? b : { ...b, linkedProductIds: (b.linkedProductIds || []).filter((id) => id !== pId) }) }) }));

  const undeductLineItem = useCallback((productId, lineId) => {
    setData((d) => {
      const p = d.products.find((x) => x.id === productId);
      const li = (p?.lineItems || []).find((x) => x.id === lineId);
      if (!li?.deductedAt || !li.materialId) return d;

      return {
        ...d,
        products: d.products.map((pp) => pp.id !== productId ? pp : {
          ...pp,
          lineItems: pp.lineItems.map((x) => x.id === lineId ? { ...x, pendingUnlock: true } : x)
        })
      };
    });
    notify("برای آزادسازی نهایی و بازگشت به انبار، روی دکمه رفرش نگه دارید");
  }, [notify]);

  const undeductWoodCut = useCallback((productId, lineId) => {
    setData((d) => {
      const p = d.products.find((x) => x.id === productId);
      const li = (p?.lineItems || []).find((x) => x.id === lineId);
      if (!li?.woodLocked || !li.materialId) return d;
      return {
        ...d,
        materials: d.materials.map((m) => {
          if (m.id !== li.materialId) return m;
          const sticks = (m.sticks || []).map((s) => ({ ...s }));
          (li.woodCuts || []).forEach((cut) => {
            const s = sticks.find((x) => x.id === cut.stickId);
            if (s) s.qty = toNum(s.qty) + 1;
            else sticks.push({ id: cut.stickId || uid(), length: cut.length, qty: 1 });
          });
          return { ...m, sticks };
        }),
        products: d.products.map((pp) => pp.id !== productId ? pp : {
          ...pp,
          lineItems: pp.lineItems.map((x) => x.id === lineId ? { ...x, woodLocked: false } : x)
        })
      };
    });
    notify("باز شد — قابل ویرایش");
  }, [notify]);

  const updateProductStatus = useCallback((productId, newStatus, opts = {}) => {
    setData((d) => {
      const products = d.products.map((p) => {
        if (p.id !== productId) return p;
        let updated = { ...p };
        if (newStatus === "sold") {
          updated.status = "sold";
          updated.saleDate = opts.saleDate || p.saleDate || todayISO();
          if (opts.buyerName) updated.buyerName = opts.buyerName;
          if (opts.locationId) updated.location = opts.locationId;
          if (opts.settled !== undefined) { updated.settled = opts.settled; if (opts.settled) updated.settleDate = opts.settleDate || todayISO(); }
        } else if (newStatus === "draft") {
          updated.status = "draft";
          updated.location = "warehouse";
        } else if (newStatus === "built") {
          updated.status = "built";
          updated.location = "warehouse";
        } else if (newStatus === "available") {
          updated.status = "available";
          updated.settled = false;
          if (opts.clearLocation) updated.location = "warehouse";
        } else if (newStatus === "settled") {
          updated.status = "sold";
          updated.settled = true;
          updated.settleDate = opts.settleDate || todayISO();
        } else if (newStatus === "unsettled") {
          updated.status = "sold";
          updated.settled = false;
        }
        return updated;
      });
      return { ...d, products };
    });
  }, []);

  const deleteCustomer = useCallback((id) => {
    setData((d) => ({ ...d, customers: (d.customers || []).filter((c) => c.id !== id), products: d.products.map((p) => p.location === id ? { ...p, location: "warehouse" } : p) }));
    notify("حذف شد");
  }, [notify]);

  const deleteProduct = useCallback((id) => {
    setData((d) => {
      const p = d.products.find((prod) => prod.id === id);
      if (!p) return d;

      let materials = d.materials.map((m) => ({
        ...m,
        sticks: m.sticks ? m.sticks.map((s) => ({ ...s })) : [],
      }));

      // Unlink product from any batch linkedProductIds
      materials = materials.map((m) => {
        if (!m.batches || m.batches.length === 0) return m;
        return {
          ...m,
          batches: m.batches.map((b) => {
            if (!b.linkedProductIds) return b;
            return {
              ...b,
              linkedProductIds: b.linkedProductIds.filter((pid) => pid !== id),
            };
          }),
        };
      });

      // متریال‌های قفل‌شده → آبی (آماده‌ی آزادسازی)، نه آزاد فوری
      (p.lineItems || []).forEach((li) => {
        if (!li.materialId) return;
        const mIdx = materials.findIndex((m) => m.id === li.materialId);
        if (mIdx === -1) return;
        const m = materials[mIdx];

        if (li.deductedAt || li.pendingUnlock) {
          const cost = toNum(li.deductedCost != null ? li.deductedCost : li.cost || 0);
          if (cost > 0 || (li.woodCuts && li.woodCuts.length)) {
            const credits = [...(m.pendingReleaseCredits || [])];
            credits.push({
              id: uid(),
              cost,
              qty: toNum(li.deductedQty || 0),
              fromProductId: id,
              fromProductName: p.name || "",
              woodCuts: li.woodCuts || null,
              woodLocked: !!li.woodLocked,
              batchId: li.batchId || null,
            });
            materials[mIdx] = { ...m, pendingReleaseCredits: credits, hidden: false };
          }
        }
        // معلق (زرد، قفل‌نشده) با حذف محصول فقط از بین می‌رود — چیزی برای آزادسازی نیست
      });

      return {
        ...d,
        products: d.products.filter((prod) => prod.id !== id),
        materials,
      };
    });
    notify("محصول حذف شد — متریال‌های قفل‌شده آماده‌ی آزادسازی شدند (آبی)");
  }, [notify]);

  // ── Export/Import ──
   const handleExportExcel = useCallback(async () => {
    try {
      // ── 1. Products Sheet (محصولات) ──
      const pHeaders = [
        "شناسه محصول (ID)",
        "کد",
        "گروه (دسته)",
        "نام محصول",
        "ابعاد",
        "عرض (cm)",
        "ارتفاع (cm)",
        "شکل",
        "وضعیت فروش",
        "موقعیت مکانی (انبار/گالری)",
        "نام خریدار",
        "شماره خریدار",
        "تاریخ فروش",
        "تاریخ تسویه",
        "وضعیت تسویه",
        "درصد تخفیف",
        "قیمت فروش (تومان)",
        "درصد سود",
        "قیمت نهایی با تخفیف (تومان)",
        "کل هزینه ساخت (تومان)",
        "درصد پوشش فرش",
        "شناسه گالری/مشتری متصل (ID)",
        "تصاویر",
        "متریال‌های متصل (Raw JSON)",
        "زمان ویرایش (Timestamp)",
        "فرش متصل (نام)",
        "پیش‌نویس؟",
        "نوع محصول",
        "توضیحات",
        "شناسه فرش متصل (ID)",
        "شناسه نوع محصول (ID)",
        "قیمت دستی؟",
        "مخفی از کاتالوگ؟",
        "تعداد",
        "تصویر اصلی",
        "کالیگرافی؟"
      ];

      const wsProductsRows = [pHeaders];
      productTotals.forEach((p) => {
        const rowData = [
          p.id,
          p.code ? toNum(p.code) : "",
          p.group || "",
          p.name || "",
          p.dims || "",
          p.dimW != null ? toNum(p.dimW) : "",
          p.dimH != null ? toNum(p.dimH) : "",
          p.shape || "rectangle",
          p.status === "sold" ? "فروخته‌شده" : "موجود",
          p.location === "warehouse" ? "انبار" : ((data.customers || []).find(c => c.id === p.location)?.name || "انبار"),
          p.buyerName || "",
          p.buyerPhone || "",
          p.saleDate ? fmtDate(p.saleDate) : "",
          p.settleDate ? fmtDate(p.settleDate) : "",
          p.status === "sold" ? (p.settled ? "تسویه‌شده" : "تسویه‌نشده") : "—",
          toNum(p.discountPercent) || 0,
          toNum(p.salePrice) || 0,
          toNum(p.profitPct) || 30,
          toNum(p.discountedPrice) || 0,
          toNum(p.totalCost) || 0,
          toNum(p.fabricCoveragePct) ?? 100,
          p.buyerCustomerId || (p.location !== "warehouse" ? p.location : "") || "",
          (p.images || []).join(", "),
          (() => {
            const enrichedLineItems = (p.lineItems || []).map(li => {
              if (li.materialId) {
                const mat = data.materials?.find(m => m.id === li.materialId);
                if (mat) {
                  return {
                    ...li,
                    consumedQtyOfMaterial: toNum(mat.purchaseQty),
                    consumedQty: toNum(mat.purchaseQty),
                    "تعداد مصرفی از متریال": toNum(mat.purchaseQty),
                    materialUnitCost: toNum(mat.unitCost)
                  };
                }
              }
              return li;
            });
            return JSON.stringify(enrichedLineItems);
          })(),
          p.updatedAt || "",
          (() => {
            const fabricId = p.fabricMaterialId || (p.lineItems || []).find((li) => {
              const mat = li.materialId ? data.materials?.find((m) => m.id === li.materialId) : null;
              return mat && mat.type === "fabric";
            })?.materialId;
            const fabricMat = fabricId ? data.materials?.find((m) => m.id === fabricId) : null;
            return fabricMat?.name || "";
          })(),
          p.isDraft ? "بله" : "خیر",
          data.productTypes?.find((t) => t.id === p.productTypeId)?.name || "",
          p.description || "",
          p.fabricMaterialId || (() => {
            const li = (p.lineItems || []).find((l) => {
              const mat = l.materialId ? data.materials?.find((m) => m.id === l.materialId) : null;
              return mat && mat.type === "fabric";
            });
            return li?.materialId || "";
          })(),
          p.productTypeId || "",
          p.salePriceManual ? "بله" : "خیر",
          p.hiddenFromCatalog ? "بله" : "خیر",
          p.qty != null ? toNum(p.qty) : 1,
          p.image || "",
          // ستون جدید همیشه در انتها اضافه می‌شه، نه وسط — دقیقاً برای این‌که
          // باگ حیاتیِ column-shift که قبلاً کل import رو می‌ترکوند (مستند
          // بالای همین فایل) دوباره تکرار نشه (Ash 🟡، آیتم ۷ - تکمیل export/import)
          p.isCalligraphy ? "بله" : "خیر"
        ];
        wsProductsRows.push(rowData);
      });

      const wsProducts = XLSX.utils.aoa_to_sheet(wsProductsRows);

      // Apply formatting to cells in wsProducts
      productTotals.forEach((p, idx) => {
        const rIdx = idx + 1;
        [15, 17, 20].forEach(cIdx => {
          const cellRef = XLSX.utils.encode_cell({ r: rIdx, c: cIdx });
          if (wsProducts[cellRef]) wsProducts[cellRef].z = '0"%"';
        });
        [16, 18, 19].forEach(cIdx => {
          const cellRef = XLSX.utils.encode_cell({ r: rIdx, c: cIdx });
          if (wsProducts[cellRef]) wsProducts[cellRef].z = '#,##0';
        });
        [1].forEach(cIdx => {
          const cellRef = XLSX.utils.encode_cell({ r: rIdx, c: cIdx });
          if (wsProducts[cellRef]) wsProducts[cellRef].z = '0';
        });
      });

      wsProducts["!cols"] = [
        { wch: 18 }, { wch: 8 }, { wch: 15 }, { wch: 25 }, { wch: 12 },
        { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 22 },
        { wch: 15 }, { wch: 15 }, { wch: 13 }, { wch: 13 }, { wch: 12 },
        { wch: 12 }, { wch: 15 }, { wch: 10 }, { wch: 15 }, { wch: 15 },
        { wch: 15 }, { wch: 18 }, { wch: 25 }, { wch: 30 }, { wch: 20 },
        { wch: 20 }, { wch: 10 }, { wch: 18 }
      ];
      wsProducts["!views"] = [{ RTL: true, showGridLines: true }];

      // Helper to calculate batch consumed cost
      const getBatchConsumedCost = (m, batch, products) => {
        let consumed = 0;
        (products || []).forEach(p => {
          (p.lineItems || []).forEach(li => {
            if (li.materialId === m.id && li.batchId === batch.id) {
              const pDecorated = productTotals.find(pt => pt.id === p.id);
              const liDecorated = pDecorated?.lineItems?.find(l => l.materialId === m.id && l.batchId === batch.id);
              if (liDecorated) {
                consumed += toNum(liDecorated.resolvedCost);
              } else {
                consumed += toNum(li.cost || li.deductedCost || 0);
              }
            }
          });
        });
        if (batch.locked || (batch.linkedProductIds && batch.linkedProductIds.length > 0)) {
          return toNum(batch.totalCost);
        }
        return Math.min(toNum(batch.totalCost), consumed);
      };

      // ── 2. Materials Sheet (متریال‌ها) ──
      const mHeaders = [
        "شناسه متریال (ID)",
        "نام متریال",
        "نوع متریال",
        "دسته‌بندی",
        "تعداد موجود",
        "قیمت واحد",
        "قیمت کل",
        "تعداد مصرف شده",
        "عرض (cm)",
        "ارتفاع (cm)",
        "طول واحد (cm)",
        "نسبت/تعداد پیش‌فرض",
        "درصد پیش‌فرض",
        "آیا ابزار است؟",
        "محاسبه در هزینه؟",
        "مخفی؟",
        "تاریخ خرید",
        "قدمت (سال)",
        "طرح فرش",
        "بچ‌های شارژ شده (Raw JSON)",
        "شاخه‌ها (Raw JSON)",
        "خریدهای ثبت شده (Raw JSON)",
        "شناسه محصولات متصل (Raw JSON)",
        "زمان ویرایش (Timestamp)",
        "هزینه باقیمانده",
        "تعداد کل (totalQty)",
        "تعداد باقیمانده (remainingQty)",
        "اعتبار فعال؟",
        "باقیمانده قابل‌مصرف؟"
      ];

      const wsMaterialsRows = [mHeaders];
      materialsWithRemaining.forEach((m) => {
        const purchaseQty = m.purchaseQty != null ? toNum(m.purchaseQty) : 1;
        const unitCost = m.unitCost != null ? toNum(m.unitCost) : toNum(m.totalCost);
        const totalCost = toNum(m.totalCost);
        const remainingCost = m.remainingCost != null ? toNum(m.remainingCost) : totalCost;
        const usedCost = Math.max(0, totalCost - remainingCost);
        const consumedQty = totalCost > 0 ? (usedCost / totalCost) * purchaseQty : 0;

        const exportedBatches = (m.batches || []).map(b => {
          const batchConsumedCost = getBatchConsumedCost(m, b, productTotals);
          const bQty = b.qty || 1;
          const bUnitPrice = b.unitPrice || (toNum(b.totalCost) / bQty);
          const bConsumedQty = toNum(b.totalCost) > 0 ? (batchConsumedCost / toNum(b.totalCost)) * bQty : 0;
          return {
            ...b,
            qty: bQty,
            unitPrice: bUnitPrice,
            totalCost: toNum(b.totalCost),
            consumedQty: bConsumedQty
          };
        });

        const rowData = [
          m.id,
          m.name || "",
          m.type || "purchased",
          m.category || "",
          purchaseQty,
          unitCost,
          totalCost,
          consumedQty,
          m.dimW != null ? toNum(m.dimW) : "",
          m.dimH != null ? toNum(m.dimH) : "",
          m.unitLength != null ? toNum(m.unitLength) : "",
          m.ratioValue != null ? toNum(m.ratioValue) : (m.fixedQty != null ? toNum(m.fixedQty) : ""),
          m.defaultPct != null ? toNum(m.defaultPct) : 100,
          m.isHardwareTool ? "بله" : "خیر",
          m.includeInCost ? "بله" : "خیر",
          m.hidden ? "بله" : "خیر",
          m.purchaseDate ? fmtDate(m.purchaseDate) : "",
          m.type === "fabric" && m.ageYears != null ? toNum(m.ageYears) : "",
          m.type === "fabric" ? (m.pattern || "") : "",
          JSON.stringify(exportedBatches),
          JSON.stringify((m.sticks || []).map((s) => {
            const sQty = Math.max(1, toNum(s.qty) || 1);
            const sTotal = s.totalCost != null ? toNum(s.totalCost) : null;
            const sUnit = s.unitPrice != null ? toNum(s.unitPrice)
              : (sTotal != null && sQty > 0 ? Math.round(sTotal / sQty) : null);
            return { ...s, qty: sQty, unitPrice: sUnit, totalCost: sTotal };
          })),
          JSON.stringify((m.procurements || []).map((pr) => {
            const prQty = Math.max(1, toNum(pr.qty) || 1);
            const prTotal = toNum(pr.total);
            const prUnit = pr.unitPrice != null ? toNum(pr.unitPrice)
              : (prQty > 0 && prTotal > 0 ? Math.round(prTotal / prQty) : null);
            return { ...pr, qty: prQty, unitPrice: prUnit, total: prTotal };
          })),
          JSON.stringify(m.linkedProductIds || []),
          m.updatedAt || "",
          m.remainingCost != null ? toNum(m.remainingCost) : remainingCost,
          m.totalQty != null ? toNum(m.totalQty) : purchaseQty,
          m.remainingQty != null ? toNum(m.remainingQty) : "",
          m.creditAllowed === false ? "خیر" : "بله",
          m.isUsableRemaining === false ? "خیر" : "بله"
        ];
        wsMaterialsRows.push(rowData);
      });

      const wsMaterials = XLSX.utils.aoa_to_sheet(wsMaterialsRows);

      // Apply formatting to cells in wsMaterials
      materialsWithRemaining.forEach((m, idx) => {
        const rIdx = idx + 1;
        [5, 6].forEach(cIdx => {
          const cellRef = XLSX.utils.encode_cell({ r: rIdx, c: cIdx });
          if (wsMaterials[cellRef]) wsMaterials[cellRef].z = '#,##0';
        });
        [12].forEach(cIdx => {
          const cellRef = XLSX.utils.encode_cell({ r: rIdx, c: cIdx });
          if (wsMaterials[cellRef]) wsMaterials[cellRef].z = '0"%"';
        });
      });

      wsMaterials["!cols"] = [
        { wch: 18 }, { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 12 },
        { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 10 },
        { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 15 },
        { wch: 10 }, { wch: 13 }, { wch: 30 }, { wch: 30 }, { wch: 30 },
        { wch: 30 }, { wch: 20 }
      ];
      wsMaterials["!views"] = [{ RTL: true, showGridLines: true }];

      // ── 3. Cutting Sessions Sheet (جلسات برش) ──
      const sHeaders = [
        "شناسه جلسه (ID)",
        "عنوان جلسه",
        "تاریخ ثبت",
        "لیست فریم‌ها (Raw JSON)",
        "لیست شاخه‌ها (Raw JSON)",
        "لیست پنل‌ها (Raw JSON)",
        "اطلاعات کامل جلسه (Raw JSON)",
        "زمان ویرایش (Timestamp)"
      ];

      const wsSessionsRows = [sHeaders];
      const sessionsList = data.woodCuttingSessions || [];
      sessionsList.forEach((s) => {
        const rowData = [
          s.id,
          s.title || `جلسه برش`,
          s.timestamp ? fmtDate(new Date(s.timestamp)) : "",
          JSON.stringify(s.frames || []),
          JSON.stringify(s.stickRows || []),
          JSON.stringify(s.panelRows || []),
          JSON.stringify(s),
          s.updatedAt || s.timestamp || ""
        ];
        wsSessionsRows.push(rowData);
      });

      const wsSessions = XLSX.utils.aoa_to_sheet(wsSessionsRows);

      wsSessions["!cols"] = [
        { wch: 18 }, { wch: 20 }, { wch: 15 }, { wch: 30 }, { wch: 30 }, { wch: 30 }, { wch: 30 }, { wch: 20 }
      ];
      wsSessions["!views"] = [{ RTL: true, showGridLines: true }];

      // ── 4. Galleries & Customers Sheet (گالری‌ها و مشتری‌ها) ──
      const cHeaders = [
        "شناسه یکتا (ID)",
        "نام",
        "نام مدیر گالری",
        "شماره تلفن",
        "نوع",
        "رنگ اختصاصی",
        "یادداشت",
        "لیست فاکتورها (Human-Readable)",
        "اطلاعات کامل مشتری (Raw JSON)",
        "زمان ویرایش (Timestamp)"
      ];

      const wsCustomersRows = [cHeaders];
      const customersList = data.customers || [];
      customersList.forEach((c) => {
        const soldProducts = productTotals.filter(p => p.status === "sold" && p.saleDate && p.location === c.id);
        const groups = {};
        soldProducts.forEach(p => {
          const d = p.saleDate.substring(0, 10);
          if (!groups[d]) groups[d] = [];
          groups[d].push(p);
        });

        const invoicesText = Object.keys(groups).sort((a, b) => b.localeCompare(a)).map(d => {
          const total = groups[d].reduce((s, p) => s + toNum(p.salePrice), 0);
          const settled = groups[d].every(p => p.settled) ? "تسویه شده" : "تسویه نشده";
          return `تاریخ ${fmtDate(d)} (${groups[d].length} کالا - جمع ${fmt(total)} ت - ${settled})`;
        }).join(" | ");

        const rowData = [
          c.id,
          c.name || "",
          c.galleryOwnerName || "",
          c.phone || "",
          c.kind === "gallery" ? "گالری" : "مشتری مستقیم",
          c.color || "",
          c.note || "",
          invoicesText || "فاقد فاکتور فروش",
          JSON.stringify(c),
          c.updatedAt || ""
        ];
        wsCustomersRows.push(rowData);
      });

      const wsCustomers = XLSX.utils.aoa_to_sheet(wsCustomersRows);

      wsCustomers["!cols"] = [
        { wch: 18 }, { wch: 25 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 25 }, { wch: 50 }, { wch: 30 }, { wch: 20 }
      ];
      wsCustomers["!views"] = [{ RTL: true, showGridLines: true }];

      // ── 5. Business Cards Sheet (کارت‌ویزیت‌ها) — قبلاً اصلاً شیتی برای
      //     کارت‌ویزیت‌ها وجود نداشت و در خروجی اکسل کلاً جا می‌موند ──
      const bcHeaders = [
        "شناسه (ID)",
        "نوع",
        "نام",
        "تلفن",
        "آدرس",
        "وبسایت",
        "اینستاگرام",
        "لینکدین",
        "تلگرام",
        "واتساپ",
        "ایمیل",
        "یادداشت",
        "اطلاعات کامل (Raw JSON)",
        "زمان ویرایش (Timestamp)"
      ];
      const wsBcRows = [bcHeaders];
      const allBusinessCards = [
        ...(data.myBusinessCard ? [{ ...data.myBusinessCard, isMine: true }] : []),
        ...((data.businessCards || []).map((b) => ({ ...b, isMine: false }))),
      ];
      allBusinessCards.forEach((b) => {
        wsBcRows.push([
          b.id || "",
          b.isMine ? "کارت خودم" : "کارت همکار/رابط",
          b.name || "",
          b.phone || "",
          b.address || "",
          b.website || "",
          b.instagram || "",
          b.linkedin || "",
          b.telegram || "",
          b.whatsapp || "",
          b.email || "",
          b.note || "",
          JSON.stringify(b),
          b.updatedAt || ""
        ]);
      });
      const wsBusinessCards = XLSX.utils.aoa_to_sheet(wsBcRows);
      wsBusinessCards["!cols"] = [
        { wch: 18 }, { wch: 14 }, { wch: 20 }, { wch: 15 }, { wch: 25 }, { wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 25 }, { wch: 30 }, { wch: 20 }
      ];
      wsBusinessCards["!views"] = [{ RTL: true, showGridLines: true }];

      // ── 6. Equipment Sheet (تجهیزات) ──
      const eqList = data.equipment || [];
      const wsEqRows = [["شناسه (ID)", "اطلاعات کامل (Raw JSON)", "زمان ویرایش (Timestamp)"]];
      eqList.forEach((e) => {
        wsEqRows.push([e?.id || "", JSON.stringify(e), e?.updatedAt || ""]);
      });
      const wsEquipment = XLSX.utils.aoa_to_sheet(wsEqRows);
      wsEquipment["!cols"] = [{ wch: 18 }, { wch: 40 }, { wch: 20 }];
      wsEquipment["!views"] = [{ RTL: true, showGridLines: true }];

      // ── 7. Workshop Links Sheet (لینک‌های کارگاه) ──
      const wlList = data.workshopLinks || [];
      const wsWlRows = [["شناسه (ID)", "شناسه محصول", "شناسه متریال", "شناسه فریم", "اطلاعات کامل (Raw JSON)"]];
      wlList.forEach((w) => {
        wsWlRows.push([w?.id || "", w?.productId || "", w?.materialId || "", w?.frameId || "", JSON.stringify(w)]);
      });
      const wsWorkshopLinks = XLSX.utils.aoa_to_sheet(wsWlRows);
      wsWorkshopLinks["!cols"] = [{ wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 40 }];
      wsWorkshopLinks["!views"] = [{ RTL: true, showGridLines: true }];

      // ── 8. Audit Log Sheet (ردپای تغییرات) ──
      const auditList = data.auditLog || [];
      const wsAuditRows = [["تاریخ (Timestamp)", "نوع رکورد", "نام رکورد", "شناسه رکورد", "نوع تغییر"]];
      const auditActionFa = { created: "افزوده شد", updated: "ویرایش شد", deleted: "حذف شد" };
      auditList.forEach((a) => {
        wsAuditRows.push([
          a.date ? fmtDate(new Date(a.date)) : "",
          a.entityLabel || a.entity || "",
          a.entityName || "",
          a.entityId || "",
          auditActionFa[a.action] || a.action || ""
        ]);
      });
      const wsAuditLog = XLSX.utils.aoa_to_sheet(wsAuditRows);
      wsAuditLog["!cols"] = [{ wch: 16 }, { wch: 16 }, { wch: 25 }, { wch: 18 }, { wch: 14 }];
      wsAuditLog["!views"] = [{ RTL: true, showGridLines: true }];

      // ── انواع محصول (داینامیک با ID) ──
      const ptList = data.productTypes || [];
      const wsPtRows = [["شناسه نوع (ID)", "نام نوع", "اطلاعات کامل (Raw JSON)"]];
      ptList.forEach((t) => {
        wsPtRows.push([t?.id || "", t?.name || "", JSON.stringify(t || {})]);
      });
      const wsProductTypes = XLSX.utils.aoa_to_sheet(wsPtRows);
      wsProductTypes["!cols"] = [{ wch: 22 }, { wch: 24 }, { wch: 40 }];
      wsProductTypes["!views"] = [{ RTL: true, showGridLines: true }];

      // ── پیش‌نویس فاکتورها ──
      const invList = data.invoiceDrafts || [];
      const wsInvRows = [["شناسه (ID)", "اطلاعات کامل (Raw JSON)", "زمان ویرایش"]];
      invList.forEach((inv) => {
        wsInvRows.push([inv?.id || "", JSON.stringify(inv || {}), inv?.updatedAt || inv?.createdAt || ""]);
      });
      const wsInvoiceDrafts = XLSX.utils.aoa_to_sheet(wsInvRows);
      wsInvoiceDrafts["!cols"] = [{ wch: 22 }, { wch: 50 }, { wch: 20 }];
      wsInvoiceDrafts["!views"] = [{ RTL: true, showGridLines: true }];

      // ── Build Workbook ──
      const wb = XLSX.utils.book_new();
      wb.Workbook = { Views: [{ RTL: true }] };
      XLSX.utils.book_append_sheet(wb, wsProducts, "محصولات");
      XLSX.utils.book_append_sheet(wb, wsMaterials, "متریال‌ها");
      XLSX.utils.book_append_sheet(wb, wsSessions, "جلسات برش");
      XLSX.utils.book_append_sheet(wb, wsCustomers, "مشتریان و گالری‌ها");
      XLSX.utils.book_append_sheet(wb, wsBusinessCards, "کارت‌ویزیت‌ها");
      XLSX.utils.book_append_sheet(wb, wsEquipment, "تجهیزات");
      XLSX.utils.book_append_sheet(wb, wsWorkshopLinks, "لینک‌های کارگاه");
      XLSX.utils.book_append_sheet(wb, wsAuditLog, "ردپای تغییرات");
      XLSX.utils.book_append_sheet(wb, wsProductTypes, "انواع محصول");
      XLSX.utils.book_append_sheet(wb, wsInvoiceDrafts, "پیش‌نویس فاکتور");
      const wbBinary = XLSX.write(wb, { type: "array", bookType: "xlsx" });
      const wbBlob = new Blob([wbBinary], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      await saveFile(wbBlob, `refarsh-backup-${todayISO()}.xlsx`);
      notify("فایل اکسل چندصفحه‌ای پشتیبان با موفقیت ساخته و دانلود شد");
    } catch (err) {
      console.error("Export Excel error:", err);
      notify("خطا در ساخت خروجی اکسل چندصفحه‌ای");
    }
  }, [productTotals, materialsWithRemaining, data, notify]);

  // ── بخش ۳۵: خروجی اکسل پیش‌نمایش گرافیکی (رنگی، فقط نمایشی — هرگز import نمی‌شه) ──
  // چیدمان نزدیک به Book1 کاربر: شیت «خروجی» + شیت «متریال»
  const handleExportPreviewExcel = useCallback(async () => {
    try {
      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();
      wb.creator = "Refarsh";
      wb.views = [{ rightToLeft: true }];

      const solid = (argb) => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
      const money = "#,##0";

      // دسته‌بندی هزینه از روی type / نام متریال (نزدیک به ستون‌های Book1)
      const COST_COLS = [
        { key: "wood", header: "سهم چوب", match: (m, li) => m?.type === "linear" || /چوب|قاب|شاسی/.test(`${m?.name || ""}${li?.label || ""}`) },
        { key: "fabric", header: "سهم فرش", match: (m, li) => m?.type === "fabric" || /فرش/.test(`${m?.name || ""}${li?.label || ""}`) },
        { key: "board", header: "سهم صفحه", match: (m, li) => m?.type === "area" || /صفحه|mdf|ام\s*دی\s*اف/i.test(`${m?.name || ""}${li?.label || ""}`) },
        { key: "mirror", header: "قیمت ایینه", match: (m, li) => /آینه|ایینه|آیینه/.test(`${m?.name || ""}${li?.label || ""}`) },
        { key: "callig", header: "قیمت کالیگرافی", match: (m, li) => /کالیگ/.test(`${m?.name || ""}${li?.label || ""}`) },
        { key: "paint", header: "سهم رنگ", match: (m, li) => /رنگ|پتینه|اکرلی|اکریلی/.test(`${m?.name || ""}${li?.label || ""}`) },
        { key: "sealer", header: "سیلر کیلر شاپان", match: (m, li) => /سیلر|کیلر|شاپان|وارنیش/.test(`${m?.name || ""}${li?.label || ""}`) },
        { key: "glue", header: "چسب", match: (m, li) => /چسب/.test(`${m?.name || ""}${li?.label || ""}`) },
        { key: "hardware", header: "قیمت یراق", match: (m, li) => m?.type === "fixed" || /یراق|پیچ|قفل|لولا|گیره/.test(`${m?.name || ""}${li?.label || ""}`) },
        { key: "fabricPad", header: "پارچه و ابر", match: (m, li) => /پارچه|ابر|فوم|کوسن|رومیزی/.test(`${m?.name || ""}${li?.label || ""}`) },
        { key: "thread", header: "ریشه و نخ", match: (m, li) => /ریشه|نخ|مکرومه/.test(`${m?.name || ""}${li?.label || ""}`) },
        { key: "pack", header: "بسته بندی", match: (m, li) => /بسته|فوم محافظ|کارتن/.test(`${m?.name || ""}${li?.label || ""}`) },
      ];

      const matById = {};
      (data.materials || []).forEach((m) => { matById[m.id] = m; });

      const bucketLine = (li) => {
        const cost = toNum(li.resolvedCost != null ? li.resolvedCost : li.cost);
        if (cost <= 0) return null;
        const m = li.materialId ? matById[li.materialId] : null;
        for (const col of COST_COLS) {
          if (col.match(m, li)) return { key: col.key, cost };
        }
        return { key: "_other", cost };
      };

      const formatDims = (p) => {
        if (p.dims) return p.dims;
        const w = toNum(p.dimW), h = toNum(p.dimH);
        if (w && h) return `${w}x${h}`;
        if (w) return `${w}`;
        return "";
      };


      // ── شیت خروجی (دسته‌بندی رنگی + ستون‌های گالری) ──
      const ws = wb.addWorksheet("خروجی", { views: [{ rightToLeft: true, state: "frozen", ySplit: 2 }] });

      // ۱۲ رنگ کمرنگ برای محصولات / پررنگ‌تر برای هدر دسته
      const CAT_LIGHT = ["FFE8F5E9","FFE3F2FD","FFFFF3E0","FFF3E5F5","FFFCE4EC","FFE0F7FA","FFFFFDE7","FFE8EAF6","FFF1F8E9","FFFFEBEE","FFE0F2F1","FFFFF8E1"];
      const CAT_DARK  = ["FF66BB6A","FF42A5F5","FFFFA726","FFAB47BC","FFEC407A","FF26C6DA","FFFFEE58","FF7986CB","FF9CCC65","FFEF5350","FF4DB6AC","FFFFCA28"];

      const galleries = (data.customers || []).filter((c) => c.kind === "gallery" || c.isGallery);
      const galleryList = galleries.length ? galleries : (data.customers || []).filter((c) => c.kind !== "warehouse");

      // ردیف ۱: هدر اصلی
      const header1 = ["شرح", "ابعاد", ...COST_COLS.map((c) => c.header), "جمع هزینه", "قیمت فروش"];
      galleryList.forEach((g) => {
        header1.push(g.name || "گالری");
        header1.push("فروش‌رفته");
        header1.push("تسویه‌نشده");
      });
      const r1 = ws.addRow(header1);
      r1.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
      r1.height = 24;
      r1.eachCell((cell) => {
        cell.fill = solid("FF1a1a1a");
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      });

      // ردیف ۲: زیرهدر گالری‌ها (موجودی / فروش / بدهکار)
      const header2 = ["", "", ...COST_COLS.map(() => ""), "", ""];
      galleryList.forEach(() => {
        header2.push("موجود");
        header2.push("فروش");
        header2.push("بدهکار");
      });
      const r2 = ws.addRow(header2);
      r2.font = { bold: true, size: 9, color: { argb: "FFFFFFFF" } };
      r2.eachCell((cell, col) => {
        cell.fill = solid("FF333333");
        cell.alignment = { horizontal: "center" };
      });
      // رنگ هدر هر گالری
      galleryList.forEach((g, gi) => {
        const base = 3 + COST_COLS.length + 2 + gi * 3;
        const gColor = (g.color || "#888888").replace("#", "");
        const argb = gColor.length === 6 ? `FF${gColor}` : "FF888888";
        for (let k = 0; k < 3; k++) {
          const cell = r1.getCell(base + k);
          cell.fill = solid(argb);
          r2.getCell(base + k).fill = solid(argb);
        }
      });

      ws.columns = header1.map((h, i) => ({
        width: i === 0 ? 24 : i === 1 ? 12 : 11,
      }));

      // گروه‌بندی محصولات
      const groups = {};
      const groupOrder = [];
      productTotals.forEach((p) => {
        if (p.isDraft) return;
        let g = "بدون دسته";
        try {
          g = resolveProductGroupName(p, data.materials || []) || p.group || "بدون دسته";
        } catch (_) {
          g = p.group || "بدون دسته";
        }
        if (!groups[g]) { groups[g] = []; groupOrder.push(g); }
        groups[g].push(p);
      });

      const moneyCols = new Set();
      // هزینه + فروش
      for (let i = 3; i <= 4 + COST_COLS.length; i++) moneyCols.add(i);

      groupOrder.forEach((gName, gi) => {
        const list = groups[gName];
        const light = CAT_LIGHT[gi % CAT_LIGHT.length];
        const dark = CAT_DARK[gi % CAT_DARK.length];

        // جمع‌های دسته
        let gCost = 0, gPrice = 0;
        const gCostBuckets = {};
        COST_COLS.forEach((c) => { gCostBuckets[c.key] = 0; });
        const gGal = galleryList.map(() => ({ stock: 0, sold: 0, debt: 0 }));

        list.forEach((p) => {
          const cost = toNum(p.totalCost);
          const price = p.discountedPrice != null ? toNum(p.discountedPrice) : toNum(p.salePrice);
          gCost += cost;
          gPrice += price;
          (p.lineItems || []).forEach((li) => {
            const b = bucketLine(li);
            if (b && gCostBuckets[b.key] != null) gCostBuckets[b.key] += b.cost;
          });
          galleryList.forEach((gal, gxi) => {
            if (p.buyerCustomerId !== gal.id && p.galleryId !== gal.id && p.location !== gal.id) return;
            if (p.status === "sold") {
              if (p.settled) gGal[gxi].sold += price;
              else gGal[gxi].debt += price;
            } else {
              gGal[gxi].stock += price;
            }
          });
        });

        // ردیف هدر دسته (پررنگ + بولد)
        const catVals = [
          gName,
          "",
          ...COST_COLS.map((c) => gCostBuckets[c.key] || ""),
          gCost || "",
          gPrice || "",
        ];
        galleryList.forEach((_, gxi) => {
          catVals.push(gGal[gxi].stock || "");
          catVals.push(gGal[gxi].sold || "");
          catVals.push(gGal[gxi].debt || "");
        });
        const catRow = ws.addRow(catVals);
        catRow.font = { bold: true, size: 11, color: { argb: "FF111111" } };
        catRow.height = 22;
        catRow.eachCell((cell) => {
          cell.fill = solid(dark);
          cell.alignment = { horizontal: "center", vertical: "middle" };
        });
        catRow.getCell(1).alignment = { horizontal: "right" };
        for (let i = 3; i <= 4 + COST_COLS.length; i++) {
          if (catRow.getCell(i).value) catRow.getCell(i).numFmt = money;
        }
        galleryList.forEach((_, gxi) => {
          const base = 5 + COST_COLS.length + gxi * 3;
          for (let k = 0; k < 3; k++) {
            if (catRow.getCell(base + k).value) catRow.getCell(base + k).numFmt = money;
          }
        });

        // محصولات
        list.forEach((p) => {
          const buckets = {};
          COST_COLS.forEach((c) => { buckets[c.key] = 0; });
          (p.lineItems || []).forEach((li) => {
            const b = bucketLine(li);
            if (b && buckets[b.key] != null) buckets[b.key] += b.cost;
          });
          const cost = toNum(p.totalCost);
          const price = p.discountedPrice != null ? toNum(p.discountedPrice) : toNum(p.salePrice);
          const dims = formatDims(p);

          // گالری متصل
          let linkedGalIdx = -1;
          galleryList.forEach((gal, gxi) => {
            if (p.buyerCustomerId === gal.id || p.galleryId === gal.id || p.location === gal.id) linkedGalIdx = gxi;
          });

          const rowVals = [
            p.name || "",
            dims,
            ...COST_COLS.map((c) => buckets[c.key] || ""),
            cost || "",
            price || "",
          ];
          galleryList.forEach((gal, gxi) => {
            const linked = linkedGalIdx === gxi;
            if (!linked) {
              rowVals.push("");
              rowVals.push("");
              rowVals.push("");
              return;
            }
            if (p.status === "sold") {
              rowVals.push(""); // موجود نه
              if (p.settled) {
                rowVals.push(price || 0);
                rowVals.push("");
              } else {
                rowVals.push("");
                rowVals.push(price || 0);
              }
            } else {
              rowVals.push(1); // موجود
              rowVals.push("");
              rowVals.push("");
            }
          });

          const r = ws.addRow(rowVals);
          r.font = { bold: true, size: 10 }; // نام محصول بولد
          // رنگ پس‌زمینه دسته (کمرنگ)
          r.eachCell((cell) => { cell.fill = solid(light); });

          // ردیف فروش‌رفته سیاه / تسویه‌نشده قرمز / موجود رنگ گالری
          if (p.status === "sold") {
            if (p.settled) {
              r.eachCell((cell) => {
                cell.fill = solid("FF222222");
                cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
              });
            } else {
              r.eachCell((cell) => {
                cell.fill = solid("FFB71C1C");
                cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
              });
            }
          } else if (linkedGalIdx >= 0) {
            const gColor = (galleryList[linkedGalIdx].color || "#888888").replace("#", "");
            const argb = gColor.length === 6 ? `FF${gColor}` : light;
            // فقط ستون‌های گالری همان رنگ؛ بدنه دسته کمرنگ بماند
            const base = 5 + COST_COLS.length + linkedGalIdx * 3;
            for (let k = 0; k < 3; k++) {
              r.getCell(base + k).fill = solid(argb);
            }
            // ردیف کامل هم کمی رنگ گالری بگیرد
            r.eachCell((cell) => {
              if (!cell.fill || cell.fill.fgColor?.argb === light) {
                // mix: keep light category
              }
            });
            r.eachCell((cell) => { cell.fill = solid(argb.length === 8 ? argb : light); });
          }

          for (let i = 3; i <= 4 + COST_COLS.length; i++) {
            if (r.getCell(i).value) r.getCell(i).numFmt = money;
          }
          galleryList.forEach((_, gxi) => {
            const base = 5 + COST_COLS.length + gxi * 3;
            for (let k = 1; k < 3; k++) {
              if (r.getCell(base + k).value && r.getCell(base + k).value !== 1) {
                r.getCell(base + k).numFmt = money;
              }
            }
          });

          // outline برای جمع‌شدن هزینه‌ها (نام و ابعاد و قیمت فروش باز بمانند)
          r.outlineLevel = 1;
        });
      });

      // ── شیت متریال ──
      const wsM = wb.addWorksheet("متریال", { views: [{ rightToLeft: true }] });
      wsM.addRow(["ساخته شده", "هزینه ساخت", "خرید شده", "قیمت خرید", "ابزار ثابت", "قیمت ابزار"]);
      const mh = wsM.getRow(1);
      mh.font = { bold: true, color: { argb: "FFFFFFFF" } };
      mh.eachCell((c) => { c.fill = solid("FF2a2a2a"); c.alignment = { horizontal: "center" }; });
      wsM.columns = [{ width: 28 }, { width: 14 }, { width: 28 }, { width: 14 }, { width: 22 }, { width: 14 }];

      const made = [], bought = [], tools = [];
      (data.materials || []).forEach((m) => {
        const cost = toNum(m.totalCost);
        const row = { name: m.name || "", cost };
        if (m.type === "fixed" || m.isHardware) tools.push(row);
        else if (m.type === "fabric" || m.type === "made") made.push(row);
        else bought.push(row);
      });
      const maxR = Math.max(made.length, bought.length, tools.length, 1);
      for (let i = 0; i < maxR; i++) {
        const r = wsM.addRow([
          made[i]?.name || "",
          made[i] ? made[i].cost : "",
          bought[i]?.name || "",
          bought[i] ? bought[i].cost : "",
          tools[i]?.name || "",
          tools[i] ? tools[i].cost : "",
        ]);
        [2, 4, 6].forEach((ci) => { if (r.getCell(ci).value) r.getCell(ci).numFmt = money; });
      }

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      await saveFile(blob, `Refarsh_Preview_${todayISO()}.xlsx`);
      notify("فایل پیش‌نمایش گرافیکی ساخته و دانلود شد");
    } catch (err) {
      console.error(err);
      notify("خطا در ساخت پیش‌نمایش اکسل");
    }
  }, [productTotals, data, notify]);


  // ── ایمپورت اکسل جدید ──
  const handleImportExcel = useCallback((e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: "array" });
        // آیتم ۲: قبلاً یه خطای کوچیک توی هر بخش (مثلاً یه JSON خراب توی یه
        // سلول) کل ایمپورت رو با یه پیام ثابت و بی‌فایده متوقف می‌کرد. الان هر
        // بخش (مشتریان/متریال/محصولات/جلسات) جدا try/catch می‌شه؛ اگه یکی
        // خراب بود، بقیه‌ی بخش‌ها همچنان ایمپورت می‌شن و در پایان دقیقاً گفته
        // می‌شه کدوم شیت مشکل داشت، به‌جای شکست کامل و کور
        const sectionErrors = [];

        // Find Sheets by Name or fallback to Indices
        let productsSheet = null;
        let materialsSheet = null;
        let sessionsSheet = null;
        let customersSheet = null;
        let productTypesSheet = null;
        let invoiceDraftsSheet = null;
        let businessCardsSheet = null;
        let equipmentSheet = null;
        let workshopLinksSheet = null;
        let auditLogSheet = null;

        wb.SheetNames.forEach((name) => {
          if (name.includes("انواع")) productTypesSheet = wb.Sheets[name];
          else if (name.includes("پیش‌نویس") || name.includes("پيش‌نويس") || name.includes("پیش نویس")) invoiceDraftsSheet = wb.Sheets[name];
          else if (name.includes("کارت")) businessCardsSheet = wb.Sheets[name];
          else if (name.includes("تجهیز")) equipmentSheet = wb.Sheets[name];
          else if (name.includes("کارگاه") || name.includes("لینک")) workshopLinksSheet = wb.Sheets[name];
          else if (name.includes("ردپا") || name.includes("audit")) auditLogSheet = wb.Sheets[name];
          else if (name.includes("محصول")) productsSheet = wb.Sheets[name];
          else if (name.includes("متریال")) materialsSheet = wb.Sheets[name];
          else if (name.includes("برش")) sessionsSheet = wb.Sheets[name];
          else if (name.includes("مشتری") || name.includes("گالری")) customersSheet = wb.Sheets[name];
        });

        if (!productsSheet && wb.SheetNames[0]) productsSheet = wb.Sheets[wb.SheetNames[0]];
        if (!materialsSheet && wb.SheetNames[1]) materialsSheet = wb.Sheets[wb.SheetNames[1]];
        if (!sessionsSheet && wb.SheetNames[2]) sessionsSheet = wb.Sheets[wb.SheetNames[2]];
        if (!customersSheet && wb.SheetNames[3]) customersSheet = wb.Sheets[wb.SheetNames[3]];

        // ── ۱. پردازش مشتریان و گالری‌ها (Dependency #1) ──
        const importedCustomers = [];
        try {
        if (customersSheet) {
          const custRows = XLSX.utils.sheet_to_json(customersSheet, { header: 1, defval: "" });
          custRows.forEach((row, idx) => {
            if (idx === 0) return;
            const id = String(row[0] || "").trim();
            const name = String(row[1] || "").trim();
            if (!name) return;

            let parsedCust = null;
            if (row[8]) {
              try { parsedCust = JSON.parse(row[8]); } catch (_) {}
            }

            if (parsedCust && parsedCust.id) {
              importedCustomers.push({
                ...parsedCust,
                updatedAt: parsedCust.updatedAt || (row[9] !== "" ? toNum(row[9]) : null)
              });
            } else {
              importedCustomers.push({
                id: id || uid(),
                name,
                galleryOwnerName: String(row[2] || "").trim(),
                phone: String(row[3] || "").trim(),
                kind: (row[4] === "گالری" || row[4] === "gallery") ? "gallery" : "customer",
                color: String(row[5] || "").trim() || GALLERY_COLOR_PALETTE[importedCustomers.length % GALLERY_COLOR_PALETTE.length],
                note: String(row[6] || "").trim(),
                updatedAt: row[9] !== "" ? toNum(row[9]) : null
              });
            }
          });
        }
        } catch (sectionErr) {
          console.error("import: مشتریان/گالری‌ها", sectionErr);
          sectionErrors.push(`مشتریان/گالری‌ها: ${sectionErr?.message || sectionErr}`);
        }

        // ── ۲. پردازش متریال‌ها (Dependency #2) ──
        const importedMaterials = [];
        try {
        if (materialsSheet) {
          const matRows = XLSX.utils.sheet_to_json(materialsSheet, { header: 1, defval: "" });
          matRows.forEach((row, idx) => {
            if (idx === 0) return;
            const id = String(row[0] || "").trim();
            const name = String(row[1] || "").trim();
            if (!name) return;

            let batches = [];
            let sticks = [];
            let procurements = [];
            let linkedProductIds = [];

            // 🔴 نکته‌ی مهم (باگ واقعی که import رو کلاً می‌ترکوند، fixed شد):
            // ستون‌های «قدمت (سال)» و «طرح فرش» بین «تاریخ خرید» و «بچ‌های شارژ شده»
            // به اکسپورت اضافه شده بودن (index ۱۷ و ۱۸)، ولی اینجا هنوز با اندیس قدیمی
            // (بدون این ۲ ستون) خونده می‌شد — یعنی row[17] که قبلاً batches بود، الان
            // «قدمت» (یه عدد، مثلاً 50) بود. JSON.parse(50) بدون خطا عدد ۵۰ برمی‌گردوند
            // (نه آرایه)، و خط بعدی `(batches || []).map(...)` روی یه عدد صدا زده می‌شد
            // → TypeError خام که کل import رو (نه فقط همون متریال) می‌ترکوند، چون این
            // forEach توی try/catch جداگونه نبود. با فایل بک‌آپ واقعی تست شد: دقیقاً
            // همون ۱۰ متریال فرش‌دار (که «قدمت» پر داشتن) باعث کرش می‌شدن.
            if (row[19]) {
              try {
                batches = JSON.parse(row[19]);
                if (Array.isArray(batches)) {
                  batches = batches.map(b => {
                    const bQty = Math.max(1, toNum(b.qty) || 1);
                    const bTotalCost = toNum(b.totalCost);
                    const bUnitPrice = b.unitPrice != null && toNum(b.unitPrice) > 0
                      ? toNum(b.unitPrice)
                      : (bQty > 0 && bTotalCost > 0 ? Math.round(bTotalCost / bQty) : null);
                    const bConsumedQty = b.consumedQty != null ? toNum(b.consumedQty) : 0;
                    const bConsumedCost = bQty > 0 ? (bConsumedQty / bQty) * bTotalCost : 0;
                    const bRemainingCost = Math.max(0, bTotalCost - bConsumedCost);
                    return {
                      ...b,
                      id: b.id || uid(),
                      qty: bQty,
                      unitPrice: bUnitPrice,
                      totalCost: bTotalCost,
                      remainingCost: bRemainingCost,
                      date: b.date || null,
                      locked: !!b.locked,
                      linkedProductIds: Array.isArray(b.linkedProductIds) ? b.linkedProductIds : [],
                    };
                  });
                } else {
                  batches = [];
                }
              } catch (_) {} 
            }
            if (row[20]) {
              try {
                sticks = JSON.parse(row[20]);
                if (Array.isArray(sticks)) {
                  sticks = sticks.map((s) => {
                    const sQty = Math.max(1, toNum(s.qty) || 1);
                    const sTotal = s.totalCost != null ? toNum(s.totalCost) : null;
                    const sUnit = s.unitPrice != null && toNum(s.unitPrice) > 0
                      ? toNum(s.unitPrice)
                      : (sTotal != null && sQty > 0 ? Math.round(sTotal / sQty) : null);
                    return {
                      ...s,
                      id: s.id || uid(),
                      length: toNum(s.length),
                      qty: sQty,
                      unitPrice: sUnit,
                      totalCost: sTotal,
                      date: s.date || null,
                    };
                  });
                } else {
                  sticks = [];
                }
              } catch (_) {}
            }
            if (row[21]) {
              try {
                procurements = JSON.parse(row[21]);
                if (Array.isArray(procurements)) {
                  procurements = procurements.map((pr) => {
                    const prQty = Math.max(1, toNum(pr.qty) || 1);
                    const prTotal = toNum(pr.total);
                    const prUnit = pr.unitPrice != null && toNum(pr.unitPrice) > 0
                      ? toNum(pr.unitPrice)
                      : (prQty > 0 && prTotal > 0 ? Math.round(prTotal / prQty) : null);
                    return {
                      ...pr,
                      id: pr.id || uid(),
                      qty: prQty,
                      total: prTotal,
                      unitPrice: prUnit,
                      date: pr.date || null,
                    };
                  });
                } else {
                  procurements = [];
                }
              } catch (_) {}
            }
            if (row[22]) { try { const p = JSON.parse(row[22]); linkedProductIds = Array.isArray(p) ? p : []; } catch (_) {} }

            const purchaseQty = row[4] !== "" ? toNum(row[4]) : 1;
            const unitCost = row[5] !== "" ? toNum(row[5]) : toNum(row[6]);
            const totalCost = toNum(row[6]);
            const consumedQty = row[7] !== "" ? toNum(row[7]) : 0;
            const consumedCost = purchaseQty > 0 ? (consumedQty / purchaseQty) * totalCost : 0;
            const calculatedRemainingCost = Math.max(0, totalCost - consumedCost);
            const matType = String(row[2] || "purchased").trim();
            const dimW = row[8] !== "" ? toNum(row[8]) : null;
            const dimH = row[9] !== "" ? toNum(row[9]) : null;
            const purchaseDate = row[16] ? String(row[16]).trim() : null;

            // مهاجرت: مساحتی/فرش بدون بچ → بچ اولیه از ابعاد/هزینه
            if ((matType === "area" || matType === "fabric") && (!batches || batches.length === 0) && (dimW > 0 || dimH > 0 || totalCost > 0)) {
              const bQty = Math.max(1, purchaseQty || 1);
              batches = [{
                id: uid(),
                label: "خرید اولیه",
                width: dimW || 0,
                height: dimH || 0,
                qty: bQty,
                unitPrice: bQty > 0 ? Math.round(totalCost / bQty) : totalCost,
                totalCost,
                date: purchaseDate || null,
                locked: false,
                linkedProductIds: [],
              }];
            }
            // مهاجرت: خطی بدون شاخه → یک شاخه از طول واحد
            if (matType === "linear" && (!sticks || sticks.length === 0)) {
              const ul = row[10] !== "" ? toNum(row[10]) : 0;
              if (ul > 0 || purchaseQty > 0) {
                sticks = [{
                  id: uid(),
                  length: ul || 0,
                  qty: Math.max(1, purchaseQty || 1),
                  unitPrice: unitCost || null,
                  totalCost: totalCost || null,
                  date: purchaseDate || null,
                }];
              }
            }
            // تاریخ خالی بچ/چوب را از تاریخ خرید متریال پر کن
            if (purchaseDate) {
              batches = (batches || []).map((b) => ({ ...b, date: b.date || purchaseDate }));
              sticks = (sticks || []).map((s) => ({ ...s, date: s.date || purchaseDate }));
            }

            // ── فرش: قدمت و طرح — الان ستون اختصاصی دارن (۱۷ و ۱۸)، اولویت با اون‌هاست؛
            // فقط اگه خالی بودن (بک‌آپ قدیمی‌تر از این فیچر) از روی نام حدس زده می‌شه
            let ageYears = row[17] !== "" && row[17] != null ? toNum(row[17]) : null;
            let pattern = row[18] ? String(row[18]).trim() : null;
            if (ageYears == null) {
              const ageMatch = String(name || "").match(/(\d+)\s*ساله/);
              if (ageMatch) ageYears = toNum(ageMatch[1]);
            }
            if (!pattern) {
              const patMatch = String(name || "").match(/طرح\s*([^)٬،\d]+?)(?:\s*[)٬،\d]|$)/);
              if (patMatch) pattern = String(patMatch[1]).trim().replace(/\s+/g, " ");
            }

            // تکمیل unitPrice و pattern روی بچ‌ها
            batches = (batches || []).map((b) => {
              const bQty = Math.max(1, toNum(b.qty) || 1);
              const bTotal = toNum(b.totalCost);
              let bUnit = b.unitPrice != null && b.unitPrice !== "" ? toNum(b.unitPrice) : null;
              if (bUnit == null || bUnit === 0) {
                bUnit = bQty > 0 && bTotal > 0 ? Math.round(bTotal / bQty) : (unitCost || null);
              }
              return {
                ...b,
                qty: bQty,
                unitPrice: bUnit,
                totalCost: bTotal || (bUnit != null ? bUnit * bQty : 0),
                pattern: b.pattern || pattern || null,
                ageYears: b.ageYears != null ? b.ageYears : ageYears,
              };
            });

            importedMaterials.push({
              id: id || uid(),
              name,
              type: matType,
              category: String(row[3] || "").trim(),
              purchaseQty,
              unitCost,
              totalCost,
              dimW,
              dimH,
              unitLength: row[10] !== "" ? toNum(row[10]) : null,
              ratioValue: matType === "ratio" ? toNum(row[11]) : null,
              fixedQty: matType === "fixed" ? toNum(row[11]) : null,
              defaultPct: row[12] !== "" ? toNum(row[12]) : 100,
              isHardwareTool: row[13] === "بله" || row[13] === true,
              includeInCost: row[14] !== "خیر" && row[14] !== false,
              hidden: row[15] === "بله" || row[15] === true,
              purchaseDate,
              ageYears: matType === "fabric" ? ageYears : null,
              pattern: matType === "fabric" ? (pattern || null) : null,
              batches,
              sticks,
              procurements,
              linkedProductIds,
              updatedAt: row[23] !== "" ? toNum(row[23]) : null,
              remainingCost: row[24] !== "" && row[24] != null && typeof row[24] === "number" ? toNum(row[24]) : calculatedRemainingCost,
              totalQty: row[25] !== "" && row[25] != null && typeof row[25] === "number" ? toNum(row[25]) : purchaseQty,
              remainingQty: row[26] !== "" && row[26] != null && typeof row[26] === "number" ? toNum(row[26]) : Math.max(0, purchaseQty - consumedQty),
              creditAllowed: row[27] !== "خیر" && row[27] !== false,
              isUsableRemaining: row[28] !== "خیر" && row[28] !== false
            });
          });
        }
        } catch (sectionErr) {
          console.error("import: متریال‌ها", sectionErr);
          sectionErrors.push(`متریال‌ها: ${sectionErr?.message || sectionErr}`);
        }

        // ── ۳. پردازش محصولات (Dependency #3) ──
        const importedProducts = [];
        try {
        if (productsSheet) {
          const prodRows = XLSX.utils.sheet_to_json(productsSheet, { header: 1, defval: "" });
          prodRows.forEach((row, idx) => {
            if (idx === 0) return;
            const id = String(row[0] || "").trim();
            const name = String(row[3] || "").trim();
            if (!name) return;

            let lineItems = [];
            if (row[23]) {
              try {
                lineItems = JSON.parse(row[23]);
                if (Array.isArray(lineItems)) {
                  lineItems = lineItems.map((li) => {
                    li = { ...li, id: li.id || uid() };
                    if (li.materialId) {
                      const mQty = toNum(li.consumedQtyOfMaterial || li.consumedQty || li["تعداد مصرفی از متریال"] || 0);
                      const mPct = toNum(li.pct || 0);
                      const mUnitCost = toNum(li.materialUnitCost || 0);
                      if (mQty > 0 && mPct > 0 && mUnitCost > 0) {
                        li.cost = mQty * (mPct / 100) * mUnitCost;
                      }
                    }
                    return li;
                  });
                }
              } catch (_) {}
            }

            if (!lineItems || lineItems.length === 0) {
              lineItems = DEFAULT_COST_LABELS.map(lbl => ({
                id: uid(),
                label: lbl,
                cost: 0,
                materialId: null,
                pct: null,
                batchId: null,
                useAreaRatio: false,
                includeWastage: false,
                manualArea: null,
                deductedCost: null,
                deductedAt: null,
                woodCuts: null,
                woodLocked: false
              }));
            }

            const locationVal = String(row[9] || "").trim();
            let locationId = "warehouse";
            const linkedCustId = String(row[21] || "").trim();

            if (linkedCustId) {
              locationId = linkedCustId;
            } else if (locationVal && locationVal !== "انبار") {
              const foundCust = importedCustomers.find(c => c.name === locationVal);
              if (foundCust) {
                locationId = foundCust.id;
              }
            }

            const statusVal = String(row[8] || "").trim();
            const status = (statusVal === "فروخته‌شده" || statusVal === "sold") ? "sold" : "available";

            importedProducts.push({
              id: id || uid(),
              code: row[1] !== "" ? toNum(row[1]) : null,
              group: String(row[2] || "").trim(),
              name,
              dims: String(row[4] || "").trim(),
              dimW: row[5] !== "" ? toNum(row[5]) : null,
              dimH: row[6] !== "" ? toNum(row[6]) : null,
              shape: String(row[7] || "rectangle").trim(),
              status,
              location: locationId,
              buyerName: String(row[10] || "").trim(),
              buyerPhone: String(row[11] || "").trim(),
              saleDate: row[12] ? String(row[12]).trim() : null,
              settleDate: row[13] ? String(row[13]).trim() : null,
              settled: row[14] === "تسویه‌شده" || row[14] === "yes" || row[14] === "true",
              discountPercent: row[15] !== "" ? toNum(row[15]) : 0,
              salePrice: row[16] !== "" ? toNum(row[16]) : 0,
              profitPct: row[17] !== "" ? toNum(row[17]) : 30,
              discountedPrice: row[18] !== "" ? toNum(row[18]) : 0,
              totalCost: row[19] !== "" ? toNum(row[19]) : 0,
              fabricCoveragePct: row[20] !== "" ? toNum(row[20]) : 100,
              buyerCustomerId: linkedCustId || null,
              images: row[22] ? String(row[22]).split(",").map(s => s.trim()).filter(Boolean) : [],
              lineItems,
              updatedAt: row[24] !== "" ? toNum(row[24]) : null,
              fabricMaterialId: (() => {
                // اولویت با شناسه مستقیم (داینامیک)؛ در غیر این صورت از نام
                const fabricId = String(row[29] || "").trim();
                if (fabricId) {
                  const byId = importedMaterials.find((m) => m.id === fabricId)
                    || (data.materials || []).find((m) => m.id === fabricId);
                  if (byId) return byId.id;
                  return fabricId; // حتی اگر هنوز در لیست نیست، ID را نگه دار
                }
                const fabricName = String(row[25] || "").trim();
                if (!fabricName) return null;
                const found = importedMaterials.find((m) => m.name === fabricName && m.type === "fabric")
                  || (data.materials || []).find((m) => m.name === fabricName && m.type === "fabric");
                return found ? found.id : null;
              })(),
              isDraft: row[26] === "بله" || row[26] === true,
              productTypeId: (() => {
                const typeId = String(row[30] || "").trim();
                if (typeId) return typeId;
                const typeName = String(row[27] || "").trim();
                if (!typeName) return null;
                const found = (data.productTypes || []).find((t) => t.name === typeName);
                return found ? found.id : null;
              })(),
              description: String(row[28] || "").trim(),
              salePriceManual: row[31] === "بله" || row[31] === true,
              hiddenFromCatalog: row[32] === "بله" || row[32] === true,
              qty: (() => {
                if (row[33] !== "" && row[33] != null) return Math.max(1, toNum(row[33]) || 1);
                // از نام محصول: «(4عدد)» یا «(۳عدد)» یا «4عدد»
                const m = String(name).match(/(\d+)\s*عدد/);
                if (m) return Math.max(1, parseInt(m[1], 10) || 1);
                return 1;
              })(),
              image: String(row[34] || "").trim() || null,
              // ستون ۳۵ (انتهایی، امن) — فایل‌های قدیمی‌تر که این ستون رو
              // ندارن، خودکار false می‌گیرن (Ash 🟡)
              isCalligraphy: row[35] === "بله" || row[35] === true
            });
          });
        }
        } catch (sectionErr) {
          console.error("import: محصولات", sectionErr);
          sectionErrors.push(`محصولات: ${sectionErr?.message || sectionErr}`);
        }

        // ── ۴. پردازش جلسات برش (Dependency #4) ──
        const importedSessions = [];
        try {
        if (sessionsSheet) {
          const sessRows = XLSX.utils.sheet_to_json(sessionsSheet, { header: 1, defval: "" });
          sessRows.forEach((row, idx) => {
            if (idx === 0) return;
            const id = String(row[0] || "").trim();
            if (!id) return;

            let parsedSess = null;
            if (row[6]) {
              try { parsedSess = JSON.parse(row[6]); } catch (_) {}
            }

            if (parsedSess && parsedSess.id) {
              importedSessions.push({
                ...parsedSess,
                updatedAt: parsedSess.updatedAt || (row[7] !== "" ? toNum(row[7]) : null)
              });
            } else {
              let frames = [];
              let stickRows = [];
              let panelRows = [];
              try {
                if (row[3]) frames = JSON.parse(row[3]);
                if (row[4]) stickRows = JSON.parse(row[4]);
                if (row[5]) panelRows = JSON.parse(row[5]);
              } catch (_) {}

              importedSessions.push({
                id,
                title: String(row[1] || "").trim(),
                timestamp: row[2] ? new Date(row[2]).getTime() : Date.now(),
                frames,
                stickRows,
                panelRows,
                updatedAt: row[7] !== "" ? toNum(row[7]) : null
              });
            }
          });
        }
        } catch (sectionErr) {
          console.error("import: جلسات برش", sectionErr);
          sectionErrors.push(`جلسات برش: ${sectionErr?.message || sectionErr}`);
        }

        // کارت‌ویزیت‌ها (+ کارت خودم)
        const importedBusinessCards = [];
        let importedMyBusinessCard = null;
        // تجهیزات
        const importedEquipment = [];
        // لینک‌های کارگاه
        const importedWorkshopLinks = [];
        // ردپای تغییرات
        const importedAuditLog = [];
        // انواع محصول
        const importedProductTypes = [];
        // پیش‌نویس فاکتور
        const importedInvoiceDrafts = [];
        try {
        if (businessCardsSheet) {
          const bcRows = XLSX.utils.sheet_to_json(businessCardsSheet, { header: 1, defval: "" });
          bcRows.forEach((row, idx) => {
            if (idx === 0) return;
            const id = String(row[0] || "").trim();
            const kindLabel = String(row[1] || "").trim();
            let full = null;
            // ستون Raw JSON معمولاً یکی از آخرین‌هاست — جستجو در ردیف
            for (let ci = row.length - 1; ci >= 0; ci--) {
              const cell = row[ci];
              if (typeof cell === "string" && cell.trim().startsWith("{")) {
                try { full = JSON.parse(cell); break; } catch (_) {}
              }
            }
            const card = full && typeof full === "object"
              ? { ...full, id: full.id || id || uid() }
              : {
                  id: id || uid(),
                  name: String(row[2] || "").trim(),
                  phone: String(row[3] || "").trim(),
                  address: String(row[4] || "").trim(),
                  website: String(row[5] || "").trim(),
                  instagram: String(row[6] || "").trim(),
                  linkedin: String(row[7] || "").trim(),
                  telegram: String(row[8] || "").trim(),
                  whatsapp: String(row[9] || "").trim(),
                  email: String(row[10] || "").trim(),
                  note: String(row[11] || "").trim(),
                };
            if (kindLabel.includes("خودم") || card.isMine) {
              importedMyBusinessCard = { ...card, isMine: true };
            } else {
              importedBusinessCards.push({ ...card, isMine: false });
            }
          });
        }

        if (equipmentSheet) {
          const eqRows = XLSX.utils.sheet_to_json(equipmentSheet, { header: 1, defval: "" });
          eqRows.forEach((row, idx) => {
            if (idx === 0) return;
            const id = String(row[0] || "").trim();
            let full = null;
            if (row[1]) { try { full = JSON.parse(row[1]); } catch (_) {} }
            if (full && typeof full === "object") {
              importedEquipment.push({ ...full, id: full.id || id || uid(), updatedAt: full.updatedAt || row[2] || null });
            } else if (id) {
              importedEquipment.push({ id, updatedAt: row[2] || null });
            }
          });
        }

        if (workshopLinksSheet) {
          const wlRows = XLSX.utils.sheet_to_json(workshopLinksSheet, { header: 1, defval: "" });
          wlRows.forEach((row, idx) => {
            if (idx === 0) return;
            const id = String(row[0] || "").trim();
            let full = null;
            if (row[4]) { try { full = JSON.parse(row[4]); } catch (_) {} }
            if (full && typeof full === "object") {
              importedWorkshopLinks.push({
                ...full,
                id: full.id || id || uid(),
                productId: full.productId || String(row[1] || "").trim() || null,
                materialId: full.materialId || String(row[2] || "").trim() || null,
                frameId: full.frameId || String(row[3] || "").trim() || null,
              });
            } else if (id || row[1] || row[2]) {
              importedWorkshopLinks.push({
                id: id || uid(),
                productId: String(row[1] || "").trim() || null,
                materialId: String(row[2] || "").trim() || null,
                frameId: String(row[3] || "").trim() || null,
              });
            }
          });
        }

        if (auditLogSheet) {
          const aRows = XLSX.utils.sheet_to_json(auditLogSheet, { header: 1, defval: "" });
          aRows.forEach((row, idx) => {
            if (idx === 0) return;
            const entityId = String(row[3] || "").trim();
            if (!entityId && !row[0]) return;
            importedAuditLog.push({
              id: uid(),
              date: row[0] || Date.now(),
              entityLabel: String(row[1] || "").trim(),
              entityName: String(row[2] || "").trim(),
              entityId,
              action: String(row[4] || "").trim(),
            });
          });
        }

        if (productTypesSheet) {
          const ptRows = XLSX.utils.sheet_to_json(productTypesSheet, { header: 1, defval: "" });
          ptRows.forEach((row, idx) => {
            if (idx === 0) return;
            const id = String(row[0] || "").trim();
            const name = String(row[1] || "").trim();
            if (!id && !name) return;
            let full = null;
            if (row[2]) { try { full = JSON.parse(row[2]); } catch (_) {} }
            importedProductTypes.push(full && typeof full === "object"
              ? { ...full, id: full.id || id || uid(), name: full.name || name }
              : { id: id || uid(), name });
          });
        }

        if (invoiceDraftsSheet) {
          const invRows = XLSX.utils.sheet_to_json(invoiceDraftsSheet, { header: 1, defval: "" });
          invRows.forEach((row, idx) => {
            if (idx === 0) return;
            const id = String(row[0] || "").trim();
            let full = null;
            if (row[1]) { try { full = JSON.parse(row[1]); } catch (_) {} }
            if (full && typeof full === "object") {
              importedInvoiceDrafts.push({ ...full, id: full.id || id || uid() });
            } else if (id) {
              importedInvoiceDrafts.push({ id, updatedAt: row[2] || null });
            }
          });
        }
        } catch (sectionErr) {
          console.error("import: کارت‌ویزیت/تجهیزات/لینک‌کارگاه/ردپا/انواع‌محصول/پیش‌نویس‌فاکتور", sectionErr);
          sectionErrors.push(`بخش‌های تکمیلی (کارت‌ویزیت/تجهیزات/...): ${sectionErr?.message || sectionErr}`);
        }

        // Set pending state to trigger confirmation dialog rather than wiping database automatically
        setPendingExcelImport({
          products: importedProducts,
          materials: importedMaterials,
          customers: importedCustomers,
          sessions: importedSessions,
          productTypes: importedProductTypes,
          invoiceDrafts: importedInvoiceDrafts,
          businessCards: importedBusinessCards,
          myBusinessCard: importedMyBusinessCard,
          equipment: importedEquipment,
          workshopLinks: importedWorkshopLinks,
          auditLog: importedAuditLog,
        });

        if (sectionErrors.length > 0) {
          // بخش‌هایی که خراب بودن رد شدن ولی بقیه‌ی فایل با موفقیت ایمپورت شد —
          // به‌جای شکست کامل، دقیقاً می‌گیم کدوم بخش(ها) مشکل داشتن
          notify(`ایمپورت با هشدار انجام شد — این بخش(ها) مشکل داشتن و رد شدن: ${sectionErrors.join(" | ")}`);
        }

      } catch (err) {
        console.error(err);
        // آیتم ۲: قبلاً پیام همیشه ثابت و بی‌فایده بود («خطا در بازخوانی فایل
        // اکسل پشتیبان») و متن واقعی خطا فقط توی console.error می‌رفت که روی
        // گوشی/APK اصلاً دیده نمی‌شه — الان خودِ پیام خطا هم توی toast میاد تا
        // بشه فهمید مشکل واقعاً چیه (شیت گم‌شده، فرمت غلط، JSON خراب، ...)
        notify(`خطا در بازخوانی فایل اکسل پشتیبان: ${err?.message || err}`);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  }, [notify, setPendingExcelImport]);

  const handleExecuteExcelMerge = useCallback((pendingData) => {
    if (!pendingData) return;
    try {
      const {
        products: importedProducts = [],
        materials: importedMaterials = [],
        customers: importedCustomers = [],
        sessions: importedSessions = [],
        productTypes: importedProductTypes = [],
        invoiceDrafts: importedInvoiceDrafts = [],
        businessCards: importedBusinessCards = [],
        myBusinessCard: importedMyBusinessCard = null,
        equipment: importedEquipment = [],
        workshopLinks: importedWorkshopLinks = [],
        auditLog: importedAuditLog = [],
      } = pendingData;

      setData((current) => {
        const customerIdMap = new Map();
        const materialIdMap = new Map();
        const productIdMap = new Map();
        const sessionIdMap = new Map();

        // ── ۱. ادغام مشتریان و شناسایی تداخل ──
        const currentCustomers = current.customers || [];
        const finalCustomers = [...currentCustomers];

        importedCustomers.forEach((imp) => {
          const matched = currentCustomers.find(
            (c) => c.id === imp.id || (c.name === imp.name && c.kind === imp.kind)
          );

          if (matched) {
            customerIdMap.set(imp.id, matched.id);
            const existingTime = matched.updatedAt || 0;
            const importedTime = imp.updatedAt || 0;
            if (importedTime >= existingTime) {
              const idx = finalCustomers.findIndex(c => c.id === matched.id);
              if (idx > -1) {
                finalCustomers[idx] = { ...matched, ...imp, id: matched.id };
              }
            }
          } else {
            const newId = uid();
            customerIdMap.set(imp.id, newId);
            finalCustomers.push({ ...imp, id: newId });
          }
        });

        // ── ۲. ادغام متریال‌ها و شناسایی تداخل ──
        const currentMaterials = current.materials || [];
        const finalMaterials = [...currentMaterials];

        importedMaterials.forEach((imp) => {
          const matched = currentMaterials.find(
            (m) => m.id === imp.id || (m.name === imp.name && m.type === imp.type)
          );

          if (matched) {
            materialIdMap.set(imp.id, matched.id);
            const existingTime = matched.updatedAt || 0;
            const importedTime = imp.updatedAt || 0;
            if (importedTime >= existingTime) {
              const idx = finalMaterials.findIndex(m => m.id === matched.id);
              if (idx > -1) {
                finalMaterials[idx] = { ...matched, ...imp, id: matched.id };
              }
            }
          } else {
            const newId = uid();
            materialIdMap.set(imp.id, newId);
            finalMaterials.push({ ...imp, id: newId });
          }
        });

        // ── ۳. ادغام محصولات و شناسایی تداخل ──
        const currentProducts = current.products || [];
        const finalProducts = [...currentProducts];

        importedProducts.forEach((imp) => {
          const matched = currentProducts.find(
            (p) => p.id === imp.id || (p.code != null && p.code === imp.code) || (p.name === imp.name && p.group === imp.group)
          );

          if (matched) {
            productIdMap.set(imp.id, matched.id);
            const existingTime = matched.updatedAt || 0;
            const importedTime = imp.updatedAt || 0;
            if (importedTime >= existingTime) {
              const idx = finalProducts.findIndex(p => p.id === matched.id);
              if (idx > -1) {
                finalProducts[idx] = { ...matched, ...imp, id: matched.id };
              }
            }
          } else {
            const newId = uid();
            productIdMap.set(imp.id, newId);
            finalProducts.push({ ...imp, id: newId });
          }
        });

        // ── ۴. ادغام جلسات برش ──
        const currentSessions = current.woodCuttingSessions || [];
        const finalSessions = [...currentSessions];

        importedSessions.forEach((imp) => {
          const matched = currentSessions.find(
            (s) => s.id === imp.id || s.title === imp.title
          );

          if (matched) {
            sessionIdMap.set(imp.id, matched.id);
            const existingTime = matched.updatedAt || matched.timestamp || 0;
            const importedTime = imp.updatedAt || imp.timestamp || 0;
            if (importedTime >= existingTime) {
              const idx = finalSessions.findIndex(s => s.id === matched.id);
              if (idx > -1) {
                finalSessions[idx] = { ...matched, ...imp, id: matched.id };
              }
            }
          } else {
            const newId = uid();
            sessionIdMap.set(imp.id, newId);
            finalSessions.push({ ...imp, id: newId });
          }
        });

        // ── ۵. بازسازی و اصلاح روابط (Link Re-establishment based on ID mapping) ──
        const updatedProducts = finalProducts.map((p) => {
          let updatedP = { ...p };
          
          if (updatedP.buyerCustomerId && customerIdMap.has(updatedP.buyerCustomerId)) {
            updatedP.buyerCustomerId = customerIdMap.get(updatedP.buyerCustomerId);
          }
          
          if (updatedP.location && customerIdMap.has(updatedP.location)) {
            updatedP.location = customerIdMap.get(updatedP.location);
          }

          if (updatedP.fabricMaterialId && materialIdMap.has(updatedP.fabricMaterialId)) {
            updatedP.fabricMaterialId = materialIdMap.get(updatedP.fabricMaterialId);
          }

          if (updatedP.lineItems && Array.isArray(updatedP.lineItems)) {
            updatedP.lineItems = updatedP.lineItems.map((li) => {
              let updatedLi = { ...li };
              if (updatedLi.materialId && materialIdMap.has(updatedLi.materialId)) {
                updatedLi.materialId = materialIdMap.get(updatedLi.materialId);
              }
              
              // Recalculate cost based on the formula: (تعداد مصرفی × (درصد مصرف / 100) × قیمت هر واحد متریال)
              if (updatedLi.materialId) {
                const targetMat = finalMaterials.find((m) => m.id === updatedLi.materialId);
                if (targetMat) {
                  const mQty = toNum(targetMat.purchaseQty || updatedLi.consumedQtyOfMaterial || updatedLi.consumedQty || updatedLi["تعداد مصرفی از متریال"] || 0);
                  const mPct = toNum(updatedLi.pct || 0);
                  const mUnitCost = toNum(targetMat.unitCost || updatedLi.materialUnitCost || 0);
                  if (mQty > 0 && mPct > 0 && mUnitCost > 0) {
                    updatedLi.cost = mQty * (mPct / 100) * mUnitCost;
                  }
                }
              }
              return updatedLi;
            });
          }

          return updatedP;
        });

        const updatedMaterials = finalMaterials.map((m) => {
          let updatedM = { ...m };
          if (updatedM.linkedProductIds && Array.isArray(updatedM.linkedProductIds)) {
            updatedM.linkedProductIds = updatedM.linkedProductIds.map((pId) => {
              return productIdMap.get(pId) || pId;
            });
          }
          return updatedM;
        });

        // انواع محصول — ادغام بر اساس ID
        const currentTypes = current.productTypes || [];
        const finalTypes = [...currentTypes];
        (importedProductTypes || []).forEach((imp) => {
          const matched = currentTypes.find((t) => t.id === imp.id || t.name === imp.name);
          if (matched) {
            const idx = finalTypes.findIndex((t) => t.id === matched.id);
            if (idx > -1) finalTypes[idx] = { ...matched, ...imp, id: matched.id };
          } else {
            finalTypes.push({ ...imp, id: imp.id || uid() });
          }
        });

        // پیش‌نویس فاکتور
        const currentInvs = current.invoiceDrafts || [];
        const finalInvs = [...currentInvs];
        (importedInvoiceDrafts || []).forEach((imp) => {
          const matched = currentInvs.find((x) => x.id === imp.id);
          if (matched) {
            const idx = finalInvs.findIndex((x) => x.id === matched.id);
            if (idx > -1) finalInvs[idx] = { ...matched, ...imp, id: matched.id };
          } else {
            finalInvs.push({ ...imp, id: imp.id || uid() });
          }
        });

        // کارت‌ویزیت‌ها
        const currentCards = current.businessCards || [];
        const finalCards = [...currentCards];
        (importedBusinessCards || []).forEach((imp) => {
          const matched = currentCards.find((c) => c.id === imp.id || (c.name && c.name === imp.name));
          if (matched) {
            const idx = finalCards.findIndex((c) => c.id === matched.id);
            if (idx > -1) finalCards[idx] = { ...matched, ...imp, id: matched.id, isMine: false };
          } else {
            finalCards.push({ ...imp, id: imp.id || uid(), isMine: false });
          }
        });
        const finalMyCard = importedMyBusinessCard
          ? { ...(current.myBusinessCard || {}), ...importedMyBusinessCard, isMine: true }
          : current.myBusinessCard;

        // تجهیزات / لینک کارگاه / audit
        const mergeByIdLocal = (curr, incoming) => {
          const out = [...(curr || [])];
          (incoming || []).forEach((imp) => {
            if (!imp) return;
            const matched = out.find((x) => x.id && imp.id && x.id === imp.id);
            if (matched) {
              const idx = out.findIndex((x) => x.id === matched.id);
              if (idx > -1) out[idx] = { ...matched, ...imp, id: matched.id };
            } else {
              out.push({ ...imp, id: imp.id || uid() });
            }
          });
          return out;
        };
        const finalEquipment = mergeByIdLocal(current.equipment, importedEquipment);
        const finalWorkshopLinks = mergeByIdLocal(current.workshopLinks, importedWorkshopLinks).map((w) => ({
          ...w,
          productId: (w.productId && productIdMap.has(w.productId)) ? productIdMap.get(w.productId) : w.productId,
          materialId: (w.materialId && materialIdMap.has(w.materialId)) ? materialIdMap.get(w.materialId) : w.materialId,
        }));
        const finalAudit = [...(importedAuditLog || []), ...(current.auditLog || [])]
          .filter((entry, i, arr) => entry && arr.findIndex((e) => e.id === entry.id) === i)
          .slice(0, 300);

        return {
          ...current,
          customers: finalCustomers,
          materials: updatedMaterials,
          products: updatedProducts,
          woodCuttingSessions: finalSessions,
          productTypes: finalTypes,
          invoiceDrafts: finalInvs,
          businessCards: finalCards,
          myBusinessCard: finalMyCard,
          equipment: finalEquipment,
          workshopLinks: finalWorkshopLinks,
          auditLog: finalAudit,
        };
      });

      notify(`✓ ادغام هوشمند موفقیت‌آمیز بود: شامل ${importedProducts.length} محصول، ${importedMaterials.length} متریال، ${importedCustomers.length} مشتری و ${importedSessions.length} جلسه برش.`);
      setPendingExcelImport(null);
    } catch (err) {
      console.error(err);
      notify("خطا در ادغام فایل اکسل پشتیبان");
    }
  }, [setData, notify]);

  const handleExecuteExcelReplace = useCallback((pendingData) => {
    if (!pendingData) return;
    try {
      const {
        products = [],
        materials = [],
        customers = [],
        sessions = [],
        productTypes = [],
        invoiceDrafts = [],
        businessCards = [],
        myBusinessCard = null,
        equipment = [],
        workshopLinks = [],
        auditLog = [],
      } = pendingData;
      setData((d) => {
        return {
          ...d,
          products,
          materials,
          customers,
          woodCuttingSessions: sessions,
          productTypes: productTypes.length ? productTypes : (d.productTypes || []),
          invoiceDrafts: invoiceDrafts.length ? invoiceDrafts : (d.invoiceDrafts || []),
          businessCards: businessCards.length ? businessCards : (d.businessCards || []),
          myBusinessCard: myBusinessCard || d.myBusinessCard,
          equipment: equipment.length ? equipment : (d.equipment || []),
          workshopLinks: workshopLinks.length ? workshopLinks : (d.workshopLinks || []),
          auditLog: auditLog.length ? auditLog : (d.auditLog || []),
        };
      });
      notify(`✓ بازگردانی کامل با موفقیت انجام شد: ${products.length} محصول، ${materials.length} متریال، ${customers.length} مشتری و ${sessions.length} جلسه برش بارگذاری شد.`);
      setPendingExcelImport(null);
    } catch (err) {
      console.error(err);
      notify("خطا در اعمال فایل اکسل پشتیبان");
    }
  }, [setData, notify]);
  const handleExportJson = useCallback(async () => {
    try {
      const payload = {
        ...data,
        myBusinessCard: data.myBusinessCard || myBusinessCard,
        businessCards: data.businessCards || businessCards,
        __exportedAt: new Date().toISOString(),
        __schemaVersion: SCHEMA_VERSION,
        __appVersion: APP_VERSION,
        __storageKey: STORAGE_KEY
      };
      
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      await saveFile(blob, `refarsh-backup-${todayISO()}.json`);
      notify("بکاپ کامل JSON با موفقیت ساخته و دانلود شد");
    } catch (err) {
      console.error("Export JSON error:", err);
      notify("خطا در ساخت بکاپ کامل JSON");
    }
  }, [data, myBusinessCard, businessCards, notify]);

  const handleImportJson = useCallback((e) => {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = (ev) => {
      try {
        const incoming = JSON.parse(ev.target.result);
        if (!incoming.products && !incoming.materials) { notify("فایل بکاپ معتبر نیست"); return; }
        setData((d) => {
          const mergedProducts = mergeById(d.products, incoming.products || [], { replaceArrays: true });
          const finalProducts = [], usedCodes = new Set();
          let maxCode = mergedProducts.reduce((m, p) => Math.max(m, toNum(p.code)), 0);
          let prodAdded = 0, prodUpdated = 0;
          mergedProducts.forEach((p) => {
            let code = p.code;
            if (!code || usedCodes.has(code)) { maxCode++; code = maxCode; }
            usedCodes.add(code);
            finalProducts.push({ ...p, code });
          });
          const oldIds = new Set(d.products.map((p) => p.id));
          finalProducts.forEach((p) => { if (oldIds.has(p.id)) prodUpdated++; else prodAdded++; });
          const mergedCustomers = mergeById(d.customers || [], incoming.customers || []);
          const custAdded = mergedCustomers.length - (d.customers || []).length;
          const mergedMaterials = mergeById(d.materials, incoming.materials || []);
          const matAdded = mergedMaterials.length - d.materials.length;
          const parts = [];
          if (prodAdded > 0) parts.push(`${prodAdded} محصول جدید`);
          if (prodUpdated > 0) parts.push(`${prodUpdated} محصول بروز`);
          if (custAdded > 0) parts.push(`${custAdded} مشتری جدید`);
          if (matAdded > 0) parts.push(`${matAdded} متریال جدید`);
          setTimeout(() => notify(parts.length ? `وارد شد: ${parts.join(" · ")}` : "بدون تغییر جدید"), 100);
          const mergedBusinessCards = mergeById(d.businessCards || [], incoming.businessCards || []);
          const mergedSessions = mergeById(d.woodCuttingSessions || [], incoming.woodCuttingSessions || []);
          const mergedAuditLog = [...(incoming.auditLog || []), ...(d.auditLog || [])]
            .filter((entry, idx, arr) => arr.findIndex((e) => e.id === entry.id) === idx)
            .sort((a, b) => (b.date || 0) - (a.date || 0))
            .slice(0, 300);
          return {
            ...d,
            products: finalProducts,
            materials: mergedMaterials,
            customers: mergedCustomers,
            equipment: mergeById(d.equipment || [], incoming.equipment || []),
            workshopLinks: mergeById(d.workshopLinks || [], incoming.workshopLinks || []),
            businessCards: mergedBusinessCards,
            myBusinessCard: d.myBusinessCard?.name ? d.myBusinessCard : (incoming.myBusinessCard || d.myBusinessCard),
            woodCuttingSessions: mergedSessions,
            auditLog: mergedAuditLog,
            productTypes: mergeById(d.productTypes || [], incoming.productTypes || []),
            invoiceDrafts: mergeById(d.invoiceDrafts || [], incoming.invoiceDrafts || []),
          };
        });
      } catch { notify("فایل بکاپ معتبر نیست"); }
    };
    r.readAsText(f);
    e.target.value = "";
  }, [notify]);

  const nextCode = useMemo(() => data.products.reduce((m, p) => Math.max(m, toNum(p.code)), 0) + 1, [data.products]);

  const handleManagementPanel = useCallback(() => setShowManagementPanel(true), []);
  const handleExitPanel = useCallback(() => { setShowManagementPanel(false); setActiveTab("catalog"); }, []);

  const handleSaveWoodCuttingSession = useCallback((state) => {
    const hasValidFrame = state.frames?.some(f => f.w && toNum(f.w) > 0);
    const hasValidSticks = state.stickRows && state.stickRows.length > 0;
    const hasValidPanels = state.panelRows && state.panelRows.length > 0;

    if (!hasValidFrame && !hasValidSticks && !hasValidPanels) {
      notify("جلسه خالی قابل ذخیره نیست");
      return;
    }
    setData((d) => ({
      ...d,
      woodCuttingSessions: [...(d.woodCuttingSessions || []), { id: uid(), ...state, timestamp: Date.now() }]
    }));
    notify("جلسه ذخیره شد");
  }, [notify]);

  const handleDeleteWoodCuttingSession = useCallback((sessionId) => {
    setData((d) => ({
      ...d,
      woodCuttingSessions: (d.woodCuttingSessions || []).filter(s => s.id !== sessionId)
    }));
    notify("جلسه حذف شد");
  }, [notify]);

  const handleExportWoodCutting = useCallback((type) => {
    notify(`در حال خروجی ${type === 'image' ? 'تصویر' : 'PDF'}...`);
  }, [notify]);

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#F5F0EB", fontFamily: "'Vazirmatn','Tahoma','Arial',sans-serif" }} dir="rtl">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;} body{margin:0;background:#0a0a0a;}
        input[type=number]::-webkit-inner-spin-button,input[type=number]::-webkit-outer-spin-button{opacity:.35;}
        input[type=range]{-webkit-appearance:none;appearance:none;height:4px;border-radius:4px;background:#2a2a2a;outline:none;}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:16px;height:16px;border-radius:50%;background:#8B1A1A;cursor:pointer;}
        ::-webkit-scrollbar{width:3px;height:3px;} ::-webkit-scrollbar-track{background:transparent;} ::-webkit-scrollbar-thumb{background:#2a2a2a;border-radius:3px;}
        select{-webkit-appearance:none;appearance:none;}
        @keyframes refarshSpin{to{transform:rotate(360deg)}}
        @keyframes pulseDot{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.35)}}
        @keyframes iconSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
      `}</style>

      <GlobalHeader
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        hasPending={hasPendingMaterialChanges}
        onQuickRefresh={handleQuickRefresh}
        onHoldRefresh={handleHoldRefresh}
        onUndoRefresh={handleUndoRefresh}
        onResetFilters={handleResetFilters}
        refreshProblemTabs={refreshProblemTabs}
        workshopLinks={data.workshopLinks || []}
        onLinksChange={(links) => setData((d) => ({ ...d, workshopLinks: links }))}
        onManagementPanel={handleManagementPanel}
        basket={basket}
        onToggleBasket={toggleBasket}
        basketCount={basket.length}
        myBusinessCard={myBusinessCard}
        businessCards={businessCards}
        onSaveBusinessCards={handleSaveBusinessCards}
        isInstallable={isInstallable}
        onInstall={handleInstallApp}
      />

      <main ref={mainSwipeRef} {...mainSwipeHandlers} style={{ paddingTop: 12, paddingLeft: 14, paddingRight: 14, paddingBottom: 100, maxWidth: "100%", margin: "0 auto" }}>
        {/* بخش «پنل مخفی»: طبق دستور صریح کاربر، دیگه هیچ مسیر موازی و بدون-رمزی
            به محصولات/متریال/برش/گالری/حسابداری/فاکتورها نباید باشه — تنها راه
            ورود باید پنل مدیریت (ManagementPanelModal پایین‌تر) باشه که خودش از
            قبل پشت PinScreen قفله. قبلاً این‌جا یه کپی کامل و موازیِ بدون‌رمز از
            همون تب‌ها هم رندر می‌شد (پشت activeTab)، که این نشست کاملاً حذف شد.
            <main> از این به بعد همیشه فقط CatalogTab رو نشون می‌ده. */}
        <CatalogTab stickyTop="var(--global-header-height, 56px)"
          products={productTotals}
          customers={data.customers || []}
          materials={materialsWithRemaining || data.materials || []}
          setData={setData}
          notify={notify}
          sortOrder={sortOrder}
          setSortOrder={setSortOrder}
          basket={basket}
          setBasket={setBasket}
          showBasket={showBasket}
          setShowBasket={setShowBasket}
          addToBasket={addToBasket}
          removeFromBasket={removeFromBasket}
          myBusinessCard={myBusinessCard}
          productTypes={data.productTypes || []}
        />
      </main>

      {showManagementPanel && (
        <ManagementPanelModal
          onClose={handleExitPanel}
          onQuickRefresh={handleQuickRefresh}
          onHoldRefresh={handleHoldRefresh}
          onUndoRefresh={handleUndoRefresh}
          hasPending={hasPendingMaterialChanges}
          onOpenBusinessCardManager={() => setShowBusinessCardEditor(true)}
          activeTab={activeTab}
          isAnyModalOpen={isAnyModalOpen}
          hideScrollButton={isAnyModalOpenInsidePanel}
          refreshResetTick={refreshResetTick}
          refreshProblemTabs={refreshProblemTabs}
        >
          <MgmtTabs
            productTotals={productTotals}
            groupedProducts={groupedProducts}
            materialsWithRemaining={materialsWithRemaining}
            customerStats={customerStats}
            data={data}
            setData={setData}
            notify={notify}
            nextCode={nextCode}
            sortMode={sortMode}
            setSortMode={setSortMode}
            sortOrder={sortOrder}
            setSortOrder={setSortOrder}
            sortOrderMaterials={sortOrderMaterials}
            setSortOrderMaterials={setSortOrderMaterials}
            sortOrderGallery={sortOrderGallery}
            setSortOrderGallery={setSortOrderGallery}
            areaBatchCostByProduct={areaBatchCostByProduct}
            ratioByAreaCostByProduct={ratioByAreaCostByProduct}
            accounting={accounting}
            onLinkBatch={linkProductToBatch}
            onUnlinkBatch={unlinkProductFromBatch}
            onUndeductLine={undeductLineItem}
            onUndeductWood={undeductWoodCut}
            onImageUpload={handleImageUpload}
            onRequestDeleteProduct={(id) => setConfirmDeleteProduct(id)}
            onRequestDeleteMaterial={(id) => setConfirmDeleteMaterial(id)}
            onRequestDeleteCustomer={(id) => setConfirmDeleteCustomer(id)}
            addMaterialPurchase={addMaterialPurchase}
            updateProcurement={updateProcurement}
            deleteProcurement={deleteProcurement}
            deleteMaterial={deleteMaterial}
            addBatch={addBatch}
            updateBatch={updateBatch}
            deleteBatch={deleteBatch}
            lockBatch={lockBatch}
            unlockBatch={unlockBatch}
            addStick={addStick}
            updateStick={updateStick}
            deleteStick={deleteStick}
            bulkApplyMaterial={bulkApplyMaterial}
            deleteCustomer={deleteCustomer}
            handleExportExcel={handleExportExcel}
            handleExportPreviewExcel={handleExportPreviewExcel}
            handleExportJson={handleExportJson}
            xlsxImportRef={xlsxImportRef}
            jsonImportRef={jsonImportRef}
            onQuickRefresh={handleQuickRefresh}
            onHoldRefresh={handleHoldRefresh}
            onUndoRefresh={handleUndoRefresh}
            hasPending={hasPendingMaterialChanges}
            woodCuttingSessions={data.woodCuttingSessions || []}
            onSaveSession={handleSaveWoodCuttingSession} onDeleteSession={handleDeleteWoodCuttingSession}
            onExportWoodCutting={handleExportWoodCutting}
            onModalToggle={setIsProductModalOpen}
            myBusinessCard={myBusinessCard}
            nestedModalCount={nestedModalCount}
            hideFloatingSync={
              showBasket ||
              showBusinessCardEditor ||
              !!confirmDeleteProduct ||
              !!confirmDeleteMaterial ||
              !!confirmDeleteCustomer ||
              isProductModalOpen
            }
          />
        </ManagementPanelModal>
      )}

      {showBusinessCardEditor && (
        <BusinessCardModal
          onClose={() => setShowBusinessCardEditor(false)}
          myCard={myBusinessCard}
          cards={businessCards}
          onSave={handleSaveBusinessCards}
          isManagement={true}
        />
      )}

      <input ref={xlsxImportRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={handleImportExcel} />
      <input ref={jsonImportRef} type="file" accept=".json,application/json" style={{ display: "none" }} onChange={handleImportJson} />
      {confirmDeleteProduct && <ConfirmDialog title="حذف محصول" message="این محصول کامل حذف می‌شود. قابل برگشت نیست." confirmLabel="بله، حذف کن" onConfirm={() => { deleteProduct(confirmDeleteProduct); setConfirmDeleteProduct(null); }} onCancel={() => setConfirmDeleteProduct(null)} />}
      {confirmDeleteMaterial && <ConfirmDialog title="حذف متریال" message="این متریال و لینک‌های آن به محصولات حذف می‌شود." confirmLabel="حذف" onConfirm={() => { deleteMaterial(confirmDeleteMaterial); setConfirmDeleteMaterial(null); }} onCancel={() => setConfirmDeleteMaterial(null)} />}
      {confirmDeleteCustomer && <ConfirmDialog title="حذف مشتری / گالری" message="محصولات نزد این گالری به انبار برمی‌گردند." confirmLabel="حذف" onConfirm={() => { deleteCustomer(confirmDeleteCustomer); setConfirmDeleteCustomer(null); }} onCancel={() => setConfirmDeleteCustomer(null)} />}
      {pendingExcelImport && (
        <ExcelImportConfirmDialog 
          pendingData={pendingExcelImport} 
          onConfirmMerge={() => handleExecuteExcelMerge(pendingExcelImport)} 
          onConfirmReplace={() => handleExecuteExcelReplace(pendingExcelImport)} 
          onCancel={() => setPendingExcelImport(null)} 
        />
      )}
      <ScrollToTopButton activeTab={activeTab} hide={isAnyModalOpen} />
    </div>
  );
}
