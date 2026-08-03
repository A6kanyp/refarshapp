import React from "react";
import { Phone, Instagram, Globe, MessageCircle } from "lucide-react";
import { toNum, fmt, toPersianDigits} from "../mathCore";
import { useResolvedImageSrc, IMAGE_CATEGORIES } from "../utils/imageStorage";


function stripGenderPrefix(name) {
  let n = String(name || "").trim();
  // حذف پیشوندهای تکراری مثل خانم/آقا/سرکار خانم/جناب آقای
  n = n.replace(/^(سرکار\s*خانم|جناب\s*آقای|خانم|آقای|آقا)\s+/u, "");
  n = n.replace(/^(سرکار\s*خانم|جناب\s*آقای|خانم|آقای|آقا)\s+/u, "");
  return n.trim();
}

// ── تصویر آیتم فاکتور ──
// باگ: item.image توی سیستم جدید ذخیره‌سازی عکس (imageStorage.js) فقط اسم فایله
// نه یه src مستقیم‌قابل‌استفاده — قبلاً مستقیم توی <img src={item.image}/> ست می‌شد
// که همیشه شکسته بود (به‌جز عکس‌های خیلی قدیمی base64/URL). این کامپوننت دقیقاً
// مثل ProductImage (ProductTab.jsx) resolve واقعی (فایل محلی/IndexedDB) رو انجام می‌ده.
function InvoiceItemImage({ filename }) {
  const isLegacyInline = !!filename && (filename.startsWith("data:") || filename.startsWith("http") || filename.startsWith("/"));
  const resolvedSrc = useResolvedImageSrc(isLegacyInline ? null : filename, IMAGE_CATEGORIES.PRODUCT);
  const src = isLegacyInline ? filename : resolvedSrc;
  if (!filename || !src) {
    // نکته‌ی مهم برای Save/Share/Print (InvoicePrint.jsx): وقتی filename هست ولی src
    // هنوز resolve نشده (useResolvedImageSrc در حال lookup از IndexedDB/فایل‌سیستمه)،
    // این یه پلاسهولدر موقته نه «واقعاً بدون عکس». قبلاً این دو حالت از نظر DOM
    // غیرقابل‌تشخیص بودن، پس اگه کاربر سریع دکمه‌ی ذخیره/اشتراک/چاپ رو می‌زد، اسنپ‌شاتی
    // که گرفته می‌شد همین پلاسهولدر رو برای همیشه توی عکس/PDF نهایی ثبت می‌کرد، حتی اگه
    // یه لحظه بعد عکس واقعی لود می‌شد. الان با data-resolving مشخصش می‌کنیم تا
    // InvoicePrint.jsx قبل از گرفتن اسنپ‌شات صبر کنه تا همه‌شون تموم بشن.
    const stillResolving = !!filename && resolvedSrc === undefined && !isLegacyInline;
    return (
      <div data-resolving={stillResolving ? "true" : undefined} style={{ width: "42px", height: "42px", margin: "0 auto", borderRadius: "6px", background: "#f0f0f0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "9px", color: "#888", border: "1px dashed #ccc" }}>{stillResolving ? "" : "بدون عکس"}</div>
    );
  }
  return (
    <div style={{ width: "42px", height: "42px", margin: "0 auto", borderRadius: "6px", overflow: "hidden", border: "1px solid #ddd", background: "#f0f0f0" }}>
      <img src={src} style={{ width: "100%", height: "100%", objectFit: "cover" }} referrerPolicy="no-referrer" alt="" />
    </div>
  );
}

export default function InvoiceTemplate({ invoiceData, businessCard }) {
  // بخش «بازطراحی ذخیره‌سازی عکس‌ها» (Wall 🟣): قبل از هر return زودهنگام باید
  // صدا زده بشه (قانون Hooks). qrCode جدید فقط اسم فایله؛ برای داده‌ی قدیمی
  // (data URL مستقیم) هم سازگار می‌مونیم
  const qrRaw = businessCard?.qrCode || null;
  const qrIsLegacyInline = !!qrRaw && (qrRaw.startsWith("data:") || qrRaw.startsWith("http") || qrRaw.startsWith("/"));
  const resolvedQrSrc = useResolvedImageSrc(qrIsLegacyInline ? null : qrRaw, IMAGE_CATEGORIES.QR);
  const qrSrc = qrIsLegacyInline ? qrRaw : resolvedQrSrc;

  if (!invoiceData) return null;

  const {
    id,
    type = "sales",
    date,
    customer, // { name, phone, address, gender, kind, galleryOwnerName }
    items = [], // array of products
    totals, // { total, discount, final }
    depositAmount: rawDepositAmount = 0, // آیتم ۲ (نمای پیشرفته‌ی فاکتور): مبلغ ودیعه/پیش‌پرداخت که از مبلغ قابل‌پرداخت کم می‌شه
  } = invoiceData;

  const title = type === "sales" ? "فاکتور فروش کالا" : "حساب فاکتور";
  
  // Resolve buyer displayName and prefix based on gender and whether it's a gallery
 const trimmedName = stripGenderPrefix(customer?.name);
const isGallery = customer?.kind === "gallery";
const isWarehouse = customer?.kind === "warehouse";
const genderPrefix = customer?.gender === "خانم" ? "سرکار خانم" : "جناب آقای";

let buyerDisplayName = "";

// ۱) گالری
if (isGallery) {
  const galleryName = trimmedName || "گالری";
  const ownerName = customer?.galleryOwnerName?.trim();
  const ownerPrefix = customer?.galleryOwnerGender === "خانم" ? "سرکار خانم" : "جناب آقای";

  if (ownerName) {
    buyerDisplayName = `همکار گرامی: ${galleryName} (با مدیریت ${ownerPrefix} ${ownerName})`;
  } else {
    buyerDisplayName = `همکار گرامی: ${galleryName}`;
  }
}

// ۲) فروش مستقیم (انبار بدون نام)
else if (isWarehouse && !trimmedName) {
  buyerDisplayName = "فروش مستقیم: مشتری گرامی";
}

// ۳) مشتری عادی
else if (trimmedName) {
  buyerDisplayName = `خریدار محترم: ${genderPrefix} ${trimmedName}`;
}

// ۴) هیچ‌چیز نبود → فروش مستقیم
else {
  buyerDisplayName = "فروش مستقیم: مشتری گرامی";
}

  // Calculate settlement totals if any items are settled
  // خودِ آیتم‌ها همیشه فیلدهای یکسان دارن (finalPrice/originalPrice/isSettled/isAvailableInGallery)،
  // برخلاف پارامتر totals که فرمتش بین جاهای مختلفی که فاکتور می‌سازن (گالری/حسابداری/فاکتورها) یکی نبود
  // و باعث می‌شد بعضی وقتا «جمع اقلام فروش‌رفته» همیشه خالی/نادرست نشون داده بشه.
  const availableItems = items.filter((i) => i.isAvailableInGallery);
  const soldItems = items.filter((i) => !i.isAvailableInGallery);
  const soldSettledItems = soldItems.filter((i) => i.isSettled);
  const soldUnsettledItems = soldItems.filter((i) => !i.isSettled);

  const sumFinal = (arr) => arr.reduce((s, i) => s + toNum(i.finalPrice), 0);
  const sumOriginal = (arr) => arr.reduce((s, i) => s + toNum(i.originalPrice ?? i.finalPrice), 0);

  const isGiftItem = (i) => toNum(i.originalPrice) > 0 && toNum(i.finalPrice) <= 0;
  const giftSoldItems = soldItems.filter(isGiftItem);
  const nonGiftSoldItems = soldItems.filter((i) => !isGiftItem(i));

  const totalAllItems = sumOriginal(items);
  const soldRevenue = sumFinal(soldItems);
  const paidAmount = sumFinal(soldSettledItems);
  const galleryStockValue = sumFinal(availableItems);
  // تخفیف واقعی فقط روی آیتم‌های غیرِ هدیه حساب می‌شه؛ هدیه‌ها جدا (به‌عنوان «هدیه»، نه تخفیف) گزارش می‌شن
  const totalDiscount = sumOriginal(nonGiftSoldItems) - sumFinal(nonGiftSoldItems);
  const totalGiftValue = sumOriginal(giftSoldItems);
  const finalPayable = Math.max(0, sumFinal(soldUnsettledItems) - toNum(rawDepositAmount));
  const depositAmount = toNum(rawDepositAmount);

  const hasSettledItems = soldSettledItems.length > 0;
  const hasAvailableItems = availableItems.length > 0;

  return (
    <div className="invoice-paper" dir="rtl">
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
          }
          body {
            margin: 0;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            background: #fff !important;
            color: #000 !important;
          }
          .invoice-paper {
            font-family: "Vazirmatn", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            width: 210mm !important;
            min-height: 297mm !important;
            margin: 0 !important;
            padding: 36mm 15mm 15mm 15mm !important;
            box-shadow: none !important;
            background-color: #ffffff !important;
            border: none !important;
            display: flex;
            flex-direction: column;
            box-sizing: border-box !important;
            position: relative !important;
          }
          .no-print {
            display: none !important;
          }
        }
        /* Screen style for A4-like preview */
        @media screen {
          .invoice-paper {
            font-family: "Vazirmatn", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            width: 794px;
            min-height: 1123px;
            height: auto;
            margin: 0 auto;
            padding: 130px 40px 40px 40px;
            background-color: #ffffff;
            color: #1a1a1a;
            border-radius: 8px;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
            border: 1px solid #2d2d2d;
            display: flex;
            flex-direction: column;
            box-sizing: border-box;
            position: relative;
          }
          /* فقط ناحیه محتوا (جدول) رشد می‌کند؛ جمع و توضیحات پایین می‌مانند */
          .invoice-paper .invoice-body-grow {
            flex: 1 1 auto;
            min-height: 0;
          }
        }

        .invoice-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
          margin-bottom: 20px;
          table-layout: fixed;
          word-wrap: break-word;
        }

        .invoice-table th {
          background-color: #f5f5f5 !important;
          color: #1a1a1a;
          font-weight: 700;
          border-bottom: 2px solid #333;
          padding: 8px;
          text-align: center;
          font-size: 11px;
        }

        .invoice-table td {
          border-bottom: 1px solid #e0e0e0;
          padding: 10px 8px;
          font-size: 11px;
          vertical-align: middle;
          color: #2c2c2c;
          word-break: normal;
          overflow-wrap: break-word;
        }

        .invoice-summary-box {
          border: 1.5px solid #1a1a1a;
          border-radius: 6px;
          overflow: hidden;
          width: 100%;
          max-width: 320px;
          align-self: flex-end;
        }

        .invoice-summary-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 12px;
          font-size: 11px;
          border-bottom: 1px solid #e0e0e0;
        }

        .invoice-summary-row:last-child {
          border-bottom: none;
        }

        .invoice-summary-final {
          background-color: #f9f9f9;
          font-weight: 700;
          font-size: 12px;
          border-top: 1px solid #1a1a1a;
        }

        .signature-section {
          border: 1px solid #eee;
          border-radius: 6px;
          background: #fafafa;
          padding: 10px;
          display: flex;
          justify-content: space-between;
          width: 100%;
        }

        .badge-settled {
          display: inline-block;
          background-color: #e6f7ed;
          color: #219653;
          border: 1px solid #219653;
          border-radius: 4px;
          padding: 2px 6px;
          font-size: 10px;
          font-weight: 600;
        }

        .badge-pending {
          display: inline-block;
          background-color: #fdf4e7;
          color: #d87c1d;
          border: 1px solid #d87c1d;
          border-radius: 4px;
          padding: 2px 6px;
          font-size: 10px;
          font-weight: 600;
        }
      `}</style>

      {/* سربرگ و واترمارک قبلاً background-image روی خودِ .invoice-paper بودن.
          html2canvas (که دکمه‌ی «دانلود/ذخیره PDF» همینو صدا می‌زنه) پشتیبانی
          قابل‌اعتمادی از background-image چندلایه‌ی CSS نداره — خصوصاً روی
          المنت‌های بلند (فاکتورهای پرآیتم) کامل ناپدید می‌شد. تبدیل به دو تا
          تگ <img> واقعی شد که html2canvas خیلی بهتر و قابل‌اعتمادتر می‌گیرتشون.
          پشت محتوا قرار می‌گیرن (z-index زیر، محتوا با wrapper بعدی روش میاد) */}
      <img src="/assets/images/invoice-header.jpg" alt="" style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "auto", zIndex: 0, pointerEvents: "none" }} />
      <img src="/assets/images/invoice-watermark.jpg" alt="" style={{ position: "absolute", bottom: 0, right: 0, width: "33.5%", height: "auto", zIndex: 0, pointerEvents: "none" }} />
      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", flex: 1, minHeight: "calc(1123px - 170px)", height: "auto" }}>

      {/* Invoice title, number, and date info bar (positioned below the letterhead line) */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1.5px solid #1a1a1a", paddingBottom: "10px", marginBottom: "16px" }}>
        {qrSrc ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px", order: 2 }}>
            <div style={{ width: "90px", height: "90px", background: "#fff", padding: "4px", borderRadius: "6px", border: "1px solid #1a1a1a", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <img src={qrSrc} style={{ width: "100%", height: "100%", objectFit: "contain" }} referrerPolicy="no-referrer" alt="QR Code" />
            </div>
          </div>
        ) : (
          <div style={{ width: "90px", height: "90px", order: 2 }}></div>
        )}

        <div style={{ order: 1 }}>
          <h1 style={{ fontSize: "18px", fontWeight: 700, color: "#1a1a1a", margin: 0 }}>{title}</h1>
        </div>
        
        <div style={{ display: "flex", gap: "20px", fontSize: "11px", color: "#444", order: 0 }}>
          <div>
            <strong>شماره فاکتور:</strong> <span style={{ fontFamily: "monospace", fontSize: "12px" }}>#{id}</span>
          </div>
          <div>
            <strong>تاریخ صدور:</strong> {date}
          </div>
        </div>
      </div>

      {/* Client & Buyer Info Section */}
      <div style={{ background: "#f9f9f9", border: "1px solid #eee", borderRadius: "8px", padding: "12px 16px", marginBottom: "20px", display: "grid", gridTemplateColumns: "2fr 1fr", gap: "16px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <div style={{ fontSize: "12px" }}>
  <strong style={{ fontSize: "13px", color: "#000" }}>
    {buyerDisplayName}
  </strong>
</div>

          {customer?.address && (
            <div style={{ fontSize: "11px", lineHeight: "1.6" }}>
              <span style={{ color: "#666", marginLeft: "6px" }}>نشانی تحویل:</span>
              <span style={{ color: "#333" }}>{customer.address}</span>
            </div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", borderRight: "1px solid #e0e0e0", paddingRight: "16px" }}>
          <div style={{ fontSize: "11px" }}>
            <span style={{ color: "#666", marginLeft: "6px" }}>شماره تماس:</span>
            <span style={{ color: "#000", fontWeight: "600", direction: "ltr", display: "inline-block" }}>{customer?.phone || "—"}</span>
          </div>
          <div style={{ fontSize: "11px" }}>
            <span style={{ color: "#666", marginLeft: "6px" }}>نوع خریدار:</span>
            <span style={{ color: "#000" }}>{isGallery ? "گالری همکار" : "مشتری حقیقی"}</span>
          </div>
        </div>
      </div>

      {/* Products list Table */}
      <div className="invoice-body-grow" style={{ flex: "1 1 auto", display: "flex", flexDirection: "column" }}>
      <table className="invoice-table">
        <thead>
          <tr>
            <th style={{ width: "6%" }}>ردیف</th>
            <th style={{ width: "12%" }}>تصویر</th>
            <th style={{ width: "36%", textAlign: "right" }}>شرح محصول / شناسه کد</th>
            <th style={{ width: "16%" }}>ابعاد کالا (cm)</th>
            <th style={{ width: "18%", textAlign: "left" }}>مبلغ نهایی با تخفیف</th>
            <th style={{ width: "12%" }}>وضعیت مالی</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={index}>
              <td style={{ textAlign: "center", fontWeight: "bold" }}>{index + 1}</td>
              <td style={{ textAlign: "center" }}>
                <InvoiceItemImage filename={item.image} />
              </td>
              <td style={{ textAlign: "right" }}>
                <div style={{ fontWeight: "700", color: "#111", fontSize: "12px" }}>{item.name}</div>
                <div style={{ fontSize: "10px", color: "#666", marginTop: "3px" }}>شناسه کد کالا: {item.code || "—"}</div>
              </td>
              <td style={{ textAlign: "center", fontWeight: "500", whiteSpace: "nowrap" }}>{item.dims || "—"}</td>
              <td style={{ textAlign: "left", fontWeight: "700", color: "#111" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", justifyContent: "center", width: "100%", height: "100%", minHeight: "28px", boxSizing: "border-box" }}>
                {item.discountPct >= 100 ? (
                  <span style={{ textDecoration: "line-through", color: "#999", fontSize: "11px" }}>{fmt(item.originalPrice)} ت</span>
                ) : item.discountPct > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                    <span style={{ textDecoration: "line-through", color: "#999", fontSize: "10px", fontWeight: "normal", marginBottom: "3px" }}>{fmt(item.originalPrice)}</span>
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <div style={{ background: "#e3f2fd", border: "1px solid #64b5f6", borderRadius: "4px", padding: "1px 7px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", lineHeight: 1.35, marginLeft: "6px" }}>
                        <span style={{ color: "#1565c0", fontSize: "8.5px", fontWeight: "700" }}>٪{toPersianDigits(item.discountPct)}</span>
                      </div>
                      <span>{fmt(item.finalPrice)} ت</span>
                    </div>
                  </div>
                ) : (
                  <span>{fmt(item.finalPrice)} ت</span>
                )}
                </div>
              </td>
              <td style={{ textAlign: "center" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%", minHeight: "28px", boxSizing: "border-box" }}>
                {item.discountPct >= 100 ? (
                  <span style={{ display: "inline-flex", alignItems: "center", background: "#fce4ec", color: "#c2185b", border: "1px solid #c2185b", borderRadius: "4px", padding: "2px 7px", fontSize: "10px", fontWeight: "700", direction: "rtl", unicodeBidi: "plaintext" }}>
                    <span>هدیه</span><span style={{ marginRight: "4px" }}>{"\u{1F381}\uFE0E"}</span>
                  </span>
                ) : item.isAvailableInGallery ? (
                  <span style={{ color: "#666", fontSize: "10px", fontWeight: "bold" }}>موجود در گالری</span>
                ) : item.isSettled ? (
                  <span className="badge-settled" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", direction: "rtl", unicodeBidi: "plaintext" }}>تسویه شده</span>
                ) : (
                  <span className="badge-pending" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", direction: "rtl", unicodeBidi: "plaintext" }}>بدهکار</span>
                )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      {/* Bottom section: details & totals - pinned above footer */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "24px", marginTop: "auto", marginBottom: "20px", flexShrink: 0 }}>
        {/* Signatures & Notes */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "12px" }}>
          <div>
            <div style={{ fontSize: "10px", fontWeight: "700", marginBottom: "4px", color: "#333" }}>توضیحات مهم:</div>
            <div style={{ fontSize: "9px", color: "#666", display: "flex", flexDirection: "column", gap: "3px" }}>
  <div>این آثار، فرش‌های احیاشده‌ای هستند که دوباره به زندگی برگشته‌اند. هر قطعه حاصل ترکیب هنر دست، قدمت، و بازآفرینی در استودیو ریفرش است.</div>
  <div>قاب‌ها چوبی و دست‌ساز هستند و فرش‌ها قدمتی بالا دارند؛ لطفاً آن‌ها را در معرض نور مستقیم آفتاب یا رطوبت شدید قرار ندهید.</div>
  <div>در فرآیند احیا تلاش شده اصالت و هویت فرش‌ها حفظ شود. بسیاری از عدم‌تقارن‌ها و نقص‌های ظریف، از روز نخست بافت وجود داشته‌اند و بخشی از شخصیت واقعی اثر محسوب می‌شوند.</div>
  <div>فرشباف‌ها با باور به اینکه هیچ چیز در جهان کامل مطلق نیست، عمداً رگه‌هایی از عدم تقارن یا نقص را در بافت قرار می‌دادند تا روح اثر زنده و انسانی باقی بماند.</div>
</div>
</div>

          <div className="signature-section">
            <div style={{ textAlign: "center", flex: 1 }}>
              <div style={{ fontSize: "10px", color: "#555", marginBottom: "35px" }}>مهر و امضای استودیو فرش و دکور ریفرش</div>
              <div style={{ borderTop: "1px dashed #ddd", width: "80%", margin: "0 auto" }}></div>
            </div>
            <div style={{ textAlign: "center", flex: 1, borderRight: "1px solid #eee" }}>
              <div style={{ fontSize: "10px", color: "#555", marginBottom: "35px" }}>مهر و امضای خریدار / تحویل‌گیرنده</div>
              <div style={{ borderTop: "1px dashed #ddd", width: "80%", margin: "0 auto" }}></div>
            </div>
          </div>
        </div>

        {/* Totals Table */}
        <div className="invoice-summary-box">
          {isGallery ? (
            <>
              <div className="invoice-summary-row">
                <span style={{ color: "#666" }}>جمع کل اقلام:</span>
                <strong style={{ color: "#333" }}>{fmt(totalAllItems)} تومان</strong>
              </div>
              <div className="invoice-summary-row">
                <span style={{ color: "#666" }}>جمع اقلام فروش‌رفته:</span>
                <strong style={{ color: "#333" }}>{fmt(soldRevenue)} تومان</strong>
              </div>
              {hasSettledItems && (
                <div className="invoice-summary-row" style={{ color: "#219653" }}>
                  <span>مبلغ پرداخت‌شده:</span>
                  <strong>{fmt(paidAmount)} تومان</strong>
                </div>
              )}
              {totalDiscount > 0 && (
                <div className="invoice-summary-row" style={{ color: "#d32f2f" }}>
                  <span>مجموع تخفیف‌ها:</span>
                  <strong>{fmt(totalDiscount)} تومان</strong>
                </div>
              )}
              {totalGiftValue > 0 && (
                <div className="invoice-summary-row" style={{ color: "#9c27b0" }}>
                  <span>مجموع هدیه‌ها ({giftSoldItems.length} قلم):</span>
                  <strong>{fmt(totalGiftValue)} تومان</strong>
                </div>
              )}
              {hasAvailableItems && (
                <div className="invoice-summary-row" style={{ background: "#f5f5f5" }}>
                  <span style={{ color: "#555", fontWeight: "bold" }}>موجودی در گالری:</span>
                  <strong style={{ color: "#555" }}>{fmt(galleryStockValue)} تومان</strong>
                </div>
              )}
              {depositAmount > 0 && (
                <div className="invoice-summary-row" style={{ color: "#1565c0" }}>
                  <span>مبلغ ودیعه (پیش‌پرداخت):</span>
                  <strong>{fmt(depositAmount)} تومان</strong>
                </div>
              )}
              <div className="invoice-summary-row invoice-summary-final">
                <span>مبلغ نهایی قابل پرداخت:</span>
                <span style={{ fontSize: "14px", fontWeight: "bold", color: "#8B1A1A" }}>{fmt(finalPayable)} تومان</span>
              </div>
            </>
          ) : (
            <>
              <div className="invoice-summary-row">
                <span style={{ color: "#666" }}>جمع کل:</span>
                <strong style={{ color: "#333" }}>{fmt(totalAllItems)} تومان</strong>
              </div>
              {hasSettledItems && (
                <div className="invoice-summary-row" style={{ color: "#219653" }}>
                  <span>مبلغ پرداخت‌شده:</span>
                  <strong>{fmt(paidAmount)} تومان</strong>
                </div>
              )}
              {totalDiscount > 0 && (
                <div className="invoice-summary-row" style={{ color: "#d32f2f" }}>
                  <span>مجموع تخفیف‌ها:</span>
                  <strong>{fmt(totalDiscount)} تومان</strong>
                </div>
              )}
              {totalGiftValue > 0 && (
                <div className="invoice-summary-row" style={{ color: "#9c27b0" }}>
                  <span>مجموع هدیه‌ها ({giftSoldItems.length} قلم):</span>
                  <strong>{fmt(totalGiftValue)} تومان</strong>
                </div>
              )}
              {depositAmount > 0 && (
                <div className="invoice-summary-row" style={{ color: "#1565c0" }}>
                  <span>مبلغ ودیعه (پیش‌پرداخت):</span>
                  <strong>{fmt(depositAmount)} تومان</strong>
                </div>
              )}
              <div className="invoice-summary-row invoice-summary-final">
                <span>مبلغ نهایی قابل پرداخت:</span>
                <span style={{ fontSize: "14px", fontWeight: "bold", color: "#8B1A1A" }}>{fmt(finalPayable)} تومان</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Business Card footer (Contact details) */}
      <div style={{ borderTop: "2px solid #1a1a1a", paddingTop: "16px", marginTop: "auto", display: "flex", flexDirection: "column", gap: "8px", fontSize: "11px", color: "#333", width: "100%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: "700", color: "#111", fontSize: "13px" }}>{businessCard?.name || "استودیو فرش و دکور ریفرش"}</span>
          <span style={{ fontSize: "10px", color: "#666" }}>بازآفرینی (آپ‌سایکلینگ) از قلب فرش‌های اصیل ایرانی</span>
        </div>
        
        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "center", background: "#f9f9f9", padding: "8px 12px", borderRadius: "6px" }}>
          {/* Phone/WhatsApp — طبق درخواست، حتی اگه شماره واتساپ همون شماره تلفن باشه، هردو جدا نمایش داده می‌شن */}
          {(() => {
            const phoneVal = businessCard?.phone || (businessCard?.phones && businessCard.phones[0]) || "";
            const waVal = businessCard?.whatsapp || "";
            return (
              <>
                {phoneVal && (
                  <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                    <Phone size={14} color="#8B1A1A" />
                    <span style={{ direction: "ltr" }}>{phoneVal}</span>
                  </div>
                )}
                {waVal && (
                  <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                    <MessageCircle size={14} color="#8B1A1A" />
                    <span style={{ direction: "ltr" }}>{waVal}</span>
                  </div>
                )}
              </>
            );
          })()}
          
          {/* Instagram */}
          {businessCard?.instagram && (
            <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <Instagram size={14} color="#8B1A1A" />
              <span>{businessCard.instagram.startsWith("@") ? businessCard.instagram : "@" + businessCard.instagram}</span>
            </div>
          )}

          {/* Website */}
          {businessCard?.website && (
            <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <Globe size={14} color="#8B1A1A" />
              <span style={{ direction: "ltr" }}>{businessCard.website.replace(/^https?:\/\//, '')}</span>
            </div>
          )}
        </div>

        {/* Address */}
        {businessCard?.address && (
          <div style={{ fontSize: "10.5px", color: "#555" }}>
            <strong>نشانی:</strong> <span>{businessCard.address}</span>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
