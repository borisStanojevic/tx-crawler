const httpClient = require("./http-client.js");

const ETHERSCAN_API_KEY = "7ZIP4RCQ52YN864M8E36GUSSFB7725XR19";

function getTransactionListByAddress(address, parameters) {
	const startBlock = parameters.startBlock;
	const endBlock = parameters.endBlock;

	return httpClient.get(
		`https://api.etherscan.io/api?module=account&action=txlist&address=${address}&startblock=${startBlock}&endblock=${endBlock}&sort=desc&apikey=${ETHERSCAN_API_KEY}`
	);
}

module.exports = {
	getTransactionListByAddress,
};
