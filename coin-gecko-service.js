const httpClient = require("./http-client.js");

function getMarketChartInRange(parameters) {
	const coinId = parameters.coinId;
	const currency = parameters.currency;
	const from = parameters.from;
	const to = parameters.to;

	return httpClient.get(
		`https://api.coingecko.com/api/v3/coins/${coinId}/market_chart/range?vs_currency=${currency}&from=${from}&to=${to}`
	);
}

function getCurrentCoinPrice(coinId, currency) {
	return httpClient.get(
		`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=${currency}`
	);
}

module.exports = {
	getMarketChartInRange,
	getCurrentCoinPrice,
};
