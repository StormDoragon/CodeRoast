import React, { useState } from 'react';

interface ChatInputProps {
  onSubmit: (text: string) => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({ onSubmit }) => {
  const [text, setText] = useState('');
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSubmit(text.trim());
    setText('');
  };
  return (
    <form onSubmit={handleSubmit} className="flex">
      <input
        className="flex-1 border p-2"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Ask about the code..."
      />
      <button type="submit" className="ml-2 px-4 py-2 bg-blue-500 text-white rounded">
        Send
      </button>
    </form>
  );
};