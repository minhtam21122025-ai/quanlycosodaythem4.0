import React, { useState } from 'react';
import { 
  Home, 
  Users, 
  BookOpen, 
  DollarSign, 
  Calendar,
  GraduationCap,
  ChevronLeft,
  ChevronRight,
  X,
  Building2,
  Sparkles
} from 'lucide-react';
import { cn } from '../lib/utils';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths 
} from 'date-fns';
import { vi } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';

import Logo from './Logo';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentUser: any;
  onLogout: () => void;
  logoUrl?: string;
}

const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab, currentUser, onLogout, logoUrl }) => {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const menuItems = [
    { id: 'dashboard', label: 'TRANG CHỦ', icon: Home },
    { id: 'ai_lesson_plan', label: 'TẠO GIÁO ÁN NLS, AI', icon: Sparkles },
    { id: 'business', label: 'HỘ KINH DOANH', icon: Building2 },
    { id: 'students_group', label: 'HỌC SINH', icon: Users },
    { id: 'program', label: 'QUẢN LÝ CHƯƠNG TRÌNH DẠY', icon: BookOpen },
    { id: 'finance_group', label: 'TÀI CHÍNH', icon: DollarSign },
    { id: 'users', label: 'TÀI KHOẢN', icon: Users, adminOnly: true },
  ].filter(item => {
    if (currentUser?.role === 'admin') return true;
    return !item.adminOnly;
  });

  return (
    <header className="fixed top-0 left-0 right-0 z-[60] bg-white dark:bg-slate-900 border-b border-neutral-200 dark:border-slate-800 shadow-md h-28 px-4 lg:px-8 flex flex-col justify-center transition-all duration-300">
      {/* Top Row: Brand and User Actions */}
      <div className="flex items-center justify-between w-full mb-1">
        {/* 1. BÊN TRÁI (Brand) */}
        <div className="flex items-center gap-3 min-w-[200px]">
          <div className="h-12 w-12 flex items-center justify-center bg-white dark:bg-slate-800 rounded-xl shadow-sm p-1">
            <Logo className="h-full w-full" src={logoUrl} />
          </div>
          <div className="flex flex-col">
            <h1 className="text-xl font-black tracking-tighter text-primary leading-none">HOÀNG GIA</h1>
            <p className="text-[8px] font-bold text-neutral-400 dark:text-slate-500 tracking-widest uppercase mt-0.5">Trao cơ hội - Nhận niềm tin</p>
          </div>
        </div>

        {/* 3. BÊN PHẢI (User + Action) */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2">
            <button 
              onClick={() => setIsCalendarOpen(true)}
              className="p-2 text-neutral-400 hover:text-primary hover:bg-primary/5 rounded-xl transition-all"
            >
              <Calendar className="w-5 h-5" />
            </button>
          </div>

          <div className="h-6 w-px bg-neutral-200 dark:bg-slate-800 hidden sm:block" />

          <div className="flex items-center gap-3">
            <div className="text-right hidden md:block">
              <p className="text-[10px] font-black text-neutral-900 dark:text-white leading-none uppercase">{currentUser?.role === 'admin' ? 'QUẢN TRỊ VIÊN' : 'NGƯỜI DÙNG'}</p>
              <div className="flex items-center gap-2 mt-1">
                <button 
                  onClick={onLogout}
                  className="text-[9px] font-bold text-red-500 hover:underline uppercase tracking-tighter"
                >
                  Đăng xuất
                </button>
              </div>
            </div>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center text-white text-sm font-black shadow-lg border-2 border-white dark:border-slate-800">
              {currentUser?.email?.charAt(0).toUpperCase() || 'A'}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row: Navigation Menu */}
      <nav className="hidden lg:flex items-center justify-center gap-2 w-full border-t border-neutral-100 dark:border-slate-800 pt-2 flex-wrap">
        {menuItems.map((item) => {
          const isActive = activeTab === item.id || (item.id === 'program' && ['classes', 'ppct', 'lesson-plan', 'journal'].includes(activeTab)) || (item.id === 'students_group' && ['students-list', 'students-export'].includes(activeTab)) || (item.id === 'finance_group' && ['finance-config', 'finance-ledger', 'finance-vouchers'].includes(activeTab));
          
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all duration-200 group relative",
                "border-b-4 active:border-b-0 active:translate-y-[2px]",
                isActive 
                  ? "bg-primary text-white border-primary-hover shadow-lg shadow-primary/20" 
                  : "bg-white dark:bg-slate-800 text-neutral-600 dark:text-slate-300 border-neutral-200 dark:border-slate-700 hover:bg-neutral-50 dark:hover:bg-slate-700 shadow-sm"
              )}
            >
              <item.icon className={cn("w-3.5 h-3.5", isActive ? "text-white" : "text-neutral-400 group-hover:text-primary")} />
              <span className="text-[10px] font-black tracking-tight uppercase">{item.label}</span>
            </button>
          );
        })}
      </nav>
      {/* Calendar Modal */}
      <AnimatePresence>
        {isCalendarOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden border border-neutral-200 dark:border-slate-800"
            >
              <div className="p-6 border-b border-neutral-100 dark:border-slate-800 flex items-center justify-between bg-neutral-50/50 dark:bg-slate-800/30">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                    className="p-2 hover:bg-neutral-200 dark:hover:bg-slate-700 rounded-xl transition-all text-neutral-600 dark:text-slate-300"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <h3 className="text-lg font-black text-neutral-900 dark:text-white capitalize">
                    {format(currentMonth, 'MMMM yyyy', { locale: vi })}
                  </h3>
                  <button 
                    onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                    className="p-2 hover:bg-neutral-200 dark:hover:bg-slate-700 rounded-xl transition-all text-neutral-600 dark:text-slate-300"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
                <button 
                  onClick={() => setIsCalendarOpen(false)}
                  className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-neutral-400 hover:text-red-500 rounded-xl transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((day) => (
                    <div key={day} className="text-center text-[10px] font-black text-neutral-400 dark:text-slate-500 uppercase tracking-widest py-2">
                      {day}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {(() => {
                    const monthStart = startOfMonth(currentMonth);
                    const monthEnd = endOfMonth(monthStart);
                    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
                    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
                    const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

                    return calendarDays.map((day) => {
                      const isCurrentMonth = isSameMonth(day, monthStart);
                      const isToday = isSameDay(day, new Date());

                      return (
                        <div 
                          key={day.toString()}
                          className={cn(
                            "aspect-square flex items-center justify-center rounded-xl text-sm font-bold transition-all",
                            !isCurrentMonth && "text-neutral-300 dark:text-slate-700",
                            isCurrentMonth && !isToday && "text-neutral-700 dark:text-slate-200 hover:bg-neutral-100 dark:hover:bg-slate-800",
                            isToday && "bg-[#0078D4] text-white shadow-lg shadow-[#0078D4]/30"
                          )}
                        >
                          {format(day, 'd')}
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
              
              <div className="p-4 bg-neutral-50 dark:bg-slate-800/30 border-t border-neutral-100 dark:border-slate-800 flex justify-center">
                <button 
                  onClick={() => setCurrentMonth(new Date())}
                  className="text-xs font-black text-[#0078D4] hover:underline uppercase tracking-widest"
                >
                  Hôm nay: {format(new Date(), 'dd/MM/yyyy')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </header>
  );
};

export default Header;
