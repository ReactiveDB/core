import * as path from 'path'

const testDir = path.join(process.cwd(), 'spec-js/test')
const testFile = `${testDir}/run`

export function runTman() {
  Object.keys(require.cache).forEach(id => {
    delete require.cache[id]
  })

  const { run, setExit, reset, mocha } = require(testFile)

  setExit(false)
  mocha()
  return run()(() => {
    reset()
  })
}
