const { db, FieldValue, COLLECTIONS } = require("../config/firebase");
const { validationResult } = require("express-validator");

// Helper: convert a Firestore DocumentSnapshot to a plain object
const docToObj = (snap) => (snap.exists ? { id: snap.id, ...snap.data() } : null);
const snapToDocs = (querySnap) => querySnap.docs.map((d) => ({ id: d.id, ...d.data() }));

// ── GET /api/crops — public browse with filters ───────────────────────────────
exports.getCrops = async (req, res, next) => {
  try {
    const { crop, district, minQty, maxPrice, page = 1, limit = 20 } = req.query;

    // Firestore requires composite indexes for multi-field queries.
    // Base query: always filter by status = active
    let query = db.collection(COLLECTIONS.CROPS).where("status", "==", "active");

    // Equality filters (index-free when combined with status)
    if (district) query = query.where("district", "==", district);
    if (crop)     query = query.where("cropName", "==", crop);

    // Ordering + pagination
    query = query.orderBy("createdAt", "desc").limit(Number(limit));

    const snapshot = await query.get();
    let crops = snapToDocs(snapshot);

    // Client-side filter for range queries (avoids extra composite indexes)
    if (minQty)   crops = crops.filter((c) => c.quantity >= Number(minQty));
    if (maxPrice) crops = crops.filter((c) => !c.pricePerUnit || c.pricePerUnit <= Number(maxPrice));

    // Determine if the requesting user can see phone numbers
    const isVerifiedRetailer = req.user?.role === "retailer" && req.user?.isVerified;
    const isAdmin = req.user?.role === "admin";

    const safeCrops = crops.map((c) => {
      if (!isVerifiedRetailer && !isAdmin) {
        return { ...c, farmerPhone: "Verified retailers only" };
      }
      return c;
    });

    res.json({ success: true, total: safeCrops.length, crops: safeCrops });
  } catch (err) {
    // Firestore throws a 9 FAILED_PRECONDITION error when a needed index is missing
    if (err.code === 9) {
      return res.status(500).json({
        success: false,
        message: "A Firestore composite index is missing. Check server logs for the index creation URL.",
        details: err.message,
      });
    }
    next(err);
  }
};

// ── GET /api/crops/:id ────────────────────────────────────────────────────────
exports.getCrop = async (req, res, next) => {
  try {
    const snap = await db.collection(COLLECTIONS.CROPS).doc(req.params.id).get();
    if (!snap.exists) return res.status(404).json({ success: false, message: "Listing not found" });

    // Increment view count atomically
    await snap.ref.update({ viewCount: FieldValue.increment(1) });

    res.json({ success: true, crop: docToObj(snap) });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/crops — farmer only ────────────────────────────────────────────
exports.createCrop = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const {
      cropName, quantity, unit = "Quintal",
      pricePerUnit, village, district, variety, notes,
      location, // { lat, lng } from frontend geolocation
    } = req.body;

    // Fetch farmer name + phone from their Firestore profile
    const farmerSnap = await db.collection(COLLECTIONS.USERS).doc(req.user.uid).get();
    const farmer = farmerSnap.data();

    const cropData = {
      farmerUid:    req.user.uid,
      farmerName:   farmer.name,
      farmerPhone:  farmer.phone,
      cropName, quantity: Number(quantity), unit,
      pricePerUnit: pricePerUnit ? Number(pricePerUnit) : null,
      village:  village  || "",
      district: district || "",
      variety:  variety  || "",
      notes:    notes    || "",
      location: location || null,  // { lat, lng }
      status:      "active",
      viewCount:   0,
      contactCount: 0,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const ref = await db.collection(COLLECTIONS.CROPS).add(cropData);

    // Real-time broadcast to all connected Socket.io clients
    req.io.emit("newListing", { id: ref.id, cropName, district, quantity, unit });

    res.status(201).json({ success: true, crop: { id: ref.id, ...cropData } });
  } catch (err) {
    next(err);
  }
};

// ── PUT /api/crops/:id — farmer who owns it or admin ─────────────────────────
exports.updateCrop = async (req, res, next) => {
  try {
    const snap = await db.collection(COLLECTIONS.CROPS).doc(req.params.id).get();
    if (!snap.exists) return res.status(404).json({ success: false, message: "Listing not found" });

    const crop = snap.data();
    if (crop.farmerUid !== req.user.uid && req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Not authorised to edit this listing" });
    }

    const allowed = ["cropName", "quantity", "unit", "pricePerUnit", "village", "district", "variety", "notes", "status"];
    const updates = { updatedAt: FieldValue.serverTimestamp() };
    allowed.forEach((f) => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    await snap.ref.update(updates);
    res.json({ success: true, crop: { id: snap.id, ...crop, ...updates } });
  } catch (err) {
    next(err);
  }
};

// ── DELETE /api/crops/:id — farmer or admin ───────────────────────────────────
exports.deleteCrop = async (req, res, next) => {
  try {
    const snap = await db.collection(COLLECTIONS.CROPS).doc(req.params.id).get();
    if (!snap.exists) return res.status(404).json({ success: false, message: "Listing not found" });

    if (snap.data().farmerUid !== req.user.uid && req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Not authorised" });
    }

    await snap.ref.delete();
    res.json({ success: true, message: "Listing removed" });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/crops/farmer/my — farmer's own listings ────────────────────────
exports.myListings = async (req, res, next) => {
  try {
    const snapshot = await db
      .collection(COLLECTIONS.CROPS)
      .where("farmerUid", "==", req.user.uid)
      .orderBy("createdAt", "desc")
      .get();

    res.json({ success: true, count: snapshot.size, crops: snapToDocs(snapshot) });
  } catch (err) {
    next(err);
  }
};
