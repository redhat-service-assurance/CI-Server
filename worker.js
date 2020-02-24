const User = require('./pkg/user');
const config = require('./pkg/config');
const JobConf = require('./pkg/config-jobs');
const { parentPort, workerData } = require("worker_threads");

jobconf = new JobConf();

user = new User({
    oauth_token: config.oauth_token,
    username: config.github_user,
    organization: config.organization
});

user.getAuthStatus().catch((error) => {
    console.log(error);
});

async function runScript({script, repoName, ref, ocp_project} = {}){
    // script: list of commands
    env_clone = process.env;
    var env_clone = Object.create( process.env );
    env_clone.OCP_PROJECT = ocp_project;
    env_clone.HOME = '/var/tmp/' + repoName + '/' + ref;

    let complete_comm = "set -e;";
    for (let comm of script) {
        complete_comm += comm + ';'
    }

    return await user.runInRepo({ 
        repoName: repoName,
        command: complete_comm,
        ref: ref,
        env_vars: env_clone,
        timeout: jobconf.global.timeout 
    });
}

async function execJob(chunkObj) {

    let refSanitized = chunkObj.ref.replace(/\//g, '-');

    // update local repo with remote changes
    user.registerRepo(chunkObj.repository.name);

    // kill any previous jobs running in this repo
    await user.killRepoJob(chunkObj.repository.name, refSanitized, () => {
        user.updateStatus({
            repoName: chunkObj.repository.name,
            ref: refSanitized,
            sha: chunkObj.after,
            status: ''
        })       
    });
    
    // sync new changes to local repo
    await user.syncRepo({
        repoName: chunkObj.repository.name,
        ref: refSanitized,
        tree_sha: chunkObj.head_commit.tree_id
    });

    // read in job config
    jobconf.reset();
    try{
        jobconf.read('/var/tmp/' + chunkObj.repository.name + '/' + refSanitized + '/ci.yml');
    } catch(err) {
        console.log(err);
        return
    }

    // post pending status
    if( jobconf.global.report.github && config.reporting ){
        user.updateStatus({
            repoName: chunkObj.repository.name,
            ref: refSanitized,
            sha: chunkObj.after,
            status: 'pending'
        }).then( (data) => {
            if(data.body.message) {
                console.log("[CI Server] Failed to update 'pending' statuses to " + chunkObj.repository.name + " with: " + body.message);
            } else {
                console.log("[CI Server] Posted status 'pending' to repo " + chunkObj.repository.name);
            }
        }).catch((err) => {
            console.log("Failed to update status: " + err);
        })
    }

    //run scripts
    console.log("\n\nRunning Scripts");
    results = await runScript({
        script: jobconf.script, 
        repoName: chunkObj.repository.name,
        ref: refSanitized, 
        ocp_project: chunkObj.after
    })

    let end_status = "";
    if(results.code == 2) {
        await user.killRepoJob(chunkObj.repository.name, refSanitized);
        end_status = "failure";
    } else if(results.code != 0) {
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
        ref: refSanitized,
        ocp_project: chunkObj.after
    });

    if(asResults.code == 2) { //timeout happened
        await user.killRepoJob(chunkObj.repository.name, refSanitized);
    }


    if( jobconf.global.report.github && config.reporting ){
        user.postGist("## Script results \n```" + results.data + "```\n\n## After Scripts\n```" + asResults.data + "```", (error, url) => {
            if(error) {
                console.log('Could not post test output to gist: ');
                console.log(error);
            } else {
                console.log("Gist available at: " + url);
            }

            // post final script statuses
            user.updateStatus({
                repoName: chunkObj.repository.name,
                ref: refSanitized,
                sha: chunkObj.after,
                status: end_status,
                url: url
            }).then( (data) => {
                if(data.body.message) {
                    console.log("[CI Server] Failed to update statuses: " + body.message);
                } else {
                    console.log("[CI Server] Posted status '" + end_status + "' to repo " + chunkObj.repository.name);
                }
            }).catch((err) => {
                console.log("Failed to update status: " + err);
            })
        });
    }
}

parentPort.on('message', async (chunk) => {
    await execJob(chunk);
    parentPort.postMessage('complete');
});