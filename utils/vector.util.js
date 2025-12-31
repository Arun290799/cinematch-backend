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
const incrementalAverage = (current, count, next) => {
	if (!current || !current.length) return next;

	const result = new Array(next.length);
	for (let i = 0; i < next.length; i++) {
		result[i] = (current[i] * count + next[i]) / (count + 1);
	}
	return result;
};

module.exports = { averageVectors, incrementalAverage };
