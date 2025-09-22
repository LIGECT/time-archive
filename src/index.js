import "./style.css";
import { db } from "./db.js";
import { ViewManager } from "./views.js";

// Инициализация менеджера видов
const viewManager = new ViewManager();

// DOM загрузился, можно начинать безобразие
document.addEventListener("DOMContentLoaded", () => {
  // Находим форму и поля
  const noteForm = document.getElementById("new-note-form");
  const noteContentField = document.getElementById("note-content");
  const noteTagsField = document.getElementById("note-tags");
  const saveButton = document.getElementById("save-note-btn");
  // Обработчик отправки формы
  noteForm.addEventListener("submit", async (event) => {
    // Отменяем стандартную отправку формы, нам не нужна перезагрузка страницы
    event.preventDefault();

    // Забираем данные из полей
    const content = noteContentField.value.trim();
    const tagsInput = noteTagsField.value.trim();

    // Валидация: пустой контент = нахуй иди
    if (!content) {
      alert(
        "Ты че, думаешь пустые записи кому-то нужны? Напиши хоть что-нибудь."
      );
      noteContentField.focus();
      return;
    }

    // Обрабатываем теги: разделяем по запятым, чистим от пробелов и мусора
    let tags = [];
    if (tagsInput) {
      tags = tagsInput
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0) // Убираем пустые теги
        .map((tag) => (tag.startsWith("#") ? tag : `#${tag}`)); // Добавляем # если забыл
    }

    try {
      // Блокируем кнопку, чтобы дурак не нажимал дважды
      saveButton.disabled = true;
      saveButton.textContent = "Сохраняю...";

      // Сохраняем в базу
      await db.addNote(content, tags);

      // Успех! Очищаем форму
      noteContentField.value = "";
      noteTagsField.value = "";

      // Показываем успешное сохранение (временно)
      saveButton.textContent = "Сохранено!";
      setTimeout(() => {
        saveButton.textContent = "Сохранить и страдать дальше";
      }, 2000);

      // Фокус обратно на textarea для следующей записи
      noteContentField.focus();

      // Используем менеджер видов для обновления
      await viewManager.updateRecentNotes();
    } catch (error) {
      console.error("Ошибка при сохранении записи:", error);
      alert("Что-то пошло не так при сохранении. Проверь консоль, там детали.");
    } finally {
      // Разблокируем кнопку в любом случае
      saveButton.disabled = false;
    }
  });

  // Фокус на форму сразу при загрузке - удобно для быстрого ввода
  noteContentField.focus();
});
