const request = require('request');
const child_process = require('child_process');
const fs = require('fs');

function runCommand(command) {
    //There is a bug in the container build here, so don't use this function just yet
    child = child_process.exec(command);
    var data = "";
    var error = "";
    child.stdout.on('data', (out) => {
        data += out;
        console.log(out);
    });
    child.stderr.on('data', (out) => {
        error += out;
        console.log(out);
    });
    return new Promise( (resolve, reject) => {
        child.on('close', (code) => {
            resolve({
                code: code,
                stdout: data,
                stderr: error
            });
        });
    });
}

// Provide functions to track remote repo in a local repo
function Repo({user, oauth_token, name, organization} = {}){
    var __current_branch;
    var __path; 
    var __ref;

    this.__user = user;
    this.__name = name;
    this.__organization = organization;
    this.__oauth_token = oauth_token;

    this.run = (command) => {
        return runCommand('cd ' + this.__path + ' && ' + command);
    }

    // sync repo to origin ref 
    this.sync = (ref) => {
        refObj = ref.split('/');

        this.__current_branch = refObj[refObj.length - 1]
        this.__path = '/var/tmp/' + this.__name;
        this.__ref = ref;
        
        var subpath = this.__organization;
        if(!subpath){
            subpath = this.__user;
        }

        origin = 'github.com/' + subpath + '/' + this.__name + '.git';

        return runCommand('sh scripts/sync-branch.sh -p ' + this.__path + ' -r ' + this.__ref + ' -b ' + this.__current_branch + ' -o ' + origin + ' -t ' + this.__oauth_token);
    }
}

function User({oauth_token, username, organization} = {}) {
    this.__repos = new Map();
    this.__oauth_token = oauth_token;
    this.__base_url = 'https://api.github.com';
    this.__user = username;
    this.__organization = organization;
    this.__gist_url;
    this.__headers = {
        'Authorization': 'token ' + this.__oauth_token,
        'User-Agent': username
    }

    // function definitions
    this.request = ({method, endpoint = '', json = null} = {}) => {
        url = this.__base_url + endpoint;
        return new Promise( (resolve, reject) => {
            switch(method) {
                case 'GET':
                    request.get({url: url, json: json, headers: this.__headers}, (error, resp, body) => {
                        resolve({
                            error: error,
                            response: resp,
                            body: body
                        });
                    });
                    break;
                case 'POST':
                    request.post({url: url, json: json, headers: this.__headers}, (error, resp, body) => {
                        resolve({
                            error: error,
                            response: resp,
                            body: body
                        });
                    });
                    break;
                default:
                    reject('Unrecognized HTTP method');
            }
        });
    };
        

    // register and track new repo
    this.registerRepo = (repoName) => {
        if (!this.__repos.has(repoName)) {
            this.__repos.set(repoName, new Repo({
                user: this.__user,
                name: repoName,
                organization: this.__organization,
                oauth_token: this.__oauth_token
            }));
            console.log("Repository " + repoName + " registered");
        }
    }

    this.syncRepo = ({repoName, ref} = {}) => {
        return this.__repos.get(repoName).sync(ref);
    }

    // run command in repo
    this.runInRepo = ({repoName, command} = {}) => {
        return this.__repos.get(repoName).run(command);
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
            case 'pending':
                desc = 'Pending';
                break;
            default:
                callback('Unrecognized status');
                return;
        }

        var subpath = this.__organization;
        if(!subpath){
            subpath = this.__user;
        }

        return this.request({
            method: 'POST',
            endpoint: '/repos/' + subpath + '/' + repoName + '/statuses/' + sha,
            json: {
                'state': status,
                'description': desc,
                'target_url': this.__gist_url,
                'context': 'CI Bot'
            }
        });
    }

    this.postGist = (text, callback) => {
        this.request({
           method: 'POST',
           endpoint: '/gists',
           json: {
                'description': 'CI test results',
                'public': true,
                'files': {
                    'results.txt': {
                        'content': text
                    }
                }
           }
       }).then( (data) => {
           if(!data.body.id){
               callback(data.body);
           } else {
               this.__gist_url = 'https://gist.github.com/' + this.__user + '/' + data.body.id;
               callback(null, this.__gist_url);
           }
       });
    }


    // finish setup
    this.getAuthStatus = () => {
        return this.request({
            method: 'GET',
        }).then((data) => {
            if (data.response.headers.status != '200 OK') {
                console.log('Warning: authorization failed with message: ' + response.headers.status);
            } else {
                console.log("User successfully authorized");
            }
        })
    } 
}
module.exports = User 