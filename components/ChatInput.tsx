import React, { useRef, useEffect } from 'react';
import { Plus, Mic, ArrowUp } from 'lucide-react';
import { DepartmentId } from '../types';
import { DEPARTMENTS } from '../constants';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onAddSource: () => void;
  isGenerating: boolean;
  selectedDepartment: DepartmentId;
  departments?: typeof DEPARTMENTS;
}

const ChatInput: React.FC<ChatInputProps> = ({
  value,
  onChange,
  onSubmit,
  onAddSource,
  isGenerating,
  selectedDepartment,
  departments = DEPARTMENTS,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const currentDept = departments.find(d => d.id === selectedDepartment);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(scrollHeight, 200)}px`;
    }
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  const handleSubmit = () => {
    onSubmit();
    // Reset textarea height after submit
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  return (
    <div className="p-4 bg-transparent z-20">
      <div className="max-w-3xl mx-auto">
        <div className="relative bg-[#f4f4f4] rounded-[26px] flex items-end p-2 transition-all duration-300">

          {/* Left Action (Plus) */}
          <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center mb-0.5 group relative">
            <button
              type="button"
              onClick={onAddSource}
              className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-200 rounded-full transition-colors outline-none focus:outline-none"
            >
              <Plus className="w-5 h-5" />
            </button>
            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-belhard-blue text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
              Добавить файл
            </div>
          </div>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Вопрос в отдел "${currentDept?.name}"...`}
            className="w-full max-h-[200px] py-3 px-2 bg-transparent border-none outline-none focus:ring-0 focus:outline-none ring-0 shadow-none text-gray-900 placeholder-gray-500 resize-none overflow-y-auto leading-6 custom-scrollbar text-base"
            rows={1}
          />

          {/* Right Actions */}
          <div className="flex items-center gap-1 mb-0.5 shrink-0 pr-1">
            {/* Mic Button */}
            <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center group relative">
              <button
                className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-200 rounded-full transition-colors outline-none focus:outline-none"
              >
                <Mic className="w-5 h-5" />
              </button>
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-belhard-blue text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                Диктовка
              </div>
            </div>

            {/* Send Button */}
            <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center group relative">
              <button
                onClick={handleSubmit}
                disabled={!value.trim() || isGenerating}
                className={`w-8 h-8 rounded-full transition-all duration-200 flex items-center justify-center outline-none focus:outline-none ${
                  value.trim() && !isGenerating
                    ? 'bg-belhard-blue text-white hover:bg-belhard-dark'
                    : 'bg-gray-300 text-gray-100 cursor-not-allowed'
                }`}
              >
                <ArrowUp className="w-5 h-5" />
              </button>
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-belhard-blue text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                Отправить
              </div>
            </div>
          </div>
        </div>

        <div className="text-center mt-3 text-[10px] text-gray-400">
          Belhard AI может ошибаться. Сверяйте информацию с <span className="font-semibold text-gray-500 cursor-pointer hover:underline">источниками</span>.
        </div>
      </div>
    </div>
  );
};

export default ChatInput;
