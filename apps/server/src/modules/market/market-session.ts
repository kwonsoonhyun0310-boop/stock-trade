const REGULAR_MARKET_OPEN_MINUTES = 9 * 60 + 30;
const REGULAR_MARKET_CLOSE_MINUTES = 16 * 60;

const usMarketClockFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  weekday: "short",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false
});

interface UsMarketState {
  dateKey: string;
  minuteOfDay: number;
  isWeekday: boolean;
  isRegularOpen: boolean;
  refreshKey: string;
}

const getUsClockParts = (value: Date | string) =>
  Object.fromEntries(
    usMarketClockFormatter
      .formatToParts(new Date(value))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

export const getUsRegularMarketState = (value: Date | string = new Date()): UsMarketState => {
  const parts = getUsClockParts(value);
  const dateKey = `${parts.year}-${parts.month}-${parts.day}`;
  const minuteOfDay = Number(parts.hour ?? 0) * 60 + Number(parts.minute ?? 0);
  const isWeekday =
    parts.weekday === "Mon" ||
    parts.weekday === "Tue" ||
    parts.weekday === "Wed" ||
    parts.weekday === "Thu" ||
    parts.weekday === "Fri";
  const isRegularOpen =
    isWeekday &&
    minuteOfDay >= REGULAR_MARKET_OPEN_MINUTES &&
    minuteOfDay < REGULAR_MARKET_CLOSE_MINUTES;

  let phase = "weekend";

  if (isWeekday && minuteOfDay < REGULAR_MARKET_OPEN_MINUTES) {
    phase = "preopen";
  } else if (isRegularOpen) {
    phase = `open:${Math.floor((minuteOfDay - REGULAR_MARKET_OPEN_MINUTES) / 30)}`;
  } else if (isWeekday) {
    phase = "afterclose";
  }

  return {
    dateKey,
    minuteOfDay,
    isWeekday,
    isRegularOpen,
    refreshKey: `${dateKey}:${phase}`
  };
};

export const hasFreshUsRegularMarketData = (generatedAt: Date | string, now: Date | string = new Date()) =>
  getUsRegularMarketState(generatedAt).refreshKey === getUsRegularMarketState(now).refreshKey;
