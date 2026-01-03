const express = require("express");
const router = express.Router();
const {
	testPopularMovies,
	testMovieDetails,
	getMovieDetails,
	testEmbedding,
	likeMovie,
	dislikeMovie,
	getRecommendations,
	discoverMovies,
	likedMovies,
	likedMovieIds,
	clearAllLikes,
} = require("../controllers/movieController");

const { protect } = require("../middleware/authMiddleware");

//public routes
router.get("/discover", discoverMovies);
router.get("/details/:id", getMovieDetails);

router.get("/test/popular", testPopularMovies);
router.get("/test/details/:id", testMovieDetails);
router.get("/test/embedding", testEmbedding);

//private routes
router.post("/like", protect, likeMovie);
router.post("/dislike", protect, dislikeMovie);
router.delete("/clear-all-likes", protect, clearAllLikes);
router.get("/recommendations", protect, getRecommendations);
router.get("/likedmovies", protect, likedMovies);
router.get("/likedmovieIds", protect, likedMovieIds);

module.exports = router;
