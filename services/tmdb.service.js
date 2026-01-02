const axios = require("axios");

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_API_KEY = process.env.TMDB_API_KEY;

// Check if API key is configured
if (!TMDB_API_KEY) {
	console.warn("⚠️  TMDB_API_KEY not found in environment variables");
}

const tmdbClient = axios.create({
	baseURL: TMDB_BASE_URL,
	timeout: 10000,
	params: {
		api_key: TMDB_API_KEY,
	},
});

// Add retry interceptor
const withRetry = async (fn, retries = 3, delayMs = 1000) => {
	let lastError;
	for (let i = 0; i < retries; i++) {
		try {
			return await fn();
		} catch (error) {
			lastError = error;
			if (error.response?.status === 429) {
				const waitTime = delayMs * Math.pow(2, i); // Exponential backoff
				console.log(`Rate limited. Retrying in ${waitTime}ms... (attempt ${i + 1}/${retries})`);
				await new Promise((resolve) => setTimeout(resolve, waitTime));
			} else if (
				error.code === "ECONNRESET" ||
				error.code === "ETIMEDOUT" ||
				error.message.includes("Failed to connect")
			) {
				if (i < retries - 1) {
					console.log(`Connection error. Retrying in ${delayMs}ms... (attempt ${i + 1}/${retries})`);
					await new Promise((resolve) => setTimeout(resolve, delayMs));
				}
			} else {
				// For other errors, don't retry
				throw error;
			}
		}
	}
	throw lastError;
};

const getPopularMovies = async (page = 1) => {
	return withRetry(
		async () => {
			try {
				const response = await tmdbClient.get("/movie/popular", {
					params: { page },
				});
				return response.data.results;
			} catch (error) {
				if (error.response) {
					throw new Error(`TMDB API error: ${error.response.status} - ${error.response.statusText}`);
				} else if (error.request) {
					throw new Error("Failed to connect to TMDB API");
				} else {
					throw new Error(`Error fetching popular movies: ${error.message}`);
				}
			}
		},
		3,
		1000
	);
};

const getMovieDetails = async (movieId) => {
	return withRetry(
		async () => {
			try {
				const response = await tmdbClient.get(`/movie/${movieId}`, {
					params: { append_to_response: "genres" },
				});
				return {
					id: response.data.id,
					title: response.data.title,
					poster_path: response.data.poster_path,
					overview: response.data.overview,
					releaseDate: response.data.release_date,
					rating: response.data.vote_average,
					language: response.data.original_language,
					genres: response.data.genres?.map((g) => g.name) || [],
					backdrop_path: response.data.backdrop_path,
					runtime: response.data.runtime,
					status: response.data.status,
					adult: response.data.adult,
				};
			} catch (error) {
				if (error.response) {
					if (error.response.status === 404) {
						throw new Error(`Movie ${movieId} not found`);
					}
					throw new Error(`TMDB API error: ${error.response.status} - ${error.response.statusText}`);
				} else if (error.request) {
					throw new Error(`Failed to fetch TMDB details for movie ${movieId}: Failed to connect to TMDB API`);
				} else {
					throw new Error(`Error fetching movie details: ${error.message}`);
				}
			}
		},
		3,
		1000
	);
};

// const getMovieDetailsWithRetry = async (movieId, retries = 3) => {
// 	for (let i = 0; i < retries; i++) {
// 		try {
// 			return await getMovieDetails(movieId);
// 		} catch (err) {
// 			if (i === retries - 1) throw err;
// 			await new Promise((r) => setTimeout(r, 500 * (i + 1)));
// 		}
// 	}
// };

const getMovieKeywords = async (movieId) => {
	try {
		const response = await tmdbClient.get(`/movie/${movieId}/keywords`);
		return response.data.keywords.map((k) => k.name);
	} catch (error) {
		if (error.response) {
			throw new Error(`TMDB API error: ${error.response.status} - ${error.response.statusText}`);
		} else if (error.request) {
			throw new Error("Failed to connect to TMDB API");
		} else {
			throw new Error(`Error fetching movie keywords: ${error.message}`);
		}
	}
};
const getMovieCredits = async (movieId) => {
	try {
		const response = await tmdbClient.get(`/movie/${movieId}/credits`);
		const cast = response.data?.cast || [];

		return cast.slice(0, 5).map((actor) => actor.name);
	} catch (error) {
		if (error.response) {
			throw new Error(`TMDB API error: ${error.response.status} - ${error.response.statusText}`);
		} else if (error.request) {
			throw new Error("Failed to connect to TMDB API");
		} else {
			throw new Error(`Error fetching movie credits: ${error.message}`);
		}
	}
};
// async function withRetry(fn, retries = 3, delay = 500) {
// 	try {
// 		return await fn();
// 	} catch (error) {
// 		const isRetryable = !error.response || error.response.status >= 500;

// 		if (!isRetryable || retries === 0) {
// 			throw error;
// 		}

// 		await new Promise((res) => setTimeout(res, delay));
// 		return withRetry(fn, retries - 1, delay * 2);
// 	}
// }
const getFullMovieData = async (movieId) => {
	try {
		const [details, keywords, actors] = await Promise.all([
			withRetry(() => getMovieDetails(movieId)),
			withRetry(() => getMovieKeywords(movieId)),
			withRetry(() => getMovieCredits(movieId)),
		]);

		return {
			...details,
			keywords,
			actors,
			combinedText: `
      ${details.overview}
      Keywords: ${keywords.join(", ")}
      Actors: ${actors.join(", ")}
      Genres: ${details.genres.join(", ")}
      Original Language: ${details.language}
    `,
		};
	} catch (error) {
		throw new Error(`Error fetching full movie data: ${error.message}`);
	}
};

const discoverMovies = async (options = {}) => {
	return withRetry(
		async () => {
			const {
				page = 1,
				languages,
				search = "",
				sortBy = "popularity.desc",
				voteAverageGte,
				voteCountGte,
				withGenres,
				year,
			} = options;

			try {
				const languagesArr = languages ? languages.split(",").map((lang) => lang.trim()) : [];
				let tempLanguages = languagesArr && languagesArr.length > 0 ? languagesArr.join("|") : "";
				// If search query provided, use search endpoint
				if (search && search.trim()) {
					const response = await tmdbClient.get("/search/movie", {
						params: {
							query: search.trim(),
							page,
							language: "en-US",
						},
					});
					if (languagesArr && languagesArr.length > 0) {
						response.data.results = response.data.results.filter((movie) =>
							languagesArr.includes(movie.original_language)
						);
					}
					return response.data;
				}

				// Otherwise use discover endpoint
				const params = {
					page,
					language: "en-US",
					sort_by: sortBy,
					"vote_average.gte": voteAverageGte,
					"vote_count.gte": voteCountGte,
					with_genres: withGenres,
					primary_release_year: year,
				};
				if (tempLanguages) {
					// Handle both string and array inputs
					params.with_original_language = tempLanguages;
				}

				// Remove undefined params
				Object.keys(params).forEach((key) => params[key] === undefined && delete params[key]);

				const response = await tmdbClient.get("/discover/movie", { params });
				return response.data;
			} catch (error) {
				if (error.response) {
					throw new Error(`TMDB API error: ${error.response.status} - ${error.response.statusText}`);
				} else if (error.request) {
					throw new Error("Failed to connect to TMDB API");
				}
				throw error;
			}
		},
		3,
		1000
	);
};
// const discoverMoviesWithRetry = async (options = {}, retries = 3) => {
// 	for (let i = 0; i < retries; i++) {
// 		try {
// 			return await discoverMovies(options);
// 		} catch (err) {
// 			console.log("discoverMoviesWithRetry error retrying:", i + 1);
// 			if (i === retries - 1) throw err;
// 			await new Promise((r) => setTimeout(r, 500 * (i + 1)));
// 		}
// 	}
// };

const getMoviesByDiscover = async (year, page, language) => {
	return withRetry(
		async () => {
			const params = {
				page,
				language: "en-US",
				sort_by: "popularity.desc",
				primary_release_year: year,
				with_original_language: language,
				"vote_average.gte": 5,
			};

			const response = await tmdbClient.get("/discover/movie", { params });
			const data = await response.data;

			// Extract only movie IDs
			const movieIds = (data.results || []).map((movie) => movie.id);

			return {
				movieIds,
				totalPages: data.total_pages || 0,
				hasMore: data.page < data.total_pages,
			};
		},
		3,
		1000
	);
};

/**
 * Fetches popular movies with pagination and optional year filtering
 * @param {number} page - Page number to fetch (1-based)
 * @param {string} [language='en-US'] - Language code for results
 * @param {number} [yearGte] - Filter movies released in or after this year
 * @returns {Promise<{movieIds: number[], totalPages: number, hasMore: boolean}>}
 */
const getPopularMoviesByPage = async (page = 1, language = "en-US", yearGte) => {
	return withRetry(
		async () => {
			const params = {
				page,
				language,
				sort_by: "popularity.desc",
				"vote_count.gte": 10, // Ensure we get movies with some minimum votes
				"vote_average.gte": 6, // Ensure we get movies with decent ratings
				with_status: 0, // Only include movies with status "Released"
			};

			// Add year filter if provided
			if (yearGte) {
				params["primary_release_date.gte"] = `${yearGte}-01-01`;
			}

			// Use discover endpoint when year filter is applied, otherwise use popular endpoint
			const endpoint = yearGte ? "/discover/movie" : "/movie/popular";

			const response = await tmdbClient.get(endpoint, { params });
			const data = response.data;

			// Extract only movie IDs
			const movieIds = (data.results || []).map((movie) => movie.id);

			return {
				movieIds,
				totalPages: data.total_pages || 0,
				hasMore: data.page < data.total_pages,
			};
		},
		3,
		1000
	);
};

module.exports = {
	getPopularMovies,
	getPopularMoviesByPage,
	getMovieDetails,
	// getMovieDetailsWithRetry,
	// discoverMoviesWithRetry,
	getMovieKeywords,
	getMovieCredits,
	getFullMovieData,
	discoverMovies,
	getMoviesByDiscover,
};
