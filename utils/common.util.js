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
const ott_providers = [
	{
		providerId: 8,
		provider_name: "Netflix",
		logo: "https://image.tmdb.org/t/p/w154/9A1JSVmSxsyaBK4SUFsYVqbAYfW.jpg",
	},
	{
		providerId: 9,
		provider_name: "Amazon Prime Video",
		logo: "https://image.tmdb.org/t/p/w154/emthp39XA2YScoYL1p0sdbAH2WA.jpg",
	},
	{
		providerId: 10,
		provider_name: "Amazon Video",
		logo: "https://image.tmdb.org/t/p/w154/emthp39XA2YScoYL1p0sdbAH2WA.jpg",
	},
	{
		providerId: 337,
		provider_name: "Disney Plus",
		logo: "https://image.tmdb.org/t/p/w154/7rwgEs15tFwyR9NPQ5vpzxTj19Q.jpg",
	},
	{
		providerId: 2336,
		provider_name: "JioHotstar",
		logo: "https://image.tmdb.org/t/p/w154/zdTSUEVZFXp3E0EkOMGN99QPVJp.jpg",
	},
	{ providerId: 15, provider_name: "Hulu", logo: "https://image.tmdb.org/t/p/w154/bxBlRPEPpMVDc4jMhSrTf2339DW.jpg" },
	{
		providerId: 192,
		provider_name: "YouTube",
		logo: "https://image.tmdb.org/t/p/w154/pTnn5JwWr4p3pG8H6VrpiQo7Vs0.jpg",
	},
	{
		providerId: 3,
		provider_name: "Google Play Movies",
		logo: "https://image.tmdb.org/t/p/w154/8z7rC8uIDaTM91X0ZfkRf04ydj2.jpg",
	},
	{
		providerId: 68,
		provider_name: "Microsoft Store",
		logo: "https://image.tmdb.org/t/p/w154/5vfrJQgNe9UnHVgVNAwZTy0Jo9o.jpg",
	},
	{
		providerId: 35,
		provider_name: "Rakuten TV",
		logo: "https://image.tmdb.org/t/p/w154/bZvc9dXrXNly7cA0V4D9pR8yJwm.jpg",
	},
	{
		providerId: 20,
		provider_name: "maxdome Store",
		logo: "https://image.tmdb.org/t/p/w154/cBN4jd4wPq6on0kESiTlevqvlnL.jpg",
	},
	{
		providerId: 130,
		provider_name: "Sky Store",
		logo: "https://image.tmdb.org/t/p/w154/6AKbY2ayaEuH4zKg2prqoVQ9iaY.jpg",
	},
	{
		providerId: 237,
		provider_name: "Sony Liv",
		logo: "https://image.tmdb.org/t/p/w154/3973zlBbBXdXxaWqRWzGG2GYxbT.jpg",
	},
	{
		providerId: 393,
		provider_name: "FlixOlé",
		logo: "https://image.tmdb.org/t/p/w154/ozMgkAAoi6aDI5ce8KKA2k8TGvB.jpg",
	},
	{
		providerId: 385,
		provider_name: "BINGE",
		logo: "https://image.tmdb.org/t/p/w154/7QX5OdsQZrXGNBKq9SPzoPV9OYQ.jpg",
	},
	{
		providerId: 386,
		provider_name: "Peacock Premium",
		logo: "https://image.tmdb.org/t/p/w154/2aGrp1xw3qhwCYvNGAJZPdjfeeX.jpg",
	},
	{
		providerId: 387,
		provider_name: "Peacock Premium Plus",
		logo: "https://image.tmdb.org/t/p/w154/drPlq5beqXtBaP7MNs8W616YRhm.jpg",
	},
	{
		providerId: 397,
		provider_name: "BBC America",
		logo: "https://image.tmdb.org/t/p/w154/jfXLhMzHHmBYrtE9ZaW7as2RA98.jpg",
	},
	{ providerId: 631, provider_name: "HRTi", logo: "https://image.tmdb.org/t/p/w154/Z2up2zbp5sdLWagSQmaPozkIKM.jpg" },
	{
		providerId: 633,
		provider_name: "Paramount+ Roku Premium Channel",
		logo: "https://image.tmdb.org/t/p/w154/ywIoxSjoYJGUIbR6BfxUiCHdPi3.jpg",
	},
	{
		providerId: 634,
		provider_name: "Starz Roku Premium Channel",
		logo: "https://image.tmdb.org/t/p/w154/9laPF1MAiUxlqM8T98F3Gj0bhzd.jpg",
	},
	{
		providerId: 635,
		provider_name: "AMC+ Roku Premium Channel",
		logo: "https://image.tmdb.org/t/p/w154/gAGrSQCTAisxy2CsWbijVvJEnRo.jpg",
	},
	{
		providerId: 232,
		provider_name: "Zee5",
		logo: "https://image.tmdb.org/t/p/w154/vPIW5b0ebTLj9bFCZypoBbF8wSl.jpg",
	},
	{
		providerId: 158,
		provider_name: "Viu",
		logo: "https://image.tmdb.org/t/p/w154/o7WsYI2r1llIf9h6JTGVX9yTHPx.jpg",
	},
	{
		providerId: 2,
		provider_name: "Apple TV",
		logo: "https://image.tmdb.org/t/p/w154/9ghgSC0MA082EL6HLCW3GalykFD.jpg",
	},
];

module.exports = { promisePool, ott_providers };
