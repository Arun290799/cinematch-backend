const { getMovieDetails } = require("./services/tmdb.service");

async function testTMDBError() {
	console.log("Testing TMDB error handling...");

	try {
		// Test with an invalid movie ID
		const movie = await getMovieDetails(999999999);
		console.log("Movie details:", movie);
	} catch (error) {
		console.log("✅ Caught error:", error.message);
	}

	try {
		// Test with a valid movie ID
		const movie = await getMovieDetails(767);
		console.log("✅ Successfully fetched movie:", movie.title);
	} catch (error) {
		console.log("❌ Failed to fetch valid movie:", error.message);
	}
}

testTMDBError().catch(console.error);
