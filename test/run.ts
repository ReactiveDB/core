// require alias
import '../src/global'
const lfPath = 'lovefield/dist/lovefield.js'
require(lfPath)
require.cache[require.resolve('lovefield')] = require.cache[require.resolve(lfPath)]

import { aggresiveOptimizer } from '../src'
if (!!process.env.optimize) {
  aggresiveOptimizer()
}

import './specs'
export { run, setExit, reset, mocha } from 'tman'
