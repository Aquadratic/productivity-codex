import '@fullcalendar/core/index.js';
import type { EventClickArg } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin, { DateClickArg } from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import { addMinutes, format, parseISO } from 'date-fns';
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
import { createCustomRecurrenceRule } from '../shared/recurrence';
import { validateEventTime } from '../shared/events';
import { getSoundChoice, soundChoices } from '../shared/sounds';
import { durationPartsToSeconds, formatTimer, getTimerSnapshot, isValidTimerDuration, secondsToDurationParts } from '../shared/timer';
import { getTaskListGroups, getUpcomingItems, type PlannerFilter, type PlannerListItem } from '../shared/selectors';
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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string>();

  const openDraft = (start: Date, end?: Date) => {
    setDraft(toDraft(start, end ?? addMinutes(start, 30)));
    setEditingEventId(undefined);
    setDrawerOpen(true);
  };

  const openExisting = (id: string) => {
    const event = planner.state.events.find((candidate) => candidate.id === id);
    if (!event) return;
    setDraft(toDraft(parseISO(event.startsAt), parseISO(event.endsAt), event));
    setEditingEventId(id);
    setDrawerOpen(true);
  };

  const handleDateClick = (arg: DateClickArg) => openDraft(addMinutes(arg.date, -30), addMinutes(arg.date, 30));
  const handleEventClick = (arg: EventClickArg) => openExisting(arg.event.id);
  const previewEvents = useMemo(() => {
    if (!drawerOpen) return planner.calendarEvents;
    const previewStart = new Date(`${draft.startDate}T${draft.start}`);
    const previewEnd = new Date(`${draft.endDate}T${draft.end}`);
    if (Number.isNaN(previewStart.getTime()) || Number.isNaN(previewEnd.getTime())) {
      return planner.calendarEvents;
    }
    return [
      ...planner.calendarEvents,
      {
        id: 'draft-preview',
        title: draft.title || 'New Event',
        start: previewStart.toISOString(),
        end: previewEnd.toISOString(),
        allDay: draft.allDay,
        classNames: ['draft-preview-event'],
        backgroundColor: draft.color,
        borderColor: draft.color,
        extendedProps: { importance: draft.importance, notes: draft.notes }
      }
    ];
  }, [draft, drawerOpen, planner.calendarEvents]);

  return (
    <div className="view-stack full-height-view">
      <header className="view-header">
        <div>
          <p className="eyebrow">Calendar</p>
          <h2>Plan By Time</h2>
        </div>
        <button className="primary-action" onClick={() => { setEditingEventId(undefined); setDrawerOpen(true); }} type="button">
          <CalendarDays size={18} />
          New Event
        </button>
      </header>
      <div className="calendar-layout single">
        <section className="panel calendar-panel" aria-label="Calendar">
          <FullCalendar
            allDaySlot
            dateClick={handleDateClick}
            dayMaxEventRows={3}
            dayMaxEvents={3}
            editable={false}
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
            select={(selection) => openDraft(selection.start, selection.end)}
            slotDuration="00:30:00"
            snapDuration="00:30:00"
            scrollTime="06:00:00"
            slotMinTime="00:00:00"
            slotMaxTime="24:00:00"
            views={{
              dayGridMonth: { titleFormat: { month: 'short', year: 'numeric' } },
              timeGridWeek: { titleFormat: { month: 'short', day: 'numeric' } },
              timeGridDay: { titleFormat: { month: 'short', day: 'numeric', year: 'numeric' } },
              listWeek: { titleFormat: { month: 'short', day: 'numeric' } }
            }}
            eventTimeFormat={{ hour: 'numeric', minute: '2-digit', meridiem: 'short' }}
          />
        </section>
        {drawerOpen && (
          <div className="drawer-backdrop" role="presentation" onMouseDown={(event) => {
            if (event.target === event.currentTarget) setDrawerOpen(false);
          }}>
            <EventForm
              draft={draft}
              editingEventId={editingEventId}
              planner={planner}
              onChange={setDraft}
              onClose={() => setDrawerOpen(false)}
              onSaved={() => {
                setDrawerOpen(false);
                setEditingEventId(undefined);
                setDraft(toDraft(new Date()));
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function TasksView({ planner }: { planner: ReturnType<typeof usePlanner> }) {
  const [filter, setFilter] = useState<PlannerFilter>('all');
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [taskDraft, setTaskDraft] = useState<TaskDraft>(() => toTaskDraft(new Date()));
  const groups = useMemo(() => getTaskListGroups(planner.state, filter), [filter, planner.state]);

  return (
    <div className="view-stack full-height-view">
      <header className="view-header">
        <div>
          <p className="eyebrow">Tasks</p>
          <h2>Work Queue</h2>
        </div>
        <div className="header-actions">
          <SegmentedControl options={['all', 'today', 'upcoming', 'overdue']} value={filter} onChange={(value) => setFilter(value as PlannerFilter)} />
          <button className="primary-action" onClick={() => setTaskFormOpen(true)} type="button">
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
            <PlannerItemRow item={item} key={`${item.kind}-${item.id}`} planner={planner} />
          ))}
        </ListPanel>
        <ListPanel title="Completed" detail="Finished Items For This Tab" empty="Nothing completed here yet." initiallyCollapsed>
          {groups.completed.map((item) => (
            <PlannerItemRow item={item} key={`completed-${item.kind}-${item.id}`} planner={planner} />
          ))}
        </ListPanel>
        {taskFormOpen && (
          <div className="drawer-backdrop" role="presentation" onMouseDown={(event) => {
            if (event.target === event.currentTarget) setTaskFormOpen(false);
          }}>
            <TaskForm
              draft={taskDraft}
              planner={planner}
              onChange={setTaskDraft}
              onClose={() => setTaskFormOpen(false)}
              onSaved={() => {
                setTaskFormOpen(false);
                setTaskDraft(toTaskDraft(new Date()));
              }}
            />
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
          <p className="timer-meta">Nice work. Choose another sound, preview it, or start another session.</p>
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
        <button className="danger-action" onClick={planner.resetPlanner} type="button">
          <RotateCcw size={18} />
          Reset Test Data
        </button>
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
  const setField = <K extends keyof EventDraft>(key: K, value: EventDraft[K]) => onChange({ ...draft, [key]: value });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
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
      recurrenceRule: buildRecurrenceFromForm(form),
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
        <label className="field">
          <span>Start Time</span>
          <input disabled={draft.allDay} name="start" step="1800" type="time" required value={draft.start} onChange={(event) => setField('start', event.target.value)} />
        </label>
      </div>
      <div className="form-grid">
        <label className="field">
          <span>End Date</span>
          <input name="endDate" type="date" required value={draft.endDate} onChange={(event) => setField('endDate', event.target.value)} />
        </label>
        <label className="field">
          <span>End Time</span>
          <input disabled={draft.allDay} name="end" step="1800" type="time" required value={draft.end} onChange={(event) => setField('end', event.target.value)} />
        </label>
      </div>
      <RecurrenceFields />
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
        <button className="secondary-action" type="button" onClick={() => onChange(toDraft(new Date()))}>
          <RotateCcw size={18} />
          Reset
        </button>
        <button className="primary-action" type="submit">{editingEventId ? 'Save Event' : 'Add Event'}</button>
      </div>
      {editingEventId && (
        <button className="danger-action" type="button" onClick={() => {
          planner.deleteEvent(editingEventId);
          onSaved();
        }}>
          <Trash2 size={18} />
          Delete Event
        </button>
      )}
    </form>
  );
}

function TaskForm({
  draft,
  planner,
  onChange,
  onClose,
  onSaved
}: {
  draft: TaskDraft;
  planner: ReturnType<typeof usePlanner>;
  onChange: (draft: TaskDraft) => void;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [error, setError] = useState<string>();
  const setField = <K extends keyof TaskDraft>(key: K, value: TaskDraft[K]) => onChange({ ...draft, [key]: value });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
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

    planner.addTask({
      title: draft.title,
      notes: draft.notes,
      priority: draft.priority,
      startsAt,
      endsAt,
      dueAt: endsAt,
      allDay: draft.allDay,
      recurrenceRule: buildRecurrenceFromForm(form),
      reminders: []
    });
    onSaved();
  };

  return (
    <form className="panel form-panel drawer-panel" onMouseDown={(event) => event.stopPropagation()} onSubmit={submit}>
      <DrawerHeader title="New Task" detail="Capture the next clear action." onClose={onClose} />
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
        <span>Optional Start Time</span>
      </label>
      <div className="form-grid">
        <label className="field">
          <span>Start Date</span>
          <input disabled={!draft.hasStartTime && !draft.allDay} name="startDate" type="date" value={draft.startDate} onChange={(event) => setField('startDate', event.target.value)} />
        </label>
        <TimePartsControl
          disabled={draft.allDay || !draft.hasStartTime}
          hour={draft.startHour}
          minute={draft.startMinute}
          meridiem={draft.startMeridiem}
          name="start"
          onHourChange={(value) => setField('startHour', value)}
          onMeridiemChange={(value) => setField('startMeridiem', value)}
          onMinuteChange={(value) => setField('startMinute', value)}
        />
      </div>
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
          <option value="low">Low - Flexible Timing</option>
          <option value="normal">Normal - Planned Work</option>
          <option value="high">High - Needs Attention</option>
        </select>
      </label>
      <RecurrenceFields />
      <textarea name="notes" placeholder="Notes" value={draft.notes} onChange={(event) => setField('notes', event.target.value)} />
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions">
        <button className="secondary-action" type="button" onClick={() => onChange(toTaskDraft(new Date()))}>
          <RotateCcw size={18} />
          Reset
        </button>
        <button className="primary-action" type="submit">Add Task</button>
      </div>
    </form>
  );
}

function PlannerItemRow({ item, planner }: { item: PlannerListItem; planner: ReturnType<typeof usePlanner> }) {
  const when = item.startsAt ?? item.dueAt;
  const source = item.source;
  const toggle = () => item.kind === 'task'
    ? planner.toggleTask(source as Task)
    : planner.toggleEvent(source as CalendarEvent, item.startsAt);

  return (
    <div className={`list-row ${item.kind} ${item.completed ? 'completed' : ''}`} style={item.kind === 'event' ? { borderLeftColor: (source as CalendarEvent).color } : undefined}>
      <button
        aria-label={item.completed ? `Mark ${item.title} incomplete` : `Mark ${item.title} complete`}
        className="icon-action"
        onClick={toggle}
        title={item.completed ? 'Mark incomplete' : 'Mark complete'}
        type="button"
      >
        {item.completed ? <Check size={16} /> : <Square size={16} />}
      </button>
      <div className="item-main">
        <strong>{item.title}</strong>
        <span>{when ? format(parseISO(when), 'MMM d, h:mm a') : 'No due date'}</span>
        {item.completedAt && <span className="completed-time">Completed {format(parseISO(item.completedAt), 'MMM d, h:mm a')}</span>}
      </div>
      <small>{item.kind === 'task' ? item.priority : item.importance}</small>
      {item.kind === 'event' && item.importance === 'high' && <Star size={16} />}
      <button className="icon-action" onClick={() => item.kind === 'task' ? planner.deleteTask(item.id) : planner.deleteEvent(item.id)} title={item.kind === 'task' ? 'Delete Task' : 'Delete Event'} type="button"><Trash2 size={16} /></button>
    </div>
  );
}

function SoundControls({ planner }: { planner: ReturnType<typeof usePlanner> }) {
  const settings = planner.state.settings;
  const selectedSoundId = soundChoices.some((sound) => sound.id === settings.timerCompleteSound)
    ? settings.timerCompleteSound
    : soundChoices[0].id;

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
        <button className="secondary-action" onClick={() => playSound(selectedSoundId, settings.soundVolume)} type="button">
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

function RecurrenceFields() {
  const [frequency, setFrequency] = useState<RepeatFrequency | 'none'>('none');

  return (
    <fieldset className="recurrence-box">
      <legend>Repeat</legend>
      <select name="frequency" value={frequency} onChange={(event) => setFrequency(event.target.value as RepeatFrequency)}>
        <option value="none">No Repeat</option>
        <option value="daily">Daily</option>
        <option value="weekly">Weekly</option>
        <option value="monthly">Monthly</option>
        <option value="yearly">Yearly</option>
      </select>
      {frequency !== 'none' && (
        <>
          <div className="form-grid">
            <label className="field">
              <span>Every</span>
              <input defaultValue="1" min="1" name="interval" type="number" />
            </label>
            <label className="field">
              <span>Occurrences</span>
              <input min="1" name="count" placeholder="Optional" type="number" />
            </label>
          </div>
          <label className="field">
            <span>End By (Optional)</span>
            <input name="until" type="date" />
          </label>
          {(frequency === 'daily' || frequency === 'weekly') && (
            <div className="weekday-grid" aria-label="Repeat weekdays">
              {weekdayOptions.map((day) => (
                <label key={day.value}>
                  <input name="weekdays" type="checkbox" value={day.value} />
                  <span>{day.label}</span>
                </label>
              ))}
            </div>
          )}
          {frequency === 'monthly' && (
            <div className="month-grid" aria-label="Repeat months">
              {monthOptions.map((month) => (
                <label key={month.value}>
                  <input name="months" type="checkbox" value={month.value} />
                  <span>{month.label}</span>
                </label>
              ))}
            </div>
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
      <select aria-label={`${name} minute`} value={minute} onChange={(event) => onMinuteChange(event.target.value)}>
        <option value="00">00</option>
        <option value="30">30</option>
      </select>
      <select aria-label={`${name} meridiem`} value={meridiem} onChange={(event) => onMeridiemChange(event.target.value as 'AM' | 'PM')}>
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </fieldset>
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
    color: event?.color ?? eventColors[0]
  };
}

function toTaskDraft(start: Date): TaskDraft {
  const end = addMinutes(start, 30);
  return {
    title: '',
    notes: '',
    hasStartTime: false,
    startDate: format(start, 'yyyy-MM-dd'),
    startHour: format(start, 'h'),
    startMinute: Number(format(start, 'm')) >= 30 ? '30' : '00',
    startMeridiem: format(start, 'a') as 'AM' | 'PM',
    endDate: format(end, 'yyyy-MM-dd'),
    endHour: format(end, 'h'),
    endMinute: Number(format(end, 'm')) >= 30 ? '30' : '00',
    endMeridiem: format(end, 'a') as 'AM' | 'PM',
    allDay: false,
    priority: 'normal'
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

function buildRecurrenceFromForm(form: FormData): string | undefined {
  const frequency = String(form.get('frequency')) as RepeatFrequency | 'none';
  if (frequency === 'none') return undefined;

  const countValue = String(form.get('count') || '');
  const untilValue = String(form.get('until') || '');
  const weekdays = form.getAll('weekdays').map(String) as Array<'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU'>;
  const months = form.getAll('months').map((month) => Number(month)).filter((month) => month >= 1 && month <= 12);

  return createCustomRecurrenceRule({
    frequency,
    interval: Math.max(1, Number(form.get('interval') || 1)),
    count: countValue ? Number(countValue) : undefined,
    until: untilValue ? new Date(`${untilValue}T23:59:59`) : undefined,
    weekdays: (frequency === 'daily' || frequency === 'weekly') && weekdays.length > 0 ? weekdays : undefined,
    months: frequency === 'monthly' && months.length > 0 ? months : undefined
  });
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
