import React, { useState, useEffect, useRef } from 'react';
import {
  Shield, Server, Lock, Globe, ArrowRight, ChevronDown,
  Brain, Award, BookOpen, Building2, GraduationCap, Zap,
  CheckCircle, AlertTriangle, ExternalLink, Users, Clock,
  Cpu, Database, Eye, MessageSquare, Camera, Newspaper
} from 'lucide-react';

interface LandingPageProps {
  onGoToLogin: () => void;
  onGoToRegister: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onGoToLogin, onGoToRegister }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState('');
  const mainRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = mainRef.current;
    if (!container) return;
    const handleScroll = () => {
      setIsScrolled(container.scrollTop > 50);
      // Determine active section
      const sections = container.querySelectorAll('section[id]');
      let current = '';
      sections.forEach((section) => {
        const rect = section.getBoundingClientRect();
        if (rect.top <= 200) current = section.id;
      });
      setActiveSection(current);
    };
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollTo = (id: string) => {
    const el = mainRef.current?.querySelector(`#${id}`);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div ref={mainRef} className="h-screen overflow-y-auto bg-white scroll-smooth">

      {/* ==================== NAVBAR ==================== */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled ? 'bg-white/95 backdrop-blur-md shadow-md' : 'bg-transparent'
      }`}>
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors duration-300 ${
              isScrolled ? 'bg-belhard-blue' : 'bg-white'
            }`}>
              <Brain className={`w-5 h-5 sm:w-6 sm:h-6 transition-colors duration-300 ${isScrolled ? 'text-white' : 'text-belhard-blue'}`} />
            </div>
            <span className={`font-bold text-sm sm:text-lg truncate transition-colors duration-300 ${isScrolled ? 'text-gray-900' : 'text-white'}`}>Belhard AI</span>
          </div>

          <div className={`hidden lg:flex items-center gap-6 text-sm font-medium transition-colors duration-300 ${isScrolled ? 'text-gray-600' : 'text-white/80'}`}>
            {[
              ['problem', 'Проблема'],
              ['solution', 'Решение'],
              ['awards', 'Награды'],
              ['features', 'Возможности'],
              ['partners', 'Партнёры'],
            ].map(([id, label]) => (
              <button
                key={id}
                onClick={() => scrollTo(id)}
                className={`transition-colors ${
                  isScrolled
                    ? `hover:text-belhard-blue ${activeSection === id ? 'text-belhard-blue' : ''}`
                    : `hover:text-white ${activeSection === id ? 'text-white' : ''}`
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              onClick={onGoToLogin}
              className={`hidden sm:block text-sm font-medium transition-colors duration-300 ${
                isScrolled ? 'text-gray-600 hover:text-belhard-blue' : 'text-white hover:text-white/80'
              }`}
            >
              Войти
            </button>
            <button
              onClick={onGoToRegister}
              className={`px-3 py-2 sm:px-5 sm:py-2.5 text-xs sm:text-sm font-semibold rounded-xl transition-all duration-300 shadow-lg ${
                isScrolled
                  ? 'bg-belhard-blue text-white hover:bg-belhard-dark shadow-belhard-blue/20'
                  : 'bg-white text-belhard-blue hover:bg-white/90 shadow-white/10'
              }`}
            >
              Начать работу
            </button>
          </div>
        </div>
      </nav>

      {/* ==================== HERO ==================== */}
      <section id="hero" className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-[#001a4d] via-[#003087] to-[#005EB8]" />
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-400/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-green-400/5 rounded-full blur-3xl" />
          {/* Grid pattern */}
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }} />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-sm text-white/80 mb-8 border border-white/10">
            <Shield className="w-4 h-4" />
            Суверенная AI-платформа для Республики Беларусь
          </div>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white leading-tight mb-6">
            Национальная<br />
            <span className="bg-gradient-to-r from-blue-300 via-cyan-300 to-green-300 bg-clip-text text-transparent">
              языковая модель
            </span>
          </h1>

          <p className="text-lg md:text-xl text-white/70 max-w-2xl mx-auto mb-10 leading-relaxed">
            Первая белорусская LLM, работающая в закрытом контуре.
            Разработана группой компаний Belhard совместно с НАН Беларуси
            для безопасной работы с корпоративными данными.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <button
              onClick={onGoToRegister}
              className="px-8 py-4 bg-white text-belhard-dark font-bold rounded-2xl shadow-2xl shadow-black/20 hover:shadow-3xl hover:scale-[1.02] transition-all flex items-center gap-3 text-lg"
            >
              Попробовать бесплатно
              <ArrowRight className="w-5 h-5" />
            </button>
            <button
              onClick={() => scrollTo('problem')}
              className="px-8 py-4 bg-white/10 text-white font-semibold rounded-2xl border border-white/20 hover:bg-white/20 transition-all flex items-center gap-3"
            >
              Узнать больше
              <ChevronDown className="w-5 h-5" />
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto">
            {[
              ['1-3 сек', 'Время ответа'],
              ['2', 'Языка: RU/BY'],
              ['100%', 'Данные в РБ'],
              ['567+', 'ИИ-проектов'],
            ].map(([value, label]) => (
              <div key={label} className="text-center">
                <div className="text-2xl md:text-3xl font-bold text-white">{value}</div>
                <div className="text-sm text-white/50 mt-1">{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <ChevronDown className="w-6 h-6 text-white/40" />
        </div>
      </section>

      {/* ==================== PROBLEM ==================== */}
      <section id="problem" className="py-24 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-600 rounded-full text-sm font-medium mb-4">
              <AlertTriangle className="w-4 h-4" />
              Проблема
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Зависимость от иностранных AI-систем
            </h2>
            <p className="text-lg text-gray-500 max-w-2xl mx-auto">
              Белорусские предприятия вынуждены использовать проприетарные системы
              стран, которые не всегда являются дружественными
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                flag: '🇺🇸',
                country: 'США',
                systems: 'OpenAI (ChatGPT), Google (Gemini), Anthropic (Claude)',
                risks: [
                  'Санкционные ограничения — блокировка доступа из РБ',
                  'Данные передаются на серверы в США',
                  'Подчинение законодательству США (CLOUD Act)',
                  'Доступ может быть отозван в любой момент',
                ],
                color: 'border-red-200 bg-red-50/50',
                iconColor: 'text-red-500',
              },
              {
                flag: '🇨🇳',
                country: 'Китай',
                systems: 'DeepSeek, Baidu (ERNIE), Alibaba (Qwen)',
                risks: [
                  'Данные попадают на серверы КНР',
                  'Закон о национальной безопасности КНР',
                  'Цензура контента по требованиям КПК',
                  'Нестабильный доступ и блокировки',
                ],
                color: 'border-orange-200 bg-orange-50/50',
                iconColor: 'text-orange-500',
              },
              {
                flag: '🇷🇺',
                country: 'Россия',
                systems: 'Яндекс GPT, GigaChat (Сбер), MTS AI',
                risks: [
                  'Зависимость от инфраструктуры другого государства',
                  'Данные на российских серверах',
                  'Регуляторные риски (закон о локализации РФ)',
                  'Конкурентная разведка и утечки',
                ],
                color: 'border-yellow-200 bg-yellow-50/50',
                iconColor: 'text-yellow-600',
              },
            ].map((item) => (
              <div key={item.country} className={`rounded-2xl border-2 ${item.color} p-6 hover:shadow-lg transition-all`}>
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-3xl">{item.flag}</span>
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg">{item.country}</h3>
                    <p className="text-xs text-gray-500">{item.systems}</p>
                  </div>
                </div>
                <ul className="space-y-3">
                  {item.risks.map((risk, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <AlertTriangle className={`w-4 h-4 ${item.iconColor} shrink-0 mt-0.5`} />
                      {risk}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Summary box */}
          <div className="mt-12 bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  icon: Globe,
                  title: 'Геополитические риски',
                  desc: 'Доступ к API может быть заблокирован из-за санкций, изменений политики или международных конфликтов. Бизнес-процессы парализуются мгновенно.',
                },
                {
                  icon: Eye,
                  title: 'Утечка данных',
                  desc: 'Корпоративные секреты, персональные данные сотрудников и клиентов передаются на серверы иностранных компаний без гарантий конфиденциальности.',
                },
                {
                  icon: Lock,
                  title: 'Нарушение законодательства',
                  desc: 'Закон РБ №455-З «О персональных данных» требует обработку данных на территории Беларуси. Использование иностранных AI-сервисов создаёт правовые риски.',
                },
              ].map((item) => (
                <div key={item.title} className="text-center">
                  <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <item.icon className="w-6 h-6 text-red-500" />
                  </div>
                  <h4 className="font-bold text-gray-900 mb-2">{item.title}</h4>
                  <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ==================== SOLUTION ==================== */}
      <section id="solution" className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-600 rounded-full text-sm font-medium mb-4">
              <CheckCircle className="w-4 h-4" />
              Решение
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Белорусская национальная языковая модель
            </h2>
            <p className="text-lg text-gray-500 max-w-2xl mx-auto">
              Группа компаний Belhard совместно с Национальной академией наук Беларуси
              создали первую суверенную LLM, работающую полностью в закрытом контуре
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-center mb-16">
            {/* Left — description */}
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-6">
                Полный цифровой суверенитет
              </h3>
              <div className="space-y-5">
                {[
                  {
                    icon: Server,
                    title: 'Закрытый контур',
                    desc: 'Модель разворачивается на серверах предприятия. Ни один байт данных не покидает периметр организации.',
                  },
                  {
                    icon: Lock,
                    title: 'Соответствие законодательству',
                    desc: 'Полное соответствие Закону РБ «О персональных данных» и требованиям ОАЦ по защите информации.',
                  },
                  {
                    icon: Brain,
                    title: 'Русский и белорусский языки',
                    desc: 'Модель обучена на корпусах русского и белорусского языков. Генерация ответов за 1-3 секунды.',
                  },
                  {
                    icon: Database,
                    title: 'RAG по НПА РБ',
                    desc: 'Встроенная база знаний из нормативных правовых актов Республики Беларусь с точными цитатами статей.',
                  },
                ].map((item) => (
                  <div key={item.title} className="flex gap-4">
                    <div className="w-10 h-10 bg-belhard-light rounded-xl flex items-center justify-center shrink-0">
                      <item.icon className="w-5 h-5 text-belhard-blue" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">{item.title}</h4>
                      <p className="text-sm text-gray-500 mt-1">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — visual card */}
            <div className="relative">
              <div className="bg-gradient-to-br from-belhard-blue to-belhard-dark rounded-3xl p-8 text-white shadow-2xl shadow-belhard-blue/20">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
                    <Shield className="w-7 h-7" />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg">Belhard AI</h4>
                    <p className="text-white/60 text-sm">Национальная LLM v1.0</p>
                  </div>
                </div>

                <div className="space-y-4 mb-8">
                  <div className="bg-white/10 rounded-xl p-4">
                    <div className="text-xs text-white/50 mb-1">Архитектура</div>
                    <div className="font-semibold">Open-source модель + OSTIS семантика</div>
                  </div>
                  <div className="bg-white/10 rounded-xl p-4">
                    <div className="text-xs text-white/50 mb-1">Развёртывание</div>
                    <div className="font-semibold">On-premise / Частное облако РБ</div>
                  </div>
                  <div className="bg-white/10 rounded-xl p-4">
                    <div className="text-xs text-white/50 mb-1">Безопасность</div>
                    <div className="font-semibold">OSTIS — интеллектуальный кокон защиты</div>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-sm text-white/60">
                  <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> 1-3 сек</span>
                  <span className="flex items-center gap-1"><Cpu className="w-4 h-4" /> GPU-оптимизация</span>
                  <span className="flex items-center gap-1"><Globe className="w-4 h-4" /> RU/BY</span>
                </div>
              </div>
              {/* Decorative */}
              <div className="absolute -z-10 top-4 left-4 right-4 bottom-4 bg-belhard-blue/20 rounded-3xl blur-xl" />
            </div>
          </div>

          {/* OSTIS Technology */}
          <div className="bg-gray-50 rounded-2xl p-8 border border-gray-100">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">
                  Технология OSTIS — «Интеллектуальный кокон»
                </h3>
                <p className="text-gray-600 mb-4 leading-relaxed">
                  Открытая семантическая технология (OSTIS), разработанная при участии профессора
                  БГУИР Владимира Голенкова, обеспечивает прозрачность и контролируемость
                  AI-системы. В отличие от «чёрных ящиков» зарубежных нейросетей,
                  OSTIS позволяет точно видеть, как система принимает решения.
                </p>
                <div className="flex flex-wrap gap-2">
                  {['SC-код', 'SC-машина', 'Логический вывод', 'Самообучение', 'Прозрачность'].map((tag) => (
                    <span key={tag} className="px-3 py-1 bg-white rounded-full text-xs font-medium text-gray-600 border border-gray-200">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Прозрачность', desc: 'Видно, как принимаются решения', icon: Eye },
                  { label: 'Безопасность', desc: 'Контроль над действиями ИИ', icon: Shield },
                  { label: 'Гибкость', desc: 'Адаптация под задачи предприятия', icon: Zap },
                  { label: 'Универсальность', desc: 'Интеграция с любыми системами', icon: Globe },
                ].map((item) => (
                  <div key={item.label} className="bg-white rounded-xl p-4 border border-gray-100">
                    <item.icon className="w-5 h-5 text-belhard-blue mb-2" />
                    <div className="font-semibold text-sm text-gray-900">{item.label}</div>
                    <div className="text-xs text-gray-500 mt-1">{item.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== AWARDS ==================== */}
      <section id="awards" className="py-24 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-600 rounded-full text-sm font-medium mb-4">
              <Award className="w-4 h-4" />
              Признание
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Награды и достижения
            </h2>
            <p className="text-lg text-gray-500 max-w-2xl mx-auto">
              IV Международный форум IT-Академграда «Искусственный интеллект в Беларуси», октябрь 2025
            </p>
          </div>

          {/* Photo Gallery from Forum */}
          <div className="mb-12">
            <h3 className="font-bold text-lg text-gray-900 mb-6 flex items-center gap-2">
              <Camera className="w-5 h-5 text-gray-400" />
              Фотогалерея с форума
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                {
                  src: 'https://www.kv.by/sites/default/files/styles/post_picture/public/pictures/userpictures/2025/10/14/2359/photo_5436034790110396517_y.jpg',
                  alt: 'Выступление на форуме IT-Академграда',
                },
                {
                  src: 'https://www.kv.by/sites/default/files/styles/post_picture/public/pictures/userpictures/2025/10/14/2359/photo_5436034790110395127_y.jpg',
                  alt: 'Презентация национальной LLM',
                },
                {
                  src: 'https://www.kv.by/sites/default/files/styles/post_picture/public/pictures/userpictures/2025/10/14/2359/photo_5436034790110395102_y.jpg',
                  alt: 'Спикеры форума ИИ в Беларуси',
                },
                {
                  src: 'https://www.kv.by/sites/default/files/styles/post_picture/public/pictures/userpictures/2025/10/14/2359/photo_6013884689456151237_w.jpg',
                  alt: 'Награждение — лидер ИИ',
                },
                {
                  src: 'https://www.kv.by/sites/default/files/styles/post_picture/public/pictures/userpictures/2025/10/14/2359/photo_5436034790110395898_y.jpg',
                  alt: 'Демонстрация AI-продуктов Belhard',
                },
                {
                  src: 'https://www.kv.by/sites/default/files/styles/post_picture/public/pictures/userpictures/2025/10/14/2359/imgonline-com-ua-osvetlenie-uerojwpmzte.jpg',
                  alt: 'Участники форума IT-Академграда',
                },
              ].map((photo, i) => (
                <a
                  key={i}
                  href="https://www.kv.by/post/1071228-gk-belhard-na-forume-it-akademgrada-iskusstvennyy-intellekt-v-belarusi"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative block rounded-2xl overflow-hidden bg-gray-100 aspect-[4/3]"
                >
                  <img
                    src={photo.src}
                    alt={photo.alt}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-full group-hover:translate-y-0 transition-transform">
                    <p className="text-white text-xs font-medium">{photo.alt}</p>
                    <p className="text-white/60 text-[10px] mt-0.5 flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" /> Источник: KV.by
                    </p>
                  </div>
                </a>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-3 flex items-center gap-1">
              <ExternalLink className="w-3 h-3" />
              Фото:
              <a href="https://www.kv.by/post/1071228-gk-belhard-na-forume-it-akademgrada-iskusstvennyy-intellekt-v-belarusi" target="_blank" rel="noopener noreferrer" className="text-belhard-blue hover:underline">
                KV.by — ГК «БелХард» на форуме IT-Академграда
              </a>
            </p>
          </div>

          {/* Awards cards */}
          <div className="grid md:grid-cols-2 gap-8 mb-12">
            {/* Award 1 */}
            <div className="bg-white rounded-2xl border border-amber-100 shadow-sm overflow-hidden hover:shadow-lg transition-all">
              <div className="h-2 bg-gradient-to-r from-amber-400 to-yellow-500" />
              <div className="p-8">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center shrink-0">
                    <Award className="w-8 h-8 text-amber-500" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-gray-900">Компания — лидер ИИ</h3>
                    <p className="text-sm text-gray-500">IV Международный форум IT-Академграда</p>
                  </div>
                </div>
                <p className="text-gray-600 text-sm leading-relaxed mb-4">
                  ГК «БелХард» получила диплом в номинации «Компания — лидер ИИ»
                  на IV Международном форуме IT-Академграда «Искусственный интеллект в Беларуси»,
                  прошедшем в октябре 2025 года.
                </p>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <Clock className="w-3 h-3" />
                  13-14 октября 2025, Минск
                </div>
              </div>
            </div>

            {/* Award 2 */}
            <div className="bg-white rounded-2xl border border-amber-100 shadow-sm overflow-hidden hover:shadow-lg transition-all">
              <div className="h-2 bg-gradient-to-r from-amber-400 to-yellow-500" />
              <div className="p-8">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center shrink-0">
                    <Award className="w-8 h-8 text-amber-500" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-gray-900">Проект — лидер ИИ</h3>
                    <p className="text-sm text-gray-500">IV Международный форум IT-Академграда</p>
                  </div>
                </div>
                <p className="text-gray-600 text-sm leading-relaxed mb-4">
                  Национальная LLM отмечена дипломом в номинации «Проект — лидер ИИ».
                  Первый образец модели был успешно создан и протестирован,
                  подтвердив работоспособность на русском и белорусском языках.
                </p>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <Clock className="w-3 h-3" />
                  13-14 октября 2025, Минск
                </div>
              </div>
            </div>
          </div>

          {/* Speakers */}
          <div className="bg-white rounded-2xl border border-gray-200 p-8 mb-12">
            <h3 className="font-bold text-lg text-gray-900 mb-6">Ключевые выступления</h3>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                {
                  speaker: 'Игорь Мамоненко',
                  role: 'Генеральный директор ГК «БелХард»',
                  topic: '«Масштабирование персонализированного обучения с помощью ИИ»',
                  desc: 'Как ИИ создаёт индивидуальные образовательные программы и адаптирует контент в реальном времени.',
                  img: 'https://content.onliner.by/news/1200x5616/8b07c15f53d7784974afbfaa780d329b.jpg',
                },
                {
                  speaker: 'Дмитрий Воронюк',
                  role: 'Менеджер по развитию, ЗАО «БелХард Групп»',
                  topic: '«Национальная LLM для Беларуси»',
                  desc: 'Архитектура модели, результаты тестирования и планы запуска для госсектора и университетов.',
                  img: 'https://www.belhard.com/ru/wp-content/uploads/2025/10/3.jpg',
                },
                {
                  speaker: 'Владимир Голенков',
                  role: 'Профессор БГУИР',
                  topic: '«Технология OSTIS»',
                  desc: 'Открытая семантическая технология для создания прозрачных и контролируемых интеллектуальных систем.',
                  img: 'https://www.belhard.com/ru/wp-content/uploads/2025/10/2.jpg',
                },
              ].map((item) => (
                <div key={item.speaker} className="bg-gray-50 rounded-xl overflow-hidden">
                  <div className="h-40 bg-gray-200 overflow-hidden">
                    <img
                      src={item.img}
                      alt={item.speaker}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <div className="p-5">
                    <h4 className="font-bold text-gray-900">{item.speaker}</h4>
                    <p className="text-xs text-gray-500 mb-2">{item.role}</p>
                    <p className="text-sm font-medium text-belhard-blue mb-1">{item.topic}</p>
                    <p className="text-xs text-gray-500 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Press / Article Preview Cards */}
          <div>
            <h3 className="font-bold text-lg text-gray-900 mb-6 flex items-center gap-2">
              <Newspaper className="w-5 h-5 text-gray-400" />
              Публикации в СМИ
            </h3>
            <div className="grid md:grid-cols-3 gap-6">
              {/* Article 1 — KV.by */}
              <a
                href="https://www.kv.by/post/1071228-gk-belhard-na-forume-it-akademgrada-iskusstvennyy-intellekt-v-belarusi"
                target="_blank"
                rel="noopener noreferrer"
                className="group bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-lg transition-all"
              >
                <div className="h-48 bg-gray-100 overflow-hidden">
                  <img
                    src="https://www.kv.by/sites/default/files/styles/post_picture/public/pictures/userpictures/2025/10/14/2359/photo_5436034790110396517_y.jpg"
                    alt="Форум IT-Академграда"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                </div>
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-bold text-white bg-blue-600 px-2 py-0.5 rounded">KV.by</span>
                    <span className="text-xs text-gray-400">14 октября 2025</span>
                  </div>
                  <h4 className="font-bold text-gray-900 text-sm group-hover:text-belhard-blue transition-colors leading-snug">
                    ГК «БелХард» на форуме IT-Академграда «Искусственный интеллект в Беларуси»
                  </h4>
                  <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                    Два диплома: «Компания — лидер ИИ» и «Проект — лидер ИИ». Презентация национальной LLM, CardioGuru и других AI-продуктов.
                  </p>
                  <div className="flex items-center gap-1 mt-3 text-xs text-belhard-blue font-medium">
                    <ExternalLink className="w-3 h-3" /> Читать статью
                  </div>
                </div>
              </a>

              {/* Article 2 — Onliner */}
              <a
                href="https://tech.onliner.by/2025/06/12/belhard-2025"
                target="_blank"
                rel="noopener noreferrer"
                className="group bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-lg transition-all"
              >
                <div className="h-48 bg-gray-100 overflow-hidden">
                  <img
                    src="https://content.onliner.by/news/1400x5616/a39c21e214679970ffb39a7869e99733.jpg"
                    alt="Глава Belhard — интервью Onliner"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                </div>
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-bold text-white bg-red-500 px-2 py-0.5 rounded">Onliner</span>
                    <span className="text-xs text-gray-400">12 июня 2025</span>
                  </div>
                  <h4 className="font-bold text-gray-900 text-sm group-hover:text-belhard-blue transition-colors leading-snug">
                    Глава Belhard об угрозах от нейронных сетей и зарплатах в ИТ
                  </h4>
                  <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                    Игорь Мамоненко о системе OSTIS, защите от неконтролируемых действий нейросетей и планах развития национальной LLM.
                  </p>
                  <div className="flex items-center gap-1 mt-3 text-xs text-belhard-blue font-medium">
                    <ExternalLink className="w-3 h-3" /> Читать статью
                  </div>
                </div>
              </a>

              {/* Article 3 — Belhard.com */}
              <a
                href="https://www.belhard.com/ru/2025/06/19/%D0%B2-%D0%BC%D0%B8%D0%BD%D1%81%D0%BA%D0%B5-%D1%81%D0%BE%D1%81%D1%82%D0%BE%D1%8F%D0%BB%D1%81%D1%8F-%D1%81%D0%B5%D0%BC%D0%B8%D0%BD%D0%B0%D1%80-%D0%BF%D1%80%D0%B5%D0%B7%D0%B5%D0%BD%D1%82%D0%B0%D1%86/"
                target="_blank"
                rel="noopener noreferrer"
                className="group bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-lg transition-all"
              >
                <div className="h-48 bg-gray-100 overflow-hidden">
                  <img
                    src="https://www.belhard.com/ru/wp-content/uploads/2025/06/2ae1d373-9c1b-43e6-ad2b-66937a7b89c7.jpg"
                    alt="Семинар ИИ Страна Беларусь"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                </div>
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-bold text-white bg-belhard-blue px-2 py-0.5 rounded">Belhard.com</span>
                    <span className="text-xs text-gray-400">17-20 июня 2025</span>
                  </div>
                  <h4 className="font-bold text-gray-900 text-sm group-hover:text-belhard-blue transition-colors leading-snug">
                    Семинар-презентация «ИИ Страна Беларусь» на Digital Expo 2025
                  </h4>
                  <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                    9 факторов конкурентоспособности Беларуси в ИИ. Партнёры: НАН Беларуси, БГУ, БГУИР, «Сбербанк-Технологии».
                  </p>
                  <div className="flex items-center gap-1 mt-3 text-xs text-belhard-blue font-medium">
                    <ExternalLink className="w-3 h-3" /> Читать статью
                  </div>
                </div>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== FEATURES ==================== */}
      <section id="features" className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-full text-sm font-medium mb-4">
              <Zap className="w-4 h-4" />
              Возможности
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Что умеет система
            </h2>
            <p className="text-lg text-gray-500 max-w-2xl mx-auto">
              Корпоративная AI-платформа с департаментными ассистентами,
              обученными на белорусском законодательстве
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: MessageSquare,
                title: 'Департаментные ассистенты',
                desc: 'Специализированные AI-помощники для бухгалтерии, HR, юридического отдела и IT.',
                color: 'bg-purple-50 text-purple-500',
              },
              {
                icon: BookOpen,
                title: 'RAG по НПА РБ',
                desc: 'Retrieval-Augmented Generation на базе 100+ нормативных правовых актов с точными цитатами статей.',
                color: 'bg-blue-50 text-blue-500',
              },
              {
                icon: Lock,
                title: 'Закрытый контур',
                desc: 'Все данные остаются внутри периметра организации. Никакие запросы не уходят во внешние сети.',
                color: 'bg-green-50 text-green-500',
              },
              {
                icon: Zap,
                title: 'Стриминг ответов',
                desc: 'Посимвольная генерация ответов с эффектом печатной машинки. Время ответа 1-3 секунды.',
                color: 'bg-amber-50 text-amber-500',
              },
              {
                icon: Brain,
                title: 'Мульти-агентная система',
                desc: 'LangGraph оркестрация: маршрутизация запросов, извлечение документов, синтез ответов от нескольких агентов.',
                color: 'bg-red-50 text-red-500',
              },
              {
                icon: Database,
                title: 'Семантический поиск',
                desc: 'Векторные эмбеддинги + ключевые слова для точного поиска по базе знаний. Поддержка мультиязычности.',
                color: 'bg-cyan-50 text-cyan-500',
              },
            ].map((item) => (
              <div key={item.title} className="bg-gray-50 rounded-2xl p-6 border border-gray-100 hover:shadow-md hover:border-gray-200 transition-all">
                <div className={`w-12 h-12 ${item.color} rounded-xl flex items-center justify-center mb-4`}>
                  <item.icon className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ==================== PARTNERS ==================== */}
      <section id="partners" className="py-24 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-full text-sm font-medium mb-4">
              <Building2 className="w-4 h-4" />
              Партнёры
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Экосистема разработки
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { name: 'ГК «БелХард»', desc: 'Разработка и интеграция', icon: Building2 },
              { name: 'НАН Беларуси', desc: 'Научное сопровождение', icon: GraduationCap },
              { name: 'БГУИР', desc: 'Технология OSTIS', icon: Cpu },
              { name: 'БГУ', desc: 'Языковые корпуса', icon: BookOpen },
            ].map((p) => (
              <div key={p.name} className="bg-white rounded-2xl border border-gray-100 p-6 text-center hover:shadow-md transition-all">
                <div className="w-14 h-14 bg-belhard-light rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <p.icon className="w-7 h-7 text-belhard-blue" />
                </div>
                <h4 className="font-bold text-gray-900 text-sm">{p.name}</h4>
                <p className="text-xs text-gray-500 mt-1">{p.desc}</p>
              </div>
            ))}
          </div>

          {/* AI Projects by Belhard */}
          <div className="mt-16">
            <h3 className="text-xl font-bold text-gray-900 mb-6 text-center">
              ИИ-проекты группы компаний Belhard
            </h3>
            <div className="grid md:grid-cols-4 gap-4">
              {[
                { name: 'Alvisenna', desc: 'ИИ-доктор — медицинский ассистент' },
                { name: 'NeuroFace', desc: 'Анализ личности по фотографии' },
                { name: 'Barion', desc: 'Управление сетью электрозарядных станций' },
                { name: 'BuzzPoint', desc: 'Ориентация для незрячих и слабовидящих' },
              ].map((proj) => (
                <div key={proj.name} className="bg-white rounded-xl p-5 border border-gray-100">
                  <h4 className="font-bold text-belhard-blue">{proj.name}</h4>
                  <p className="text-xs text-gray-500 mt-1">{proj.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div className="mt-16 bg-gradient-to-br from-belhard-blue to-belhard-dark rounded-2xl p-10 text-white">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              {[
                ['С 1994', 'Год основания Belhard'],
                ['567+', 'Реализованных ИИ-проектов в РБ'],
                ['200+', 'AI-стартапов в стране'],
                ['68,5%', 'Локаций с оптикой (инфраструктура)'],
              ].map(([val, label]) => (
                <div key={label}>
                  <div className="text-3xl font-bold">{val}</div>
                  <div className="text-sm text-white/60 mt-1">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ==================== CTA ==================== */}
      <section className="py-24 bg-white">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Готовы к цифровому суверенитету?
          </h2>
          <p className="text-lg text-gray-500 mb-10 max-w-xl mx-auto">
            Начните использовать национальную LLM для вашего предприятия.
            Безопасно, быстро, в закрытом контуре.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={onGoToRegister}
              className="px-8 py-4 bg-belhard-blue text-white font-bold rounded-2xl shadow-xl shadow-belhard-blue/20 hover:bg-belhard-dark transition-all flex items-center gap-3 text-lg"
            >
              Зарегистрироваться
              <ArrowRight className="w-5 h-5" />
            </button>
            <button
              onClick={onGoToLogin}
              className="px-8 py-4 bg-gray-100 text-gray-700 font-semibold rounded-2xl hover:bg-gray-200 transition-all"
            >
              Войти в систему
            </button>
          </div>
        </div>
      </section>

      {/* ==================== FOOTER ==================== */}
      <footer className="bg-gray-900 text-white py-16">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-10 mb-12">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-belhard-blue rounded-xl flex items-center justify-center">
                  <Brain className="w-6 h-6 text-white" />
                </div>
                <span className="font-bold text-lg">Belhard AI</span>
              </div>
              <p className="text-sm text-gray-400 leading-relaxed">
                Национальная языковая модель для суверенной обработки данных
                в закрытом контуре предприятия.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-4 text-gray-300">Компания</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="https://www.belhard.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">belhard.com</a></li>
                <li><a href="https://belhard.academy" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Академия Belhard</a></li>
                <li><a href="https://nasb.gov.by" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">НАН Беларуси</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4 text-gray-300">Источники</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>
                  <a href="https://www.kv.by/post/1071228-gk-belhard-na-forume-it-akademgrada-iskusstvennyy-intellekt-v-belarusi" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                    Форум IT-Академграда — KV.by
                  </a>
                </li>
                <li>
                  <a href="https://tech.onliner.by/2025/06/12/belhard-2025" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                    Интервью Belhard — Onliner
                  </a>
                </li>
                <li>
                  <a href="https://www.belhard.com/ru/2025/06/19/%D0%B2-%D0%BC%D0%B8%D0%BD%D1%81%D0%BA%D0%B5-%D1%81%D0%BE%D1%81%D1%82%D0%BE%D1%8F%D0%BB%D1%81%D1%8F-%D1%81%D0%B5%D0%BC%D0%B8%D0%BD%D0%B0%D1%80-%D0%BF%D1%80%D0%B5%D0%B7%D0%B5%D0%BD%D1%82%D0%B0%D1%86/" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                    «ИИ Страна Беларусь» — Belhard
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4 text-gray-300">Контакты</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>Минск, Республика Беларусь</li>
                <li>ГК «БелХард Групп»</li>
                <li>Основана в 1994 году</li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-gray-500">
              &copy; {new Date().getFullYear()} Belhard Group. Все права защищены.
            </p>
            <p className="text-xs text-gray-600">
              Суверенная AI-платформа для Республики Беларусь
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
