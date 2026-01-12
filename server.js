require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const authRoutes = require("./routes/authRoutes");
const movieRoutes = require("./routes/movieRoutes");
const wishlistRoutes = require("./routes/wishlistRoutes");
const contactRoutes = require("./routes/contactRoutes");
const errorHandler = require("./middleware/errorMiddleware");
const { createCollection } = require("./services/vector.service");
const { indexMovies } = require("./jobs/indexMovies.job");
const { indexPopularMovies } = require("./jobs/indexPopularMovies.job");
const app = express();

// CORS configuration
const corsOptions = {
	origin: process.env.CLIENT_URL || "http://localhost:3000",
	credentials: true,
	methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
	allowedHeaders: ["Content-Type", "Authorization"],
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/movies", movieRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/contact", contactRoutes);
// Health check endpoint
app.get("/health", (req, res) => {
	res.status(200).json({
		status: "success",
		message: "Server is running",
		timestamp: new Date().toISOString(),
	});
});

// TMDB API health check
app.get("/health/tmdb", async (req, res) => {
	try {
		const { getPopularMovies } = require("./services/tmdb.service");
		// Try to fetch a single popular movie to check API connectivity
		const movies = await getPopularMovies(1);
		res.status(200).json({
			status: "success",
			message: "TMDB API is healthy",
			timestamp: new Date().toISOString(),
			data: {
				available: movies.length > 0,
				firstMovie: movies[0]?.title || null,
			},
		});
	} catch (error) {
		res.status(503).json({
			status: "error",
			message: "TMDB API is unavailable",
			timestamp: new Date().toISOString(),
			error: error.message,
		});
	}
});

// Error handling middleware
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

// Handle unhandled promise rejections
process.on("unhandledRejection", (err, promise) => {
	console.error("UNHANDLED REJECTION! 💥", err.message);
	console.error("Promise:", promise);
	// Don't shut down the server, just log the error
	// process.exit(1);
});

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
	console.error("UNCAUGHT EXCEPTION! 💥", err);
	// Don't shut down the server, just log the error
	// process.exit(1);
});

(async () => {
	try {
		// await createCollection();
		// await indexMovies();
		// await indexPopularMovies();
	} catch (error) {
		console.error("❌ Failed to start server", error);
		process.exit(1);
	}
})();
// Connect to MongoDB
mongoose
	.connect(process.env.MONGODB_URI)
	.then(() => {
		console.log("✅ Connected to MongoDB");

		app.listen(PORT, () => {
			console.log(`🚀 Server running on port ${PORT}`);
		});

		// Handle unhandled promise rejections
		process.on("unhandledRejection", (err) => {
			console.error("UNHANDLED REJECTION! 💥 Shutting down...");
			console.error(err.name, err.message);
			process.exit(1);
		});
	})
	.catch((err) => {
		console.error("MongoDB connection error:", err);
		process.exit(1);
	});

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
	console.error("UNCAUGHT EXCEPTION! 💥 Shutting down...");
	console.error(err.name, err.message);
	process.exit(1);
});

// Handle SIGTERM for graceful shutdown
process.on("SIGTERM", () => {
	console.log("👋 SIGTERM RECEIVED. Shutting down gracefully");
	process.exit(0);
});
