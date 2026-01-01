import React from 'react';
import { ArrowLeft } from 'lucide-react';

interface HelpPageProps {
  onClose: () => void;
}

const HelpPage: React.FC<HelpPageProps> = ({ onClose }) => {
  return (
    <div className="h-screen bg-white flex flex-col overflow-hidden">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white z-50 flex-shrink-0">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Вернуться к чату"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-belhard-blue rounded-lg flex items-center justify-center text-white font-bold text-sm">
                BA
              </div>
              <span className="font-bold text-xl text-gray-900">Belhard AI</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Закрыть
          </button>
        </div>
      </header>

      {/* Content Area */}
      <div className="flex flex-1 overflow-hidden max-w-7xl mx-auto w-full">
        {/* Left Sidebar */}
        <aside className="w-64 border-r border-gray-200 p-6 overflow-y-auto flex-shrink-0 custom-scrollbar">
          <nav className="space-y-1">
            <a href="#overview" className="block py-2 text-sm font-medium text-gray-900 hover:text-belhard-blue">
              Обзор
            </a>
            <a href="#getting-started" className="block py-2 text-sm text-gray-600 hover:text-gray-900">
              Начало работы
            </a>
            <a href="#features" className="block py-2 text-sm text-gray-600 hover:text-gray-900">
              Функции
            </a>
            <a href="#departments" className="block py-2 text-sm text-gray-600 hover:text-gray-900">
              Отделы
            </a>
            <a href="#knowledge-base" className="block py-2 text-sm text-gray-600 hover:text-gray-900">
              База знаний
            </a>
            <a href="#citations" className="block py-2 text-sm text-gray-600 hover:text-gray-900">
              Цитирование
            </a>
            <a href="#faq" className="block py-2 text-sm text-gray-600 hover:text-gray-900">
              FAQ
            </a>
            <a href="#company" className="block py-2 text-sm text-gray-600 hover:text-gray-900">
              О компании
            </a>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 px-12 py-12 overflow-y-auto custom-scrollbar">
          <h1 className="text-5xl font-bold text-gray-900 mb-8">Помощь и документация</h1>

          {/* Overview */}
          <section id="overview" className="mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-6">Обзор</h2>
            <p className="text-lg text-gray-700 leading-relaxed mb-4">
              Belhard AI — это корпоративная языковая модель, разработанная специально для белорусских компаний.
              Система предоставляет специализированных AI-ассистентов для различных отделов компании.
            </p>
            <p className="text-lg text-gray-700 leading-relaxed">
              Версия: <strong>2.0.0</strong> | Создано: <strong>Дмитрий Утлик</strong> |
              Компания: <strong>Belhard Group & НАН РБ</strong>
            </p>
          </section>

          {/* Getting Started */}
          <section id="getting-started" className="mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-6">Начало работы</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">1. Вход в систему</h3>
                <p className="text-gray-700">
                  Введите ваш корпоративный email для доступа к системе. Авторизация происходит автоматически.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">2. Выбор отдела</h3>
                <p className="text-gray-700">
                  В верхней части экрана выберите отдел, соответствующий вашему запросу. Каждый отдел имеет
                  специализированного AI-ассистента.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">3. Задайте вопрос</h3>
                <p className="text-gray-700">
                  Введите ваш вопрос в поле ввода внизу экрана. AI ответит на основе базы знаний компании.
                </p>
              </div>
            </div>
          </section>

          {/* Features */}
          <section id="features" className="mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-6">Основные функции</h2>
            <ul className="space-y-3 text-gray-700">
              <li className="flex gap-2">
                <span className="text-belhard-blue">•</span>
                <span><strong>Умный поиск</strong>: Поиск информации по корпоративной базе знаний</span>
              </li>
              <li className="flex gap-2">
                <span className="text-belhard-blue">•</span>
                <span><strong>Цитирование источников</strong>: Все ответы подкреплены ссылками на документы</span>
              </li>
              <li className="flex gap-2">
                <span className="text-belhard-blue">•</span>
                <span><strong>История чатов</strong>: Сохранение и управление историей диалогов</span>
              </li>
              <li className="flex gap-2">
                <span className="text-belhard-blue">•</span>
                <span><strong>Редактирование сообщений</strong>: Возможность изменить вопрос и получить новый ответ</span>
              </li>
              <li className="flex gap-2">
                <span className="text-belhard-blue">•</span>
                <span><strong>Архивация чатов</strong>: Перемещение старых чатов в архив</span>
              </li>
            </ul>
          </section>

          {/* Departments */}
          <section id="departments" className="mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-6">Отделы</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 border border-gray-200 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-2">Общий отдел</h3>
                <p className="text-sm text-gray-600">Общие вопросы и информация о компании</p>
              </div>
              <div className="p-4 border border-gray-200 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-2">Бухгалтерия</h3>
                <p className="text-sm text-gray-600">Налоги, финансовая отчетность, платежи</p>
              </div>
              <div className="p-4 border border-gray-200 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-2">HR отдел</h3>
                <p className="text-sm text-gray-600">Кадры, трудовое право, отпуска</p>
              </div>
              <div className="p-4 border border-gray-200 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-2">Юридический отдел</h3>
                <p className="text-sm text-gray-600">Правовые вопросы, договоры, законодательство</p>
              </div>
              <div className="p-4 border border-gray-200 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-2">IT отдел</h3>
                <p className="text-sm text-gray-600">Техническая поддержка, безопасность</p>
              </div>
            </div>
          </section>

          {/* Knowledge Base */}
          <section id="knowledge-base" className="mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-6">База знаний</h2>
            <p className="text-gray-700 mb-4">
              Система использует базу знаний, включающую:
            </p>
            <ul className="space-y-2 text-gray-700">
              <li>• Трудовой кодекс Республики Беларусь</li>
              <li>• Налоговый кодекс Республики Беларусь</li>
              <li>• Декрет №8 о развитии цифровой экономики</li>
              <li>• Законы о защите персональных данных</li>
              <li>• Внутренние корпоративные документы</li>
              <li>• Регламенты и инструкции</li>
            </ul>
            <p className="text-gray-700 mt-4">
              Вы можете добавлять собственные документы через кнопку "+" в поле ввода.
            </p>
          </section>

          {/* Citations */}
          <section id="citations" className="mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-6">Система цитирования</h2>
            <p className="text-gray-700 mb-4">
              В версии 2.0.0 введена новая система цитирования с читаемым форматом:
            </p>
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <p className="text-sm text-gray-700 mb-2"><strong>Формат:</strong></p>
              <code className="text-sm bg-white px-2 py-1 rounded border border-gray-200">
                ТК РБ - РАЗДЕЛ II. ГЛАВА 2 - Статья 16
              </code>
              <p className="text-sm text-gray-700 mt-4 mb-2"><strong>Примеры:</strong></p>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• "Декрет №8 - ГЛАВА 1 - Статья 2 п1"</li>
                <li>• "НК РБ - РАЗДЕЛ III - Статья 120"</li>
                <li>• "Сотрудники - пункт 5"</li>
              </ul>
            </div>
            <p className="text-gray-700 mt-4">
              Кликните на цитату, чтобы открыть документ с подсветкой нужного фрагмента.
            </p>
          </section>

          {/* FAQ */}
          <section id="faq" className="mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-6">Часто задаваемые вопросы</h2>
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Как добавить свой документ в базу знаний?
                </h3>
                <p className="text-gray-700">
                  Нажмите кнопку "+" рядом с полем ввода, заполните название, короткое название для цитирования
                  и вставьте текст документа. Система автоматически проиндексирует его.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Как изменить вопрос после отправки?
                </h3>
                <p className="text-gray-700">
                  Наведите курсор на сообщение и нажмите иконку карандаша слева. Введите новый текст и нажмите "Отправить".
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Сохраняется ли история чатов?
                </h3>
                <p className="text-gray-700">
                  Да, все чаты сохраняются в IndexedDB вашего браузера. Вы можете архивировать
                  или удалять старые чаты через меню (три точки).
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Что делать, если AI не находит нужную информацию?
                </h3>
                <p className="text-gray-700">
                  Попробуйте переформулировать вопрос или добавить нужный документ в базу знаний.
                  Также убедитесь, что выбран правильный отдел.
                </p>
              </div>
            </div>
          </section>

          {/* Company */}
          <section id="company" className="mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-6">О компании</h2>
            <p className="text-gray-700 mb-4">
              Belhard AI разработан совместно <strong>Belhard Group</strong> и <strong>Национальной академией наук
              Республики Беларусь</strong>.
            </p>
            <p className="text-gray-700 mb-4">
              <strong>Автор проекта:</strong> Дмитрий Утлик, AI Product Manager
            </p>
            <p className="text-gray-700">
              Проект направлен на повышение эффективности работы белорусских компаний через внедрение
              современных AI-технологий.
            </p>
          </section>

          {/* Contact */}
          <section className="mb-16 p-6 bg-gray-50 rounded-xl border border-gray-200">
            <h3 className="text-xl font-semibold text-gray-900 mb-3">Нужна помощь?</h3>
            <p className="text-gray-700 mb-4">
              Если вы не нашли ответ на свой вопрос, свяжитесь с нами:
            </p>
            <div className="space-y-2 text-gray-700">
              <p>📧 Email: <a href="mailto:support@belhard.ai" className="text-belhard-blue hover:underline">support@belhard.ai</a></p>
              <p>💬 Telegram: <a href="https://t.me/belhard_ai" className="text-belhard-blue hover:underline">@belhard_ai</a></p>
              <p>🌐 Сайт: <a href="https://belhard.ai" className="text-belhard-blue hover:underline">belhard.ai</a></p>
            </div>
          </section>

          {/* Footer */}
          <footer className="border-t border-gray-200 bg-gray-50 py-8 mt-16 -mx-12 px-12">
            <div className="text-center text-sm text-gray-600">
              <p>© 2025 Belhard AI. Все права защищены.</p>
              <p className="mt-2">Создано в Республике Беларусь 🇧🇾</p>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
};

export default HelpPage;
