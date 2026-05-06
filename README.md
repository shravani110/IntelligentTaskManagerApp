# Intelligent Task Manager

A React Native mobile application that uses AI-powered natural language processing to parse task input, schedule reminders, and sync with your device calendar.

## Features

- **AI Task Parsing**: Type tasks in natural language (e.g., "Meeting with design team tomorrow at 2 PM") and the app automatically extracts title, category, date, and time
- **Smart Categorization**: Automatically categorizes tasks into Work, Personal, Health, or Other based on content
- **Calendar Integration**: Important tasks are automatically saved to your device calendar
- **Smart Notifications**: Receive reminders at 1 hour, 30 minutes, 5 minutes, and at task start time
- **Daily & Weekly Views**: Switch between day-based and week-based task views
- **Persistent Storage**: Tasks are saved locally using AsyncStorage
- **Visual Calendar**: Interactive calendar with task indicators and date selection

## Tech Stack

- **Framework**: React Native 0.85.0 with React 19.2.3
- **Language**: TypeScript 5.8.3
- **Storage**: @react-native-async-storage/async-storage
- **Notifications**: @notifee/react-native
- **Calendar**: react-native-calendar-events
- **HTTP Client**: axios

## Project Structure

```
src/
├── screens/
│   └── TaskManagerScreen.tsx    # Main UI with calendar, task list, and input
├── services/
│   ├── calendarService.ts       # Calendar permission and event management
│   └── notificationService.ts   # Notification channel and reminder scheduling
├── types/
│   └── task.ts                  # TypeScript interfaces for tasks
└── utils/
    └── aiTaskParser.ts          # Natural language parsing (API + fallback)
```

## Getting Started

### Prerequisites

- Node.js >= 22.11.0
- React Native development environment (Android Studio / Xcode)
- CocoaPods (for iOS)

### Installation

1. Install dependencies:
```sh
npm install
```

2. iOS setup (macOS only):
```sh
cd ios && pod install && cd ..
```

### Running the App

Start Metro bundler:
```sh
npm start
```

Run on Android:
```sh
npm run android
```

Run on iOS:
```sh
npm run ios
```

## Usage

1. **Add a Task**: Type natural language in the input field (e.g., "Doctor appointment next Tuesday at 10 AM")
2. **View Tasks**: Toggle between Daily and Weekly views
3. **Complete Tasks**: Tap the checkbox to mark tasks as done
4. **Navigate Calendar**: Use arrows to change months, tap dates to select

## AI Task Parser

The app uses a hybrid parsing approach:
- **Primary**: Attempts to call an external AI API endpoint
- **Fallback**: Local rule-based parser that detects:
  - Time expressions ("2 PM", "14:30")
  - Dates ("today", "tomorrow", "next Monday", "May 15")
  - Categories (meeting → Work, doctor → Health, etc.)

## Required Permissions

### Android
- `android.permission.READ_CALENDAR`
- `android.permission.WRITE_CALENDAR`
- `android.permission.POST_NOTIFICATIONS` (Android 13+)

### iOS
- `NSCalendarsUsageDescription`
- Notification permissions via Notifee

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start Metro bundler |
| `npm run android` | Build and run Android app |
| `npm run ios` | Build and run iOS app |
| `npm test` | Run Jest tests |
| `npm run lint` | Run ESLint |

## License

MIT
