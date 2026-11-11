const { createHash, randomBytes } = require("crypto");
const {
	getPopularMovies,
	getFullMovieData,
	getMovieDetails,
	getMovieTrailer,
	getMovieOttProviders,
	discoverMovies: tmdbDiscover,
} = require("../services/tmdb.service");
const { getMoviesLike } = require("../services/movieService");
const { generateEmbedding } = require("../services/embedding.service");
const User = require("../models/User");
const Wishlist = require("../models/Wishlist");
const LikedMovie = require("../models/LikedMovie");
const GuestSession = require("../models/GuestSession");
const { searchSimilarMovies } = require("../services/vector.service");
const { getOrCreateMovieVector } = require("../services/movieVector.service");
const { promisePool } = require("../utils/common.util");
const { averageVectors } = require("../utils/vector.util");
const processMovieVector = require("../jobs/processMovieVector");
const rebuildUserVector = require("../jobs/rebuildUserVector");

const GUEST_LIKE_LIMIT = 10;
const GUEST_SESSION_MAX_AGE = 24 * 60 * 60 * 1000;
const GUEST_SESSION_COOKIE = "guest_session";

const hashGuestToken = (token) => createHash("sha256").update(token).digest("hex");

const getGuestSession = async (req, res) => {
	let token = req.cookies?.[GUEST_SESSION_COOKIE];
	if (token && /^[a-f0-9]{64}$/.test(token)) {
		const existing = await GuestSession.findOne({ sessionHash: hashGuestToken(token) });
		if (existing && existing.expiresAt <= new Date()) {
			token = null;
		}
	}
	if (!token || !/^[a-f0-9]{64}$/.test(token)) {
		token = randomBytes(32).toString("hex");
	}

	const session = await GuestSession.findOneAndUpdate(
		{ sessionHash: hashGuestToken(token) },
		{
			$setOnInsert: {
				likes: [],
				expiresAt: new Date(Date.now() + GUEST_SESSION_MAX_AGE),
			},
		},
		{ new: true, upsert: true, setDefaultsOnInsert: true },
	);

	res.cookie(GUEST_SESSION_COOKIE, token, {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		path: "/",
		maxAge: Math.max(session.expiresAt.getTime() - Date.now(), 0),
	});

	return session;
};

const validateGuestMovie = (body) => {
	const movieId = Number(body.movieId);
	if (!Number.isSafeInteger(movieId) || movieId <= 0 || typeof body.title !== "string" || !body.title.trim()) {
		return null;
	}

	return {
		movieId,
		title: body.title.trim().slice(0, 300),
		posterPath: typeof body.posterUrl === "string" ? body.posterUrl.slice(0, 500) : "",
		year: body.year == null ? "" : String(body.year).slice(0, 20),
		overview: typeof body.overview === "string" ? body.overview.slice(0, 5000) : "",
		rating: body.rating != null && Number.isFinite(Number(body.rating)) ? Number(body.rating) : undefined,
	};
};

exports.guestLikedMovies = async (req, res) => {
	try {
		const session = await getGuestSession(req, res);
		const results = [...session.likes].reverse();
		return res.json({
			success: true,
			count: results.length,
			limit: GUEST_LIKE_LIMIT,
			likedMovieIds: results.map((movie) => movie.movieId),
			results,
		});
	} catch (error) {
		console.error("guestLikedMovies error:", error);
		return res.status(500).json({ success: false, error: "Failed to fetch guest likes" });
	}
};

exports.guestLikeMovie = async (req, res) => {
	try {
		const movie = validateGuestMovie(req.body || {});
		if (!movie) {
			return res.status(400).json({ success: false, error: "A valid movie ID and title are required" });
		}

		const session = await getGuestSession(req, res);
		const updated = await GuestSession.findOneAndUpdate(
			{
				_id: session._id,
				"likes.movieId": { $ne: movie.movieId },
				$expr: { $lt: [{ $size: "$likes" }, GUEST_LIKE_LIMIT] },
			},
			{ $push: { likes: movie } },
			{ new: true, runValidators: true },
		);

		if (updated) {
			return res.status(201).json({
				success: true,
				count: updated.likes.length,
				limit: GUEST_LIKE_LIMIT,
				likedMovieIds: updated.likes.map((likedMovie) => likedMovie.movieId),
			});
		}

		const current = await GuestSession.findById(session._id);
		if (!current) {
			return res.status(409).json({ success: false, error: "Guest session expired. Refresh and try again." });
		}

		if (current.likes.some((likedMovie) => likedMovie.movieId === movie.movieId)) {
			return res.json({
				success: true,
				count: current.likes.length,
				limit: GUEST_LIKE_LIMIT,
				likedMovieIds: current.likes.map((likedMovie) => likedMovie.movieId),
			});
		}

		return res.status(429).json({
			success: false,
			error: `Guests can like up to ${GUEST_LIKE_LIMIT} movies. Sign in to like more.`,
			count: current.likes.length,
			limit: GUEST_LIKE_LIMIT,
		});
	} catch (error) {
		console.error("guestLikeMovie error:", error);
		return res.status(500).json({ success: false, error: "Failed to like movie" });
	}
};

exports.guestDislikeMovie = async (req, res) => {
	try {
		const movieId = Number(req.body?.movieId);
		if (!Number.isSafeInteger(movieId) || movieId <= 0) {
			return res.status(400).json({ success: false, error: "A valid movie ID is required" });
		}

		const session = await getGuestSession(req, res);
		const updated = await GuestSession.findByIdAndUpdate(
			session._id,
			{ $pull: { likes: { movieId } } },
			{ new: true },
		);

		return res.json({
			success: true,
			count: updated.likes.length,
			limit: GUEST_LIKE_LIMIT,
			likedMovieIds: updated.likes.map((movie) => movie.movieId),
		});
	} catch (error) {
		console.error("guestDislikeMovie error:", error);
		return res.status(500).json({ success: false, error: "Failed to remove guest like" });
	}
};

exports.clearGuestLikes = async (req, res) => {
	try {
		const session = await getGuestSession(req, res);
		session.likes = [];
		await session.save();
		return res.json({ success: true, count: 0, limit: GUEST_LIKE_LIMIT, likedMovieIds: [] });
	} catch (error) {
		console.error("clearGuestLikes error:", error);
		return res.status(500).json({ success: false, error: "Failed to clear guest likes" });
	}
};

exports.getGuestRecommendations = async (req, res) => {
	try {
		const token = req.cookies?.[GUEST_SESSION_COOKIE];
		if (!token || !/^[a-f0-9]{64}$/.test(token)) {
			return res.json({ success: true, page: 1, total_pages: 0, total_results: 0, results: [] });
		}

		const session = await GuestSession.findOne({
			sessionHash: hashGuestToken(token),
			expiresAt: { $gt: new Date() },
		});
		if (!session?.likes.length) {
			return res.json({ success: true, page: 1, total_pages: 0, total_results: 0, results: [] });
		}

		const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
		if (page > 2) {
			return res.status(403).json({
				success: false,
				error: "Guests can view up to 2 pages of recommendations. Sign in to see more.",
				guest_limit_reached: true,
				limit_pages: 2,
			});
		}
		const languages = req.query.languages ? req.query.languages.split(",").filter(Boolean) : [];
		const genres = req.query.genres ? req.query.genres.split(",").filter(Boolean) : [];
		const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 40, 1), 40);
		const vectors = (
			await promisePool(session.likes, 3, async ({ movieId }) => getOrCreateMovieVector(movieId))
		).filter(Boolean);

		if (!vectors.length) {
			return res.json({ success: true, page, total_pages: 0, total_results: 0, results: [] });
		}

		const likedIds = session.likes.map((movie) => movie.movieId);
		const results = await searchSimilarMovies(averageVectors(vectors), 500, likedIds, { languages, genres });
		const totalResults = results.length;
		const availablePages = totalResults === 0 ? 0 : Math.ceil(totalResults / limit);
		const totalPages = Math.min(availablePages, 2);
		const pageItems = results.slice((page - 1) * limit, page * limit);
		const recommendations = (
			await promisePool(pageItems, 5, async (result) => {
				try {
					return { ...(await getMovieDetails(result.movieId)), score: result.score };
				} catch (error) {
					console.error(`Failed to fetch TMDB details for movie ${result.movieId}:`, error.message);
					return null;
				}
			})
		).filter(Boolean);

		return res.json({
			success: true,
			page,
			total_pages: totalPages,
			total_results: totalResults,
			guest_limit_reached: availablePages > 2 && page === 2,
			results: recommendations,
		});
	} catch (error) {
		console.error("getGuestRecommendations error:", error);
		return res.status(500).json({ success: false, error: "Failed to generate guest recommendations" });
	}
};

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
	try {
		const movieId = req.params.id;
		const includeTrailer = req.query.include_trailer === "true" || req.query.include_trailer === "1";
		const includeProviders = req.query.include_providers === "true" || req.query.include_providers === "1";

		// Get basic movie details
		const movie = await getMovieDetails(movieId);

		// Add trailer if requested
		if (includeTrailer) {
			try {
				const trailer = await getMovieTrailer(movieId);
				movie.trailer = trailer;
			} catch (trailerError) {
				console.warn(`Failed to fetch trailer for movie ${movieId}:`, trailerError.message);
				movie.trailer = null; // Don't fail the whole request if trailer fetch fails
			}
		}

		// Add OTT providers if requested
		if (includeProviders) {
			try {
				const providers = await getMovieOttProviders(movieId);
				movie.ott_providers = providers;
			} catch (providersError) {
				console.warn(`Failed to fetch OTT providers for movie ${movieId}:`, providersError.message);
				movie.ott_providers = {
					stream: [],
					rent: [],
					buy: [],
					hasAny: false,
				}; // Don't fail the whole request if providers fetch fails
			}
		}

		res.json(movie);
	} catch (error) {
		console.error("Error in getMovieDetails:", error);
		if (error.message.includes("not found")) {
			return res.status(404).json({
				success: false,
				error: "Movie not found",
			});
		}
		res.status(500).json({
			success: false,
			error: error.message || "Failed to fetch movie details",
		});
	}
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
			},
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

exports.clearAllLikes = async (req, res) => {
	try {
		const userId = req.user._id;

		// Delete all liked movies for the user
		const result = await LikedMovie.deleteMany({ user: userId });

		// Clear user vector since there are no more likes
		await User.findByIdAndUpdate(userId, {
			$unset: { userVector: 1 },
		});

		// Respond immediately
		res.json({
			success: true,
			message: "All liked movies cleared",
			deletedCount: result.deletedCount,
		});
	} catch (error) {
		console.error("clearAllLikes error:", error);
		res.status(500).json({
			success: false,
			error: error.message || "Failed to clear liked movies",
		});
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

// SEO-friendly endpoint to get movie and similar movies by slug
// Public route, no authentication required
exports.getMoviesLike = async (req, res) => {
	try {
		const { slug } = req.params;
		const useVector = req.query.use_vector !== "false"; // Default to true

		// Validate slug
		if (!slug || slug.trim() === "") {
			return res.status(400).json({
				success: false,
				error: "Slug is required",
			});
		}

		// Get movie and similar movies
		const result = await getMoviesLike(slug, useVector);

		// Handle movie not found
		if (!result.movie) {
			return res.status(404).json({
				success: false,
				error: "Movie not found",
				slug,
			});
		}

		res.json({
			success: true,
			movie: result.movie,
			similarMovies: result.similarMovies,
			count: result.similarMovies.length,
		});
	} catch (error) {
		console.error("Error in getMoviesLike:", error);

		// Handle specific error cases
		if (error.message.includes("TMDB API error")) {
			return res.status(502).json({
				success: false,
				error: "External API error",
				details: error.message,
			});
		}

		if (error.message.includes("Failed to connect")) {
			return res.status(503).json({
				success: false,
				error: "Service unavailable",
				details: error.message,
			});
		}

		res.status(500).json({
			success: false,
			error: "Internal server error",
			details: error.message,
		});
	}
};
