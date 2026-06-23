// routes/auth.js
const express = require("express");
const { register, getMe, updateProfile, updateLastLogin } = require("../controllers/authController");
const { protect } = require("../middleware/auth");
const router = express.Router();

// Called by frontend AFTER Firebase creates the Auth user
router.post("/register",         register);
router.get("/me",                protect, getMe);
router.put("/updateprofile",     protect, updateProfile);
router.post("/update-last-login",protect, updateLastLogin);

module.exports = router;
