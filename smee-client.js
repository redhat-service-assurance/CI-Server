const SmeeClient = require('smee-client')
const fs = require('fs');

const smee = new SmeeClient({
  source: 'https://smee.io/VP49ltzf9OyzhqXj',
  target: 'http://localhost:3000/commit',
  logger: console 
})

events = smee.start();