const { getPopularMovies, getFullMovieData, getMoviesByDiscover } = require("../services/tmdb.service");

const { generateEmbedding } = require("../services/embedding.service");
const { upsertMovieVector, getMovieVectorById } = require("../services/vector.service");

/**
 * Index movies into Qdrant
 * This should be run once or via cron
 */
const indexMovies = async () => {
	console.log("🚀 Starting movie indexing job...");

	let totalIndexed = 0;
	let totalSkipped = 0;
	let totalFailed = 0;
	const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

	// Define the range of years to process (from current year to 1900)
	const currentYear = 2025;
	const startYear = 2025;
	const years = Array.from({ length: currentYear - startYear + 1 }, (_, i) => currentYear - i);
	console.log(`\n📅 Processing years: ${years.join(", ")}`);
	// Process each year
	for (const year of years) {
		console.log(`\n📅 Processing year: ${year}`);
		let page = 19;
		let hasMore = true;
		let yearIndexed = 0;
		let yearSkipped = 0;
		let yearFailed = 0;

		while (hasMore && page <= 100) {
			try {
				const { movieIds, totalPages, hasMore: more } = await getMoviesByDiscover(year, page, "en");

				console.log(`   Found ${movieIds.length} movies (Total pages: ${totalPages})`);

				if (movieIds.length === 0) {
					console.log(`   ℹ️  No more movies for year ${year}`);
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
							yearSkipped++;
							continue;
						}

						// 2️⃣ Fetch full movie data
						const fullMovie = await getFullMovieData(movieId);
						if (!fullMovie.combinedText) {
							console.log(`⚠️ Skipping movie ${movieId} (no text)`);
							totalSkipped++;
							yearSkipped++;
							continue;
						}

						// 3️⃣ Generate embedding (Gemini)
						const vector = await generateEmbedding(fullMovie.combinedText);

						if (!vector || !vector.length) {
							console.log(`⚠️ Empty embedding for movie ${movieId}`);
							totalFailed++;
							yearFailed++;
							continue;
						}

						console.log(`   ✅ Indexed: ${fullMovie.title} (${movieId}) [${year}]`);
						totalIndexed++;
						yearIndexed++;

						// 4️⃣ Store vector in Qdrant
						await upsertMovieVector(movieId, vector, fullMovie);
						await delay(250);
					} catch (err) {
						console.error(`❌ Failed to index movie ${movieId}`, err);
						totalFailed++;
						yearFailed++;

						if (err.message.includes("429")) {
							console.log(`⏸️  Rate limited. Waiting 10 seconds...`);
							await delay(100000);
						}
					}
				}

				console.log(`\n✅ Completed page ${page}`);

				hasMore = more;
				page++;

				// Delay between page requests
				await delay(250);
			} catch (err) {
				console.error(`\n❌ Error fetching page ${page} for year ${year}:`, err.message);

				// If it's a rate limit error, wait longer
				if (err.message.includes("429")) {
					console.log(`⏸️  Rate limited. Waiting 10 seconds...`);
					await delay(10000);
				} else {
					// For other errors, skip to next page
					hasMore = false;
					break;
				}
			}
		}

		// Log yearly summary
		console.log(`\n📊 Year ${year} Summary:`);
		console.log(`   ✅ Indexed: ${yearIndexed}`);
		console.log(`   ⏭️  Skipped: ${yearSkipped}`);
		console.log(`   ❌ Failed: ${yearFailed}`);
		console.log(`   📝 Total processed: ${yearIndexed + yearSkipped + yearFailed}`);

		// Add a small delay between years to be nice to the API
		if (year > startYear) {
			console.log(`\n⏳ Taking a short break before next year...`);
			await delay(2000);
		}
	}

	// Final summary
	console.log("\n🎉 Movie indexing completed for all years!");
	console.log(`\n📊 Final Summary (${startYear}-${currentYear}):`);
	console.log(`   ✅ Total Indexed: ${totalIndexed}`);
	console.log(`   ⏭️  Total Skipped: ${totalSkipped}`);
	console.log(`   ❌ Total Failed: ${totalFailed}`);
	console.log(`   📝 Grand Total: ${totalIndexed + totalSkipped + totalFailed}`);
	console.log(`\n✨ All done!`);
};

module.exports = {
	indexMovies,
};
