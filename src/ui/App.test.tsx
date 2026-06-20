import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  });

  it('renders the dashboard and can add a task', async () => {
    render(<App />);

    expect(await screen.findByText('Dashboard')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Tasks/i }));
    expect(screen.queryByPlaceholderText('Task title')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Add task/i }));
    await userEvent.type(screen.getByPlaceholderText('Task title'), 'Take medication');
    const addTaskButtons = screen.getAllByRole('button', { name: /Add task/i });
    await userEvent.click(addTaskButtons[addTaskButtons.length - 1]);

    await waitFor(() => expect(screen.getByText('Take medication')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /Mark Take medication complete/i }));
    await userEvent.click(screen.getByRole('button', { name: /^completed$/i }));
    await userEvent.click(await screen.findByRole('button', { name: /Mark Take medication incomplete/i }));
    await userEvent.click(screen.getByRole('button', { name: /^today$/i }));
    expect(await screen.findByRole('button', { name: /Mark Take medication complete/i })).toBeInTheDocument();
  });

  it('hides timer stop and complete actions until a timer starts', async () => {
    render(<App />);

    await screen.findByText('Dashboard');
    await userEvent.click(screen.getByRole('button', { name: /Timer/i }));

    expect(screen.queryByRole('button', { name: /Stop/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Complete/i })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Start timer/i }));

    expect(await screen.findByText(/session/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Stop/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Complete/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Complete/i }));
    expect(await screen.findByText(/Timer complete/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Start another/i })).toBeInTheDocument();
  });

  it('adds calendar events and shows them in upcoming and tasks', async () => {
    render(<App />);

    await screen.findByText('Dashboard');
    await userEvent.click(screen.getByRole('button', { name: /Calendar/i }));

    await userEvent.click(screen.getByRole('button', { name: /New event/i }));
    await userEvent.type(screen.getByPlaceholderText('Event title'), 'Math class');
    const startDateInput = document.querySelector('input[name="startDate"]') as HTMLInputElement;
    const endDateInput = document.querySelector('input[name="endDate"]') as HTMLInputElement;
    await userEvent.clear(startDateInput);
    await userEvent.type(startDateInput, '2026-06-21');
    await userEvent.clear(endDateInput);
    await userEvent.type(endDateInput, '2026-06-21');
    await userEvent.click(screen.getByRole('button', { name: /Add event/i }));

    await userEvent.click(screen.getByRole('button', { name: /Dashboard/i }));
    expect(screen.getByText('Math class')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Tasks/i }));
    await userEvent.click(screen.getByRole('button', { name: /^upcoming$/i }));
    expect(screen.getByText('Math class')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Mark Math class complete/i }));
    expect(screen.getByRole('button', { name: /Mark Math class incomplete/i })).toBeInTheDocument();
  });

  it('can reset planner data from settings', async () => {
    render(<App />);

    await screen.findByText('Dashboard');
    await userEvent.click(screen.getByRole('button', { name: /Tasks/i }));
    await userEvent.click(screen.getByRole('button', { name: /Add task/i }));
    await userEvent.type(screen.getByPlaceholderText('Task title'), 'Temporary task');
    const addTaskButtons = screen.getAllByRole('button', { name: /Add task/i });
    await userEvent.click(addTaskButtons[addTaskButtons.length - 1]);
    expect(await screen.findByText('Temporary task')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Settings/i }));
    await userEvent.click(screen.getByRole('button', { name: /Reset test data/i }));
    await userEvent.click(screen.getByRole('button', { name: /Tasks/i }));
    expect(screen.queryByText('Temporary task')).not.toBeInTheDocument();
  });
});
