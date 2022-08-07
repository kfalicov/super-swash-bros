const { merge } = require("webpack-merge");
const path = require("path");
const base = require("./base");
const CopyWebpackPlugin = require("copy-webpack-plugin");

module.exports = merge(base, {
  mode: "production",
  output: {
    filename: "[name].[chunkhash].js",
  },
  devtool: false,
  performance: {
    maxEntrypointSize: 900000,
    maxAssetSize: 900000,
  },
  externals: { phaser: "Phaser" },
  optimization: {},
});
