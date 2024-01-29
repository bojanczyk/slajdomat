// const HtmlInlineScriptPlugin = require('html-inline-script-webpack-plugin');
const path = require('path')
const webpack = require('webpack')
const { exec } = require('child_process');
const HookShellScriptPlugin = require('hook-shell-script-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');



module.exports = (env, argv) => ({
  mode: 'development', 
  // mode: 'production', 

  devtool: 'inline-source-map', //alternative is false 


  entry: {
    ui: './src/plugin/ui.ts', // UI side of figma plugin
    code: './src/plugin/code.ts', // Figma side of the figma plugin
    viewer: './src/viewer/viewer.ts', // The viewer code
  },

  target: 'node',

  //the make-plugin script puts together the figma plugin
  plugins: [
    // the following is just so that watch uses the plugin ui
    new HtmlWebpackPlugin({
      template: './src/plugin/ui.html', 
      filename: 'not-important-ui.html', 
    }),
    new HtmlWebpackPlugin({
      template: './src/viewer/slajdomat.html', 
      filename: 'not-important-slajdomat.html', 
    }),
    // my own handmade script for building the plugin ui. Proably a better setup would be to use the two plugins above, with appropriate parameters, instead of the script below
    new HookShellScriptPlugin({
      done: ['sh src/plugin/make-plugin-ui.sh']
    }),
  ],

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

