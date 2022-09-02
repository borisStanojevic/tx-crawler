const axios = require("axios");
const Agent = require("agentkeepalive");

axios.defaults.httpsAgent = new Agent.HttpsAgent({
	maxSockets: 100,
	maxFreeSockets: 10,
	timeout: 120000,
	freeSocketTimeout: 60000,
});

async function get(url) {
	const errorOrData = await axios
		.get(url)
		.then((response) => response.data)
		.catch((error) => error);

	if (errorOrData instanceof Error) {
		console.error(errorOrData);
		throw new Error("Unsuccessful HTTP response.");
	}

	return errorOrData;
}

module.exports = {
	get,
};
