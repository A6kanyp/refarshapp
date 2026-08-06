import React, { useState, useMemo } from "react";
import { 
  Receipt, Eye, Printer, Search, ArrowUpDown, ChevronDown, ChevronUp, FileText, 
  Calendar, CheckCircle2, AlertCircle, ShoppingBag, Landmark, User, DollarSign,
  Palette, Edit3, Save, RefreshCw, Filter, X
, Trash2, Edit2, Plus } from "lucide-react";
import { fmt, fmtCode, fmtDate, toNum, formatProductDims, qtySuffix } from "../mathCore";
import { uid } from "../dataModels";
import { JalaliDatePicker } from "./JalaliDatePicker";
import InvoicePrint from "./InvoicePrint";

const S = {
  container: { display: "flex", flexDirection: "column", gap: 16, width: "100%" },
  header: { display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 12, borderBottom: "1px solid #1f1f1f", paddingBottom: 12 },
  title: { fontSize: 16, fontWeight: 700, color: "#F5F0EB", display: "flex", alignItems: "center", gap: 8 },
  subtitle: { fontSize: 11, color: "#888", marginTop: 2 },
  statsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 },
  statCard: { background: "#121212", border: "1px solid #1e1e1e", borderRadius: 10, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 4 },
  statLabel: { fontSize: 10, color: "#666", fontWeight: 600 },
  statValue: { fontSize: 15, fontWeight: 700, color: "#F5F0EB" },
  card: { background: "#111111", border: "1px solid #1c1c1c", borderRadius: 12, padding: 16 },
  input: { background: "#1c1c1c", border: "1px solid #2a2a2a", borderRadius: 6, padding: "8px 12px", color: "#ddd", fontSize: 11.5, outline: "none", fontFamily: "inherit", transition: "border-color 0.2s" },
  btn: { background: "#8B1A1A", color: "#F5F0EB", border: "none", borderRadius: 6, padding: "8px 14px", fontSize: 11.5, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, transition: "all 0.2s" },
  btnOutline: { background: "transparent", color: "#888", border: "1px solid #2a2a2a", borderRadius: 6, padding: "8px 14px", fontSize: 11.5, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 },
  chip: { background: "#1c1c1c", border: "1px solid #2a2a2a", color: "#888", fontSize: 10, padding: "4px 9px", borderRadius: 12, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4 },
};

export default function InvoicesTab({
  productTotals = [],
  customers = [],
  setData,
  notify,
  businessCard = null,
  invoiceDrafts = []
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterStatus, setFilterStatus] = useState("all"); // 'all', 'settled', 'unsettled'
  const [filterSaleType, setFilterSaleType] = useState("all"); // 'all', 'direct', 'customer', 'gallery'
  const [activePrintInvoice, setActivePrintInvoice] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editBuyerName, setEditBuyerName] = useState("");
  const [editBuyerPhone, setEditBuyerPhone] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editSettled, setEditSettled] = useState(true);
  const [autoPrint, setAutoPrint] = useState(false);
  const [expandedInvoiceId, setExpandedInvoiceId] = useState(null);
  const [showAddItemPicker, setShowAddItemPicker] = useState(false);
  const [addItemQuery, setAddItemQuery] = useState("");

  // States for پیش‌فاکتور (Draft) Creator — قبلاً «Sandbox» بود؛ الان به‌جای
  // دیتای تستی/دستی، از محصولات واقعی انتخاب می‌شه
  const [currentDraftId, setCurrentDraftId] = useState(null);
  const [customInvoiceTitle, setCustomInvoiceTitle] = useState("پیش‌فاکتور فروش");
  const [customBuyerName, setCustomBuyerName] = useState("");
  const [customBuyerPhone, setCustomBuyerPhone] = useState("");
  const [customBuyerAddress, setCustomBuyerAddress] = useState("");
  const [customBuyerGender, setCustomBuyerGender] = useState("آقا");
  const [customDate, setCustomDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [customItems, setCustomItems] = useState([]);
  const [customIsSettled, setCustomIsSettled] = useState(true);
  const [customDeposit, setCustomDeposit] = useState(0);
  const [productPickerQuery, setProductPickerQuery] = useState("");

  const [showProductPicker, setShowProductPicker] = useState(false);
  const availableProductsForDraft = useMemo(
    () => (productTotals || []).filter((p) => p.status === "available"),
    [productTotals]
  );
  const productPickerResults = useMemo(() => {
    const q = productPickerQuery.trim().toLowerCase();
    const pool = q
      ? availableProductsForDraft.filter((p) => p.name?.toLowerCase().includes(q) || String(p.code).includes(q))
      : availableProductsForDraft;
    return pool.slice(0, 40);
  }, [productPickerQuery, availableProductsForDraft]);

  // پیدا کردن محصولات موجود برای افزودن به یک فاکتور ثبت‌شده در حال ویرایش
  const addItemResults = useMemo(() => {
    const q = addItemQuery.trim().toLowerCase();
    const pool = q
      ? availableProductsForDraft.filter((p) => p.name?.toLowerCase().includes(q) || String(p.code).includes(q))
      : availableProductsForDraft;
    return pool.slice(0, 30);
  }, [addItemQuery, availableProductsForDraft]);

  const addProductToDraft = (p) => {
    setCustomItems((items) => [...items, {
      productId: p.id,
      name: p.name,
      code: fmtCode(p.code),
      dims: formatProductDims(p) + qtySuffix(p),
      finalPrice: toNum(p.discountedPrice ?? p.salePrice),
      isSettled: true,
      image: p.image || "",
    }]);
    setProductPickerQuery("");
  };

  const removeItemFromDraft = (i) => {
    setCustomItems((items) => items.filter((_, idx) => idx !== i));
  };

  const resetDraftForm = () => {
    setCurrentDraftId(null);
    setCustomInvoiceTitle("پیش‌فاکتور فروش");
    setCustomBuyerName("");
    setCustomBuyerPhone("");
    setCustomBuyerAddress("");
    setCustomBuyerGender("آقا");
    setCustomDate(new Date().toISOString().substring(0, 10));
    setCustomItems([]);
    setCustomIsSettled(true);
    setCustomDeposit(0);
  };

  const handleSaveDraft = () => {
    const draft = {
      id: currentDraftId || `draft_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      title: customInvoiceTitle,
      buyerName: customBuyerName,
      buyerPhone: customBuyerPhone,
      buyerAddress: customBuyerAddress,
      buyerGender: customBuyerGender,
      date: customDate,
      items: customItems,
      isSettled: customIsSettled,
      deposit: toNum(customDeposit),
      updatedAt: Date.now(),
    };
    setData((d) => {
      const list = d.invoiceDrafts || [];
      const idx = list.findIndex((x) => x.id === draft.id);
      const next = idx === -1 ? [...list, draft] : list.map((x, i) => (i === idx ? draft : x));
      return { ...d, invoiceDrafts: next };
    });
    setCurrentDraftId(draft.id);
    notify && notify("پیش‌فاکتور ذخیره شد");
  };

  const handleLoadDraft = (draft) => {
    setCurrentDraftId(draft.id);
    setCustomInvoiceTitle(draft.title || "پیش‌فاکتور فروش");
    setCustomBuyerName(draft.buyerName || "");
    setCustomBuyerPhone(draft.buyerPhone || "");
    setCustomBuyerAddress(draft.buyerAddress || "");
    setCustomBuyerGender(draft.buyerGender || "آقا");
    setCustomDate(draft.date || new Date().toISOString().substring(0, 10));
    setCustomItems(draft.items || []);
    setCustomIsSettled(draft.isSettled !== false);
    setCustomDeposit(toNum(draft.deposit) || 0);
  };

  const handleDeleteDraft = (id) => {
    setData((d) => ({ ...d, invoiceDrafts: (d.invoiceDrafts || []).filter((x) => x.id !== id) }));
    if (currentDraftId === id) resetDraftForm();
    notify && notify("پیش‌فاکتور حذف شد");
  };

  // یه پیش‌فاکتور ذخیره‌شده رو «نهایی» می‌کنه: محصولات واقعیِ توش (که productId دارن) رو
  // sold می‌کنه (دقیقاً همون قراردادی که سبد خرید تب محصولات برای فروش استفاده می‌کنه)
  // و خودِ پیش‌فاکتور از لیست پیش‌نویس‌ها حذف می‌شه — از اون به بعد جزو فاکتورهای رسمی‌ست
  const handleFinalizeDraft = (draft) => {
    if (!setData) return;
    const itemsWithProduct = (draft.items || []).filter((it) => it.productId);
    if (itemsWithProduct.length === 0) {
      notify && notify("این پیش‌فاکتور هیچ محصول واقعی‌ای نداره که بشه نهایی‌ش کرد");
      return;
    }
    const name = (draft.buyerName || "").trim();
    const saleDate = draft.date || new Date().toISOString().substring(0, 10);
    const priceById = {};
    itemsWithProduct.forEach((it) => { priceById[it.productId] = toNum(it.finalPrice); });
    const ids = new Set(itemsWithProduct.map((it) => it.productId));

    setData((d) => {
      let customersList = [...(d.customers || [])];
      let custId = null;
      if (name) {
        const existing = customersList.find((c) => c.kind === "customer" && c.name.toLowerCase() === name.toLowerCase());
        if (existing) {
          custId = existing.id;
        } else {
          const nc = { id: uid(), name, phone: draft.buyerPhone || "", note: draft.buyerAddress || "", color: "#8B1A1A", kind: "customer" };
          customersList = [...customersList, nc];
          custId = nc.id;
        }
      }
      const updatedProducts = d.products.map((p) => {
        if (!ids.has(p.id)) return p;
        const orig = toNum(p.salePrice);
        const fp = priceById[p.id];
        const discPct = orig > 0 && fp < orig ? Math.round((1 - fp / orig) * 100) : 0;
        return {
          ...p,
          status: "sold",
          location: custId || p.location,
          buyerCustomerId: custId,
          buyerName: name,
          buyerPhone: draft.buyerPhone || "",
          buyerAddress: draft.buyerAddress || "",
          buyerGender: draft.buyerGender || "",
          saleDate,
          settled: !!draft.isSettled,
          settleDate: draft.isSettled ? saleDate : null,
          discountPercent: discPct,
          discountedPrice: fp,
        };
      });
      const nextDrafts = (d.invoiceDrafts || []).filter((x) => x.id !== draft.id);
      return { ...d, products: updatedProducts, customers: customersList, invoiceDrafts: nextDrafts };
    });
    if (currentDraftId === draft.id) resetDraftForm();
    notify && notify("پیش‌فاکتور نهایی و به فاکتور رسمی تبدیل شد");
  };

  // Compute Invoices Grouped from Product Totals
  const invoices = useMemo(() => {
    const sold = (productTotals || []).filter((p) => p.status === "sold" && p.saleDate);
    const groups = {};
    sold.forEach((p) => {
      const buyerId = p.buyerCustomerId || p.location || "warehouse";
      const dateStr = p.saleDate.substring(0, 10);
      const key = `${buyerId}_${dateStr}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    });

    const custMap = {};
    (customers || []).forEach((c) => (custMap[c.id] = c));

    return Object.keys(groups)
      .map((key) => {
        const parts = key.split("_");
        const buyerId = parts[0];
        const dateStr = parts.slice(1).join("_");
        const items = groups[key];
        const buyerName =
          buyerId === "warehouse"
            ? "پیش خودم (انبار)"
            : custMap[buyerId]?.name || buyerId || "ناشناس";
        const buyerPhone = items[0]?.buyerPhone || custMap[buyerId]?.phone || "";
        const buyerAddress = items[0]?.buyerAddress || custMap[buyerId]?.note || "";
        const buyerGender = items[0]?.buyerGender || "";
        const saleType = buyerId === "warehouse" ? "direct" : (custMap[buyerId]?.kind === "gallery" ? "gallery" : "customer");
        return {
          id: key,
          date: dateStr,
          buyerId,
          buyerName,
          buyerPhone,
          buyerAddress,
          buyerGender,
          saleType,
          items,
          total: items.reduce((s, p) => s + toNum(p.salePrice), 0),
          allSettled: items.every((p) => p.settled),
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [productTotals, customers]);

  // Multi-criteria Filtered Invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        inv.buyerName.toLowerCase().includes(q) ||
        inv.date.includes(q) ||
        inv.items.some(
          (p) => p.name?.toLowerCase().includes(q) || String(p.code).includes(q)
        );

      const matchesDate =
        (!filterDateFrom || inv.date >= filterDateFrom) &&
        (!filterDateTo || inv.date <= filterDateTo);

      const matchesStatus =
        filterStatus === "all" ||
        (filterStatus === "settled" && inv.allSettled) ||
        (filterStatus === "unsettled" && !inv.allSettled);

      const matchesSaleType = filterSaleType === "all" || inv.saleType === filterSaleType;

      return matchesSearch && matchesDate && matchesStatus && matchesSaleType;
    });
  }, [invoices, searchQuery, filterDateFrom, filterDateTo, filterStatus, filterSaleType]);

  // Calculations for stats
  const stats = useMemo(() => {
    const totalCount = invoices.length;
    const settledCount = invoices.filter(i => i.allSettled).length;
    const totalAmount = invoices.reduce((s, i) => s + i.total, 0);
    const unsettledAmount = invoices.reduce((sum, inv) => {
      const outstanding = inv.items.filter(p => !p.settled).reduce((s, p) => s + toNum(p.salePrice), 0);
      return sum + outstanding;
    }, 0);

    return {
      totalCount,
      settledCount,
      unsettledCount: totalCount - settledCount,
      totalAmount,
      unsettledAmount,
      settledPct: totalCount > 0 ? Math.round((settledCount / totalCount) * 100) : 100
    };
  }, [invoices]);


  const handleEditClick = (inv, e) => {
    e.stopPropagation();
    setEditingId(inv.id);
    setEditBuyerName(inv.buyerName);
    setEditBuyerPhone(inv.buyerPhone);
    setEditDate(inv.date);
    setEditSettled(inv.allSettled);
    setExpandedInvoiceId(inv.id);
    setShowAddItemPicker(false);
    setAddItemQuery("");
  };

  const handleSaveInvoiceEdit = (invId) => {
    if (!editBuyerName.trim()) {
      if (notify) notify("نام خریدار نمی‌تواند خالی باشد");
      return;
    }
    if (setData) {
      setData((d) => {
        let customersList = [...(d.customers || [])];
        let custId = null;

        // Ensure customer exists
        const existingCustIdx = customersList.findIndex(c => c.name === editBuyerName.trim() && c.kind === "customer");
        if (existingCustIdx !== -1) {
          custId = customersList[existingCustIdx].id;
          if (editBuyerPhone && editBuyerPhone !== customersList[existingCustIdx].phone) {
            customersList = customersList.map((c, i) => i === existingCustIdx ? { ...c, phone: editBuyerPhone } : c);
          }
        } else {
          // Check if it matches a gallery
          const existingGal = customersList.find(c => c.name === editBuyerName.trim() && c.kind === "gallery");
          if (existingGal) {
            custId = existingGal.id;
          } else {
            // create new customer
            const nc = {
              id: "CUST-" + Date.now() + Math.floor(Math.random()*1000),
              name: editBuyerName.trim(),
              phone: editBuyerPhone,
              kind: "customer",
            };
            customersList = [...customersList, nc];
            custId = nc.id;
          }
        }

        const updatedProducts = d.products.map((p) => {
          const buyerId = p.buyerCustomerId || p.location || "warehouse";
          const dateStr = p.saleDate?.substring(0, 10);
          const groupKey = `${buyerId}_${dateStr}`;
          if (groupKey === invId) {
            return {
              ...p,
              buyerCustomerId: custId,
              buyerName: editBuyerName.trim(),
              buyerPhone: editBuyerPhone,
              saleDate: editDate,
              settled: editSettled,
              settleDate: editSettled ? (p.settleDate || editDate) : null,
              location: custId || "warehouse",
            };
          }
          return p;
        });

        return { ...d, products: updatedProducts, customers: customersList };
      });
      if (notify) notify("فاکتور با موفقیت ویرایش شد");
    }
    setEditingId(null);
  };

  // یک قلم رو از فاکتور جدا می‌کنه (برخلاف حذف کل فاکتور) — محصول به انبار برمی‌گرده
  const handleRemoveItemFromInvoice = (productId) => {
    if (!setData) return;
    setData((d) => ({
      ...d,
      products: d.products.map((p) =>
        p.id === productId
          ? {
              ...p,
              status: "available",
              location: "warehouse",
              buyerCustomerId: null,
              buyerName: "",
              buyerPhone: "",
              saleDate: null,
              settled: false,
              settleDate: null,
            }
          : p
      ),
    }));
    if (notify) notify("کالا از فاکتور جدا و به انبار برگشت");
  };

  // یک محصول موجود رو به فاکتور در حال ویرایش اضافه می‌کنه
  const handleAddItemToInvoice = (inv, product) => {
    if (!setData) return;
    setData((d) => ({
      ...d,
      products: d.products.map((p) =>
        p.id === product.id
          ? {
              ...p,
              status: "sold",
              location: inv.buyerId,
              buyerCustomerId: inv.buyerId === "warehouse" ? null : inv.buyerId,
              buyerName: editBuyerName || inv.buyerName,
              buyerPhone: editBuyerPhone || inv.buyerPhone,
              saleDate: editDate || inv.date,
              settled: editSettled,
              settleDate: editSettled ? (editDate || inv.date) : null,
            }
          : p
      ),
    }));
    if (notify) notify("محصول به فاکتور اضافه شد");
  };

  // تخفیف تک‌تک اقلام — مستقیم روی خودِ رکورد محصول می‌نویسه (discountPercent/discountedPrice)
  // پس این تغییر همه‌جای دیگه (تب محصولات، حسابداری و...) هم که همین فیلدها رو می‌خونن دیده می‌شه
  const handleItemDiscountChange = (product, rawValue) => {
    if (!setData) return;
    const disc = rawValue === "" ? 0 : Math.min(100, Math.max(0, parseFloat(rawValue) || 0));
    const sp = toNum(product.salePrice);
    const dp = disc > 0 ? Math.round(sp * (1 - disc / 100)) : sp;
    setData((d) => ({
      ...d,
      products: d.products.map((p) =>
        p.id === product.id ? { ...p, discountPercent: disc, discountedPrice: dp } : p
      ),
    }));
  };

  const handleDeleteInvoice = (invId, e) => {
    e.stopPropagation();
    if (window.confirm("آیا از حذف این فاکتور و بازگرداندن محصولات آن به انبار مطمئن هستید؟")) {
      if (setData) {
        setData((d) => {
          const updatedProducts = d.products.map((p) => {
            const buyerId = p.buyerCustomerId || p.location || "warehouse";
            const dateStr = p.saleDate?.substring(0, 10);
            const groupKey = `${buyerId}_${dateStr}`;
            if (groupKey === invId) {
              return {
                ...p,
                status: "available",
                location: "warehouse",
                buyerCustomerId: null,
                buyerName: "",
                buyerPhone: "",
                saleDate: null,
                settled: false,
                settleDate: null,
              };
            }
            return p;
          });
          return { ...d, products: updatedProducts };
        });
        if (notify) notify("فاکتور با موفقیت حذف شد و محصولات به انبار بازگشتند");
      }
    }
  };

  const handleTriggerPrint = (inv, printImmediately = false) => {
    const mappedItems = inv.items.map(p => {
      const orig = toNum(p.salePrice);
      let finalP = orig;
      let disc = 0;
      let isGift = false;
      if (p.discountedPrice != null && toNum(p.discountedPrice) < orig) {
        finalP = toNum(p.discountedPrice);
        disc = orig - finalP;
        isGift = finalP <= 0;
      } else if (p.discount && toNum(p.discount) > 0) {
        disc = toNum(p.discount);
        finalP = Math.max(0, orig - disc);
        isGift = finalP <= 0;
      } else if (p.discountPercent && toNum(p.discountPercent) > 0) {
        disc = (orig * toNum(p.discountPercent)) / 100;
        finalP = Math.max(0, orig - disc);
        isGift = toNum(p.discountPercent) >= 100;
      }
      return {
        name: p.name,
        code: fmtCode(p.code),
        isGift,
        image: p.image || (p.images && p.images[0]) || "",
        dims: formatProductDims(p) + qtySuffix(p),
        originalPrice: orig,
        finalPrice: finalP,
        discountPct: disc > 0 && orig > 0 ? Math.round((disc / orig) * 100) : 0,
        isSettled: p.settled
      };
    });

    const totalOrig = mappedItems.reduce((acc, item) => acc + item.originalPrice, 0);
    const totalFinal = mappedItems.reduce((acc, item) => acc + item.finalPrice, 0);
    const totalDisc = totalOrig - totalFinal;

    const matchingCustomer = customers?.find(c => c.name?.trim().toLowerCase() === inv.buyerName?.trim().toLowerCase());
    const customerObj = matchingCustomer ? {
      ...matchingCustomer,
      name: matchingCustomer.name || inv.buyerName,
      phone: inv.buyerPhone || matchingCustomer.phone || "",
      address: inv.buyerAddress || matchingCustomer.address || "",
      gender: inv.buyerGender || matchingCustomer.gender || "unknown"
    } : {
      name: inv.buyerName,
      phone: inv.buyerPhone || "",
      address: inv.buyerAddress || "",
      gender: inv.buyerGender || "unknown"
    };

    const invoiceData = {
      id: 1000 + Math.floor(Math.random() * 9000),
      type: matchingCustomer?.kind === "gallery" ? "accounting" : "sales",
      date: fmtDate(inv.date),
      customer: customerObj,
      items: mappedItems,
      totals: {
        total: totalOrig,
        discount: totalDisc,
        final: totalFinal
      }
    };

    setAutoPrint(printImmediately);
    setActivePrintInvoice(invoiceData);
  };

  const handlePrintRawSandbox = () => {
    const invoiceData = {
      id: currentDraftId || "DRAFT-PREVIEW",
      type: "sales",
      date: fmtDate(customDate),
      customer: {
        name: customBuyerName,
        phone: customBuyerPhone,
        address: customBuyerAddress,
        gender: customBuyerGender
      },
      items: customItems.map((item) => ({
        ...item,
        originalPrice: item.finalPrice,
        discountPct: 0,
        // آیتم ۲ (نمای پیشرفته): وضعیت تسویه‌ی کل پیش‌فاکتور به هر قلم اعمال می‌شه
        // (قبلاً هر قلم همیشه isSettled پیش‌فرض/undefined بود، مستقل از تاگل بالای فرم)
        isSettled: customIsSettled,
      })),
      totals: {
        total: customItems.reduce((s, x) => s + toNum(x.finalPrice), 0),
        discount: 0,
        final: customItems.reduce((s, x) => s + toNum(x.finalPrice), 0)
      },
      // مبلغ ودیعه هم توی چاپ/پیش‌نمایش A4 از مبلغ نهایی کم بشه (InvoiceTemplate.jsx)
      depositAmount: customIsSettled ? 0 : toNum(customDeposit),
    };
    setAutoPrint(false);
    setActivePrintInvoice(invoiceData);
  };

  return (
    <div style={S.container} dir="rtl">
      {/* Title */}
      <div style={S.header}>
        <div>
          <h1 style={S.title}>
            <Receipt size={18} color="#8B1A1A" />
            سیستم یکپارچه فاکتورهای کارگاه ریفرش
          </h1>
          <p style={S.subtitle}>مدیریت مالی، صدور فاکتور رسمی مشتریان و شبیه‌سازی قالب چاپی</p>
        </div>
      </div>

      {/* Stats row */}
      <div style={S.statsGrid}>
        <div style={S.statCard}>
          <span style={S.statLabel}>کل فاکتورهای صادر شده</span>
          <span style={S.statValue}>{stats.totalCount} فاکتور</span>
        </div>
        <div style={S.statCard}>
          <span style={S.statLabel}>وضعیت تسویه مالی</span>
          <span style={{ ...S.statValue, color: stats.settledPct > 70 ? "#5fd180" : "#f2c94c" }}>
            {stats.settledPct}٪ ({stats.settledCount} تسویه)
          </span>
        </div>
        <div style={S.statCard}>
          <span style={S.statLabel}>کل مطالبات معوقه</span>
          <span style={{ ...S.statValue, color: "#e08a8a" }}>{fmt(stats.unsettledAmount)} تومان</span>
        </div>
        <div style={S.statCard}>
          <span style={S.statLabel}>مجموع درآمدهای حاصله</span>
          <span style={{ ...S.statValue, color: "#5fd180" }}>{fmt(stats.totalAmount)} تومان</span>
        </div>
      </div>

      {/* چیدمان: قبلاً یه گرید ۲ستونه‌ی ثابت (inline style) بود که کلاس ریسپانسیو
          Tailwind رو خنثی می‌کرد (چون inline style همیشه رو کلاس اولویت داره) و
          روی گوشی باعث اسکرول افقی می‌شد. الان یه ستون عمودی ساده‌ست — هم اسکرول
          افقی از بین رفت، هم «پیش‌فاکتور» طبیعتاً رفت پایینِ لیست فاکتورها */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        
        {/* لیست فاکتورهای صادر شده */}
        <div style={S.card}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#F5F0EB" }}>فاکتورهای صادر شده ({filteredInvoices.length})</span>
              
              {/* Reset Filters Quick Button */}
              {(searchQuery || filterDateFrom || filterDateTo || filterStatus !== "all" || filterSaleType !== "all") && (
                <button 
                  onClick={() => { setSearchQuery(""); setFilterDateFrom(""); setFilterDateTo(""); setFilterStatus("all"); setFilterSaleType("all"); }}
                  style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "#8B1A1A", fontSize: 10, cursor: "pointer", fontWeight: "bold" }}
                >
                  <X size={10} /> حذف فیلترها
                </button>
              )}
            </div>

            {/* Filter controls: خط اول جستجو، خط بعد از‌تاریخ/تا‌تاریخ کنار هم */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {/* Search text filter */}
              <div style={{ position: "relative", width: "100%" }}>
                <input onFocus={(e) => e.target.select()} 
                  style={{ ...S.input, width: "100%", paddingRight: 28, height: 32, fontSize: 10.5 }}
                  placeholder="جستجوی نام یا کد..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <Search size={11} color="#666" style={{ position: "absolute", right: 10, top: 11 }} />
              </div>

              {/* Date range filter */}
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ position: "relative", flex: "1 1 0" }}>
                  <div style={{ fontSize: 9, color: "#666", marginBottom: 3 }}>از تاریخ</div>
                  <JalaliDatePicker 
                    value={filterDateFrom}
                    onChange={(val) => setFilterDateFrom(val)}
                    allowEmpty={true}
                  />
                </div>
                <div style={{ position: "relative", flex: "1 1 0" }}>
                  <div style={{ fontSize: 9, color: "#666", marginBottom: 3 }}>تا تاریخ</div>
                  <JalaliDatePicker 
                    value={filterDateTo}
                    onChange={(val) => setFilterDateTo(val)}
                    allowEmpty={true}
                  />
                </div>
              </div>
            </div>

            {/* Sale type filter */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, background: "#151515", padding: 3, borderRadius: 8, border: "1px solid #1f1f1f" }}>
              <button
                onClick={() => setFilterSaleType("all")}
                style={{ flex: "1 1 70px", padding: "6px 0", fontSize: 10, fontWeight: 600, border: "none", borderRadius: 6, cursor: "pointer", background: filterSaleType === "all" ? "#8B1A1A" : "transparent", color: filterSaleType === "all" ? "#fff" : "#888", transition: "all 0.15s" }}
              >
                همه‌ی فروش‌ها
              </button>
              <button
                onClick={() => setFilterSaleType("direct")}
                style={{ flex: "1 1 70px", padding: "6px 0", fontSize: 10, fontWeight: 600, border: "none", borderRadius: 6, cursor: "pointer", background: filterSaleType === "direct" ? "#2a2a3a" : "transparent", color: filterSaleType === "direct" ? "#a89bd4" : "#888", transition: "all 0.15s" }}
              >
                مستقیم
              </button>
              <button
                onClick={() => setFilterSaleType("customer")}
                style={{ flex: "1 1 70px", padding: "6px 0", fontSize: 10, fontWeight: 600, border: "none", borderRadius: 6, cursor: "pointer", background: filterSaleType === "customer" ? "#1d3a24" : "transparent", color: filterSaleType === "customer" ? "#5fd180" : "#888", transition: "all 0.15s" }}
              >
                به مشتری
              </button>
              <button
                onClick={() => setFilterSaleType("gallery")}
                style={{ flex: "1 1 70px", padding: "6px 0", fontSize: 10, fontWeight: 600, border: "none", borderRadius: 6, cursor: "pointer", background: filterSaleType === "gallery" ? "#3a2414" : "transparent", color: filterSaleType === "gallery" ? "#e0a35a" : "#888", transition: "all 0.15s" }}
              >
                ارجاع به گالری
              </button>
            </div>

            {/* Settlement filter tabs */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, background: "#151515", padding: 3, borderRadius: 8, border: "1px solid #1f1f1f" }}>
              <button 
                onClick={() => setFilterStatus("all")}
                style={{ flex: "1 1 70px", padding: "6px 0", fontSize: 10, fontWeight: 600, border: "none", borderRadius: 6, cursor: "pointer", background: filterStatus === "all" ? "#8B1A1A" : "transparent", color: filterStatus === "all" ? "#fff" : "#888", transition: "all 0.15s" }}
              >
                همه فاکتورها
              </button>
              <button 
                onClick={() => setFilterStatus("settled")}
                style={{ flex: "1 1 70px", padding: "6px 0", fontSize: 10, fontWeight: 600, border: "none", borderRadius: 6, cursor: "pointer", background: filterStatus === "settled" ? "#1d3a24" : "transparent", color: filterStatus === "settled" ? "#5fd180" : "#888", transition: "all 0.15s" }}
              >
                تسویه شده
              </button>
              <button 
                onClick={() => setFilterStatus("unsettled")}
                style={{ flex: "1 1 70px", padding: "6px 0", fontSize: 10, fontWeight: 600, border: "none", borderRadius: 6, cursor: "pointer", background: filterStatus === "unsettled" ? "#3a1d1d" : "transparent", color: filterStatus === "unsettled" ? "#e08a8a" : "#888", transition: "all 0.15s" }}
              >
                بدهکاران
              </button>
            </div>
          </div>

          {filteredInvoices.length === 0 ? (
            <div style={{ fontSize: 11, color: "#555", textAlign: "center", padding: "40px 0", border: "1px dashed #222", borderRadius: 8 }}>
              هیچ فاکتوری با شرایط فیلتر شده یافت نشد.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingLeft: 2 }}>
              {filteredInvoices.map((inv) => {
                const isExpanded = expandedInvoiceId === inv.id;
                return (
                  <div key={inv.id} style={{ background: "#141414", border: "1px solid #1e1e1e", borderRadius: 8, overflow: "hidden", transition: "border-color 0.2s" }} className="hover:border-neutral-800">
                    <div 
                      style={{ padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
                      onClick={() => {
                        setExpandedInvoiceId(isExpanded ? null : inv.id);
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 11.5, fontWeight: 700, color: "#eee" }}>{inv.buyerName}</div>
                        <div style={{ fontSize: 9.5, color: "#666", marginTop: 3, display: "flex", alignItems: "center", gap: 6 }}>
                          <Calendar size={10} /> {fmtDate(inv.date)} · <span>{inv.items.length} کالا</span>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ textAlign: "left" }}>
                          <div style={{ fontSize: 12, fontWeight: 800, color: "#5fd180" }}>{fmt(inv.total)} ت</div>
                          <div style={{ fontSize: 8.5, fontWeight: "600", color: inv.allSettled ? "#5fd180" : "#e08a8a", marginTop: 2 }}>
                            {inv.allSettled ? "✓ تسویه کامل" : "⚠ مانده بدهکار"}
                          </div>
                        </div>

                        {/* Fast actions buttons */}
                        <div style={{ display: "flex", gap: 4 }} onClick={(e) => e.stopPropagation()}>
                          
                          <button 
                            style={{ padding: "5px 9px", background: "#333", border: "none", borderRadius: 4, cursor: "pointer", color: "#ccc" }} 
                            onClick={(e) => handleEditClick(inv, e)}
                            title="ویرایش فاکتور"
                          >
                            <Edit2 size={11} />
                          </button>
                          <button 
                            style={{ padding: "5px 9px", background: "#2a1414", border: "none", borderRadius: 4, cursor: "pointer", color: "#e08a8a" }} 
                            onClick={(e) => handleDeleteInvoice(inv.id, e)}
                            title="حذف فاکتور"
                          >
                            <Trash2 size={11} />
                          </button>
    <button 
                            style={{ ...S.btn, padding: "5px 9px", background: "#222" }} 
                            onClick={() => handleTriggerPrint(inv, false)}
                            title="مشاهده جزئیات فاکتور"
                          >
                            <Eye size={11} color="#aaa" />
                          </button>
                          <button 
                            style={{ ...S.btn, padding: "5px 9px", background: "#8B1A1A" }} 
                            onClick={() => handleTriggerPrint(inv, true)}
                            title="پرینت رسمی"
                          >
                            <Printer size={11} />
                          </button>
                        </div>

                        {isExpanded ? <ChevronUp size={12} color="#555" /> : <ChevronDown size={12} color="#555" />}
                      </div>
                    </div>

                    {isExpanded && editingId === inv.id && (
                      <div style={{ padding: "10px 12px", background: "#0a0a0a", borderTop: "1px solid #1e1e1e" }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                          <div>
                            <label style={{ fontSize: 9, color: "#888" }}>نام خریدار</label>
                            <input onFocus={(e) => e.target.select()} style={{ ...S.input, width: "100%", height: 30, marginTop: 3 }} value={editBuyerName} onChange={(e) => setEditBuyerName(e.target.value)} />
                          </div>
                          <div>
                            <label style={{ fontSize: 9, color: "#888" }}>شماره تماس</label>
                            <input onFocus={(e) => e.target.select()} style={{ ...S.input, width: "100%", height: 30, marginTop: 3 }} value={editBuyerPhone} onChange={(e) => setEditBuyerPhone(e.target.value)} />
                          </div>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10, alignItems: "end" }}>
                          <div>
                            <label style={{ fontSize: 9, color: "#888" }}>تاریخ فروش</label>
                            <JalaliDatePicker value={editDate} onChange={(val) => setEditDate(val)} />
                          </div>
                          <button
                            onClick={() => setEditSettled((s) => !s)}
                            style={{ height: 32, borderRadius: 6, border: "none", cursor: "pointer", fontSize: 10.5, fontWeight: 600, background: editSettled ? "#1d3a24" : "#3a1d1d", color: editSettled ? "#5fd180" : "#e08a8a" }}
                          >
                            {editSettled ? "✓ تسویه‌شده" : "⚠ بدهکار"}
                          </button>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
                          {inv.items.map(p => (
                            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 6, paddingBottom: 5, borderBottom: "1px dashed #151515" }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 10, color: "#ccc", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>#{fmtCode(p.code)} {p.name}</div>
                                <div style={{ fontSize: 9, color: "#666" }}>{fmt(toNum(p.salePrice))} ت</div>
                              </div>
                              <input
                                type="number" min={0} max={100} onFocus={(e) => e.target.select()}
                                value={toNum(p.discountPercent) || ""}
                                placeholder="0٪"
                                onChange={(e) => handleItemDiscountChange(p, e.target.value)}
                                style={{ ...S.input, width: 46, height: 26, padding: "2px 4px", textAlign: "center", fontSize: 10 }}
                                title="درصد تخفیف این کالا"
                              />
                              <button
                                onClick={() => handleRemoveItemFromInvoice(p.id)}
                                title="حذف این کالا از فاکتور"
                                style={{ padding: "5px 7px", background: "#2a1414", border: "none", borderRadius: 4, cursor: "pointer", color: "#e08a8a" }}
                              >
                                <Trash2 size={10} />
                              </button>
                            </div>
                          ))}
                          {inv.items.length === 0 && (
                            <div style={{ fontSize: 9.5, color: "#555", textAlign: "center", padding: "8px 0" }}>همه‌ی اقلام از این فاکتور جدا شدن</div>
                          )}
                        </div>

                        {!showAddItemPicker ? (
                          <button onClick={() => setShowAddItemPicker(true)} style={{ ...S.btnOutline, width: "100%", justifyContent: "center", fontSize: 10, marginBottom: 10 }}>
                            <Plus size={11} /> افزودن محصول به این فاکتور
                          </button>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
                            <input
                              autoFocus placeholder="جستجوی محصول موجود..."
                              value={addItemQuery} onChange={(e) => setAddItemQuery(e.target.value)}
                              style={{ ...S.input, width: "100%", height: 30 }}
                            />
                            <div style={{ maxHeight: 140, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
                              {addItemResults.length === 0 ? (
                                <div style={{ fontSize: 9.5, color: "#555", padding: "6px 0" }}>محصول موجودی پیدا نشد</div>
                              ) : addItemResults.map((p) => (
                                <div key={p.id}
                                  onClick={() => { handleAddItemToInvoice(inv, p); setShowAddItemPicker(false); setAddItemQuery(""); }}
                                  style={{ fontSize: 10, color: "#ccc", padding: "6px 8px", background: "#161616", borderRadius: 5, cursor: "pointer", display: "flex", justifyContent: "space-between" }}
                                >
                                  <span>#{fmtCode(p.code)} {p.name}</span>
                                  <span style={{ color: "#5fd180" }}>{fmt(toNum(p.discountedPrice ?? p.salePrice))} ت</span>
                                </div>
                              ))}
                            </div>
                            <button onClick={() => { setShowAddItemPicker(false); setAddItemQuery(""); }} style={{ ...S.btnOutline, fontSize: 9.5, alignSelf: "flex-end", padding: "4px 10px" }}>بستن</button>
                          </div>
                        )}

                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                          <button onClick={() => { setEditingId(null); setShowAddItemPicker(false); }} style={{ ...S.btnOutline, fontSize: 10, padding: "6px 12px" }}>انصراف</button>
                          <button onClick={() => handleSaveInvoiceEdit(inv.id)} style={{ ...S.btn, fontSize: 10, padding: "6px 12px", background: "#1d3a24", color: "#5fd180" }}>
                            <Save size={11} style={{ marginLeft: 3 }} /> ذخیره تغییرات
                          </button>
                        </div>
                      </div>
                    )}

                    {isExpanded && editingId !== inv.id && (
                      <div style={{ padding: "10px 12px", background: "#0a0a0a", borderTop: "1px solid #1e1e1e" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 10 }}>
                          {inv.items.map(p => (
                            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#888", paddingBottom: 4, borderBottom: "1px dashed #151515" }}>
                              <span>#{fmtCode(p.code)} {p.name}</span>
                              <span style={{ color: "#aaa" }}>{fmt(toNum(p.salePrice))} ت</span>
                            </div>
                          ))}
                        </div>
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                          <button style={{ ...S.btn, fontSize: 10, padding: "5px 10px", background: "#1d3a24", color: "#5fd180" }} onClick={() => handleTriggerPrint(inv, true)}>
                            <Printer size={11} style={{ marginLeft: 3 }} /> چاپ فوری A4
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* پیش‌فاکتور (Draft) — حالا زیر لیست فاکتورها، نه کنارش */}
        <div style={S.card}>
          <div style={{ borderBottom: "1px solid #1f1f1f", paddingBottom: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#F5F0EB", display: "flex", alignItems: "center", gap: 6 }}>
              <Palette size={13} color="#f2c94c" />
              پیش‌فاکتور (Draft)
            </span>
            <p style={{ fontSize: 9.5, color: "#666", marginTop: 3 }}>محصولات واقعی رو اضافه کن، پیش‌نویس رو ذخیره کن، بعداً برگرد و کامل/چاپش کن</p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div>
                <label style={{ fontSize: 9, color: "#888" }}>عنوان برگه فاکتور</label>
                <input onFocus={(e) => e.target.select()} 
                  style={{ ...S.input, width: "100%", height: 32, marginTop: 3 }} 
                  value={customInvoiceTitle} 
                  onChange={(e) => setCustomInvoiceTitle(e.target.value)}
                />
              </div>
              <div>
                <label style={{ fontSize: 9, color: "#888" }}>نام مشتری / گالری</label>
                <input onFocus={(e) => e.target.select()} 
                  style={{ ...S.input, width: "100%", height: 32, marginTop: 3 }} 
                  value={customBuyerName} 
                  onChange={(e) => setCustomBuyerName(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div>
                <label style={{ fontSize: 9, color: "#888" }}>تلفن همراه خریدار</label>
                <input onFocus={(e) => e.target.select()} 
                  style={{ ...S.input, width: "100%", height: 32, marginTop: 3 }} 
                  value={customBuyerPhone} 
                  onChange={(e) => setCustomBuyerPhone(e.target.value)}
                />
              </div>
              <div>
                <label style={{ fontSize: 9, color: "#888" }}>نشانی پستی خریدار</label>
                <input onFocus={(e) => e.target.select()} 
                  style={{ ...S.input, width: "100%", height: 32, marginTop: 3 }} 
                  value={customBuyerAddress} 
                  onChange={(e) => setCustomBuyerAddress(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div>
                <label style={{ fontSize: 9, color: "#888" }}>جنسیت خریدار</label>
                <select 
                  style={{ ...S.input, width: "100%", height: 32, marginTop: 3, padding: "4px 8px" }} 
                  value={customBuyerGender} 
                  onChange={(e) => setCustomBuyerGender(e.target.value)}
                >
                  <option value="آقا">جناب آقای</option>
                  <option value="خانم">سرکار خانم</option>
                  <option value="حقوقی">گالری همکار</option>
                  <option value="">نامشخص</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 9, color: "#888" }}>تاریخ فاکتور</label>
                <JalaliDatePicker 
                  style={{ marginTop: 3 }}
                  value={customDate} 
                  onChange={(val) => setCustomDate(val)}
                />
              </div>
            </div>

            {/* Product Picker — دقیقاً مثل سبد خرید: یه لیست باز/بسته‌شونده،
                نه فقط با جستجوی کد؛ محصولات از‌قبل‌فروخته‌شده توش نیستن */}
            <div>
              <button
                onClick={() => setShowProductPicker((s) => !s)}
                style={{ ...S.btnOutline, width: "100%", justifyContent: "space-between" }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <ShoppingBag size={13} />
                  افزودن محصول از انبار ({availableProductsForDraft.length} موجود)
                </span>
                {showProductPicker ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
              {showProductPicker && (
                <div style={{ marginTop: 6 }}>
                  <input onFocus={(e) => e.target.select()}
                    style={{ ...S.input, width: "100%", height: 32 }}
                    placeholder="فیلتر با نام یا کد محصول..."
                    value={productPickerQuery}
                    onChange={(e) => setProductPickerQuery(e.target.value)}
                  />
                  <div style={{ background: "#1c1c1c", border: "1px solid #2a2a2a", borderRadius: 8, marginTop: 4, maxHeight: 240, overflowY: "auto" }}>
                    {productPickerResults.length === 0 ? (
                      <div style={{ padding: "12px 10px", fontSize: 10, color: "#555", textAlign: "center" }}>محصول موجودی پیدا نشد</div>
                    ) : (
                      productPickerResults.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => addProductToDraft(p)}
                          style={{ display: "flex", width: "100%", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", background: "transparent", border: "none", borderBottom: "1px solid #232323", color: "#ddd", fontSize: 10.5, fontFamily: "inherit", cursor: "pointer", textAlign: "right" }}
                        >
                          <span>#{fmtCode(p.code)} {p.name} — {formatProductDims(p)}</span>
                          <span style={{ color: "#5fd180" }}>{fmt(toNum(p.discountedPrice ?? p.salePrice))} ت</span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Items list */}
            <div>
              <span style={{ fontSize: 9.5, fontWeight: "700", color: "#aaa" }}>اقلام پیش‌فاکتور ({customItems.length}):</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 5 }}>
                {customItems.length === 0 && (
                  <div style={{ fontSize: 9.5, color: "#444", padding: "8px 0" }}>هنوز محصولی اضافه نشده</div>
                )}
                {customItems.map((item, i) => (
                  <div key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <button
                      onClick={() => removeItemFromDraft(i)}
                      style={{ background: "transparent", border: "none", color: "#8B1A1A", cursor: "pointer", padding: 2, flexShrink: 0 }}
                      title="حذف قلم"
                    >
                      <Trash2 size={13} />
                    </button>
                    <input onFocus={(e) => e.target.select()} 
                      style={{ ...S.input, flex: 2, height: 28, padding: "2px 8px", fontSize: 10 }}
                      value={item.name}
                      onChange={(e) => {
                        const copy = [...customItems];
                        copy[i].name = e.target.value;
                        setCustomItems(copy);
                      }}
                    />
                    <input onFocus={(e) => e.target.select()} 
                      style={{ ...S.input, width: 60, height: 28, padding: "2px 4px", fontSize: 10, textAlign: "center" }}
                      value={item.dims}
                      placeholder="ابعاد"
                      onChange={(e) => {
                        const copy = [...customItems];
                        copy[i].dims = e.target.value;
                        setCustomItems(copy);
                      }}
                    />
                    <input onFocus={(e) => e.target.select()} 
                      type="number"
                      style={{ ...S.input, width: 85, height: 28, padding: "2px 6px", fontSize: 10 }}
                      value={item.finalPrice}
                      onChange={(e) => {
                        const copy = [...customItems];
                        copy[i].finalPrice = parseInt(e.target.value) || 0;
                        setCustomItems(copy);
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* وضعیت تسویه + ودیعه + مبلغ قابل پرداخت */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, alignItems: "end" }}>
              <button
                onClick={() => setCustomIsSettled((s) => !s)}
                style={{ height: 32, marginTop: 3, borderRadius: 6, border: "none", cursor: "pointer", fontSize: 10.5, fontWeight: 600, background: customIsSettled ? "#1d3a24" : "#3a1d1d", color: customIsSettled ? "#5fd180" : "#e08a8a" }}
              >
                {customIsSettled ? "✓ تسویه‌شده" : "⚠ بدهکار / پیش‌پرداخت"}
              </button>
              {!customIsSettled && (
                <div>
                  <label style={{ fontSize: 9, color: "#888" }}>مبلغ ودیعه (پیش‌پرداخت)</label>
                  <input onFocus={(e) => e.target.select()}
                    type="number"
                    style={{ ...S.input, width: "100%", height: 32, marginTop: 3 }}
                    value={customDeposit || ""}
                    placeholder="0"
                    onChange={(e) => setCustomDeposit(parseInt(e.target.value) || 0)}
                  />
                </div>
              )}
            </div>
            {!customIsSettled && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "#F5F0EB", background: "#161616", borderRadius: 8, padding: "8px 12px" }}>
                <span style={{ color: "#888" }}>مبلغ قابل پرداخت (بعد از ودیعه)</span>
                <span style={{ fontWeight: 700 }}>{fmt(Math.max(0, customItems.reduce((s, x) => s + toNum(x.finalPrice), 0) - toNum(customDeposit)))} ت</span>
              </div>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button style={{ ...S.btnOutline, flex: 1, justifyContent: "center" }} onClick={handleSaveDraft}>
                <Save size={13} />
                {currentDraftId ? "ذخیره تغییرات" : "ذخیره پیش‌نویس"}
              </button>
              {currentDraftId && (
                <button style={{ ...S.btnOutline, justifyContent: "center", color: "#8B1A1A" }} onClick={resetDraftForm}>
                  <X size={13} />
                  جدید
                </button>
              )}
            </div>

            <button style={{ ...S.btn, width: "100%", justifyContent: "center", marginTop: 4 }} onClick={handlePrintRawSandbox}>
              <Eye size={13} />
              پیش‌نمایش و چاپ A4
            </button>
          </div>
        </div>

        {/* Saved Drafts List */}
        {invoiceDrafts.length > 0 && (
          <div style={S.card}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#F5F0EB", display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <FileText size={13} color="#7aa8d8" />
              پیش‌فاکتورهای ذخیره‌شده ({invoiceDrafts.length})
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {invoiceDrafts.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).map((draft) => {
                const total = (draft.items || []).reduce((s, x) => s + toNum(x.finalPrice), 0);
                return (
                  <div key={draft.id} style={{ display: "flex", alignItems: "center", gap: 8, background: "#121212", border: "1px solid #1e1e1e", borderRadius: 8, padding: "8px 10px" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, color: "#ddd" }}>{draft.title || "پیش‌فاکتور"} {draft.buyerName && `— ${draft.buyerName}`}</div>
                      <div style={{ fontSize: 9.5, color: "#666", marginTop: 2 }}>{(draft.items || []).length} قلم — {fmt(total)} ت</div>
                    </div>
                    <button style={{ ...S.chip }} onClick={() => handleLoadDraft(draft)}>باز کردن</button>
                    <button
                      style={{ ...S.chip, background: "#1d3a24", color: "#5fd180", border: "none" }}
                      onClick={() => handleFinalizeDraft(draft)}
                      title="تبدیل به فاکتور رسمی (محصولاتش sold می‌شن و از پیش‌نویس‌ها حذف می‌شه)"
                    >
                      <CheckCircle2 size={12} /> نهایی‌کردن
                    </button>
                    <button style={{ background: "transparent", border: "none", color: "#8B1A1A", cursor: "pointer", padding: 4 }} onClick={() => handleDeleteDraft(draft.id)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>

      {/* Invoice Modal Overlay */}
      {activePrintInvoice && (
        <InvoicePrint
          invoiceData={activePrintInvoice}
          businessCard={businessCard}
          autoPrint={autoPrint}
          onClose={() => setActivePrintInvoice(null)}
        />
      )}
    </div>
  );
}
