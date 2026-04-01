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
  Edit2,
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
  ArrowLeft,
  Check,
  Menu,
  X,
  LayoutDashboard,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Receipt,
  LogOut,
  Info,
  Lock,
  UserPlus,
  Calendar,
  RefreshCw,
  Moon,
  Sun,
  TrendingUp,
  Activity,
  CreditCard,
  User,
  Bell,
  Search,
  MapPin,
  Home,
  Settings2,
  ShieldCheck,
  Zap,
  HelpCircle,
  Layers,
  RotateCcw
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

import { cn } from './lib/utils';

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

import Footer from './components/Footer';
import Header from './components/Header';

// --- Utilities ---

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
const THEME_KEY = 'tutoring_center_theme';

const DEFAULT_CLASSES: ClassSubject[] = [
  { id: 'c6-1', grade: '6', subject: 'Toán', subSubject: 'Số học' },
  { id: 'c6-2', grade: '6', subject: 'Toán', subSubject: 'Hình học' },
  { id: 'c6-3', grade: '6', subject: 'KHTN', subSubject: 'Vật lý' },
  { id: 'c7-1', grade: '7', subject: 'Toán', subSubject: 'Đại số' },
  { id: 'c7-2', grade: '7', subject: 'Toán', subSubject: 'Hình học' },
  { id: 'c7-3', grade: '7', subject: 'KHTN', subSubject: 'Vật lý' },
  { id: 'c7-4', grade: '7', subject: 'Ngữ văn', subSubject: '' },
  { id: 'c8-1', grade: '8', subject: 'Toán', subSubject: 'Đại số' },
  { id: 'c8-2', grade: '8', subject: 'Toán', subSubject: 'Hình học' },
  { id: 'c8-3', grade: '8', subject: 'KHTN', subSubject: 'Vật lý' },
  { id: 'c8-4', grade: '8', subject: 'Ngữ văn', subSubject: '' },
  { id: 'c9-1', grade: '9', subject: 'Toán', subSubject: 'Đại số' },
  { id: 'c9-2', grade: '9', subject: 'Toán', subSubject: 'Hình học' },
  { id: 'c9-3', grade: '9', subject: 'KHTN', subSubject: 'Vật lý' },
  { id: 'c9-4', grade: '9', subject: 'Ngữ văn', subSubject: '' },
];

const DEFAULT_PPCT: PPCTItem[] = [
  { id: 'p6-1', grade: '6', subject: 'Toán', subSubject: 'Đại số', period: 1, content: 'Tập hợp các số tự nhiên', notes: '' },
  { id: 'p7-1', grade: '7', subject: 'Toán', subSubject: 'Đại số', period: 1, content: 'Số hữu tỉ', notes: '' },
  { id: 'p8-1', grade: '8', subject: 'Toán', subSubject: 'Đại số', period: 1, content: 'Đa thức', notes: '' },
  { id: 'p9-1', grade: '9', subject: 'Toán', subSubject: 'Đại số', period: 1, content: 'Căn bậc hai', notes: '' },
];

interface UserAccount {
  id: string;
  email: string;
  password: string;
  role: 'admin' | 'user';
  expiryDate?: string;
  createdAt: string;
  businessName?: string;
  businessAddress?: string;
  businessLocation?: string;
  businessOwner?: string;
}

// --- Components ---

export default function App() {
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem(THEME_KEY);
    return saved === 'dark';
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem(THEME_KEY, darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => {
    const saved = localStorage.getItem(AUTH_KEY);
    return saved ? JSON.parse(saved) : null;
  });
  const [users, setUsers] = useState<UserAccount[]>(() => {
    const saved = localStorage.getItem(USERS_KEY);
    const defaultAdmin: UserAccount = {
      id: 'admin-1',
      email: 'cosogiaoduchoanggia269@gmail.com',
      password: 'Laichau@123',
      role: 'admin',
      createdAt: new Date().toISOString()
    };
    if (saved) {
      const parsed = JSON.parse(saved);
      if (!parsed.some((u: any) => u.email.toLowerCase() === defaultAdmin.email.toLowerCase())) {
        return [defaultAdmin, ...parsed];
      }
      return parsed;
    }
    return [defaultAdmin];
  });

  const [activeTab, setActiveTab] = useState('dashboard');
  const [isProgramOpen, setIsProgramOpen] = useState(true);
  const [isStudentsOpen, setIsStudentsOpen] = useState(true);
  const [isFinanceOpen, setIsFinanceOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [tabOrder, setTabOrder] = useState<string[]>(['dashboard', 'business', 'program', 'students_group', 'finance_group', 'users']);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  const moveTab = (id: string, direction: 'up' | 'down') => {
    const index = tabOrder.indexOf(id);
    if (index === -1) return;
    const newOrder = [...tabOrder];
    if (direction === 'up' && index > 0) {
      [newOrder[index], newOrder[index - 1]] = [newOrder[index - 1], newOrder[index]];
    } else if (direction === 'down' && index < newOrder.length - 1) {
      [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    }
    setTabOrder(newOrder);
  };
  const [businessInfo, setBusinessInfo] = useState<BusinessInfo>({
    name: '',
    address: '',
    taxId: '',
    owner: '',
    businessLocation: ''
  });
  const [classes, setClasses] = useState<ClassSubject[]>([]);
  const [ppctData, setPpctData] = useState<PPCTItem[]>([]);
  const [lessonPlans, setLessonPlans] = useState<LessonPlan[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [financialConfig, setFinancialConfig] = useState<FinancialConfig>({
    reportPeriod: '',
    receiptDate: '',
    paymentDate: '',
    preparer: '',
    treasurer: '',
    taxCode: ''
  });
  const [incomeData, setIncomeData] = useState<IncomeItem[]>([]);
  const [expenseData, setExpenseData] = useState<ExpenseItem[]>([]);
  const [currentPlan, setCurrentPlan] = useState<LessonPlan | null>(null);

  // Load/Reset data when user changes
  useEffect(() => {
    setIsDataLoaded(false);
    
    if (!currentUser) {
      setBusinessInfo({ name: '', address: '', taxId: '', owner: '', businessLocation: '' });
      setClasses(DEFAULT_CLASSES);
      setPpctData(DEFAULT_PPCT);
      setLessonPlans([]);
      setStudents([]);
      setFinancialConfig({ reportPeriod: '', receiptDate: '', paymentDate: '', preparer: '', treasurer: '', taxCode: '' });
      setIncomeData([]);
      setExpenseData([]);
      setTabOrder(['dashboard', 'business', 'program', 'students_group', 'finance_group', 'users']);
      setIsDataLoaded(true);
      return;
    }

    const userStorageKey = `${STORAGE_KEY}_${currentUser.id}`;
    const saved = localStorage.getItem(userStorageKey);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.businessInfo) {
          setBusinessInfo({
            ...data.businessInfo,
            name: data.businessInfo.name || currentUser.businessName || '',
            address: data.businessInfo.address || currentUser.businessAddress || '',
            owner: data.businessInfo.owner || currentUser.businessOwner || '',
            businessLocation: data.businessInfo.businessLocation || currentUser.businessLocation || '',
            taxId: data.businessInfo.taxId || ''
          });
        }
        
        // Restore defaults if requested or if data is missing
        setClasses(data.classes && data.classes.length > 0 ? data.classes : DEFAULT_CLASSES);
        setPpctData(data.ppctData && data.ppctData.length > 0 ? data.ppctData : DEFAULT_PPCT);
        
        // Clear soft data as requested by user
        setStudents([]);
        setIncomeData([]);
        setExpenseData([]);
        
        if (data.lessonPlans) setLessonPlans(data.lessonPlans);
        if (data.financialConfig) setFinancialConfig(data.financialConfig);
        if (data.tabOrder) setTabOrder(data.tabOrder);
      } catch (e) {
        console.error("Failed to parse saved data", e);
      }
    } else {
      // New user: start with defaults from currentUser if available
      setBusinessInfo({ 
        name: currentUser.businessName || '', 
        address: currentUser.businessAddress || '', 
        taxId: '', 
        owner: currentUser.businessOwner || '',
        businessLocation: currentUser.businessLocation || ''
      });
      setClasses(DEFAULT_CLASSES);
      setPpctData(DEFAULT_PPCT);
      setLessonPlans([]);
      setStudents([]);
      setFinancialConfig({ reportPeriod: '', receiptDate: '', paymentDate: '', preparer: '', treasurer: '', taxCode: '' });
      setIncomeData([]);
      setExpenseData([]);
      setTabOrder(['dashboard', 'business', 'program', 'students_group', 'finance_group', 'users']);
    }
    setIsDataLoaded(true);
  }, [currentUser?.id]);

  // Save data to localStorage (user-specific)
  useEffect(() => {
    if (!currentUser || !isDataLoaded) return;

    const userStorageKey = `${STORAGE_KEY}_${currentUser.id}`;
    const data = { 
      businessInfo, 
      classes, 
      ppctData, 
      lessonPlans, 
      students, 
      financialConfig, 
      incomeData, 
      expenseData,
      tabOrder 
    };
    localStorage.setItem(userStorageKey, JSON.stringify(data));
  }, [currentUser?.id, businessInfo, classes, ppctData, lessonPlans, students, financialConfig, incomeData, expenseData, tabOrder, isDataLoaded]);

  // Save users to localStorage (global)
  useEffect(() => {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    
    // Ensure default admin is always present
    const defaultAdminEmail = 'cosogiaoduchoanggia269@gmail.com';
    if (!users.some(u => u.email.toLowerCase() === defaultAdminEmail.toLowerCase())) {
      const defaultAdmin: UserAccount = {
        id: 'admin-1',
        email: defaultAdminEmail,
        password: 'Laichau@123',
        role: 'admin',
        createdAt: new Date().toISOString()
      };
      setUsers(prev => [defaultAdmin, ...prev]);
    }
  }, [users]);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.log('--- HỆ THỐNG QUẢN LÝ CƠ SỞ DẠY THÊM HOÀNG GIA ---');
      console.log('Tài khoản quản trị mặc định:');
      console.log('Email:', 'cosogiaoduchoanggia269@gmail.com');
      console.log('Mật khẩu:', 'Laichau@123');
      console.log('--------------------------------------------------');
    }
  }, []);

  // Save auth to localStorage
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(AUTH_KEY, JSON.stringify(currentUser));
    } else {
      localStorage.removeItem(AUTH_KEY);
    }
  }, [currentUser]);

  // Sync currentUser with users array to get latest updates (like business info)
  useEffect(() => {
    if (currentUser) {
      const latestUser = users.find(u => u.id === currentUser.id);
      if (latestUser && JSON.stringify(latestUser) !== JSON.stringify(currentUser)) {
        setCurrentUser(latestUser);
      }
    }
  }, [users, currentUser?.id]);

  const tabs = [
    { id: 'dashboard', label: 'Tổng quát', icon: LayoutDashboard },
    { id: 'business', label: 'Cấu hình Hộ kinh doanh', icon: Building2 },
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

  const filteredTabs = tabs
    .filter(tab => {
      if (currentUser?.role === 'admin') return true;
      if (tab.adminOnly) return false;
      // User can access: Dashboard, Business, Program, Students, Finance
      return ['dashboard', 'business', 'program', 'students_group', 'finance_group'].includes(tab.id);
    })
    .sort((a, b) => {
      const indexA = tabOrder.indexOf(a.id);
      const indexB = tabOrder.indexOf(b.id);
      return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
    });

  const monthlyRevenue = useMemo(() => {
    return incomeData.reduce((sum, item) => sum + item.amount, 0);
  }, [incomeData]);

  const deletePlan = (id: string) => {
    setLessonPlans(lessonPlans.filter(p => p.id !== id));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setActiveTab('dashboard');
    setShowWelcomeModal(false);
  };

  const handleLogin = (user: UserAccount) => {
    setCurrentUser(user);
    setShowWelcomeModal(true);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <DashboardSection 
            studentCount={students.length}
            classCount={classes.length}
            monthlyRevenue={monthlyRevenue}
            reportPeriod={financialConfig.reportPeriod}
          />
        );
      case 'business':
        return <BusinessConfigSection info={businessInfo} setInfo={setBusinessInfo} setActiveTab={setActiveTab} currentUser={currentUser} />;
      case 'program':
      case 'classes':
      case 'ppct':
      case 'lesson-plan':
      case 'journal':
        return (
          <ProgramManagementSection 
            classes={classes}
            setClasses={setClasses}
            ppctData={ppctData}
            setPpctData={setPpctData}
            lessonPlans={lessonPlans}
            setLessonPlans={setLessonPlans}
            deletePlan={deletePlan}
            businessInfo={businessInfo}
            activeSubTab={activeTab}
            setActiveTab={setActiveTab}
          />
        );
      case 'students_group':
      case 'students-list':
      case 'students-export':
        return (
          <StudentManagementSection 
            students={students}
            setStudents={setStudents}
            businessInfo={businessInfo}
            activeSubTab={activeTab}
            setActiveTab={setActiveTab}
          />
        );
      case 'finance_group':
      case 'finance-config':
      case 'finance-ledger':
      case 'finance-vouchers':
        return (
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
        );
      case 'users':
        return currentUser.role === 'admin' ? (
          <UserManagementSection 
            users={users} 
            setUsers={setUsers} 
            setActiveTab={setActiveTab}
          />
        ) : null;
      default:
        return null;
    }
  };

  if (!currentUser) {
    return <LoginPage onLogin={handleLogin} users={users} darkMode={darkMode} setDarkMode={setDarkMode} />;
  }

  return (
    <div className="flex flex-col h-screen bg-bg-light dark:bg-bg-dark font-sans text-neutral-900 dark:text-slate-100 overflow-hidden transition-colors duration-300">
      <Header 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        currentUser={currentUser} 
        onLogout={handleLogout}
      />
      
      <div className="flex flex-1 pt-20 overflow-hidden">
        {/* Welcome Modal */}
        <AnimatePresence>
        {showWelcomeModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl max-w-2xl w-full p-8 lg:p-12 border border-neutral-200 dark:border-slate-800 relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 via-green-500 to-orange-500" />
              
              <div className="text-center space-y-6">
                <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="w-10 h-10 text-primary animate-pulse" />
                </div>
                
                <h2 className="text-2xl lg:text-3xl font-normal text-neutral-900 dark:text-white leading-tight">
                  Chào mừng Quý Thầy Cô đến với <span className="text-primary">HOÀNG GIA</span>
                </h2>
                <p className="text-primary font-normal text-xl">admin</p>
                
                <div className="text-neutral-600 dark:text-slate-300 leading-relaxed text-lg font-normal">
                  Hệ thống được thiết kế tối ưu dành riêng cho các thầy cô và trung tâm dạy thêm. Bao gồm các chương trình: 
                  <span className="text-blue-600 dark:text-blue-400 mx-1">Quản lý học sinh</span>, 
                  <span className="text-green-600 dark:text-green-400 mx-1">Quản lý chương trình dạy</span>, 
                  <span className="text-orange-600 dark:text-orange-400 mx-1">Quản lý tài chính</span>. 
                  Chúng tôi cung cấp các công cụ mạnh mẽ để quản lý học sinh, chương trình giảng dạy và tài chính, giúp Quý Thầy Cô tập trung hoàn toàn vào sứ mệnh truyền đạt tri thức.
                </div>

                <button
                  onClick={() => setShowWelcomeModal(false)}
                  className="mt-8 px-10 py-4 bg-primary text-white rounded-2xl font-bold hover:bg-primary-hover transition-all shadow-xl shadow-primary/20 active:scale-95"
                >
                  Bắt đầu làm việc
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Mobile Menu Toggle */}
      <div className="lg:hidden fixed top-0 left-0 right-0 bg-white dark:bg-slate-900 border-b border-neutral-200 dark:border-slate-800 z-50 px-4 py-3 flex items-center justify-between">
        <h1 className="text-sm font-bold text-primary flex items-center gap-2">
          <GraduationCap className="w-5 h-5" />
          HỆ THỐNG QUẢN LÝ HOÀNG GIA
        </h1>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 text-neutral-600 dark:text-slate-400 hover:bg-neutral-100 dark:hover:bg-slate-800 rounded-lg"
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
            className="lg:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={cn(
        "fixed lg:static inset-y-0 left-0 w-72 bg-white dark:bg-slate-900 border-r border-neutral-200 dark:border-slate-800 flex flex-col z-50 transition-all duration-300 transform lg:translate-x-0 shadow-xl lg:shadow-none",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-8 pb-6 hidden lg:block">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-primary/25">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <div className="leading-tight">
              <h1 className="text-lg font-normal tracking-tight text-neutral-900 dark:text-white">HOÀNG GIA</h1>
              <p className="text-[10px] font-normal text-primary uppercase tracking-[0.2em]">Dashboard Pro</p>
            </div>
          </div>
        </div>
        
        <nav className="flex-1 px-4 space-y-1 overflow-y-auto custom-scrollbar py-4">
          {filteredTabs.map((tab, index) => (
            <div key={tab.id} className="group relative space-y-1">
              {currentUser?.role === 'admin' && (
                <div className="absolute -left-2 top-1/2 -translate-y-1/2 flex flex-col opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <button 
                    onClick={(e) => { e.stopPropagation(); moveTab(tab.id, 'up'); }}
                    disabled={index === 0}
                    className="p-0.5 text-neutral-400 hover:text-primary disabled:opacity-0"
                  >
                    <ChevronUp className="w-3 h-3" />
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); moveTab(tab.id, 'down'); }}
                    disabled={index === filteredTabs.length - 1}
                    className="p-0.5 text-neutral-400 hover:text-primary disabled:opacity-0"
                  >
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </div>
              )}
              {tab.subTabs ? (
                <>
                  <button
                    onClick={() => {
                      tab.setIsOpen && tab.setIsOpen(!tab.isOpen);
                      setActiveTab(tab.id);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group/item",
                      (tab.id === activeTab || (tab.subTabs && tab.subTabs.some(st => st.id === activeTab)))
                        ? "bg-primary/5 dark:bg-primary/10 text-primary"
                        : "text-neutral-600 dark:text-slate-400 hover:bg-neutral-50 dark:hover:bg-slate-800/50 hover:text-neutral-900 dark:hover:text-slate-200"
                    )}
                  >
                    <tab.icon className={cn("w-5 h-5 shrink-0 transition-colors", (tab.id === activeTab || (tab.subTabs && tab.subTabs.some(st => st.id === activeTab))) ? "text-primary" : "text-neutral-400 group-hover/item:text-neutral-600 dark:group-hover/item:text-slate-200")} />
                    <span className="flex-1 text-sm font-bold">{tab.label}</span>
                    <motion.div
                      animate={{ rotate: tab.isOpen ? 90 : 0 }}
                      className="ml-auto"
                    >
                      <ChevronRight className="w-4 h-4 opacity-50" />
                    </motion.div>
                  </button>
                  <AnimatePresence>
                    {tab.isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden pl-12 space-y-1 mt-1"
                      >
                        {tab.subTabs.map((subTab) => (
                          <button
                            key={subTab.id}
                            onClick={() => {
                              setActiveTab(subTab.id);
                              if (window.innerWidth < 1024) setIsMobileMenuOpen(false);
                            }}
                            className={cn(
                              "w-full flex items-center gap-3 py-2.5 text-[13px] font-normal transition-all duration-200 relative",
                              activeTab === subTab.id
                                ? "text-primary"
                                : "text-neutral-500 dark:text-slate-500 hover:text-neutral-900 dark:hover:text-slate-200"
                            )}
                          >
                            {activeTab === subTab.id && (
                              <motion.div 
                                layoutId="subtab-active"
                                className="absolute -left-4 w-1 h-4 bg-primary rounded-full shadow-[0_0_8px_rgba(22,119,255,0.5)]"
                              />
                            )}
                            {subTab.label}
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
                    "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group/item",
                    activeTab === tab.id
                      ? "bg-primary/5 dark:bg-primary/10 text-primary shadow-sm"
                      : "text-neutral-600 dark:text-slate-400 hover:bg-neutral-50 dark:hover:bg-slate-800/50 hover:text-neutral-900 dark:hover:text-slate-200"
                  )}
                >
                  <tab.icon className={cn("w-5 h-5 shrink-0 transition-colors", activeTab === tab.id ? "text-primary" : "text-neutral-400 group-hover/item:text-neutral-600 dark:group-hover/item:text-slate-200")} />
                  <span className="flex-1 text-sm font-bold">{tab.label}</span>
                  {activeTab === tab.id && (
                    <motion.div 
                      layoutId="tab-active-indicator"
                      className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(22,119,255,0.5)]"
                    />
                  )}
                </button>
              )}
            </div>
          ))}
        </nav>
        
        <div className="p-6 border-t border-neutral-100 dark:border-slate-800">
          <div className="bg-neutral-50 dark:bg-slate-800/50 rounded-2xl p-4 text-center">
            <p className="text-[10px] text-neutral-400 dark:text-slate-500 font-normal uppercase tracking-widest mb-1">Bản quyền hệ thống</p>
            <p className="text-[11px] font-normal text-neutral-600 dark:text-slate-300">ĐÀO MINH TÂM</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-bg-light dark:bg-bg-dark transition-colors duration-300">
        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-8 custom-scrollbar">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="max-w-7xl mx-auto"
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
          
          <Footer />
        </div>
      </main>
    </div>
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
  const stats = [
    { 
      label: 'Tổng số học sinh', 
      value: studentCount, 
      icon: Users, 
      color: 'from-blue-500 to-indigo-600',
      trend: '+12%',
      description: 'Học sinh đang theo học'
    },
    { 
      label: 'Số lớp học', 
      value: classCount, 
      icon: BookOpen, 
      color: 'from-orange-500 to-amber-600',
      trend: '+2',
      description: 'Lớp đang hoạt động'
    },
    { 
      label: 'Doanh thu tháng', 
      value: monthlyRevenue.toLocaleString('vi-VN') + 'đ', 
      icon: CreditCard, 
      color: 'from-emerald-500 to-teal-600',
      trend: '+15%',
      description: `Kỳ báo cáo: ${reportPeriod || 'Hiện tại'}`
    },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Information Card */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="saas-card bg-gradient-to-br from-white to-neutral-50 dark:from-slate-900 dark:to-slate-800 border-l-4 border-l-primary"
      >
        <div className="flex items-start gap-6">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center shrink-0">
            <Sparkles className="w-8 h-8 text-primary" />
          </div>
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">
              Chào mừng Quý Thầy Cô đến với <span className="text-primary">HOÀNG GIA</span>
            </h2>
            <p className="text-neutral-600 dark:text-slate-300 text-lg leading-relaxed">
              Hệ thống được thiết kế tối ưu dành riêng cho các thầy cô và trung tâm dạy thêm. Bao gồm các chương trình: 
              <span className="text-blue-600 dark:text-blue-400 font-bold mx-1">Quản lý học sinh</span>, 
              <span className="text-emerald-600 dark:text-emerald-400 font-bold mx-1">Quản lý chương trình dạy</span>, 
              <span className="text-orange-600 dark:text-orange-400 font-bold mx-1">Quản lý tài chính</span>. 
              Chúng tôi cung cấp các công cụ mạnh mẽ để quản lý học sinh, chương trình giảng dạy và tài chính, giúp Quý Thầy Cô tập trung hoàn toàn vào sứ mệnh truyền đạt tri thức.
            </p>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat, idx) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="saas-card group"
          >
            <div className="flex items-start justify-between mb-4">
              <div className={cn(
                "w-12 h-12 rounded-2xl bg-gradient-to-br flex items-center justify-center text-white shadow-lg transition-transform group-hover:scale-110 duration-300",
                stat.color
              )}>
                <stat.icon className="w-6 h-6" />
              </div>
              <span className="text-xs font-bold text-green-500 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-lg">
                {stat.trend}
              </span>
            </div>
            <div>
              <p className="text-sm font-normal text-neutral-500 dark:text-slate-400 mb-1">{stat.label}</p>
              <h3 className="text-3xl font-normal text-neutral-900 dark:text-white tracking-tight">{stat.value}</h3>
              <p className="text-[10px] font-normal text-neutral-400 dark:text-slate-500 mt-2 uppercase tracking-wider">{stat.description}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="saas-card"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-normal text-neutral-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Tỷ lệ chuyên cần
            </h3>
            <select className="bg-neutral-50 dark:bg-slate-900 border-none text-xs font-normal text-neutral-500 rounded-lg px-3 py-1.5 outline-none cursor-pointer">
              <option>7 ngày qua</option>
              <option>30 ngày qua</option>
            </select>
          </div>
          <div className="h-64 flex items-end justify-between gap-2 px-2">
            {[65, 80, 45, 90, 70, 85, 95].map((height, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                <div className="w-full relative">
                  <motion.div 
                    initial={{ height: 0 }}
                    animate={{ height: `${height}%` }}
                    transition={{ duration: 1, delay: 0.5 + (i * 0.1), ease: "easeOut" }}
                    className="w-full bg-primary/10 group-hover:bg-primary/20 rounded-t-lg transition-colors relative overflow-hidden"
                  >
                    <motion.div 
                      initial={{ height: 0 }}
                      animate={{ height: '100%' }}
                      transition={{ duration: 1, delay: 0.8 + (i * 0.1) }}
                      className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-primary to-indigo-400 opacity-80"
                    />
                  </motion.div>
                </div>
                <span className="text-[10px] font-bold text-neutral-400 dark:text-slate-500">T{i+2}</span>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
          className="saas-card flex flex-col items-center justify-center text-center py-12"
        >
          <div className="relative w-48 h-48 mb-8">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="96"
                cy="96"
                r="80"
                fill="transparent"
                stroke="currentColor"
                strokeWidth="12"
                className="text-neutral-100 dark:text-slate-800"
              />
              <motion.circle
                cx="96"
                cy="96"
                r="80"
                fill="transparent"
                stroke="url(#gradient)"
                strokeWidth="12"
                strokeDasharray={502.4}
                initial={{ strokeDashoffset: 502.4 }}
                animate={{ strokeDashoffset: 502.4 * (1 - 0.78) }}
                transition={{ duration: 2, delay: 0.5, ease: "easeInOut" }}
                strokeLinecap="round"
              />
              <defs>
                <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#1677FF" />
                  <stop offset="100%" stopColor="#818CF8" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-4xl font-black text-neutral-900 dark:text-white tracking-tighter">78%</span>
              <span className="text-[10px] font-normal text-neutral-400 uppercase tracking-widest mt-1">Hoàn thành HP</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-8 w-full max-w-xs">
            <div className="text-center">
              <p className="text-[10px] font-normal text-neutral-400 uppercase tracking-widest mb-1">Đã nộp</p>
              <p className="text-xl font-normal text-neutral-900 dark:text-white">142</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] font-normal text-neutral-400 uppercase tracking-widest mb-1">Chưa nộp</p>
              <p className="text-xl font-normal text-neutral-900 dark:text-white">38</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function BusinessConfigSection({ info, setInfo, setActiveTab, currentUser }: { info: BusinessInfo, setInfo: (i: BusinessInfo) => void, setActiveTab: (t: string) => void, currentUser: UserAccount | null }) {
  const isReadOnly = currentUser?.role === 'user';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isReadOnly) return;
    setInfo({ ...info, [e.target.name]: e.target.value });
  };

  const fields = [
    { name: 'name', label: 'Hộ kinh doanh', placeholder: 'VD: Trung tâm Giáo dục Hoàng Gia', icon: Building2 },
    { name: 'address', label: 'Địa chỉ', placeholder: 'VD: Số 123, Đường ABC, Quận XYZ, TP. HCM', icon: Home },
    { name: 'businessLocation', label: 'Nơi kinh doanh', placeholder: 'VD: SN 269 - Lê Duẩn - Phường Tân Phong - Tỉnh Lai Châu', icon: MapPin },
    { name: 'owner', label: 'Chủ hộ kinh doanh', placeholder: 'VD: Nguyễn Văn A', icon: User },
    { name: 'taxId', label: 'Mã số thuế', placeholder: 'VD: 0123456789', icon: CreditCard },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <button 
        onClick={() => setActiveTab('dashboard')}
        className="flex items-center gap-2 text-neutral-500 hover:text-primary transition-all text-sm font-bold group mb-4"
      >
        <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-slate-800 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all">
          <ArrowLeft className="w-4 h-4" />
        </div>
        Quay lại trang chủ
      </button>

      <div className="saas-card">
        <div className="flex items-center gap-4 mb-8 pb-6 border-b border-neutral-100 dark:border-slate-800">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
            <Settings2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-normal text-neutral-900 dark:text-white">Thông tin cơ bản</h3>
            <p className="text-sm text-neutral-500 dark:text-slate-400">
              {isReadOnly ? 'Xem thông tin định danh cho cơ sở của bạn' : 'Cập nhật thông tin định danh cho cơ sở của bạn'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {fields.map((field) => (
            <div key={field.name} className={cn("space-y-2", field.name === 'address' && "md:col-span-2")}>
              <label className="text-xs font-normal text-neutral-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <field.icon className="w-3.5 h-3.5" />
                {field.label}
              </label>
              <div className="relative group">
                <input
                  type="text"
                  name={field.name}
                  value={(info as any)[field.name] || ""}
                  onChange={handleChange}
                  disabled={isReadOnly}
                  placeholder={field.placeholder}
                  className={cn(
                    "w-full bg-neutral-50 dark:bg-slate-900/50 border border-neutral-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all dark:text-white",
                    isReadOnly && "cursor-not-allowed opacity-70"
                  )}
                />
                {!isReadOnly && <div className="absolute inset-0 rounded-xl bg-primary/5 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity" />}
              </div>
            </div>
          ))}
        </div>

        {!isReadOnly && (
          <div className="mt-10 flex justify-end">
            <button className="btn-primary flex items-center gap-2">
              <Save className="w-4 h-4" />
              Lưu thay đổi
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="saas-card p-6 bg-blue-50/50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/20">
          <div className="w-10 h-10 rounded-xl bg-blue-500 text-white flex items-center justify-center mb-4">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h4 className="font-bold text-neutral-900 dark:text-white mb-1">Bảo mật dữ liệu</h4>
          <p className="text-xs text-neutral-500 dark:text-slate-400">Thông tin của bạn được mã hóa và bảo vệ theo tiêu chuẩn SaaS.</p>
        </div>
        <div className="saas-card p-6 bg-purple-50/50 dark:bg-purple-900/10 border-purple-100 dark:border-purple-900/20">
          <div className="w-10 h-10 rounded-xl bg-purple-500 text-white flex items-center justify-center mb-4">
            <Zap className="w-5 h-5" />
          </div>
          <h4 className="font-bold text-neutral-900 dark:text-white mb-1">Tự động đồng bộ</h4>
          <p className="text-xs text-neutral-500 dark:text-slate-400">Mọi thay đổi sẽ được cập nhật tức thì trên toàn hệ thống.</p>
        </div>
        <div className="saas-card p-6 bg-amber-50/50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/20">
          <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center mb-4">
            <HelpCircle className="w-5 h-5" />
          </div>
          <h4 className="font-bold text-neutral-900 dark:text-white mb-1">Hỗ trợ 24/7</h4>
          <p className="text-xs text-neutral-500 dark:text-slate-400">Liên hệ với chúng tôi nếu bạn gặp khó khăn khi cấu hình.</p>
        </div>
      </div>
    </div>
  );
}

function ClassConfigSection({ classes, setClasses, setActiveTab }: { key?: string, classes: ClassSubject[], setClasses: (c: ClassSubject[]) => void, setActiveTab: (t: string) => void }) {
  const addRow = () => {
    setClasses([...classes, { id: crypto.randomUUID(), grade: '', subject: '', subSubject: '' }]);
  };

  const resetToDefault = () => {
    if (window.confirm("Bạn có chắc chắn muốn khôi phục cấu hình mặc định? Toàn bộ dữ liệu hiện tại sẽ bị ghi đè.")) {
      setClasses(DEFAULT_CLASSES);
    }
  };

  const removeRow = (id: string) => {
    setClasses(classes.filter((c) => c.id !== id));
  };

  const handleChange = (id: string, field: keyof ClassSubject, value: string) => {
    setClasses(classes.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 max-w-5xl mx-auto"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-neutral-900 dark:text-white tracking-tight">Cấu hình Lớp học</h2>
          <p className="text-sm text-neutral-500 dark:text-slate-400 mt-1 font-medium">Thiết lập các khối lớp, môn học và phân môn cho cơ sở.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={resetToDefault}
            className="px-6 py-3 bg-neutral-100 dark:bg-slate-800 text-neutral-700 dark:text-slate-300 rounded-xl hover:bg-neutral-200 dark:hover:bg-slate-700 transition-all font-bold text-sm flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Khôi phục mặc định
          </button>
          <button 
            onClick={addRow}
            className="px-6 py-3 bg-primary text-white rounded-xl hover:bg-primary-hover transition-all shadow-lg shadow-primary/20 font-bold text-sm flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Thêm dòng mới
          </button>
        </div>
      </div>

      <div className="saas-card overflow-hidden !p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-neutral-50/50 dark:bg-slate-900/50 border-b border-neutral-100 dark:border-slate-800">
                <th className="px-8 py-5 text-[10px] font-black text-neutral-400 dark:text-slate-500 uppercase tracking-widest">Khối lớp</th>
                <th className="px-8 py-5 text-[10px] font-black text-neutral-400 dark:text-slate-500 uppercase tracking-widest">Môn học</th>
                <th className="px-8 py-5 text-[10px] font-black text-neutral-400 dark:text-slate-500 uppercase tracking-widest">Phân môn</th>
                <th className="px-8 py-5 text-[10px] font-black text-neutral-400 dark:text-slate-500 uppercase tracking-widest w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-slate-800">
              <AnimatePresence mode="popLayout">
                {classes.map((cls, idx) => (
                  <motion.tr 
                    key={cls.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ delay: idx * 0.05 }}
                    className="group hover:bg-neutral-50/30 dark:hover:bg-slate-900/30 transition-colors"
                  >
                    <td className="px-8 py-4">
                      <input
                        value={cls.grade}
                        onChange={(e) => handleChange(cls.id, 'grade', e.target.value)}
                        placeholder="VD: 6"
                        className="w-full bg-transparent border-none focus:ring-0 text-sm font-black text-neutral-900 dark:text-white placeholder-neutral-300 dark:placeholder-slate-700"
                      />
                    </td>
                    <td className="px-8 py-4">
                      <input
                        value={cls.subject}
                        onChange={(e) => handleChange(cls.id, 'subject', e.target.value)}
                        placeholder="VD: Toán"
                        className="w-full bg-transparent border-none focus:ring-0 text-sm font-bold text-neutral-700 dark:text-slate-300 placeholder-neutral-300 dark:placeholder-slate-700"
                      />
                    </td>
                    <td className="px-8 py-4">
                      <input
                        value={cls.subSubject}
                        onChange={(e) => handleChange(cls.id, 'subSubject', e.target.value)}
                        placeholder="VD: Đại số"
                        className="w-full bg-transparent border-none focus:ring-0 text-sm font-bold text-neutral-500 dark:text-slate-400 placeholder-neutral-300 dark:placeholder-slate-700 italic"
                      />
                    </td>
                    <td className="px-8 py-4 text-right">
                      <button
                        onClick={() => removeRow(cls.id)}
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
        {classes.length === 0 && (
          <div className="py-24 text-center">
            <div className="w-20 h-20 bg-neutral-50 dark:bg-slate-900 rounded-3xl flex items-center justify-center mx-auto mb-6 text-neutral-300 dark:text-slate-700">
              <Layers className="w-10 h-10" />
            </div>
            <h4 className="text-xl font-bold text-neutral-900 dark:text-white">Chưa có lớp học nào</h4>
            <p className="text-sm text-neutral-500 dark:text-slate-400 mt-2">Nhấn "Thêm dòng mới" để bắt đầu cấu hình hệ thống.</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function PPCTSection({ ppctData, setPpctData, classes, setPlans, plans, setActiveTab }: { 
  key?: string,
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
        
        const mappedData: PPCTItem[] = jsonData.map(row => ({
          id: crypto.randomUUID(),
          grade: normalizeGrade(row['Lớp'] || row['Khối'] || activeGrade),
          subject: String(row['Môn'] || row['Môn học'] || '').trim(),
          subSubject: String(row['Phân môn'] || '').trim(),
          period: Number(row['Tiết theo PPCT'] || row['Tiết'] || 0),
          content: String(row['Nội dung'] || row['Tên bài dạy'] || row['Nội dung bài học'] || '').trim(),
          notes: String(row['Ghi chú'] || '').trim()
        })).filter(item => item.subject && item.content);

        if (mappedData.length === 0) {
          alert("Không tìm thấy dữ liệu hợp lệ trong file Excel. Vui lòng kiểm tra lại định dạng file mẫu.");
          return;
        }

        const targetGrade = normalizeGrade(activeGrade);
        const otherGradesData = ppctData.filter(item => normalizeGrade(item.grade) !== targetGrade);
        setPpctData([...otherGradesData, ...mappedData]);
      } catch (err) {
        console.error("Upload error:", err);
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const deleteRow = (id: string) => {
    setPpctData(ppctData.filter(d => d.id !== id));
  };

  const downloadSamplePPCT = () => {
    const sampleData = [
      { 'Lớp': activeGrade, 'Môn': 'Toán', 'Phân môn': 'Đại số', 'Tiết theo PPCT': 1, 'Nội dung': 'Tập hợp các số tự nhiên', 'Ghi chú': '' },
    ];
    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "PPCT Mẫu");
    XLSX.writeFile(wb, `Mau_PPCT_Lop_${activeGrade}.xlsx`);
  };

  const clearData = () => {
    const targetGrade = normalizeGrade(activeGrade);
    setPpctData(ppctData.filter(item => normalizeGrade(item.grade) !== targetGrade));
  };

  const handleChange = (id: string, field: keyof PPCTItem, value: any) => {
    setPpctData(ppctData.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const addRow = () => {
    setPpctData([...ppctData, {
      id: crypto.randomUUID(),
      grade: activeGrade,
      subject: '',
      subSubject: '',
      period: (filteredData.length > 0 ? Math.max(...filteredData.map(d => d.period)) + 1 : 1),
      content: '',
      notes: ''
    }]);
  };

  const resetToDefault = () => {
    if (window.confirm("Bạn có chắc chắn muốn khôi phục phân phối chương trình mặc định?")) {
      setPpctData(DEFAULT_PPCT);
    }
  };

  const syncToLessonPlan = () => {
    const today = new Date();
    const start = startOfWeek(today, { weekStartsOn: 1 });
    const end = endOfWeek(today, { weekStartsOn: 1 });
    
    const rows: LessonPlanRow[] = [];
    const WEEKDAYS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6'];
    const WEEKEND = ['Thứ 7', 'Chủ Nhật'];

    WEEKDAYS.forEach((day, idx) => {
      const date = addDays(start, idx);
      ['Ca 1 (17h-19h)', 'Ca 2 (19h-21h)'].forEach(shift => {
        rows.push({
          id: crypto.randomUUID(),
          day,
          date: format(date, 'dd/MM/yyyy'),
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
          date: format(date, 'dd/MM/yyyy'),
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
  };

  const grades = Array.from(new Set(classes.map(c => c.grade))).sort();
  const filteredData = ppctData.filter(item => normalizeGrade(item.grade) === normalizeGrade(activeGrade));

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 max-w-6xl mx-auto"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">Phân phối chương trình</h2>
          <p className="text-sm text-neutral-500 dark:text-slate-400 mt-1">Quản lý kế hoạch giảng dạy chi tiết theo từng khối lớp.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={resetToDefault}
            className="px-6 py-3 bg-neutral-100 dark:bg-slate-800 text-neutral-700 dark:text-slate-300 rounded-xl hover:bg-neutral-200 dark:hover:bg-slate-700 transition-all font-bold text-sm flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Khôi phục mặc định
          </button>
          <button 
            onClick={syncToLessonPlan}
            className="px-6 py-3 bg-neutral-100 dark:bg-slate-800 text-neutral-700 dark:text-slate-300 rounded-xl hover:bg-neutral-200 dark:hover:bg-slate-700 transition-all font-bold text-sm flex items-center gap-2"
          >
            <Calendar className="w-4 h-4" />
            Tạo lịch báo giảng
          </button>
          <button 
            onClick={downloadSamplePPCT}
            className="px-6 py-3 bg-neutral-100 dark:bg-slate-800 text-neutral-700 dark:text-slate-300 rounded-xl hover:bg-neutral-200 dark:hover:bg-slate-700 transition-all font-bold text-sm flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Tải file mẫu
          </button>
          <label className="px-6 py-3 bg-primary text-white rounded-xl hover:bg-primary-hover transition-all shadow-lg shadow-primary/20 font-bold text-sm flex items-center gap-3 cursor-pointer">
            <Upload className="w-4 h-4" />
            Nhập từ Excel
            <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleFileUpload} />
          </label>
          <button 
            onClick={addRow}
            className="px-6 py-3 bg-primary text-white rounded-xl hover:bg-primary-hover transition-all shadow-lg shadow-primary/20 font-bold text-sm flex items-center gap-3"
          >
            <Plus className="w-4 h-4" />
            Thêm dòng mới
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 p-1.5 bg-neutral-100 dark:bg-slate-800 rounded-2xl w-fit">
          {(grades.length > 0 ? grades : ['6', '7', '8', '9']).map((grade) => (
            <button
              key={grade}
              onClick={() => setActiveGrade(grade)}
              className={cn(
                "px-6 py-2.5 rounded-xl text-sm font-bold transition-all",
                normalizeGrade(activeGrade) === normalizeGrade(grade) 
                  ? "bg-white dark:bg-slate-700 text-primary dark:text-white shadow-sm" 
                  : "text-neutral-500 dark:text-slate-400 hover:text-neutral-900 dark:hover:text-slate-200"
              )}
            >
              Khối {grade}
            </button>
          ))}
        </div>
        {filteredData.length > 0 && (
          <ConfirmButton
            onConfirm={clearData}
            className="text-sm text-red-600 dark:text-red-400 font-bold flex items-center gap-2 px-4 py-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
            icon={Trash2}
            confirmText="Xác nhận xóa?"
          >
            Xóa dữ liệu khối {activeGrade}
          </ConfirmButton>
        )}
      </div>

      <div className="saas-card overflow-hidden !p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-neutral-50/50 dark:bg-slate-900/50 border-b border-neutral-100 dark:border-slate-800">
                <th className="px-6 py-4 text-[10px] font-normal text-neutral-400 dark:text-slate-500 uppercase tracking-widest w-16 text-center">Tiết</th>
                <th className="px-6 py-4 text-[10px] font-normal text-neutral-400 dark:text-slate-500 uppercase tracking-widest w-40">Môn học</th>
                <th className="px-6 py-4 text-[10px] font-normal text-neutral-400 dark:text-slate-500 uppercase tracking-widest w-40">Phân môn</th>
                <th className="px-6 py-4 text-[10px] font-normal text-neutral-400 dark:text-slate-500 uppercase tracking-widest">Nội dung bài dạy</th>
                <th className="px-6 py-4 text-[10px] font-normal text-neutral-400 dark:text-slate-500 uppercase tracking-widest w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-slate-800">
              {filteredData.map((item, idx) => (
                <tr key={item.id} className="hover:bg-neutral-50/30 dark:hover:bg-slate-900/30 transition-colors group">
                  <td className="px-6 py-4">
                    <input
                      type="number"
                      value={item.period}
                      onChange={(e) => handleChange(item.id, 'period', Number(e.target.value))}
                      className="w-full bg-transparent border-none focus:ring-0 text-sm font-normal text-neutral-900 dark:text-white text-center font-mono"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <input
                      value={item.subject}
                      onChange={(e) => handleChange(item.id, 'subject', e.target.value)}
                      className="w-full bg-transparent border-none focus:ring-0 text-sm font-normal text-primary"
                      placeholder="Môn học"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <input
                      value={item.subSubject}
                      onChange={(e) => handleChange(item.id, 'subSubject', e.target.value)}
                      className="w-full bg-transparent border-none focus:ring-0 text-sm text-neutral-500 dark:text-slate-400 italic"
                      placeholder="Phân môn"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <input
                      value={item.content}
                      onChange={(e) => handleChange(item.id, 'content', e.target.value)}
                      className="w-full bg-transparent border-none focus:ring-0 text-sm text-neutral-700 dark:text-slate-300 font-medium"
                      placeholder="Nội dung bài dạy"
                    />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => deleteRow(item.id)}
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredData.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-24 text-center">
                    <div className="w-20 h-20 bg-neutral-50 dark:bg-slate-900 rounded-3xl flex items-center justify-center mx-auto mb-6 text-neutral-300 dark:text-slate-700">
                      <FileSpreadsheet className="w-10 h-10" />
                    </div>
                    <h4 className="text-xl font-bold text-neutral-900 dark:text-white">Chưa có dữ liệu PPCT</h4>
                    <p className="text-sm text-neutral-500 dark:text-slate-400 mt-2">Vui lòng nhập dữ liệu từ file Excel để bắt đầu.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}

function LessonPlanSection({ 
  plans, 
  setPlans, 
  deletePlan, 
  ppctData, 
  classes, 
  businessInfo,
  setActiveTab
}: { 
  key?: string,
  plans: LessonPlan[], 
  setPlans: (p: LessonPlan[]) => void, 
  deletePlan: (id: string) => void,
  ppctData: PPCTItem[], 
  classes: ClassSubject[],
  businessInfo: BusinessInfo,
  setActiveTab: (t: string) => void
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

    WEEKDAYS.forEach((day, idx) => {
      const date = addDays(start, idx);
      ['Ca 1 (17h-19h)', 'Ca 2 (19h-21h)'].forEach(shift => {
        rows.push({
          id: crypto.randomUUID(),
          day,
          date: format(date, 'dd/MM/yyyy'),
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
          date: format(date, 'dd/MM/yyyy'),
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
              new TextRun({ text: `Tuần: ${plan.week} - Từ ngày: ${safeFormat(plan.startDate, 'dd/MM/yyyy')} - Đến ngày: ${safeFormat(plan.endDate, 'dd/MM/yyyy')}`, size: 22 }),
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

                  [row.grade, row.subject, row.subSubject, row.period].forEach(text => {
                    rowChildren.push(new TableCell({
                      children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(text), size: 20 })] })],
                      verticalAlign: VerticalAlign.CENTER,
                    }));
                  });

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
                        spacing: { before: 1700 }
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
                        spacing: { before: 1700 }
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
      <div className="space-y-8 max-w-6xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-normal text-neutral-900 dark:text-white">Tạo Lịch báo giảng</h2>
            <p className="text-sm text-neutral-500 dark:text-slate-400">Thiết lập kế hoạch giảng dạy chi tiết cho tuần mới.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsCreating(false)}
              className="btn-secondary"
            >
              Hủy bỏ
            </button>
            <button
              onClick={savePlan}
              className="btn-primary flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              Lưu lịch dạy
            </button>
          </div>
        </div>

        <div className="saas-card grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-normal text-neutral-400 dark:text-slate-500 uppercase tracking-widest">Họ tên giáo viên</label>
            <input
              value={editingPlan.teacherName}
              onChange={(e) => setEditingPlan({ ...editingPlan, teacherName: e.target.value })}
              placeholder="Nhập họ tên..."
              className="w-full bg-neutral-50 dark:bg-slate-900 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-normal text-neutral-400 dark:text-slate-500 uppercase tracking-widest">Tuần</label>
            <input
              value={editingPlan.week}
              onChange={(e) => setEditingPlan({ ...editingPlan, week: e.target.value })}
              className="w-full bg-neutral-50 dark:bg-slate-900 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-normal text-neutral-400 dark:text-slate-500 uppercase tracking-widest">Ngày bắt đầu</label>
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
              className="w-full bg-neutral-50 dark:bg-slate-900 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-normal text-neutral-400 dark:text-slate-500 uppercase tracking-widest">Ngày kết thúc</label>
            <input
              type="date"
              readOnly
              value={editingPlan.endDate}
              className="w-full bg-neutral-100 dark:bg-slate-800 border-none rounded-xl px-4 py-3 text-sm text-neutral-500 cursor-not-allowed"
            />
          </div>
        </div>

        <div className="saas-card overflow-hidden !p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr className="bg-neutral-50/50 dark:bg-slate-900/50 border-b border-neutral-100 dark:border-slate-800">
                  <th className="px-4 py-4 text-[10px] font-normal text-neutral-400 dark:text-slate-500 uppercase tracking-widest w-24">Thứ, ngày</th>
                  <th className="px-4 py-4 text-[10px] font-normal text-neutral-400 dark:text-slate-500 uppercase tracking-widest w-24">Ca dạy</th>
                  <th className="px-4 py-4 text-[10px] font-normal text-neutral-400 dark:text-slate-500 uppercase tracking-widest w-20">Lớp</th>
                  <th className="px-4 py-4 text-[10px] font-normal text-neutral-400 dark:text-slate-500 uppercase tracking-widest w-32">Môn</th>
                  <th className="px-4 py-4 text-[10px] font-normal text-neutral-400 dark:text-slate-500 uppercase tracking-widest w-32">Phân môn</th>
                  <th className="px-4 py-4 text-[10px] font-normal text-neutral-400 dark:text-slate-500 uppercase tracking-widest w-20">Tiết</th>
                  <th className="px-4 py-4 text-[10px] font-normal text-neutral-400 dark:text-slate-500 uppercase tracking-widest">Nội dung bài dạy</th>
                  <th className="px-4 py-4 text-[10px] font-normal text-neutral-400 dark:text-slate-500 uppercase tracking-widest w-24">Ghi chú</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-slate-800">
                {editingPlan.rows.map((row) => (
                  <tr key={row.id} className="hover:bg-neutral-50/50 dark:hover:bg-slate-900/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="text-xs font-normal text-neutral-900 dark:text-white">{row.day}</div>
                      <div className="text-[10px] text-neutral-400 dark:text-slate-500">{row.date}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-[10px] font-medium text-neutral-500 dark:text-slate-400 bg-neutral-100 dark:bg-slate-800 px-2 py-1 rounded-lg w-fit">
                        {row.shift}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={row.grade}
                        onChange={(e) => handleRowChange(row.id, 'grade', e.target.value)}
                        className="w-full bg-transparent border-none focus:ring-0 text-xs font-normal text-primary"
                      >
                        <option value="">-</option>
                        {Array.from(new Set(classes.map(c => c.grade))).map(g => (
                          <option key={g} value={g}>{g}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={row.subject}
                        onChange={(e) => handleRowChange(row.id, 'subject', e.target.value)}
                        className="w-full bg-transparent border-none focus:ring-0 text-xs font-medium text-neutral-700 dark:text-slate-300"
                      >
                        <option value="">-</option>
                        {Array.from(new Set(classes.filter(c => c.grade === row.grade).map(c => c.subject))).map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={row.subSubject}
                        onChange={(e) => handleRowChange(row.id, 'subSubject', e.target.value)}
                        className="w-full bg-transparent border-none focus:ring-0 text-xs text-neutral-500 dark:text-slate-400"
                      >
                        <option value="">-</option>
                        {classes.filter(c => c.grade === row.grade && c.subject === row.subject).map(c => (
                          <option key={c.subSubject} value={c.subSubject}>{c.subSubject}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={row.period}
                        onChange={(e) => handleRowChange(row.id, 'period', e.target.value)}
                        className="w-full bg-transparent border-none focus:ring-0 text-xs font-normal text-neutral-900 dark:text-white"
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
                              {p.period}
                            </option>
                          ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <input
                          value={row.content}
                          onChange={(e) => handleRowChange(row.id, 'content', e.target.value)}
                          placeholder="Nội dung bài học..."
                          className="flex-1 bg-transparent border-none focus:ring-0 text-xs text-neutral-700 dark:text-slate-300 placeholder-neutral-300 dark:placeholder-slate-700"
                        />
                        {row.grade && row.subject && row.period && (
                          <button
                            onClick={() => autoFillContent(row.id)}
                            className="p-1.5 text-primary hover:bg-primary/10 rounded-lg transition-all"
                            title="AI Tự điền nội dung"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        value={row.notes}
                        onChange={(e) => handleRowChange(row.id, 'notes', e.target.value)}
                        placeholder="..."
                        className="w-full bg-transparent border-none focus:ring-0 text-xs text-neutral-500 dark:text-slate-400"
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
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-normal text-neutral-900 dark:text-white">Lịch báo giảng</h2>
          <p className="text-sm text-neutral-500 dark:text-slate-400">Quản lý và theo dõi kế hoạch giảng dạy hàng tuần.</p>
        </div>
        <button
          onClick={startNewPlan}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Tạo lịch mới
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {plans.map((plan, idx) => (
            <motion.div 
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="saas-card group hover:scale-[1.02] transition-all"
            >
              <div className="flex justify-between items-start mb-6">
                <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                  <CalendarDays className="w-6 h-6" />
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                  <button 
                    onClick={() => { setEditingPlan(plan); setIsCreating(true); }} 
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-neutral-400 hover:text-primary hover:bg-primary/10 transition-all"
                  >
                    <FileText className="w-4 h-4" />
                  </button>
                  <ConfirmButton 
                    onConfirm={() => deletePlan(plan.id)} 
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                    icon={Trash2}
                    confirmText=""
                  />
                </div>
              </div>
              
              <h3 className="text-lg font-normal text-neutral-900 dark:text-white mb-1">
                {plan.teacherName || 'Giáo viên chưa định danh'}
              </h3>
              <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-slate-400 mb-6">
                <span className="bg-neutral-100 dark:bg-slate-800 px-2 py-1 rounded-lg font-normal">Tuần {plan.week}</span>
                <span>{safeFormat(plan.startDate, 'dd/MM/yyyy')} - {safeFormat(plan.endDate, 'dd/MM/yyyy')}</span>
              </div>

              <button
                onClick={() => exportToWord(plan)}
                className="w-full btn-secondary flex items-center justify-center gap-2 py-2.5"
              >
                <Download className="w-4 h-4" />
                Tải file Word
              </button>
            </motion.div>
          ))}
        </AnimatePresence>

        {plans.length === 0 && (
          <div className="col-span-full py-24 text-center border-2 border-dashed border-neutral-200 dark:border-slate-800 rounded-3xl">
            <div className="w-20 h-20 bg-neutral-50 dark:bg-slate-900 rounded-3xl flex items-center justify-center mx-auto mb-6 text-neutral-300 dark:text-slate-700">
              <Plus className="w-10 h-10" />
            </div>
            <h4 className="text-xl font-normal text-neutral-900 dark:text-white">Chưa có lịch dạy</h4>
            <p className="text-sm text-neutral-500 dark:text-slate-400 mt-2">Bắt đầu bằng cách tạo một lịch báo giảng mới cho tuần này.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ClassJournalSection({ 
  plans, 
  setPlans, 
  deletePlan,
  businessInfo,
  setActiveTab
}: { 
  key?: string,
  plans: LessonPlan[], 
  setPlans: (p: LessonPlan[]) => void,
  deletePlan: (id: string) => void,
  businessInfo: BusinessInfo,
  setActiveTab: (t: string) => void
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
              new TextRun({ text: `Tuần: ${selectedPlan.week} - Từ ngày: ${safeFormat(selectedPlan.startDate, 'dd/MM/yyyy')} - Đến ngày: ${safeFormat(selectedPlan.endDate, 'dd/MM/yyyy')}`, size: 22 }),
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
        ],
      }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `SoDauBai_Tuan${selectedPlan.week}.docx`);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-neutral-900 dark:text-white tracking-tight">Sổ đầu bài</h2>
          <p className="text-neutral-500 dark:text-slate-400 mt-1 font-medium">Ghi chép tình hình lớp học dựa trên lịch báo giảng.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {selectedPlan && (
            <>
              <ConfirmButton
                onConfirm={() => {
                  deletePlan(selectedPlan.id);
                  setSelectedPlanId('');
                }}
                className="flex items-center gap-2 px-4 py-2 text-red-600 border border-red-200 dark:border-red-900/30 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-all font-bold text-sm"
                icon={Trash2}
              >
                Xóa lịch này
              </ConfirmButton>
              <button
                onClick={exportToWord}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl hover:bg-primary-hover transition-all shadow-lg shadow-primary/20 font-bold text-sm"
              >
                <Download className="w-4 h-4" /> Xuất Sổ đầu bài
              </button>
            </>
          )}
        </div>
      </header>

      <div className="saas-card p-0 overflow-hidden">
        <div className="p-6 border-b border-neutral-100 dark:border-slate-800 bg-neutral-50/50 dark:bg-slate-800/30">
          <div className="max-w-md">
            <label className="text-[11px] font-black text-neutral-500 dark:text-slate-400 uppercase tracking-widest block mb-2">Chọn lịch báo giảng để ghi sổ</label>
            <div className="relative">
              <select
                value={selectedPlanId}
                onChange={(e) => setSelectedPlanId(e.target.value)}
                className="w-full pl-4 pr-10 py-3 bg-white dark:bg-slate-900 rounded-xl border border-neutral-200 dark:border-slate-700 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all appearance-none text-sm font-bold text-neutral-900 dark:text-white"
              >
                <option value="">-- Chọn lịch báo giảng --</option>
                {plans.map(p => (
                  <option key={p.id} value={p.id}>{p.teacherName} - Tuần {p.week} ({p.startDate} - {p.endDate})</option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-400">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </div>
        </div>

        <div className="p-0">
          {selectedPlan ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[1200px]">
                <thead>
                  <tr className="bg-neutral-50 dark:bg-slate-800/50 border-b border-neutral-200 dark:border-slate-800">
                    <th className="px-4 py-4 text-[11px] font-black text-neutral-500 dark:text-slate-400 uppercase tracking-widest w-32">Thứ, ngày</th>
                    <th className="px-4 py-4 text-[11px] font-black text-neutral-500 dark:text-slate-400 uppercase tracking-widest w-28">Buổi</th>
                    <th className="px-4 py-4 text-[11px] font-black text-neutral-500 dark:text-slate-400 uppercase tracking-widest w-20">Lớp</th>
                    <th className="px-4 py-4 text-[11px] font-black text-neutral-500 dark:text-slate-400 uppercase tracking-widest w-32">Môn</th>
                    <th className="px-4 py-4 text-[11px] font-black text-neutral-500 dark:text-slate-400 uppercase tracking-widest">Nội dung bài dạy</th>
                    <th className="px-4 py-4 text-[11px] font-black text-neutral-500 dark:text-slate-400 uppercase tracking-widest w-24">Sĩ số</th>
                    <th className="px-4 py-4 text-[11px] font-black text-neutral-500 dark:text-slate-400 uppercase tracking-widest w-64">Nhận xét</th>
                    <th className="px-4 py-4 text-[11px] font-black text-neutral-500 dark:text-slate-400 uppercase tracking-widest w-40">Chữ ký</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-slate-800">
                  {selectedPlan.rows.filter(r => r.grade).map((row) => (
                    <tr key={row.id} className="hover:bg-neutral-50 dark:hover:bg-slate-800/50 transition-colors group">
                      <td className="px-4 py-4">
                        <div className="font-bold text-neutral-900 dark:text-white text-sm">{row.day}</div>
                        <div className="text-[11px] text-neutral-400 dark:text-slate-500 font-bold mt-0.5">{row.date}</div>
                      </td>
                      <td className="px-4 py-4 text-sm font-medium text-neutral-600 dark:text-slate-300">{row.shift}</td>
                      <td className="px-4 py-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-primary/10 text-primary text-[10px] font-black border border-primary/20 uppercase tracking-wider">
                          {row.grade}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm font-medium text-neutral-600 dark:text-slate-300">{row.subject}</td>
                      <td className="px-4 py-4 text-sm text-neutral-900 dark:text-white leading-relaxed font-medium">{row.content}</td>
                      <td className="px-3 py-3">
                        <input
                          value={row.attendance || ''}
                          onChange={(e) => handleRowChange(row.id, 'attendance', e.target.value)}
                          placeholder="20/20"
                          className="w-full bg-transparent border border-transparent group-hover:border-neutral-200 dark:group-hover:border-slate-700 focus:border-primary focus:ring-2 focus:ring-primary/10 rounded-lg px-2 py-1.5 text-sm transition-all outline-none dark:text-white font-bold"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <input
                          value={row.comments || ''}
                          onChange={(e) => handleRowChange(row.id, 'comments', e.target.value)}
                          placeholder="Lớp học tốt..."
                          className="w-full bg-transparent border border-transparent group-hover:border-neutral-200 dark:group-hover:border-slate-700 focus:border-primary focus:ring-2 focus:ring-primary/10 rounded-lg px-2 py-1.5 text-sm transition-all outline-none dark:text-white font-medium"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <input
                          value={row.signature || ''}
                          onChange={(e) => handleRowChange(row.id, 'signature', e.target.value)}
                          placeholder="Ký tên"
                          className="w-full bg-transparent border border-transparent group-hover:border-neutral-200 dark:group-hover:border-slate-700 focus:border-primary focus:ring-2 focus:ring-primary/10 rounded-lg px-2 py-1.5 text-sm transition-all outline-none dark:text-white font-bold italic"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-24 text-center">
              <div className="w-20 h-20 bg-[#F9FAFB] rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="w-10 h-10 text-[#9CA3AF]" />
              </div>
              <h3 className="text-lg font-bold text-[#1F2937]">Chưa chọn lịch báo giảng</h3>
              <p className="text-[#6B7280] mt-2 max-w-xs mx-auto">Vui lòng chọn một lịch báo giảng từ danh sách phía trên để bắt đầu ghi sổ đầu bài.</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function ProgramManagementSection({ 
  classes, 
  setClasses, 
  ppctData, 
  setPpctData, 
  lessonPlans, 
  setLessonPlans, 
  deletePlan, 
  businessInfo, 
  activeSubTab, 
  setActiveTab 
}: { 
  classes: ClassSubject[], 
  setClasses: (c: ClassSubject[]) => void, 
  ppctData: PPCTItem[], 
  setPpctData: (d: PPCTItem[]) => void, 
  lessonPlans: LessonPlan[], 
  setLessonPlans: (l: LessonPlan[]) => void, 
  deletePlan: (id: string) => void, 
  businessInfo: BusinessInfo, 
  activeSubTab: string, 
  setActiveTab: (t: string) => void 
}) {
  const subNavItems = [
    { id: 'classes', label: 'Cấu hình lớp học', icon: GraduationCap, description: 'Thiết lập khối lớp, môn học và phân môn.' },
    { id: 'ppct', label: 'Phân phối chương trình', icon: BookOpen, description: 'Quản lý nội dung giảng dạy theo từng tiết.' },
    { id: 'lesson-plan', label: 'Lịch báo giảng', icon: CalendarDays, description: 'Lập kế hoạch giảng dạy chi tiết theo tuần.' },
    { id: 'journal', label: 'Sổ đầu bài', icon: ClipboardList, description: 'Ghi chép nhật ký giảng dạy của các lớp.' },
  ];

  const renderSubNav = () => (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8 pb-6 border-b border-neutral-100 dark:border-slate-800">
      <button 
        onClick={() => setActiveTab('dashboard')}
        className="flex items-center gap-2 text-neutral-500 hover:text-primary transition-all text-sm font-bold group"
      >
        <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-slate-800 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all">
          <ArrowLeft className="w-4 h-4" />
        </div>
        Quay lại trang chủ
      </button>
      
      <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 scrollbar-hide w-full sm:w-auto">
        {subNavItems.map(item => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap border",
              activeSubTab === item.id 
                ? "bg-primary text-white border-primary shadow-lg shadow-primary/20" 
                : "bg-white dark:bg-slate-900 text-neutral-500 dark:text-slate-400 border-neutral-200 dark:border-slate-800 hover:border-primary/50 hover:text-primary"
            )}
          >
            <item.icon className="w-3.5 h-3.5" />
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );

  if (activeSubTab === 'program') {
    return (
      <div className="space-y-6">
        {renderSubNav()}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <header>
            <h2 className="text-2xl font-bold text-[#1F2937] dark:text-white">Quản lý Chương trình</h2>
            <p className="text-[#6B7280] dark:text-slate-400 mt-1">Chọn chức năng bạn muốn thực hiện.</p>
          </header>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {subNavItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className="bg-white dark:bg-slate-900 p-6 rounded-[20px] shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-[#E5E7EB] dark:border-slate-800 hover:border-[#1677FF] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] transition-all text-center group relative overflow-hidden flex flex-col items-center"
              >
                <div className="absolute top-0 left-0 w-1 h-full bg-[#1677FF] opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="w-14 h-14 bg-[#EFF6FF] dark:bg-blue-900/20 rounded-2xl flex items-center justify-center text-[#1677FF] mb-4 group-hover:scale-110 transition-transform">
                  <item.icon className="w-7 h-7" />
                </div>
                <h3 className="text-base font-bold text-[#1F2937] dark:text-white">{item.label}</h3>
                <p className="text-xs text-[#6B7280] dark:text-slate-400 mt-2 leading-relaxed">
                  {item.description}
                </p>
              </button>
            ))}
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {renderSubNav()}
      <AnimatePresence mode="wait">
        {activeSubTab === 'classes' && (
          <ClassConfigSection key="classes" classes={classes} setClasses={setClasses} setActiveTab={setActiveTab} />
        )}
        {activeSubTab === 'ppct' && (
          <PPCTSection key="ppct" ppctData={ppctData} setPpctData={setPpctData} classes={classes} plans={lessonPlans} setPlans={setLessonPlans} setActiveTab={setActiveTab} />
        )}
        {activeSubTab === 'lesson-plan' && (
          <LessonPlanSection key="lesson-plan" plans={lessonPlans} setPlans={setLessonPlans} classes={classes} ppctData={ppctData} deletePlan={deletePlan} businessInfo={businessInfo} setActiveTab={setActiveTab} />
        )}
        {activeSubTab === 'journal' && (
          <ClassJournalSection key="journal" plans={lessonPlans} setPlans={setLessonPlans} deletePlan={deletePlan} businessInfo={businessInfo} setActiveTab={setActiveTab} />
        )}
      </AnimatePresence>
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
  const subNavItems = [
    { id: 'students-list', label: 'Tải danh sách học sinh', icon: Upload },
    { id: 'students-export', label: 'Xuất đơn đăng kí học thêm', icon: FileText },
  ];

  const renderSubNav = () => (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8 pb-6 border-b border-neutral-100 dark:border-slate-800">
      <button 
        onClick={() => setActiveTab('dashboard')}
        className="flex items-center gap-2 text-neutral-500 hover:text-primary transition-all text-sm font-bold group"
      >
        <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-slate-800 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all">
          <ArrowLeft className="w-4 h-4" />
        </div>
        Quay lại trang chủ
      </button>
      
      <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 scrollbar-hide w-full sm:w-auto">
        {subNavItems.map(item => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap border",
              activeSubTab === item.id 
                ? "bg-primary text-white border-primary shadow-lg shadow-primary/20" 
                : "bg-white dark:bg-slate-900 text-neutral-500 dark:text-slate-400 border-neutral-200 dark:border-slate-800 hover:border-primary/50 hover:text-primary"
            )}
          >
            <item.icon className="w-3.5 h-3.5" />
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );

  if (activeSubTab === 'students_group') {
    return (
      <div className="space-y-6">
        {renderSubNav()}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <header>
            <h2 className="text-2xl font-bold text-[#1F2937] dark:text-white">Quản lý Học sinh</h2>
            <p className="text-[#6B7280] dark:text-slate-400 mt-1">Chọn chức năng bạn muốn thực hiện.</p>
          </header>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {subNavItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className="bg-white dark:bg-slate-900 p-8 rounded-[20px] shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-[#E5E7EB] dark:border-slate-800 hover:border-[#1677FF] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] transition-all text-center group relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-1 h-full bg-[#1677FF] opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="w-16 h-16 bg-[#EFF6FF] dark:bg-blue-900/20 rounded-2xl flex items-center justify-center text-[#1677FF] mx-auto mb-5 group-hover:scale-110 transition-transform">
                  <item.icon className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-[#1F2937] dark:text-white">{item.label}</h3>
                <p className="text-sm text-[#6B7280] dark:text-slate-400 mt-2 leading-relaxed">
                  {item.id === 'students-list' 
                    ? 'Nhập danh sách học sinh từ file Excel vào hệ thống để quản lý tập trung.'
                    : 'Tạo và tải về đơn đăng ký học thêm chuyên nghiệp cho từng học sinh.'}
                </p>
              </button>
            ))}
          </div>
        </motion.div>
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
                    spacing: { line: 312 },
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
    ];
  };

  const exportRegistrationForm = async (student: Student) => {
    const doc = new Document({
      sections: [{
        properties: {
          page: {
            margin: { top: 1134, bottom: 567, left: 1531, right: 1134 }
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
      {renderSubNav()}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">Quản lý Học sinh</h2>
            <p className="text-neutral-500 dark:text-slate-400 mt-1">
              {activeSubTab === 'students-list' ? 'Tải danh sách học sinh từ file Excel.' : 'Xuất đơn đăng ký học thêm cho học sinh.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {activeSubTab === 'students-export' && (
              <button
                onClick={exportAllRegistrationForms}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-sm font-bold text-sm w-full md:w-auto justify-center"
              >
                <Download className="w-4 h-4" /> Xuất toàn bộ đơn
              </button>
            )}
            {activeSubTab === 'students-list' && (
              <>
                <ConfirmButton
                  onConfirm={() => setStudents([])}
                  className="flex items-center gap-2 px-4 py-2.5 text-red-600 border border-red-200 dark:border-red-900/30 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-all font-bold text-sm w-full md:w-auto justify-center"
                  icon={Trash2}
                >
                  Xóa toàn bộ
                </ConfirmButton>
                <label className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl hover:bg-primary-hover transition-all shadow-sm font-bold cursor-pointer w-full md:w-auto justify-center text-sm">
                  <Upload className="w-4 h-4" /> Đưa danh sách lên (Excel)
                  <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="hidden" />
                </label>
              </>
            )}
          </div>
        </header>

        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-neutral-200 dark:border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr className="bg-neutral-50 dark:bg-slate-800/50 border-b border-neutral-200 dark:border-slate-800">
                  <th className="px-6 py-4 text-[11px] font-normal text-neutral-500 dark:text-slate-400 uppercase tracking-wider w-16 text-center">STT</th>
                  <th className="px-6 py-4 text-[11px] font-normal text-neutral-500 dark:text-slate-400 uppercase tracking-wider">Họ và tên</th>
                  <th className="px-6 py-4 text-[11px] font-normal text-neutral-500 dark:text-slate-400 uppercase tracking-wider w-24 text-center">Lớp</th>
                  <th className="px-6 py-4 text-[11px] font-normal text-neutral-500 dark:text-slate-400 uppercase tracking-wider">Trường</th>
                  <th className="px-6 py-4 text-[11px] font-normal text-neutral-500 dark:text-slate-400 uppercase tracking-wider">Phụ huynh</th>
                  <th className="px-6 py-4 text-[11px] font-normal text-neutral-500 dark:text-slate-400 uppercase tracking-wider">SĐT</th>
                  <th className="px-6 py-4 text-[11px] font-normal text-neutral-500 dark:text-slate-400 uppercase tracking-wider">Môn đăng ký</th>
                  <th className="px-6 py-4 text-[11px] font-normal text-neutral-500 dark:text-slate-400 uppercase tracking-wider w-32 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-slate-800">
                {students.map((student, idx) => (
                  <tr key={student.id} className="hover:bg-neutral-50 dark:hover:bg-slate-800/50 transition-colors group">
                    <td className="px-6 py-4 text-sm text-neutral-500 dark:text-slate-400 text-center font-mono">{student.stt || idx + 1}</td>
                    <td className="px-6 py-4 text-sm font-normal text-neutral-900 dark:text-white">{student.name}</td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-xs font-normal border border-primary/20">
                        {student.grade}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-neutral-600 dark:text-slate-400">{student.school}</td>
                    <td className="px-6 py-4 text-sm text-neutral-600 dark:text-slate-400 font-normal">{student.parentName}</td>
                    <td className="px-6 py-4 text-sm text-neutral-600 dark:text-slate-400 font-mono">{student.phone}</td>
                    <td className="px-6 py-4 text-sm text-neutral-600 dark:text-slate-400">{student.subject}</td>
                    <td className="px-6 py-4 text-sm text-center">
                      <div className="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {activeSubTab === 'students-export' && (
                          <button
                            onClick={() => exportRegistrationForm(student)}
                            title="Xuất đơn đăng ký"
                            className="w-8 h-8 flex items-center justify-center text-primary hover:bg-primary/10 rounded-lg transition-all"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                        )}
                        {activeSubTab === 'students-list' && (
                          <ConfirmButton
                            onConfirm={() => setStudents(students.filter(s => s.id !== student.id))}
                            className="w-8 h-8 flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                            icon={Trash2}
                            confirmText=""
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {students.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-24 text-center">
                      <div className="w-20 h-20 bg-neutral-50 dark:bg-slate-900 rounded-3xl flex items-center justify-center mx-auto mb-6 text-neutral-300 dark:text-slate-700">
                        <Users className="w-10 h-10" />
                      </div>
                      <h3 className="text-xl font-bold text-neutral-900 dark:text-white">Chưa có danh sách học sinh</h3>
                      <p className="text-sm text-neutral-500 dark:text-slate-400 mt-2 max-w-xs mx-auto italic">Vui lòng đưa file Excel lên để bắt đầu quản lý học sinh.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function LoginPage({ onLogin, users, darkMode, setDarkMode }: { onLogin: (user: UserAccount) => void, users: UserAccount[], darkMode: boolean, setDarkMode: (v: boolean) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const user = users.find(u => u.email.toLowerCase() === email.trim().toLowerCase() && u.password === password.trim());
    
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
    <div className="min-h-screen bg-bg-light dark:bg-bg-dark flex items-center justify-center p-4 transition-colors duration-500 relative overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/10 rounded-full blur-[120px] animate-pulse delay-700" />

      <motion.div 
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="max-w-md w-full bg-card-light dark:bg-card-dark rounded-[32px] shadow-2xl p-10 border border-neutral-200/50 dark:border-slate-700/50 relative z-10 backdrop-blur-sm"
      >
        <div className="absolute top-6 right-6">
          <button 
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 rounded-xl bg-neutral-100 dark:bg-slate-800 text-neutral-600 dark:text-slate-400 hover:scale-110 transition-all"
          >
            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>

          <div className="text-center mb-10">
          <motion.div 
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.2 }}
            className="w-20 h-20 bg-gradient-to-br from-primary to-indigo-600 rounded-[24px] flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-primary/40 relative"
          >
            <GraduationCap className="w-12 h-12 text-white" />
            <div className="absolute -top-2 -right-2 w-6 h-6 bg-amber-400 rounded-full border-4 border-white dark:border-slate-900 shadow-sm" />
          </motion.div>
          <h1 className="text-3xl font-black text-neutral-900 dark:text-white tracking-tight">Chào mừng trở lại</h1>
          <p className="text-neutral-500 dark:text-slate-400 mt-2 font-bold text-sm uppercase tracking-widest">Hệ thống quản lý Hoàng Gia</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-neutral-700 dark:text-slate-300 ml-1">Tài khoản</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <User className="w-5 h-5 text-neutral-400 group-focus-within:text-primary transition-colors" />
              </div>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-neutral-50 dark:bg-slate-900/50 border border-neutral-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white transition-all outline-none"
                placeholder="Nhập email hoặc tên đăng nhập"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-neutral-700 dark:text-slate-300 ml-1">Mật khẩu</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Lock className="w-5 h-5 text-neutral-400 group-focus-within:text-primary transition-colors" />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-neutral-50 dark:bg-slate-900/50 border border-neutral-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white transition-all outline-none"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-2xl flex items-center gap-3 text-red-600 dark:text-red-400 text-sm font-medium"
            >
              <Info className="w-5 h-5 shrink-0" />
              {error}
            </motion.div>
          )}

          <button
            type="submit"
            className="w-full py-4 bg-primary text-white rounded-2xl font-bold hover:bg-primary-hover transition-all shadow-xl shadow-primary/20 flex items-center justify-center gap-3 group active:scale-[0.98]"
          >
            Đăng nhập hệ thống
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </form>

        <div className="mt-10 pt-8 border-t border-neutral-100 dark:border-slate-800 text-center">
          <p className="text-xs text-neutral-400 dark:text-slate-500 font-medium uppercase tracking-widest">
            Bản quyền: Đào Minh Tâm - Zalo 0366000555
          </p>
        </div>
      </motion.div>
    </div>
  );
}

function UserManagementSection({ users, setUsers, setActiveTab }: { users: UserAccount[], setUsers: React.Dispatch<React.SetStateAction<UserAccount[]>>, setActiveTab: (t: string) => void }) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [formData, setFormData] = useState({ 
    email: '', 
    password: '', 
    role: 'user' as const, 
    expiryDate: '',
    businessName: '',
    businessAddress: '',
    businessLocation: '',
    businessOwner: ''
  });

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUser) {
      setUsers(users.map(u => u.id === editingUser.id ? { ...u, ...formData } : u));
      setEditingUser(null);
    } else {
      const user: UserAccount = {
        id: crypto.randomUUID(),
        ...formData,
        createdAt: new Date().toISOString()
      };
      setUsers([...users, user]);
      setIsAdding(false);
    }
    setFormData({ 
      email: '', 
      password: '', 
      role: 'user', 
      expiryDate: '',
      businessName: '',
      businessAddress: '',
      businessLocation: '',
      businessOwner: ''
    });
  };

  const startEdit = (user: UserAccount) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      password: user.password,
      role: user.role,
      expiryDate: user.expiryDate || '',
      businessName: user.businessName || '',
      businessAddress: user.businessAddress || '',
      businessLocation: user.businessLocation || '',
      businessOwner: user.businessOwner || ''
    });
    setIsAdding(false);
  };

  const cancelForm = () => {
    setIsAdding(false);
    setEditingUser(null);
    setFormData({ 
      email: '', 
      password: '', 
      role: 'user', 
      expiryDate: '',
      businessName: '',
      businessAddress: '',
      businessLocation: '',
      businessOwner: ''
    });
  };

  const deleteUser = (id: string) => {
    setUsers(users.filter(u => u.id !== id));
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <button 
        onClick={() => setActiveTab('dashboard')}
        className="flex items-center gap-2 text-neutral-500 hover:text-primary transition-all text-sm font-bold group mb-4"
      >
        <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-slate-800 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all">
          <ArrowLeft className="w-4 h-4" />
        </div>
        Quay lại trang chủ
      </button>

      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-neutral-900 dark:text-white tracking-tight">Quản lý Tài khoản</h2>
          <p className="text-neutral-500 dark:text-slate-400 mt-1 font-medium">Tạo và quản lý quyền truy cập của người dùng.</p>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl hover:bg-primary-hover transition-all shadow-lg shadow-primary/20 font-bold text-sm"
        >
          <UserPlus className="w-4 h-4" />
          Thêm tài khoản
        </button>
      </header>

      {(isAdding || editingUser) && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="saas-card p-8"
        >
          <h3 className="text-lg font-normal text-neutral-900 dark:text-white mb-6 flex items-center gap-2">
            <div className="w-2 h-6 bg-primary rounded-full" />
            {editingUser ? 'Chỉnh sửa tài khoản' : 'Thêm tài khoản mới'}
          </h3>
          <form onSubmit={handleSaveUser} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-2">
              <label className="block text-[11px] font-normal text-neutral-500 dark:text-slate-400 uppercase tracking-widest ml-1">Tài khoản</label>
              <input
                type="text"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-3 bg-neutral-50 dark:bg-slate-800/50 border border-neutral-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none dark:text-white transition-all font-normal"
                placeholder="Email hoặc tên đăng nhập"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="block text-[11px] font-normal text-neutral-500 dark:text-slate-400 uppercase tracking-widest ml-1">Mật khẩu</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-4 py-3 bg-neutral-50 dark:bg-slate-800/50 border border-neutral-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none dark:text-white transition-all font-normal"
                placeholder="••••••••"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="block text-[11px] font-normal text-neutral-500 dark:text-slate-400 uppercase tracking-widest ml-1">Quyền hạn</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as 'admin' | 'user' })}
                className="w-full px-4 py-3 bg-neutral-50 dark:bg-slate-800/50 border border-neutral-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none dark:text-white transition-all font-normal appearance-none"
              >
                <option value="user">Người dùng</option>
                <option value="admin">Quản trị viên</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-[11px] font-black text-neutral-500 dark:text-slate-400 uppercase tracking-widest ml-1">Hạn sử dụng</label>
              <input
                type="date"
                value={formData.expiryDate}
                onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                className="w-full px-4 py-3 bg-neutral-50 dark:bg-slate-800/50 border border-neutral-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none dark:text-white transition-all font-bold"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-[11px] font-normal text-neutral-500 dark:text-slate-400 uppercase tracking-widest ml-1">Tên cơ sở kinh doanh</label>
              <input
                type="text"
                value={formData.businessName}
                onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                className="w-full px-4 py-3 bg-neutral-50 dark:bg-slate-800/50 border border-neutral-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none dark:text-white transition-all font-normal"
                placeholder="Tên cơ sở"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-[11px] font-normal text-neutral-500 dark:text-slate-400 uppercase tracking-widest ml-1">Địa chỉ</label>
              <input
                type="text"
                value={formData.businessAddress}
                onChange={(e) => setFormData({ ...formData, businessAddress: e.target.value })}
                className="w-full px-4 py-3 bg-neutral-50 dark:bg-slate-800/50 border border-neutral-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none dark:text-white transition-all font-normal"
                placeholder="Địa chỉ chi tiết"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-[11px] font-normal text-neutral-500 dark:text-slate-400 uppercase tracking-widest ml-1">Nơi kinh doanh</label>
              <input
                type="text"
                value={formData.businessLocation}
                onChange={(e) => setFormData({ ...formData, businessLocation: e.target.value })}
                className="w-full px-4 py-3 bg-neutral-50 dark:bg-slate-800/50 border border-neutral-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none dark:text-white transition-all font-normal"
                placeholder="Thành phố, Tỉnh"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-[11px] font-normal text-neutral-500 dark:text-slate-400 uppercase tracking-widest ml-1">Chủ hộ kinh doanh</label>
              <input
                type="text"
                value={formData.businessOwner}
                onChange={(e) => setFormData({ ...formData, businessOwner: e.target.value })}
                className="w-full px-4 py-3 bg-neutral-50 dark:bg-slate-800/50 border border-neutral-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none dark:text-white transition-all font-normal"
                placeholder="Tên chủ hộ"
              />
            </div>
            <div className="md:col-span-2 lg:col-span-4 flex justify-end gap-3 mt-4 pt-6 border-t border-neutral-100 dark:border-slate-800">
              <button
                type="button"
                onClick={cancelForm}
                className="px-6 py-2.5 text-neutral-600 dark:text-slate-400 hover:bg-neutral-100 dark:hover:bg-slate-800 rounded-xl transition-all font-bold text-sm"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                className="px-8 py-2.5 bg-primary text-white rounded-xl hover:bg-primary-hover transition-all font-bold text-sm shadow-lg shadow-primary/20"
              >
                {editingUser ? 'Cập nhật tài khoản' : 'Lưu tài khoản'}
              </button>
            </div>
          </form>
        </motion.div>
      )}

      <div className="saas-card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-neutral-50 dark:bg-slate-800/50 border-b border-neutral-200 dark:border-slate-800">
                <th className="px-6 py-4 text-[11px] font-normal text-neutral-500 dark:text-slate-400 uppercase tracking-widest">Tài khoản</th>
                <th className="px-6 py-4 text-[11px] font-normal text-neutral-500 dark:text-slate-400 uppercase tracking-widest">Quyền hạn</th>
                <th className="px-6 py-4 text-[11px] font-normal text-neutral-500 dark:text-slate-400 uppercase tracking-widest">Ngày tạo</th>
                <th className="px-6 py-4 text-[11px] font-normal text-neutral-500 dark:text-slate-400 uppercase tracking-widest">Thông tin kinh doanh</th>
                <th className="px-6 py-4 text-[11px] font-normal text-neutral-500 dark:text-slate-400 uppercase tracking-widest">Hạn sử dụng</th>
                <th className="px-6 py-4 text-[11px] font-normal text-neutral-500 dark:text-slate-400 uppercase tracking-widest text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-slate-800">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-neutral-50 dark:hover:bg-slate-800/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black shadow-sm">
                        {user.email?.charAt(0).toUpperCase() || '?'}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-normal text-neutral-900 dark:text-white">{user.email || 'No Email'}</span>
                        <span className="text-[10px] text-neutral-400 dark:text-slate-500 font-normal uppercase tracking-wider">ID: {user.id.slice(0, 8)}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border",
                      user.role === 'admin' 
                        ? "bg-purple-50 text-purple-700 border-purple-100 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-900/30" 
                        : "bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-900/30"
                    )}>
                      {user.role === 'admin' ? 'Quản trị viên' : 'Người dùng'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs font-bold text-neutral-500 dark:text-slate-400 font-mono">
                    {formatDate(user.createdAt)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      {user.businessName && <span className="text-xs font-bold text-neutral-900 dark:text-white">{user.businessName}</span>}
                      {user.businessOwner && <span className="text-[10px] text-neutral-500 dark:text-slate-400">Chủ: {user.businessOwner}</span>}
                      {(user.businessAddress || user.businessLocation) && (
                        <div className="flex items-center gap-1 text-[10px] text-neutral-400 dark:text-slate-500">
                          <MapPin className="w-3 h-3" />
                          <span>{[user.businessAddress, user.businessLocation].filter(Boolean).join(', ')}</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs">
                    {user.expiryDate ? (
                      <span className={cn(
                        "flex items-center gap-1.5 font-bold font-mono",
                        new Date(user.expiryDate) < new Date() ? "text-red-500" : "text-neutral-600 dark:text-slate-400"
                      )}>
                        <Calendar className="w-3.5 h-3.5" />
                        {formatDate(user.expiryDate)}
                      </span>
                    ) : (
                      <span className="text-neutral-400 dark:text-slate-600 italic text-[11px] font-bold uppercase tracking-wider">Vô thời hạn</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => startEdit(user)}
                        className="w-9 h-9 flex items-center justify-center text-primary hover:bg-primary/10 rounded-xl transition-all"
                        title="Chỉnh sửa"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {user.email !== 'cosogiaoduchoanggia269@gmail.com' && (
                        <ConfirmButton
                          onConfirm={() => deleteUser(user.id)}
                          className="w-9 h-9 flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                          icon={Trash2}
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
    </motion.div>
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

  const subNavItems = [
    { id: 'classes', label: 'Cấu hình lớp học', icon: GraduationCap },
    { id: 'ppct', label: 'Phân phối chương trình', icon: BookOpen },
    { id: 'lesson-plan', label: 'Lịch báo giảng', icon: CalendarDays },
    { id: 'journal', label: 'Sổ đầu bài', icon: ClipboardList },
  ];

  if (currentUser?.role === 'admin') {
    subNavItems.push({ id: 'users', label: 'Tạo tài khoản', icon: UserPlus });
  }

  const renderSubNav = () => (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8 pb-6 border-b border-neutral-100 dark:border-slate-800">
      <button 
        onClick={() => setActiveTab('dashboard')}
        className="flex items-center gap-2 text-neutral-500 hover:text-primary transition-all text-sm font-bold group"
      >
        <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-slate-800 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all">
          <ArrowLeft className="w-4 h-4" />
        </div>
        Quay lại trang chủ
      </button>
      
      <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 scrollbar-hide w-full sm:w-auto">
        {subNavItems.map(item => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className="flex items-center gap-2 px-4 py-2 bg-neutral-50 dark:bg-slate-800/50 hover:bg-primary/10 hover:text-primary rounded-xl transition-all text-[11px] font-black uppercase tracking-wider whitespace-nowrap border border-transparent hover:border-primary/20"
          >
            <item.icon className="w-3.5 h-3.5" />
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );

  if (activeSubTab === 'finance_group') {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-8"
      >
        {renderSubNav()}
        <header>
          <h2 className="text-3xl font-normal text-neutral-900 dark:text-white tracking-tight">Quản lý Tài chính</h2>
          <p className="text-neutral-500 dark:text-slate-400 mt-2 text-lg font-normal">Hệ thống quản lý thu chi và báo cáo thuế hộ kinh doanh.</p>
        </header>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <button
            onClick={() => setActiveTab('finance-config')}
            className="saas-card p-8 hover:border-primary dark:hover:border-primary hover:shadow-2xl hover:shadow-primary/10 transition-all text-left group relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500" />
            <div className="relative z-10">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mb-6 group-hover:scale-110 transition-transform shadow-sm">
                <Settings className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-normal text-neutral-900 dark:text-white mb-3 tracking-tight">Cấu hình & Tải dữ liệu</h3>
              <p className="text-neutral-500 dark:text-slate-400 leading-relaxed font-normal text-sm">Thiết lập thông tin báo cáo, người ký và nhập dữ liệu thu chi từ file Excel.</p>
              <div className="mt-6 flex items-center text-primary font-normal text-xs uppercase tracking-widest">
                Bắt đầu ngay <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('finance-ledger')}
            className="saas-card p-8 hover:border-emerald-500 dark:hover:border-emerald-500 hover:shadow-2xl hover:shadow-emerald-500/10 transition-all text-left group relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500" />
            <div className="relative z-10">
              <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-600 mb-6 group-hover:scale-110 transition-transform shadow-sm">
                <BarChart3 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-normal text-neutral-900 dark:text-white mb-3 tracking-tight">Sổ chi tiết doanh thu</h3>
              <p className="text-neutral-500 dark:text-slate-400 leading-relaxed font-normal text-sm">Xuất sổ S1a-HKD theo Thông tư 152/2025/TT-BTC phục vụ quyết toán thuế.</p>
              <div className="mt-6 flex items-center text-emerald-600 font-normal text-xs uppercase tracking-widest">
                Xuất báo cáo <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('finance-vouchers')}
            className="saas-card p-8 hover:border-orange-500 dark:hover:border-orange-500 hover:shadow-2xl hover:shadow-orange-500/10 transition-all text-left group relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500" />
            <div className="relative z-10">
              <div className="w-16 h-16 bg-orange-500/10 rounded-2xl flex items-center justify-center text-orange-600 mb-6 group-hover:scale-110 transition-transform shadow-sm">
                <Receipt className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-normal text-neutral-900 dark:text-white mb-3 tracking-tight">Phiếu Thu - Phiếu Chi</h3>
              <p className="text-neutral-500 dark:text-slate-400 leading-relaxed font-normal text-sm">Tự động tạo và in hàng loạt phiếu thu, phiếu chi tiền mặt chuyên nghiệp.</p>
              <div className="mt-6 flex items-center text-orange-600 font-normal text-xs uppercase tracking-widest">
                Tạo chứng từ <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </button>
        </div>
      </motion.div>
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
            margin: { top: 1134, bottom: 567, left: 1531, right: 1134 }
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
                          new TextRun({ text: config.taxCode || businessInfo.taxId || "................", size: 24 }),
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
                  new Paragraph({
                    children: [
                      new TextRun({ text: "Mã số thuế: ", bold: true, size: 20 }),
                      new TextRun({ text: config.taxCode || businessInfo.taxId || "................", size: 20 }),
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
                  new Paragraph({
                    children: [
                      new TextRun({ text: "Mã số thuế: ", bold: true, size: 20 }),
                      new TextRun({ text: config.taxCode || businessInfo.taxId || "................", size: 20 }),
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
    <div className="space-y-8">
      {renderSubNav()}
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-bold text-neutral-900 dark:text-white tracking-tight">Quản lý Tài chính</h2>
          <p className="text-neutral-500 dark:text-slate-400 mt-1">
            {activeSubTab === 'finance-config' && 'Cấu hình báo cáo và tải nội dung thu chi.'}
            {activeSubTab === 'finance-ledger' && 'Xuất sổ doanh thu bán hàng hóa, dịch vụ.'}
            {activeSubTab === 'finance-vouchers' && 'Xuất phiếu thu, phiếu chi theo mẫu.'}
          </p>
        </div>
        <div className="flex bg-neutral-100 dark:bg-slate-800/50 p-1.5 rounded-2xl self-start lg:self-center shadow-inner">
          {subTabs.map((st) => (
            <button
              key={st.id}
              onClick={() => setActiveTab(st.id)}
              className={cn(
                "flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-sm font-bold transition-all",
                activeSubTab === st.id
                  ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
                  : "text-neutral-500 dark:text-slate-400 hover:text-neutral-900 dark:hover:text-white"
              )}
            >
              <st.icon className="w-4 h-4" />
              <span className="hidden md:inline">{st.label}</span>
            </button>
          ))}
        </div>
      </header>

      {activeSubTab === 'finance-config' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-neutral-200 dark:border-slate-800 shadow-sm">
            <h3 className="text-xl font-bold text-neutral-900 dark:text-white mb-8 flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <Settings className="w-5 h-5" />
              </div>
              Cấu hình báo cáo
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <div className="space-y-2">
                <label className="text-sm font-bold text-neutral-700 dark:text-slate-300 ml-1">Kì báo cáo (VD: Tháng 01/2026)</label>
                <input 
                  type="text" 
                  value={config.reportPeriod}
                  onChange={(e) => setConfig({ ...config, reportPeriod: e.target.value })}
                  className="w-full px-4 py-3 bg-neutral-50 dark:bg-slate-800/50 border border-neutral-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white transition-all"
                  placeholder="Tháng 01/2026"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-neutral-700 dark:text-slate-300 ml-1">Ngày xuất phiếu thu</label>
                <input 
                  type="date" 
                  value={config.receiptDate}
                  onChange={(e) => setConfig({ ...config, receiptDate: e.target.value })}
                  className="w-full px-4 py-3 bg-neutral-50 dark:bg-slate-800/50 border border-neutral-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-neutral-700 dark:text-slate-300 ml-1">Ngày xuất phiếu chi</label>
                <input 
                  type="date" 
                  value={config.paymentDate}
                  onChange={(e) => setConfig({ ...config, paymentDate: e.target.value })}
                  className="w-full px-4 py-3 bg-neutral-50 dark:bg-slate-800/50 border border-neutral-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-neutral-700 dark:text-slate-300 ml-1">Người lập biểu</label>
                <input 
                  type="text" 
                  value={config.preparer}
                  onChange={(e) => setConfig({ ...config, preparer: e.target.value })}
                  className="w-full px-4 py-3 bg-neutral-50 dark:bg-slate-800/50 border border-neutral-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white transition-all"
                  placeholder="Họ và tên người lập biểu"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-neutral-700 dark:text-slate-300 ml-1">Thủ quỹ</label>
                <input 
                  type="text" 
                  value={config.treasurer}
                  onChange={(e) => setConfig({ ...config, treasurer: e.target.value })}
                  className="w-full px-4 py-3 bg-neutral-50 dark:bg-slate-800/50 border border-neutral-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white transition-all"
                  placeholder="Họ và tên thủ quỹ"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-neutral-700 dark:text-slate-300 ml-1">Mã số thuế</label>
                <input 
                  type="text" 
                  value={config.taxCode}
                  onChange={(e) => setConfig({ ...config, taxCode: e.target.value })}
                  className="w-full px-4 py-3 bg-neutral-50 dark:bg-slate-800/50 border border-neutral-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white transition-all"
                  placeholder="Nhập mã số thuế"
                />
              </div>
            </div>
            <div className="mt-8 flex justify-end pt-6 border-t border-neutral-100 dark:border-slate-800">
              <button 
                onClick={() => {
                  if (!config.reportPeriod || !config.receiptDate || !config.paymentDate || !config.preparer || !config.treasurer || !config.taxCode) {
                    alert("Vui lòng điền đầy đủ thông tin cấu hình.");
                    return;
                  }
                  setIsConfigSaved(true);
                  alert("Đã lưu cấu hình báo cáo!");
                }}
                className="flex items-center gap-2 px-8 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none font-bold"
              >
                <Save className="w-4 h-4" /> Lưu cấu hình
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {activeSubTab === 'finance-config' && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-neutral-200 dark:border-slate-800 shadow-sm group">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-xl font-bold text-neutral-900 dark:text-white flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                      <PieChart className="w-5 h-5" />
                    </div>
                    Nội dung thu
                  </h3>
                  <p className="text-sm text-neutral-500 dark:text-slate-400 mt-2 leading-relaxed">Tải lên bảng chấm công và thu tiền để đồng bộ dữ liệu doanh thu.</p>
                </div>
                <button 
                  onClick={downloadIncomeTemplate}
                  className="p-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-xl transition-all"
                  title="Tải file mẫu"
                >
                  <Download className="w-5 h-5" />
                </button>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <label className="flex-1 flex items-center justify-center gap-3 px-6 py-4 border-2 border-dashed border-neutral-200 dark:border-slate-700 rounded-2xl hover:border-emerald-500 dark:hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 transition-all cursor-pointer group/label">
                  <Upload className="w-5 h-5 text-neutral-400 group-hover/label:text-emerald-600 dark:group-hover/label:text-emerald-400" />
                  <span className="text-sm font-bold text-neutral-600 dark:text-slate-300 group-hover/label:text-emerald-700 dark:group-hover/label:text-emerald-400">Tải lên file Excel</span>
                  <input type="file" accept=".xlsx, .xls" onChange={handleIncomeUpload} className="hidden" />
                </label>
                <ConfirmButton
                  onConfirm={() => setIncomeData([])}
                  className="px-6 py-4 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900/30 rounded-2xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-all font-bold text-sm"
                  icon={Trash2}
                >
                  Xóa dữ liệu
                </ConfirmButton>
              </div>
              {incomeData.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mt-6 p-4 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-2xl text-sm font-bold flex items-center gap-3"
                >
                  <div className="w-6 h-6 bg-emerald-100 dark:bg-emerald-800/50 rounded-full flex items-center justify-center">
                    <Check className="w-4 h-4" />
                  </div>
                  Đã tải {incomeData.length} mục thu tiền học phí.
                </motion.div>
              )}
            </div>

            <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-neutral-200 dark:border-slate-800 shadow-sm group">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-xl font-bold text-neutral-900 dark:text-white flex items-center gap-3">
                    <div className="w-10 h-10 bg-orange-50 dark:bg-orange-900/30 rounded-xl flex items-center justify-center text-orange-600 dark:text-orange-400">
                      <PieChart className="w-5 h-5" />
                    </div>
                    Nội dung chi
                  </h3>
                  <p className="text-sm text-neutral-500 dark:text-slate-400 mt-2 leading-relaxed">Tải lên danh sách các khoản chi phí vận hành để đồng bộ dữ liệu.</p>
                </div>
                <button 
                  onClick={downloadExpenseTemplate}
                  className="p-2 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-xl transition-all"
                  title="Tải file mẫu"
                >
                  <Download className="w-5 h-5" />
                </button>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <label className="flex-1 flex items-center justify-center gap-3 px-6 py-4 border-2 border-dashed border-neutral-200 dark:border-slate-700 rounded-2xl hover:border-orange-500 dark:hover:border-orange-500 hover:bg-orange-50/50 dark:hover:bg-orange-900/10 transition-all cursor-pointer group/label">
                  <Upload className="w-5 h-5 text-neutral-400 group-hover/label:text-orange-600 dark:group-hover/label:text-orange-400" />
                  <span className="text-sm font-bold text-neutral-600 dark:text-slate-300 group-hover/label:text-orange-700 dark:group-hover/label:text-orange-400">Tải lên file Excel</span>
                  <input type="file" accept=".xlsx, .xls" onChange={handleExpenseUpload} className="hidden" />
                </label>
                <ConfirmButton
                  onConfirm={() => setExpenseData([])}
                  className="px-6 py-4 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900/30 rounded-2xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-all font-bold text-sm"
                  icon={Trash2}
                >
                  Xóa dữ liệu
                </ConfirmButton>
              </div>
              {expenseData.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mt-6 p-4 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 rounded-2xl text-sm font-bold flex items-center gap-3"
                >
                  <div className="w-6 h-6 bg-orange-100 dark:bg-orange-800/50 rounded-full flex items-center justify-center">
                    <Check className="w-4 h-4" />
                  </div>
                  Đã tải {expenseData.length} mục chi phí vận hành.
                </motion.div>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-neutral-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="p-6 border-b border-neutral-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4 bg-neutral-50/50 dark:bg-slate-800/30">
              <div>
                <h3 className="font-bold text-neutral-900 dark:text-white text-lg">Danh sách Thu - Chi chi tiết</h3>
                <p className="text-xs text-neutral-500 dark:text-slate-400 mt-1 font-medium">Tổng số: {incomeData.length + expenseData.length} bản ghi</p>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={syncData}
                  disabled={isSyncing}
                  className="flex items-center gap-2.5 px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none font-bold text-sm disabled:opacity-50"
                >
                  <RefreshCw className={cn("w-4 h-4", isSyncing && "animate-spin")} /> 
                  {isSyncing ? "Đang đồng bộ..." : "Đồng bộ dữ liệu"}
                </button>
              </div>
            </div>
            <div className="overflow-x-auto max-h-[500px] custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-white dark:bg-slate-900 shadow-sm z-10">
                  <tr className="bg-neutral-50 dark:bg-slate-800/50 border-b border-neutral-200 dark:border-slate-800">
                    <th className="px-6 py-4 text-[11px] font-bold text-neutral-500 dark:text-slate-400 uppercase tracking-wider w-16 text-center">STT</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-neutral-500 dark:text-slate-400 uppercase tracking-wider">Họ và tên / Đối tác</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-neutral-500 dark:text-slate-400 uppercase tracking-wider">Địa chỉ / Nội dung</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-neutral-500 dark:text-slate-400 uppercase tracking-wider">Phân loại</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-neutral-500 dark:text-slate-400 uppercase tracking-wider text-right">Số tiền (VNĐ)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-slate-800">
                  {incomeData.map((item) => (
                    <tr key={`income-${item.id}`} className="hover:bg-emerald-50/30 dark:hover:bg-emerald-900/10 transition-colors group">
                      <td className="px-6 py-4 text-sm text-neutral-500 dark:text-slate-400 text-center font-mono">{item.stt}</td>
                      <td className="px-6 py-4">
                        <span className="font-bold text-neutral-900 dark:text-white">{item.name}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-neutral-600 dark:text-slate-400">
                        {item.address}
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold uppercase tracking-wider">
                          Thu học phí
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-neutral-900 dark:text-white text-right font-bold font-mono">
                        {item.amount.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  {expenseData.map((item) => (
                    <tr key={`expense-${item.id}`} className="hover:bg-orange-50/30 dark:hover:bg-orange-900/10 transition-colors group">
                      <td className="px-6 py-4 text-sm text-neutral-500 dark:text-slate-400 text-center font-mono">{item.stt}</td>
                      <td className="px-6 py-4">
                        <span className="font-bold text-neutral-900 dark:text-white">{item.name}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-neutral-600 dark:text-slate-400">
                        {item.content || item.address}
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 rounded-lg bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 text-[10px] font-bold uppercase tracking-wider">
                          Chi phí
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-neutral-900 dark:text-white text-right font-bold font-mono">
                        {item.amount.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  {incomeData.length === 0 && expenseData.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-20 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-16 h-16 bg-neutral-50 dark:bg-slate-800 rounded-full flex items-center justify-center text-neutral-300 dark:text-slate-600">
                            <FileSpreadsheet className="w-8 h-8" />
                          </div>
                          <p className="text-neutral-500 dark:text-slate-400 font-medium">Chưa có dữ liệu thu chi. Vui lòng tải file Excel lên để bắt đầu.</p>
                        </div>
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
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="space-y-8"
        >
          {renderSubNav()}
          <div className="bg-white dark:bg-slate-900 p-12 rounded-[2.5rem] border border-neutral-200 dark:border-slate-800 text-center space-y-8 shadow-sm">
            <div className="w-24 h-24 bg-indigo-50 dark:bg-indigo-900/30 rounded-3xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 mx-auto shadow-inner">
              <FileSpreadsheet className="w-10 h-10" />
            </div>
            <div className="max-w-xl mx-auto space-y-3">
              <h3 className="text-2xl font-bold text-neutral-900 dark:text-white">Xuất Sổ chi tiết doanh thu</h3>
              <p className="text-neutral-500 dark:text-slate-400 text-lg leading-relaxed">
                Hệ thống sẽ tự động tổng hợp dữ liệu từ các file Excel đã tải lên để tạo Sổ doanh thu (Mẫu S1a-HKD) theo đúng quy định của Bộ Tài chính.
              </p>
            </div>
            <div className="pt-4">
              <button
                onClick={exportS1aHKD}
                className="inline-flex items-center gap-3 px-10 py-4 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 dark:shadow-none font-bold text-lg group"
              >
                <Download className="w-6 h-6 group-hover:translate-y-0.5 transition-transform" /> 
                Tải xuống Sổ doanh thu (.docx)
              </button>
            </div>
            <div className="text-xs text-neutral-400 dark:text-slate-500 font-medium">
              Định dạng Word (.docx) - Tương thích với Microsoft Word và Google Docs
            </div>
          </div>
        </motion.div>
      )}

      {activeSubTab === 'finance-vouchers' && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="space-y-8"
        >
          {renderSubNav()}
          <div className="bg-white dark:bg-slate-900 p-12 rounded-[2.5rem] border border-neutral-200 dark:border-slate-800 text-center space-y-8 shadow-sm">
            <div className="w-24 h-24 bg-emerald-50 dark:bg-emerald-900/30 rounded-3xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 mx-auto shadow-inner">
              <FileText className="w-10 h-10" />
            </div>
            <div className="max-w-xl mx-auto space-y-3">
              <h3 className="text-2xl font-bold text-neutral-900 dark:text-white">Xuất Phiếu thu & Phiếu chi</h3>
              <p className="text-neutral-500 dark:text-slate-400 text-lg leading-relaxed">
                Tạo hàng loạt phiếu thu và phiếu chi tiền mặt từ danh sách dữ liệu. Mỗi trang Word sẽ chứa 2 phiếu để tiết kiệm giấy in.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-6 pt-4">
              <button
                onClick={exportAllVouchers}
                className="inline-flex items-center gap-3 px-10 py-4 bg-emerald-600 text-white rounded-2xl hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-200 dark:shadow-none font-bold text-lg group"
              >
                <Download className="w-6 h-6 group-hover:translate-y-0.5 transition-transform" /> 
                Xuất toàn bộ phiếu (.docx)
              </button>
            </div>
            <div className="text-xs text-neutral-400 dark:text-slate-500 font-medium">
              Hỗ trợ in ấn hàng loạt - Tự động đánh số chứng từ
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
