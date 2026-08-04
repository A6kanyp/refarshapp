// ============================================================
// GlobalHeader.jsx - Refarsh Clean (با آیکون RotateCcw)
// ============================================================
import React, { useState, useRef, useEffect, useLayoutEffect } from "react";
import {
  Package, Layers, Scissors, Users, Calculator,
  RotateCcw, BookOpen, X, Plus, Trash2, ShoppingBag, Receipt,
  Lock, Unlock, Undo2,
} from "lucide-react";
import { FilterPopup } from "./FilterPopup";
import { uid } from "../dataModels";
import { scrollAppToTop } from "../utils/scrollToTop";
import BusinessCardModal from "./BusinessCardModal";

const LOGO_GRID = [
  "KKKKKKKKKKKKKKKKKKKKKKKK",
  "KKKKKKKWWWKKKRWWWKKKKKKK",
  "KKKKKKWWRRWRRWRRWWKKKKKK",
  "KKKKKKRWRRRWRRRRWRKKKKKK",
  "KKKKKKKWKRRWRRRKWKKKKKKK",
  "KKKKKKKWKKRWRRKKWKKKKKKK",
  "KKKRRRKWKKRWRRKKWKRRRKKK",
  "KKKKRRRWKKKRRKKKWRRRKKKK",
  "KKKKKRRKKKRRRRKKKRRKKKKK",
  "KKWWWWRKKRRWRRRKKRWWWWKK",
  "KWWWKKKKKRWRRWRKKKKKWWWK",
  "KKKWWKKKRWKKKRWRKKKWWKKK",
  "KKKKWKKKRWKKKRWRKKKWKKKK",
  "KKRRRKKKRWKKKRWRKKKRRRKK",
  "KKRRRKKKRWRKKRWRKKKRRRKK",
  "KKKRRRKKRWWRRWWRKKRRRKKK",
  "KKKKWKKKKRWRRWRKKKKWKKKK",
  "KKKWWWWWWWRRRRWWWWWWWKKK",
  "KKKWKKKKRRWWWWWWWKKKWKKK",
  "KKKKKKKRRKKKRWWRRWKKKKKK",
  "KKKKKKRRKKKKKRWKRRWKKKKK",
  "KKKKKKKKKKKKRWKWWWWWKKKK",
  "KKKKKKKKKKKKKKKKKKKWKKKK",
  "KKKKKKKKKKKKKKKKKKKKKKKK",
];
const LOGO_COLORS = { K: "#111111", W: "#F5F0EB", R: "#8B1A1A" };

function RefarshLogo({ size = 28, rounded = true }) {
  const n = LOGO_GRID.length;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${n} ${n}`}
      style={{ borderRadius: rounded ? size * 0.18 : 0, display: "block", flexShrink: 0 }}>
      <rect width={n} height={n} fill={LOGO_COLORS.K} />
      {LOGO_GRID.map((row, y) =>
        row.split("").map((c, x) =>
          c === "K" ? null : <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={LOGO_COLORS[c]} />
        )
      )}
    </svg>
  );
}

export { RefarshLogo };

const TABS = [
  { id: "catalog", label: "کاتالوگ", Icon: BookOpen },
  { id: "products", label: "محصولات", Icon: Package },
  { id: "materials", label: "متریال", Icon: Layers },
  { id: "woodCutting", label: "برش بهینه", Icon: Scissors },
  { id: "gallery", label: "گالری/مشتری", Icon: Users },
  { id: "accounting", label: "حسابداری", Icon: Calculator },
  { id: "invoices", label: "فاکتورها", Icon: Receipt },
];

// ── مودال لینک‌ها ──
function LinksModal({ links, onClose, onOpenConfig }) {
  const copyUrl = (url) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(url);
    } else {
      const ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
  };

  return (
    <div style={LS.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={LS.sheet} dir="rtl">
        <div style={LS.sheetHeader}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#F5F0EB", flex: 1 }}>لینک‌های کارگاه</span>
          <button style={LS.textBtn} onClick={() => { onClose(); onOpenConfig(); }}>ویرایش</button>
          <button style={LS.iconBtn} onClick={onClose}><X size={16} color="#888" /></button>
        </div>
        <div style={{ padding: "6px 12px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
          {links.length === 0 ? (
            <p style={{ fontSize: 11, color: "#555", textAlign: "center", padding: "24px 0" }}>هنوز لینکی اضافه نشده — «ویرایش» رو بزن.</p>
          ) : links.map((link) => (
            <div key={link.id} style={LS.linkRow}>
              <a href={link.url} target="_blank" rel="noopener noreferrer"
                style={{ flex: 1, fontSize: 12, color: "#7aa8d8", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {link.title || link.url}
              </a>
              <button style={LS.iconBtn} title="کپی" onClick={() => copyUrl(link.url)}>📋</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function LinksConfigModal({ links, onChange, onClose }) {
  const [draft, setDraft] = useState(links.map((l) => ({ ...l })));
  const add    = () => setDraft((d) => [...d, { id: uid(), title: "", url: "" }]);
  const remove = (id) => setDraft((d) => d.filter((l) => l.id !== id));
  const update = (id, field, val) => setDraft((d) => d.map((l) => l.id === id ? { ...l, [field]: val } : l));
  const save   = () => { onChange(draft); onClose(); };
  return (
    <div style={LS.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ ...LS.sheet, maxHeight: "80vh", overflowY: "auto" }} dir="rtl">
        <div style={LS.sheetHeader}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#F5F0EB", flex: 1 }}>مدیریت لینک‌ها</span>
          <button style={LS.iconBtn} onClick={onClose}><X size={16} color="#888" /></button>
        </div>
        <div style={{ padding: "8px 12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
          {draft.map((link) => (
            <div key={link.id} style={{ display: "flex", flexDirection: "column", gap: 5, background: "#1a1a1a", borderRadius: 9, padding: "10px 12px" }}>
              <input style={LS.input} placeholder="عنوان لینک" value={link.title} onChange={(e) => update(link.id, "title", e.target.value)} />
              <input style={{ ...LS.input, direction: "ltr" }} placeholder="https://..." value={link.url} onChange={(e) => update(link.id, "url", e.target.value)} />
              <button style={{ alignSelf: "flex-end", background: "transparent", border: "none", color: "#e08a8a", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }} onClick={() => remove(link.id)}>
                <Trash2 size={11} style={{ verticalAlign: -1, marginLeft: 3 }} />حذف
              </button>
            </div>
          ))}
          <button style={LS.addBtn} onClick={add}><Plus size={13} style={{ marginLeft: 4, verticalAlign: -2 }} />افزودن لینک</button>
          <button style={{ ...LS.addBtn, background: "#8B1A1A", color: "#fff", border: "none", marginTop: 4 }} onClick={save}>ذخیره</button>
        </div>
      </div>
    </div>
  );
}

export default function GlobalHeader({
  activeTab, setActiveTab,
  hasPending,
  onQuickRefresh, onHoldRefresh, onUndoRefresh, onResetFilters, onCancelPendingLocks, onCancelPendingUnlocks, refreshProblemTabs = [],
  workshopLinks, onLinksChange,
  onManagementPanel,
  basket = [],
  onToggleBasket,
  basketCount = 0,
  myBusinessCard = null,
  businessCards = [],
  onSaveBusinessCards = null,
  isInstallable = false,
  onInstall = null,
}) {
  const [showLinks, setShowLinks] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [showBusinessCard, setShowBusinessCard] = useState(false);
  // پاپ‌آپ ۷دکمه‌ای قفل/آزاد/Undo/لغو/رفرش — طبق بازطراحی جدید (رودمپ، بخش
  // «خیلی مهم» بالای فایل)، دیگه نگه‌داشتن مستقیماً هردو مود رو اجرا نمی‌کنه؛
  // یه منو باز می‌شه که هرکدوم از ۷ عملیات رو جدا و بدون‌ابهام انتخاب کنی —
  // دقیقاً همون چیزی که داخل پنل مدیریت (RefreshLockButton در App.jsx) هست.
  const [showHoldPopup, setShowHoldPopup] = useState(false);
  const holdTimer = useRef(null);
  const didHold = useRef(false);
  const refreshTimer = useRef(null);
  const refreshDidHold = useRef(false);
  const [refreshRotation, setRefreshRotation] = useState(0);
  const spinVelocityRef = useRef(0);
  const spinRafRef = useRef(null);
  const spinAngleRef = useRef(0);

  const stopSpinLoop = () => {
    if (spinRafRef.current) cancelAnimationFrame(spinRafRef.current);
    spinRafRef.current = null;
  };

  useEffect(() => stopSpinLoop, []);

  const startContinuousSpin = () => {
    stopSpinLoop();
    spinVelocityRef.current = -9; // درجه در هر فریم — منفی یعنی خلاف جهت عقربه‌های ساعت (طبق خواسته‌ی کاربر، جهتش برعکس بود)
    const tick = () => {
      spinAngleRef.current += spinVelocityRef.current;
      setRefreshRotation(spinAngleRef.current);
      spinRafRef.current = requestAnimationFrame(tick);
    };
    spinRafRef.current = requestAnimationFrame(tick);
  };

  // موقع رها کردن، به‌جای قطع ناگهانی، سرعت چرخش طی ۱ تا ۲ ثانیه با
  // شتاب‌کاهشی طبیعی (اینرسی) کم می‌شه تا آروم بایسته
  const startDeceleratingSpin = () => {
    stopSpinLoop();
    const decay = 0.965;
    const tick = () => {
      spinAngleRef.current += spinVelocityRef.current;
      spinVelocityRef.current *= decay;
      setRefreshRotation(spinAngleRef.current);
      if (spinVelocityRef.current > 0.05) {
        spinRafRef.current = requestAnimationFrame(tick);
      } else {
        spinRafRef.current = null;
      }
    };
    spinRafRef.current = requestAnimationFrame(tick);
  };

  // ── لوگو ──
  const onLogoPointerDown = () => {
    didHold.current = false;
    holdTimer.current = setTimeout(() => {
      didHold.current = true;
      setShowConfig(true);
    }, 600);
  };
  const onLogoPointerUp = () => clearTimeout(holdTimer.current);
  const onLogoClick = () => {
    if (!didHold.current) {
      setShowBusinessCard(true);
    }
  };

  // ── دکمه Refresh ──
  const onRefreshPointerDown = (e) => {
    e.preventDefault();
    refreshDidHold.current = false;
    startContinuousSpin();
    refreshTimer.current = setTimeout(() => {
      refreshDidHold.current = true;
      setShowHoldPopup(true);
    }, 550);
  };
  const lastRefreshTapRef = useRef(0);
  const onRefreshPointerUp = () => {
    const didHold = refreshDidHold.current;
    clearTimeout(refreshTimer.current);
    startDeceleratingSpin();
    if (!didHold) {
      const now = Date.now();
      if (now - lastRefreshTapRef.current < 350) {
        // دابل‌کلیک → ریست فیلترها/سورت‌ها (بجز تب برش)
        lastRefreshTapRef.current = 0;
        onResetFilters && onResetFilters();
      } else {
        lastRefreshTapRef.current = now;
        onQuickRefresh && onQuickRefresh();
      }
    }
    refreshDidHold.current = false;
  };
  const onRefreshClick = () => {};

  const isCatalog = activeTab === "catalog";
  const headerRef = useRef(null);

  useLayoutEffect(() => {
    if (!headerRef.current) return;
    const updateHeight = () => {
      const h = headerRef.current.offsetHeight;
      document.documentElement.style.setProperty("--global-header-height", `${h}px`);
    };
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(headerRef.current);
    return () => observer.disconnect();
  }, [activeTab]);

  return (
    <>
      <style>{`
        @keyframes refarshSpin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes pulseDot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.55;transform:scale(1.35)} }
        @keyframes iconSpin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        .refNav::-webkit-scrollbar{display:none}
      `}</style>

      <header style={HS.header} dir="rtl" ref={headerRef}>
        <div style={HS.brandRow}>
          <div style={HS.left}>
            {isCatalog && onManagementPanel && (
              <button
                style={HS.managementBtn}
                onClick={onManagementPanel}
              >
                پنل مدیریت
              </button>
            )}
            {isInstallable && onInstall && (
              <button
                style={{
                  ...HS.managementBtn,
                  background: "#1c3d1c",
                  borderColor: "#2a5c2a",
                  color: "#a4e0a4",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  marginRight: isCatalog ? 6 : 0
                }}
                onClick={onInstall}
                title="نصب نسخه قابل نصب و آفلاین روی گوشی یا دسکتاپ"
              >
                <span>📥</span>
                <span>نصب برنامه</span>
              </button>
            )}
          </div>

          <div style={HS.center}>
            <div
              style={{ cursor: "pointer", userSelect: "none", WebkitUserSelect: "none", flexShrink: 0 }}
              onPointerDown={onLogoPointerDown}
              onPointerUp={onLogoPointerUp}
              onPointerCancel={onLogoPointerUp}
              onClick={onLogoClick}
            >
              <RefarshLogo size={34} />
            </div>
            <div style={{ whiteSpace: "nowrap" }}>
              <div style={HS.title}>REFARSH STUDIO</div>
              <div style={HS.subtitle}>
                {isCatalog ? "کاتالوگ ریفرش" : "سیستم مدیریت و حسابداری استودیو ریفرش"}
              </div>
            </div>
          </div>

          <div style={HS.right}>
            {isCatalog ? (
              <button
                style={HS.basketBtn}
                onClick={onToggleBasket}
              >
                <ShoppingBag size={18} />
                {basketCount > 0 && (
                  <span style={HS.basketBadge}>
                    {basketCount}
                  </span>
                )}
              </button>
            ) : (
              <div style={{ position: "relative", flexShrink: 0 }}>
                <button
                  style={HS.refreshBtn}
                  onPointerDown={onRefreshPointerDown}
                  onPointerUp={onRefreshPointerUp}
                  onPointerCancel={onRefreshPointerUp}
                  onClick={onRefreshClick}
                  title="تپ: رفرش نمایش | نگه‌دار ۵۵۰ms: منوی قفل/آزاد/Undo/لغو | دو تپ سریع: ریست فیلترها"
                >
                  <RotateCcw 
                    size={16} 
                    color="#888"
                    style={{
                      transform: `rotate(${refreshRotation}deg)`,
                    }}
                  />
                  {hasPending && <span style={HS.pendingDot} />}
                </button>

                <FilterPopup open={showHoldPopup} onClose={() => setShowHoldPopup(false)} width={190}>
                  <div style={{ padding: 10 }}>
                    <div style={{ fontSize: 10, color: "#888", textAlign: "center", marginBottom: 8 }}>چه کاری انجام بشه؟</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          style={{ ...HS.holdRowBtn, background: "#1d3a24", color: "#5fd180" }}
                          onClick={() => { setShowHoldPopup(false); onHoldRefresh && onHoldRefresh("lock"); }}
                        >
                          <Lock size={15} />
                          قفل
                        </button>
                        <button
                          style={{ ...HS.holdRowBtn, background: "#3a2414", color: "#e0a35a" }}
                          onClick={() => { setShowHoldPopup(false); onHoldRefresh && onHoldRefresh("unlock"); }}
                        >
                          <Unlock size={15} />
                          آزاد
                        </button>
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          style={{ ...HS.holdRowBtn, background: "#1c1c1c", color: "#888" }}
                          onClick={() => { setShowHoldPopup(false); onUndoRefresh && onUndoRefresh("lock"); }}
                        >
                          <Undo2 size={15} />
                          Undo قفل
                        </button>
                        <button
                          style={{ ...HS.holdRowBtn, background: "#1c1c1c", color: "#888" }}
                          onClick={() => { setShowHoldPopup(false); onUndoRefresh && onUndoRefresh("unlock"); }}
                        >
                          <Undo2 size={15} />
                          Undo آزاد
                        </button>
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          style={{ ...HS.holdRowBtn, background: "#1c1c1c", color: "#d0b878" }}
                          onClick={() => { setShowHoldPopup(false); onCancelPendingLocks && onCancelPendingLocks(); }}
                        >
                          <X size={15} />
                          لغو معلق‌ها
                        </button>
                        <button
                          style={{ ...HS.holdRowBtn, background: "#1c1c1c", color: "#d0b878" }}
                          onClick={() => { setShowHoldPopup(false); onCancelPendingUnlocks && onCancelPendingUnlocks(); }}
                        >
                          <X size={15} />
                          لغو منتظرآزادها
                        </button>
                      </div>
                      <button
                        style={{ ...HS.holdRowBtn, background: "#1c1c1c", color: "#ccc", flexDirection: "row" }}
                        onClick={() => { setShowHoldPopup(false); onQuickRefresh && onQuickRefresh(); }}
                      >
                        <RotateCcw size={15} />
                        رفرش
                      </button>
                    </div>
                  </div>
                </FilterPopup>
              </div>
            )}
          </div>
        </div>
        {/* نوار تب محصولات/متریال/... که قبلاً اینجا بود حذف شد: طبق دستور صریح
            کاربر، دیگه نباید هیچ راهی جز پنل مدیریت (پشت رمز، MgmtTabs) به این
            بخش‌ها باشه. activeTab دیگه هیچ‌وقت غیر از "catalog" نمی‌شه، پس این
            نوار همیشه dead/غیرقابل‌دسترس بود؛ برای اینکه واقعاً حذف شده باشه
            (نه فقط مخفی)، خودِ کد رو هم پاک کردیم */}
      </header>

      {showLinks && (
        <LinksModal links={workshopLinks||[]} onClose={() => setShowLinks(false)} onOpenConfig={() => { setShowLinks(false); setShowConfig(true); }} />
      )}
      {showConfig && (
        <LinksConfigModal links={workshopLinks||[]} onChange={(u) => { onLinksChange && onLinksChange(u); setShowConfig(false); }} onClose={() => setShowConfig(false)} />
      )}
      {showBusinessCard && (
        <BusinessCardModal
          onClose={() => setShowBusinessCard(false)}
          myCard={myBusinessCard}
          cards={businessCards}
          onSave={(myCard, cards) => {
            if (onSaveBusinessCards) onSaveBusinessCards(myCard, cards);
          }}
          isManagement={activeTab !== "catalog"}
          hidePartners={activeTab === "catalog"}
        />
      )}
    </>
  );
}

const HS = {
  header: {
    position: "sticky",
    top: 0,
    zIndex: 50,
    background: "#0a0a0a",
    borderBottom: "1px solid #141414",
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: 0,
    boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
  },
  brandRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    minHeight: 52,
    padding: "10px 14px 4px",
    boxSizing: "border-box",
  },
  left: {
    flex: "0 0 auto",
    display: "flex",
    alignItems: "center",
    gap: 6,
    minWidth: 80,
  },
  center: {
    flex: "1 1 auto",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: "0 4px",
    minWidth: 0,
  },
  right: {
    flex: "0 0 auto",
    display: "flex",
    alignItems: "center",
    gap: 6,
    minWidth: 80,
    justifyContent: "flex-end",
  },
  managementBtn: {
    background: "#1e1e1e",
    border: "1px solid #2a2a2a",
    color: "#aaa",
    fontSize: 11,
    padding: "5px 10px",
    borderRadius: 8,
    cursor: "pointer",
    fontFamily: "inherit",
    whiteSpace: "nowrap",
    flexShrink: 0,
  },
  title: {
    fontSize: 15,
    fontWeight: 700,
    color: "#F5F0EB",
    letterSpacing: "0.12em",
  },
  subtitle: {
    fontSize: 9.5,
    color: "#888",
    marginTop: 1,
    lineHeight: 1.3,
    whiteSpace: "nowrap",
  },
  basketBtn: {
    background: "#1c1c1c",
    border: "1px solid #2a2a2a",
    borderRadius: 8,
    padding: "6px 10px",
    cursor: "pointer",
    color: "#888",
    position: "relative",
  },
  basketBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    background: "#8B1A1A",
    color: "#fff",
    fontSize: 8,
    width: 18,
    height: 18,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  refreshBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    background: "#161616",
    border: "1px solid #232323",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    padding: 0,
    touchAction: "manipulation",
    position: "relative",
  },
  holdRowBtn: {
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
    padding: "10px 6px", borderRadius: 10, cursor: "pointer", fontFamily: "inherit", fontSize: 10, border: "1px solid #2a2a2a", flex: 1,
  },
  pendingDot: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#e03030",
    border: "1.5px solid #0a0a0a",
    animation: "pulseDot 1.1s ease-in-out infinite",
    pointerEvents: "none",
  },
  nav: {
    display: "flex",
    flexWrap: "wrap",
    gap: "3px",
    padding: "0 14px 8px",
    width: "100%",
    minHeight: 38,
    boxSizing: "border-box",
  },
  navBtn: {
    flex: "1 1 auto",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "4px",
    padding: "6px 8px",
    borderRadius: 18,
    background: "transparent",
    border: "1px solid #1e1e1e",
    color: "#555",
    fontSize: "9.5px",
    fontFamily: "inherit",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  navBtnActive: {
    background: "#8B1A1A",
    border: "1px solid #8B1A1A",
    color: "#fff",
  },
};

const LS = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.78)",
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
    zIndex: 200,
  },
  sheet: {
    width: "100%",
    maxWidth: 480,
    background: "#181818",
    borderRadius: "16px 16px 0 0",
    display: "flex",
    flexDirection: "column",
    maxHeight: "65vh",
    overflowY: "auto",
  },
  sheetHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "14px 14px 10px",
    borderBottom: "1px solid #232323",
    position: "sticky",
    top: 0,
    background: "#181818",
    zIndex: 10,
  },
  linkRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: "#121212",
    borderRadius: 8,
    padding: "10px 12px",
  },
  iconBtn: {
    background: "transparent",
    border: "none",
    fontSize: 15,
    cursor: "pointer",
    padding: "3px 5px",
    display: "flex",
    alignItems: "center",
    lineHeight: 1,
  },
  textBtn: {
    background: "transparent",
    border: "none",
    color: "#7aa8d8",
    fontSize: 11,
    cursor: "pointer",
    fontFamily: "inherit",
    padding: "3px 6px",
  },
  input: {
    width: "100%",
    background: "#1c1c1c",
    border: "1px solid #2a2a2a",
    borderRadius: 6,
    padding: "7px 10px",
    color: "#ddd",
    fontFamily: "inherit",
    fontSize: 11,
    outline: "none",
    boxSizing: "border-box",
  },
  addBtn: {
    width: "100%",
    background: "#1c1c1c",
    border: "1px dashed #333",
    color: "#888",
    fontFamily: "inherit",
    fontSize: 11,
    padding: "10px 0",
    borderRadius: 8,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
};