const { auth, db, FieldValue, COLLECTIONS } = require("../config/firebase");

const snapToDocs = (qs) => qs.docs.map((d) => ({ id: d.id, ...d.data() }));

// ── GET /api/admin/stats ──────────────────────────────────────────────────────
exports.getStats = async (req, res, next) => {
  try {
    // Run all count queries in parallel with Promise.all
    const [usersSnap, cropsSnap, contactsSnap, pendingRetailersSnap, activeListingsSnap] =
      await Promise.all([
        db.collection(COLLECTIONS.USERS).get(),
        db.collection(COLLECTIONS.CROPS).get(),
        db.collection(COLLECTIONS.CONTACTS).get(),
        db.collection(COLLECTIONS.USERS).where("role", "==", "retailer").where("isVerified", "==", false).get(),
        db.collection(COLLECTIONS.CROPS).where("status", "==", "active").get(),
      ]);

    const users = snapToDocs(usersSnap);
    const stats = {
      totalUsers:        users.length,
      totalFarmers:      users.filter((u) => u.role === "farmer").length,
      totalRetailers:    users.filter((u) => u.role === "retailer").length,
      verifiedRetailers: users.filter((u) => u.role === "retailer" && u.isVerified).length,
      pendingRetailers:  pendingRetailersSnap.size,
      totalListings:     cropsSnap.size,
      activeListings:    activeListingsSnap.size,
      totalContacts:     contactsSnap.size,
    };

    res.json({ success: true, stats });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/admin/users?role=&verified= ─────────────────────────────────────
exports.getAllUsers = async (req, res, next) => {
  try {
    const { role, verified } = req.query;
    let query = db.collection(COLLECTIONS.USERS).orderBy("createdAt", "desc");

    if (role)               query = query.where("role", "==", role);
    if (verified !== undefined)
      query = query.where("isVerified", "==", verified === "true");

    const snapshot = await query.get();
    res.json({ success: true, total: snapshot.size, users: snapToDocs(snapshot) });
  } catch (err) {
    next(err);
  }
};

// ── PUT /api/admin/users/:uid/verify — approve or reject a retailer ───────────
exports.verifyRetailer = async (req, res, next) => {
  try {
    const { approve } = req.body;
    const uid = req.params.uid;

    const snap = await db.collection(COLLECTIONS.USERS).doc(uid).get();
    if (!snap.exists) return res.status(404).json({ success: false, message: "User not found" });
    if (snap.data().role !== "retailer") {
      return res.status(400).json({ success: false, message: "User is not a retailer" });
    }

    await snap.ref.update({
      isVerified:  !!approve,
      verifiedAt:  approve ? FieldValue.serverTimestamp() : null,
      verifiedBy:  approve ? req.user.uid : null,
      updatedAt:   FieldValue.serverTimestamp(),
    });

    // Push real-time notification to the retailer
    req.io.to(`user_${uid}`).emit("verificationUpdate", {
      approved: !!approve,
      message: approve
        ? "Your account has been approved! You can now contact farmers."
        : "Your application was not approved. Please contact admin.",
    });

    res.json({ success: true, message: `Retailer ${approve ? "approved" : "rejected"}` });
  } catch (err) {
    next(err);
  }
};

// ── PUT /api/admin/users/:uid/toggle — activate or deactivate an account ──────
exports.toggleUser = async (req, res, next) => {
  try {
    const snap = await db.collection(COLLECTIONS.USERS).doc(req.params.uid).get();
    if (!snap.exists) return res.status(404).json({ success: false, message: "User not found" });

    const newStatus = !snap.data().isActive;
    await snap.ref.update({ isActive: newStatus, updatedAt: FieldValue.serverTimestamp() });

    // Also disable/enable in Firebase Auth
    await auth.updateUser(req.params.uid, { disabled: !newStatus });

    res.json({ success: true, isActive: newStatus });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/admin/listings ───────────────────────────────────────────────────
exports.getAllListings = async (req, res, next) => {
  try {
    const { status } = req.query;
    let query = db.collection(COLLECTIONS.CROPS).orderBy("createdAt", "desc");
    if (status) query = query.where("status", "==", status);

    const snapshot = await query.get();
    res.json({ success: true, total: snapshot.size, crops: snapToDocs(snapshot) });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/admin/contacts — full interaction/call log ───────────────────────
exports.getCallLog = async (req, res, next) => {
  try {
    const { type } = req.query;
    let query = db.collection(COLLECTIONS.CONTACTS).orderBy("createdAt", "desc").limit(200);
    if (type) query = query.where("type", "==", type);

    const snapshot = await query.get();
    res.json({ success: true, total: snapshot.size, contacts: snapToDocs(snapshot) });
  } catch (err) {
    next(err);
  }
};
