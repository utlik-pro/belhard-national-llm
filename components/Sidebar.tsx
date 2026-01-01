
import React, { useState } from 'react';
import { Plus, Search, MessageSquare, Settings, LogOut, LayoutGrid, Database, FileText, UploadCloud, Edit2, Trash2, X, MoreVertical, Archive } from 'lucide-react';
import { ChatSession, Source } from '../types';

interface SidebarProps {
  isOpen: boolean;
  onClose?: () => void;
  history: ChatSession[];
  activeChatId: string | null;
  sources: Source[];
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
  onLogout: () => void;
  onViewDocument: (source: Source) => void;
  onAddSource: () => void;
  onEditSource: (source: Source) => void;
  onDeleteSource: (id: string) => void;
  onDeleteChat: (id: string) => void;
  onArchiveChat: (id: string) => void;
  onRenameChat: (id: string, newTitle: string) => void;
}

type ViewMode = 'chats' | 'knowledge';

const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  history,
  activeChatId,
  sources,
  onSelectChat,
  onNewChat,
  onLogout,
  onViewDocument,
  onAddSource,
  onEditSource,
  onDeleteSource,
  onDeleteChat,
  onArchiveChat,
  onRenameChat
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('chats');
  const [showArchived, setShowArchived] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [renamingChatId, setRenamingChatId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: 'delete' | 'archive' | 'restore';
    chatId: string;
    chatTitle: string;
  } | null>(null);

  const handleConfirmAction = () => {
    if (!confirmModal) return;

    if (confirmModal.type === 'delete') {
      onDeleteChat(confirmModal.chatId);
    } else if (confirmModal.type === 'archive' || confirmModal.type === 'restore') {
      onArchiveChat(confirmModal.chatId);
      // After restoring, switch back to main chats view
      if (confirmModal.type === 'restore') {
        setShowArchived(false);
      }
    }

    setConfirmModal(null);
    setOpenMenuId(null);
  };

  return (
    <React.Fragment>
    <div className={`
      fixed inset-y-0 left-0 z-50 w-80 bg-[#F8F9FA] border-r border-gray-200 flex flex-col transition-transform duration-300 transform shadow-xl lg:shadow-none
      ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      lg:relative lg:translate-x-0
    `}>
      {/* Header */}
      <div className="p-4 h-16 flex items-center justify-between border-b border-gray-100 bg-white/50 backdrop-blur-sm">
        <div className="flex items-center gap-2 text-belhard-blue font-bold text-xl tracking-tight">
          <div className="w-8 h-8 bg-belhard-blue rounded-lg flex items-center justify-center text-white shadow-sm">
            <LayoutGrid className="w-5 h-5" />
          </div>
          Belhard AI
        </div>
        {/* Mobile Close Button */}
        <button 
          onClick={onClose}
          className="lg:hidden p-2 text-gray-500 hover:bg-gray-200 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Action Button */}
      <div className="p-4">
        {viewMode === 'chats' ? (
            <button 
                onClick={onNewChat}
                className="w-full py-3 px-4 bg-white border border-gray-200 hover:border-belhard-blue hover:shadow-md text-gray-700 hover:text-belhard-blue font-medium rounded-xl flex items-center gap-3 transition-all duration-200 group"
            >
                <div className="p-1 bg-belhard-light text-belhard-blue rounded-lg group-hover:bg-belhard-blue group-hover:text-white transition-colors">
                <Plus className="w-5 h-5" />
                </div>
                Новый чат
            </button>
        ) : (
            <button 
                onClick={onAddSource}
                className="w-full py-3 px-4 bg-belhard-blue border border-transparent hover:bg-belhard-dark hover:shadow-md text-white font-medium rounded-xl flex items-center gap-3 transition-all duration-200 group"
            >
                <div className="p-1 bg-white/20 text-white rounded-lg">
                <UploadCloud className="w-5 h-5" />
                </div>
                Загрузить документ
            </button>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="px-4 pb-2 mt-2">
         <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 ml-1">
            Разделы
         </div>
         <nav className="space-y-1">
             <button 
                onClick={() => setViewMode('chats')}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  viewMode === 'chats' 
                  ? 'bg-belhard-light text-belhard-blue' 
                  : 'text-gray-600 hover:bg-gray-100'
                }`}
             >
                <MessageSquare className="w-4 h-4" />
                Недавние чаты
             </button>
             <button 
                onClick={() => setViewMode('knowledge')}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  viewMode === 'knowledge' 
                  ? 'bg-belhard-light text-belhard-blue' 
                  : 'text-gray-600 hover:bg-gray-100'
                }`}
             >
                <Database className="w-4 h-4" />
                База знаний
             </button>
         </nav>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1 custom-scrollbar">
        
        {viewMode === 'chats' ? (
          <>
            <div className="px-4 mb-2 mt-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="Поиск по чатам..." 
                  className="w-full pl-9 pr-3 py-2 bg-gray-100 border-none rounded-lg text-sm focus:ring-2 focus:ring-belhard-blue/20 outline-none text-gray-700 placeholder-gray-400"
                />
              </div>
            </div>
            <div className="flex items-center justify-between mb-2 px-2 mt-2">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                {showArchived ? 'Архив' : 'История'}
              </div>
              <button
                onClick={() => setShowArchived(!showArchived)}
                className="text-xs font-medium text-belhard-blue hover:underline"
              >
                {showArchived ? '← Назад' : 'Архив →'}
              </button>
            </div>
            {history.filter(chat => showArchived ? chat.archived : !chat.archived).map((chat) => (
              <div
                key={chat.id}
                className={`w-full rounded-lg text-sm transition-all duration-200 group relative ${
                  activeChatId === chat.id
                    ? 'bg-white shadow-sm border border-gray-100'
                    : 'hover:bg-gray-100'
                }`}
              >
                {renamingChatId === chat.id ? (
                  <div className="p-3">
                    <input
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          onRenameChat(chat.id, renameValue);
                          setRenamingChatId(null);
                        } else if (e.key === 'Escape') {
                          setRenamingChatId(null);
                        }
                      }}
                      onBlur={() => setRenamingChatId(null)}
                      autoFocus
                      className="w-full px-2 py-1 text-sm border border-belhard-blue rounded focus:outline-none focus:ring-2 focus:ring-belhard-blue/20"
                    />
                  </div>
                ) : (
                  <>
                    <div
                      onClick={() => onSelectChat(chat.id)}
                      className="w-full text-left px-3 py-2 pr-12 cursor-pointer"
                    >
                      <div className={`font-medium truncate ${activeChatId === chat.id ? 'text-belhard-blue' : 'text-gray-800'}`}>
                        {chat.title}
                      </div>
                    </div>

                    {/* Three-dot menu button */}
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          console.log('Three dots clicked, chat.id:', chat.id);
                          console.log('Current openMenuId:', openMenuId);
                          setOpenMenuId(openMenuId === chat.id ? null : chat.id);
                        }}
                        className="p-1.5 hover:bg-gray-200 rounded-md text-gray-500 hover:text-gray-700 transition-colors"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Dropdown menu */}
                    {openMenuId === chat.id && (
                      <>
                        {console.log('Rendering menu for chat.id:', chat.id)}
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setOpenMenuId(null)}
                        />
                        <div className="absolute right-2 top-12 w-48 bg-white border border-gray-200 rounded-lg shadow-xl z-50 py-1">
                          {!chat.archived && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setRenameValue(chat.title);
                                setRenamingChatId(chat.id);
                                setOpenMenuId(null);
                              }}
                              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                              Переименовать
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmModal({
                                isOpen: true,
                                type: chat.archived ? 'restore' : 'archive',
                                chatId: chat.id,
                                chatTitle: chat.title
                              });
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                          >
                            <Archive className="w-4 h-4" />
                            {chat.archived ? 'Восстановить' : 'Архивировать'}
                          </button>
                          <div className="border-t border-gray-100 my-1" />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmModal({
                                isOpen: true,
                                type: 'delete',
                                chatId: chat.id,
                                chatTitle: chat.title
                              });
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                            Удалить
                          </button>
                        </div>
                      </>
                    )}

                    {activeChatId === chat.id && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-belhard-blue rounded-r-full"></div>
                    )}
                  </>
                )}
              </div>
            ))}
          </>
        ) : (
          <>
            <div className="px-4 mb-4 mt-2">
                <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-[10px] text-blue-800 leading-relaxed">
                  Индекс обновлен: Только что.<br/>
                  Доступно документов: {sources.length}
                </div>
            </div>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-2">
                Подключенные источники
            </div>
            <div className="space-y-2 pb-4">
              {sources.map((source) => (
                <div 
                  key={source.id} 
                  className="group flex flex-col bg-white border border-gray-200 rounded-lg hover:border-belhard-blue hover:shadow-sm transition-all overflow-hidden"
                >
                  <div 
                    onClick={() => onViewDocument(source)}
                    className="flex items-start p-3 cursor-pointer"
                  >
                    <div className="mt-0.5 p-1.5 bg-gray-50 rounded-md group-hover:bg-belhard-light group-hover:text-belhard-blue transition-colors">
                        <FileText className="w-4 h-4 text-gray-500 group-hover:text-belhard-blue" />
                    </div>
                    <div className="ml-3 flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-800 truncate group-hover:text-belhard-blue transition-colors">
                        {source.title}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded uppercase">
                            {source.type}
                        </span>
                        <span className="text-[10px] text-green-600 font-medium">
                            • Индексировано
                        </span>
                        </div>
                    </div>
                  </div>
                  
                  {/* Quick Actions Panel (Visible on Hover/Focus) */}
                  <div className="flex border-t border-gray-100 divide-x divide-gray-100 h-0 group-hover:h-8 transition-all overflow-hidden opacity-0 group-hover:opacity-100">
                     <button 
                        onClick={(e) => { e.stopPropagation(); onEditSource(source); }}
                        className="flex-1 flex items-center justify-center text-[10px] font-medium text-gray-600 hover:bg-gray-50 hover:text-belhard-blue"
                     >
                        <Edit2 className="w-3 h-3 mr-1" /> Ред.
                     </button>
                     <button 
                        onClick={(e) => { e.stopPropagation(); onDeleteSource(source.id); }}
                        className="flex-1 flex items-center justify-center text-[10px] font-medium text-gray-600 hover:bg-red-50 hover:text-red-600"
                     >
                        <Trash2 className="w-3 h-3 mr-1" /> Удал.
                     </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>

    {/* Confirmation Modal */}
    {confirmModal && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-slide-up">
          <div className="p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              {confirmModal.type === 'delete'
                ? 'Удалить чат?'
                : confirmModal.type === 'restore'
                  ? 'Восстановить чат?'
                  : 'Архивировать чат?'
              }
            </h3>
            <p className="text-gray-700 mb-1">
              {confirmModal.type === 'delete'
                ? `Вы уверены, что хотите удалить чат`
                : confirmModal.type === 'restore'
                  ? `Вы хотите восстановить чат`
                  : `Вы хотите архивировать чат`
              } <span className="font-semibold">{confirmModal.chatTitle}</span>?
            </p>
            <p className="text-sm text-gray-500">
              {confirmModal.type === 'delete'
                ? 'Это действие нельзя отменить. Все сообщения будут удалены.'
                : confirmModal.type === 'restore'
                  ? 'Чат будет перемещен обратно в основной список.'
                  : 'Чат будет перемещен в архив. Вы сможете восстановить его позже.'
              }
            </p>
          </div>

          <div className="flex gap-3 px-6 pb-6">
            <button
              onClick={() => setConfirmModal(null)}
              className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors"
            >
              Отмена
            </button>
            <button
              onClick={handleConfirmAction}
              className={`flex-1 px-4 py-2.5 font-semibold rounded-xl transition-colors ${
                confirmModal.type === 'delete'
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-belhard-blue hover:bg-belhard-dark text-white'
              }`}
            >
              {confirmModal.type === 'delete'
                ? 'Удалить'
                : confirmModal.type === 'restore'
                  ? 'Восстановить'
                  : 'Архивировать'
              }
            </button>
          </div>
        </div>
      </div>
    )}
    </React.Fragment>
  );
};

export default Sidebar;
