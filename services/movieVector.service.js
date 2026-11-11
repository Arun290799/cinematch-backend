const redis = require("../lib/redis");
const { getFullMovieData } = require("./tmdb.service");
const { generateEmbedding } = require("./embedding.service");
const { getMovieVectorById, upsertMovieVector } = require("./vector.service");

module.exports.getOrCreateMovieVector = async (movieId) => {
	const cacheKey = `movie:vector:${movieId}`;
	const cached = await redis.get(cacheKey);
	if (cached) {
		return JSON.parse(cached);
	}

	let vector = await getMovieVectorById(movieId);
	if (!vector?.length) {
		const fullMovie = await getFullMovieData(movieId);
		if (!fullMovie?.combinedText) {
			return null;
		}

		vector = await generateEmbedding(fullMovie.combinedText);
		if (!vector?.length) {
			return null;
		}

		await upsertMovieVector(movieId, vector, fullMovie);
	}

	await redis.set(cacheKey, JSON.stringify(vector), "EX", 86400);
	return vector;
};
