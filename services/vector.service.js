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
const upsertMovieVector = async (movieId, vector) => {
	try {
		await qdrant.upsert(COLLECTION_NAME, {
			points: [
				{
					id: movieId,
					vector,
					payload: {
						movieId,
					},
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
const searchSimilarMovies = async (userVector, limit = 10) => {
	const result = await qdrant.search(COLLECTION_NAME, {
		vector: userVector,
		limit,
	});

	return result.map((item) => ({
		movieId: item.payload.movieId,
		score: item.score,
	}));
};

module.exports = {
	createCollection,
	upsertMovieVector,
	getMovieVectorById,
	searchSimilarMovies,
};
