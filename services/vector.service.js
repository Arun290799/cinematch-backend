const { QdrantClient } = require("@qdrant/js-client-rest");

const qdrant = new QdrantClient({
	url: process.env.QDRANT_URL,
	apiKey: process.env.QDRANT_API_KEY,
});

const COLLECTION_NAME = "movies";

const VECTOR_SIZE = 1536; // must match embedding model

const createCollection = async () => {
	const collections = await qdrant.getCollections();

	const exists = collections.collections.some((c) => c.name === COLLECTION_NAME);
	if (exists) {
		console.log("✅ Collection already exists");
		return;
	}

	await qdrant.createCollection(COLLECTION_NAME, {
		vectors: {
			size: VECTOR_SIZE,
			distance: "Cosine",
		},
	});

	console.log("✅ Collection created");
};
const upsertMovieVector = async (movieId, vector, movieDetails = null) => {
	try {
		// Prepare enriched payload if movie details are provided
		const payload = movieDetails
			? {
					movieId,
					language: movieDetails.language || movieDetails.original_language,
					genres: movieDetails.genres || [],
					releaseDate: movieDetails.releaseDate || movieDetails.release_date,
			  }
			: {
					movieId,
			  };

		await qdrant.upsert(COLLECTION_NAME, {
			points: [
				{
					id: movieId,
					vector,
					payload,
				},
			],
		});
	} catch (error) {
		console.log("error while upsertMovieVector", error);
	}
};
const getMovieVectorById = async (movieId) => {
	const result = await qdrant.retrieve(COLLECTION_NAME, {
		ids: [movieId],
		with_vector: true,
	});
	return result[0]?.vector;
};
const searchSimilarMovies = async (userVector, limit = 10, excludeMovieIds = [], filters = {}) => {
	const excludedIds = excludeMovieIds.map((id) => Number(id));

	// Build filter conditions
	const filterConditions = [];

	// Add exclusion filter
	if (excludedIds.length > 0) {
		filterConditions.push({
			must_not: [
				{
					key: "movieId",
					match: {
						any: excludedIds,
					},
				},
			],
		});
	}

	// Add language filter
	if (filters.languages && filters.languages.length > 0) {
		filterConditions.push({
			must: [
				{
					key: "language",
					match: {
						any: filters.languages,
					},
				},
			],
		});
	}

	// Add genre filter
	if (filters.genres && filters.genres.length > 0) {
		filterConditions.push({
			must: [
				{
					key: "genres",
					match: {
						any: filters.genres,
					},
				},
			],
		});
	}

	// Add release date range filter
	if (filters.releaseDateGte || filters.releaseDateLte) {
		const dateCondition = {};
		if (filters.releaseDateGte) {
			dateCondition.gte = filters.releaseDateGte;
		}
		if (filters.releaseDateLte) {
			dateCondition.lte = filters.releaseDateLte;
		}
		filterConditions.push({
			must: [
				{
					key: "releaseDate",
					range: dateCondition,
				},
			],
		});
	}

	// Combine all filters
	const filter =
		filterConditions.length > 0
			? {
					must: filterConditions
						.map((condition) => (condition.must ? condition.must[0] : null))
						.filter(Boolean),
					must_not: filterConditions.flatMap((condition) => condition.must_not || []).filter(Boolean),
			  }
			: undefined;

	const result =
		typeof qdrant.search === "function"
			? await qdrant.search(COLLECTION_NAME, {
					vector: userVector,
					limit,
					filter,
					with_payload: true,
			  })
			: await qdrant.query(COLLECTION_NAME, {
					query: userVector,
					limit,
					filter,
					with_payload: true,
			  });
	const points = Array.isArray(result) ? result : result.points;

	return points.map((item) => {
		const payload = item.payload || {};
		const movieId = payload.movieId ?? item.id;
		if (movieId == null) {
			throw new Error("Qdrant returned a movie point without a movie ID");
		}

		return {
			movieId,
			score: item.score,
			language: payload.language,
			genres: payload.genres,
			releaseDate: payload.releaseDate,
		};
	});
};

module.exports = {
	createCollection,
	upsertMovieVector,
	getMovieVectorById,
	searchSimilarMovies,
};
