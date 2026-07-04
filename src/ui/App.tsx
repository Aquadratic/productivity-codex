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
  Download,
  Pencil,
  GripHorizontal,
  LayoutDashboard,
  ListTodo,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  RotateCcw,
  Settings,
  Sparkles,
  Square,
  Star,
  Trash2,
  Upload,
  Volume2,
  X
} from 'lucide-react';
import { FormEvent, useEffect, useMemo, useRef, useState, type CSSProperties, type Dispatch, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject, type SetStateAction } from 'react';
import {
  darkThemeColors,
  lightThemeColors,
  type AppSettings,
  type CalendarEvent,
  type Importance,
  type RepeatFrequency,
  type Task,
  type ThemeColors,
  type TimerMode,
  type UpcomingRange
} from '../shared/types';
import { createCustomRecurrenceRule, parseRecurrenceRule, type RecurrenceDraft } from '../shared/recurrence';
import { isEventOccurrenceCompleted, validateEventTime } from '../shared/events';
import { getSoundChoice, soundChoices } from '../shared/sounds';
import { buildPlannerExport, buildPlannerExportFilename, parsePlannerExport } from '../shared/export';
import { durationPartsToSeconds, formatTimer, getTimerSnapshot, isValidTimerDuration, secondsToDurationParts } from '../shared/timer';
import { getCalendarViewEvents, getTaskListGroups, getUpcomingItems, type PlannerFilter, type PlannerListItem } from '../shared/selectors';
import { isTaskOccurrenceCompleted } from '../shared/tasks';
import { buildThemeVariables, calendarClickRange, wrapMinute } from '../shared/uiHelpers';
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
  color: string;
  recurrence: RecurrenceDraft;
};

type DrawerMode = 'choice' | 'eventDetails' | 'taskDetails' | 'eventForm' | 'taskForm';
type PendingSelection = { start: Date; end: Date; allDay?: boolean };
type UndoState = {
  kind: 'event' | 'task';
  id: string;
  previous: { startsAt?: string; endsAt: string; dueAt?: string; allDay: boolean };
};

type CalendarPointerSelection = PendingSelection & { mode: 'hover' | 'press' | 'drag' };
type CalendarHitBounds = { left: number; top: number; width: number; height: number };
type CalendarHitTarget = {
  date: string;
  kind: 'box' | 'line';
  left: number;
  time: string;
  top: number;
  width: number;
  height: number;
};

const eventColors = ['#2f5597', '#4d63a6', '#5578a6', '#8f4d32', '#7b4fa3'];
const themeColorFields: Array<{ key: keyof ThemeColors; label: string }> = [
  { key: 'taskDefault', label: 'Task Default' },
  { key: 'eventDefault', label: 'Event Default' }
];

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
  const settings = planner.state.settings;
  const [taskDefaultSignal, setTaskDefaultSignal] = useState(0);
  const navigate = (view: View) => {
    if (view === 'tasks') setTaskDefaultSignal((value) => value + 1);
    planner.setView(view);
  };

  return (
    <main className={settings.sidebarCollapsed ? 'app-shell sidebar-collapsed' : 'app-shell'} style={buildThemeVariables(settings) as CSSProperties}>
      <aside className="sidebar">
        <button
          aria-label={settings.sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          className="icon-action sidebar-toggle"
          onClick={() => planner.updateSettings({ ...settings, sidebarCollapsed: !settings.sidebarCollapsed })}
          title={settings.sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          type="button"
        >
          {settings.sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
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
                onClick={() => navigate(item.view)}
                title={item.label}
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
            {planner.view === 'tasks' && <TasksView planner={planner} defaultSignal={taskDefaultSignal} />}
            {planner.view === 'timer' && <TimerView planner={planner} />}
            {planner.view === 'settings' && <SettingsView planner={planner} />}
          </>
        )}
      </section>
      <nav className="mobile-nav" aria-label="Mobile Navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              className={planner.view === item.view ? 'mobile-nav-button active' : 'mobile-nav-button'}
              key={item.view}
              onClick={() => navigate(item.view)}
              title={item.label}
              type="button"
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </main>
  );
}

function Dashboard({ planner }: { planner: ReturnType<typeof usePlanner> }) {
  const todaysEvents = planner.todayItems.filter((item) => item.kind === 'event');
  const todaysTasks = planner.todayItems.filter((item) => item.kind === 'task');
  const [range, setRange] = useState<UpcomingRange>(planner.state.settings.upcomingRange);
  const [now, setNow] = useState(new Date());
  const [drawerMode, setDrawerMode] = useState<DrawerMode>();
  const [selectedTaskId, setSelectedTaskId] = useState<string>();
  const [selectedTaskOccurrenceKey, setSelectedTaskOccurrenceKey] = useState<string>();
  const [selectedEventId, setSelectedEventId] = useState<string>();
  const [selectedEventOccurrenceKey, setSelectedEventOccurrenceKey] = useState<string>();
  const [eventDraft, setEventDraft] = useState<EventDraft>(() => toDraft(new Date(), undefined, undefined, planner.state.settings.themeColors.eventDefault));
  const [taskDraft, setTaskDraft] = useState<TaskDraft>(() => toTaskDraft(new Date(), undefined, planner.state.settings.themeColors.taskDefault));
  const upcoming = useMemo(() => getUpcomingItems(planner.state, new Date(), range), [planner.state, range]);
  const selectedTask = planner.state.tasks.find((task) => task.id === selectedTaskId);
  const selectedEvent = planner.state.events.find((event) => event.id === selectedEventId);

  const openItemDetails = (item: PlannerListItem) => {
    if (item.kind === 'task') {
      const task = item.source as Task;
      setSelectedTaskId(task.id);
      setSelectedTaskOccurrenceKey(item.occurrenceKey);
      setSelectedEventId(undefined);
      setSelectedEventOccurrenceKey(undefined);
      setTaskDraft(toTaskDraftFromTask(task, planner.state.settings.themeColors.taskDefault));
      setDrawerMode('taskDetails');
      return;
    }

    const event = item.source as CalendarEvent;
    setSelectedEventId(event.id);
    setSelectedEventOccurrenceKey(item.occurrenceKey ?? item.startsAt);
    setSelectedTaskId(undefined);
    setSelectedTaskOccurrenceKey(undefined);
    setEventDraft(toDraft(parseISO(event.startsAt), parseISO(event.endsAt), event, planner.state.settings.themeColors.eventDefault));
    setDrawerMode('eventDetails');
  };

  const openItemEdit = (item: PlannerListItem) => {
    openItemDetails(item);
    setDrawerMode(item.kind === 'task' ? 'taskForm' : 'eventForm');
  };

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
        <div className="dashboard-header-actions">
          <span className="current-time-chip" aria-label="Current Time">{format(now, 'h:mm:ss a')}</span>
          <button className="primary-action" onClick={() => planner.setView('timer')} type="button">
            <Play size={18} />
            Start Focus
          </button>
        </div>
      </header>
      <div className="dashboard-grid">
        <MetricCard label="Events Today" value={todaysEvents.length} />
        <MetricCard label="Tasks Today" value={todaysTasks.length} />
        <MetricCard label="Upcoming" value={upcoming.length} />
        <ListPanel title="Today" detail="Schedule And Task List" empty="Nothing due today." roomy>
          {planner.todayItems.map((item) => (
            <PlannerItemRow item={item} key={`${item.kind}-${item.id}`} planner={planner} onEdit={() => openItemEdit(item)} onOpen={() => openItemDetails(item)} />
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
            <PlannerItemRow item={item} key={`${item.kind}-${item.id}`} planner={planner} onEdit={() => openItemEdit(item)} onOpen={() => openItemDetails(item)} />
          ))}
        </ListPanel>
      </div>
      {drawerMode && (
        <div className="drawer-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setDrawerMode(undefined);
        }}>
          <DraggablePanel planner={planner}>
            {drawerMode === 'eventDetails' && selectedEvent && (
              <DetailsDrawer
                item={selectedEvent}
                kind="event"
                completed={isEventOccurrenceCompleted(selectedEvent, selectedEventOccurrenceKey)}
                onClose={() => setDrawerMode(undefined)}
                onEdit={() => setDrawerMode('eventForm')}
                onDelete={() => { planner.deleteEvent(selectedEvent.id); setDrawerMode(undefined); }}
                onToggle={() => planner.toggleEvent(selectedEvent, selectedEventOccurrenceKey)}
              />
            )}
            {drawerMode === 'taskDetails' && selectedTask && (
              <DetailsDrawer
                item={selectedTask}
                kind="task"
                completed={selectedTaskOccurrenceKey ? isTaskOccurrenceCompleted(selectedTask, selectedTaskOccurrenceKey) : selectedTask.status === 'completed'}
                onClose={() => setDrawerMode(undefined)}
                onEdit={() => setDrawerMode('taskForm')}
                onDelete={() => {
                  if (selectedTaskOccurrenceKey && selectedTask.recurrenceRule && selectedTask.completedOccurrences.some((record) => record.occurrenceKey === selectedTaskOccurrenceKey)) {
                    planner.updateTask(selectedTask.id, {
                      completedOccurrences: selectedTask.completedOccurrences.filter((record) => record.occurrenceKey !== selectedTaskOccurrenceKey)
                    });
                  } else {
                    planner.deleteTask(selectedTask.id);
                  }
                  setDrawerMode(undefined);
                }}
                onToggle={() => planner.toggleTask(selectedTask, selectedTaskOccurrenceKey)}
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
                  setSelectedTaskOccurrenceKey(undefined);
                }}
              />
            )}
            {drawerMode === 'eventForm' && (
              <EventForm
                draft={eventDraft}
                editingEventId={selectedEventId}
                planner={planner}
                onChange={setEventDraft}
                onClose={() => setDrawerMode(undefined)}
                onSaved={() => {
                  setDrawerMode(undefined);
                  setSelectedEventId(undefined);
                }}
              />
            )}
          </DraggablePanel>
        </div>
      )}
    </div>
  );
}

function CalendarView({ planner }: { planner: ReturnType<typeof usePlanner> }) {
  const calendarPanelRef = useRef<HTMLElement>(null);
  const [draft, setDraft] = useState<EventDraft>(() => toDraft(new Date(), undefined, undefined, planner.state.settings.themeColors.eventDefault));
  const [taskDraft, setTaskDraft] = useState<TaskDraft>(() => toTaskDraft(new Date(), undefined, planner.state.settings.themeColors.taskDefault));
  const [drawerMode, setDrawerMode] = useState<DrawerMode>();
  const [editingEventId, setEditingEventId] = useState<string>();
  const [editingEventOccurrenceKey, setEditingEventOccurrenceKey] = useState<string>();
  const [selectedTaskId, setSelectedTaskId] = useState<string>();
  const [selectedTaskOccurrenceKey, setSelectedTaskOccurrenceKey] = useState<string>();
  const [pendingSelection, setPendingSelection] = useState<PendingSelection>(() => ({ start: new Date(), end: addMinutes(new Date(), 60) }));
  const [calendarRange, setCalendarRange] = useState(() => ({ start: subDays(new Date(), 30), end: addDays(new Date(), 60) }));
  const [calendarViewType, setCalendarViewType] = useState('timeGridWeek');
  const [pointerSelection, setPointerSelection] = useState<CalendarPointerSelection>();
  const [hitBounds, setHitBounds] = useState<CalendarHitBounds>();
  const [undo, setUndo] = useState<UndoState>();
  const settings = planner.state.settings;

  const openChoice = (start: Date, end?: Date, allDay = false) => {
    const selection = { start, end: end ?? addMinutes(start, 60), allDay };
    setPendingSelection(selection);
    setDraft(toDraft(selection.start, selection.end, undefined, settings.themeColors.eventDefault));
    setTaskDraft(toTaskDraft(selection.start, selection.end, settings.themeColors.taskDefault, allDay));
    setEditingEventId(undefined);
    setEditingEventOccurrenceKey(undefined);
    setSelectedTaskId(undefined);
    setSelectedTaskOccurrenceKey(undefined);
    setDrawerMode('choice');
  };

  const openExisting = (id: string, occurrenceKey?: string) => {
    const event = planner.state.events.find((candidate) => candidate.id === id);
    if (!event) return;
    setDraft(toDraft(parseISO(event.startsAt), parseISO(event.endsAt), event, settings.themeColors.eventDefault));
    setEditingEventId(id);
    setEditingEventOccurrenceKey(occurrenceKey ?? event.startsAt);
    setSelectedTaskId(undefined);
    setSelectedTaskOccurrenceKey(undefined);
    setDrawerMode('eventDetails');
  };

  const openTaskDetails = (id: string, occurrenceKey?: string) => {
    const task = planner.state.tasks.find((candidate) => candidate.id === id);
    if (!task) return;
    setTaskDraft(toTaskDraftFromTask(task, settings.themeColors.taskDefault));
    setSelectedTaskId(id);
    setSelectedTaskOccurrenceKey(occurrenceKey);
    setEditingEventId(undefined);
    setDrawerMode('taskDetails');
  };

  const handleDateClick = (arg: DateClickArg) => {
    const clickTarget = arg.jsEvent.target;
    if (
      clickTarget instanceof Element &&
      clickTarget.closest('.fc-event, .fc-more-link, .fc-popover, .fc-toolbar, .fc-button')
    ) {
      return;
    }

    if (arg.view.type === 'dayGridMonth') {
      const now = new Date();
      const start = new Date(arg.date);
      start.setHours(now.getHours(), now.getMinutes(), 0, 0);
      openChoice(start, addMinutes(start, 60));
      return;
    }

    if (arg.view.type === 'timeGridWeek' || arg.view.type === 'timeGridDay') {
      if (arg.allDay) {
        openChoice(arg.date, addMinutes(arg.date, 60), true);
        return;
      }

      const panel = calendarPanelRef.current;
      const slots = Array.from(panel?.querySelectorAll<HTMLElement>('.fc-timegrid-slot-lane[data-time]') ?? []);
      const columns = Array.from(panel?.querySelectorAll<HTMLElement>('.fc-timegrid-col[data-date]') ?? []);
      const slotFromTarget = clickTarget instanceof Element
        ? clickTarget.closest<HTMLElement>('.fc-timegrid-slot-lane[data-time]')
        : undefined;
      const slotFromPoint = document.elementsFromPoint(arg.jsEvent.clientX, arg.jsEvent.clientY)
        .find((element): element is HTMLElement => element instanceof HTMLElement && element.matches('.fc-timegrid-slot-lane[data-time]'));
      const slot = slotFromTarget ?? slotFromPoint;
      if (!slot?.dataset.time) return;
      const column = columns.find((candidate) => {
        const rect = candidate.getBoundingClientRect();
        return arg.jsEvent.clientX >= rect.left && arg.jsEvent.clientX <= rect.right && arg.jsEvent.clientY >= rect.top && arg.jsEvent.clientY <= rect.bottom;
      });
      if (!column?.dataset.date) return;
      const slotRect = slot.getBoundingClientRect();
      if (
        arg.jsEvent.clientX < slotRect.left ||
        arg.jsEvent.clientX > slotRect.right ||
        arg.jsEvent.clientY < slotRect.top ||
        arg.jsEvent.clientY > slotRect.bottom
      ) {
        return;
      }

      const nearestLineSlot = slots.reduce<{ slot: HTMLElement; distance: number } | undefined>((nearest, candidate) => {
        const distance = Math.abs(arg.jsEvent.clientY - candidate.getBoundingClientRect().top);
        return !nearest || distance < nearest.distance ? { slot: candidate, distance } : nearest;
      }, undefined);
      const lineThreshold = 8;
      const lineSlot = nearestLineSlot && nearestLineSlot.distance <= lineThreshold ? nearestLineSlot.slot : undefined;
      const time = lineSlot?.dataset.time ?? slot.dataset.time;
      const startsAt = new Date(`${column.dataset.date}T${time}`);
      const range = calendarClickRange(startsAt, Boolean(lineSlot));
      openChoice(range.start, range.end);
    }
  };

  const handleEventClick = (arg: EventClickArg) => {
    const props = arg.event.extendedProps as { kind?: 'event' | 'task'; sourceId?: string; occurrenceAt?: string };
    if (props.kind === 'task' && props.sourceId) {
      openTaskDetails(props.sourceId, props.occurrenceAt);
    } else if (props.sourceId) {
      openExisting(props.sourceId, props.occurrenceAt);
    }
  };

  const calendarItems = useMemo(
    () => getCalendarViewEvents(planner.state, calendarRange.start, calendarRange.end),
    [calendarRange.end, calendarRange.start, planner.state]
  );

  const previewEvents = useMemo(() => {
    const selectionPreview = pointerSelection ?? (drawerMode === 'choice' ? { ...pendingSelection, mode: 'press' as const } : undefined);
    const basePreview = selectionPreview
      ? [
        ...calendarItems,
        {
          id: 'selection-preview',
          title: 'New Event',
          start: selectionPreview.start.toISOString(),
          end: selectionPreview.end.toISOString(),
          allDay: Boolean(selectionPreview.allDay),
          classNames: ['draft-preview-event', `preview-${selectionPreview.mode}`],
          display: 'background',
          backgroundColor: settings.themeColors.eventDefault,
          borderColor: settings.themeColors.eventDefault,
          extendedProps: { importance: 'normal' as const, notes: '', kind: 'event' as const, sourceId: 'selection-preview' }
        }
      ]
      : calendarItems;

    if (drawerMode !== 'eventForm') return basePreview;
    if (editingEventId) {
      const original = planner.state.events.find((event) => event.id === editingEventId);
      if (
        original &&
        original.startsAt === new Date(`${draft.startDate}T${draft.start}`).toISOString() &&
        original.endsAt === new Date(`${draft.endDate}T${draft.end}`).toISOString() &&
        original.allDay === draft.allDay
      ) {
        return basePreview;
      }
    }
    const previewStart = new Date(`${draft.startDate}T${draft.start}`);
    const previewEnd = new Date(`${draft.endDate}T${draft.end}`);
    if (Number.isNaN(previewStart.getTime()) || Number.isNaN(previewEnd.getTime())) {
      return basePreview;
    }
    return [
      ...basePreview,
      {
        id: 'draft-preview',
        title: draft.title || 'New Event',
        start: previewStart.toISOString(),
        end: previewEnd.toISOString(),
        allDay: draft.allDay,
        classNames: ['draft-preview-event'],
        display: 'background',
        backgroundColor: draft.color,
        borderColor: draft.color,
        extendedProps: { importance: draft.importance, notes: draft.notes, kind: 'event' as const, sourceId: 'draft-preview' }
      }
    ];
  }, [calendarItems, draft, drawerMode, editingEventId, pendingSelection, planner.state.events, pointerSelection, settings.themeColors.eventDefault]);

  const updateDroppedItem = (arg: any) => {
    const props = arg.event.extendedProps as { kind?: 'event' | 'task'; sourceId?: string; occurrenceAt?: string; completed?: boolean };
    const sourceId = props.sourceId;
    if (!props.kind || !sourceId || !arg.event.start || !arg.event.end) return;

    if (props.kind === 'event') {
      const event = planner.state.events.find((candidate) => candidate.id === sourceId);
      if (!event) return;
      setUndo({ kind: 'event', id: sourceId, previous: { startsAt: event.startsAt, endsAt: event.endsAt, allDay: event.allDay } });
      const completedOccurrences = props.completed && props.occurrenceAt
        ? event.completedOccurrences.map((record) => (
          record.occurrenceKey === props.occurrenceAt
            ? { ...record, occurrenceKey: arg.event.start!.toISOString() }
            : record
        ))
        : event.completedOccurrences;
      planner.updateEvent(sourceId, {
        startsAt: arg.event.start.toISOString(),
        endsAt: arg.event.end.toISOString(),
        allDay: arg.event.allDay,
        completedOccurrences
      });
    } else {
      const task = planner.state.tasks.find((candidate) => candidate.id === sourceId);
      if (!task) return;
      setUndo({ kind: 'task', id: sourceId, previous: { startsAt: task.startsAt, endsAt: task.endsAt ?? arg.event.end.toISOString(), dueAt: task.dueAt, allDay: task.allDay } });
      const completedOccurrences = props.completed && props.occurrenceAt
        ? task.completedOccurrences.map((record) => (
          record.occurrenceKey === props.occurrenceAt
            ? { ...record, occurrenceKey: arg.event.end!.toISOString() }
            : record
        ))
        : task.completedOccurrences;
      planner.updateTask(sourceId, {
        startsAt: task.startsAt ? arg.event.start.toISOString() : undefined,
        endsAt: arg.event.end.toISOString(),
        dueAt: arg.event.end.toISOString(),
        allDay: arg.event.allDay,
        completedOccurrences
      });
    }
  };

  useEffect(() => {
    if (!undo) return undefined;
    const timeout = window.setTimeout(() => setUndo(undefined), 8000);
    return () => window.clearTimeout(timeout);
  }, [undo]);

  useEffect(() => {
    if (!calendarViewType.startsWith('timeGrid')) {
      setHitBounds(undefined);
      return undefined;
    }

    const panel = calendarPanelRef.current;
    if (!panel) return undefined;

    const measure = () => {
      const panelRect = panel.getBoundingClientRect();
      const body = panel.querySelector<HTMLElement>('.fc-timegrid-body');
      const cols = panel.querySelector<HTMLElement>('.fc-timegrid-cols');
      const scroller = body?.closest<HTMLElement>('.fc-scroller');
      if (!body || !cols || !scroller) {
        setHitBounds(undefined);
        return;
      }

      const bodyRect = body.getBoundingClientRect();
      const colsRect = cols.getBoundingClientRect();
      const scrollerRect = scroller.getBoundingClientRect();
      const scrollbarWidth = Math.max(0, scroller.offsetWidth - scroller.clientWidth);
      const left = Math.max(bodyRect.left, colsRect.left, scrollerRect.left);
      const top = Math.max(bodyRect.top, scrollerRect.top);
      const right = Math.min(bodyRect.right, colsRect.right, scrollerRect.right - scrollbarWidth);
      const bottom = Math.min(bodyRect.bottom, scrollerRect.bottom);
      const width = Math.max(0, right - left);
      const height = Math.max(0, bottom - top);
      setHitBounds(width > 0 && height > 0 ? {
        left: left - panelRect.left,
        top: top - panelRect.top,
        width,
        height
      } : undefined);
    };

    window.setTimeout(measure, 0);
    window.addEventListener('resize', measure);
    panel.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      panel.removeEventListener('scroll', measure, true);
    };
  }, [calendarViewType, calendarRange.start, calendarRange.end]);

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
    <div className="view-stack full-height-view calendar-view">
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
        <section className="panel calendar-panel" aria-label="Calendar" ref={calendarPanelRef}>
          <FullCalendar
            allDaySlot
            dateClick={handleDateClick}
            dayMaxEventRows={3}
            dayMaxEvents={3}
            editable
            eventDurationEditable
            eventMaxStack={1}
            eventOrder="start,duration,title,id"
            eventOrderStrict
            eventStartEditable
            eventDisplay="block"
            eventContent={renderCalendarEventContent}
            eventClick={handleEventClick}
            eventMouseEnter={() => setPointerSelection(undefined)}
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
            selectMinDistance={8}
            select={(selection) => {
              if (selection.allDay) {
                const endDate = subDays(selection.end, 1);
                const now = new Date();
                const start = new Date(selection.start);
                start.setHours(now.getHours(), now.getMinutes(), 0, 0);
                const end = new Date(endDate);
                end.setHours(now.getHours(), now.getMinutes(), 0, 0);
                openChoice(start, end, true);
              } else {
                openChoice(selection.start, selection.end);
              }
            }}
            datesSet={(arg) => {
              setCalendarRange({ start: arg.start, end: arg.end });
              setCalendarViewType(arg.view.type);
            }}
            eventDrop={updateDroppedItem}
            eventResize={updateDroppedItem}
            slotDuration="01:00:00"
            snapDuration="00:30:00"
            scrollTime="00:00:00"
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
            <DraggablePanel planner={planner}>
              {drawerMode === 'choice' && (
                <ChoiceDrawer
                  onClose={() => setDrawerMode(undefined)}
                  onEvent={() => {
                    setDraft(toDraft(pendingSelection.start, pendingSelection.end, undefined, settings.themeColors.eventDefault));
                    setDrawerMode('eventForm');
                  }}
                  onTask={() => {
                  setTaskDraft(toTaskDraft(pendingSelection.start, pendingSelection.end, settings.themeColors.taskDefault, Boolean(pendingSelection.allDay), Boolean(pendingSelection.allDay)));
                    setDrawerMode('taskForm');
                  }}
                />
              )}
              {drawerMode === 'eventDetails' && editingEventId && (
                <DetailsDrawer
                  item={planner.state.events.find((event) => event.id === editingEventId)}
                  kind="event"
                  completed={isEventOccurrenceCompleted(planner.state.events.find((event) => event.id === editingEventId)!, editingEventOccurrenceKey)}
                  onClose={() => setDrawerMode(undefined)}
                  onDelete={() => { planner.deleteEvent(editingEventId); setDrawerMode(undefined); }}
                  onEdit={() => setDrawerMode('eventForm')}
                  onToggle={() => planner.toggleEvent(planner.state.events.find((event) => event.id === editingEventId)!, editingEventOccurrenceKey)}
                />
              )}
              {drawerMode === 'taskDetails' && selectedTaskId && (
                <DetailsDrawer
                  item={planner.state.tasks.find((task) => task.id === selectedTaskId)}
                  kind="task"
                  onClose={() => setDrawerMode(undefined)}
                  onDelete={() => {
                    const selectedTask = planner.state.tasks.find((task) => task.id === selectedTaskId);
                    if (selectedTask && selectedTaskOccurrenceKey && selectedTask.recurrenceRule && selectedTask.completedOccurrences.some((record) => record.occurrenceKey === selectedTaskOccurrenceKey)) {
                      planner.updateTask(selectedTask.id, {
                        completedOccurrences: selectedTask.completedOccurrences.filter((record) => record.occurrenceKey !== selectedTaskOccurrenceKey)
                      });
                    } else {
                      planner.deleteTask(selectedTaskId);
                    }
                    setDrawerMode(undefined);
                  }}
                  onEdit={() => setDrawerMode('taskForm')}
                  onToggle={() => planner.toggleTask(planner.state.tasks.find((task) => task.id === selectedTaskId)!, selectedTaskOccurrenceKey)}
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
                    setDraft(toDraft(new Date(), undefined, undefined, settings.themeColors.eventDefault));
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
                    setTaskDraft(toTaskDraft(new Date(), undefined, settings.themeColors.taskDefault));
                  }}
                />
              )}
            </DraggablePanel>
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

function renderCalendarEventContent(arg: { event: { title: string; extendedProps: Record<string, unknown> }; timeText: string }) {
  const isCompleted = arg.event.extendedProps.completed === true;
  return (
    <span className="calendar-event-content">
      {isCompleted && <Check className="calendar-completed-check" aria-hidden="true" size={16} />}
      {arg.timeText && <span className="calendar-event-time">{arg.timeText}</span>}
      <span className="calendar-event-title">{arg.event.title}</span>
    </span>
  );
}

function CalendarTimeInteractionLayer({
  bounds,
  panelRef,
  onOpenChoice,
  onPreview
}: {
  bounds?: CalendarHitBounds;
  panelRef: RefObject<HTMLElement>;
  onOpenChoice: (start: Date, end?: Date, allDay?: boolean) => void;
  onPreview: (selection: CalendarPointerSelection | undefined) => void;
}) {
  const pointerStart = useRef<{ x: number; y: number; range: PendingSelection }>();
  const [targets, setTargets] = useState<CalendarHitTarget[]>([]);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel || !bounds) {
      setTargets([]);
      return undefined;
    }

    const measureTargets = () => {
      const panelRect = panel.getBoundingClientRect();
      const cols = Array.from(panel.querySelectorAll<HTMLElement>('.fc-timegrid-col[data-date]'));
      const slots = Array.from(panel.querySelectorAll<HTMLElement>('.fc-timegrid-slot-lane[data-time]'));
      const nextTargets: CalendarHitTarget[] = [];

      for (const col of cols) {
        const date = col.dataset.date;
        if (!date) continue;
        const colRect = col.getBoundingClientRect();
        const left = Math.max(colRect.left - panelRect.left, bounds.left);
        const right = Math.min(colRect.right - panelRect.left, bounds.left + bounds.width);
        const width = right - left;
        if (width <= 0) continue;

        for (const slot of slots) {
          const time = slot.dataset.time;
          if (!time) continue;
          const slotRect = slot.getBoundingClientRect();
          const top = slotRect.top - panelRect.top;
          const bottom = slotRect.bottom - panelRect.top;
          if (bottom < bounds.top || top > bounds.top + bounds.height) continue;
          const visibleTop = Math.max(top, bounds.top);
          const visibleBottom = Math.min(bottom, bounds.top + bounds.height);
          const lineTop = Math.max(bounds.top, visibleTop - 7);
          const lineBottom = Math.min(bounds.top + bounds.height, visibleTop + 7);
          const boxTop = Math.min(visibleBottom, visibleTop + 8);
          const boxBottom = Math.max(boxTop, visibleBottom - 8);

          if (lineBottom > lineTop) {
            nextTargets.push({
              date,
              height: lineBottom - lineTop,
              kind: 'line',
              left,
              time,
              top: lineTop,
              width
            });
          }

          if (boxBottom > boxTop) {
            nextTargets.push({
              date,
              height: boxBottom - boxTop,
              kind: 'box',
              left,
              time,
              top: boxTop,
              width
            });
          }
        }
      }

      setTargets(nextTargets);
    };

    window.setTimeout(measureTargets, 0);
    window.addEventListener('resize', measureTargets);
    panel.addEventListener('scroll', measureTargets, true);
    return () => {
      window.removeEventListener('resize', measureTargets);
      panel.removeEventListener('scroll', measureTargets, true);
    };
  }, [bounds, panelRef]);

  if (!bounds) return null;

  const readRangeFromTarget = (target: CalendarHitTarget, mode: CalendarPointerSelection['mode']): CalendarPointerSelection | undefined => {
    const startsAt = new Date(`${target.date}T${target.time}`);
    const range = calendarClickRange(startsAt, target.kind === 'line');
    return { ...range, mode };
  };

  const findTargetAtPoint = (clientX: number, clientY: number): CalendarHitTarget | undefined => {
    const panel = panelRef.current;
    if (!panel) return undefined;
    if (document.elementFromPoint(clientX, clientY)?.closest('.fc-event')) return undefined;
    const panelRect = panel.getBoundingClientRect();
    const x = clientX - panelRect.left;
    const y = clientY - panelRect.top;
    return [...targets].reverse().find((target) => (
      x >= target.left &&
      x <= target.left + target.width &&
      y >= target.top &&
      y <= target.top + target.height
    ));
  };

  const rangeForDrag = (start: PendingSelection, current: PendingSelection): CalendarPointerSelection => {
    const first = start.start <= current.start ? start.start : current.start;
    const last = start.start <= current.start ? current.end : start.end;
    return {
      start: first,
      end: last <= first ? addMinutes(first, 30) : last,
      mode: 'drag'
    };
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const hitTarget = findTargetAtPoint(event.clientX, event.clientY);
    const current = hitTarget ? readRangeFromTarget(hitTarget, pointerStart.current ? 'drag' : 'hover') : undefined;
    if (!current) {
      if (!pointerStart.current) onPreview(undefined);
      return;
    }

    if (pointerStart.current) {
      onPreview(rangeForDrag(pointerStart.current.range, current));
      return;
    }

    onPreview(current);
  };

  return (
    <div
      aria-label="Calendar Time Selection Layer"
      className="calendar-hit-layer"
      style={{ left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height }}
      onPointerLeave={() => {
        pointerStart.current = undefined;
        onPreview(undefined);
      }}
      onPointerMove={handlePointerMove}
      onPointerUp={(event) => {
        const start = pointerStart.current;
        pointerStart.current = undefined;
        const hitTarget = findTargetAtPoint(event.clientX, event.clientY);
        const current = hitTarget ? readRangeFromTarget(hitTarget, 'press') : undefined;
        if (!start || !current) {
          onPreview(undefined);
          return;
        }
        const dragged = Math.abs(event.clientX - start.x) > 6 || Math.abs(event.clientY - start.y) > 6;
        const range = dragged ? rangeForDrag(start.range, current) : current;
        onPreview(undefined);
        onOpenChoice(range.start, range.end);
      }}
      onWheel={(event) => {
        const panel = panelRef.current;
        const scroller = Array.from(panel?.querySelectorAll<HTMLElement>('.fc-scroller') ?? [])
          .find((candidate) => candidate.scrollHeight > candidate.clientHeight);
        if (!scroller) return;
        const atTop = scroller.scrollTop <= 0;
        const atBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1;
        if ((event.deltaY < 0 && atTop) || (event.deltaY > 0 && atBottom)) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        scroller.scrollTop += event.deltaY;
      }}
      role="presentation"
    >
      {targets.map((target) => (
        <div
          aria-hidden="true"
          className={`calendar-hit-target calendar-hit-target-${target.kind}`}
          data-date={target.date}
          data-kind={target.kind}
          data-time={target.time}
          key={`${target.kind}-${target.date}-${target.time}`}
          onPointerDown={(event) => {
            if (document.elementFromPoint(event.clientX, event.clientY)?.closest('.fc-event')) return;
            const range = readRangeFromTarget(target, 'press');
            if (!range) return;
            pointerStart.current = { x: event.clientX, y: event.clientY, range };
            onPreview(range);
          }}
          style={{ left: target.left - bounds.left, top: target.top - bounds.top, width: target.width, height: target.height }}
        />
      ))}
    </div>
  );
}

function TasksView({ planner, defaultSignal }: { planner: ReturnType<typeof usePlanner>; defaultSignal: number }) {
  const [filter, setFilter] = useState<PlannerFilter>('today');
  const [drawerMode, setDrawerMode] = useState<DrawerMode>();
  const [selectedTaskId, setSelectedTaskId] = useState<string>();
  const [selectedTaskOccurrenceKey, setSelectedTaskOccurrenceKey] = useState<string>();
  const [selectedEventId, setSelectedEventId] = useState<string>();
  const [selectedEventOccurrenceKey, setSelectedEventOccurrenceKey] = useState<string>();
  const [completionUndo, setCompletionUndo] = useState<{ kind: 'task' | 'event'; id: string; title: string; occurrenceKey?: string; wasCompleted: boolean }>();
  const [eventDraft, setEventDraft] = useState<EventDraft>(() => toDraft(new Date(), undefined, undefined, planner.state.settings.themeColors.eventDefault));
  const [taskDraft, setTaskDraft] = useState<TaskDraft>(() => toTaskDraft(new Date()));
  const groups = useMemo(() => getTaskListGroups(planner.state, filter), [filter, planner.state]);
  const selectedTask = planner.state.tasks.find((task) => task.id === selectedTaskId);
  const selectedEvent = planner.state.events.find((event) => event.id === selectedEventId);
  const taskListCopy = getTaskListCopy(planner.state.settings.showTaskItemsInTasks, planner.state.settings.showCalendarEventsInTasks);

  const openItemDetails = (item: PlannerListItem) => {
    if (item.kind === 'task') {
      setSelectedTaskId((item.source as Task).id);
      setSelectedTaskOccurrenceKey(item.occurrenceKey);
      setSelectedEventId(undefined);
      setSelectedEventOccurrenceKey(undefined);
      setTaskDraft(toTaskDraftFromTask(item.source as Task, planner.state.settings.themeColors.taskDefault));
      setDrawerMode('taskDetails');
      return;
    }

    const event = item.source as CalendarEvent;
    setSelectedEventId(event.id);
    setSelectedEventOccurrenceKey(item.occurrenceKey ?? item.startsAt);
    setSelectedTaskId(undefined);
    setSelectedTaskOccurrenceKey(undefined);
    setEventDraft(toDraft(parseISO(event.startsAt), parseISO(event.endsAt), event, planner.state.settings.themeColors.eventDefault));
    setDrawerMode('eventDetails');
  };

  const openItemEdit = (item: PlannerListItem) => {
    openItemDetails(item);
    setDrawerMode(item.kind === 'task' ? 'taskForm' : 'eventForm');
  };

  useEffect(() => {
    setFilter('today');
  }, [defaultSignal]);

  useEffect(() => {
    if (!completionUndo) return undefined;
    const timeout = window.setTimeout(() => setCompletionUndo(undefined), 7000);
    return () => window.clearTimeout(timeout);
  }, [completionUndo]);

  const undoCompletionToggle = () => {
    if (!completionUndo) return;
    if (completionUndo.kind === 'task') {
      const task = planner.state.tasks.find((candidate) => candidate.id === completionUndo.id);
      if (task) planner.toggleTask(task, completionUndo.occurrenceKey);
    } else {
      const event = planner.state.events.find((candidate) => candidate.id === completionUndo.id);
      if (event) planner.toggleEvent(event, completionUndo.occurrenceKey);
    }
    setCompletionUndo(undefined);
  };

  return (
    <div className="view-stack full-height-view">
      <header className="view-header">
        <div>
          <p className="eyebrow">Tasks</p>
          <h2>Work Queue</h2>
        </div>
        <div className="header-actions">
          <label className="mini-toggle">
            <input checked={planner.state.settings.showTaskItemsInTasks} type="checkbox" onChange={(event) => planner.updateSettings({ ...planner.state.settings, showTaskItemsInTasks: event.target.checked })} />
            <span>Show Tasks</span>
          </label>
          <label className="mini-toggle">
            <input checked={planner.state.settings.showCalendarEventsInTasks} type="checkbox" onChange={(event) => planner.updateSettings({ ...planner.state.settings, showCalendarEventsInTasks: event.target.checked })} />
            <span>Show Events</span>
          </label>
          <SegmentedControl options={['all', 'today', 'upcoming', 'overdue']} value={filter} onChange={(value) => setFilter(value as PlannerFilter)} />
          <button className="primary-action" onClick={() => { setSelectedTaskId(undefined); setSelectedTaskOccurrenceKey(undefined); setSelectedEventId(undefined); setTaskDraft(toTaskDraft(new Date(), undefined, planner.state.settings.themeColors.taskDefault)); setDrawerMode('taskForm'); }} type="button">
            <ListTodo size={18} />
            Add Task
          </button>
        </div>
      </header>
      <div className="task-layout single">
        <ListPanel
          title={taskListCopy.title}
          detail={taskListCopy.detail}
          empty="Nothing in this list."
        >
          {groups.active.map((item) => (
            <PlannerItemRow item={item} key={`${item.kind}-${item.id}`} planner={planner} onEdit={() => openItemEdit(item)} onOpen={() => openItemDetails(item)} onToggleItem={setCompletionUndo} />
          ))}
        </ListPanel>
        <ListPanel title="Completed" detail="Finished items for this tab." empty="Nothing completed here yet." initiallyCollapsed>
          {groups.completed.map((item) => (
            <PlannerItemRow item={item} key={`completed-${item.kind}-${item.id}`} planner={planner} onEdit={() => openItemEdit(item)} onOpen={() => openItemDetails(item)} onToggleItem={setCompletionUndo} />
          ))}
        </ListPanel>
        {completionUndo && (
          <div className="undo-toast task-undo-toast" role="status">
            <span>{completionUndo.wasCompleted ? 'Marked incomplete.' : 'Marked complete.'}</span>
            <button className="secondary-action" onClick={undoCompletionToggle} type="button">Undo</button>
          </div>
        )}
        {drawerMode && (
          <div className="drawer-backdrop" role="presentation" onMouseDown={(event) => {
            if (event.target === event.currentTarget) setDrawerMode(undefined);
          }}>
            <DraggablePanel planner={planner}>
              {drawerMode === 'eventDetails' && selectedEvent && (
                <DetailsDrawer
                  item={selectedEvent}
                  kind="event"
                  completed={isEventOccurrenceCompleted(selectedEvent, selectedEventOccurrenceKey)}
                  onClose={() => setDrawerMode(undefined)}
                  onEdit={() => setDrawerMode('eventForm')}
                  onDelete={() => { planner.deleteEvent(selectedEvent.id); setDrawerMode(undefined); }}
                  onToggle={() => planner.toggleEvent(selectedEvent, selectedEventOccurrenceKey)}
                />
              )}
              {drawerMode === 'taskDetails' && selectedTask && (
                <DetailsDrawer
                  item={selectedTask}
                  kind="task"
                  completed={selectedTaskOccurrenceKey ? isTaskOccurrenceCompleted(selectedTask, selectedTaskOccurrenceKey) : selectedTask.status === 'completed'}
                  onClose={() => setDrawerMode(undefined)}
                  onEdit={() => setDrawerMode('taskForm')}
                  onDelete={() => {
                    if (selectedTaskOccurrenceKey && selectedTask.recurrenceRule && selectedTask.completedOccurrences.some((record) => record.occurrenceKey === selectedTaskOccurrenceKey)) {
                      planner.updateTask(selectedTask.id, {
                        completedOccurrences: selectedTask.completedOccurrences.filter((record) => record.occurrenceKey !== selectedTaskOccurrenceKey)
                      });
                    } else {
                      planner.deleteTask(selectedTask.id);
                    }
                    setDrawerMode(undefined);
                  }}
                  onToggle={() => planner.toggleTask(selectedTask, selectedTaskOccurrenceKey)}
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
                    setSelectedTaskOccurrenceKey(undefined);
                    setTaskDraft(toTaskDraft(new Date(), undefined, planner.state.settings.themeColors.taskDefault));
                  }}
                />
              )}
              {drawerMode === 'eventForm' && (
                <EventForm
                  draft={eventDraft}
                  editingEventId={selectedEventId}
                  planner={planner}
                  onChange={setEventDraft}
                  onClose={() => setDrawerMode(undefined)}
                  onSaved={() => {
                    setDrawerMode(undefined);
                    setSelectedEventId(undefined);
                    setEventDraft(toDraft(new Date(), undefined, undefined, planner.state.settings.themeColors.eventDefault));
                  }}
                />
              )}
            </DraggablePanel>
          </div>
        )}
      </div>
    </div>
  );
}

function TimerView({ planner }: { planner: ReturnType<typeof usePlanner> }) {
  const [mode, setMode] = useState<TimerMode | 'pomodoro'>('focus');
  const [duration, setDuration] = useState(() => secondsToDurationParts(planner.state.settings.lastTimerDurationSeconds));
  const [pomodoroActive, setPomodoroActive] = useState(false);
  const [pomodoroFocusCount, setPomodoroFocusCount] = useState(0);
  const [now, setNow] = useState(Date.now());
  const loopingAudio = useRef<HTMLAudioElement>();
  const initialCompletedTimerId = useRef(planner.completedTimer?.id);
  const playedCompletedTimerId = useRef<string>();
  const snapshot = planner.activeTimer ? getTimerSnapshot(planner.activeTimer, now) : undefined;
  const settings = planner.state.settings;
  const canStart = mode === 'pomodoro' || isValidTimerDuration(duration);

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
    if (
      planner.completedTimer &&
      planner.completedTimer.id !== initialCompletedTimerId.current &&
      planner.completedTimer.id !== playedCompletedTimerId.current &&
      settings.soundsEnabled
    ) {
      loopingAudio.current?.pause();
      loopingAudio.current = playSound(settings.timerCompleteSound, settings.soundVolume, true);
      playedCompletedTimerId.current = planner.completedTimer.id;
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

  useEffect(() => () => stopCompleteSound(), []);

  const dismissCompletion = () => {
    stopCompleteSound();
    planner.dismissCompletedTimer();
  };

  const startTimer = () => {
    if (mode === 'pomodoro') {
      setPomodoroActive(true);
      setPomodoroFocusCount(0);
      planner.startTimer('focus', Math.max(1, settings.pomodoroFocusMinutes) * 60);
      return;
    }
    const durationSeconds = durationPartsToSeconds(duration);
    planner.updateSettings({ ...settings, lastTimerDurationSeconds: durationSeconds });
    planner.startTimer(mode, durationSeconds);
  };

  const startNextPomodoroSegment = () => {
    if (!planner.completedTimer) return;
    const sessionsBeforeLongBreak = Math.max(1, settings.pomodoroSessionsBeforeLongBreak);
    const nextFocusCount = planner.completedTimer.mode === 'focus' ? pomodoroFocusCount + 1 : pomodoroFocusCount;
    const nextMode: TimerMode = planner.completedTimer.mode === 'focus' ? 'break' : 'focus';
    const breakIsLong = planner.completedTimer.mode === 'focus' && nextFocusCount % sessionsBeforeLongBreak === 0;
    const nextDuration = nextMode === 'focus'
      ? settings.pomodoroFocusMinutes * 60
      : (breakIsLong ? settings.pomodoroLongBreakMinutes : settings.pomodoroShortBreakMinutes) * 60;

    stopCompleteSound();
    planner.dismissCompletedTimer();
    setPomodoroFocusCount(nextFocusCount);
    setPomodoroActive(true);
    planner.startTimer(nextMode, Math.max(1, nextDuration));
  };

  const resetToSetup = () => {
    setPomodoroActive(false);
    setPomodoroFocusCount(0);
    dismissCompletion();
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
              ? 'Nice work. The next session is ready when you are.'
              : 'Break finished. Ready when you are.'}
          </p>
          {pomodoroActive && (
            <p className="timer-meta">
              Pomodoro Progress: {pomodoroFocusCount + (planner.completedTimer.mode === 'focus' ? 1 : 0)} Focus Session(s)
            </p>
          )}
          <div className="timer-actions">
            <button className="secondary-action" onClick={stopCompleteSound} type="button">
              <Volume2 size={18} />
              Stop Sound
            </button>
            <button className="secondary-action" onClick={resetToSetup} type="button">
              <Play size={18} />
              Start Another
            </button>
            {pomodoroActive && (
              <button className="primary-action" onClick={startNextPomodoroSegment} type="button">
                <Play size={18} />
                Start Next
              </button>
            )}
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
            <SegmentedControl options={['focus', 'break', 'pomodoro']} value={mode} onChange={(value) => setMode(value as TimerMode | 'pomodoro')} />
            {mode === 'pomodoro' ? (
              <div className="pomodoro-summary editable-pomodoro">
                <strong>Pomodoro Cycle</strong>
                <div className="duration-grid">
                  <NumberSetting label="Focus Minutes" value={settings.pomodoroFocusMinutes} onChange={(value) => planner.updateSettings({ ...settings, pomodoroFocusMinutes: value })} />
                  <NumberSetting label="Short Break" value={settings.pomodoroShortBreakMinutes} onChange={(value) => planner.updateSettings({ ...settings, pomodoroShortBreakMinutes: value })} />
                  <NumberSetting label="Long Break" value={settings.pomodoroLongBreakMinutes} onChange={(value) => planner.updateSettings({ ...settings, pomodoroLongBreakMinutes: value })} />
                </div>
                <NumberSetting label="Sessions Before Long Break" value={settings.pomodoroSessionsBeforeLongBreak} onChange={(value) => planner.updateSettings({ ...settings, pomodoroSessionsBeforeLongBreak: value })} />
              </div>
            ) : (
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
            )}
            <SoundControls planner={planner} />
            <button className="primary-action" disabled={!canStart} onClick={startTimer} type="button">
              <Play size={18} />
              {mode === 'pomodoro' ? 'Start Pomodoro' : 'Start Timer'}
            </button>
          </>
        )}
      </section>
    </div>
  );
}

function SettingsView({ planner }: { planner: ReturnType<typeof usePlanner> }) {
  const settings = planner.state.settings;
  const [confirmAction, setConfirmAction] = useState<string>();
  const [importState, setImportState] = useState<ReturnType<typeof parsePlannerExport>>();
  const [importError, setImportError] = useState<string>();
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [pendingSyncChoice, setPendingSyncChoice] = useState<'local' | 'cloud'>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!planner.pendingRemoteState) {
      setPendingSyncChoice(undefined);
    }
  }, [planner.pendingRemoteState]);

  const exportPlannerData = () => {
    const exportedAt = new Date();
    const payload = buildPlannerExport(planner.state, exportedAt);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = buildPlannerExportFilename(exportedAt);
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const readImportFile = (file: File | undefined) => {
    setImportError(undefined);
    setImportState(undefined);
    setConfirmAction(undefined);
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parsePlannerExport(JSON.parse(String(reader.result)));
        setImportState(parsed);
        setConfirmAction('settings-import');
      } catch (error) {
        setImportError(error instanceof Error ? error.message : 'Could not import planner data.');
      }
    };
    reader.readAsText(file);
  };

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
        {planner.platform.supportsAutostart && (
          <label className="toggle-row">
            <span><Clock3 size={18} /> Start With Windows</span>
            <input
              checked={settings.autostartEnabled}
              onChange={(event) => planner.updateSettings({ ...settings, autostartEnabled: event.target.checked })}
              type="checkbox"
            />
          </label>
        )}
        {!planner.platform.supportsAutostart && (
          <p className="header-note">Autostart is available only in the Windows desktop app.</p>
        )}
        <div className="form-actions settings-actions">
          <button className="secondary-action" disabled={!planner.platform.supportsNotifications} onClick={planner.testNotification} type="button">
            Test Notification
          </button>
        </div>
        {planner.notificationStatus && <p className="header-note" role="status">{planner.notificationStatus}</p>}
        <section className="settings-section" aria-label="Theme Settings">
          <PanelTitle title="Theme" detail="Preset Or Custom App Colors" />
          <label className="field">
            <span>Theme Preset</span>
            <select
              value={settings.themePreset}
              onChange={(event) => {
                const preset = event.target.value as AppSettings['themePreset'];
                planner.updateSettings({
                  ...settings,
                  themePreset: preset,
                  themeColors: preset === 'light' ? lightThemeColors : preset === 'dark' ? darkThemeColors : settings.themeColors
                });
              }}
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="custom">Custom</option>
            </select>
          </label>
          <div className="theme-color-grid">
            {themeColorFields.map((field) => (
              <label className="field color-input-row" key={field.key}>
                <span>{field.label}</span>
                <input
                  type="color"
                  value={settings.themeColors[field.key]}
                  onChange={(event) => planner.updateSettings({
                    ...settings,
                    themePreset: 'custom',
                    themeColors: { ...settings.themeColors, [field.key]: event.target.value }
                  })}
                />
              </label>
            ))}
          </div>
        </section>
        <section className="settings-section" aria-label="Pomodoro Settings">
          <PanelTitle title="Pomodoro" detail="Cycle Lengths And Long Break Timing" />
          <div className="duration-grid">
            <NumberSetting label="Focus Minutes" value={settings.pomodoroFocusMinutes} onChange={(value) => planner.updateSettings({ ...settings, pomodoroFocusMinutes: value })} />
            <NumberSetting label="Short Break" value={settings.pomodoroShortBreakMinutes} onChange={(value) => planner.updateSettings({ ...settings, pomodoroShortBreakMinutes: value })} />
            <NumberSetting label="Long Break" value={settings.pomodoroLongBreakMinutes} onChange={(value) => planner.updateSettings({ ...settings, pomodoroLongBreakMinutes: value })} />
          </div>
          <NumberSetting label="Sessions Before Long Break" value={settings.pomodoroSessionsBeforeLongBreak} onChange={(value) => planner.updateSettings({ ...settings, pomodoroSessionsBeforeLongBreak: value })} />
        </section>
        <SoundControls planner={planner} />
        <section className="settings-section" aria-label="Account Sync">
          <PanelTitle title="Account Sync" detail={planner.syncUser ? `Signed in${planner.syncUser.email ? ` as ${planner.syncUser.email}` : ''}` : 'Email and password Supabase sync'} />
          {planner.syncUser ? (
            <div className="form-actions settings-actions">
              <button className="secondary-action" disabled={planner.syncStatus === 'syncing'} onClick={planner.syncNow} type="button">
                Sync Now
              </button>
              <button className="secondary-action" onClick={planner.signOut} type="button">
                Sign Out
              </button>
            </div>
          ) : (
            <div className="auth-grid">
              <label className="field">
                <span>Email</span>
                <input autoComplete="email" type="email" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} />
              </label>
              <label className="field">
                <span>Password</span>
                <input autoComplete="current-password" type="password" value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} />
              </label>
              <div className="form-actions settings-actions">
                <button className="primary-action" disabled={!authEmail || !authPassword || planner.syncStatus === 'syncing'} onClick={() => planner.signIn(authEmail, authPassword)} type="button">
                  Sign In
                </button>
                <button className="secondary-action" disabled={!authEmail || !authPassword || planner.syncStatus === 'syncing'} onClick={() => planner.signUp(authEmail, authPassword)} type="button">
                  Create Account
                </button>
              </div>
            </div>
          )}
          {planner.pendingRemoteState && (
            <div className="sync-warning">
              <strong>Cloud data is different from this device.</strong>
              <span>Export a backup, choose which copy to keep, then confirm the choice.</span>
              {pendingSyncChoice && (
                <span className="sync-choice">
                  Selected: {pendingSyncChoice === 'local' ? 'Keep local data on this device' : 'Use cloud data for this device'}
                </span>
              )}
              <div className="form-actions settings-actions">
                <button className="secondary-action" onClick={exportPlannerData} type="button">
                  <Download size={18} />
                  Export Backup
                </button>
                <button className={pendingSyncChoice === 'local' ? 'primary-action' : 'secondary-action'} onClick={() => setPendingSyncChoice('local')} type="button">
                  Keep Local Data
                </button>
                <button className={pendingSyncChoice === 'cloud' ? 'danger-action' : 'secondary-action'} onClick={() => setPendingSyncChoice('cloud')} type="button">
                  Use Cloud Data
                </button>
                {pendingSyncChoice && (
                  <>
                    <button
                      className={pendingSyncChoice === 'cloud' ? 'danger-action' : 'primary-action'}
                      onClick={() => {
                        if (pendingSyncChoice === 'local') planner.keepLocalState();
                        if (pendingSyncChoice === 'cloud') planner.useRemoteState();
                        setPendingSyncChoice(undefined);
                      }}
                      type="button"
                    >
                      Confirm Selection
                    </button>
                    <button className="secondary-action" onClick={() => setPendingSyncChoice(undefined)} type="button">
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
          <p className="header-note">
            {planner.syncStatus === 'syncing'
              ? 'Syncing...'
              : planner.lastSyncedAt
                ? `Last Synced ${format(parseISO(planner.lastSyncedAt), 'MMM d, h:mm a')}`
                : 'Local data stays on this device until you sign in.'}
          </p>
          {planner.syncError && <p className="form-error" role="alert">{planner.syncError}</p>}
        </section>
        <div className="form-actions settings-actions">
          <input
            accept="application/json"
            className="visually-hidden"
            ref={fileInputRef}
            type="file"
            onChange={(event) => readImportFile(event.target.files?.[0])}
          />
          <ConfirmActionButton
            actionId="settings-import"
            className="secondary-action"
            confirmAction={confirmAction}
            icon={<Upload size={18} />}
            label="Import Planner Data"
            onConfirm={() => {
              if (!importState) {
                fileInputRef.current?.click();
                return;
              }
              planner.importPlannerState(importState);
              setImportState(undefined);
              setConfirmAction(undefined);
              if (fileInputRef.current) fileInputRef.current.value = '';
            }}
            onFirstClick={() => fileInputRef.current?.click()}
            setConfirmAction={setConfirmAction}
          />
          <button className="secondary-action" onClick={exportPlannerData} type="button">
            <Download size={18} />
            Export Planner Data
          </button>
        </div>
        {importError && <p className="form-error" role="alert">{importError}</p>}
      </section>
    </div>
  );
}

function NumberSetting({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input min="1" type="number" value={value} onChange={(event) => onChange(Math.max(1, Number(event.target.value) || 1))} />
    </label>
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
    rememberCustomColor(planner, draft.color);
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
      <ColorPicker
        label="Event Color"
        options={buildColorOptions(planner.state.settings.themeColors.eventDefault, planner.state.settings.themeColors.taskDefault, planner.state.settings.recentCustomColors)}
        value={draft.color}
        onChange={(color) => setField('color', color)}
      />
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions">
        {editingEventId && (
          <ConfirmActionButton
            actionId="delete"
            className="danger-action"
            confirmAction={confirmAction}
            icon={<Trash2 size={18} />}
            label="Delete Event"
            onConfirm={() => {
              planner.deleteEvent(editingEventId);
              onSaved();
            }}
            setConfirmAction={setConfirmAction}
          />
        )}
        <ConfirmActionButton
          actionId="reset"
          className="secondary-action"
          confirmAction={confirmAction}
          icon={<RotateCcw size={18} />}
          label="Reset"
          onConfirm={() => {
            onChange(toDraft(new Date(), undefined, undefined, planner.state.settings.themeColors.eventDefault));
            setConfirmAction(undefined);
          }}
          setConfirmAction={setConfirmAction}
        />
        <button className="primary-action" type="submit">{editingEventId ? 'Save Event' : 'Add Event'}</button>
      </div>
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
  const [confirmAction, setConfirmAction] = useState<'delete' | 'reset'>();
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
      color: draft.color,
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
    rememberCustomColor(planner, draft.color);
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
      <ColorPicker
        label="Task Color"
        options={buildColorOptions(planner.state.settings.themeColors.taskDefault, planner.state.settings.themeColors.eventDefault, planner.state.settings.recentCustomColors)}
        value={draft.color}
        onChange={(color) => setField('color', color)}
      />
      <RecurrenceFields value={draft.recurrence} onChange={(recurrence) => setField('recurrence', recurrence)} />
      <textarea name="notes" placeholder="Notes" value={draft.notes} onChange={(event) => setField('notes', event.target.value)} />
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions">
        {editingTaskId && (
          <ConfirmActionButton
            actionId="delete"
            className="danger-action"
            confirmAction={confirmAction}
            icon={<Trash2 size={18} />}
            label="Delete Task"
            onConfirm={() => {
              planner.deleteTask(editingTaskId);
              onSaved();
            }}
            setConfirmAction={setConfirmAction}
          />
        )}
        <ConfirmActionButton
          actionId="reset"
          className="secondary-action"
          confirmAction={confirmAction}
          icon={<RotateCcw size={18} />}
          label="Reset"
          onConfirm={() => {
            onChange(toTaskDraft(new Date(), undefined, planner.state.settings.themeColors.taskDefault));
            setConfirmAction(undefined);
          }}
          setConfirmAction={setConfirmAction}
        />
        <button className="primary-action" type="submit">{editingTaskId ? 'Save Task' : 'Add Task'}</button>
      </div>
    </form>
  );
}

function PlannerItemRow({
  item,
  planner,
  onEdit,
  onOpen,
  onToggleItem
}: {
  item: PlannerListItem;
  planner: ReturnType<typeof usePlanner>;
  onEdit?: () => void;
  onOpen?: () => void;
  onToggleItem?: (undo: { kind: 'task' | 'event'; id: string; title: string; occurrenceKey?: string; wasCompleted: boolean }) => void;
}) {
  const when = formatItemTime(item);
  const source = item.source;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const toggle = () => item.kind === 'task'
    ? planner.toggleTask(source as Task, item.occurrenceKey ?? item.endsAt ?? item.dueAt)
    : planner.toggleEvent(source as CalendarEvent, item.occurrenceKey ?? item.startsAt);
  const toggleWithMotion = () => {
    toggle();
    onToggleItem?.({
      kind: item.kind,
      id: item.kind === 'task' ? (source as Task).id : (source as CalendarEvent).id,
      title: item.title,
      occurrenceKey: item.occurrenceKey ?? (item.kind === 'task' ? item.endsAt ?? item.dueAt : item.startsAt),
      wasCompleted: item.completed
    });
  };
  const deleteItem = () => {
    if (item.kind === 'task') {
      const task = source as Task;
      if (item.completed && task.recurrenceRule && item.occurrenceKey) {
        planner.updateTask(task.id, {
          completedOccurrences: task.completedOccurrences.filter((record) => record.occurrenceKey !== item.occurrenceKey)
        });
        return;
      }
      planner.deleteTask(task.id);
      return;
    }

    planner.deleteEvent((source as CalendarEvent).id);
  };

  return (
    <div
      className={`list-row ${item.kind} ${item.completed ? 'completed' : ''}`}
      onClick={onOpen}
      role={onOpen ? 'button' : undefined}
      style={{ borderLeftColor: item.kind === 'event' ? (source as CalendarEvent).color : item.color ?? planner.state.settings.themeColors.taskDefault }}
      tabIndex={onOpen ? 0 : undefined}
    >
      <button
        aria-label={item.completed ? `Mark ${item.title} incomplete` : `Mark ${item.title} complete`}
        className="icon-action completion-toggle"
        onClick={(event) => { event.stopPropagation(); toggleWithMotion(); }}
        title={item.completed ? 'Mark incomplete' : 'Mark complete'}
        type="button"
      >
        {item.completed ? <Check size={16} /> : <Square size={16} />}
      </button>
      <div className="item-main">
        <strong>{item.title}</strong>
        <span>{when}</span>
        <span className="item-meta">{item.kind === 'task' ? item.priority : item.importance}</span>
        {item.notes && <span className="item-notes">{item.notes}</span>}
        {item.completedAt && <span className="completed-time">Completed {format(parseISO(item.completedAt), 'MMM d, h:mm a')}</span>}
      </div>
      <div className="row-actions">
        {item.kind === 'event' && item.importance === 'high' && <Star size={16} />}
        {onEdit && (
        <button
          className="icon-action"
          onClick={(event) => { event.stopPropagation(); onEdit(); }}
          title={item.kind === 'task' ? 'Edit Task' : 'Edit Event'}
          type="button"
        >
          <Pencil size={16} />
        </button>
        )}
        <button
        className={confirmDelete ? 'danger-action row-confirm-delete' : 'icon-action'}
        onClick={(event) => {
          event.stopPropagation();
          if (!confirmDelete) {
            setConfirmDelete(true);
            return;
          }
          deleteItem();
        }}
        onBlur={() => window.setTimeout(() => setConfirmDelete(false), 120)}
        title={item.kind === 'task' ? 'Delete Task' : 'Delete Event'}
        type="button"
      >
        {confirmDelete ? 'Confirm' : <Trash2 size={16} />}
        </button>
      </div>
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

function ColorPicker({ label, options = eventColors, value, onChange }: { label: string; options?: string[]; value: string; onChange: (color: string) => void }) {
  return (
    <fieldset className="color-picker">
      <legend>{label}</legend>
      <div className="color-grid">
        {options.map((color) => (
          <label key={color} style={{ '--swatch-color': color } as CSSProperties}>
            <input checked={value === color} name="color" type="radio" value={color} onChange={() => onChange(color)} />
            <span aria-hidden="true" />
          </label>
        ))}
        <label className="custom-color-field">
          <input aria-label={`Custom ${label}`} type="color" value={value} onChange={(event) => onChange(event.target.value)} />
          <span aria-hidden="true"><Palette size={15} /></span>
        </label>
      </div>
    </fieldset>
  );
}

function buildColorOptions(primaryDefault: string, secondaryDefault: string, recentCustomColors: string[] = []): string[] {
  return Array.from(new Set([primaryDefault, secondaryDefault, ...recentCustomColors, ...eventColors])).slice(0, 8);
}

function rememberCustomColor(planner: ReturnType<typeof usePlanner>, color: string) {
  const settings = planner.state.settings;
  const builtIns = new Set([settings.themeColors.taskDefault, settings.themeColors.eventDefault, ...eventColors]);
  if (!/^#[0-9a-f]{6}$/i.test(color) || builtIns.has(color)) return;
  const recentCustomColors = [color, ...settings.recentCustomColors.filter((candidate) => candidate !== color)].slice(0, 5);
  planner.updateSettings({ ...settings, recentCustomColors });
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
  completed,
  item,
  kind,
  onClose,
  onDelete,
  onEdit,
  onToggle
}: {
  completed?: boolean;
  item?: Task | CalendarEvent;
  kind: 'task' | 'event';
  onClose: () => void;
  onDelete?: () => void;
  onEdit: () => void;
  onToggle: () => void;
}) {
  const [confirmAction, setConfirmAction] = useState<'delete'>();
  if (!item) return null;
  const startsAt = 'startsAt' in item ? item.startsAt : undefined;
  const endsAt = 'endsAt' in item ? item.endsAt : undefined;
  const complete = completed ?? ('status' in item ? item.status === 'completed' : item.completedOccurrences.length > 0);

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
        {onDelete && (
          <ConfirmActionButton
            actionId="delete"
            className="danger-action"
            confirmAction={confirmAction}
            icon={<Trash2 size={18} />}
            label={kind === 'task' ? 'Delete Task' : 'Delete Event'}
            onConfirm={onDelete}
            setConfirmAction={setConfirmAction}
          />
        )}
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

function ConfirmActionButton<T extends string>({
  actionId,
  className,
  confirmAction,
  icon,
  label,
  onConfirm,
  onFirstClick,
  setConfirmAction
}: {
  actionId: T;
  className: string;
  confirmAction?: T;
  icon: ReactNode;
  label: string;
  onConfirm: () => void;
  onFirstClick?: () => void;
  setConfirmAction: Dispatch<SetStateAction<T | undefined>>;
}) {
  const confirming = confirmAction === actionId;
  return (
    <button
      className={className}
      onClick={() => {
        if (confirming) {
          onConfirm();
          return;
        }
        onFirstClick?.();
        setConfirmAction(actionId);
      }}
      type="button"
    >
      {icon}
      {confirming ? 'Confirm' : label}
    </button>
  );
}

function DraggablePanel({ children, planner }: { children: ReactNode; planner: ReturnType<typeof usePlanner> }) {
  const settings = planner.state.settings;
  const [position, setPosition] = useState(() => settings.popupPosition);
  const dragOffset = useRef({ x: 0, y: 0 });
  const positionRef = useRef(position);

  useEffect(() => {
    const next = clampPopupPosition(settings.popupPosition);
    positionRef.current = next;
    setPosition(next);
  }, [settings.popupPosition.x, settings.popupPosition.y]);

  const startDrag = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    const panel = event.currentTarget.closest('.draggable-panel') as HTMLElement | null;
    const rect = panel?.getBoundingClientRect();
    dragOffset.current = {
      x: event.clientX - (rect?.left ?? position.x),
      y: event.clientY - (rect?.top ?? position.y)
    };

    const move = (moveEvent: MouseEvent) => {
      const width = panel?.offsetWidth ?? 420;
      const height = panel?.offsetHeight ?? 560;
      const nextPosition = {
        x: Math.min(Math.max(0, moveEvent.clientX - dragOffset.current.x), Math.max(0, window.innerWidth - width)),
        y: Math.min(Math.max(0, moveEvent.clientY - dragOffset.current.y), Math.max(0, window.innerHeight - height))
      };
      positionRef.current = nextPosition;
      setPosition(nextPosition);
    };

    const stop = () => {
      planner.updateSettings({ ...planner.state.settings, popupPosition: clampPopupPosition(positionRef.current) });
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', stop);
    };

    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', stop);
  };

  return (
    <div className="draggable-panel" style={{ transform: `translate(${position.x}px, ${position.y}px)` }} onMouseDown={(event) => event.stopPropagation()}>
      <div className="drag-handle" onMouseDown={startDrag} role="button" tabIndex={0} title="Move Popup" aria-label="Move Popup">
        <GripHorizontal size={18} />
      </div>
      {children}
    </div>
  );
}

function clampPopupPosition(position: { x: number; y: number }) {
  return {
    x: Math.min(Math.max(0, position.x), Math.max(0, window.innerWidth - 240)),
    y: Math.min(Math.max(0, position.y), Math.max(0, window.innerHeight - 160))
  };
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
          {value.frequency === 'weekly' && (
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
      <input
        aria-label={`${name} minute`}
        className="minute-input"
        max="59"
        min="0"
        type="number"
        value={minute}
        onChange={(event) => onMinuteChange(wrapMinute(Number(event.target.value)))}
      />
      <select aria-label={`${name} AM PM`} className="meridiem-select" value={meridiem} onChange={(event) => onMeridiemChange(event.target.value as 'AM' | 'PM')}>
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
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
      {!expanded && childArray.length > 0 && <p className="hidden-count">{childArray.length} Hidden</p>}
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

function getTaskListCopy(showTasks: boolean, showEvents: boolean): { title: string; detail: string } {
  if (showTasks && showEvents) {
    return {
      title: 'Tasks And Events',
      detail: 'Plan work and scheduled events from one checklist.'
    };
  }

  if (showEvents) {
    return {
      title: 'Calendar Events',
      detail: 'Scheduled events shown as checklist items.'
    };
  }

  if (showTasks) {
    return {
      title: 'Tasks',
      detail: 'Action items organized by timing and completion.'
    };
  }

  return {
    title: 'No Items Shown',
    detail: 'Turn on tasks or events to populate this list.'
  };
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

function toDraft(start: Date, end = addMinutes(start, 30), event?: CalendarEvent, defaultColor = eventColors[0]): EventDraft {
  return {
    title: event?.title ?? '',
    notes: event?.notes ?? '',
    startDate: format(start, 'yyyy-MM-dd'),
    start: format(start, 'HH:mm'),
    endDate: format(end, 'yyyy-MM-dd'),
    end: format(end, 'HH:mm'),
    allDay: event?.allDay ?? false,
    importance: event?.importance ?? 'normal',
    color: event?.color ?? defaultColor,
    recurrence: parseRecurrenceRule(event?.recurrenceRule)
  };
}

function toTaskDraft(start: Date, end = addMinutes(start, 30), defaultColor = '#2f5597', hasStartTime = false, allDay = false): TaskDraft {
  return {
    title: '',
    notes: '',
    hasStartTime,
    startDate: format(start, 'yyyy-MM-dd'),
    startHour: format(start, 'h'),
    startMinute: format(start, 'mm'),
    startMeridiem: format(start, 'a') as 'AM' | 'PM',
    endDate: format(end, 'yyyy-MM-dd'),
    endHour: format(end, 'h'),
    endMinute: format(end, 'mm'),
    endMeridiem: format(end, 'a') as 'AM' | 'PM',
    allDay,
    priority: 'normal',
    color: defaultColor,
    recurrence: { frequency: 'none', interval: 1 }
  };
}

function toTaskDraftFromTask(task: Task, defaultColor = '#2f5597'): TaskDraft {
  const end = task.endsAt ?? task.dueAt ?? new Date().toISOString();
  const draft = toTaskDraft(task.startsAt ? parseISO(task.startsAt) : parseISO(end), parseISO(end), task.color ?? defaultColor);
  return {
    ...draft,
    title: task.title,
    notes: task.notes,
    hasStartTime: Boolean(task.startsAt),
    allDay: task.allDay,
    priority: task.priority,
    color: task.color ?? defaultColor,
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
    weekdays: recurrence.frequency === 'weekly' && recurrence.weekdays?.length ? recurrence.weekdays : undefined,
    months: recurrence.frequency === 'monthly' && recurrence.months?.length ? recurrence.months : undefined
  });
}

function timeStringToParts(value: string): { hour: string; minute: string; meridiem: 'AM' | 'PM' } {
  const [hourText = '0', minuteText = '0'] = value.split(':');
  const hour24 = Number(hourText);
  return {
    hour: String(hour24 % 12 || 12),
    minute: wrapMinute(Number(minuteText)),
    meridiem: hour24 >= 12 ? 'PM' : 'AM'
  };
}

function partsToTimeString(hour: string, minute: string, meridiem: 'AM' | 'PM'): string {
  const hourNumber = Number(hour);
  const normalizedHour = meridiem === 'AM' ? hourNumber % 12 : (hourNumber % 12) + 12;
  return `${String(normalizedHour).padStart(2, '0')}:${wrapMinute(Number(minute))}`;
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
  return `${format(start, 'MMM d, yyyy h:mm a')} - ${format(end, isSameDay(start, end) ? 'h:mm a' : 'MMM d, yyyy h:mm a')}`;
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
