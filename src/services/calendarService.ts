import RNCalendarEvents from 'react-native-calendar-events';
import {TaskItem} from '../types/task';

export const requestCalendarAccess = async () => {
  const status = await RNCalendarEvents.checkPermissions();

  if (status === 'authorized') {
    return true;
  }

  const nextStatus = await RNCalendarEvents.requestPermissions();
  return nextStatus === 'authorized';
};

export const saveTaskToCalendar = async (task: TaskItem) => {
  if (!task.isImportant || !task.dueAt) {
    return null;
  }

  const hasAccess = await requestCalendarAccess();

  if (!hasAccess) {
    return null;
  }

  const startDate = task.dueAt;
  const endDate = new Date(
    new Date(task.dueAt).getTime() + 60 * 60 * 1000,
  ).toISOString();

  return RNCalendarEvents.saveEvent(task.title, {
    startDate,
    endDate,
    notes: `Created by Intelligent Task Manager\nCategory: ${task.category}\nRaw Input: ${task.rawText}`,
  });
};

/*
React Native CLI native setup notes for react-native-calendar-events:

1. Install packages:
   npm install react-native-calendar-events

2. iOS:
   cd ios && pod install && cd ..
   Add calendar usage descriptions in ios/<YourApp>/Info.plist:
   - NSCalendarsUsageDescription

3. Android:
   Add calendar permissions in android/app/src/main/AndroidManifest.xml:
   - android.permission.READ_CALENDAR
   - android.permission.WRITE_CALENDAR

4. Modern React Native CLI uses autolinking, so manual linking is typically not required.
*/
