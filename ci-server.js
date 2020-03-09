const express = require('express'); 
const config = require('./pkg/config');
const SmeeClient = require('smee-client');
const bodyParser = require('body-parser');
const { StaticPool } = require("node-worker-threads-pool");

console.log('Utilizing ' + config.workers + ' workers to process jobs.')

workerPath = './worker.js';

if(config.webhook_proxy){
    const smee = new SmeeClient({
        source: config.webhook_proxy,
        target: 'http://localhost:3000/commit',
        logger: console 
    })

    const events = smee.start();

    events.addEventListener('error', (error) => {
        console.log("Error occurred with Smee client: ");
        console.log(error);
	events = smee.start();	
    });
}

const pool = new StaticPool({
    size: config.workers,
    task: workerPath,
});

var app = express();

app.use(bodyParser.json());

app.post('/commit', (req) => {
   (async ()=> {
        try{
            let event = req.headers['x-github-event'];
            switch(event) {
                case 'push':
                    if( req.body.after != "0000000000000000000000000000000000000000") {
                        try {
                            const res = await pool.exec(req.body);
                            console.log('Job ended with status ' + res);
                        } catch(error) {
                            console.log("Job failed with " + error);
                        }
                    }
                    break;
                case 'pull_request':
                    console.log('Recieved PR event');
                    break;
                default:
                    console.log('Unrecognized github event: ' + event)
                    break;
            }
        } catch(error) {
            console.log('While parsing incoming message: ' + error);
        }
   }) ();
});

app.listen(3000, () => {
    console.log( `CI Server is listening on port 3000 for github webhooks`);
})
