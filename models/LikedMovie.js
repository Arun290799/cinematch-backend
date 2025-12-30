// models/LikedMovie.js
const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");

const likedMovieSchema = new mongoose.Schema(
	{
		user: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
		movieId: {
			type: Number,
			required: true,
		},
		title: {
			type: String,
			required: true,
		},
		posterPath: String,
		year: String,
		overview: String,
		rating: Number,
		genres: [
			{
				id: Number,
				name: String,
			},
		],
		vector: [
			{
				type: Number,
			},
		],
	},
	{
		timestamps: true,
	}
);

// Add pagination plugin (useful if we paginate liked movies later)
likedMovieSchema.plugin(mongoosePaginate);

// Unique per user/movie like
likedMovieSchema.index({ user: 1, movieId: 1 }, { unique: true });

module.exports = mongoose.model("LikedMovie", likedMovieSchema);


