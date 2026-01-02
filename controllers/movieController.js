const {
	getPopularMovies,
	getFullMovieData,
	getMovieDetails,
	discoverMovies: tmdbDiscover,
} = require("../services/tmdb.service");
const { generateEmbedding } = require("../services/embedding.service");
const User = require("../models/User");
const Wishlist = require("../models/Wishlist");
const LikedMovie = require("../models/LikedMovie");
const { searchSimilarMovies } = require("../services/vector.service");
const { promisePool } = require("../utils/common.util");
const processMovieVector = require("../jobs/processMovieVector");
const rebuildUserVector = require("../jobs/rebuildUserVector");

exports.testPopularMovies = async (req, res) => {
	const movies = await getPopularMovies();
	res.json(movies.slice(0, 5));
};

exports.testMovieDetails = async (req, res) => {
	const movieId = req.params.id;
	const movie = await getFullMovieData(movieId);
	res.json(movie);
};
exports.getMovieDetails = async (req, res) => {
	const movieId = req.params.id;
	const movie = await getMovieDetails(movieId);
	res.json(movie);
};

exports.testEmbedding = async (req, res) => {
	try {
		const vector = await generateEmbedding("A dark psychological thriller about obsession");
		res.json({
			vectorLength: vector.length,
			sample: vector.slice(0, 5),
		});
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
};

exports.likeMovie = async (req, res) => {
	try {
		const userId = req.user._id;
		const { movieId, title, posterUrl, overview, rating, year } = req.body;

		// Prevent duplicates in liked collection
		const existing = await LikedMovie.findOne({ user: userId, movieId });
		if (existing) {
			return res.status(400).json({
				success: false,
				message: "Movie already liked",
			});
		}

		// Store like with embedded vector (or empty array if vector generation failed)
		const liked = await LikedMovie.create({
			user: userId,
			movieId,
			title,
			posterPath: posterUrl,
			year,
			overview,
			rating,
		});

		// Instant response
		res.status(201).json({
			success: true,
			message: "Movie liked",
			data: liked,
		});

		// Async vector processing
		setImmediate(() => {
			processMovieVector(userId, movieId).catch(console.error);
		});
	} catch (error) {
		console.error("likeMovie error:", error);
		res.status(500).json({
			success: false,
			error: error.message || "Failed to like movie",
		});
	}
};

exports.dislikeMovie = async (req, res) => {
	try {
		const userId = req.user._id;
		const { movieId } = req.body;

		const removed = await LikedMovie.findOneAndDelete({
			user: userId,
			movieId,
		});

		if (!removed) {
			return res.status(404).json({
				success: false,
				message: "Movie not found in liked list",
			});
		}

		// Respond immediately
		res.json({
			success: true,
			message: "Movie disliked",
		});
		// Async rebuild (rare operation)
		setImmediate(() => {
			rebuildUserVector(userId).catch(console.error);
		});
	} catch (error) {
		console.error("dislikeMovie error:", error);
		res.status(500).json({
			success: false,
			error: error.message || "Failed to dislike movie",
		});
	}
};

exports.getPopularMovies = async (req, res) => {
	try {
		const page = parseInt(req.query.page) || 1; // Get page from query string, default to 1
		const movies = await getPopularMovies(page);
		res.json(movies.slice(0, 20));
	} catch (error) {
		console.error("Error in getPopularMovies:", error);
		return res.status(500).json({ error: error.message });
	}
};

exports.getRecommendations = async (req, res) => {
	try {
		const userId = req.user._id;

		const user = await User.findById(userId);
		const page = parseInt(req.query.page, 10) || 1;
		const languages = req.query.languages ? req.query.languages.split(",") : [];
		const genres = req.query.genres ? req.query.genres.split(",") : [];
		const limit = Math.min(parseInt(req.query.limit, 10) || 40, 40); // safety cap

		// 1️⃣ Cold start handling
		if (!user || !user.userVector || user.userVector.length === 0) {
			return res.json({
				message: "No preferences yet",
				page,
				total_pages: 0,
				total_results: 0,
				results: [],
			});
		}
		const watchlist = await Wishlist.find({ user: userId }, { movieId: 1, _id: 0 });
		const watchlistSet = new Set(watchlist.map((m) => m.movieId));
		const likedMovies = await LikedMovie.find({ user: userId }, { movieId: 1, _id: 0 });
		const likedSet = new Set(likedMovies.map((m) => m.movieId));
		// 2️⃣ Get similar movies from Qdrant
		const results = await searchSimilarMovies(user.userVector, 500, [...watchlistSet, ...likedSet], {
			languages,
			genres,
		});

		const totalResults = results.length;
		const totalPages = totalResults === 0 ? 0 : Math.ceil(totalResults / limit);
		const startIndex = (page - 1) * limit;
		const pageItems = results.slice(startIndex, startIndex + limit);

		// 5️⃣ Enrich with TMDB movie details (similar shape to discover results)
		const recommendations = (
			await promisePool(pageItems, 5, async (r) => {
				try {
					const details = await getMovieDetails(r.movieId);
					return {
						...details,
						score: r.score,
					};
				} catch (err) {
					console.error(`Failed to fetch TMDB details for movie ${r.movieId}:`, err.message);
					return null;
				}
			})
		).filter(Boolean);

		res.json({
			success: true,
			page,
			total_pages: totalPages,
			total_results: totalResults,
			results: recommendations,
		});
	} catch (error) {
		console.error("getRecommendations error:", error);
		res.status(500).json({ error: error.message });
	}
};

exports.discoverMovies = async (req, res) => {
	try {
		// Get query parameters with defaults
		const {
			page = 1,
			languages,
			search = "",
			sortBy = "popularity.desc",
			voteAverageGte,
			voteCountGte,
			withGenres,
			year,
		} = req.query;

		// Convert to appropriate types
		const options = {
			page: parseInt(page, 10),
			search: search.toString(),
			sortBy,
			voteAverageGte: voteAverageGte ? parseFloat(voteAverageGte) : undefined,
			voteCountGte: voteCountGte ? parseInt(voteCountGte, 10) : undefined,
			withGenres: withGenres ? withGenres.toString() : undefined,
			year: year ? parseInt(year, 10) : undefined,
		};
		if (languages) {
			options.languages = languages;
		}

		const result = await tmdbDiscover(options);

		res.json({
			success: true,
			page: result.page,
			total_pages: result.total_pages,
			total_results: result.total_results,
			results: result.results,
		});
	} catch (error) {
		console.error("Discover movies error:", error);
		res.status(500).json({
			success: false,
			error: error.message || "Failed to fetch movies",
		});
	}
};

// Returns the authenticated user's liked movies from the LikedMovie collection
// Expects protect middleware to set req.user._id
exports.likedMovies = async (req, res) => {
	try {
		const userId = req.user._id;
		const page = parseInt(req.query.page, 10) || 1;
		const limit = Math.min(parseInt(req.query.limit, 10) || 20, 20); // safety cap at 20

		// Paginate liked movies with full stored details
		const result = await LikedMovie.paginate(
			{ user: userId },
			{
				page,
				limit,
				sort: { createdAt: -1 },
				lean: true,
			}
		);

		return res.json({
			success: true,
			page: result.page,
			total_pages: result.totalPages,
			total_results: result.totalDocs,
			results: result.docs || [], // full movie details from LikedMovie documents
		});
	} catch (error) {
		console.error("likedMovies error:", error);
		return res.status(500).json({ message: "Server error", error: error.message });
	}
};

// Returns ONLY all liked movie IDs for the authenticated user
// Useful for quickly checking "is liked" status on arbitrary movie lists
exports.likedMovieIds = async (req, res) => {
	try {
		const userId = req.user._id;

		const liked = await LikedMovie.find({ user: userId }, { movieId: 1, _id: 0 }).lean();
		const likedMovieIds = (liked || []).map((m) => m.movieId);

		return res.json({
			success: true,
			count: likedMovieIds.length,
			likedMovieIds,
		});
	} catch (error) {
		console.error("likedMovieIds error:", error);
		return res.status(500).json({ message: "Server error", error: error.message });
	}
};
