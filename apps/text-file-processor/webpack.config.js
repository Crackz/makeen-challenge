/* eslint-disable */
module.exports = function (options, webpack) {
  return {
    ...options,
    entry: ['./src/main.ts'],
    externals: [],
    output: {
      ...options.output,
      libraryTarget: 'commonjs2',
    },
    // Keep original names for better debugging
    optimization: {
      ...options.optimization,
      moduleIds: 'named',
      chunkIds: 'named',
    },
    plugins: [
      ...options.plugins,
      // Todo: optimize the build by lazy loading non-essential modules like class-validator (Ignored)
      // new webpack.IgnorePlugin({
      //   checkResource(resource) {
      //     // Ignoring non-essential modules for Lambda deployment
      //     return lazyImports.includes(resource);
      //   },
      // }),
    ],
  };
};
