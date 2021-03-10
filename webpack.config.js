// const HtmlInlineScriptPlugin = require('html-inline-script-webpack-plugin');
const path = require('path')
const webpack = require('webpack')

module.exports = (env, argv) => ({
  mode: argv.mode === 'production' ? 'production' : 'development',

  watch: true,
  // This is necessary because Figma's 'eval' works differently than normal eval
  devtool: argv.mode === 'production' ? false : 'inline-source-map',

  entry: {
    ui: './src/plugin/ui.ts', // UI side of figma plugin
    code: './src/plugin/code.ts', // Figma side of the figma plugin
    viewer: './src/viewer/viewer.ts' // The viewer code
  },

  target: 'node',


  module: {
    rules: [

      // Converts TypeScript code to JavaScript
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      },

      // Enables including CSS by doing "import './file.css'" in your TypeScript code
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"],
      },

    ],
  },

  // Webpack tries these extensions for you if you omit the extension like "import './file'"
  resolve: {
    extensions: ['.tsx', '.ts', '.jsx', '.js']
  },

  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'), // Compile into a folder called "dist"
  },

})