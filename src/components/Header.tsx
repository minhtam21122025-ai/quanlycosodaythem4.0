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
  Menu,
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
  onMenuToggle?: () => void;
}

const Header: React.FC<HeaderProps> = ({ currentUser, onLogout, logoUrl, onMenuToggle }) => {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  return (
    <header className="sticky top-0 z-[40] bg-white dark:bg-slate-900 border-b border-neutral-200 dark:border-slate-800 shadow-sm h-20 px-4 lg:px-8 flex items-center justify-between transition-all duration-300">
      {/* Search or Page Title could go here */}
      <div className="flex items-center gap-4">
        <button 
          onClick={onMenuToggle}
          className="lg:hidden p-2 text-neutral-500 hover:text-primary hover:bg-primary/5 rounded-xl transition-all"
        >
          <Menu className="w-6 h-6" />
        </button>
        <h2 className="text-lg lg:text-xl font-black text-neutral-900 dark:text-white tracking-tight uppercase hidden sm:block">
          Hệ thống Quản lý Hoàng Gia
        </h2>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsCalendarOpen(true)}
            className="w-10 h-10 flex items-center justify-center text-neutral-400 hover:text-primary hover:bg-primary/5 rounded-xl transition-all border border-neutral-100 dark:border-slate-800"
          >
            <Calendar className="w-5 h-5" />
          </button>
          
          <div className="h-6 w-px bg-neutral-200 dark:bg-slate-800" />

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-[10px] font-black text-neutral-900 dark:text-white leading-none uppercase">
                {currentUser?.role === 'admin' ? 'QUẢN TRỊ VIÊN' : 'NGƯỜI DÙNG'}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <button 
                  onClick={onLogout}
                  className="text-[9px] font-bold text-red-500 hover:underline uppercase tracking-tighter"
                >
                  Đăng xuất
                </button>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center text-white text-sm font-black shadow-lg border-2 border-white dark:border-slate-800">
              {currentUser?.email?.charAt(0).toUpperCase() || 'A'}
            </div>
          </div>
        </div>
      </div>

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
