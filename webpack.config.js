// const HtmlInlineScriptPlugin = require('html-inline-script-webpack-plugin');
const path = require('path')
const webpack = require('webpack')

module.exports = (env, argv) => ({
  mode: 'development', // alternative is  'development',

  // watch: true,
  devtool: this.mode === 'production' ? false : 'inline-source-map',

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
      {
        test: /\.(woff(2)?|ttf|eot|svg)(\?v=\d+\.\d+\.\d+)?$/,
        use: [
          {
            loader: 'file-loader',
            options: {
              name: '[name].[ext]',
              outputPath: 'fonts/'
            }
          }
        ]
      }

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