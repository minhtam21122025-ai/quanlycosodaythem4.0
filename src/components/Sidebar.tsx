import React from 'react';
import { 
  Home, 
  Users, 
  BookOpen, 
  DollarSign, 
  Calendar,
  Building2,
  Sparkles,
  ClipboardList,
  LogOut,
  Settings,
  ChevronRight,
  X
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import Logo from './Logo';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentUser: any;
  onLogout: () => void;
  isOpen?: boolean;
  onClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, currentUser, onLogout, isOpen, onClose }) => {
  const menuItems = [
    { id: 'dashboard', label: 'TRANG CHỦ', icon: Home },
    { id: 'ai_lesson_plan', label: 'TẠO KHBD NLS, AI', icon: Sparkles },
    { id: 'teacher_lesson_plan', label: 'TẠO KHBD GIÁO VIÊN', icon: ClipboardList },
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
    <>
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[90] lg:hidden"
          />
        )}
      </AnimatePresence>

      <div className={cn(
        "fixed lg:relative inset-y-0 left-0 w-72 bg-white dark:bg-slate-900 border-r border-neutral-200 dark:border-slate-800 shadow-xl z-[100] transition-transform duration-300 transform lg:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-8 border-b border-neutral-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 flex items-center justify-center bg-white dark:bg-slate-800 rounded-xl shadow-sm p-1 border border-neutral-100 dark:border-slate-700">
              <Logo className="h-full w-full" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-xl font-black tracking-tighter text-primary leading-none">HOÀNG GIA</h1>
              <p className="text-[8px] font-bold text-neutral-400 dark:text-slate-500 tracking-widest uppercase mt-0.5">Trao cơ hội - Nhận niềm tin</p>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden p-2 text-neutral-400 hover:text-red-500 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-2 custom-scrollbar">
          {menuItems.map((item) => {
             const isActive = activeTab === item.id || 
              (item.id === 'program' && ['classes', 'ppct', 'lesson-plan', 'journal'].includes(activeTab)) || 
              (item.id === 'students_group' && ['students-list', 'students-export'].includes(activeTab)) || 
              (item.id === 'finance_group' && ['finance-config', 'finance-ledger', 'finance-vouchers'].includes(activeTab));
            
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  if (onClose) onClose();
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-300 group",
                  isActive 
                    ? "bg-primary text-white shadow-lg shadow-primary/20 scale-[1.02]" 
                    : "text-neutral-500 dark:text-slate-400 hover:bg-neutral-50 dark:hover:bg-slate-800/50 hover:text-primary dark:hover:text-white"
                )}
              >
                <item.icon className={cn("w-5 h-5 shrink-0", isActive ? "text-white" : "text-neutral-400 group-hover:text-primary")} />
                <span className="text-[13px] font-black tracking-widest uppercase text-left">{item.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="active-nav"
                    className="ml-auto w-1.5 h-1.5 rounded-full bg-white shadow-sm"
                  />
                )}
              </button>
            );
          })}
        </div>

      <div className="p-6 border-t border-neutral-100 dark:border-slate-800 space-y-4">
        <div className="flex items-center gap-3 p-3 bg-neutral-50 dark:bg-slate-800/50 rounded-2xl border border-neutral-100 dark:border-slate-700">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center text-white text-sm font-black shadow-lg border-2 border-white dark:border-slate-800 shrink-0">
            {currentUser?.email?.charAt(0).toUpperCase() || 'A'}
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-black text-neutral-900 dark:text-white truncate uppercase">
              {currentUser?.role === 'admin' ? 'QUẢN TRỊ VIÊN' : 'NGƯỜI DÙNG'}
            </p>
            <p className="text-[9px] font-medium text-neutral-500 dark:text-slate-400 truncate">
              {currentUser?.email}
            </p>
          </div>
        </div>

        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-2xl transition-all text-[11px] font-black tracking-wider uppercase group"
        >
          <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          Đăng xuất
        </button>
      </div>
    </div>
  </>
);
};

export default Sidebar;
