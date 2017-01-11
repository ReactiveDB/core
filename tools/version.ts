'use strict'
import * as fs from 'fs'

const version = require('../package.json').version

const replace = fs
  .readFileSync('src/storage/Database.ts', 'utf-8')
  .replace(/version = '[\d\.]+'/g, `version = '${version}'`)

fs.writeFileSync('src/storage/Database.ts', replace)
