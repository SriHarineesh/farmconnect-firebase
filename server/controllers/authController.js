const { auth, db, FieldValue, COLLECTIONS } = require("../config/firebase");

// ─────────────────────────────────────────────────────────────────────────────
// HOW AUTH WORKS IN THIS FIREBASE BUILD
//
// 1. REGISTER:
//    Frontend creates Firebase Auth user (email = phone@farmconnect.in, password)
//    then POSTs the user's uid + profile fields to POST /api/auth/register
//    Backend stores the profile in Firestore users/{uid}
//    (Firebase Auth handles the credential — we only store metadata in Firestore)
//
// 2. LOGIN:
//    Frontend signs in via Firebase SDK → gets an ID token
//    ID token is sent to protected routes via Authorization: Bearer <token>
//    Backend verifies the token with Firebase Admin SDK (middleware/auth.js)
//
// 3. getMe / updateProfile:
//    Standard protect-middleware flow — uid comes from the verified token
// ─────────────────────────────────────────────────────────────────────────────

// ── POST /api/auth/register ───────────────────────────────────────────────────
// Called AFTER the frontend successfully creates a Firebase Auth user.
// Body: { uid, name, phone, role, district, village?, businessName?, govtIdNumber? }
exports.register = async (req, res, next) => {
  try {
    const {
      uid, name, phone, role = "farmer",
      district, village, businessName, govtIdNumber,
    } = req.body;

    if (!uid || !name || !phone || !district) {
      return res.status(400).json({ success: false, message: "uid, name, phone, and district are required" });
    }
    if (role === "admin") {
      return res.status(403).json({ success: false, message: "Cannot self-register as admin" });
    }

    // Check if a profile already exists for this uid
    const existing = await db.collection(COLLECTIONS.USERS).doc(uid).get();
    if (existing.exists) {
      return res.status(409).json({ success: false, message: "Profile already exists for this account" });
    }

    const profile = {
      uid, name, phone, role,
      district: district || "",
      village:  village  || "",
      businessName:  businessName  || "",
      govtIdNumber:  govtIdNumber  || "",
      isVerified: role === "farmer" || role === "admin", // retailers start unverified
      isActive:   true,
      createdAt:  FieldValue.serverTimestamp(),
      lastLoginAt: FieldValue.serverTimestamp(),
    };

    // Store in Firestore users/{uid}  (uid is the Firebase Auth UID)
    await db.collection(COLLECTIONS.USERS).doc(uid).set(profile);

    // Set custom claims on the Firebase Auth token so the role travels with the token
    await auth.setCustomUserClaims(uid, { role });

    if (role === "retailer") {
      return res.status(201).json({
        success: true,
        message: "Retailer account created. Awaiting admin verification before you can contact farmers.",
      });
    }

    res.status(201).json({ success: true, message: "Account created", profile });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
exports.getMe = async (req, res) => {
  // req.user is populated by the protect middleware from Firestore
  res.json({ success: true, user: req.user });
};

// ── PUT /api/auth/updateprofile ───────────────────────────────────────────────
exports.updateProfile = async (req, res, next) => {
  try {
    const allowed = ["name", "village", "district", "businessName", "location"];
    const updates = { updatedAt: FieldValue.serverTimestamp() };
    allowed.forEach((f) => {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    });

    await db.collection(COLLECTIONS.USERS).doc(req.user.uid).update(updates);

    // Also update displayName in Firebase Auth if name changed
    if (req.body.name) {
      await auth.updateUser(req.user.uid, { displayName: req.body.name });
    }

    const snap = await db.collection(COLLECTIONS.USERS).doc(req.user.uid).get();
    res.json({ success: true, user: { uid: snap.id, ...snap.data() } });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/auth/update-last-login ─────────────────────────────────────────
// Frontend calls this after a successful Firebase login to record the timestamp
exports.updateLastLogin = async (req, res, next) => {
  try {
    await db.collection(COLLECTIONS.USERS).doc(req.user.uid).update({
      lastLoginAt: FieldValue.serverTimestamp(),
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};
