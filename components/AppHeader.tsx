import React, { useState } from 'react';
import { Menu, ChevronDown, Settings, HelpCircle, LogOut } from 'lucide-react';
import { DepartmentId } from '../types';
import { DEPARTMENTS } from '../constants';

interface AppHeaderProps {
  selectedDepartment: DepartmentId;
  onDepartmentChange: (dept: DepartmentId) => void;
  onOpenSidebar: () => void;
  onOpenSettings: () => void;
  onOpenHelp: () => void;
  onLogoutRequest: () => void;
  departments?: typeof DEPARTMENTS;
}

const AppHeader: React.FC<AppHeaderProps> = ({
  selectedDepartment,
  onDepartmentChange,
  onOpenSidebar,
  onOpenSettings,
  onOpenHelp,
  onLogoutRequest,
  departments = DEPARTMENTS,
}) => {
  const [isDeptMenuOpen, setIsDeptMenuOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  const currentDept = departments.find(d => d.id === selectedDepartment);
  const DepartmentIcon = currentDept?.icon;

  return (
    <header className="h-16 flex items-center justify-between px-4 bg-white/80 backdrop-blur-md border-b border-gray-200 z-30">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenSidebar}
          className="lg:hidden p-2 hover:bg-gray-100 rounded-lg text-gray-600 active:bg-gray-200 transition-colors"
        >
          <Menu className="w-6 h-6" />
        </button>

        {/* Department Selector */}
        <div className="relative">
          <button
            onClick={() => setIsDeptMenuOpen(!isDeptMenuOpen)}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors active:bg-gray-200"
          >
            {DepartmentIcon && <DepartmentIcon className={`w-4 h-4 ${currentDept?.color}`} />}
            <span className="text-sm font-semibold text-gray-700 hidden sm:inline">
              {currentDept?.name}
            </span>
            <span className="text-sm font-semibold text-gray-700 sm:hidden">
              {currentDept?.name.split(' ')[0]}
            </span>
            <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform duration-200 ${isDeptMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropdown Content */}
          {isDeptMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-40 cursor-default"
                onClick={() => setIsDeptMenuOpen(false)}
              />
              <div className="absolute top-full left-0 mt-2 w-64 bg-white border border-gray-200 shadow-xl rounded-xl overflow-hidden animate-slide-up z-50">
                <div className="p-1">
                  {departments.map(dept => (
                    <button
                      key={dept.id}
                      onClick={() => {
                        onDepartmentChange(dept.id);
                        setIsDeptMenuOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2.5 text-sm rounded-lg flex items-center gap-3 transition-colors ${
                        selectedDepartment === dept.id ? 'bg-belhard-light text-belhard-blue' : 'hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <dept.icon className={`w-4 h-4 ${selectedDepartment === dept.id ? 'text-belhard-blue' : dept.color}`} />
                      <span>{dept.name}</span>
                      {selectedDepartment === dept.id && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-belhard-blue"></div>}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* User Profile */}
      <div className="relative">
        <button
          onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
          className="flex items-center gap-3 hover:bg-gray-50 rounded-lg p-2 transition-colors"
        >
          <div className="text-right hidden sm:block">
            <div className="text-sm font-semibold text-gray-800">Дмитрий Утлик</div>
            <div className="text-xs text-gray-500">AI Product</div>
          </div>
          <img
            src="/images/profile.jpg"
            alt="Дмитрий Утлик"
            className="w-10 h-10 rounded-full object-cover shadow-md"
          />
        </button>

        {/* Profile Dropdown Menu */}
        {isProfileMenuOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsProfileMenuOpen(false)}
            />
            <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-gray-200 rounded-xl shadow-2xl z-50 py-2 animate-slide-up">
              {/* User Info Header */}
              <div className="px-4 py-3 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <img
                    src="/images/profile.jpg"
                    alt="Дмитрий Утлик"
                    className="w-10 h-10 rounded-full object-cover shadow-md"
                  />
                  <div>
                    <div className="text-sm font-semibold text-gray-800">Дмитрий Утлик</div>
                    <div className="text-xs text-gray-500">@utlik</div>
                  </div>
                </div>
              </div>

              {/* Menu Items */}
              <div className="py-1">
                <button
                  onClick={() => {
                    setIsProfileMenuOpen(false);
                    onOpenSettings();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Settings className="w-4 h-4" />
                  <span>Настройки</span>
                </button>
                <button
                  onClick={() => {
                    setIsProfileMenuOpen(false);
                    onOpenHelp();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <HelpCircle className="w-4 h-4" />
                  <span>Помощь</span>
                  <ChevronDown className="w-3 h-3 ml-auto -rotate-90" />
                </button>
              </div>

              {/* Logout */}
              <div className="border-t border-gray-100 mt-1 pt-1">
                <button
                  onClick={() => {
                    setIsProfileMenuOpen(false);
                    onLogoutRequest();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Выход</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </header>
  );
};

export default AppHeader;
