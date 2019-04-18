import * as tman from 'tman'
import 'tman-skin'
// import '../specs'

if (!process || !process.env) {
  process.env = {}
}

tman.mocha()
tman.run()

// import '../schemas'
// import './fetch'
import './demo'
