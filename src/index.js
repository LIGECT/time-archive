import "./style.css";
import { db } from "./db.js";
import { ViewManager } from "./views.js";

// Регистрируем Service Worker только в production-сборке, чтобы избежать варнингов в dev-режиме
if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
  window.addEventListener("load", async () => {
    try {
      // Регистрируем SW, который сгенерировал Workbox
      const registration = await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
        updateViaCache: "none", // Не кэшируем сам SW файл
      });

      console.log(
        "✅ Workbox Service Worker зарегистрирован:",
        registration.scope
      );

      // Проверяем обновления каждые 60 секунд
      setInterval(() => {
        registration.update();
      }, 60000);

      // Обработка обновлений SW
      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;

        if (newWorker) {
          newWorker.addEventListener("statechange", () => {
            if (
              newWorker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              showUpdateNotification();
            }
          });
        }
      });
    } catch (error) {
      console.error("❌ Ошибка регистрации Workbox Service Worker:", error);
    }
  });

  // Слушаем сообщения от SW
  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data && event.data.type === "CACHE_UPDATED") {
      console.log("📦 Кэш обновлён:", event.data.payload);
    }
  });

  // Перезагрузка страницы после активации нового SW для применения обновлений
  let refreshing;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    window.location.reload();
    refreshing = true;
  });
}

// Обработка установки PWA
let deferredPrompt;

window.addEventListener("beforeinstallprompt", (event) => {
  console.log("PWA готово к установке");

  // Предотвращаем автоматический показ баннера
  event.preventDefault();
  deferredPrompt = event;

  // Показываем свою кнопку установки
  showInstallButton();
});

// Отслеживаем успешную установку
window.addEventListener("appinstalled", () => {
  console.log("PWA успешно установлено");
  deferredPrompt = null;
  hideInstallButton();

  // Показываем уведомление об успешной установке
  showInstallSuccessNotification();
});

// Функция показа кнопки установки
function showInstallButton() {
  // Создаём кнопку установки, если её нет
  let installButton = document.getElementById("install-pwa-btn");

  if (!installButton) {
    installButton = document.createElement("button");
    installButton.id = "install-pwa-btn";
    installButton.className = "install-pwa-button";
    installButton.innerHTML = "📱 Установить приложение";
    installButton.title =
      "Установить Архив Потраченного Времени как приложение";

    // Добавляем в навигацию
    const nav = document.getElementById("main-nav");
    if (nav) {
      nav.appendChild(installButton);
    }
  }

  installButton.style.display = "inline-flex";

  // Обработчик клика на кнопку установки
  installButton.addEventListener("click", async () => {
    if (!deferredPrompt) return;

    try {
      // Показываем диалог установки
      deferredPrompt.prompt();

      // Ждём выбор пользователя
      const { outcome } = await deferredPrompt.userChoice;

      console.log(
        `Пользователь ${
          outcome === "accepted" ? "согласился" : "отказался"
        } установить PWA`
      );

      deferredPrompt = null;
      hideInstallButton();
    } catch (error) {
      console.error("Ошибка установки PWA:", error);
    }
  });
}

// Функция скрытия кнопки установки
function hideInstallButton() {
  const installButton = document.getElementById("install-pwa-btn");
  if (installButton) {
    installButton.style.display = "none";
  }
}

// Функция показа уведомления об обновлении
function showUpdateNotification() {
  const notification = document.createElement("div");
  notification.className = "export-notification update-notification";
  notification.innerHTML = `
    <div class="notification-content">
      <span class="notification-icon">🔄</span>
      <div class="notification-text">
        <strong>Обновление доступно!</strong>
        <p>Новая версия приложения готова к установке</p>
        <button id="update-sw-btn" class="update-button">Обновить сейчас</button>
      </div>
    </div>
  `;

  document.body.appendChild(notification);
  setTimeout(() => notification.classList.add("show"), 10);

  // Обработчик обновления
  const updateBtn = notification.querySelector("#update-sw-btn");
  updateBtn.addEventListener("click", () => {
    // Сообщаем новому SW, чтобы он стал активным
    navigator.serviceWorker.ready.then((registration) => {
      if (registration.waiting) {
        registration.waiting.postMessage({ type: "SKIP_WAITING" });
      }
    });
  });

  // Автоскрытие через 10 секунд
  setTimeout(() => {
    notification.classList.remove("show");
    setTimeout(() => notification.remove(), 300);
  }, 10000);
}

// Уведомление об успешной установке
function showInstallSuccessNotification() {
  const notification = document.createElement("div");
  notification.className = "export-notification success";
  notification.innerHTML = `
    <div class="notification-content">
      <span class="notification-icon">✅</span>
      <div class="notification-text">
        <strong>Приложение установлено!</strong>
        <p>Архив Потраченного Времени теперь доступен с главного экрана.</p>
      </div>
    </div>
  `;
  document.body.appendChild(notification);
  setTimeout(() => notification.classList.add("show"), 10);

  setTimeout(() => {
    notification.classList.remove("show");
    setTimeout(() => notification.remove(), 300);
  }, 5000);
}

// Инициализация приложения
document.addEventListener("DOMContentLoaded", () => {
  console.log("Архив Потраченного Времени запускается...");

  // Инициализируем менеджер видов
  const viewManager = new ViewManager();

  // Инициализируем форму добавления записей
  initializeNoteForm(viewManager);

  // Устанавливаем активную вкладку по умолчанию
  viewManager.switchView("today");

  console.log("Приложение готово к использованию");
});

// Инициализация формы добавления записей
function initializeNoteForm(viewManager) {
  const noteForm = document.getElementById("new-note-form");
  const noteContentField = document.getElementById("note-content");
  const noteTagsField = document.getElementById("note-tags");
  const saveButton = document.getElementById("save-note-btn");

  if (!noteForm) {
    console.error("Форма добавления записей не найдена!");
    return;
  }

  // Обработчик отправки формы
  noteForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const content = noteContentField.value.trim();
    const tagsInput = noteTagsField.value.trim();

    // Валидация
    if (!content) {
      alert(
        "Эй, мудила! Пустые записи никому не нужны. Напиши хоть что-нибудь осмысленное."
      );
      noteContentField.focus();
      return;
    }

    // Парсинг тегов
    let tags = [];
    if (tagsInput) {
      tags = tagsInput
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0)
        .map((tag) => (tag.startsWith("#") ? tag : `#${tag}`));
    }

    try {
      // Блокируем форму во время сохранения
      setFormState(false, "Сохраняю твои страдания...");

      // Сохраняем в базу
      const noteId = await db.addNote(content, tags);

      console.log(`Запись сохранена с ID: ${noteId}`);

      // Очищаем форму
      noteContentField.value = "";
      noteTagsField.value = "";

      // Показываем успех
      setFormState(true, "Сохранено!");
      setTimeout(() => {
        setFormState(true, "Сохранить и страдать дальше");
      }, 2000);

      // Фокус для следующей записи
      noteContentField.focus();

      // Обновляем отображение записей
      await viewManager.updateCurrentView();
    } catch (error) {
      console.error("Ошибка при сохранении записи:", error);
      alert(
        "Что-то пошло не так. Твои страдания не сохранились. Проверь консоль."
      );
      setFormState(true);
    }
  });

  // Автофокус на форму при загрузке
  noteContentField.focus();

  // Вспомогательная функция для управления состоянием формы
  function setFormState(enabled, buttonText = "Сохранить и страдать дальше") {
    saveButton.disabled = !enabled;
    saveButton.textContent = buttonText;
    noteContentField.disabled = !enabled;
    noteTagsField.disabled = !enabled;
  }
}
