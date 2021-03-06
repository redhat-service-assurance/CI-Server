const request = require('request');
const child_process = require('child_process');
const fs = require('fs');

function runCommand(command, env_vars) {
    child = child_process.exec(command, {env: env_vars, shell: '/bin/bash'});
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
    var __timeout;

    this.run = (command, timeout, env_vars) => {
        __process = child_process.exec(command, {detached: true, env: env_vars, shell: '/bin/bash'});
        __is_running = true;
        var data = "";
        __process.stdout.on('data', (out) => {
            data += out;
            console.log(out);
        });
        __process.stderr.on('data', (out) => {
            data += out;
            console.log(out);
        });

        return new Promise( (resolve, reject) => {
            __timeout = setTimeout(function() {
                console.log("Process timed out")
                data += "\nTimed out after " + timeout + "seconds\n";
                resolve({
                    code: 2,
                    data: data 
                });
            }, timeout * 1000);

            __process.on('close', (code) => {
                clearTimeout(__timeout);
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
            console.log(__process.pid);
            __process.stdin.end();
            __process.stdout.destroy();
            __process.stderr.destroy();
            if(__process.kill()) {
                console.log("Killing job");
            }
            return new Promise( (resolve, reject) => {
                __process.on('close', (code, signal) => {
                    console.log("Job killed with code " + code + " from signal " + signal );
                    __is_running = false;
                    resolve({
                        code: code,
                        data: 'Job killed'
                    });
                });
            });
        }
    }
}

// Provide functions to track remote repo in a local repo
function Repo({user, oauth_token, name, organization} = {}){
    //TODO: give each ref it's own file system
    var __path; 
    var __ref;

    this.__user = user;
    this.__name = name;
    this.__organization = organization;
    this.__oauth_token = oauth_token;
    this.__jobs = new Map();
    this.__synchronizing = false;
    this.__kill_sync = false;
    this.__file_write_processes = [];

    this.killJob = (ref, callback) => {
        if(this.__jobs.has(ref)) {
            return this.__jobs.get(ref).kill(callback);
        }
    }

    this.runJob = (command, env_vars, ref, timeout) => {
        let ref_path = this.__path + '/' + ref;

        if(!this.__jobs.has(ref)) {
            this.__jobs.set(ref, new Job());
        }

        return this.__jobs.get(ref).run('cd ' + ref_path + ' && ' + command, timeout, env_vars);
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

    this.__build = (tree_obj, path) => {
        this.__file_write_processes = [];
        for(let tree_branch of tree_obj.tree) {
            if (tree_branch.type == 'blob' && ! this.__kill_sync) {
                this.__file_write_processes.push(new Promise((resolve, reject) => {
                    this.__getFile(tree_branch.url).then((resp) => {
                        let blob = JSON.parse(resp.body).content
                        let buff = new Buffer.from(blob, 'base64');
                        let text = buff.toString('ascii');

                        try{
                            fs.writeFileSync(path + tree_branch.path, text, { flag: 'w' });
                        } catch(error) {
                            console.log("Failed writing to file " + path + tree_branch.path + " with error " + error);
                        }

                        comp = tree_branch.path.split('.');
                        console.log("Wrote to file: " + path + tree_branch.path);
                        if( comp[comp.length - 1] == 'sh') { // give execute permissions to .sh files
                            runCommand('cd ' + path + ' && chmod +x ' + tree_branch.path);
                        } 
                        resolve();
                    });
                }));
            } else if (tree_branch.type == 'tree' && ! this.__kill_sync ) {
                console.log("Created directory: " + path + tree_branch.path);
                if(! fs.existsSync(path + tree_branch.path) ) {
                    try{
                        fs.mkdirSync(path + tree_branch.path)
                    } catch(error) {
                        console.log("Failed to create directory " + path + tree_branch.path + " with error " + error);
                    }
                }
            }
        }
    }
    
    // sync local repo with origin
    // cancel any previous syncs happening in current branch
    this.sync = async (tree_url, ref, oauth_token) => {
        if( this.__synchronizing ) {
            this.__kill_sync = true;
            console.log("Cancelled previous sync");
            await Promise.all(this.__file_write_processes);
            this.__kill_sync = false;
        }
        this.__synchronizing = true;
        this.__path = '/var/tmp/' + this.__name;
        this.__oauth_token = oauth_token;

        ref_path = this.__path + '/' + ref + '/';
        if ( ! fs.existsSync(this.__path)) {
            fs.mkdirSync(this.__path);
        }
        if ( ! fs.existsSync(ref_path)) {
            fs.mkdirSync(ref_path);
        }
        let resp = await this.__getFile(tree_url);
        if(resp.error){
            console.log("Error getting tree object from github: " + resp.error)
        }
        try{
            this.__build(JSON.parse(resp.body), ref_path);
            await Promise.all(this.__file_write_processes);
            this.__synchronizing = false;
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

    this.killRepoJob = (repoName, ref, callback) => {
        if(this.__repos.has(repoName)) {
            return this.__repos.get(repoName).killJob(ref, callback);
        }
    }

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
        let url = this.__base_url + '/repos/' + subpath + '/' + repoName + '/git/trees/' + tree_sha + '?recursive=1';
        return this.__repos.get(repoName).sync(url, ref, this.__oauth_token);
    }

    // run command in repo
    this.runInRepo = ({repoName, command, env_vars, ref, timeout} = {}) => {
        return this.__repos.get(repoName).runJob(command, env_vars, ref, timeout);
    }

    this.updateStatus = ({repoName, sha, status, url} = {}) => {
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
                'target_url': url,
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
                    'results.md': {
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
            if( data.error ) {
                throw 'Failed to connect to Github API with ' + data.error; 
            }
            if (data.response.headers.status != '200 OK') {
                throw 'Warning: authorization failed with message: ' + data.response.headers.status;
            } else {
                console.log("User successfully authorized");
            }
        });
    } 
}
module.exports = User 
