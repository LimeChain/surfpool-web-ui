'use client';

import { useState } from 'react';

interface DraftFieldProps {
  initialValue: string;
  onCommit: (value: string) => void;
  onDone: () => void;
  multiline?: boolean;
  allowEmpty?: boolean;
  rows?: number;
  className?: string;
}

/**
 * Inline edit field that keeps the draft local and commits once on blur/Enter.
 * Committing on every keystroke fires a backend request per character and
 * re-renders the edited entity under the user's cursor.
 */
export default function DraftField({
  initialValue,
  onCommit,
  onDone,
  multiline = false,
  allowEmpty = false,
  rows,
  className = '',
}: DraftFieldProps) {
  // STATE
  const [draft, setDraft] = useState(initialValue);

  // HANDLERS
  const commit = () => {
    const value = draft.trim();
    if (value !== initialValue.trim() && (value || allowEmpty)) {
      onCommit(value);
    }
    onDone();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (!multiline || !e.shiftKey)) {
      e.preventDefault();
      commit();
    }
    if (e.key === 'Escape') {
      // The scenario detail pane closes on window-level Escape
      e.stopPropagation();
      onDone();
    }
  };

  if (multiline) {
    return (
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        autoFocus
        rows={rows}
        className={className}
      />
    );
  }

  return (
    <input
      type="text"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={handleKeyDown}
      autoFocus
      className={className}
    />
  );
}
