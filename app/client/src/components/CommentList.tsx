import React, { useState } from 'react';

interface Comment {
  id: string;
  content: string;
  user_name: string;
  user_id: string;
  created_at: string;
}

interface ProjectMember {
  user_id: string;
  name: string;
}

interface CommentListProps {
  comments: Comment[];
  members: ProjectMember[];
  currentUserId: string;
  onAddComment: (content: string) => void;
  onDeleteComment: (id: string) => void;
}

export function CommentList({
  comments,
  members,
  currentUserId,
  onAddComment,
  onDeleteComment,
}: CommentListProps) {
  const [input, setInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<ProjectMember[]>([]);

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value;
    setInput(value);

    // Check for @mention trigger
    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = value.slice(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

    if (mentionMatch) {
      const query = mentionMatch[1].toLowerCase();
      const filtered = members.filter(
        (m) => m.name.toLowerCase().includes(query) && m.user_id !== currentUserId
      );
      setSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setShowSuggestions(false);
    }
  }

  function insertMention(member: ProjectMember) {
    const mentionMatch = input.match(/@(\w*)$/);
    if (mentionMatch) {
      const beforeMention = input.slice(0, input.length - mentionMatch[0].length);
      setInput(`${beforeMention}@${member.name} `);
    }
    setShowSuggestions(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (input.trim()) {
      onAddComment(input.trim());
      setInput('');
    }
  }

  return (
    <div className="mt-4">
      <h4 className="text-sm font-medium text-gray-700 mb-2">Comments</h4>

      <div className="space-y-3 mb-3">
        {comments.map((comment) => (
          <div key={comment.id} className="bg-gray-50 rounded p-3">
            <div className="flex justify-between items-start">
              <span className="text-sm font-medium">{comment.user_name}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">
                  {new Date(comment.created_at).toLocaleString()}
                </span>
                {comment.user_id === currentUserId && (
                  <button
                    onClick={() => onDeleteComment(comment.id)}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
            <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">
              {comment.content}
            </p>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="relative">
        <textarea
          value={input}
          onChange={handleInputChange}
          placeholder="Add a comment... Use @name to mention someone"
          className="w-full border rounded p-2 text-sm resize-none"
          rows={2}
        />
        {showSuggestions && (
          <div className="absolute bottom-full mb-1 bg-white border rounded shadow-lg z-10">
            {suggestions.map((member) => (
              <button
                key={member.user_id}
                type="button"
                onClick={() => insertMention(member)}
                className="block w-full text-left px-3 py-1 text-sm hover:bg-blue-50"
              >
                {member.name}
              </button>
            ))}
          </div>
        )}
        <button
          type="submit"
          disabled={!input.trim()}
          className="mt-1 px-3 py-1 bg-blue-600 text-white text-sm rounded disabled:opacity-50"
        >
          Comment
        </button>
      </form>
    </div>
  );
}
