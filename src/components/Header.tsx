import React from 'react';
import { 
  Home, 
  Users, 
  BookOpen, 
  DollarSign, 
  BarChart3, 
  Settings2, 
  Calendar,
  ChevronDown,
  Menu,
  GraduationCap
} from 'lucide-react';
import { cn } from '../lib/utils';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentUser: any;
  onLogout: () => void;
}

const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab, currentUser, onLogout }) => {
  const menuItems = [
    { id: 'dashboard', label: 'TRANG CHỦ', icon: Home },
    { id: 'students_group', label: 'HỌC SINH', icon: Users },
    { id: 'program', label: 'QUẢN LÝ CHƯƠNG TRÌNH DẠY', icon: BookOpen },
    { id: 'finance_group', label: 'TÀI CHÍNH', icon: DollarSign },
    { id: 'reports', label: 'BÁO CÁO', icon: BarChart3 },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-[60] bg-white dark:bg-slate-900 border-b border-neutral-200 dark:border-slate-800 shadow-sm h-20 px-4 lg:px-8 flex items-center justify-between transition-all duration-300">
      {/* 1. BÊN TRÁI (Brand) */}
      <div className="flex items-center gap-3 min-w-[240px]">
        <div className="w-10 h-10 bg-[#0078D4] rounded-xl flex items-center justify-center shadow-lg shadow-[#0078D4]/20">
          <GraduationCap className="w-6 h-6 text-white" />
        </div>
        <div className="flex flex-col">
          <h1 className="text-xl font-black text-neutral-900 dark:text-white tracking-tight leading-none">HOÀNG GIA</h1>
          <p className="text-[9px] font-bold text-[#0078D4] uppercase tracking-[0.15em] mt-1">TRAO CƠ HỘI - NHẬN NIỀM TIN</p>
        </div>
      </div>

      {/* 2. Ở GIỮA (Menu điều hướng) - Hidden on mobile */}
      <nav className="hidden lg:flex items-center gap-1">
        {menuItems.map((item) => {
          const isActive = activeTab === item.id || (item.id === 'program' && ['classes', 'ppct', 'lesson-plan', 'journal'].includes(activeTab)) || (item.id === 'students_group' && ['students-list', 'students-export'].includes(activeTab)) || (item.id === 'finance_group' && ['finance-config', 'finance-ledger', 'finance-vouchers'].includes(activeTab));
          
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-300 group",
                isActive 
                  ? "bg-[#0078D4]/10 text-[#0078D4]" 
                  : "text-neutral-500 dark:text-slate-400 hover:text-[#0078D4] dark:hover:text-[#0078D4] hover:bg-neutral-50 dark:hover:bg-slate-800"
              )}
            >
              <item.icon className={cn("w-4 h-4", isActive ? "text-[#0078D4]" : "text-neutral-400 group-hover:text-[#0078D4]")} />
              <span className="text-xs font-black tracking-wider">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* 3. BÊN PHẢI (User + Action) */}
      <div className="flex items-center gap-4 lg:gap-6">
        {/* Mobile Menu Toggle */}
        <button className="lg:hidden p-2 text-neutral-500 dark:text-slate-400 hover:bg-neutral-100 dark:hover:bg-slate-800 rounded-lg">
          <Menu className="w-6 h-6" />
        </button>

        <div className="hidden sm:flex items-center gap-4">
          <button className="flex items-center gap-2 px-4 py-2 bg-neutral-100 dark:bg-slate-800 hover:bg-neutral-200 dark:hover:bg-slate-700 text-neutral-700 dark:text-slate-200 rounded-xl transition-all font-bold text-xs group">
            <Settings2 className="w-4 h-4 text-neutral-400 group-hover:text-[#0078D4] transition-colors" />
            Tùy chỉnh
          </button>
          
          <button className="p-2 text-neutral-400 hover:text-[#0078D4] hover:bg-[#0078D4]/5 rounded-xl transition-all">
            <Calendar className="w-5 h-5" />
          </button>
        </div>

        <div className="h-8 w-px bg-neutral-200 dark:bg-slate-800 hidden sm:block" />

        <div className="flex items-center gap-3">
          <div className="text-right hidden md:block">
            <p className="text-sm font-black text-neutral-900 dark:text-white leading-none uppercase">{currentUser?.role === 'admin' ? 'ADMIN' : 'USER'}</p>
            <div className="flex items-center gap-2 mt-1">
              <button 
                onClick={() => setActiveTab('dashboard')}
                className="text-[10px] font-bold text-[#0078D4] hover:underline"
              >
                Quay lại trang chủ
              </button>
              <span className="text-neutral-300 dark:text-slate-700">|</span>
              <button 
                onClick={onLogout}
                className="text-[10px] font-bold text-red-500 hover:underline"
              >
                Đăng xuất
              </button>
            </div>
          </div>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#0078D4] to-indigo-600 flex items-center justify-center text-white font-black shadow-lg shadow-[#0078D4]/20 border-2 border-white dark:border-slate-800">
            {currentUser?.email?.charAt(0).toUpperCase() || 'A'}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
