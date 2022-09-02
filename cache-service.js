const { createClient } = require("redis");

const redisClient = createClient({
	legacyMode: true,
	socket: {
		host: process.env.REDIS_HOST,
		port: process.env.REDIS_PORT,
	},
});

(async function () {
	await redisClient.connect();
	redisClient.on("error", (error) => {
		console.error(`Error connecting to Redis: ${error}`);
	});
})();

async function get(key) {
	const value = await redisClient.get(key);

	return value === undefined ? null : JSON.parse(value);
}

async function set(key, value, ttl = Infinity) {
	await redisClient.set(key, JSON.stringify(value));
	if (Number.isFinite(ttl)) await redisClient.expire(key, ttl);
}

function contains(key) {
	return redisClient.exists(key);
}

module.exports = {
	get,
	set,
	contains,
};
