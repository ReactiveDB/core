const webpack = require('webpack')
const path = require('path')
const os = require('os')
const ExtractTextPlugin = require('extract-text-webpack-plugin')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const HappyPack = require('happypack')
const { CheckerPlugin } = require('awesome-typescript-loader')

const happyThreadPool = HappyPack.ThreadPool({ size: os.cpus().length })

// Webpack Config
module.exports = {
  entry: {
    'main': './test/e2e/app.ts',
    'vendor': [ 'lovefield', 'rxjs', 'sinon', 'tman', 'chai', 'sinon-chai', 'tslib' ]
  },
  devtool: 'cheap-module-source-map',
  cache: true,
  output: {
    filename: '[name].js',
    path: path.join(__dirname, 'dist'),
    publicPath: '/'
  },

  resolve: {
    modules: [ path.join(__dirname, 'src'), 'node_modules' ],
    extensions: ['.ts', '.js'],
    alias: {
      'lovefield': path.join(process.cwd(), 'node_modules/lovefield/dist/lovefield.js'),
      'sinon': path.join(process.cwd(), 'node_modules/sinon/pkg/sinon.js'),
      'tman': path.join(process.cwd(), 'node_modules/tman/browser/tman.js'),
      'tman-skin': path.join(process.cwd(), 'node_modules/tman/browser/tman.css')
    }
  },

  devServer: {
    hot: true,
    // enable HMR on the server

    contentBase: path.resolve(__dirname, 'dist'),
    // match the output path

    publicPath: '/',
    // match the output `publicPath`

    watchOptions: { aggregateTimeout: 300, poll: 1000 },
  },

  node: {
    global: true
  },

  plugins: [
    new CheckerPlugin(),
    new webpack.LoaderOptionsPlugin({
      debug: true
    }),
    new webpack.optimize.CommonsChunkPlugin({ name: ['main', 'vendor'], minChunks: Infinity }),
    new ExtractTextPlugin({ filename: 'style.css' }),
    new webpack.HotModuleReplacementPlugin(),
    new webpack.NoEmitOnErrorsPlugin(),
    new HtmlWebpackPlugin({
      filename: 'index.html',
      template: `test/e2e/index.html`,
      inject: true
    }),
    new webpack.DefinePlugin({
      'process.env': {
        NODE_ENV: JSON.stringify('development')
      }
    }),
    new HappyPack({
      id: 'css',
      loaders: [ 'style-loader', 'css-loader' ],
      threadPool: happyThreadPool
    }),

    new HappyPack({
      id: 'sourceMap',
      loaders: [ 'source-map-loader' ],
      threadPool: happyThreadPool
    }),

    new HappyPack({
      id: 'raw',
      loaders: ['raw-loader'],
      threadPool: happyThreadPool
    })
  ],

  module: {
    noParse: [/tman\/browser\/tman\.js/, /sinon\/pkg\/sinon\.js/],
    rules: [
      {
        test: /\.tsx?$/,
        enforce: 'pre',
        exclude: /node_modules/,
        loader: 'tslint-loader'
      },
      {
        test: /\.js$/,
        enforce: 'pre',
        loader: 'happypack/loader?id=sourceMap',
        include: /rxjs/
      },
      {
        test: /\.ts$/,
        use: 'awesome-typescript-loader',
        exclude: /node_modules/
      },
      { test: /\.css$/, use: 'happypack/loader?id=css' },
      { test: /\.html$/, use: 'happypack/loader?id=raw' }
    ]
  }
}
