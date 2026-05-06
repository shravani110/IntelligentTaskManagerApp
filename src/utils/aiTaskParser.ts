import axios from 'axios';
import {ParsedTask} from '../types/task';

const AI_ENDPOINT = 'https://example.com/v1/tasks/parse';

type ParseTaskRequest = {
  input: string;
  timezone: string;
};

type ParseTaskResponse = {
  data: ParsedTask;
};

const api = axios.create({
  baseURL: AI_ENDPOINT,
  timeout: 8000,
  headers: {
    'Content-Type': 'application/json',
  },
});

const monthNames = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];

const weekdayNames = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

const parseTimeFromText = (input: string) => {
  const match = input.match(/(\d{1,2})(?:[:.](\d{1,2}))?\s*(am|pm)\b/i);

  if (!match) {
    return null;
  }

  let hours = Number(match[1]);
  const rawMinutes = match[2] ? Number(match[2]) : 0;
  const minutes = match[2] && match[2].length === 1 ? rawMinutes * 10 : rawMinutes;
  const meridiem = match[3].toLowerCase();

  if (meridiem === 'pm' && hours !== 12) {
    hours += 12;
  }

  if (meridiem === 'am' && hours === 12) {
    hours = 0;
  }

  return {hours, minutes};
};

const parseExplicitDayOfMonth = (input: string, now: Date) => {
  const match = input.match(/\b(\d{1,2})(st|nd|rd|th)\b/i);

  if (!match) {
    return null;
  }

  const day = Number(match[1]);
  const candidate = new Date(now);
  candidate.setDate(day);
  candidate.setHours(9, 0, 0, 0);

  if (candidate < now && !input.includes('today')) {
    candidate.setMonth(candidate.getMonth() + 1);
    candidate.setDate(day);
  }

  return candidate;
};

const parseNamedMonthDate = (input: string, now: Date) => {
  for (let index = 0; index < monthNames.length; index += 1) {
    const month = monthNames[index];
    const monthPattern = new RegExp(`${month}\\s+(\\d{1,2})`, 'i');
    const match = input.match(monthPattern);

    if (!match) {
      continue;
    }

    const candidate = new Date(now);
    candidate.setMonth(index, Number(match[1]));
    candidate.setHours(9, 0, 0, 0);

    if (candidate < now) {
      candidate.setFullYear(candidate.getFullYear() + 1);
    }

    return candidate;
  }

  return null;
};

const parseWeekdayDate = (input: string, now: Date) => {
  for (let index = 0; index < weekdayNames.length; index += 1) {
    const weekday = weekdayNames[index];

    if (!input.includes(weekday)) {
      continue;
    }

    const candidate = new Date(now);
    const dayOffset = (index - now.getDay() + 7) % 7 || 7;
    candidate.setDate(now.getDate() + dayOffset);
    candidate.setHours(9, 0, 0, 0);
    return candidate;
  }

  return null;
};

const buildDetectedDate = (input: string) => {
  const normalized = input.toLowerCase();
  const now = new Date();
  let candidate: Date | null = null;

  if (normalized.includes('today')) {
    candidate = new Date(now);
  } else if (normalized.includes('tomorrow')) {
    candidate = new Date(now);
    candidate.setDate(now.getDate() + 1);
  } else {
    candidate =
      parseNamedMonthDate(normalized, now) ??
      parseExplicitDayOfMonth(normalized, now) ??
      parseWeekdayDate(normalized, now);
  }

  const parsedTime = parseTimeFromText(normalized);

  if (!candidate && parsedTime) {
    candidate = new Date(now);
    candidate.setSeconds(0, 0);
    candidate.setHours(parsedTime.hours, parsedTime.minutes, 0, 0);

    if (candidate < now && !normalized.includes('today')) {
      candidate.setDate(candidate.getDate() + 1);
    }
  }

  if (!candidate) {
    return null;
  }

  if (parsedTime) {
    candidate.setHours(parsedTime.hours, parsedTime.minutes, 0, 0);
  } else {
    candidate.setHours(9, 0, 0, 0);
  }

  return candidate;
};

const buildMockTask = (input: string): ParsedTask => {
  const normalized = input.toLowerCase();
  const detectedDate = buildDetectedDate(input);

  const category: ParsedTask['category'] =
    normalized.includes('meeting') ||
    normalized.includes('design') ||
    normalized.includes('client') ||
    normalized.includes('office') ||
    normalized.includes('work')
      ? 'Work'
      : normalized.includes('doctor') || normalized.includes('gym')
        ? 'Health'
        : normalized.includes('family') || normalized.includes('home')
          ? 'Personal'
          : 'Other';

  const dueAt = detectedDate ? detectedDate.toISOString() : null;
  const reminderAt = dueAt
    ? new Date(new Date(dueAt).getTime() - 60 * 60 * 1000).toISOString()
    : null;

  return {
    title: input.trim(),
    category,
    dueAt,
    reminderAt,
    isImportant:
      normalized.includes('meeting') ||
      normalized.includes('deadline') ||
      normalized.includes('call') ||
      normalized.includes('appointment'),
    confidence: 0.91,
  };
};

export const parseTaskWithAI = async (input: string): Promise<ParsedTask> => {
  const payload: ParseTaskRequest = {
    input,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };

  try {
    const response = await api.post<ParseTaskResponse>('', payload);
    return response.data.data;
  } catch {
    return buildMockTask(input);
  }
};

/*
Expected JSON request payload:
{
  "input": "Meeting with the design team tomorrow at 2 PM",
  "timezone": "Asia/Calcutta"
}

Expected JSON response payload:
{
  "data": {
    "title": "Meeting with the design team",
    "category": "Work",
    "dueAt": "2026-04-11T14:00:00.000Z",
    "reminderAt": "2026-04-11T13:00:00.000Z",
    "isImportant": true,
    "confidence": 0.97
  }
}
*/
