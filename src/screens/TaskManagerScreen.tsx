import React, {useEffect, useMemo, useState} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Alert,
  FlatList,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  StatusBar,
  Text,
  TextInput,
  View,
} from 'react-native';
import {saveTaskToCalendar} from '../services/calendarService';
import {
  initializeNotifications,
  scheduleTaskReminder,
} from '../services/notificationService';
import {TaskItem} from '../types/task';
import {parseTaskWithAI} from '../utils/aiTaskParser';

type TaskView = 'Daily' | 'Weekly';

type CalendarDay = {
  date: Date;
  isCurrentMonth: boolean;
};

const TASK_STORAGE_KEY = 'intelligent-task-manager/tasks';

const isSameDay = (left: Date, right: Date) =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();

const isWithinSelectedWeek = (date: Date, selectedDate: Date) => {
  const start = new Date(selectedDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return date >= start && date <= end;
};

const formatTaskDate = (value: string | null) => {
  if (!value) {
    return 'No date detected';
  }

  return new Date(value).toLocaleString();
};

const formatTaskTimeOnly = (value: string | null) => {
  if (!value) {
    return 'No exact time detected';
  }

  return new Date(value).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
};

const formatCalendarHeader = (value: Date) =>
  value.toLocaleString(undefined, {
    month: 'long',
    year: 'numeric',
  });

const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const buildCalendarDays = (focusedDate: Date): CalendarDay[] => {
  const firstDayOfMonth = new Date(
    focusedDate.getFullYear(),
    focusedDate.getMonth(),
    1,
  );
  const start = new Date(firstDayOfMonth);
  start.setDate(firstDayOfMonth.getDate() - firstDayOfMonth.getDay());

  return Array.from({length: 35}, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);

    return {
      date,
      isCurrentMonth: date.getMonth() === focusedDate.getMonth(),
    };
  });
};

export const TaskManagerScreen = () => {
  const [rawTask, setRawTask] = useState('');
  const [view, setView] = useState<TaskView>('Daily');
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  });

  const calendarDays = useMemo(
    () => buildCalendarDays(selectedDate),
    [selectedDate],
  );

  useEffect(() => {
    initializeNotifications().catch(() => {
      Alert.alert(
        'Notifications',
        'Notification permissions could not be initialized.',
      );
    });
  }, []);

  useEffect(() => {
    const loadTasks = async () => {
      try {
        const storedTasks = await AsyncStorage.getItem(TASK_STORAGE_KEY);

        if (!storedTasks) {
          return;
        }

        const parsedTasks = JSON.parse(storedTasks) as TaskItem[];
        setTasks(parsedTasks);
      } catch {
        Alert.alert(
          'Saved Tasks',
          'Previously saved tasks could not be loaded.',
        );
      } finally {
        setIsLoadingTasks(false);
      }
    };

    loadTasks().catch(() => {
      setIsLoadingTasks(false);
    });
  }, []);

  useEffect(() => {
    if (isLoadingTasks) {
      return;
    }

    AsyncStorage.setItem(TASK_STORAGE_KEY, JSON.stringify(tasks)).catch(() => {
      Alert.alert('Saved Tasks', 'Tasks could not be saved locally.');
    });
  }, [isLoadingTasks, tasks]);

  const visibleTasks = useMemo(() => {
    return tasks.filter(task => {
      if (!task.dueAt) {
        return view === 'Weekly';
      }

      const dueDate = new Date(task.dueAt);
      return view === 'Daily'
        ? isSameDay(dueDate, selectedDate)
        : isWithinSelectedWeek(dueDate, selectedDate);
    });
  }, [selectedDate, tasks, view]);

  const markedDates = useMemo(() => {
    return new Set(
      tasks
        .filter(task => task.dueAt)
        .map(task => new Date(task.dueAt as string).toDateString()),
    );
  }, [tasks]);

  const handleAddTask = async () => {
    const trimmed = rawTask.trim();

    if (!trimmed || isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      const parsedTask = await parseTaskWithAI(trimmed);
      const nextTask: TaskItem = {
        ...parsedTask,
        id: `${Date.now()}`,
        rawText: trimmed,
        completed: false,
        createdAt: new Date().toISOString(),
      };

      setTasks(current => [nextTask, ...current]);
      setSelectedDate(() => {
        const nextDate = nextTask.dueAt ? new Date(nextTask.dueAt) : new Date();
        nextDate.setHours(0, 0, 0, 0);
        return nextDate;
      });
      setView('Daily');
      setRawTask('');

      await scheduleTaskReminder(nextTask);
      await saveTaskToCalendar(nextTask);
    } catch {
      Alert.alert(
        'Task Parsing Failed',
        'The task could not be parsed. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleTaskCompletion = (taskId: string) => {
    setTasks(current =>
      current.map(task =>
        task.id === taskId
          ? {
              ...task,
              completed: !task.completed,
            }
          : task,
      ),
    );
  };

  const shiftCalendarMonth = (offset: number) => {
    setSelectedDate(current => {
      const next = new Date(current);
      next.setMonth(current.getMonth() + offset);
      return next;
    });
  };

  const renderCalendarDay = (day: CalendarDay) => {
    const isSelected = isSameDay(day.date, selectedDate);
    const isMarked = markedDates.has(day.date.toDateString());

    return (
      <Pressable
        key={day.date.toISOString()}
        onPress={() => setSelectedDate(new Date(day.date))}
        style={[
          styles.calendarDay,
          isSelected && styles.calendarDaySelected,
          !day.isCurrentMonth && styles.calendarDayMuted,
        ]}>
        <Text
          style={[
            styles.calendarDayLabel,
            isSelected && styles.calendarDayLabelSelected,
            !day.isCurrentMonth && styles.calendarDayLabelMuted,
          ]}>
          {day.date.getDate()}
        </Text>
        {isMarked ? (
          <View
            style={[
              styles.calendarDot,
              isSelected && styles.calendarDotSelected,
            ]}
          />
        ) : null}
      </Pressable>
    );
  };

  const renderTask = ({item}: {item: TaskItem}) => (
    <View style={styles.taskCard}>
      <Pressable
        onPress={() => toggleTaskCompletion(item.id)}
        style={[styles.checkbox, item.completed && styles.checkboxChecked]}>
        {item.completed ? <Text style={styles.checkmark}>✓</Text> : null}
      </Pressable>

      <View style={styles.taskContent}>
        <Text style={[styles.taskTitle, item.completed && styles.taskTitleDone]}>
          {item.title}
        </Text>
        <Text style={styles.taskMeta}>
          {item.category} | {formatTaskDate(item.dueAt)}
        </Text>
        <Text style={styles.taskMeta}>
          Meeting time: {formatTaskTimeOnly(item.dueAt)}
        </Text>
        <Text style={styles.taskMeta}>
          Reminders: 1h, 30m, 5m before and at the exact time
        </Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.heroRow}>
        <View style={styles.logoBadge}>
          <Image
            source={require('../../assets/app-logo.png')}
            style={styles.logoImage}
            resizeMode="cover"
          />
        </View>
        <View style={styles.heroText}>
          <Text style={styles.heading}>Intelligent Task Manager</Text>
          <Text style={styles.subheading}>
            Turn raw notes into organized tasks, reminders, and calendar events.
          </Text>
        </View>
      </View>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.inputCard}>
          <Text style={styles.sectionEyebrow}>Quick Capture</Text>
          <TextInput
            value={rawTask}
            onChangeText={setRawTask}
            placeholder="Type a task like: Meeting with the design team tomorrow at 2 PM"
            placeholderTextColor="#8A94A6"
            multiline
            style={styles.input}
          />

          <Pressable
            onPress={handleAddTask}
            disabled={isSubmitting}
            style={[styles.addButton, isSubmitting && styles.addButtonDisabled]}>
            <Text style={styles.addButtonText}>
              {isSubmitting ? 'Parsing...' : 'Add with AI'}
            </Text>
          </Pressable>
        </View>

        <View style={styles.calendarCard}>
          <Text style={styles.sectionEyebrow}>Planner</Text>
          <View style={styles.calendarHeaderRow}>
            <Text style={styles.calendarTitle}>Task Calendar</Text>
            <View style={styles.calendarActions}>
              <Pressable
                onPress={() => shiftCalendarMonth(-1)}
                style={styles.calendarNavButton}>
                <Text style={styles.calendarNavLabel}>{'<'}</Text>
              </Pressable>
              <Pressable
                onPress={() => shiftCalendarMonth(1)}
                style={styles.calendarNavButton}>
                <Text style={styles.calendarNavLabel}>{'>'}</Text>
              </Pressable>
            </View>
          </View>

          <Text style={styles.calendarMonthLabel}>
            {formatCalendarHeader(selectedDate)}
          </Text>

          <View style={styles.calendarWeekdays}>
            {weekdayLabels.map(label => (
              <Text key={label} style={styles.calendarWeekdayLabel}>
                {label}
              </Text>
            ))}
          </View>

          <View style={styles.calendarGrid}>
            {calendarDays.map(renderCalendarDay)}
          </View>

          <Text style={styles.calendarHint}>
            Tap a date to see daily tasks. Important dated tasks are also saved to
            the device calendar after permission is granted.
          </Text>
        </View>

        <View style={styles.segmentedControl}>
          {(['Daily', 'Weekly'] as TaskView[]).map(option => (
            <Pressable
              key={option}
              onPress={() => setView(option)}
              style={[
                styles.segmentButton,
                view === option && styles.segmentButtonActive,
              ]}>
              <Text
                style={[
                  styles.segmentLabel,
                  view === option && styles.segmentLabelActive,
                ]}>
                {option}
              </Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          onPress={() => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            setSelectedDate(today);
            setView('Daily');
          }}
          style={styles.todayShortcut}>
          <Text style={styles.todayShortcutText}>
            Jump to Today: {selectedDate.toLocaleDateString()}
          </Text>
        </Pressable>

        {visibleTasks.length > 0 ? (
          <FlatList
            data={visibleTasks}
            keyExtractor={item => item.id}
            renderItem={renderTask}
            scrollEnabled={false}
            contentContainerStyle={styles.listContent}
          />
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>
              {isLoadingTasks
                ? 'Loading your tasks'
                : `No ${view.toLowerCase()} tasks yet`}
            </Text>
            <Text style={styles.emptyText}>
              {isLoadingTasks
                ? 'Please wait while the app restores your saved tasks.'
                : 'Add a task above and the AI parser will organize it for you.'}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 24 : 24,
  },
  scrollContent: {
    paddingBottom: 36,
  },
  heading: {
    fontSize: 28,
    fontWeight: '700',
    color: '#132238',
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroText: {
    flex: 1,
    marginLeft: 14,
  },
  logoBadge: {
    width: 56,
    height: 56,
    borderRadius: 18,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#246BFD',
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: {width: 0, height: 6},
    elevation: 4,
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  sectionEyebrow: {
    marginBottom: 10,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#7A8799',
  },
  subheading: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    color: '#5C6B80',
  },
  inputCard: {
    marginTop: 24,
    padding: 16,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    shadowColor: '#183153',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: {width: 0, height: 8},
    elevation: 4,
  },
  input: {
    minHeight: 96,
    fontSize: 15,
    color: '#132238',
    textAlignVertical: 'top',
  },
  addButton: {
    marginTop: 16,
    borderRadius: 14,
    backgroundColor: '#246BFD',
    paddingVertical: 14,
    alignItems: 'center',
  },
  addButtonDisabled: {
    opacity: 0.7,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  segmentedControl: {
    flexDirection: 'row',
    marginTop: 24,
    padding: 4,
    borderRadius: 16,
    backgroundColor: '#E9EEF6',
  },
  segmentButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  segmentButtonActive: {
    backgroundColor: '#FFFFFF',
  },
  segmentLabel: {
    color: '#5C6B80',
    fontSize: 14,
    fontWeight: '600',
  },
  segmentLabelActive: {
    color: '#132238',
  },
  listContent: {
    paddingTop: 20,
    flexGrow: 1,
  },
  todayShortcut: {
    marginTop: 16,
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#E9EEF6',
  },
  todayShortcutText: {
    color: '#132238',
    fontSize: 13,
    fontWeight: '700',
  },
  calendarCard: {
    marginTop: 20,
    padding: 16,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    shadowColor: '#183153',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: {width: 0, height: 8},
    elevation: 4,
  },
  calendarHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  calendarTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#132238',
  },
  calendarActions: {
    flexDirection: 'row',
  },
  calendarNavButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginLeft: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E9EEF6',
  },
  calendarNavLabel: {
    color: '#132238',
    fontSize: 16,
    fontWeight: '700',
  },
  calendarMonthLabel: {
    marginTop: 12,
    fontSize: 15,
    fontWeight: '600',
    color: '#5C6B80',
  },
  calendarWeekdays: {
    flexDirection: 'row',
    marginTop: 16,
  },
  calendarWeekdayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: '#7A8799',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
  },
  calendarDay: {
    width: '14.28%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 6,
  },
  calendarDaySelected: {
    backgroundColor: '#246BFD',
    shadowColor: '#246BFD',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: {width: 0, height: 4},
    elevation: 3,
  },
  calendarDayMuted: {
    opacity: 0.45,
  },
  calendarDayLabel: {
    color: '#132238',
    fontSize: 14,
    fontWeight: '600',
  },
  calendarDayLabelSelected: {
    color: '#FFFFFF',
  },
  calendarDayLabelMuted: {
    color: '#7A8799',
  },
  calendarDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 4,
    backgroundColor: '#246BFD',
  },
  calendarDotSelected: {
    backgroundColor: '#FFFFFF',
  },
  calendarHint: {
    marginTop: 12,
    fontSize: 13,
    lineHeight: 20,
    color: '#5C6B80',
  },
  taskCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    shadowColor: '#183153',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: {width: 0, height: 6},
    elevation: 3,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#B8C4D6',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    borderColor: '#246BFD',
    backgroundColor: '#246BFD',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  taskContent: {
    flex: 1,
    marginLeft: 14,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#132238',
  },
  taskTitleDone: {
    textDecorationLine: 'line-through',
    color: '#7A8799',
  },
  taskMeta: {
    marginTop: 6,
    fontSize: 13,
    color: '#5C6B80',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#132238',
  },
  emptyText: {
    marginTop: 8,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 21,
    color: '#6A778B',
    maxWidth: 280,
  },
});
