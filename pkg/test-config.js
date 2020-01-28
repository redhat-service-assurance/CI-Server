yaml = require('js-yaml');
fs   = require('fs');

try {
	var doc = yaml.safeLoad(fs.readFileSync('../ci.yaml', 'utf8'));
	
} catch(err) {
	console.log(err);
}
	
