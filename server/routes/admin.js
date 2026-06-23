// routes/admin.js
const express = require("express");
const {
  getStats, getAllUsers, verifyRetailer, toggleUser, getAllListings, getCallLog,
} = require("../controllers/adminController");
const { protect, authorize } = require("../middleware/auth");
const router = express.Router();

router.use(protect, authorize("admin")); // all admin routes locked down

router.get("/stats",                  getStats);
router.get("/users",                  getAllUsers);
router.put("/users/:uid/verify",      verifyRetailer);
router.put("/users/:uid/toggle",      toggleUser);
router.get("/listings",               getAllListings);
router.get("/contacts",               getCallLog);

module.exports = router;
