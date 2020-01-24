const SmeeClient = require('smee-client')

const smee = new SmeeClient({
  source: 'https://smee.io/VP49ltzf9OyzhqXj',
  target: 'http://localhost:3000/events',
  logger: console
})

const events = smee.start()

