// ============================================================
// syncManager.js - Client-Side Offline-First Synchronization
// ============================================================

import { loadData, saveData, migrateData } from "../dataModels";

const DELETED_REGISTRY_KEY = "refarsh_deleted_records_v1";
const SYNC_STATE_KEY = "refarsh_sync_state_v1";
export const API_BASE_URL_OVERRIDE_KEY = "refarsh_api_base_url_override";
// روی APK مسیر نسبی /api کار نمی‌کند — آدرس سرور را از env بگیر، مگر این‌که
// کاربر توی تب سینک یه آدرس دستی ذخیره کرده باشه (که همیشه اولویت داره)
const ENV_API_BASE = (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL)
  ? String(import.meta.env.VITE_API_BASE_URL).replace(/\/$/, "")
  : "";
export function getApiBase() {
  try {
    const saved = localStorage.getItem(API_BASE_URL_OVERRIDE_KEY);
    if (saved && saved.trim()) return saved.trim().replace(/\/$/, "");
  } catch (_) {}
  return ENV_API_BASE;
}
const apiUrl = (path) => `${getApiBase()}${path}`;

const AUDIT_LOG_MAX = 300;

// اسم قابل‌نمایش هر رکورد برای لاگ تغییرات (بر اساس فیلدهای رایج مدل‌های مختلف)
function entityDisplayName(item) {
  return item?.name || item?.label || item?.title || item?.buyerName || "بدون نام";
}

const ENTITY_LABELS = {
  products: "محصول",
  materials: "متریال",
  customers: "مشتری/گالری",
  equipment: "تجهیزات",
  workshopLinks: "لینک کارگاه",
  businessCards: "کارت‌ویزیت",
  invoiceDrafts: "پیش‌فاکتور",
  woodCuttingSessions: "نشست برش چوب",
};

// ── PERSISTENT TOMBSTONE REGISTRY (FOR OFFLINE DELETIONS) ──

export function getDeletedRegistry() {
  try {
    const raw = localStorage.getItem(DELETED_REGISTRY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error("Failed to load deleted registry:", err);
    return [];
  }
}

export function addDeletedRecord(id, type) {
  try {
    const registry = getDeletedRegistry();
    // Prevent duplicate entries
    if (!registry.some((item) => item.id === id)) {
      registry.push({
        id,
        type,
        deletedAt: Date.now(),
      });
      localStorage.setItem(DELETED_REGISTRY_KEY, JSON.stringify(registry));
    }
  } catch (err) {
    console.error("Failed to append to deleted registry:", err);
  }
}

export function clearDeletedRegistry(syncedIds = []) {
  try {
    const registry = getDeletedRegistry();
    const remaining = registry.filter((item) => !syncedIds.includes(item.id));
    localStorage.setItem(DELETED_REGISTRY_KEY, JSON.stringify(remaining));
  } catch (err) {
    console.error("Failed to clear deleted registry:", err);
  }
}

// ── LAST SYNC TIMESTAMP TRACKING ──

export function getLastSyncTime() {
  try {
    return parseInt(localStorage.getItem(SYNC_STATE_KEY) || "0", 10);
  } catch {
    return 0;
  }
}

export function setLastSyncTime(timestamp) {
  try {
    localStorage.setItem(SYNC_STATE_KEY, timestamp.toString());
  } catch (err) {
    console.error("Failed to set last sync timestamp:", err);
  }
}

// ── AUTOMATED STATE UPDATE PROCESSOR ──

export function processStateUpdate(prev, next) {
  if (!prev) return next;
  if (!next) return next;

  const now = Date.now();
  const processed = { ...next };
  // ردپای تغییرات: قبلاً فقط برای همگام‌سازی (تشخیص حذف‌شده‌ها + مهر زمان
  // updatedAt برای حل تضاد) استفاده می‌شد، ولی هیچ لاگ قابل‌مطالعه‌ای از
  // «چی، کِی، چه تغییری کرد» برای خودِ کاربر نگه نمی‌داشت. حالا از همین
  // مقایسه‌ی prev/next که به‌هرحال انجام می‌شه، یک آرایه‌ی ردپای تغییرات
  // (auditLog) هم می‌سازیم و به آخرین ۳۰۰ رکورد محدودش می‌کنیم.
  const newAuditEntries = [];

  // بخش ۱۴ (Wall 🟣): woodCuttingSessions اضافه شد — دقیقاً همون باگی که Ref
  // برای invoiceDrafts پیدا کرد: این مجموعه توی سرور پردازش نمی‌شد، پس هر
  // سینک همه‌ی نشست‌های ذخیره‌شده‌ی برش چوب رو پاک می‌کرد
  const collections = ["products", "materials", "customers", "equipment", "workshopLinks", "businessCards", "invoiceDrafts", "woodCuttingSessions"];

  // 1. Automatically detect deleted records (Tombstones)
  collections.forEach((key) => {
    const prevList = prev[key] || [];
    const nextList = next[key] || [];

    if (prevList.length > nextList.length) {
      const nextIds = new Set(nextList.map((item) => item?.id).filter(Boolean));
      prevList.forEach((item) => {
        if (item && item.id && !nextIds.has(item.id)) {
          // Record deleted item in the tombstone registry
          addDeletedRecord(item.id, key.replace(/s$/, "")); // e.g. "products" -> "product"
          newAuditEntries.push({
            id: `${now}-${item.id}-del`,
            date: now,
            entity: key,
            entityLabel: ENTITY_LABELS[key] || key,
            entityId: item.id,
            entityName: entityDisplayName(item),
            action: "deleted",
          });
        }
      });
    }
  });

  // 2. Automatically stamp added/changed records with updatedAt
  collections.forEach((key) => {
    if (!Array.isArray(processed[key])) return;
    const oldList = prev[key] || [];
    const oldMap = new Map(oldList.map((item) => [item.id, item]));

    processed[key] = processed[key].map((item) => {
      if (!item || !item.id) return item;

      const oldItem = oldMap.get(item.id);
      if (!oldItem) {
        // Brand new item created locally
        newAuditEntries.push({
          id: `${now}-${item.id}-new`,
          date: now,
          entity: key,
          entityLabel: ENTITY_LABELS[key] || key,
          entityId: item.id,
          entityName: entityDisplayName(item),
          action: "created",
        });
        return {
          ...item,
          updatedAt: item.updatedAt || now,
        };
      }

      // If object reference changed, check if it's actually modified
      if (item !== oldItem) {
        const itemStr = JSON.stringify({ ...item, updatedAt: undefined });
        const oldStr = JSON.stringify({ ...oldItem, updatedAt: undefined });

        if (itemStr !== oldStr) {
          // Truly modified record
          // If the item already has a fresh timestamp from a sync down, respect it
          const hasNewSyncTime = item.updatedAt !== oldItem.updatedAt && item.updatedAt > (oldItem.updatedAt || 0);
          // مهرِ زمانِ رسیده از سینک (دیتای دیگران) رو به‌عنوان یک تغییرِ محلی
          // ثبت نکنیم؛ فقط ویرایش‌های واقعی همین دستگاه توی لاگ می‌ره
          if (!hasNewSyncTime) {
            newAuditEntries.push({
              id: `${now}-${item.id}-upd`,
              date: now,
              entity: key,
              entityLabel: ENTITY_LABELS[key] || key,
              entityId: item.id,
              entityName: entityDisplayName(item),
              action: "updated",
            });
          }
          return {
            ...item,
            updatedAt: hasNewSyncTime ? item.updatedAt : now,
          };
        }
      }

      // Unchanged record, preserve old updatedAt (or stamp with current time if never stamped)
      return {
        ...item,
        updatedAt: item.updatedAt || oldItem.updatedAt || now,
      };
    });
  });

  // 3. Handle myBusinessCard singleton
  if (processed.myBusinessCard && processed.myBusinessCard.id) {
    const oldCard = prev.myBusinessCard;
    if (!oldCard || processed.myBusinessCard !== oldCard) {
      const itemStr = JSON.stringify({ ...processed.myBusinessCard, updatedAt: undefined });
      const oldStr = JSON.stringify({ ...oldCard, updatedAt: undefined });

      if (itemStr !== oldStr) {
        const hasNewSyncTime = processed.myBusinessCard.updatedAt !== oldCard?.updatedAt && processed.myBusinessCard.updatedAt > (oldCard?.updatedAt || 0);
        processed.myBusinessCard = {
          ...processed.myBusinessCard,
          updatedAt: hasNewSyncTime ? processed.myBusinessCard.updatedAt : now,
        };
      }
    }
  }

  if (newAuditEntries.length > 0) {
    const existingLog = Array.isArray(next.auditLog) ? next.auditLog : (Array.isArray(prev.auditLog) ? prev.auditLog : []);
    processed.auditLog = [...newAuditEntries, ...existingLog].slice(0, AUDIT_LOG_MAX);
  } else if (!Array.isArray(processed.auditLog)) {
    processed.auditLog = Array.isArray(prev.auditLog) ? prev.auditLog : [];
  }

  return processed;
}



// ── CORE SYNC ENGINE CLIENT FUNCTION ──
// این تابع قبلاً مستقیم از مرورگر به Firestore وصل می‌شد (بدون هیچ fallback ای)،
// در حالی که سرور (server.ts → /api/sync) از قبل پیاده‌سازی کامل و امن‌تری داشت:
// هم با توکن Firebase احراز هویت می‌کند، هم اگر Firestore روی پروژه فعال/provision
// نشده باشد به‌صورت خودکار روی یک دیتابیس محلی JSON روی خود سرور fallback می‌کند.
// چون کلاینت هیچ‌وقت این مسیر سرور را صدا نمی‌زد، همگام‌سازی عملاً کار نمی‌کرد.
export async function performSynchronization(localData, token, pendingChanges = []) {
  if (!navigator.onLine) {
    return { success: false, offline: true, error: "دستگاه آفلاین است" };
  }

  if (!token) {
    return { success: false, offline: false, error: "لطفاً وارد شوید" };
  }

  const deletedRecords = getDeletedRegistry();
  const deletedIds = deletedRecords.map((r) => ({ id: r.id, type: r.type }));

  try {
    const res = await fetch(apiUrl("/api/sync"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        clientData: localData,
        deletedIds,
        pendingChanges,
      }),
    });

    let body;
    try {
      body = await res.json();
    } catch (_) {
      body = null;
    }

    if (!res.ok) {
      const msg = body?.error || body?.details || `خطای سرور (${res.status})`;
      return { success: false, offline: false, error: msg };
    }

    if (!body?.success || !body?.serverData) {
      return { success: false, offline: false, error: "پاسخ نامعتبر از سرور همگام‌سازی" };
    }

    const migratedServerData = migrateData(body.serverData);

    const syncedIds = deletedRecords.map((r) => r.id);
    clearDeletedRegistry(syncedIds);
    setLastSyncTime(body.serverTime || Date.now());
    saveData(migratedServerData);

    return {
      success: true,
      offline: false,
      mergedData: migratedServerData,
    };
  } catch (err) {
    console.error("Sync API failure:", err);
    const msg = err?.message || "";
    const networkish =
      msg.includes("Failed to fetch") ||
      msg.includes("NetworkError") ||
      msg.includes("Network request failed") ||
      msg.includes("Load failed");
    return {
      success: false,
      offline: false,
      error: networkish
        ? "ارتباط با سرور برقرار نشد. VITE_API_BASE_URL را چک کن، سرور را روشن نگه دار، و اگر از گوشی تست می‌کنی IP سیستم را بگذار نه localhost."
        : (msg || "خطای ناشناخته در همگام‌سازی"),
    };
  }
}
