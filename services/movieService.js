const {
	searchMovieByName,
	getMovieDetails,
	getSimilarMovies: tmdbGetSimilarMovies,
} = require("./tmdb.service");
const { getMovieVectorById, searchSimilarMovies } = require("./vector.service");

/**
 * Convert slug to movie name
 * Slugs are typically lowercase with hyphens: "the-dark-knight" -> "The Dark Knight"
 */
const slugToMovieName = (slug) => {
	return slug
		.split("-")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
};

/**
 * Get movie by slug
 * @param {string} slug - URL-friendly movie name (e.g., "the-dark-knight")
 * @returns {Promise<Object|null>} - Movie object or null if not found
 */
const getMovieBySlug = async (slug) => {
	try {
		// Convert slug to movie name
		const movieName = slugToMovieName(slug);

		// Search TMDB for the movie
		const searchResult = await searchMovieByName(movieName);

		if (!searchResult) {
			return null;
		}

		// Get full movie details
		const movieDetails = await getMovieDetails(searchResult.id);

		return movieDetails;
	} catch (error) {
		console.error(`Error in getMovieBySlug for slug "${slug}":`, error.message);
		throw error;
	}
};

/**
 * Get vector similar movies for a given movie ID
 * @param {number} movieId - TMDB movie ID
 * @returns {Promise<Array>} - Array of similar movie objects with scores
 */
const getVectorSimilarMovies = async (movieId) => {
	try {
		// Get the movie's vector from Qdrant
		const movieVector = await getMovieVectorById(movieId);

		if (!movieVector) {
			console.warn(`No vector found for movie ${movieId}, skipping vector search`);
			return [];
		}

		// Search for similar movies using the vector
		const similarMovies = await searchSimilarMovies(movieVector, 15, [movieId]);

		return similarMovies;
	} catch (error) {
		console.error(`Error in getVectorSimilarMovies for movie ${movieId}:`, error.message);
		// Return empty array on error to allow fallback to TMDB only
		return [];
	}
};

/**
 * Merge TMDB and vector results, deduplicating by movie ID
 * @param {Array} tmdbResults - Results from TMDB similar movies API
 * @param {Array} vectorResults - Results from vector similarity search
 * @returns {Promise<Array>} - Merged and deduplicated results
 */
const mergeSimilarMovies = (tmdbResults, vectorResults) => {
	const mergedMap = new Map();

	// Add TMDB results first (base similarity)
	tmdbResults.forEach((movie) => {
		mergedMap.set(movie.id, {
			...movie,
			source: "tmdb",
		});
	});

	// Add/vector enhance results
	vectorResults.forEach((movie) => {
		if (mergedMap.has(movie.movieId)) {
			// Movie exists in TMDB results, add vector score
			const existing = mergedMap.get(movie.movieId);
			mergedMap.set(movie.movieId, {
				...existing,
				vectorScore: movie.score,
				source: "hybrid",
			});
		} else {
			// New movie from vector search, need to fetch details
			// For now, just store the minimal info
			mergedMap.set(movie.movieId, {
				id: movie.movieId,
				vectorScore: movie.score,
				source: "vector",
				language: movie.language,
				genres: movie.genres,
				releaseDate: movie.releaseDate,
			});
		}
	});

	// Convert to array and sort by combined score
	// Prioritize hybrid results, then TMDB, then vector
	const merged = Array.from(mergedMap.values()).sort((a, b) => {
		const aScore = a.vectorScore || (a.popularity / 100) || 0;
		const bScore = b.vectorScore || (b.popularity / 100) || 0;
		return bScore - aScore;
	});

	return merged.slice(0, 15);
};

/**
 * Get movies like a given movie by slug
 * @param {string} slug - URL-friendly movie name (e.g., "the-dark-knight")
 * @param {boolean} useVector - Whether to use vector similarity (default: true)
 * @returns {Promise<Object>} - Object containing movie and similarMovies
 */
const getMoviesLike = async (slug, useVector = true) => {
	try {
		// Step 1: Get the movie by slug
		const movie = await getMovieBySlug(slug);

		if (!movie) {
			return {
				movie: null,
				similarMovies: [],
				error: "Movie not found",
			};
		}

		// Step 2: Get similar movies from TMDB
		const tmdbSimilar = await tmdbGetSimilarMovies(movie.id);

		// Step 3: Optionally get vector similar movies and merge
		let similarMovies = tmdbSimilar;

		if (useVector) {
			try {
				const vectorSimilar = await getVectorSimilarMovies(movie.id);
				similarMovies = mergeSimilarMovies(tmdbSimilar, vectorSimilar);

				// For vector-only results, fetch full details from TMDB
				const vectorOnlyResults = similarMovies.filter((m) => m.source === "vector");
				if (vectorOnlyResults.length > 0) {
					const detailedVectorResults = await Promise.all(
						vectorOnlyResults.map(async (m) => {
							try {
								const details = await getMovieDetails(m.id);
								return {
									...details,
									vectorScore: m.vectorScore,
									source: "vector",
								};
							} catch (err) {
								console.error(`Failed to fetch details for movie ${m.id}:`, err.message);
								return null;
							}
						})
					);

					// Replace vector-only results with detailed ones
					const detailedMap = new Map(detailedVectorResults.filter(Boolean).map((m) => [m.id, m]));
					similarMovies = similarMovies.map((m) => (detailedMap.has(m.id) ? detailedMap.get(m.id) : m));
				}
			} catch (vectorError) {
				console.warn("Vector similarity search failed, using TMDB only:", vectorError.message);
				// Fall back to TMDB results only
				similarMovies = tmdbSimilar;
			}
		}

		return {
			movie,
			similarMovies: similarMovies.slice(0, 15),
		};
	} catch (error) {
		console.error(`Error in getMoviesLike for slug "${slug}":`, error.message);
		throw error;
	}
};

module.exports = {
	getMovieBySlug,
	getMoviesLike,
	getVectorSimilarMovies,
	mergeSimilarMovies,
};
