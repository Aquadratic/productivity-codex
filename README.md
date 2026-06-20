# Productivity Codex

A Windows-first productivity app for calendar planning, recurring tasks, reminders, and focus or break timers.

## Stack

- Tauri v2 desktop shell
- React + TypeScript UI
- SQLite-backed local persistence through a storage adapter
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
- Customizable calendar visible hours

## Mobile Portability

The app keeps business logic in `src/shared` and platform behavior in `src/platform`.
Future Android/iOS shells should reuse recurrence, reminders, tasks, timers, and persistence contracts while replacing platform adapters as needed.

Likely future paths:

- Tauri mobile, reusing most of the React UI
- React Native, reusing shared TypeScript domain modules and replacing the UI shell

## Development

```bash
npm install
npm run dev
```

For the desktop shell:

```bash
npm run tauri dev
```

Run tests:

```bash
npm test
```
