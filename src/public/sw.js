// Service Worker для кэширования основных ресурсов
const CACHE_NAME = "time-archive-v1.0.0";
const CACHE_URLS = [
  "/",
  "/src/index.html",
  "/src/style.css",
  "/src/index.js",
  "/src/db.js",
  "/src/views.js",
  "/images/icon-192x192.png",
  "/images/icon-512x512.png",
  "/manifest.json",
];

// Установка Service Worker
self.addEventListener("install", (event) => {
  console.log("[SW] Установка Service Worker");

  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log("[SW] Кэширование файлов");
        return cache.addAll(CACHE_URLS);
      })
      .then(() => {
        console.log("[SW] Все файлы закэшированы");
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error("[SW] Ошибка кэширования:", error);
      })
  );
});

// Активация Service Worker
self.addEventListener("activate", (event) => {
  console.log("[SW] Активация Service Worker");

  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log("[SW] Удаление старого кэша:", cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log("[SW] Service Worker активирован");
        return self.clients.claim();
      })
  );
});

// Стратегия кэширования: сначала кэш, потом сеть
self.addEventListener("fetch", (event) => {
  // Кэшируем только GET запросы
  if (event.request.method !== "GET") {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Если есть в кэше - возвращаем из кэша
        console.log("[SW] Из кэша:", event.request.url);
        return cachedResponse;
      }

      // Если нет в кэше - запрашиваем из сети
      console.log("[SW] Из сети:", event.request.url);
      return fetch(event.request)
        .then((response) => {
          // Если получили ответ - кэшируем его
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch((error) => {
          console.error("[SW] Ошибка сети:", error);

          // Возвращаем офлайн-страницу для HTML запросов
          if (event.request.headers.get("accept").includes("text/html")) {
            return caches.match("/offline.html");
          }
        });
    })
  );
});

// Обновление кэша при получении push-уведомления
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    console.log("[SW] Принудительное обновление");
    self.skipWaiting();
  }

  if (event.data && event.data.type === "CACHE_UPDATE") {
    console.log("[SW] Обновление кэша");
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) => cache.addAll(CACHE_URLS))
    );
  }
});

// Синхронизация в фоне (для будущего функционала)
self.addEventListener("sync", (event) => {
  console.log("[SW] Фоновая синхронизация:", event.tag);

  if (event.tag === "backup-notes") {
    event.waitUntil(
      // Здесь можно добавить логику синхронизации записей
      console.log("[SW] Синхронизация записей")
    );
  }
});
