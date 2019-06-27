import * as fs from 'fs'
import { resolve } from 'path'
import * as shelljs from 'shelljs'

const tagReg = /^[0-9]+(\.[0-9]+)*(-(alpha|beta)\.[0-9]+)?/

const gitExecResult = shelljs.exec('git log -1 --pretty=%B')
const gitError = gitExecResult.stderr

if (gitError) {
  console.info(gitError)
  process.exit(1)
}

const gitStdout = gitExecResult.stdout

if (!tagReg.test(gitStdout)) {
  console.info('Not a release commit.')
  process.exit(0)
}

const pkg = require('../package.json')
const README = fs.readFileSync(resolve(process.cwd(), 'README.md'), 'utf8')

const cjsPkg = { ...pkg, main: './index.js' }
const esPkg = { ...cjsPkg, name: 'reactivedb-es', sideEffects: false }

const write = (distPath: string, data: any) => {
  return new Promise((res, reject) => {
    fs.writeFile(resolve(process.cwd(), distPath), data, 'utf8', (err) => {
      if (!err) {
        return res()
      }
      reject(err)
    })
  })
}

const cjsPkgData = JSON.stringify(cjsPkg, null, 2)
const esPkgData = JSON.stringify(esPkg, null, 2)

Promise.all([
  write('dist/cjs/package.json', cjsPkgData),
  write('dist/es/package.json', esPkgData),
  write('dist/es/README.md', README),
  write('dist/cjs/README.md', README),
])
  .then(() => {
    const { stderr, stdout } = shelljs.exec('npm publish dist/cjs --tag=next')
    if (stderr) {
      throw stderr
    }
    console.info(stdout)
  })
  .then(() => {
    const { stderr, stdout } = shelljs.exec('npm publish dist/es --tag=next')
    if (stderr) {
      throw stderr
    }
    console.info(stdout)
  })
  .catch((e: Error) => {
    console.error(e)
    process.exit(1)
  })
