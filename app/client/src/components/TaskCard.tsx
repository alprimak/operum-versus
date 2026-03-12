import React from 'react';

interface TaskCardProps {
  task: {
    id: string;
    title: string;
    description?: string;
    status: string;
    priority: string;
    assignee_name?: string;
    due_date?: string;
  };
  onStatusChange: (taskId: string, status: string) => void;
  onAssigneeChange: (taskId: string, assigneeId: string | null) => void;
}

const statusColors: Record<string, string> = {
  todo: 'bg-gray-100 text-gray-800',
  in_progress: 'bg-blue-100 text-blue-800',
  review: 'bg-yellow-100 text-yellow-800',
  done: 'bg-green-100 text-green-800',
};

const priorityColors: Record<string, string> = {
  low: 'bg-gray-50 text-gray-600',
  medium: 'bg-blue-50 text-blue-600',
  high: 'bg-orange-50 text-orange-600',
  urgent: 'bg-red-50 text-red-600',
};

function parseDateUTC(dateStr: string): Date {
  // Parse date-only strings (YYYY-MM-DD) as UTC to avoid timezone offset shifting the day
  const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatDueDate(dateStr: string): string {
  const date = parseDateUTC(dateStr);
  return date.toLocaleDateString(undefined, { timeZone: 'UTC' });
}

function isDueDateOverdue(dateStr: string): boolean {
  const dueDate = parseDateUTC(dateStr);
  // Compare against today at UTC midnight
  const today = new Date();
  const todayUTC = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  return dueDate < todayUTC;
}

export function TaskCard({ task, onStatusChange, onAssigneeChange }: TaskCardProps) {
  const isOverdue = task.due_date && task.status !== 'done' && isDueDateOverdue(task.due_date);

  return (
    <div className="border rounded-lg p-4 bg-white shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-medium text-gray-900">{task.title}</h3>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${priorityColors[task.priority]}`}>
          {task.priority}
        </span>
      </div>

      {task.description && (
        <p className="text-sm text-gray-600 mb-3">{task.description}</p>
      )}

      <div className="flex items-center gap-3 text-sm">
        <select
          value={task.status}
          onChange={(e) => onStatusChange(task.id, e.target.value)}
          className={`px-2 py-1 rounded text-xs font-medium ${statusColors[task.status]}`}
        >
          <option value="todo">Todo</option>
          <option value="in_progress">In Progress</option>
          <option value="review">Review</option>
          <option value="done">Done</option>
        </select>

        {task.assignee_name && (
          <span className="text-gray-500">
            {task.assignee_name}
          </span>
        )}

        {task.due_date && (
          <span className={`${isOverdue ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
            {formatDueDate(task.due_date)}
          </span>
        )}
      </div>
    </div>
  );
}
