// const rules = require('./webpack.rules');
// const plugins = require('./webpack.plugins');

// rules.push({
//   test: /\.css$/,
//   use: [{ loader: 'style-loader' }, { loader: 'css-loader' }],
// });

module.exports = {
  module: {
    // rules,
    rules: require('./webpack.rules'),
  },
  // plugins: plugins,
  plugins: require('./webpack.plugins'),
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.css'],
    fallback: {
      "fs": false,
      "os": false,
      "path": false
    }
  },
};
