const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const admin = require("firebase-admin");
const { getApps, initializeApp, cert, applicationDefault } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const fs = require("fs");

function initFirebaseAdmin() {
  const existingApps = getApps();
  if (existingApps.length) return existingApps[0];

  try {
    const credentialPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const credential = credentialPath && fs.existsSync(credentialPath)
      ? cert(JSON.parse(fs.readFileSync(credentialPath, "utf8")))
      : applicationDefault();
    const projectId = process.env.FIREBASE_PROJECT_ID || "attendance-monitoring-73028";
    return initializeApp({ credential, projectId });
  } catch (error) {
    console.error("Firebase Admin initialization error:", error.message);
    return null;
  }
}

function createAttendanceId(studentId, studentCode, date) {
  const recordCode = String(studentCode || studentId)
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toUpperCase();
  return `ATT-${String(date).replace(/-/g, "")}-${recordCode}`;
}

function formatDateInput(date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function getLastWeekdays(totalDays = 7) {
  const results = [new Date()];
  const today = new Date();
  const cursor = new Date(today);

  while (results.length < totalDays) {
    cursor.setDate(cursor.getDate() - 1);
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) {
      results.unshift(new Date(cursor));
    }
  }

  return results;
}

function buildSeedScan(period, forcedStatus = null) {
  const schedule = {
    "AM-1": { time: "07:15", status: "present" },
    "AM-2": { time: "11:20", status: "present" },
    "PM-1": { time: "13:15", status: "present" },
    "PM-2": { time: "16:10", status: "present" }
  };

  const periodConfig = schedule[period] || { time: "00:00", status: "present" };
  const finalStatus = forcedStatus || periodConfig.status;

  return {
    time: periodConfig.time,
    status: finalStatus,
    smsStatus: "simulated"
  };
}

async function main() {
  const adminApp = initFirebaseAdmin();
  if (!adminApp) {
    console.error("Firebase Admin is not configured. Check FIREBASE_SERVICE_ACCOUNT_PATH or GOOGLE_APPLICATION_CREDENTIALS.");
    process.exit(1);
  }

  const db = getFirestore(adminApp);
  const studentsSnapshot = await db.collection("students").get();

  if (studentsSnapshot.empty) {
    console.error("No students found in Firestore. Seed aborted to avoid creating new records.");
    process.exit(1);
  }

  const students = studentsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const days = getLastWeekdays(7);
  let createdCount = 0;

  console.log(`Found ${students.length} students. Generating seeded attendance for today and the previous ${days.length - 1} weekdays...`);

  for (const student of students) {
    const studentId = String(student.id || student.studentId || "");
    const studentCode = String(student.studentCode || student.code || "");
    const sectionId = student.sectionId || student.section || "";

    for (const day of days) {
      const date = formatDateInput(day);
      const attendanceId = createAttendanceId(studentId, studentCode, date);
      const attendanceRef = db.collection("attendance").doc(attendanceId);
      const existing = await attendanceRef.get();

      if (existing.exists) {
        continue;
      }

      const scans = {};
      const periods = ["AM-1", "AM-2", "PM-1", "PM-2"];

      for (const period of periods) {
        const chance = { "AM-1": 0.85, "AM-2": 0.7, "PM-1": 0.7, "PM-2": 0.7 }[period] || 0;

        if (Math.random() > chance) {
          continue;
        }

        let status = "present";
        if (period === "AM-1" && Math.random() > 0.75) {
          status = "late";
        }

        scans[period] = buildSeedScan(period, status);
      }

      if (Object.keys(scans).length === 0) {
        const status = Math.random() > 0.75 ? "late" : "present";
        scans["AM-1"] = buildSeedScan("AM-1", status);
      }

      const firstScanTime = Object.values(scans)[0]?.time || "07:15";
      const firstScanStatus = Object.values(scans)[0]?.status || "present";
      const record = {
        id: attendanceId,
        studentId,
        studentCode,
        sectionId,
        date,
        time: firstScanTime,
        status: firstScanStatus,
        scans,
        seed: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        scanCount: Object.keys(scans).length
      };

      await attendanceRef.set(record, { merge: true });
      createdCount += 1;
    }
  }

  console.log(`Seed complete. Created ${createdCount} attendance records with seed: true.`);
}

main().catch((error) => {
  console.error("Seed script failed:", error && error.message ? error.message : error);
  process.exit(1);
});
