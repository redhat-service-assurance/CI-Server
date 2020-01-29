const request = require('request');
const child_process = require('child_process');
const fs = require('fs');

// Provide functions to track remote repo in a local repo
function Repo({user, name, organization} = {}){
    var __current_branch;
    var __path; 
    var __ref;

    this.__user = user;
    this.__name = name;
    this.__organization = organization;

    this.__sync_branch = (callback) => {
        return child_process.exec('sh scripts/sync-branch.sh -p ' + this.__path + ' -r ' + this.__ref + ' -b ' + this.__current_branch, (err, stdout, stderr) => {
            callback(err, stdout, stderr);
        })
    }

    this.runCommand = (command, callback) => {
        return child_process.exec('cd ' + this.__path + ' && ' + command, callback)
    }

    // sync repo to origin ref 
    this.sync = (ref, callback) => {
        refObj = ref.split('/');

        this.__current_branch = refObj[refObj.length - 1]
        this.__path = '/var/tmp/';
        this.__ref = ref;
        
        var subpath = this.__organization;
        if(!subpath){
            subpath = this.__user;
        }

        if (!fs.existsSync(this.__path + name)) {
            console.log('Tracking new repository ' + this.__name)
            child_process.exec('cd ' + this.__path + ' && git clone https://www.github.com/' + subpath + '/' + this.__name + '.git')
            .on('exit', (code) => {
                this.__path = this.__path + this.__name;
                return this.__sync_branch(callback);
            })
        } else {
            console.log('Using existing repository "' + this.__name + '"');

            this.__path = this.__path + this.__name;
            return this.__sync_branch(callback);
        }
    }
}

function User({oauth_token, username, organization} = {}) {
    this.__repos = new Map();
    this.__oauth_token = oauth_token;
    this.__base_url = 'https://api.github.com';
    this.__user = username;
    this.__organization = organization
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

    // register and track new repo
    this.registerRepo = (repoName) => {
        if (!this.__repos.has(repoName)) {
            this.__repos.set(repoName, new Repo({
                user: this.__user,
                name: repoName,
                organization: this.__organization
            }));
        }
    }

    this.syncRepo = ({repoName, ref} = {}, callback) => {
        return this.__repos.get(repoName).sync(ref, (err, stdout, stderr) => {
            callback(err,stdout,stderr);
        });
    }

    // run command in repo
    this.runInRepo = ({repoName, command} = {}, callback) => {
        return this.__repos.get(repoName).runCommand(command, callback);
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

        var subpath = this.__organization;
        if(!subpath){
            subpath = this.__user;
        }

        this.request({
            method: 'POST',
            endpoint: '/repos/' + subpath + '/' + repoName + '/statuses/' + sha,
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
        } else {
            console.log("User successfully authorized");
        }
    })
}
module.exports = User 