import Dexie from "dexie";
import { DATE_RANGES, getDateRangeByType } from "./dateUtils.js";
import { getWeekStart as getWeekStartUtil } from "./dateUtils.js";

// Класс для работы с базой данных. Наследуемся от Dexie, чтобы не писать лишнего говна.
class TimeArchiveDB extends Dexie {
  constructor() {
    // Название базы. В IndexedDB оно будет отображаться как 'TimeArchive'.
    super("TimeArchive");

    // Определяем схему базы данных, версия 1.
    this.version(1).stores({
      // Таблица notes:
      // ++id — автоинкрементный первичный ключ (за нас IndexedDB будет создавать уникальные ID)
      // date — дата записи (будет проиндексирована для быстрого поиска по датам)
      // content — текст заметки (индекс для полнотекстового поиска, хотя IndexedDB в этом говно)
      // tags — массив тегов (индекс для поиска по тегам)
      notes: "++id, date, content, tags",
    });

    // Привязываем таблицы к свойствам класса для удобного доступа.
    this.notes = this.table("notes");
  }

  // Добавить новую запись в архив страданий.
  async addNote(content, tags = []) {
    try {
      const note = {
        content: content.trim(),
        tags: Array.isArray(tags) ? tags : [],
        date: new Date(), // Текущая дата и время
      };

      // Dexie.add() возвращает Promise с ID созданной записи.
      const id = await this.notes.add(note);
      console.log(`Запись добавлена с ID: ${id}`);
      return id;
    } catch (error) {
      console.error("Ошибка при добавлении записи:", error);
      throw error;
    }
  }

  // === БАЗОВЫЕ МЕТОДЫ ДЛЯ РАБОТЫ С ДИАПАЗОНАМИ ДАТ ===

  // Основной метод получения записей по диапазону дат
  async getNotesByDateRange(
    startDate,
    endDate,
    includeStart = true,
    includeEnd = false
  ) {
    try {
      return await this.notes
        .where("date")
        .between(startDate, endDate, includeStart, includeEnd) // [web:30][web:33]
        .reverse() // Свежие записи сверху
        .toArray();
    } catch (error) {
      console.error("Ошибка получения записей по диапазону:", error);
      throw error;
    }
  }

  // Записи за сегодня
  async getTodayNotes() {
    const { start, end } = getDateRangeByType(DATE_RANGES.TODAY);
    return await this.getNotesByDateRange(start, end, true, false);
  }

  // Записи за вчера
  async getYesterdayNotes() {
    const { start, end } = getDateRangeByType(DATE_RANGES.YESTERDAY);
    return await this.getNotesByDateRange(start, end, true, false);
  }

  // === БАЗОВЫЙ ПОИСК ===

  // Простой поиск по содержимому и тегам (как у тебя уже есть, но улучшенный)
  async searchNotes(query, options = {}) {
    if (!query || query.trim().length === 0) {
      return [];
    }

    const {
      caseSensitive = false,
      searchInContent = true,
      searchInTags = true,
      exactMatch = false,
      limit = 100,
      dateFrom = null,
      dateTo = null,
    } = options;

    const searchQuery = caseSensitive
      ? query.trim()
      : query.trim().toLowerCase();

    let notesCollection = this.notes.toCollection();

    // Фильтруем по дате, если указана
    if (dateFrom || dateTo) {
      const from = dateFrom || new Date("1970-01-01");
      const to = dateTo || new Date("2099-12-31");
      notesCollection = this.notes.where("date").between(from, to, true, true);
    }

    const results = await notesCollection
      .filter((note) => {
        let contentMatch = false;
        let tagMatch = false;

        if (searchInContent) {
          const content = caseSensitive
            ? note.content
            : note.content.toLowerCase();
          contentMatch = exactMatch
            ? content === searchQuery
            : content.includes(searchQuery);
        }

        if (searchInTags && note.tags.length > 0) {
          tagMatch = note.tags.some((tag) => {
            const tagText = caseSensitive ? tag : tag.toLowerCase();
            return exactMatch
              ? tagText === searchQuery
              : tagText.includes(searchQuery);
          });
        }

        return contentMatch || tagMatch;
      })
      .reverse() // Новые записи сверху
      .limit(limit)
      .toArray();

    return results;
  }

  // === ПРОДВИНУТЫЙ ПОИСК ===

  // Поиск только по тегам
  async searchByTags(tags, matchAll = false) {
    if (!Array.isArray(tags) || tags.length === 0) {
      return [];
    }

    const normalizedTags = tags.map((tag) =>
      tag.startsWith("#") ? tag.toLowerCase() : `#${tag.toLowerCase()}`
    );

    return await this.notes
      .filter((note) => {
        if (!note.tags || note.tags.length === 0) return false;

        const noteTags = note.tags.map((tag) => tag.toLowerCase());

        return matchAll
          ? // ВСЕ теги должны присутствовать
            normalizedTags.every((tag) => noteTags.includes(tag))
          : // Хотя бы один тег должен присутствовать
            normalizedTags.some((tag) => noteTags.includes(tag));
      })
      .reverse()
      .toArray();
  }

  // Поиск по началу строки (быстрее для больших БД) [web:39]
  async searchNotesStartsWith(query, field = "content") {
    if (!query || query.trim().length === 0) {
      return [];
    }

    const searchQuery = query.trim().toLowerCase();

    return await this.notes
      .filter((note) => {
        if (field === "content") {
          return note.content.toLowerCase().startsWith(searchQuery);
        } else if (field === "tags") {
          return note.tags.some((tag) =>
            tag.toLowerCase().startsWith(searchQuery)
          );
        }
        return false;
      })
      .reverse()
      .toArray();
  }

  // Полнотекстовый поиск с подсветкой совпадений
  async fullTextSearch(query, options = {}) {
    const {
      highlightMatches = false,
      minWordLength = 2,
      stopWords = ["и", "в", "на", "с", "по", "для", "от", "к", "до", "из"],
      limit = 50,
    } = options;

    if (!query || query.trim().length < minWordLength) {
      return [];
    }

    // Разбиваем запрос на слова и убираем стоп-слова
    const words = query
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(
        (word) => word.length >= minWordLength && !stopWords.includes(word)
      );

    if (words.length === 0) {
      return [];
    }

    const results = await this.notes
      .filter((note) => {
        const content = note.content.toLowerCase();
        const tags = note.tags.join(" ").toLowerCase();
        const searchText = `${content} ${tags}`;

        // Ищем все слова
        return words.every((word) => searchText.includes(word));
      })
      .reverse()
      .limit(limit)
      .toArray();

    // Добавляем подсветку, если нужно
    if (highlightMatches) {
      return results.map((note) => ({
        ...note,
        highlightedContent: this.highlightMatches(note.content, words),
        highlightedTags: note.tags.map((tag) =>
          this.highlightMatches(tag, words)
        ),
      }));
    }

    return results;
  }

  // Вспомогательный метод для подсветки совпадений
  highlightMatches(text, words) {
    let highlighted = text;

    words.forEach((word) => {
      const regex = new RegExp(`(${word})`, "gi");
      highlighted = highlighted.replace(regex, "<mark>$1</mark>");
    });

    return highlighted;
  }

  // === КОМБИНИРОВАННЫЙ ПОИСК ===

  // Поиск с множественными критериями
  async advancedSearch(criteria) {
    const {
      text = "",
      tags = [],
      dateFrom = null,
      dateTo = null,
      hasAttachments = null, // true/false/null
      minLength = null,
      maxLength = null,
      sortBy = "date", // 'date', 'relevance'
      sortOrder = "desc", // 'asc', 'desc'
      limit = 100,
    } = criteria;

    let query = this.notes.toCollection();

    // Фильтр по дате
    if (dateFrom || dateTo) {
      const from = dateFrom || new Date("1970-01-01");
      const to = dateTo || new Date("2099-12-31");
      query = this.notes.where("date").between(from, to, true, true);
    }

    const results = await query
      .filter((note) => {
        // Поиск по тексту
        if (text && !note.content.toLowerCase().includes(text.toLowerCase())) {
          return false;
        }

        // Поиск по тегам
        if (tags.length > 0) {
          const hasTag = tags.some((tag) =>
            note.tags.some((noteTag) =>
              noteTag.toLowerCase().includes(tag.toLowerCase())
            )
          );
          if (!hasTag) return false;
        }

        // Фильтр по длине текста
        if (minLength !== null && note.content.length < minLength) {
          return false;
        }
        if (maxLength !== null && note.content.length > maxLength) {
          return false;
        }

        return true;
      })
      .toArray();

    // Сортировка
    if (sortBy === "date") {
      results.sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return sortOrder === "desc" ? dateB - dateA : dateA - dateB;
      });
    } else if (sortBy === "relevance" && text) {
      // Простая сортировка по релевантности
      results.sort((a, b) => {
        const aRelevance = this.calculateRelevance(a, text);
        const bRelevance = this.calculateRelevance(b, text);
        return sortOrder === "desc"
          ? bRelevance - aRelevance
          : aRelevance - bRelevance;
      });
    }

    return results.slice(0, limit);
  }

  // Вспомогательный метод расчёта релевантности
  calculateRelevance(note, query) {
    const content = note.content.toLowerCase();
    const queryLower = query.toLowerCase();

    let relevance = 0;

    // Точное совпадение = больше баллов
    if (content.includes(queryLower)) {
      relevance += 10;
    }

    // Совпадение в начале = больше баллов
    if (content.startsWith(queryLower)) {
      relevance += 5;
    }

    // Совпадение в тегах = больше баллов
    if (note.tags.some((tag) => tag.toLowerCase().includes(queryLower))) {
      relevance += 8;
    }

    return relevance;
  }

  // === СТАТИСТИКА ПОИСКА ===

  // Получить популярные теги
  async getPopularTags(limit = 20) {
    const allNotes = await this.notes.toArray();
    const tagCounts = {};

    allNotes.forEach((note) => {
      note.tags.forEach((tag) => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });

    return Object.entries(tagCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([tag, count]) => ({ tag, count }));
  }

  // Автодополнение для тегов
  async getTagSuggestions(prefix, limit = 10) {
    if (!prefix || prefix.length < 1) {
      return await this.getPopularTags(limit);
    }

    const allNotes = await this.notes.toArray();
    const matchingTags = new Set();

    allNotes.forEach((note) => {
      note.tags.forEach((tag) => {
        if (tag.toLowerCase().startsWith(prefix.toLowerCase())) {
          matchingTags.add(tag);
        }
      });
    });

    return Array.from(matchingTags).slice(0, limit);
  }

  // Сохранение истории поиска
  async saveSearchHistory(query, resultsCount) {
    const historyEntry = {
      query,
      resultsCount,
      timestamp: new Date(),
    };

    // Можно добавить отдельную таблицу для истории поиска
    console.log("Поиск сохранён в историю:", historyEntry);
  }

  // Получить все записи (для дебага и экспорта).
  async getAllNotes() {
    return await this.notes.reverse().toArray();
  }

  // Записи за текущую неделю
  async getThisWeekNotes() {
    const { start, end } = getDateRangeByType(DATE_RANGES.THIS_WEEK);
    return await this.getNotesByDateRange(start, end, true, false);
  }

  // Записи за конкретную неделю
  async getWeekNotes(weekStart) {
    const start = weekStart || getWeekStartUtil(new Date());
    const end = new Date(start);
    end.setDate(start.getDate() + 7);

    return await this.getNotesByDateRange(start, end, true, false);
  }

  // Записи за текущий месяц
  async getThisMonthNotes() {
    const { start, end } = getDateRangeByType(DATE_RANGES.THIS_MONTH);
    return await this.getNotesByDateRange(start, end, true, false);
  }

  // Записи за конкретный месяц
  async getMonthNotes(year, month) {
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 1);

    return await this.getNotesByDateRange(startDate, endDate, true, false);
  }

  // Записи за текущий год
  async getThisYearNotes() {
    const { start, end } = getDateRangeByType(DATE_RANGES.THIS_YEAR);
    return await this.getNotesByDateRange(start, end, true, false);
  }

  // Записи за конкретный год
  async getYearNotes(year = null) {
    const targetYear = year || new Date().getFullYear();
    const startDate = new Date(targetYear, 0, 1); // 1 января
    const endDate = new Date(targetYear + 1, 0, 1); // 1 января следующего года

    return await this.getNotesByDateRange(startDate, endDate, true, false);
  }

  // === ПРОДВИНУТЫЕ МЕТОДЫ ДЛЯ ДИАПАЗОНОВ ===

  // Записи за последние N дней
  async getLastNDaysNotes(days) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    return await this.getNotesByDateRange(startDate, endDate, true, true);
  }

  // Записи за последние N недель
  async getLastNWeeksNotes(weeks) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - weeks * 7);

    return await this.getNotesByDateRange(startDate, endDate, true, true);
  }

  // Записи за последние N месяцев
  async getLastNMonthsNotes(months) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(endDate.getMonth() - months);

    return await this.getNotesByDateRange(startDate, endDate, true, true);
  }

  // Записи с определённой даты до сегодня [web:32]
  async getNotesFromDate(startDate) {
    // Используем .aboveOrEqual() чтобы включить записи с самой startDate
    return await this.notes
      .where("date")
      .aboveOrEqual(startDate)
      .reverse()
      .toArray();
  }

  // Записи до определённой даты
  async getNotesBeforeDate(endDate) {
    return await this.notes.where("date").below(endDate).reverse().toArray();
  }

  // Получить статистику по записям (для годового обзора)
  async getNotesStats(year = null) {
    const yearNotes = await this.getYearNotes(year);

    // Группируем по месяцам
    const monthlyStats = {};
    for (let i = 0; i < 12; i++) {
      monthlyStats[i] = 0;
    }

    yearNotes.forEach((note) => {
      const month = note.date.getMonth();
      monthlyStats[month]++;
    });

    return {
      totalNotes: yearNotes.length,
      monthlyStats,
      allNotes: yearNotes,
    };
  }

  // === СТАТИСТИЧЕСКИЕ МЕТОДЫ ===

  // Статистика записей по дням за период
  async getDailyStats(startDate, endDate) {
    const notes = await this.getNotesByDateRange(
      startDate,
      endDate,
      true,
      true
    );

    const dailyStats = {};
    notes.forEach((note) => {
      const dateKey = note.date.toISOString().split("T")[0]; // YYYY-MM-DD

      if (!dailyStats[dateKey]) {
        dailyStats[dateKey] = {
          date: dateKey,
          count: 0,
          notes: [],
        };
      }

      dailyStats[dateKey].count++;
      dailyStats[dateKey].notes.push(note);
    });

    return Object.values(dailyStats).sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    );
  }

  // Статистика по тегам за период
  async getTagStatsForPeriod(startDate, endDate) {
    const notes = await this.getNotesByDateRange(
      startDate,
      endDate,
      true,
      true
    );

    const tagStats = {};
    notes.forEach((note) => {
      note.tags.forEach((tag) => {
        if (!tagStats[tag]) {
          tagStats[tag] = {
            tag,
            count: 0,
            notes: [],
          };
        }
        tagStats[tag].count++;
        tagStats[tag].notes.push(note);
      });
    });

    // Сортируем по популярности
    return Object.values(tagStats).sort((a, b) => b.count - a.count);
  }

  // Получить записи с пагинацией [web:32]
  async getNotesPaginated(
    offset = 0,
    limit = 20,
    startDate = null,
    endDate = null
  ) {
    let query = this.notes.orderBy("date").reverse();

    // Если указан диапазон дат, фильтруем
    if (startDate && endDate) {
      query = this.notes
        .where("date")
        .between(startDate, endDate, true, false)
        .reverse();
    }

    return await query.offset(offset).limit(limit).toArray();
  }

  // === ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ===

  // Форматирование диапазона дат для отображения
  formatDateRange(startDate, endDate) {
    const start = startDate.toLocaleDateString("ru-RU");
    const end = endDate.toLocaleDateString("ru-RU");

    if (start === end) {
      return start;
    }

    return `${start} - ${end}`;
  }
}

// Создаём единственный экземпляр базы данных для всего приложения.
// Паттерн Singleton, чтобы не плодить подключения.
export const db = new TimeArchiveDB();
