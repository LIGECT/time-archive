// Утилиты для работы с датами в проекте

// Предустановленные диапазоны для быстрого доступа
export const DATE_RANGES = {
  TODAY: "today",
  YESTERDAY: "yesterday",
  THIS_WEEK: "thisWeek",
  LAST_WEEK: "lastWeek",
  THIS_MONTH: "thisMonth",
  LAST_MONTH: "lastMonth",
  THIS_YEAR: "thisYear",
  LAST_7_DAYS: "last7Days",
  LAST_30_DAYS: "last30Days",
  LAST_90_DAYS: "last90Days",
  ALL_TIME: "allTime",
};

// Получить диапазон дат по типу
export function getDateRangeByType(rangeType) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (rangeType) {
    case DATE_RANGES.TODAY:
      return {
        start: new Date(today),
        end: new Date(today.getTime() + 24 * 60 * 60 * 1000),
      };

    case DATE_RANGES.YESTERDAY:
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      return {
        start: yesterday,
        end: new Date(today),
      };

    case DATE_RANGES.THIS_WEEK:
      const thisWeekStart = getWeekStart(now);
      const thisWeekEnd = new Date(thisWeekStart);
      thisWeekEnd.setDate(thisWeekStart.getDate() + 7);
      return {
        start: thisWeekStart,
        end: thisWeekEnd,
      };

    case DATE_RANGES.LAST_WEEK:
      const lastWeekStart = getWeekStart(now);
      lastWeekStart.setDate(lastWeekStart.getDate() - 7);
      const lastWeekEnd = new Date(lastWeekStart);
      lastWeekEnd.setDate(lastWeekStart.getDate() + 7);
      return {
        start: lastWeekStart,
        end: lastWeekEnd,
      };

    case DATE_RANGES.THIS_MONTH:
      return {
        start: new Date(now.getFullYear(), now.getMonth(), 1),
        end: new Date(now.getFullYear(), now.getMonth() + 1, 1),
      };

    case DATE_RANGES.LAST_MONTH:
      return {
        start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        end: new Date(now.getFullYear(), now.getMonth(), 1),
      };

    case DATE_RANGES.THIS_YEAR:
      return {
        start: new Date(now.getFullYear(), 0, 1),
        end: new Date(now.getFullYear() + 1, 0, 1),
      };

    case DATE_RANGES.LAST_7_DAYS:
      const last7Start = new Date(now);
      last7Start.setDate(now.getDate() - 7);
      return {
        start: last7Start,
        end: now,
      };

    case DATE_RANGES.LAST_30_DAYS:
      const last30Start = new Date(now);
      last30Start.setDate(now.getDate() - 30);
      return {
        start: last30Start,
        end: now,
      };

    case DATE_RANGES.LAST_90_DAYS:
      const last90Start = new Date(now);
      last90Start.setDate(now.getDate() - 90);
      return {
        start: last90Start,
        end: now,
      };

    case DATE_RANGES.ALL_TIME:
      return {
        start: new Date("1970-01-01"),
        end: new Date("2099-12-31"),
      };

    default:
      throw new Error(`Неизвестный тип диапазона: ${rangeType}`);
  }
}

// Получить начало недели
export function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const weekStart = new Date(d.setDate(diff));
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
}

// Примеры использования в твоём коде
export function getDateRangeExamples() {
  return {
    // Записи за сегодня
    todayNotes: () => db.getTodayNotes(),

    // Записи за последнюю неделю
    lastWeekNotes: () => {
      const range = getDateRangeByType(DATE_RANGES.LAST_7_DAYS);
      return db.getNotesByDateRange(range.start, range.end);
    },

    // Записи за текущий месяц
    thisMonthNotes: () => {
      const range = getDateRangeByType(DATE_RANGES.THIS_MONTH);
      return db.getNotesByDateRange(range.start, range.end);
    },

    // Кастомный диапазон
    customRange: (startDate, endDate) => {
      return db.getNotesByDateRange(startDate, endDate);
    },
  };
}
