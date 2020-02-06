const request = require('request');
const child_process = require('child_process');
const fs = require('fs');

function runCommand(command, env_vars) {
    child = child_process.exec(command, {env: env_vars, shell: '/bin/bash'});
    console.log(env_vars);
    var data = "";
    var error = "";
    child.stdout.on('data', (out) => {
        data += out;
        console.log(out);
    });
    child.stderr.on('data', (out) => {
        data += out;
        console.log(out);
    });
    return new Promise( (resolve, reject) => {
        child.on('close', (code) => {
            resolve({
                code: code,
                data: data
            });
        });
    });
}

function Job(){
    var __process;
    var __is_running;

    this.run = (command, env_vars) => {
        __process = child_process.exec(command, {env: env_vars, shell: '/bin/bash'});
        __is_running = true;
        var data = "";
        var error = "";
        __process.stdout.on('data', (out) => {
            data += out;
            console.log(out);
        });
        __process.stderr.on('data', (out) => {
            data += out;
            console.log(out);
        });

        return new Promise( (resolve, reject) => {
            __process.on('close', (code) => {
                __is_running = false;
                resolve({
                    code: code,
                    data: data
                });
            });
        });
    }

    this.kill = () => {
        if(__is_running) {
            __is_running = false;
            return __process.kill('SIGHUP');
        }
        return true;
    }
}

// Provide functions to track remote repo in a local repo
function Repo({user, oauth_token, name, organization} = {}){
    //TODO: give each ref it's own file system
    var __current_branch;
    var __path; 
    var __ref;

    this.__user = user;
    this.__name = name;
    this.__organization = organization;
    this.__oauth_token = oauth_token;
    this.__jobs = new Map();

    this.runJob = (command, env_vars, ref) => {
        refObj = ref.split('/');
        let branch = refObj[refObj.length - 1]
        let branch_path = this.__path + '/' + branch;
        if(!this.__jobs.has(ref)) {
            this.__jobs.set(ref, new Job());
            return this.__jobs.get(ref).run('cd ' + branch_path + ' && ' + command, env_vars);
        } else {
            console.log("Stopping previous job for " + branch_path + ':' + ref);
            if (this.__jobs.get(ref).kill()) {
                return this.__jobs.get(ref).run('cd ' + branch_path + ' && ' + command, env_vars);
            } else {
                console.log("Error stopping job for " + branch_path + ':' + ref);
            }
        }
    }

    this.__getFile = (url) => {
        return new Promise( (resolve, reject) => {
            request.get({url: url, headers: {
                'User-Agent': this.__user,
                'Authorization': 'token ' + this.__oauth_token
            }}, (error, resp, body) => {
                resolve({
                    error: error,
                    response: resp,
                    body: body
                });
            });
        });
    }

    this.__recursiveBuild = async (tree_obj, path) => {
        if(tree_obj) {
            for (let branch_obj of tree_obj.tree) {
                if (branch_obj.type == 'tree') {
                    if ( ! fs.existsSync(path + branch_obj.path)) {
                        fs.mkdirSync(path + branch_obj.path);
                        console.log("Created directory: " + path + branch_obj.path);
                    }

                    let resp = await this.__getFile(branch_obj.url);
                    child_tree = JSON.parse(resp.body);

                    await this.__recursiveBuild(child_tree , path + branch_obj.path + '/' );

                } else if (branch_obj.type == 'blob') {
                    let resp = await this.__getFile(branch_obj.url);
                    let blob = JSON.parse(resp.body).content
                    let buff = new Buffer(blob, 'base64');
                    let text = buff.toString('ascii');

                    fs.writeFileSync(path + branch_obj.path, text, { flag: 'w' });

                    comp = branch_obj.path.split('.');
                    console.log("Wrote to file: " + path + branch_obj.path);

                    if( comp[comp.length - 1] == 'sh') { // give execute permissions to .sh files
                        runCommand('cd ' + path + ' && chmod +x ' + branch_obj.path);
                    }
                }
            }
        }
    }

    this.sync = async (tree_url, ref, oauth_token) => {
        refObj = ref.split('/');
        let branch = refObj[refObj.length - 1]
        this.__path = '/var/tmp/' + this.__name;
        this.__oauth_token = oauth_token;

        branch_path = this.__path + '/' + branch + '/';
        if ( ! fs.existsSync(this.__path)) {
            fs.mkdirSync(this.__path);
        }
        if ( ! fs.existsSync(branch_path)) {
            fs.mkdirSync(branch_path);
        }
        let resp = await this.__getFile(tree_url);
        if(resp.error){
            console.log("Error getting tree object from github: " + resp.error)
        }
        try{
            await this.__recursiveBuild(JSON.parse(resp.body), branch_path);
        } catch(err) {
            console.log("When calling " + tree_url + ': ' + err);
        }
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

    this.syncRepo = ({repoName, ref, tree_sha} = {}) => {
        var subpath = this.__organization;
        if(!subpath){
            subpath = this.__user;
        }
        let url = this.__base_url + '/repos/' + subpath + '/' + repoName + '/git/trees/' + tree_sha;
        return this.__repos.get(repoName).sync(url, ref, this.__oauth_token);
    }

    // run command in repo
    this.runInRepo = ({repoName, command, env_vars, ref} = {}) => {
        return this.__repos.get(repoName).runJob(command, env_vars, ref);
    }

    this.updateStatus = ({repoName, ref, sha, status} = {}, callback) => {
        var desc;
        switch(status){
            case 'success':
                desc = 'All jobs passed';
                break;
            case 'failure':
                desc = 'Some jobs failed';
                break;
            case 'pending':
                desc = 'Running jobs';
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