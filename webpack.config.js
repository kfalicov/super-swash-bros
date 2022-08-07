const HtmlWebpackPlugin = require("html-webpack-plugin");
const path = require("path");

module.exports = {
  entry: path.resolve(__dirname, "./src/index.ts"), // Absolute path.
  output: {
    filename: "[name].[contenthash].bundle.js",
    path: path.resolve(__dirname, "dist"),
    clean: true, // Clean the output directory before emit.
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /(node_modules|bower_components)/,
        use: {
          loader: "babel-loader",
          options: {
            presets: ["@babel/preset-env"],
          },
        },
      },
      {
        test: /\.ts$/,
        use: "ts-loader",
      },
      {
        test: /\.(woff(2)?|eot|ttf|otf|svg|)$/,
        type: "asset/inline",
      },
    ],
  },
  resolve: {
    // Add `.ts` as a resolvable extension (allows to add alias too).
    extensions: [".ts", ".js"],
  },
  devServer: {
    host: "0.0.0.0",
    open: false,
    static: {
      directory: path.resolve(__dirname, "assets"),
      publicPath: "/assets",
    },
    compress: true,
    hot: true,
    port: 3000,
  },
  optimization: {
    splitChunks: {
      cacheGroups: {
        defaultVendors: {
          // Build a distinct chunk file to phaser (allows to reduce size of js file).
          test: /[\\/]node_modules[\\/]phaser[\\/]/,
          name: "phaser",
          enforce: true, // Ignore minimal constraints to use optimization module.
          chunks: "initial",
        },
      },
    },
  },
  plugins: [
    new HtmlWebpackPlugin({
      // A HTML page that will load that JavaScript bundle as a script.
      title: "Phaser",
      filename: "index.html",
      template: "./index.html",
    }),
  ],
};
