import React, { useRef, useEffect } from 'react';
import ChatMessage from './ChatMessage';
import { Message, Source, DepartmentId } from '../types';
import { DEPARTMENTS } from '../constants';

interface ChatAreaProps {
  messages: Message[];
  selectedDepartment: DepartmentId;
  onViewSource: (source: Source, highlightText?: string) => void;
  onEditMessage: (messageId: string, newContent: string) => void;
  onRegenerateMessage: (messageId: string) => void;
  departments?: typeof DEPARTMENTS;
}

const ChatArea: React.FC<ChatAreaProps> = ({
  messages,
  selectedDepartment,
  onViewSource,
  onEditMessage,
  onRegenerateMessage,
  departments = DEPARTMENTS,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const currentDept = departments.find(d => d.id === selectedDepartment);
  const DepartmentIcon = currentDept?.icon;

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 custom-scrollbar scroll-smooth">
      <div className="max-w-3xl mx-auto pb-4">
        {messages.length === 0 ? (
          <div className="h-[60vh] flex flex-col items-center justify-center text-center opacity-50">
            <div className="w-16 h-16 bg-gray-200 rounded-2xl mb-4 flex items-center justify-center">
              {DepartmentIcon && <DepartmentIcon className={`w-8 h-8 ${currentDept?.color || 'text-gray-400'}`} />}
            </div>
            <h3 className="text-xl font-semibold text-gray-700">Национальная LLM</h3>
            <p className="text-sm text-gray-500 mt-2 max-w-xs">
              Отдел: {currentDept?.name}<br />
              Задайте вопрос по внутренним документам или процессам.
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <ChatMessage
              key={msg.id}
              message={msg}
              onViewSource={onViewSource}
              onEditMessage={onEditMessage}
              onRegenerateMessage={onRegenerateMessage}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};

export default ChatArea;
