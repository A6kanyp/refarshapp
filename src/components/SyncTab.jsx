// ============================================================
// SyncTab.jsx - Refarsh Studio Sync & Backup Center
// ============================================================

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Cloud, CloudLightning, RefreshCw, CheckCircle2,
  AlertTriangle, FileDown, FileUp, Trash2, Database,
  HelpCircle, Wifi, WifiOff, Clock, HardDrive, Info,
  FolderOpen, Save, X, Check, ChevronDown, ChevronUp, Plus, Edit3, LayoutGrid
} from "lucide-react";
import {
  performSynchronization,
  getDeletedRegistry,
  clearDeletedRegistry,
  getLastSyncTime,
  setLastSyncTime
} from "../utils/syncManager";
import { getDefaultData } from "../dataModels";
import { getImageFolderName } from "../utils/imageStorage";
import { useAuth } from "../contexts/AuthContext.jsx";

function formatRelativeTime(timestamp) {
  if (!timestamp) return "هرگز همگام‌سازی نشده";
  const diff = Date.now() - timestamp;
  if (diff < 60000) return "چند ثانیه پیش";
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} دقیقه پیش`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ساعت پیش`;
  return new Date(timestamp).toLocaleDateString("fa-IR", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

export default function SyncTab({
  stickyTop = 60,
  data,
  setData,
  notify,
  onExportExcel,
  onExportPreviewExcel,
  onExportJson,
  onImportExcelClick,
  onImportJsonClick,
  hideFloatingSync
}) {
  const { user, token, loading, login, logout, getToken } = useAuth();
  const [syncStatus, setSyncStatus] = useState("idle"); // idle, syncing, success, error
  const [errorMsg, setErrorMsg] = useState("");
  const [lastSync, setLastSync] = useState(() => getLastSyncTime());
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [serverPing, setServerPing] = useState(null); // 'ok', 'error', null
  const [pinging, setPinging] = useState(false);
  const [pendingDeletes, setPendingDeletes] = useState(() => getDeletedRegistry());
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetPin, setResetPin] = useState("");
  const [showPinInput, setShowPinInput] = useState(false);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [auditFilter, setAuditFilter] = useState("all");

  const auditLog = Array.isArray(data?.auditLog) ? data.auditLog : [];
  const filteredAuditLog = useMemo(() => {
    if (auditFilter === "all") return auditLog;
    return auditLog.filter((e) => e.action === auditFilter);
  }, [auditLog, auditFilter]);
  const formatLogDate = (ts) => {
    if (!ts) return "—";
    try {
      const d = new Date(ts);
      const dFormat = new Intl.DateTimeFormat("fa-IR", { calendar: "persian", year: "numeric", month: "2-digit", day: "2-digit" });
      const tFormat = new Intl.DateTimeFormat("fa-IR", { hour: "2-digit", minute: "2-digit", hour12: false });
      return `${dFormat.format(d)} ساعت ${tFormat.format(d)}`;
    } catch {
      return "—";
    }
  };
  const auditActionMeta = {
    created: { label: "افزوده شد", color: "#5fd180", Icon: Plus },
    updated: { label: "ویرایش شد", color: "#e0a35a", Icon: Edit3 },
    deleted: { label: "حذف شد", color: "#e08a8a", Icon: Trash2 },
  };

  const [showPathEditor, setShowPathEditor] = useState(false);
  const imageFolderName = getImageFolderName();

  // Poll navigator.onLine and local storage deletes
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial check of local pending deletes
    setPendingDeletes(getDeletedRegistry());

    const timer = setInterval(() => {
      setPendingDeletes(getDeletedRegistry());
      setLastSync(getLastSyncTime());
    }, 5000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(timer);
    };
  }, []);

  // بعد از آماده‌شدن auth، وضعیت سرور را چک کن
  useEffect(() => {
    if (loading) return;
    testConnection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, token]);

  const getApiBase = () => {
    const raw =
      typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL
        ? String(import.meta.env.VITE_API_BASE_URL).trim()
        : "";
    return raw.replace(/\/$/, "");
  };

  const testConnection = async () => {
    setPinging(true);
    try {
      const API_BASE = getApiBase();
      // روی APK بدون آدرس سرور، درخواست به capacitor:// می‌رود و همیشه fail می‌شود
      const isNative =
        typeof window !== "undefined" &&
        window.Capacitor &&
        typeof window.Capacitor.isNativePlatform === "function" &&
        window.Capacitor.isNativePlatform();
      if (isNative && !API_BASE) {
        setServerPing("error");
        setErrorMsg(
          "آدرس سرور تنظیم نشده. در فایل .env مقدار VITE_API_BASE_URL را بگذار (مثلاً http://192.168.1.10:3000) و دوباره npm run build + cap sync بزن."
        );
        return;
      }
      // اول health بدون توکن — فقط زنده بودن سرور
      const healthRes = await fetch(`${API_BASE}/api/health`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      if (!healthRes.ok) {
        setServerPing("error");
        setErrorMsg(`سرور پاسخ نداد (کد ${healthRes.status}). مطمئن شو npm run dev یا npm start روی سرور اجراست.`);
        return;
      }
      // اگر لاگین است، وضعیت احراز هویت‌شده را هم چک کن
      if (token) {
        const res = await fetch(`${API_BASE}/api/sync/status`, {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          setServerPing("error");
          if (res.status === 401) {
            setErrorMsg("توکن نامعتبر است — دوباره با گوگل وارد شو.");
          } else {
            setErrorMsg(body?.error || `خطای سرور سینک (کد ${res.status})`);
          }
          return;
        }
      }
      setServerPing("ok");
      setIsOnline(true);
      setErrorMsg("");
    } catch (err) {
      setServerPing("error");
      const msg = err?.message || "";
      setErrorMsg(
        msg.includes("Failed to fetch") || msg.includes("NetworkError")
          ? "ارتباط شبکه برقرار نشد. سرور روشن است؟ آدرس VITE_API_BASE_URL درست است؟ فایروال پورت ۳۰۰۰ را نبسته؟"
          : msg || "برقراری ارتباط با سرور قطع شد"
      );
    } finally {
      setPinging(false);
    }
  };

  const handleSync = async () => {
    if (syncStatus === "syncing" || loading) return;
    setSyncStatus("syncing");
    setErrorMsg("");

    try {
      if (loading) {
        throw new Error("در حال بارگذاری اطلاعات کاربری، لطفاً کمی صبر کنید.");
      }
      const API_BASE = getApiBase();
      const isNative =
        typeof window !== "undefined" &&
        window.Capacitor &&
        typeof window.Capacitor.isNativePlatform === "function" &&
        window.Capacitor.isNativePlatform();
      if (isNative && !API_BASE) {
        throw new Error(
          "آدرس سرور (VITE_API_BASE_URL) خالی است. بدون آن APK نمی‌تواند به سرور وصل شود."
        );
      }
      const freshToken = await getToken();
      console.log("Sync token check:", freshToken ? "Token present" : "Token missing", "API_BASE=", API_BASE || "(same-origin)");
      if (!freshToken) {
        throw new Error("لطفاً ابتدا وارد حساب کاربری خود شوید.");
      }
      const result = await performSynchronization(data, freshToken);
      if (result.success) {
        setSyncStatus("success");
        setLastSync(getLastSyncTime());
        setPendingDeletes([]);
        if (result.mergedData) {
          setData(result.mergedData);
        }
        notify("همگام‌سازی با موفقیت انجام شد");
        setServerPing("ok");
      } else {
        setSyncStatus("error");
        setErrorMsg(result.error || "خطای ناشناخته در ارتباط با سرور");
        setServerPing("error");
        notify("همگام‌سازی ناموفق بود");
      }
    } catch (err) {
      setSyncStatus("error");
      setErrorMsg(err.message || "برقراری ارتباط با سرور قطع شد");
      notify("خطا در همگام‌سازی");
    }
  };

  const handleResetServerStore = async () => {
    if (resetPin !== "274526") {
      notify("رمز وارد شده اشتباه است");
      return;
    }
    if (!user) {
      notify("لطفاً ابتدا وارد حساب کاربری گوگل خود شوید");
      return;
    }
    try {
      const freshToken = await getToken();
      if (!freshToken) {
        notify("لطفاً ابتدا وارد حساب کاربری خود شوید");
        return;
      }
      const API_BASE_R = (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) ? String(import.meta.env.VITE_API_BASE_URL).replace(/\/$/, "") : "";
      const res = await fetch(`${API_BASE_R}/api/sync/reset`, {
        method: "POST",
        headers: { Authorization: `Bearer ${freshToken}` },
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) {
        notify(body?.error || "خطا در ریست دیتابیس ابری");
        return;
      }

      // ریست کامل داده‌ی محلی — قبلاً فقط ۵ از ۸ فیلد پاک می‌شد و بقیه
      // (کارت‌ویزیت من، کارت‌ویزیت‌های همکاران، جلسات برش) دست‌نخورده باقی
      // می‌ماند که هم دیتای قدیمی رو نگه می‌داشت و هم می‌تونست باعث کرش بشه
      setData(getDefaultData());
      notify("دیتابیس ابری سرور و داده‌های محلی با موفقیت ریست شد");
      setLastSyncTime(0);
      setLastSync(0);
      clearDeletedRegistry(getDeletedRegistry().map((r) => r.id));
      setPendingDeletes([]);
      setShowResetConfirm(false);
      setShowPinInput(false);
      setResetPin("");
      testConnection();
    } catch (err) {
      console.error("Reset failed:", err);
      notify("خطا در برقراری ارتباط برای ریست دیتابیس");
    }
  };

  // Counting change footprint
  const unsyncedChangesCount = pendingDeletes.length;

  return (
    <>
      <div className="flex flex-col gap-6 max-w-lg mx-auto py-4" dir="rtl" id="sync-tab-container" style={{ paddingBottom: "24px" }}>
      {/* ── CONNECTION STATUS CARD ── */}
      <div className="bg-[#121212] border border-[#1f1f1f] rounded-2xl p-5 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1.5 h-full bg-[#8B1A1A]"></div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Database className="text-[#8B1A1A]" size={22} />
            <h2 className="text-sm font-bold text-[#F5F0EB]">مرکز هماهنگی و همگام‌سازی ابری</h2>
          </div>
          <div className="flex items-center gap-1.5 bg-[#1a1a1a] px-3 py-1.5 rounded-full border border-[#2a2a2a]">
            {isOnline ? (
              <>
                <Wifi className="text-emerald-500" size={12} />
                <span className="text-[10px] text-emerald-400 font-medium">اتصال اینترنت برقرار است</span>
              </>
            ) : (
              <>
                <WifiOff className="text-red-500" size={12} />
                <span className="text-[10px] text-red-400 font-medium">دستگاه آفلاین است</span>
              </>
            )}
          </div>
        </div>

        <p className="text-[11px] text-[#888] leading-relaxed mb-5">
          داده‌های شما به صورت آفلاین در دستگاه جاری ثبت می‌شوند. با برقراری اتصال همگام‌سازی، دیتابیس شما با نسخه ابری ادغام شده و روی تمام دستگاه‌ها (ویندوز، اندروید و وب‌سایت کارگاه) یکپارچه می‌شود.
        </p>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-[#161616] border border-[#222] rounded-xl p-3 flex flex-col justify-center">
            <div className="flex items-center gap-1.5 mb-1">
              <Clock size={12} className="text-[#666]" />
              <span className="text-[10px] text-[#666] font-medium">آخرین همگام‌سازی</span>
            </div>
            <div className="text-xs font-semibold text-[#ddd]">
              {formatRelativeTime(lastSync)}
            </div>
          </div>

          <div className="bg-[#161616] border border-[#222] rounded-xl p-3 flex flex-col justify-center">
            <div className="flex items-center gap-1.5 mb-1">
              <HardDrive size={12} className="text-[#666]" />
              <span className="text-[10px] text-[#666] font-medium">حذف‌شده‌های منتظر همگام‌سازی</span>
            </div>
            <div className={`text-xs font-semibold ${unsyncedChangesCount > 0 ? "text-amber-400" : "text-[#ddd]"}`}>
              {unsyncedChangesCount} آیتم
            </div>
          </div>
        </div>

        {/* Sync action trigger */}
        <div className="flex flex-col gap-2 mt-4">
          {!user ? (
            <button
              onClick={login}
              className="w-full py-3 px-4 rounded-xl font-medium text-xs flex items-center justify-center gap-2 bg-[#1a1a1a] hover:bg-[#222] text-[#fff] border border-[#2a2a2a] transition-all cursor-pointer"
            >
              <svg className="w-4 h-4 mr-1" viewBox="0 0 24 24">
                <path
                  fill="#EA4335"
                  d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.4l3.7 2.9C6.5 7.1 9 5 12 5z"
                />
                <path
                  fill="#4285F4"
                  d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.4h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.7z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C1 9.1.5 11 .5 13s.5 3.9 1.4 5.7l3.7-2.9z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c3.2 0 6-1.1 8-2.9l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.1-6.4-5.3L1.9 16C3.7 19.8 7.5 23 12 23z"
                />
              </svg>
              ورود با حساب گوگل جهت فعال‌سازی همگام‌سازی ابری
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between p-2.5 bg-[#161616] border border-[#222] rounded-xl text-[10px] text-[#aaa]">
                <div className="flex items-center gap-2">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt={user.displayName} referrerPolicy="no-referrer" className="w-4 h-4 rounded-full" />
                  ) : (
                    <div className="w-4 h-4 bg-[#8B1A1A] rounded-full flex items-center justify-center text-[9px] text-white font-bold">
                      {user.email ? user.email[0].toUpperCase() : "U"}
                    </div>
                  )}
                  <span className="font-semibold">{user.displayName || user.email}</span>
                </div>
                <button onClick={logout} className="text-[#e08a8a] hover:text-red-400 font-medium transition-all cursor-pointer">
                  خروج از حساب
                </button>
              </div>
              <button
                onClick={handleSync}
                disabled={syncStatus === "syncing"}
                className={`w-full py-3 px-4 rounded-xl font-medium text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  syncStatus === "syncing"
                    ? "bg-[#1f1f1f] border border-[#333] text-[#666]"
                    : "bg-[#8B1A1A] hover:bg-[#a62424] text-white border border-[#8B1A1A]"
                }`}
                id="manual-sync-btn"
              >
                <RefreshCw
                  size={14}
                  className={`${syncStatus === "syncing" ? "animate-spin text-[#666]" : "text-white"}`}
                />
                {syncStatus === "syncing" ? "در حال همگام‌سازی اطلاعات با سرور..." : "همگام‌سازی و بروزرسانی ابرها"}
              </button>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 mt-2">
            <button
              onClick={testConnection}
              disabled={pinging}
              className="flex-1 py-2 px-3 bg-[#1a1a1a] border border-[#282828] text-[#999] hover:text-[#bbb] rounded-lg text-[10px] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {pinging ? "تست..." : "بررسی وضعیت سرور"}
            </button>
            <div className="text-[10px] text-[#666] flex items-center gap-1">
              <span>وضعیت سرور کارگاه:</span>
              {serverPing === "ok" ? (
                <span className="text-emerald-500 font-bold">فعال و متصل</span>
              ) : serverPing === "error" ? (
                <span className="text-red-500 font-bold">خطای ارتباط</span>
              ) : (
                <span className="text-amber-500 font-bold">بررسی نشده</span>
              )}
            </div>
          </div>
        </div>

        {syncStatus === "success" && (
          <div className="mt-4 p-3 bg-emerald-950/20 border border-emerald-900/35 rounded-xl flex items-center gap-2">
            <CheckCircle2 className="text-emerald-500 flex-shrink-0" size={14} />
            <span className="text-[10px] text-emerald-400">تمام تغییرات با موفقیت در دیتابیس ابری ادغام و ثبت شدند.</span>
          </div>
        )}

        {(syncStatus === "error" || (serverPing === "error" && errorMsg)) && (
          <div className="mt-4 p-3 bg-red-950/20 border border-red-900/35 rounded-xl flex items-center gap-2">
            <AlertTriangle className="text-red-500 flex-shrink-0" size={14} />
            <span className="text-[10px] text-red-400">{errorMsg || "خطا در اتصال به سرور همگام‌سازی."}</span>
          </div>
        )}
      </div>

      {/* ── BACKUP & HARD FILES ── */}
      <div className="bg-[#121212] border border-[#1f1f1f] rounded-2xl p-5 shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          <HardDrive className="text-[#888]" size={20} />
          <h2 className="text-sm font-bold text-[#F5F0EB]">نسخه‌های پشتیبان آفلاین و فایل‌ها</h2>
        </div>

        <p className="text-[11px] text-[#888] leading-relaxed mb-5">
          برای امنیت کامل داده‌ها، می‌توانید در هر زمان کل اطلاعات استودیو ریفرش را در قالب یک فایل اکسل (XLSX) یا فایل دیتابیس کامل (JSON) دانلود کرده و مجدداً روی همین دستگاه یا دستگاهی دیگر بارگذاری (Import) کنید.
        </p>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <button
            onClick={onExportExcel}
            className="p-4 bg-[#181818] border border-[#232323] hover:border-[#3a3a3a] rounded-xl flex flex-col items-center justify-center gap-2 transition-all text-[#ccc] hover:text-white cursor-pointer"
          >
            <FileDown className="text-emerald-500" size={20} />
            <span className="text-[11px] font-semibold">خروجی اکسل کامل</span>
            <span className="text-[9px] text-[#666]">محصولات، متریال، گالری</span>
          </button>

          <button
            onClick={onExportJson}
            className="p-4 bg-[#181818] border border-[#232323] hover:border-[#3a3a3a] rounded-xl flex flex-col items-center justify-center gap-2 transition-all text-[#ccc] hover:text-white cursor-pointer"
          >
            <FileDown className="text-[#8B1A1A]" size={20} />
            <span className="text-[11px] font-semibold">بکاپ کامل JSON</span>
            <span className="text-[9px] text-[#666]">کل اطلاعات با ساختار دیتابیس</span>
          </button>
        </div>

        {onExportPreviewExcel && (
          <button
            onClick={onExportPreviewExcel}
            className="w-full p-4 bg-[#181818] border border-[#232323] hover:border-[#3a3a3a] rounded-xl flex flex-col items-center justify-center gap-2 transition-all text-[#ccc] hover:text-white cursor-pointer mb-3"
          >
            <LayoutGrid className="text-amber-500" size={20} />
            <span className="text-[11px] font-semibold">پیش‌نمایش گرافیکی اکسل (رنگی، فقط نمایشی)</span>
            <span className="text-[9px] text-[#666]">دسته‌بندی رنگی، جمع هر گالری — قابل import نیست</span>
          </button>
        )}

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={onImportExcelClick}
            className="py-2.5 px-3 bg-[#161616] border border-[#252525] hover:border-[#333] rounded-lg text-[10px] text-[#999] hover:text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <FileUp size={12} className="text-emerald-500" />
            بارگذاری فایل اکسل
          </button>

          <button
            onClick={onImportJsonClick}
            className="py-2.5 px-3 bg-[#161616] border border-[#252525] hover:border-[#333] rounded-lg text-[10px] text-[#999] hover:text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <FileUp size={12} className="text-[#8B1A1A]" />
            بارگذاری بکاپ JSON
          </button>
        </div>

        {/* ── تنظیم پوشه‌ی عکس‌ها ── */}
        <div className="mt-6 pt-5 border-t border-[#1f1f1f]">
          <button
            className="flex items-center gap-2 bg-transparent border-none text-[#777] text-[11px] cursor-pointer font-inherit p-1"
            onClick={() => setShowPathEditor(!showPathEditor)}
          >
            <FolderOpen size={14} />
            پوشه‌ی عکس‌ها: <span dir="ltr" className="text-[#999]">{imageFolderName}</span>
          </button>

          {showPathEditor && (
            <div className="bg-[#0e0e0e] border border-[#1e1e1e] rounded-xl p-3 mt-2">
              <div className="text-[9.5px] text-[#666] mb-2 leading-relaxed">
                عکس‌ها دیگه داخل خودِ دیتابیس ذخیره نمی‌شن (سبک‌تر و سریع‌تر می‌شه)؛ به‌جاش توی یه پوشه روی خودِ گوشی/سیستم ذخیره می‌شن. اندروید اجازه‌ی وارد کردن مسیر کامل دلخواه رو نمی‌ده، پس این پوشه همیشه داخل «Documents» گوشی ساخته می‌شه (با فایل‌منیجر هم قابل‌دیدنه) — لازم نیست خودت بسازیش، اپ خودکار می‌سازه. اگه خواستی از قبل دستی بسازی، دقیقاً همین مسیرها:
              </div>
              <div className="text-[9.5px] text-[#888] mb-1 leading-loose font-mono" dir="ltr">
                Documents/{imageFolderName}/images  ← عکس محصولات<br />
                Documents/{imageFolderName}/qr  ← QR کارت‌ویزیت خودت<br />
                Documents/{imageFolderName}/cards  ← عکس کارت‌ویزیت همکاران/تامین‌کننده‌ها<br />
                Documents/{imageFolderName}/factor/pdf  ← PDF فاکتورها (ذخیره خودکار)<br />
                Documents/{imageFolderName}/factor/image  ← عکس فاکتورها (ذخیره خودکار)<br />
                Documents/{imageFolderName}/1dnesting  ← خروجی عکس برش ۱D<br />
                Documents/{imageFolderName}/2dnesting  ← خروجی عکس برش ۲D
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── TECHNICAL AUDIT / OFFLINE TOMBSTONES LOG ── */}
      {unsyncedChangesCount > 0 && (
        <div className="bg-[#121212] border border-[#1f1f1f] rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Info className="text-amber-500" size={16} />
              <h3 className="text-xs font-bold text-[#F5F0EB]">ردپای عملیات‌های منتظر هماهنگی</h3>
            </div>
            <span className="text-[9px] text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded-full">تغییرات آفلاین</span>
          </div>

          <p className="text-[10px] text-[#666] leading-relaxed mb-3">
            شناسه‌های زیر به عنوان نشان‌گذارهای حذف (Tombstones) ثبت شده‌اند تا در همگام‌سازی بعدی از دیتابیس ابری نیز حذف شوند:
          </p>

          <div className="max-h-28 overflow-y-auto border border-[#1f1f1f] rounded-xl p-1 bg-[#0f0f0f] flex flex-col gap-1.5">
            {pendingDeletes.map((del) => (
              <div
                key={del.id}
                className="flex items-center justify-between p-2 bg-[#141414] rounded-lg border border-[#1c1c1c] text-[9.5px] font-mono"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[#888] font-sans">
                    {del.type === "product" ? "📦 محصول" : del.type === "material" ? "🪵 متریال" : "👤 مشتری"}
                  </span>
                  <span className="text-[#444]">{del.id}</span>
                </div>
                <span className="text-[#555] font-sans">
                  {new Date(del.deletedAt).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── ADVANCED ADMIN DEV ZONE ── */}
      <div className="bg-[#121212] border border-[#1f1f1f] rounded-2xl p-5 shadow-lg">
        <div className="flex items-center gap-2.5 mb-2.5">
          <HelpCircle size={16} className="text-[#555]" />
          <h3 className="text-xs font-bold text-[#F5F0EB]">ناحیه توسعه‌دهندگان کارگاه</h3>
        </div>
        <p className="text-[10px] text-[#666] leading-relaxed mb-4">
          این ابزارها برای رفع اشکال و پاکسازی دیتابیس ابری در زمان تست‌های اولیه تعبیه شده‌اند. با احتیاط استفاده کنید.
        </p>

        {showResetConfirm ? (
          <div className="p-3 bg-red-950/20 border border-red-900/40 rounded-xl">
            {!showPinInput ? (
              <>
                <p className="text-[10.5px] text-red-400 font-semibold mb-3">
                  آیا از ریست کامل دیتابیس ابری مطمئن هستید؟ دیتای موجود در ابر پاک شده و با اولین هماهنگی دیتای فعلی شما مجدداً ابرها را پر خواهد کرد.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowPinInput(true)}
                    className="flex-1 py-1.5 bg-[#8B1A1A] hover:bg-red-700 text-white font-bold rounded-lg text-[10px] cursor-pointer"
                  >
                    تایید و مرحله بعد
                  </button>
                  <button
                    onClick={() => setShowResetConfirm(false)}
                    className="flex-1 py-1.5 bg-[#1a1a1a] border border-[#2a2a2a] text-[#aaa] rounded-lg text-[10px] cursor-pointer"
                  >
                    انصراف
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-[10.5px] text-red-400 font-semibold mb-2">
                  لطفاً رمز عبور پاکسازی را وارد کنید:
                </p>
                <input
                  type="password"
                  className="w-full bg-[#161616] border border-[#2a2a2a] rounded-lg p-2 mb-3 text-center text-white outline-none font-mono"
                  value={resetPin}
                  onChange={(e) => setResetPin(e.target.value)}
                  placeholder="PIN"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleResetServerStore}
                    className="flex-2 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-[10px] cursor-pointer"
                  >
                    پاکسازی نهایی دیتابیس
                  </button>
                  <button
                    onClick={() => {
                      setShowPinInput(false);
                      setResetPin("");
                    }}
                    className="flex-1 py-1.5 bg-[#1a1a1a] border border-[#2a2a2a] text-[#aaa] rounded-lg text-[10px] cursor-pointer"
                  >
                    بازگشت
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <button
            onClick={() => setShowResetConfirm(true)}
            className="w-full py-2 bg-[#1a1a1a] hover:bg-[#201010] border border-[#2e2020] text-red-400 hover:text-red-300 rounded-xl text-[10px] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Trash2 size={12} className="text-red-500" />
            پاکسازی دیتابیس ابری سرور (Reset Server Store)
          </button>
        )}
      </div>
      {/* ردپای تغییرات */}
      <div style={{ background: "#161616", border: "1px solid #262626", borderRadius: 10, padding: 14, marginTop: 14 }}>
        <div
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
          onClick={() => setShowAuditLog((s) => !s)}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Clock size={16} color="#888" />
            <span style={{ fontSize: 12, fontWeight: 600, color: "#ddd" }}>ردپای تغییرات</span>
            <span style={{ fontSize: 10, color: "#666" }}>({auditLog.length} مورد)</span>
          </div>
          {showAuditLog ? <ChevronUp size={16} color="#888" /> : <ChevronDown size={16} color="#888" />}
        </div>

        {showAuditLog && (
          <div style={{ marginTop: 10 }}>
            <div style={{ display: "flex", gap: 4, marginBottom: 8, flexWrap: "wrap" }}>
              {[
                ["all", "همه"],
                ["created", "افزوده‌ها"],
                ["updated", "ویرایش‌ها"],
                ["deleted", "حذف‌ها"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setAuditFilter(key)}
                  style={{
                    fontSize: 10, fontFamily: "inherit", padding: "4px 10px", borderRadius: 6, cursor: "pointer",
                    background: auditFilter === key ? "#8B1A1A" : "#1c1c1c",
                    color: auditFilter === key ? "#fff" : "#999",
                    border: auditFilter === key ? "none" : "1px solid #2a2a2a",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {filteredAuditLog.length === 0 ? (
              <div style={{ fontSize: 10.5, color: "#555", textAlign: "center", padding: "16px 0" }}>
                هنوز تغییری ثبت نشده
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 320, overflowY: "auto" }}>
                {filteredAuditLog.map((entry) => {
                  const meta = auditActionMeta[entry.action] || auditActionMeta.updated;
                  const { Icon } = meta;
                  return (
                    <div
                      key={entry.id}
                      style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", background: "#1a1a1a", borderRadius: 6, border: "1px solid #232323" }}
                    >
                      <Icon size={12} color={meta.color} style={{ flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 10.5, color: "#ddd", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          <span style={{ color: "#888" }}>{entry.entityLabel}</span> «{entry.entityName}» <span style={{ color: meta.color }}>{meta.label}</span>
                        </div>
                        <div style={{ fontSize: 9, color: "#666", marginTop: 1 }}>{formatLogDate(entry.date)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div style={{ fontSize: 9, color: "#555", marginTop: 8, lineHeight: 1.6 }}>
              این لاگ فقط شامل تغییرات همین دستگاه است و آخرین {300} مورد را نگه می‌دارد.
            </div>
          </div>
        )}
      </div>

      <div style={{ height: 24 }} />
    </div>
      {!hideFloatingSync && (
        <button
          style={{
            position: "fixed",
            bottom: 20,
            right: 20,
            width: 52,
            height: 52,
            borderRadius: "50%",
            background: "#8B1A1A",
            border: "none",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 40,
            cursor: "pointer",
            boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
            transition: "transform 0.1s",
            opacity: syncStatus === "syncing" ? 0.6 : 1,
          }}
          onClick={handleSync}
          disabled={syncStatus === "syncing"}
          title="همگام‌سازی دستی"
        >
          <RefreshCw size={22} className={syncStatus === "syncing" ? "animate-spin" : ""} />
        </button>
      )}
    </>
  );
}
