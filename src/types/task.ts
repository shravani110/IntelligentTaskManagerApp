export type TaskCategory = 'Work' | 'Personal' | 'Health' | 'Other';

export type ParsedTask = {
  title: string;
  category: TaskCategory;
  dueAt: string | null;
  reminderAt: string | null;
  isImportant: boolean;
  confidence: number;
};

export type TaskItem = ParsedTask & {
  id: string;
  rawText: string;
  completed: boolean;
  createdAt: string;
};
