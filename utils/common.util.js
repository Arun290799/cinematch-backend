async function promisePool(items, concurrency, taskFn) {
	const results = [];
	const executing = [];

	for (const item of items) {
		const p = Promise.resolve().then(() => taskFn(item));
		results.push(p);

		if (concurrency <= items.length) {
			const e = p.then(() => executing.splice(executing.indexOf(e), 1));
			executing.push(e);
			if (executing.length >= concurrency) {
				await Promise.race(executing);
			}
		}
	}

	return Promise.all(results);
}

module.exports = { promisePool };
