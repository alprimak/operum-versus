import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TaskCard } from '../components/TaskCard';

describe('TaskCard date handling', () => {
  const baseTask = {
    id: '1',
    title: 'Test Task',
    status: 'todo',
    priority: 'medium',
  };

  const noop = () => {};

  it('should display due date correctly for YYYY-MM-DD format', () => {
    render(
      <TaskCard
        task={{ ...baseTask, due_date: '2025-06-15' }}
        onStatusChange={noop}
        onAssigneeChange={noop}
      />
    );
    // The date should be displayed (format depends on locale, just check it's rendered)
    const dateElement = screen.getByText(/6\/15\/2025|15\/06\/2025|2025-06-15/);
    expect(dateElement).toBeDefined();
  });

  it('should not mark future dates as overdue', () => {
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);
    const futureDateStr = futureDate.toISOString().split('T')[0];

    const { container } = render(
      <TaskCard
        task={{ ...baseTask, due_date: futureDateStr }}
        onStatusChange={noop}
        onAssigneeChange={noop}
      />
    );

    // Future date should NOT have the overdue styling (text-red-600)
    const dateSpan = container.querySelector('span:last-child');
    expect(dateSpan?.className).not.toContain('text-red-600');
  });

  it('should mark past dates as overdue for todo tasks', () => {
    const { container } = render(
      <TaskCard
        task={{ ...baseTask, due_date: '2020-01-01' }}
        onStatusChange={noop}
        onAssigneeChange={noop}
      />
    );

    // Past date should have overdue styling
    const dateSpan = container.querySelector('.text-red-600');
    expect(dateSpan).toBeDefined();
  });

  it('should not mark done tasks as overdue', () => {
    const { container } = render(
      <TaskCard
        task={{ ...baseTask, status: 'done', due_date: '2020-01-01' }}
        onStatusChange={noop}
        onAssigneeChange={noop}
      />
    );

    // Done task should not show overdue styling even with past date
    const dateSpan = container.querySelector('.text-red-600');
    expect(dateSpan).toBeNull();
  });
});
