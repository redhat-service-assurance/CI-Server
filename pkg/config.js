module.exports = {
	github_user: process.env.GITHUB_USER,
	oauth_token: process.env.OAUTH_TOKEN,
	organization: process.env.ORGANIZATION,
	webhook_proxy: process.env.WEBHOOK_PROXY
};

if(module.exports.webhook_proxy){
	console.log("Utilizing smee.io webhook proxy at " + module.exports.webhook_proxy);
}

if (!module.exports.oauth_token || !module.exports.github_user) {
	console.log("Warning: OAUTH_TOKEN or GITHUB_USER env variables not set. Ci server functionality may be reduced");
}
if (module.exports.organization){
	console.log("Using organization " + module.exports.organization + ". \nNote: organization name takes precedence over user in API calls."
	+ " This means some CI features may not work in user repositories.")
}


