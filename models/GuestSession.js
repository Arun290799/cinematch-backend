const mongoose = require("mongoose");

const guestLikeSchema = new mongoose.Schema(
	{
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
	},
	{ _id: false },
);

const guestSessionSchema = new mongoose.Schema(
	{
		sessionHash: {
			type: String,
			required: true,
			unique: true,
		},
		likes: {
			type: [guestLikeSchema],
			default: [],
		},
		expiresAt: {
			type: Date,
			required: true,
		},
	},
	{ timestamps: true },
);

guestSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("GuestSession", guestSessionSchema);
