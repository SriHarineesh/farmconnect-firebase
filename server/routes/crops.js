// routes/crops.js
const express = require("express");
const { body } = require("express-validator");
const {
  getCrops, getCrop, createCrop, updateCrop, deleteCrop, myListings,
} = require("../controllers/cropsController");
const { protect, authorize } = require("../middleware/auth");
const router = express.Router();

router.get("/",            getCrops);          // public
router.get("/farmer/my",   protect, authorize("farmer"), myListings);
router.get("/:id",         getCrop);           // public
router.post("/", protect, authorize("farmer"), [
  body("cropName").trim().notEmpty().withMessage("Crop name required"),
  body("quantity").isFloat({ min: 0.1 }).withMessage("Valid quantity required"),
  body("district").trim().notEmpty().withMessage("District required"),
], createCrop);
router.put("/:id",    protect, authorize("farmer", "admin"), updateCrop);
router.delete("/:id", protect, authorize("farmer", "admin"), deleteCrop);

module.exports = router;
