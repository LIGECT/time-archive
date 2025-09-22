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

    const notesHTML = notes.map((note) => this.createNoteHTML(note)).join("");

    container.innerHTML = `
      <div class="notes-header">
        <h4>Последние записи (${notes.length})</h4>
      </div>
      <div class="notes-list">
        ${notesHTML}
      </div>
    `;

    console.log(`Отображено ${notes.length} записей`);
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

  // Создание HTML для одной записи
  createNoteHTML(note) {
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

    const content =
      note.content.length > 200
        ? note.content.substring(0, 200) + "..."
        : note.content;

    return `
      <div class="note-item" data-note-id="${
        note.id
      }" title="Запись от ${date.toLocaleString("ru-RU")}">
        <div class="note-header">
          <span class="note-time">${timeString}</span>
          <span class="note-id">#${note.id}</span>
        </div>
        <div class="note-content">${this.escapeHtml(content)}</div>
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
      <div class="week-grid">
        ${weekHTML}
      </div>
      <div class="week-summary">
        <p>Всего записей за неделю: <strong>${notes.length}</strong></p>
      </div>
    `;
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
