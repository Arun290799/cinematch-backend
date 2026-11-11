const User = require("../models/User");
const LikedMovie = require("../models/LikedMovie");
const { getOrCreateMovieVector } = require("../services/movieVector.service");

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
		const vector = await getOrCreateMovieVector(movieId);
		if (!vector?.length) continue;

		avg = incrementalAverage(avg, count, vector);
		count++;
	}

	await User.findByIdAndUpdate(userId, {
		userVector: avg,
		vectorCount: count,
	});
};
