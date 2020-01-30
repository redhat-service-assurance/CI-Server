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

function runTest(chunkObj) {
    user.registerRepo(chunkObj.repository.name);

    //sync repo
    user.syncRepo({
        repoName: chunkObj.repository.name,
        ref: chunkObj.ref
    }, (err, stdout, stderr) => {
        if(err){
            console.log("Warning: failed to sync repo " + chunkObj.repository.name +  " with " + err + " " + stderr);
        } else {
            console.log(stdout + stderr);
        }

        //run tests
        user.runInRepo({
            repoName: chunkObj.repository.name,
            command: 'sh ci.sh'
        }, (err, stdout, stderr) => {

            console.log(stdout + stderr);
            if(err) {
                user.status = "failure";
            } else {
                user.status = "success";
            }             
            user.postGist("Test results\n\n" + stdout + stderr, (error) => {
                if(error) {
                    console.log('Could not post test output to gist: ');
                    console.log(error);
                } else {
                    user.updateStatus({
                        repoName: chunkObj.repository.name,
                        ref: chunkObj.ref,
                        sha: chunkObj.after,
                        status: user.status 
                    }, (err, resp, body) => {
                        if(body.message) {
                            console.log("Failed to update statuses: " + body.message);
                        } else {
                            console.log("Posted status updates to repo " + chunkObj.repository.name);
                        }
                    });
                }
            });
        })
        .stdout.pipe(process.stdout);
    });
    console.log("Test complete");
}

app.post('/commit', (req, res) => {
    req.on('data', (chunk) => {
        chunkObj = JSON.parse(chunk);
        user.updateStatus({
            repoName: chunkObj.repository.name,
            ref: chunkObj.ref,
            sha: chunkObj.after,
            status: 'pending'
        }, (err, resp, body) => {
            if(body.message) {
                console.log("Failed to update statuses: " + body.message);
            } else {
                console.log("Posted status updates to repo " + chunkObj.repository.name);
            }
        });
        runTest(chunkObj);
        console.log('Waiting for new test')
    });
});

var server = app.listen(3000, () => {
    console.log("Listening on port 3000 for github webhooks");
})