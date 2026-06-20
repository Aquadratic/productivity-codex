import '@fullcalendar/core/index.js';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin, { DateClickArg } from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import { addMinutes, format, parseISO, setHours, setMinutes } from 'date-fns';
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
import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { CalendarEvent, Task, TimerMode, UpcomingRange } from '../shared/types';
import { createCustomRecurrenceRule } from '../shared/recurrence';
import { validateEventTime } from '../shared/events';
import { getSoundChoice, soundChoices } from '../shared/sounds';
import { formatTimer, getTimerSnapshot } from '../shared/timer';
import { getTaskListItems, getUpcomingItems, type PlannerListItem } from '../shared/selectors';
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
  startDate: string;
  start: string;
  endDate: string;
  end: string;
};

type RepeatFrequency = 'none' | 'daily' | 'weekly' | 'monthly';

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
  const upcoming = useMemo(() => getUpcomingItems(planner.state, new Date(), range), [planner.state, range]);

  return (
    <div className="view-stack dashboard-view">
      <header className="view-header">
        <div>
          <p className="eyebrow">{format(new Date(), 'EEEE, MMM d')}</p>
          <h2>Dashboard</h2>
        </div>
        <button className="primary-action" onClick={() => planner.setView('timer')} type="button">
          <Play size={18} />
          Start focus
        </button>
      </header>
      <div className="dashboard-grid">
        <MetricCard label="Events today" value={todaysEvents.length} />
        <MetricCard label="Tasks today" value={todaysTasks.length} />
        <MetricCard label="Upcoming" value={upcoming.length} />
        <ListPanel title="Today" detail="Schedule and task list" empty="Nothing due today.">
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
              aria-label="Upcoming range"
              className="compact-select"
              value={range}
              onChange={(event) => setRange(event.target.value as UpcomingRange)}
            >
              <option value="all">All upcoming</option>
              <option value="today">Today</option>
              <option value="7days">7 days</option>
              <option value="30days">30 days</option>
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

  const openDraft = (start: Date, end?: Date) => {
    setDraft(toDraft(start, end ?? addMinutes(start, 15)));
    setDrawerOpen(true);
  };

  const handleDateClick = (arg: DateClickArg) => openDraft(arg.date);

  return (
    <div className="view-stack full-height-view">
      <header className="view-header">
        <div>
          <p className="eyebrow">Calendar</p>
          <h2>Plan by time</h2>
        </div>
        <button className="primary-action" onClick={() => { setDraft(toDraft(new Date())); setDrawerOpen(true); }} type="button">
          <CalendarDays size={18} />
          New event
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
            events={planner.calendarEvents}
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
            slotDuration="00:15:00"
            snapDuration="00:15:00"
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
          <div className="drawer-backdrop" role="presentation">
            <EventForm draft={draft} planner={planner} onClose={() => setDrawerOpen(false)} />
          </div>
        )}
      </div>
    </div>
  );
}

function TasksView({ planner }: { planner: ReturnType<typeof usePlanner> }) {
  const [filter, setFilter] = useState<'today' | 'upcoming' | 'overdue' | 'completed'>('today');
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const items = useMemo(() => getTaskListItems(planner.state, filter), [filter, planner.state]);

  return (
    <div className="view-stack full-height-view">
      <header className="view-header">
        <div>
          <p className="eyebrow">Tasks</p>
          <h2>Work queue</h2>
        </div>
        <div className="header-actions">
          <SegmentedControl options={['today', 'upcoming', 'overdue', 'completed']} value={filter} onChange={(value) => setFilter(value as typeof filter)} />
          <button className="primary-action" onClick={() => setTaskFormOpen(true)} type="button">
            <ListTodo size={18} />
            Add task
          </button>
        </div>
      </header>
      <div className="task-layout single">
        <ListPanel
          title={planner.state.settings.showCalendarEventsInTasks ? 'Tasks and calendar events' : 'Tasks'}
          detail={planner.state.settings.showCalendarEventsInTasks ? 'Events can be checked off here without becoming tasks.' : 'Calendar events are hidden here.'}
          empty="Nothing in this list."
        >
          {items.map((item) => (
            <PlannerItemRow item={item} key={`${item.kind}-${item.id}`} planner={planner} />
          ))}
        </ListPanel>
        {taskFormOpen && (
          <div className="drawer-backdrop" role="presentation">
            <TaskForm planner={planner} onClose={() => setTaskFormOpen(false)} />
          </div>
        )}
      </div>
    </div>
  );
}

function TimerView({ planner }: { planner: ReturnType<typeof usePlanner> }) {
  const [mode, setMode] = useState<TimerMode>('focus');
  const [minutes, setMinutesValue] = useState(25);
  const [now, setNow] = useState(Date.now());
  const snapshot = planner.activeTimer ? getTimerSnapshot(planner.activeTimer, now) : undefined;
  const settings = planner.state.settings;

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
      playSound(settings.timerCompleteSound, settings.soundVolume);
    }
  }, [planner.completedTimer, settings.soundsEnabled, settings.soundVolume, settings.timerCompleteSound]);

  if (planner.completedTimer) {
    return (
      <div className="timer-screen">
        <section className="panel timer-panel completion-screen">
          <p className="eyebrow">Timer complete</p>
          <h2>{planner.completedTimer.mode === 'focus' ? 'Focus session finished' : 'Break finished'}</h2>
          <div className="timer-display">{formatTimer(planner.completedTimer.durationSeconds)}</div>
          <p className="timer-meta">Nice work. Choose another sound, preview it, or start another session.</p>
          <SoundControls planner={planner} />
          <div className="timer-actions">
            <button className="secondary-action" onClick={planner.dismissCompletedTimer} type="button">
              <X size={18} />
              Close
            </button>
            <button className="primary-action" onClick={() => { planner.dismissCompletedTimer(); planner.startTimer(mode, minutes); }} type="button">
              <Play size={18} />
              Start another
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
        <h2>{planner.activeTimer ? `${planner.activeTimer.mode === 'focus' ? 'Focus' : 'Break'} session` : 'Choose a session'}</h2>
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
            <label className="field">
              <span>Minutes</span>
              <input min="1" max="180" type="number" value={minutes} onChange={(event) => setMinutesValue(Number(event.target.value))} />
            </label>
            <SoundControls planner={planner} />
            <button className="primary-action" onClick={() => planner.startTimer(mode, minutes)} type="button">
              <Play size={18} />
              Start timer
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
    <div className="view-stack">
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
          <span><Clock3 size={18} /> Start with Windows</span>
          <input
            checked={settings.autostartEnabled}
            onChange={(event) => planner.updateSettings({ ...settings, autostartEnabled: event.target.checked })}
            type="checkbox"
          />
        </label>
        <label className="toggle-row">
          <span><ListTodo size={18} /> Show calendar events in Tasks</span>
          <input
            checked={settings.showCalendarEventsInTasks}
            onChange={(event) => planner.updateSettings({ ...settings, showCalendarEventsInTasks: event.target.checked })}
            type="checkbox"
          />
        </label>
        <SoundControls planner={planner} />
        <label className="field">
          <span>Default reminder minutes</span>
          <input
            min="0"
            type="number"
            value={settings.defaultReminderMinutes}
            onChange={(event) => planner.updateSettings({ ...settings, defaultReminderMinutes: Number(event.target.value) })}
          />
        </label>
        <button className="danger-action" onClick={planner.resetPlanner} type="button">
          <RotateCcw size={18} />
          Reset test data
        </button>
      </section>
    </div>
  );
}

function EventForm({ draft, planner, onClose }: { draft: EventDraft; planner: ReturnType<typeof usePlanner>; onClose: () => void }) {
  const [error, setError] = useState<string>();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const startsAt = new Date(`${String(form.get('startDate'))}T${String(form.get('start'))}`).toISOString();
    const endsAt = new Date(`${String(form.get('endDate'))}T${String(form.get('end'))}`).toISOString();
    const validationError = validateEventTime({ startsAt, endsAt });

    if (validationError) {
      setError(validationError);
      return;
    }

    planner.addEvent({
      title: String(form.get('title')),
      notes: String(form.get('notes')),
      startsAt,
      endsAt,
      allDay: false,
      importance: form.get('important') ? 'important' : 'normal',
      recurrenceRule: buildRecurrenceFromForm(form),
      reminders: [{ minutesBefore: planner.state.settings.defaultReminderMinutes }],
      completedOccurrences: []
    });
    onClose();
  };

  return (
    <form className="panel form-panel drawer-panel" onSubmit={submit}>
      <DrawerHeader title="New event" detail="Use 15-minute slots, multi-day times, and custom repeats." onClose={onClose} />
      <input name="title" placeholder="Event title" required />
      <div className="form-grid">
        <label className="field">
          <span>Start date</span>
          <input key={`start-date-${draft.startDate}`} defaultValue={draft.startDate} name="startDate" type="date" required />
        </label>
        <label className="field">
          <span>Start time</span>
          <input key={`start-${draft.start}`} defaultValue={draft.start} name="start" step="900" type="time" required />
        </label>
      </div>
      <div className="form-grid">
        <label className="field">
          <span>End date</span>
          <input key={`end-date-${draft.endDate}`} defaultValue={draft.endDate} name="endDate" type="date" required />
        </label>
        <label className="field">
          <span>End time</span>
          <input key={`end-${draft.end}`} defaultValue={draft.end} name="end" step="900" type="time" required />
        </label>
      </div>
      <RecurrenceFields />
      <textarea name="notes" placeholder="Notes" />
      <label className="checkbox-row">
        <input name="important" type="checkbox" />
        <span>Important</span>
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="primary-action" type="submit">Add event</button>
    </form>
  );
}

function TaskForm({ planner, onClose }: { planner: ReturnType<typeof usePlanner>; onClose: () => void }) {
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const date = String(form.get('date'));
    const time = String(form.get('time'));
    planner.addTask({
      title: String(form.get('title')),
      notes: String(form.get('notes')),
      priority: String(form.get('priority')) as Task['priority'],
      dueAt: date ? setMinutes(setHours(new Date(`${date}T00:00:00`), Number(time.slice(0, 2))), Number(time.slice(3, 5))).toISOString() : undefined,
      recurrenceRule: buildRecurrenceFromForm(form),
      reminders: [{ minutesBefore: planner.state.settings.defaultReminderMinutes }]
    });
    onClose();
  };

  return (
    <form className="panel form-panel drawer-panel" onSubmit={submit}>
      <DrawerHeader title="New task" detail="Capture the next clear action." onClose={onClose} />
      <input name="title" placeholder="Task title" required />
      <div className="form-grid">
        <input defaultValue={format(new Date(), 'yyyy-MM-dd')} name="date" type="date" />
        <input defaultValue="09:00" name="time" step="900" type="time" />
      </div>
      <select defaultValue="normal" name="priority">
        <option value="low">Low</option>
        <option value="normal">Normal</option>
        <option value="high">High</option>
      </select>
      <RecurrenceFields />
      <textarea name="notes" placeholder="Notes" />
      <button className="primary-action" type="submit">Add task</button>
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
    <div className={`list-row ${item.kind} ${item.completed ? 'completed' : ''}`}>
      <button
        aria-label={item.completed ? `Mark ${item.title} incomplete` : `Mark ${item.title} complete`}
        className="icon-action"
        onClick={toggle}
        title={item.completed ? 'Mark incomplete' : 'Mark complete'}
        type="button"
      >
        {item.completed ? <RotateCcw size={16} /> : <Check size={16} />}
      </button>
      <div className="item-main">
        <strong>{item.title}</strong>
        <span>{when ? format(parseISO(when), 'MMM d, h:mm a') : 'No due date'}</span>
      </div>
      <small>{item.kind === 'task' ? item.priority : item.importance}</small>
      {item.kind === 'event' && item.importance === 'important' && <Star size={16} />}
      <button className="icon-action" onClick={() => item.kind === 'task' ? planner.deleteTask(item.id) : planner.deleteEvent(item.id)} title={item.kind === 'task' ? 'Delete task' : 'Delete event'} type="button"><Trash2 size={16} /></button>
    </div>
  );
}

function SoundControls({ planner }: { planner: ReturnType<typeof usePlanner> }) {
  const settings = planner.state.settings;

  return (
    <div className="sound-controls">
      <label className="toggle-row">
        <span><Volume2 size={18} /> Timer sounds</span>
        <input
          checked={settings.soundsEnabled}
          onChange={(event) => planner.updateSettings({ ...settings, soundsEnabled: event.target.checked })}
          type="checkbox"
        />
      </label>
      <div className="form-grid">
        <select
          aria-label="Timer completion sound"
          value={settings.timerCompleteSound}
          onChange={(event) => planner.updateSettings({ ...settings, timerCompleteSound: event.target.value })}
        >
          {soundChoices.map((sound) => <option key={sound.id} value={sound.id}>{sound.label}</option>)}
        </select>
        <button className="secondary-action" onClick={() => playSound(settings.timerCompleteSound, settings.soundVolume)} type="button">
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

function RecurrenceFields() {
  const [frequency, setFrequency] = useState<RepeatFrequency>('none');

  return (
    <fieldset className="recurrence-box">
      <legend>Repeat</legend>
      <select name="frequency" value={frequency} onChange={(event) => setFrequency(event.target.value as RepeatFrequency)}>
        <option value="none">No repeat</option>
        <option value="daily">Daily</option>
        <option value="weekly">Weekly</option>
        <option value="monthly">Monthly</option>
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
            <span>End by</span>
            <input name="until" type="date" />
          </label>
          {frequency === 'weekly' && (
            <div className="weekday-grid" aria-label="Repeat weekdays">
              {weekdayOptions.map((day) => (
                <label key={day.value}>
                  <input name="weekdays" type="checkbox" value={day.value} />
                  <span>{day.label}</span>
                </label>
              ))}
            </div>
          )}
        </>
      )}
    </fieldset>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <section className="panel metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </section>
  );
}

function ListPanel({ title, detail, empty, action, children }: { title: string; detail: string; empty: string; action?: React.ReactNode; children: React.ReactNode }) {
  const childArray = Array.isArray(children) ? children : [children];
  const [expanded, setExpanded] = useState(false);

  return (
    <section className={`panel feature-panel ${expanded ? 'expanded-list' : ''}`}>
      <div className="panel-title-row">
        <PanelTitle title={title} detail={detail} />
        <div className="panel-actions">
          {action}
          <button className="icon-action" onClick={() => setExpanded((current) => !current)} title={expanded ? 'Collapse list' : 'Expand list'} type="button">
            <ChevronDown className={expanded ? 'rotate-icon' : ''} size={18} />
          </button>
        </div>
      </div>
      <div className="item-list">{childArray.length === 0 ? <p className="empty-state">{empty}</p> : children}</div>
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

function toDraft(start: Date, end = addMinutes(start, 15)): EventDraft {
  return {
    startDate: format(start, 'yyyy-MM-dd'),
    start: format(start, 'HH:mm'),
    endDate: format(end, 'yyyy-MM-dd'),
    end: format(end, 'HH:mm')
  };
}

function buildRecurrenceFromForm(form: FormData): string | undefined {
  const frequency = String(form.get('frequency')) as RepeatFrequency;
  if (frequency === 'none') return undefined;

  const countValue = String(form.get('count') || '');
  const untilValue = String(form.get('until') || '');
  const weekdays = form.getAll('weekdays').map(String) as Array<'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU'>;

  return createCustomRecurrenceRule({
    frequency,
    interval: Math.max(1, Number(form.get('interval') || 1)),
    count: countValue ? Number(countValue) : undefined,
    until: untilValue ? new Date(`${untilValue}T23:59:59`) : undefined,
    weekdays: frequency === 'weekly' && weekdays.length > 0 ? weekdays : undefined
  });
}

function playSound(soundId: string, volume: number): void {
  const audio = new Audio(getSoundChoice(soundId).src);
  audio.volume = volume;
  const playback = audio.play();
  if (playback) {
    playback.catch(() => undefined);
  }
}
