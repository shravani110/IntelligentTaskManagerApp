import notifee, {
  AndroidImportance,
  TimestampTrigger,
  TriggerType,
} from '@notifee/react-native';
import {TaskItem} from '../types/task';

const CHANNEL_ID = 'task-reminders';
const REMINDER_STEPS = [
  {suffix: 'one-hour', minutesBefore: 60, bodyPrefix: '1 hour left'},
  {suffix: 'thirty-minutes', minutesBefore: 30, bodyPrefix: '30 minutes left'},
  {suffix: 'five-minutes', minutesBefore: 5, bodyPrefix: '5 minutes left'},
  {suffix: 'start-time', minutesBefore: 0, bodyPrefix: 'It is time now'},
] as const;

const formatEventTime = (value: string) =>
  new Date(value).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });

export const initializeNotifications = async () => {
  await notifee.requestPermission();

  await notifee.createChannel({
    id: CHANNEL_ID,
    name: 'Task Reminders',
    importance: AndroidImportance.HIGH,
  });
};

export const scheduleTaskReminder = async (task: TaskItem) => {
  if (!task.dueAt) {
    return;
  }

  const eventTime = new Date(task.dueAt).getTime();
  const formattedTime = formatEventTime(task.dueAt);

  await Promise.all(
    REMINDER_STEPS.map(async reminder => {
      const reminderTimestamp = eventTime - reminder.minutesBefore * 60 * 1000;

      if (reminderTimestamp <= Date.now()) {
        return;
      }

      const trigger: TimestampTrigger = {
        type: TriggerType.TIMESTAMP,
        timestamp: reminderTimestamp,
      };

      const body =
        reminder.minutesBefore === 0
          ? `${reminder.bodyPrefix}. Your meeting time is ${formattedTime}.`
          : `${reminder.bodyPrefix}. Your meeting is at ${formattedTime}.`;

      await notifee.createTriggerNotification(
        {
          id: `${task.id}-${reminder.suffix}`,
          title: `Reminder: ${task.title}`,
          body,
          android: {
            channelId: CHANNEL_ID,
            pressAction: {
              id: 'default',
            },
          },
        },
        trigger,
      );
    }),
  );
};

/*
React Native CLI native setup notes for @notifee/react-native:

1. Install packages:
   npm install @notifee/react-native

2. iOS:
   cd ios && pod install && cd ..
   Autolinking handles the native module in modern React Native CLI projects.

3. Android:
   Autolinking also handles Android, but make sure the project compiles with the
   Android Gradle setup expected by your installed Notifee version.

4. If notifications do not appear on Android 13+, verify runtime notification
   permission handling and test on a real device/emulator with notifications enabled.
*/
