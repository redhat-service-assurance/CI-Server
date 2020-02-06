yaml = require('js-yaml');
fs   = require('fs');

function JobConfig(){
    this.read = (filepath) => {
        try {
            doc = yaml.safeLoad(fs.readFileSync(filepath, 'utf-8'));
        } catch(err) {
            throw "Error reading in test config file: " + err;
        }

        this.script = doc.script;
        this.after_script = doc.after_script;
    }

    this.clear = () => {
        this.script = "",
        this.after_script = ""
    }
}

module.exports = JobConfig