import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import {
  StaleWhileRevalidate,
  CacheFirst,
  NetworkFirst,
} from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";
import { CacheableResponsePlugin } from "workbox-cacheable-response";
import { BackgroundSyncPlugin } from "workbox-background-sync";
import { googleFontsCache } from "workbox-recipes";

// ===============================
// КОНФИГУРАЦИЯ КЭША
// ===============================

const CACHE_PREFIX = "time-archive";
const APP_VERSION = "1.0.0";

const CACHE_NAMES = {
  APP_SHELL: `${CACHE_PREFIX}-app-shell-v${APP_VERSION}`,
  STATIC_RESOURCES: `${CACHE_PREFIX}-static-v${APP_VERSION}`,
  API_CACHE: `${CACHE_PREFIX}-api-v${APP_VERSION}`,
  IMAGES: `${CACHE_PREFIX}-images-v${APP_VERSION}`,
  FONTS: `${CACHE_PREFIX}-fonts-v${APP_VERSION}`,
  OFFLINE: `${CACHE_PREFIX}-offline-v${APP_VERSION}`,
};

// ===============================
// PRECACHING (ОСНОВНЫЕ РЕСУРСЫ)
// ===============================

// Workbox заменит __WB_MANIFEST на список всех bundled файлов [web:90]
precacheAndRoute(self.__WB_MANIFEST);

// Очищаем устаревшие кэши при обновлении
cleanupOutdatedCaches();

// ===============================
// RUNTIME CACHING (СТРАТЕГИИ)
// ===============================

// 1. App Shell - сначала кэш, потом сеть (для HTML)
registerRoute(
  ({ request }) => request.destination === "document",
  new StaleWhileRevalidate({
    cacheName: CACHE_NAMES.APP_SHELL,
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
);

// 2. CSS и JS - сначала кэш, потом сеть
registerRoute(
  ({ request }) =>
    request.destination === "script" || request.destination === "style",
  new StaleWhileRevalidate({
    cacheName: CACHE_NAMES.STATIC_RESOURCES,
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 100, // Максимум 100 файлов
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 дней
      }),
    ],
  })
);

// 3. Изображения - сначала кэш (долгосрочное хранение)
registerRoute(
  ({ request }) => request.destination === "image",
  new CacheFirst({
    cacheName: CACHE_NAMES.IMAGES,
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 60, // Максимум 60 изображений
        maxAgeSeconds: 7 * 24 * 60 * 60, // 7 дней
        purgeOnQuotaError: true, // Очистка при превышении квоты
      }),
    ],
  })
);

// 4. API запросы - сначала сеть, потом кэш (для данных)
registerRoute(
  ({ url }) =>
    url.pathname.startsWith("/api/") || url.pathname.includes(".json"),
  new NetworkFirst({
    cacheName: CACHE_NAMES.API_CACHE,
    networkTimeoutSeconds: 3, // Таймаут сети 3 секунды
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 5 * 60, // 5 минут для API
      }),
    ],
  })
);

// ===============================
// BACKGROUND SYNC (ФОНОВАЯ СИНХРОНИЗАЦИЯ)
// ===============================

// Плагин для фоновой синхронизации (когда сеть восстанавливается)
const bgSyncPlugin = new BackgroundSyncPlugin("notes-sync-queue", {
  maxRetentionTime: 24 * 60, // Повторные попытки в течение 24 часов
});

// Регистрируем маршрут для POST запросов (добавление записей)
registerRoute(
  ({ url, request }) =>
    request.method === "POST" && url.pathname.includes("/api/notes"),
  new NetworkFirst({
    cacheName: CACHE_NAMES.API_CACHE,
    plugins: [bgSyncPlugin],
  })
);

// ===============================
// ОФЛАЙН FALLBACK
// ===============================

// Кэшируем офлайн страницу при установке
self.addEventListener("install", (event) => {
  console.log("[SW] 📦 Установка Service Worker v" + APP_VERSION);

  const offlineUrls = ["/offline.html", "/images/offline-icon.png"];

  event.waitUntil(
    caches
      .open(CACHE_NAMES.OFFLINE)
      .then((cache) => {
        console.log("[SW] 💾 Кэширование офлайн ресурсов");
        return cache.addAll(offlineUrls);
      })
      .then(() => {
        console.log("[SW] ✅ Офлайн ресурсы закэшированы");
        return self.skipWaiting(); // Немедленная активация
      })
      .catch((error) => {
        console.error("[SW] ❌ Ошибка кэширования офлайн ресурсов:", error);
      })
  );
});

// Активация и очистка старых кэшей
self.addEventListener("activate", (event) => {
  console.log("[SW] 🚀 Активация Service Worker v" + APP_VERSION);

  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              // Удаляем кэши, которые не относятся к текущей версии
              return (
                cacheName.startsWith(CACHE_PREFIX) &&
                !Object.values(CACHE_NAMES).includes(cacheName)
              );
            })
            .map((cacheName) => {
              console.log("[SW] 🗑️ Удаление старого кэша:", cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => {
        console.log("[SW] ✅ Service Worker активирован");
        return self.clients.claim(); // Управление всеми вкладками
      })
  );
});

// Fallback для навигационных запросов (показываем офлайн страницу)
registerRoute(
  ({ request }) => request.mode === "navigate",
  async ({ event }) => {
    try {
      // Пытаемся загрузить из сети
      const response = await fetch(event.request);
      return response;
    } catch (error) {
      // Если сеть недоступна - показываем офлайн страницу
      console.log("[SW] 📱 Показ офлайн страницы");
      const cache = await caches.open(CACHE_NAMES.OFFLINE);
      return await cache.match("/offline.html");
    }
  }
);

// ===============================
// GOOGLE FONTS CACHING
// ===============================

// Кэширование Google Fonts (если используются)
googleFontsCache();

// ===============================
// УВЕДОМЛЕНИЯ И PUSH
// ===============================

// Обработка сообщений от клиента (например, для skipWaiting)
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    console.log("[SW] 📢 Получена команда SKIP_WAITING, активируюсь...");
    self.skipWaiting();
  }
});

// Обработка push-уведомлений (для будущего функционала)
self.addEventListener("push", (event) => {
  console.log("[SW] 📬 Получено push-уведомление:", event.data?.text());

  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body || "У вас есть новые записи для просмотра",
    icon: "/images/icon-192x192.png",
    badge: "/images/badge-72x72.png",
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: data.primaryKey || "default",
      url: data.url || "/",
    },
    actions: [
      {
        action: "explore",
        title: "Открыть архив",
        icon: "/images/action-explore.png",
      },
      {
        action: "close",
        title: "Закрыть",
        icon: "/images/action-close.png",
      },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(
      data.title || "Архив Потраченного Времени",
      options
    )
  );
});

// Обработка кликов по уведомлениям
self.addEventListener("notificationclick", (event) => {
  console.log("[SW] 🔔 Клик по уведомлению:", event.action);

  event.notification.close();

  if (event.action === "explore") {
    // Открываем приложение
    event.waitUntil(
      clients.matchAll({ type: "window" }).then((clientList) => {
        // Если приложение уже открыто - фокусируемся на нём
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            return client.focus();
          }
        }

        // Если приложение не открыто - открываем новое окно
        if (clients.openWindow) {
          return clients.openWindow(event.notification.data.url);
        }
      })
    );
  }
});

console.log("[SW] 🎉 Service Worker Template загружен v" + APP_VERSION);
