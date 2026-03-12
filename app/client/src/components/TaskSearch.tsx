import React, { useState } from 'react';

interface TaskSearchProps {
  onSearch: (filters: {
    q?: string;
    status?: string;
    priority?: string;
    assignee?: string;
  }) => void;
  members?: { user_id: string; name: string }[];
}

export function TaskSearch({ onSearch, members = [] }: TaskSearchProps) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [assignee, setAssignee] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSearch({
      q: query || undefined,
      status: status || undefined,
      priority: priority || undefined,
      assignee: assignee || undefined,
    });
  }

  function handleClear() {
    setQuery('');
    setStatus('');
    setPriority('');
    setAssignee('');
    onSearch({});
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap gap-2 items-end mb-4">
      <div>
        <label className="block text-xs text-gray-500">Search</label>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tasks..."
          className="border rounded px-2 py-1 text-sm"
        />
      </div>

      <div>
        <label className="block text-xs text-gray-500">Status</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="border rounded px-2 py-1 text-sm"
        >
          <option value="">All</option>
          <option value="todo">Todo</option>
          <option value="in_progress">In Progress</option>
          <option value="review">Review</option>
          <option value="done">Done</option>
        </select>
      </div>

      <div>
        <label className="block text-xs text-gray-500">Priority</label>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="border rounded px-2 py-1 text-sm"
        >
          <option value="">All</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
      </div>

      {members.length > 0 && (
        <div>
          <label className="block text-xs text-gray-500">Assignee</label>
          <select
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
          >
            <option value="">All</option>
            {members.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <button type="submit" className="px-3 py-1 bg-blue-600 text-white text-sm rounded">
        Search
      </button>
      <button type="button" onClick={handleClear} className="px-3 py-1 bg-gray-200 text-sm rounded">
        Clear
      </button>
    </form>
  );
}
