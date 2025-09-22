import "./style.css";
import { db } from "./db.js";
import { ViewManager } from "./views.js";

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
