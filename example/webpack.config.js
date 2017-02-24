const path = require('path')
const TsConfigPathsPlugin = require('awesome-typescript-loader').TsConfigPathsPlugin
const config = require('../webpack.config')

config.entry = {
  app: './example/index.ts',
  reactivedb: ['reactivedb'],
  vendor: ['lovefield', 'rxjs', 'tslib', 'react', 'react-dom', 'antd', 'lodash']
}

for (const x of config.module.rules) {
  if (x.use === 'awesome-typescript-loader') {
    x.test = /\.(ts|tsx)$/
    x.use = `awesome-typescript-loader?configFileName=${path.join(process.cwd(), 'example/tsconfig.json')}&useCache=true`
  }
}

config.resolve = {
  modules: [
    path.join(process.cwd(), 'example'),
    'node_modules',
    path.join(process.cwd(), 'example/node_modules')
  ],
  extensions: ['.tsx', '.ts', '.js', 'css'],
  alias: {
    'reactivedb': path.join(process.cwd(), 'dist/cjs')
    // 'lovefield': path.join(process.cwd(), 'node_modules/lovefield/dist/lovefield.es6.js')
  }
}

module.exports = config
