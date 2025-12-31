const redis = require("../lib/redis");
const User = require("../models/User");
const LikedMovie = require("../models/LikedMovie");
const { getMovieVectorById } = require("../services/vector.service");

const { incrementalAverage } = require("../utils/vector.util");

module.exports = async function rebuildUserVector(userId) {
	const likedMovies = await LikedMovie.find({ user: userId }, { movieId: 1, _id: 0 });

	if (!likedMovies.length) {
		await User.findByIdAndUpdate(userId, {
			userVector: [],
			vectorCount: 0,
		});
		return;
	}

	let avg = [];
	let count = 0;

	for (const { movieId } of likedMovies) {
		const cacheKey = `movie:vector:${movieId}`;

		let vector = await redis.get(cacheKey);
		if (vector) {
			vector = JSON.parse(vector);
		} else {
			vector = await getMovieVectorById(movieId);
			if (!vector?.length) continue;

			await redis.set(cacheKey, JSON.stringify(vector), "EX", 86400);
		}

		avg = incrementalAverage(avg, count, vector);
		count++;
	}

	await User.findByIdAndUpdate(userId, {
		userVector: avg,
		vectorCount: count,
	});
};
