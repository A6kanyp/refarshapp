import { pushBackHandler } from "../utils/backButton";
import { useRegisterOpenModal } from "../utils/modalRegistry";
import React, { useEffect, useState, useRef } from "react";
import { X, Printer, Download, Copy, FileDown, RefreshCw } from "lucide-react";
import html2canvas from "html2canvas";
import InvoiceTemplate from "./InvoiceTemplate";
import { fmt, toNum } from "../mathCore";
import { saveFile, shareFile, shareText, REFARSH_SAVE_DIRS } from "../utils/nativeSave";
import { useToast } from "../contexts/ToastContext";

// بخش «بک‌گراند فاکتور بعضی‌وقتا نمیاد» (این تصادفی نبود، یه race condition واقعی بود):
// paperElement.cloneNode(true) یه کپیِ کاملاً جدید از <img>های سربرگ/واترمارک می‌سازه،
// و این img های کپی‌شده باید دوباره لود/دیکود بشن (حتی اگه عکس اصلی قبلاً کش شده باشه).
// قبلاً فقط ۱۵۰ میلی‌ثانیه صبر می‌کرد که کافی نبود (خصوصاً گوشی‌های کندتر یا بار اول
// بدون کش) — همینه که گاهی بک‌گراند میومد گاهی نه. الان واقعاً صبر می‌کنیم تا همه‌ی
// img های داخل کلون finish بشن (یا حداکثر ۲ ثانیه، که گیر نکنه اگه عکسی offline/خراب بود)
function waitForImagesToLoad(container, maxWaitMs = 2000) {
  const imgs = Array.from(container.querySelectorAll("img"));
  if (imgs.length === 0) return Promise.resolve();
  const imgPromises = imgs.map((img) => {
    if (img.complete && img.naturalWidth > 0) return Promise.resolve();
    return new Promise((resolve) => {
      img.addEventListener("load", resolve, { once: true });
      img.addEventListener("error", resolve, { once: true });
    });
  });
  const timeoutPromise = new Promise((resolve) => setTimeout(resolve, maxWaitMs));
  return Promise.race([Promise.all(imgPromises), timeoutPromise]);
}

// باگ واقعی: عکس محصولات توی فاکتور از یه هوک async (useResolvedImageSrc در
// InvoiceTemplate.jsx) میان که lookup از IndexedDB/فایل‌سیستم می‌زنه. اگه کاربر
// همون لحظه‌ی باز شدن پیش‌نمایش دکمه‌ی ذخیره/اشتراک/چاپ رو بزنه، ممکنه هنوز خیلی
// از این lookupها تموم نشده باشن — و چون paperElement.cloneNode یه اسنپ‌شاته (نه
// زنده)، هرچی همون لحظه توی DOM واقعی بوده (پلاسهولدر «در حال لود») برای همیشه
// همون می‌مونه، حتی اگه یه لحظه بعد عکس واقعی لود بشه. پس قبل از هر clone، رو
// خودِ عنصر زنده (نه کلون) صبر می‌کنیم تا هیچ پلاسهولدر در-حال-لودی نمونده باشه.
function waitForProductImagesResolved(liveElement, maxWaitMs = 3000) {
  if (!liveElement) return Promise.resolve();
  return new Promise((resolve) => {
    const start = Date.now();
    const check = () => {
      const pending = liveElement.querySelectorAll('[data-resolving="true"]').length;
      if (pending === 0 || Date.now() - start > maxWaitMs) {
        resolve();
      } else {
        requestAnimationFrame(check);
      }
    };
    check();
  });
}

export default function InvoicePrint({
  invoiceData, 
  businessCard,
  onClose,
  autoPrint
}) {
  useRegisterOpenModal(true);
  const { showToast } = useToast();
  useEffect(() => {
    if (!onClose) return;
    return pushBackHandler(() => onClose());
  }, [onClose]);

  const [scale, setScale] = useState(1);
  // کاربر: از لحظه‌ی زدن دکمه‌ی سیو/اشتراک تا وقتی توست موفقیت میاد، خودِ آیکون
  // دکمه باید بچرخه (مثل دکمه‌ی سینک) و بعدش برگرده حالت عادی. مقدار: null یا
  // یکی از "pdf" | "image" | "sharePdf" | "shareImage"
  const [savingAction, setSavingAction] = useState(null);
  const containerRef = useRef(null);
  const paperRef = useRef(null);
  const [paperHeight, setPaperHeight] = useState(1123);
  const [isCompact, setIsCompact] = useState(window.innerWidth < 640);

  const handlePrint = () => {
    window.print();
  };

  const handleSaveAsPDF = () => {
    const paperElement = paperRef.current;
    if (!paperElement) return;
    setSavingAction("pdf");
    waitForProductImagesResolved(paperElement).then(() => {

    // Create an off-screen container to render the A4 page at 1x scale
    const cloneContainer = document.createElement("div");
    cloneContainer.style.position = "absolute";
    cloneContainer.style.top = "-9999px";
    cloneContainer.style.left = "-9999px";
    cloneContainer.style.width = "794px";
    cloneContainer.style.height = "auto";
    cloneContainer.style.background = "#ffffff";
    cloneContainer.style.direction = "rtl";
    document.body.appendChild(cloneContainer);

    const clonedPaper = paperElement.cloneNode(true);
    clonedPaper.style.transform = "none";
    clonedPaper.style.transformOrigin = "initial";
    clonedPaper.style.width = "794px";
    clonedPaper.style.height = "auto";
    
    cloneContainer.appendChild(clonedPaper);

    // Let clone render (و مهم‌تر: صبر کن img های کپی‌شده واقعاً لود بشن)
    waitForImagesToLoad(clonedPaper).then(() => {
      html2canvas(clonedPaper, {
        scale: 2, // 2x scale is perfect for PDF resolution
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
        width: 794,
        allowTaint: true
      }).then(async (canvas) => {
        const imgData = canvas.toDataURL("image/jpeg", 0.95);
        
        // Import jsPDF dynamically
        const { jsPDF } = await import("jspdf");
        
        const imgWidth = 210;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        
        // Create jsPDF with custom page size [width, height] in mm
        // We use Math.max(297, imgHeight) to ensure it is at least A4 size but can expand downwards infinitely!
        const pdf = new jsPDF({
          orientation: "p",
          unit: "mm",
          format: [210, Math.max(297, imgHeight)]
        });
        
        
        pdf.addImage(imgData, "JPEG", 0, 0, imgWidth, imgHeight);
        
        const safeId = invoiceData.id || "temp";
        const safeName = (invoiceData.customer?.name || "Invoice").replace(/[^a-zA-Z0-9؀-\u06FF\s-]/g, '').trim().replace(/\s+/g, '_');
        const pdfBlob = pdf.output("blob");
        await saveFile(pdfBlob, `Factor_${safeName}_${safeId}.pdf`, { subdir: REFARSH_SAVE_DIRS.BILLS_PDF, share: false });
        showToast("PDF فاکتور ذخیره شد", "success");
        setSavingAction(null);
        
        document.body.removeChild(cloneContainer);
      }).catch(err => {
        console.error("Error saving PDF:", err);
        alert("خطا در ذخیره فایل PDF");
        setSavingAction(null);
        if (cloneContainer.parentNode) {
          document.body.removeChild(cloneContainer);
        }
      });
    });
    });
  };

  useEffect(() => {
    const handleResize = () => {
      setIsCompact(window.innerWidth < 640);
      if (containerRef.current) {
        const parentWidth = containerRef.current.clientWidth;
        const targetWidth = 794;
        if (parentWidth < targetWidth) {
          const newScale = parentWidth / targetWidth;
          setScale(newScale);
        } else {
          setScale(1);
        }
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    
    // Set up ResizeObserver to track exact rendered height of the paper element
    let resizeObserver = null;
    if (paperRef.current && typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver((entries) => {
        for (let entry of entries) {
          const rect = entry.contentRect;
          if (rect && rect.height) {
            setPaperHeight(rect.height);
          } else if (entry.target) {
            setPaperHeight(entry.target.scrollHeight || 1123);
          }
        }
      });
      resizeObserver.observe(paperRef.current);
    }

    const timer = setTimeout(handleResize, 150);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      clearTimeout(timer);
    };
  }, [invoiceData]);

  useEffect(() => {
    if (autoPrint || invoiceData?.autoPrint) {
      const timer = setTimeout(() => {
        window.print();
      }, 750);
      return () => clearTimeout(timer);
    }
  }, [autoPrint, invoiceData]);

  // Capture invoice container and save as high-quality PNG image
  const handleSaveAsImage = () => {
    const paperElement = paperRef.current;
    if (!paperElement) return;
    setSavingAction("image");
    waitForProductImagesResolved(paperElement).then(() => {

    // Create an off-screen container to render the A4 page at 1x scale
    // This avoids html2canvas bugs caused by active CSS scale/transform properties
    const cloneContainer = document.createElement("div");
    cloneContainer.style.position = "absolute";
    cloneContainer.style.top = "-9999px";
    cloneContainer.style.left = "-9999px";
    cloneContainer.style.width = "794px";
    cloneContainer.style.height = "auto";
    cloneContainer.style.background = "#ffffff";
    cloneContainer.style.direction = "rtl";
    document.body.appendChild(cloneContainer);

    const clonedPaper = paperElement.cloneNode(true);
    clonedPaper.style.transform = "none";
    clonedPaper.style.transformOrigin = "initial";
    clonedPaper.style.width = "794px";
    clonedPaper.style.height = "auto";
    
    cloneContainer.appendChild(clonedPaper);

    // صبر کن img های کپی‌شده واقعاً لود بشن (نه صرفاً یه timeout ثابت)
    waitForImagesToLoad(clonedPaper).then(() => {
      html2canvas(clonedPaper, {
        scale: 2, // کاهش از 3 به 2 برای سرعت (کاربر: خیلی زمان‌بر بود) — همون کیفیتی که PDF ازش استفاده می‌کنه، مساحت پیکسل تقریباً نصف می‌شه
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
        width: 794,
        allowTaint: true
      
      }).then(async (canvas) => {
        const safeId = invoiceData.id || "temp";
        const safeName = (invoiceData.customer?.name || "Invoice").replace(/[^a-zA-Z0-9؀-\u06FF\s-]/g, '').trim().replace(/\s+/g, '_');
        await saveFile(canvas.toDataURL("image/png", 1.0), `Factor_${safeName}_${safeId}.png`, { subdir: REFARSH_SAVE_DIRS.BILLS_IMAGE, share: false });
        showToast("عکس فاکتور ذخیره شد", "success");
        setSavingAction(null);
        
        // Cleanup cloned elements
        document.body.removeChild(cloneContainer);
      }).catch(err => {
        console.error("Error saving image:", err);
        alert("خطا در ذخیره تصویر فاکتور");
        setSavingAction(null);
        if (cloneContainer.parentNode) {
          document.body.removeChild(cloneContainer);
        }
      });
    });
    });
  };


  const captureCanvas = async () => {
    const paperElement = paperRef.current;
    if (!paperElement) return null;
    await waitForProductImagesResolved(paperElement);
    const cloneContainer = document.createElement("div");
    cloneContainer.style.position = "absolute";
    cloneContainer.style.top = "-9999px";
    cloneContainer.style.left = "-9999px";
    cloneContainer.style.width = "794px";
    cloneContainer.style.background = "#ffffff";
    cloneContainer.style.direction = "rtl";
    document.body.appendChild(cloneContainer);
    const clonedPaper = paperElement.cloneNode(true);
    clonedPaper.style.transform = "none";
    clonedPaper.style.width = "794px";
    cloneContainer.appendChild(clonedPaper);
    await waitForImagesToLoad(clonedPaper);
    try {
      const canvas = await html2canvas(clonedPaper, {
        scale: 2, useCORS: true, backgroundColor: "#ffffff", logging: false, width: 794, allowTaint: true, // کاهش از 3 به 2 برای سرعت
      });
      return { canvas, cleanup: () => { if (cloneContainer.parentNode) document.body.removeChild(cloneContainer); } };
    } catch (e) {
      if (cloneContainer.parentNode) document.body.removeChild(cloneContainer);
      throw e;
    }
  };

  const handleSharePDF = async () => {
    setSavingAction("sharePdf");
    try {
      const cap = await captureCanvas();
      if (!cap) return;
      const { canvas, cleanup } = cap;
      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      const { jsPDF } = await import("jspdf");
      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const pdf = new jsPDF({ orientation: imgHeight > imgWidth ? "portrait" : "portrait", unit: "mm", format: [imgWidth, imgHeight] });
      pdf.addImage(imgData, "JPEG", 0, 0, imgWidth, imgHeight);
      const pdfBlob = pdf.output("blob");
      const safeId = invoiceData?.id || "temp";
      const safeName = (invoiceData?.customer?.name || "Invoice").replace(/[^a-zA-Z0-9؀-\u06FF\s-]/g, "").trim().replace(/\s+/g, "_");
      await shareFile(pdfBlob, `Factor_${safeName}_${safeId}.pdf`, { title: `فاکتور #${safeId}` });
      cleanup();
    } catch (err) {
      console.error(err);
      alert("خطا در اشتراک PDF");
    } finally {
      setSavingAction(null);
    }
  };

  const handleShareImage = async () => {
    setSavingAction("shareImage");
    try {
      const cap = await captureCanvas();
      if (!cap) return;
      const { canvas, cleanup } = cap;
      const safeId = invoiceData?.id || "temp";
      const safeName = (invoiceData?.customer?.name || "Invoice").replace(/[^a-zA-Z0-9؀-\u06FF\s-]/g, "").trim().replace(/\s+/g, "_");
      await shareFile(canvas.toDataURL("image/png", 1.0), `Factor_${safeName}_${safeId}.png`, { title: `فاکتور #${safeId}` });
      cleanup();
    } catch (err) {
      console.error(err);
      alert("خطا در اشتراک تصویر");
    } finally {
      setSavingAction(null);
    }
  };

  // همون منطق درست‌شده‌ی InvoiceTemplate.jsx (گالری/مشتری/فروش مستقیم با جنسیت) — اینجا هم
  // به‌جای دوباره‌نویسی (که قبلاً باعث پرانتز تکراری و متن اشتباه برای انبار/بی‌نام می‌شد) از همین استفاده می‌شه
  const stripGenderPrefix = (name) => {
    let n = String(name || "").trim();
    n = n.replace(/^(سرکار\s*خانم|جناب\s*آقای|خانم|آقای|آقا)\s+/u, "");
    n = n.replace(/^(سرکار\s*خانم|جناب\s*آقای|خانم|آقای|آقا)\s+/u, "");
    return n.trim();
  };
  const buildBuyerDisplayName = (customer) => {
    const trimmedName = stripGenderPrefix(customer?.name);
    const isGallery = customer?.kind === "gallery";
    const isWarehouse = customer?.kind === "warehouse" || (!customer?.kind && !isGallery);
    const genderPrefix = customer?.gender === "خانم" ? "سرکار خانم" : "جناب آقای";

    if (isGallery) {
      const galleryName = trimmedName || "گالری";
      const ownerName = customer?.galleryOwnerName?.trim();
      const ownerPrefix = customer?.galleryOwnerGender === "خانم" ? "سرکار خانم" : "جناب آقای";
      return ownerName
        ? `همکار گرامی: ${galleryName} (با مدیریت ${ownerPrefix} ${ownerName})`
        : `همکار گرامی: ${galleryName}`;
    }
    if (isWarehouse && !trimmedName) return "فروش مستقیم: مشتری گرامی";
    if (trimmedName) return `خریدار محترم: ${genderPrefix} ${trimmedName}`;
    return "فروش مستقیم: مشتری گرامی";
  };

  // Compile a clean, beautiful text summary to copy to clipboard
  const handleCopyText = () => {
    if (!invoiceData) return;
    
    const { id, date, customer, items = [], totals } = invoiceData;
    const buyerName = buildBuyerDisplayName(customer);

    let text = `📄 استودیو فرش و دکور ریفرش\n`;
    text += `----------------------------------\n`;
    text += `شماره فاکتور: #${id}\n`;
    text += `تاریخ صدور: ${date}\n`;
    text += `${buyerName}\n`;
    if (customer?.phone) text += `تلفن خریدار: ${customer.phone}\n`;
    text += `----------------------------------\n`;
    text += `اقلام فاکتور:\n`;
    
    items.forEach((item, idx) => {
      text += `${idx + 1}. ${item.name} (${item.dims || "ابعاد نامشخص"}) - قیمت نهایی: ${fmt(item.finalPrice)} تومان\n`;
    });
    
    text += `----------------------------------\n`;
    text += `جمع کل: ${fmt((totals?.total || 0))} تومان\n`;
    if ((totals?.discount || 0) > 0) text += `مجموع تخفیف: ${fmt((totals?.discount || 0))} تومان\n`;
    
    const settledTotal = items.filter(item => item.isSettled).reduce((sum, item) => sum + toNum(item.finalPrice), 0);
    const remainingPayable = Math.max(0, toNum((totals?.final || 0)) - settledTotal);
    
    if (settledTotal > 0) {
      text += `مبلغ پرداخت شده: ${fmt(settledTotal)} تومان\n`;
      text += `مبلغ باقیمانده قابل پرداخت: ${fmt(remainingPayable)} تومان\n`;
    } else {
      text += `مبلغ نهایی قابل پرداخت: ${fmt((totals?.final || 0))} تومان\n`;
    }
    
    text += `----------------------------------\n`;
    
    const phonesStr = Array.isArray(businessCard?.phones) 
      ? businessCard.phones.filter(Boolean).join(" / ") 
      : (businessCard?.phone || "");
    if (phonesStr) text += `تلفن پشتیبانی: ${phonesStr}\n`;
    if (businessCard?.instagram) text += `اینستاگرام: ${businessCard.instagram}\n`;
    text += `با تشکر از اعتماد شما - استودیو ریفرش`;

    navigator.clipboard.writeText(text).then(() => {
      alert("متن فاکتور با موفقیت در کلیپ‌بورد کپی شد.");
    }).catch(err => {
      console.error("Error copying text:", err);
      alert("خطا در کپی متن فاکتور");
    });
  };

  
  // Share basic details — روی اندروید از شیت اشتراک‌گذاری بومی، روی وب از Web Share API/کلیپ‌بورد
  const handleShare = async () => {
    if (!invoiceData) return;
    
    const { id, date, customer, totals } = invoiceData;
    const buyerName = buildBuyerDisplayName(customer);

    const textToShare = `فاکتور خرید #${id} از استودیو فرش و دکور ریفرش صادر گردید.\n${buyerName}\nمبلغ نهایی فاکتور: ${fmt(totals.final)} تومان.`;

    const result = await shareText({ title: `فاکتور خرید #${id}`, text: textToShare, url: window.location.href });
    if (result === "clipboard") {
      alert("سیستم اشتراک‌گذاری پیشرفته در دسترس نبود؛ خلاصه فاکتور در کلیپ‌بورد کپی شد تا بتوانید آن را ارسال کنید.");
    } else if (result === "failed") {
      alert("خطا در اشتراک‌گذاری فاکتور");
    }
  };

  return (
    <div className="invoice-print-wrapper" dir="rtl" style={{
      position: "fixed",
      top: 0,
      left: 0,
      width: "100vw",
      height: "100vh",
      background: "rgba(10, 10, 10, 0.97)",
      overflowY: "auto",
      overflowX: "hidden", // Completely disable horizontal scroll on print modal
      zIndex: 99999,
      padding: "20px 10px"
    }}>
      <style>{`
        @media print {
          /* Force hide everything in the app except the print modal wrapper */
          body * {
            visibility: hidden !important;
          }
          .invoice-print-wrapper, .invoice-print-wrapper * {
            visibility: visible !important;
          }
          .invoice-print-wrapper {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: auto !important;
            background: #fff !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
          }
          .no-print-wrapper {
            display: none !important;
            visibility: hidden !important;
          }
          .invoice-container-outer {
            width: 210mm !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
          }
          .invoice-scale-wrapper {
            transform: none !important;
            height: auto !important;
          }
        }
      `}</style>

      {/* UI Controls Header (hidden on print) */}
      <div className="no-print-wrapper" style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        display: 'flex',
        flexDirection: isCompact ? 'column' : 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: isCompact ? '10px' : '6px',
        marginBottom: 20,
        background: "#161616",
        border: "1px solid #2d2d2d",
        padding: "10px 12px",
        borderRadius: "10px",
        width: "100%",
        maxWidth: "794px",
        margin: "0 auto 20px auto",
        boxShadow: "0 4px 24px rgba(0,0,0,0.6)",
        direction: "rtl"
      }}>
        {/* Right side: Invoice Title/Brand */}
        <span style={{ fontSize: "11px", fontWeight: "600", color: "#F5F0EB", display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#8B1A1A" }}></span>
          پیش‌نمایش فاکتور استودیو ریفرش
        </span>

        {/* Left side: Rearranged Buttons (X on right, others on left) */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
          {/* Close button (X) on the right side of the group */}
          <button 
            onClick={onClose} 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              background: '#2a1414', 
              color: '#e08a8a', 
              border: '1px solid #5a2d2d', 
              borderRadius: 6, 
              cursor: 'pointer', 
              transition: "all 0.2s"
            }}
            title="بستن پیش‌نمایش (X)"
          >
            <X size={16} />
          </button>

          {/* Elegant vertical divider */}
          <div style={{ width: "1px", height: "20px", background: "#333", margin: "0 2px" }}></div>

          {/* Save as PDF → آبی (ذخیره‌ی خودکار در Documents/refarsh/factor/pdf) */}
          <button 
            onClick={handleSaveAsPDF} 
            disabled={savingAction === "pdf"}
            style={{ 
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              background: '#1a3a5c', 
              color: '#9ec9f5', 
              border: '1px solid #2a5080', 
              borderRadius: 6, 
              cursor: 'pointer', 
              transition: "all 0.2s" 
            }}
            title="ذخیره PDF در Documents/refarsh/factor/pdf"
          >
            {savingAction === "pdf" ? <RefreshCw size={15} className="animate-spin" /> : <FileDown size={15} />}
          </button>

          {/* Save as Image → آبی (ذخیره‌ی خودکار در Documents/refarsh/factor/image) */}
          <button 
            onClick={handleSaveAsImage} 
            disabled={savingAction === "image"}
            style={{ 
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              background: '#1a3a5c', 
              color: '#9ec9f5', 
              border: '1px solid #2a5080', 
              borderRadius: 6, 
              cursor: 'pointer', 
            }}
            title="ذخیره تصویر در Documents/refarsh/factor/image"
          >
            {savingAction === "image" ? <RefreshCw size={15} className="animate-spin" /> : <Download size={15} />}
          </button>

          {/* Copy Invoice Text */}
          <button 
            onClick={handleCopyText} 
            style={{ 
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              background: '#232323', 
              color: '#ddd', 
              border: '1px solid #333', 
              borderRadius: 6, 
              cursor: 'pointer', 
            }}
            title="کپی متن فاکتور"
          >
            <Copy size={15} />
          </button>

          {/* Share PDF → قرمز */}
          <button
            onClick={handleSharePDF}
            disabled={savingAction === "sharePdf"}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '32px', height: '32px', background: '#8B1A1A', color: '#fff',
              border: 'none', borderRadius: 6, cursor: 'pointer',
            }}
            title="اشتراک PDF"
          >
            {savingAction === "sharePdf" ? <RefreshCw size={15} className="animate-spin" /> : <FileDown size={15} />}
          </button>

          {/* Share Image → مشکی */}
          <button
            onClick={handleShareImage}
            disabled={savingAction === "shareImage"}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '32px', height: '32px', background: '#232323', color: '#ddd',
              border: '1px solid #333', borderRadius: 6, cursor: 'pointer',
            }}
            title="اشتراک تصویر"
          >
            {savingAction === "shareImage" ? <RefreshCw size={15} className="animate-spin" /> : <Download size={15} />}
          </button>
        </div>
      </div>

      <div 
        ref={containerRef} 
        style={{ 
          width: "100%", 
          maxWidth: "794px", 
          margin: "0 auto", 
          display: "flex",
          justifyContent: "center",
          overflow: "hidden" // Ensure no horizontal scrolling inside container
        }}
        className="invoice-container-outer"
      >
        <div 
          style={{ 
            transform: `scale(${scale})`, 
            transformOrigin: "top center", 
            width: "794px", // Keep fixed width for scale calculations
            height: `${paperHeight}px`, 
            marginBottom: `-${paperHeight * (1 - scale)}px`, // Pull bottom elements up
            marginLeft: `-${(794 * (1 - scale)) / 2}px`, // Pull left to match parent bounds
            marginRight: `-${(794 * (1 - scale)) / 2}px`, // Pull right to match parent bounds
            flexShrink: 0,
            overflow: "visible",
            transition: "transform 0.05s ease-out"
          }}
          className="invoice-scale-wrapper"
        >
          <div ref={paperRef} style={{ display: "block", textAlign: "right", width: "794px" }}>
            <InvoiceTemplate invoiceData={invoiceData} businessCard={businessCard} />
          </div>
        </div>
      </div>
    </div>
  );
}
