# Productivity Codex

A Windows-first productivity app for calendar planning, recurring tasks, reminders, and focus or break timers.

## Stack

- Tauri v2 desktop shell
- React + TypeScript UI
- SQLite-backed local persistence through a storage adapter
- Optional Supabase email/password account sync
- Native notifications and autostart through platform adapters
- Shared planner logic kept free of desktop-only dependencies

## Current V1 Features

- Dashboard for today's schedule, tasks, and upcoming items
- FullCalendar-powered calendar with month, week, day, and agenda views
- Click a date or time slot to prefill a new event
- Events with importance markers, notes, reminders, and recurrence rules
- Tasks with due dates, priorities, reminders, recurrence rules, and optional calendar-event visibility
- Live focus and break timer sessions with countdown, progress, and completion state
- Windows notifications, tray behavior, and autostart settings
- Settings test action for notification permission and delivery checks

## Windows And Android

The app keeps business logic in `src/shared` and platform behavior in `src/platform`.
Android uses Tauri mobile as a platform shell, so normal React and shared TypeScript updates affect Windows and Android together.

Desktop-only behavior such as tray, Windows autostart, and close-to-tray stays gated in `src-tauri` and `src/platform`.
Shared behavior such as Calendar, Tasks, Timer, Supabase sync, import/export, sounds, local storage contracts, and notifications stays in the existing app.

Release Windows builds use the Windows GUI subsystem, so they do not open a command prompt. Debug builds remain console-friendly.

## Development

```bash
npm install
npm run dev
```

For the desktop shell:

```bash
npm run tauri dev
```

For Android, install the Tauri Android prerequisites first, including Android Studio or the Android SDK command-line tools, and set `ANDROID_HOME` if the SDK is not in the default location. Then run:

```bash
npm run tauri:android:init
npm run tauri:android:dev
npm run tauri:android:build
```

The generated Android project is only a build shell. Do not duplicate planner logic there; keep product changes in React and shared TypeScript.

Run tests:

```bash
npm test
```

## Supabase Sync

The app can sync a signed-in user's local planner state to Supabase using the `planner_states` table.

Apply the SQL migration in `supabase/migrations/202607020001_create_planner_states.sql` in the Supabase SQL editor, or with the Supabase CLI.

The current project defaults are configured in the app, and can be overridden with:

```bash
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-publishable-key
```
