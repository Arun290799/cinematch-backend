const User = require("../models/User");
const { getOrCreateMovieVector } = require("../services/movieVector.service");
const { incrementalAverage } = require("../utils/vector.util");

module.exports = async function processMovieVector(userId, movieId) {
	const vector = await getOrCreateMovieVector(movieId);
	if (!vector?.length) return;

	const user = await User.findById(userId);
	if (!user) return;

	user.userVector = incrementalAverage(user.userVector, user.vectorCount, vector);
	user.vectorCount += 1;

	await user.save();
};
