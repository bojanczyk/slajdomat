import type { Configuration } from 'webpack';

import { rules } from './webpack.rules';
import { plugins } from './webpack.plugins';

rules.push({
  test: /\.css$/,
  use: [{ loader: 'style-loader' }, { loader: 'css-loader' }],
},
{
  test: /\.(png|jpe?g|gif|svg)$/i,
  use: [
      {
          loader: 'file-loader',
          options: {
              name: '[path][name].[ext]',
          },
      },
  ],

});

export const rendererConfig: Configuration = {
  module: {
    rules,
  },
  plugins,
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.css', '.svg'],
  },
};
