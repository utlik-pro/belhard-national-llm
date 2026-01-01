import React, { useState, useEffect } from 'react';
import { X, FileText, FileSpreadsheet, Globe, Cpu, CheckCircle } from 'lucide-react';
import { Source } from '../types';

interface DocumentEditorProps {
  source?: Source | null; // If null, we are creating new
  onSave: (source: Source) => void;
  onClose: () => void;
}

const DocumentEditor: React.FC<DocumentEditorProps> = ({ source, onSave, onClose }) => {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<Source['type']>('DOC');
  const [citation, setCitation] = useState('');
  const [content, setContent] = useState('');

  const [isIndexing, setIsIndexing] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (source) {
      setTitle(source.title);
      setType(source.type);
      setCitation(source.citation || '');
      setContent(source.fullContent || source.preview || '');
    }
  }, [source]);

  const handleSave = () => {
    if (!title || !content) return;

    // Simulate Indexing Process
    setIsIndexing(true);
    let currentProgress = 0;
    const interval = setInterval(() => {
      currentProgress += Math.random() * 15;
      if (currentProgress >= 100) {
        currentProgress = 100;
        clearInterval(interval);

        // Finalize save
        setTimeout(() => {
            // Generate citation from title if not provided
            const finalCitation = citation.trim() ||
                                  title.replace(/\.(pdf|doc|docx|txt|xlsx)$/i, '').substring(0, 30);

            const newSource: Source = {
                id: source?.id || Date.now().toString(),
                title,
                type,
                citation: finalCitation,
                url: '#',
                preview: content.substring(0, 150) + '...',
                fullContent: content
            };
            onSave(newSource);
            onClose();
        }, 500);
      }
      setProgress(currentProgress);
    }, 200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-up">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-bold text-gray-800">
            {source ? 'Редактирование документа' : 'Добавление в Базу Знаний'}
          </h2>
          <button onClick={onClose} className="p-2 text-gray-500 hover:bg-gray-200 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <div className="p-6 space-y-4">
          
          {/* Title & Type */}
          <div className="grid grid-cols-3 gap-4">
             <div className="col-span-2 space-y-1">
                <label className="text-xs font-semibold text-gray-500 uppercase">Название документа</label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Например: Стратегия_2025.pdf"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-belhard-blue/20 outline-none"
                />
             </div>
             <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500 uppercase">Тип</label>
                <select
                  value={type}
                  onChange={e => setType(e.target.value as any)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-belhard-blue/20 outline-none"
                >
                    <option value="DOC">DOC / Текст</option>
                    <option value="PDF">PDF Документ</option>
                    <option value="XLSX">Таблица Excel</option>
                    <option value="WEB">Веб-страница</option>
                </select>
             </div>
          </div>

          {/* Citation Field */}
          <div className="space-y-1">
             <label className="text-xs font-semibold text-gray-500 uppercase">
                Короткое название для цитирования
             </label>
             <input
               type="text"
               value={citation}
               onChange={e => setCitation(e.target.value)}
               placeholder="Например: Сотрудники, Список_2025, Регламент"
               className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-belhard-blue/20 outline-none"
             />
             <p className="text-xs text-gray-400 mt-1">
               AI будет использовать это название в цитатах. Если оставить пустым, будет использоваться название документа.
             </p>
          </div>

          {/* Content Area */}
          <div className="space-y-1">
             <label className="text-xs font-semibold text-gray-500 uppercase flex justify-between">
                <span>Содержание документа (Для индексации)</span>
                <span className="text-belhard-blue font-normal lowercase">{content.length} симв.</span>
             </label>
             <textarea 
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="Вставьте полный текст документа здесь. Нейросеть проиндексирует его для поиска..."
                className="w-full h-64 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-belhard-blue/20 outline-none resize-none custom-scrollbar text-sm leading-relaxed"
             />
          </div>

        </div>

        {/* Footer / Status */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          {isIndexing ? (
             <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-belhard-blue uppercase">
                    <span className="flex items-center gap-2">
                        <Cpu className="w-4 h-4 animate-spin" />
                        Создание векторных эмбеддингов...
                    </span>
                    <span>{Math.round(progress)}%</span>
                </div>
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                        className="h-full bg-belhard-blue transition-all duration-200"
                        style={{ width: `${progress}%` }}
                    />
                </div>
             </div>
          ) : (
            <div className="flex justify-end gap-3">
               <button 
                 onClick={onClose}
                 className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
               >
                 Отмена
               </button>
               <button
                 onClick={handleSave}
                 disabled={!title || !content}
                 className="flex items-center gap-2 px-6 py-2 text-sm font-bold text-white bg-belhard-blue hover:bg-belhard-dark rounded-lg shadow-lg shadow-belhard-blue/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
               >
                 <CheckCircle className="w-4 h-4" />
                 Сохранить и Индексировать
               </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default DocumentEditor;