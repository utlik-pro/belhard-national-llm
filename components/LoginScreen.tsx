import React, { useState } from 'react';
import { LayoutGrid, ArrowRight, Lock, Mail } from 'lucide-react';

interface LoginScreenProps {
  onLogin: (email: string) => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('demo@belhard.ai');
  const [password, setPassword] = useState('123456');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      onLogin(email);
      setLoading(false);
    }, 1500);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-belhard-light via-white to-white p-6 relative overflow-hidden">
      
      {/* Decorative Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-belhard-blue/5 rounded-full blur-3xl"></div>
          <div className="absolute top-[20%] right-[10%] w-[20%] h-[20%] bg-belhard-green/5 rounded-full blur-3xl"></div>
      </div>

      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-100 p-8 md:p-10 relative z-10 animate-fade-in">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-belhard-blue rounded-2xl flex items-center justify-center text-white mb-4 shadow-lg shadow-belhard-blue/30">
            <LayoutGrid className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Belhard AI</h1>
          <p className="text-sm text-gray-500 mt-2 text-center">Корпоративная когнитивная система</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600 uppercase ml-1">Корпоративный Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-belhard-blue/20 focus:border-belhard-blue outline-none transition-all text-gray-800 placeholder-gray-400"
                placeholder="name@belhard.ai"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600 uppercase ml-1">Пароль</label>
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
            className="w-full py-3.5 bg-belhard-blue hover:bg-belhard-dark text-white font-semibold rounded-xl shadow-lg shadow-belhard-blue/30 transition-all duration-200 transform hover:scale-[1.01] active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <>
                Войти в систему
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 text-center">
            <div className="inline-block px-4 py-2 bg-gray-50 rounded-lg border border-gray-100">
                <p className="text-xs text-gray-500 font-medium">Тестовый доступ</p>
                <p className="text-xs text-gray-400 mt-1 font-mono">demo@belhard.ai / 123456</p>
            </div>
        </div>
      </div>
      
      <div className="mt-8 text-center text-xs text-gray-400 font-medium">
        &copy; 2025 Belhard Group. Доступ ограничен.
      </div>
    </div>
  );
};

export default LoginScreen;