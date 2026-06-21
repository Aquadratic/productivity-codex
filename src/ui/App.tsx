import '@fullcalendar/core/index.js';
import type { EventClickArg } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin, { DateClickArg } from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import { addDays, addMilliseconds, addMinutes, differenceInMilliseconds, format, isSameDay, parseISO, subDays } from 'date-fns';
import {
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  Clock3,
  LayoutDashboard,
  ListTodo,
  Play,
  RotateCcw,
  Settings,
  Sparkles,
  Square,
  Star,
  Trash2,
  Volume2,
  X
} from 'lucide-react';
import { FormEvent, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { CalendarEvent, Importance, RepeatFrequency, Task, TimerMode, UpcomingRange } from '../shared/types';
import { createCustomRecurrenceRule, parseRecurrenceRule, type RecurrenceDraft } from '../shared/recurrence';
import { validateEventTime } from '../shared/events';
import { getSoundChoice, soundChoices } from '../shared/sounds';
import { durationPartsToSeconds, formatTimer, getTimerSnapshot, isValidTimerDuration, secondsToDurationParts } from '../shared/timer';
import { getCalendarViewEvents, getTaskListGroups, getUpcomingItems, type PlannerFilter, type PlannerListItem } from '../shared/selectors';
import { usePlanner, type View } from './usePlanner';

const navItems: Array<{ view: View; label: string; icon: typeof LayoutDashboard }> = [
  { view: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { view: 'calendar', label: 'Calendar', icon: CalendarDays },
  { view: 'tasks', label: 'Tasks', icon: ListTodo },
  { view: 'timer', label: 'Timer', icon: Clock3 },
  { view: 'settings', label: 'Settings', icon: Settings }
];

const weekdayOptions = [
  { value: 'MO', label: 'Mon' },
  { value: 'TU', label: 'Tue' },
  { value: 'WE', label: 'Wed' },
  { value: 'TH', label: 'Thu' },
  { value: 'FR', label: 'Fri' },
  { value: 'SA', label: 'Sat' },
  { value: 'SU', label: 'Sun' }
] as const;

type EventDraft = {
  title: string;
  notes: string;
  startDate: string;
  start: string;
  endDate: string;
  end: string;
  allDay: boolean;
  importance: Importance;
  color: string;
  recurrence: RecurrenceDraft;
};

type TaskDraft = {
  title: string;
  notes: string;
  hasStartTime: boolean;
  startDate: string;
  startHour: string;
  startMinute: string;
  startMeridiem: 'AM' | 'PM';
  endDate: string;
  endHour: string;
  endMinute: string;
  endMeridiem: 'AM' | 'PM';
  allDay: boolean;
  priority: Task['priority'];
  recurrence: RecurrenceDraft;
};

type DrawerMode = 'choice' | 'eventDetails' | 'taskDetails' | 'eventForm' | 'taskForm';
type PendingSelection = { start: Date; end: Date; allDay?: boolean };
type UndoState = {
  kind: 'event' | 'task';
  id: string;
  previous: { startsAt?: string; endsAt: string; dueAt?: string; allDay: boolean };
};

const eventColors = ['#5578a6', '#23693c', '#8f4d32', '#7b4fa3', '#b2671d', '#2f7f7b'];

const monthOptions = [
  { value: '1', label: 'Jan' },
  { value: '2', label: 'Feb' },
  { value: '3', label: 'Mar' },
  { value: '4', label: 'Apr' },
  { value: '5', label: 'May' },
  { value: '6', label: 'Jun' },
  { value: '7', label: 'Jul' },
  { value: '8', label: 'Aug' },
  { value: '9', label: 'Sep' },
  { value: '10', label: 'Oct' },
  { value: '11', label: 'Nov' },
  { value: '12', label: 'Dec' }
] as const;

export function App() {
  const planner = usePlanner();

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark"><Sparkles size={20} /></div>
          <div>
            <p className="eyebrow">Productivity Codex</p>
            <h1>Today, organized.</h1>
          </div>
        </div>
        <nav aria-label="Main navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                className={planner.view === item.view ? 'nav-button active' : 'nav-button'}
                key={item.view}
                onClick={() => planner.setView(item.view)}
                type="button"
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <section className="workspace">
        {!planner.loaded ? (
          <div className="panel loading-panel">Loading planner...</div>
        ) : (
          <>
            {planner.view === 'dashboard' && <Dashboard planner={planner} />}
            {planner.view === 'calendar' && <CalendarView planner={planner} />}
            {planner.view === 'tasks' && <TasksView planner={planner} />}
            {planner.view === 'timer' && <TimerView planner={planner} />}
            {planner.view === 'settings' && <SettingsView planner={planner} />}
          </>
        )}
      </section>
    </main>
  );
}

function Dashboard({ planner }: { planner: ReturnType<typeof usePlanner> }) {
  const todaysEvents = planner.todayItems.filter((item) => item.kind === 'event');
  const todaysTasks = planner.todayItems.filter((item) => item.kind === 'task');
  const [range, setRange] = useState<UpcomingRange>(planner.state.settings.upcomingRange);
  const [now, setNow] = useState(new Date());
  const upcoming = useMemo(() => getUpcomingItems(planner.state, new Date(), range), [planner.state, range]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="view-stack dashboard-view">
      <header className="view-header">
        <div>
          <p className="eyebrow">{format(new Date(), 'EEEE, MMM d')}</p>
          <h2>Dashboard</h2>
        </div>
        <button className="primary-action" onClick={() => planner.setView('timer')} type="button">
          <Play size={18} />
          Start Focus
        </button>
      </header>
      <div className="dashboard-grid">
        <MetricCard label="Events Today" value={todaysEvents.length} />
        <MetricCard label="Tasks Today" value={todaysTasks.length} />
        <MetricCard label="Upcoming" value={upcoming.length} />
        <MetricCard label="Current Time" value={format(now, 'h:mm:ss a')} />
        <ListPanel title="Today" detail="Schedule And Task List" empty="Nothing due today." roomy>
          {planner.todayItems.map((item) => (
            <PlannerItemRow item={item} key={`${item.kind}-${item.id}`} planner={planner} />
          ))}
        </ListPanel>
        <ListPanel
          title="Upcoming"
          detail="Future tasks and events"
          empty="No upcoming events or tasks."
          action={
            <select
              aria-label="Upcoming Range"
              className="compact-select"
              value={range}
              onChange={(event) => setRange(event.target.value as UpcomingRange)}
            >
              <option value="all">All Upcoming</option>
              <option value="today">Today</option>
              <option value="7days">7 Days</option>
              <option value="30days">30 Days</option>
            </select>
          }
        >
          {upcoming.map((item) => (
            <PlannerItemRow item={item} key={`${item.kind}-${item.id}`} planner={planner} />
          ))}
        </ListPanel>
      </div>
    </div>
  );
}

function CalendarView({ planner }: { planner: ReturnType<typeof usePlanner> }) {
  const [draft, setDraft] = useState<EventDraft>(() => toDraft(new Date()));
  const [taskDraft, setTaskDraft] = useState<TaskDraft>(() => toTaskDraft(new Date()));
  const [drawerMode, setDrawerMode] = useState<DrawerMode>();
  const [editingEventId, setEditingEventId] = useState<string>();
  const [selectedTaskId, setSelectedTaskId] = useState<string>();
  const [pendingSelection, setPendingSelection] = useState<PendingSelection>(() => ({ start: new Date(), end: addMinutes(new Date(), 60) }));
  const [calendarRange, setCalendarRange] = useState(() => ({ start: subDays(new Date(), 30), end: addDays(new Date(), 60) }));
  const [undo, setUndo] = useState<UndoState>();
  const settings = planner.state.settings;

  const openChoice = (start: Date, end?: Date, allDay = false) => {
    const selection = { start, end: end ?? addMinutes(start, 60), allDay };
    setPendingSelection(selection);
    setDraft(toDraft(selection.start, selection.end));
    setTaskDraft(toTaskDraft(selection.start, selection.end));
    setEditingEventId(undefined);
    setSelectedTaskId(undefined);
    setDrawerMode('choice');
  };

  const openExisting = (id: string) => {
    const event = planner.state.events.find((candidate) => candidate.id === id);
    if (!event) return;
    setDraft(toDraft(parseISO(event.startsAt), parseISO(event.endsAt), event));
    setEditingEventId(id);
    setSelectedTaskId(undefined);
    setDrawerMode('eventDetails');
  };

  const openTaskDetails = (id: string) => {
    const task = planner.state.tasks.find((candidate) => candidate.id === id);
    if (!task) return;
    setTaskDraft(toTaskDraftFromTask(task));
    setSelectedTaskId(id);
    setEditingEventId(undefined);
    setDrawerMode('taskDetails');
  };

  const handleDateClick = (arg: DateClickArg) => {
    if (arg.view.type === 'dayGridMonth') {
      const now = new Date();
      const start = new Date(arg.date);
      start.setHours(now.getHours(), now.getMinutes(), 0, 0);
      openChoice(start, addMinutes(start, 60));
      return;
    }

    const minute = arg.date.getMinutes();
    openChoice(minute === 0 ? addMinutes(arg.date, -30) : arg.date, minute === 0 ? addMinutes(arg.date, 30) : addMinutes(arg.date, 60));
  };

  const handleEventClick = (arg: EventClickArg) => {
    const props = arg.event.extendedProps as { kind?: 'event' | 'task'; sourceId?: string };
    if (props.kind === 'task' && props.sourceId) {
      openTaskDetails(props.sourceId);
    } else if (props.sourceId) {
      openExisting(props.sourceId);
    }
  };

  const calendarItems = useMemo(
    () => getCalendarViewEvents(planner.state, calendarRange.start, calendarRange.end),
    [calendarRange.end, calendarRange.start, planner.state]
  );

  const previewEvents = useMemo(() => {
    if (drawerMode !== 'eventForm') return calendarItems;
    if (editingEventId) {
      const original = planner.state.events.find((event) => event.id === editingEventId);
      if (
        original &&
        original.startsAt === new Date(`${draft.startDate}T${draft.start}`).toISOString() &&
        original.endsAt === new Date(`${draft.endDate}T${draft.end}`).toISOString() &&
        original.allDay === draft.allDay
      ) {
        return calendarItems;
      }
    }
    const previewStart = new Date(`${draft.startDate}T${draft.start}`);
    const previewEnd = new Date(`${draft.endDate}T${draft.end}`);
    if (Number.isNaN(previewStart.getTime()) || Number.isNaN(previewEnd.getTime())) {
      return calendarItems;
    }
    return [
      ...calendarItems,
      {
        id: 'draft-preview',
        title: draft.title || 'New Event',
        start: previewStart.toISOString(),
        end: previewEnd.toISOString(),
        allDay: draft.allDay,
        classNames: ['draft-preview-event'],
        backgroundColor: draft.color,
        borderColor: draft.color,
        extendedProps: { importance: draft.importance, notes: draft.notes, kind: 'event' as const, sourceId: 'draft-preview' }
      }
    ];
  }, [calendarItems, draft, drawerMode, editingEventId, planner.state.events]);

  const updateDroppedItem = (arg: any) => {
    const props = arg.event.extendedProps as { kind?: 'event' | 'task'; sourceId?: string };
    const sourceId = props.sourceId;
    if (!props.kind || !sourceId || !arg.event.start || !arg.event.end) return;

    if (props.kind === 'event') {
      const event = planner.state.events.find((candidate) => candidate.id === sourceId);
      if (!event) return;
      setUndo({ kind: 'event', id: sourceId, previous: { startsAt: event.startsAt, endsAt: event.endsAt, allDay: event.allDay } });
      planner.updateEvent(sourceId, {
        startsAt: arg.event.start.toISOString(),
        endsAt: arg.event.end.toISOString(),
        allDay: arg.event.allDay
      });
    } else {
      const task = planner.state.tasks.find((candidate) => candidate.id === sourceId);
      if (!task) return;
      setUndo({ kind: 'task', id: sourceId, previous: { startsAt: task.startsAt, endsAt: task.endsAt ?? arg.event.end.toISOString(), dueAt: task.dueAt, allDay: task.allDay } });
      planner.updateTask(sourceId, {
        startsAt: task.startsAt ? arg.event.start.toISOString() : undefined,
        endsAt: arg.event.end.toISOString(),
        dueAt: arg.event.end.toISOString(),
        allDay: arg.event.allDay
      });
    }
  };

  useEffect(() => {
    if (!undo) return undefined;
    const timeout = window.setTimeout(() => setUndo(undefined), 8000);
    return () => window.clearTimeout(timeout);
  }, [undo]);

  const restoreUndo = () => {
    if (!undo) return;
    if (undo.kind === 'event') {
      planner.updateEvent(undo.id, undo.previous);
    } else {
      planner.updateTask(undo.id, undo.previous);
    }
    setUndo(undefined);
  };

  return (
    <div className="view-stack full-height-view">
      <header className="view-header">
        <div>
          <p className="eyebrow">Calendar</p>
          <h2>Plan By Time</h2>
        </div>
        <div className="header-actions">
          <label className="mini-toggle">
            <input checked={settings.showEventsInCalendar} type="checkbox" onChange={(event) => planner.updateSettings({ ...settings, showEventsInCalendar: event.target.checked })} />
            <span>Show Events</span>
          </label>
          <label className="mini-toggle">
            <input checked={settings.showTasksInCalendar} type="checkbox" onChange={(event) => planner.updateSettings({ ...settings, showTasksInCalendar: event.target.checked })} />
            <span>Show Tasks</span>
          </label>
          <button className="primary-action" onClick={() => { setEditingEventId(undefined); setDrawerMode('eventForm'); }} type="button">
          <CalendarDays size={18} />
          New Event
          </button>
        </div>
      </header>
      <div className="calendar-layout single">
        <section className="panel calendar-panel" aria-label="Calendar">
          <FullCalendar
            allDaySlot
            dateClick={handleDateClick}
            dayMaxEventRows={3}
            dayMaxEvents={3}
            editable
            eventDurationEditable
            eventStartEditable
            eventDisplay="block"
            eventClick={handleEventClick}
            events={previewEvents}
            expandRows
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek'
            }}
            height="100%"
            initialView="timeGridWeek"
            moreLinkClick="popover"
            nowIndicator
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
            selectable
            select={(selection) => {
              if (selection.allDay) {
                const endDate = subDays(selection.end, 1);
                const now = new Date();
                const start = new Date(selection.start);
                start.setHours(now.getHours(), now.getMinutes(), 0, 0);
                const end = new Date(endDate);
                end.setHours(now.getHours(), now.getMinutes(), 0, 0);
                openChoice(start, end);
              } else {
                openChoice(selection.start, selection.end);
              }
            }}
            datesSet={(arg) => setCalendarRange({ start: arg.start, end: arg.end })}
            eventDrop={updateDroppedItem}
            eventResize={updateDroppedItem}
            slotDuration="01:00:00"
            snapDuration="00:30:00"
            scrollTime="06:00:00"
            slotMinTime="00:00:00"
            slotMaxTime="24:00:00"
            views={{
              dayGridMonth: { titleFormat: { month: 'short', year: 'numeric' } },
              timeGridWeek: { titleFormat: { month: 'short', day: 'numeric', year: 'numeric' } },
              timeGridDay: { titleFormat: { month: 'short', day: 'numeric', year: 'numeric' } },
              listWeek: { titleFormat: { month: 'short', day: 'numeric', year: 'numeric' } }
            }}
            eventTimeFormat={{ hour: 'numeric', minute: '2-digit', meridiem: 'short' }}
          />
        </section>
        {drawerMode && (
          <div className="drawer-backdrop" role="presentation" onMouseDown={(event) => {
            if (event.target === event.currentTarget) setDrawerMode(undefined);
          }}>
            {drawerMode === 'choice' && (
              <ChoiceDrawer
                onClose={() => setDrawerMode(undefined)}
                onEvent={() => {
                  setDraft(toDraft(pendingSelection.start, pendingSelection.end));
                  setDrawerMode('eventForm');
                }}
                onTask={() => {
                  setTaskDraft(toTaskDraft(pendingSelection.start, pendingSelection.end));
                  setDrawerMode('taskForm');
                }}
              />
            )}
            {drawerMode === 'eventDetails' && editingEventId && (
              <DetailsDrawer
                item={planner.state.events.find((event) => event.id === editingEventId)}
                kind="event"
                onClose={() => setDrawerMode(undefined)}
                onEdit={() => setDrawerMode('eventForm')}
                onToggle={() => planner.toggleEvent(planner.state.events.find((event) => event.id === editingEventId)!)}
              />
            )}
            {drawerMode === 'taskDetails' && selectedTaskId && (
              <DetailsDrawer
                item={planner.state.tasks.find((task) => task.id === selectedTaskId)}
                kind="task"
                onClose={() => setDrawerMode(undefined)}
                onEdit={() => setDrawerMode('taskForm')}
                onToggle={() => planner.toggleTask(planner.state.tasks.find((task) => task.id === selectedTaskId)!)}
              />
            )}
            {drawerMode === 'eventForm' && (
              <EventForm
                draft={draft}
                editingEventId={editingEventId}
                planner={planner}
                onChange={setDraft}
                onClose={() => setDrawerMode(undefined)}
                onSaved={() => {
                  setDrawerMode(undefined);
                  setEditingEventId(undefined);
                  setDraft(toDraft(new Date()));
                }}
              />
            )}
            {drawerMode === 'taskForm' && (
              <TaskForm
                draft={taskDraft}
                editingTaskId={selectedTaskId}
                planner={planner}
                onChange={setTaskDraft}
                onClose={() => setDrawerMode(undefined)}
                onSaved={() => {
                  setDrawerMode(undefined);
                  setSelectedTaskId(undefined);
                  setTaskDraft(toTaskDraft(new Date()));
                }}
              />
            )}
          </div>
        )}
        {undo && (
          <div className="undo-toast" role="status">
            Time updated.
            <button className="secondary-action" onClick={restoreUndo} type="button">Undo</button>
          </div>
        )}
      </div>
    </div>
  );
}

function TasksView({ planner }: { planner: ReturnType<typeof usePlanner> }) {
  const [filter, setFilter] = useState<PlannerFilter>('all');
  const [drawerMode, setDrawerMode] = useState<DrawerMode>();
  const [selectedTaskId, setSelectedTaskId] = useState<string>();
  const [taskDraft, setTaskDraft] = useState<TaskDraft>(() => toTaskDraft(new Date()));
  const groups = useMemo(() => getTaskListGroups(planner.state, filter), [filter, planner.state]);
  const selectedTask = planner.state.tasks.find((task) => task.id === selectedTaskId);

  return (
    <div className="view-stack full-height-view">
      <header className="view-header">
        <div>
          <p className="eyebrow">Tasks</p>
          <h2>Work Queue</h2>
        </div>
        <div className="header-actions">
          <SegmentedControl options={['all', 'today', 'upcoming', 'overdue']} value={filter} onChange={(value) => setFilter(value as PlannerFilter)} />
          <button className="primary-action" onClick={() => { setSelectedTaskId(undefined); setTaskDraft(toTaskDraft(new Date())); setDrawerMode('taskForm'); }} type="button">
            <ListTodo size={18} />
            Add Task
          </button>
        </div>
      </header>
      <div className="task-layout single">
        <ListPanel
          title={planner.state.settings.showCalendarEventsInTasks ? 'Tasks And Calendar Events' : 'Tasks'}
          detail={planner.state.settings.showCalendarEventsInTasks ? 'Events can be checked off here without becoming tasks.' : 'Calendar events are hidden here.'}
          empty="Nothing in this list."
        >
          {groups.active.map((item) => (
            <PlannerItemRow item={item} key={`${item.kind}-${item.id}`} planner={planner} onOpen={() => {
              if (item.kind === 'task') {
                setSelectedTaskId((item.source as Task).id);
                setTaskDraft(toTaskDraftFromTask(item.source as Task));
                setDrawerMode('taskDetails');
              }
            }} />
          ))}
        </ListPanel>
        <ListPanel title="Completed" detail="Finished Items For This Tab" empty="Nothing completed here yet." initiallyCollapsed>
          {groups.completed.map((item) => (
            <PlannerItemRow item={item} key={`completed-${item.kind}-${item.id}`} planner={planner} onOpen={() => {
              if (item.kind === 'task') {
                setSelectedTaskId((item.source as Task).id);
                setTaskDraft(toTaskDraftFromTask(item.source as Task));
                setDrawerMode('taskDetails');
              }
            }} />
          ))}
        </ListPanel>
        {drawerMode && (
          <div className="drawer-backdrop" role="presentation" onMouseDown={(event) => {
            if (event.target === event.currentTarget) setDrawerMode(undefined);
          }}>
            {drawerMode === 'taskDetails' && selectedTask && (
              <DetailsDrawer
                item={selectedTask}
                kind="task"
                onClose={() => setDrawerMode(undefined)}
                onEdit={() => setDrawerMode('taskForm')}
                onToggle={() => planner.toggleTask(selectedTask)}
              />
            )}
            {drawerMode === 'taskForm' && (
              <TaskForm
                draft={taskDraft}
                editingTaskId={selectedTaskId}
                planner={planner}
                onChange={setTaskDraft}
                onClose={() => setDrawerMode(undefined)}
                onSaved={() => {
                  setDrawerMode(undefined);
                  setSelectedTaskId(undefined);
                  setTaskDraft(toTaskDraft(new Date()));
                }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TimerView({ planner }: { planner: ReturnType<typeof usePlanner> }) {
  const [mode, setMode] = useState<TimerMode>('focus');
  const [duration, setDuration] = useState(() => secondsToDurationParts(planner.state.settings.lastTimerDurationSeconds));
  const [now, setNow] = useState(Date.now());
  const loopingAudio = useRef<HTMLAudioElement>();
  const snapshot = planner.activeTimer ? getTimerSnapshot(planner.activeTimer, now) : undefined;
  const settings = planner.state.settings;
  const canStart = isValidTimerDuration(duration);

  useEffect(() => {
    if (!planner.activeTimer) return undefined;
    const interval = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(interval);
  }, [planner.activeTimer]);

  useEffect(() => {
    if (planner.activeTimer && snapshot?.isExpired) {
      planner.stopTimer(true);
    }
  }, [planner, snapshot?.isExpired]);

  useEffect(() => {
    if (planner.completedTimer && settings.soundsEnabled) {
      loopingAudio.current?.pause();
      loopingAudio.current = playSound(settings.timerCompleteSound, settings.soundVolume, true);
    }
    return () => {
      loopingAudio.current?.pause();
      loopingAudio.current = undefined;
    };
  }, [planner.completedTimer, settings.soundsEnabled, settings.soundVolume, settings.timerCompleteSound]);

  const stopCompleteSound = () => {
    loopingAudio.current?.pause();
    loopingAudio.current = undefined;
  };

  const dismissCompletion = () => {
    stopCompleteSound();
    planner.dismissCompletedTimer();
  };

  const startTimer = () => {
    const durationSeconds = durationPartsToSeconds(duration);
    planner.updateSettings({ ...settings, lastTimerDurationSeconds: durationSeconds });
    planner.startTimer(mode, durationSeconds);
  };

  if (planner.completedTimer) {
    return (
      <div className="timer-screen">
        <section className="panel timer-panel completion-screen">
          <p className="eyebrow">Timer Complete</p>
          <h2>{planner.completedTimer.mode === 'focus' ? 'Focus Session Finished' : 'Break Finished'}</h2>
          <div className="timer-display">{formatTimer(planner.completedTimer.durationSeconds)}</div>
          <p className="timer-meta">
            {planner.completedTimer.mode === 'focus'
              ? 'Nice work. Choose another sound, preview it, or start another session.'
              : 'Break finished. Ready when you are.'}
          </p>
          <SoundControls planner={planner} />
          <div className="timer-actions">
            <button className="secondary-action" onClick={stopCompleteSound} type="button">
              <Volume2 size={18} />
              Stop Sound
            </button>
            <button className="primary-action" onClick={dismissCompletion} type="button">
              <Play size={18} />
              Start Another
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="timer-screen">
      <section className={planner.activeTimer ? 'panel timer-panel active-session' : 'panel timer-panel'}>
        <p className="eyebrow">Timer</p>
        <h2>{planner.activeTimer ? `${planner.activeTimer.mode === 'focus' ? 'Focus' : 'Break'} Session` : 'Choose a Session'}</h2>
        {planner.activeTimer && snapshot ? (
          <>
            <div className="timer-display" aria-live="polite">{formatTimer(snapshot.remainingSeconds)}</div>
            <div className="timer-progress" aria-label="Timer progress">
              <span style={{ width: `${snapshot.progress * 100}%` }} />
            </div>
            <p className="timer-meta">Ends at {format(snapshot.finishedAt, 'h:mm a')}</p>
            <div className="timer-actions">
              <button className="secondary-action" onClick={() => planner.stopTimer(false)} type="button">
                <Square size={18} />
                Stop
              </button>
              <button className="primary-action" onClick={() => planner.stopTimer(true)} type="button">
                <Check size={18} />
                Complete
              </button>
            </div>
          </>
        ) : (
          <>
            <SegmentedControl options={['focus', 'break']} value={mode} onChange={(value) => setMode(value as TimerMode)} />
            <div className="duration-grid">
              <label className="field">
                <span>Hours</span>
                <input min="0" max="12" type="number" value={duration.hours} onChange={(event) => setDuration({ ...duration, hours: Number(event.target.value) })} />
              </label>
              <label className="field">
                <span>Minutes</span>
                <input min="0" max="59" type="number" value={duration.minutes} onChange={(event) => setDuration({ ...duration, minutes: Number(event.target.value) })} />
              </label>
              <label className="field">
                <span>Seconds</span>
                <input min="0" max="59" type="number" value={duration.seconds} onChange={(event) => setDuration({ ...duration, seconds: Number(event.target.value) })} />
              </label>
            </div>
            <SoundControls planner={planner} />
            <button className="primary-action" disabled={!canStart} onClick={startTimer} type="button">
              <Play size={18} />
              Start Timer
            </button>
          </>
        )}
      </section>
    </div>
  );
}

function SettingsView({ planner }: { planner: ReturnType<typeof usePlanner> }) {
  const settings = planner.state.settings;
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <div className="settings-screen">
      <header className="view-header">
        <div>
          <p className="eyebrow">Preferences</p>
          <h2>Settings</h2>
        </div>
      </header>
      <section className="panel settings-panel">
        <label className="toggle-row">
          <span><Bell size={18} /> Notifications</span>
          <input
            checked={settings.notificationsEnabled}
            onChange={(event) => planner.updateSettings({ ...settings, notificationsEnabled: event.target.checked })}
            type="checkbox"
          />
        </label>
        <label className="toggle-row">
          <span><Clock3 size={18} /> Start With Windows</span>
          <input
            checked={settings.autostartEnabled}
            onChange={(event) => planner.updateSettings({ ...settings, autostartEnabled: event.target.checked })}
            type="checkbox"
          />
        </label>
        <label className="toggle-row">
          <span><ListTodo size={18} /> Show Calendar Events In Tasks</span>
          <input
            checked={settings.showCalendarEventsInTasks}
            onChange={(event) => planner.updateSettings({ ...settings, showCalendarEventsInTasks: event.target.checked })}
            type="checkbox"
          />
        </label>
        <SoundControls planner={planner} />
        <button className="danger-action" onClick={() => setConfirmReset(true)} type="button">
          <RotateCcw size={18} />
          Reset Test Data
        </button>
        {confirmReset && (
          <ConfirmDialog
            title="Reset Test Data?"
            body="This clears local planner data and restores the default state."
            confirmLabel="Reset Test Data"
            danger
            onCancel={() => setConfirmReset(false)}
            onConfirm={() => {
              planner.resetPlanner();
              setConfirmReset(false);
            }}
          />
        )}
      </section>
    </div>
  );
}

function EventForm({
  draft,
  editingEventId,
  planner,
  onChange,
  onClose,
  onSaved
}: {
  draft: EventDraft;
  editingEventId?: string;
  planner: ReturnType<typeof usePlanner>;
  onChange: (draft: EventDraft) => void;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [error, setError] = useState<string>();
  const [confirmAction, setConfirmAction] = useState<'delete' | 'reset'>();
  const setField = <K extends keyof EventDraft>(key: K, value: EventDraft[K]) => onChange({ ...draft, [key]: value });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const startsAt = new Date(`${draft.startDate}T${draft.allDay ? '00:00' : draft.start}`).toISOString();
    const endsAt = new Date(`${draft.endDate}T${draft.allDay ? '23:59' : draft.end}`).toISOString();
    const validationError = validateEventTime({ startsAt, endsAt });

    if (validationError) {
      setError(validationError);
      return;
    }

    const eventInput = {
      title: draft.title,
      notes: draft.notes,
      startsAt,
      endsAt,
      allDay: draft.allDay,
      importance: draft.importance,
      color: draft.color,
      recurrenceRule: buildRecurrenceFromDraft(draft.recurrence),
      reminders: []
    };

    if (editingEventId) {
      planner.updateEvent(editingEventId, eventInput);
    } else {
      planner.addEvent({ ...eventInput, completedOccurrences: [] });
    }
    onSaved();
  };

  return (
    <form className="panel form-panel drawer-panel" onMouseDown={(event) => event.stopPropagation()} onSubmit={submit}>
      <DrawerHeader title={editingEventId ? 'Edit Event' : 'New Event'} detail="Use 30-minute precision, multi-day times, colors, and custom repeats." onClose={onClose} />
      <input name="title" placeholder="Event Title" required value={draft.title} onChange={(event) => setField('title', event.target.value)} />
      <label className="checkbox-row">
        <input name="allDay" type="checkbox" checked={draft.allDay} onChange={(event) => setField('allDay', event.target.checked)} />
        <span>All Day</span>
      </label>
      <div className="form-grid">
        <label className="field">
          <span>Start Date</span>
          <input name="startDate" type="date" required value={draft.startDate} onChange={(event) => setField('startDate', event.target.value)} />
        </label>
        <ClockTimeControl disabled={draft.allDay} label="Start Time" value={draft.start} onChange={(value) => setField('start', value)} />
      </div>
      <div className="form-grid">
        <label className="field">
          <span>End Date</span>
          <input name="endDate" type="date" required value={draft.endDate} onChange={(event) => setField('endDate', event.target.value)} />
        </label>
        <ClockTimeControl disabled={draft.allDay} label="End Time" value={draft.end} onChange={(value) => setField('end', value)} />
      </div>
      <RecurrenceFields value={draft.recurrence} onChange={(recurrence) => setField('recurrence', recurrence)} />
      <textarea name="notes" placeholder="Notes" value={draft.notes} onChange={(event) => setField('notes', event.target.value)} />
      <label className="field">
        <span>Importance</span>
        <select name="importance" value={draft.importance} onChange={(event) => setField('importance', event.target.value as CalendarEvent['importance'])}>
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
        </select>
      </label>
      <ColorPicker value={draft.color} onChange={(color) => setField('color', color)} />
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions">
        {editingEventId && (
          <button className="danger-action" type="button" onClick={() => setConfirmAction('delete')}>
            <Trash2 size={18} />
            Delete Event
          </button>
        )}
        <button className="secondary-action" type="button" onClick={() => setConfirmAction('reset')}>
          <RotateCcw size={18} />
          Reset
        </button>
        <button className="primary-action" type="submit">{editingEventId ? 'Save Event' : 'Add Event'}</button>
      </div>
      {confirmAction && (
        <ConfirmDialog
          title={confirmAction === 'delete' ? 'Delete Event?' : 'Reset Event?'}
          body={confirmAction === 'delete' ? 'This removes the event from your calendar.' : 'This clears the current draft and uses the current date and time.'}
          confirmLabel={confirmAction === 'delete' ? 'Delete Event' : 'Reset'}
          danger={confirmAction === 'delete'}
          onCancel={() => setConfirmAction(undefined)}
          onConfirm={() => {
            if (confirmAction === 'delete' && editingEventId) {
              planner.deleteEvent(editingEventId);
              onSaved();
            } else {
              onChange(toDraft(new Date()));
              setConfirmAction(undefined);
            }
          }}
        />
      )}
    </form>
  );
}

function TaskForm({
  draft,
  editingTaskId,
  planner,
  onChange,
  onClose,
  onSaved
}: {
  draft: TaskDraft;
  editingTaskId?: string;
  planner: ReturnType<typeof usePlanner>;
  onChange: (draft: TaskDraft) => void;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [error, setError] = useState<string>();
  const [confirmAction, setConfirmAction] = useState<'reset'>();
  const setField = <K extends keyof TaskDraft>(key: K, value: TaskDraft[K]) => onChange({ ...draft, [key]: value });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const startsAt = draft.hasStartTime || draft.allDay
      ? buildDraftDateTime(
        draft.startDate,
        draft.startHour,
        draft.startMinute,
        draft.startMeridiem,
        draft.allDay,
        false
      ).toISOString()
      : undefined;
    const endsAt = buildDraftDateTime(
      draft.endDate,
      draft.endHour,
      draft.endMinute,
      draft.endMeridiem,
      draft.allDay,
      true
    ).toISOString();
    const validationError = startsAt ? validateEventTime({ startsAt, endsAt }) : undefined;

    if (validationError) {
      setError(validationError);
      return;
    }

    const taskInput = {
      title: draft.title,
      notes: draft.notes,
      priority: draft.priority,
      startsAt,
      endsAt,
      dueAt: endsAt,
      allDay: draft.allDay,
      recurrenceRule: buildRecurrenceFromDraft(draft.recurrence),
      reminders: []
    };

    if (editingTaskId) {
      planner.updateTask(editingTaskId, taskInput);
    } else {
      planner.addTask(taskInput);
    }
    onSaved();
  };

  return (
    <form className="panel form-panel drawer-panel" onMouseDown={(event) => event.stopPropagation()} onSubmit={submit}>
      <DrawerHeader title={editingTaskId ? 'Edit Task' : 'New Task'} detail="Capture the next clear action." onClose={onClose} />
      <input name="title" placeholder="Task Title" required value={draft.title} onChange={(event) => setField('title', event.target.value)} />
      <label className="checkbox-row">
        <input name="allDay" type="checkbox" checked={draft.allDay} onChange={(event) => setField('allDay', event.target.checked)} />
        <span>All Day</span>
      </label>
      <label className="checkbox-row">
        <input
          disabled={draft.allDay}
          name="hasStartTime"
          type="checkbox"
          checked={draft.hasStartTime}
          onChange={(event) => setField('hasStartTime', event.target.checked)}
        />
        <span>Start Time</span>
      </label>
      {(draft.hasStartTime || draft.allDay) && (
        <div className="form-grid">
          <label className="field">
            <span>Start Date</span>
            <input disabled={draft.allDay} name="startDate" type="date" value={draft.startDate} onChange={(event) => setField('startDate', event.target.value)} />
          </label>
          <TimePartsControl
            disabled={draft.allDay}
            hour={draft.startHour}
            minute={draft.startMinute}
            meridiem={draft.startMeridiem}
            name="start"
            onHourChange={(value) => setField('startHour', value)}
            onMeridiemChange={(value) => setField('startMeridiem', value)}
            onMinuteChange={(value) => setField('startMinute', value)}
          />
        </div>
      )}
      <div className="form-grid">
        <label className="field">
          <span>End Date</span>
          <input name="endDate" type="date" value={draft.endDate} onChange={(event) => setField('endDate', event.target.value)} />
        </label>
        <TimePartsControl
          disabled={draft.allDay}
          hour={draft.endHour}
          minute={draft.endMinute}
          meridiem={draft.endMeridiem}
          name="end"
          onHourChange={(value) => setField('endHour', value)}
          onMeridiemChange={(value) => setField('endMeridiem', value)}
          onMinuteChange={(value) => setField('endMinute', value)}
        />
      </div>
      <label className="field">
        <span>Priority</span>
        <select name="priority" value={draft.priority} onChange={(event) => setField('priority', event.target.value as Task['priority'])}>
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
        </select>
      </label>
      <RecurrenceFields value={draft.recurrence} onChange={(recurrence) => setField('recurrence', recurrence)} />
      <textarea name="notes" placeholder="Notes" value={draft.notes} onChange={(event) => setField('notes', event.target.value)} />
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions">
        <button className="secondary-action" type="button" onClick={() => setConfirmAction('reset')}>
          <RotateCcw size={18} />
          Reset
        </button>
        <button className="primary-action" type="submit">{editingTaskId ? 'Save Task' : 'Add Task'}</button>
      </div>
      {confirmAction && (
        <ConfirmDialog
          title="Reset Task?"
          body="This clears the current draft and uses the current date and time."
          confirmLabel="Reset"
          onCancel={() => setConfirmAction(undefined)}
          onConfirm={() => {
            onChange(toTaskDraft(new Date()));
            setConfirmAction(undefined);
          }}
        />
      )}
    </form>
  );
}

function PlannerItemRow({ item, planner, onOpen }: { item: PlannerListItem; planner: ReturnType<typeof usePlanner>; onOpen?: () => void }) {
  const when = formatItemTime(item);
  const source = item.source;
  const toggle = () => item.kind === 'task'
    ? planner.toggleTask(source as Task)
    : planner.toggleEvent(source as CalendarEvent, item.startsAt);

  return (
    <div
      className={`list-row ${item.kind} ${item.completed ? 'completed' : ''}`}
      onClick={onOpen}
      role={onOpen ? 'button' : undefined}
      style={item.kind === 'event' ? { borderLeftColor: (source as CalendarEvent).color } : undefined}
      tabIndex={onOpen ? 0 : undefined}
    >
      <button
        aria-label={item.completed ? `Mark ${item.title} incomplete` : `Mark ${item.title} complete`}
        className="icon-action"
        onClick={(event) => { event.stopPropagation(); toggle(); }}
        title={item.completed ? 'Mark incomplete' : 'Mark complete'}
        type="button"
      >
        {item.completed ? <Check size={16} /> : <Square size={16} />}
      </button>
      <div className="item-main">
        <strong>{item.title}</strong>
        <span>{when}</span>
        {item.notes && <span className="item-notes">{item.notes}</span>}
        {item.completedAt && <span className="completed-time">Completed {format(parseISO(item.completedAt), 'MMM d, h:mm a')}</span>}
      </div>
      <small>{item.kind === 'task' ? item.priority : item.importance}</small>
      {item.kind === 'event' && item.importance === 'high' && <Star size={16} />}
      <button className="icon-action" onClick={(event) => { event.stopPropagation(); item.kind === 'task' ? planner.deleteTask((source as Task).id) : planner.deleteEvent((source as CalendarEvent).id); }} title={item.kind === 'task' ? 'Delete Task' : 'Delete Event'} type="button"><Trash2 size={16} /></button>
    </div>
  );
}

function SoundControls({ planner }: { planner: ReturnType<typeof usePlanner> }) {
  const settings = planner.state.settings;
  const previewAudio = useRef<HTMLAudioElement>();
  const selectedSoundId = soundChoices.some((sound) => sound.id === settings.timerCompleteSound)
    ? settings.timerCompleteSound
    : soundChoices[0].id;

  useEffect(() => () => {
    previewAudio.current?.pause();
    previewAudio.current = undefined;
  }, []);

  const previewSound = () => {
    previewAudio.current?.pause();
    previewAudio.current = playSound(selectedSoundId, settings.soundVolume);
  };

  return (
    <div className="sound-controls">
      <label className="toggle-row">
        <span><Volume2 size={18} /> Timer Sounds</span>
        <input
          checked={settings.soundsEnabled}
          onChange={(event) => planner.updateSettings({ ...settings, soundsEnabled: event.target.checked })}
          type="checkbox"
        />
      </label>
      <div className="form-grid">
        <select
          aria-label="Timer Completion Sound"
          value={selectedSoundId}
          onChange={(event) => planner.updateSettings({ ...settings, timerCompleteSound: event.target.value })}
        >
          {soundChoices.map((sound) => <option key={sound.id} value={sound.id}>{sound.label}</option>)}
        </select>
        <button className="secondary-action" onClick={previewSound} type="button">
          <Volume2 size={18} />
          Preview
        </button>
      </div>
      <label className="field">
        <span>Volume</span>
        <input
          max="1"
          min="0"
          step="0.05"
          type="range"
          value={settings.soundVolume}
          onChange={(event) => planner.updateSettings({ ...settings, soundVolume: Number(event.target.value) })}
        />
      </label>
    </div>
  );
}

function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  return (
    <fieldset className="color-picker">
      <legend>Event Color</legend>
      <div className="color-grid">
        {eventColors.map((color) => (
          <label key={color} style={{ '--swatch-color': color } as CSSProperties}>
            <input checked={value === color} name="color" type="radio" value={color} onChange={() => onChange(color)} />
            <span aria-hidden="true" />
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function ChoiceDrawer({ onClose, onEvent, onTask }: { onClose: () => void; onEvent: () => void; onTask: () => void }) {
  return (
    <section className="panel form-panel drawer-panel" onMouseDown={(event) => event.stopPropagation()}>
      <DrawerHeader title="Create Item" detail="Choose what this calendar time should become." onClose={onClose} />
      <button className="primary-action" onClick={onEvent} type="button"><CalendarDays size={18} /> New Event</button>
      <button className="secondary-action" onClick={onTask} type="button"><ListTodo size={18} /> New Task</button>
    </section>
  );
}

function DetailsDrawer({
  item,
  kind,
  onClose,
  onEdit,
  onToggle
}: {
  item?: Task | CalendarEvent;
  kind: 'task' | 'event';
  onClose: () => void;
  onEdit: () => void;
  onToggle: () => void;
}) {
  if (!item) return null;
  const startsAt = 'startsAt' in item ? item.startsAt : undefined;
  const endsAt = 'endsAt' in item ? item.endsAt : undefined;
  const complete = 'status' in item ? item.status === 'completed' : item.completedOccurrences.length > 0;

  return (
    <section className="panel form-panel drawer-panel" onMouseDown={(event) => event.stopPropagation()}>
      <DrawerHeader title={item.title} detail={kind === 'task' ? 'Task Details' : 'Event Details'} onClose={onClose} />
      <div className="detail-stack">
        <DetailLine label="When" value={formatRange(startsAt, endsAt, item.allDay)} />
        <DetailLine label={kind === 'task' ? 'Priority' : 'Importance'} value={'priority' in item ? item.priority : item.importance} />
        <DetailLine label="Repeat" value={item.recurrenceRule ? 'Repeats' : 'Does Not Repeat'} />
        <DetailLine label="Status" value={complete ? 'Completed' : 'Open'} />
        {item.notes && <DetailLine label="Notes" value={item.notes} />}
      </div>
      <div className="form-actions">
        <button className="secondary-action" onClick={onToggle} type="button">{complete ? 'Mark Incomplete' : 'Mark Complete'}</button>
        <button className="primary-action" onClick={onEdit} type="button">Edit</button>
      </div>
    </section>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-line">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ConfirmDialog({
  title,
  body,
  confirmLabel,
  danger = false,
  onCancel,
  onConfirm
}: {
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="confirm-box" role="alertdialog" aria-modal="true">
      <strong>{title}</strong>
      <p>{body}</p>
      <div className="form-actions">
        <button className="secondary-action" onClick={onCancel} type="button">Cancel</button>
        <button className={danger ? 'danger-action' : 'primary-action'} onClick={onConfirm} type="button">{confirmLabel}</button>
      </div>
    </div>
  );
}

function RecurrenceFields({ value, onChange }: { value: RecurrenceDraft; onChange: (value: RecurrenceDraft) => void }) {
  const setValue = (patch: Partial<RecurrenceDraft>) => onChange({ ...value, ...patch });
  const toggleWeekday = (day: NonNullable<RecurrenceDraft['weekdays']>[number]) => {
    const weekdays = value.weekdays ?? [];
    setValue({ weekdays: weekdays.includes(day) ? weekdays.filter((candidate) => candidate !== day) : [...weekdays, day] });
  };
  const toggleMonth = (month: number) => {
    const months = value.months ?? [];
    setValue({ months: months.includes(month) ? months.filter((candidate) => candidate !== month) : [...months, month] });
  };

  return (
    <fieldset className="recurrence-box">
      <legend>Repeat</legend>
      <select name="frequency" value={value.frequency} onChange={(event) => setValue({ frequency: event.target.value as RepeatFrequency | 'none' })}>
        <option value="none">No Repeat</option>
        <option value="daily">Daily</option>
        <option value="weekly">Weekly</option>
        <option value="monthly">Monthly</option>
        <option value="yearly">Yearly</option>
      </select>
      {value.frequency !== 'none' && (
        <>
          <div className="form-grid">
            <label className="field">
              <span>Every</span>
              <input min="1" name="interval" type="number" value={value.interval} onChange={(event) => setValue({ interval: Math.max(1, Number(event.target.value) || 1) })} />
            </label>
            <label className="field">
              <span>Occurrences</span>
              <input min="1" name="count" placeholder="Optional" type="number" value={value.count ?? ''} onChange={(event) => setValue({ count: event.target.value ? Number(event.target.value) : undefined })} />
            </label>
          </div>
          <label className="field">
            <span>End By (Optional)</span>
            <input name="until" type="date" value={value.until ? format(value.until, 'yyyy-MM-dd') : ''} onChange={(event) => setValue({ until: event.target.value ? new Date(`${event.target.value}T23:59:59`) : undefined })} />
          </label>
          {(value.frequency === 'daily' || value.frequency === 'weekly') && (
            <>
            <p className="field-hint">Days (Optional)</p>
            <div className="weekday-grid" aria-label="Repeat weekdays">
              {weekdayOptions.map((day) => (
                <label key={day.value}>
                  <input checked={value.weekdays?.includes(day.value) ?? false} name="weekdays" type="checkbox" value={day.value} onChange={() => toggleWeekday(day.value)} />
                  <span>{day.label}</span>
                </label>
              ))}
            </div>
            </>
          )}
          {value.frequency === 'monthly' && (
            <>
            <p className="field-hint">Months (Optional)</p>
            <div className="month-grid" aria-label="Repeat months">
              {monthOptions.map((month) => (
                <label key={month.value}>
                  <input checked={value.months?.includes(Number(month.value)) ?? false} name="months" type="checkbox" value={month.value} onChange={() => toggleMonth(Number(month.value))} />
                  <span>{month.label}</span>
                </label>
              ))}
            </div>
            </>
          )}
        </>
      )}
    </fieldset>
  );
}

function MetricCard({ label, value }: { label: string; value: number | string }) {
  return (
    <section className="panel metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </section>
  );
}

function TimePartsControl({
  disabled,
  hour,
  minute,
  meridiem,
  name,
  onHourChange,
  onMeridiemChange,
  onMinuteChange
}: {
  disabled: boolean;
  hour: string;
  minute: string;
  meridiem: 'AM' | 'PM';
  name: string;
  onHourChange: (value: string) => void;
  onMeridiemChange: (value: 'AM' | 'PM') => void;
  onMinuteChange: (value: string) => void;
}) {
  return (
    <fieldset className="time-parts" disabled={disabled}>
      <legend>{name === 'start' ? 'Start Time' : 'End Time'}</legend>
      <select aria-label={`${name} hour`} value={hour} onChange={(event) => onHourChange(event.target.value)}>
        {Array.from({ length: 12 }, (_, index) => String(index + 1)).map((value) => (
          <option key={value} value={value}>{value}</option>
        ))}
      </select>
      <input aria-label={`${name} minute`} max="59" min="0" type="number" value={minute} onChange={(event) => onMinuteChange(clampMinute(event.target.value))} />
      <div className="segmented mini-segmented" aria-label={`${name} meridiem`}>
        {(['AM', 'PM'] as const).map((value) => (
          <button className={meridiem === value ? 'selected' : ''} key={value} onClick={() => onMeridiemChange(value)} type="button">{value}</button>
        ))}
      </div>
    </fieldset>
  );
}

function ClockTimeControl({ disabled, label, value, onChange }: { disabled: boolean; label: string; value: string; onChange: (value: string) => void }) {
  const parts = timeStringToParts(value);
  return (
    <TimePartsControl
      disabled={disabled}
      hour={parts.hour}
      minute={parts.minute}
      meridiem={parts.meridiem}
      name={label.toLowerCase().startsWith('start') ? 'start' : 'end'}
      onHourChange={(hour) => onChange(partsToTimeString(hour, parts.minute, parts.meridiem))}
      onMinuteChange={(minute) => onChange(partsToTimeString(parts.hour, minute, parts.meridiem))}
      onMeridiemChange={(meridiem) => onChange(partsToTimeString(parts.hour, parts.minute, meridiem))}
    />
  );
}

function ListPanel({
  title,
  detail,
  empty,
  action,
  children,
  initiallyCollapsed = false,
  roomy = false
}: {
  title: string;
  detail: string;
  empty: string;
  action?: ReactNode;
  children: ReactNode;
  initiallyCollapsed?: boolean;
  roomy?: boolean;
}) {
  const childArray = Array.isArray(children) ? children : [children];
  const [expanded, setExpanded] = useState(!initiallyCollapsed);

  return (
    <section className={`panel feature-panel ${expanded ? 'expanded-list' : ''} ${roomy ? 'roomy-list' : ''}`}>
      <div className="panel-title-row">
        <PanelTitle title={title} detail={detail} />
        <div className="panel-actions">
          {action}
          <button className="icon-action" onClick={() => setExpanded((current) => !current)} title={expanded ? 'Collapse list' : 'Expand list'} type="button">
            <ChevronDown className={expanded ? 'rotate-icon' : ''} size={18} />
          </button>
        </div>
      </div>
      {expanded && <div className="item-list">{childArray.length === 0 ? <p className="empty-state">{empty}</p> : children}</div>}
    </section>
  );
}

function PanelTitle({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="panel-title">
      <h3>{title}</h3>
      <p>{detail}</p>
    </div>
  );
}

function DrawerHeader({ title, detail, onClose }: { title: string; detail: string; onClose: () => void }) {
  return (
    <div className="panel-title-row">
      <PanelTitle title={title} detail={detail} />
      <button className="icon-action" onClick={onClose} title="Close" type="button"><X size={18} /></button>
    </div>
  );
}

function SegmentedControl({ options, value, onChange }: { options: string[]; value: string; onChange: (value: string) => void }) {
  return (
    <div className="segmented">
      {options.map((option) => (
        <button className={value === option ? 'selected' : ''} key={option} onClick={() => onChange(option)} type="button">
          {option}
        </button>
      ))}
    </div>
  );
}

function toDraft(start: Date, end = addMinutes(start, 30), event?: CalendarEvent): EventDraft {
  return {
    title: event?.title ?? '',
    notes: event?.notes ?? '',
    startDate: format(start, 'yyyy-MM-dd'),
    start: format(start, 'HH:mm'),
    endDate: format(end, 'yyyy-MM-dd'),
    end: format(end, 'HH:mm'),
    allDay: event?.allDay ?? false,
    importance: event?.importance ?? 'normal',
    color: event?.color ?? eventColors[0],
    recurrence: parseRecurrenceRule(event?.recurrenceRule)
  };
}

function toTaskDraft(start: Date, end = addMinutes(start, 30)): TaskDraft {
  return {
    title: '',
    notes: '',
    hasStartTime: false,
    startDate: format(start, 'yyyy-MM-dd'),
    startHour: format(start, 'h'),
    startMinute: format(start, 'mm'),
    startMeridiem: format(start, 'a') as 'AM' | 'PM',
    endDate: format(end, 'yyyy-MM-dd'),
    endHour: format(end, 'h'),
    endMinute: format(end, 'mm'),
    endMeridiem: format(end, 'a') as 'AM' | 'PM',
    allDay: false,
    priority: 'normal',
    recurrence: { frequency: 'none', interval: 1 }
  };
}

function toTaskDraftFromTask(task: Task): TaskDraft {
  const end = task.endsAt ?? task.dueAt ?? new Date().toISOString();
  const draft = toTaskDraft(task.startsAt ? parseISO(task.startsAt) : parseISO(end), parseISO(end));
  return {
    ...draft,
    title: task.title,
    notes: task.notes,
    hasStartTime: Boolean(task.startsAt),
    allDay: task.allDay,
    priority: task.priority,
    recurrence: parseRecurrenceRule(task.recurrenceRule)
  };
}

function buildDraftDateTime(
  date: string,
  hour: string,
  minute: string,
  meridiem: 'AM' | 'PM',
  allDay: boolean,
  endOfDay: boolean
): Date {
  if (allDay) {
    return new Date(`${date}T${endOfDay ? '23:59' : '00:00'}:00`);
  }

  const hourNumber = Number(hour);
  const normalizedHour = meridiem === 'AM'
    ? hourNumber % 12
    : (hourNumber % 12) + 12;

  return new Date(`${date}T${String(normalizedHour).padStart(2, '0')}:${minute}:00`);
}

function buildRecurrenceFromDraft(recurrence: RecurrenceDraft): string | undefined {
  if (recurrence.frequency === 'none') return undefined;
  return createCustomRecurrenceRule({
    frequency: recurrence.frequency,
    interval: Math.max(1, recurrence.interval || 1),
    count: recurrence.count,
    until: recurrence.until,
    weekdays: (recurrence.frequency === 'daily' || recurrence.frequency === 'weekly') && recurrence.weekdays?.length ? recurrence.weekdays : undefined,
    months: recurrence.frequency === 'monthly' && recurrence.months?.length ? recurrence.months : undefined
  });
}

function timeStringToParts(value: string): { hour: string; minute: string; meridiem: 'AM' | 'PM' } {
  const [hourText = '0', minuteText = '0'] = value.split(':');
  const hour24 = Number(hourText);
  return {
    hour: String(hour24 % 12 || 12),
    minute: clampMinute(minuteText),
    meridiem: hour24 >= 12 ? 'PM' : 'AM'
  };
}

function partsToTimeString(hour: string, minute: string, meridiem: 'AM' | 'PM'): string {
  const hourNumber = Number(hour);
  const normalizedHour = meridiem === 'AM' ? hourNumber % 12 : (hourNumber % 12) + 12;
  return `${String(normalizedHour).padStart(2, '0')}:${clampMinute(minute)}`;
}

function clampMinute(value: string): string {
  const minute = Math.min(59, Math.max(0, Number(value) || 0));
  return String(minute).padStart(2, '0');
}

function formatRange(startsAt?: string, endsAt?: string, allDay = false): string {
  if (!startsAt && !endsAt) return 'No Time';
  if (!startsAt || startsAt === endsAt) return `${endsAt ? format(parseISO(endsAt), allDay ? 'MMM d, yyyy' : 'MMM d, yyyy h:mm a') : 'No Time'}`;
  const start = parseISO(startsAt);
  const end = parseISO(endsAt!);
  if (allDay) return `${format(start, 'MMM d, yyyy')} - ${format(end, 'MMM d, yyyy')}`;
  return `${format(start, 'MMM d, h:mm a')} - ${format(end, isSameDay(start, end) ? 'h:mm a' : 'MMM d, h:mm a')}`;
}

function formatItemTime(item: PlannerListItem): string {
  return formatRange(item.startsAt, item.endsAt ?? item.dueAt, item.allDay);
}

function playSound(soundId: string, volume: number, loop = false): HTMLAudioElement {
  const audio = new Audio(getSoundChoice(soundId).src);
  audio.volume = volume;
  audio.loop = loop;
  const playback = audio.play();
  if (playback) {
    playback.catch(() => undefined);
  }
  return audio;
}
