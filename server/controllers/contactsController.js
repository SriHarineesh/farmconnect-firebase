const { db, FieldValue, COLLECTIONS } = require("../config/firebase");

const snapToDocs = (qs) => qs.docs.map((d) => ({ id: d.id, ...d.data() }));

// ── POST /api/contacts/reveal/:cropId — verified retailer views farmer phone ──
exports.revealPhone = async (req, res, next) => {
  try {
    const cropSnap = await db.collection(COLLECTIONS.CROPS).doc(req.params.cropId).get();
    if (!cropSnap.exists) return res.status(404).json({ success: false, message: "Listing not found" });

    const crop = cropSnap.data();

    // Log the phone-reveal interaction to Firestore
    await db.collection(COLLECTIONS.CONTACTS).add({
      type:        "phone_reveal",
      retailerUid: req.user.uid,
      retailerName: req.user.name,
      farmerUid:   crop.farmerUid,
      farmerName:  crop.farmerName,
      cropId:      req.params.cropId,
      cropName:    crop.cropName,
      status:      "completed",
      message:     "",
      createdAt:   FieldValue.serverTimestamp(),
    });

    // Increment the listing's contact counter atomically
    await cropSnap.ref.update({ contactCount: FieldValue.increment(1) });

    // Real-time push notification to the farmer's browser via Socket.io
    req.io.to(`user_${crop.farmerUid}`).emit("contactAlert", {
      message: `A verified dealer just viewed your contact for ${crop.cropName}`,
      retailer: req.user.name,
    });

    res.json({ success: true, phone: crop.farmerPhone });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/contacts/interest/:cropId — retailer sends interest request ─────
exports.sendInterest = async (req, res, next) => {
  try {
    const { message = "" } = req.body;
    const cropSnap = await db.collection(COLLECTIONS.CROPS).doc(req.params.cropId).get();
    if (!cropSnap.exists) return res.status(404).json({ success: false, message: "Listing not found" });

    const crop = cropSnap.data();

    // Prevent duplicate pending requests
    const dupSnap = await db
      .collection(COLLECTIONS.CONTACTS)
      .where("type",        "==", "interest_sent")
      .where("retailerUid", "==", req.user.uid)
      .where("cropId",      "==", req.params.cropId)
      .where("status",      "==", "pending")
      .limit(1)
      .get();

    if (!dupSnap.empty) {
      return res.status(400).json({
        success: false,
        message: "You already have a pending request for this listing",
      });
    }

    const ref = await db.collection(COLLECTIONS.CONTACTS).add({
      type:         "interest_sent",
      retailerUid:  req.user.uid,
      retailerName: req.user.name,
      retailerPhone: req.user.phone,
      retailerBusiness: req.user.businessName || "",
      farmerUid:    crop.farmerUid,
      farmerName:   crop.farmerName,
      cropId:       req.params.cropId,
      cropName:     crop.cropName,
      status:       "pending",
      message,
      createdAt:    FieldValue.serverTimestamp(),
    });

    // Real-time notification to farmer
    req.io.to(`user_${crop.farmerUid}`).emit("newInterestRequest", {
      from:    req.user.name,
      crop:    crop.cropName,
      message: message || "A dealer is interested in your crop.",
    });

    res.status(201).json({ success: true, contactId: ref.id });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/contacts/mycontacts — farmer sees all requests on their crops ────
exports.myContacts = async (req, res, next) => {
  try {
    const snapshot = await db
      .collection(COLLECTIONS.CONTACTS)
      .where("farmerUid", "==", req.user.uid)
      .orderBy("createdAt", "desc")
      .get();

    res.json({ success: true, count: snapshot.size, contacts: snapToDocs(snapshot) });
  } catch (err) {
    next(err);
  }
};

// ── PUT /api/contacts/:id/respond — farmer accepts or declines a request ──────
exports.respondToRequest = async (req, res, next) => {
  try {
    const { status } = req.body; // "accepted" or "declined"
    if (!["accepted", "declined"].includes(status)) {
      return res.status(400).json({ success: false, message: "Status must be 'accepted' or 'declined'" });
    }

    const snap = await db.collection(COLLECTIONS.CONTACTS).doc(req.params.id).get();
    if (!snap.exists) return res.status(404).json({ success: false, message: "Request not found" });
    if (snap.data().farmerUid !== req.user.uid) {
      return res.status(403).json({ success: false, message: "Not authorised" });
    }

    await snap.ref.update({ status, respondedAt: FieldValue.serverTimestamp() });

    // Notify the retailer of the farmer's decision
    req.io.to(`user_${snap.data().retailerUid}`).emit("requestResponse", {
      status,
      cropName: snap.data().cropName,
    });

    res.json({ success: true, status });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/contacts/my-interests — retailer sees their own sent requests ────
exports.myInterests = async (req, res, next) => {
  try {
    const snapshot = await db
      .collection(COLLECTIONS.CONTACTS)
      .where("retailerUid", "==", req.user.uid)
      .orderBy("createdAt", "desc")
      .get();

    res.json({ success: true, count: snapshot.size, contacts: snapToDocs(snapshot) });
  } catch (err) {
    next(err);
  }
};
