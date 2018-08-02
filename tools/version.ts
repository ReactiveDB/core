import * as fs from 'fs'

const version = require('../package.json').version

const filePath = 'src/version.ts'

const replace = fs.readFileSync(filePath, 'utf-8').replace(/[\d\.]+/g, `${version}`)

fs.writeFileSync(filePath, replace)
