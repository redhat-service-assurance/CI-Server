module.exports = {
	github_user: process.env.GITHUB_USER,
	oauth_token: process.env.OAUTH_TOKEN,
	organization: process.env.ORGANIZATION,
	webhook_proxy: process.env.WEBHOOK_PROXY,
	reporting: process.env.hasOwnProperty('REPORTING') ? (process.env.REPORTING == 'true') : true,
	workers: process.env.hasOwnProperty('WORKERS') ? parseInt(process.env.WORKERS) : require('os').cpus().length
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

if( !module.exports.reporting ){
	console.log("Warning: reporting disabled in server config. No status updates will be posted to origin");
}