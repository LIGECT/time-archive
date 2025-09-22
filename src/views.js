import { db } from "./db.js";
import { getWeekStart } from "./dateUtils.js";

// Класс для управления видами приложения
export class ViewManager {
  constructor() {
    this.currentView = "today";
    this.currentWeekStart = null;
    this.currentMonth = new Date().getMonth();
    this.currentYear = new Date().getFullYear();

    this.initNavigation();
  }

  // Инициализация обработчиков навигации
  initNavigation() {
    const navButtons = document.querySelectorAll(".nav-button");

    navButtons.forEach((button) => {
      button.addEventListener("click", (e) => {
        const view = e.target.dataset.view;
        this.switchView(view);
      });
    });

    // Обработчики для стрелочек в заголовках
    this.initNavigationArrows();
  }

  // Переключение между видами
  async switchView(viewName) {
    // Скрываем все виды
    document.querySelectorAll("[data-view-content]").forEach((view) => {
      view.hidden = true;
    });

    // Убираем активный класс у всех кнопок
    document.querySelectorAll(".nav-button").forEach((btn) => {
      btn.classList.remove("active");
    });

    // Показываем нужный вид
    const targetView = document.querySelector(
      `[data-view-content="${viewName}"]`
    );
    const activeButton = document.querySelector(`[data-view="${viewName}"]`);

    if (targetView && activeButton) {
      targetView.hidden = false;
      activeButton.classList.add("active");
      this.currentView = viewName;

      // Загружаем данные для этого вида
      await this.loadViewData(viewName);
    }
  }

  // Загрузка данных в зависимости от вида
  async loadViewData(viewName) {
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
          // Поиск загружается по запросу
          this.setupSearch();
          break;
      }
    } catch (error) {
      console.error(`Ошибка загрузки вида ${viewName}:`, error);
    }
  }

  // Загрузка записей за сегодня
  async loadTodayView() {
    const notes = await db.getTodayNotes();
    this.updateRecentNotesList(notes.slice(0, 5));
  }

  // Загрузка записей за неделю
  async loadWeekView() {
    if (!this.currentWeekStart) {
      this.currentWeekStart = getWeekStart(new Date());
    }

    const notes = await db.getWeekNotes(this.currentWeekStart);
    this.updateWeekView(notes);
  }

  // Загрузка записей за месяц
  async loadMonthView() {
    const notes = await db.getMonthNotes(this.currentYear, this.currentMonth);
    this.updateMonthView(notes);
  }

  // Загрузка записей за год
  async loadYearView() {
    const stats = await db.getNotesStats(this.currentYear);
    this.updateYearView(stats);
  }

  // Обновление списка записей (для today и week)
  updateRecentNotesList(notes) {
    const container = document.getElementById("recent-notes-list");

    if (notes.length === 0) {
      container.innerHTML = "<p>Записей нет. Начни страдать!</p>";
      return;
    }

    container.innerHTML = notes
      .map((note) => this.createNoteHTML(note))
      .join("");
  }

  // Обновление недельного вида
  updateWeekView(notes) {
    const container = document.getElementById("week-notes-list");
    const title = document.getElementById("week-title");

    // Обновляем заголовок
    const endDate = new Date(this.currentWeekStart);
    endDate.setDate(endDate.getDate() + 6);

    title.textContent = `Неделя ${this.formatDate(
      this.currentWeekStart
    )} - ${this.formatDate(endDate)}`;

    // Группируем записи по дням
    const notesByDay = this.groupNotesByDay(notes);

    container.innerHTML = Object.entries(notesByDay)
      .map(
        ([day, dayNotes]) => `
        <div class="day-group">
          <h4>${this.formatDayHeader(day)}</h4>
          <div class="day-notes">
            ${dayNotes.map((note) => this.createNoteHTML(note)).join("")}
          </div>
        </div>
      `
      )
      .join("");
  }

  // Группировка записей по дням
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

  // Создание HTML для одной записи
  createNoteHTML(note) {
    const date = new Date(note.date);
    const timeString = date.toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const tagsHtml =
      note.tags.length > 0
        ? `<div class="note-tags">${note.tags.join(" ")}</div>`
        : "";

    return `
      <div class="note-item" data-note-id="${note.id}">
        <div class="note-time">${timeString}</div>
        <div class="note-content">${this.escapeHtml(note.content)}</div>
        ${tagsHtml}
      </div>
    `;
  }

  // Обновление месячного вида
  updateMonthView(notes) {
    const container = document.getElementById("month-calendar-grid");
    const title = document.getElementById("month-title");

    // Обновляем заголовок
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

    // Создаём календарную сетку
    const firstDay = new Date(this.currentYear, this.currentMonth, 1);
    const lastDay = new Date(this.currentYear, this.currentMonth + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1; // Понедельник = 0

    // Группируем записи по дням
    const notesByDay = {};
    notes.forEach((note) => {
      const day = note.date.getDate();
      if (!notesByDay[day]) {
        notesByDay[day] = [];
      }
      notesByDay[day].push(note);
    });

    // Очищаем контейнер
    container.innerHTML = "";

    // Добавляем заголовки дней недели
    const dayHeaders = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
    dayHeaders.forEach((dayName) => {
      const dayHeader = document.createElement("div");
      dayHeader.className = "calendar-day-header";
      dayHeader.textContent = dayName;
      container.appendChild(dayHeader);
    });

    // Добавляем пустые ячейки в начале месяца
    for (let i = 0; i < startDayOfWeek; i++) {
      const emptyDay = document.createElement("div");
      emptyDay.className = "calendar-day empty";
      container.appendChild(emptyDay);
    }

    // Добавляем дни месяца
    for (let day = 1; day <= daysInMonth; day++) {
      const dayElement = document.createElement("div");
      dayElement.className = "calendar-day";

      const dayNotesCount = notesByDay[day] ? notesByDay[day].length : 0;

      if (dayNotesCount > 0) {
        dayElement.classList.add("has-notes");
        dayElement.innerHTML = `
        <div class="day-number">${day}</div>
        <div class="notes-count">${dayNotesCount}</div>
      `;

        // Добавляем обработчик клика для показа записей этого дня
        dayElement.addEventListener("click", () => {
          this.showDayNotes(
            this.currentYear,
            this.currentMonth,
            day,
            notesByDay[day]
          );
        });
      } else {
        dayElement.innerHTML = `<div class="day-number">${day}</div>`;
      }

      // Выделяем сегодняшний день
      const today = new Date();
      if (
        this.currentYear === today.getFullYear() &&
        this.currentMonth === today.getMonth() &&
        day === today.getDate()
      ) {
        dayElement.classList.add("today");
      }

      container.appendChild(dayElement);
    }
  }

  // Обновление годового вида
  updateYearView(stats) {
    const container = document.getElementById("year-calendar-grid");
    const title = document.querySelector("#year-view h2");

    // Обновляем заголовок
    title.textContent = `Годовой отчёт о страданиях - ${this.currentYear}`;

    // Очищаем контейнер
    container.innerHTML = "";

    const monthNames = [
      "Янв",
      "Фев",
      "Мар",
      "Апр",
      "Май",
      "Июн",
      "Июл",
      "Авг",
      "Сен",
      "Окт",
      "Ноя",
      "Дек",
    ];

    // Находим максимальное количество записей в месяце для нормализации
    const maxNotesInMonth = Math.max(...Object.values(stats.monthlyStats));

    // Создаём ячейки для каждого месяца
    for (let month = 0; month < 12; month++) {
      const monthElement = document.createElement("div");
      monthElement.className = "year-month";

      const notesCount = stats.monthlyStats[month] || 0;
      const intensity = maxNotesInMonth > 0 ? notesCount / maxNotesInMonth : 0;

      // Добавляем класс интенсивности для визуализации
      if (notesCount > 0) {
        monthElement.classList.add("has-notes");
        if (intensity > 0.7) monthElement.classList.add("high-activity");
        else if (intensity > 0.3) monthElement.classList.add("medium-activity");
        else monthElement.classList.add("low-activity");
      }

      monthElement.innerHTML = `
      <div class="month-name">${monthNames[month]}</div>
      <div class="month-count">${notesCount}</div>
    `;

      // Добавляем обработчик для перехода к месячному виду
      monthElement.addEventListener("click", () => {
        this.currentMonth = month;
        this.switchView("month");
      });

      container.appendChild(monthElement);
    }

    // Добавляем общую статистику
    const statsElement = document.createElement("div");
    statsElement.className = "year-stats";
    statsElement.innerHTML = `
    <h3>Статистика за год</h3>
    <p>Всего записей: <strong>${stats.totalNotes}</strong></p>
    <p>Записей в месяц в среднем: <strong>${Math.round(
      stats.totalNotes / 12
    )}</strong></p>
    <p>Самый продуктивный месяц: <strong>${
      monthNames[
        Object.keys(stats.monthlyStats).reduce((a, b) =>
          stats.monthlyStats[a] > stats.monthlyStats[b] ? a : b
        )
      ]
    }</strong></p>
  `;

    container.appendChild(statsElement);
  }

  // Показать записи конкретного дня (модальное окно или расширяемый блок)
  showDayNotes(year, month, day, notes) {
    // Простая реализация через alert (потом можешь заменить на модальное окно)
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

  // Настройка расширенного поиска
  setupSearch() {
    // Создаём расширенный поисковой интерфейс
    this.createAdvancedSearchInterface();

    // Теперь, когда HTML создан, получаем новые элементы
    const searchInput = document.getElementById("search-input");
    const searchResults = document.getElementById("search-results-list");

    let searchTimeout;
    let lastQuery = "";

    // Основной поиск с debounce
    searchInput.addEventListener("input", (e) => {
      clearTimeout(searchTimeout);

      const query = e.target.value.trim();
      lastQuery = query;

      if (query.length < 2) {
        searchResults.innerHTML = "<p>Введите минимум 2 символа для поиска</p>";
        this.showSearchSuggestions();
        return;
      }

      searchTimeout = setTimeout(async () => {
        // Проверяем, что запрос не изменился за время ожидания
        if (query === lastQuery) {
          await this.performSearch(query);
        }
      }, 300);
    });

    // Поиск по Enter
    searchInput.addEventListener("keypress", async (e) => {
      if (e.key === "Enter") {
        e.preventDefault(); // Предотвращаем стандартное поведение (например, отправку формы)
        clearTimeout(searchTimeout);
        await this.performSearch(e.target.value.trim());
      }
    });

    // Показываем предложения при фокусе
    searchInput.addEventListener("focus", () => {
      if (searchInput.value.length < 2) {
        this.showSearchSuggestions();
      }
    });
  }

  // Создание интерфейса расширенного поиска
  createAdvancedSearchInterface() {
    const searchView = document.getElementById("search-view");

    const advancedSearchHTML = `
    <div class="search-container">
      <div class="search-main">
        <input type="search" id="search-input" placeholder="Поиск по записям и тегам..." />
        <button id="advanced-search-toggle">Расширенный поиск</button>
      </div>
      
      <div id="advanced-search-panel" class="advanced-search hidden">
        <div class="search-filters">
          <div class="filter-group">
            <label>Поиск в:</label>
            <label><input type="checkbox" id="search-content" checked> Тексте записей</label>
            <label><input type="checkbox" id="search-tags" checked> Тегах</label>
          </div>
          
          <div class="filter-group">
            <label>Теги (через запятую):</label>
            <input type="text" id="tags-filter" placeholder="#работа, #баг, #встреча">
          </div>
          
          <div class="filter-group">
            <label>Период:</label>
            <select id="date-range-preset">
              <option value="">Любой период</option>
              <option value="today">Сегодня</option>
              <option value="week">Эта неделя</option>
              <option value="month">Этот месяц</option>
              <option value="custom">Выбрать даты</option>
            </select>
          </div>
          
          <div id="custom-date-range" class="filter-group hidden">
            <label>От: <input type="date" id="date-from"></label>
            <label>До: <input type="date" id="date-to"></label>
          </div>
          
          <div class="filter-group">
            <label>Сортировка:</label>
            <select id="sort-by">
              <option value="date">По дате</option>
              <option value="relevance">По релевантности</option>
            </select>
            <select id="sort-order">
              <option value="desc">Новые первыми</option>
              <option value="asc">Старые первыми</option>
            </select>
          </div>
          
          <button id="apply-advanced-search">Найти</button>
          <button id="clear-search">Очистить</button>
        </div>
      </div>
      
      <div id="search-suggestions" class="search-suggestions"></div>
      <div id="search-results-list" class="search-results"></div>
    </div>
  `;

    searchView.innerHTML = advancedSearchHTML;

    // Инициализируем обработчики для расширенного поиска
    this.initAdvancedSearchHandlers();
  }

  // Инициализация обработчиков расширенного поиска
  initAdvancedSearchHandlers() {
    const toggleBtn = document.getElementById("advanced-search-toggle");
    const advancedPanel = document.getElementById("advanced-search-panel");
    const dateRangeSelect = document.getElementById("date-range-preset");
    const customDateRange = document.getElementById("custom-date-range");
    const applyBtn = document.getElementById("apply-advanced-search");
    const clearBtn = document.getElementById("clear-search");

    // Переключение расширенной панели
    toggleBtn.addEventListener("click", () => {
      advancedPanel.classList.toggle("hidden");
      toggleBtn.textContent = advancedPanel.classList.contains("hidden")
        ? "Расширенный поиск"
        : "Скрыть расширенный поиск";
    });

    // Показ/скрытие кастомных дат
    dateRangeSelect.addEventListener("change", (e) => {
      customDateRange.classList.toggle("hidden", e.target.value !== "custom");
    });

    // Применение расширенного поиска
    applyBtn.addEventListener("click", async () => {
      await this.performAdvancedSearch();
    });

    // Очистка поиска
    clearBtn.addEventListener("click", () => {
      this.clearSearch();
    });
  }

  // Выполнение обычного поиска
  async performSearch(query) {
    const searchResults = document.getElementById("search-results-list");

    if (!query || query.length < 2) {
      searchResults.innerHTML = "<p>Введите поисковый запрос</p>";
      return;
    }

    try {
      searchResults.innerHTML = "<p>Поиск...</p>";

      // Определяем тип поиска
      let results;

      if (query.startsWith("#")) {
        // Поиск по тегам
        results = await db.searchByTags([query]);
      } else if (query.includes(" ")) {
        // Полнотекстовый поиск для фраз
        results = await db.fullTextSearch(query, { highlightMatches: true });
      } else {
        // Обычный поиск
        results = await db.searchNotes(query);
      }

      await db.saveSearchHistory(query, results.length);
      this.displaySearchResults(results, query);
    } catch (error) {
      console.error("Ошибка поиска:", error);
      searchResults.innerHTML = "<p>Ошибка при поиске. Попробуйте ещё раз.</p>";
    }
  }

  // Выполнение расширенного поиска
  async performAdvancedSearch() {
    const searchResults = document.getElementById("search-results-list");

    try {
      searchResults.innerHTML = "<p>Выполняется расширенный поиск...</p>";

      const criteria = this.getAdvancedSearchCriteria();
      const results = await db.advancedSearch(criteria);

      this.displaySearchResults(results, criteria.text || "расширенный поиск");
    } catch (error) {
      console.error("Ошибка расширенного поиска:", error);
      searchResults.innerHTML = "<p>Ошибка при выполнении поиска</p>";
    }
  }

  // Получение критериев расширенного поиска
  getAdvancedSearchCriteria() {
    const text = document.getElementById("search-input").value.trim();
    const tagsInput = document.getElementById("tags-filter").value.trim();
    const datePreset = document.getElementById("date-range-preset").value;
    const sortBy = document.getElementById("sort-by").value;
    const sortOrder = document.getElementById("sort-order").value;

    let tags = [];
    if (tagsInput) {
      tags = tagsInput
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);
    }

    let dateFrom = null;
    let dateTo = null;

    if (datePreset === "today") {
      dateFrom = new Date();
      dateFrom.setHours(0, 0, 0, 0);
      dateTo = new Date();
      dateTo.setHours(23, 59, 59, 999);
    } else if (datePreset === "week") {
      dateFrom = getWeekStart(new Date());
      dateTo = new Date();
    } else if (datePreset === "month") {
      dateFrom = new Date();
      dateFrom.setDate(1);
      dateFrom.setHours(0, 0, 0, 0);
      dateTo = new Date();
    } else if (datePreset === "custom") {
      const fromInput = document.getElementById("date-from").value;
      const toInput = document.getElementById("date-to").value;
      if (fromInput) dateFrom = new Date(fromInput);
      if (toInput) dateTo = new Date(toInput + "T23:59:59");
    }

    return {
      text,
      tags,
      dateFrom,
      dateTo,
      sortBy,
      sortOrder,
      limit: 100,
    };
  }
  // Инициализация стрелочек для навигации по периодам
  initNavigationArrows() {
    // Обработчики для недели
    const weekArrows = document.querySelectorAll("#week-view .nav-arrow");
    if (weekArrows.length >= 2) {
      weekArrows[0].addEventListener("click", () => this.navigateWeek(-1));
      weekArrows[1].addEventListener("click", () => this.navigateWeek(1));
    }

    // Обработчики для месяца
    const monthArrows = document.querySelectorAll("#month-view .nav-arrow");
    if (monthArrows.length >= 2) {
      monthArrows[0].addEventListener("click", () => this.navigateMonth(-1));
      monthArrows[1].addEventListener("click", () => this.navigateMonth(1));
    }
  }

  // Навигация по неделям
  navigateWeek(direction) {
    if (!this.currentWeekStart) {
      this.currentWeekStart = getWeekStart(new Date());
    }

    this.currentWeekStart.setDate(
      this.currentWeekStart.getDate() + direction * 7
    );
    this.loadWeekView();
  }

  // Навигация по месяцам
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

  // Показ предложений поиска
  async showSearchSuggestions() {
    const suggestionsContainer = document.getElementById("search-suggestions");

    try {
      const popularTags = await db.getPopularTags(10);

      if (popularTags.length > 0) {
        const suggestionsHTML = `
        <div class="suggestions">
          <h4>Популярные теги:</h4>
          <div class="tag-suggestions">
            ${popularTags
              .map(
                ({ tag, count }) =>
                  `<span class="tag-suggestion" data-tag="${tag}">${tag} (${count})</span>`
              )
              .join("")}
          </div>
        </div>
      `;

        suggestionsContainer.innerHTML = suggestionsHTML;

        // Добавляем обработчики клика на теги
        suggestionsContainer
          .querySelectorAll(".tag-suggestion")
          .forEach((tagEl) => {
            tagEl.addEventListener("click", (e) => {
              const tag = e.target.dataset.tag;
              document.getElementById("search-input").value = tag;
              this.performSearch(tag);
            });
          });
      }
    } catch (error) {
      console.error("Ошибка загрузки предложений:", error);
    }
  }

  // Отображение результатов поиска (улучшенная версия)
  displaySearchResults(notes, query) {
    const searchResults = document.getElementById("search-results-list");
    const suggestionsContainer = document.getElementById("search-suggestions");

    // Скрываем предложения
    suggestionsContainer.innerHTML = "";

    if (notes.length === 0) {
      searchResults.innerHTML = `
      <div class="no-results">
        <p>По запросу <strong>"${this.escapeHtml(
          query
        )}"</strong> ничего не найдено</p>
        <p>Попробуйте:</p>
        <ul>
          <li>Упростить запрос</li>
          <li>Проверить правильность написания</li>
          <li>Использовать другие ключевые слова</li>
        </ul>
      </div>
    `;
      return;
    }

    const resultsHTML = `
    <div class="search-results-header">
      <p>Найдено записей: <strong>${
        notes.length
      }</strong> по запросу <strong>"${this.escapeHtml(query)}"</strong></p>
    </div>
    <div class="search-results-list">
      ${notes.map((note) => this.createSearchResultHTML(note)).join("")}
    </div>
  `;

    searchResults.innerHTML = resultsHTML;
  }

  // Создание HTML для результата поиска с подсветкой
  createSearchResultHTML(note) {
    const date = new Date(note.date);
    const dateString = date.toLocaleDateString("ru-RU");
    const timeString = date.toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
    });

    // Используем подсвеченный контент, если он есть
    const content = note.highlightedContent || this.escapeHtml(note.content);

    const tagsHtml =
      note.tags.length > 0
        ? `<div class="note-tags">${note.tags
            .map((tag) =>
              note.highlightedTags
                ? note.highlightedTags.find((ht) => ht.includes(tag)) || tag
                : tag
            )
            .join(" ")}</div>`
        : "";

    return `
    <div class="search-result-item note-item" data-note-id="${note.id}">
      <div class="note-date">${dateString} ${timeString}</div>
      <div class="note-content">${content}</div>
      ${tagsHtml}
    </div>
  `;
  }

  // Очистка поиска
  clearSearch() {
    document.getElementById("search-input").value = "";
    document.getElementById("tags-filter").value = "";
    document.getElementById("date-from").value = "";
    document.getElementById("date-to").value = "";
    document.getElementById("date-range-preset").value = "";
    document.getElementById("sort-by").value = "date";
    document.getElementById("sort-order").value = "desc";

    const searchResults = document.getElementById("search-results-list");
    searchResults.innerHTML = "<p>Введите поисковый запрос</p>";

    this.showSearchSuggestions();
  }

  // Вспомогательные функции
  formatDate(date) {
    return date.toLocaleDateString("ru-RU");
  }

  formatDayHeader(dateString) {
    const date = new Date(dateString);
    const dayNames = [
      "Воскресенье",
      "Понедельник",
      "Вторник",
      "Среда",
      "Четверг",
      "Пятница",
      "Суббота",
    ];
    return `${dayNames[date.getDay()]}, ${this.formatDate(date)}`;
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  // Обновление списка последних записей (для вызова из index.js)
  async updateRecentNotes() {
    if (this.currentView === "today") {
      await this.loadTodayView();
    }
  }
}
