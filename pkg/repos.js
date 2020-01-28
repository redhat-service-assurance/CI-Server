const request = require('request');
const child_process = require('child_process');
const fs = require('fs');

// Provide functions to track remote repo in a local repo
function Repo({user, name} = {}){
    var __current_branch;
    var __path; 
    var __ref;

    this.__user = user;
    this.__name = name;

    // Sync branch with upstream repo 
    this.__reconcile_branch = (callback) => {
        child_process.exec('cd ' + this.__path + ' && git show-ref --verify --quiet ' + this.__ref, (err, stdout, stderr) => {
            callback(err,stdout,stderr);
        })
        .on('exit', (code) => {
            if (code != 0) {
                console.log('Creating new branch ' + this.__current_branch);

                child_process.exec('cd ' + this.__path + ' && git checkout --track origin/' + this.__current_branch, (err, stdout, stderr) => {
                    callback(err,stdout,stderr);
                })
                .on('exit', (code) => {
                    child_process.exec('cd ' + this.__path + ' && git pull', (err, stdout, stderr) => {
                        callback(err,stdout,stderr);
                    });
                });
            } else {
                console.log('Updating existing branch ' + this.__current_branch);
                child_process.exec('cd ' + this.__path + ' && git pull', (err, stdout, stderr) => {
                    callback(err,stdout,stderr);
                });
            }
        });
    }

    this.__sync_branch = (callback) => {
        child_process.exec('sh ../scripts/sync-branch.sh -p ' + this.__path + ' -r ' + this.__ref + ' -b ' + this.__current_branch, (err, stdout, stderr) => {
            callback(err, stdout, stderr);
        })
    }

    // sync repo to origin ref 
    this.sync = (ref, callback) => {
        refObj = ref.split('/');

        this.__current_branch = refObj[refObj.length - 1]
        this.__path = '/var/tmp/';
        this.__ref = ref;

        if (!fs.existsSync(this.__path + name)) {
            console.log('Tracking new repository ' + this.__name)
            child_process.exec('cd ' + this.__path + ' && git clone https://www.github.com/' + user + '/' + this.__name + '.git', (err, stdout, stderr) => {
                callback(err, stdout, stderr);
            })
            .on('exit', (code) => {
                this.__path = this.__path + this.__name;
                // this.__reconcile_branch(callback);
                this.__sync_branch(callback);
            })
        } else {
            console.log('Using existing repository "' + this.__name + '"');

            this.__path = this.__path + this.__name;
            //this.__reconcile_branch(callback);
            this.__sync_branch(callback);
        }
    }
}

function User({oauth_token, username} = {}) {
    this.__repos = new Map();
    this.__oauth_token = oauth_token;
    this.__base_url = 'https://api.github.com';
    this.__user = username;
    this.__headers = {
        'Authorization': 'token ' + this.__oauth_token,
        'User-Agent': username 
    }

    // function definitions
    this.request = ({method, endpoint = '', json = null} = {}, callback) => {
        url = this.__base_url + endpoint;
        switch(method) {
            case 'GET':
                return request.get({url: url, json: json, headers: this.__headers}, callback)
            case 'POST':
                return request.post({url: url, json: json, headers: this.__headers}, callback)
            default:
                throw 'Unrecognized HTTP method';
        }
    };

    this.newRepo = (repoName, callback) => {
        this.__repos.set(repoName, new Repo({
            user: this.__user,
            name: repoName
        }));
        this.__repos.get(repoName).sync('/refs/heads/master', (err, stdout, stderr) => {
            callback(err, stdout, stderr);
        });
    }

    this.updateStatus = ({repoName, ref, sha, status} = {}, callback) => {
        var desc;
        switch(status){
            case 'success':
                desc = 'All checks passed';
                break;
            case 'failure':
                desc = 'Some checks failed';
                break;
            default:
                callback('Unrecognized status');
                return;
        }

        this.request({
            method: 'POST',
            endpoint: '/repos/' + this.__user + '/' + repoName + '/statuses/' + sha,
            json: {
                'state': status,
                'description': desc,
                'target_url': 'https://www.redhat.com',
                'context': 'CI Bot'
            }
        }, callback);
    }


    // finish setup
    this.request({
        method: 'GET',
    }, (error, response, body) => {
        if (response.headers.status != '200 OK') {
            console.log('Warning: authorization failed with message: ' + response.headers.status);
        }
    })
}
module.exports = User 