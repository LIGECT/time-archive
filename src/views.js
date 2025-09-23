import { db } from "./db.js";

export class ViewManager {
  constructor() {
    this.currentView = "today";
    this.currentWeekStart = null;
    this.currentMonth = new Date().getMonth();
    this.currentYear = new Date().getFullYear();

    this.init();
  }

  // Полная инициализация менеджера
  init() {
    console.log("Инициализация ViewManager...");

    this.initNavigation();
    this.initNavigationArrows();
    this.setupEventListeners();
  }

  // === ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК ===

  // Инициализация навигации
  initNavigation() {
    const navButtons = document.querySelectorAll(".nav-button");

    if (navButtons.length === 0) {
      console.error("Кнопки навигации не найдены!");
      return;
    }

    console.log(`Найдено ${navButtons.length} кнопок навигации`);

    navButtons.forEach((button, index) => {
      const view = button.dataset.view;

      if (!view) {
        console.warn(`Кнопка ${index} не имеет data-view атрибута`);
        return;
      }

      button.addEventListener("click", (e) => {
        e.preventDefault();
        console.log(`Переключение на вид: ${view}`);
        this.switchView(view);
      });

      // Accessibility: поддержка клавиатуры
      button.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          this.switchView(view);
        }
      });
    });
  }

  // Переключение между видами
  async switchView(viewName) {
    console.log(`Переключение на вид: ${viewName}`);

    try {
      // 1. Скрываем все виды
      this.hideAllViews();

      // 2. Убираем активные классы у всех кнопок
      this.deactivateAllNavButtons();

      // 3. Показываем нужный вид
      const success = this.showView(viewName);

      if (!success) {
        console.error(`Вид ${viewName} не найден!`);
        return;
      }

      // 4. Активируем соответствующую кнопку
      this.activateNavButton(viewName);

      // 5. Сохраняем текущий вид
      this.currentView = viewName;

      // 6. Загружаем данные для этого вида
      await this.loadViewData(viewName);

      console.log(`Успешно переключились на вид: ${viewName}`);
    } catch (error) {
      console.error(`Ошибка при переключении на вид ${viewName}:`, error);
    }
  }

  // Скрытие всех видов
  hideAllViews() {
    const allViews = document.querySelectorAll("[data-view-content]");
    allViews.forEach((view) => {
      view.hidden = true;
      view.style.display = "none";
    });
  }

  // Показ конкретного вида
  showView(viewName) {
    const targetView = document.querySelector(
      `[data-view-content="${viewName}"]`
    );

    if (!targetView) {
      return false;
    }

    targetView.hidden = false;
    targetView.style.display = "block";
    return true;
  }

  // Деактивация всех кнопок навигации
  deactivateAllNavButtons() {
    const allButtons = document.querySelectorAll(".nav-button");
    allButtons.forEach((btn) => {
      btn.classList.remove("active");
      btn.setAttribute("aria-selected", "false");
    });
  }

  // Активация кнопки навигации
  activateNavButton(viewName) {
    const activeButton = document.querySelector(`[data-view="${viewName}"]`);

    if (activeButton) {
      activeButton.classList.add("active");
      activeButton.setAttribute("aria-selected", "true");
    }
  }

  // Загрузка данных в зависимости от вида
  async loadViewData(viewName) {
    console.log(`Загрузка данных для вида: ${viewName}`);

    try {
      switch (viewName) {
        case "today":
          await this.loadTodayView();
          break;
        case "week":
          await this.loadWeekView();
          break;
        case "month":
          await this.loadMonthView();
          break;
        case "year":
          await this.loadYearView();
          break;
        case "search":
          this.setupSearch();
          break;
        default:
          console.warn(`Неизвестный вид: ${viewName}`);
      }
    } catch (error) {
      console.error(`Ошибка загрузки вида ${viewName}:`, error);
      this.showError(`Ошибка загрузки данных для вида "${viewName}"`);
    }
  }

  // === ВИД "СЕГОДНЯ" ===

  async loadTodayView() {
    console.log('Загрузка вида "Сегодня"...');

    try {
      const todayNotes = await db.getTodayNotes();
      console.log(`Найдено записей за сегодня: ${todayNotes.length}`);

      const recentNotes = todayNotes.slice(0, 10);
      this.updateRecentNotesList(recentNotes);

      // Показываем записи за вчера для контекста
      if (typeof db.getYesterdayNotes === "function") {
        const yesterdayNotes = await db.getYesterdayNotes();
        if (yesterdayNotes.length > 0) {
          this.showYesterdayNotes(yesterdayNotes.slice(0, 5));
        }
      }
    } catch (error) {
      console.error('Ошибка загрузки вида "Сегодня":', error);
      this.showError("Не удалось загрузить записи за сегодня");
    }
  }

  // Обновление списка последних записей
  updateRecentNotesList(notes) {
    const container = document.getElementById("recent-notes-list");

    if (!container) {
      console.error("Контейнер recent-notes-list не найден!");
      return;
    }

    if (notes.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>📝 Пока записей нет</p>
          <p>Начни документировать свои страдания!</p>
        </div>
      `;
      return;
    }

    // Используем умное сокращение до 200 символов
    const notesHTML = notes
      .map((note) => this.createNoteHTML(note, 200))
      .join("");

    container.innerHTML = `
      <div class="notes-header">
        <h4>Последние записи (${notes.length})</h4>
        <div class="export-buttons-group">
          <button class="export-button compact" id="export-today-btn" title="Скопировать записи за сегодня">
            📋 Копировать
          </button>
          <button class="download-button compact" id="download-today-btn" title="Скачать записи за сегодня как .txt">
            📥 Скачать
          </button>
        </div>
      </div>
      <div class="notes-list">
        ${notesHTML}
      </div>
    `;

    console.log(`Отображено ${notes.length} записей`);

    // Добавляем все обработчики
    this.attachTodayHandlers();
  }

  // Новый метод для всех обработчиков вида "Сегодня"
  attachTodayHandlers() {
    // Обработчики экспорта
    const exportTodayBtn = document.getElementById("export-today-btn");
    if (exportTodayBtn) {
      exportTodayBtn.addEventListener("click", async () => {
        exportTodayBtn.disabled = true;
        exportTodayBtn.textContent = "⏳";

        const result = await this.exportTodayNotes();
        this.showExportNotification(result, false);

        exportTodayBtn.disabled = false;
        exportTodayBtn.textContent = "📋 Копировать";
      });
    }

    const downloadTodayBtn = document.getElementById("download-today-btn");
    if (downloadTodayBtn) {
      downloadTodayBtn.addEventListener("click", async () => {
        downloadTodayBtn.disabled = true;
        downloadTodayBtn.textContent = "⏳";

        const result = await this.downloadTodayNotes();
        this.showExportNotification(result, true);

        downloadTodayBtn.disabled = false;
        downloadTodayBtn.textContent = "📥 Скачать";
      });
    }

    // Обработчики действий с записями (делегирование событий)
    const container = document.getElementById("recent-notes-list");
    if (!container) return;

    container.addEventListener("click", (e) => {
      const button = e.target.closest("button[data-note-id]");
      if (!button) return;

      const noteId = button.dataset.noteId;

      // Раскрытие текста
      if (button.classList.contains("expand-note-btn")) {
        this.expandNoteContent(noteId);
      }

      // Копирование записи
      if (button.classList.contains("copy-btn")) {
        this.copyNoteToClipboard(parseInt(noteId, 10));
      }

      // Редактирование (будущий функционал)
      if (button.classList.contains("edit-btn")) {
        this.editNote(parseInt(noteId, 10));
      }

      // Удаление
      if (button.classList.contains("delete-btn")) {
        this.deleteNote(parseInt(noteId, 10));
      }
    });
  }

  // Метод раскрытия полного контента записи
  expandNoteContent(noteId) {
    const noteContent = document.querySelector(
      `.note-item[data-note-id="${noteId}"] .note-content`
    );
    const contentText = noteContent?.querySelector(".content-text");
    const expandBtn = noteContent?.querySelector(".expand-note-btn");

    if (!noteContent || !contentText || !expandBtn) {
      console.error("Элементы для раскрытия не найдены:", noteId);
      return;
    }

    const fullContent = noteContent.dataset.fullContent;

    if (fullContent) {
      // Заменяем сокращённый текст на полный
      contentText.innerHTML = fullContent;
      contentText.classList.remove("truncated");

      // Удаляем кнопку раскрытия
      expandBtn.remove();

      console.log(`Раскрыт полный текст записи #${noteId}`);
    }
  }

  // Копирование отдельной записи в буфер обмена
  async copyNoteToClipboard(noteId) {
    try {
      const note = await db.notes.get(noteId);

      if (!note) {
        console.error("Запись не найдена:", noteId);
        return;
      }

      const noteText = this.formatSingleNoteForCopy(note);
      const result = await this.copyToClipboard(noteText);

      // Показываем уведомление
      this.showExportNotification(
        {
          success: result.success,
          count: 1,
          period: `запись #${noteId}`,
          error: result.error,
        },
        false
      );
    } catch (error) {
      console.error("Ошибка копирования записи:", error);
    }
  }

  // Форматирование одной записи для копирования
  formatSingleNoteForCopy(note) {
    const date = new Date(note.date).toLocaleString("ru-RU");
    const tags = note.tags.length > 0 ? ` ${note.tags.join(" ")}` : "";

    return `📝 Запись #${note.id} от ${date}\n\n${note.content}${tags}`;
  }

  // Удаление записи
  async deleteNote(noteId) {
    const confirmMessage = `Точно удалить запись #${noteId}?\n\nЭто действие необратимо!`;

    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      await db.deleteNote(noteId);

      // Обновляем текущий вид
      await this.updateCurrentView();

      console.log(`Запись #${noteId} удалена`);

      // Показываем кастомное уведомление
      const notification = document.createElement("div");
      notification.className = "export-notification success";
      notification.innerHTML = `
        <div class="notification-content">
          <span class="notification-icon">🗑️</span>
          <div class="notification-text">
            <strong>Запись удалена</strong>
            <p>Запись #${noteId} была успешно удалена.</p>
          </div>
        </div>
      `;
      document.body.appendChild(notification);
      setTimeout(() => notification.classList.add("show"), 10);
      setTimeout(() => {
        notification.classList.remove("show");
        setTimeout(() => {
          if (notification.parentNode) {
            document.body.removeChild(notification);
          }
        }, 300);
      }, 3000);
    } catch (error) {
      console.error("Ошибка удаления записи:", error);
      alert(`Не удалось удалить запись #${noteId}: ${error.message}`);
    }
  }

  // Редактирование записи (заглушка для будущего функционала)
  async editNote(noteId) {
    console.log("Редактирование записи:", noteId);
    alert(
      `Редактирование записи #${noteId}\n\nФункция будет добавлена в следующих версиях.`
    );
  }

  // Показ записей за вчера (дополнительно)
  showYesterdayNotes(notes) {
    const container = document.getElementById("recent-notes-list");

    if (!container || notes.length === 0) return;

    const yesterdayHTML = `
      <div class="yesterday-notes">
        <h4>Вчера (${notes.length})</h4>
        <div class="notes-list">
          ${notes.map((note) => this.createNoteHTML(note)).join("")}
        </div>
      </div>
    `;

    container.insertAdjacentHTML("beforeend", yesterdayHTML);
  }

  // Создание HTML для одной записи с умным отображением
  createNoteHTML(note, maxLength = 200) {
    const date = new Date(note.date);
    const now = new Date();

    let timeString;
    if (this.isSameDay(date, now)) {
      timeString = date.toLocaleTimeString("ru-RU", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else {
      timeString = date.toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    }

    const tagsHTML =
      note.tags.length > 0
        ? `<div class="note-tags">${note.tags.join(" ")}</div>`
        : "";

    // Умное сокращение с возможностью раскрытия
    const shouldTruncate = maxLength && note.content.length > maxLength;
    const displayContent = shouldTruncate
      ? note.content.substring(0, maxLength) + "..."
      : note.content;

    // Сохраняем полный контент в data-атрибуте для раскрытия
    const fullContentAttr = shouldTruncate
      ? `data-full-content="${this.escapeHtml(note.content)}"`
      : "";

    const expandButton = shouldTruncate
      ? `<button class="expand-note-btn" data-note-id="${note.id}" title="Показать полный текст">Показать полностью</button>`
      : "";

    return `
      <div class="note-item" data-note-id="${
        note.id
      }" title="Запись от ${date.toLocaleString("ru-RU")}">
        <div class="note-header">
          <span class="note-time">${timeString}</span>
          <span class="note-id">#${note.id}</span>
          <div class="note-actions">
            <button class="note-action-btn copy-btn" data-note-id="${
              note.id
            }" title="Скопировать запись">📋</button>
            <button class="note-action-btn edit-btn" data-note-id="${
              note.id
            }" title="Редактировать">✏️</button>
            <button class="note-action-btn delete-btn" data-note-id="${
              note.id
            }" title="Удалить">🗑️</button>
          </div>
        </div>
        <div class="note-content" ${fullContentAttr}>
          <div class="content-text ${
            shouldTruncate ? "truncated" : ""
          }" data-note-id="${note.id}">
            ${this.escapeHtml(displayContent)}
          </div>
          ${expandButton}
        </div>
        ${tagsHTML}
      </div>
    `;
  }

  // === ВИД "НЕДЕЛЯ" ===

  async loadWeekView() {
    console.log("Загрузка недельного вида...");

    try {
      if (!this.currentWeekStart) {
        this.currentWeekStart = this.getWeekStart(new Date());
      }

      const notes = await db.getWeekNotes(this.currentWeekStart);
      console.log(`Найдено записей за неделю: ${notes.length}`);

      this.updateWeekView(notes);
    } catch (error) {
      console.error("Ошибка загрузки недельного вида:", error);
      this.showError("Не удалось загрузить записи за неделю");
    }
  }

  // Обновление недельного вида
  updateWeekView(notes) {
    const container = document.getElementById("week-notes-list");
    const title = document.getElementById("week-title");

    if (!container || !title) {
      console.error("Контейнеры для недельного вида не найдены!");
      return;
    }
    const endDate = new Date(this.currentWeekStart);
    endDate.setDate(endDate.getDate() + 6);

    const startStr = this.currentWeekStart.toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
    });
    const endStr = endDate.toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    title.textContent = `Неделя ${startStr} — ${endStr}`;

    if (notes.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>📅 За эту неделю записей нет</p>
          <p>Время начать документировать!</p>
        </div>
      `;
      return;
    }

    const notesByDay = this.groupNotesByDay(notes);
    const weekDays = this.getWeekDaysArray(this.currentWeekStart);

    const weekHTML = weekDays
      .map((day) => {
        const dateKey = day.date.toDateString();
        const dayNotes = notesByDay[dateKey] || [];
        return `
          <div class="week-day ${dayNotes.length > 0 ? "has-notes" : ""}">
            <div class="day-header">
              <h4>${day.name}</h4>
              <span class="day-date">${day.date.toLocaleDateString("ru-RU", {
                day: "2-digit",
                month: "2-digit",
              })}</span>
              ${
                dayNotes.length > 0
                  ? `<span class="notes-count">${dayNotes.length}</span>`
                  : ""
              }
            </div>
            <div class="day-notes">
              ${
                dayNotes.length > 0
                  ? dayNotes
                      .map((note) => this.createCompactNoteHTML(note))
                      .join("")
                  : '<p class="no-notes">Записей нет</p>'
              }
            </div>
          </div>
        `;
      })
      .join("");

    container.innerHTML = `
    <div class="week-controls">
      <div class="export-buttons-group">
        <button class="export-button" id="export-week-btn" title="Скопировать все записи за неделю в буфер обмена">
          📋 Скопировать записи (${notes.length})
        </button>
        <button class="download-button" id="download-week-btn" title="Скачать все записи за неделю как .txt файл">
          📥 Скачать .txt (${notes.length})
        </button>
      </div>
    </div>
    <div class="week-grid">
      ${weekHTML}
    </div>
    <div class="week-summary">
      <p>Всего записей за неделю: <strong>${notes.length}</strong></p>
      <p>Активных дней: <strong>${Object.keys(notesByDay).length}</strong></p>
    </div>
  `;

    // Обработчики для кнопок
    const exportBtn = document.getElementById("export-week-btn");
    if (exportBtn) {
      exportBtn.addEventListener("click", async () => {
        exportBtn.disabled = true;
        exportBtn.textContent = "⏳ Копирование...";

        const result = await this.exportWeekNotes();
        this.showExportNotification(result, false);

        exportBtn.disabled = false;
        exportBtn.textContent = `📋 Скопировать записи (${notes.length})`;
      });
    }

    const downloadBtn = document.getElementById("download-week-btn");
    if (downloadBtn) {
      downloadBtn.addEventListener("click", async () => {
        downloadBtn.disabled = true;
        downloadBtn.textContent = "⏳ Скачивание...";

        const result = await this.downloadWeekNotes();
        this.showExportNotification(result, true);

        downloadBtn.disabled = false;
        downloadBtn.textContent = `📥 Скачать .txt (${notes.length})`;
      });
    }
  }

  // === ВИД "МЕСЯЦ" ===

  async loadMonthView() {
    console.log("Загрузка месячного вида...");

    try {
      const notes = await db.getMonthNotes(this.currentYear, this.currentMonth);
      console.log(`Найдено записей за месяц: ${notes.length}`);

      this.updateMonthView(notes);
    } catch (error) {
      console.error("Ошибка загрузки месячного вида:", error);
      this.showError("Не удалось загрузить записи за месяц");
    }
  }

  // Обновление месячного вида с календарём
  updateMonthView(notes) {
    const container = document.getElementById("month-calendar-grid");
    const title = document.getElementById("month-title");

    if (!container || !title) {
      console.error("Контейнеры для месячного вида не найдены!");
      return;
    }
    const monthNames = [
      "Январь",
      "Февраль",
      "Март",
      "Апрель",
      "Май",
      "Июнь",
      "Июль",
      "Август",
      "Сентябрь",
      "Октябрь",
      "Ноябрь",
      "Декабрь",
    ];

    title.textContent = `${monthNames[this.currentMonth]} ${this.currentYear}`;

    const firstDay = new Date(this.currentYear, this.currentMonth, 1);
    const lastDay = new Date(this.currentYear, this.currentMonth + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;

    const notesByDay = {};
    notes.forEach((note) => {
      const day = note.date.getDate();
      if (!notesByDay[day]) {
        notesByDay[day] = [];
      }
      notesByDay[day].push(note);
    });

    const monthControlsHTML = `
    <div class="month-controls">
      <div class="export-buttons-group">
        <button class="export-button" id="export-month-btn" title="Скопировать все записи за месяц в буфер обмена">
          📋 Экспорт месяца (${notes.length})
        </button>
        <button class="download-button" id="download-month-btn" title="Скачать все записи за месяц как .txt файл">
          📥 Скачать .txt (${notes.length})
        </button>
      </div>
    </div>
  `;

    container.parentElement.insertAdjacentHTML("afterbegin", monthControlsHTML);

    container.innerHTML = "";
    container.className = "month-calendar-grid";
    // Заголовки дней недели
    const dayHeaders = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
    dayHeaders.forEach((dayName) => {
      const dayHeader = document.createElement("div");
      dayHeader.className = "calendar-day-header";
      dayHeader.textContent = dayName;
      container.appendChild(dayHeader);
    });

    // Пустые ячейки в начале месяца
    for (let i = 0; i < startDayOfWeek; i++) {
      const emptyDay = document.createElement("div");
      emptyDay.className = "calendar-day empty";
      container.appendChild(emptyDay);
    }

    // Дни месяца
    const today = new Date();
    for (let day = 1; day <= daysInMonth; day++) {
      const dayElement = document.createElement("div");
      dayElement.className = "calendar-day";

      const dayNotesCount = notesByDay[day] ? notesByDay[day].length : 0;
      const isToday =
        this.currentYear === today.getFullYear() &&
        this.currentMonth === today.getMonth() &&
        day === today.getDate();

      let intensityClass = "";
      if (dayNotesCount > 0) {
        dayElement.classList.add("has-notes");
        if (dayNotesCount >= 5) intensityClass = "high-activity";
        else if (dayNotesCount >= 3) intensityClass = "medium-activity";
        else intensityClass = "low-activity";
        dayElement.classList.add(intensityClass);
      }

      if (isToday) {
        dayElement.classList.add("today");
      }

      dayElement.innerHTML = `
        <div class="day-number">${day}</div>
        ${
          dayNotesCount > 0
            ? `<div class="notes-indicator">${dayNotesCount}</div>`
            : ""
        }
      `;

      if (dayNotesCount > 0) {
        dayElement.style.cursor = "pointer";
        dayElement.addEventListener("click", () => {
          this.showDayNotesModal(
            this.currentYear,
            this.currentMonth,
            day,
            notesByDay[day]
          );
        });
      }

      container.appendChild(dayElement);
    }

    // Обработчики для кнопок экспорта и скачивания
    const exportMonthBtn = document.getElementById("export-month-btn");
    const downloadMonthBtn = document.getElementById("download-month-btn");

    if (exportMonthBtn) {
      exportMonthBtn.addEventListener("click", async () => {
        exportMonthBtn.disabled = true;
        exportMonthBtn.textContent = "⏳ Экспортируем...";

        const result = await this.exportMonthNotes();
        this.showExportNotification(result, false);

        exportMonthBtn.disabled = false;
        exportMonthBtn.textContent = `📋 Экспорт месяца (${notes.length})`;
      });
    }

    if (downloadMonthBtn) {
      downloadMonthBtn.addEventListener("click", async () => {
        downloadMonthBtn.disabled = true;
        downloadMonthBtn.textContent = "⏳ Скачиваем...";

        const result = await this.downloadMonthNotes();
        this.showExportNotification(result, true);

        downloadMonthBtn.disabled = false;
        downloadMonthBtn.textContent = `📥 Скачать .txt (${notes.length})`;
      });
    }
  }

  // === ВИД "ГОД" ===

  async loadYearView() {
    console.log("Загрузка годового вида...");

    try {
      const stats = await db.getNotesStats(this.currentYear);
      console.log(`Статистика за год: ${stats.totalNotes} записей`);

      this.updateYearView(stats);
    } catch (error) {
      console.error("Ошибка загрузки годового вида:", error);
      this.showError("Не удалось загрузить данные за год");
    }
  }

  // Обновление годового вида
  updateYearView(stats) {
    const container = document.getElementById("year-calendar-grid");
    const title = document.querySelector("#year-view h2");

    if (!container || !title) {
      console.error("Контейнеры для годового вида не найдены!");
      return;
    }

    title.textContent = `Годовой архив страданий — ${this.currentYear}`;

    const yearControlsHTML = `
    <div class="year-controls">
      <div class="export-buttons-group">
        <button class="export-button" id="export-year-btn" title="Скопировать все записи за год в буфер обмена">
          📋 Экспорт года (${stats.totalNotes})
        </button>
        <button class="download-button" id="download-year-btn" title="Скачать все записи за год как .txt файл">
          📥 Скачать .txt (${stats.totalNotes})
        </button>
      </div>
    </div>
  `;

    container.parentElement.insertAdjacentHTML("afterbegin", yearControlsHTML);

    container.innerHTML = "";
    container.className = "year-calendar-grid";

    const monthNames = [
      "Январь",
      "Февраль",
      "Март",
      "Апрель",
      "Май",
      "Июнь",
      "Июль",
      "Август",
      "Сентябрь",
      "Октябрь",
      "Ноябрь",
      "Декабрь",
    ];

    const maxNotesInMonth = Math.max(...Object.values(stats.monthlyStats), 1);

    monthNames.forEach((monthName, monthIndex) => {
      const notesCount = stats.monthlyStats[monthIndex] || 0;
      const intensity = notesCount / maxNotesInMonth;

      const monthElement = document.createElement("div");
      monthElement.className = "year-month";

      if (notesCount > 0) {
        monthElement.classList.add("has-notes");
        if (intensity >= 0.8) monthElement.classList.add("very-high-activity");
        else if (intensity >= 0.6) monthElement.classList.add("high-activity");
        else if (intensity >= 0.4)
          monthElement.classList.add("medium-activity");
        else monthElement.classList.add("low-activity");
      }

      monthElement.innerHTML = `
        <div class="month-header">
          <span class="month-name">${monthName}</span>
          <span class="month-number">${monthIndex + 1}</span>
        </div>
        <div class="month-count">${notesCount}</div>
        <div class="month-bar">
          <div class="month-bar-fill" style="width: ${intensity * 100}%"></div>
        </div>
      `;

      monthElement.style.cursor = "pointer";
      monthElement.addEventListener("click", () => {
        this.currentMonth = monthIndex;
        this.switchView("month");
      });

      monthElement.title = `${monthName} ${this.currentYear}: ${notesCount} записей`;

      container.appendChild(monthElement);
    });

    // Обработчики для кнопок года
    const exportYearBtn = document.getElementById("export-year-btn");
    const downloadYearBtn = document.getElementById("download-year-btn");

    if (exportYearBtn) {
      exportYearBtn.addEventListener("click", async () => {
        exportYearBtn.disabled = true;
        exportYearBtn.textContent = "⏳ Собираем архив...";

        const result = await this.exportYearNotes();
        this.showExportNotification(result, false);

        exportYearBtn.disabled = false;
        exportYearBtn.textContent = `📋 Экспорт года (${stats.totalNotes})`;
      });
    }

    if (downloadYearBtn) {
      downloadYearBtn.addEventListener("click", async () => {
        downloadYearBtn.disabled = true;
        downloadYearBtn.textContent = "⏳ Создаём архив...";

        const result = await this.downloadYearNotes();
        this.showExportNotification(result, true);

        downloadYearBtn.disabled = false;
        downloadYearBtn.textContent = `📥 Скачать .txt (${stats.totalNotes})`;
      });
    }
  }

  // === ПОИСК ===

  setupSearch() {
    console.log("Настройка поиска...");

    const searchInput = document.getElementById("search-input");
    const searchResults = document.getElementById("search-results-list");
    const searchSuggestions = document.getElementById("search-suggestions");

    if (!searchInput || !searchResults) {
      console.error("Элементы поиска не найдены!");
      return;
    }

    let searchTimeout;
    let lastQuery = "";

    // Показываем подсказки при загрузке вида
    this.showSearchSuggestions();

    // Основной поиск с debounce (живое обновление)
    searchInput.addEventListener("input", (e) => {
      clearTimeout(searchTimeout);

      const query = e.target.value.trim();
      lastQuery = query;

      // Очищаем подсказки когда начинаем печатать
      if (query.length > 0 && searchSuggestions) {
        searchSuggestions.innerHTML = "";
      }

      if (query.length === 0) {
        // Если поле пустое, показываем подсказки
        this.showSearchSuggestions();
        searchResults.innerHTML = `
        <div class="search-placeholder">
          <p>👆 Начните вводить текст для поиска</p>
          <p>Поиск происходит автоматически по мере ввода</p>
        </div>
      `;
        return;
      }

      if (query.length === 1) {
        searchResults.innerHTML = `
        <div class="search-placeholder">
          <p>Введите ещё ${2 - query.length} символ...</p>
        </div>
      `;
        return;
      }

      // Показываем индикатор загрузки
      if (query.length >= 2) {
        searchResults.innerHTML = `
        <div class="search-loading">
          <p>🔍 Поиск "${this.escapeHtml(query)}"...</p>
        </div>
      `;
      }

      // Дебаунс - ждём 300мс после последнего ввода
      searchTimeout = setTimeout(async () => {
        // Проверяем, что запрос не изменился за время ожидания
        if (query === lastQuery && query.length >= 2) {
          await this.performSearch(query);
        }
      }, 300);
    });

    // Поиск по Enter для быстрого выполнения
    searchInput.addEventListener("keypress", async (e) => {
      if (e.key === "Enter") {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();
        if (query.length >= 2) {
          await this.performSearch(query);
        }
      }
    });

    // Показываем подсказки при фокусе на пустом поле
    searchInput.addEventListener("focus", () => {
      if (searchInput.value.length === 0) {
        this.showSearchSuggestions();
      }
    });

    // Очищаем подсказки при потере фокуса
    searchInput.addEventListener("blur", () => {
      // Задержка, чтобы можно было кликнуть на подсказку
      setTimeout(() => {
        if (searchInput.value.length === 0 && searchSuggestions) {
          searchSuggestions.innerHTML = "";
        }
      }, 200);
    });

    // Автофокус на поиск при переключении на вкладку
    searchInput.focus();
  }

  async performSearch(query) {
    const searchResults = document.getElementById("search-results-list");

    try {
      console.log(`Выполняется поиск: "${query}"`);

      let results = [];

      // Определяем тип поиска по запросу
      if (query.startsWith("#")) {
        // Поиск по тегам
        const tagQuery = query.substring(1); // убираем #
        results = await db.searchByTags([tagQuery], false); // false = любой из тегов
        console.log(
          `Поиск по тегу "${tagQuery}": найдено ${results.length} записей`
        );
      } else {
        // Обычный текстовый поиск
        results = await db.searchNotes(query, {
          searchInContent: true,
          searchInTags: true,
          caseSensitive: false,
          limit: 50,
        });
        console.log(
          `Текстовый поиск "${query}": найдено ${results.length} записей`
        );
      }

      // Отображаем результаты
      this.displaySearchResults(results, query);
    } catch (error) {
      console.error("Ошибка поиска:", error);
      searchResults.innerHTML = `
      <div class="search-error">
        <p>❌ Ошибка при выполнении поиска</p>
        <p>Попробуйте ещё раз или перезагрузите страницу</p>
        <button onclick="location.reload()" class="retry-button">Перезагрузить</button>
      </div>
    `;
    }
  }

  displaySearchResults(notes, query) {
    const searchResults = document.getElementById("search-results-list");

    if (notes.length === 0) {
      searchResults.innerHTML = `
      <div class="no-results">
        <h4>😔 Ничего не найдено</h4>
        <p>По запросу <strong>"${this.escapeHtml(
          query
        )}"</strong> ничего не найдено</p>
        <div class="search-tips">
          <h5>💡 Попробуйте:</h5>
          <ul>
            <li>Упростить поисковый запрос</li>
            <li>Проверить правильность написания</li>
            <li>Использовать другие ключевые слова</li>
            <li>Поискать по тегам: <code>#работа</code>, <code>#проект</code></li>
          </ul>
        </div>
      </div>
    `;
      return;
    }

    // Группируем результаты по дням для лучшей читаемости
    const resultsByDate = this.groupSearchResultsByDate(notes);

    const totalResults = notes.length;
    const resultsHeader = `
    <div class="search-results-header">
      <h4>✅ Найдено: ${totalResults} записей</h4>
      <p>по запросу <strong>"${this.escapeHtml(query)}"</strong></p>
      ${
        totalResults > 10
          ? "<p><small>Показаны самые релевантные результаты</small></p>"
          : ""
      }
    </div>
  `;

    const resultsHTML = Object.entries(resultsByDate)
      .sort(([dateA], [dateB]) => new Date(dateB) - new Date(dateA)) // Сортируем по дате, новые первыми
      .map(([dateString, dayNotes]) => {
        const date = new Date(dateString);
        const formattedDate = this.formatSearchDate(date);

        return `
        <div class="search-day-group">
          <h5 class="search-day-header">${formattedDate} (${
          dayNotes.length
        })</h5>
          <div class="search-day-results">
            ${dayNotes
              .map((note) => this.createSearchResultHTML(note, query))
              .join("")}
          </div>
        </div>
      `;
      })
      .join("");

    searchResults.innerHTML = resultsHeader + resultsHTML;

    // Плавная прокрутка к результатам
    searchResults.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Группировка результатов поиска по датам
  groupSearchResultsByDate(notes) {
    const groups = {};

    notes.forEach((note) => {
      const dateKey = note.date.toDateString();
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(note);
    });

    return groups;
  }

  // Создание HTML для результата поиска с подсветкой
  createSearchResultHTML(note, query = "") {
    const date = new Date(note.date);
    const timeString = date.toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
    });

    // Подсвечиваем найденный текст
    let highlightedContent = this.escapeHtml(note.content);
    if (query && !query.startsWith("#")) {
      const regex = new RegExp(`(${this.escapeRegex(query)})`, "gi");
      highlightedContent = highlightedContent.replace(regex, "<mark>$1</mark>");
    }

    // Подсвечиваем найденные теги
    let highlightedTags = note.tags.map((tag) => {
      if (
        query.startsWith("#") &&
        tag.toLowerCase().includes(query.substring(1).toLowerCase())
      ) {
        const tagRegex = new RegExp(
          `(${this.escapeRegex(query.substring(1))})`,
          "gi"
        );
        return tag.replace(tagRegex, "<mark>$1</mark>");
      }
      return tag;
    });

    const tagsHTML =
      highlightedTags.length > 0
        ? `<div class="search-result-tags">${highlightedTags.join(" ")}</div>`
        : "";

    return `
    <div class="search-result-item" data-note-id="${note.id}">
      <div class="search-result-header">
        <span class="search-result-time">${timeString}</span>
        <span class="search-result-id">#${note.id}</span>
      </div>
      <div class="search-result-content">${highlightedContent}</div>
      ${tagsHTML}
    </div>
  `;
  }

  // Показ поисковых подсказок
  async showSearchSuggestions() {
    const suggestionsContainer = document.getElementById("search-suggestions");

    if (!suggestionsContainer) return;

    try {
      // Получаем популярные теги для подсказок
      const popularTags = (await db.getPopularTags)
        ? await db.getPopularTags(8)
        : [];

      if (popularTags.length > 0) {
        const suggestionsHTML = `
        <div class="suggestions">
          <h5>🏷️ Популярные теги:</h5>
          <div class="tag-suggestions">
            ${popularTags
              .map(
                ({ tag, count }) =>
                  `<button class="tag-suggestion" data-tag="${tag}" title="${count} записей">
                ${tag} <span class="tag-count">(${count})</span>
              </button>`
              )
              .join("")}
          </div>
          <div class="search-examples">
            <h5>💡 Примеры поиска:</h5>
            <div class="example-queries">
              <button class="example-query" data-query="встреча">встреча</button>
              <button class="example-query" data-query="#баг">#баг</button>
              <button class="example-query" data-query="проект">проект</button>
              <button class="example-query" data-query="#важно">#важно</button>
            </div>
          </div>
        </div>
      `;

        suggestionsContainer.innerHTML = suggestionsHTML;

        // Добавляем обработчики клика на теги и примеры
        suggestionsContainer
          .querySelectorAll(".tag-suggestion")
          .forEach((tagEl) => {
            tagEl.addEventListener("click", (e) => {
              const tag =
                e.target.dataset.tag ||
                e.target.closest("[data-tag]").dataset.tag;
              const searchInput = document.getElementById("search-input");
              searchInput.value = tag;
              searchInput.focus();
              this.performSearch(tag);
            });
          });

        suggestionsContainer
          .querySelectorAll(".example-query")
          .forEach((exampleEl) => {
            exampleEl.addEventListener("click", (e) => {
              const query = e.target.dataset.query;
              const searchInput = document.getElementById("search-input");
              searchInput.value = query;
              searchInput.focus();
              this.performSearch(query);
            });
          });
      } else {
        // Если нет тегов, показываем базовые подсказки
        suggestionsContainer.innerHTML = `
        <div class="suggestions">
          <div class="search-examples">
            <h5>💡 Как искать:</h5>
            <ul>
              <li><strong>По тексту:</strong> просто введите слово или фразу</li>
              <li><strong>По тегам:</strong> начните с # (например: #работа)</li>
              <li><strong>Поиск живой:</strong> результаты появляются по мере ввода</li>
            </ul>
          </div>
        </div>
      `;
      }
    } catch (error) {
      console.error("Ошибка загрузки подсказок:", error);
    }
  }

  // Форматирование даты для результатов поиска
  formatSearchDate(date) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

    if (date >= today) {
      return "🕒 Сегодня";
    } else if (date >= yesterday) {
      return "📅 Вчера";
    } else {
      const daysDiff = Math.floor((today - date) / (1000 * 60 * 60 * 24));
      if (daysDiff <= 7) {
        return `📆 ${daysDiff} дней назад`;
      } else {
        return date.toLocaleDateString("ru-RU", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year:
            date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
        });
      }
    }
  }

  // Экранирование регулярных выражений
  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // === МЕТОДЫ ЭКСПОРТА И КОПИРОВАНИЯ ===

  // Универсальная функция копирования в буфер обмена с fallback
  async copyToClipboard(text) {
    try {
      // Проверяем поддержку современного API [web:62]
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return { success: true, method: "modern" };
      }

      // Fallback для старых браузеров [web:64]
      if (
        document.queryCommandSupported &&
        document.queryCommandSupported("copy")
      ) {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        textarea.style.top = "-9999px";
        document.body.appendChild(textarea);

        textarea.focus();
        textarea.select();

        const successful = document.execCommand("copy");
        document.body.removeChild(textarea);

        if (successful) {
          return { success: true, method: "fallback" };
        }
      }

      throw new Error("Clipboard API не поддерживается в этом браузере");
    } catch (error) {
      console.error("Ошибка копирования:", error);
      return { success: false, error: error.message };
    }
  }

  // Форматирование записей для экспорта
  formatNotesForExport(notes, period = "") {
    if (!notes || notes.length === 0) {
      return `📋 Архив Потраченного Времени ${period}\n\nЗаписей не найдено.`;
    }

    const header =
      `📋 Архив Потраченного Времени ${period}\n` +
      `Экспортировано: ${new Date().toLocaleString("ru-RU")}\n` +
      `Всего записей: ${notes.length}\n` +
      `${"=".repeat(50)}\n\n`;

    // Группируем записи по дням
    const notesByDay = this.groupNotesByDay(notes);

    let formattedText = header;

    // Сортируем дни по дате (новые первыми)
    const sortedDays = Object.keys(notesByDay).sort(
      (a, b) => new Date(b) - new Date(a)
    );

    sortedDays.forEach((dayString, dayIndex) => {
      const dayNotes = notesByDay[dayString];
      const date = new Date(dayString);

      // Форматируем заголовок дня
      const dayHeader = `📅 ${date.toLocaleDateString("ru-RU", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })} (${dayNotes.length} записей)`;

      formattedText += `${dayHeader}\n${"-".repeat(40)}\n`;

      // Сортируем записи дня по времени
      const sortedNotes = dayNotes.sort(
        (a, b) => new Date(a.date) - new Date(b.date)
      );

      sortedNotes.forEach((note, noteIndex) => {
        const time = note.date.toLocaleTimeString("ru-RU", {
          hour: "2-digit",
          minute: "2-digit",
        });

        const tags = note.tags.length > 0 ? ` ${note.tags.join(" ")}` : "";

        formattedText += `${noteIndex + 1}. [${time}] ${note.content}${tags}\n`;
      });

      formattedText += "\n";
    });

    const footer =
      `${"=".repeat(50)}\n` +
      `Создано в Архиве Потраченного Времени\n` +
      `Всего дней с записями: ${sortedDays.length}\n` +
      `Общее количество записей: ${notes.length}`;

    formattedText += footer;

    return formattedText;
  }

  // Экспорт записей за сегодня
  async exportTodayNotes() {
    try {
      const notes = await db.getTodayNotes();
      const today = new Date().toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });

      const exportText = this.formatNotesForExport(notes, `- ${today}`);
      const result = await this.copyToClipboard(exportText);

      return {
        success: result.success,
        count: notes.length,
        period: "сегодня",
        error: result.error,
      };
    } catch (error) {
      console.error("Ошибка экспорта записей за сегодня:", error);
      return { success: false, error: error.message };
    }
  }

  // Экспорт записей за неделю
  async exportWeekNotes() {
    try {
      if (!this.currentWeekStart) {
        this.currentWeekStart = this.getWeekStart(new Date());
      }

      const notes = await db.getWeekNotes(this.currentWeekStart);
      const endDate = new Date(this.currentWeekStart);
      endDate.setDate(endDate.getDate() + 6);

      const weekPeriod = `- Неделя с ${this.currentWeekStart.toLocaleDateString(
        "ru-RU"
      )} по ${endDate.toLocaleDateString("ru-RU")}`;
      const exportText = this.formatNotesForExport(notes, weekPeriod);
      const result = await this.copyToClipboard(exportText);

      return {
        success: result.success,
        count: notes.length,
        period: "неделю",
        error: result.error,
      };
    } catch (error) {
      console.error("Ошибка экспорта записей за неделю:", error);
      return { success: false, error: error.message };
    }
  }

  // Экспорт записей за месяц
  async exportMonthNotes() {
    try {
      const notes = await db.getMonthNotes(this.currentYear, this.currentMonth);

      const monthNames = [
        "январь",
        "февраль",
        "март",
        "апрель",
        "май",
        "июнь",
        "июль",
        "август",
        "сентябрь",
        "октябрь",
        "ноябрь",
        "декабрь",
      ];

      const monthPeriod = `- ${monthNames[this.currentMonth]} ${
        this.currentYear
      }`;
      const exportText = this.formatNotesForExport(notes, monthPeriod);
      const result = await this.copyToClipboard(exportText);

      return {
        success: result.success,
        count: notes.length,
        period: "месяц",
        error: result.error,
      };
    } catch (error) {
      console.error("Ошибка экспорта записей за месяц:", error);
      return { success: false, error: error.message };
    }
  }

  // Экспорт записей за год
  async exportYearNotes() {
    try {
      const stats = await db.getNotesStats(this.currentYear);
      const yearPeriod = `- ${this.currentYear} год`;

      const exportText = this.formatNotesForExport(stats.allNotes, yearPeriod);
      const result = await this.copyToClipboard(exportText);

      return {
        success: result.success,
        count: stats.totalNotes,
        period: "год",
        error: result.error,
      };
    } catch (error) {
      console.error("Ошибка экспорта записей за год:", error);
      return { success: false, error: error.message };
    }
  }

  // === МЕТОДЫ СКАЧИВАНИЯ ФАЙЛОВ ===

  // Универсальная функция для скачивания Blob как файла [web:76]
  downloadBlob(blob, filename) {
    try {
      // Создаём URL для Blob объекта [web:73]
      const blobUrl = URL.createObjectURL(blob);

      // Создаём временную ссылку для скачивания
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;

      // Скрываем ссылку
      link.style.display = "none";

      // Добавляем в DOM, кликаем и удаляем
      document.body.appendChild(link);

      // Используем dispatchEvent для лучшей совместимости [web:76]
      link.dispatchEvent(
        new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          view: window,
        })
      );

      document.body.removeChild(link);

      // Освобождаем память через небольшую задержку [web:77]
      setTimeout(() => {
        URL.revokeObjectURL(blobUrl);
      }, 100);

      return { success: true };
    } catch (error) {
      console.error("Ошибка скачивания файла:", error);
      return { success: false, error: error.message };
    }
  }

  // Генерация имени файла для отчёта
  generateReportFilename(period, notes) {
    const now = new Date();
    const dateStr = now.toISOString().split("T")[0]; // YYYY-MM-DD
    const timeStr = now.toTimeString().split(" ")[0].replace(/:/g, "-"); // HH-MM-SS

    let periodStr = period.replace(/\s+/g, "_").replace(/[^\w\-_]/g, "");
    if (periodStr) {
      periodStr = `_${periodStr}`;
    }

    return `archive_report${periodStr}_${dateStr}_${timeStr}.txt`;
  }

  // Скачивание записей за сегодня как .txt файла
  async downloadTodayNotes() {
    try {
      const notes = await db.getTodayNotes();
      const today = new Date().toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });

      const reportText = this.formatNotesForExport(notes, `- ${today}`);
      const blob = new Blob([reportText], { type: "text/plain;charset=utf-8" });
      const filename = this.generateReportFilename("сегодня", notes);

      const result = this.downloadBlob(blob, filename);

      return {
        success: result.success,
        count: notes.length,
        period: "сегодня",
        filename: filename,
        error: result.error,
      };
    } catch (error) {
      console.error("Ошибка скачивания записей за сегодня:", error);
      return { success: false, error: error.message };
    }
  }

  // Скачивание записей за неделю как .txt файла
  async downloadWeekNotes() {
    try {
      if (!this.currentWeekStart) {
        this.currentWeekStart = this.getWeekStart(new Date());
      }

      const notes = await db.getWeekNotes(this.currentWeekStart);
      const endDate = new Date(this.currentWeekStart);
      endDate.setDate(endDate.getDate() + 6);

      const weekPeriod = `- Неделя с ${this.currentWeekStart.toLocaleDateString(
        "ru-RU"
      )} по ${endDate.toLocaleDateString("ru-RU")}`;
      const reportText = this.formatNotesForExport(notes, weekPeriod);
      const blob = new Blob([reportText], { type: "text/plain;charset=utf-8" });
      const filename = this.generateReportFilename("неделя", notes);

      const result = this.downloadBlob(blob, filename);

      return {
        success: result.success,
        count: notes.length,
        period: "неделю",
        filename: filename,
        error: result.error,
      };
    } catch (error) {
      console.error("Ошибка скачивания записей за неделю:", error);
      return { success: false, error: error.message };
    }
  }

  // Скачивание записей за месяц как .txt файла
  async downloadMonthNotes() {
    try {
      const notes = await db.getMonthNotes(this.currentYear, this.currentMonth);

      const monthNames = [
        "январь",
        "февраль",
        "март",
        "апрель",
        "май",
        "июнь",
        "июль",
        "август",
        "сентябрь",
        "октябрь",
        "ноябрь",
        "декабрь",
      ];

      const monthPeriod = `- ${monthNames[this.currentMonth]} ${
        this.currentYear
      }`;
      const reportText = this.formatNotesForExport(notes, monthPeriod);
      const blob = new Blob([reportText], { type: "text/plain;charset=utf-8" });
      const filename = this.generateReportFilename(
        `${monthNames[this.currentMonth]}_${this.currentYear}`,
        notes
      );

      const result = this.downloadBlob(blob, filename);

      return {
        success: result.success,
        count: notes.length,
        period: "месяц",
        filename: filename,
        error: result.error,
      };
    } catch (error) {
      console.error("Ошибка скачивания записей за месяц:", error);
      return { success: false, error: error.message };
    }
  }

  // Скачивание записей за год как .txt файла
  async downloadYearNotes() {
    try {
      const stats = await db.getNotesStats(this.currentYear);
      const yearPeriod = `- ${this.currentYear} год`;

      const reportText = this.formatNotesForExport(stats.allNotes, yearPeriod);
      const blob = new Blob([reportText], { type: "text/plain;charset=utf-8" });
      const filename = this.generateReportFilename(
        `${this.currentYear}_год`,
        stats.allNotes
      );

      const result = this.downloadBlob(blob, filename);

      return {
        success: result.success,
        count: stats.totalNotes,
        period: "год",
        filename: filename,
        error: result.error,
      };
    } catch (error) {
      console.error("Ошибка скачивания записей за год:", error);
      return { success: false, error: error.message };
    }
  }

  // Обновлённая функция показа уведомлений с поддержкой скачивания
  showExportNotification(result, isDownload = false) {
    const { success, count, period, filename, error } = result;

    const notification = document.createElement("div");
    notification.className = `export-notification ${
      success ? "success" : "error"
    }`;

    if (success) {
      notification.innerHTML = `
      <div class="notification-content">
        <span class="notification-icon">${isDownload ? "📥" : "✅"}</span>
        <div class="notification-text">
          <strong>${isDownload ? "Файл скачан!" : "Экспорт завершён!"}</strong>
          <p>${
            isDownload
              ? `Сохранён файл с ${count} записями за ${period}`
              : `Скопировано ${count} записей за ${period} в буфер обмена`
          }</p>
          ${filename ? `<p class="filename">📄 ${filename}</p>` : ""}
        </div>
      </div>
    `;
    } else {
      notification.innerHTML = `
      <div class="notification-content">
        <span class="notification-icon">❌</span>
        <div class="notification-text">
          <strong>${
            isDownload ? "Ошибка скачивания" : "Ошибка экспорта"
          }</strong>
          <p>${error || "Не удалось выполнить операцию"}</p>
        </div>
      </div>
    `;
    }

    document.body.appendChild(notification);

    setTimeout(() => notification.classList.add("show"), 10);

    setTimeout(() => {
      notification.classList.remove("show");
      setTimeout(() => {
        if (notification.parentNode) {
          document.body.removeChild(notification);
        }
      }, 300);
    }, 5000); // Увеличиваем время показа до 5 секунд для скачивания

    notification.addEventListener("click", () => {
      notification.classList.remove("show");
      setTimeout(() => {
        if (notification.parentNode) {
          document.body.removeChild(notification);
        }
      }, 300);
    });
  }

  // === ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ===

  showDayNotesModal(year, month, day, notes) {
    const date = new Date(year, month, day);
    const dateString = date.toLocaleDateString("ru-RU");

    let notesText = `Записи за ${dateString}:\n\n`;
    notes.forEach((note, index) => {
      const time = note.date.toLocaleTimeString("ru-RU", {
        hour: "2-digit",
        minute: "2-digit",
      });
      notesText += `${index + 1}. [${time}] ${note.content}\n`;
      if (note.tags.length > 0) {
        notesText += `   Теги: ${note.tags.join(" ")}\n`;
      }
      notesText += "\n";
    });

    alert(notesText);
  }

  groupNotesByDay(notes) {
    const groups = {};
    notes.forEach((note) => {
      const day = note.date.toDateString();
      if (!groups[day]) {
        groups[day] = [];
      }
      groups[day].push(note);
    });
    return groups;
  }

  getWeekDaysArray(weekStart) {
    const days = [];
    const dayNames = [
      "Понедельник",
      "Вторник",
      "Среда",
      "Четверг",
      "Пятница",
      "Суббота",
      "Воскресенье",
    ];

    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      days.push({
        name: dayNames[i],
        date: date,
      });
    }
    return days;
  }

  createCompactNoteHTML(note) {
    const time = note.date.toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const shortContent =
      note.content.length > 100
        ? note.content.substring(0, 100) + "..."
        : note.content;

    return `
      <div class="compact-note" data-note-id="${note.id}">
        <span class="compact-time">${time}</span>
        <span class="compact-content">${this.escapeHtml(shortContent)}</span>
        ${
          note.tags.length > 0
            ? `<span class="compact-tags">${note.tags
                .slice(0, 2)
                .join(" ")}</span>`
            : ""
        }
      </div>
    `;
  }

  getMostActiveMonth(monthlyStats) {
    const monthNames = [
      "Январь",
      "Февраль",
      "Март",
      "Апрель",
      "Май",
      "Июнь",
      "Июль",
      "Август",
      "Сентябрь",
      "Октябрь",
      "Ноябрь",
      "Декабрь",
    ];

    let maxMonth = 0;
    let maxCount = 0;

    Object.entries(monthlyStats).forEach(([month, count]) => {
      if (count > maxCount) {
        maxCount = count;
        maxMonth = parseInt(month);
      }
    });

    return monthNames[maxMonth];
  }

  getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const weekStart = new Date(d.setDate(diff));
    weekStart.setHours(0, 0, 0, 0);
    return weekStart;
  }

  isSameDay(date1, date2) {
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  showError(message) {
    console.error("ViewManager Error:", message);
    const activeView = document.querySelector(
      "[data-view-content]:not([hidden])"
    );
    if (activeView) {
      const errorHTML = `
        <div class="error-message">
          <p>⚠️ ${message}</p>
          <button onclick="location.reload()">Перезагрузить</button>
        </div>
      `;
      activeView.innerHTML = errorHTML;
    }
  }

  async updateCurrentView() {
    await this.loadViewData(this.currentView);
  }

  // Инициализация стрелочек для навигации
  initNavigationArrows() {
    const weekArrows = document.querySelectorAll("#week-view .nav-arrow");
    if (weekArrows.length >= 2) {
      weekArrows[0].addEventListener("click", () => this.navigateWeek(-1));
      weekArrows[1].addEventListener("click", () => this.navigateWeek(1));
    }

    const monthArrows = document.querySelectorAll("#month-view .nav-arrow");
    if (monthArrows.length >= 2) {
      monthArrows[0].addEventListener("click", () => this.navigateMonth(-1));
      monthArrows[1].addEventListener("click", () => this.navigateMonth(1));
    }
  }

  navigateWeek(direction) {
    if (!this.currentWeekStart) {
      this.currentWeekStart = this.getWeekStart(new Date());
    }

    this.currentWeekStart.setDate(
      this.currentWeekStart.getDate() + direction * 7
    );
    this.loadWeekView();
  }

  navigateMonth(direction) {
    this.currentMonth += direction;

    if (this.currentMonth < 0) {
      this.currentMonth = 11;
      this.currentYear--;
    } else if (this.currentMonth > 11) {
      this.currentMonth = 0;
      this.currentYear++;
    }

    this.loadMonthView();
  }

  setupEventListeners() {
    document.addEventListener("keydown", (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case "1":
            e.preventDefault();
            this.switchView("today");
            break;
          case "2":
            e.preventDefault();
            this.switchView("week");
            break;
          case "3":
            e.preventDefault();
            this.switchView("month");
            break;
          case "4":
            e.preventDefault();
            this.switchView("year");
            break;
          case "f":
            e.preventDefault();
            this.switchView("search");
            break;
        }
      }
    });

    console.log(
      "Настроены клавиатурные сокращения: Ctrl+1-4 для переключения видов, Ctrl+F для поиска"
    );
  }
}
