const express = require("express");
const transactionService = require("./transaction-service.js");
const pricingService = require("./pricing-service.js");

const server = express();
server.set("view engine", "pug");

server.get("/transactions/:address", async function (request, response) {
	const address = request.params.address;
	const startBlock = request.query.startBlock;

	const [currentEtherPrice, transactions] = await Promise.all([
		pricingService.getCurrentEtherPrice(),
		transactionService.getTransactionListByAddress(address, startBlock),
	]);

	return response.render("index", { currentEtherPrice, transactions });
});

server.listen(process.env.PORT, function () {
	console.log(`Server listening...`);
});
