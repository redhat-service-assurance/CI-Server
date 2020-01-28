module.exports = {
	oauth_token: process.env.OAUTH_TOKEN
};

if (!module.exports.oauth_token) {
	console.log("Warning: OAUTH_TOKEN env not set. Ci server may not be able to access github resources");
}


