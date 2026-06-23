const admin = require("firebase-admin");
require("dotenv").config();

// ─────────────────────────────────────────────────────────────────────────────
// TWO WAYS TO INITIALISE — choose whichever suits your setup:
//
// OPTION A (recommended for deployment): env variables (default below)
// OPTION B (easier for local dev): point to the downloaded JSON key file
//   1. Download service account JSON from Firebase Console
//      → Project Settings → Service Accounts → Generate new private key
//   2. Place the file at server/serviceAccountKey.json
//   3. Set GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json in .env
//   4. Swap the initializeApp call below for:
//      admin.initializeApp({ credential: admin.credential.applicationDefault() });
// ─────────────────────────────────────────────────────────────────────────────

if (!admin.apps.length) {
 admin.initializeApp({
  credential: admin.credential.cert(
    require('./serviceAccountKey.json')
  ),
});
}

const db   = admin.firestore();
const auth = admin.auth();

// Firestore settings — disable deprecated timestamp behaviour warning
db.settings({ ignoreUndefinedProperties: true });

// Handy helpers re-exported so controllers don't need to import admin directly
const FieldValue  = admin.firestore.FieldValue;
const Timestamp   = admin.firestore.Timestamp;

// ─── Collection name constants (one place to rename if needed) ────────────────
const COLLECTIONS = {
  USERS:    "users",
  CROPS:    "crops",
  CONTACTS: "contacts",
};

module.exports = { admin, db, auth, FieldValue, Timestamp, COLLECTIONS };
