const express = require("express");
const router = express.Router();
const { submitContact } = require("../controllers/contactController");

// Public route - submit contact form
router.post("/", submitContact);

module.exports = router;
