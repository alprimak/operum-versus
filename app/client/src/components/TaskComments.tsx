import React, { useState, useEffect } from 'react';

interface Comment {
  id: string;
  content: string;
  author_name: string;
  created_at: string;
}

interface TaskCommentsProps {
  taskId: string;
  projectMembers?: Array<{ id: string; name: string }>;
}

export function TaskComments({ taskId, projectMembers = [] }: TaskCommentsProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
  const token = localStorage.getItem('accessToken');

  useEffect(() => {
    fetchComments();
  }, [taskId]);

  async function fetchComments() {
    const res = await fetch(`${apiUrl}/comments/task/${taskId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setComments(data.comments);
    }
  }

  async function submitComment() {
    if (!newComment.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/comments/task/${taskId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: newComment }),
      });
      if (res.ok) {
        setNewComment('');
        await fetchComments();
      }
    } finally {
      setLoading(false);
    }
  }

  async function deleteComment(commentId: string) {
    await fetch(`${apiUrl}/comments/${commentId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    setComments(prev => prev.filter(c => c.id !== commentId));
  }

  return (
    <div className="mt-4">
      <h4 className="text-sm font-medium text-gray-700 mb-2">Comments</h4>
      <div className="space-y-2 mb-3">
        {comments.map(comment => (
          <div key={comment.id} className="bg-gray-50 rounded p-2 text-sm">
            <div className="flex justify-between items-center mb-1">
              <span className="font-medium text-gray-700">{comment.author_name}</span>
              <button
                onClick={() => deleteComment(comment.id)}
                className="text-xs text-red-400 hover:text-red-600"
              >
                Delete
              </button>
            </div>
            <p className="text-gray-600 whitespace-pre-wrap">{comment.content}</p>
          </div>
        ))}
        {comments.length === 0 && (
          <p className="text-sm text-gray-400">No comments yet.</p>
        )}
      </div>
      <div className="flex gap-2">
        <textarea
          value={newComment}
          onChange={e => setNewComment(e.target.value)}
          placeholder="Add a comment... Use @name to mention someone"
          className="border rounded px-2 py-1 text-sm flex-1 resize-none"
          rows={2}
          onKeyDown={e => {
            if (e.key === 'Enter' && e.ctrlKey) submitComment();
          }}
        />
        <button
          onClick={submitComment}
          disabled={loading || !newComment.trim()}
          className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 self-end"
        >
          {loading ? '...' : 'Post'}
        </button>
      </div>
    </div>
  );
}
