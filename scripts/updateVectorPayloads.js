const { QdrantClient } = require("@qdrant/js-client-rest");
const { getMovieDetails } = require("../services/tmdb.service");
const { promisePool } = require("../utils/common.util");

const qdrant = new QdrantClient({
	url: process.env.QDRANT_URL,
	apiKey: process.env.QDRANT_API_KEY,
});

const COLLECTION_NAME = "movies";

/**
 * Updates vector payloads with additional metadata (language, genres, release date)
 * This script should be run once to enrich existing vectors with filtering capabilities
 */
async function updateVectorPayloads() {
	console.log("🚀 Starting vector payload update...");
	try {
		// Get all points in the collection (scroll through all)
		let allPoints = [];
		let nextPageOffset = null;

		do {
			const response = await qdrant.scroll(COLLECTION_NAME, {
				limit: 100,
				offset: nextPageOffset,
				with_payload: true,
				with_vector: false,
			});

			if (!response.points || response.points.length === 0) break;

			allPoints.push(...response.points);
			nextPageOffset = response.next_page_offset;

			console.log(`📊 Retrieved ${allPoints.length} points so far...`);
		} while (nextPageOffset !== null);

		console.log(`📋 Total points to update: ${allPoints.length}`);

		// Process points in batches to avoid overwhelming TMDB API
		const BATCH_SIZE = 5;
		let updatedCount = 0;
		let errorCount = 0;

		for (let i = 0; i < allPoints.length; i += BATCH_SIZE) {
			const batch = allPoints.slice(i, i + BATCH_SIZE);

			console.log(
				`🔄 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(allPoints.length / BATCH_SIZE)}`
			);

			const updatePromises = batch.map(async (point) => {
				try {
					const movieId = point.payload.movieId;

					// Get full movie details from TMDB
					const movieDetails = await getMovieDetails(movieId);

					if (!movieDetails) {
						console.warn(`⚠️  No details found for movie ${movieId}`);
						return null;
					}

					// Update the point with enriched payload
					await qdrant.setPayload(COLLECTION_NAME, {
						payload: {
							...point.payload,
							language: movieDetails.language || movieDetails.original_language,
							genres: movieDetails.genres || [],
							releaseDate: movieDetails.releaseDate || movieDetails.release_date,
						},
						filter: {
							must: [{ key: "movieId", match: { value: movieId } }],
						},
					});

					console.log(`✅ Updated movie ${movieId}: ${movieDetails.title}`);
					return { success: true, movieId };
				} catch (error) {
					console.error(`❌ Failed to update movie ${point.payload.movieId}:`, error.message);
					return { success: false, movieId: point.payload.movieId, error: error.message };
				}
			});

			const results = await promisePool(updatePromises, 3, (promise) => promise);

			// Count successes and failures
			results.forEach((result) => {
				if (result && result.success) {
					updatedCount++;
				} else if (result && !result.success) {
					errorCount++;
				}
			});

			// Small delay to avoid rate limiting
			await new Promise((resolve) => setTimeout(resolve, 1000));
		}

		console.log(`\n🎉 Update completed!`);
		console.log(`✅ Successfully updated: ${updatedCount} vectors`);
		console.log(`❌ Failed updates: ${errorCount} vectors`);
		console.log(`📊 Success rate: ${((updatedCount / (updatedCount + errorCount)) * 100).toFixed(2)}%`);
	} catch (error) {
		console.error("💥 Fatal error during update:", error);
		throw error;
	}
}

/**
 * Verify the update by checking a sample of updated payloads
 */
async function verifyUpdate() {
	console.log("\n🔍 Verifying update...");

	try {
		const response = await qdrant.scroll(COLLECTION_NAME, {
			limit: 5,
			with_payload: true,
			with_vector: false,
		});

		console.log("📋 Sample of updated payloads:");
		response.result.points.forEach((point, index) => {
			console.log(`${index + 1}. Movie ${point.payload.movieId}:`, {
				language: point.payload.language,
				genres: point.payload.genres,
				releaseDate: point.payload.releaseDate,
			});
		});
	} catch (error) {
		console.error("❌ Verification failed:", error);
	}
}

// Run if called directly
if (require.main === module) {
	updateVectorPayloads()
		.then(() => verifyUpdate())
		.then(() => {
			console.log("🏁 Script completed successfully");
			process.exit(0);
		})
		.catch((error) => {
			console.error("💥 Script failed:", error);
			process.exit(1);
		});
}

module.exports = { updateVectorPayloads, verifyUpdate };
