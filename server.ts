import "dotenv/config";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { requireAuth, AuthRequest } from "./src/middleware/auth.ts";
import {
  getDocsByUserId,
  setDoc,
  addDoc,
  deleteDoc,
  clearAllCollections,
  getDbBackendInfo,
} from "./src/lib/db-layer.ts";
import fs from "fs";

const app = express();
const PORT = 3000;

// Enable large JSON payload parsing to handle full database syncing and images
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// CORS: APK (capacitor://) و وب جدا از origin سرور به /api می‌زنند
app.use((req, res, next) => {
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, Accept");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  next();
});

// ── API ENDPOINTS ──

// Health check بدون توکن — فقط برای تست «آیا سرور زنده است»
app.get("/api/health", async (_req, res) => {
  try {
    const dbInfo = await getDbBackendInfo();
    res.json({
      status: "ok",
      serverTime: Date.now(),
      storage: dbInfo.backend,
      storageOk: dbInfo.ok,
    });
  } catch (err: any) {
    res.status(500).json({ status: "error", error: err?.message || "health failed" });
  }
});

// وضعیت سینک (با احراز هویت)
app.get("/api/sync/status", requireAuth, async (req, res) => {
  const dbInfo = await getDbBackendInfo();
  res.json({
    status: "ok",
    serverTime: Date.now(),
    info: "Refarsh Sync Server Online",
    storage: dbInfo.backend,
    storageOk: dbInfo.ok,
  });
});

// Conflict-Resolving Sync Endpoint
app.post("/api/sync", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUserId;
    if (!userId) {
      return res.status(400).json({ error: "User ID not registered" });
    }

    const { clientData, deletedIds = [], pendingChanges = [] } = req.body;
    const serverTime = Date.now();

    if (!clientData) {
      return res.status(400).json({ error: "No clientData provided" });
    }

    // 1. Log pending material changes
    for (const change of pendingChanges) {
      await addDoc("material_changes", {
        userId,
        materialId: change.materialId,
        action: change.action,
        timestamp: change.timestamp,
      }, userId);
    }

    // 2. Process client deletions (incoming tombstoning)
    for (const del of deletedIds) {
      const { id, type } = del;
      if (!id || !type) continue;

      let collName = "";
      if (type === "product" || type === "products") collName = "products";
      else if (type === "material" || type === "materials") collName = "materials";
      else if (type === "customer" || type === "customers") collName = "customers";
      else if (type === "equipment" || type === "equipments") collName = "equipment";
      else if (type === "workshopLink" || type === "workshopLinks") collName = "workshop_links";
      else if (type === "businessCard" || type === "businessCards") collName = "business_cards";
      else if (type === "productType" || type === "productTypes") collName = "product_types";
      else if (type === "invoiceDraft" || type === "invoiceDrafts") collName = "invoice_drafts";
      else if (type === "woodCuttingSession" || type === "woodCuttingSessions") collName = "wood_cutting_sessions";

      if (collName) {
        await deleteDoc(collName, id, userId);
      }
    }

    // 3. Load current database records for this user from DB Layer
    const dbProducts = await getDocsByUserId("products", userId);
    const dbMaterials = await getDocsByUserId("materials", userId);
    const dbCustomers = await getDocsByUserId("customers", userId);
    const dbEquipment = await getDocsByUserId("equipment", userId);
    const dbWorkshopLinks = await getDocsByUserId("workshop_links", userId);
    const dbBusinessCards = await getDocsByUserId("business_cards", userId);
    const dbProductTypes = await getDocsByUserId("product_types", userId);
    const dbInvoiceDrafts = await getDocsByUserId("invoice_drafts", userId);
    const dbWoodCuttingSessions = await getDocsByUserId("wood_cutting_sessions", userId);

    const dbProductsMap = new Map(dbProducts.map((p: any) => [p.id, p]));
    const dbMaterialsMap = new Map(dbMaterials.map((m: any) => [m.id, m]));
    const dbCustomersMap = new Map(dbCustomers.map((c: any) => [c.id, c]));
    const dbEquipmentMap = new Map(dbEquipment.map((e: any) => [e.id, e]));
    const dbWorkshopLinksMap = new Map(dbWorkshopLinks.map((w: any) => [w.id, w]));
    const dbBusinessCardsMap = new Map(dbBusinessCards.map((b: any) => [b.id, b]));
    const dbProductTypesMap = new Map(dbProductTypes.map((t: any) => [t.id, t]));
    const dbInvoiceDraftsMap = new Map(dbInvoiceDrafts.map((x: any) => [x.id, x]));
    const dbWoodCuttingSessionsMap = new Map(dbWoodCuttingSessions.map((x: any) => [x.id, x]));

    // 4. Upsert products
    if (Array.isArray(clientData.products)) {
      for (const p of clientData.products) {
        if (!p || !p.id) continue;
        const dbP = dbProductsMap.get(p.id);
        const clientUpdate = p.updatedAt || serverTime;
        const dbUpdate = dbP ? (dbP.updatedAt || 0) : 0;

        if (!dbP || clientUpdate > dbUpdate) {
          const val = {
            id: p.id,
            userId,
            code: p.code ? String(p.code) : null,
            group: p.group ? String(p.group) : null,
            name: p.name ? String(p.name) : null,
            dims: p.dims ? String(p.dims) : null,
            dimW: p.dimW !== undefined && p.dimW !== null ? String(p.dimW) : null,
            dimH: p.dimH !== undefined && p.dimH !== null ? String(p.dimH) : null,
            shape: p.shape ? String(p.shape) : null,
            images: p.images || [],
            image: p.image ? String(p.image) : null,
            lineItems: p.lineItems || [],
            salePrice: p.salePrice !== undefined && p.salePrice !== null ? String(p.salePrice) : null,
            profitPct: p.profitPct !== undefined && p.profitPct !== null ? String(p.profitPct) : null,
            status: p.status ? String(p.status) : null,
            location: p.location ? String(p.location) : null,
            settled: !!p.settled,
            buyerName: p.buyerName ? String(p.buyerName) : null,
            buyerCustomerId: p.buyerCustomerId ? String(p.buyerCustomerId) : null,
            buyerPhone: p.buyerPhone ? String(p.buyerPhone) : null,
            saleDate: p.saleDate ? String(p.saleDate) : null,
            settleDate: p.settleDate ? String(p.settleDate) : null,
            discountPercent: p.discountPercent !== undefined && p.discountPercent !== null ? String(p.discountPercent) : null,
            discountedPrice: p.discountedPrice !== undefined && p.discountedPrice !== null ? String(p.discountedPrice) : null,
            createdAt: p.createdAt ? String(p.createdAt) : null,
            updatedAt: clientUpdate,
            productTypeId: p.productTypeId ? String(p.productTypeId) : null,
            qty: p.qty !== undefined && p.qty !== null ? String(p.qty) : null,
          };
          await setDoc("products", p.id, val, userId);
        }
      }
    }

    // 5. Upsert materials
    if (Array.isArray(clientData.materials)) {
      for (const m of clientData.materials) {
        if (!m || !m.id) continue;
        const dbM = dbMaterialsMap.get(m.id);
        const clientUpdate = m.updatedAt || serverTime;
        const dbUpdate = dbM ? (dbM.updatedAt || 0) : 0;

        if (!dbM || clientUpdate > dbUpdate) {
          const val = {
            id: m.id,
            userId,
            name: m.name ? String(m.name) : null,
            type: m.type ? String(m.type) : null,
            category: m.category ? String(m.category) : null,
            totalCost: m.totalCost !== undefined && m.totalCost !== null ? String(m.totalCost) : null,
            remainingCost: m.remainingCost !== undefined && m.remainingCost !== null ? String(m.remainingCost) : null,
            procurements: m.procurements || [],
            batches: m.batches || [],
            sticks: m.sticks || [],
            isHardwareTool: !!m.isHardwareTool,
            includeInCost: m.includeInCost !== false,
            hidden: !!m.hidden,
            purchaseDate: m.purchaseDate ? String(m.purchaseDate) : null,
            dimW: m.dimW !== undefined && m.dimW !== null ? String(m.dimW) : null,
            dimH: m.dimH !== undefined && m.dimH !== null ? String(m.dimH) : null,
            unitLength: m.unitLength !== undefined && m.unitLength !== null ? String(m.unitLength) : null,
            ratioValue: m.ratioValue !== undefined && m.ratioValue !== null ? String(m.ratioValue) : null,
            fixedQty: m.fixedQty !== undefined && m.fixedQty !== null ? String(m.fixedQty) : null,
            defaultPct: m.defaultPct !== undefined && m.defaultPct !== null ? String(m.defaultPct) : null,
            updatedAt: clientUpdate,
          };
          await setDoc("materials", m.id, val, userId);
        }
      }
    }

    // 6. Upsert customers
    if (Array.isArray(clientData.customers)) {
      for (const c of clientData.customers) {
        if (!c || !c.id) continue;
        const dbC = dbCustomersMap.get(c.id);
        const clientUpdate = c.updatedAt || serverTime;
        const dbUpdate = dbC ? (dbC.updatedAt || 0) : 0;

        if (!dbC || clientUpdate > dbUpdate) {
          const val = {
            id: c.id,
            userId,
            name: c.name ? String(c.name) : null,
            phone: c.phone ? String(c.phone) : null,
            kind: c.kind ? String(c.kind) : null,
            color: c.color ? String(c.color) : null,
            note: c.note ? String(c.note) : null,
            updatedAt: clientUpdate,
          };
          await setDoc("customers", c.id, val, userId);
        }
      }
    }

    // 7. Upsert equipment
    if (Array.isArray(clientData.equipment)) {
      for (const e of clientData.equipment) {
        if (!e || !e.id) continue;
        const dbE = dbEquipmentMap.get(e.id);
        const clientUpdate = e.updatedAt || serverTime;
        const dbUpdate = dbE ? (dbE.updatedAt || 0) : 0;

        if (!dbE || clientUpdate > dbUpdate) {
          const val = {
            id: e.id,
            userId,
            name: e.name ? String(e.name) : null,
            type: e.type ? String(e.type) : null,
            purchasePrice: e.purchasePrice !== undefined && e.purchasePrice !== null ? String(e.purchasePrice) : null,
            purchaseDate: e.purchaseDate ? String(e.purchaseDate) : null,
            depreciationYears: e.depreciationYears !== undefined && e.depreciationYears !== null ? String(e.depreciationYears) : null,
            salvageValue: e.salvageValue !== undefined && e.salvageValue !== null ? String(e.salvageValue) : null,
            maintenanceCost: e.maintenanceCost !== undefined && e.maintenanceCost !== null ? String(e.maintenanceCost) : null,
            lastMaintenanceDate: e.lastMaintenanceDate ? String(e.lastMaintenanceDate) : null,
            note: e.note ? String(e.note) : null,
            updatedAt: clientUpdate,
          };
          await setDoc("equipment", e.id, val, userId);
        }
      }
    }

    // 8. Upsert workshopLinks
    if (Array.isArray(clientData.workshopLinks)) {
      for (const wl of clientData.workshopLinks) {
        if (!wl || !wl.id) continue;
        const dbWl = dbWorkshopLinksMap.get(wl.id);
        const clientUpdate = wl.updatedAt || serverTime;
        const dbUpdate = dbWl ? (dbWl.updatedAt || 0) : 0;

        if (!dbWl || clientUpdate > dbUpdate) {
          const val = {
            id: wl.id,
            userId,
            productId: wl.productId ? String(wl.productId) : null,
            materialId: wl.materialId ? String(wl.materialId) : null,
            frameId: wl.frameId ? String(wl.frameId) : null,
            updatedAt: clientUpdate,
          };
          await setDoc("workshop_links", wl.id, val, userId);
        }
      }
    }

    // 9. Upsert businessCards
    if (Array.isArray(clientData.businessCards)) {
      for (const b of clientData.businessCards) {
        if (!b || !b.id) continue;
        const dbB = dbBusinessCardsMap.get(b.id);
        const clientUpdate = b.updatedAt || serverTime;
        const dbUpdate = dbB ? (dbB.updatedAt || 0) : 0;

        if (!dbB || clientUpdate > dbUpdate) {
          const val = {
            id: b.id,
            userId,
            name: b.name ? String(b.name) : null,
            phone: b.phone ? String(b.phone) : null,
            address: b.address ? String(b.address) : null,
            website: b.website ? String(b.website) : null,
            instagram: b.instagram ? String(b.instagram) : null,
            linkedin: b.linkedin ? String(b.linkedin) : null,
            telegram: b.telegram ? String(b.telegram) : null,
            whatsapp: b.whatsapp ? String(b.whatsapp) : null,
            email: b.email ? String(b.email) : null,
            note: b.note ? String(b.note) : null,
            isMine: !!b.isMine,
            updatedAt: clientUpdate,
          };
          await setDoc("business_cards", b.id, val, userId);
        }
      }
    }

    // 9b. Upsert productTypes
    if (Array.isArray(clientData.productTypes)) {
      for (const t of clientData.productTypes) {
        if (!t || !t.id) continue;
        const dbT = dbProductTypesMap.get(t.id);
        const clientUpdate = t.updatedAt || serverTime;
        const dbUpdate = dbT ? (dbT.updatedAt || 0) : 0;

        if (!dbT || clientUpdate > dbUpdate) {
          const val = {
            id: t.id,
            userId,
            name: t.name ? String(t.name) : null,
            updatedAt: clientUpdate,
          };
          await setDoc("product_types", t.id, val, userId);
        }
      }
    }

    // 9c. Upsert invoiceDrafts (پیش‌فاکتورهای ذخیره‌شده — قبلاً هیچ‌جای سرور
    // پردازش نمی‌شدن، پس با هر سینک از دیتای کاربر پاک می‌شدن چون
    // consolidatedServerData فیلدش رو نداشت و migrateData سمت کلاینت خالی
    // جایگزینش می‌کرد)
    if (Array.isArray(clientData.invoiceDrafts)) {
      for (const draft of clientData.invoiceDrafts) {
        if (!draft || !draft.id) continue;
        const dbDraft = dbInvoiceDraftsMap.get(draft.id);
        const clientUpdate = draft.updatedAt || serverTime;
        const dbUpdate = dbDraft ? (dbDraft.updatedAt || 0) : 0;

        if (!dbDraft || clientUpdate > dbUpdate) {
          const val = {
            id: draft.id,
            userId,
            title: draft.title ? String(draft.title) : null,
            buyerName: draft.buyerName ? String(draft.buyerName) : null,
            buyerPhone: draft.buyerPhone ? String(draft.buyerPhone) : null,
            buyerAddress: draft.buyerAddress ? String(draft.buyerAddress) : null,
            buyerGender: draft.buyerGender ? String(draft.buyerGender) : null,
            date: draft.date ? String(draft.date) : null,
            items: Array.isArray(draft.items) ? draft.items : [],
            updatedAt: clientUpdate,
          };
          await setDoc("invoice_drafts", draft.id, val, userId);
        }
      }
    }

    // 9d. Upsert woodCuttingSessions (نشست‌های ذخیره‌شده‌ی برش چوب — دقیقاً همون
    // باگ invoiceDrafts بالا: این مجموعه هیچ‌جای سرور پردازش نمی‌شد، پس
    // consolidatedServerData فیلدش رو نداشت و هر سینک نشست‌های محلی رو پاک می‌کرد)
    if (Array.isArray(clientData.woodCuttingSessions)) {
      for (const session of clientData.woodCuttingSessions) {
        if (!session || !session.id) continue;
        const dbSession = dbWoodCuttingSessionsMap.get(session.id);
        const clientUpdate = session.updatedAt || session.timestamp || serverTime;
        const dbUpdate = dbSession ? (dbSession.updatedAt || dbSession.timestamp || 0) : 0;

        if (!dbSession || clientUpdate > dbUpdate) {
          // ساختار جلسه (frames/stickRows/panelRows/...) کاملاً آزاده و بین
          // نسخه‌های الگوریتم برش ممکنه فرق کنه، پس مثل invoiceDrafts.items
          // بدون دست‌کاری فیلد-به-فیلد کامل پاس داده می‌شه
          const val = {
            ...session,
            id: session.id,
            userId,
            updatedAt: clientUpdate,
          };
          await setDoc("wood_cutting_sessions", session.id, val, userId);
        }
      }
    }

    // 10. Upsert myBusinessCard singleton
    const myCard = clientData.myBusinessCard;
    if (myCard && myCard.id) {
      const dbB = dbBusinessCardsMap.get(myCard.id);
      const clientUpdate = myCard.updatedAt || serverTime;
      const dbUpdate = dbB ? (dbB.updatedAt || 0) : 0;

      if (!dbB || clientUpdate > dbUpdate) {
        const val = {
          id: myCard.id,
          userId,
          name: myCard.name ? String(myCard.name) : null,
          phone: myCard.phone ? String(myCard.phone) : null,
          address: myCard.address ? String(myCard.address) : null,
          website: myCard.website ? String(myCard.website) : null,
          instagram: myCard.instagram ? String(myCard.instagram) : null,
          linkedin: myCard.linkedin ? String(myCard.linkedin) : null,
          telegram: myCard.telegram ? String(myCard.telegram) : null,
          whatsapp: myCard.whatsapp ? String(myCard.whatsapp) : null,
          email: myCard.email ? String(myCard.email) : null,
          note: myCard.note ? String(myCard.note) : null,
          isMine: true,
          updatedAt: clientUpdate,
        };
        await setDoc("business_cards", myCard.id, val, userId);
      }
    }

    // 10.5 Upsert auditLog entries (بخش ۳۲)
    // ردپای تغییرات (audit log) الان بخشی از خودِ آبجکت اصلی data شده
    // (data.auditLog، کار همکار برای بخش ۲۹/۳۲) و همراه با clientData میاد.
    // رکوردهاش immutable-append-only هستن (یه id ثابت که هیچ‌وقت محتواش
    // عوض نمی‌شه)، پس نیازی به مقایسه‌ی updatedAt نیست؛ فقط با upsert
    // idempotent ذخیره می‌شن. نکته‌ی مهم: بدون این بخش، هر «همگام‌سازی»
    // چون سرور فیلد auditLog رو برنمی‌گردوند، migrateData سمت کلاینت
    // auditLog محلی رو با آرایه‌ی خالی جایگزین می‌کرد (یعنی لاگ پاک می‌شد)
    if (Array.isArray(clientData.auditLog)) {
      for (const entry of clientData.auditLog) {
        if (!entry || !entry.id) continue;
        await setDoc("audit_log", entry.id, {
          id: entry.id,
          userId,
          entity: entry.entity ? String(entry.entity) : null,
          entityLabel: entry.entityLabel ? String(entry.entityLabel) : null,
          entityId: entry.entityId ? String(entry.entityId) : null,
          entityName: entry.entityName ? String(entry.entityName) : "",
          action: entry.action ? String(entry.action) : null,
          date: entry.date || serverTime,
        }, userId);
      }
    }

    // 11. Fetch complete, fresh consolidated records for the user from DB Layer
    const finalProducts = await getDocsByUserId("products", userId);
    const finalMaterials = await getDocsByUserId("materials", userId);
    const finalCustomers = await getDocsByUserId("customers", userId);
    const finalEquipment = await getDocsByUserId("equipment", userId);
    const finalWorkshopLinks = await getDocsByUserId("workshop_links", userId);
    const finalBusinessCards = await getDocsByUserId("business_cards", userId);
    const finalAuditLog = await getDocsByUserId("audit_log", userId);
    const finalProductTypes = await getDocsByUserId("product_types", userId);
    const finalInvoiceDrafts = await getDocsByUserId("invoice_drafts", userId);
    const finalWoodCuttingSessions = await getDocsByUserId("wood_cutting_sessions", userId);

    // Convert values back to client types
    // نکته‌ی مهم: از `?? ` (nullish) استفاده می‌کنیم نه `? :` (truthy) — چون
    // truthy check نمی‌تونه بین «واقعاً null/تعریف‌نشده» و «واقعاً صفر یا
    // رشته‌ی خالی» فرق بذاره. این باعث می‌شد profitPct=null (که یعنی «این
    // محصول کاملاً دستی قیمت‌گذاری شده، دست نزن») توی هر سینک ابری به ۰
    // تبدیل بشه، علامتِ «دستی‌بودن» گم بشه، و بعدش syncPercentPricedProducts
    // قیمتش رو بی‌اجازه بازمحاسبه کنه — دقیقاً همون چیزی که کاربر گزارش داد
    const numOrNull = (v: any) => (v === null || v === undefined || v === "" ? null : Number(v));
    const clientProducts = finalProducts.map((p: any) => ({
      ...p,
      dimW: numOrNull(p.dimW),
      dimH: numOrNull(p.dimH),
      salePrice: numOrNull(p.salePrice) ?? 0,
      profitPct: numOrNull(p.profitPct),
      discountPercent: numOrNull(p.discountPercent) ?? 0,
      discountedPrice: numOrNull(p.discountedPrice) ?? 0,
      qty: numOrNull(p.qty) ?? 1,
      images: p.images || [],
      lineItems: p.lineItems || [],
    }));

    const clientMaterials = finalMaterials.map((m: any) => ({
      ...m,
      totalCost: numOrNull(m.totalCost) ?? 0,
      remainingCost: numOrNull(m.remainingCost) ?? 0,
      dimW: numOrNull(m.dimW),
      dimH: numOrNull(m.dimH),
      unitLength: numOrNull(m.unitLength),
      ratioValue: numOrNull(m.ratioValue),
      fixedQty: numOrNull(m.fixedQty),
      defaultPct: numOrNull(m.defaultPct) ?? 100,
      procurements: m.procurements || [],
      batches: m.batches || [],
      sticks: m.sticks || [],
    }));

    const clientCustomers = finalCustomers.map((c: any) => ({ ...c }));

    const clientEquipment = finalEquipment.map((e: any) => ({
      ...e,
      purchasePrice: numOrNull(e.purchasePrice) ?? 0,
      depreciationYears: numOrNull(e.depreciationYears) ?? 0,
      salvageValue: numOrNull(e.salvageValue) ?? 0,
      maintenanceCost: numOrNull(e.maintenanceCost) ?? 0,
    }));

    const clientWorkshopLinks = finalWorkshopLinks.map((wl: any) => ({ ...wl }));

    // بخش ۳۲: آخرین ۳۰۰ رویداد audit log (از همه‌ی دستگاه‌های همین کاربر)،
    // جدیدترین اول — همون سقفی که AUDIT_LOG_MAX توی utils/syncManager.js
    // سمت کلاینت هم استفاده می‌کنه
    const clientAuditLog = finalAuditLog
      .map((a: any) => ({
        id: a.id,
        entity: a.entity || null,
        entityLabel: a.entityLabel || null,
        entityId: a.entityId || null,
        entityName: a.entityName || "",
        action: a.action || null,
        date: a.date ? Number(a.date) : 0,
      }))
      .sort((a: any, b: any) => b.date - a.date)
      .slice(0, 300);

    // Distinguish "myBusinessCard" singleton and standard business cards list
    const clientMyBusinessCard = finalBusinessCards.find((b: any) => b.isMine) || {};
    const clientOtherBusinessCards = finalBusinessCards.filter((b: any) => !b.isMine);

    const consolidatedServerData = {
      products: clientProducts,
      materials: clientMaterials,
      customers: clientCustomers,
      equipment: clientEquipment,
      workshopLinks: clientWorkshopLinks,
      myBusinessCard: clientMyBusinessCard,
      businessCards: clientOtherBusinessCards,
      auditLog: clientAuditLog,
      productTypes: finalProductTypes.map((t: any) => ({ ...t })),
      invoiceDrafts: finalInvoiceDrafts.map((d: any) => ({
        id: d.id,
        title: d.title || null,
        buyerName: d.buyerName || null,
        buyerPhone: d.buyerPhone || null,
        buyerAddress: d.buyerAddress || null,
        buyerGender: d.buyerGender || null,
        date: d.date || null,
        items: Array.isArray(d.items) ? d.items : [],
        updatedAt: d.updatedAt ? Number(d.updatedAt) : 0,
      })),
      woodCuttingSessions: finalWoodCuttingSessions.map((s: any) => {
        const { userId: _uid, ...rest } = s;
        return { ...rest, updatedAt: s.updatedAt ? Number(s.updatedAt) : 0 };
      }),
      __schemaVersion: 7,
    };

    return res.json({
      success: true,
      serverTime,
      serverData: consolidatedServerData,
    });

  } catch (err: any) {
    console.error("Sync error:", err);
    return res.status(500).json({ error: "Internal server error during sync", details: err.message });
  }
});

// Clear remote store (revert to default empty database for user)
app.post("/api/sync/reset", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUserId;
    if (!userId) {
      return res.status(400).json({ error: "User ID not registered" });
    }

    await clearAllCollections(userId);

    res.json({ success: true, message: "Server master store reset completed for this user." });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── INVOICE ENDPOINTS ──

app.get("/api/invoices", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUserId;
    if (!userId) return res.status(400).json({ error: "User ID not registered" });
    const allInvoices = await getDocsByUserId("invoices", userId);
    res.json(allInvoices);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.post("/api/invoices", requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUserId;
    if (!userId) return res.status(400).json({ error: "User ID not registered" });
    const { id, customerId, date, total, discount, finalTotal, settled, settleDate, type, items } = req.body;
    
    await setDoc("invoices", id, {
      id,
      userId,
      customerId: customerId || null,
      date: date || null,
      total: total || null,
      discount: discount || null,
      finalTotal: finalTotal || null,
      settled: !!settled,
      settleDate: settleDate || null,
      type: type || null,
      updatedAt: Date.now()
    }, userId);

    if (Array.isArray(items)) {
      for (const item of items) {
        const itemId = item.id || `${id}_${Date.now()}_${Math.random()}`;
        await setDoc("invoice_items", itemId, {
          ...item,
          userId,
          invoiceId: id,
          updatedAt: Date.now()
        }, userId);
      }
    }
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── FILE UPLOAD ENDPOINT ──
// بخش «بازطراحی ذخیره‌سازی عکس‌ها» (Wall 🟣): این endpoint حذف شد — علاوه بر
// این‌که با معماری جدید (پوشه‌ی محلی روی خودِ گوشی/سیستم کاربر، نه سرور)
// ناسازگار بود، یه آسیب‌پذیری امنیتی واقعی هم داشت: `destPath` مستقیم از
// body کلاینت گرفته می‌شد و بدون هیچ اعتبارسنجی/sanitize به fs.mkdirSync +
// fs.copyFileSync پاس داده می‌شد — یعنی هر کاربر لاگین‌شده‌ای می‌تونست با یه
// destPath دلخواه (مثلاً یه مسیر سیستمی) هر فایلی رو هرجای دیسک سرور بنویسه
// (path traversal / arbitrary file write). عکس‌ها الان توی `src/utils/imageStorage.js`
// مدیریت می‌شن (Capacitor Filesystem روی اندروید، IndexedDB روی وب).

// ── VITE MIDDLEWARE SETUP FOR DEV VS PRODUCTION SERVING ──

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite development middleware integrated.");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Static production build folders served from:", distPath);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Refarsh Studio Sync Backend Running on http://localhost:${PORT}`);
  });
}

startServer();
