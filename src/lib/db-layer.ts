// ============================================================
// db-layer.ts — لایهٔ ذخیره‌سازی سمت سرور
// ------------------------------------------------------------
// قبلاً: Firestore + fallback فایل JSON محلی
// الان: PostgreSQL (Neon) به‌صورت document-store (JSONB)
//
// مدل دادهٔ کلاینت انعطاف‌پذیر است (فیلدهای پویا، آرایه، nested).
// به‌جای نگاشت ستون‌به‌ستون (که با هر فیچر جدید می‌شکند)، هر سند
// مثل Firestore داخل یک جدول واحد با payload JSONB ذخیره می‌شود.
// این هم با API فعلی سازگار است، هم برای سینک لحظه‌ای با سایت
// (query روی user_id / collection / updated_at) آماده است.
//
// احراز هویت همچنان Firebase Auth است؛ فقط ذخیره‌ی داده روی SQL است.
// ============================================================

import pg from "pg";
import fs from "fs";
import path from "path";

const { Pool } = pg;

// ── Pool ──
function createPool(): pg.Pool | null {
  const host = process.env.SQL_HOST;
  const user = process.env.SQL_USER || process.env.SQL_ADMIN_USER;
  const password = process.env.SQL_PASSWORD || process.env.SQL_ADMIN_PASSWORD;
  const database = process.env.SQL_DB_NAME;

  if (!host || !user || !password || !database) {
    console.warn(
      "[db-layer] SQL credentials missing (SQL_HOST / SQL_USER / SQL_PASSWORD / SQL_DB_NAME). Falling back to local JSON."
    );
    return null;
  }

  return new Pool({
    host,
    user,
    password,
    database,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
    max: 10,
  });
}

const pool = createPool();
let sqlReady = false;
let schemaEnsured = false;

// ── Local JSON fallback (اگر SQL در دسترس نباشد) ──
const DB_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

function getLocalDbPath(userId: string): string {
  return path.join(DB_DIR, `local_db_${userId}.json`);
}

function emptyLocalDb() {
  return {
    users: null as any,
    products: [] as any[],
    materials: [] as any[],
    customers: [] as any[],
    equipment: [] as any[],
    workshop_links: [] as any[],
    business_cards: [] as any[],
    invoices: [] as any[],
    invoice_items: [] as any[],
    material_changes: [] as any[],
    invoice_drafts: [] as any[],
    wood_cutting_sessions: [] as any[],
    product_types: [] as any[],
  };
}

function readLocalDb(userId: string): any {
  const filePath = getLocalDbPath(userId);
  if (!fs.existsSync(filePath)) return emptyLocalDb();
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (err) {
    console.error(`Error reading local DB for ${userId}:`, err);
    return emptyLocalDb();
  }
}

function writeLocalDb(userId: string, data: any): void {
  try {
    fs.writeFileSync(getLocalDbPath(userId), JSON.stringify(data, null, 2), "utf8");
  } catch (err) {
    console.error(`Error writing local DB for ${userId}:`, err);
  }
}

// ── Schema bootstrap ──
async function ensureSchema(): Promise<boolean> {
  if (!pool) return false;
  if (schemaEnsured) return true;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS app_users (
        uid TEXT PRIMARY KEY,
        email TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS sync_docs (
        collection TEXT NOT NULL,
        id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        data JSONB NOT NULL DEFAULT '{}'::jsonb,
        updated_at BIGINT,
        PRIMARY KEY (collection, id)
      );

      CREATE INDEX IF NOT EXISTS idx_sync_docs_user_coll
        ON sync_docs (user_id, collection);

      CREATE INDEX IF NOT EXISTS idx_sync_docs_updated
        ON sync_docs (user_id, collection, updated_at);
    `);
    schemaEnsured = true;
    sqlReady = true;
    console.log("[db-layer] PostgreSQL (Neon) schema ready.");
    return true;
  } catch (err: any) {
    console.error("[db-layer] Failed to ensure SQL schema:", err?.message || err);
    sqlReady = false;
    return false;
  }
}

async function useSql(): Promise<boolean> {
  if (!pool) return false;
  if (sqlReady && schemaEnsured) return true;
  return ensureSchema();
}

// ── Public API (همان امضای قبلی برای سازگاری با server.ts) ──

export async function getUser(uid: string): Promise<any> {
  if (await useSql()) {
    try {
      const r = await pool!.query(
        `SELECT uid, email, created_at AS "createdAt" FROM app_users WHERE uid = $1`,
        [uid]
      );
      if (r.rows[0]) {
        const row = r.rows[0];
        return {
          uid: row.uid,
          email: row.email,
          createdAt:
            row.createdAt instanceof Date
              ? row.createdAt.toISOString()
              : row.createdAt,
        };
      }
      return null;
    } catch (err: any) {
      console.error("[db-layer] getUser SQL error:", err?.message || err);
    }
  }
  const db = readLocalDb(uid);
  return db.users;
}

export async function saveUser(uid: string, email: string): Promise<any> {
  const now = new Date().toISOString();
  if (await useSql()) {
    try {
      await pool!.query(
        `INSERT INTO app_users (uid, email, created_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (uid) DO UPDATE SET email = EXCLUDED.email`,
        [uid, email]
      );
      return { uid, email, createdAt: now };
    } catch (err: any) {
      console.error("[db-layer] saveUser SQL error:", err?.message || err);
    }
  }
  const db = readLocalDb(uid);
  db.users = { uid, email, createdAt: now };
  writeLocalDb(uid, db);
  return db.users;
}

export async function updateUserEmail(uid: string, email: string): Promise<void> {
  if (await useSql()) {
    try {
      await pool!.query(`UPDATE app_users SET email = $2 WHERE uid = $1`, [uid, email]);
      return;
    } catch (err: any) {
      console.error("[db-layer] updateUserEmail SQL error:", err?.message || err);
    }
  }
  const db = readLocalDb(uid);
  if (db.users) {
    db.users.email = email;
    writeLocalDb(uid, db);
  }
}

export async function getDocsByUserId(collection: string, userId: string): Promise<any[]> {
  if (await useSql()) {
    try {
      const r = await pool!.query(
        `SELECT id, data, updated_at AS "updatedAt"
         FROM sync_docs
         WHERE collection = $1 AND user_id = $2`,
        [collection, userId]
      );
      return r.rows.map((row) => {
        const payload = row.data && typeof row.data === "object" ? row.data : {};
        return {
          id: row.id,
          ...payload,
          updatedAt: payload.updatedAt ?? row.updatedAt ?? undefined,
          userId: payload.userId ?? userId,
        };
      });
    } catch (err: any) {
      console.error(`[db-layer] getDocsByUserId(${collection}) SQL error:`, err?.message || err);
    }
  }
  const db = readLocalDb(userId);
  return db[collection] || [];
}

export async function setDoc(
  collection: string,
  docId: string,
  data: any,
  userId: string
): Promise<void> {
  const payload = { ...data, id: docId, userId };
  const updatedAt =
    typeof payload.updatedAt === "number" && !Number.isNaN(payload.updatedAt)
      ? payload.updatedAt
      : Date.now();
  payload.updatedAt = updatedAt;

  if (await useSql()) {
    try {
      await pool!.query(
        `INSERT INTO sync_docs (collection, id, user_id, data, updated_at)
         VALUES ($1, $2, $3, $4::jsonb, $5)
         ON CONFLICT (collection, id) DO UPDATE SET
           data = EXCLUDED.data,
           user_id = EXCLUDED.user_id,
           updated_at = EXCLUDED.updated_at`,
        [collection, docId, userId, JSON.stringify(payload), updatedAt]
      );
      return;
    } catch (err: any) {
      console.error(`[db-layer] setDoc(${collection}/${docId}) SQL error:`, err?.message || err);
    }
  }

  const db = readLocalDb(userId);
  if (!db[collection]) db[collection] = [];
  const idx = db[collection].findIndex((item: any) => item?.id === docId);
  if (idx >= 0) db[collection][idx] = payload;
  else db[collection].push(payload);
  writeLocalDb(userId, db);
}

export async function addDoc(
  collection: string,
  data: any,
  userId: string
): Promise<void> {
  const randomId =
    data?.id ||
    `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  await setDoc(collection, randomId, data, userId);
}

export async function deleteDoc(
  collection: string,
  docId: string,
  userId: string
): Promise<void> {
  if (await useSql()) {
    try {
      await pool!.query(
        `DELETE FROM sync_docs
         WHERE collection = $1 AND id = $2 AND user_id = $3`,
        [collection, docId, userId]
      );
      return;
    } catch (err: any) {
      console.error(`[db-layer] deleteDoc(${collection}/${docId}) SQL error:`, err?.message || err);
    }
  }

  const db = readLocalDb(userId);
  if (db[collection]) {
    db[collection] = db[collection].filter((item: any) => item.id !== docId);
    writeLocalDb(userId, db);
  }
}

export async function clearAllCollections(userId: string): Promise<void> {
  if (await useSql()) {
    try {
      await pool!.query(`DELETE FROM sync_docs WHERE user_id = $1`, [userId]);
      return;
    } catch (err: any) {
      console.error(`[db-layer] clearAllCollections SQL error:`, err?.message || err);
    }
  }

  writeLocalDb(userId, emptyLocalDb());
}

/** برای دیباگ / health-check */
export async function getDbBackendInfo(): Promise<{ backend: string; ok: boolean }> {
  if (await useSql()) {
    try {
      await pool!.query("SELECT 1");
      return { backend: "postgresql", ok: true };
    } catch {
      return { backend: "postgresql", ok: false };
    }
  }
  return { backend: "local-json", ok: true };
}
