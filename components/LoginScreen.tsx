import React, { useState } from 'react';
import { LayoutGrid, ArrowRight, ArrowLeft, Lock, Mail, User, Building2, Briefcase } from 'lucide-react';
import { CountryId } from '../types';
import { COUNTRY_CONFIGS } from '../constants';
import { userDB } from '../services/userDBService';

interface LoginScreenProps {
  onLogin: (email: string, country: CountryId) => void;
  initialMode?: 'login' | 'register';
  onBackToLanding?: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, initialMode = 'login', onBackToLanding }) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [selectedCountry, setSelectedCountry] = useState<CountryId>('belarus');
  const config = COUNTRY_CONFIGS[selectedCountry];

  // Login fields
  const [email, setEmail] = useState(config.demoEmail);
  const [password, setPassword] = useState('123456');

  // Register fields
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regName, setRegName] = useState('');
  const [regCompany, setRegCompany] = useState('');
  const [regPosition, setRegPosition] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCountryChange = (country: CountryId) => {
    setSelectedCountry(country);
    const newConfig = COUNTRY_CONFIGS[country];
    setEmail(newConfig.demoEmail);
    setError('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await userDB.login(email, password);
      onLogin(email, selectedCountry);
    } catch (err: any) {
      if (err.message === 'USER_NOT_FOUND') {
        setError(selectedCountry === 'azerbaijan'
          ? 'İstifadəçi tapılmadı. Qeydiyyatdan keçin.'
          : 'Пользователь не найден. Зарегистрируйтесь.');
      } else if (err.message === 'INVALID_PASSWORD') {
        setError(selectedCountry === 'azerbaijan'
          ? 'Yanlış şifrə'
          : 'Неверный пароль');
      } else {
        setError('Ошибка входа');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (regPassword.length < 6) {
      setError(selectedCountry === 'azerbaijan'
        ? 'Şifrə ən azı 6 simvol olmalıdır'
        : 'Пароль должен быть не менее 6 символов');
      setLoading(false);
      return;
    }

    try {
      await userDB.register(regEmail, regPassword, regName, selectedCountry, regCompany, regPosition);
      // Auto-login after registration
      await userDB.login(regEmail, regPassword);
      onLogin(regEmail, selectedCountry);
    } catch (err: any) {
      if (err.message === 'USER_EXISTS') {
        setError(selectedCountry === 'azerbaijan'
          ? 'Bu e-poçt artıq qeydiyyatdan keçib'
          : 'Этот email уже зарегистрирован');
      } else {
        setError('Ошибка регистрации');
      }
    } finally {
      setLoading(false);
    }
  };

  const isAz = selectedCountry === 'azerbaijan';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-belhard-light via-white to-white p-6 relative overflow-hidden">

      {/* Decorative Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className={`absolute -top-[10%] -left-[10%] w-[40%] h-[40%] ${isAz ? 'bg-blue-500/5' : 'bg-belhard-blue/5'} rounded-full blur-3xl`}></div>
          <div className={`absolute top-[20%] right-[10%] w-[20%] h-[20%] ${isAz ? 'bg-red-500/5' : 'bg-belhard-green/5'} rounded-full blur-3xl`}></div>
      </div>

      {/* Back to Landing */}
      {onBackToLanding && (
        <button
          onClick={onBackToLanding}
          className="absolute top-6 left-6 z-20 flex items-center gap-2 text-sm text-gray-500 hover:text-belhard-blue transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          На главную
        </button>
      )}

      {/* Country Switcher */}
      <div className="relative z-10 mb-6 flex gap-2 bg-white rounded-xl shadow-md border border-gray-100 p-1.5">
        {(Object.keys(COUNTRY_CONFIGS) as CountryId[]).map((countryId) => {
          const c = COUNTRY_CONFIGS[countryId];
          const isActive = selectedCountry === countryId;
          return (
            <button
              key={countryId}
              onClick={() => handleCountryChange(countryId)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-belhard-blue text-white shadow-md shadow-belhard-blue/20'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span className="text-lg">{c.flag}</span>
              <span>{c.name}</span>
            </button>
          );
        })}
      </div>

      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-100 p-8 md:p-10 relative z-10 animate-fade-in">
        <div className="flex flex-col items-center mb-8">
          <div className={`w-16 h-16 ${isAz ? 'bg-blue-600' : 'bg-belhard-blue'} rounded-2xl flex items-center justify-center text-white mb-4 shadow-lg ${isAz ? 'shadow-blue-600/30' : 'shadow-belhard-blue/30'}`}>
            <LayoutGrid className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            {mode === 'login' ? config.loginTitle : (isAz ? 'Qeydiyyat' : 'Регистрация')}
          </h1>
          <p className="text-sm text-gray-500 mt-2 text-center">
            {mode === 'login'
              ? config.loginSubtitle
              : (isAz ? 'Yeni hesab yaradın' : 'Создайте аккаунт для работы с системой')
            }
          </p>
        </div>

        {/* Mode Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6">
          <button
            onClick={() => { setMode('login'); setError(''); }}
            className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
              mode === 'login'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {isAz ? 'Daxil ol' : 'Вход'}
          </button>
          <button
            onClick={() => { setMode('register'); setError(''); }}
            className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
              mode === 'register'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {isAz ? 'Qeydiyyat' : 'Регистрация'}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
            {error}
          </div>
        )}

        {/* LOGIN FORM */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600 uppercase ml-1">
                {isAz ? 'E-poçt' : 'Email'}
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-belhard-blue/20 focus:border-belhard-blue outline-none transition-all text-gray-800 placeholder-gray-400"
                  placeholder={config.demoEmail}
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600 uppercase ml-1">
                {isAz ? 'Şifrə' : 'Пароль'}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-belhard-blue/20 focus:border-belhard-blue outline-none transition-all text-gray-800"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3.5 ${isAz ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/30' : 'bg-belhard-blue hover:bg-belhard-dark shadow-belhard-blue/30'} text-white font-semibold rounded-xl shadow-lg transition-all duration-200 transform hover:scale-[1.01] active:scale-[0.98] flex items-center justify-center gap-2`}
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  {isAz ? 'Daxil ol' : 'Войти в систему'}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* REGISTER FORM */}
        {mode === 'register' && (
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600 uppercase ml-1">
                {isAz ? 'Ad, Soyad' : 'Имя и фамилия'} *
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-belhard-blue/20 focus:border-belhard-blue outline-none transition-all text-gray-800 placeholder-gray-400"
                  placeholder={isAz ? 'Adınız Soyadınız' : 'Иван Петров'}
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600 uppercase ml-1">
                {isAz ? 'E-poçt' : 'Email'} *
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-belhard-blue/20 focus:border-belhard-blue outline-none transition-all text-gray-800 placeholder-gray-400"
                  placeholder="user@company.by"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600 uppercase ml-1">
                {isAz ? 'Şifrə' : 'Пароль'} *
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-belhard-blue/20 focus:border-belhard-blue outline-none transition-all text-gray-800 placeholder-gray-400"
                  placeholder={isAz ? 'Minimum 6 simvol' : 'Минимум 6 символов'}
                  required
                  minLength={6}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600 uppercase ml-1">
                  {isAz ? 'Şirkət' : 'Компания'}
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={regCompany}
                    onChange={(e) => setRegCompany(e.target.value)}
                    className="w-full pl-9 pr-3 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-belhard-blue/20 focus:border-belhard-blue outline-none transition-all text-gray-800 placeholder-gray-400 text-sm"
                    placeholder={isAz ? 'Şirkət adı' : 'Название'}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600 uppercase ml-1">
                  {isAz ? 'Vəzifə' : 'Должность'}
                </label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={regPosition}
                    onChange={(e) => setRegPosition(e.target.value)}
                    className="w-full pl-9 pr-3 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-belhard-blue/20 focus:border-belhard-blue outline-none transition-all text-gray-800 placeholder-gray-400 text-sm"
                    placeholder={isAz ? 'Vəzifəniz' : 'Должность'}
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3.5 ${isAz ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/30' : 'bg-belhard-blue hover:bg-belhard-dark shadow-belhard-blue/30'} text-white font-semibold rounded-xl shadow-lg transition-all duration-200 transform hover:scale-[1.01] active:scale-[0.98] flex items-center justify-center gap-2`}
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  {isAz ? 'Qeydiyyatdan keç' : 'Создать аккаунт'}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        <div className="mt-6 text-center">
            <div className="inline-block px-4 py-2 bg-gray-50 rounded-lg border border-gray-100">
                <p className="text-xs text-gray-500 font-medium">
                  {isAz ? 'Test girişi' : 'Тестовый доступ'}
                </p>
                <p className="text-xs text-gray-400 mt-1 font-mono">{config.demoEmail} / 123456</p>
            </div>
        </div>
      </div>

      <div className="mt-8 text-center text-xs text-gray-400 font-medium">
        {isAz
          ? <>&copy; 2025 HeadBots / Utlik.Co</>
          : <>&copy; 2025 Belhard Group. Доступ ограничен.</>
        }
      </div>
    </div>
  );
};

export default LoginScreen;
