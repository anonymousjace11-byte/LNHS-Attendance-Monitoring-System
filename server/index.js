const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const { getApps, initializeApp, cert, applicationDefault } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");
const cloudinary = require("cloudinary").v2;
const fs = require("fs");
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");
const twilio = require("twilio");
const helmet = require("helmet");

const app = express();
const isProduction = process.env.NODE_ENV === "production" || Boolean(process.env.K_SERVICE);
app.set("trust proxy", isProduction ? 1 : false);
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  strictTransportSecurity: isProduction ? undefined : false
}));
const qrCredentialLifetimeMs = Number(process.env.QR_CREDENTIAL_LIFETIME_MS || 180 * 24 * 60 * 60 * 1000);
const smsResendWindowMs = 15 * 60 * 1000;
const smsResendLimit = 3;
const DEFAULT_SMS_TEMPLATES = {
  present: "Your child {student_name} was marked Present for {period} on {date}.",
  late: "Your child {student_name} was marked Late for {period} on {date}.",
  absent: "Your child {student_name} was marked Absent for {period} on {date}."
};
const DEFAULT_SMS_RUNTIME = {
  mode: "inherit",
  disabled: false,
  dailyCapPerStudent: 4
};

function getQrSigningSecret() {
  return process.env.QR_SIGNING_SECRET || "";
}

function encodeQrPayload(payload) {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function signQrPayload(encodedPayload) {
  return crypto.createHmac("sha256", getQrSigningSecret()).update(encodedPayload).digest("base64url");
}

function createQrCredential(jti, expiresAt) {
  const payload = encodeQrPayload({ v: 1, jti, exp: expiresAt });
  return `LNHS1.${payload}.${signQrPayload(payload)}`;
}

function verifyQrCredential(value) {
  if (!getQrSigningSecret()) throw new Error("QR_SIGNING_SECRET is not configured");
  const parts = String(value || "").split(".");
  if (parts.length !== 3 || parts[0] !== "LNHS1") throw new Error("Invalid QR credential");
  const [prefix, encodedPayload, signature] = parts;
  const expectedSignature = signQrPayload(encodedPayload);
  const expectedBuffer = Buffer.from(expectedSignature);
  const actualBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== actualBuffer.length || !crypto.timingSafeEqual(expectedBuffer, actualBuffer)) throw new Error("Invalid QR signature");
  const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  if (payload.v !== 1 || !payload.jti || !Number.isInteger(payload.exp) || payload.exp <= Math.floor(Date.now() / 1000)) throw new Error("Expired QR credential");
  return payload;
}
const productionOrigins = String(process.env.CORS_ORIGINS || "https://attendance-monitoring-73028.web.app,https://attendance-monitoring-73028.firebaseapp.com")
  .split(",")
  .map(origin => origin.trim())
  .filter(Boolean);
const devOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:8443",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "http://127.0.0.1:8443"
];
const allowedOrigins = isProduction ? productionOrigins : [...devOrigins, ...productionOrigins];
const isAllowedOrigin = origin => {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  if (isProduction) return false;

  try {
    const { hostname, protocol } = new URL(origin);
    if (protocol !== "http:" && protocol !== "https:") return false;
    if (["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(hostname)) return true;

    const ipv4 = /^\d+\.\d+\.\d+\.\d+$/;
    if (!ipv4.test(hostname)) return false;

    return [
      /^10\./,
      /^192\.168\./,
      /^172\.(1[6-9]|2\d|3[01])\./,
      /^169\.254\./
    ].some((pattern) => pattern.test(hostname));
  } catch {
    return false;
  }
};

app.use(cors({
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) return callback(null, true);
    const error = new Error("Origin not allowed by CORS");
    error.status = 403;
    return callback(error);
  }
}));
app.use(express.json({ limit: "10mb" }));

const rateLimitHandler = (req, res) => res.status(429).json({ error: "Too many requests. Please wait and try again." });
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 1000, standardHeaders: "draft-7", legacyHeaders: false, handler: rateLimitHandler });
const smsLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: "draft-7", legacyHeaders: false, handler: rateLimitHandler });
const attendanceLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  keyGenerator: req => req.auth.uid,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: rateLimitHandler
});
app.use(apiLimiter);
app.use((error, req, res, next) => {
  if (error.message === "Origin not allowed by CORS") {
    return res.status(403).json({ error: error.message });
  }
  return next(error);
});

function initFirebaseAdmin() {
  const existingApps = getApps();
  if (existingApps.length) return existingApps[0];

  try {
    const credentialPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const credential = credentialPath && fs.existsSync(credentialPath)
      ? cert(JSON.parse(fs.readFileSync(credentialPath, "utf8")))
      : applicationDefault();
    const projectId = process.env.FIREBASE_PROJECT_ID || "attendance-monitoring-73028";
    const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || `${projectId}.firebasestorage.app`;
    return initializeApp({ credential, projectId, storageBucket });
  } catch (error) {
    console.error("Firebase Admin initialization error:", error.message);
    return null;
  }
}

function getFirebaseErrorStatus(error) {
  return error.includes("not configured") ? 503 : 403;
}

async function verifyAdminRequest(req) {
  const authorization = req.get("Authorization");
  const adminSdk = initFirebaseAdmin();

  if (!adminSdk) return { error: "Firebase Admin SDK not configured" };
  if (!authorization || !authorization.startsWith("Bearer ")) {
    return { error: "Firebase authentication required." };
  }

  try {
    const token = await getAuth(adminSdk).verifyIdToken(authorization.slice(7).trim());
    if (token.admin !== true) return { error: "Admin access required." };
    return { adminSdk, token };
  } catch (error) {
    console.error("Firebase admin token verification error:", error.code || "unknown", error.message);
    return { error: "Invalid Firebase authentication token." };
  }
}

async function setRoleClaims(adminSdk, uid, role, email, name, password = "") {
  let firebaseUser;
  try {
    firebaseUser = await getAuth(adminSdk).getUser(uid);
  } catch (error) {
    if (error.code !== "auth/user-not-found") throw error;
    firebaseUser = await getAuth(adminSdk).createUser({ uid, email, displayName: name, ...(password ? { password } : {}) });
  }

  if (password && firebaseUser) await getAuth(adminSdk).updateUser(uid, { password });

  await getAuth(adminSdk).setCustomUserClaims(uid, {
    admin: role === "admin",
    teacher: role === "teacher",
    student: role === "student"
  });
}

const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID || process.env.ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN || process.env.AUTH_TOKEN;
const twilioNumber = process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_NUMBER;
const twilioMessagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
const smsMode = String(process.env.SMS_MODE || "simulated").toLowerCase();
const smsProvider = String(process.env.SMS_PROVIDER || "twilio").toLowerCase();
const semaphoreApiKey = process.env.SEMAPHORE_API_KEY;
const semaphoreSenderName = process.env.SEMAPHORE_SENDER_NAME;
const client = twilioAccountSid && twilioAuthToken
  ? twilio(twilioAccountSid, twilioAuthToken)
  : null;
const twilioConfigured = Boolean(client && (twilioNumber || twilioMessagingServiceSid));
const semaphoreConfigured = Boolean(semaphoreApiKey);
const smsGatewayConfigured = smsProvider === "semaphore" ? semaphoreConfigured : twilioConfigured;

function normalizePhoneNumber(value) {
  const rawPhone = String(value || "").trim().replace(/[\s().-]/g, "");
  if (rawPhone.startsWith("09") && rawPhone.length === 11) return `+63${rawPhone.slice(1)}`;
  if (rawPhone.startsWith("63") && rawPhone.length === 12) return `+${rawPhone}`;
  return rawPhone;
}
function isE164PhoneNumber(value) {
  return /^\+[1-9]\d{7,14}$/.test(value);
}
function isValidStudentId(value) {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
}
function getAttendanceDateParts(date = new Date()) {
  const timeZone = process.env.ATTENDANCE_TIME_ZONE || "Asia/Manila";
  const dateFormatter = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
  const timeFormatter = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const weekdayFormatter = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" });
  return { date: dateFormatter.format(date), time: timeFormatter.format(date), weekday: weekdayFormatter.format(date), timeZone };
}
async function getAttendanceCutoff(db) {
  try {
    const snapshot = await db.collection("settings").doc("attendance").get();
    const configuredCutoff = snapshot.exists ? String(snapshot.data()?.cutoff || "") : "";
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(configuredCutoff) ? configuredCutoff : (process.env.ATTENDANCE_CUTOFF || "07:30");
  } catch {
    return process.env.ATTENDANCE_CUTOFF || "07:30";
  }
}
function renderSmsTemplate(template, data = {}) {
  return String(template || "")
    .replaceAll("{student_name}", data.studentName || "")
    .replaceAll("{section}", data.section || "")
    .replaceAll("{period}", data.period || "")
    .replaceAll("{date}", data.date || "")
    .replaceAll("{status}", data.status || "");
}
async function loadSmsTemplates(db) {
  try {
    const snapshot = await db.collection("settings").doc("sms_templates").get();
    const stored = snapshot.exists ? snapshot.data() : {};
    return {
      present: typeof stored.present === "string" && stored.present.trim() ? stored.present : DEFAULT_SMS_TEMPLATES.present,
      late: typeof stored.late === "string" && stored.late.trim() ? stored.late : DEFAULT_SMS_TEMPLATES.late,
      absent: typeof stored.absent === "string" && stored.absent.trim() ? stored.absent : DEFAULT_SMS_TEMPLATES.absent
    };
  } catch (error) {
    console.error("SMS template read error:", error.message);
    return { ...DEFAULT_SMS_TEMPLATES };
  }
}
async function loadSmsRuntimeConfig(db) {
  try {
    const snapshot = await db.collection("settings").doc("sms_runtime").get();
    const stored = snapshot.exists ? snapshot.data() : {};
    return {
      mode: ["inherit", "simulated", "live"].includes(stored.mode) ? stored.mode : DEFAULT_SMS_RUNTIME.mode,
      disabled: stored.disabled === true,
      dailyCapPerStudent: Number.isInteger(stored.dailyCapPerStudent) && stored.dailyCapPerStudent >= 0
        ? stored.dailyCapPerStudent
        : DEFAULT_SMS_RUNTIME.dailyCapPerStudent
    };
  } catch (error) {
    console.error("SMS runtime config read error:", error.message);
    return { ...DEFAULT_SMS_RUNTIME, configUnavailable: true };
  }
}
async function checkSmsAllowed(db, { studentId } = {}) {
  const runtime = await loadSmsRuntimeConfig(db);
  if (runtime.configUnavailable) {
    return { allowed: false, mode: "disabled", reason: "SMS runtime config unavailable — send blocked for safety", remainingCap: null };
  }
  if (runtime.disabled) {
    return { allowed: false, mode: "disabled", reason: "SMS disabled by admin", remainingCap: null };
  }

  const effectiveMode = runtime.mode === "inherit" ? smsMode : runtime.mode;
  if (effectiveMode === "simulated") {
    return { allowed: true, mode: "simulated", reason: "", remainingCap: null };
  }

  if (runtime.dailyCapPerStudent > 0 && studentId) {
    const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
    const startOfToday = new Date(`${todayKey}T00:00:00+08:00`);
    const startOfTomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
    try {
      const snapshot = await db.collection("sms_logs")
        .where("studentId", "==", studentId)
        .where("status", "in", ["sent", "simulated"])
        .where("createdAt", ">=", startOfToday)
        .where("createdAt", "<", startOfTomorrow)
        .count()
        .get();
      const sentToday = snapshot.data().count;
      const remainingCap = Math.max(0, runtime.dailyCapPerStudent - sentToday);
      if (sentToday >= runtime.dailyCapPerStudent) {
        return {
          allowed: false,
          mode: "capped",
          reason: `Daily cap reached (${sentToday}/${runtime.dailyCapPerStudent})`,
          remainingCap
        };
      }
      return { allowed: true, mode: "live", reason: "", remainingCap };
    } catch (error) {
      console.error("SMS daily cap count error:", error.message);
      return { allowed: false, mode: "capped", reason: "Cap check unavailable — send blocked for safety", remainingCap: null };
    }
  }

  return { allowed: true, mode: "live", reason: "", remainingCap: null };
}
function isAttendanceCutoffReached(time, cutoff) {
  return time >= (cutoff || process.env.ATTENDANCE_CUTOFF || "07:30");
}
function createAttendanceId(studentId, studentCode, date) {
  const recordCode = String(studentCode || studentId).replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").toUpperCase();
  return `ATT-${String(date).replace(/-/g, "")}-${recordCode}`;
}
const attendancePeriods = ["AM-1", "AM-2", "PM-1", "PM-2"];
function getAttendanceScans(record = {}) {
  const scans = record.scans && typeof record.scans === "object" ? { ...record.scans } : {};
  if (!scans["AM-1"] && record.time && record.status) {
    scans["AM-1"] = { time: record.time, status: record.status, smsStatus: record.smsStatus || "skipped" };
  }
  return scans;
}
async function sendSemaphoreSms(message, recipientPhone, settings = {}) {
  const apiKey = settings.apiKey ?? semaphoreApiKey;
  const senderName = settings.senderName ?? semaphoreSenderName;
  const parameters = new URLSearchParams({ apikey: apiKey, number: recipientPhone, message });
  if (senderName) parameters.set("sendername", senderName);
  const response = await fetch("https://api.semaphore.co/api/v4/messages", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: parameters });
  const result = await response.json();
  if (!response.ok || !Array.isArray(result) || !result.length || String(result[0].status).toLowerCase() === "failed") {
    throw new Error(result?.message || result?.[0]?.status || "Semaphore rejected the SMS");
  }
  return result[0];
}
const cloudinaryConfigured = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

if (cloudinaryConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
}

async function requireStaffAuth(req, res, next) {
  const authorization = req.get("Authorization");

  if (!authorization || !authorization.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Firebase authentication required." });
  }

  const idToken = authorization.slice("Bearer ".length).trim();
  const adminSdk = initFirebaseAdmin();
  if (!adminSdk) return res.status(503).json({ error: "Firebase Admin SDK not configured" });

  try {
    const decodedToken = await getAuth(adminSdk).verifyIdToken(idToken);
    const isAdmin = decodedToken.admin === true;
    const isTeacher = decodedToken.teacher === true;

    if (!isAdmin && !isTeacher) {
      return res.status(403).json({ error: "Admin or teacher access required." });
    }

    req.auth = decodedToken;
    req.adminSdk = adminSdk;
    req.isAdmin = isAdmin;
    req.teacherSectionIds = isAdmin ? [] : (await getFirestore(adminSdk).collection("sections").where("teacherId", "==", decodedToken.uid).get()).docs.map(section => section.id);
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid Firebase authentication token." });
  }
}

function teacherCanAccessSection(req, sectionId) {
  return req.isAdmin || Boolean(sectionId && req.teacherSectionIds.includes(sectionId));
}

function requireTeacherSection(req, res, sectionId) {
  if (!teacherCanAccessSection(req, sectionId)) {
    res.status(403).json({ error: "Teacher access is limited to assigned sections." });
    return false;
  }
  return true;
}

async function writeAuditLog(db, { action, actorUid = "system", targetType = "", targetId = "", details = {} }) {
  try {
    await db.collection("audit_logs").add({ action, actorUid, targetType, targetId, details, createdAt: new Date() });
  } catch (error) {
    console.error("Audit log write error:", error.message);
  }
}

app.get("/staff/system-status", requireStaffAuth, (req, res) => {
  return res.json({ success: true, smsGatewayConfigured, smsProvider });
});

app.get("/admin/health", async (req, res) => {
  const authResult = await verifyAdminRequest(req);
  if (authResult.error) return res.status(getFirebaseErrorStatus(authResult.error)).json({ error: authResult.error });
  const adminSdk = initFirebaseAdmin();
  return res.json({
    success: true,
    firebaseAdminConfigured: !!adminSdk,
    cloudinaryConfigured,
    twilioConfigured,
    timestamp: new Date().toISOString()
  });
});

app.post("/admin/upload-student-photo", async (req, res) => {
  const authResult = await verifyAdminRequest(req);
  if (authResult.error) return res.status(getFirebaseErrorStatus(authResult.error)).json({ error: authResult.error });
  if (!cloudinaryConfigured) {
    return res.status(503).json({ error: "Cloudinary is not configured. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET to the server environment." });
  }

  const { studentId, imageBase64, contentType = "image/jpeg" } = req.body || {};
  if (!isValidStudentId(studentId) || !imageBase64) return res.status(400).json({ error: "Invalid studentId or missing imageBase64" });
  if (!String(contentType).startsWith("image/")) return res.status(400).json({ error: "Only image uploads are allowed" });

  try {
    const imageBuffer = Buffer.from(imageBase64, "base64");
    if (imageBuffer.length > 8 * 1024 * 1024) {
      return res.status(413).json({ error: "Photo must be smaller than 8 MB." });
    }

    const uploadResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream({
        folder: "attendance-system/students",
        public_id: studentId,
        resource_type: "image",
        overwrite: true,
        invalidate: true
      }, (error, result) => error ? reject(error) : resolve(result));
      uploadStream.end(imageBuffer);
    });
    return res.json({ success: true, photoUrl: uploadResult.secure_url, assetId: uploadResult.asset_id });
  } catch (error) {
    console.error("Admin student photo upload error:", error);
    return res.status(502).json({ error: "Cloudinary rejected the student photo upload." });
  }
});

async function sendViaProvider({ to, message, provider = smsProvider, settings = {}, smsGuard }) {
  const guard = smsGuard || await checkSmsAllowed(settings.db, { studentId: settings.studentId });
  if (!guard.allowed) {
    return {
      status: guard.mode === "disabled" ? "skipped-disabled" : "skipped-capped",
      mode: guard.mode,
      reason: guard.reason
    };
  }
  if (guard.mode === "simulated") {
    return { status: "simulated", mode: "simulated", reason: guard.reason || "" };
  }

  const configuredSemaphore = settings.semaphoreConfigured ?? semaphoreConfigured;
  const configuredTwilio = settings.twilioConfigured ?? twilioConfigured;
  const mode = guard.mode || settings.smsMode || smsMode;

  if (provider === "semaphore" && !configuredSemaphore) {
    return { status: "unconfigured", mode, reason: "Semaphore API key is not configured", error: "Semaphore API key is not configured" };
  }
  if (mode === "simulated" || (provider === "twilio" && !configuredTwilio)) {
    return { status: "simulated", mode: "simulated", reason: "" };
  }

  try {
    if (provider === "semaphore") {
      await sendSemaphoreSms(message, to, {
        apiKey: settings.semaphoreApiKey,
        senderName: settings.semaphoreSenderName,
      });
    } else {
      const smsRequest = { body: message, to };
      const messagingServiceSid = settings.twilioMessagingServiceSid ?? twilioMessagingServiceSid;
      const number = settings.twilioNumber ?? twilioNumber;
      const smsClient = settings.client ?? client;
      if (messagingServiceSid) smsRequest.messagingServiceSid = messagingServiceSid;
      else smsRequest.from = number;
      await smsClient.messages.create(smsRequest);
    }
    return { status: "sent", mode, reason: "" };
  } catch (error) {
    return { status: "failed", mode, reason: error.message, error: error.message };
  }
}

app.post("/send-sms", smsLimiter, requireStaffAuth, async (req, res) => {
  const { name, phone, studentId = "", attendanceId = "", status = "present" } = req.body || {};
  const normalizedPhone = normalizePhoneNumber(phone);
  const message = `${name} is ${status}.`;
  const db = getFirestore(req.adminSdk);
  const logSms = async (deliveryStatus, error = "", mode = smsMode, reason = error) => {
    try {
      await db.collection("sms_logs").add({
        actorUid: req.auth.uid,
        studentId,
        attendanceId,
        phone: normalizedPhone,
        message,
        status: deliveryStatus,
        error,
        mode,
        reason,
        createdAt: new Date()
      });
    } catch (logError) {
      console.error("SMS log write error:", logError.message);
    }
  };

  if (!normalizedPhone) {
    await logSms("skipped", "No linked parent or guardian phone number");
    return res.status(200).json({ success: true, status: "skipped", message, phone: "" });
  }
  if (!isE164PhoneNumber(normalizedPhone)) {
    await logSms("failed", "Phone number must use international format, for example +639171234567");
    return res.status(400).json({ success: false, status: "failed", error: "Phone number must use international format, for example +639171234567" });
  }
  const guard = await checkSmsAllowed(db, { studentId: typeof studentId === "string" ? studentId : "" });
  const delivery = await sendViaProvider({
    to: normalizedPhone,
    message,
    provider: smsProvider,
    smsGuard: guard,
    settings: {
      db,
      studentId: typeof studentId === "string" ? studentId : "",
      semaphoreConfigured,
      semaphoreApiKey,
      semaphoreSenderName,
      twilioConfigured,
      twilioMessagingServiceSid,
      twilioNumber,
      client,
    },
  });

  if (delivery.status === "unconfigured") {
    await logSms("failed", delivery.error, delivery.mode, delivery.reason);
    return res.status(503).json({ success: false, status: "failed", error: "Semaphore API key is not configured" });
  }
  if (delivery.status === "skipped-disabled" || delivery.status === "skipped-capped") {
    await logSms(delivery.status, delivery.reason, delivery.mode, delivery.reason);
    return res.status(200).json({ success: true, status: delivery.status, mode: delivery.mode, reason: delivery.reason });
  }
  if (delivery.status === "simulated") {
    await logSms("simulated", "", delivery.mode, delivery.reason);
    return res.status(200).json({ success: true, status: "simulated", message, phone: normalizedPhone });
  }
  if (delivery.status === "sent") {
    await logSms("sent", "", delivery.mode, delivery.reason);
    return res.json({ success: true, status: "sent", phone: normalizedPhone });
  }

  await logSms("failed", delivery.error, delivery.mode, delivery.reason);
  return res.status(500).json({ success: false, status: "failed", error: "SMS delivery failed" });
});

app.post("/sms/send-manual", smsLimiter, requireStaffAuth, async (req, res) => {
  const { studentId, period, message } = req.body || {};
  if (typeof studentId !== "string" || !studentId.trim()) {
    return res.status(400).json({ success: false, status: "invalid", error: "studentId is required" });
  }
  const normalizedStudentId = studentId.trim();
  if (!isValidStudentId(normalizedStudentId)) {
    return res.status(400).json({ success: false, status: "invalid", error: "studentId is invalid" });
  }
  if (!attendancePeriods.includes(period)) {
    return res.status(400).json({ success: false, status: "invalid", error: "period must be one of AM-1, AM-2, PM-1, PM-2" });
  }
  if (typeof message !== "string" || !message) {
    return res.status(400).json({ success: false, status: "invalid", error: "message is required" });
  }
  const trimmedMessage = message.trim();
  if (!trimmedMessage) {
    return res.status(400).json({ success: false, status: "invalid", error: "message cannot be empty" });
  }
  if (trimmedMessage.length > 320) {
    return res.status(400).json({ success: false, status: "invalid", error: "message must be 320 characters or fewer" });
  }

  try {
    const db = getFirestore(req.adminSdk);
    const studentSnapshot = await db.collection("students").doc(normalizedStudentId).get();
    if (!studentSnapshot.exists) {
      return res.status(404).json({ success: false, status: "not_found", error: "Student not found" });
    }

    const student = studentSnapshot.data() || {};
    const sectionId = student.sectionId || student.section || "";
    if (typeof sectionId !== "string" || !sectionId.trim()) {
      return res.status(400).json({ success: false, status: "invalid", error: "Student has no assigned section" });
    }
    if (!requireTeacherSection(req, res, sectionId.trim())) return;

    const parentContactId = `${normalizedStudentId}_parent`;
    const parentSnapshot = await db.collection("parentcontacts").doc(parentContactId).get();
    const parentContact = parentSnapshot.exists ? parentSnapshot.data() || {} : {};
    const phone = [parentContact.parentPhone, student.parentPhone, student.contactNumber, student.phone]
      .find(value => typeof value === "string" && value.trim());
    if (!phone) {
      return res.status(400).json({ success: false, status: "invalid", error: "No parent contact number on file" });
    }

    const normalizedPhone = normalizePhoneNumber(phone);
    if (!isE164PhoneNumber(normalizedPhone)) {
      return res.status(400).json({ success: false, status: "invalid", error: "Phone number must use international format, for example +639171234567" });
    }

    const guard = await checkSmsAllowed(db, { studentId: normalizedStudentId });
    const delivery = await sendViaProvider({
      to: normalizedPhone,
      message: trimmedMessage,
      provider: smsProvider,
      smsGuard: guard,
      settings: {
        db,
        studentId: normalizedStudentId,
        semaphoreConfigured,
        semaphoreApiKey,
        semaphoreSenderName,
        twilioConfigured,
        twilioMessagingServiceSid,
        twilioNumber,
        client,
      },
    });

    try {
      await db.collection("sms_logs").add({
        actorUid: req.auth.uid,
        manual: true,
        studentId: normalizedStudentId,
        period,
        phone: normalizedPhone,
        message: trimmedMessage,
        status: delivery.status,
        error: delivery.error || "",
        mode: delivery.mode || guard.mode,
        reason: delivery.reason || "",
        createdAt: new Date(),
      });
    } catch (logError) {
      console.error("Manual SMS log write error:", logError.message);
    }

    if (delivery.status === "unconfigured") {
      return res.status(503).json({ success: false, status: "failed", error: "SMS gateway is not configured" });
    }
    if (delivery.status === "skipped-disabled" || delivery.status === "skipped-capped") {
      return res.status(200).json({ success: true, status: delivery.status, mode: delivery.mode, reason: delivery.reason });
    }
    if (delivery.status === "simulated") {
      return res.status(200).json({ success: true, status: "simulated", phone: normalizedPhone });
    }
    if (delivery.status === "sent") {
      return res.status(200).json({ success: true, status: "sent", phone: normalizedPhone });
    }

    return res.status(500).json({ success: false, status: "failed", error: "SMS delivery failed" });
  } catch (error) {
    console.error("Manual SMS send error:", error);
    return res.status(500).json({ success: false, status: "failed", error: "Unable to send manual SMS" });
  }
});

app.get("/sms-logs", requireStaffAuth, async (req, res) => {
  try {
    const snapshot = await getFirestore(req.adminSdk).collection("sms_logs").orderBy("createdAt", "desc").limit(100).get();
    return res.json({ success: true, logs: snapshot.docs.map(record => {
      const data = record.data();
      return { id: record.id, ...data, createdAt: data.createdAt?.toDate?.()?.toISOString?.() || data.createdAt || "" };
    }) });
  } catch (error) {
    console.error("SMS logs list error:", error);
    return res.status(500).json({ error: "Failed to load SMS logs" });
  }
});

app.post("/admin/sms-logs/:logId/retry", async (req, res) => {
  const authResult = await verifyAdminRequest(req);
  if (authResult.error) return res.status(getFirebaseErrorStatus(authResult.error)).json({ error: authResult.error });
  const db = getFirestore(authResult.adminSdk);
  try {
    const originalRef = db.collection("sms_logs").doc(req.params.logId);
    const originalSnapshot = await originalRef.get();
    if (!originalSnapshot.exists) return res.status(404).json({ error: "SMS log not found." });
    const original = originalSnapshot.data() || {};
    if (original.status !== "failed") return res.status(409).json({ error: "Only failed SMS notifications can be retried." });
    const recipientPhone = normalizePhoneNumber(original.phone || "");
    if (!isE164PhoneNumber(recipientPhone)) return res.status(400).json({ error: "The logged phone number is not valid for retry." });

    const studentId = original.studentId || "";
    const guard = await checkSmsAllowed(db, { studentId });
    const delivery = await sendViaProvider({
      db,
      studentId,
      smsGuard: guard,
      to: recipientPhone,
      message: original.message || "",
      provider: smsProvider,
      settings: {
        db,
        studentId,
        semaphoreConfigured,
        semaphoreApiKey,
        semaphoreSenderName,
        twilioConfigured,
        twilioMessagingServiceSid,
        twilioNumber,
        client
      }
    });
    const status = delivery.status === "unconfigured" ? "failed" : delivery.status;
    const errorMessage = delivery.error || "";
    const mode = delivery.mode || guard.mode;
    const reason = delivery.reason || errorMessage;

    const retryRef = await db.collection("sms_logs").add({ actorUid: authResult.token.uid, studentId, attendanceId: original.attendanceId || "", phone: recipientPhone, message: original.message || "", status, error: errorMessage, mode, reason, retryOf: req.params.logId, createdAt: new Date() });
    if (original.attendanceId) {
      const attendanceUpdate = { smsStatus: status };
      if (attendancePeriods.includes(original.period)) attendanceUpdate.scans = { [original.period]: { smsStatus: status } };
      await db.collection("attendance").doc(original.attendanceId).set(attendanceUpdate, { merge: true });
    }
    await writeAuditLog(db, { action: "sms.retry", actorUid: authResult.token.uid, targetType: "sms_log", targetId: retryRef.id, details: { retryOf: req.params.logId, status, mode, reason } });
    return res.json({ success: true, status, mode, reason, retryLogId: retryRef.id });
  } catch (error) {
    console.error("SMS retry error:", error);
    return res.status(500).json({ error: "Failed to retry SMS notification." });
  }
});

app.post("/attendance/record", requireStaffAuth, attendanceLimiter, async (req, res) => {
  const { qrValue = "", period = "" } = req.body || {};
  if (!qrValue) return res.status(400).json({ error: "A signed QR credential is required." });
  if (!attendancePeriods.includes(period)) return res.status(400).json({ error: "A valid attendance period is required." });

  try {
    const db = getFirestore(req.adminSdk);
    let credential;
    try {
      credential = verifyQrCredential(qrValue);
    } catch (error) {
      return res.status(error.message.includes("configured") ? 503 : 403).json({ error: "Invalid or expired QR credential." });
    }
    const attendanceCutoff = await getAttendanceCutoff(db);
    const qrSnapshot = await db.collection("qr_codes").doc(credential.jti).get();
    if (!qrSnapshot.exists || qrSnapshot.data()?.active !== true || qrSnapshot.data()?.revokedAt) return res.status(403).json({ error: "This QR credential is inactive or revoked." });
    const qrData = qrSnapshot.data();
    if (!isValidStudentId(qrData.studentId)) return res.status(404).json({ error: "Student record not found." });
    const studentSnapshot = await db.collection("students").doc(qrData.studentId).get();
    if (!studentSnapshot.exists) return res.status(404).json({ error: "Student record not found." });
    const studentData = studentSnapshot.data() || {};
    const studentId = qrData.studentId;
    const studentCode = studentData.studentCode || studentData.code || qrData.studentCode || "";
    const sectionId = studentData.sectionId || studentData.section || "";
    if (!sectionId) return res.status(400).json({ error: "Student record has no section assigned. Attendance cannot be recorded." });
    const teacherId = studentData.teacherId || studentData.teacher || "";
    if (!requireTeacherSection(req, res, sectionId)) return;
    const name = studentData.name || studentCode;
    const serverNow = new Date();
    const { date, time: localClock } = getAttendanceDateParts(serverNow);
    const time = new Intl.DateTimeFormat("en-US", { timeZone: process.env.ATTENDANCE_TIME_ZONE || "Asia/Manila", hour: "2-digit", minute: "2-digit" }).format(serverNow);
    const status = period === "AM-1" && localClock > attendanceCutoff ? "late" : "present";
    const id = createAttendanceId(studentId, studentCode, date);
    const attendanceRef = db.collection("attendance").doc(id);
    const parentSnapshot = await db.collection("parentcontacts").doc(`${studentId}_parent`).get();
    const recipientPhone = normalizePhoneNumber(studentData.parentPhone || parentSnapshot.data()?.parentPhone || "");
    const scanResult = await db.runTransaction(async transaction => {
      const snapshot = await transaction.get(attendanceRef);
      const current = snapshot.exists ? snapshot.data() || {} : {};
      const scans = getAttendanceScans(current);
      if (scans[period]) return { duplicate: true, scans };
      const scanCount = attendancePeriods.filter(item => scans[item]).length;
      if (scanCount >= attendancePeriods.length) return { limitReached: true, scans };

      scans[period] = { time, status, smsStatus: recipientPhone ? "pending" : "skipped" };
      const arrivalScan = scans["AM-1"];
      transaction.set(attendanceRef, {
        id,
        studentId,
        studentCode,
        sectionId,
        teacherId,
        qrId: credential.jti,
        date,
        time: arrivalScan?.time || time,
        status: arrivalScan?.status || status,
        arrivalStatus: arrivalScan?.status || "",
        period,
        scanCount: attendancePeriods.filter(item => scans[item]).length,
        scans,
        smsStatus: scans[period].smsStatus,
        updatedAt: new Date(),
        ...(!snapshot.exists ? { createdAt: new Date() } : {})
      }, { merge: true });
      return { scans, scanCount: attendancePeriods.filter(item => scans[item]).length };
    });
    if (scanResult.duplicate || scanResult.limitReached) {
      return res.status(409).json({
        error: scanResult.duplicate ? `This student already has an ${period} scan today.` : "The daily scan limit has been reached.",
        code: "duplicate_scan",
        period,
        scanCount: attendancePeriods.filter(item => scanResult.scans[item]).length
      });
    }

    const templates = await loadSmsTemplates(db);
    const messageTemplate = status === "late" ? templates.late : templates.present;
    const message = renderSmsTemplate(messageTemplate, {
      studentName: name,
      section: studentData.sectionName || sectionId,
      period,
      date,
      status
    });
    let smsStatus = "skipped";
    let smsError = "";
    let smsModeForLog = smsMode;
    let smsReason = "";
    if (!recipientPhone) {
      smsError = "No linked parent or guardian phone number";
      smsReason = smsError;
    } else if (!isE164PhoneNumber(recipientPhone)) {
      smsStatus = "failed";
      smsError = "Phone number must use international format, for example +639171234567";
      smsReason = smsError;
    } else {
      const guard = await checkSmsAllowed(db, { studentId });
      const delivery = await sendViaProvider({
        db,
        studentId,
        smsGuard: guard,
        to: recipientPhone,
        message,
        provider: smsProvider,
        settings: {
          db,
          studentId,
          semaphoreConfigured,
          semaphoreApiKey,
          semaphoreSenderName,
          twilioConfigured,
          twilioMessagingServiceSid,
          twilioNumber,
          client
        }
      });
      smsStatus = delivery.status === "unconfigured" ? "failed" : delivery.status;
      smsError = delivery.error || "";
      smsModeForLog = delivery.mode || guard.mode;
      smsReason = delivery.reason || smsError;
      if (smsStatus === "sent") {
        console.log("Automatic attendance SMS sent.");
      } else if (smsStatus === "failed") {
        console.error("Automatic attendance SMS error:", smsError);
      }
    }
    await attendanceRef.set({ scans: { [period]: { smsStatus } }, smsStatus, updatedAt: new Date() }, { merge: true });
    await db.collection("sms_logs").add({ actorUid: req.auth.uid, studentId, attendanceId: id, period, phone: recipientPhone, message, status: smsStatus, error: smsError, mode: smsModeForLog, reason: smsReason, createdAt: new Date() });
    await writeAuditLog(db, { action: "attendance.period_recorded", actorUid: req.auth.uid, targetType: "attendance", targetId: id, details: { studentId, sectionId, period, status, smsStatus } });
    scanResult.scans[period].smsStatus = smsStatus;
    return res.json({
      success: true,
      recorded: true,
      id,
      date,
      time,
      studentId,
      studentCode,
      sectionId,
      period,
      status,
      arrivalStatus: scanResult.scans["AM-1"]?.status || "",
      smsStatus,
      scanCount: scanResult.scanCount,
      scans: scanResult.scans
    });
  } catch (error) {
    console.error("Attendance record error:", error);
    return res.status(500).json({ error: "Unable to record attendance" });
  }
});

app.post("/attendance/excuse", requireStaffAuth, attendanceLimiter, async (req, res) => {
  const { studentId = "", period = "", reason = "" } = req.body || {};
  if (!isValidStudentId(studentId)) return res.status(400).json({ error: "A valid studentId is required." });
  if (!attendancePeriods.includes(period)) return res.status(400).json({ error: "A valid attendance period is required." });

  try {
    const db = getFirestore(req.adminSdk);
    const studentSnapshot = await db.collection("students").doc(studentId).get();
    if (!studentSnapshot.exists) return res.status(404).json({ error: "Student record not found." });
    const student = studentSnapshot.data() || {};
    const sectionId = student.sectionId || student.section || "";
    if (!sectionId) return res.status(400).json({ error: "Student record has no section assigned." });
    if (!requireTeacherSection(req, res, sectionId)) return;

    const { date, time } = getAttendanceDateParts();
    const studentCode = student.studentCode || student.code || studentId;
    const attendanceId = createAttendanceId(studentId, studentCode, date);
    const attendanceRef = db.collection("attendance").doc(attendanceId);
    const result = await db.runTransaction(async transaction => {
      const snapshot = await transaction.get(attendanceRef);
      const current = snapshot.exists ? snapshot.data() || {} : {};
      const scans = getAttendanceScans(current);
      if (scans[period]) return { duplicate: true, scans };
      if (attendancePeriods.filter(item => scans[item]).length >= attendancePeriods.length) return { duplicate: true, scans };

      const sanitizedReason = String(reason).trim().slice(0, 240);
      scans[period] = { time, status: "excused", smsStatus: "skipped", ...(sanitizedReason ? { reason: sanitizedReason } : {}) };
      const arrivalScan = scans["AM-1"];
      const arrivalStatus = arrivalScan?.status || current.arrivalStatus || "";
      const attendance = {
        id: attendanceId,
        studentId,
        studentCode,
        sectionId,
        teacherId: student.teacherId || student.teacher || "",
        date,
        time: arrivalScan?.time || current.time || (period === "AM-1" ? time : ""),
        status: arrivalStatus || current.status || "excused",
        arrivalStatus,
        period,
        scanCount: attendancePeriods.filter(item => scans[item]).length,
        scans,
        smsStatus: "skipped",
        updatedAt: new Date(),
        ...(!snapshot.exists ? { createdAt: new Date() } : {})
      };
      transaction.set(attendanceRef, attendance, { merge: true });
      return { attendance, scans };
    });
    if (result.duplicate) {
      return res.status(409).json({ error: `This student already has an ${period} record today.`, code: "duplicate_scan", period });
    }

    await writeAuditLog(db, { action: "attendance.period_excused", actorUid: req.auth.uid, targetType: "attendance", targetId: attendanceId, details: { studentId, sectionId, period, reason: String(reason).trim().slice(0, 240) } });
    return res.json({ success: true, recorded: true, ...result.attendance });
  } catch (error) {
    console.error("Excused attendance error:", error);
    return res.status(500).json({ error: "Unable to record excused attendance." });
  }
});

app.post("/admin/sections", async (req, res) => {
  const authResult = await verifyAdminRequest(req);
  if (authResult.error) {
    return res.status(getFirebaseErrorStatus(authResult.error)).json({ error: authResult.error });
  }

  const { action = "save", id, name, grade, room, strand = "", teacherId = "", uid, sectionId, previousSectionId = "" } = req.body || {};

  try {
    const db = getFirestore(authResult.adminSdk);

    if (action === "syncTeacherSection") {
      if (previousSectionId && previousSectionId !== sectionId) {
        await db.collection("sections").doc(previousSectionId).set({ teacherId: "", updatedAt: new Date() }, { merge: true });
      }
      if (sectionId) {
        await db.collection("sections").doc(sectionId).set({ teacherId: uid || teacherId || "", updatedAt: new Date() }, { merge: true });
      }
      return res.json({ success: true });
    }

    if (!name || !grade || !room) {
      return res.status(400).json({ error: "Missing required fields: name, grade, room" });
    }

    const sectionPayload = {
      name: name.trim(),
      grade: grade.trim(),
      room: room.trim(),
      strand: strand.trim(),
      adviser: String(req.body.adviser || "").trim(),
      teacherId: teacherId || "",
      updatedAt: new Date()
    };

    if (id) {
      await db.collection("sections").doc(id).set(sectionPayload, { merge: true });
      return res.json({ success: true, sectionId: id, section: sectionPayload });
    }

    const sectionRef = await db.collection("sections").add({ ...sectionPayload, createdAt: new Date() });
    return res.json({ success: true, sectionId: sectionRef.id, section: sectionPayload });
  } catch (error) {
    console.error("Admin sections write error:", error);
    return res.status(500).json({ error: "Failed to save section" });
  }
});

app.get("/teacher/sections", requireStaffAuth, async (req, res) => {
  if (req.isAdmin || req.auth?.teacher !== true) {
    return res.status(403).json({ error: "Teacher access required." });
  }

  try {
    const db = getFirestore(req.adminSdk);
    const snapshots = await Promise.all((req.teacherSectionIds || []).map(sectionId => db.collection("sections").doc(sectionId).get()));
    const sections = snapshots
      .filter(snapshot => snapshot.exists)
      .map(snapshot => ({ id: snapshot.id, ...snapshot.data() }));
    return res.json({ success: true, sections });
  } catch (error) {
    console.error("Teacher sections read error:", error);
    return res.status(500).json({ error: "Failed to load assigned sections" });
  }
});

app.get("/admin/sections", async (req, res) => {
  const authResult = await verifyAdminRequest(req);
  if (authResult.error) return res.status(getFirebaseErrorStatus(authResult.error)).json({ error: authResult.error });

  try {
    const snapshot = await getFirestore(authResult.adminSdk).collection("sections").get();
    return res.json({ success: true, sections: snapshot.docs.map(section => ({ id: section.id, ...section.data() })) });
  } catch (error) {
    console.error("Admin sections read error:", error);
    return res.status(500).json({ error: "Failed to load sections" });
  }
});

app.delete("/admin/sections/:sectionId", async (req, res) => {
  const authResult = await verifyAdminRequest(req);
  if (authResult.error) return res.status(getFirebaseErrorStatus(authResult.error)).json({ error: authResult.error });

  try {
    await getFirestore(authResult.adminSdk).collection("sections").doc(req.params.sectionId).delete();
    return res.json({ success: true, sectionId: req.params.sectionId });
  } catch (error) {
    console.error("Admin section delete error:", error);
    return res.status(500).json({ error: "Failed to delete section" });
  }
});

app.post("/admin/teachers", async (req, res) => {
  const authResult = await verifyAdminRequest(req);
  if (authResult.error) return res.status(getFirebaseErrorStatus(authResult.error)).json({ error: authResult.error });

  const { action = "list", uid, name, email, password = "", strand = "", sectionId = "", approved = true } = req.body || {};
  try {
    const db = getFirestore(authResult.adminSdk);
    if (action === "list") {
      const [teacherSnapshot, userSnapshot] = await Promise.all([
        db.collection("teachers").get(),
        db.collection("users").where("role", "==", "teacher").get()
      ]);
      const teachers = new Map();
      teacherSnapshot.docs.forEach(teacher => teachers.set(teacher.id, { id: teacher.id, ...teacher.data() }));
      userSnapshot.docs.forEach(user => {
        if (!teachers.has(user.id)) teachers.set(user.id, { id: user.id, ...user.data() });
      });
      return res.json({ success: true, teachers: [...teachers.values()] });
    }
    if (action !== "save" || !uid || !name || !email) {
      return res.status(400).json({ error: "Missing required teacher fields: uid, name, email" });
    }
    if (password && password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });
    const previousTeacher = await db.collection("teachers").doc(uid).get();
    const previousSectionId = previousTeacher.exists ? String(previousTeacher.data()?.sectionId || "") : "";
    await setRoleClaims(authResult.adminSdk, uid, "teacher", email.trim().toLowerCase(), name.trim(), password);
    const teacher = { uid, name: name.trim(), email: email.trim().toLowerCase(), strand, sectionId, approved: !!approved, updatedAt: new Date() };
    await db.collection("teachers").doc(uid).set(teacher, { merge: true });
    await db.collection("users").doc(uid).set({ id: uid, ...teacher, role: "teacher" }, { merge: true });
    if (previousSectionId && previousSectionId !== sectionId) {
      await db.collection("sections").doc(previousSectionId).set({ teacherId: "", updatedAt: new Date() }, { merge: true });
    }
    if (sectionId) {
      await db.collection("sections").doc(sectionId).set({ teacherId: uid, updatedAt: new Date() }, { merge: true });
    }
    return res.json({ success: true, teacher });
  } catch (error) {
    console.error("Admin teachers write error:", error);
    return res.status(500).json({ error: "Failed to save teacher" });
  }
});

app.get("/admin/teachers", async (req, res) => {
  const authResult = await verifyAdminRequest(req);
  if (authResult.error) return res.status(getFirebaseErrorStatus(authResult.error)).json({ error: authResult.error });

  try {
    const snapshot = await getFirestore(authResult.adminSdk).collection("teachers").get();
    return res.json({ success: true, teachers: snapshot.docs.map(teacher => ({ id: teacher.id, ...teacher.data() })) });
  } catch (error) {
    console.error("Admin teachers read error:", error);
    return res.status(500).json({ error: "Failed to load teachers" });
  }
});

app.delete("/admin/teachers/:uid", async (req, res) => {
  const authResult = await verifyAdminRequest(req);
  if (authResult.error) return res.status(getFirebaseErrorStatus(authResult.error)).json({ error: authResult.error });

  try {
    const db = getFirestore(authResult.adminSdk);
    await db.collection("teachers").doc(req.params.uid).delete();
    await db.collection("users").doc(req.params.uid).delete();
    try { await getAuth(authResult.adminSdk).deleteUser(req.params.uid); } catch (error) {
      if (error.code !== "auth/user-not-found") throw error;
    }
    return res.json({ success: true, uid: req.params.uid });
  } catch (error) {
    console.error("Admin teacher delete error:", error);
    return res.status(500).json({ error: "Failed to delete teacher" });
  }
});

app.post("/admin/create-user-profile", async (req, res) => {
  const authResult = await verifyAdminRequest(req);
  if (authResult.error) {
    return res.status(getFirebaseErrorStatus(authResult.error)).json({ error: authResult.error });
  }

  const { uid, name, email, role = "student", strand = "", approved = true } = req.body || {};
  if (!uid || !email || !name) {
    return res.status(400).json({ error: "Missing required fields: uid, name, email" });
  }

  const profile = {
    id: uid,
    uid,
    name: name.trim(),
    email: email.trim().toLowerCase(),
    role,
    strand: strand || "",
    approved: !!approved,
    adminProvisioned: role === "admin",
    createdAt: new Date()
  };

  try {
    await setRoleClaims(authResult.adminSdk, uid, role, profile.email, profile.name);
    const db = getFirestore(authResult.adminSdk);
    await db.collection("users").doc(uid).set(profile, { merge: true });
    if (role === "teacher") {
      await db.collection("teachers").doc(uid).set({ uid, name: profile.name, email: profile.email, strand: profile.strand, approved: profile.approved, createdAt: new Date() }, { merge: true });
    }
    return res.json({ success: true, profile });
  } catch (error) {
    console.error("Admin create-user-profile error:", error);
    return res.status(500).json({ error: "Failed to create user profile" });
  }
});

app.post("/qr/generate", requireStaffAuth, async (req, res) => {
  const { studentId, studentCode, sectionId } = req.body || {};
  if (!isValidStudentId(studentId)) return res.status(400).json({ error: "Invalid studentId." });
  if (typeof studentCode !== "string" || !studentCode.trim() || studentCode.length > 32) return res.status(400).json({ error: "Invalid studentCode." });
  if (typeof sectionId !== "string" || !sectionId.trim() || sectionId.length > 128 || sectionId.includes("/")) return res.status(400).json({ error: "Invalid sectionId." });
  if (!requireTeacherSection(req, res, sectionId)) return;
  if (!getQrSigningSecret()) return res.status(503).json({ error: "QR signing is not configured on the server." });

  try {
    const db = getFirestore(req.adminSdk);
    const studentSnapshot = await db.collection("students").doc(studentId).get();
    if (!studentSnapshot.exists) return res.status(404).json({ error: "Student record not found." });
    const student = studentSnapshot.data() || {};
    const studentSection = student.sectionId || student.section || "";
    if (!studentSection) return res.status(400).json({ error: "Student record has no section assigned." });
    if (studentSection !== sectionId) return res.status(403).json({ error: "Student does not belong to the requested section." });
    const storedCode = student.studentCode || student.code || "";
    if (storedCode && storedCode !== studentCode) return res.status(400).json({ error: "studentCode does not match the student record." });

    const qrUuid = crypto.randomUUID();
    const expiresAt = Math.floor((Date.now() + qrCredentialLifetimeMs) / 1000);
    const qrContent = createQrCredential(qrUuid, expiresAt);
    const qrData = { uuid: qrUuid, studentId, studentCode: storedCode || studentCode, sectionId, generatedAt: new Date(), expiresAt: new Date(expiresAt * 1000), active: true, issuedTo: req.auth.uid };
    await db.collection("qr_codes").doc(qrUuid).set(qrData);
    await writeAuditLog(db, { action: "qr.generated", actorUid: req.auth.uid, targetType: "qr_code", targetId: qrUuid, details: { studentId, sectionId: sectionId || "" } });
    return res.json({ success: true, qrUuid, qrContent, expiresAt });
  } catch (error) {
    console.error("QR generation error:", error);
    return res.status(500).json({ error: "Failed to generate QR code" });
  }
});

app.post("/qr/:qrUuid/revoke", async (req, res) => {
  const authResult = await verifyAdminRequest(req);
  if (authResult.error) return res.status(getFirebaseErrorStatus(authResult.error)).json({ error: authResult.error });
  try {
    const qrRef = getFirestore(authResult.adminSdk).collection("qr_codes").doc(req.params.qrUuid);
    const snapshot = await qrRef.get();
    if (!snapshot.exists) return res.status(404).json({ error: "QR code not found" });
    await qrRef.set({ active: false, revokedAt: new Date(), revokedBy: authResult.token.uid }, { merge: true });
    await writeAuditLog(getFirestore(authResult.adminSdk), { action: "qr.revoked", actorUid: authResult.token.uid, targetType: "qr_code", targetId: req.params.qrUuid });
    return res.json({ success: true });
  } catch (error) {
    console.error("QR revocation error:", error);
    return res.status(500).json({ error: "Failed to revoke QR code" });
  }
});

app.get("/qr/:qrUuid", requireStaffAuth, async (req, res) => {
  try {
    const db = getFirestore(req.adminSdk);
    const snapshot = await db.collection("qr_codes").doc(req.params.qrUuid).get();
    if (!snapshot.exists) return res.status(404).json({ error: "QR code not found" });
    const qrData = snapshot.data() || {};
    if (!req.isAdmin) {
      if (!isValidStudentId(qrData.studentId)) return res.status(404).json({ error: "Student record not found" });
      const studentSnapshot = await db.collection("students").doc(qrData.studentId).get();
      if (!studentSnapshot.exists) return res.status(404).json({ error: "Student record not found" });
      const student = studentSnapshot.data() || {};
      if (!requireTeacherSection(req, res, student.sectionId || student.section)) return;
    }
    return res.json({ success: true, qrData: { id: snapshot.id, ...qrData } });
  } catch (error) {
    console.error("QR lookup error:", error);
    return res.status(500).json({ error: "Failed to load QR code" });
  }
});

app.post("/parent-contacts", requireStaffAuth, async (req, res) => {
  const { studentId, parentName, parentPhone } = req.body || {};
  if (!isValidStudentId(studentId)) return res.status(400).json({ error: "Invalid studentId." });
  if (typeof parentPhone !== "string" || !parentPhone.trim()) return res.status(400).json({ error: "Missing required field: parentPhone" });
  if (parentName !== undefined && typeof parentName !== "string") return res.status(400).json({ error: "Invalid parentName." });
  const normalizedPhone = normalizePhoneNumber(parentPhone);
  if (!isE164PhoneNumber(normalizedPhone)) return res.status(400).json({ error: "Phone number must use international format, for example +639171234567" });

  try {
    const db = getFirestore(req.adminSdk);
    const studentSnapshot = await db.collection("students").doc(studentId).get();
    if (!studentSnapshot.exists) return res.status(404).json({ error: "Student record not found." });
    const contactId = `${studentId}_parent`;
    const contact = { studentId, parentName: String(parentName || "Guardian").trim().slice(0, 120), parentPhone: normalizedPhone, notifyOnAttendance: true, createdAt: new Date(), updatedAt: new Date() };
    await db.collection("parentcontacts").doc(contactId).set(contact, { merge: true });
    return res.json({ success: true, contactId, contact });
  } catch (error) {
    console.error("Parent contact save error:", error);
    return res.status(500).json({ error: "Failed to save parent contact" });
  }
});

app.get("/parent-contacts", requireStaffAuth, async (req, res) => {
  try {
    const snapshot = await getFirestore(req.adminSdk).collection("parentcontacts").get();
    const contacts = snapshot.docs.map(record => ({ id: record.id, ...record.data() }));
    return res.json({ success: true, contacts });
  } catch (error) {
    console.error("Parent contacts list error:", error);
    return res.status(500).json({ error: "Failed to load parent contacts" });
  }
});

app.get("/parent-contacts/:studentId", requireStaffAuth, async (req, res) => {
  if (!isValidStudentId(req.params.studentId)) return res.status(400).json({ error: "Invalid studentId." });
  try {
    const snapshot = await getFirestore(req.adminSdk).collection("parentcontacts").doc(`${req.params.studentId}_parent`).get();
    if (!snapshot.exists) return res.status(404).json({ error: "Parent contact not found" });
    return res.json({ success: true, contact: { id: snapshot.id, ...snapshot.data() } });
  } catch (error) {
    console.error("Parent contact lookup error:", error);
    return res.status(500).json({ error: "Failed to load parent contact" });
  }
});

app.delete("/parent-contacts/:contactId", requireStaffAuth, async (req, res) => {
  try {
    await getFirestore(req.adminSdk).collection("parentcontacts").doc(req.params.contactId).delete();
    return res.json({ success: true, contactId: req.params.contactId });
  } catch (error) {
    console.error("Parent contact delete error:", error);
    return res.status(500).json({ error: "Failed to delete parent contact" });
  }
});

app.get("/attendance/:studentId", requireStaffAuth, async (req, res) => {
  if (!isValidStudentId(req.params.studentId)) return res.status(400).json({ error: "Invalid studentId." });
  try {
    const studentSnapshot = await getFirestore(req.adminSdk).collection("students").doc(req.params.studentId).get();
    if (!studentSnapshot.exists) return res.status(404).json({ error: "Student record not found" });
    const student = studentSnapshot.data() || {};
    if (!requireTeacherSection(req, res, student.sectionId || student.section)) return;
    const snapshot = await getFirestore(req.adminSdk).collection("attendance").where("studentId", "==", req.params.studentId).get();
    const attendance = snapshot.docs.map(record => ({ id: record.id, ...record.data() })).sort((left, right) => String(right.date).localeCompare(String(left.date)));
    return res.json({ success: true, attendance });
  } catch (error) {
    console.error("Student attendance lookup error:", error);
    return res.status(500).json({ error: "Failed to load attendance history" });
  }
});

app.get("/students", requireStaffAuth, async (req, res) => {
  try {
    const snapshot = await getFirestore(req.adminSdk).collection("students").get();
    const students = snapshot.docs.map(record => ({ id: record.id, ...record.data() })).filter(student => teacherCanAccessSection(req, student.sectionId || student.section));
    return res.json({ success: true, students });
  } catch (error) {
    console.error("Students list error:", error);
    return res.status(500).json({ error: "Failed to load students" });
  }
});

app.get("/attendance", requireStaffAuth, async (req, res) => {
  try {
    const snapshot = await getFirestore(req.adminSdk).collection("attendance").get();
    const attendance = snapshot.docs.map(record => ({ id: record.id, ...record.data() })).filter(entry => teacherCanAccessSection(req, entry.sectionId));
    return res.json({ success: true, attendance });
  } catch (error) {
    console.error("Attendance list error:", error);
    return res.status(500).json({ error: "Failed to load attendance records" });
  }
});

async function finalizeAttendanceForDate(db, date, actorUid = "system") {
  const studentSnapshot = await db.collection("students").get();
  const attendanceSnapshot = await db.collection("attendance").where("date", "==", date).get();
  const templates = await loadSmsTemplates(db);
  const existingAttendance = new Map(attendanceSnapshot.docs.map(record => [record.data()?.studentId, record.data()]));
  const results = { date, created: 0, skipped: 0, sent: 0, simulated: 0, failed: 0, noContact: 0 };

  for (const studentRecord of studentSnapshot.docs) {
    const student = studentRecord.data() || {};
    const existingRecord = existingAttendance.get(studentRecord.id);
    const existingScans = getAttendanceScans(existingRecord);
    if (student.active === false || existingScans["AM-1"]) {
      results.skipped += 1;
      continue;
    }

    const attendanceId = createAttendanceId(studentRecord.id, student.studentCode || student.code, date);
    const parentSnapshot = await db.collection("parentcontacts").doc(`${studentRecord.id}_parent`).get();
    const parent = parentSnapshot.exists ? parentSnapshot.data() || {} : {};
    const recipientPhone = normalizePhoneNumber(student.parentPhone || student.phone || parent.parentPhone || "");
    const name = student.name || student.studentCode || student.code || studentRecord.id;
    const sectionId = student.sectionId || student.section || "";
    const message = renderSmsTemplate(templates.absent, {
      studentName: name,
      section: student.sectionName || sectionId,
      period: "AM-1",
      date,
      status: "absent"
    });
    let smsStatus = recipientPhone ? "pending" : "skipped";
    let smsError = recipientPhone ? "" : "No linked parent or guardian phone number";
    let smsModeForLog = smsMode;
    let smsReason = recipientPhone ? "" : smsError;
    const scans = { ...existingScans, "AM-1": { time: "", status: "absent", smsStatus } };

    await db.collection("attendance").doc(attendanceId).set({
      id: attendanceId,
      studentId: studentRecord.id,
      studentCode: student.studentCode || student.code || studentRecord.id,
      sectionId,
      teacherId: student.teacherId || student.teacher || "",
      ...(student.qrUuid ? { qrId: student.qrUuid } : {}),
      date,
      time: "",
      status: "absent",
      arrivalStatus: "absent",
      period: "AM-1",
      scanCount: attendancePeriods.filter(period => scans[period]).length,
      scans,
      smsStatus,
      updatedAt: new Date(),
      ...(!existingRecord ? { createdAt: new Date() } : {})
    }, { merge: true });
    results.created += 1;

    if (!recipientPhone) {
      results.noContact += 1;
    } else if (!isE164PhoneNumber(recipientPhone)) {
      smsStatus = "failed";
      smsError = "Phone number must use international format, for example +639171234567";
      smsReason = smsError;
      results.failed += 1;
    } else {
      const studentId = studentRecord.id;
      const guard = await checkSmsAllowed(db, { studentId });
      const delivery = await sendViaProvider({
        db,
        studentId,
        smsGuard: guard,
        to: recipientPhone,
        message,
        provider: smsProvider,
        settings: {
          db,
          studentId,
          semaphoreConfigured,
          semaphoreApiKey,
          semaphoreSenderName,
          twilioConfigured,
          twilioMessagingServiceSid,
          twilioNumber,
          client
        }
      });
      smsStatus = delivery.status === "unconfigured" ? "failed" : delivery.status;
      smsError = delivery.error || "";
      smsModeForLog = delivery.mode || guard.mode;
      smsReason = delivery.reason || smsError;
      if (smsStatus === "sent") {
        results.sent += 1;
      } else if (smsStatus === "simulated") {
        results.simulated += 1;
      } else if (smsStatus === "failed") {
        results.failed += 1;
        console.error("Automatic absent SMS error:", smsError);
      } else {
        results.skipped += 1;
      }
    }

    await db.collection("attendance").doc(attendanceId).set({ scans: { "AM-1": { smsStatus } }, smsStatus }, { merge: true });
    await db.collection("sms_logs").add({ actorUid, studentId: studentRecord.id, attendanceId, period: "AM-1", phone: recipientPhone, message, status: smsStatus, error: smsError, mode: smsModeForLog, reason: smsReason, createdAt: new Date() });
  }

  return results;
}

app.get("/admin/settings/sms-templates", requireStaffAuth, async (req, res) => {
  try {
    const templates = await loadSmsTemplates(getFirestore(req.adminSdk));
    return res.json({ success: true, templates });
  } catch (error) {
    console.error("SMS template load error:", error);
    return res.status(500).json({ success: false, error: "Unable to load SMS templates" });
  }
});

app.post("/admin/settings/sms-templates", async (req, res) => {
  const authResult = await verifyAdminRequest(req);
  if (authResult.error) return res.status(getFirebaseErrorStatus(authResult.error)).json({ success: false, error: authResult.error });
  const { present, late, absent } = req.body || {};
  const templateValues = { present, late, absent };
  const invalidTemplate = Object.values(templateValues).some(value =>
    typeof value !== "string" || !value.trim() || value.length > 320
  );
  if (invalidTemplate) {
    return res.status(400).json({ success: false, error: "Each SMS template must be a non-empty string of at most 320 characters." });
  }

  try {
    const db = getFirestore(authResult.adminSdk);
    const templates = {
      present: present.trim(),
      late: late.trim(),
      absent: absent.trim()
    };
    await db.collection("settings").doc("sms_templates").set({
      ...templates,
      updatedAt: new Date(),
      updatedBy: authResult.token.uid
    }, { merge: true });
    await writeAuditLog(db, {
      action: "settings.sms_templates_updated",
      actorUid: authResult.token.uid,
      targetType: "settings",
      targetId: "sms_templates",
      details: templates
    });
    return res.json({ success: true });
  } catch (error) {
    console.error("SMS template save error:", error);
    return res.status(500).json({ success: false, error: "Unable to save SMS templates" });
  }
});

app.post("/admin/settings/attendance", async (req, res) => {
  const authResult = await verifyAdminRequest(req);
  if (authResult.error) return res.status(getFirebaseErrorStatus(authResult.error)).json({ error: authResult.error });
  const cutoff = String(req.body?.cutoff || "");
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(cutoff)) return res.status(400).json({ error: "Cutoff must use HH:MM format." });
  try {
    const db = getFirestore(authResult.adminSdk);
    await db.collection("settings").doc("attendance").set({ cutoff, updatedAt: new Date(), updatedBy: authResult.token.uid }, { merge: true });
    await writeAuditLog(db, { action: "settings.attendance_cutoff_updated", actorUid: authResult.token.uid, targetType: "settings", targetId: "attendance", details: { cutoff } });
    return res.json({ success: true, cutoff });
  } catch (error) {
    console.error("Attendance settings write error:", error);
    return res.status(500).json({ error: "Failed to save attendance settings." });
  }
});

app.get("/admin/settings/sms-runtime", async (req, res) => {
  const authResult = await verifyAdminRequest(req);
  if (authResult.error) return res.status(getFirebaseErrorStatus(authResult.error)).json({ success: false, error: authResult.error });
  try {
    const loadedRuntime = await loadSmsRuntimeConfig(getFirestore(authResult.adminSdk));
    const effectiveMode = loadedRuntime.mode === "inherit" ? smsMode : loadedRuntime.mode;
    const runtime = {
      mode: loadedRuntime.mode,
      disabled: loadedRuntime.disabled,
      dailyCapPerStudent: loadedRuntime.dailyCapPerStudent,
      effectiveMode
    };
    return res.json({ success: true, runtime });
  } catch (error) {
    console.error("SMS runtime settings load error:", error);
    return res.status(500).json({ success: false, error: "Unable to load SMS runtime settings" });
  }
});

app.post("/admin/settings/sms-runtime", async (req, res) => {
  const authResult = await verifyAdminRequest(req);
  if (authResult.error) return res.status(getFirebaseErrorStatus(authResult.error)).json({ success: false, error: authResult.error });
  const { mode, disabled, dailyCapPerStudent } = req.body || {};
  if (!["inherit", "simulated", "live"].includes(mode)) {
    return res.status(400).json({ success: false, error: "Mode must be inherit, simulated, or live." });
  }
  if (typeof disabled !== "boolean") {
    return res.status(400).json({ success: false, error: "Disabled must be a boolean." });
  }
  if (!Number.isInteger(dailyCapPerStudent) || dailyCapPerStudent < 0) {
    return res.status(400).json({ success: false, error: "Daily cap must be a non-negative integer." });
  }

  try {
    const db = getFirestore(authResult.adminSdk);
    const runtime = { mode, disabled, dailyCapPerStudent };
    await db.collection("settings").doc("sms_runtime").set({
      ...runtime,
      updatedAt: new Date(),
      updatedBy: authResult.token.uid
    }, { merge: true });
    await writeAuditLog(db, {
      action: "settings.sms_runtime_updated",
      actorUid: authResult.token.uid,
      targetType: "settings",
      targetId: "sms_runtime",
      details: runtime
    });
    return res.json({ success: true });
  } catch (error) {
    console.error("SMS runtime settings write error:", error);
    return res.status(500).json({ success: false, error: "Unable to save SMS runtime settings" });
  }
});

app.get("/admin/audit-logs", async (req, res) => {
  const authResult = await verifyAdminRequest(req);
  if (authResult.error) return res.status(getFirebaseErrorStatus(authResult.error)).json({ error: authResult.error });
  try {
    const snapshot = await getFirestore(authResult.adminSdk).collection("audit_logs").orderBy("createdAt", "desc").limit(200).get();
    return res.json({ success: true, logs: snapshot.docs.map(record => {
      const data = record.data();
      return { id: record.id, ...data, createdAt: data.createdAt?.toDate?.()?.toISOString?.() || data.createdAt || "" };
    }) });
  } catch (error) {
    console.error("Audit logs list error:", error);
    return res.status(500).json({ error: "Failed to load audit logs." });
  }
});

app.post("/attendance/finalize", requireStaffAuth, async (req, res) => {
  const requestedDate = String(req.body?.date || getAttendanceDateParts().date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) return res.status(400).json({ error: "Date must use YYYY-MM-DD format." });

  try {
    const db = getFirestore(req.adminSdk);
    const cutoff = await getAttendanceCutoff(db);
    const currentParts = getAttendanceDateParts();
    if (requestedDate === currentParts.date && !isAttendanceCutoffReached(currentParts.time, cutoff) && req.body?.force !== true) {
      return res.status(409).json({ error: `Attendance cannot be finalized before the ${cutoff} cutoff.` });
    }
    const result = await finalizeAttendanceForDate(db, requestedDate, req.auth.uid);
    await writeAuditLog(db, { action: "attendance.absences_finalized", actorUid: req.auth.uid, targetType: "attendance_date", targetId: requestedDate, details: result });
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error("Attendance finalization error:", error);
    return res.status(500).json({ error: "Unable to finalize absent attendance." });
  }
});

app.get("/attendance/section/:sectionId/today", requireStaffAuth, async (req, res) => {
  const date = new Date();
  const today = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  if (!requireTeacherSection(req, res, req.params.sectionId)) return;
  try {
    const snapshot = await getFirestore(req.adminSdk).collection("attendance").where("sectionId", "==", req.params.sectionId).where("date", "==", today).get();
    const attendance = snapshot.docs.map(record => ({ id: record.id, ...record.data() }));
    return res.json({ success: true, date: today, attendance, present: attendance.filter(item => item.status === "present").length, late: attendance.filter(item => item.status === "late").length, absent: attendance.filter(item => item.status === "absent").length });
  } catch (error) {
    console.error("Section attendance lookup error:", error);
    return res.status(500).json({ error: "Failed to load section attendance" });
  }
});

app.get("/attendance/stats/:studentId", requireStaffAuth, async (req, res) => {
  if (!isValidStudentId(req.params.studentId)) return res.status(400).json({ error: "Invalid studentId." });
  try {
    const db = getFirestore(req.adminSdk);
    const studentSnapshot = await db.collection("students").doc(req.params.studentId).get();
    if (!studentSnapshot.exists) return res.status(404).json({ error: "Student record not found" });
    const student = studentSnapshot.data() || {};
    if (!requireTeacherSection(req, res, student.sectionId || student.section)) return;
    const snapshot = await db.collection("attendance").where("studentId", "==", req.params.studentId).get();
    const attendance = snapshot.docs.map(record => record.data());
    const present = attendance.filter(item => item.status === "present").length;
    const late = attendance.filter(item => item.status === "late").length;
    const absent = attendance.filter(item => item.status === "absent").length;
    const total = attendance.length;
    return res.json({ success: true, total, present, late, absent, percentage: total ? Math.round(((present + late) / total) * 100) : 0 });
  } catch (error) {
    console.error("Attendance stats error:", error);
    return res.status(500).json({ error: "Failed to load attendance statistics" });
  }
});

if (process.env.ATTENDANCE_AUTO_FINALIZE !== "false") {
  const absenceFinalizer = setInterval(async () => {
    const parts = getAttendanceDateParts();
    if (["Sat", "Sun"].includes(parts.weekday) || !isAttendanceCutoffReached(parts.time)) return;
    const adminSdk = initFirebaseAdmin();
    if (!adminSdk) return;
    try {
      const db = getFirestore(adminSdk);
      const cutoff = await getAttendanceCutoff(db);
      if (!isAttendanceCutoffReached(parts.time, cutoff)) return;
      await finalizeAttendanceForDate(db, parts.date);
    } catch (error) {
      console.error("Scheduled attendance finalization error:", error.message);
    }
  }, 5 * 60 * 1000);
  absenceFinalizer.unref?.();
}

app.listen(5000, "0.0.0.0", () => console.log("Server running on http://0.0.0.0:5000"));
