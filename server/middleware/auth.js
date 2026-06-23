const { auth, db, COLLECTIONS } = require("../config/firebase");

// ─── protect: verify Firebase ID token sent in Authorization header ───────────
// Frontend calls firebase.auth().currentUser.getIdToken() and sends:
//   Authorization: Bearer <idToken>
exports.protect = async (req, res, next) => {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Not authorised — please log in" });
  }

  const idToken = header.split("Bearer ")[1];

  try {
    // Verify the token with Firebase Admin — this also checks expiry
    const decoded = await auth.verifyIdToken(idToken);

    // Load the user's Firestore profile (contains role, isVerified, etc.)
    const snap = await db.collection(COLLECTIONS.USERS).doc(decoded.uid).get();
    if (!snap.exists) {
      return res.status(401).json({ success: false, message: "User profile not found — please re-register" });
    }

    const profile = snap.data();
    if (!profile.isActive) {
      return res.status(403).json({ success: false, message: "Account deactivated — contact admin" });
    }

    // Attach uid + profile to request for downstream controllers
    req.user = { uid: decoded.uid, ...profile };
    next();
  } catch (err) {
    console.error("Token verification failed:", err.code);
    return res.status(401).json({ success: false, message: "Invalid or expired session — please log in again" });
  }
};

// ─── authorize: restrict to specific roles ────────────────────────────────────
// Usage:  router.delete("/crop/:id", protect, authorize("farmer","admin"), handler)
exports.authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: `Role '${req.user.role}' is not allowed to access this route`,
    });
  }
  next();
};

// ─── verifiedRetailer: retailer AND admin-approved ────────────────────────────
exports.verifiedRetailer = (req, res, next) => {
  if (req.user.role !== "retailer") {
    return res.status(403).json({ success: false, message: "Retailers only" });
  }
  if (!req.user.isVerified) {
    return res.status(403).json({
      success: false,
      message: "Your account is pending admin approval. You will be notified once verified.",
    });
  }
  next();
};
