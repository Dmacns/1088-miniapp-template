import type { UserConfigExport } from '@tarojs/cli';
import path from 'path';

export default {
  logger: {
    quiet: false,
    stats: true,
  },
  mini: {},
  h5: {
    devServer: {
      open: false,
      port: 50061,
      static: [
        {
          directory: path.resolve(__dirname, '../../static'),
          publicPath: '/static/',
        },
      ],
    },
  },
} satisfies UserConfigExport<'webpack5'>;
