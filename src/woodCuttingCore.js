// ============================================================
// MODULE: woodCuttingCore.js
// VERSION: 2.3.0-stable
// ============================================================
import { toNum } from "./mathCore";

export const FRAME_TYPES = {
  FOUR_SIDE:  "4side",
  THREE_SIDE: "3side",
  SINGLE:     "single",
};

export const applyKerf = (val, kerf) => Math.round((toNum(val) + toNum(kerf)) * 100) / 100;
export const r2 = (v) => Math.round(toNum(v) * 100) / 100;

export function getFramePieces(frameType, w, h, thickness, qty = 1, isSemiCircle = false) {
  const t = r2(thickness);
  const W = r2(w);
  const H = r2(h);
  const Q = Math.max(1, Math.round(toNum(qty)));
  const pieces = [];

  if (frameType === FRAME_TYPES.FOUR_SIDE) {
    if (!W && !H) return pieces;
    for (let i = 0; i < Q; i++) {
      pieces.push({ length: r2(W + 2 * t), cutType: "double", role: "عرض", axis: "W", miterLeft: true, miterRight: true });
      pieces.push({ length: r2(W + 2 * t), cutType: "double", role: "عرض", axis: "W", miterLeft: true, miterRight: true });
      pieces.push({ length: r2(H + 2 * t), cutType: "double", role: "ارتفاع", axis: "H", miterLeft: true, miterRight: true });
      pieces.push({ length: r2(H + 2 * t), cutType: "double", role: "ارتفاع", axis: "H", miterLeft: true, miterRight: true });
    }
  } else if (frameType === FRAME_TYPES.THREE_SIDE) {
    if (!W && !H) return pieces;
    for (let i = 0; i < Q; i++) {
      pieces.push({ length: r2(H + t), cutType: "single", role: "طرفین ×2", axis: "H", miterLeft: true, miterRight: false });
      pieces.push({ length: r2(H + t), cutType: "single", role: "طرفین ×2", axis: "H", miterLeft: true, miterRight: false });
      pieces.push({ length: r2(W + 2 * t), cutType: "double", role: "اتصال ×1", axis: "W", miterLeft: true, miterRight: true });
    }
  } else if (frameType === FRAME_TYPES.SINGLE) {
    if (!W) return pieces;
    // تک‌چوب: همیشه برش مستقیم (بدون مایتر) با رنگ قرمز
    const length = isSemiCircle ? r2(W + 2 * t) : W;
    for (let i = 0; i < Q; i++) {
      pieces.push({
        length: length,
        cutType: "none",
        role: "تک چوب",
        axis: "W",
        miterLeft: false,
        miterRight: false,
      });
    }
  }
  return pieces;
}

export function getBackingSheetSize(frameType, w, h, thickness) {
  if (frameType === FRAME_TYPES.SINGLE) return null;
  const t = r2(thickness);
  const W = r2(w);
  const H = r2(h);
  if (!W || !H) return null;
  const addon = r2(t * 2 - 1);
  return { sheetW: r2(W + addon), sheetH: r2(H + addon) };
}

export function nestBackingPanelsManual(panels, availableStocks, kerf = 0) {
  const K = r2(kerf);
  if (!panels.length) return { sheetCount: 0, layouts: [] };

  const stockInstances = [];
  (availableStocks || []).forEach((s, idx) => {
    const sw = r2(s.w);
    const sh = r2(s.h);
    if (sw > 0 && sh > 0) {
      for (let i = 0; i < Math.max(1, toNum(s.qty)); i++) {
        const w = Math.max(sw, sh);
        const h = Math.min(sw, sh);
        stockInstances.push({ w, h, id: `stock-${idx}-${i}` });
      }
    }
  });

  stockInstances.sort((a, b) => (a.w * a.h) - (b.w * b.h));

  const expanded = [];
  panels.forEach(({ sheetW, sheetH, qty = 1, label = "", isSemiCircle = false, isCircle = false }) => {
    const pw = r2(sheetW);
    const ph = r2(sheetH);
    if (pw <= 0 || ph <= 0) return;
    for (let i = 0; i < Math.max(1, toNum(qty)); i++) {
      expanded.push({ w: pw, h: ph, label, isSemiCircle, isCircle });
    }
  });

  expanded.sort((a, b) => (b.w * b.h) - (a.w * a.h));

  const sheets = [];

  expanded.forEach((item) => {
    let placed = false;

    for (let sIdx = 0; sIdx < sheets.length; sIdx++) {
      const s = sheets[sIdx];
      const SW = s.w;
      const SH = s.h;

      let bestPlacement = null;
      let bestScore = Infinity;

      const orientations = [];
      orientations.push({ w: item.w, h: item.h, rotated: false });
      if (item.w !== item.h) {  // نیم‌دایره هم می‌تونه ۹۰ درجه بچرخه تا بهتر جا بشه
        orientations.push({ w: item.h, h: item.w, rotated: true });
      }

      for (const orient of orientations) {
        const pw = orient.w;
        const ph = orient.h;

        for (const pt of s.candidates) {
          const x = pt.x;
          const y = pt.y;

          if (x + pw > SW || y + ph > SH) continue;

          let overlap = false;
          for (const p of s.placements) {
            if (!(x + pw + K <= p.x || p.x + p.w + K <= x || y + ph + K <= p.y || p.y + p.h + K <= y)) {
              overlap = true;
              break;
            }
          }

          if (!overlap) {
            // اولویت با پرشدن عرض چوب (Y) قبل از رفتن روی طول (X) — قبلاً برعکس بود
            const score = x * 100000 + y;
            if (score < bestScore) {
              bestScore = score;
              bestPlacement = { x, y, w: pw, h: ph, rotated: orient.rotated };
            }
          }
        }
      }

      if (bestPlacement) {
        s.placements.push({
          ...item,
          x: bestPlacement.x,
          y: bestPlacement.y,
          w: bestPlacement.w,
          h: bestPlacement.h,
          rotated: bestPlacement.rotated,
        });

        const newCandidates = [
          { x: r2(bestPlacement.x + bestPlacement.w + K), y: bestPlacement.y },
          { x: bestPlacement.x, y: r2(bestPlacement.y + bestPlacement.h + K) }
        ];

        s.candidates = s.candidates.filter(pt => {
          return !(pt.x >= bestPlacement.x && pt.x < r2(bestPlacement.x + bestPlacement.w) &&
                   pt.y >= bestPlacement.y && pt.y < r2(bestPlacement.y + bestPlacement.h));
        });

        s.candidates.push(...newCandidates);

        const seen = new Set();
        s.candidates = s.candidates.filter(pt => {
          const key = `${r2(pt.x)},${r2(pt.y)}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        placed = true;
        break;
      }
    }

    if (placed) return;

    let bestStockIdx = -1;
    let bestStockPlacement = null;

    for (let idx = 0; idx < stockInstances.length; idx++) {
      const stock = stockInstances[idx];
      const SW = stock.w;
      const SH = stock.h;

      const orientations = [];
      orientations.push({ w: item.w, h: item.h, rotated: false });
      if (item.w !== item.h) {  // نیم‌دایره هم می‌تونه ۹۰ درجه بچرخه تا بهتر جا بشه
        orientations.push({ w: item.h, h: item.w, rotated: true });
      }

      for (const orient of orientations) {
        if (orient.w <= SW && orient.h <= SH) {
          bestStockIdx = idx;
          bestStockPlacement = { x: 0, y: 0, w: orient.w, h: orient.h, rotated: orient.rotated };
          break;
        }
      }
      if (bestStockIdx !== -1) break;
    }

    if (bestStockIdx !== -1) {
      const stock = stockInstances.splice(bestStockIdx, 1)[0];
      const newSheet = {
        w: stock.w,
        h: stock.h,
        placements: [{
          ...item,
          x: bestStockPlacement.x,
          y: bestStockPlacement.y,
          w: bestStockPlacement.w,
          h: bestStockPlacement.h,
          rotated: bestStockPlacement.rotated,
        }],
        candidates: [
          { x: r2(bestStockPlacement.x + bestStockPlacement.w + K), y: bestStockPlacement.y },
          { x: bestStockPlacement.x, y: r2(bestStockPlacement.y + bestStockPlacement.h + K) }
        ]
      };
      sheets.push(newSheet);
    } else {
      if (!sheets.unfulfilled) sheets.unfulfilled = [];
      sheets.unfulfilled.push(item);
    }
  });

  const layouts = sheets.map((s) => {
    return { placements: s.placements, freeRects: [], stockW: s.w, stockH: s.h };
  });

  return { sheetCount: layouts.length, layouts, unfulfilled: sheets.unfulfilled || [] };
}

export function nestBackingPanels(panels, availableStocks, kerf = 0, mode = "machine") {
  if (mode === "manual") {
    return nestBackingPanelsManual(panels, availableStocks, kerf);
  }
  const K = r2(kerf);
  if (!panels.length) return { sheetCount: 0, layouts: [] };

  const stockInstances = [];
  (availableStocks || []).forEach((s, idx) => {
    const sw = r2(s.w);
    const sh = r2(s.h);
    if (sw > 0 && sh > 0) {
      for (let i = 0; i < Math.max(1, toNum(s.qty)); i++) {
        // Always store as landscape internally for stock 
        const w = Math.max(sw, sh);
        const h = Math.min(sw, sh);
        stockInstances.push({ w, h, id: `stock-${idx}-${i}` });
      }
    }
  });

  // Sort stock from smallest area to largest to minimize waste
  stockInstances.sort((a, b) => (a.w * a.h) - (b.w * b.h));

  const expanded = [];
  panels.forEach(({ sheetW, sheetH, qty = 1, label = "", isSemiCircle = false, isCircle = false }) => {
    const pw = r2(sheetW);
    const ph = r2(sheetH);
    if (pw <= 0 || ph <= 0) return;
    for (let i = 0; i < Math.max(1, toNum(qty)); i++) {
      expanded.push({ w: pw, h: ph, label, isSemiCircle, isCircle });
    }
  });

  // یک بار با ترتیب چیدمان اجرا می‌شه و چینش نهایی (شیت‌ها + کمبود) رو برمی‌گردونه
  function runShelfPacking(sortedItems, stockInstancesForRun) {
    const stockInstances = stockInstancesForRun.map((s) => ({ ...s }));
    const sheets = [];

    function getOrientations(item) {
      const o1 = { w: item.w, h: item.h, rotated: false };
      const o2 = { w: item.h, h: item.w, rotated: true };
      if (item.w === item.h) {
        // مربع/دایره کامل: چرخوندن فرقی نمی‌کنه
        return [o1];
      }
      // نیم‌دایره هم مثل بقیه‌ی تکه‌ها می‌تونه ۹۰ درجه بچرخه تا بهتر جا بشه
      // Prefer height to be the LARGER dimension to create tall shelves
      return item.h > item.w ? [o1, o2] : [o2, o1];
    }

    // فقط توی شیت‌های از قبل بازشده جا می‌ده (نه ساخت شیت جدید). اگه جا شد، sheets رو
    // مستقیم تغییر می‌ده و true برمی‌گردونه. برای چک‌کردن پرشدن جای خالی صفحات موجود
    // (هم موقع پردازش عادی هر تکه، هم موقع پاس تکمیلی قبل از باز کردن صفحه‌ی جدید) استفاده می‌شه.
    function tryPlaceInExistingSheets(item) {
      const orientations = getOrientations(item);

      // جا کردن توی فضای باقیمونده‌ی یه ردیف (شلف) موجود
      for (const orient of orientations) {
        for (const s of sheets) {
          if (s.overflow) continue;
          if (orient.w > s.w || orient.h > s.h) continue;
          for (const shelf of s.shelves) {
            if (shelf.overflow) continue;
            const usedW = shelf.items.reduce((sum, it) => sum + it.w, 0) + shelf.items.length * K;
            const remainingW = r2(s.w - usedW);
            if (orient.h <= shelf.h && orient.w <= remainingW) {
              shelf.items.push({ ...item, w: orient.w, h: orient.h, rotated: orient.rotated });
              return true;
            }
          }
        }
      }

      // ساخت یه ردیف (شلف) جدید توی یکی از صفحات موجود (نه صفحه‌ی تازه)
      for (const orient of orientations) {
        for (const s of sheets) {
          if (s.overflow) continue;
          if (orient.w > s.w || orient.h > s.h) continue;
          const nextY = r2(s.usedH + (s.shelves.length ? K : 0));
          if (r2(nextY + orient.h) <= s.h) {
            s.shelves.push({ y: nextY, h: orient.h, items: [{ ...item, w: orient.w, h: orient.h, rotated: orient.rotated }] });
            s.usedH = r2(nextY + orient.h);
            return true;
          }
        }
      }

      return false;
    }

    // صف قابل‌تغییر: هر بار یه تکه از جلو برداشته می‌شه؛ برخلاف forEach ساده، این اجازه می‌ده
    // موقع باز کردن صفحه‌ی جدید، بقیه‌ی صف رو دوباره چک کنیم و چیزهایی که جا هستن رو زودتر خارج کنیم.
    const queue = [...sortedItems];

    while (queue.length) {
      const item = queue.shift();

      if (tryPlaceInExistingSheets(item)) continue;

      // قبل از باز کردن صفحه‌ی جدید: یک پاس اضافه روی کل صف باقی‌مونده (از کوچیک به بزرگ)
      // تا هر تکه‌ای که توی فضای خالی صفحات *موجود* جا می‌شه رو زودتر جا بدیم — همون راه‌حلی
      // که برای مشکل «صفحه‌ی جدید فقط با یه تکه‌ی تنها باز می‌شه در حالی که صفحه‌ی قبلی هنوز
      // جا داشت» قبلاً توی ROADMAP توضیح داده شده بود.
      if (queue.length) {
        const bySize = [...queue].sort((a, b) => Math.max(a.w, a.h) - Math.max(b.w, b.h));
        for (const filler of bySize) {
          if (tryPlaceInExistingSheets(filler)) {
            const idx = queue.indexOf(filler);
            if (idx !== -1) queue.splice(idx, 1);
          }
        }
      }

      // بعد از پاس تکمیلی، دوباره امتحان کن (فضای بیشتری پر شده، ولی برای خودِ این تکه معمولاً
      // فرقی نمی‌کنه چون قبلاً هیچ‌جا جا نشده بود؛ این چک فقط برای اطمینانه)
      if (tryPlaceInExistingSheets(item)) continue;

      // باز کردن صفحه‌ی جدید از استوک‌های موجود
      const orientations = getOrientations(item);
      let placed = false;
      for (const orient of orientations) {
        const idx = stockInstances.findIndex(s => orient.w <= s.w && orient.h <= s.h);
        if (idx !== -1) {
          const stock = stockInstances.splice(idx, 1)[0];
          sheets.push({
            w: stock.w,
            h: stock.h,
            shelves: [{ y: 0, h: orient.h, items: [{ ...item, w: orient.w, h: orient.h, rotated: orient.rotated }] }],
            usedH: orient.h
          });
          placed = true;
          break;
        }
      }

      // اگه استوک مناسب نبود یا تموم شده بود، توی لیست «کمبود» بذارش
      if (!placed) {
        if (!sheets.unfulfilled) sheets.unfulfilled = [];
        sheets.unfulfilled.push(item);
      }
    }

    const validSheets = sheets.filter(s => !s.overflow);
    let wastedArea = 0;
    const layouts = validSheets.map((s) => {
      const placements = [];
      let usedArea = 0;
      s.shelves.forEach((shelf) => {
        let x = 0;
        shelf.items.forEach((it, idx) => {
          if (idx > 0) x = r2(x + K);
          placements.push({
            x,
            y: shelf.y,
            w: it.w,
            h: it.h,
            label: it.label,
            isSemiCircle: it.isSemiCircle || false,
            isCircle: it.isCircle || false,
            rotated: it.rotated || false,
          });
          usedArea += it.w * it.h;
          x = r2(x + it.w);
        });
      });
      wastedArea += (s.w * s.h) - usedArea;
      return { placements, freeRects: [], stockW: s.w, stockH: s.h };
    });

    return {
      sheetCount: layouts.length,
      layouts,
      unfulfilled: sheets.unfulfilled || [],
      wastedArea,
    };
  }

  // ── موتور دوم (قوی‌تر): guillotine free-rectangle packing ──
  // برخلاف shelf-packing (که فضا رو به نوارهای افقی با ارتفاع ثابت تقسیم می‌کنه و
  // تکه‌های با ابعاد نزدیک به هم رو گاهی توی نوارهای جدا می‌ندازه)، این روش فضای خالی
  // هر صفحه رو به‌صورت یه لیست مستطیل آزاد نگه می‌داره؛ هر تکه توی «بهترین» مستطیل آزاد
  // (کمترین فضای هدررفته) جا می‌شه و باقی‌مونده‌ش با یه برش کامل (guillotine — همون‌جوری
  // که دستگاه واقعی برش می‌ده) به دو مستطیل آزاد جدید تقسیم می‌شه. این دقیقاً مسئله‌ی
  // «۲ تکه‌ی ۲۳ + ۱ تکه‌ی ۲۱ که باید در عرض چیده بشن» رو حل می‌کنه، چون امتحان‌کردن *همه‌ی*
  // مستطیل‌های آزاد (نه فقط اولین نواری که جا می‌شه) باعث می‌شه تکه‌های هم‌اندازه معمولاً
  // کنار هم قرار بگیرن.
  function runGuillotinePacking(sortedItems, stockInstancesForRun, splitAxis) {
    const stockInstances = stockInstancesForRun.map((s) => ({ ...s }));
    const sheets = [];

    function getOrientations(item) {
      if (item.w === item.h) return [{ w: item.w, h: item.h, rotated: false }];
      return [
        { w: item.w, h: item.h, rotated: false },
        { w: item.h, h: item.w, rotated: true },
      ];
    }

    // مستطیل باقی‌مونده رو با یه برش کامل (guillotine) به دو مستطیل آزاد تقسیم می‌کنه.
    // splitAxis: "short" = برش در جهتی که کوتاه‌ترین نوار جدا رو تولید کنه (استاندارد و معمولاً بهتر)
    //            "long"  = برعکسش، به‌عنوان یه گزینه‌ی جایگزین برای امتحان کردن
    function splitFreeRect(fr, iw, ih) {
      const rects = [];
      const rightW = r2(fr.w - iw - K);
      const topH = r2(fr.h - ih - K);
      const chooseHorizontalFirst = splitAxis === "short"
        ? (fr.w - iw) <= (fr.h - ih)
        : (fr.w - iw) > (fr.h - ih);

      if (chooseHorizontalFirst) {
        // نوار بالا کل عرض رو می‌گیره، نوار کناری فقط هم‌ارتفاع تکه‌ست
        if (topH > 0.01) rects.push({ x: fr.x, y: r2(fr.y + ih + K), w: fr.w, h: topH });
        if (rightW > 0.01) rects.push({ x: r2(fr.x + iw + K), y: fr.y, w: rightW, h: ih });
      } else {
        // نوار کناری کل ارتفاع رو می‌گیره، نوار بالا فقط هم‌عرضِ تکه‌ست
        if (rightW > 0.01) rects.push({ x: r2(fr.x + iw + K), y: fr.y, w: rightW, h: fr.h });
        if (topH > 0.01) rects.push({ x: fr.x, y: r2(fr.y + ih + K), w: iw, h: topH });
      }
      return rects;
    }

    // بهترین مستطیل آزاد (توی همه‌ی صفحات بازشده) رو برای این تکه پیدا می‌کنه — امتیاز بر اساس
    // کمترین فضای هدررفته (Best Area Fit)
    function tryPlaceInExistingSheets(item) {
      const orientations = getOrientations(item);
      let best = null;
      for (const orient of orientations) {
        for (const s of sheets) {
          if (s.overflow) continue;
          for (let i = 0; i < s.freeRects.length; i++) {
            const fr = s.freeRects[i];
            if (orient.w <= fr.w + 0.001 && orient.h <= fr.h + 0.001) {
              const leftoverArea = fr.w * fr.h - orient.w * orient.h;
              if (!best || leftoverArea < best.leftoverArea) {
                best = { sheet: s, frIdx: i, orient, leftoverArea };
              }
            }
          }
        }
      }
      if (!best) return false;
      const { sheet, frIdx, orient } = best;
      const fr = sheet.freeRects[frIdx];
      sheet.placements.push({ ...item, x: fr.x, y: fr.y, w: orient.w, h: orient.h, rotated: orient.rotated });
      sheet.freeRects.splice(frIdx, 1);
      sheet.freeRects.push(...splitFreeRect(fr, orient.w, orient.h));
      return true;
    }

    const queue = [...sortedItems];

    while (queue.length) {
      const item = queue.shift();

      if (tryPlaceInExistingSheets(item)) continue;

      // همون پاس تکمیلی: قبل از باز کردن صفحه‌ی جدید، ببین کوچیک‌ترهای باقی‌مونده جا می‌شن یا نه
      if (queue.length) {
        const bySize = [...queue].sort((a, b) => Math.max(a.w, a.h) - Math.max(b.w, b.h));
        for (const filler of bySize) {
          if (tryPlaceInExistingSheets(filler)) {
            const idx = queue.indexOf(filler);
            if (idx !== -1) queue.splice(idx, 1);
          }
        }
      }

      if (tryPlaceInExistingSheets(item)) continue;

      const orientations = getOrientations(item);
      let placed = false;
      for (const orient of orientations) {
        const idx = stockInstances.findIndex(s => orient.w <= s.w && orient.h <= s.h);
        if (idx !== -1) {
          const stock = stockInstances.splice(idx, 1)[0];
          const sheet = { w: stock.w, h: stock.h, placements: [], freeRects: [{ x: 0, y: 0, w: stock.w, h: stock.h }] };
          sheet.placements.push({ ...item, x: 0, y: 0, w: orient.w, h: orient.h, rotated: orient.rotated });
          sheet.freeRects = splitFreeRect(sheet.freeRects[0], orient.w, orient.h);
          sheets.push(sheet);
          placed = true;
          break;
        }
      }

      if (!placed) {
        if (!sheets.unfulfilled) sheets.unfulfilled = [];
        sheets.unfulfilled.push(item);
      }
    }

    const validSheets = sheets.filter(s => !s.overflow);
    let wastedArea = 0;
    const layouts = validSheets.map((s) => {
      let usedArea = 0;
      s.placements.forEach(p => { usedArea += p.w * p.h; });
      wastedArea += (s.w * s.h) - usedArea;
      return {
        placements: s.placements.map(p => ({
          x: p.x, y: p.y, w: p.w, h: p.h,
          label: p.label, isSemiCircle: p.isSemiCircle || false, isCircle: p.isCircle || false, rotated: p.rotated || false,
        })),
        freeRects: [],
        stockW: s.w,
        stockH: s.h,
      };
    });

    return { sheetCount: layouts.length, layouts, unfulfilled: sheets.unfulfilled || [], wastedArea };
  }


  // بازمحاسبه‌ی کامل با چند ترتیب/الگوریتم چیدمان مختلف (نه فقط یک حریصانه‌ی ساده)، و انتخاب
  // هرکدوم که کمتر شیت مصرف کنه (و در تساوی، کمتر هدررفت داشته باشه). حل مطلقاً بهینه (bin-packing
  // واقعی) یه مسئله‌ی NP-hard جداست که هیچ الگوریتمی تضمین «بهترین ممکن» نمی‌ده؛ این چند تا
  // استراتژی رو امتحان می‌کنه (شامل guillotine واقعی که فضای خالی رو مستطیل‌به‌مستطیل نگه می‌داره،
  // نه فقط نوار افقی ثابت) و بهترین‌شون رو نگه می‌داره — که در عمل خیلی به بهینه نزدیک‌تره.
  const byMaxDim = [...expanded].sort((a, b) => {
    const maxA = Math.max(a.w, a.h);
    const maxB = Math.max(b.w, b.h);
    if (maxA !== maxB) return maxB - maxA;
    const minA = Math.min(a.w, a.h);
    const minB = Math.min(b.w, b.h);
    return minB - minA;
  });
  const byArea = [...expanded].sort((a, b) => (b.w * b.h) - (a.w * a.h));

  // ترتیب سوم: تکه‌هایی که یه بعدشون (کوچیک‌ترین یا بزرگ‌ترین بعد) با هم برابره رو کنار هم
  // می‌ذاره — دقیقاً برای سناریوهایی مثل «۲ تکه‌ی ۲۳ + ۱ تکه‌ی ۲۱» که باید هم‌اندازه‌ها با هم
  // یه ردیف/فضا رو پر کنن، نه اینکه فقط بر اساس مساحت/بزرگی جدا از هم پردازش بشن.
  const byMatchingDim = [...expanded].sort((a, b) => {
    const minA = Math.min(a.w, a.h), minB = Math.min(b.w, b.h);
    const maxA = Math.max(a.w, a.h), maxB = Math.max(b.w, b.h);
    if (minA !== minB) return minA - minB;
    return maxB - maxA;
  });

  const attempts = [
    ...[byMaxDim, byArea, byMatchingDim].map((order) => runShelfPacking(order, stockInstances)),
    ...[byMaxDim, byArea, byMatchingDim].flatMap((order) => [
      runGuillotinePacking(order, stockInstances, "short"),
      runGuillotinePacking(order, stockInstances, "long"),
    ]),
  ];

  const best = attempts.reduce((best, cur) => {
    if (!best) return cur;
    if (cur.unfulfilled.length !== best.unfulfilled.length) return cur.unfulfilled.length < best.unfulfilled.length ? cur : best;
    if (cur.sheetCount !== best.sheetCount) return cur.sheetCount < best.sheetCount ? cur : best;
    return cur.wastedArea < best.wastedArea ? cur : best;
  }, null);

  return { sheetCount: best.sheetCount, layouts: best.layouts, unfulfilled: best.unfulfilled };
}

export function optimizeCutting(sticks, requiredPiecesObj, kerf = 0.3) {
  const K = r2(kerf);
  const baseStockInstances = [];
  (sticks || []).forEach((s) => {
    for (let i = 0; i < Math.max(1, toNum(s.qty)); i++) {
      if (toNum(s.length) > 0) baseStockInstances.push({ length: r2(s.length), id: `${s.id}-${i}` });
    }
  });
  baseStockInstances.sort((a, b) => a.length - b.length);

  function runOnePass(pieces, stockInstancesInput) {
  const stockInstances = stockInstancesInput.map(s => ({ ...s }));
  const bins = [];

  const getPieceCostInBin = (bin, piece) => {
    const lastCut = bin && bin.cuts && bin.cuts.length > 0 ? bin.cuts[bin.cuts.length - 1] : null;
    const thickness = toNum(piece.thickness) || 2.5;

    // NOTE: within a single mitered piece, the left and right edges are cut at
    // MIRRORED angles (a real frame piece is a symmetric trapezoid, not a
    // parallelogram) — so "right" is always the opposite category of "left"
    // for the same flip state. Two adjacent pieces on the same stick share the
    // literal same saw cut, so piece(i).right must equal piece(i+1).left
    // (same category) to be considered a matched/nested miter joint.
    const R_prev = (!lastCut || !lastCut.miterRight) ? 'flat' : (lastCut.flipped ? 'pos' : 'neg');

    // A piece with only ONE mitered end (e.g. "single" cuts) can physically be
    // laid on the stick with that mitered end facing either left or right —
    // that's an independent choice from the up/down mirror flip. Together
    // these give the 4 possible shapes: |===\ \===| |===/ /===|
    // Pieces with both ends the same (double: both mitered, none: both flat)
    // only have one meaningful left/right arrangement.
    const orientationVariants = piece.miterLeft !== piece.miterRight
      ? [
          { miterLeft: piece.miterLeft, miterRight: piece.miterRight },
          { miterLeft: piece.miterRight, miterRight: piece.miterLeft },
        ]
      : [{ miterLeft: piece.miterLeft, miterRight: piece.miterRight }];

    let best = null;

    orientationVariants.forEach((v) => {
      [false, true].forEach((flipped) => {
        const leftSlope = !v.miterLeft ? 'flat' : (flipped ? 'neg' : 'pos');
        const rightSlope = !v.miterRight ? 'flat' : (flipped ? 'pos' : 'neg');

        let overlap = 0;
        let penalty = 0;
        let cost;

        if (R_prev === leftSlope) {
          if (R_prev === 'flat') {
            overlap = 0;
            cost = piece.length + K;
            penalty = 0;
          } else {
            overlap = thickness;
            cost = piece.length - thickness + K;
            penalty = 0;
          }
        } else {
          overlap = 0;
          cost = piece.length + thickness + K;
          if (R_prev !== 'flat' && leftSlope !== 'flat') {
            // Both are miters but opposite slopes (clash)
            penalty = 100;
          } else {
            // One is flat, one is miter (normal transition, no clash)
            penalty = 0;
          }
        }

        const candidate = {
          flipped,
          overlap,
          cost: r2(cost),
          penalty,
          finalMiterLeft: v.miterLeft,
          finalMiterRight: v.miterRight,
        };

        if (!best || (candidate.cost + candidate.penalty) < (best.cost + best.penalty)) {
          best = candidate;
        }
      });
    });

    return best;
  };

  // پیدا کردن بهترین بین (چوب از قبل بازشده) برای یه تکه، بدون commit کردنش —
  // هم توی پردازش عادی هر تکه استفاده می‌شه، هم برای چک‌کردن تکه‌ی جایگزین موقع سواپ زیر.
  function findBestBin(piece) {
    let bestBinIdx = -1;
    let bestScore = Infinity;
    let bestPlacement = null;
    bins.forEach((bin, idx) => {
      if (bin.unfulfilled) return;
      const placement = getPieceCostInBin(bin, piece);
      // فیکس باگ واقعی (تأیید شده با تست: چوب ۲۰۰ سانتی + ۸ تکه‌ی ۲۵ سانتی
      // تک‌مایتر هم‌جهت → قبلاً remaining=7.6 نشون می‌داد یعنی ۲۰۷.۶ سانت
      // پذیرفته می‌شد روی یه چوب ۲۰۰ سانتی!): تخفیف overlap موقع جفت‌شدن
      // مایترها (`cost = length - thickness + K`) باعث می‌شه «هزینه»ی
      // حسابداری‌شده کمتر از طول فیزیکی واقعی تکه بشه؛ چک قبلی فقط رو همون
      // هزینه‌ی تخفیف‌خورده بود، پس می‌شد چندین تکه رو زنجیره کرد و مجموع
      // طول فیزیکی واقعی‌شون از طول چوب رد بزنه. الان علاوه بر هزینه‌ی
      // تخفیف‌خورده، مجموع طول خامِ (بدون تخفیف) تکه‌ها هم باید توی چوب جا
      // بشه — این یه محدودیت فیزیکی مطلقه که تخفیف overlap نمی‌تونه نقضش کنه.
      const rawUsedIfPlaced = (bin.rawUsed || 0) + toNum(piece.length);
      // کرف (پهنای برش اره) همیشه واقعاً از متریال کم می‌شه، حتی سر یه اتصال
      // مایترِ «جفت‌شده» که تخفیف ضخامت می‌گیره — چون تخفیف ضخامت فقط
      // هم‌پوشانیِ هندسیِ خودِ برش‌های کج رو مدل می‌کنه، نه اینکه اره لازم
      // نیست از وسطشون رد بشه. پس حداقل فیزیکیِ مطلق = مجموع طول خام + کرفِ
      // هر اتصال (صرف‌نظر از تخفیف)، و این هیچ‌وقت نباید از طول چوب رد بزنه.
      const jointsIfPlaced = bin.cuts.length; // اضافه‌شدن این تکه یعنی یه اتصال جدید با آخرین تکه
      const minPhysicalIfPlaced = rawUsedIfPlaced + jointsIfPlaced * K;
      if (r2(bin.remaining) >= placement.cost && minPhysicalIfPlaced <= (bin.stockLength || 0) + 0.01) {
        // Straight (non-mitered) pieces have no material benefit from any
        // particular neighbor, so give a small preference to keep them
        // grouped next to other straight pieces already on the stick.
        const lastCut = bin.cuts[bin.cuts.length - 1];
        // همگروه کردن برش‌های هم‌نوع: صاف‌ها کنار هم، مایترها کنار هم
        let groupBonus = 0;
        if (lastCut) {
          if (piece.cutType === lastCut.cutType) groupBonus = 5;
          // جریمهٔ مجاورت صاف با مایتر (پرتی مثلثی ضخامت)
          else if ((piece.cutType === "none") !== (lastCut.cutType === "none")) groupBonus = -4;
        }
        const score = placement.cost + placement.penalty - groupBonus;
        if (score < bestScore) {
          bestScore = score;
          bestBinIdx = idx;
          bestPlacement = placement;
        }
      }
    });
    return { bestBinIdx, bestPlacement };
  }

  // صف قابل‌تغییر (نه forEach ساده) تا وقتی می‌خوایم چوب تازه باز کنیم، بتونیم تکه‌ی جلوی
  // صف رو با یه تکه‌ی مناسب‌تر (اگه بود) عوض کنیم و تکه‌ی فعلی رو برای دور بعد نگه داریم.
  const queue = [...pieces];

  // شبیه‌سازی هزینه‌ی یه دنباله‌ی کامل از تکه‌ها روی یه چوب خالی (بدون commit)، برای
  // مقایسه‌ی چیدمان‌های مختلف همون تکه‌ها روی یه چوب — استفاده در پاس بازچینی زیر.
  const evaluateSequence = (piecesSeq, stockLength) => {
    let remaining = stockLength;
    let rawUsed = 0;
    const cuts = [];
    for (const p of piecesSeq) {
      const placement = getPieceCostInBin({ cuts }, p);
      remaining = r2(remaining - placement.cost);
      rawUsed = r2(rawUsed + toNum(p.length));
      const minPhysical = rawUsed + cuts.length * K;
      if (remaining < 0 || minPhysical > stockLength + 0.01) return null;
      cuts.push({
        ...p,
        miterLeft: placement.finalMiterLeft,
        miterRight: placement.finalMiterRight,
        kerf: K,
        overlap: placement.overlap,
        flipped: placement.flipped,
      });
    }
    return { remaining, cuts };
  };

  // پاس بازچینی محلی: بعد از چیدن حریصانه‌ی هر چوب، امتحان می‌کنه هر تکه رو تک‌تک به
  // ابتدا یا انتهای همون چوب منتقل کنه — دقیقاً برای حالتی که یه تکه‌ی ناهم‌نوع (مثلاً
  // تک‌مایتر/بدون‌مایتر) وسط یه بلوک از تکه‌های هم‌نوع (مثلاً دومایتر) گیر افتاده و
  // زنجیره‌ی جفت‌شدن رایگان رو قطع کرده؛ بردنش به لبه‌ی چوب (که طبیعتاً فلت/آزاده) این
  // هزینه‌ی اضافه رو حذف می‌کنه. فقط وقتی چیدمان جدید واقعاً پرتی کمتری داره (باقیمانده‌ی
  // بیشتر) و هنوز جا می‌شه، جایگزین می‌شه.
  const reorderBinForLessWaste = (cuts, stockLength) => {
    if (!cuts || cuts.length <= 1) return null;
    const base = cuts.map((c) => ({ ...c }));
    let best = evaluateSequence(base, stockLength);
    if (!best) return null;
    let bestOrder = base;
    for (let i = 0; i < base.length; i++) {
      const toEnd = [...base.slice(0, i), ...base.slice(i + 1), base[i]];
      const resEnd = evaluateSequence(toEnd, stockLength);
      if (resEnd && resEnd.remaining > best.remaining) {
        best = resEnd;
        bestOrder = toEnd;
      }
      const toStart = [base[i], ...base.slice(0, i), ...base.slice(i + 1)];
      const resStart = evaluateSequence(toStart, stockLength);
      if (resStart && resStart.remaining > best.remaining) {
        best = resStart;
        bestOrder = toStart;
      }
    }
    return bestOrder === base ? null : { cuts: best.cuts, remaining: best.remaining };
  };

  while (queue.length) {
    let piece = queue.shift();

    const { bestBinIdx, bestPlacement } = findBestBin(piece);

    if (bestBinIdx !== -1) {
      const bin = bins[bestBinIdx];
      bin.remaining = r2(bin.remaining - bestPlacement.cost);
      bin.rawUsed = r2((bin.rawUsed || 0) + toNum(piece.length));
      bin.cuts.push({ 
        ...piece, 
        miterLeft: bestPlacement.finalMiterLeft, 
        miterRight: bestPlacement.finalMiterRight, 
        kerf: K, 
        overlap: bestPlacement.overlap,
        flipped: bestPlacement.flipped
      });
      continue;
    }

    // هیچ چوب بازی جا نداشت — پس چوب جدید باز می‌شه، یعنی هر دو لبه‌ی این تکه به لبه‌ی
    // خامِ چوب می‌خوره. تکه‌ای که یه سمتش صاف باشه (بدون مایتر یا تک‌مایتر) رایگان به لبه‌ی
    // خام می‌چسبه، ولی تکه‌ی دومایتر (هر دو سمت کج) همیشه یه‌ضخامت اضافه از همون لبه‌ی خام
    // هدر می‌ده. اگه این تکه دومایتره و توی صف یه تکه‌ی تک‌مایتر/بدون‌مایتر منتظره که خودش
    // هم جای دیگه‌ای جا نمی‌شه، اول اونو برای باز کردن چوب جدید جلو می‌ندازیم و این تکه رو
    // برای دور بعد برمی‌گردونیم (که یا توی همین چوب تازه یا جای دیگه جا می‌شه).
    if (piece.cutType === "double") {
      const swapIdx = queue.findIndex((p) => {
        if (p.cutType === "double") return false;
        // فقط اگه خودِ تکه‌ی جایگزین هم توی هیچ چوب بازی جا نمی‌شه (وگرنه نوبت خودش که
        // برسه همون‌جا جا می‌شه و این سواپ لازم نیست)
        return findBestBin(p).bestBinIdx === -1;
      });
      if (swapIdx !== -1) {
        const swapPiece = queue.splice(swapIdx, 1)[0];
        queue.unshift(piece);
        piece = swapPiece;
      }
    }

    // Find the best-fit stock stick that minimizes remaining waste
    let bestStockIdx = -1;
    let bestStockRemaining = Infinity;
    let bestStockPlacement = null;

    stockInstances.forEach((stock, idx) => {
      const placement = getPieceCostInBin(null, piece);
      if (stock.length >= placement.cost) {
        const remainingAfter = r2(stock.length - placement.cost);
        if (remainingAfter < bestStockRemaining) {
          bestStockRemaining = remainingAfter;
          bestStockIdx = idx;
          bestStockPlacement = placement;
        }
      }
    });

    if (bestStockIdx !== -1) {
      const stock = stockInstances.splice(bestStockIdx, 1)[0];
      bins.push({ 
        stockLength: stock.length, 
        remaining: r2(stock.length - bestStockPlacement.cost), 
        rawUsed: r2(toNum(piece.length)),
        cuts: [{ 
          ...piece, 
          miterLeft: bestStockPlacement.finalMiterLeft, 
          miterRight: bestStockPlacement.finalMiterRight, 
          kerf: K, 
          overlap: bestStockPlacement.overlap,
          flipped: bestStockPlacement.flipped
        }] 
      });
    } else {
      bins.push({ stockLength: null, remaining: 0, cuts: [{ ...piece, kerf: K, overlap: 0 }], unfulfilled: true });
    }
  }

  bins.forEach((bin) => {
    if (bin.unfulfilled) return;
    const improved = reorderBinForLessWaste(bin.cuts, bin.stockLength);
    if (improved) {
      bin.cuts = improved.cuts;
      bin.remaining = improved.remaining;
    }
  });

  const fulfilled = bins.filter((b) => !b.unfulfilled);
  return {
    bins,
    usedSticks: fulfilled.length,
    totalWaste: fulfilled.reduce((s, b) => s + Math.max(0, b.remaining), 0),
    unfulfilledCount: bins.filter((b) => b.unfulfilled).length,
  };
  } // end runOnePass

  // چند ترتیب مختلف برای پردازش تکه‌ها امتحان می‌شه (نه فقط یه حریصانه‌ی تنها)، و هرکدوم که
  // کمتر چوب مصرف کنه (و در تساوی، کمتر هدررفت داشته باشه) نگه داشته می‌شه. حل مطلقاً بهینه
  // یه مسئله‌ی NP-hard جداست؛ این چند استراتژی رو امتحان می‌کنه که در عمل خیلی بهتر از یک
  // حریصانه‌ی تنهاست.
  const byNoneLast = [...requiredPiecesObj].sort((a, b) => {
    const aNone = a.cutType === "none" ? 1 : 0;
    const bNone = b.cutType === "none" ? 1 : 0;
    if (aNone !== bNone) return aNone - bNone;
    return b.length - a.length;
  });
  const byLengthOnly = [...requiredPiecesObj].sort((a, b) => b.length - a.length);
  // دومایتری‌ها اول — چون سخت‌ترین‌ها برای جا انداختنن (هر دو لبه‌شون باید یا با یه چوب
  // جدید یا با تطبیق دقیق کنار یه مایتر دیگه جفت بشه)، پردازش زودتر اونا معمولاً بهتره.
  const byDoubleFirst = [...requiredPiecesObj].sort((a, b) => {
    const aRank = a.cutType === "double" ? 0 : a.cutType === "single" ? 1 : 2;
    const bRank = b.cutType === "double" ? 0 : b.cutType === "single" ? 1 : 2;
    if (aRank !== bRank) return aRank - bRank;
    return b.length - a.length;
  });
  // تک‌مایتری‌ها اول — هرکدوم فقط یه لبه‌ی مایتر دارن، پس اگه اول این‌ها با هم جفت بشن
  // (قبل از این‌که یه تکه‌ی دومایتر یکی از لبه‌هاشون رو "قرض" بگیره)، شانس بیشتری برای
  // زنجیره‌ی تک‌مایتر↔تک‌مایتر پشت‌سرهم می‌مونه.
  const bySingleFirst = [...requiredPiecesObj].sort((a, b) => {
    const aRank = a.cutType === "single" ? 0 : a.cutType === "double" ? 1 : 2;
    const bRank = b.cutType === "single" ? 0 : b.cutType === "double" ? 1 : 2;
    if (aRank !== bRank) return aRank - bRank;
    return b.length - a.length;
  });
  // بدون‌مایتری‌ها اول — این‌ها هیچ لبه‌ی مایتری ندارن، پس اتصال بدون‌مایتر↔بدون‌مایتر
  // همیشه رایگانه (بدون هدررفت اضافه). اگه این‌ها زودتر (وقتی چوب‌ها هنوز خالی‌ان)
  // پردازش بشن، شانس بیشتری دارن کنار هم روی یه چوب جمع بشن، به‌جای این‌که یکی اول
  // یکی چوب رو باز کنه و بعداً یه بدون‌مایتر دیگه، بعد از پر شدن وسط چوب با مایتری‌ها،
  // به‌جای کنار همون اولی، ته چوب بیفته (که یعنی ۲ اتصال بدون‌مایتر↔مایتر به‌جای ۱).
  const byNoneFirst = [...requiredPiecesObj].sort((a, b) => {
    const aRank = a.cutType === "none" ? 0 : 1;
    const bRank = b.cutType === "none" ? 0 : 1;
    if (aRank !== bRank) return aRank - bRank;
    return b.length - a.length;
  });

  const attempts = [byNoneLast, byLengthOnly, byDoubleFirst, bySingleFirst, byNoneFirst].map((order) => runOnePass(order, baseStockInstances));

  const best = attempts.reduce((best, cur) => {
    if (!best) return cur;
    if (cur.unfulfilledCount !== best.unfulfilledCount) return cur.unfulfilledCount < best.unfulfilledCount ? cur : best;
    if (cur.usedSticks !== best.usedSticks) return cur.usedSticks < best.usedSticks ? cur : best;
    return cur.totalWaste < best.totalWaste ? cur : best;
  }, null);

  return best;
}

export function buildCutSummary(allFramePieces) {
  const double = {},
    single = {},
    none = {};
  allFramePieces.forEach(({ length, cutType, miterLeft, miterRight }) => {
    const key = String(r2(length));
    const bucket = cutType === "double" ? double : cutType === "single" ? single : none;
    if (!bucket[key]) bucket[key] = { length: parseFloat(key), count: 0, miterLeft, miterRight };
    bucket[key].count++;
  });
  const toList = (obj) => Object.values(obj).sort((a, b) => b.length - a.length);
  return { double: toList(double), single: toList(single), none: toList(none) };
}

export function groupPiecesByThickness(frames) {
  const groups = new Map();
  frames.forEach((frame) => {
    const key = String(r2(toNum(frame.thickness)));
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(...(frame.pieces || []));
  });
  return groups;
}