// routes/contacts.js
const express = require("express");
const {
  revealPhone, sendInterest, myContacts, respondToRequest, myInterests,
} = require("../controllers/contactsController");
const { protect, verifiedRetailer } = require("../middleware/auth");
const router = express.Router();

router.use(protect); // all contact routes require login

router.post("/reveal/:cropId",    verifiedRetailer, revealPhone);
router.post("/interest/:cropId",  verifiedRetailer, sendInterest);
router.get("/mycontacts",                           myContacts);
router.get("/my-interests",                         myInterests);
router.put("/:id/respond",                          respondToRequest);

module.exports = router;
