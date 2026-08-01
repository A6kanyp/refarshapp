// ============================================================
// scratchpad.js - Refarsh Clean
// ============================================================

export const SCRATCH_KEYS = {
  product: "scratch_product_edit",
  material: "scratch_material_edit",
};

const _timers = {};

export function saveScratch(key, data) {
  clearTimeout(_timers[key]);
  _timers[key] = setTimeout(() => {
    try { sessionStorage.setItem(key, JSON.stringify(data)); } catch (_) {}
  }, 700);
}

export function loadScratch(key) {
  try {
    const v = sessionStorage.getItem(key);
    return v ? JSON.parse(v) : null;
  } catch (_) { return null; }
}

export function clearScratch(key) {
  clearTimeout(_timers[key]);
  try { sessionStorage.removeItem(key); } catch (_) {}
}