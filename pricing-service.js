const coinGeckoService = require("./coin-gecko-service.js");
const dateService = require("./date-service.js");
const cacheService = require("./cache-service.js");

const ETHEREUM_BIRTH_UNIX_TIMESTAMP = 1438214400;

async function getEtherPriceHistory() {
	let priceHistory = await cacheService.get("ETHER_PRICE_HISTORY");
	if (priceHistory) return priceHistory;

	const response = await coinGeckoService.getMarketChartInRange({
		coinId: "ethereum",
		currency: "usd",
		from: ETHEREUM_BIRTH_UNIX_TIMESTAMP,
		to: dateService.getCurrentUnixTimestamp(),
	});

	const prices = response["prices"];

	priceHistory = createPriceHistory(prices);
	const oneDayInSeconds = 24 * 3600;
	await cacheService.set("ETHER_PRICE_HISTORY", oneDayInSeconds);

	return priceHistory;
}

async function getCurrentEtherPrice() {
	let currentEtherPrice = await cacheService.get("CURRENT_ETHER_PRICE");
	if (currentEtherPrice) return currentEtherPrice;

	const response = await coinGeckoService.getCurrentCoinPrice(
		"ethereum",
		"usd"
	);

	currentEtherPrice = response["ethereum"]["usd"];

	const halfHourInSeconds = 0.5 * 3600;
	await cacheService.set(
		"CURRENT_ETHER_PRICE",
		currentEtherPrice,
		halfHourInSeconds
	);

	return currentEtherPrice;
}

function createPriceHistory(prices) {
	const priceHistory = {};
	prices.forEach((price) => {
		const priceTimestampInMilliseconds = price[0];
		const date = dateService.formatDate(
			new Date(priceTimestampInMilliseconds)
		);
		const dateSegment = date.substring(0, date.indexOf(","));
		priceHistory[`${dateSegment}`] = price[1];
	});

	return priceHistory;
}

module.exports = {
	getEtherPriceHistory,
	getCurrentEtherPrice,
};
