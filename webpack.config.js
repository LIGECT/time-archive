const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const { InjectManifest } = require("workbox-webpack-plugin");
const webpack = require("webpack");

module.exports = (env, argv) => {
  const isProduction = argv.mode === "production";

  return {
    // Режим работы. 'development' для разработки, 'production' для продакшена.
    mode: isProduction ? "production" : "development",

    // Точка входа.
    entry: "./src/index.js",

    // Куда складывать собранный бандл.
    output: {
      // Имя файла бандла. [contenthash] для кеширования в продакшене.
      filename: isProduction ? "[name].[contenthash].js" : "[name].js",
      path: path.resolve(__dirname, "dist"),
      // publicPath важен для корректной работы роутинга в SPA.
      // Для Netlify/Vercel оставляем '/', для GitHub Pages нужно будет
      // указать '/<repo-name>/', если проект не в корневом домене.
      publicPath: "/",
      clean: true,
    },

    // Настройки для dev-сервера.
    devServer: {
      static: {
        directory: path.join(__dirname, "dist"),
      },
      compress: true,
      port: 9000,
      open: true,
    },

    // Модули и правила их обработки.
    module: {
      rules: [
        {
          test: /\.jsx?$/,
          exclude: /node_modules/,
          use: {
            loader: "babel-loader",
            options: {
              presets: ["@babel/preset-env"],
              sourceType: "module",
            },
          },
        },
        {
          test: /\.css$/,
          use: ["style-loader", "css-loader"],
        },
        {
          // Правило для обработки изображений и других ассетов
          test: /\.(png|svg|jpg|jpeg|gif|ico|webp)$/i,
          type: "asset/resource",
          generator: {
            filename: "images/[hash][ext][query]",
          },
        },
      ],
    },

    // Плагины.
    plugins: [
      new HtmlWebpackPlugin({
        template: "./src/index.html",
      }),
      new CopyWebpackPlugin({
        patterns: [
          {
            from: "src/public",
            to: ".",
            globOptions: { ignore: ["**/sw.js"] },
          },
        ],
      }),
      // DefinePlugin для передачи переменных окружения в код
      new webpack.DefinePlugin({
        "process.env.NODE_ENV": JSON.stringify(
          isProduction ? "production" : "development"
        ),
      }),
      // InjectManifest только для продакшена
      isProduction &&
        new InjectManifest({
          swSrc: "./src/sw-template.js",
          swDest: "sw.js",
          exclude: [
            /\.map$/,
            /manifest\.json$/,
            /\.DS_Store$/,
            /^manifest.*\.js$/,
          ],
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB
        }),
    ].filter(Boolean), // .filter(Boolean) для удаления false значений из массива плагинов

    // Оптимизация для продакшн-сборки
    optimization: {
      // Разделение кода на части (чанки) для лучшего кэширования
      splitChunks: isProduction
        ? {
            chunks: "all",
          }
        : false,
    },
  };
};
