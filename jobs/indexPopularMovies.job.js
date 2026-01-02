const { getFullMovieData, getPopularMoviesByPage } = require("../services/tmdb.service");
const { generateEmbedding } = require("../services/embedding.service");
const { upsertMovieVector, getMovieVectorById } = require("../services/vector.service");

/**
 * Index popular movies into Qdrant
 * This should be run once or via cron
 */
const indexPopularMovies = async () => {
	console.log("🚀 Starting popular movies indexing job...");

	let totalIndexed = 0;
	let totalSkipped = 0;
	let totalFailed = 0;
	let page = 265;
	let hasMore = true;
	const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

	while (hasMore && page <= 1000) {
		// Limit to 100 pages to avoid excessive API calls
		try {
			const { movieIds, totalPages, hasMore: more } = await getPopularMoviesByPage(page, "en-US", 2010);
			console.log(`📄 Processing page ${page}/${totalPages}`);
			console.log(`   Found ${movieIds.length} popular movies`);

			if (movieIds.length === 0) {
				console.log("   ℹ️  No more popular movies to index");
				hasMore = false;
				break;
			}

			for (const movieId of movieIds) {
				try {
					// 1️⃣ Check if movie already indexed
					const existingVector = await getMovieVectorById(movieId);
					if (existingVector) {
						console.log(`⏭️ Movie ${movieId} already indexed`);
						totalSkipped++;
						continue;
					}

					// 2️⃣ Fetch full movie data
					const fullMovie = await getFullMovieData(movieId);
					if (!fullMovie.combinedText) {
						console.log(`⚠️ Skipping movie ${movieId} (no text)`);
						totalSkipped++;
						continue;
					}

					// 3️⃣ Generate embedding
					console.log(`   Generating embedding for movie ${movieId}...`);
					const vector = await generateEmbedding(fullMovie.combinedText);

					if (!vector || !vector.length) {
						console.log(`⚠️ Empty embedding for movie ${movieId}`);
						totalFailed++;
						continue;
					}

					// 4️⃣ Store vector in Qdrant
					await upsertMovieVector(movieId, vector, fullMovie);
					console.log(`   ✅ Indexed: ${fullMovie.title} (${movieId})`);
					totalIndexed++;

					// Be nice to the API
					await delay(250);
				} catch (err) {
					console.error(`❌ Failed to index movie ${movieId}:`, err.message);
					totalFailed++;

					if (err.message.includes("429")) {
						console.log(`⏸️  Rate limited. Waiting 10 seconds...`);
						await delay(100000);
					}
				}
			}

			console.log(`✅ Completed page ${page}/${totalPages}`);
			hasMore = more;
			page++;

			// Add a small delay between pages
			await delay(500);
		} catch (err) {
			console.error(`\n❌ Error fetching page ${page}:`, err.message);

			// If rate limited, wait longer
			if (err.message.includes("429")) {
				console.log(`⏸️  Rate limited. Waiting 30 seconds...`);
				await delay(30000);
			} else {
				// For other errors, stop processing
				hasMore = false;
				break;
			}
		}
	}

	// Final summary
	console.log("\n🎉 Popular movies indexing completed!");
	console.log(`📊 Final Summary:`);
	console.log(`   ✅ Total Indexed: ${totalIndexed}`);
	console.log(`   ⏭️  Total Skipped: ${totalSkipped}`);
	console.log(`   ❌ Total Failed: ${totalFailed}`);
	console.log(`   📝 Grand Total: ${totalIndexed + totalSkipped + totalFailed}`);
	console.log("\n✨ All done!");
};

// Run the job if this file is executed directly
if (require.main === module) {
	indexPopularMovies().catch(console.error);
}

module.exports = {
	indexPopularMovies,
};
