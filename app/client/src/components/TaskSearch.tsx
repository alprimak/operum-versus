import React, { useState } from 'react';

interface TaskSearchProps {
  projectId: string;
  onResults: (tasks: any[]) => void;
}

export function TaskSearch({ projectId, onResults }: TaskSearchProps) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');

  const handleSearch = async () => {
    const token = localStorage.getItem('accessToken');
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

    const params = new URLSearchParams({ project_id: projectId });
    if (query) params.set('query', query);
    if (status) params.set('status', status);
    if (priority) params.set('priority', priority);

    const res = await fetch(`${apiUrl}/tasks/search?${params}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (res.ok) {
      const data = await res.json();
      onResults(data.tasks);
    }
  };

  const handleClear = () => {
    setQuery('');
    setStatus('');
    setPriority('');
    onResults([]);
  };

  return (
    <div className="flex gap-2 items-center flex-wrap">
      <input
        type="text"
        placeholder="Search tasks..."
        value={query}
        onChange={e => setQuery(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleSearch()}
        className="border rounded px-3 py-1.5 text-sm flex-1 min-w-48"
      />
      <select
        value={status}
        onChange={e => setStatus(e.target.value)}
        className="border rounded px-2 py-1.5 text-sm"
      >
        <option value="">All Statuses</option>
        <option value="todo">Todo</option>
        <option value="in_progress">In Progress</option>
        <option value="review">Review</option>
        <option value="done">Done</option>
      </select>
      <select
        value={priority}
        onChange={e => setPriority(e.target.value)}
        className="border rounded px-2 py-1.5 text-sm"
      >
        <option value="">All Priorities</option>
        <option value="low">Low</option>
        <option value="medium">Medium</option>
        <option value="high">High</option>
        <option value="urgent">Urgent</option>
      </select>
      <button
        onClick={handleSearch}
        className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Search
      </button>
      <button
        onClick={handleClear}
        className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
      >
        Clear
      </button>
    </div>
  );
}
