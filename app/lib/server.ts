import { env } from "cloudflare:workers";

type RuntimeEnv = {
  DB: D1Database;
  MATERIALS: R2Bucket;
  ADMIN_EMAIL?: string;
  ADMIN_PASSWORD?: string;
  SESSION_SECRET?: string;
  GOOGLE_CLIENT_EMAIL?: string;
  GOOGLE_PRIVATE_KEY?: string;
  GOOGLE_DRIVE_FOLDER_ID?: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  MERCADO_PAGO_ACCESS_TOKEN?: string;
  MERCADO_PAGO_WEBHOOK_SECRET?: string;
  COURSE_CHECKOUT_TITLE?: string;
  COURSE_CHECKOUT_PRICE?: string;
  CRON_SECRET?: string;
  MANUAL_ACCOUNT_SECRET?: string;
  APP_URL?: string;
};

export type Session = {
  role: "admin" | "student";
  id: string;
  email: string;
  exp: number;
};

export type ServiceConfig = {
  resendApiKey: string;
  emailFrom: string;
  appUrl: string;
  googleClientEmail: string;
  googlePrivateKey: string;
  googleDriveFolderId: string;
  mercadoPagoAccessToken: string;
  mercadoPagoWebhookSecret: string;
  courseCheckoutTitle: string;
  courseCheckoutPrice: string;
};

export const runtime = env as unknown as RuntimeEnv;

const encoder = new TextEncoder();

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function hmac(value: string) {
  const secret = runtime.SESSION_SECRET || "local-development-secret-change-me";
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return bytesToBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value))));
}

export async function createSessionCookie(session: Omit<Session, "exp">) {
  const payload = bytesToBase64Url(
    encoder.encode(JSON.stringify({ ...session, exp: Date.now() + 1000 * 60 * 60 * 24 * 7 })),
  );
  const signature = await hmac(payload);
  return `fluency_session=${payload}.${signature}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800; Secure`;
}

export function clearSessionCookie() {
  return "fluency_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure";
}

export async function readSession(request: Request): Promise<Session | null> {
  const cookie = request.headers.get("cookie") || "";
  const raw = cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith("fluency_session="))?.split("=")[1];
  if (!raw) return null;
  const [payload, signature] = raw.split(".");
  if (!payload || !signature || (await hmac(payload)) !== signature) return null;
  try {
    const session = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payload))) as Session;
    return session.exp > Date.now() ? session : null;
  } catch {
    return null;
  }
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const hash = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: 120_000 },
    key,
    256,
  );
  return `v1.120000.${bytesToBase64Url(salt)}.${bytesToBase64Url(new Uint8Array(hash))}`;
}

export async function verifyPassword(password: string, encoded: string) {
  const [, iterations, salt, expected] = encoded.split(".");
  if (!iterations || !salt || !expected) return false;
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const hash = new Uint8Array(await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: base64UrlToBytes(salt), iterations: Number(iterations) },
    key,
    256,
  ));
  const wanted = base64UrlToBytes(expected);
  if (hash.length !== wanted.length) return false;
  let mismatch = 0;
  hash.forEach((byte, index) => (mismatch |= byte ^ wanted[index]));
  return mismatch === 0;
}

export function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return `+55${digits}`;
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) return `+${digits}`;
  return digits.length >= 10 && digits.length <= 15 ? `+${digits}` : "";
}

export function oneYearFromNow() {
  const expiresAt = new Date();
  expiresAt.setUTCFullYear(expiresAt.getUTCFullYear() + 1);
  expiresAt.setUTCHours(23, 59, 59, 0);
  return expiresAt.toISOString();
}

export async function ensureDatabase() {
  if (!runtime.DB) throw new Error("Banco de dados não configurado.");
  await runtime.DB.batch([
    runtime.DB.prepare(`CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT NOT NULL DEFAULT '',
      password_hash TEXT,
      expires_at TEXT NOT NULL,
      renewal_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_access_at TEXT
    )`),
    runtime.DB.prepare(`CREATE TABLE IF NOT EXISTS admins (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT NOT NULL DEFAULT '',
      password_hash TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_access_at TEXT
    )`),
    runtime.DB.prepare(`CREATE TABLE IF NOT EXISTS expiration_notices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id TEXT NOT NULL,
      notice_type TEXT NOT NULL,
      sent_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(student_id, notice_type),
      FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE
    )`),
    runtime.DB.prepare(`CREATE TABLE IF NOT EXISTS access_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id TEXT NOT NULL,
      accessed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE
    )`),
    runtime.DB.prepare(`CREATE TABLE IF NOT EXISTS lesson_metadata (
      file_id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      level TEXT NOT NULL DEFAULT 'Todos os níveis',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    runtime.DB.prepare(`CREATE TABLE IF NOT EXISTS lesson_progress (
      student_id TEXT NOT NULL,
      lesson_id TEXT NOT NULL,
      lesson_title TEXT NOT NULL,
      watched_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(student_id, lesson_id),
      FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE
    )`),
    runtime.DB.prepare(`CREATE TABLE IF NOT EXISTS lesson_materials (
      id TEXT PRIMARY KEY,
      lesson_id TEXT NOT NULL UNIQUE,
      lesson_title TEXT NOT NULL,
      title TEXT NOT NULL,
      file_name TEXT NOT NULL,
      object_key TEXT NOT NULL UNIQUE,
      content_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    runtime.DB.prepare(`CREATE TABLE IF NOT EXISTS communications (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    runtime.DB.prepare(`CREATE TABLE IF NOT EXISTS communication_reads (
      student_id TEXT NOT NULL,
      communication_id TEXT NOT NULL,
      read_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(student_id, communication_id),
      FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE,
      FOREIGN KEY(communication_id) REFERENCES communications(id) ON DELETE CASCADE
    )`),
    runtime.DB.prepare(`CREATE TABLE IF NOT EXISTS service_settings (
      setting_key TEXT PRIMARY KEY,
      encrypted_value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    runtime.DB.prepare(`CREATE TABLE IF NOT EXISTS checkout_orders (
      id TEXT PRIMARY KEY,
      preference_id TEXT,
      payment_id TEXT,
      status TEXT NOT NULL DEFAULT 'created',
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'BRL',
      checkout_url TEXT,
      student_id TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    runtime.DB.prepare(`CREATE TABLE IF NOT EXISTS schedule_entries (
      id TEXT PRIMARY KEY,
      weekday INTEGER NOT NULL CHECK(weekday BETWEEN 1 AND 7),
      start_time TEXT NOT NULL,
      title TEXT NOT NULL,
      details TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    runtime.DB.prepare(`CREATE TABLE IF NOT EXISTS app_meta (
      meta_key TEXT PRIMARY KEY,
      meta_value TEXT NOT NULL
    )`),
    runtime.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_students_email ON students(email)"),
    runtime.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_admins_email ON admins(email)"),
    runtime.DB.prepare("CREATE INDEX IF NOT EXISTS idx_students_expires_at ON students(expires_at)"),
    runtime.DB.prepare("CREATE INDEX IF NOT EXISTS idx_access_events_accessed_at ON access_events(accessed_at)"),
    runtime.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_lesson_progress_student_lesson ON lesson_progress(student_id, lesson_id)"),
    runtime.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_lesson_materials_lesson ON lesson_materials(lesson_id)"),
    runtime.DB.prepare("CREATE INDEX IF NOT EXISTS idx_communications_created_at ON communications(created_at)"),
    runtime.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_communication_reads_student_message ON communication_reads(student_id, communication_id)"),
    runtime.DB.prepare("CREATE INDEX IF NOT EXISTS idx_schedule_weekday_time ON schedule_entries(weekday, start_time)"),
    runtime.DB.prepare("CREATE INDEX IF NOT EXISTS idx_checkout_orders_status ON checkout_orders(status)"),
    runtime.DB.prepare("CREATE INDEX IF NOT EXISTS idx_checkout_orders_payment_id ON checkout_orders(payment_id)"),
  ]);
  const studentColumns = await runtime.DB.prepare("PRAGMA table_info(students)").all<{ name: string }>();
  if (!studentColumns.results.some((column) => column.name === "renewal_count")) {
    try {
      await runtime.DB.prepare("ALTER TABLE students ADD COLUMN renewal_count INTEGER NOT NULL DEFAULT 0").run();
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes("duplicate column name")) throw error;
    }
  }
  if (!studentColumns.results.some((column) => column.name === "phone")) {
    try {
      await runtime.DB.prepare("ALTER TABLE students ADD COLUMN phone TEXT NOT NULL DEFAULT ''").run();
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes("duplicate column name")) throw error;
    }
  }
  await runtime.DB.prepare(`INSERT INTO access_events (student_id, accessed_at)
    SELECT students.id, students.last_access_at FROM students
    WHERE students.last_access_at IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM access_events WHERE access_events.student_id = students.id)`
  ).run();
  const scheduleSeed = await runtime.DB.prepare("SELECT meta_value FROM app_meta WHERE meta_key = 'schedule_seed_v1'").first<{ meta_value: string }>();
  if (!scheduleSeed) {
    const defaults = [
      ["schedule-mon-16", 1, "16:00", "Conversação", "Encontro de conversação pelo Zoom"],
      ["schedule-mon-17", 1, "17:00", "Aula extra", "Com teacher Rafa"],
      ["schedule-mon-18", 1, "18:00", "Revisão entre alunos", "Extra do curso com a aluna Vilma · aulas iniciais"],
      ["schedule-tue-17", 2, "17:00", "Conversação", "Encontro de conversação pelo Zoom"],
      ["schedule-tue-18", 2, "18:00", "Aula extra", "Com teacher Rafa"],
      ["schedule-tue-20", 2, "20:00", "Conversação", "Encontro de conversação pelo Zoom"],
      ["schedule-wed-10", 3, "10:00", "Conversação", "Encontro de conversação pelo Zoom"],
      ["schedule-wed-16", 3, "16:00", "Aula ao vivo", "Com teacher"],
      ["schedule-wed-19", 3, "19:00", "Conversação", "Encontro de conversação pelo Zoom"],
      ["schedule-wed-20", 3, "20:00", "Aula ao vivo", "Com teacher"],
      ["schedule-thu-17", 4, "17:00", "Conversação", "Encontro de conversação pelo Zoom"],
      ["schedule-thu-19", 4, "19:00", "Live no Instagram", "Com Teacher Gabriel"],
      ["schedule-fri-18", 5, "18:00", "Revisão entre alunos", "Extra do curso com a aluna Vilma · aulas iniciais"],
      ["schedule-sat-16", 6, "16:00", "Conversação", "Encontro de conversação pelo Zoom"],
    ] as const;
    await runtime.DB.batch([
      ...defaults.map((entry) => runtime.DB.prepare("INSERT OR IGNORE INTO schedule_entries (id, weekday, start_time, title, details) VALUES (?, ?, ?, ?, ?)").bind(...entry)),
      runtime.DB.prepare("INSERT OR REPLACE INTO app_meta (meta_key, meta_value) VALUES ('schedule_seed_v1', 'complete')"),
    ]);
    await runtime.DB.prepare("PRAGMA optimize").run();
  }
}

async function settingsEncryptionKey() {
  const material = encoder.encode(runtime.SESSION_SECRET || "local-development-secret-change-me");
  const digest = await crypto.subtle.digest("SHA-256", material);
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function encryptSetting(value: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await settingsEncryptionKey(), encoder.encode(value));
  return `${bytesToBase64Url(iv)}.${bytesToBase64Url(new Uint8Array(encrypted))}`;
}

async function decryptSetting(value: string) {
  try {
    const [iv, encrypted] = value.split(".");
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: base64UrlToBytes(iv) }, await settingsEncryptionKey(), base64UrlToBytes(encrypted));
    return new TextDecoder().decode(decrypted);
  } catch {
    return "";
  }
}

const settingKeys: Record<keyof ServiceConfig, string> = {
  resendApiKey: "resend_api_key",
  emailFrom: "email_from",
  appUrl: "app_url",
  googleClientEmail: "google_client_email",
  googlePrivateKey: "google_private_key",
  googleDriveFolderId: "google_drive_folder_id",
  mercadoPagoAccessToken: "mercado_pago_access_token",
  mercadoPagoWebhookSecret: "mercado_pago_webhook_secret",
  courseCheckoutTitle: "course_checkout_title",
  courseCheckoutPrice: "course_checkout_price",
};

export async function getServiceConfig(): Promise<ServiceConfig> {
  const fallback: ServiceConfig = {
    resendApiKey: runtime.RESEND_API_KEY || "",
    emailFrom: runtime.EMAIL_FROM || "",
    appUrl: runtime.APP_URL || "",
    googleClientEmail: runtime.GOOGLE_CLIENT_EMAIL || "",
    googlePrivateKey: runtime.GOOGLE_PRIVATE_KEY || "",
    googleDriveFolderId: runtime.GOOGLE_DRIVE_FOLDER_ID || "",
    mercadoPagoAccessToken: runtime.MERCADO_PAGO_ACCESS_TOKEN || "",
    mercadoPagoWebhookSecret: runtime.MERCADO_PAGO_WEBHOOK_SECRET || "",
    courseCheckoutTitle: runtime.COURSE_CHECKOUT_TITLE || "Inglês com Gabriel - Acesso anual",
    courseCheckoutPrice: runtime.COURSE_CHECKOUT_PRICE || "997",
  };
  if (!runtime.DB) return fallback;
  const rows = await runtime.DB.prepare("SELECT setting_key, encrypted_value FROM service_settings").all<{ setting_key: string; encrypted_value: string }>();
  const stored = new Map(rows.results.map((row) => [row.setting_key, row.encrypted_value]));
  for (const key of Object.keys(settingKeys) as Array<keyof ServiceConfig>) {
    const encrypted = stored.get(settingKeys[key]);
    if (encrypted) fallback[key] = await decryptSetting(encrypted);
  }
  return fallback;
}

export async function saveServiceConfig(values: Partial<ServiceConfig>) {
  for (const key of Object.keys(settingKeys) as Array<keyof ServiceConfig>) {
    const value = values[key];
    if (typeof value !== "string" || !value.trim()) continue;
    const encrypted = await encryptSetting(value.trim());
    await runtime.DB.prepare(`INSERT INTO service_settings (setting_key, encrypted_value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(setting_key) DO UPDATE SET encrypted_value = excluded.encrypted_value, updated_at = CURRENT_TIMESTAMP`
    ).bind(settingKeys[key], encrypted).run();
  }
}

export function json(data: unknown, status = 200, headers?: HeadersInit) {
  return Response.json(data, { status, headers });
}

export async function requireRole(request: Request, role: Session["role"]) {
  const session = await readSession(request);
  return session?.role === role ? session : null;
}

async function getGoogleAccessToken() {
  const config = await getServiceConfig();
  const email = config.googleClientEmail;
  const privateKeyPem = config.googlePrivateKey?.replace(/\\n/g, "\n");
  if (!email || !privateKeyPem) return null;
  const now = Math.floor(Date.now() / 1000);
  const header = bytesToBase64Url(encoder.encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const claims = bytesToBase64Url(encoder.encode(JSON.stringify({
    iss: email,
    scope: "https://www.googleapis.com/auth/drive.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })));
  const keyBytes = Uint8Array.from(
    atob(privateKeyPem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "")),
    (char) => char.charCodeAt(0),
  );
  const key = await crypto.subtle.importKey("pkcs8", keyBytes, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, encoder.encode(`${header}.${claims}`));
  const assertion = `${header}.${claims}.${bytesToBase64Url(new Uint8Array(signature))}`;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  if (!response.ok) throw new Error("Não foi possível autenticar no Google Drive.");
  return (await response.json() as { access_token: string }).access_token;
}

export type DriveLesson = {
  id: string;
  name: string;
  mimeType: string;
  createdTime?: string;
  modifiedTime?: string;
  size?: string;
  thumbnailLink?: string;
  videoMediaMetadata?: { durationMillis?: string };
  folderId?: string;
  folderPath?: string;
};

export async function listDriveLessons() {
  const token = await getGoogleAccessToken();
  const rootFolderId = (await getServiceConfig()).googleDriveFolderId;
  if (!token || !rootFolderId) return null;
  const folderMimeType = "application/vnd.google-apps.folder";
  const queue: Array<{ id: string; path: string }> = [{ id: rootFolderId, path: "" }];
  const visited = new Set<string>();
  const lessons: DriveLesson[] = [];

  while (queue.length) {
    const folder = queue.shift()!;
    if (visited.has(folder.id)) continue;
    visited.add(folder.id);
    let pageToken = "";
    do {
      const params = new URLSearchParams({
        q: `'${folder.id}' in parents and trashed = false and (mimeType = '${folderMimeType}' or mimeType contains 'video/')`,
        fields: "nextPageToken,files(id,name,mimeType,createdTime,modifiedTime,size,thumbnailLink,videoMediaMetadata(durationMillis))",
        orderBy: "folder,name_natural",
        pageSize: "1000",
        supportsAllDrives: "true",
        includeItemsFromAllDrives: "true",
      });
      if (pageToken) params.set("pageToken", pageToken);
      const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error("Não foi possível consultar as aulas e subpastas no Google Drive.");
      const data = await response.json() as { files: DriveLesson[]; nextPageToken?: string };
      for (const item of data.files) {
        if (item.mimeType === folderMimeType) {
          queue.push({ id: item.id, path: folder.path ? `${folder.path} / ${item.name}` : item.name });
        } else {
          lessons.push({ ...item, folderId: folder.id, folderPath: folder.path || "Aulas gerais" });
        }
      }
      pageToken = data.nextPageToken || "";
    } while (pageToken);
  }

  return lessons.sort((a, b) => (b.createdTime || "").localeCompare(a.createdTime || ""));
}

export async function streamDriveLesson(fileId: string, range?: string | null) {
  const token = await getGoogleAccessToken();
  if (!token) return null;
  return fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`, {
    headers: { Authorization: `Bearer ${token}`, ...(range ? { Range: range } : {}) },
  });
}
