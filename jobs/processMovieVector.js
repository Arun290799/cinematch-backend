const redis = require("../lib/redis");
const User = require("../models/User");
const { getFullMovieData } = require("../services/tmdb.service");
const { incrementalAverage } = require("../utils/vector.util");
const { generateEmbedding } = require("../services/embedding.service");
const { upsertMovieVector, getMovieVectorById } = require("../services/vector.service");

module.exports = async function processMovieVector(userId, movieId) {
	const cacheKey = `movie:vector:${movieId}`;

	let vector = await redis.get(cacheKey);
	if (vector) {
		vector = JSON.parse(vector);
	} else {
		vector = await getMovieVectorById(movieId);

		if (!vector) {
			try {
				const fullMovie = await getFullMovieData(movieId);
				if (!fullMovie?.combinedText) return;

				vector = await generateEmbedding(fullMovie.combinedText);
				if (!vector?.length) return;

				await upsertMovieVector(movieId, vector, fullMovie);
			} catch (error) {
				console.error(`Failed to generate vector for movie ${movieId}:`, error);
			}
		}

		await redis.set(cacheKey, JSON.stringify(vector), "EX", 86400);
	}

	const user = await User.findById(userId);
	if (!user) return;

	user.userVector = incrementalAverage(user.userVector, user.vectorCount, vector);
	user.vectorCount += 1;

	await user.save();
};
