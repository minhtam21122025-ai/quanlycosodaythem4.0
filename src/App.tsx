/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, 
  GraduationCap, 
  BookOpen, 
  CalendarDays, 
  ClipboardList,
  Users,
  Plus,
  Trash2,
  Download,
  Upload,
  Save,
  ChevronRight,
  Sparkles,
  FileText,
  FileSpreadsheet,
  DollarSign,
  Settings,
  PieChart,
  ArrowRight,
  Check,
  Menu,
  X,
  LayoutDashboard,
  ChevronDown,
  BarChart3,
  Receipt,
  LogOut,
  Lock,
  UserPlus,
  Calendar,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2pdf from 'html2pdf.js';
import { Document, Packer, Paragraph, Table, TableRow, TableCell, WidthType, AlignmentType, HeadingLevel, TextRun, VerticalAlign, BorderStyle, PageBreak } from 'docx';
import { saveAs } from 'file-saver';
import { format, startOfWeek, endOfWeek, addDays, parseISO } from 'date-fns';
import { GoogleGenAI } from "@google/genai";
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { 
  BusinessInfo, 
  ClassSubject, 
  PPCTItem, 
  LessonPlan, 
  LessonPlanRow, 
  Student,
  FinancialConfig,
  IncomeItem,
  ExpenseItem
} from './types';

// --- Utilities ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function numberToVietnameseWords(number: number): string {
  if (number === 0) return "Không đồng";

  const units = ["", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
  const tens = ["", "mười", "hai mươi", "ba mươi", "bốn mươi", "năm mươi", "sáu mươi", "bảy mươi", "tám mươi", "chín mươi"];
  const hundreds = ["không trăm", "một trăm", "hai trăm", "ba trăm", "bốn trăm", "năm trăm", "sáu trăm", "bảy trăm", "tám trăm", "chín trăm"];
  const groups = ["", "nghìn", "triệu", "tỷ", "nghìn tỷ", "triệu tỷ"];

  function readThreeDigits(n: number, isFirstGroup: boolean): string {
    let res = "";
    const h = Math.floor(n / 100);
    const t = Math.floor((n % 100) / 10);
    const u = n % 10;

    if (h > 0 || !isFirstGroup) {
      res += hundreds[h] + " ";
    }

    if (t > 0) {
      res += tens[t] + " ";
      if (u === 1 && t > 1) res = res.trim() + " mốt ";
      else if (u === 5) res = res.trim() + " lăm ";
      else if (u > 0) res += units[u] + " ";
    } else if (u > 0) {
      if (!isFirstGroup || h > 0) res += "lẻ ";
      res += units[u] + " ";
    }

    return res.trim();
  }

  let res = "";
  let groupIdx = 0;
  let tempNum = number;

  while (tempNum > 0) {
    const groupVal = tempNum % 1000;
    if (groupVal > 0) {
      const groupStr = readThreeDigits(groupVal, tempNum < 1000);
      res = groupStr + " " + groups[groupIdx] + " " + res;
    }
    tempNum = Math.floor(tempNum / 1000);
    groupIdx++;
  }

  res = res.trim();
  if (res.startsWith("không trăm ")) {
      res = res.substring(11);
  }
  if (res.startsWith("lẻ ")) {
      res = res.substring(3);
  }

  return res.charAt(0).toUpperCase() + res.slice(1) + " đồng chẵn";
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return "";
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
};

const getLastDayOfMonth = (period: string) => {
  const match = period.match(/Tháng (\d{2})\/(\d{4})/i);
  if (match) {
    const month = parseInt(match[1]);
    const year = parseInt(match[2]);
    const lastDay = new Date(year, month, 0).getDate();
    return `${String(lastDay).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
  }
  return "";
};

function ConfirmButton({ 
  onConfirm, 
  children, 
  className, 
  confirmText = "Bạn có chắc chắn?",
  icon: Icon
}: { 
  onConfirm: () => void, 
  children?: React.ReactNode, 
  className?: string, 
  confirmText?: string,
  icon?: any
}) {
  const [isConfirming, setIsConfirming] = useState(false);

  useEffect(() => {
    if (isConfirming) {
      const timer = setTimeout(() => setIsConfirming(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isConfirming]);

  if (isConfirming) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          onConfirm();
          setIsConfirming(false);
        }}
        className={cn("flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all shadow-sm font-medium animate-pulse", className)}
      >
        {confirmText}
      </button>
    );
  }

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        setIsConfirming(true);
      }}
      className={className}
    >
      {Icon && <Icon className="w-4 h-4" />}
      {children}
    </button>
  );
}

const normalizeGrade = (g: any) => String(g || '').replace(/\D/g, '');

const safeFormat = (dateStr: string | undefined, formatStr: string) => {
  if (!dateStr) return '...';
  try {
    const date = parseISO(dateStr);
    if (isNaN(date.getTime())) return '...';
    return format(date, formatStr);
  } catch (e) {
    return '...';
  }
};

const STORAGE_KEY = 'tutoring_center_data';
const AUTH_KEY = 'tutoring_center_auth';
const USERS_KEY = 'tutoring_center_users';

interface UserAccount {
  id: string;
  email: string;
  password: string;
  role: 'admin' | 'user';
  expiryDate?: string;
  createdAt: string;
}

const INITIAL_CLASSES: ClassSubject[] = [
  { grade: '6', subject: 'Toán', subSubject: 'Số học' },
  { grade: '6', subject: 'Toán', subSubject: 'Hình học' },
  { grade: '6', subject: 'KHTN', subSubject: 'Vật lý' },
  { grade: '7', subject: 'Toán', subSubject: 'Đại số' },
  { grade: '7', subject: 'Toán', subSubject: 'Hình học' },
  { grade: '7', subject: 'KHTN', subSubject: 'Vật lý' },
  { grade: '8', subject: 'Toán', subSubject: 'Đại số' },
  { grade: '8', subject: 'Toán', subSubject: 'Hình học' },
  { grade: '8', subject: 'KHTN', subSubject: 'Vật lý' },
  { grade: '9', subject: 'Toán', subSubject: 'Đại số' },
  { grade: '9', subject: 'Toán', subSubject: 'Hình học' },
  { grade: '9', subject: 'KHTN', subSubject: 'Vật lý' },
];

// --- Components ---

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => {
    const saved = localStorage.getItem(AUTH_KEY);
    return saved ? JSON.parse(saved) : null;
  });
  const [users, setUsers] = useState<UserAccount[]>(() => {
    const saved = localStorage.getItem(USERS_KEY);
    if (saved) return JSON.parse(saved);
    return [{
      id: 'admin-1',
      email: 'cosogiaoduchoanggia269@gmail.com',
      password: 'Laichau@123',
      role: 'admin',
      createdAt: new Date().toISOString()
    }];
  });

  const [activeTab, setActiveTab] = useState('dashboard');
  const [isProgramOpen, setIsProgramOpen] = useState(true);
  const [isStudentsOpen, setIsStudentsOpen] = useState(true);
  const [isFinanceOpen, setIsFinanceOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [businessInfo, setBusinessInfo] = useState<BusinessInfo>({
    name: '',
    address: '',
    taxId: '',
    owner: ''
  });
  const [classes, setClasses] = useState<ClassSubject[]>(INITIAL_CLASSES);
  const [ppctData, setPpctData] = useState<PPCTItem[]>([]);
  const [lessonPlans, setLessonPlans] = useState<LessonPlan[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [financialConfig, setFinancialConfig] = useState<FinancialConfig>({
    reportPeriod: '',
    receiptDate: '',
    paymentDate: '',
    preparer: '',
    treasurer: ''
  });
  const [incomeData, setIncomeData] = useState<IncomeItem[]>([]);
  const [expenseData, setExpenseData] = useState<ExpenseItem[]>([]);
  const [currentPlan, setCurrentPlan] = useState<LessonPlan | null>(null);

  // Load data from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.businessInfo) setBusinessInfo(data.businessInfo);
        if (data.classes) setClasses(data.classes);
        if (data.ppctData) setPpctData(data.ppctData);
        if (data.lessonPlans) setLessonPlans(data.lessonPlans);
        if (data.students) setStudents(data.students);
        if (data.financialConfig) setFinancialConfig(data.financialConfig);
        if (data.incomeData) setIncomeData(data.incomeData);
        if (data.expenseData) setExpenseData(data.expenseData);
      } catch (e) {
        console.error("Failed to parse saved data", e);
      }
    }
  }, []);

  // Save data to localStorage
  useEffect(() => {
    const data = { businessInfo, classes, ppctData, lessonPlans, students, financialConfig, incomeData, expenseData };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [businessInfo, classes, ppctData, lessonPlans, students, financialConfig, incomeData, expenseData]);

  // Save users to localStorage
  useEffect(() => {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }, [users]);

  // Save auth to localStorage
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(AUTH_KEY, JSON.stringify(currentUser));
    } else {
      localStorage.removeItem(AUTH_KEY);
    }
  }, [currentUser]);

  const tabs = [
    { id: 'dashboard', label: 'Tổng quát', icon: LayoutDashboard },
    { id: 'business', label: 'Cấu hình Hộ kinh doanh', icon: Building2, adminOnly: true },
    { 
      id: 'program', 
      label: 'Quản lý Chương trình dạy', 
      icon: BookOpen,
      isOpen: isProgramOpen,
      setIsOpen: setIsProgramOpen,
      subTabs: [
        { id: 'classes', label: 'Cấu hình Lớp học', icon: GraduationCap },
        { id: 'ppct', label: 'Phân phối Chương trình', icon: BookOpen },
        { id: 'lesson-plan', label: 'Lịch báo giảng', icon: CalendarDays },
        { id: 'journal', label: 'Sổ đầu bài', icon: ClipboardList },
      ]
    },
    { 
      id: 'students_group', 
      label: 'Quản lý Học sinh', 
      icon: Users,
      isOpen: isStudentsOpen,
      setIsOpen: setIsStudentsOpen,
      subTabs: [
        { id: 'students-list', label: 'Tải danh sách học sinh', icon: Upload },
        { id: 'students-export', label: 'Xuất đơn đăng kí học thêm', icon: FileText },
      ]
    },
    { 
      id: 'finance_group', 
      label: 'Quản lý Tài chính', 
      icon: DollarSign,
      isOpen: isFinanceOpen,
      setIsOpen: setIsFinanceOpen,
      subTabs: [
        { id: 'finance-config', label: 'Cấu hình và tải nội dung thu, chi', icon: Settings },
        { id: 'finance-ledger', label: 'Xuất sổ doanh thu', icon: FileSpreadsheet },
        { id: 'finance-vouchers', label: 'Xuất phiếu thu, chi', icon: FileText },
      ]
    },
    { id: 'users', label: 'Quản lý Tài khoản', icon: Users, adminOnly: true },
  ];

  const filteredTabs = tabs.filter(tab => {
    if (currentUser?.role === 'admin') return true;
    if (tab.adminOnly) return false;
    // User can only access 4 items: Dashboard, Program, Students, Finance
    return ['dashboard', 'program', 'students_group', 'finance_group'].includes(tab.id);
  });

  const monthlyRevenue = useMemo(() => {
    return incomeData.reduce((sum, item) => sum + item.amount, 0);
  }, [incomeData]);

  const deletePlan = (id: string) => {
    setLessonPlans(lessonPlans.filter(p => p.id !== id));
  };

  if (!currentUser) {
    return <LoginPage onLogin={setCurrentUser} users={users} />;
  }

  return (
    <div className="flex h-screen bg-neutral-100 font-sans text-neutral-900 overflow-hidden">
      {/* Mobile Menu Toggle */}
      <div className="lg:hidden fixed top-0 left-0 right-0 bg-white border-b border-neutral-200 z-50 px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold text-indigo-600 flex items-center gap-2">
          <GraduationCap className="w-5 h-5" />
          Quản lý cơ sở Dạy thêm
        </h1>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 text-neutral-600 hover:bg-neutral-100 rounded-lg"
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileMenuOpen(false)}
            className="lg:hidden fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={cn(
        "fixed lg:static inset-y-0 left-0 w-72 bg-white border-r border-neutral-200 flex flex-col z-50 transition-transform duration-300 transform lg:translate-x-0",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6 border-b border-neutral-200">
          <h1 className="text-xl font-bold tracking-tight text-indigo-600 flex items-center gap-2">
            <GraduationCap className="w-6 h-6" />
            Quản lý cơ sở Dạy thêm
          </h1>
          <p className="text-xs text-neutral-500 mt-1 uppercase tracking-widest font-semibold">Hệ thống quản lý cơ sở Dạy thêm</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {filteredTabs.map((tab) => (
            <div key={tab.id} className="space-y-1">
              {tab.subTabs ? (
                <>
                  <button
                    onClick={() => {
                      tab.setIsOpen && tab.setIsOpen(!tab.isOpen);
                      setActiveTab(tab.id);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 text-left",
                      tab.id === activeTab || (tab.subTabs && tab.subTabs.some(st => st.id === activeTab))
                        ? "bg-indigo-50/50 text-indigo-700"
                        : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
                    )}
                  >
                    <tab.icon className={cn("w-5 h-5 shrink-0", (tab.id === activeTab || (tab.subTabs && tab.subTabs.some(st => st.id === activeTab))) ? "text-indigo-600" : "text-neutral-400")} />
                    <span className="flex-1">{tab.label}</span>
                    <motion.div
                      animate={{ rotate: tab.isOpen ? 90 : 0 }}
                      className="ml-auto"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </motion.div>
                  </button>
                  <AnimatePresence>
                    {tab.isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden pl-4 space-y-1"
                      >
                        {tab.subTabs.map((subTab) => (
                          <button
                            key={subTab.id}
                            onClick={() => {
                              setActiveTab(subTab.id);
                              if (window.innerWidth < 1024) setIsMobileMenuOpen(false);
                            }}
                            className={cn(
                              "w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 text-left",
                              activeTab === subTab.id
                                ? "bg-indigo-50 text-indigo-700 shadow-sm"
                                : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900"
                            )}
                          >
                            <subTab.icon className={cn("w-4 h-4 shrink-0", activeTab === subTab.id ? "text-indigo-600" : "text-neutral-400")} />
                            <span className="truncate">{subTab.label}</span>
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              ) : (
                <button
                  onClick={() => {
                    setActiveTab(tab.id);
                    if (window.innerWidth < 1024) setIsMobileMenuOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200",
                    activeTab === tab.id 
                      ? "bg-indigo-50 text-indigo-700 shadow-sm" 
                      : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
                  )}
                >
                  <tab.icon className={cn("w-5 h-5", activeTab === tab.id ? "text-indigo-600" : "text-neutral-400")} />
                  {tab.label}
                  {activeTab === tab.id && <ChevronRight className="w-4 h-4 ml-auto" />}
                </button>
              )}
            </div>
          ))}
        </nav>

        {currentUser && (
          <div className="p-4 border-t border-neutral-200">
            <div className="flex items-center gap-3 px-4 py-3 mb-2">
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                {currentUser.email[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-neutral-900 truncate">{currentUser.email}</p>
                <p className="text-xs text-neutral-500 capitalize">{currentUser.role === 'admin' ? 'Quản trị viên' : 'Người dùng'}</p>
              </div>
            </div>
            <button
              onClick={() => setCurrentUser(null)}
              className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-all"
            >
              <LogOut className="w-4 h-4" />
              Đăng xuất
            </button>
          </div>
        )}
        
        <div className="p-4 border-t border-neutral-200 text-[10px] text-neutral-400 text-center">
          Bản quyền: Đào Minh Tâm - Zalo 0366000555
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pt-16 lg:pt-0">
        <div className="max-w-6xl mx-auto p-4 md:p-8">
          <DashboardSection 
            studentCount={students.length}
            classCount={classes.length}
            monthlyRevenue={monthlyRevenue}
            reportPeriod={financialConfig.reportPeriod}
          />
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'business' && (
                <BusinessConfigSection 
                  info={businessInfo} 
                  setInfo={setBusinessInfo} 
                />
              )}
              {activeTab === 'classes' && (
                <ClassConfigSection 
                  classes={classes} 
                  setClasses={setClasses} 
                />
              )}
              {activeTab === 'ppct' && (
                <PPCTSection 
                  ppctData={ppctData} 
                  setPpctData={setPpctData} 
                  classes={classes}
                  setPlans={setLessonPlans}
                  plans={lessonPlans}
                  setActiveTab={setActiveTab}
                />
              )}
              {activeTab === 'lesson-plan' && (
                <LessonPlanSection 
                  plans={lessonPlans} 
                  setPlans={setLessonPlans}
                  deletePlan={deletePlan}
                  ppctData={ppctData}
                  classes={classes}
                  businessInfo={businessInfo}
                />
              )}
              {activeTab === 'journal' && (
                <ClassJournalSection 
                  plans={lessonPlans}
                  setPlans={setLessonPlans}
                  deletePlan={deletePlan}
                  businessInfo={businessInfo}
                />
              )}
              {(activeTab === 'students_group' || activeTab === 'students-list' || activeTab === 'students-export') && (
                <StudentManagementSection 
                  students={students}
                  setStudents={setStudents}
                  businessInfo={businessInfo}
                  activeSubTab={activeTab}
                  setActiveTab={setActiveTab}
                />
              )}
              {(activeTab === 'finance_group' || activeTab === 'finance-config' || activeTab === 'finance-ledger' || activeTab === 'finance-vouchers') && (
                <FinancialManagementSection 
                  config={financialConfig}
                  setConfig={setFinancialConfig}
                  incomeData={incomeData}
                  setIncomeData={setIncomeData}
                  expenseData={expenseData}
                  setExpenseData={setExpenseData}
                  businessInfo={businessInfo}
                  activeSubTab={activeTab}
                  setActiveTab={setActiveTab}
                  currentUser={currentUser}
                />
              )}
              {activeTab === 'users' && currentUser.role === 'admin' && (
                <UserManagementSection 
                  users={users} 
                  setUsers={setUsers} 
                />
              )}
            </motion.div>
          </AnimatePresence>
          
          <footer className="mt-12 pt-8 border-t border-neutral-200 text-center text-sm text-neutral-500">
            Bản quyền: Đào Minh Tâm - Zalo 0366000555
          </footer>
        </div>
      </main>
    </div>
  );
}

// --- Section Components ---

function DashboardSection({ 
  studentCount, 
  classCount, 
  monthlyRevenue,
  reportPeriod 
}: { 
  studentCount: number, 
  classCount: number, 
  monthlyRevenue: number,
  reportPeriod: string
}) {
  return (
    <div className="mb-8">
      <h2 className="text-xl font-bold text-neutral-900 mb-4 flex items-center gap-2">
        <LayoutDashboard className="w-5 h-5 text-indigo-600" /> Tổng quát
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-200 flex items-center gap-4"
      >
        <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
          <Users className="w-6 h-6" />
        </div>
        <div>
          <p className="text-sm font-medium text-neutral-500">Tổng số học sinh</p>
          <p className="text-2xl font-bold text-neutral-900 leading-tight">{studentCount}</p>
        </div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-200 flex items-center gap-4"
      >
        <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
          <BookOpen className="w-6 h-6" />
        </div>
        <div>
          <p className="text-sm font-medium text-neutral-500">Số lớp học</p>
          <p className="text-2xl font-bold text-neutral-900 leading-tight">{classCount}</p>
        </div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-200 flex items-center gap-4"
      >
        <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center text-orange-600">
          <DollarSign className="w-6 h-6" />
        </div>
        <div>
          <p className="text-sm font-medium text-neutral-500">Doanh thu {reportPeriod || 'tháng'}</p>
          <p className="text-2xl font-bold text-neutral-900 leading-tight">{monthlyRevenue.toLocaleString()} VNĐ</p>
        </div>
      </motion.div>
      </div>
    </div>
  );
}

function BusinessConfigSection({ info, setInfo }: { info: BusinessInfo, setInfo: (i: BusinessInfo) => void }) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInfo({ ...info, [e.target.name]: e.target.value });
  };

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-bold text-neutral-900">Cấu hình Hộ kinh doanh</h2>
        <p className="text-neutral-500">Thông tin cơ bản về cơ sở dạy thêm của bạn.</p>
      </header>

      <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-neutral-700">Tên Hộ kinh doanh</label>
          <input
            name="name"
            value={info.name}
            onChange={handleChange}
            placeholder="VD: Trung tâm Bồi dưỡng Văn hóa Hoàn Cầu"
            className="w-full px-4 py-2 rounded-lg border border-neutral-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-neutral-700">Chủ hộ kinh doanh</label>
          <input
            name="owner"
            value={info.owner}
            onChange={handleChange}
            placeholder="VD: Nguyễn Văn A"
            className="w-full px-4 py-2 rounded-lg border border-neutral-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-neutral-700">Mã số thuế</label>
          <input
            name="taxId"
            value={info.taxId}
            onChange={handleChange}
            placeholder="VD: 0123456789"
            className="w-full px-4 py-2 rounded-lg border border-neutral-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-neutral-700">Địa điểm kinh doanh</label>
          <input
            name="businessLocation"
            value={info.businessLocation || ""}
            onChange={handleChange}
            placeholder="VD: SN 269 - Lê Duẩn - Phường Tân Phong - Tỉnh Lai Châu"
            className="w-full px-4 py-2 rounded-lg border border-neutral-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <label className="text-sm font-semibold text-neutral-700">Địa chỉ</label>
          <input
            name="address"
            value={info.address}
            onChange={handleChange}
            placeholder="VD: Số 123, Đường ABC, Quận XYZ, TP. HCM"
            className="w-full px-4 py-2 rounded-lg border border-neutral-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
          />
        </div>
        <div className="md:col-span-2 flex justify-end pt-4">
          <button
            onClick={() => alert("Đã lưu cấu hình Hộ kinh doanh!")}
            className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm font-medium"
          >
            <Save className="w-4 h-4" /> Lưu cấu hình
          </button>
        </div>
      </div>
    </div>
  );
}

function ClassConfigSection({ classes, setClasses }: { classes: ClassSubject[], setClasses: (c: ClassSubject[]) => void }) {
  const addRow = () => {
    setClasses([...classes, { grade: '', subject: '', subSubject: '' }]);
  };

  const removeRow = (index: number) => {
    setClasses(classes.filter((_, i) => i !== index));
  };

  const handleChange = (index: number, field: keyof ClassSubject, value: string) => {
    const newClasses = [...classes];
    newClasses[index][field] = value;
    setClasses(newClasses);
  };

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900">Cấu hình Lớp học</h2>
          <p className="text-neutral-500">Thiết lập các khối lớp, môn học và phân môn.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => alert("Đã lưu cấu hình Lớp học!")}
            className="flex items-center gap-2 px-4 py-2 text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors font-medium"
          >
            <Save className="w-4 h-4" /> Lưu cấu hình
          </button>
          <button
            onClick={addRow}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm font-medium"
          >
            <Plus className="w-4 h-4" /> Thêm dòng
          </button>
        </div>
      </header>

      <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-neutral-50 border-b border-neutral-200">
              <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">Khối lớp</th>
              <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">Môn học</th>
              <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">Phân môn</th>
              <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider w-16"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {classes.map((cls, idx) => (
              <tr key={idx} className="hover:bg-neutral-50 transition-colors">
                <td className="px-6 py-3">
                  <input
                    value={cls.grade}
                    onChange={(e) => handleChange(idx, 'grade', e.target.value)}
                    placeholder="VD: 6"
                    className="w-full bg-transparent border-none focus:ring-0 text-sm"
                  />
                </td>
                <td className="px-6 py-3">
                  <input
                    value={cls.subject}
                    onChange={(e) => handleChange(idx, 'subject', e.target.value)}
                    placeholder="VD: Toán"
                    className="w-full bg-transparent border-none focus:ring-0 text-sm"
                  />
                </td>
                <td className="px-6 py-3">
                  <input
                    value={cls.subSubject}
                    onChange={(e) => handleChange(idx, 'subSubject', e.target.value)}
                    placeholder="VD: Đại số"
                    className="w-full bg-transparent border-none focus:ring-0 text-sm"
                  />
                </td>
                <td className="px-6 py-3 text-right">
                  <button
                    onClick={() => removeRow(idx)}
                    className="text-neutral-400 hover:text-red-600 transition-colors p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PPCTSection({ ppctData, setPpctData, classes, setPlans, plans, setActiveTab }: { 
  ppctData: PPCTItem[], 
  setPpctData: (d: PPCTItem[]) => void, 
  classes: ClassSubject[],
  setPlans: (p: LessonPlan[]) => void,
  plans: LessonPlan[],
  setActiveTab: (t: string) => void
}) {
  const [activeGrade, setActiveGrade] = useState<string>('6');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const wb = XLSX.read(data, { type: 'array' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const jsonData = XLSX.utils.sheet_to_json(ws) as any[];
        
        console.log("Raw Excel Data:", jsonData);

        // Map Excel columns to PPCTItem
        // Expected columns: Lớp, Môn, Phân môn, Tiết theo PPCT, Nội dung, Ghi chú
        const mappedData: PPCTItem[] = jsonData.map(row => ({
          grade: normalizeGrade(row['Lớp'] || row['Khối'] || activeGrade),
          subject: String(row['Môn'] || row['Môn học'] || '').trim(),
          subSubject: String(row['Phân môn'] || '').trim(),
          period: Number(row['Tiết theo PPCT'] || row['Tiết'] || 0),
          content: String(row['Nội dung'] || row['Tên bài dạy'] || row['Nội dung bài học'] || '').trim(),
          notes: String(row['Ghi chú'] || '').trim()
        })).filter(item => item.subject && item.content);

        if (mappedData.length === 0) {
          alert("Không tìm thấy dữ liệu hợp lệ trong file Excel. Vui lòng kiểm tra lại định dạng file mẫu (Cần các cột: Lớp, Môn, Phân môn, Tiết theo PPCT, Nội dung).");
          return;
        }

        // Merge with existing data, replacing for this grade
        const targetGrade = normalizeGrade(activeGrade);
        const otherGradesData = ppctData.filter(item => normalizeGrade(item.grade) !== targetGrade);
        setPpctData([...otherGradesData, ...mappedData]);
        alert(`Đã nhận PPCT lớp ${activeGrade} thành công với ${mappedData.length} tiết học!`);
      } catch (err) {
        console.error("Upload error:", err);
        alert("Có lỗi xảy ra khi đọc file Excel. Vui lòng đảm bảo file không bị khóa và đúng định dạng .xlsx");
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const deleteRow = (idx: number) => {
    const filteredData = ppctData.filter(d => normalizeGrade(d.grade) === normalizeGrade(activeGrade));
    const otherGradesData = ppctData.filter(d => normalizeGrade(d.grade) !== normalizeGrade(activeGrade));
    const newFilteredData = filteredData.filter((_, i) => i !== idx);
    setPpctData([...otherGradesData, ...newFilteredData]);
  };

  const downloadSamplePPCT = () => {
    const sampleData = [
      { 'Lớp': activeGrade, 'Môn': 'Toán', 'Phân môn': 'Đại số', 'Tiết theo PPCT': 1, 'Nội dung': 'Tập hợp các số tự nhiên', 'Ghi chú': '' },
      { 'Lớp': activeGrade, 'Môn': 'Toán', 'Phân môn': 'Đại số', 'Tiết theo PPCT': 2, 'Nội dung': 'Các phép tính trong tập hợp số tự nhiên', 'Ghi chú': '' },
      { 'Lớp': activeGrade, 'Môn': 'KHTN', 'Phân môn': 'Vật lý', 'Tiết theo PPCT': 1, 'Nội dung': 'Mở đầu về KHTN', 'Ghi chú': '' },
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "PPCT Mau");
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'binary' });

    function s2ab(s: string) {
      const buf = new ArrayBuffer(s.length);
      const view = new Uint8Array(buf);
      for (let i = 0; i < s.length; i++) view[i] = s.charCodeAt(i) & 0xFF;
      return buf;
    }

    saveAs(new Blob([s2ab(wbout)], { type: "application/octet-stream" }), `Mau_PPCT_Khoi_${activeGrade}.xlsx`);
  };

  const clearData = () => {
    const targetGrade = normalizeGrade(activeGrade);
    setPpctData(ppctData.filter(item => normalizeGrade(item.grade) !== targetGrade));
  };

  const syncToLessonPlan = () => {
    const today = new Date();
    const start = startOfWeek(today, { weekStartsOn: 1 });
    const end = endOfWeek(today, { weekStartsOn: 1 });
    
    const rows: LessonPlanRow[] = [];
    const WEEKDAYS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6'];
    const WEEKEND = ['Thứ 7', 'Chủ Nhật'];

    // Mon-Fri: 2 shifts
    WEEKDAYS.forEach((day, idx) => {
      const date = addDays(start, idx);
      ['Ca 1 (17h-19h)', 'Ca 2 (19h-21h)'].forEach(shift => {
        rows.push({
          id: crypto.randomUUID(),
          day,
          date: format(date, 'dd/MM'),
          shift,
          grade: '',
          subject: '',
          subSubject: '',
          period: '',
          content: '',
          notes: ''
        });
      });
    });

    // Sat-Sun: 6 shifts
    WEEKEND.forEach((day, idx) => {
      const date = addDays(start, 5 + idx);
      [
        'Ca 1 (7h-9h)', 
        'Ca 2 (9h-11h)', 
        'Ca 3 (14h-16h)', 
        'Ca 4 (16h-18h)', 
        'Ca 5 (18h-20h)', 
        'Ca 6 (20h-22h)'
      ].forEach(shift => {
        rows.push({
          id: crypto.randomUUID(),
          day,
          date: format(date, 'dd/MM'),
          shift,
          grade: '',
          subject: '',
          subSubject: '',
          period: '',
          content: '',
          notes: ''
        });
      });
    });

    const newPlan: LessonPlan = {
      id: crypto.randomUUID(),
      teacherName: '',
      week: format(start, 'w'),
      startDate: format(start, 'yyyy-MM-dd'),
      endDate: format(end, 'yyyy-MM-dd'),
      rows
    };

    setPlans([newPlan, ...plans]);
    setActiveTab('lesson-plan');
    alert("Đã tạo một bản thảo Lịch báo giảng mới. Vui lòng kiểm tra trong mục Lịch báo giảng.");
  };

  const grades = Array.from(new Set(classes.map(c => c.grade))).sort();

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900">Phân phối Chương trình</h2>
          <p className="text-neutral-500">Tải lên file Excel chứa nội dung bài học theo từng tiết cho từng khối lớp.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => alert("Đã lưu dữ liệu Phân phối chương trình!")}
            className="flex items-center gap-2 px-4 py-2 text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors font-medium"
          >
            <Save className="w-4 h-4" /> Lưu PPCT
          </button>
          <button
            onClick={downloadSamplePPCT}
            className="flex items-center gap-2 px-4 py-2 text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors font-medium"
          >
            <Download className="w-4 h-4" /> Tải file mẫu
          </button>
          <button
            onClick={syncToLessonPlan}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors shadow-sm font-medium"
          >
            <CalendarDays className="w-4 h-4" /> Đồng bộ sang Lịch báo giảng
          </button>
          <ConfirmButton
            onConfirm={clearData}
            className="flex items-center gap-2 px-4 py-2 text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors font-medium"
            icon={Trash2}
          >
            Xóa dữ liệu khối {activeGrade}
          </ConfirmButton>
          <label className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm font-medium cursor-pointer">
            <Upload className="w-4 h-4" /> Tải Excel Khối {activeGrade}
            <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleFileUpload} />
          </label>
        </div>
      </header>

      <div className="flex gap-2 border-b border-neutral-200">
        {grades.map(g => (
          <button
            key={g}
            onClick={() => setActiveGrade(g)}
            className={cn(
              "px-6 py-3 text-sm font-bold transition-all border-b-2",
              normalizeGrade(activeGrade) === normalizeGrade(g)
                ? "border-indigo-600 text-indigo-600" 
                : "border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300"
            )}
          >
            Khối {g}
          </button>
        ))}
      </div>

      {ppctData.filter(d => normalizeGrade(d.grade) === normalizeGrade(activeGrade)).length > 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden">
          <div className="p-4 bg-indigo-50 border-b border-indigo-100 flex justify-between items-center">
            <span className="text-sm font-medium text-indigo-700">Đã tải {ppctData.filter(d => normalizeGrade(d.grade) === normalizeGrade(activeGrade)).length} tiết học cho Khối {activeGrade}</span>
          </div>
          <div className="max-h-[500px] overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-white shadow-sm z-10">
                <tr className="bg-neutral-50 border-b border-neutral-200">
                  <th className="px-6 py-3 text-xs font-bold text-neutral-500 uppercase tracking-wider">Lớp</th>
                  <th className="px-6 py-3 text-xs font-bold text-neutral-500 uppercase tracking-wider">Môn</th>
                  <th className="px-6 py-3 text-xs font-bold text-neutral-500 uppercase tracking-wider">Phân môn</th>
                  <th className="px-6 py-3 text-xs font-bold text-neutral-500 uppercase tracking-wider">Tiết</th>
                  <th className="px-6 py-3 text-xs font-bold text-neutral-500 uppercase tracking-wider">Nội dung</th>
                  <th className="px-6 py-3 text-xs font-bold text-neutral-500 uppercase tracking-wider text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {ppctData.filter(d => normalizeGrade(d.grade) === normalizeGrade(activeGrade)).map((item, idx) => (
                  <tr key={idx} className="hover:bg-neutral-50 transition-colors text-sm">
                    <td className="px-6 py-3 font-medium">{item.grade}</td>
                    <td className="px-6 py-3">{item.subject}</td>
                    <td className="px-6 py-3">{item.subSubject}</td>
                    <td className="px-6 py-3">{item.period}</td>
                    <td className="px-6 py-3 text-neutral-600">{item.content}</td>
                    <td className="px-6 py-3 text-right">
                      <ConfirmButton 
                        onConfirm={() => deleteRow(idx)}
                        className="p-1.5 text-neutral-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                        icon={Trash2}
                        confirmText="Xóa?"
                      >
                      </ConfirmButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border-2 border-dashed border-neutral-300 p-20 text-center space-y-4">
          <div className="bg-neutral-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
            <FileSpreadsheet className="w-8 h-8 text-neutral-400" />
          </div>
          <div>
            <p className="text-lg font-semibold text-neutral-900">Chưa có dữ liệu PPCT Khối {activeGrade}</p>
            <p className="text-neutral-500 max-w-sm mx-auto">Tải lên file Excel với các cột: Lớp, Môn, Phân môn, Tiết theo PPCT, Nội dung.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function LessonPlanSection({ plans, setPlans, deletePlan, ppctData, classes, businessInfo }: { 
  plans: LessonPlan[], 
  setPlans: (p: LessonPlan[]) => void, 
  deletePlan: (id: string) => void,
  ppctData: PPCTItem[], 
  classes: ClassSubject[],
  businessInfo: BusinessInfo
}) {
  const [isCreating, setIsCreating] = useState(false);
  const [editingPlan, setEditingPlan] = useState<LessonPlan | null>(null);

  const startNewPlan = () => {
    const today = new Date();
    const start = startOfWeek(today, { weekStartsOn: 1 });
    const end = endOfWeek(today, { weekStartsOn: 1 });
    
    const rows: LessonPlanRow[] = [];
    const WEEKDAYS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6'];
    const WEEKEND = ['Thứ 7', 'Chủ Nhật'];

    // Mon-Fri: 2 shifts
    WEEKDAYS.forEach((day, idx) => {
      const date = addDays(start, idx);
      ['Ca 1 (17h-19h)', 'Ca 2 (19h-21h)'].forEach(shift => {
        rows.push({
          id: crypto.randomUUID(),
          day,
          date: format(date, 'dd/MM'),
          shift,
          grade: '',
          subject: '',
          subSubject: '',
          period: '',
          content: '',
          notes: ''
        });
      });
    });

    // Sat-Sun: 6 shifts
    WEEKEND.forEach((day, idx) => {
      const date = addDays(start, 5 + idx);
      [
        'Ca 1 (7h-9h)', 
        'Ca 2 (9h-11h)', 
        'Ca 3 (14h-16h)', 
        'Ca 4 (16h-18h)', 
        'Ca 5 (18h-20h)', 
        'Ca 6 (20h-22h)'
      ].forEach(shift => {
        rows.push({
          id: crypto.randomUUID(),
          day,
          date: format(date, 'dd/MM'),
          shift,
          grade: '',
          subject: '',
          subSubject: '',
          period: '',
          content: '',
          notes: ''
        });
      });
    });

    const newPlan: LessonPlan = {
      id: crypto.randomUUID(),
      teacherName: '',
      week: format(start, 'w'),
      startDate: format(start, 'yyyy-MM-dd'),
      endDate: format(end, 'yyyy-MM-dd'),
      rows
    };
    setEditingPlan(newPlan);
    setIsCreating(true);
  };

  const savePlan = () => {
    if (!editingPlan) return;
    if (plans.find(p => p.id === editingPlan.id)) {
      setPlans(plans.map(p => p.id === editingPlan.id ? editingPlan : p));
    } else {
      setPlans([editingPlan, ...plans]);
    }
    setIsCreating(false);
    setEditingPlan(null);
  };

  const handleRowChange = (rowId: string, field: keyof LessonPlanRow, value: string) => {
    if (!editingPlan) return;
    const newRows = editingPlan.rows.map(row => {
      if (row.id === rowId) {
        const updatedRow = { ...row, [field]: value };
        
        // Reset dependent fields if parent changes
        if (field === 'grade') {
          updatedRow.subject = '';
          updatedRow.subSubject = '';
          updatedRow.period = '';
          updatedRow.content = '';
        } else if (field === 'subject') {
          updatedRow.subSubject = '';
          updatedRow.period = '';
          updatedRow.content = '';
        } else if (field === 'subSubject') {
          updatedRow.period = '';
          updatedRow.content = '';
        } else if (field === 'period') {
          // Auto-sync content from PPCT if period selected
          const ppctMatch = ppctData.find(p => 
            normalizeGrade(p.grade) === normalizeGrade(updatedRow.grade) && 
            String(p.subject).trim().toLowerCase() === String(updatedRow.subject).trim().toLowerCase() && 
            (updatedRow.subSubject ? String(p.subSubject).trim().toLowerCase() === String(updatedRow.subSubject).trim().toLowerCase() : true) &&
            Number(p.period) === Number(value)
          );
          if (ppctMatch) {
            updatedRow.content = ppctMatch.content;
          }
        }
        
        return updatedRow;
      }
      return row;
    });
    setEditingPlan({ ...editingPlan, rows: newRows });
  };

  const autoFillContent = async (rowId: string) => {
    if (!editingPlan) return;
    const row = editingPlan.rows.find(r => r.id === rowId);
    if (!row || !row.grade || !row.subject || !row.period) return;

    // First try to find in PPCT data
    const ppctMatch = ppctData.find(p => 
      String(p.grade) === String(row.grade) && 
      String(p.subject) === String(row.subject) && 
      (row.subSubject ? String(p.subSubject) === String(row.subSubject) : true) &&
      Number(p.period) === Number(row.period)
    );

    if (ppctMatch) {
      handleRowChange(rowId, 'content', ppctMatch.content);
      return;
    }

    // If not found, use AI (Gemini)
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `Dựa trên thông tin sau, hãy cho biết nội dung bài học (tên bài dạy) của tiết học này:
      Khối lớp: ${row.grade}
      Môn học: ${row.subject}
      Phân môn: ${row.subSubject}
      Tiết theo PPCT: ${row.period}
      Trả về duy nhất tên bài học, không thêm gì khác.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      if (response.text) {
        handleRowChange(rowId, 'content', response.text.trim());
      }
    } catch (error) {
      console.error("AI Auto-fill failed", error);
    }
  };

  const exportToWord = async (plan: LessonPlan) => {
    const doc = new Document({
      sections: [{
        properties: {
          page: {
            margin: { top: 850, bottom: 850, left: 1134, right: 850 }
          }
        },
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: `Hộ kinh doanh: ${businessInfo.name}`, size: 22 }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `Địa chỉ: ${businessInfo.address}`, size: 22 }),
            ],
          }),
          new Paragraph({
            text: "KẾ HOẠCH DẠY HỌC CỦA GIÁO VIÊN",
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { before: 400, after: 200 },
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: `Họ tên giáo viên dạy: ${plan.teacherName}`, bold: true, size: 24 }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: `Tuần: ${plan.week} - Từ ngày: ${plan.startDate} - Đến ngày: ${plan.endDate}`, size: 22 }),
            ],
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  "Thứ, ngày", "Ca học", "Lớp", "Môn học", "Phân môn", "Tiết PPCT", "Tên bài dạy", "Ghi chú"
                ].map(text => new TableCell({
                  children: [new Paragraph({ 
                    alignment: AlignmentType.CENTER, 
                    children: [new TextRun({ text, bold: true, size: 22 })] 
                  })],
                  verticalAlign: VerticalAlign.CENTER,
                  shading: { fill: "F2F2F2" }
                })),
              }),
              ...(() => {
                const rowsToExport = plan.rows.filter(r => r.grade);
                const tableRows: TableRow[] = [];
                let lastDay = "";
                
                rowsToExport.forEach((row) => {
                  const dayText = row.day || row.date || '';
                  const isNewDay = dayText !== lastDay;
                  if (isNewDay) lastDay = dayText;

                  const rowChildren: TableCell[] = [];
                  
                  if (isNewDay) {
                    rowChildren.push(new TableCell({
                      children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: dayText, size: 20 })] })],
                      verticalAlign: VerticalAlign.CENTER,
                      rowSpan: rowsToExport.filter(r => (r.day || r.date || '') === dayText).length,
                    }));
                  }

                  // Split shift: "Ca 1 (17h-19h)" -> "Ca 1" and "(17h-19h)"
                  const shiftMatch = row.shift.match(/(Ca \d+)\s*(.*)/);
                  const shiftLine1 = shiftMatch ? shiftMatch[1] : row.shift;
                  const shiftLine2 = shiftMatch ? shiftMatch[2] : "";

                  rowChildren.push(new TableCell({
                    children: [
                      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: shiftLine1, size: 20 })] }),
                      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: shiftLine2, size: 18 })] }),
                    ],
                    verticalAlign: VerticalAlign.CENTER,
                  }));

                  // Lớp, Môn, Phân môn, Tiết - Centered
                  [row.grade, row.subject, row.subSubject, row.period].forEach(text => {
                    rowChildren.push(new TableCell({
                      children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(text), size: 20 })] })],
                      verticalAlign: VerticalAlign.CENTER,
                    }));
                  });

                  // Content, Notes - Left aligned
                  [row.content, row.notes].forEach(text => {
                    rowChildren.push(new TableCell({
                      children: [new Paragraph({ children: [new TextRun({ text: String(text), size: 20 })] })],
                      verticalAlign: VerticalAlign.CENTER,
                    }));
                  });

                  tableRows.push(new TableRow({ children: rowChildren }));
                });
                return tableRows;
              })()
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "\n\n" }),
            ],
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
              insideHorizontal: { style: BorderStyle.NONE },
              insideVertical: { style: BorderStyle.NONE },
            },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    children: [
                      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Người lập", bold: true, size: 22 })] }),
                      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `Ngày ${safeFormat(plan.startDate, 'dd/MM/yyyy')}`, size: 20 })] }),
                      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "(Ký, ghi rõ họ tên)", italics: true, size: 20 })] }),
                      new Paragraph({ 
                        alignment: AlignmentType.CENTER, 
                        children: [new TextRun({ text: plan.teacherName, bold: true, size: 22 })],
                        spacing: { before: 1700 } // Approx 3cm spacing
                      }),
                    ],
                  }),
                  new TableCell({
                    children: [
                      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Duyệt kế hoạch", bold: true, size: 22 })] }),
                      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `Ngày ${safeFormat(plan.startDate, 'dd/MM/yyyy')}`, size: 20 })] }),
                      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "(Ký, ghi rõ họ tên)", italics: true, size: 20 })] }),
                      new Paragraph({ 
                        alignment: AlignmentType.CENTER, 
                        children: [new TextRun({ text: businessInfo.owner, bold: true, size: 22 })],
                        spacing: { before: 1700 } // Approx 3cm spacing
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `LichBaoGiang_${plan.teacherName}_Tuan${plan.week}.docx`);
  };

  if (isCreating && editingPlan) {
    return (
      <div className="space-y-6">
        <header className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-neutral-900">Tạo Lịch báo giảng</h2>
          <div className="flex gap-3">
            <button
              onClick={() => setIsCreating(false)}
              className="px-4 py-2 text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors font-medium"
            >
              Hủy
            </button>
            <button
              onClick={savePlan}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm font-medium"
            >
              <Save className="w-4 h-4" /> Lưu lịch
            </button>
          </div>
        </header>

        <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-neutral-500 uppercase">Họ tên giáo viên</label>
              <input
                value={editingPlan.teacherName}
                onChange={(e) => setEditingPlan({ ...editingPlan, teacherName: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-neutral-300 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-neutral-500 uppercase">Tuần</label>
              <input
                value={editingPlan.week}
                onChange={(e) => setEditingPlan({ ...editingPlan, week: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-neutral-300 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-neutral-500 uppercase">Ngày bắt đầu</label>
              <input
                type="date"
                value={editingPlan.startDate}
                onChange={(e) => {
                  if (!e.target.value) {
                    setEditingPlan({ ...editingPlan, startDate: '', endDate: '' });
                    return;
                  }
                  const start = parseISO(e.target.value);
                  if (isNaN(start.getTime())) return;
                  const end = endOfWeek(start, { weekStartsOn: 1 });
                  setEditingPlan({ 
                    ...editingPlan, 
                    startDate: e.target.value,
                    endDate: format(end, 'yyyy-MM-dd')
                  });
                }}
                className="w-full px-3 py-2 rounded-lg border border-neutral-300 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-neutral-500 uppercase">Ngày kết thúc</label>
              <input
                type="date"
                readOnly
                value={editingPlan.endDate}
                className="w-full px-3 py-2 rounded-lg border border-neutral-300 bg-neutral-50 outline-none"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr className="bg-neutral-50 border-b border-neutral-200">
                  <th className="px-3 py-3 text-[10px] font-bold text-neutral-500 uppercase w-24">Thứ, ngày</th>
                  <th className="px-3 py-3 text-[10px] font-bold text-neutral-500 uppercase w-24">Ca dạy</th>
                  <th className="px-3 py-3 text-[10px] font-bold text-neutral-500 uppercase w-16">Lớp</th>
                  <th className="px-3 py-3 text-[10px] font-bold text-neutral-500 uppercase w-24">Môn</th>
                  <th className="px-3 py-3 text-[10px] font-bold text-neutral-500 uppercase w-24">Phân môn</th>
                  <th className="px-3 py-3 text-[10px] font-bold text-neutral-500 uppercase w-16">Tiết</th>
                  <th className="px-3 py-3 text-[10px] font-bold text-neutral-500 uppercase">Nội dung bài dạy</th>
                  <th className="px-3 py-3 text-[10px] font-bold text-neutral-500 uppercase w-24">Ghi chú</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {editingPlan.rows.map((row) => (
                  <tr key={row.id} className="hover:bg-neutral-50 transition-colors">
                    <td className="px-2 py-2">
                      <input
                        value={row.day}
                        readOnly
                        className="w-full bg-transparent border-none focus:ring-0 text-xs font-medium"
                      />
                      <div className="text-[10px] text-neutral-400 px-1">{row.date}</div>
                    </td>
                    <td className="px-2 py-2">
                      <input
                        value={row.shift}
                        readOnly
                        className="w-full bg-transparent border-none focus:ring-0 text-xs"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <select
                        value={row.grade}
                        onChange={(e) => handleRowChange(row.id, 'grade', e.target.value)}
                        className="w-full bg-transparent border-none focus:ring-0 text-xs"
                      >
                        <option value="">-</option>
                        {Array.from(new Set(classes.map(c => c.grade))).map(g => (
                          <option key={g} value={g}>{g}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <select
                        value={row.subject}
                        onChange={(e) => handleRowChange(row.id, 'subject', e.target.value)}
                        className="w-full bg-transparent border-none focus:ring-0 text-xs"
                      >
                        <option value="">-</option>
                        {Array.from(new Set(classes.filter(c => c.grade === row.grade).map(c => c.subject))).map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <select
                        value={row.subSubject}
                        onChange={(e) => handleRowChange(row.id, 'subSubject', e.target.value)}
                        className="w-full bg-transparent border-none focus:ring-0 text-xs"
                      >
                        <option value="">-</option>
                        {classes.filter(c => c.grade === row.grade && c.subject === row.subject).map(c => (
                          <option key={c.subSubject} value={c.subSubject}>{c.subSubject}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <select
                        value={row.period}
                        onChange={(e) => handleRowChange(row.id, 'period', e.target.value)}
                        className="w-full bg-transparent border-none focus:ring-0 text-xs"
                      >
                        <option value="">-</option>
                        {ppctData
                          .filter(p => 
                            normalizeGrade(p.grade) === normalizeGrade(row.grade) && 
                            String(p.subject).trim().toLowerCase() === String(row.subject).trim().toLowerCase() && 
                            (row.subSubject ? String(p.subSubject).trim().toLowerCase() === String(row.subSubject).trim().toLowerCase() : true)
                          )
                          .sort((a, b) => a.period - b.period)
                          .map((p, pIdx) => (
                            <option key={`${p.grade}-${p.subject}-${p.subSubject}-${p.period}-${pIdx}`} value={String(p.period)}>
                              Tiết {p.period}
                            </option>
                          ))}
                      </select>
                    </td>
                    <td className="px-2 py-2 flex items-center gap-2">
                      <input
                        value={row.content}
                        onChange={(e) => handleRowChange(row.id, 'content', e.target.value)}
                        placeholder="Nội dung bài học..."
                        className="flex-1 bg-transparent border-none focus:ring-0 text-xs"
                      />
                      <button
                        onClick={() => autoFillContent(row.id)}
                        title="AI Tự điền nội dung"
                        className="p-1 text-indigo-500 hover:bg-indigo-50 rounded transition-colors"
                      >
                        <Sparkles className="w-4 h-4" />
                      </button>
                    </td>
                    <td className="px-2 py-2">
                      <input
                        value={row.notes}
                        onChange={(e) => handleRowChange(row.id, 'notes', e.target.value)}
                        className="w-full bg-transparent border-none focus:ring-0 text-xs"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900">Lịch báo giảng</h2>
          <p className="text-neutral-500">Quản lý và tạo lịch báo giảng cho giáo viên.</p>
        </div>
        <button
          onClick={startNewPlan}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm font-medium"
        >
          <Plus className="w-4 h-4" /> Tạo lịch mới
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {plans.map(plan => (
          <div key={plan.id} className="bg-white rounded-xl shadow-sm border border-neutral-200 p-5 hover:shadow-md transition-shadow group">
            <div className="flex justify-between items-start mb-4">
              <div className="bg-indigo-50 p-2 rounded-lg">
                <CalendarDays className="w-6 h-6 text-indigo-600" />
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => { setEditingPlan(plan); setIsCreating(true); }} className="p-2 text-neutral-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50">
                  <FileText className="w-4 h-4" />
                </button>
                <ConfirmButton 
                  onConfirm={() => deletePlan(plan.id)} 
                  className="p-2 text-neutral-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                  icon={Trash2}
                  confirmText="Xóa?"
                >
                </ConfirmButton>
              </div>
            </div>
            <h3 className="font-bold text-lg text-neutral-900">{plan.teacherName || 'Chưa đặt tên GV'}</h3>
            <p className="text-sm text-neutral-500">Tuần {plan.week} ({plan.startDate} - {plan.endDate})</p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => exportToWord(plan)}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-neutral-100 text-neutral-700 rounded-lg hover:bg-neutral-200 transition-colors text-sm font-medium"
              >
                <Download className="w-4 h-4" /> Tải Word
              </button>
            </div>
          </div>
        ))}
        {plans.length === 0 && (
          <div className="col-span-full py-20 text-center bg-white rounded-xl border-2 border-dashed border-neutral-300">
            <p className="text-neutral-500">Chưa có lịch báo giảng nào được tạo.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ClassJournalSection({ plans, setPlans, deletePlan, businessInfo }: { 
  plans: LessonPlan[], 
  setPlans: (p: LessonPlan[]) => void,
  deletePlan: (id: string) => void,
  businessInfo: BusinessInfo
}) {
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  
  const selectedPlan = useMemo(() => plans.find(p => p.id === selectedPlanId), [plans, selectedPlanId]);

  const handleRowChange = (rowId: string, field: 'attendance' | 'comments' | 'signature', value: string) => {
    if (!selectedPlanId) return;
    const newPlans = plans.map(plan => {
      if (plan.id === selectedPlanId) {
        const newRows = plan.rows.map(row => {
          if (row.id === rowId) {
            return { ...row, [field]: value };
          }
          return row;
        });
        return { ...plan, rows: newRows };
      }
      return plan;
    });
    setPlans(newPlans);
  };

  const exportToWord = async () => {
    if (!selectedPlan) return;

    const doc = new Document({
      sections: [{
        properties: {
          page: {
            margin: { top: 1134, bottom: 567, left: 1134, right: 1418 }
          }
        },
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: `Hộ kinh doanh: ${businessInfo.name}`, size: 22 }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `Địa chỉ: ${businessInfo.address}`, size: 22 }),
            ],
          }),
          new Paragraph({
            text: "SỔ ĐẦU BÀI",
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { before: 400, after: 200 },
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: `Tuần: ${selectedPlan.week} - Từ ngày: ${selectedPlan.startDate} - Đến ngày: ${selectedPlan.endDate}`, size: 22 }),
            ],
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  "Thứ ngày tháng", "Buổi", "Lớp", "Môn học", "Phân môn", "Tiết theo KHDH", "Tên bài, nội dung công việc", "Sĩ số", "Nhận xét của giáo viên", "Giáo viên dạy/ký tên"
                ].map(text => new TableCell({
                  children: [new Paragraph({ 
                    alignment: AlignmentType.CENTER, 
                    children: [new TextRun({ text, bold: true, size: 22 })] 
                  })],
                  verticalAlign: VerticalAlign.CENTER,
                  shading: { fill: "F2F2F2" }
                })),
              }),
              ...(() => {
                const rowsToExport = selectedPlan.rows.filter(r => r.grade);
                const tableRows: TableRow[] = [];
                let lastDay = "";
                
                rowsToExport.forEach((row) => {
                  const dayText = row.day + (row.date ? ` (${row.date})` : '');
                  const isNewDay = dayText !== lastDay;
                  if (isNewDay) lastDay = dayText;

                  const rowChildren: TableCell[] = [];
                  
                  if (isNewDay) {
                    rowChildren.push(new TableCell({
                      children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: dayText, size: 20 })] })],
                      verticalAlign: VerticalAlign.CENTER,
                      rowSpan: rowsToExport.filter(r => (r.day + (r.date ? ` (${r.date})` : '')) === dayText).length,
                    }));
                  }

                  // Split shift
                  const shiftMatch = row.shift.match(/(Ca \d+)\s*(.*)/);
                  const shiftLine1 = shiftMatch ? shiftMatch[1] : row.shift;
                  const shiftLine2 = shiftMatch ? shiftMatch[2] : "";

                  rowChildren.push(new TableCell({
                    children: [
                      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: shiftLine1, size: 20 })] }),
                      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: shiftLine2, size: 18 })] }),
                    ],
                    verticalAlign: VerticalAlign.CENTER,
                  }));

                  // Lớp, Môn, Phân môn, Tiết - Centered
                  [row.grade, row.subject, row.subSubject, row.period].forEach(text => {
                    rowChildren.push(new TableCell({
                      children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(text), size: 20 })] })],
                      verticalAlign: VerticalAlign.CENTER,
                    }));
                  });

                  // Content, Attendance, Comments, Signature - Left aligned
                  [row.content, row.attendance || '', row.comments || '', row.signature || ''].forEach(text => {
                    rowChildren.push(new TableCell({
                      children: [new Paragraph({ children: [new TextRun({ text: String(text), size: 20 })] })],
                      verticalAlign: VerticalAlign.CENTER,
                    }));
                  });

                  tableRows.push(new TableRow({ children: rowChildren }));
                });
                return tableRows;
              })()
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "\n\n" }),
            ],
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
              insideHorizontal: { style: BorderStyle.NONE },
              insideVertical: { style: BorderStyle.NONE },
            },
            rows: [
              new TableRow({
                children: [
                  new TableCell({ children: [], width: { size: 60, type: WidthType.PERCENTAGE } }),
                  new TableCell({
                    width: { size: 40, type: WidthType.PERCENTAGE },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({ text: "Xác nhận của Hộ Kinh doanh", bold: true, size: 22 }),
                        ],
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({ text: `Ngày ${safeFormat(selectedPlan.endDate, 'dd/MM/yyyy')}`, size: 20 }),
                        ],
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({ text: "(Ký, ghi rõ họ tên)", italics: true, size: 20 }),
                        ],
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({ text: businessInfo.owner, bold: true, size: 22 }),
                        ],
                        spacing: { before: 1700 } // Approx 3cm spacing
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { before: 400 },
            children: [
              new TextRun({ text: "Bản quyền: Đào Minh Tâm - Zalo 0366000555", size: 16, color: "999999" }),
            ],
          }),
        ],
      }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `SoDauBai_Tuan${selectedPlan.week}.docx`);
  };

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900">Sổ đầu bài</h2>
          <p className="text-neutral-500">Ghi chép tình hình lớp học dựa trên lịch báo giảng.</p>
        </div>
        {selectedPlan && (
          <div className="flex gap-3">
            <ConfirmButton
              onConfirm={() => {
                deletePlan(selectedPlan.id);
                setSelectedPlanId('');
              }}
              className="flex items-center gap-2 px-4 py-2 text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors font-medium"
              icon={Trash2}
            >
              Xóa lịch này
            </ConfirmButton>
            <button
              onClick={exportToWord}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm font-medium"
            >
              <Download className="w-4 h-4" /> Xuất Sổ đầu bài
            </button>
          </div>
        )}
      </header>

      <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6 space-y-6">
        <div className="max-w-xs">
          <label className="text-xs font-bold text-neutral-500 uppercase block mb-1">Chọn lịch báo giảng</label>
          <select
            value={selectedPlanId}
            onChange={(e) => setSelectedPlanId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-neutral-300 focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            <option value="">-- Chọn lịch --</option>
            {plans.map(p => (
              <option key={p.id} value={p.id}>{p.teacherName} - Tuần {p.week}</option>
            ))}
          </select>
        </div>

        {selectedPlan ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1200px]">
              <thead>
                <tr className="bg-neutral-50 border-b border-neutral-200">
                  <th className="px-3 py-3 text-[10px] font-bold text-neutral-500 uppercase w-24">Thứ, ngày</th>
                  <th className="px-3 py-3 text-[10px] font-bold text-neutral-500 uppercase w-24">Buổi</th>
                  <th className="px-3 py-3 text-[10px] font-bold text-neutral-500 uppercase w-16">Lớp</th>
                  <th className="px-3 py-3 text-[10px] font-bold text-neutral-500 uppercase w-24">Môn</th>
                  <th className="px-3 py-3 text-[10px] font-bold text-neutral-500 uppercase">Nội dung bài dạy</th>
                  <th className="px-3 py-3 text-[10px] font-bold text-neutral-500 uppercase w-20">Sĩ số</th>
                  <th className="px-3 py-3 text-[10px] font-bold text-neutral-500 uppercase w-48">Nhận xét</th>
                  <th className="px-3 py-3 text-[10px] font-bold text-neutral-500 uppercase w-32">Chữ ký</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {selectedPlan.rows.filter(r => r.grade).map((row) => (
                  <tr key={row.id} className="hover:bg-neutral-50 transition-colors">
                    <td className="px-3 py-3 text-xs">
                      <div>{row.day}</div>
                      <div className="text-[10px] text-neutral-400">{row.date}</div>
                    </td>
                    <td className="px-3 py-3 text-xs">{row.shift}</td>
                    <td className="px-3 py-3 text-xs font-bold">{row.grade}</td>
                    <td className="px-3 py-3 text-xs">{row.subject}</td>
                    <td className="px-3 py-3 text-xs">{row.content}</td>
                    <td className="px-2 py-2">
                      <input
                        value={row.attendance || ''}
                        onChange={(e) => handleRowChange(row.id, 'attendance', e.target.value)}
                        placeholder="20/20"
                        className="w-full bg-transparent border-none focus:ring-0 text-xs"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        value={row.comments || ''}
                        onChange={(e) => handleRowChange(row.id, 'comments', e.target.value)}
                        placeholder="Lớp học tốt..."
                        className="w-full bg-transparent border-none focus:ring-0 text-xs"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        value={row.signature || ''}
                        onChange={(e) => handleRowChange(row.id, 'signature', e.target.value)}
                        placeholder="Ký tên"
                        className="w-full bg-transparent border-none focus:ring-0 text-xs"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-20 text-center text-neutral-500">
            Vui lòng chọn một lịch báo giảng để bắt đầu ghi sổ đầu bài.
          </div>
        )}
      </div>
    </div>
  );
}

function StudentManagementSection({ 
  students, 
  setStudents, 
  businessInfo,
  activeSubTab,
  setActiveTab
}: { 
  students: Student[], 
  setStudents: (s: Student[]) => void,
  businessInfo: BusinessInfo,
  activeSubTab: string,
  setActiveTab: (t: string) => void
}) {
  if (activeSubTab === 'students_group') {
    return (
      <div className="space-y-6">
        <header>
          <h2 className="text-2xl font-bold text-neutral-900">Quản lý Học sinh</h2>
          <p className="text-neutral-500">Chọn chức năng bạn muốn thực hiện.</p>
        </header>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <button
            onClick={() => setActiveTab('students-list')}
            className="bg-white p-8 rounded-2xl shadow-sm border border-neutral-200 hover:border-indigo-500 hover:shadow-md transition-all text-center group"
          >
            <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mx-auto mb-4 group-hover:scale-110 transition-transform">
              <Upload className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-neutral-900">Tải danh sách học sinh</h3>
            <p className="text-sm text-neutral-500 mt-2">Nhập danh sách học sinh từ file Excel vào hệ thống.</p>
          </button>
          <button
            onClick={() => setActiveTab('students-export')}
            className="bg-white p-8 rounded-2xl shadow-sm border border-neutral-200 hover:border-emerald-500 hover:shadow-md transition-all text-center group"
          >
            <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 mx-auto mb-4 group-hover:scale-110 transition-transform">
              <FileText className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-neutral-900">Xuất đơn đăng kí học thêm</h3>
            <p className="text-sm text-neutral-500 mt-2">Tạo và tải về đơn đăng ký học thêm cho từng học sinh.</p>
          </button>
        </div>
      </div>
    );
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

      // Skip header row and map data
      // Columns: STT, HỌ VÀ TÊN, LỚP, TRƯỜNG, HỌ VÀ TÊN PHỤ HUYNH, SĐT, MÔN ĐĂNG KÍ HỌC, NGÀY ĐĂNG KÍ HỌC
      const newStudents: Student[] = data.slice(1)
        .filter(row => row[1]) // Must have a name
        .map((row, idx) => {
          let phone = String(row[5] || '').trim();
          if (phone && !phone.startsWith('0')) {
            phone = '0' + phone;
          }
          return {
            id: crypto.randomUUID(),
            stt: String(row[0] || idx + 1),
            name: String(row[1] || ''),
            grade: String(row[2] || ''),
            school: String(row[3] || ''),
            parentName: String(row[4] || ''),
            phone: phone,
            subject: String(row[6] || ''),
            registrationDate: String(row[7] || ''),
          };
        });

      setStudents([...students, ...newStudents]);
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const getRegistrationFormChildren = (student: Student) => {
    const parseDate = (dateStr: string) => {
      if (!dateStr) return { d: '......', m: '......', y: '......' };
      const parts = dateStr.split(/[\/\-\.]/);
      if (parts.length === 3) {
        return { d: parts[0].padStart(2, '0'), m: parts[1].padStart(2, '0'), y: parts[2] };
      }
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        return { 
          d: String(d.getDate()).padStart(2, '0'), 
          m: String(d.getMonth() + 1).padStart(2, '0'), 
          y: String(d.getFullYear()) 
        };
      }
      return { d: '......', m: '......', y: '......' };
    };

    const { d, m, y } = parseDate(student.registrationDate);

    return [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { line: 312 },
        children: [
          new TextRun({ text: "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", bold: true, size: 28 }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { line: 312 },
        children: [
          new TextRun({ text: "Độc lập - Tự do - Hạnh phúc", bold: true, size: 26 }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { line: 312 },
        children: [
          new TextRun({ text: "----------***----------", size: 24 }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 400, after: 400, line: 312 },
        children: [
          new TextRun({ text: "ĐƠN ĐĂNG KÍ HỌC THÊM", bold: true, size: 32 }),
        ],
      }),
      new Paragraph({
        indent: { left: 1134 },
        spacing: { line: 312 },
        children: [
          new TextRun({ text: "Kính gửi: ", italics: true, size: 28 }),
          new TextRun({ text: businessInfo.name || "................................................................", bold: true, size: 28 }),
        ],
      }),
      new Paragraph({ spacing: { before: 200, line: 312 } }),
      new Paragraph({
        indent: { firstLine: 567 },
        spacing: { line: 312 },
        children: [
          new TextRun({ text: "Tôi tên là: ", size: 28 }),
          new TextRun({ text: student.parentName || "................................................................", size: 28 }),
        ],
      }),
      new Paragraph({
        indent: { firstLine: 567 },
        spacing: { line: 312 },
        children: [
          new TextRun({ text: "Số điện thoại: ", size: 28 }),
          new TextRun({ text: student.phone || "................................................................", size: 28 }),
        ],
      }),
      new Paragraph({
        indent: { firstLine: 567 },
        spacing: { line: 312 },
        children: [
          new TextRun({ text: "Là Phụ huynh của học sinh: ", size: 28 }),
          new TextRun({ text: student.name || "................................................................", size: 28 }),
        ],
      }),
      new Paragraph({
        indent: { firstLine: 567 },
        spacing: { line: 312 },
        children: [
          new TextRun({ text: "Lớp: ", size: 28 }),
          new TextRun({ text: student.grade || "................................................................", size: 28 }),
        ],
      }),
      new Paragraph({
        indent: { firstLine: 567 },
        spacing: { line: 312 },
        children: [
          new TextRun({ text: "Đang học tại trường: ", size: 28 }),
          new TextRun({ text: student.school || "................................................................", size: 28 }),
        ],
      }),
      new Paragraph({
        indent: { firstLine: 567 },
        spacing: { line: 312 },
        children: [
          new TextRun({ text: "Môn đăng kí học: ", size: 28 }),
          new TextRun({ text: student.subject || "................................................................", size: 28 }),
        ],
      }),
      new Paragraph({
        indent: { firstLine: 567 },
        spacing: { before: 200, line: 312 },
        children: [
          new TextRun({ text: `Tôi viết đơn này đăng kí học thêm môn ${student.subject || '........'} trong năm 2026, do `, size: 28 }),
          new TextRun({ text: businessInfo.name || "................", size: 28 }),
          new TextRun({ text: " tổ chức tại ", size: 28 }),
          new TextRun({ text: businessInfo.address || "................", size: 28 }),
        ],
      }),
      new Paragraph({
        indent: { firstLine: 567 },
        spacing: { before: 200, line: 312 },
        children: [
          new TextRun({ text: "Tôi xin cam kết đối với con tôi sẽ:", size: 28 }),
        ],
      }),
      new Paragraph({
        indent: { firstLine: 567 },
        spacing: { line: 312 },
        children: [
          new TextRun({ text: "+ Chấp hành nghiêm túc nội quy lớp học.", size: 28 }),
        ],
      }),
      new Paragraph({
        indent: { firstLine: 567 },
        spacing: { line: 312 },
        children: [
          new TextRun({ text: "+ Tham gia học tập đầy đủ, đúng giờ.", size: 28 }),
        ],
      }),
      new Paragraph({
        indent: { firstLine: 567 },
        spacing: { line: 312 },
        children: [
          new TextRun({ text: "+ Hoàn thành bài tập và chủ động trong học tập.", size: 28 }),
        ],
      }),
      new Paragraph({
        indent: { firstLine: 567 },
        spacing: { line: 312 },
        children: [
          new TextRun({ text: "Rất mong cơ sở xem xét và chấp thuận.", size: 28 }),
        ],
      }),
      new Paragraph({
        indent: { firstLine: 567 },
        spacing: { before: 400, line: 312 },
        children: [
          new TextRun({ text: "Tôi xin trân trọng cảm ơn!", italics: true, size: 28 }),
        ],
      }),
      new Paragraph({ spacing: { before: 400, line: 312 } }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.NONE },
          bottom: { style: BorderStyle.NONE },
          left: { style: BorderStyle.NONE },
          right: { style: BorderStyle.NONE },
          insideHorizontal: { style: BorderStyle.NONE },
          insideVertical: { style: BorderStyle.NONE },
        },
        rows: [
          new TableRow({
            children: [
              new TableCell({ children: [], width: { size: 50, type: WidthType.PERCENTAGE } }),
              new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { line: 312 },
                    children: [
                      new TextRun({ text: `Lai châu, ngày ${d} tháng ${m} năm ${y}`, italics: true, size: 26 }),
                    ],
                  }),
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { line: 312 },
                    children: [
                      new TextRun({ text: "NGƯỜI LÀM ĐƠN", bold: true, size: 28 }),
                    ],
                  }),
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { line: 312 },
                    children: [
                      new TextRun({ text: "(Kí và ghi rõ họ tên)", italics: true, size: 24 }),
                    ],
                  }),
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 800, line: 312 },
                    children: [
                      new TextRun({ text: student.parentName || "", bold: true, size: 28 }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { before: 400 },
        children: [
          new TextRun({ text: "Bản quyền: Đào Minh Tâm - Zalo 0366000555", size: 16, color: "999999" }),
        ],
      }),
    ];
  };

  const exportRegistrationForm = async (student: Student) => {
    const doc = new Document({
      sections: [{
        properties: {
          page: {
            margin: { top: 1134, bottom: 567, left: 1134, right: 1418 }
          }
        },
        children: getRegistrationFormChildren(student),
      }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `DonDangKiHocThem_${student.name}.docx`);
  };

  const exportAllRegistrationForms = async () => {
    if (students.length === 0) return;
    
    const children: any[] = [];
    students.forEach((student, index) => {
      children.push(...getRegistrationFormChildren(student));
      if (index < students.length - 1) {
        children.push(new Paragraph({ children: [new PageBreak()] }));
      }
    });

    const doc = new Document({
      sections: [{
        properties: {
          page: {
            margin: { top: 1134, bottom: 567, left: 1134, right: 1418 }
          }
        },
        children: children,
      }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `Tat_Ca_Don_Dang_Ky.docx`);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900">Quản lý Học sinh</h2>
          <p className="text-neutral-500">
            {activeSubTab === 'students-list' ? 'Tải danh sách học sinh từ file Excel.' : 'Xuất đơn đăng ký học thêm cho học sinh.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {activeSubTab === 'students-export' && (
            <button
              onClick={exportAllRegistrationForms}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors shadow-sm font-medium w-full md:w-auto justify-center"
            >
              <Download className="w-4 h-4" /> Xuất toàn bộ đơn
            </button>
          )}
          {activeSubTab === 'students-list' && (
            <>
              <ConfirmButton
                onConfirm={() => setStudents([])}
                className="flex items-center gap-2 px-4 py-2 text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors font-medium w-full md:w-auto justify-center"
                icon={Trash2}
              >
                Xóa toàn bộ
              </ConfirmButton>
              <label className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm font-medium cursor-pointer w-full md:w-auto justify-center">
                <Upload className="w-4 h-4" /> Đưa danh sách lên (Excel)
                <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="hidden" />
              </label>
            </>
          )}
        </div>
      </header>

      <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-200">
                <th className="px-4 py-3 text-xs font-bold text-neutral-500 uppercase w-12 text-center">STT</th>
                <th className="px-4 py-3 text-xs font-bold text-neutral-500 uppercase">Họ và tên</th>
                <th className="px-4 py-3 text-xs font-bold text-neutral-500 uppercase w-20 text-center">Lớp</th>
                <th className="px-4 py-3 text-xs font-bold text-neutral-500 uppercase">Trường</th>
                <th className="px-4 py-3 text-xs font-bold text-neutral-500 uppercase">Phụ huynh</th>
                <th className="px-4 py-3 text-xs font-bold text-neutral-500 uppercase">SĐT</th>
                <th className="px-4 py-3 text-xs font-bold text-neutral-500 uppercase">Môn đăng ký</th>
                <th className="px-4 py-3 text-xs font-bold text-neutral-500 uppercase w-32 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {students.map((student, idx) => (
                <tr key={student.id} className="hover:bg-neutral-50 transition-colors">
                  <td className="px-4 py-3 text-sm text-neutral-600 text-center">{student.stt || idx + 1}</td>
                  <td className="px-4 py-3 text-sm font-medium text-neutral-900">{student.name}</td>
                  <td className="px-4 py-3 text-sm text-neutral-600 text-center">{student.grade}</td>
                  <td className="px-4 py-3 text-sm text-neutral-600">{student.school}</td>
                  <td className="px-4 py-3 text-sm text-neutral-600">{student.parentName}</td>
                  <td className="px-4 py-3 text-sm text-neutral-600">{student.phone}</td>
                  <td className="px-4 py-3 text-sm text-neutral-600">{student.subject}</td>
                  <td className="px-4 py-3 text-sm text-center">
                    <div className="flex justify-center gap-2">
                      {activeSubTab === 'students-export' && (
                        <button
                          onClick={() => exportRegistrationForm(student)}
                          title="Xuất đơn đăng ký"
                          className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                      )}
                      {activeSubTab === 'students-list' && (
                        <ConfirmButton
                          onConfirm={() => setStudents(students.filter(s => s.id !== student.id))}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                          icon={Trash2}
                          confirmText="Xóa?"
                        >
                        </ConfirmButton>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {students.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-neutral-500 italic">
                    Chưa có danh sách học sinh. Vui lòng đưa file Excel lên.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function LoginPage({ onLogin, users }: { onLogin: (user: UserAccount) => void, users: UserAccount[] }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const user = users.find(u => u.email === email && u.password === password);
    
    if (user) {
      if (user.expiryDate && new Date(user.expiryDate) < new Date()) {
        setError('Tài khoản đã hết hạn sử dụng.');
        return;
      }
      onLogin(user);
    } else {
      setError('Tài khoản hoặc mật khẩu không chính xác.');
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-neutral-200"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <GraduationCap className="w-10 h-10 text-indigo-600" />
          </div>
          <h1 className="text-2xl font-bold text-neutral-900">Đăng nhập</h1>
          <p className="text-neutral-500 mt-2">Hệ thống quản lý cơ sở Dạy thêm</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">Tài khoản</label>
            <div className="relative">
              <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                placeholder="Nhập tài khoản"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">Mật khẩu</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                placeholder="Nhập mật khẩu"
                required
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg text-center">{error}</p>
          )}

          <button
            type="submit"
            className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
          >
            Đăng nhập
            <ArrowRight className="w-5 h-5" />
          </button>
        </form>
      </motion.div>
    </div>
  );
}

function UserManagementSection({ users, setUsers }: { users: UserAccount[], setUsers: React.Dispatch<React.SetStateAction<UserAccount[]>> }) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [formData, setFormData] = useState({ email: '', password: '', role: 'user' as const, expiryDate: '' });

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUser) {
      setUsers(users.map(u => u.id === editingUser.id ? { ...u, ...formData } : u));
      setEditingUser(null);
    } else {
      const user: UserAccount = {
        id: Math.random().toString(36).substr(2, 9),
        ...formData,
        createdAt: new Date().toISOString()
      };
      setUsers([...users, user]);
      setIsAdding(false);
    }
    setFormData({ email: '', password: '', role: 'user', expiryDate: '' });
  };

  const startEdit = (user: UserAccount) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      password: user.password,
      role: user.role,
      expiryDate: user.expiryDate || ''
    });
    setIsAdding(false);
  };

  const cancelForm = () => {
    setIsAdding(false);
    setEditingUser(null);
    setFormData({ email: '', password: '', role: 'user', expiryDate: '' });
  };

  const deleteUser = (id: string) => {
    setUsers(users.filter(u => u.id !== id));
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900">Quản lý Tài khoản</h2>
          <p className="text-neutral-500">Tạo và quản lý quyền truy cập của người dùng.</p>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
        >
          <UserPlus className="w-5 h-5" />
          Thêm tài khoản
        </button>
      </header>

      {(isAdding || editingUser) && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm"
        >
          <h3 className="text-lg font-bold mb-4">{editingUser ? 'Chỉnh sửa tài khoản' : 'Thêm tài khoản mới'}</h3>
          <form onSubmit={handleSaveUser} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Tài khoản</label>
              <input
                type="text"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Mật khẩu</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Quyền hạn</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as 'admin' | 'user' })}
                className="w-full px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
              >
                <option value="user">Người dùng</option>
                <option value="admin">Quản trị viên</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Hạn sử dụng (Tùy chọn)</label>
              <input
                type="date"
                value={formData.expiryDate}
                onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                className="w-full px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="md:col-span-2 lg:col-span-4 flex justify-end gap-3 mt-2">
              <button
                type="button"
                onClick={cancelForm}
                className="px-4 py-2 text-neutral-600 hover:bg-neutral-100 rounded-xl transition-all"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all"
              >
                {editingUser ? 'Cập nhật' : 'Lưu tài khoản'}
              </button>
            </div>
          </form>
        </motion.div>
      )}

      <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-200">
                <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">Tài khoản</th>
                <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">Quyền hạn</th>
                <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">Ngày tạo</th>
                <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">Hạn sử dụng</th>
                <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-neutral-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                        {user.email[0].toUpperCase()}
                      </div>
                      <span className="font-medium text-neutral-900">{user.email}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2.5 py-1 rounded-full text-xs font-medium",
                      user.role === 'admin' ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                    )}>
                      {user.role === 'admin' ? 'Quản trị viên' : 'Người dùng'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-neutral-500">
                    {formatDate(user.createdAt)}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {user.expiryDate ? (
                      <span className={cn(
                        "flex items-center gap-1.5",
                        new Date(user.expiryDate) < new Date() ? "text-red-600 font-medium" : "text-neutral-600"
                      )}>
                        <Calendar className="w-4 h-4" />
                        {formatDate(user.expiryDate)}
                      </span>
                    ) : (
                      <span className="text-neutral-400 italic">Vô thời hạn</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => startEdit(user)}
                        className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                        title="Chỉnh sửa"
                      >
                        <Settings className="w-5 h-5" />
                      </button>
                      {user.email !== 'cosogiaoduchoanggia269@gmail.com' && (
                        <ConfirmButton
                          onConfirm={() => deleteUser(user.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          icon={Trash2}
                          confirmText="Xác nhận xóa?"
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function FinancialManagementSection({ 
  config, 
  setConfig, 
  incomeData, 
  setIncomeData, 
  expenseData, 
  setExpenseData,
  businessInfo,
  activeSubTab,
  setActiveTab,
  currentUser
}: { 
  config: FinancialConfig, 
  setConfig: (c: FinancialConfig) => void,
  incomeData: IncomeItem[],
  setIncomeData: (d: IncomeItem[]) => void,
  expenseData: ExpenseItem[],
  setExpenseData: (d: ExpenseItem[]) => void,
  businessInfo: BusinessInfo,
  activeSubTab: string,
  setActiveTab: (t: string) => void,
  currentUser: UserAccount | null
}) {
  useEffect(() => {
    if (currentUser) {
      const savedData = localStorage.getItem(`finance_data_${currentUser.id}`);
      if (savedData) {
        try {
          const parsed = JSON.parse(savedData);
          if (parsed.incomeData) setIncomeData(parsed.incomeData);
          if (parsed.expenseData) setExpenseData(parsed.expenseData);
          if (parsed.config) setConfig(parsed.config);
        } catch (e) {
          console.error("Error loading saved finance data", e);
        }
      }
    }
  }, [currentUser]);

  if (activeSubTab === 'finance_group') {
    return (
      <div className="space-y-6">
        <header>
          <h2 className="text-2xl font-bold text-neutral-900">Quản lý Tài chính</h2>
          <p className="text-neutral-500">Chọn chức năng bạn muốn thực hiện.</p>
        </header>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <button
            onClick={() => setActiveTab('finance-config')}
            className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-200 hover:border-indigo-500 hover:shadow-md transition-all text-center group"
          >
            <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mx-auto mb-4 group-hover:scale-110 transition-transform">
              <Settings className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-neutral-900">Cấu hình và tải nội dung thu, chi</h3>
            <p className="text-sm text-neutral-500 mt-2">Thiết lập thông tin báo cáo và nhập dữ liệu tài chính.</p>
          </button>
          <button
            onClick={() => setActiveTab('finance-ledger')}
            className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-200 hover:border-emerald-500 hover:shadow-md transition-all text-center group"
          >
            <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 mx-auto mb-4 group-hover:scale-110 transition-transform">
              <BarChart3 className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-neutral-900">Xuất sổ doanh thu</h3>
            <p className="text-sm text-neutral-500 mt-2">Tải về sổ doanh thu bán hàng hóa, dịch vụ (S1-HKD).</p>
          </button>
          <button
            onClick={() => setActiveTab('finance-vouchers')}
            className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-200 hover:border-orange-500 hover:shadow-md transition-all text-center group"
          >
            <div className="w-14 h-14 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-600 mx-auto mb-4 group-hover:scale-110 transition-transform">
              <Receipt className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-neutral-900">Xuất phiếu thu, chi</h3>
            <p className="text-sm text-neutral-500 mt-2">Tạo và tải về các phiếu thu, phiếu chi tiền mặt.</p>
          </button>
        </div>
      </div>
    );
  }

  const [isConfigSaved, setIsConfigSaved] = useState(!!config.reportPeriod);
  const [isSyncing, setIsSyncing] = useState(false);

  const syncData = async () => {
    if (!currentUser) {
      alert("Vui lòng đăng nhập để đồng bộ dữ liệu.");
      return;
    }
    
    setIsSyncing(true);
    try {
      // Simulate sync to Firebase
      // In a real app, we would use setDoc(doc(db, "users", currentUser.uid, "finance", "data"), ...)
      const dataToSync = {
        incomeData,
        expenseData,
        config,
        updatedAt: new Date().toISOString()
      };
      
      localStorage.setItem(`finance_data_${currentUser.id}`, JSON.stringify(dataToSync));
      
      // Artificial delay to show syncing state
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      alert("Dữ liệu đã được đồng bộ thành công!");
    } catch (error) {
      console.error("Sync error:", error);
      alert("Lỗi khi đồng bộ dữ liệu.");
    } finally {
      setIsSyncing(false);
    }
  };

  const exportVouchersToPDF = async () => {
    if (incomeData.length === 0 && expenseData.length === 0) {
      alert("Chưa có dữ liệu để xuất phiếu.");
      return;
    }

    const container = document.createElement('div');
    container.style.width = '165mm'; // A4 width (210) - margins (20+25) = 165mm
    container.style.margin = '0';
    container.style.backgroundColor = 'white';
    
    const allItems = [
      ...incomeData.map(item => ({ type: 'receipt' as const, data: item })),
      ...expenseData.map(item => ({ type: 'payment' as const, data: item }))
    ];

    allItems.forEach((item, index) => {
      const isReceipt = item.type === 'receipt';
      const data = item.data;
      const dateStr = isReceipt ? config.receiptDate : config.paymentDate;
      const dateObj = dateStr ? new Date(dateStr) : new Date();
      const day = dateObj.getDate().toString().padStart(2, '0');
      const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
      const year = dateObj.getFullYear();
      const voucherNo = (index + 1).toString().padStart(3, '0');
      const prefix = isReceipt ? 'PT' : 'PC';

      const voucherDiv = document.createElement('div');
      voucherDiv.style.width = '100%';
      voucherDiv.style.height = '125mm'; // Approx half A4 height
      voucherDiv.style.boxSizing = 'border-box';
      voucherDiv.style.fontFamily = "'Times New Roman', serif";
      voucherDiv.style.position = 'relative';
      voucherDiv.style.backgroundColor = 'white';
      
      // Second voucher in page has 2cm gap from separator
      if (index % 2 !== 0) {
        voucherDiv.style.marginTop = '20mm';
      }

      voucherDiv.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
          <div style="width: 55%;">
            <div style="font-weight: bold; font-size: 12pt;">HỘ, CÁ NHÂN KINH DOANH: <span style="font-weight: normal;">${businessInfo.name}</span></div>
            <div style="font-weight: bold; font-size: 12pt;">Địa chỉ: <span style="font-weight: normal;">${businessInfo.address}</span></div>
          </div>
          <div style="width: 45%; text-align: center;">
            <div style="font-weight: bold; font-size: 12pt;">Mẫu số 0${isReceipt ? '1' : '2'} – TT</div>
            <div style="font-size: 10pt; font-style: italic; line-height: 1.2;">
              (Ban hành kèm theo Thông tư số 88/2021/TT-BTC<br/>
              ngày 11 tháng 10 năm 2021 của Bộ trưởng Bộ Tài chính)
            </div>
          </div>
        </div>
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
          <div style="width: 30%;"></div>
          <div style="width: 40%; text-align: center;">
            <h2 style="font-size: 18pt; font-weight: bold; margin: 0; text-transform: uppercase;">${isReceipt ? 'PHIẾU THU' : 'PHIẾU CHI'}</h2>
            <div style="font-style: italic; font-size: 12pt;">Ngày ${day} tháng ${month} năm ${year}</div>
          </div>
          <div style="width: 30%; font-size: 12pt;">
            <div>Quyển số: ...................</div>
            <div>Số: <span style="font-weight: bold;">${prefix}${voucherNo}</span></div>
          </div>
        </div>
        
        <div style="margin-bottom: 20px; font-size: 13pt; line-height: 1.6;">
          <div style="display: flex; font-size: 13pt;">
            <span style="white-space: nowrap;">Họ và tên người ${isReceipt ? 'nộp' : 'nhận'} tiền:</span>
            <span style="flex-grow: 1; border-bottom: 1px dotted #000; margin-left: 5px; font-weight: bold; padding-left: 5px;">${data.name}</span>
          </div>
          <div style="display: flex; font-size: 13pt;">
            <span style="white-space: nowrap;">Địa chỉ:</span>
            <span style="flex-grow: 1; border-bottom: 1px dotted #000; margin-left: 5px; padding-left: 5px;">${data.address}</span>
          </div>
          <div style="display: flex; font-size: 13pt;">
            <span style="white-space: nowrap;">Lý do ${isReceipt ? 'nộp' : 'chi'}:</span>
            <span style="flex-grow: 1; border-bottom: 1px dotted #000; margin-left: 5px; padding-left: 5px;">${isReceipt ? 'Thu tiền học phí, dịch vụ giáo dục' : 'Chi phí hoạt động cơ sở'}</span>
          </div>
          <div style="display: flex; align-items: baseline; font-size: 13pt;">
            <span style="white-space: nowrap;">Số tiền:</span>
            <span style="border-bottom: 1px dotted #000; padding: 0 10px; font-weight: bold;">${data.amount.toLocaleString()} VNĐ</span>
            <span style="white-space: nowrap; margin-left: 5px;">(Viết bằng chữ):</span>
            <span style="flex-grow: 1; border-bottom: 1px dotted #000; margin-left: 5px; font-style: italic; padding-left: 5px;">${numberToVietnameseWords(data.amount)}</span>
          </div>
          <div style="border-bottom: 1px dotted #000; height: 1.6em;"></div>
          <div style="display: flex; font-size: 13pt;">
            <span style="white-space: nowrap;">Kèm theo:</span>
            <span style="flex-grow: 1; border-bottom: 1px dotted #000; margin-left: 5px;"></span>
            <span style="white-space: nowrap; margin-left: 10px;">Chứng từ gốc:</span>
            <span style="width: 100px; border-bottom: 1px dotted #000; margin-left: 5px;"></span>
          </div>
        </div>
        
        <div style="text-align: right; font-style: italic; font-size: 11pt; margin-bottom: 5px; padding-right: 40px;">
          Ngày ${day} tháng ${month} năm ${year}
        </div>
        
        <table style="width: 100%; border-collapse: collapse; text-align: center; font-size: 11pt;">
          <tr>
            <td style="width: 30%; vertical-align: top;">
              <div style="font-weight: bold; line-height: 1.2;">NGƯỜI ĐẠI DIỆN<br/>HỘ KINH DOANH/<br/>CA NHÂN KINH DOANH</div>
              <div style="font-style: italic; font-size: 11pt;">(Ký, họ tên, đóng dấu)</div>
              <div style="margin-top: 40px; font-weight: bold;">${businessInfo.owner || ""}</div>
            </td>
            <td style="width: 20%; vertical-align: top;">
              <div style="font-weight: bold;">NGƯỜI LẬP<br/>BIỂU</div>
              <div style="font-style: italic; font-size: 11pt;">(Ký, họ tên)</div>
              <div style="margin-top: 40px; font-weight: bold;">${config.preparer || ""}</div>
            </td>
            <td style="width: 25%; vertical-align: top;">
              <div style="font-weight: bold;">NGƯỜI ${isReceipt ? 'NỘP' : 'NHẬN'}<br/>TIỀN</div>
              <div style="font-style: italic; font-size: 11pt;">(Ký, họ tên)</div>
              <div style="margin-top: 40px; font-weight: bold;">${data.name}</div>
            </td>
            <td style="width: 25%; vertical-align: top;">
              <div style="font-weight: bold;">THỦ QUỸ</div>
              <div style="font-style: italic; font-size: 11pt;">(Ký, họ tên)</div>
              <div style="margin-top: 40px; font-weight: bold;">${config.treasurer || ""}</div>
            </td>
          </tr>
        </table>
        
        <div style="font-size: 11pt; margin-top: 15px; display: flex;">
          <span style="white-space: nowrap;">Đã nhận đủ số tiền (viết bằng chữ):</span>
          <span style="flex-grow: 1; border-bottom: 1px dotted #000; margin-left: 5px;"></span>
        </div>
        
        <div style="position: absolute; bottom: 5px; right: 5px; font-size: 8pt; color: #999;">
          Bản quyền: Đào Minh Tâm - Zalo 0366000555
        </div>
      `;
      
      container.appendChild(voucherDiv);
      
      // Separator line after first voucher
      if (index % 2 === 0 && index < allItems.length - 1) {
        const separator = document.createElement('div');
        separator.style.width = '100%';
        separator.style.borderBottom = '1px dashed #ccc';
        separator.style.margin = '5mm 0 20mm 0'; // 2cm margin bottom for the separator to push the next voucher
        container.appendChild(separator);
      }

      // Page break after every 2 vouchers
      if ((index + 1) % 2 === 0 && index < allItems.length - 1) {
        const pageBreak = document.createElement('div');
        pageBreak.style.pageBreakAfter = 'always';
        container.appendChild(pageBreak);
      }
    });

    const opt = {
      margin: [20, 20, 10, 25] as [number, number, number, number], // [top, left, bottom, right] in mm
      filename: `Phieu_Thu_Chi_${new Date().getTime()}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { 
        scale: 2, 
        useCORS: true,
        logging: false,
        letterRendering: true
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const }
    };

    // Append to body to ensure it's rendered correctly
    document.body.appendChild(container);
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.display = 'block';
    container.style.zIndex = '-1';

    try {
      // Small delay to ensure DOM is ready
      await new Promise(resolve => setTimeout(resolve, 100));
      await html2pdf().from(container).set(opt).save();
    } catch (err) {
      console.error("PDF Export error:", err);
      alert("Lỗi khi xuất PDF. Vui lòng thử lại.");
    } finally {
      document.body.removeChild(container);
    }
  };

  const exportSingleVoucherPDF = async (item: IncomeItem | ExpenseItem, type: 'receipt' | 'payment') => {
    const isReceipt = type === 'receipt';
    const dateStr = isReceipt ? config.receiptDate : config.paymentDate;
    const dateObj = dateStr ? new Date(dateStr) : new Date();
    const day = dateObj.getDate().toString().padStart(2, '0');
    const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
    const year = dateObj.getFullYear();
    const voucherNo = "001";
    const prefix = isReceipt ? 'PT' : 'PC';

    const container = document.createElement('div');
    container.style.width = '165mm';
    container.style.backgroundColor = 'white';
    container.style.fontFamily = "'Times New Roman', serif";

    container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
        <div style="width: 55%;">
          <div style="font-weight: bold; font-size: 12pt;">HỘ, CÁ NHÂN KINH DOANH: <span style="font-weight: normal;">${businessInfo.name}</span></div>
          <div style="font-weight: bold; font-size: 12pt;">Địa chỉ: <span style="font-weight: normal;">${businessInfo.address}</span></div>
        </div>
        <div style="width: 45%; text-align: center;">
          <div style="font-weight: bold; font-size: 12pt;">Mẫu số 0${isReceipt ? '1' : '2'} – TT</div>
          <div style="font-size: 10pt; font-style: italic; line-height: 1.2;">
            (Ban hành kèm theo Thông tư số 88/2021/TT-BTC<br/>
            ngày 11 tháng 10 năm 2021 của Bộ trưởng Bộ Tài chính)
          </div>
        </div>
      </div>
      
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
        <div style="width: 30%;"></div>
        <div style="width: 40%; text-align: center;">
          <h2 style="font-size: 18pt; font-weight: bold; margin: 0; text-transform: uppercase;">${isReceipt ? 'PHIẾU THU' : 'PHIẾU CHI'}</h2>
          <div style="font-style: italic; font-size: 12pt;">Ngày ${day} tháng ${month} năm ${year}</div>
        </div>
        <div style="width: 30%; font-size: 12pt;">
          <div>Quyển số: ...................</div>
          <div>Số: <span style="font-weight: bold;">${prefix}${voucherNo}</span></div>
        </div>
      </div>
      
      <div style="margin-bottom: 20px; font-size: 13pt; line-height: 1.6;">
        <div style="display: flex; font-size: 13pt;">
          <span style="white-space: nowrap;">Họ và tên người ${isReceipt ? 'nộp' : 'nhận'} tiền:</span>
          <span style="flex-grow: 1; border-bottom: 1px dotted #000; margin-left: 5px; font-weight: bold; padding-left: 5px;">${item.name}</span>
        </div>
        <div style="display: flex; font-size: 13pt;">
          <span style="white-space: nowrap;">Địa chỉ:</span>
          <span style="flex-grow: 1; border-bottom: 1px dotted #000; margin-left: 5px; padding-left: 5px;">${item.address}</span>
        </div>
        <div style="display: flex; font-size: 13pt;">
          <span style="white-space: nowrap;">Lý do ${isReceipt ? 'nộp' : 'chi'}:</span>
          <span style="flex-grow: 1; border-bottom: 1px dotted #000; margin-left: 5px; padding-left: 5px;">${isReceipt ? 'Thu tiền học phí, dịch vụ giáo dục' : 'Chi phí hoạt động cơ sở'}</span>
        </div>
        <div style="display: flex; align-items: baseline; font-size: 13pt;">
          <span style="white-space: nowrap;">Số tiền:</span>
          <span style="border-bottom: 1px dotted #000; padding: 0 10px; font-weight: bold;">${item.amount.toLocaleString()} VNĐ</span>
          <span style="white-space: nowrap; margin-left: 5px;">(Viết bằng chữ):</span>
          <span style="flex-grow: 1; border-bottom: 1px dotted #000; margin-left: 5px; font-style: italic; padding-left: 5px;">${numberToVietnameseWords(item.amount)}</span>
        </div>
        <div style="border-bottom: 1px dotted #000; height: 1.6em;"></div>
        <div style="display: flex; font-size: 13pt;">
          <span style="white-space: nowrap;">Kèm theo:</span>
          <span style="flex-grow: 1; border-bottom: 1px dotted #000; margin-left: 5px;"></span>
          <span style="white-space: nowrap; margin-left: 10px;">Chứng từ gốc:</span>
          <span style="width: 100px; border-bottom: 1px dotted #000; margin-left: 5px;"></span>
        </div>
      </div>
      
      <div style="text-align: right; font-style: italic; font-size: 11pt; margin-bottom: 5px; padding-right: 40px;">
        Ngày ${day} tháng ${month} năm ${year}
      </div>
      
      <table style="width: 100%; border-collapse: collapse; text-align: center; font-size: 11pt;">
        <tr>
          <td style="width: 30%; vertical-align: top;">
            <div style="font-weight: bold; line-height: 1.2;">NGƯỜI ĐẠI DIỆN<br/>HỘ KINH DOANH/<br/>CA NHÂN KINH DOANH</div>
            <div style="font-style: italic; font-size: 11pt;">(Ký, họ tên, đóng dấu)</div>
            <div style="margin-top: 40px; font-weight: bold;">${businessInfo.owner || ""}</div>
          </td>
          <td style="width: 20%; vertical-align: top;">
            <div style="font-weight: bold;">NGƯỜI LẬP<br/>BIỂU</div>
            <div style="font-style: italic; font-size: 11pt;">(Ký, họ tên)</div>
            <div style="margin-top: 40px; font-weight: bold;">${config.preparer || ""}</div>
          </td>
          <td style="width: 25%; vertical-align: top;">
            <div style="font-weight: bold;">NGƯỜI ${isReceipt ? 'NỘP' : 'NHẬN'}<br/>TIỀN</div>
            <div style="font-style: italic; font-size: 11pt;">(Ký, họ tên)</div>
            <div style="margin-top: 40px; font-weight: bold;">${item.name}</div>
          </td>
          <td style="width: 25%; vertical-align: top;">
            <div style="font-weight: bold;">THỦ QUỸ</div>
            <div style="font-style: italic; font-size: 11pt;">(Ký, họ tên)</div>
            <div style="margin-top: 40px; font-weight: bold;">${config.treasurer || ""}</div>
          </td>
        </tr>
      </table>
      
      <div style="font-size: 11pt; margin-top: 15px; display: flex;">
        <span style="white-space: nowrap;">Đã nhận đủ số tiền (viết bằng chữ):</span>
        <span style="flex-grow: 1; border-bottom: 1px dotted #000; margin-left: 5px;"></span>
      </div>

      <div style="position: absolute; bottom: 5px; right: 5px; font-size: 8pt; color: #999;">
        Bản quyền: Đào Minh Tâm - Zalo 0366000555
      </div>
    `;

    const opt = {
      margin: [20, 20, 10, 25] as [number, number, number, number],
      filename: `${isReceipt ? 'PhieuThu' : 'PhieuChi'}_${item.name}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { 
        scale: 2, 
        useCORS: true,
        logging: false,
        letterRendering: true
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const }
    };

    // Append to body to ensure it's rendered correctly
    document.body.appendChild(container);
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.display = 'block';
    container.style.zIndex = '-1';

    try {
      // Small delay to ensure DOM is ready
      await new Promise(resolve => setTimeout(resolve, 100));
      await html2pdf().from(container).set(opt).save();
    } catch (err) {
      console.error("PDF Export error:", err);
      alert("Lỗi khi xuất PDF. Vui lòng thử lại.");
    } finally {
      document.body.removeChild(container);
    }
  };

  const handleIncomeUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

      // Fixed indices as requested: A=0, B=1, C=2, AK=36
      const sttIdx = 0;
      const nameIdx = 1;
      const addressIdx = 2;
      const amountIdx = 36;

      // Find the start of data - we look for a row that has "HỌ VÀ TÊN" in column B (index 1)
      let headerRowIdx = -1;
      for (let i = 0; i < data.length; i++) {
        if (String(data[i][nameIdx] || '').includes('HỌ VÀ TÊN')) {
          headerRowIdx = i;
          break;
        }
      }

      if (headerRowIdx === -1) {
        // Fallback: if header not found, assume data starts after some common header rows (e.g., row 5)
        // but it's safer to alert if the template is expected to have specific text.
        alert("Không tìm thấy dòng tiêu đề có 'HỌ VÀ TÊN' ở cột B.");
        return;
      }

      const newIncome: IncomeItem[] = data.slice(headerRowIdx + 1)
        .filter(row => row[nameIdx] && row[amountIdx])
        .map(row => ({
          id: crypto.randomUUID(),
          stt: String(row[sttIdx] || ''),
          name: String(row[nameIdx] || ''),
          address: String(row[addressIdx] || ''),
          amount: Number(row[amountIdx] || 0),
          date: config.receiptDate
        }));

      setIncomeData([...incomeData, ...newIncome]);
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const handleExpenseUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

      let headerRowIdx = -1;
      for (let i = 0; i < data.length; i++) {
        if (data[i].some(cell => String(cell).includes('Họ và tên'))) {
          headerRowIdx = i;
          break;
        }
      }

      if (headerRowIdx === -1) {
        alert("Không tìm thấy cột 'Họ và tên' trong file.");
        return;
      }

      const headers = data[headerRowIdx].map(h => String(h || '').trim());
      const sttIdx = headers.findIndex(h => h === 'TT' || h === 'STT');
      const nameIdx = headers.findIndex(h => h === 'Họ và tên');
      const addressIdx = headers.findIndex(h => h === 'Địa chỉ');
      const contentIdx = headers.findIndex(h => h === 'Nội dung chi');
      const amountIdx = headers.findIndex(h => h === 'Số tiền chi');

      if (nameIdx === -1 || amountIdx === -1) {
        alert("Không tìm thấy cột 'Họ và tên' hoặc 'Số tiền chi'.");
        return;
      }

      const newExpense: ExpenseItem[] = data.slice(headerRowIdx + 1)
        .filter(row => row[nameIdx] && row[amountIdx])
        .map(row => ({
          id: crypto.randomUUID(),
          stt: String(row[sttIdx] || ''),
          name: String(row[nameIdx] || ''),
          address: String(row[addressIdx] || ''),
          content: String(row[contentIdx] || ''),
          amount: Number(row[amountIdx] || 0),
          date: config.paymentDate
        }));

      setExpenseData([...expenseData, ...newExpense]);
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const downloadIncomeTemplate = () => {
    const header1: any[] = [];
    header1[0] = "STT";
    header1[1] = "HỌ VÀ TÊN";
    header1[2] = "Địa chỉ";
    header1[3] = "BUỔI HỌC TRONG THÁNG";
    
    const header2: any[] = [];
    for (let i = 1; i <= 31; i++) {
      header2[2 + i] = i;
    }
    header2[34] = "Số buổi học";
    header2[35] = "Số tiền 1 buổi";
    header2[36] = "Tổng tiền thu";
    header2[37] = "Ghi chú";

    const ws = XLSX.utils.aoa_to_sheet([header1, header2]);
    
    // Merge "BUỔI HỌC TRONG THÁNG" across 31 columns
    ws['!merges'] = [
      { s: { r: 0, c: 3 }, e: { r: 0, c: 33 } }, // Merge days 1-31
      { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } }, // Merge STT
      { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } }, // Merge Name
      { s: { r: 0, c: 2 }, e: { r: 1, c: 2 } }, // Merge Address
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Mau_Cham_Cong");
    XLSX.writeFile(wb, "Mau_Cham_Cong_Thu_Tien.xlsx");
  };

  const downloadExpenseTemplate = () => {
    const headers = [["TT", "Họ và tên", "Địa chỉ", "Nội dung chi", "Số tiền chi"]];
    const ws = XLSX.utils.aoa_to_sheet(headers);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Mau_Chi_Tien");
    XLSX.writeFile(wb, "Mau_Noi_Dung_Chi.xlsx");
  };

  const exportS1aHKD = async () => {
    const doc = new Document({
      sections: [{
        properties: {
          page: {
            margin: { top: 1134, bottom: 567, left: 1134, right: 1418 }
          }
        },
        children: [
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
              insideHorizontal: { style: BorderStyle.NONE },
              insideVertical: { style: BorderStyle.NONE },
            },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 60, type: WidthType.PERCENTAGE },
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({ text: "HỘ, CÁ NHÂN KINH DOANH: ", bold: true, size: 24 }),
                          new TextRun({ text: businessInfo.name.toUpperCase(), bold: true, size: 24 }),
                        ],
                      }),
                      new Paragraph({
                        children: [
                          new TextRun({ text: "Địa chỉ: ", bold: true, size: 24 }),
                          new TextRun({ text: businessInfo.address, size: 24 }),
                        ],
                      }),
                      new Paragraph({
                        children: [
                          new TextRun({ text: "Mã số thuế: ", bold: true, size: 24 }),
                          new TextRun({ text: businessInfo.taxId, size: 24 }),
                        ],
                      }),
                    ],
                  }),
                  new TableCell({
                    width: { size: 40, type: WidthType.PERCENTAGE },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({ text: "Mẫu số S1a-HKD", bold: true, size: 22 }),
                        ],
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({ text: "(Kèm theo Thông tư số 152/2025/TT-BTC", italics: true, size: 20 }),
                        ],
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({ text: "ngày 31 tháng 12 năm 2025 của Bộ trưởng Bộ Tài chính)", italics: true, size: 20 }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 600, after: 300 },
            children: [
              new TextRun({ text: "SỔ CHI TIẾT DOANH THU BÁN HÀNG HÓA, DỊCH VỤ", bold: true, size: 36 }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: `Địa điểm kinh doanh: ${businessInfo.businessLocation || businessInfo.address}`, size: 26 }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
            children: [
              new TextRun({ text: `Kỳ kê khai: ${config.reportPeriod}`, size: 26 }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { after: 200 },
            children: [
              new TextRun({ text: "Đơn vị tính: VNĐ", italics: true, size: 24 }),
            ],
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Ngày tháng", bold: true, size: 26 })] })], verticalAlign: VerticalAlign.CENTER }),
                  new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Giao dịch", bold: true, size: 26 })] })], verticalAlign: VerticalAlign.CENTER }),
                  new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Số tiền", bold: true, size: 26 })] })], verticalAlign: VerticalAlign.CENTER }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "A", italics: true, size: 24 })] })] }),
                  new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "B", italics: true, size: 24 })] })] }),
                  new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "1", italics: true, size: 24 })] })] }),
                ],
              }),
              ...incomeData.map(item => new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: formatDate(item.date) || getLastDayOfMonth(config.reportPeriod), size: 26 })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `Thu tiền học phí - ${item.name} ${item.address}`, size: 26 })] })] }),
                  new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: item.amount.toLocaleString(), size: 26 })] })] }),
                ],
              })),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Tổng cộng", bold: true, size: 26 })] })], columnSpan: 2 }),
                  new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: incomeData.reduce((sum, item) => sum + item.amount, 0).toLocaleString(), bold: true, size: 26 })] })] }),
                ],
              }),
            ],
          }),
          new Paragraph({ spacing: { before: 800 } }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
              insideHorizontal: { style: BorderStyle.NONE },
              insideVertical: { style: BorderStyle.NONE },
            },
            rows: [
              new TableRow({
                children: [
                  new TableCell({ children: [], width: { size: 50, type: WidthType.PERCENTAGE } }),
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({ text: "Ngày ...... tháng ...... năm ......", italics: true, size: 24 }),
                        ],
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({ text: "NGƯỜI ĐẠI DIỆN HỘ KINH DOANH/", bold: true, size: 24 }),
                        ],
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({ text: "CÁ NHÂN KINH DOANH", bold: true, size: 24 }),
                        ],
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({ text: "(Ký, ghi rõ họ tên, đóng dấu(nếu có))", italics: true, size: 20 }),
                        ],
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 1200 },
                        children: [
                          new TextRun({ text: businessInfo.owner || "................", bold: true, size: 24 }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { before: 400 },
            children: [
              new TextRun({ text: "Bản quyền: Đào Minh Tâm - Zalo 0366000555", size: 16, color: "999999" }),
            ],
          }),
        ],
      }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `SoDoanhThu_${config.reportPeriod.replace(/\//g, '-')}.docx`);
  };

  const getReceiptVoucherChildren = (item: IncomeItem, index: number = 0) => {
    const dateParts = config.receiptDate.split('-');
    const d = dateParts[2] || '...';
    const m = dateParts[1] || '...';
    const y = dateParts[0] || '...';
    const voucherNo = `PT${d}${m}${y.slice(-2)}-${String(index + 1).padStart(3, '0')}`;

    const noBorder = {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.NONE },
    };

    return [
      // Header Table
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: noBorder,
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 60, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({ text: "HỘ, CÁ NHÂN KINH DOANH: ", bold: true, size: 20 }),
                      new TextRun({ text: businessInfo.name || "................", size: 20 }),
                    ],
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({ text: "Địa chỉ: ", bold: true, size: 20 }),
                      new TextRun({ text: businessInfo.address || "................", size: 20 }),
                    ],
                  }),
                ],
              }),
              new TableCell({
                width: { size: 40, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new TextRun({ text: "Mẫu số 01 – TT", bold: true, size: 20 }),
                    ],
                  }),
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new TextRun({ 
                        text: "(Ban hành kèm theo Thông tư số 88/2021/TT-BTC ngày 11 tháng 10 năm 2021 của Bộ trưởng Bộ Tài chính)", 
                        italics: true, 
                        size: 16 
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),

      // Title Section
      new Paragraph({ spacing: { before: 200 } }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: noBorder,
        rows: [
          new TableRow({
            children: [
              new TableCell({ width: { size: 25, type: WidthType.PERCENTAGE }, children: [] }),
              new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new TextRun({ text: "PHIẾU THU", bold: true, size: 32 }),
                    ],
                  }),
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new TextRun({ text: `Ngày ${d} tháng ${m} năm ${y}`, italics: true, size: 20 }),
                    ],
                  }),
                ],
              }),
              new TableCell({
                width: { size: 25, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({ text: "Quyển số: ", size: 20 }),
                      new TextRun({ text: "................", size: 20 }),
                    ],
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({ text: "Số: ", size: 20 }),
                      new TextRun({ text: voucherNo, size: 20 }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),

      new Paragraph({ spacing: { before: 200 } }),
      new Paragraph({
        children: [
          new TextRun({ text: "Họ và tên người nộp tiền: ", size: 26 }),
          new TextRun({ text: item.name || "................................................................", bold: true, size: 26 }),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({ text: "Địa chỉ: ", size: 26 }),
          new TextRun({ text: item.address || "................................................................", size: 26 }),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({ text: "Lý do nộp: ", size: 26 }),
          new TextRun({ text: `Nộp tiền học phí ${config.reportPeriod}`, size: 26 }),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({ text: "Số tiền: ", size: 26 }),
          new TextRun({ text: `${item.amount.toLocaleString()} VNĐ`, bold: true, size: 26 }),
          new TextRun({ text: " (Viết bằng chữ): ", size: 26 }),
          new TextRun({ text: numberToVietnameseWords(item.amount), italics: true, size: 26 }),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({ text: "Kèm theo: ", size: 26 }),
          new TextRun({ text: `Bảng chấm công và thu tiền ${config.reportPeriod}`, size: 26 }),
          new TextRun({ text: " Chứng từ gốc: ", size: 26 }),
          new TextRun({ text: "................", size: 26 }),
        ],
      }),

      // Signatures
      new Paragraph({ spacing: { before: 200 } }),
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [
          new TextRun({ text: `Ngày ${d} tháng ${m} năm ${y}`, italics: true, size: 18 }),
        ],
      }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: noBorder,
        rows: [
          new TableRow({
            children: [
              new TableCell({
                children: [
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "NGƯỜI ĐẠI DIỆN", bold: true, size: 22 })] }),
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "HỘ KINH DOANH/", bold: true, size: 22 })] }),
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "CÁ NHÂN KINH DOANH", bold: true, size: 22 })] }),
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "(Ký, họ tên, đóng dấu)", italics: true, size: 22 })] }),
                ],
              }),
              new TableCell({
                children: [
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "NGƯỜI LẬP BIỂU", bold: true, size: 22 })] }),
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "(Ký, họ tên)", italics: true, size: 22 })] }),
                ],
              }),
              new TableCell({
                children: [
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "NGƯỜI NỘP TIỀN", bold: true, size: 22 })] }),
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "(Ký, họ tên)", italics: true, size: 22 })] }),
                ],
              }),
              new TableCell({
                children: [
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "THỦ QUỸ", bold: true, size: 22 })] }),
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "(Ký, họ tên)", italics: true, size: 22 })] }),
                ],
              }),
            ],
          }),
          new TableRow({
            children: [
              new TableCell({
                children: [
                  new Paragraph({ spacing: { before: 400 } }),
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: businessInfo.owner || "", bold: true, size: 22 })] }),
                ],
              }),
              new TableCell({
                children: [
                  new Paragraph({ spacing: { before: 400 } }),
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: config.preparer || "", bold: true, size: 22 })] }),
                ],
              }),
              new TableCell({
                children: [
                  new Paragraph({ spacing: { before: 400 } }),
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: item.name, bold: true, size: 22 })] }),
                ],
              }),
              new TableCell({
                children: [
                  new Paragraph({ spacing: { before: 400 } }),
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: config.treasurer || "", bold: true, size: 22 })] }),
                ],
              }),
            ],
          }),
        ],
      }),
      new Paragraph({ spacing: { before: 200 } }),
      new Paragraph({
        children: [
          new TextRun({ text: "Đã nhận đủ số tiền (viết bằng chữ): ", size: 20 }),
          new TextRun({ text: "....................................................................................................", size: 20 }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { before: 200 },
        children: [
          new TextRun({ text: "Bản quyền: Đào Minh Tâm - Zalo 0366000555", size: 16, color: "999999" }),
        ],
      }),
    ];
  };

  const getPaymentVoucherChildren = (item: ExpenseItem, index: number = 0) => {
    const dateParts = config.paymentDate.split('-');
    const d = dateParts[2] || '...';
    const m = dateParts[1] || '...';
    const y = dateParts[0] || '...';
    const voucherNo = `PC${d}${m}${y.slice(-2)}-${String(index + 1).padStart(3, '0')}`;

    const noBorder = {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.NONE },
    };

    return [
      // Header Table
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: noBorder,
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 60, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({ text: "HỘ, CÁ NHÂN KINH DOANH: ", bold: true, size: 20 }),
                      new TextRun({ text: businessInfo.name || "................", size: 20 }),
                    ],
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({ text: "Địa chỉ: ", bold: true, size: 20 }),
                      new TextRun({ text: businessInfo.address || "................", size: 20 }),
                    ],
                  }),
                ],
              }),
              new TableCell({
                width: { size: 40, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new TextRun({ text: "Mẫu số 01 – TT", bold: true, size: 20 }),
                    ],
                  }),
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new TextRun({ 
                        text: "(Ban hành kèm theo Thông tư số 88/2021/TT-BTC ngày 11 tháng 10 năm 2021 của Bộ trưởng Bộ Tài chính)", 
                        italics: true, 
                        size: 16 
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),

      // Title Section
      new Paragraph({ spacing: { before: 200 } }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: noBorder,
        rows: [
          new TableRow({
            children: [
              new TableCell({ width: { size: 25, type: WidthType.PERCENTAGE }, children: [] }),
              new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new TextRun({ text: "PHIẾU CHI", bold: true, size: 32 }),
                    ],
                  }),
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new TextRun({ text: `Ngày ${d} tháng ${m} năm ${y}`, italics: true, size: 20 }),
                    ],
                  }),
                ],
              }),
              new TableCell({
                width: { size: 25, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({ text: "Quyển số: ", size: 20 }),
                      new TextRun({ text: "................", size: 20 }),
                    ],
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({ text: "Số: ", size: 20 }),
                      new TextRun({ text: voucherNo, size: 20 }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),

      new Paragraph({ spacing: { before: 200 } }),
      new Paragraph({
        children: [
          new TextRun({ text: "Họ và tên người nhận tiền: ", size: 26 }),
          new TextRun({ text: item.name || "................................................................", bold: true, size: 26 }),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({ text: "Địa chỉ: ", size: 26 }),
          new TextRun({ text: item.address || "................................................................", size: 26 }),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({ text: "Lý do chi: ", size: 26 }),
          new TextRun({ text: `Chi tiền học phí ${config.reportPeriod}`, size: 26 }),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({ text: "Số tiền: ", size: 26 }),
          new TextRun({ text: `${item.amount.toLocaleString()} VNĐ`, bold: true, size: 26 }),
          new TextRun({ text: " (Viết bằng chữ): ", size: 26 }),
          new TextRun({ text: numberToVietnameseWords(item.amount), italics: true, size: 26 }),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({ text: "Kèm theo: ", size: 26 }),
          new TextRun({ text: `Bảng chấm công và thu tiền ${config.reportPeriod}`, size: 26 }),
          new TextRun({ text: " Chứng từ gốc: ", size: 26 }),
          new TextRun({ text: "................", size: 26 }),
        ],
      }),

      // Signatures
      new Paragraph({ spacing: { before: 200 } }),
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [
          new TextRun({ text: `Ngày ${d} tháng ${m} năm ${y}`, italics: true, size: 18 }),
        ],
      }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: noBorder,
        rows: [
          new TableRow({
            children: [
              new TableCell({
                children: [
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "NGƯỜI ĐẠI DIỆN", bold: true, size: 22 })] }),
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "HỘ KINH DOANH/", bold: true, size: 22 })] }),
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "CÁ NHÂN KINH DOANH", bold: true, size: 22 })] }),
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "(Ký, họ tên, đóng dấu)", italics: true, size: 22 })] }),
                ],
              }),
              new TableCell({
                children: [
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "NGƯỜI LẬP BIỂU", bold: true, size: 22 })] }),
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "(Ký, họ tên)", italics: true, size: 22 })] }),
                ],
              }),
              new TableCell({
                children: [
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "NGƯỜI NHẬN TIỀN", bold: true, size: 22 })] }),
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "(Ký, họ tên)", italics: true, size: 22 })] }),
                ],
              }),
              new TableCell({
                children: [
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "THỦ QUỸ", bold: true, size: 22 })] }),
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "(Ký, họ tên)", italics: true, size: 22 })] }),
                ],
              }),
            ],
          }),
          new TableRow({
            children: [
              new TableCell({
                children: [
                  new Paragraph({ spacing: { before: 400 } }),
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: businessInfo.owner || "", bold: true, size: 22 })] }),
                ],
              }),
              new TableCell({
                children: [
                  new Paragraph({ spacing: { before: 400 } }),
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: config.preparer || "", bold: true, size: 22 })] }),
                ],
              }),
              new TableCell({
                children: [
                  new Paragraph({ spacing: { before: 400 } }),
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: item.name, bold: true, size: 22 })] }),
                ],
              }),
              new TableCell({
                children: [
                  new Paragraph({ spacing: { before: 400 } }),
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: config.treasurer || "", bold: true, size: 22 })] }),
                ],
              }),
            ],
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { before: 200 },
        children: [
          new TextRun({ text: "Bản quyền: Đào Minh Tâm - Zalo 0366000555", size: 16, color: "999999" }),
        ],
      }),
    ];
  };

  const exportReceipt = async (item: IncomeItem) => {
    const doc = new Document({
      sections: [{
        properties: {
          page: {
            margin: { top: 1134, bottom: 567, left: 1134, right: 1418 }
          }
        },
        children: getReceiptVoucherChildren(item),
      }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `PhieuThu_${item.name}.docx`);
  };

  const exportPaymentVoucher = async (item: ExpenseItem) => {
    const doc = new Document({
      sections: [{
        properties: {
          page: {
            margin: { top: 1134, bottom: 567, left: 1134, right: 1418 }
          }
        },
        children: getPaymentVoucherChildren(item),
      }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `PhieuChi_${item.name}.docx`);
  };

  const exportAllVouchers = async () => {
    const children: any[] = [];
    
    // Combine income and expense items
    const allItems = [
      ...incomeData.map(item => ({ type: 'receipt' as const, data: item })),
      ...expenseData.map(item => ({ type: 'payment' as const, data: item }))
    ];

    let receiptCount = 0;
    let paymentCount = 0;

    allItems.forEach((item, index) => {
      if (item.type === 'receipt') {
        children.push(...getReceiptVoucherChildren(item.data as IncomeItem, receiptCount));
        receiptCount++;
      } else {
        children.push(...getPaymentVoucherChildren(item.data as ExpenseItem, paymentCount));
        paymentCount++;
      }

      // Add separator or page break
      if (index < allItems.length - 1) {
        if (index % 2 === 0) {
          // Even index (0, 2, 4...) means it's the first voucher on the page
          children.push(new Paragraph({ 
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 200 },
            children: [new TextRun({ text: "----------------------------------------------------------------------------------------------------", size: 20 })] 
          }));
        } else {
          // Odd index (1, 3, 5...) means it's the second voucher on the page
          children.push(new Paragraph({ 
            children: [new PageBreak()],
            spacing: { before: 0, after: 0 }
          }));
        }
      }
    });

    const doc = new Document({
      sections: [{
        properties: {
          page: {
            margin: { top: 1134, bottom: 567, left: 1134, right: 1418 }
          }
        },
        children: children,
      }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `Tat_Ca_Phieu_Thu_Chi.docx`);
  };

  const subTabs = [
    { id: 'finance-config', label: 'Cấu hình & Tải lên', icon: Settings },
    { id: 'finance-ledger', label: 'Xuất sổ doanh thu', icon: BarChart3 },
    { id: 'finance-vouchers', label: 'Xuất phiếu thu, chi', icon: Receipt },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900">Quản lý Tài chính</h2>
          <p className="text-neutral-500">
            {activeSubTab === 'finance-config' && 'Cấu hình báo cáo và tải nội dung thu chi.'}
            {activeSubTab === 'finance-ledger' && 'Xuất sổ doanh thu bán hàng hóa, dịch vụ.'}
            {activeSubTab === 'finance-vouchers' && 'Xuất phiếu thu, phiếu chi theo mẫu.'}
          </p>
        </div>
        <div className="flex bg-neutral-200/50 p-1 rounded-xl self-start">
          {subTabs.map((st) => (
            <button
              key={st.id}
              onClick={() => setActiveTab(st.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                activeSubTab === st.id
                  ? "bg-white text-indigo-600 shadow-sm"
                  : "text-neutral-600 hover:text-neutral-900"
              )}
            >
              <st.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{st.label}</span>
            </button>
          ))}
        </div>
      </header>

      {activeSubTab === 'finance-config' && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-neutral-200">
        <h3 className="text-lg font-bold text-neutral-900 mb-4 flex items-center gap-2">
          <Settings className="w-5 h-5 text-indigo-600" /> Cấu hình báo cáo
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-neutral-700">Kì báo cáo (VD: Tháng 01/2026)</label>
            <input 
              type="text" 
              value={config.reportPeriod}
              onChange={(e) => setConfig({ ...config, reportPeriod: e.target.value })}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="Tháng 01/2026"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-neutral-700">Ngày xuất phiếu thu</label>
            <input 
              type="date" 
              value={config.receiptDate}
              onChange={(e) => setConfig({ ...config, receiptDate: e.target.value })}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-neutral-700">Ngày xuất phiếu chi</label>
            <input 
              type="date" 
              value={config.paymentDate}
              onChange={(e) => setConfig({ ...config, paymentDate: e.target.value })}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-neutral-700">Người lập biểu</label>
            <input 
              type="text" 
              value={config.preparer}
              onChange={(e) => setConfig({ ...config, preparer: e.target.value })}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="Họ và tên người lập biểu"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-neutral-700">Thủ quỹ</label>
            <input 
              type="text" 
              value={config.treasurer}
              onChange={(e) => setConfig({ ...config, treasurer: e.target.value })}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="Họ và tên thủ quỹ"
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button 
            onClick={() => {
              if (!config.reportPeriod || !config.receiptDate || !config.paymentDate || !config.preparer || !config.treasurer) {
                alert("Vui lòng điền đầy đủ thông tin cấu hình.");
                return;
              }
              setIsConfigSaved(true);
              alert("Đã lưu cấu hình báo cáo!");
            }}
            className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm font-medium"
          >
            <Save className="w-4 h-4" /> Lưu cấu hình
          </button>
        </div>
      </div>
      )}

      {activeSubTab === 'finance-config' && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-neutral-200">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
                  <PieChart className="w-5 h-5 text-emerald-600" /> Nội dung thu
                </h3>
                <button 
                  onClick={downloadIncomeTemplate}
                  className="text-xs font-medium text-emerald-600 hover:underline flex items-center gap-1"
                >
                  <Download className="w-3 h-3" /> Tải file mẫu
                </button>
              </div>
              <p className="text-sm text-neutral-500 mb-4">Tải lên bảng chấm công và thu tiền để đồng bộ dữ liệu.</p>
              <div className="flex gap-3">
                <label className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-neutral-300 rounded-xl hover:border-emerald-500 hover:bg-emerald-50 transition-all cursor-pointer group">
                  <Upload className="w-5 h-5 text-neutral-400 group-hover:text-emerald-600" />
                  <span className="text-sm font-medium text-neutral-600 group-hover:text-emerald-700">Tải lên Nội dung thu</span>
                  <input type="file" accept=".xlsx, .xls" onChange={handleIncomeUpload} className="hidden" />
                </label>
                <ConfirmButton
                  onConfirm={() => setIncomeData([])}
                  className="px-4 py-2 text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                  icon={Trash2}
                >
                  Xóa
                </ConfirmButton>
              </div>
              {incomeData.length > 0 && (
                <div className="mt-4 p-3 bg-emerald-50 text-emerald-700 rounded-lg text-sm flex items-center gap-2">
                  <Check className="w-4 h-4" /> Đã tải {incomeData.length} mục thu tiền.
                </div>
              )}
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-neutral-200">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
                  <PieChart className="w-5 h-5 text-orange-600" /> Nội dung chi
                </h3>
                <button 
                  onClick={downloadExpenseTemplate}
                  className="text-xs font-medium text-orange-600 hover:underline flex items-center gap-1"
                >
                  <Download className="w-3 h-3" /> Tải file mẫu
                </button>
              </div>
              <p className="text-sm text-neutral-500 mb-4">Tải lên danh sách nội dung chi để đồng bộ dữ liệu.</p>
              <div className="flex gap-3">
                <label className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-neutral-300 rounded-xl hover:border-orange-500 hover:bg-orange-50 transition-all cursor-pointer group">
                  <Upload className="w-5 h-5 text-neutral-400 group-hover:text-orange-600" />
                  <span className="text-sm font-medium text-neutral-600 group-hover:text-orange-700">Tải lên Nội dung chi</span>
                  <input type="file" accept=".xlsx, .xls" onChange={handleExpenseUpload} className="hidden" />
                </label>
                <ConfirmButton
                  onConfirm={() => setExpenseData([])}
                  className="px-4 py-2 text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                  icon={Trash2}
                >
                  Xóa
                </ConfirmButton>
              </div>
              {expenseData.length > 0 && (
                <div className="mt-4 p-3 bg-orange-50 text-orange-700 rounded-lg text-sm flex items-center gap-2">
                  <Check className="w-4 h-4" /> Đã tải {expenseData.length} mục chi tiền.
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden">
            <div className="p-4 border-b border-neutral-200 flex justify-between items-center bg-neutral-50">
              <h3 className="font-bold text-neutral-900">Danh sách Thu - Chi</h3>
              <div className="flex gap-2">
                <button 
                  onClick={syncData}
                  disabled={isSyncing}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm font-medium disabled:opacity-50"
                >
                  <RefreshCw className={cn("w-4 h-4", isSyncing && "animate-spin")} /> 
                  {isSyncing ? "Đang đồng bộ..." : "Đồng bộ dữ liệu"}
                </button>
              </div>
            </div>
            <div className="overflow-x-auto max-h-[400px]">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-white shadow-sm z-10">
                  <tr className="bg-neutral-50 border-b border-neutral-200">
                    <th className="px-4 py-3 text-xs font-bold text-neutral-500 uppercase w-12 text-center">TT</th>
                    <th className="px-4 py-3 text-xs font-bold text-neutral-500 uppercase">Họ và tên</th>
                    <th className="px-4 py-3 text-xs font-bold text-neutral-500 uppercase">Địa chỉ</th>
                    <th className="px-4 py-3 text-xs font-bold text-neutral-500 uppercase">Loại</th>
                    <th className="px-4 py-3 text-xs font-bold text-neutral-500 uppercase text-right">Số tiền</th>
                    <th className="px-4 py-3 text-xs font-bold text-neutral-500 uppercase w-32 text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {incomeData.map((item) => (
                    <tr key={item.id} className="hover:bg-emerald-50/30 transition-colors">
                      <td className="px-4 py-3 text-sm text-neutral-600 text-center">{item.stt}</td>
                      <td className="px-4 py-3 text-sm font-medium text-neutral-900">{item.name}</td>
                      <td className="px-4 py-3 text-sm text-neutral-600">{item.address}</td>
                      <td className="px-4 py-3 text-sm text-emerald-600 font-medium">Thu</td>
                      <td className="px-4 py-3 text-sm text-neutral-900 text-right font-mono">{item.amount.toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm text-center">
                        <button 
                          onClick={() => exportSingleVoucherPDF(item, 'receipt')}
                          className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                          title="Xuất phiếu thu (PDF)"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {expenseData.map((item) => (
                    <tr key={item.id} className="hover:bg-orange-50/30 transition-colors">
                      <td className="px-4 py-3 text-sm text-neutral-600 text-center">{item.stt}</td>
                      <td className="px-4 py-3 text-sm font-medium text-neutral-900">{item.name}</td>
                      <td className="px-4 py-3 text-sm text-neutral-600">{item.address}</td>
                      <td className="px-4 py-3 text-sm text-orange-600 font-medium">Chi</td>
                      <td className="px-4 py-3 text-sm text-neutral-900 text-right font-mono">{item.amount.toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm text-center">
                        <button 
                          onClick={() => exportSingleVoucherPDF(item, 'payment')}
                          className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                          title="Xuất phiếu chi (PDF)"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {incomeData.length === 0 && expenseData.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-neutral-500 italic">
                        Chưa có dữ liệu thu chi. Vui lòng tải file lên.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}

      {activeSubTab === 'finance-ledger' && (
        <div className="bg-white p-8 rounded-xl shadow-sm border border-neutral-200 text-center space-y-4">
          <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 mx-auto">
            <FileSpreadsheet className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold">Xuất Sổ doanh thu</h3>
          <p className="text-neutral-500 max-w-md mx-auto">
            Hệ thống sẽ tổng hợp toàn bộ dữ liệu thu tiền học phí trong kỳ để xuất Sổ doanh thu theo mẫu Thông tư 88/2021/TT-BTC.
          </p>
          <button
            onClick={exportS1aHKD}
            className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm font-medium"
          >
            <Download className="w-5 h-5" /> Xuất sổ doanh thu (.docx)
          </button>
        </div>
      )}

      {activeSubTab === 'finance-vouchers' && (
        <div className="bg-white p-8 rounded-xl shadow-sm border border-neutral-200 text-center space-y-4">
          <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 mx-auto">
            <FileText className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold">Xuất Phiếu thu & Phiếu chi</h3>
          <p className="text-neutral-500 max-w-md mx-auto">
            Xuất toàn bộ phiếu thu từ danh sách thu tiền và phiếu chi từ danh sách chi phí vào một tệp duy nhất.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <button
              onClick={exportAllVouchers}
              className="inline-flex items-center gap-2 px-6 py-3 bg-neutral-100 text-neutral-600 rounded-lg hover:bg-neutral-200 transition-colors shadow-sm font-medium"
            >
              <Download className="w-5 h-5" /> Xuất toàn bộ phiếu (.docx)
            </button>
            <button
              onClick={exportVouchersToPDF}
              className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors shadow-sm font-medium"
            >
              <FileText className="w-5 h-5" /> Xuất toàn bộ phiếu (.pdf)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
