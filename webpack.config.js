const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: './src/main.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].[contenthash].js', // Use content hash for cache busting
    chunkFilename: '[name].[contenthash].chunk.js', // For dynamic chunks
    clean: true,
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js'],
  },
  // Code splitting configuration
  optimization: {
    splitChunks: {
      chunks: 'all',
      maxInitialRequests: 25,
      minSize: 20000,
      cacheGroups: {
        // Split Babylon.js into its own chunk (largest dependency)
        babylon: {
          test: /[\\/]node_modules[\\/]@babylonjs[\\/]/,
          name: 'vendor-babylon',
          chunks: 'all',
          priority: 30,
        },
        // Split React into its own chunk
        react: {
          test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
          name: 'vendor-react',
          chunks: 'all',
          priority: 20,
        },
        // Other vendor dependencies
        vendors: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendor-other',
          chunks: 'all',
          priority: 10,
        },
      },
    },
    runtimeChunk: 'single', // Separate runtime chunk
  },
  // Increase performance limits to reduce warnings
  performance: {
    maxAssetSize: 5000000, // 5MB per asset (for GLB files)
    maxEntrypointSize: 3000000, // 3MB for entry point
    hints: false,
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.glb$/,
        type: 'asset/resource',
        generator: {
          // Output GLB files to scene/assets/model/obstacles preserving folder structure
          filename: (pathData) => {
            // Get the path relative to public folder
            const relativePath = pathData.filename.replace(/^.*public[/\\]/, '');
            return relativePath;
          }
        }
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './public/index.html',
    }),
    new CopyWebpackPlugin({
      patterns: [
        {
          from: path.resolve(__dirname, 'public/scene'),
          to: 'scene',
        },
        {
          from: path.resolve(__dirname, 'public/intro-screen.png'),
          to: 'intro-screen.png',
        },
      ],
    }),
  ],
  devServer: {
    static: {
      directory: path.join(__dirname, 'public'),
    },
    compress: true,
    port: 3001,
    open: true,
  },
};
