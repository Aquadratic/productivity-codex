import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CalendarEvent, PlannerState, Task, TimerMode, TimerSession } from '../shared/types';
import { buildEventReminders, buildTaskReminders, getDueReminders, getMissedReminders } from '../shared/reminders';
import { toggleTaskCompletion } from '../shared/tasks';
import { toggleEventCompletion } from '../shared/events';
import { createId } from '../shared/id';
import { createPlatformPorts } from '../platform';
import type { PlatformPorts } from '../platform/ports';
import { createDefaultState } from '../platform/defaultState';
import { getCalendarViewEvents, getTodayItems, getUpcomingItems } from '../shared/selectors';
import { normalizeSettings } from '../shared/settings';

export type View = 'dashboard' | 'calendar' | 'tasks' | 'timer' | 'settings';

function rebuildReminders(state: PlannerState): PlannerState {
  return {
    ...state,
    reminders: [...state.events.flatMap(buildEventReminders), ...state.tasks.flatMap(buildTaskReminders)]
  };
}

export function usePlanner() {
  const [ports, setPorts] = useState<PlatformPorts>();
  const [state, setState] = useState<PlannerState>(createDefaultState());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [view, setView] = useState<View>('dashboard');
  const [loaded, setLoaded] = useState(false);
  const [activeTimer, setActiveTimer] = useState<{
    mode: TimerMode;
    startedAt: number;
    durationSeconds: number;
    pausedRemaining?: number;
  }>();
  const [completedTimer, setCompletedTimer] = useState<TimerSession>();

  useEffect(() => {
    createPlatformPorts().then(async (createdPorts) => {
      setPorts(createdPorts);
      const loadedState = rebuildReminders(await createdPorts.storage.load());
      const autostartEnabled = await createdPorts.autostart.isEnabled();
      const nextState = {
        ...loadedState,
        settings: normalizeSettings({
          ...loadedState.settings,
          autostartEnabled
        })
      };
      setState(nextState);
      setLoaded(true);

      if (nextState.settings.notificationsEnabled) {
        await createdPorts.notifications.requestPermission();
        const missed = getMissedReminders(nextState.reminders);
        if (missed.length > 0) {
          await createdPorts.notifications.send('Missed reminders', `${missed.length} reminder(s) need your attention.`);
        }
        await createdPorts.reminders.schedule(nextState.reminders);
      }
    });
  }, []);

  useEffect(() => {
    if (!ports || !loaded) {
      return;
    }

    const nextState = rebuildReminders(state);
    ports.storage.save(nextState);
    if (nextState.settings.notificationsEnabled) {
      ports.reminders.schedule(nextState.reminders);
      getDueReminders(nextState.reminders).forEach((reminder) => ports.notifications.send('Reminder', reminder.title));
    }
  }, [state, ports, loaded]);

  const commitState = useCallback((updater: (current: PlannerState) => PlannerState) => {
    setState((current) => rebuildReminders(updater(current)));
  }, []);

  const addEvent = useCallback((event: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    commitState((current) => ({
      ...current,
      events: [...current.events, { ...event, id: createId('event'), createdAt: now, updatedAt: now }]
    }));
  }, [commitState]);

  const addTask = useCallback((task: Omit<Task, 'id' | 'status' | 'completedOccurrences' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    commitState((current) => ({
      ...current,
      tasks: [
        ...current.tasks,
        { ...task, id: createId('task'), status: 'open', completedOccurrences: [], createdAt: now, updatedAt: now }
      ]
    }));
  }, [commitState]);

  const updateEvent = useCallback((eventId: string, patch: Partial<Omit<CalendarEvent, 'id' | 'createdAt'>>) => {
    commitState((current) => ({
      ...current,
      events: current.events.map((event) => (
        event.id === eventId ? { ...event, ...patch, updatedAt: new Date().toISOString() } : event
      ))
    }));
  }, [commitState]);

  const updateTask = useCallback((taskId: string, patch: Partial<Omit<Task, 'id' | 'createdAt'>>) => {
    commitState((current) => ({
      ...current,
      tasks: current.tasks.map((task) => (
        task.id === taskId ? { ...task, ...patch, updatedAt: new Date().toISOString() } : task
      ))
    }));
  }, [commitState]);

  const toggleTask = useCallback((task: Task) => {
    commitState((current) => ({
      ...current,
      tasks: current.tasks.map((candidate) => (candidate.id === task.id ? toggleTaskCompletion(candidate) : candidate))
    }));
  }, [commitState]);

  const toggleEvent = useCallback((event: CalendarEvent, occurrenceAt?: string) => {
    commitState((current) => ({
      ...current,
      events: current.events.map((candidate) => (candidate.id === event.id ? toggleEventCompletion(candidate, occurrenceAt) : candidate))
    }));
  }, [commitState]);

  const deleteTask = useCallback((taskId: string) => {
    commitState((current) => ({
      ...current,
      tasks: current.tasks.filter((task) => task.id !== taskId)
    }));
  }, [commitState]);

  const deleteEvent = useCallback((eventId: string) => {
    commitState((current) => ({
      ...current,
      events: current.events.filter((event) => event.id !== eventId)
    }));
  }, [commitState]);

  const startTimer = useCallback((mode: TimerMode, durationSeconds: number) => {
    setCompletedTimer(undefined);
    setActiveTimer({
      mode,
      startedAt: Date.now(),
      durationSeconds
    });
  }, []);

  const stopTimer = useCallback((completed: boolean) => {
    if (!activeTimer) {
      return;
    }

    const session: TimerSession = {
      id: createId('timer'),
      mode: activeTimer.mode,
      durationSeconds: activeTimer.durationSeconds,
      startedAt: new Date(activeTimer.startedAt).toISOString(),
      endedAt: new Date().toISOString(),
      completed
    };
    commitState((current) => ({ ...current, timerSessions: [session, ...current.timerSessions] }));
    if (completed && ports) {
      ports.notifications.send(activeTimer.mode === 'focus' ? 'Focus complete' : 'Break complete', 'Your timer has finished.');
    }
    if (completed) {
      setCompletedTimer(session);
    }
    setActiveTimer(undefined);
  }, [activeTimer, commitState, ports]);

  const dismissCompletedTimer = useCallback(() => setCompletedTimer(undefined), []);

  const updateSettings = useCallback(async (settings: PlannerState['settings']) => {
    if (ports) {
      await ports.autostart.setEnabled(settings.autostartEnabled);
      if (settings.notificationsEnabled) {
        await ports.notifications.requestPermission();
      }
    }
    commitState((current) => ({ ...current, settings }));
  }, [commitState, ports]);

  const resetPlanner = useCallback(() => {
    setActiveTimer(undefined);
    setCompletedTimer(undefined);
    commitState(() => createDefaultState());
  }, [commitState]);

  const calendarEvents = useMemo(() => getCalendarViewEvents(state.events), [state.events]);
  const upcoming = useMemo(() => getUpcomingItems(state), [state]);
  const todayItems = useMemo(() => getTodayItems(state), [state]);

  return {
    state,
    loaded,
    selectedDate,
    setSelectedDate,
    view,
    setView,
    calendarEvents,
    upcoming,
    todayItems,
    activeTimer,
    completedTimer,
    addEvent,
    addTask,
    updateEvent,
    updateTask,
    toggleTask,
    toggleEvent,
    deleteTask,
    deleteEvent,
    startTimer,
    stopTimer,
    dismissCompletedTimer,
    updateSettings,
    resetPlanner
  };
}
