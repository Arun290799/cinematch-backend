const redis = require("../lib/redis");
const User = require("../models/User");
const { incrementalAverage } = require("../utils/vector.util");

const {
	getMovieVectorById,
	upsertMovieVector,
	generateEmbedding,
	getFullMovieData,
} = require("../services/vector.service");

module.exports = async function processMovieVector(userId, movieId) {
	const cacheKey = `movie:vector:${movieId}`;

	let vector = await redis.get(cacheKey);
	if (vector) {
		vector = JSON.parse(vector);
	} else {
		vector = await getMovieVectorById(movieId);

		if (!vector) {
			const fullMovie = await getFullMovieData(movieId);
			if (!fullMovie?.combinedText) return;

			vector = await generateEmbedding(fullMovie.combinedText);
			if (!vector?.length) return;

			await upsertMovieVector(movieId, vector);
		}

		await redis.set(cacheKey, JSON.stringify(vector), "EX", 86400);
	}

	const user = await User.findById(userId);
	if (!user) return;

	user.userVector = incrementalAverage(user.userVector, user.vectorCount, vector);
	user.vectorCount += 1;

	await user.save();
};
