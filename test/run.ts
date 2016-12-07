// require alias
import '../src/global'
const lfPath = 'lovefield/dist/lovefield.js'
require(lfPath)
require.cache[require.resolve('lovefield')] = require.cache[require.resolve(lfPath)]

import './specs'
export { run, setExit, reset, mocha } from 'tman'
