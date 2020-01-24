const express = require('express');
const request = require('request');
const child_process = require('child_process');
const yargs = require('yargs');

var repo = '/home/pleimer/Continuous-Integration-Server/dummy';
var apiUrl = 'https://api.github.com/repos/pleimer/dummy/statuses/'
var app = express();

const argv = yargs
	.option('token', {
			alias: 't',
			description: 'Token for github OAuth',
			type: 'string'
	})
	.help()
	.alias('help','h')
	.argv;

var headers = {
	'Authorization': 'token ' + argv.token,
	'User-Agent': 'curl/7.54'
}

function status_payload_json(state, desc) {
	return {
		"state": state,
		"description": desc,
		"target_url": "https://www.github.com",
		"context": "Paul's CI Bot"
	}
}

function status_payload(state) {
	switch(state) {
		case "success":
			return status_payload_json(state, "All checks passed")
		case "failure":
			return status_payload_json(state, "Some tests failed")
		default:
			return null
	}
}

function run_shell_comm(command, cb) {
	child_process.exec(command, (err, stdout, stderr) => {
		if (err) {
			console.log(err);
		}
		console.log(command)
		console.log(stdout + "\n")
		console.log(stderr + "\n")
	}).on('exit', code => cb(code));
}

function post_status_update(state) {
	request.post({url: url, json: status_payload(state), headers: headers }, function (err, response, body) {
		if (err) {
			console.log("Failed to post status update to PR: " + err);
		} else {
			console.log("Updated status with " + state);
		}
	});
}

function check_branch(refs) {
	if (!refs) {
		console.log("No git refs specified")
		return null
	}
	try{
		child_process.execSync("cd " + repo + " && git show-ref --verify --quiet " + refs);
	} catch(err) {
		console.log("Creating new feature branch");
		
		refObj = refs.split('/');
		branch = refObj[refObj.length - 1];
		try{ 
			child_process.execSync("cd " + repo + " && git checkout --track origin/" + branch);
			console.log("Created new feature branch");
		} catch(err) {
			console.log("Failed to create new branch");
		}
	}
}

app.post('/events', function (req, res) {
	req.on('data', function(chunk) {
		//get feature branch
		check_branch(JSON.parse(chunk).ref);
		run_shell_comm('cd ' + repo + ' && git pull', function(exitStatus) {
			//get PR url
			url = apiUrl + JSON.parse(chunk).after;
			console.log(url)

			//run tests
			run_shell_comm('cd ' + repo + '/tests/ && sh run.sh', function(exitCode) {
				console.log(exitCode)
				if(exitCode != 0) {
					console.log("Tests failed")
					post_status_update("failure");
				} else {
					console.log("Tests passed")
					post_status_update("success")
				}
			});
		});
	});
});

var server = app.listen(3000, function () {
	console.log("Listening on port 3000 for github webhooks")
});

