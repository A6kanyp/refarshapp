// src/utils/imageStorage.js
import { useState, useEffect } from "react";
// ------------------------------------------------------------
// بازطراحی ذخیره‌سازی عکس‌ها: به‌جای base64 مستقیم توی رکورد محصول/کارت‌ویزیت
// (که localStorage و سینک رو سنگین می‌کرد)، فقط اسم فایل ذخیره می‌شه و خودِ
// عکس از یه پوشه‌ی مشخص لود می‌شه.
//
// ⚠️ محدودیت فنی (با کاربر هماهنگ شد): اندروید مدرن (scoped storage) اجازه‌ی
// دسترسی به یه «مسیر دلخواه تایپ‌شده» رو نمی‌ده. به‌جاش از Directory.Documents
// (پوشه‌ای که Capacitor بدون پرمیشن خاص بهش دسترسی داره و با فایل‌منیجر گوشی هم
// دیده می‌شه) + یه زیرپوشه به اسمی که خودِ کاربر انتخاب می‌کنه استفاده می‌شه.
// ساختار داخلش دقیقاً: <زیرپوشه>/images, <زیرپوشه>/qr, <زیرپوشه>/cards
//
// روی وب/پیش‌نمایش (بدون Capacitor نیتیو)، دسترسی واقعی به یه پوشه‌ی دلخواه
// روی دیسک اصلاً امکان‌پذیر نیست (محدودیت خودِ مرورگره، نه این اپ) — برای این‌که
// معماریِ «فقط اسم فایل توی رکورد» همون‌جا هم کار کنه، از IndexedDB به‌عنوان
// fallback استفاده می‌شه (بدون سقف حجمی تنگ localStorage).
// ------------------------------------------------------------

// طبق تصمیم تازه‌ی کاربر: دیگه قابل تغییر نیست، همیشه یه پوشه‌ی ثابت به اسم
// «refarsh» داخل Documents ساخته می‌شه (کاربر خودش هم می‌تونه دستی بسازتش)
const DEFAULT_FOLDER_NAME = "refarsh";

export const IMAGE_CATEGORIES = {
  PRODUCT: "images",
  QR: "qr",
  CARD: "cards",
};

export function getImageFolderName() {
  return DEFAULT_FOLDER_NAME;
}

function isNativePlatform() {
  try {
    return !!(
      typeof window !== "undefined" &&
      window.Capacitor &&
      window.Capacitor.isNativePlatform &&
      window.Capacitor.isNativePlatform()
    );
  } catch {
    return false;
  }
}

function buildRelativePath(category, filename) {
  const folder = getImageFolderName();
  return `${folder}/${category}/${filename}`;
}

// ── IndexedDB fallback (وب/پیش‌نمایش) ──
const IDB_NAME = "refarsh_image_store";
const IDB_STORE = "files";

function openImageDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(key, blob) {
  const db = await openImageDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(blob, key);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

async function idbGet(key) {
  const db = await openImageDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const req = tx.objectStore(IDB_STORE).get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function idbDelete(key) {
  const db = await openImageDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).delete(key);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

async function idbListKeys() {
  const db = await openImageDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const req = tx.objectStore(IDB_STORE).getAllKeys();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

function dataUrlToBlob(dataUrl) {
  return fetch(dataUrl).then((r) => r.blob());
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      resolve(typeof result === "string" ? result.split(",")[1] || "" : "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * یه اسم فایل یکتا برای عکس جدید می‌سازه (چون فقط اسم فایل ذخیره می‌شه، باید
 * تضمین بشه دوتا عکس مختلف هم‌نام نشن)
 */
export function generateImageFilename(prefix = "img", ext = "jpg") {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now()}_${rand}.${ext}`;
}

/**
 * عکس رو ذخیره می‌کنه (فایل واقعی روی اندروید، IndexedDB روی وب) و اسم فایل
 * رو برمی‌گردونه — همین اسم باید توی رکورد محصول/کارت ذخیره بشه، نه خودِ عکس.
 * @param {string} dataUrlOrBlob - خروجی compressImageFile (data URL) یا یه Blob
 * @param {string} category - یکی از IMAGE_CATEGORIES
 * @param {string} [filename] - اگه ندی، خودکار ساخته می‌شه
 * @returns {Promise<string>} اسم فایل ذخیره‌شده
 */
export async function saveImageToFolder(dataUrlOrBlob, category, filename) {
  const finalFilename = filename || generateImageFilename(category);
  const blob = typeof dataUrlOrBlob === "string" ? await dataUrlToBlob(dataUrlOrBlob) : dataUrlOrBlob;

  if (isNativePlatform()) {
    const { Filesystem, Directory } = await import("@capacitor/filesystem");
    const base64Data = await blobToBase64(blob);
    await Filesystem.writeFile({
      path: buildRelativePath(category, finalFilename),
      data: base64Data,
      directory: Directory.Documents,
      recursive: true,
    });
  } else {
    await idbPut(`${category}/${finalFilename}`, blob);
  }
  return finalFilename;
}

// کش کوچیک برای src های حل‌شده تا هر رندر دوباره فایل رو نخونه/URI نسازه
const resolvedSrcCache = new Map();

/**
 * src قابل‌استفاده برای <img> رو برمی‌گردونه. چون خواندن فایل async هست،
 * این تابع یه Promise برمی‌گردونه — کامپوننت‌ها باید با useState/useEffect
 * (یا هوک useResolvedImageSrc پایین همین فایل) صداش بزنن.
 */
export async function getImageSrc(filename, category) {
  if (!filename) return null;
  const cacheKey = `${category}/${filename}`;
  if (resolvedSrcCache.has(cacheKey)) return resolvedSrcCache.get(cacheKey);

  let src = null;
  if (isNativePlatform()) {
    try {
      const { Filesystem, Directory } = await import("@capacitor/filesystem");
      const { Capacitor } = await import("@capacitor/core");
      const { uri } = await Filesystem.getUri({
        path: buildRelativePath(category, filename),
        directory: Directory.Documents,
      });
      src = Capacitor.convertFileSrc(uri);
    } catch (_) {
      src = null; // فایل پیدا نشد
    }
  } else {
    try {
      const blob = await idbGet(cacheKey);
      if (blob) src = URL.createObjectURL(blob);
    } catch (_) {
      src = null;
    }
  }
  resolvedSrcCache.set(cacheKey, src);
  return src;
}

/** لیست تمام فایل‌های موجود توی یه دسته (category) — روی هر دو پلتفرم (اندروید/وب) */
async function listFilesInCategory(category) {
  if (isNativePlatform()) {
    try {
      const { Filesystem, Directory } = await import("@capacitor/filesystem");
      const folder = getImageFolderName();
      const res = await Filesystem.readdir({ path: `${folder}/${category}`, directory: Directory.Documents });
      return (res.files || []).map((f) => (typeof f === "string" ? f : f.name)).filter(Boolean);
    } catch (_) {
      return [];
    }
  }
  try {
    const keys = await idbListKeys();
    const prefix = `${category}/`;
    return keys.filter((k) => k.startsWith(prefix)).map((k) => k.slice(prefix.length));
  } catch (_) {
    return [];
  }
}

/**
 * تشخیص خودکار عکس‌های یه کد محصول توی پوشه، طبق قرارداد نام‌گذاری «کد + شماره
 * دورقمی» — مثلاً کد ۰۰۰۴ → 000401.jpg, 000402.jpg, ... تا حداکثر ۹۹ عکس.
 * اگه پوشه/IndexedDB این فایل‌ها رو داشته باشه، بدون نیاز به آپلود دستی خودکار
 * پیدا و به لیست عکس‌های محصول اضافه می‌شن.
 * @param {string} code - کد محصول (مثلاً "0004"، از قبل ۴رقمی/padded)
 * @returns {Promise<string[]>} اسم فایل‌های پیدا‌شده، به ترتیب شماره
 */
export async function autoDetectImagesForCode(code) {
  const codeStr = String(code || "").trim();
  if (!codeStr) return [];
  const files = await listFilesInCategory(IMAGE_CATEGORIES.PRODUCT);
  const re = new RegExp(`^${codeStr}(\\d{2})\\.[a-zA-Z0-9]+$`);
  const matches = [];
  for (const f of files) {
    const m = f.match(re);
    if (m) matches.push({ file: f, idx: parseInt(m[1], 10) });
  }
  matches.sort((a, b) => a.idx - b.idx);
  return matches.map((m) => m.file);
}


export async function imageFileExists(filename, category) {
  if (!filename) return false;
  if (isNativePlatform()) {
    try {
      const { Filesystem, Directory } = await import("@capacitor/filesystem");
      await Filesystem.stat({ path: buildRelativePath(category, filename), directory: Directory.Documents });
      return true;
    } catch (_) {
      return false;
    }
  }
  try {
    const blob = await idbGet(`${category}/${filename}`);
    return !!blob;
  } catch (_) {
    return false;
  }
}

export async function deleteImageFile(filename, category) {
  if (!filename) return;
  if (isNativePlatform()) {
    try {
      const { Filesystem, Directory } = await import("@capacitor/filesystem");
      await Filesystem.deleteFile({ path: buildRelativePath(category, filename), directory: Directory.Documents });
    } catch (_) {
      // فایل از قبل نبوده، مشکلی نیست
    }
  } else {
    await idbDelete(`${category}/${filename}`).catch(() => {});
  }
  resolvedSrcCache.delete(`${category}/${filename}`);
}

/** برای اکسپورت کامل: همه‌ی فایل‌های ذخیره‌شده (فقط روی وب/IndexedDB — روی
 * اندروید خودِ پوشه از طریق فایل‌منیجر/بک‌آپ گوگل قابل‌دسترسیه) */
export async function listAllStoredImageKeys() {
  if (isNativePlatform()) return []; // نیازی نیست، پوشه خودش قابل‌بک‌آپ‌گیریه
  try {
    return await idbListKeys();
  } catch (_) {
    return [];
  }
}

// ── هوک React برای استفاده‌ی راحت توی کامپوننت‌ها ──
// چون خواندن فایل async هست، این هوک src رو در دو مرحله برمی‌گردونه: اول null
// (تا لودینگ نشون داده بشه)، بعد src واقعی وقتی resolve شد.
export function useResolvedImageSrc(filename, category) {
  // undefined = هنوز در حال resolve؛ null = فایل نیست؛ string = آدرس آماده
  const [src, setSrc] = useState(undefined);
  useEffect(() => {
    let cancelled = false;
    if (!filename) {
      setSrc(null);
      return;
    }
    setSrc(undefined);
    getImageSrc(filename, category).then((resolved) => {
      if (!cancelled) setSrc(resolved || null);
    }).catch(() => {
      if (!cancelled) setSrc(null);
    });
    return () => {
      cancelled = true;
    };
  }, [filename, category]);
  return src;
}
