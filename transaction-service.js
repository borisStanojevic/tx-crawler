const { ethers, BigNumber } = require("ethers");
const cacheService = require("./cache-service.js");
const dateService = require("./date-service.js");
const pricingService = require("./pricing-service.js");
const etherscanService = require("./etherscan-service.js");

const INFURA_API_KEY = "a762641c593049e1a1b9d71339f23a84";

const provider = new ethers.providers.JsonRpcBatchProvider(
	`https://mainnet.infura.io/v3/${INFURA_API_KEY}`
);

async function getTransactionListByAddress(address, startBlock) {
	const endBlock = await getLatestBlockNumber();

	let transactions = await cacheService.get(
		`TRANSACTIONS:${address}:${startBlock}-${endBlock}`
	);

	if (transactions) return transactions;

	const transactionsResponse =
		await etherscanService.getTransactionListByAddress(address, {
			startBlock,
			endBlock,
		});

	transactions = transactionsResponse.result;

	const addressSet = new Set();
	transactions.forEach((transaction) => {
		addressSet.add(transaction.from);
		addressSet.add(transaction.to);
	});
	const addresses = [...addressSet];

	const [etherPriceHistory, balances] = await Promise.all([
		pricingService.getEtherPriceHistory(),
		getEtherBalancesForAddresses(addresses),
	]);

	const etherBalanceTable = createEtherBalanceTable(addresses, balances);
	await cacheService.set("ETHER_BALANCE_TABLE", etherBalanceTable, 60);

	transactions.forEach((transaction) => {
		processTransaction(transaction, etherPriceHistory, etherBalanceTable);
	});

	await cacheService.set(
		`TRANSACTIONS:${address}:${startBlock}-${endBlock}`,
		transactions
	);

	return transactions;
}

async function getLatestBlockNumber() {
	let latestBlockNumber = await cacheService.get("LATEST_BLOCK_NUMBER");
	if (latestBlockNumber) return latestBlockNumber;

	const latestBlock = await provider.getBlock();
	latestBlockNumber = latestBlock.number;
	const averageBlockCreationTimeInSeconds = 12;
	await cacheService.set(
		"LATEST_BLOCK_NUMBER",
		latestBlockNumber,
		averageBlockCreationTimeInSeconds
	);

	return latestBlockNumber;
}

function getEtherBalancesForAddresses(addresses) {
	return Promise.all(
		addresses.map((address) =>
			provider
				.getBalance(address)
				.then((balance) => ethers.utils.formatEther(balance))
		)
	);
}

function createEtherBalanceTable(addresses, balances) {
	const etherBalanceTable = {};
	balances.forEach((balance, index) => {
		etherBalanceTable[addresses[index]] = balance;
	});

	return etherBalanceTable;
}

function processTransaction(transaction, etherPriceHistory, etherBalanceTable) {
	transaction.isRegularTransaction = transaction.value !== "0";
	transaction.isSuccessful = transaction.isError === "0" ? true : false;
	transaction.date = dateService.formatDate(
		dateService.createDateFromUnixTimestamp(transaction.timeStamp)
	);
	transaction.index = transaction.transactionIndex;

	const etherPriceOnTransactionDate =
		etherPriceHistory[
			transaction.date.substring(0, transaction.date.indexOf(","))
		];
	transaction.etherPriceOnTransactionDate = etherPriceOnTransactionDate;

	const transactionFeeInEther = calculateTransactionFeeInEther(transaction);
	const transactionFeeOnTransactionDate =
		transactionFeeInEther * etherPriceOnTransactionDate;
	transaction.feeInEther = transactionFeeInEther;
	transaction.feeInDollarsOnTransactionDate =
		transactionFeeOnTransactionDate.toFixed(2);

	transaction.gasPriceInEther = formatWeiToEther(transaction.gasPrice);
	transaction.gasPriceInGwei = formatWeiToGwei(transaction.gasPrice);

	const percentageOfGasUsed = calculatePercentageOfGasUsed(transaction);
	transaction.percentageOfGasUsed =
		percentageOfGasUsed % 10 === 0
			? percentageOfGasUsed
			: percentageOfGasUsed.toFixed(2);

	if (transaction.isRegularTransaction) {
		processRegularTransaction(transaction);

		delete transaction.contractAddress;
		delete transaction.methodId;
		delete transaction.functionName;
	} else {
		processContractTransaction(transaction);

		delete transaction.methodId;
		delete transaction.functionName;
	}

	const senderAddress = transaction.from;
	let etherBalance = etherBalanceTable[senderAddress];
	transaction.sender = {
		address: senderAddress,
		etherBalance,
	};

	const receiverAddress = transaction.to;
	etherBalance = etherBalanceTable[receiverAddress];
	transaction.receiver = {
		address: receiverAddress,
		etherBalance,
	};

	delete transaction.isError;
	delete transaction.timeStamp;
	delete transaction.transactionIndex;
	delete transaction.txreceipt_status;
	delete transaction.to;
	delete transaction.from;

	return transaction;
}

function processRegularTransaction(transaction) {
	if (!transaction.isRegularTransaction)
		throw new Error(
			"The function expects a regular transaction. Received a contract transaction."
		);

	const valueInEther = formatWeiToEther(transaction.value);
	const valueOnTransactionDate =
		valueInEther * transaction.etherPriceOnTransactionDate;
	transaction.valueInEther = valueInEther;
	transaction.valueOnTransactionDateInDollars =
		valueOnTransactionDate.toFixed(2);

	return transaction;
}

function processContractTransaction(transaction) {
	if (transaction.isRegularTransaction)
		throw new Error(
			"The function expects a contract transaction. Received a regular transaction."
		);

	if (
		transaction.isSuccessful ||
		(transaction.input !== "0x" && transaction.functionName)
	)
		transaction.inputData = parseInputData(transaction);

	if (transaction.isSuccessful && isErc20TokenTransfer(transaction))
		processErc20TokenTransferTransaction(transaction);

	return transaction;
}

function isErc20TokenTransfer(transaction) {
	return transaction.methodId === "0xa9059cbb";
}

function processErc20TokenTransferTransaction(transaction) {
	if (!isErc20TokenTransfer(transaction))
		throw new Error(
			"The function expects an ERC20 token transfer transaction."
		);

	transaction.isErc20TokenTransfer = true;

	const amount =
		transaction.inputData.arguments[
			transaction.inputData.arguments.length - 1
		][2];

	transaction.tokenTransfer = {
		senderAddress: transaction.from,
		receiverAddress: transaction.to,
		amount,
	};

	return transaction;
}

function parseInputData(transaction) {
	const functionName = transaction.functionName;
	const input = transaction.input;

	const [openParenthesisIndex, closedParenthesisIndex] =
		getParenthesisIndexPair(functionName);

	const [argumentTypes, argumentNames] = functionName
		.slice(openParenthesisIndex + 1, closedParenthesisIndex)
		.split(" ")
		.reduce(
			(result, element, index) => {
				result[index % 2 == 0 ? 0 : 1].push(element);
				return result;
			},
			[[], []]
		);

	const interface = new ethers.utils.Interface([`function ${functionName}`]);
	const fragment = interface.getFunction(functionName);
	const functionData = interface.decodeFunctionData(fragment, input);

	const arguments = functionData.map(function (value, index) {
		return [
			argumentTypes[index],
			argumentNames[index].replace(",", ""),
			BigNumber.isBigNumber(value) ? value.toString() : value,
		];
	});

	return {
		methodId: transaction.methodId,
		functionName,
		arguments,
	};
}

function getParenthesisIndexPair(functionName) {
	let openParenthesisIndex = -1;
	let closedParenthesisIndex = -1;

	for (let i = 0; i < functionName.length; i++) {
		if (functionName[i] === "(") openParenthesisIndex = i;
		if (functionName[i] === ")") closedParenthesisIndex = i;
	}

	return [openParenthesisIndex, closedParenthesisIndex];
}

function calculateTransactionFeeInEther(transaction) {
	const gasPrice = BigNumber.from(transaction.gasPrice);
	const gasUsed = BigNumber.from(transaction.gasUsed);

	const transactionFee = gasPrice.mul(gasUsed);

	return formatWeiToEther(transactionFee);
}

function formatWeiToEther(weiAmount) {
	return ethers.utils.formatEther(weiAmount);
}

function formatWeiToGwei(weiAmount) {
	return ethers.utils.formatUnits(weiAmount, "gwei");
}

function calculatePercentageOfGasUsed(transaction) {
	return (transaction.gasUsed / transaction.gas) * 100;
}

module.exports = {
	getTransactionListByAddress,
};
