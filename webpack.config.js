const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const { InjectManifest } = require("workbox-webpack-plugin");
const crypto = require("crypto");

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
    // Копируем статические файлы из `public` в `dist`
    new CopyWebpackPlugin({
      patterns: [
        // Копируем всё из src/public в корень dist
        // Исключаем sw.js, так как он будет сгенерирован Workbox'ом
        { from: "src/public", to: ".", globOptions: { ignore: ["**/sw.js"] } },
      ],
    }),
    // Используем InjectManifest для большего контроля над SW.
    // Он возьмёт наш шаблон sw-template.js, вставит в него список файлов для кэширования
    // и создаст готовый sw.js в папке dist.
    new InjectManifest({
      swSrc: "./src/sw-template.js", // Наш шаблон service worker'а
      swDest: "sw.js", // Выходной файл service worker'а
      exclude: [
        /\.map$/, // Исключаем source maps
        /manifest\.json$/, // Исключаем манифест (будем кэшировать отдельно в sw-template.js)
        /\.DS_Store$/, // Исключаем системные файлы macOS
        /^manifest.*\.js$/, // Исключаем webpack манифесты
      ],
      maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB максимум для кэширования
      // ВНИМАНИЕ: Этот transform заставляет все файлы перекачиваться при каждой новой сборке,
      // даже если они не изменились. Это может быть полезно для разработки, но для продакшена
      // рекомендуется удалить `manifestTransforms`, чтобы Workbox использовал хэши на основе
      // содержимого файлов для умного кэширования.
      manifestTransforms: [
        (manifestEntries) => {
          const manifest = manifestEntries.map((entry) => {
            const revision = crypto
              .createHash("md5")
              .update(Buffer.from(entry.url + Date.now()))
              .digest("hex");

            return { ...entry, revision: revision.substring(0, 8) };
          });

          console.log(`📦 Workbox precache: ${manifest.length} файлов`);
          // Возвращаем манифест и пустой массив предупреждений
          return { manifest, warnings: [] };
        },
      ],
    }),
  ],
};
