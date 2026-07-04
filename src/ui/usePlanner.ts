import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CalendarEvent, PlannerState, Task, TimerMode, TimerSession } from '../shared/types';
import { buildEventReminders, buildTaskReminders, getDueReminders, getMissedReminders } from '../shared/reminders';
import { advanceOverdueRecurringTasks, toggleTaskCompletion } from '../shared/tasks';
import { toggleEventCompletion } from '../shared/events';
import { createId } from '../shared/id';
import { createPlatformPorts } from '../platform';
import type { PlatformPorts } from '../platform/ports';
import { createDefaultState } from '../platform/defaultState';
import { getCalendarViewEvents, getTodayItems, getUpcomingItems } from '../shared/selectors';
import { normalizeSettings } from '../shared/settings';
import {
  getCurrentUser,
  loadRemotePlannerState,
  saveRemotePlannerState,
  signInWithEmailPassword,
  signOut as supabaseSignOut,
  signUpWithEmailPassword,
  type SyncStatus
} from '../platform/supabaseSync';

export type View = 'dashboard' | 'calendar' | 'tasks' | 'timer' | 'settings';

function hasPlannerContent(state: PlannerState): boolean {
  return state.events.length > 0 || state.tasks.length > 0 || state.timerSessions.length > 0 || state.reminders.length > 0;
}

function rebuildReminders(state: PlannerState): PlannerState {
  const tasks = advanceOverdueRecurringTasks(state.tasks);
  return {
    ...state,
    tasks,
    reminders: [...state.events.flatMap(buildEventReminders), ...tasks.flatMap(buildTaskReminders)]
  };
}

export function usePlanner() {
  const [ports, setPorts] = useState<PlatformPorts>();
  const [state, setState] = useState<PlannerState>(createDefaultState());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [view, setView] = useState<View>('dashboard');
  const [loaded, setLoaded] = useState(false);
  const [syncUser, setSyncUser] = useState<{ id: string; email?: string }>();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('signed-out');
  const [syncError, setSyncError] = useState<string>();
  const [notificationStatus, setNotificationStatus] = useState<string>();
  const [lastSyncedAt, setLastSyncedAt] = useState<string>();
  const [pendingRemoteState, setPendingRemoteState] = useState<{ state: PlannerState; updatedAt: string }>();
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
      const user = await getCurrentUser();
      if (user) {
        setSyncUser({ id: user.id, email: user.email });
        setSyncStatus('idle');
      }

      if (nextState.settings.notificationsEnabled) {
        const granted = await createdPorts.notifications.requestPermission();
        if (!granted) {
          setNotificationStatus('Notification permission was denied.');
        }
        const missed = getMissedReminders(nextState.reminders);
        if (granted && missed.length > 0) {
          await createdPorts.notifications.send('Missed reminders', `${missed.length} reminder(s) need your attention.`).catch((error) => {
            setNotificationStatus(error instanceof Error ? error.message : 'Could not send missed reminder notification.');
          });
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
      getDueReminders(nextState.reminders).forEach((reminder) => {
        ports.notifications.send('Reminder', reminder.title).catch((error) => {
          setNotificationStatus(error instanceof Error ? error.message : 'Could not send reminder notification.');
        });
      });
    }
  }, [state, ports, loaded]);

  useEffect(() => {
    if (!loaded || !syncUser) return undefined;
    const timeout = window.setTimeout(() => {
      setSyncStatus('syncing');
      saveRemotePlannerState(syncUser.id, state)
        .then(() => {
          setLastSyncedAt(new Date().toISOString());
          setSyncStatus('idle');
          setSyncError(undefined);
        })
        .catch((error) => {
          setSyncError(error instanceof Error ? error.message : 'Could not sync planner.');
          setSyncStatus('error');
        });
    }, 1200);
    return () => window.clearTimeout(timeout);
  }, [loaded, state, syncUser]);

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

  const toggleTask = useCallback((task: Task, occurrenceAt?: string) => {
    commitState((current) => ({
      ...current,
      tasks: current.tasks.map((candidate) => (candidate.id === task.id ? toggleTaskCompletion(candidate, occurrenceAt) : candidate))
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
    commitState((current) => ({
      ...current,
      settings: {
        ...current.settings,
        lastTimerDurationSeconds: durationSeconds
      }
    }));
    setActiveTimer({
      mode,
      startedAt: Date.now(),
      durationSeconds
    });
  }, [commitState]);

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
      ports.notifications.send(activeTimer.mode === 'focus' ? 'Focus Complete' : 'Break Complete', 'Your timer has finished.').catch((error) => {
        setNotificationStatus(error instanceof Error ? error.message : 'Could not send timer notification.');
      });
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
        const granted = await ports.notifications.requestPermission();
        setNotificationStatus(granted ? 'Notifications are enabled.' : 'Notification permission was denied.');
      }
    }
    commitState((current) => ({ ...current, settings }));
  }, [commitState, ports]);

  const testNotification = useCallback(async () => {
    if (!ports) {
      setNotificationStatus('Notification system is not ready yet.');
      return;
    }
    try {
      await ports.notifications.send('Productivity Codex', 'Notifications are working.');
      setNotificationStatus('Test notification sent.');
    } catch (error) {
      setNotificationStatus(error instanceof Error ? error.message : 'Could not send test notification.');
    }
  }, [ports]);

  const resetPlanner = useCallback(() => {
    setActiveTimer(undefined);
    setCompletedTimer(undefined);
    commitState(() => createDefaultState());
  }, [commitState]);

  const importPlannerState = useCallback((nextState: PlannerState) => {
    setActiveTimer(undefined);
    setCompletedTimer(undefined);
    commitState(() => nextState);
  }, [commitState]);

  const syncNow = useCallback(async () => {
    if (!syncUser) return;
    setSyncStatus('syncing');
    try {
      await saveRemotePlannerState(syncUser.id, state);
      setLastSyncedAt(new Date().toISOString());
      setSyncError(undefined);
      setSyncStatus('idle');
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Could not sync planner.');
      setSyncStatus('error');
    }
  }, [state, syncUser]);

  const signIn = useCallback(async (email: string, password: string) => {
    setSyncStatus('syncing');
    try {
      const user = await signInWithEmailPassword(email, password);
      const remote = await loadRemotePlannerState(user.id);
      setSyncUser({ id: user.id, email: user.email });
      if (remote) {
        if (hasPlannerContent(state) && hasPlannerContent(remote.state)) {
          setPendingRemoteState(remote);
          setLastSyncedAt(remote.updatedAt);
        } else {
          commitState(() => remote.state);
          setLastSyncedAt(remote.updatedAt);
        }
      } else {
        await saveRemotePlannerState(user.id, state);
        setLastSyncedAt(new Date().toISOString());
      }
      setSyncError(undefined);
      setSyncStatus('idle');
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Could not sign in.');
      setSyncStatus('error');
    }
  }, [commitState, state]);

  const useRemoteState = useCallback(() => {
    if (!pendingRemoteState) return;
    commitState(() => pendingRemoteState.state);
    setLastSyncedAt(pendingRemoteState.updatedAt);
    setPendingRemoteState(undefined);
  }, [commitState, pendingRemoteState]);

  const keepLocalState = useCallback(async () => {
    if (!syncUser) return;
    await saveRemotePlannerState(syncUser.id, state);
    setLastSyncedAt(new Date().toISOString());
    setPendingRemoteState(undefined);
  }, [state, syncUser]);

  const signUp = useCallback(async (email: string, password: string) => {
    setSyncStatus('syncing');
    try {
      const user = await signUpWithEmailPassword(email, password);
      if (user) {
        setSyncUser({ id: user.id, email: user.email });
        await saveRemotePlannerState(user.id, state);
        setLastSyncedAt(new Date().toISOString());
      }
      setSyncError(undefined);
      setSyncStatus('idle');
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Could not create account.');
      setSyncStatus('error');
    }
  }, [state]);

  const signOut = useCallback(async () => {
    await supabaseSignOut();
    setSyncUser(undefined);
    setSyncStatus('signed-out');
    setLastSyncedAt(undefined);
  }, []);

  const calendarEvents = useMemo(() => getCalendarViewEvents(state), [state]);
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
    syncUser,
    syncStatus,
    syncError,
    notificationStatus,
    platform: ports?.platform ?? {
      isAndroid: false,
      isDesktop: true,
      supportsAutostart: true,
      supportsNotifications: true
    },
    lastSyncedAt,
    pendingRemoteState,
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
    testNotification,
    resetPlanner,
    importPlannerState,
    signIn,
    signUp,
    signOut,
    syncNow,
    useRemoteState,
    keepLocalState
  };
}
