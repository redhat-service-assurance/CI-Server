module.exports = {
	github_user: process.env.GITHUB_USER,
	oauth_token: process.env.OAUTH_TOKEN,
	organization: process.env.ORGANIZATION
};

if (!module.exports.oauth_token || !module.exports.github_user) {
	console.log("Warning: OAUTH_TOKEN or GITHUB_USER env variables not set. Ci server functionality may be reduced");
}
if (module.exports.organization){
	console.log("Using organization " + module.exports.organization + ". Note: organization name takes precedence over user in API urls"
	+ ". This means some CI features may not work in user repositories.")
}


