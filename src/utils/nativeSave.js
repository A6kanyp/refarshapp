// src/utils/nativeSave.js
// ذخیره فایل خروجی (فاکتور، برش ۱D/۲D، اکسل، JSON)
// روی وب: دانلود مرورگر
// روی اندروید: Documents/refarsh/<subdir>/ در صورت مشخص بودن subdir، وگرنه Share Sheet

function isNativeAndroid() {
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

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      const base64 = typeof result === "string" ? result.split(",")[1] || "" : "";
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function dataUrlToBlob(dataUrl) {
  const res = await fetch(dataUrl);
  return await res.blob();
}

function downloadInBrowser(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** زیرپوشه‌های ثابت داخل Documents/refarsh/ */
export const REFARSH_SAVE_DIRS = {
  BILLS_PDF: "factor/pdf",
  BILLS_IMAGE: "factor/image",
  NEST_1D: "1dnesting",
  NEST_2D: "2dnesting",
  IMAGES: "images",
  QR: "qr",
  CARDS: "cards",
};

/**
 * @param {Blob|string} data
 * @param {string} filename
 * @param {{ subdir?: string }} [opts] - مثلاً "bills" → Documents/refarsh/bills/
 */
export async function saveFile(data, filename, opts = {}) {
  let blob;
  try {
    if (typeof data === "string") {
      blob = await dataUrlToBlob(data);
    } else {
      blob = data;
    }
  } catch (e) {
    console.error("saveFile: convert failed", e);
    return false;
  }

  const subdir = opts.subdir || null;
  // share: true → بعد از ذخیره شیت اشتراک باز شود (پیش‌فرض false برای ذخیرهٔ مستقیم پوشه)
  const doShare = opts.share === true;

  if (isNativeAndroid()) {
    try {
      const { Filesystem, Directory } = await import("@capacitor/filesystem");
      const base64 = await blobToBase64(blob);
      const folder = subdir ? `refarsh/${subdir}` : "refarsh/exports";
      const path = `${folder}/${filename}`;

      try {
        await Filesystem.mkdir({
          path: folder,
          directory: Directory.Documents,
          recursive: true,
        });
      } catch (_) {}

      await Filesystem.writeFile({
        path,
        data: base64,
        directory: Directory.Documents,
      });

      if (doShare) {
        try {
          const { Share } = await import("@capacitor/share");
          const { uri } = await Filesystem.getUri({
            path,
            directory: Directory.Documents,
          });
          await Share.share({
            title: filename,
            url: uri,
            dialogTitle: "ذخیره / اشتراک فایل",
          });
        } catch (_) {}
      }
      return true;
    } catch (e) {
      console.error("saveFile native failed", e);
    }
  }

  downloadInBrowser(blob, filename);
  return true;
}

/** اشتراک فایل (PDF/تصویر) — ذخیره موقت + Share Sheet */
export async function shareFile(data, filename, opts = {}) {
  let blob;
  try {
    if (typeof data === "string") {
      blob = await dataUrlToBlob(data);
    } else {
      blob = data;
    }
  } catch (e) {
    console.error("shareFile: convert failed", e);
    return false;
  }

  if (isNativeAndroid()) {
    try {
      const { Filesystem, Directory } = await import("@capacitor/filesystem");
      const { Share } = await import("@capacitor/share");
      const base64 = await blobToBase64(blob);
      const folder = "refarsh/share_tmp";
      const path = `${folder}/${filename}`;
      try {
        await Filesystem.mkdir({ path: folder, directory: Directory.Cache, recursive: true });
      } catch (_) {}
      await Filesystem.writeFile({ path, data: base64, directory: Directory.Cache });
      const { uri } = await Filesystem.getUri({ path, directory: Directory.Cache });
      await Share.share({
        title: opts.title || filename,
        url: uri,
        dialogTitle: opts.dialogTitle || "اشتراک فایل",
      });
      return true;
    } catch (e) {
      console.error("shareFile native failed", e);
    }
  }

  // وب: تلاش برای Web Share API با فایل
  try {
    if (typeof navigator !== "undefined" && navigator.share && navigator.canShare) {
      const file = new File([blob], filename, { type: blob.type || "application/octet-stream" });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: opts.title || filename });
        return true;
      }
    }
  } catch (e) {
    if (e && e.name === "AbortError") return false;
  }

  downloadInBrowser(blob, filename);
  return true;
}

/**
 * اشتراک متن (فاکتور و غیره) — وب: Web Share API یا کپی؛ نیتیو: Capacitor Share
 * @param {{ title?: string, text?: string, url?: string }} opts
 */
export async function shareText(opts = {}) {
  const title = opts.title || "";
  const text = opts.text || "";
  const url = opts.url || "";

  if (isNativeAndroid()) {
    try {
      const { Share } = await import("@capacitor/share");
      await Share.share({
        title,
        text,
        url: url || undefined,
        dialogTitle: title || "اشتراک",
      });
      return true;
    } catch (e) {
      console.error("shareText native failed", e);
    }
  }

  try {
    if (typeof navigator !== "undefined" && navigator.share) {
      await navigator.share({ title, text, url: url || undefined });
      return true;
    }
  } catch (e) {
    if (e && e.name === "AbortError") return false;
  }

  try {
    if (typeof navigator !== "undefined" && navigator.clipboard && text) {
      await navigator.clipboard.writeText(text);
      return "clipboard";
    }
  } catch (_) {}

  return "failed";
}
