const Wishlist = require("../models/Wishlist");
const { getMovieDetails } = require("../services/tmdb.service");

// Add movie to wishlist
exports.addToWishlist = async (req, res) => {
	try {
		const { movieId, title, posterUrl, overview, rating, year, genres } = req.body;
		const userId = req.user._id;

		// Check if already in wishlist
		const exists = await Wishlist.findOne({ user: userId, movieId });
		if (exists) {
			return res.status(400).json({
				success: false,
				message: "Movie already in wishlist",
			});
		}

		// Add to wishlist
		const wishlistItem = await Wishlist.create({
			user: userId,
			movieId,
			title,
			posterPath: posterUrl,
			year,
			overview,
			rating,
			genres,
		});

		res.status(201).json({
			success: true,
			data: wishlistItem,
		});
	} catch (error) {
		console.error("Add to wishlist error:", error);
		res.status(500).json({
			success: false,
			error: error.message || "Failed to add to wishlist",
		});
	}
};

// Remove from wishlist
exports.removeFromWishlist = async (req, res) => {
	try {
		const { movieId } = req.body;
		const userId = req.user._id;

		const result = await Wishlist.findOneAndDelete({
			user: userId,
			movieId: Number(movieId),
		});

		if (!result) {
			return res.status(404).json({
				success: false,
				message: "Movie not found in wishlist",
			});
		}

		res.json({
			success: true,
			message: "Removed from wishlist",
		});
	} catch (error) {
		console.error("Remove from wishlist error:", error);
		res.status(500).json({
			success: false,
			error: "Failed to remove from wishlist",
		});
	}
};

// Get user's wishlist
exports.getWishlist = async (req, res) => {
	try {
		const userId = req.user._id;
		const { page = 1, limit = 20 } = req.query;

		const options = {
			page: parseInt(page, 10),
			limit: parseInt(limit, 10),
			sort: { createdAt: -1 },
			lean: true,
		};

		// Using mongoose-paginate-v2
		const result = await Wishlist.paginate({ user: userId }, options);

		res.json({
			success: true,
			data: {
				items: result.docs,
				total: result.totalDocs,
				pages: result.totalPages,
				page: result.page,
				limit: result.limit,
			},
		});
	} catch (error) {
		console.error("Get wishlist error:", error);
		res.status(500).json({
			success: false,
			error: "Failed to fetch wishlist",
		});
	}
};

// Get ONLY wishlist movie IDs for quick "in wishlist" checks
exports.getWishlistIds = async (req, res) => {
	try {
		const userId = req.user._id;

		const wishlistItems = await Wishlist.find(
			{ user: userId },
			{ movieId: 1, _id: 0 }
		).lean();

		const wishlistIds = (wishlistItems || []).map((item) => item.movieId);

		res.json({
			success: true,
			count: wishlistIds.length,
			wishlistIds,
		});
	} catch (error) {
		console.error("Get wishlist IDs error:", error);
		res.status(500).json({
			success: false,
			error: "Failed to fetch wishlist IDs",
		});
	}
};
// Check if movie is in wishlist
exports.checkInWishlist = async (req, res) => {
	try {
		const { movieId } = req.params;
		const userId = req.user._id;

		const exists = await Wishlist.findOne({
			user: userId,
			movieId: Number(movieId),
		});

		res.json({
			success: true,
			inWishlist: !!exists,
		});
	} catch (error) {
		console.error("Check wishlist error:", error);
		res.status(500).json({
			success: false,
			error: "Failed to check wishlist status",
		});
	}
};
