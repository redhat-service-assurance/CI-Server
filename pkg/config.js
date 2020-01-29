module.exports = {
	github_user: process.env.GITHUB_USER,
	oauth_token: process.env.OAUTH_TOKEN,
	organization: process.env.ORGANIZATION
};

if (!module.exports.oauth_token || !module.exports.github_user) {
	console.log("Warning: OAUTH_TOKEN or GITHUB_USER env variables not set. Ci server functionality may be reduced");
}


