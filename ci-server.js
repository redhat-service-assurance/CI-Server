const express = require('express'); 
const request = require('request');
const child_process = require('child_process');
const User = require('./pkg/user');
const { oauth_token, github_user, organization} = require('./pkg/config');
const JobConf = require('./pkg/config-jobs');

var app = express();

jobconf = new JobConf();

user = new User({
    oauth_token: oauth_token,
    username: github_user,
    organization: organization
});

user.getAuthStatus();

async function runScript({script, repoName, ref, ocp_project} = {}){
    // script: list of commands
    let output_buff = "";
    var results;
    for (let comm of script) {
        results = await user.runInRepo({
            repoName: repoName,
            command: comm,
            ref: ref,
            env_vars: {
                'OCP_PROJECT': ocp_project,
                'KUBECONFIG': '/.kube/config'
            }
        });
        output_buff += results.data;

        if(results.code != 0) {
            results.data = output_buff; 
            return results;
        }            
    }
    results.data = output_buff;
    return results;
}

async function execJob(chunkObj) {

    // update local repo with remote changes
    user.registerRepo(chunkObj.repository.name);

    await user.syncRepo({
        repoName: chunkObj.repository.name,
        ref: chunkObj.ref
    })

    // read in job config
    jobconf.read('/var/tmp/' + chunkObj.repository.name + '/ci.yml');

    //run scripts
    console.log("\n\nRunning Scripts");
    results = await runScript({
        script: jobconf.script, 
        repoName: chunkObj.repository.name,
        ref: chunkObj.ref, 
        ocp_project: chunkObj.after
    });

    let end_status = "";
    if(results.code != 0) {
        end_status = "failure";
    } else {
        end_status = "success";
    }             

    console.log('Script for ' + chunkObj.repository.name + ':' + chunkObj.after + ' ended with status ' + end_status)

   // run after_script 

    console.log("\n\nRunning After_Script");

    asResults = await runScript({
        script: jobconf.after_script, 
        repoName: chunkObj.repository.name,
        ref: chunkObj.ref, 
        ocp_project: chunkObj.after
    });

    user.postGist("******Script results******\n" + results.data + "\n\n******After Scripts******\n" + asResults.data, (error, url) => {
        if(error) {
            console.log('Could not post test output to gist: ');
            console.log(error);
        } else {
            console.log("Gist available at: " + url);
        }

        // post final script statuses
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
        execJob(chunkObj);
    });
});

var server = app.listen(3000, () => {
    console.log("Listening on port 3000 for github webhooks");
})