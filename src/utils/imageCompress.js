// src/utils/imageCompress.js
// ------------------------------------------------------------
// عکس‌های دوربین گوشی معمولاً چند مگابایتی و با ابعاد خیلی بزرگ هستن. تا الان
// هرجا عکسی مستقیم با FileReader.readAsDataURL خونده می‌شد، همون فایل خام
// (گاهی ۵-۱۰ مگابایت) به‌صورت base64 داخل دیتای برنامه (و localStorage)
// ذخیره می‌شد. نتیجه: وقتی چندتا از این عکس‌های سنگین با هم توی یک لیست
// (مثلاً باز کردن یک گالری با چند محصول عکس‌دار) رندر می‌شدن، روی گوشی
// (به‌خصوص اندروید WebView با حافظه محدود) اپ کرش می‌کرد؛ از طرفی چون
// ذخیره‌سازی اصلی برنامه localStorage است (سقفی حدود ۵-۱۰ مگابایت در اکثر
// مرورگرها/WebView ها)، همین چندتا عکس خام می‌تونست کل ظرفیت رو پر کنه.
//
// این تابع قبل از ذخیره، عکس رو روی یک بعد حداکثری (پیش‌فرض ۱۲۸۰ پیکسل ضلع
// بزرگ‌تر) کوچک و به JPEG با کیفیت ۰.۷۵ فشرده می‌کنه — که معمولاً حجم رو از
// چند مگابایت به چند صد کیلوبایت می‌رسونه، بدون افت محسوس کیفیت برای نمایش
// توی اپ.
// ------------------------------------------------------------

export function compressImageFile(file, { maxDim = 1280, quality = 0.75 } = {}) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type || !file.type.startsWith("image/")) {
      reject(new Error("فایل انتخاب‌شده تصویر نیست"));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error("خطا در خواندن فایل"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => {
        // اگه به هر دلیلی (فرمت غیرمعمول و...) نتونستیم decode/فشرده‌سازی کنیم،
        // همون data URL خام رو برمی‌گردونیم تا حداقل کارکرد قبلی حفظ بشه
        resolve(reader.result);
      };
      img.onload = () => {
        try {
          let { width, height } = img;
          if (width <= 0 || height <= 0) {
            resolve(reader.result);
            return;
          }
          if (width > maxDim || height > maxDim) {
            if (width >= height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL("image/jpeg", quality);
          // اگه به هر دلیلی خروجی فشرده‌شده از خودِ فایل اصلی بزرگ‌تر شد (فایل‌های
          // خیلی کوچیک/ساده)، همون نسخه‌ی اصلی رو نگه داریم
          resolve(dataUrl.length < reader.result.length ? dataUrl : reader.result);
        } catch (err) {
          resolve(reader.result);
        }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
