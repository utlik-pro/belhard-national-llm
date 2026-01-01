import React from 'react';
import { Sparkles } from 'lucide-react';
import { MigrationProgress } from '../services/migrationService';

interface AppLoadingScreenProps {
  progress: MigrationProgress;
}

const AppLoadingScreen: React.FC<AppLoadingScreenProps> = ({ progress }) => {
  return (
    <div className="flex items-center justify-center h-screen bg-gradient-to-br from-belhard-light via-white to-gray-50">
      <div className="w-full max-w-md px-6">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-belhard-blue rounded-2xl mb-4 shadow-lg">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-belhard-text mb-2">Belhard AI</h1>
          <p className="text-sm text-gray-600">Национальная LLM</p>
        </div>

        {/* Progress Info */}
        <div className="mb-4 text-center">
          <p className="text-sm font-medium text-gray-700 mb-2">{progress.step}</p>
          <p className="text-xs text-gray-500">
            {progress.current > 0 && `${progress.current} / ${progress.total}`}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden shadow-inner">
          <div
            className="bg-gradient-to-r from-belhard-blue to-belhard-dark h-full rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress.percentage}%` }}
          />
        </div>

        {/* Percentage */}
        <div className="text-center mt-3">
          <span className="text-2xl font-bold text-belhard-blue">
            {progress.percentage}%
          </span>
        </div>

        {/* Footer Info */}
        <div className="mt-12 text-center text-xs text-gray-400">
          <p>Загрузка базы знаний...</p>
          <p className="mt-1">Версия 2.0.0</p>
        </div>
      </div>
    </div>
  );
};

export default AppLoadingScreen;
