const Redis = require("ioredis");

const redis = new Redis({
	host: process.env.REDIS_HOST,
	port: process.env.REDIS_PORT,
	username: process.env.REDIS_USERNAME,
	password: process.env.REDIS_PASSWORD,

	maxRetriesPerRequest: 1,
	enableOfflineQueue: false,
	connectTimeout: 5000,
});

redis.on("connect", () => {
	console.log("✅ Redis Cloud connected");
});

redis.on("error", (err) => {
	console.error("❌ Redis error", err.message);
});

module.exports = redis;
