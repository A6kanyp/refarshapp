// ============================================================
// utils/imageHelpers.js - توابع کمکی برای مدیریت مسیر تصاویر
// ============================================================

export function getImageUrl(imageName) {
  if (!imageName) return null;
  // اگر base64 باشد، همان را برگردان
  if (imageName.startsWith('data:')) return imageName;
  // مسیر پایه را از localStorage دریافت کن
  const basePath = localStorage.getItem('refarsh_image_path') || '/images/';
  // اطمینان از وجود / در انتهای مسیر
  const path = basePath.endsWith('/') ? basePath : basePath + '/';
  return path + imageName;
}

export function getImageUrls(imageNames) {
  if (!imageNames || !Array.isArray(imageNames)) return [];
  return imageNames.map(name => getImageUrl(name)).filter(Boolean);
}