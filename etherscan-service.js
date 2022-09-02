const httpClient = require("./http-client.js");

function getTransactionListByAddress(address, parameters) {
	const startBlock = parameters.startBlock;
	const endBlock = parameters.endBlock;

	return httpClient.get(
		`https://api.etherscan.io/api?module=account&action=txlist&address=${address}&startblock=${startBlock}&endblock=${endBlock}&sort=desc&apikey=${process.env.ETHERSCAN_API_KEY}`
	);
}

module.exports = {
	getTransactionListByAddress,
};
