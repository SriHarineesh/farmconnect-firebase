const admin = require("firebase-admin");
require("dotenv").config();

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      type: "service_account",
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: process.env.FIREBASE_AUTH_URI,
      token_uri: process.env.FIREBASE_TOKEN_URI,
    }),
  });
}

const db = admin.firestore();
const auth = admin.auth();
db.settings({ ignoreUndefinedProperties: true });

const FieldValue = admin.firestore.FieldValue;
const Timestamp = admin.firestore.Timestamp;

const COLLECTIONS = {
  USERS: "users",
  CROPS: "crops",
  CONTACTS: "contacts",
};

module.exports = { admin, db, auth, FieldValue, Timestamp, COLLECTIONS };