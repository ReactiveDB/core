import * as tman from 'tman'
import 'tman-skin'
import '../specs'
import { enableRefTracing } from '../../src/addons/incremental'

if (!process || !process.env) {
  process.env = {}
}

enableRefTracing(2)

tman.mocha()
tman.run()

// import '../schemas'
// import './fetch'
