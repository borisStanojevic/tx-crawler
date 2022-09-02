const moment = require("moment");

function getCurrentDate() {
	return new Date(Date.now());
}

function getCurrentUnixTimestamp() {
	return Math.floor(Date.now() / 1000);
}

function createDateFromUnixTimestamp(unixTimestamp) {
	if (!moment(unixTimestamp, "X", true).isValid())
		throw new Error("Expected a valid UNIX timestamp.");

	return new Date(unixTimestamp * 1000);
}

function formatDate(date, format = "MMMM Do YYYY (dddd), hh:mm:ss A") {
	if (date instanceof Date === false) throw new Error("Expected valid date.");
	if (typeof format !== "string" || !format)
		throw new Error("Format should a not empty or whitespace string.");

	return moment(date).format(format);
}

module.exports = {
	getCurrentDate,
	getCurrentUnixTimestamp,
	createDateFromUnixTimestamp,
	formatDate,
};
