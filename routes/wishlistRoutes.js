const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const {
	getWishlist,
	addToWishlist,
	removeFromWishlist,
	checkInWishlist,
	getWishlistIds,
} = require("../controllers/wishlistController");

// All routes are protected and require authentication

router.get("/", protect, getWishlist);
router.get("/ids", protect, getWishlistIds);

router.post("/add", protect, addToWishlist);
router.delete("/delete", protect, removeFromWishlist);

router.get("/check/:movieId", protect, checkInWishlist);

module.exports = router;
