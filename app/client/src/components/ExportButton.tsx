import React from 'react';

interface ExportButtonProps {
  projectId: string;
}

export function ExportButton({ projectId }: ExportButtonProps) {
  const handleExport = async () => {
    const token = localStorage.getItem('accessToken');
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

    const res = await fetch(`${apiUrl}/projects/${projectId}/export/csv`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      alert('Export failed. Make sure you are a project member.');
      return;
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tasks-${projectId}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <button
      onClick={handleExport}
      className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
    >
      Export CSV
    </button>
  );
}
