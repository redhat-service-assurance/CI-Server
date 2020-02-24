yaml = require('js-yaml');
fs   = require('fs');

function JobConfig(){
    this.__defaults = new Object({
        global: {
            report: {
                github: true
            },
            timeout: 2400
        },
        script: [],
        after_script: []
    });

    this.__doc = null;

    this.__populate = (doc, defaults) => {
        Object.keys(defaults).forEach((label) => {
            if(!doc.hasOwnProperty(label)){
                doc[label] = defaults[label];
            } else {
                this.__populate(doc[label], defaults[label]);
            }
        });
    }


    this.read = (filepath) => {
        try {
            this.__doc = yaml.safeLoad(fs.readFileSync(filepath, 'utf-8'));
        } catch(err) {
            throw "Error reading in test config file: " + err;
        }

        this.__populate(this.__doc, this.__defaults);

        Object.keys(this.__defaults).forEach((label) => {
            this[label] = this.__doc[label];
        });
    }

    this.reset = () => {
        Object.keys(this.__defaults).forEach((label) => {
            this[label] = this.__defaults[label];
        });
    }
}

module.exports = JobConfig