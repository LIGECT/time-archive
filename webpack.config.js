const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");

module.exports = {
  // Режим работы. 'development' для разработки, 'production' для продакшена.
  // В дев-режиме сборка быстрее и есть соурс-мапы. В проде - код минифицирован.
  mode: "development",

  // Точка входа. Отсюда вебпак начинает строить дерево зависимостей.
  // У нас это будет, допустим, index.js в папке src.
  entry: "./src/index.js",

  // Куда складывать собранный бандл.
  output: {
    // Имя файла бандла. [name] подставит имя из entry (main), [contenthash] для кеширования.
    filename: "main.[contenthash].js",
    // Директория для сборки. path.resolve гарантирует кросс-платформенность.
    path: path.resolve(__dirname, "dist"),
    // Чистить папку dist перед каждой новой сборкой. Полезная хуйня.
    clean: true,
  },

  // Настройки для dev-сервера. Чтобы не перезапускать сборку руками каждый раз.
  devServer: {
    static: {
      directory: path.join(__dirname, "dist"),
    },
    compress: true,
    port: 9000,
    open: true, // будет открывать браузер сам, заебёшься закрывать
  },

  // Модули и правила их обработки. Самое мясо тут.
  module: {
    rules: [
      {
        // Все файлы, заканчивающиеся на .js или .jsx
        test: /\.jsx?$/,
        // Исключаем node_modules, нам не нужно их пересобирать. Запомни это, блядь.
        exclude: /node_modules/,
        // Используем babel-loader для транспайлинга ES6+/JSX в старый добрый ES5.
        use: {
          loader: "babel-loader",
          options: {
            // Пресеты для Babel. @babel/preset-env для современного JS, @babel/preset-react для JSX.
            presets: ["@babel/preset-env", "@babel/preset-react"],
            // Явно указываем, что файлы являются ES-модулями. Это решает проблему с 'import',
            // когда в package.json стоит "type": "commonjs".
            sourceType: "module",
          },
        },
      },
      {
        // Теперь обрабатываем и CSS файлы.
        test: /\.css$/,
        // Используем два лоадера. Порядок важен: webpack применяет их справа налево (сначала css-loader, потом style-loader).
        use: ["style-loader", "css-loader"],
      },
    ],
  },

  // Плагины. Расширяют возможности вебпака.
  plugins: [
    // Этот плагин сам создаст index.html в папке dist и подключит к нему наш бандл.
    // Избавляет от необходимости делать это руками.
    new HtmlWebpackPlugin({
      // Теперь Webpack будет использовать твой src/index.html как шаблон для сборки.
      template: "./src/index.html",
    }),
  ],
};
