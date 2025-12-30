const averageVectors = (vectors) => {
	if (!vectors.length) return [];

	const vectorLength = vectors[0].length;
	const avg = new Array(vectorLength).fill(0);

	for (const vec of vectors) {
		for (let i = 0; i < vectorLength; i++) {
			avg[i] += vec[i];
		}
	}
	return avg.map((v) => v / vectors.length);
};

module.exports = { averageVectors };
