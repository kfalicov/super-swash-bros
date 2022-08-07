const webpack = require("webpack");
const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");

module.exports = {
  mode: "development",
  devtool: "eval-source-map",
  module: {
    rules: [
      {
        test: /\.js$/,
        loader: "babel-loader",
        include: path.resolve(__dirname, "src/"),
        exclude: /node_modules/,
      },
      {
        test: [/\.vert$/, /\.frag$/],
        use: "raw-loader",
      },
    ],
  },
  devServer: {
    contentBase: path.resolve(__dirname, "../assets"),
    port: 3000,
    overlay: {
      //warnings: true,
      errors: true,
    },
  },
  plugins: [
    new CleanWebpackPlugin(),
    new webpack.DefinePlugin({
      CANVAS_RENDERER: JSON.stringify(true),
      WEBGL_RENDERER: JSON.stringify(true),
    }),
    new HtmlWebpackPlugin({
      filename: "index.html",
      template: "./index.html",
    }),
    new CopyWebpackPlugin({
      patterns: [
        {
          from: path.resolve(__dirname, "../src/assets"),
          to: path.resolve(__dirname, "../dist/assets"),
        },
      ],
    }),
  ],
};
