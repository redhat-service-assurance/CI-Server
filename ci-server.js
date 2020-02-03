const express = require('express'); 
const request = require('request');
const child_process = require('child_process');
const User = require('./pkg/user');
const { oauth_token, github_user, organization} = require('./pkg/config');

var app = express();

user = new User({
    oauth_token: oauth_token,
    username: github_user,
    organization: organization
});

user.getAuthStatus();

async function runTest(chunkObj) {
    user.registerRepo(chunkObj.repository.name);

    await user.syncRepo({
        repoName: chunkObj.repository.name,
        ref: chunkObj.ref
    })    

    //run tests
    console.log("\n\nTest Output");
    results = await user.runInRepo({
        repoName: chunkObj.repository.name,
        command: 'sh ci.sh'
    });
    let end_status = "";
    if(results.code != 0) {
        end_status = "failure";
    } else {
        end_status = "success";
    }             

    console.log('Test for ' + chunkObj.repository.name + ':' + chunkObj.after + ' ended with status ' + end_status)
    user.postGist("Test results\n\n" + results.stdout + results.stderr, (error, url) => { //Gotta get output to post to gist!
        if(error) {
            console.log('Could not post test output to gist: ');
            console.log(error);
        } else {
            console.log("Gist available at: " + url);
        }
    });

    user.updateStatus({
        repoName: chunkObj.repository.name,
        ref: chunkObj.ref,
        sha: chunkObj.after,
        status: end_status 
    }).then( (data) => {
        if(data.body.message) {
            console.log("[CI Server] Failed to update statuses: " + body.message);
        } else {
            console.log("[CI Server] Posted status '" + end_status + "' to repo " + chunkObj.repository.name);
        }
    });
}

app.post('/commit', (req, res) => {
    req.on('data', (chunk) => {
        chunkObj = JSON.parse(chunk);
        user.updateStatus({
            repoName: chunkObj.repository.name,
            ref: chunkObj.ref,
            sha: chunkObj.after,
            status: 'pending'
        }).then( (data) => {
            if(data.body.message) {
                console.log("[CI Server] Failed to update 'pending' statuses to " + chunkObj.repository.name + " with: " + body.message);
            } else {
                console.log("[CI Server] Posted status 'pending' to repo " + chunkObj.repository.name);
            }
        });
        runTest(chunkObj);
    });
});

var server = app.listen(3000, () => {
    console.log("Listening on port 3000 for github webhooks");
})