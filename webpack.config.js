const path = require('path')
const webpackConfig = require('./webpack.base.config.js')

const defaultConfig = {
  entry: {
    'main': './test/e2e/app.ts',
    'vendor': [ 'lovefield', 'rxjs' ]
  },

  output: {
    path: './dist'
  }
}

const webpackMerge = require('webpack-merge')
module.exports = webpackMerge(defaultConfig, webpackConfig)
