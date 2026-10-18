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

async function main() {
  const adminApp = initFirebaseAdmin();
  if (!adminApp) {
    console.error("Firebase Admin is not configured. Check FIREBASE_SERVICE_ACCOUNT_PATH or GOOGLE_APPLICATION_CREDENTIALS.");
    process.exit(1);
  }

  const db = getFirestore(adminApp);
  const confirmDelete = process.argv.includes("--confirm");

  console.log("Scanning for attendance records marked with seed: true...");
  const snapshot = await db.collection("attendance").where("seed", "==", true).get();
  const records = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  console.log(`Found ${records.length} seed records.`);

  if (!confirmDelete) {
    console.log("Dry run only. Re-run with --confirm to delete the matching attendance records.");
    return;
  }

  console.log("Deleting seed records in batches...");
  let deleted = 0;

  for (const record of records) {
    try {
      await db.collection("attendance").doc(record.id).delete();
      deleted += 1;
      console.log(`Deleted ${record.id}`);
    } catch (error) {
      console.error(`Failed to delete ${record.id}:`, error && error.message ? error.message : error);
    }
  }

  console.log(`Cleanup complete. Deleted ${deleted} seed attendance records.`);
}

main().catch((error) => {
  console.error("Clear script failed:", error && error.message ? error.message : error);
  process.exit(1);
});
