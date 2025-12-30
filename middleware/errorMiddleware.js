// Error handling middleware
const errorHandler = (err, req, res, next) => {
	let error = { ...err };
	error.message = err.message;

	// Log to console for development
	console.error(err.stack);

	// TMDB API errors
	if (err.message && err.message.includes("TMDB API error")) {
		error = new Error("External movie service unavailable");
		error.statusCode = 503;
	}

	// TMDB connection errors
	if (err.message && err.message.includes("Failed to connect to TMDB API")) {
		error = new Error("Movie service temporarily unavailable");
		error.statusCode = 503;
	}

	// Mongoose bad ObjectId
	if (err.name === "CastError") {
		const message = `Resource not found with id of ${err.value}`;
		error = new Error(message);
		error.statusCode = 404;
	}

	// Mongoose duplicate key
	if (err.code === 11000) {
		const field = Object.keys(err.keyValue)[0];
		const message = `Duplicate field value entered for ${field}`;
		error = new Error(message);
		error.statusCode = 400;
	}

	// Mongoose validation error
	if (err.name === "ValidationError") {
		const message = Object.values(err.errors).map((val) => val.message);
		error = new Error(message);
		error.statusCode = 400;
	}

	// JWT errors
	if (err.name === "JsonWebTokenError") {
		const message = "Invalid token";
		error = new Error(message);
		error.statusCode = 401;
	}

	// JWT expired
	if (err.name === "TokenExpiredError") {
		const message = "Token has expired";
		error = new Error(message);
		error.statusCode = 401;
	}

	res.status(error.statusCode || 500).json({
		success: false,
		error: error.message || "Server Error",
	});
};

module.exports = errorHandler;
