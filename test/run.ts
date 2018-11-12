// require alias
import '../src/global'
const lfPath = 'lovefield/dist/lovefield.js'
require(lfPath)
require.cache[require.resolve('lovefield')] = require.cache[require.resolve(lfPath)]

import { aggresiveOptimizer } from '../src'
import { enableRefTracing } from '../src/addons/incremental'

enableRefTracing(2)

if (!process || !process.env) {
  process.env = {}
}

if (!global['MessageChannel']) {
  const noop: any = (): void => void 0
  class MockChannel {
    port1: MessagePort
    port2: MessagePort

    constructor() {
      const mockPort = {
        postMessage: noop,
        onmessage: noop,
        close: noop,
        start: noop,
        onmessageerror: noop,
        addEventListener: noop,
        dispatchEvent: noop,
        removeEventListener: noop,
      }
      this.port1 = mockPort
      this.port2 = mockPort
    }
  }

  global['MessageChannel'] = MockChannel
}

if (!!process.env.optimize) {
  aggresiveOptimizer()
}

import './specs'
export { run, setExit, reset, mocha } from 'tman'
