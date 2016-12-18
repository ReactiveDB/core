const webpack = require('webpack')
const path = require('path')
const ExtractTextPlugin = require('extract-text-webpack-plugin')
const HtmlWebpackPlugin = require('html-webpack-plugin')

// Webpack Config
module.exports = {
  entry: {
    'main': './test/e2e/app.ts',
    'vendor': [ 'lovefield', 'rxjs', 'sinon', 'tman' ]
  },
  devtool: 'cheap-module-source-map',
  cache: true,
  debug: true,
  output: {
    path: './dist',
    filename: '[name].js'
  },

  resolve: {
    root: [ path.join(__dirname, 'src') ],
    extensions: ['', '.ts', '.js'],
    alias: {
      'lovefield': path.join(process.cwd(), 'node_modules/lovefield/dist/lovefield.js'),
      'sinon': path.join(process.cwd(), 'node_modules/sinon/pkg/sinon.js'),
      'tman': path.join(process.cwd(), 'node_modules/tman/browser/tman.js')
    }
  },

  devServer: {
    historyApiFallback: true,
    watchOptions: { aggregateTimeout: 300, poll: 1000 }
  },

  node: {
    global: 1,
    crypto: 'empty',
    module: 0,
    Buffer: 0,
    clearImmediate: 0,
    setImmediate: 0
  },

  plugins: [
    new webpack.optimize.OccurenceOrderPlugin(true),
    new webpack.optimize.CommonsChunkPlugin({ name: ['main', 'vendor'], minChunks: Infinity }),
    new ExtractTextPlugin('style.css'),
    new webpack.HotModuleReplacementPlugin(),
    new webpack.NoErrorsPlugin(),
    new HtmlWebpackPlugin({
      filename: 'index.html',
      template: `test/e2e/index.html`,
      inject: true
    })
  ],

  module: {
    noParse: [/tman\/browser\/tman\.js/, /sinon\/pkg\/sinon\.js/],
    preLoaders: [
      { test: /\.js$/, loader: 'source-map-loader', include: /rxjs/ }
    ],
    loaders: [
      { test: /\.ts$/, loader: 'ts' },
      { test: /\.css$/, loader: ExtractTextPlugin.extract('style-loader', 'css-loader') },
      { test: /\.html$/, loader: 'raw-loader' }
    ]
  }
}
