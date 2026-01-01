import React from 'react';
import { X, Settings, Bell, Palette, Shield, User } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  useMultiAgent: boolean;
  onMultiAgentChange: (value: boolean) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  useMultiAgent,
  onMultiAgentChange,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-5xl h-[85vh] rounded-2xl shadow-2xl flex overflow-hidden animate-slide-up">

        {/* Left Sidebar */}
        <div className="w-64 bg-gray-50 border-r border-gray-200 p-4">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-800">Настройки</h2>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          <nav className="space-y-1">
            <button className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-gray-900 bg-white rounded-lg">
              <Settings className="w-4 h-4" />
              <span>Общие</span>
            </button>
            <button className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 hover:bg-white rounded-lg transition-colors">
              <Bell className="w-4 h-4" />
              <span>Уведомления</span>
            </button>
            <button className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 hover:bg-white rounded-lg transition-colors">
              <Palette className="w-4 h-4" />
              <span>Персонализация</span>
            </button>
            <button className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 hover:bg-white rounded-lg transition-colors">
              <Shield className="w-4 h-4" />
              <span>Безопасность</span>
            </button>
            <button className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 hover:bg-white rounded-lg transition-colors">
              <User className="w-4 h-4" />
              <span>Аккаунт</span>
            </button>
          </nav>
        </div>

        {/* Right Content */}
        <div className="flex-1 overflow-y-auto p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-8">Общие</h1>

          <div className="space-y-6">
            {/* Appearance */}
            <div className="flex items-center justify-between py-3 border-b border-gray-100">
              <div>
                <div className="text-sm font-semibold text-gray-800">Внешний вид</div>
              </div>
              <select className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-belhard-blue/20">
                <option>Системная</option>
                <option>Светлая</option>
                <option>Темная</option>
              </select>
            </div>

            {/* Accent Color */}
            <div className="flex items-center justify-between py-3 border-b border-gray-100">
              <div>
                <div className="text-sm font-semibold text-gray-800">Цветовая схема</div>
              </div>
              <select className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-belhard-blue/20">
                <option>По умолчанию</option>
                <option>Синий</option>
                <option>Зеленый</option>
                <option>Фиолетовый</option>
              </select>
            </div>

            {/* Language */}
            <div className="flex items-center justify-between py-3 border-b border-gray-100">
              <div>
                <div className="text-sm font-semibold text-gray-800">Язык</div>
              </div>
              <select className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-belhard-blue/20">
                <option>Русский</option>
                <option>English</option>
                <option>Беларуская</option>
              </select>
            </div>

            {/* Department */}
            <div className="flex items-center justify-between py-3 border-b border-gray-100">
              <div>
                <div className="text-sm font-semibold text-gray-800">Отдел по умолчанию</div>
                <div className="text-xs text-gray-500 mt-1">Выбирается при создании нового чата</div>
              </div>
              <select className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-belhard-blue/20">
                <option>Общий</option>
                <option>Бухгалтерия</option>
                <option>HR</option>
                <option>Юридический</option>
                <option>IT</option>
              </select>
            </div>

            {/* Separate Voice Mode */}
            <div className="flex items-center justify-between py-3 border-b border-gray-100">
              <div className="flex-1">
                <div className="text-sm font-semibold text-gray-800">Голосовой режим</div>
                <div className="text-xs text-gray-500 mt-1">Включить голосовое взаимодействие с AI ассистентом</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer ml-4">
                <input type="checkbox" className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-belhard-blue/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-belhard-blue"></div>
              </label>
            </div>

            {/* Auto-save chats */}
            <div className="flex items-center justify-between py-3 border-b border-gray-100">
              <div className="flex-1">
                <div className="text-sm font-semibold text-gray-800">Автосохранение чатов</div>
                <div className="text-xs text-gray-500 mt-1">Сохранять историю чатов в localStorage</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer ml-4">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-belhard-blue/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-belhard-blue"></div>
              </label>
            </div>

            {/* Multi-Agent Mode (LangGraph) */}
            <div className="flex items-center justify-between py-3 border-b border-gray-100">
              <div className="flex-1">
                <div className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                  Мульти-агентный режим
                  <span className="px-1.5 py-0.5 text-[10px] font-bold bg-purple-100 text-purple-700 rounded">BETA</span>
                </div>
                <div className="text-xs text-gray-500 mt-1">LangGraph: автоматическая маршрутизация к специализированным агентам (HR, Legal, IT, Accounting)</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer ml-4">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={useMultiAgent}
                  onChange={(e) => onMultiAgentChange(e.target.checked)}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-500/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>
          </div>

          {/* Info Box */}
          <div className="mt-8 p-4 bg-blue-50 border border-blue-100 rounded-xl">
            <div className="flex gap-3">
              <div className="text-blue-600 mt-0.5">ℹ️</div>
              <div>
                <div className="text-sm font-semibold text-blue-900">Belhard AI - Национальная LLM</div>
                <div className="text-xs text-blue-700 mt-1">
                  Версия: 2.0.0 | Создано: Дмитрий Утлик | Компания: Belhard Group & НАН РБ
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
