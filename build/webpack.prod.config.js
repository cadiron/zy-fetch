const util = require('./util')
const merge = require('webpack-merge')
const resolve = util.resolve
const base = require('./webpack.base.config')
module.exports = merge(base, {
  mode: 'production',
  entry: {
    main: './lib/zyFetchs.js'
  },
  output: {
    path: resolve('../dist'),
    publicPath: "/dist/",
    filename: 'zy-fetch.min.js',
    library: "ZYFETCH",
    libraryTarget: "umd",
  }
})