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
  X,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Receipt,
  LogOut,
  Info,
  Lock,
  Key,
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
  RotateCcw,
  Eye,
  EyeOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { AI_OBJECTIVES, SUBJECT_AI_INTEGRATION, NLS_MAPPING } from './constants/aiObjectives';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2pdf from 'html2pdf.js';
import { Document, Packer, Paragraph, Table, TableRow, TableCell, WidthType, AlignmentType, HeadingLevel, TextRun, VerticalAlign, BorderStyle, PageBreak, ImageRun } from 'docx';
import { saveAs } from 'file-saver';
import { format, startOfWeek, endOfWeek, addDays, parseISO } from 'date-fns';
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
import Sidebar from './components/Sidebar';
import Logo from './components/Logo';

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

const sanitizeDocxText = (text: any): string => {
  if (text === null || text === undefined) return "";
  const str = String(text);
  // Remove control characters that are invalid in XML 1.0 (Word document.xml)
  // Valid: #x9 | #xA | #xD | [#x20-#xD7FF] | [#xE000-#xFFFD] | [#x10000-#x10FFFF]
  return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x84\x86-\x9F\uFDD0-\uFDEF\uFFFE\uFFFF]/g, "");
};

/**
 * Splits HTML content into chunks of roughly maxChars length, trying to split at paragraph or section boundaries.
 */
const splitHtmlContent = (html: string, maxChars: number = 20000): string[] => {
  if (html.length <= maxChars) return [html];
  
  const chunks: string[] = [];
  let currentHtml = html;
  
  while (currentHtml.length > 0) {
    if (currentHtml.length <= maxChars) {
      chunks.push(currentHtml);
      break;
    }
    
    // Try to find a good split point (closing tag of p, div, li, h1-6)
    let splitPoint = -1;
    const searchString = currentHtml.substring(0, maxChars + 1000); // Look slightly ahead for a boundary
    const regex = /<\/(p|div|li|h[1-6]|tr|section)>/g;
    let match;
    while ((match = regex.exec(searchString)) !== null) {
      if (match.index + match[0].length <= maxChars + 1000) {
        splitPoint = match.index + match[0].length;
        if (splitPoint > maxChars) break; // If we passed maxChars, this is our best point
      }
    }
    
    if (splitPoint === -1) {
      // Fallback: split at nearest space or just force split at maxChars
      splitPoint = currentHtml.lastIndexOf(' ', maxChars);
      if (splitPoint === -1) splitPoint = maxChars;
    }
    
    chunks.push(currentHtml.substring(0, splitPoint));
    currentHtml = currentHtml.substring(splitPoint).trim();
  }
  
  return chunks;
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

const getBaseGrade = (cls: string) => {
  const match = cls.match(/^\d+/);
  return match ? match[0] : cls;
};

const ALL_CLASSES = [
  '6', '6A1', '6A2', '6A3',
  '7', '7A1', '7A2', '7A3',
  '8', '8A1', '8A2', '8A3',
  '9', '9A1', '9A2', '9A3',
  '10', '11', '12'
];

const DEFAULT_CLASSES: ClassSubject[] = [
  // Lớp 6
  { id: 'c6-1', grade: '6', subject: 'Toán', subSubject: 'Số học' },
  { id: 'c6-2', grade: '6', subject: 'Toán', subSubject: 'Đại số' },
  { id: 'c6-3', grade: '6', subject: 'Toán', subSubject: 'Hình học' },
  { id: 'c6-4', grade: '6', subject: 'Ngữ văn', subSubject: '' },
  { id: 'c6-7', grade: '6', subject: 'Khoa học tự nhiên', subSubject: 'Hóa học' },
  { id: 'c6-8', grade: '6', subject: 'Khoa học tự nhiên', subSubject: 'Sinh học' },

  // Lớp 7
  { id: 'c7-1', grade: '7', subject: 'Toán', subSubject: 'Số học' },
  { id: 'c7-2', grade: '7', subject: 'Toán', subSubject: 'Đại số' },
  { id: 'c7-3', grade: '7', subject: 'Toán', subSubject: 'Hình học' },
  { id: 'c7-4', grade: '7', subject: 'Ngữ văn', subSubject: '' },
  { id: 'c7-7', grade: '7', subject: 'Khoa học tự nhiên', subSubject: 'Hóa học' },
  { id: 'c7-8', grade: '7', subject: 'Khoa học tự nhiên', subSubject: 'Sinh học' },

  // Lớp 8
  { id: 'c8-1', grade: '8', subject: 'Toán', subSubject: 'Số học' },
  { id: 'c8-2', grade: '8', subject: 'Toán', subSubject: 'Đại số' },
  { id: 'c8-3', grade: '8', subject: 'Toán', subSubject: 'Hình học' },
  { id: 'c8-4', grade: '8', subject: 'Ngữ văn', subSubject: '' },
  { id: 'c8-7', grade: '8', subject: 'Khoa học tự nhiên', subSubject: 'Hóa học' },
  { id: 'c8-8', grade: '8', subject: 'Khoa học tự nhiên', subSubject: 'Sinh học' },

  // Lớp 9
  { id: 'c9-1', grade: '9', subject: 'Toán', subSubject: 'Số học' },
  { id: 'c9-2', grade: '9', subject: 'Toán', subSubject: 'Đại số' },
  { id: 'c9-3', grade: '9', subject: 'Toán', subSubject: 'Hình học' },
  { id: 'c9-4', grade: '9', subject: 'Ngữ văn', subSubject: '' },
  { id: 'c9-7', grade: '9', subject: 'Khoa học tự nhiên', subSubject: 'Hóa học' },
  { id: 'c9-8', grade: '9', subject: 'Khoa học tự nhiên', subSubject: 'Sinh học' },
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
  maxDevices?: number;
  taxCode?: string;
  businessName?: string;
  businessAddress?: string;
  businessOwner?: string;
  businessLocation?: string;
  createdAt: string;
}

const SYNC_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbynIT2ZNiXJvmOB3LUi9YisDYS2Crin7G0skh-cDseNNIGXfy4PK3MMMcD0lYVhMSke/exec';

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

  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [users, setUsers] = useState<UserAccount[]>(() => {
    const saved = localStorage.getItem(USERS_KEY);
    const admins: UserAccount[] = [
      {
        id: 'admin-1',
        email: 'cosogiaoduchoanggia269@gmail.com',
        password: '123456@',
        role: 'admin',
        createdAt: new Date().toISOString()
      },
      {
        id: 'admin-2',
        email: '0366000555',
        password: '123456@',
        role: 'admin',
        createdAt: new Date().toISOString()
      }
    ];

    if (saved) {
      let parsed: UserAccount[] = JSON.parse(saved);
      
      // Ensure all hardcoded admins are present and updated
      admins.forEach(admin => {
        const index = parsed.findIndex(u => u.email.toLowerCase() === admin.email.toLowerCase());
        if (index === -1) {
          parsed.push(admin);
        } else {
          parsed[index] = { ...parsed[index], password: admin.password, role: 'admin' };
        }
      });

      return parsed;
    }
    return admins;
  });

  const [activeTab, setActiveTab] = useState('dashboard');
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [businessInfo, setBusinessInfo] = useState<BusinessInfo>({
    name: 'CƠ SỞ GIÁO DỤC HOÀNG GIA',
    address: 'SN 269 Lê Duẩn - P. Tân Phong - T. Lai Châu',
    taxId: '034150007741',
    owner: 'Hoàng Thị Mơ',
    businessLocation: 'Lai Châu'
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
  const [aiLessonPlans, setAiLessonPlans] = useState<{ nls: string, ai: string } | null>(null);
  const [currentPlan, setCurrentPlan] = useState<LessonPlan | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Merge account-level business info with global info for exports
  const effectiveBusinessInfo = React.useMemo(() => {
    // Fixed values for Royal Education center
    const fixedInfo: BusinessInfo = {
      name: 'CƠ SỞ GIÁO DỤC HOÀNG GIA',
      address: 'SN 269 Lê Duẩn - P. Tân Phong - T. Lai Châu',
      taxId: '034150007741',
      owner: 'Hoàng Thị Mơ',
      businessLocation: 'Lai Châu'
    };

    if (currentUser?.role === 'admin') return fixedInfo;
    
    return {
      name: currentUser?.businessName || fixedInfo.name,
      owner: currentUser?.businessOwner || fixedInfo.owner,
      taxId: currentUser?.taxCode || fixedInfo.taxId,
      address: currentUser?.businessAddress || fixedInfo.address,
      businessLocation: currentUser?.businessLocation || fixedInfo.businessLocation
    };
  }, [currentUser]);

  // Menu Order state
  const [menuOrder, setMenuOrder] = useState<string[]>(() => {
    const saved = localStorage.getItem('MENU_ORDER');
    return saved ? JSON.parse(saved) : [
      'dashboard', 
      'ai_lesson_plan', 
      'teacher_lesson_plan', 
      'business', 
      'students_group', 
      'program', 
      'finance_group'
    ];
  });

  useEffect(() => {
    localStorage.setItem('MENU_ORDER', JSON.stringify(menuOrder));
  }, [menuOrder]);

  // Synchronization logic
  const syncToGoogleSheets = async (action: 'sync_users' | 'sync_business', payload: any) => {
    setIsSyncing(true);
    try {
      await fetch(SYNC_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload })
      });
      console.log(`Sync ${action} success`);
    } catch (error) {
      console.error(`Sync ${action} failed`, error);
    } finally {
      setIsSyncing(false);
    }
  };

  const fetchFromGoogleSheets = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch(`${SYNC_SCRIPT_URL}?action=fetch_data`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (data.users && data.users.length > 0) {
        // Map users from sheet back to UserAccount interface
        const newUsers = data.users.map((u: any) => ({
          ...u,
          id: u.id || `user-${Date.now()}-${Math.random()}`,
          role: u.role || 'user',
          maxDevices: parseInt(u.maxDevices) || 1
        }));
        setUsers(newUsers);
      }
      if (data.businessInfo) {
        setBusinessInfo(prev => ({
          ...prev,
          name: data.businessInfo.name || prev.name,
          owner: data.businessInfo.owner || prev.owner,
          taxId: data.businessInfo.taxId || prev.taxId,
          address: data.businessInfo.address || prev.address,
          businessLocation: data.businessInfo.businessLocation || prev.businessLocation
        }));
      }
      alert('Tải dữ liệu từ Google Sheet thành công!');
    } catch (error) {
      console.error("Fetch from Google Sheets failed:", error);
      alert(`Tải dữ liệu thất bại: ${error instanceof Error ? error.message : 'Lỗi mạng hoặc script không phản hồi'}`);
    } finally {
      setIsSyncing(false);
    }
  };

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
      // Reset other states
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
        
        if (data.students) setStudents(data.students);
        if (data.incomeData) setIncomeData(data.incomeData);
        if (data.expenseData) setExpenseData(data.expenseData);
        if (data.lessonPlans) setLessonPlans(data.lessonPlans);
        if (data.financialConfig) setFinancialConfig(data.financialConfig);
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
      expenseData
    };
    localStorage.setItem(userStorageKey, JSON.stringify(data));
  }, [currentUser?.id, businessInfo, classes, ppctData, lessonPlans, students, financialConfig, incomeData, expenseData, isDataLoaded]);

  // Save users to localStorage (global)
  useEffect(() => {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    
    // Ensure default admins are always present and updated
    const hardcodedAdmins = [
      { email: 'cosogiaoduchoanggia269@gmail.com', password: '123456@' },
      { email: '0366000555', password: '123456@' }
    ];

    let needsUpdate = false;
    const updatedUsers = users.map(u => {
      const hardcoded = hardcodedAdmins.find(ha => ha.email.toLowerCase() === u.email.toLowerCase());
      if (hardcoded && (u.password !== hardcoded.password || u.role !== 'admin')) {
        needsUpdate = true;
        return { ...u, password: hardcoded.password, role: 'admin' };
      }
      return u;
    });

    // Check if any admin is missing completely
    hardcodedAdmins.forEach(ha => {
      if (!users.find(u => u.email.toLowerCase() === ha.email.toLowerCase())) {
        needsUpdate = true;
        updatedUsers.push({
          id: `admin-${ha.email}`,
          email: ha.email,
          password: ha.password,
          role: 'admin',
          createdAt: new Date().toISOString()
        });
      }
    });

    if (needsUpdate) {
      setUsers(updatedUsers);
    }
  }, [users]);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.log('--- HỆ THỐNG QUẢN LÝ CƠ SỞ DẠY THÊM HOÀNG GIA ---');
      console.log('Tài khoản quản trị mặc định:');
      console.log('Email:', 'cosogiaoduchoanggia269@gmail.com');
      console.log('Mật khẩu:', '123456@');
      console.log('--------------------------------------------------');
    }
  }, []);

  // Sync currentUser with users array to get latest updates (like business info)
  useEffect(() => {
    if (currentUser) {
      const latestUser = users.find(u => u.id === currentUser.id);
      if (latestUser && JSON.stringify(latestUser) !== JSON.stringify(currentUser)) {
        setCurrentUser(latestUser);
      }
    }
  }, [users, currentUser?.id]);

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
            currentUser={currentUser}
          />
        );
      case 'ai_lesson_plan':
        return <AILessonPlanSection classes={classes} currentUser={currentUser} />;
      case 'teacher_lesson_plan':
        return <TeacherLessonPlanSection currentUser={currentUser} />;
      case 'business':
        return (
          <BusinessConfigSection 
            info={businessInfo} 
            setInfo={setBusinessInfo} 
            setActiveTab={setActiveTab} 
            currentUser={currentUser} 
            onSync={(info) => syncToGoogleSheets('sync_business', { info })}
          />
        );
      case 'menu_settings':
        return currentUser?.role === 'admin' ? (
          <MenuSettingsSection 
            menuOrder={menuOrder} 
            setMenuOrder={setMenuOrder} 
          />
        ) : null;
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
            businessInfo={effectiveBusinessInfo}
            activeSubTab={activeTab}
            setActiveTab={setActiveTab}
            currentUser={currentUser}
          />
        );
      case 'students_group':
      case 'students-list':
      case 'students-export':
        return (
          <StudentManagementSection 
            students={students}
            setStudents={setStudents}
            businessInfo={effectiveBusinessInfo}
            activeSubTab={activeTab}
            setActiveTab={setActiveTab}
            currentUser={currentUser}
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
            businessInfo={effectiveBusinessInfo}
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
            onSync={(updatedUsers) => syncToGoogleSheets('sync_users', { users: updatedUsers })}
            onFetch={fetchFromGoogleSheets}
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
    <div className="flex h-screen bg-bg-light dark:bg-bg-dark font-sans text-neutral-900 dark:text-slate-100 overflow-hidden transition-colors duration-300">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        currentUser={currentUser} 
        onLogout={handleLogout}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        menuOrder={menuOrder}
      />
      
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          currentUser={currentUser} 
          onLogout={handleLogout}
          onMenuToggle={() => setIsSidebarOpen(true)}
        />
        
        {/* Welcome Modal */}
        <AnimatePresence>
          {showWelcomeModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 lg:p-12 border border-neutral-200 dark:border-slate-800 relative custom-scrollbar"
              >
                <div className="sticky top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 via-green-500 to-orange-500 -mt-6 lg:-mt-12 mb-6 lg:mb-8 z-10" />
                
                <div className="text-center space-y-6">
                  <div className="w-16 h-16 lg:w-24 lg:h-24 bg-white dark:bg-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-4 lg:mb-6 shadow-xl shadow-primary/20 relative p-3 border border-neutral-100 dark:border-slate-800">
                    <Logo className="w-full h-full" />
                  </div>
                  
                  <h2 className="text-xl lg:text-3xl font-black text-neutral-900 dark:text-white leading-tight tracking-tight uppercase">
                    Chào mừng Quý Thầy Cô đến với <span className="text-primary">HOÀNG GIA</span>
                  </h2>
                  <p className="text-primary font-black text-sm lg:text-lg uppercase tracking-[0.2em]">{currentUser?.email}</p>
                  
                  <div className="text-neutral-600 dark:text-slate-400 leading-relaxed text-sm lg:text-lg font-medium text-justify lg:text-center px-2">
                    Hệ thống được thiết kế tối ưu dành riêng cho các thầy cô và trung tâm dạy thêm. Bao gồm các chương trình: 
                    <span className="text-blue-600 dark:text-blue-400 font-bold mx-1">Quản lý học sinh</span>, 
                    <span className="text-green-600 dark:text-green-400 font-bold mx-1">Quản lý chương trình dạy</span>, 
                    <span className="text-orange-600 dark:text-orange-400 font-bold mx-1">Quản lý tài chính</span>,
                    <span className="text-purple-600 dark:text-purple-400 font-bold mx-1">Tạo giáo án tích hợp AI và NLS</span>,
                    <span className="text-indigo-600 dark:text-indigo-400 font-bold mx-1">Tạo KHBD cho Trung tâm dạy thêm</span>. 
                    Chúng tôi cung cấp các công cụ mạnh mẽ để quản lý học sinh, chương trình giảng dạy, tài chính và hỗ trợ soạn giảng thông minh, giúp Quý Thầy Cô tập trung hoàn toàn vào sứ mệnh truyền đạt tri thức.
                  </div>

                  <div className="pt-4 lg:pt-8 pb-4">
                    <button
                      onClick={() => setShowWelcomeModal(false)}
                      className="w-full sm:w-auto px-10 py-4 bg-primary text-white rounded-2xl font-black text-base lg:text-lg hover:bg-primary-hover transition-all shadow-xl shadow-primary/20 active:scale-95 uppercase tracking-widest flex items-center justify-center gap-3 mx-auto"
                    >
                      <Sparkles className="w-5 h-5" />
                      Bắt đầu làm việc
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8 custom-scrollbar">
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
  reportPeriod,
  currentUser
}: { 
  studentCount: number, 
  classCount: number, 
  monthlyRevenue: number,
  reportPeriod: string,
  currentUser: UserAccount | null
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
        className="saas-card bg-gradient-to-br from-white to-neutral-50 dark:from-slate-900 dark:to-slate-800 border-l-4 border-l-primary overflow-hidden"
      >
        <div className="flex flex-col md:flex-row items-start gap-6 p-6 lg:p-8">
          <div className="w-16 h-16 lg:w-20 lg:h-20 bg-white dark:bg-slate-900 rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-primary/10 p-3 border border-neutral-100 dark:border-slate-800">
            <Logo className="w-full h-full" />
          </div>
          <div className="space-y-4 flex-1">
            <h2 className="text-xl lg:text-2xl font-black text-neutral-900 dark:text-white leading-tight uppercase tracking-tight">
              Chào mừng Quý Thầy Cô đến với <span className="text-primary">HOÀNG GIA</span>
            </h2>
            <p className="text-neutral-600 dark:text-slate-300 text-sm lg:text-lg leading-relaxed text-justify">
              Hệ thống được thiết kế tối ưu dành riêng cho các thầy cô và trung tâm dạy thêm. Bao gồm các chương trình: 
              <span className="text-blue-600 dark:text-blue-400 font-bold mx-1">Quản lý học sinh</span>, 
              <span className="text-emerald-600 dark:text-emerald-400 font-bold mx-1">Quản lý chương trình dạy</span>, 
              <span className="text-orange-600 dark:text-orange-400 font-bold mx-1">Quản lý tài chính</span>,
              <span className="text-purple-600 dark:text-purple-400 font-bold mx-1">Tạo giáo án tích hợp AI và NLS</span>,
              <span className="text-indigo-600 dark:text-indigo-400 font-bold mx-1">Tạo KHBD cho Trung tâm dạy thêm</span>. 
              Chúng tôi cung cấp các công cụ mạnh mẽ để quản lý học sinh, chương trình giảng dạy, tài chính và hỗ trợ soạn giảng thông minh, giúp Quý Thầy Cô tập trung hoàn toàn vào sứ mệnh truyền đạt tri thức.
            </p>
            <div className="pt-2">
              <button 
                onClick={() => window.scrollTo({ top: 400, behavior: 'smooth' })}
                className="px-6 py-2.5 bg-primary/10 dark:bg-primary/20 text-primary rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-primary hover:text-white transition-all"
              >
                Khám phá ngay
              </button>
            </div>
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

      <div className="mt-20 space-y-32">
      </div>
    </div>
  );
}

function VerticalImageGallery({ title }: { title: string }) {
  const images = [
    `https://picsum.photos/seed/${title}-1/1200/600`,
    `https://picsum.photos/seed/${title}-2/1200/600`,
    `https://picsum.photos/seed/${title}-3/1200/600`,
    `https://picsum.photos/seed/${title}-4/1200/600`,
  ];

  return (
    <div className="mt-16 space-y-12">
      <div className="flex items-center gap-6 mb-8">
        <div className="h-px flex-1 bg-neutral-200 dark:bg-slate-800" />
        <h3 className="text-xs font-black text-neutral-400 dark:text-slate-500 uppercase tracking-[0.3em] text-center">
          Hình ảnh minh họa hệ thống: {title}
        </h3>
        <div className="h-px flex-1 bg-neutral-200 dark:bg-slate-800" />
      </div>
      <div className="grid grid-cols-1 gap-12">
        {images.map((src, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, delay: idx * 0.1 }}
            className="saas-card p-0 overflow-hidden group border-none shadow-2xl shadow-black/5 dark:shadow-primary/5"
          >
            <div className="aspect-[21/9] relative overflow-hidden">
              <img 
                src={src} 
                alt={`${title} ${idx + 1}`}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity duration-500" />
              <div className="absolute inset-0 flex flex-col justify-end p-8 lg:p-12 transform translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                <div className="space-y-2">
                  <span className="inline-block px-3 py-1 bg-primary text-white text-[10px] font-black uppercase tracking-widest rounded-full mb-2">
                    Tính năng {idx + 1}
                  </span>
                  <h4 className="text-2xl lg:text-3xl font-black text-white tracking-tight">
                    {title} - Giao diện chuyên nghiệp {idx + 1}
                  </h4>
                  <p className="text-white/70 text-sm lg:text-base max-w-2xl font-medium leading-relaxed">
                    Hệ thống quản lý HOÀNG GIA cung cấp trải nghiệm người dùng tối ưu, giúp Quý Thầy Cô dễ dàng thao tác và quản lý dữ liệu một cách khoa học, minh bạch và hiệu quả nhất.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

const CURRICULUM_2018_DATA: Record<string, { subject: string; subSubjects: string[] }[]> = {
  '1': [
    { subject: 'Tiếng Việt', subSubjects: [] },
    { subject: 'Toán', subSubjects: [] },
    { subject: 'Đạo đức', subSubjects: [] },
    { subject: 'Tự nhiên và Xã hội', subSubjects: [] },
    { subject: 'Giáo dục thể chất', subSubjects: [] },
    { subject: 'Âm nhạc', subSubjects: [] },
    { subject: 'Mỹ thuật', subSubjects: [] },
    { subject: 'Hoạt động trải nghiệm', subSubjects: [] },
  ],
  '2': [
    { subject: 'Tiếng Việt', subSubjects: [] },
    { subject: 'Toán', subSubjects: [] },
    { subject: 'Đạo đức', subSubjects: [] },
    { subject: 'Tự nhiên và Xã hội', subSubjects: [] },
    { subject: 'Giáo dục thể chất', subSubjects: [] },
    { subject: 'Âm nhạc', subSubjects: [] },
    { subject: 'Mỹ thuật', subSubjects: [] },
    { subject: 'Hoạt động trải nghiệm', subSubjects: [] },
  ],
  '3': [
    { subject: 'Tiếng Việt', subSubjects: [] },
    { subject: 'Toán', subSubjects: [] },
    { subject: 'Đạo đức', subSubjects: [] },
    { subject: 'Tự nhiên và Xã hội', subSubjects: [] },
    { subject: 'Giáo dục thể chất', subSubjects: [] },
    { subject: 'Âm nhạc', subSubjects: [] },
    { subject: 'Mỹ thuật', subSubjects: [] },
    { subject: 'Hoạt động trải nghiệm', subSubjects: [] },
    { subject: 'Tin học và Công nghệ', subSubjects: ['Tin học', 'Công nghệ'] },
    { subject: 'Ngoại ngữ 1', subSubjects: [] },
  ],
  '4': [
    { subject: 'Tiếng Việt', subSubjects: [] },
    { subject: 'Toán', subSubjects: [] },
    { subject: 'Đạo đức', subSubjects: [] },
    { subject: 'Lịch sử và Địa lí', subSubjects: [] },
    { subject: 'Khoa học', subSubjects: [] },
    { subject: 'Giáo dục thể chất', subSubjects: [] },
    { subject: 'Âm nhạc', subSubjects: [] },
    { subject: 'Mỹ thuật', subSubjects: [] },
    { subject: 'Hoạt động trải nghiệm', subSubjects: [] },
    { subject: 'Tin học và Công nghệ', subSubjects: ['Tin học', 'Công nghệ'] },
    { subject: 'Ngoại ngữ 1', subSubjects: [] },
  ],
  '5': [
    { subject: 'Tiếng Việt', subSubjects: [] },
    { subject: 'Toán', subSubjects: [] },
    { subject: 'Đạo đức', subSubjects: [] },
    { subject: 'Lịch sử và Địa lí', subSubjects: [] },
    { subject: 'Khoa học', subSubjects: [] },
    { subject: 'Giáo dục thể chất', subSubjects: [] },
    { subject: 'Âm nhạc', subSubjects: [] },
    { subject: 'Mỹ thuật', subSubjects: [] },
    { subject: 'Hoạt động trải nghiệm', subSubjects: [] },
    { subject: 'Tin học và Công nghệ', subSubjects: ['Tin học', 'Công nghệ'] },
    { subject: 'Ngoại ngữ 1', subSubjects: [] },
  ],
  '6': [
    { subject: 'Toán', subSubjects: ['Số học', 'Đại số', 'Hình học'] },
    { subject: 'Ngữ văn', subSubjects: [] },
    { subject: 'Tiếng Anh', subSubjects: [] },
    { subject: 'Khoa học tự nhiên', subSubjects: ['Vật lí', 'Hóa học', 'Sinh học'] },
    { subject: 'Lịch sử và Địa lí', subSubjects: ['Lịch sử', 'Địa lí'] },
    { subject: 'Giáo dục công dân', subSubjects: [] },
    { subject: 'Công nghệ', subSubjects: [] },
    { subject: 'Tin học', subSubjects: [] },
    { subject: 'Âm nhạc', subSubjects: [] },
    { subject: 'Mỹ thuật', subSubjects: [] },
    { subject: 'Hoạt động trải nghiệm, hướng nghiệp', subSubjects: [] },
    { subject: 'Giáo dục thể chất', subSubjects: [] },
    { subject: 'Nội dung giáo dục địa phương', subSubjects: [] },
  ],
  '7': [
    { subject: 'Toán', subSubjects: ['Số học', 'Đại số', 'Hình học'] },
    { subject: 'Ngữ văn', subSubjects: [] },
    { subject: 'Tiếng Anh', subSubjects: [] },
    { subject: 'Khoa học tự nhiên', subSubjects: ['Vật lí', 'Hóa học', 'Sinh học'] },
    { subject: 'Lịch sử và Địa lí', subSubjects: ['Lịch sử', 'Địa lí'] },
    { subject: 'Giáo dục công dân', subSubjects: [] },
    { subject: 'Công nghệ', subSubjects: [] },
    { subject: 'Tin học', subSubjects: [] },
    { subject: 'Âm nhạc', subSubjects: [] },
    { subject: 'Mỹ thuật', subSubjects: [] },
    { subject: 'Hoạt động trải nghiệm, hướng nghiệp', subSubjects: [] },
    { subject: 'Giáo dục thể chất', subSubjects: [] },
    { subject: 'Nội dung giáo dục địa phương', subSubjects: [] },
  ],
  '8': [
    { subject: 'Toán', subSubjects: ['Số học', 'Đại số', 'Hình học'] },
    { subject: 'Ngữ văn', subSubjects: [] },
    { subject: 'Tiếng Anh', subSubjects: [] },
    { subject: 'Khoa học tự nhiên', subSubjects: ['Vật lí', 'Hóa học', 'Sinh học'] },
    { subject: 'Lịch sử và Địa lí', subSubjects: ['Lịch sử', 'Địa lí'] },
    { subject: 'Giáo dục công dân', subSubjects: [] },
    { subject: 'Công nghệ', subSubjects: [] },
    { subject: 'Tin học', subSubjects: [] },
    { subject: 'Âm nhạc', subSubjects: [] },
    { subject: 'Mỹ thuật', subSubjects: [] },
    { subject: 'Hoạt động trải nghiệm, hướng nghiệp', subSubjects: [] },
    { subject: 'Giáo dục thể chất', subSubjects: [] },
    { subject: 'Nội dung giáo dục địa phương', subSubjects: [] },
  ],
  '9': [
    { subject: 'Toán', subSubjects: ['Số học', 'Đại số', 'Hình học'] },
    { subject: 'Ngữ văn', subSubjects: [] },
    { subject: 'Tiếng Anh', subSubjects: [] },
    { subject: 'Khoa học tự nhiên', subSubjects: ['Vật lí', 'Hóa học', 'Sinh học'] },
    { subject: 'Lịch sử và Địa lí', subSubjects: ['Lịch sử', 'Địa lí'] },
    { subject: 'Giáo dục công dân', subSubjects: [] },
    { subject: 'Công nghệ', subSubjects: [] },
    { subject: 'Tin học', subSubjects: [] },
    { subject: 'Âm nhạc', subSubjects: [] },
    { subject: 'Mỹ thuật', subSubjects: [] },
    { subject: 'Hoạt động trải nghiệm, hướng nghiệp', subSubjects: [] },
    { subject: 'Giáo dục thể chất', subSubjects: [] },
    { subject: 'Nội dung giáo dục địa phương', subSubjects: [] },
  ],
  '10': [
    { subject: 'Toán', subSubjects: [] },
    { subject: 'Ngữ văn', subSubjects: [] },
    { subject: 'Tiếng Anh', subSubjects: [] },
    { subject: 'Giáo dục thể chất', subSubjects: [] },
    { subject: 'Giáo dục quốc phòng và an ninh', subSubjects: [] },
    { subject: 'Hoạt động trải nghiệm, hướng nghiệp', subSubjects: [] },
    { subject: 'Nội dung giáo dục địa phương', subSubjects: [] },
    { subject: 'Lịch sử', subSubjects: [] },
    { subject: 'Địa lí', subSubjects: [] },
    { subject: 'Giáo dục kinh tế và pháp luật', subSubjects: [] },
    { subject: 'Vật lí', subSubjects: [] },
    { subject: 'Hóa học', subSubjects: [] },
    { subject: 'Sinh học', subSubjects: [] },
    { subject: 'Công nghệ', subSubjects: [] },
    { subject: 'Tin học', subSubjects: [] },
    { subject: 'Âm nhạc', subSubjects: [] },
    { subject: 'Mỹ thuật', subSubjects: [] },
  ],
  '11': [
    { subject: 'Toán', subSubjects: [] },
    { subject: 'Ngữ văn', subSubjects: [] },
    { subject: 'Tiếng Anh', subSubjects: [] },
    { subject: 'Giáo dục thể chất', subSubjects: [] },
    { subject: 'Giáo dục quốc phòng và an ninh', subSubjects: [] },
    { subject: 'Hoạt động trải nghiệm, hướng nghiệp', subSubjects: [] },
    { subject: 'Nội dung giáo dục địa phương', subSubjects: [] },
    { subject: 'Lịch sử', subSubjects: [] },
    { subject: 'Địa lí', subSubjects: [] },
    { subject: 'Giáo dục kinh tế và pháp luật', subSubjects: [] },
    { subject: 'Vật lí', subSubjects: [] },
    { subject: 'Hóa học', subSubjects: [] },
    { subject: 'Sinh học', subSubjects: [] },
    { subject: 'Công nghệ', subSubjects: [] },
    { subject: 'Tin học', subSubjects: [] },
    { subject: 'Âm nhạc', subSubjects: [] },
    { subject: 'Mỹ thuật', subSubjects: [] },
  ],
  '12': [
    { subject: 'Toán', subSubjects: [] },
    { subject: 'Ngữ văn', subSubjects: [] },
    { subject: 'Tiếng Anh', subSubjects: [] },
    { subject: 'Giáo dục thể chất', subSubjects: [] },
    { subject: 'Giáo dục quốc phòng và an ninh', subSubjects: [] },
    { subject: 'Hoạt động trải nghiệm, hướng nghiệp', subSubjects: [] },
    { subject: 'Nội dung giáo dục địa phương', subSubjects: [] },
    { subject: 'Lịch sử', subSubjects: [] },
    { subject: 'Địa lí', subSubjects: [] },
    { subject: 'Giáo dục kinh tế và pháp luật', subSubjects: [] },
    { subject: 'Vật lí', subSubjects: [] },
    { subject: 'Hóa học', subSubjects: [] },
    { subject: 'Sinh học', subSubjects: [] },
    { subject: 'Công nghệ', subSubjects: [] },
    { subject: 'Tin học', subSubjects: [] },
    { subject: 'Âm nhạc', subSubjects: [] },
    { subject: 'Mỹ thuật', subSubjects: [] },
  ],
};

function AILessonPlanSection({ classes, currentUser }: { classes: ClassSubject[], currentUser: UserAccount | null }) {
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedSubSubject, setSelectedSubSubject] = useState('');
  const [aiCompetency, setAiCompetency] = useState('');
  const [digitalCompetency, setDigitalCompetency] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isGenerating, setIsGenerating] = useState<{ ai: boolean, nls: boolean }>({ ai: false, nls: false });
  const [result, setResult] = useState<{ nls: string, ai: string } | null>(null);
  const [error, setError] = useState('');
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const subjects = useMemo(() => {
    if (!selectedClass) return [];
    const baseGrade = getBaseGrade(selectedClass);
    const data = CURRICULUM_2018_DATA[baseGrade] || [];
    return data.map(d => d.subject).sort();
  }, [selectedClass]);

  const subSubjects = useMemo(() => {
    if (!selectedClass || !selectedSubject) return [];
    const baseGrade = getBaseGrade(selectedClass);
    const data = CURRICULUM_2018_DATA[baseGrade] || [];
    const subjectData = data.find(d => d.subject === selectedSubject);
    return subjectData ? subjectData.subSubjects.sort() : [];
  }, [selectedClass, selectedSubject]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    console.log('File selected:', selectedFile);
    if (selectedFile) {
      if (selectedFile.name.toLowerCase().endsWith('.docx')) {
        setFile(selectedFile);
        setError('');
      } else {
        setError('Vui lòng chọn file định dạng .docx (Word 2007+)');
        setFile(null);
      }
    }
  };

  const clearFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const generateLessonPlan = async (type: 'ai' | 'nls') => {
    if (!selectedClass || !selectedSubject || !file) {
      setError('Vui lòng điền đầy đủ thông tin và tải file giáo án.');
      return;
    }

    setIsGenerating(prev => ({ ...prev, [type]: true }));
    setError('');
    
    try {
      console.log(`Starting ${type.toUpperCase()} lesson plan generation...`);
      const arrayBuffer = await file.arrayBuffer();
      
      const images: string[] = [];
      const imageAlts: string[] = [];
      const { value: rawHtml } = await mammoth.convertToHtml(
        { arrayBuffer },
        { 
          convertImage: mammoth.images.imgElement((image) => {
            return image.read("base64").then((imageBuffer: any) => {
              const base64 = `data:${image.contentType};base64,${imageBuffer}`;
              images.push(base64);
              const altText = (image as any).altText || "";
              imageAlts.push(altText);
              return {
                src: `[[IMG_${images.length - 1}]]`,
                alt: altText
              };
            });
          })
        }
      );

      if (!rawHtml || rawHtml.trim().length === 0) {
        throw new Error('Không thể trích xuất nội dung từ file Word.');
      }

      const htmlContent = rawHtml;

      const apiKey = process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('Hệ thống chưa được cấu hình API Key. Nếu bạn đang chạy trên Vercel, vui lòng thêm GEMINI_API_KEY vào Environment Variables trong dashboard Vercel.');
      }

      const ai = new GoogleGenAI({ apiKey });
      
      const typeLabel = type === 'ai' ? 'Trí tuệ nhân tạo (AI)' : 'Năng lực số (NLS)';
      const baseGrade = getBaseGrade(selectedClass);
      const integrationData = type === 'ai' 
        ? `Mục tiêu AI: ${JSON.stringify(AI_OBJECTIVES[baseGrade as keyof typeof AI_OBJECTIVES] || [])}\nHướng dẫn AI: ${JSON.stringify(SUBJECT_AI_INTEGRATION[selectedSubject as keyof typeof SUBJECT_AI_INTEGRATION] || {})}`
        : `Danh mục Năng lực số (NLS): ${JSON.stringify(
            NLS_MAPPING[
              ['1', '2', '3'].includes(baseGrade) ? '1-3' :
              ['4', '5'].includes(baseGrade) ? '4-5' :
              ['6', '7'].includes(baseGrade) ? '6-7' :
              ['8', '9'].includes(baseGrade) ? '8-9' : '10-12'
            ] || []
          )}`;

      const prompt = `
        BẠN LÀ MỘT CHUYÊN GIA BIÊN TẬP GIÁO ÁN ĐIỆN TỬ 100% CHÍNH XÁC.
        NHIỆM VỤ: Tích hợp ${typeLabel} vào giáo án HTML sau đây.
        
        DỮ LIỆU HƯỚNG DẪN:
        ${integrationData}
        Năng lực thêm: AI: ${aiCompetency || 'N/A'}, Số: ${digitalCompetency || 'N/A'}.

        GIÁO ÁN GỐC (HTML):
        ${htmlContent}

        QUY TẮC "BẢO TOÀN TUYỆT ĐỐI":
        1. CÔ LẬP PHẠM VI XỬ LÝ: Hệ thống AI chỉ được phép xử lý nội dung văn bản của File giáo án được tải lên. Tuyệt đối không được can thiệp, làm thay đổi hoặc làm ảnh hưởng đến các dữ liệu hệ thống khác (Học sinh, Tài chính, Chương trình, Tài khoản...).
        2. SAO CHÉP CHÍNH XÁC (MIRRORING): Bạn phải đóng vai trò như một tấm gương. Các phần không liên quan đến việc tích hợp ${type.toUpperCase()} PHẢI được giữ nguyên từng dấu phẩy, từng thẻ HTML, từng dòng văn bản. Tuyệt đối không được thay đổi bất kỳ từ ngữ nào của giáo án gốc nếu không phải là phần chèn thêm nội dung tích hợp.
        3. TÍNH BẤT BIẾN CỦA CÁC MỤC KHÁC: Khi bạn chỉnh sửa hoặc bổ sung vào một mục (ví dụ: mục Hoạt động), tất cả các mục khác (ví dụ: Chuẩn bị, Tiến trình khác...) phải được giữ nguyên hoàn toàn, không được phép chỉnh sửa hay tóm tắt lại.
        4. CÔNG THỨC TOÁN HỌC (LATEEX): Chuyển đổi công thức toán/hóa sang LaTeX ($...$ hoặc $$...$$). Nếu [[IMG_X]] là công thức toán, hãy thay bằng mã LaTeX.
        5. HÌNH ẢNH & BẢNG: Giữ nguyên mã [[IMG_X]] cho hình ảnh thực tế và cấu trúc thẻ <table>.
        6. CHỈ ĐƯỢC PHÉP CHÈN THÊM (INSERTION ONLY): 
            - Thêm mục "3. ${type === 'ai' ? 'Năng lực AI' : 'Năng lực số (NLS)'}" vào phần Mục tiêu.
            - Chèn nội dung tích hợp vào các hoạt động. Nội dung chèn thêm PHẢI bôi đỏ <span style="color:red;">...</span>.
        7. TRẢ VỀ TOÀN VĂN: Phải trả về đầy đủ từ đầu đến cuối giáo án. Không được cắt xén.

        Trả về JSON: {"content": "..."}
      `;

      const response = await ai.models.generateContent({
        model: "gemini-flash-latest",
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json",
          maxOutputTokens: 8192,
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              content: { type: Type.STRING }
            },
            required: ["content"]
          }
        }
      });

      let text = response.text || '';
      if (!text) throw new Error('AI không trả về kết quả.');

      // Clean up potential markdown wrapping if AI ignores responseMimeType (rare but happens)
      if (text.includes('```json')) {
        text = text.split('```json')[1].split('```')[0].trim();
      } else if (text.includes('```')) {
        text = text.split('```')[1].split('```')[0].trim();
      }

      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error("JSON Parse Error:", e);
        
        // Robust repair and fallback extraction for truncated or malformed JSON
        try {
          // Fallback 1: Regex extraction for the "content" field
          // We look for everything after "content": " and try to find a balanced or end-of-text capture
          const contentMatch = text.match(/"content"\s*:\s*"(.*)/s);
          if (contentMatch && contentMatch[1]) {
            let extractedContent = contentMatch[1];
            
            // If it seems to have ending markers, try to strip them
            // We search for the LAST sequence of "} or " } potentially with whitespace
            const lastQuoteBrace = extractedContent.lastIndexOf('"}');
            if (lastQuoteBrace !== -1) {
              extractedContent = extractedContent.substring(0, lastQuoteBrace);
            } else {
              // If not found, it's likely truncated. Strip any trailing single quote that might be part of the truncation
              if (extractedContent.endsWith('"') && !extractedContent.endsWith('\\"')) {
                extractedContent = extractedContent.slice(0, -1);
              }
              // Also handle trailing backslash which might escape the quote we want to add later if we were parsing
              if (extractedContent.endsWith('\\')) {
                extractedContent = extractedContent.slice(0, -1);
              }
            }

            // Unescape common JSON escapes in the string
            // We use a more complete unescape sequence to handle the content safely
            const unescapedContent = extractedContent
              .replace(/\\"/g, '"')
              .replace(/\\\\/g, '\\')
              .replace(/\\n/g, '\n')
              .replace(/\\r/g, '\r')
              .replace(/\\t/g, '\t')
              .replace(/\\f/g, '\f')
              .replace(/\\b/g, '\b');

            data = { content: unescapedContent };
            console.log("Extracted massive content via regex fallback. Length:", unescapedContent.length);
          } else {
            // Fallback 2: Existing repair logic for smaller truncations
            let fixedText = text.trim();
            if (fixedText.endsWith('\\')) fixedText = fixedText.slice(0, -1);
            const attempts = [fixedText + '"}', fixedText + '}', fixedText + '" }'];
            let repaired = false;
            for (const attempt of attempts) {
              try {
                data = JSON.parse(attempt);
                repaired = true;
                break;
              } catch (err) { continue; }
            }
            if (!repaired) throw e;
          }
        } catch (e2) {
          throw new Error('Nội dung giáo án quá khổng lồ (vượt quá 1 triệu ký tự) khiến hệ thống không thể xử lý trọn vẹn trong một lượt. Vui lòng thử chia nhỏ file giáo án thành các phần (ví dụ: chia theo tiết học) để đạt hiệu quả tốt nhất.');
        }
      }

      if (!data || !data.content) throw new Error('Dữ liệu trả về không hợp lệ hoặc thiếu nội dung giáo án.');

      // Restore images
      let finalContent = data.content;
      images.forEach((base64, index) => {
        finalContent = finalContent.replace(new RegExp(`\\[\\[IMG_${index}\\]\\]`, 'g'), base64);
        // Also handle cases where AI might have modified the format slightly
        finalContent = finalContent.replace(new RegExp(`src="\\[\\[IMG_${index}\\]\\]"`, 'g'), `src="${base64}"`);
      });
      
      setResult(prev => ({
        ...prev,
        [type]: finalContent
      }) as any);
    } catch (err: any) {
      console.error(err);
      let msg = err.message;
      if (msg.includes('500') || msg.includes('INTERNAL') || msg.includes('Internal error')) {
        msg = 'Máy chủ AI gặp sự cố tạm thời hoặc giáo án của bạn quá lớn để xử lý trong một lượt. Vui lòng thử lại sau giây lát hoặc chia nhỏ giáo án.';
      }
      setError(`Có lỗi xảy ra: ${msg}`);
    } finally {
      setIsGenerating(prev => ({ ...prev, [type]: false }));
    }
  };

  const exportToDocx = async (html: string, filename: string) => {
    try {
      const chunks = splitHtmlContent(html);
      
      for (let i = 0; i < chunks.length; i++) {
        const chunkHtml = chunks[i];
        const chunkFilename = chunks.length > 1 ? filename.replace('.docx', `_Phan_${i + 1}.docx`) : filename;
        
        const parser = new DOMParser();
        const doc = parser.parseFromString(chunkHtml, 'text/html');
        const children: any[] = [];

      const processNode = (node: Node): TextRun[] => {
        let runs: TextRun[] = [];
        node.childNodes.forEach(child => {
          if (child.nodeType === Node.TEXT_NODE) {
            runs.push(new TextRun({ 
              text: sanitizeDocxText(child.textContent),
              size: 26, // 13pt
              font: "Times New Roman"
            }));
          } else if (child.nodeType === Node.ELEMENT_NODE) {
            const element = child as HTMLElement;
            const style = element.getAttribute('style') || '';
            const isRed = style.includes('color:red') || style.includes('color: red');
            const isBold = element.tagName === 'B' || element.tagName === 'STRONG' || element.tagName.startsWith('H');
            const tagName = element.tagName.toLowerCase();

            if (tagName === 'br') {
              runs.push(new TextRun({ text: "", break: 1 }));
            } else {
              runs.push(new TextRun({
                text: sanitizeDocxText(element.textContent),
                color: isRed ? "FF0000" : undefined,
                bold: isBold,
                size: element.tagName.startsWith('H') ? 30 : 26,
                font: "Times New Roman"
              }));
            }
          }
        });
        return runs;
      };

      const convertElementToDocx = (element: HTMLElement) => {
        const tagName = element.tagName.toLowerCase();
        
        if (['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
          children.push(new Paragraph({
            children: processNode(element),
            heading: tagName.startsWith('h') ? HeadingLevel[`HEADING_${tagName.substring(1)}` as keyof typeof HeadingLevel] : undefined,
            spacing: { after: 200, before: tagName.startsWith('h') ? 400 : 0 }
          }));
        } else if (tagName === 'img') {
          const src = element.getAttribute('src');
          if (src && src.startsWith('data:')) {
            try {
              const base64Data = src.split(',')[1];
              const binaryString = atob(base64Data);
              const len = binaryString.length;
              const bytes = new Uint8Array(len);
              for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              
              // Try to estimate size - for math formulas, they should be relatively wide but not tall
              // If we can't get real dimensions, we use a more balanced default
              children.push(new Paragraph({
                children: [
                  new ImageRun({
                    data: bytes,
                    transformation: {
                      width: 250,
                      height: 50, // Smaller default for potential equations
                    },
                  } as any),
                ],
                spacing: { after: 200 }
              }));
            } catch (e) {
              console.error("Error adding image to docx:", e);
            }
          }
        } else if (tagName === 'ul' || tagName === 'ol') {
          element.childNodes.forEach(li => {
            if (li.nodeType === Node.ELEMENT_NODE && (li as HTMLElement).tagName.toLowerCase() === 'li') {
              children.push(new Paragraph({
                children: processNode(li),
                bullet: tagName === 'ul' ? { level: 0 } : undefined,
                numbering: tagName === 'ol' ? { reference: 'my-numbering', level: 0 } : undefined,
                spacing: { after: 120 }
              }));
            }
          });
        } else if (tagName === 'table') {
          const rows: TableRow[] = [];
          const trs = element.querySelectorAll('tr');
          trs.forEach(tr => {
            const cells: TableCell[] = [];
            tr.childNodes.forEach(td => {
              if (td.nodeType === Node.ELEMENT_NODE && (['td', 'th'].includes((td as HTMLElement).tagName.toLowerCase()))) {
                const cellContent: Paragraph[] = [];
                // Process content inside TD
                td.childNodes.forEach(child => {
                  if (child.nodeType === Node.TEXT_NODE && child.textContent?.trim()) {
                    cellContent.push(new Paragraph({
                      children: [new TextRun({ text: sanitizeDocxText(child.textContent || ""), size: 26, font: "Times New Roman" })]
                    }));
                  } else if (child.nodeType === Node.ELEMENT_NODE) {
                    const el = child as HTMLElement;
                    if (['p', 'div', 'span', 'b', 'strong'].includes(el.tagName.toLowerCase())) {
                      cellContent.push(new Paragraph({
                        children: processNode(el)
                      }));
                    } else if (el.tagName.toLowerCase() === 'img') {
                      const src = el.getAttribute('src');
                      if (src && src.startsWith('data:')) {
                        try {
                          const base64Data = src.split(',')[1];
                          const binaryString = atob(base64Data);
                          const len = binaryString.length;
                          const bytes = new Uint8Array(len);
                          for (let i = 0; i < len; i++) {
                            bytes[i] = binaryString.charCodeAt(i);
                          }
                          
                          cellContent.push(new Paragraph({
                            children: [
                              new ImageRun({
                                data: bytes,
                                transformation: {
                                  width: 100,
                                  height: 30,
                                },
                              } as any),
                            ],
                          }));
                        } catch (e) {
                          console.error("Error adding table image to docx:", e);
                        }
                      }
                    }
                  }
                });
                
                if (cellContent.length === 0) {
                  cellContent.push(new Paragraph({ children: [] }));
                }

                cells.push(new TableCell({
                  children: cellContent,
                  verticalAlign: VerticalAlign.CENTER,
                  borders: {
                    top: { style: BorderStyle.SINGLE, size: 1 },
                    bottom: { style: BorderStyle.SINGLE, size: 1 },
                    left: { style: BorderStyle.SINGLE, size: 1 },
                    right: { style: BorderStyle.SINGLE, size: 1 },
                  }
                }));
              }
            });
            if (cells.length > 0) {
              rows.push(new TableRow({ children: cells }));
            }
          });

          if (rows.length > 0) {
            children.push(new Table({
              rows: rows,
              width: { size: 100, type: WidthType.PERCENTAGE },
            }));
            children.push(new Paragraph({ children: [] })); // Spacer
          }
        } else if (tagName === 'div') {
           children.push(new Paragraph({
            children: processNode(element),
            spacing: { after: 200 }
          }));
        }
      };

      doc.body.childNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          convertElementToDocx(node as HTMLElement);
        } else if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
          children.push(new Paragraph({
            children: [new TextRun({ 
              text: sanitizeDocxText(node.textContent || ""),
              size: 26 // 13pt
            })],
            spacing: { after: 200 }
          }));
        }
      });

        const documentDoc = new Document({
          sections: [{
            children: children,
          }],
        });

        const blob = await Packer.toBlob(documentDoc);
        saveAs(blob, chunkFilename);
        
        // Wait briefly between chunks
        if (chunks.length > 1) await new Promise(r => setTimeout(r, 500));
      }
    } catch (err) {
      console.error("Lỗi khi xuất file docx:", err);
      alert("Có lỗi xảy ra khi xuất file Word. Vui lòng thử lại.");
    }
  };

  const exportAllToDocx = async () => {
    if (result?.ai) await exportToDocx(result.ai, `GiaoAn_AI_${selectedClass}_${selectedSubject}.docx`);
    if (result?.nls) await exportToDocx(result.nls, `NangLucSohu_AI_${selectedClass}_${selectedSubject}.docx`);
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-slate-900 p-8 rounded-[32px] border border-neutral-200 dark:border-slate-800 shadow-sm"
      >
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-neutral-900 dark:text-white tracking-tight">Tạo giáo án tích hợp NLS, AI</h2>
            <p className="text-sm text-neutral-500 dark:text-slate-400 mt-1 font-medium">Tự động bổ sung mục tiêu và hoạt động tích hợp vào giáo án của bạn.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="space-y-2">
            <label className="text-sm font-bold text-neutral-700 dark:text-slate-300 ml-1">Lớp</label>
            <select 
              value={selectedClass}
              onChange={(e) => {
                setSelectedClass(e.target.value);
                setSelectedSubject('');
                setSelectedSubSubject('');
              }}
              className="w-full px-4 py-3 bg-neutral-50 dark:bg-slate-800/50 border border-neutral-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white transition-all"
            >
              <option value="">Chọn lớp</option>
              {ALL_CLASSES.map(grade => (
                <option key={grade} value={grade}>Lớp {grade}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-neutral-700 dark:text-slate-300 ml-1">Môn</label>
            <select 
              value={selectedSubject}
              onChange={(e) => {
                setSelectedSubject(e.target.value);
                setSelectedSubSubject('');
              }}
              className="w-full px-4 py-3 bg-neutral-50 dark:bg-slate-800/50 border border-neutral-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white transition-all"
              disabled={!selectedClass}
            >
              <option value="">Chọn môn</option>
              {subjects.map(subject => (
                <option key={subject} value={subject}>{subject}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-neutral-700 dark:text-slate-300 ml-1">Phân môn (nếu có)</label>
            <select 
              value={selectedSubSubject}
              onChange={(e) => setSelectedSubSubject(e.target.value)}
              className="w-full px-4 py-3 bg-neutral-50 dark:bg-slate-800/50 border border-neutral-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white transition-all"
              disabled={!selectedSubject || subSubjects.length === 0}
            >
              <option value="">Chọn phân môn</option>
              {subSubjects.map(sub => (
                <option key={sub} value={sub}>{sub}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="space-y-2">
            <label className="text-sm font-bold text-neutral-700 dark:text-slate-300 ml-1">Năng lực AI (Tùy chọn)</label>
            <input 
              type="text"
              value={aiCompetency}
              onChange={(e) => setAiCompetency(e.target.value)}
              placeholder="Nhập năng lực AI..."
              className="w-full px-4 py-3 bg-neutral-50 dark:bg-slate-800/50 border border-neutral-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-neutral-700 dark:text-slate-300 ml-1">Năng lực số (Tùy chọn)</label>
            <input 
              type="text"
              value={digitalCompetency}
              onChange={(e) => setDigitalCompetency(e.target.value)}
              placeholder="Nhập năng lực số..."
              className="w-full px-4 py-3 bg-neutral-50 dark:bg-slate-800/50 border border-neutral-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white transition-all"
            />
          </div>
        </div>

        <div className="space-y-6">
          <div 
            onClick={() => {
              console.log('Upload area clicked');
              fileInputRef.current?.click();
            }}
            className={cn(
              "flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-[24px] transition-all cursor-pointer relative group min-h-[240px]",
              file 
                ? "border-green-500 bg-green-50/30 dark:bg-green-900/10" 
                : "border-neutral-200 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-500 hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10"
            )}
          >
            <input 
              ref={fileInputRef}
              type="file" 
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" 
              onChange={handleFileChange}
              className="hidden"
            />
            <div className={cn(
              "w-20 h-20 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg",
              file ? "bg-green-500 text-white" : "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400"
            )}>
              {file ? <Check className="w-10 h-10" /> : <Upload className="w-10 h-10" />}
            </div>
            <div className="text-center space-y-2">
              <p className="text-xl font-black text-neutral-900 dark:text-white">
                {file ? file.name : 'Tải giáo án lên'}
              </p>
              <p className="text-sm text-neutral-500 dark:text-slate-400 font-medium">
                {file ? 'File đã sẵn sàng. Click để thay đổi.' : 'Hỗ trợ định dạng .docx (Microsoft Word)'}
              </p>
            </div>
            
            {file && (
              <button 
                onClick={clearFile}
                className="absolute top-6 right-6 p-2 bg-white dark:bg-slate-800 rounded-full shadow-xl hover:bg-red-50 dark:hover:bg-red-900/20 text-neutral-400 hover:text-red-500 transition-all border border-neutral-100 dark:border-slate-700"
                title="Xóa file"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl text-sm font-bold flex items-center gap-3">
              <Info className="w-5 h-5" />
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => generateLessonPlan('ai')}
              disabled={isGenerating.ai || !file}
              className={cn(
                "py-4 rounded-2xl font-black text-lg transition-all flex items-center justify-center gap-3 shadow-xl",
                isGenerating.ai || !file
                  ? "bg-neutral-100 dark:bg-slate-800 text-neutral-400 cursor-not-allowed"
                  : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200 dark:shadow-none active:scale-[0.98]"
              )}
            >
              {isGenerating.ai ? (
                <RefreshCw className="w-6 h-6 animate-spin" />
              ) : (
                <Zap className="w-6 h-6" />
              )}
              Tạo giáo án tích hợp AI
            </button>

            <button
              onClick={() => generateLessonPlan('nls')}
              disabled={isGenerating.nls || !file}
              className={cn(
                "py-4 rounded-2xl font-black text-lg transition-all flex items-center justify-center gap-3 shadow-xl",
                isGenerating.nls || !file
                  ? "bg-neutral-100 dark:bg-slate-800 text-neutral-400 cursor-not-allowed"
                  : "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200 dark:shadow-none active:scale-[0.98]"
              )}
            >
              {isGenerating.nls ? (
                <RefreshCw className="w-6 h-6 animate-spin" />
              ) : (
                <GraduationCap className="w-6 h-6" />
              )}
              Tạo giáo án tích hợp Năng lực số
            </button>
          </div>
        </div>
      </motion.div>

      {result && (
        <div className="space-y-6">
          <div className="flex justify-end">
            <button
              onClick={exportAllToDocx}
              className="flex items-center gap-2 px-8 py-4 bg-black text-white dark:bg-white dark:text-black rounded-2xl hover:scale-105 active:scale-95 transition-all font-black shadow-2xl"
            >
              <Download className="w-6 h-6" />
              Tải toàn bộ giáo án
            </button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white dark:bg-slate-900 p-8 rounded-[32px] border border-neutral-200 dark:border-slate-800 shadow-sm"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black text-neutral-900 dark:text-white flex items-center gap-2">
                <div className="w-8 h-8 bg-purple-50 dark:bg-purple-900/30 rounded-lg flex items-center justify-center text-purple-600 dark:text-purple-400">
                  <Zap className="w-4 h-4" />
                </div>
                Giáo án tích hợp AI
              </h3>
              {result.ai && (
                <button 
                  onClick={() => exportToDocx(result.ai, `GiaoAn_AI_${selectedSubject}_Lop${selectedClass}.docx`)}
                  className="p-2 text-neutral-400 hover:text-primary transition-all"
                  title="Tải xuống (.docx)"
                >
                  <Download className="w-5 h-5" />
                </button>
              )}
            </div>
            {result.ai ? (
              <div 
                className="prose dark:prose-invert max-w-none h-[600px] overflow-y-auto p-6 bg-neutral-50 dark:bg-slate-800/50 rounded-2xl border border-neutral-100 dark:border-slate-700 text-sm"
                dangerouslySetInnerHTML={{ __html: result.ai }}
              />
            ) : (
              <div className="h-[600px] flex items-center justify-center text-neutral-400 font-medium italic border-2 border-dashed border-neutral-100 dark:border-slate-800 rounded-2xl">
                Chưa có nội dung AI. Nhấn nút để tạo.
              </div>
            )}
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white dark:bg-slate-900 p-8 rounded-[32px] border border-neutral-200 dark:border-slate-800 shadow-sm"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black text-neutral-900 dark:text-white flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-50 dark:bg-blue-900/30 rounded-lg flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <GraduationCap className="w-4 h-4" />
                </div>
                Giáo án tích hợp NLS
              </h3>
              {result.nls && (
                <button 
                  onClick={() => exportToDocx(result.nls, `GiaoAn_NLS_${selectedSubject}_Lop${selectedClass}.docx`)}
                  className="p-2 text-neutral-400 hover:text-primary transition-all"
                  title="Tải xuống (.docx)"
                >
                  <Download className="w-5 h-5" />
                </button>
              )}
            </div>
            {result.nls ? (
              <div 
                className="prose dark:prose-invert max-w-none h-[600px] overflow-y-auto p-6 bg-neutral-50 dark:bg-slate-800/50 rounded-2xl border border-neutral-100 dark:border-slate-700 text-sm"
                dangerouslySetInnerHTML={{ __html: result.nls }}
              />
            ) : (
              <div className="h-[600px] flex items-center justify-center text-neutral-400 font-medium italic border-2 border-dashed border-neutral-100 dark:border-slate-800 rounded-2xl">
                Chưa có nội dung NLS. Nhấn nút để tạo.
              </div>
            )}
          </motion.div>
        </div>
      </div>
      )}
    </div>
  );
}

function TeacherLessonPlanSection({ currentUser }: { currentUser: UserAccount | null }) {
  const [grade, setGrade] = useState('');
  const [subject, setSubject] = useState('');
  const [subSubject, setSubSubject] = useState('');
  const [lessonName, setLessonName] = useState('');
  const [semester, setSemester] = useState('Học kì I');
  const [periods, setPeriods] = useState('1');
  const [userApiKey, setUserApiKey] = useState(() => localStorage.getItem('teacher_ai_api_key') || '');
  const [config, setConfig] = useState({
    multipleChoice: 0,
    trueFalse: 0,
    shortAnswer: 0,
    essay: 0
  });

  useEffect(() => {
    localStorage.setItem('teacher_ai_api_key', userApiKey);
  }, [userApiKey]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');

  // Split result into sections for easier management and sequential downloading
  const lessonParts = useMemo(() => {
    if (!result) return [];
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = result;
    
    // We look for H2 headings which usually denote Part I, II, III in our prompt
    const headings = Array.from(tempDiv.querySelectorAll('h2'));
    if (headings.length === 0) {
      return [{ title: 'Toàn bộ giáo án', content: result }];
    }
    
    const parts: { title: string; content: string }[] = [];
    headings.forEach((h, idx) => {
      const nextH = headings[idx + 1];
      let sectionContent = h.outerHTML;
      let currentNode = h.nextSibling;
      
      while (currentNode && currentNode !== nextH) {
        if (currentNode.nodeType === Node.ELEMENT_NODE) {
          sectionContent += (currentNode as HTMLElement).outerHTML;
        } else {
          sectionContent += currentNode.textContent;
        }
        currentNode = currentNode.nextSibling;
      }
      
      parts.push({
        title: h.innerText || `Phần ${idx + 1}`,
        content: sectionContent
      });
    });
    
    return parts;
  }, [result]);

  const grades_list = ALL_CLASSES;
  
  const subjects = [
    { name: 'Toán', levels: [1, 2, 3] },
    { name: 'Ngữ văn', levels: [2, 3] },
    { name: 'Tiếng Việt', levels: [1] },
    { name: 'Tiếng Anh', levels: [1, 2, 3] },
    { name: 'Khoa học tự nhiên', levels: [2] },
    { name: 'Lịch sử và Địa lý', levels: [1, 2] },
    { name: 'Vật lý', levels: [3] },
    { name: 'Hóa học', levels: [3] },
    { name: 'Sinh học', levels: [3] },
    { name: 'Lịch sử', levels: [3] },
    { name: 'Địa lý', levels: [3] },
    { name: 'GD Kinh tế và Pháp luật', levels: [3] },
    { name: 'Tin học', levels: [1, 2, 3] },
    { name: 'Công nghệ', levels: [1, 2, 3] },
    { name: 'Tự nhiên và Xã hội', levels: [1] },
    { name: 'Khoa học', levels: [1] },
    { name: 'Đạo đức', levels: [1] },
    { name: 'Giáo dục công dân', levels: [2] },
    { name: 'Âm nhạc', levels: [1, 2, 3] },
    { name: 'Mỹ thuật', levels: [1, 2, 3] },
    { name: 'Hoạt động trải nghiệm, hướng nghiệp', levels: [1, 2, 3] },
    { name: 'Giáo dục thể chất', levels: [1, 2, 3] },
  ];

  const getSubjectList = () => {
    if (!grade) return subjects;
    const gradeNum = parseInt(grade.replace(/\D/g, ''));
    let level = 1; // 1: TH, 2: THCS, 3: THPT
    if (gradeNum >= 6 && gradeNum <= 9) level = 2;
    if (gradeNum >= 10) level = 3;
    return subjects.filter(s => s.levels.includes(level));
  };

  const generatePlan = async () => {
    if (!grade || !subject || !lessonName) {
      setError('Vui lòng chọn Khối lớp, Môn học và nhập Tên bài dạy.');
      return;
    }

    setIsGenerating(true);
    setError('');
    
    try {
      const apiKey = userApiKey || process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('Hệ thống chưa được cấu hình API Key. Vui lòng nhập API Key để tiếp tục hoặc liên hệ quản trị viên.');
      }

      const ai = new GoogleGenAI({ apiKey });
      
      const prompt = `
        BẠN LÀ CHUYÊN GIA BIÊN SOẠN TÀI LIỆU GIÁO DỤC CHUẨN GDPT 2018.
        NHIỆM VỤ: Tạo một tài liệu giáo án/chuyên đề bài dạy hoàn chỉnh.

        THÔNG TIN CHUNG:
        - Khối: ${grade}
        - Môn: ${subject}
        ${subSubject ? `- Phân môn: ${subSubject}` : ''}
        - Bài dạy: ${lessonName}
        - Học kì: ${semester}
        - Thời lượng: ${periods} tiết

        YÊU CẦU CẤU TRÚC (BẮT BUỘC THEO MẪU):
        1. Tiêu đề: CHỦ ĐỀ: [Tên bài dạy] (Thời lượng: [Số tiết])
        2. PHẦN I. TÓM TẮT LÍ THUYẾT:
           - Viết chi tiết các kiến thức trọng tâm (đánh số 1, 2, 3...). 
           - Nội dung phải chuyên sâu và dễ hiểu, phù hợp với chương trình ${semester}.
        3. PHẦN II. CÁC DẠNG BÀI:
           - Dạng 1. TN nhiều đáp án: Tạo đúng ${config.multipleChoice} câu hỏi.
           - Dạng 2. TN Đúng sai: Tạo đúng ${config.trueFalse} câu hỏi (Mỗi câu có 4 ý a, b, c, d).
           - Dạng 3. TN Trả lời ngắn: Tạo đúng ${config.shortAnswer} câu hỏi.
           - Dạng 4. Tự luận: Tạo đúng ${config.essay} câu hỏi.
        4. PHẦN III. ĐÁP ÁN:
           - Cung cấp đáp án chi tiết cho toàn bộ các câu hỏi ở PHẦN II.
        5. Kết thúc bằng dòng:  HẾT 

        QUY TẮC PHẢI TUÂN THỦ:
        - CÔNG THỨC TOÁN/LÝ/HÓA: Tuyệt đối sử dụng LaTeX ($...$ hoặc $$...$$).
        - TRÌNH BÀY: Sử dụng các thẻ HTML (h2, p, strong, table, ul, li) để tạo cấu trúc văn bản đẹp.
        - ĐỊNH DẠNG CÂU HỎI: Các phương án lựa chọn (A, B, C, D) hoặc các ý (a, b, c, d) KHÔNG ĐƯỢC có dấu chấm (.) ở phía trước. Chỉ trình bày dưới dạng: "A. Nội dung" hoặc "a. Nội dung".
        - CHẤT LƯỢNG: Câu hỏi phải bám sát nội dung lí thuyết đã trình bày.

        Trả về JSON: {"content": "Nội dung HTML hoàn chỉnh"}
      `;

      const response = await ai.models.generateContent({
        model: "gemini-flash-latest",
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json",
          maxOutputTokens: 8192,
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              content: { type: Type.STRING }
            },
            required: ["content"]
          }
        }
      });

      const text = response.text || '';
      const data = JSON.parse(text);
      setResult(data.content);
    } catch (e: any) {
      console.error("AI Error:", e);
      setError(e.message || 'Có lỗi xảy ra khi tạo giáo án.');
    } finally {
      setIsGenerating(false);
    }
  };

  const exportToDocx = async (htmlContent: string, filename: string) => {
    try {
      const doc = new DOMParser().parseFromString(htmlContent, 'text/html');
      const children: any[] = [];

      const processNode = (node: Node, options: { bold?: boolean, color?: string } = {}): any[] => {
        const runs: any[] = [];
        node.childNodes.forEach(child => {
          if (child.nodeType === Node.TEXT_NODE) {
            const text = child.textContent || "";
            // Detect questions/exercises: starts with "Câu", "Bài", "Dạng"
            const isQuestion = /^(Câu|Bài|Dạng)\s+\d+[:.]/.test(text.trim());
            
            runs.push(new TextRun({
              text: sanitizeDocxText(text),
              size: 26, // 13pt
              font: "Times New Roman",
              bold: options.bold || isQuestion,
              color: isQuestion ? "0000FF" : (options.color || "000000")
            }));
          } else if (child.nodeType === Node.ELEMENT_NODE) {
            const element = child as HTMLElement;
            const tagName = element.tagName.toLowerCase();
            const textContent = element.textContent?.trim() || "";
            const isQuestion = /^(Câu|Bài|Dạng)\s+\d+[:.]/.test(textContent);
            const isBold = options.bold || element.tagName === 'B' || element.tagName === 'STRONG' || element.tagName.startsWith('H');

            if (tagName === 'br') {
              runs.push(new TextRun({ text: "", break: 1 }));
            } else {
              runs.push(new TextRun({
                text: sanitizeDocxText(element.textContent),
                bold: isBold || isQuestion,
                size: element.tagName.startsWith('H') ? 28 : 26,
                font: "Times New Roman",
                color: isQuestion ? "0000FF" : (options.color || "000000")
              }));
            }
          }
        });
        return runs;
      };

      const convertElementToDocx = (element: HTMLElement) => {
        const tagName = element.tagName.toLowerCase();
        const textContent = element.textContent?.trim() || "";

        // Special handling for the main title: CHỦ ĐỀ: ... (Thời lượng: ...)
        // We match "CHỦ ĐỀ:" and try to split before "(Thời lượng:"
        if (textContent.startsWith('CHỦ ĐỀ:') && textContent.includes('Thời lượng:')) {
          const parts = textContent.split('(');
          const topicName = parts[0].trim();
          const duration = parts[1] ? '(' + parts[1].trim() : "";

          children.push(new Paragraph({
            children: [new TextRun({ text: topicName, bold: true, size: 32, font: "Times New Roman", color: "000000" })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 }
          }));
          if (duration) {
            children.push(new Paragraph({
              children: [new TextRun({ text: duration, bold: true, size: 26, font: "Times New Roman", color: "000000" })],
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 }
            }));
          }
          return;
        }

        if (['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
          const isHeader = tagName.startsWith('h');
          const isQuestion = /^(Câu|Bài|Dạng)\s+\d+[:.]/.test(textContent);

          children.push(new Paragraph({
            children: processNode(element, { 
              bold: isHeader, 
              color: isQuestion ? "0000FF" : "000000" 
            }),
            alignment: isHeader && (tagName === 'h1' || textContent.startsWith('CHỦ ĐỀ:')) ? AlignmentType.CENTER : AlignmentType.LEFT,
            spacing: { 
              after: isHeader ? 200 : 120, 
              before: isHeader ? 240 : 0,
              line: 312 
            }
          }));
        } else if (tagName === 'ul' || tagName === 'ol') {
          element.childNodes.forEach(li => {
            if (li.nodeType === Node.ELEMENT_NODE && (li as HTMLElement).tagName.toLowerCase() === 'li') {
              children.push(new Paragraph({
                children: processNode(li as HTMLElement),
                bullet: tagName === 'ul' ? { level: 0 } : undefined,
                spacing: { after: 120, line: 312 }
              }));
            }
          });
        } else if (tagName === 'table') {
          const rows: TableRow[] = [];
          element.querySelectorAll('tr').forEach(tr => {
            const cells: TableCell[] = [];
            tr.querySelectorAll('td, th').forEach(td => {
              cells.push(new TableCell({
                children: [new Paragraph({ 
                  children: processNode(td),
                  spacing: { after: 0, before: 0 } 
                })],
                verticalAlign: VerticalAlign.CENTER,
                borders: {
                  top: { style: BorderStyle.SINGLE, size: 1 },
                  bottom: { style: BorderStyle.SINGLE, size: 1 },
                  left: { style: BorderStyle.SINGLE, size: 1 },
                  right: { style: BorderStyle.SINGLE, size: 1 },
                }
              }));
            });
            rows.push(new TableRow({ children: cells }));
          });
          children.push(new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }));
        }
      };

      doc.body.childNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) convertElementToDocx(node as HTMLElement);
      });

      const documentDoc = new Document({
        sections: [{ 
          properties: {
            page: {
              size: {
                width: 11906, // A4 width in twips
                height: 16838, // A4 height in twips
              },
              margin: {
                top: 1134,    // 2cm
                left: 1417,   // 2.5cm
                bottom: 1134, // 2cm
                right: 1134,  // 2cm
              },
            },
          },
          children 
        }],
      });

      const blob = await Packer.toBlob(documentDoc);
      saveAs(blob, filename);
    } catch (err) {
      console.error("Docx Error:", err);
      alert("Lỗi khi xuất file.");
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-slate-900 p-8 rounded-[32px] border border-neutral-200 dark:border-slate-800 shadow-sm"
      >
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
            <ClipboardList className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-neutral-900 dark:text-white tracking-tight">Tạo giáo án giáo viên</h2>
            <p className="text-sm text-neutral-500 dark:text-slate-400 mt-1 font-medium">Biên soạn giáo án/chuyên đề chuẩn GDPT 2018.</p>
          </div>
        </div>

        <div className="space-y-8">
          {/* API Key Input */}
          <div className="p-6 bg-amber-50/50 dark:bg-amber-900/10 rounded-2xl border border-amber-200/50 dark:border-amber-800/30 space-y-3">
            <label className="text-xs font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest flex items-center gap-2">
              <Key className="w-4 h-4" />
              Gemini API Key Cá nhân (Để tránh lỗi 403/404)
            </label>
            <input
              type="password"
              value={userApiKey}
              onChange={(e) => setUserApiKey(e.target.value)}
              placeholder="Nhập API Key Gemini của bạn..."
              className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-800 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none dark:text-white transition-all text-sm shadow-sm"
            />
            <p className="text-[10px] text-amber-600/80 dark:text-amber-500/80 italic font-medium leading-relaxed">
              * Mã API được lưu trong trình duyệt của bạn và dùng để gọi mô hình Gemini khi tạo giáo án. Nếu để trống, hệ thống sẽ dùng Key mặc định.
            </p>
          </div>

          {/* Grade selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <label className="text-sm font-black text-neutral-900 dark:text-white uppercase tracking-wider pl-1">Chọn Khối lớp</label>
              <select 
                value={grade}
                onChange={(e) => { setGrade(e.target.value); setSubject(''); }}
                className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary outline-none dark:text-white transition-all font-bold"
              >
                <option value="">-- Chọn khối lớp --</option>
                {grades_list.map(g => (
                  <option key={g} value={g}>Lớp {g}</option>
                ))}
              </select>
            </div>
            {/* Subject selection */}
            <div className="space-y-3">
              <label className="text-sm font-black text-neutral-900 dark:text-white uppercase tracking-wider pl-1 font-sans">Chọn Môn học</label>
              <select 
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={!grade}
                className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary outline-none dark:text-white transition-all font-bold disabled:opacity-50"
              >
                <option value="">-- Chọn môn học --</option>
                {getSubjectList().map(s => (
                  <option key={s.name} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-neutral-700 dark:text-slate-300 ml-1">Phân môn</label>
              <input 
                type="text"
                value={subSubject}
                onChange={(e) => setSubSubject(e.target.value)}
                placeholder="Ví dụ: Hình học (để trống nếu không có)"
                className="w-full px-4 py-3 bg-neutral-50 dark:bg-slate-800/50 border border-neutral-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary outline-none dark:text-white transition-all font-medium"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-neutral-700 dark:text-slate-300 ml-1">Tên bài dạy <span className="text-red-500">*</span></label>
              <input 
                type="text"
                value={lessonName}
                onChange={(e) => setLessonName(e.target.value)}
                placeholder="Ví dụ: Cấu tạo nguyên tử"
                className="w-full px-4 py-3 bg-neutral-50 dark:bg-slate-800/50 border border-neutral-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary outline-none dark:text-white transition-all font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-neutral-700 dark:text-slate-300 ml-1">Số tiết dạy</label>
              <input 
                type="number"
                value={periods}
                onChange={(e) => setPeriods(e.target.value)}
                className="w-full px-4 py-3 bg-neutral-50 dark:bg-slate-800/50 border border-neutral-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary outline-none dark:text-white transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-neutral-700 dark:text-slate-300 ml-1">Học kì</label>
              <select 
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                className="w-full px-4 py-3 bg-neutral-50 dark:bg-slate-800/50 border border-neutral-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary outline-none dark:text-white transition-all font-medium"
              >
                <option value="Học kì I">Học kì I</option>
                <option value="Học kì II">Học kì II</option>
                <option value="Cả năm">Cả năm</option>
              </select>
            </div>
          </div>

          <div className="bg-neutral-50 dark:bg-slate-800/30 p-6 rounded-2xl border border-neutral-100 dark:border-slate-800">
            <h3 className="text-sm font-black text-neutral-900 dark:text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <Settings className="w-4 h-4 text-primary" />
              Cấu hình số câu hỏi bài tập
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-neutral-500 uppercase">TN nhiều đáp án</label>
                <input 
                  type="number"
                  value={config.multipleChoice}
                  onChange={(e) => setConfig({...config, multipleChoice: parseInt(e.target.value) || 0})}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-neutral-200 dark:border-slate-700 rounded-lg outline-none text-sm dark:text-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-neutral-500 uppercase">TN Đúng/Sai</label>
                <input 
                  type="number"
                  value={config.trueFalse}
                  onChange={(e) => setConfig({...config, trueFalse: parseInt(e.target.value) || 0})}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-neutral-200 dark:border-slate-700 rounded-lg outline-none text-sm dark:text-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-neutral-500 uppercase">TN trả lời ngắn</label>
                <input 
                  type="number"
                  value={config.shortAnswer}
                  onChange={(e) => setConfig({...config, shortAnswer: parseInt(e.target.value) || 0})}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-neutral-200 dark:border-slate-700 rounded-lg outline-none text-sm dark:text-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-neutral-500 uppercase">Tự luận</label>
                <input 
                  type="number"
                  value={config.essay}
                  onChange={(e) => setConfig({...config, essay: parseInt(e.target.value) || 0})}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-neutral-200 dark:border-slate-700 rounded-lg outline-none text-sm dark:text-white"
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-sm font-bold flex items-center gap-3 border border-red-100 dark:border-red-900/30">
              <Info className="w-5 h-5" />
              {error}
            </div>
          )}

          <button
            onClick={generatePlan}
            disabled={isGenerating}
            className={cn(
              "w-full py-5 rounded-2xl font-black text-xl transition-all flex items-center justify-center gap-3 shadow-xl",
              isGenerating
                ? "bg-neutral-100 dark:bg-slate-800 text-neutral-400 cursor-not-allowed"
                : "bg-primary text-white hover:bg-primary-hover active:scale-[0.98] shadow-primary/30"
            )}
          >
            {isGenerating ? (
              <RefreshCw className="w-7 h-7 animate-spin" />
            ) : (
              <Sparkles className="w-7 h-7" />
            )}
            {isGenerating ? "Hệ thống đang biên soạn..." : "BIÊN SOẠN GIÁO ÁN THÔNG MINH"}
          </button>
        </div>
      </motion.div>

      {result && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white dark:bg-slate-900 p-10 rounded-[32px] border border-neutral-200 dark:border-slate-800 shadow-2xl relative"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 border-b border-neutral-100 dark:border-slate-800 pb-6 gap-4">
            <h3 className="text-2xl font-black text-neutral-900 dark:text-white flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                <FileText className="w-6 h-6" />
              </div>
              Nội dung giáo án ({lessonParts.length} phần)
            </h3>
            <div className="flex flex-wrap gap-2">
              <button 
                onClick={() => exportToDocx(result, `${lessonName || "GiaoAn"}.docx`)}
                className="px-6 py-3 bg-primary text-white rounded-xl font-bold flex items-center gap-2 hover:bg-primary-hover transition-all shadow-lg shadow-primary/20"
              >
                <Download className="w-5 h-5" />
                Tải TOÀN BỘ (.docx)
              </button>
              
              {lessonParts.length > 1 && lessonParts.map((part, idx) => (
                <button 
                  key={idx}
                  onClick={() => exportToDocx(part.content, `${lessonName || "GiaoAn"}_Phan${idx + 1}.docx`)}
                  className="px-4 py-3 bg-neutral-100 dark:bg-slate-800 text-neutral-700 dark:text-slate-200 rounded-xl font-bold flex items-center gap-2 hover:bg-neutral-200 dark:hover:bg-slate-700 transition-all border border-neutral-200 dark:border-slate-700 text-sm"
                  title={part.title}
                >
                  <FileText className="w-4 h-4" />
                  Phần {idx + 1}
                </button>
              ))}
            </div>
          </div>
          <div 
            className="prose dark:prose-invert max-w-none min-h-[600px] p-10 bg-white dark:bg-slate-900 border-2 border-neutral-50 dark:border-slate-800 rounded-3xl text-base leading-relaxed font-sans shadow-inner overflow-x-auto"
            dangerouslySetInnerHTML={{ __html: result }}
          />
        </motion.div>
      )}
    </div>
  );
}

function BusinessConfigSection({ info, setInfo, setActiveTab, currentUser, onSync }: { info: BusinessInfo, setInfo: (i: BusinessInfo) => void, setActiveTab: (t: string) => void, currentUser: UserAccount | null, onSync?: (info: BusinessInfo) => void }) {
  const isAdmin = currentUser?.role === 'admin';
  
  // Create a merged info object for users - merge account-level config with global config
  const displayInfo = React.useMemo(() => {
    if (isAdmin) return info;
    return {
      name: currentUser?.businessName || info.name,
      owner: currentUser?.businessOwner || info.owner,
      taxId: currentUser?.taxCode || info.taxId,
      address: currentUser?.businessAddress || info.address,
      businessLocation: currentUser?.businessLocation || info.businessLocation
    };
  }, [info, currentUser, isAdmin]);

  const [formData, setFormData] = React.useState<BusinessInfo>(displayInfo);

  React.useEffect(() => {
    setFormData(displayInfo);
  }, [displayInfo]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setInfo(formData);
    if (onSync) onSync(formData);
    alert('Đã lưu và đồng bộ cấu hình hộ kinh doanh thành công!');
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-slate-900 p-8 rounded-[32px] border border-neutral-200 dark:border-slate-800 shadow-sm"
      >
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-neutral-900 dark:text-white tracking-tight">Cấu hình Hộ kinh doanh</h2>
            <p className="text-sm text-neutral-500 dark:text-slate-400 mt-1 font-medium">
              {isAdmin 
                ? "Thiết lập thông tin cơ bản của hộ kinh doanh để in chứng từ." 
                : "Thông tin cơ bản của hộ kinh doanh (Chỉ xem)."}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-neutral-700 dark:text-slate-300 ml-1">Tên hộ kinh doanh</label>
              <input 
                type="text" 
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                disabled={!isAdmin}
                className="w-full px-4 py-3 bg-neutral-50 dark:bg-slate-800/50 border border-neutral-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary outline-none dark:text-white transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                placeholder="Ví dụ: Hộ kinh doanh Nguyễn Văn A"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-neutral-700 dark:text-slate-300 ml-1">Chủ hộ kinh doanh</label>
              <input 
                type="text" 
                value={formData.owner}
                onChange={(e) => setFormData({...formData, owner: e.target.value})}
                disabled={!isAdmin}
                className="w-full px-4 py-3 bg-neutral-50 dark:bg-slate-800/50 border border-neutral-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary outline-none dark:text-white transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                placeholder="Họ và tên chủ hộ"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-neutral-700 dark:text-slate-300 ml-1">Mã số thuế</label>
              <input 
                type="text" 
                value={formData.taxId}
                onChange={(e) => setFormData({...formData, taxId: e.target.value})}
                disabled={!isAdmin}
                className="w-full px-4 py-3 bg-neutral-50 dark:bg-slate-800/50 border border-neutral-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary outline-none dark:text-white transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                placeholder="Mã số thuế (nếu có)"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-neutral-700 dark:text-slate-300 ml-1">Địa chỉ</label>
              <input 
                type="text" 
                value={formData.address}
                onChange={(e) => setFormData({...formData, address: e.target.value})}
                disabled={!isAdmin}
                className="w-full px-4 py-3 bg-neutral-50 dark:bg-slate-800/50 border border-neutral-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary outline-none dark:text-white transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                placeholder="Địa chỉ đăng ký"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-neutral-700 dark:text-slate-300 ml-1">Nơi kinh doanh</label>
              <input 
                type="text" 
                value={formData.businessLocation}
                onChange={(e) => setFormData({...formData, businessLocation: e.target.value})}
                disabled={!isAdmin}
                className="w-full px-4 py-3 bg-neutral-50 dark:bg-slate-800/50 border border-neutral-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary outline-none dark:text-white transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                placeholder="Địa điểm kinh doanh thực tế"
              />
            </div>
          </div>

          <div className="pt-4 flex gap-4">
            {isAdmin && (
              <button 
                type="submit"
                className="px-8 py-3 bg-primary text-white rounded-xl hover:bg-primary-hover transition-all font-bold shadow-lg shadow-primary/20"
              >
                Lưu cấu hình
              </button>
            )}
            <button 
              type="button"
              onClick={() => setActiveTab('dashboard')}
              className="px-8 py-3 bg-neutral-100 dark:bg-slate-800 text-neutral-700 dark:text-slate-300 rounded-xl hover:bg-neutral-200 dark:hover:bg-slate-700 transition-all font-bold"
            >
              Trở lại
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function MenuSettingsSection({ menuOrder, setMenuOrder }: { menuOrder: string[], setMenuOrder: (o: string[]) => void }) {
  const ALL_MENU_ITEMS = [
    { id: 'dashboard', label: 'TRANG CHỦ', icon: Home },
    { id: 'ai_lesson_plan', label: 'TẠO KHBD NLS, AI', icon: Sparkles },
    { id: 'teacher_lesson_plan', label: 'TẠO KHBD GIÁO VIÊN', icon: ClipboardList },
    { id: 'business', label: 'HỘ KINH DOANH', icon: Building2 },
    { id: 'students_group', label: 'QUẢN LÝ HỌC SINH', icon: Users },
    { id: 'program', label: 'QUẢN LÝ CHƯƠNG TRÌNH DẠY', icon: BookOpen },
    { id: 'finance_group', label: 'QUẢN LÝ TÀI CHÍNH', icon: DollarSign },
  ];

  const moveUp = (index: number) => {
    if (index === 0) return;
    const newOrder = [...menuOrder];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    setMenuOrder(newOrder);
  };

  const moveDown = (index: number) => {
    if (index === menuOrder.length - 1) return;
    const newOrder = [...menuOrder];
    [newOrder[index + 1], newOrder[index]] = [newOrder[index], newOrder[index + 1]];
    setMenuOrder(newOrder);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-slate-900 p-8 rounded-[32px] border border-neutral-200 dark:border-slate-800 shadow-sm"
      >
        <div className="mb-8">
          <h2 className="text-2xl font-black text-neutral-900 dark:text-white tracking-tight">Cấu hình Thứ tự Menu</h2>
          <p className="text-sm text-neutral-500 dark:text-slate-400 mt-1 font-medium">Di chuyển các mục menu để thay đổi thứ tự hiển thị cho toàn bộ hệ thống.</p>
        </div>

        <div className="space-y-3">
          {menuOrder.map((id, index) => {
            const item = ALL_MENU_ITEMS.find(i => i.id === id);
            if (!item) return null;
            return (
              <div key={id} className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-slate-800/50 rounded-2xl border border-neutral-100 dark:border-slate-700">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-white dark:bg-slate-900 rounded-xl flex items-center justify-center text-primary shadow-sm">
                    <item.icon className="w-5 h-5" />
                  </div>
                  <span className="font-bold text-neutral-800 dark:text-slate-200">{item.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => moveUp(index)}
                    disabled={index === 0}
                    className="p-2 hover:bg-neutral-200 dark:hover:bg-slate-700 rounded-lg disabled:opacity-30 transition-all"
                  >
                    <ChevronUp className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => moveDown(index)}
                    disabled={index === menuOrder.length - 1}
                    className="p-2 hover:bg-neutral-200 dark:hover:bg-slate-700 rounded-lg disabled:opacity-30 transition-all"
                  >
                    <ChevronDown className="w-5 h-5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}

function ClassConfigSection({ classes, setClasses, setActiveTab, currentUser }: { key?: string, classes: ClassSubject[], setClasses: (c: ClassSubject[]) => void, setActiveTab: (t: string) => void, currentUser: UserAccount | null }) {
  const isAdmin = currentUser?.role === 'admin';

  const addRow = () => {
    if (!isAdmin) return;
    setClasses([...classes, { id: crypto.randomUUID(), grade: '', subject: '', subSubject: '' }]);
  };

  const resetToDefault = () => {
    if (!isAdmin) return;
    if (window.confirm("Bạn có chắc chắn muốn khôi phục cấu hình mặc định? Toàn bộ dữ liệu hiện tại sẽ bị ghi đè.")) {
      setClasses(DEFAULT_CLASSES);
    }
  };

  const removeRow = (id: string) => {
    if (!isAdmin) return;
    setClasses(classes.filter((c) => c.id !== id));
  };

  const handleChange = (id: string, field: keyof ClassSubject, value: string) => {
    if (!isAdmin) return;
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
          {isAdmin && (
            <>
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
            </>
          )}
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
                        disabled={!isAdmin}
                        placeholder="VD: 6"
                        className="w-full bg-transparent border-none focus:ring-0 text-sm font-black text-neutral-900 dark:text-white placeholder-neutral-300 dark:placeholder-slate-700 disabled:opacity-80"
                      />
                    </td>
                    <td className="px-8 py-4">
                      <input
                        value={cls.subject}
                        onChange={(e) => handleChange(cls.id, 'subject', e.target.value)}
                        disabled={!isAdmin}
                        placeholder="VD: Toán"
                        className="w-full bg-transparent border-none focus:ring-0 text-sm font-bold text-neutral-700 dark:text-slate-300 placeholder-neutral-300 dark:placeholder-slate-700 disabled:opacity-80"
                      />
                    </td>
                    <td className="px-8 py-4">
                      <input
                        value={cls.subSubject}
                        onChange={(e) => handleChange(cls.id, 'subSubject', e.target.value)}
                        disabled={!isAdmin}
                        placeholder="VD: Đại số"
                        className="w-full bg-transparent border-none focus:ring-0 text-sm font-bold text-neutral-500 dark:text-slate-400 placeholder-neutral-300 dark:placeholder-slate-700 italic disabled:opacity-80"
                      />
                    </td>
                    <td className="px-8 py-4 text-right">
                      {isAdmin && (
                        <button
                          onClick={() => removeRow(cls.id)}
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
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

function PPCTSection({ ppctData, setPpctData, classes, setPlans, plans, setActiveTab, currentUser }: { 
  key?: string,
  ppctData: PPCTItem[], 
  setPpctData: (d: PPCTItem[]) => void, 
  classes: ClassSubject[],
  setPlans: (p: LessonPlan[]) => void,
  plans: LessonPlan[],
  setActiveTab: (t: string) => void,
  currentUser: UserAccount | null
}) {
  const isAdmin = currentUser?.role === 'admin';
  const [activeGrade, setActiveGrade] = useState<string>('6');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAdmin) return;
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
    if (!isAdmin) return;
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
    if (!isAdmin) return;
    const targetGrade = normalizeGrade(activeGrade);
    setPpctData(ppctData.filter(item => normalizeGrade(item.grade) !== targetGrade));
  };

  const handleChange = (id: string, field: keyof PPCTItem, value: any) => {
    if (!isAdmin) return;
    setPpctData(ppctData.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const addRow = () => {
    if (!isAdmin) return;
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
    if (!isAdmin) return;
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
          {isAdmin && (
            <>
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
            </>
          )}
          <button 
            onClick={downloadSamplePPCT}
            className="px-6 py-3 bg-neutral-100 dark:bg-slate-800 text-neutral-700 dark:text-slate-300 rounded-xl hover:bg-neutral-200 dark:hover:bg-slate-700 transition-all font-bold text-sm flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Tải file mẫu
          </button>
          {isAdmin && (
            <>
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
            </>
          )}
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
        {filteredData.length > 0 && isAdmin && (
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
                      disabled={!isAdmin}
                      className="w-full bg-transparent border-none focus:ring-0 text-sm font-normal text-neutral-900 dark:text-white text-center font-mono disabled:opacity-80"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <input
                      value={item.subject}
                      onChange={(e) => handleChange(item.id, 'subject', e.target.value)}
                      disabled={!isAdmin}
                      className="w-full bg-transparent border-none focus:ring-0 text-sm font-normal text-primary disabled:opacity-80"
                      placeholder="Môn học"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <input
                      value={item.subSubject}
                      onChange={(e) => handleChange(item.id, 'subSubject', e.target.value)}
                      disabled={!isAdmin}
                      className="w-full bg-transparent border-none focus:ring-0 text-sm text-neutral-500 dark:text-slate-400 italic disabled:opacity-80"
                      placeholder="Phân môn"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <input
                      value={item.content}
                      onChange={(e) => handleChange(item.id, 'content', e.target.value)}
                      disabled={!isAdmin}
                      className="w-full bg-transparent border-none focus:ring-0 text-sm text-neutral-700 dark:text-slate-300 font-medium disabled:opacity-80"
                      placeholder="Nội dung bài dạy"
                    />
                  </td>
                  <td className="px-6 py-4 text-right">
                    {isAdmin && (
                      <button
                        onClick={() => deleteRow(item.id)}
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
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
      const apiKey = process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY;
      if (!apiKey) return;

      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-flash-latest",
        contents: [{ role: 'user', parts: [{ text: `Dựa trên thông tin sau, hãy cho biết nội dung bài học (tên bài dạy) của tiết học này:
      Khối lớp: ${row.grade}
      Môn học: ${row.subject}
      Phân môn: ${row.subSubject}
      Tiết theo PPCT: ${row.period}
      Trả về duy nhất tên bài học, không thêm gì khác.` }] }]
      });
      const text = response.text || '';

      if (text) {
        handleRowChange(rowId, 'content', text.trim());
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
              new TextRun({ text: sanitizeDocxText(`Hộ kinh doanh: ${businessInfo.name}`), size: 22 }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: sanitizeDocxText(`Địa chỉ: ${businessInfo.address}`), size: 22 }),
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
              new TextRun({ text: sanitizeDocxText(`Họ tên giáo viên dạy: ${plan.teacherName}`), bold: true, size: 24 }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: sanitizeDocxText(`Tuần: ${plan.week} - Từ ngày: ${safeFormat(plan.startDate, 'dd/MM/yyyy')} - Đến ngày: ${safeFormat(plan.endDate, 'dd/MM/yyyy')}`), size: 22 }),
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
                    children: [new TextRun({ text: sanitizeDocxText(text), bold: true, size: 22 })] 
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
                      children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: sanitizeDocxText(dayText), size: 20 })] })],
                      verticalAlign: VerticalAlign.CENTER,
                      rowSpan: rowsToExport.filter(r => (r.day || r.date || '') === dayText).length,
                    }));
                  }

                  const shiftMatch = row.shift.match(/(Ca \d+)\s*(.*)/);
                  const shiftLine1 = shiftMatch ? shiftMatch[1] : row.shift;
                  const shiftLine2 = shiftMatch ? shiftMatch[2] : "";

                  rowChildren.push(new TableCell({
                    children: [
                      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: sanitizeDocxText(shiftLine1), size: 20 })] }),
                      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: sanitizeDocxText(shiftLine2), size: 18 })] }),
                    ],
                    verticalAlign: VerticalAlign.CENTER,
                  }));

                  [row.grade, row.subject, row.subSubject, row.period].forEach(text => {
                    rowChildren.push(new TableCell({
                      children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: sanitizeDocxText(text), size: 20 })] })],
                      verticalAlign: VerticalAlign.CENTER,
                    }));
                  });

                  [row.content, row.notes].forEach(text => {
                    rowChildren.push(new TableCell({
                      children: [new Paragraph({ children: [new TextRun({ text: sanitizeDocxText(text), size: 20 })] })],
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
                      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: sanitizeDocxText("Người lập"), bold: true, size: 22 })] }),
                      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: sanitizeDocxText(`Ngày ${safeFormat(plan.startDate, 'dd/MM/yyyy')}`), size: 20 })] }),
                      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: sanitizeDocxText("(Ký, ghi rõ họ tên)"), italics: true, size: 20 })] }),
                      new Paragraph({ 
                        alignment: AlignmentType.CENTER, 
                        children: [new TextRun({ text: sanitizeDocxText(plan.teacherName), bold: true, size: 22 })],
                        spacing: { before: 1700 }
                      }),
                    ],
                  }),
                  new TableCell({
                    children: [
                      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: sanitizeDocxText("Duyệt kế hoạch"), bold: true, size: 22 })] }),
                      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: sanitizeDocxText(`Ngày ${safeFormat(plan.startDate, 'dd/MM/yyyy')}`), size: 20 })] }),
                      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: sanitizeDocxText("(Ký, ghi rõ họ tên)"), italics: true, size: 20 })] }),
                      new Paragraph({ 
                        alignment: AlignmentType.CENTER, 
                        children: [new TextRun({ text: sanitizeDocxText(businessInfo.owner), bold: true, size: 22 })],
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
                      <div className="relative group/period">
                        <input
                          list={`periods-${row.id}`}
                          value={row.period}
                          onChange={(e) => handleRowChange(row.id, 'period', e.target.value)}
                          className="w-full bg-transparent border-none focus:ring-0 text-xs font-normal text-neutral-900 dark:text-white"
                          placeholder="Tiết..."
                        />
                        <datalist id={`periods-${row.id}`}>
                          {ppctData
                            .filter(p => 
                              normalizeGrade(p.grade) === normalizeGrade(row.grade) && 
                              String(p.subject).trim().toLowerCase() === String(row.subject).trim().toLowerCase() && 
                              (row.subSubject ? String(p.subSubject).trim().toLowerCase() === String(row.subSubject).trim().toLowerCase() : true)
                            )
                            .sort((a, b) => a.period - b.period)
                            .map((p, pIdx) => (
                              <option key={`${p.grade}-${p.subject}-${p.subSubject}-${p.period}-${pIdx}`} value={String(p.period)}>
                                {p.period} - {p.content}
                              </option>
                            ))}
                        </datalist>
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center opacity-0 group-hover/period:opacity-100 transition-opacity">
                          {[1, 2, 3, 4, 5].map(n => (
                            <button
                              key={n}
                              onClick={() => handleRowChange(row.id, 'period', String(n))}
                              className="w-5 h-5 flex items-center justify-center text-[10px] bg-neutral-100 dark:bg-slate-800 hover:bg-primary hover:text-white rounded ml-0.5"
                            >
                              {n}
                            </button>
                          ))}
                        </div>
                      </div>
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
              new TextRun({ text: sanitizeDocxText(`Hộ kinh doanh: ${businessInfo.name}`), size: 22 }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: sanitizeDocxText(`Địa chỉ: ${businessInfo.address}`), size: 22 }),
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
              new TextRun({ text: sanitizeDocxText(`Tuần: ${selectedPlan.week} - Từ ngày: ${safeFormat(selectedPlan.startDate, 'dd/MM/yyyy')} - Đến ngày: ${safeFormat(selectedPlan.endDate, 'dd/MM/yyyy')}`), size: 22 }),
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
                    children: [new TextRun({ text: sanitizeDocxText(text), bold: true, size: 22 })] 
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
                  const dayStr = row.day + (row.date ? ` (${row.date})` : '');
                  const dayText = sanitizeDocxText(dayStr);
                  const isNewDay = dayText !== lastDay;
                  if (isNewDay) lastDay = dayText;

                  const rowChildren: TableCell[] = [];
                  
                  if (isNewDay) {
                    rowChildren.push(new TableCell({
                      children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: sanitizeDocxText(dayText), size: 20 })] })],
                      verticalAlign: VerticalAlign.CENTER,
                      rowSpan: rowsToExport.filter(r => (r.day + (r.date ? ` (${r.date})` : '')) === dayStr).length,
                    }));
                  }

                  // Split shift
                  const shiftMatch = row.shift.match(/(Ca \d+)\s*(.*)/);
                  const shiftLine1 = shiftMatch ? shiftMatch[1] : row.shift;
                  const shiftLine2 = shiftMatch ? shiftMatch[2] : "";

                  rowChildren.push(new TableCell({
                    children: [
                      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: sanitizeDocxText(shiftLine1), size: 20 })] }),
                      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: sanitizeDocxText(shiftLine2), size: 18 })] }),
                    ],
                    verticalAlign: VerticalAlign.CENTER,
                  }));

                  // Lớp, Môn, Phân môn, Tiết - Centered
                  [row.grade, row.subject, row.subSubject, row.period].forEach(text => {
                    rowChildren.push(new TableCell({
                      children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: sanitizeDocxText(text), size: 20 })] })],
                      verticalAlign: VerticalAlign.CENTER,
                    }));
                  });

                  // Content, Attendance, Comments, Signature - Left aligned
                  [row.content, row.attendance || '', row.comments || '', row.signature || ''].forEach(text => {
                    rowChildren.push(new TableCell({
                      children: [new Paragraph({ children: [new TextRun({ text: sanitizeDocxText(text), size: 20 })] })],
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
                          new TextRun({ text: sanitizeDocxText("Xác nhận của Hộ Kinh doanh"), bold: true, size: 22 }),
                        ],
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({ text: sanitizeDocxText(`Ngày ${safeFormat(selectedPlan.endDate, 'dd/MM/yyyy')}`), size: 20 }),
                        ],
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({ text: sanitizeDocxText("(Ký, ghi rõ họ tên)"), italics: true, size: 20 }),
                        ],
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({ text: sanitizeDocxText(businessInfo.owner), bold: true, size: 22 }),
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
  setActiveTab,
  currentUser
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
  setActiveTab: (t: string) => void,
  currentUser: UserAccount | null
}) {
  const effectiveBusinessInfo = businessInfo;
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
          <ClassConfigSection key="classes" classes={classes} setClasses={setClasses} setActiveTab={setActiveTab} currentUser={currentUser} />
        )}
        {activeSubTab === 'ppct' && (
          <PPCTSection key="ppct" ppctData={ppctData} setPpctData={setPpctData} classes={classes} plans={lessonPlans} setPlans={setLessonPlans} setActiveTab={setActiveTab} currentUser={currentUser} />
        )}
        {activeSubTab === 'lesson-plan' && (
          <LessonPlanSection key="lesson-plan" plans={lessonPlans} setPlans={setLessonPlans} classes={classes} ppctData={ppctData} deletePlan={deletePlan} businessInfo={effectiveBusinessInfo} setActiveTab={setActiveTab} />
        )}
        {activeSubTab === 'journal' && (
          <ClassJournalSection key="journal" plans={lessonPlans} setPlans={setLessonPlans} deletePlan={deletePlan} businessInfo={effectiveBusinessInfo} setActiveTab={setActiveTab} />
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
  setActiveTab,
  currentUser
}: { 
  students: Student[], 
  setStudents: (s: Student[]) => void,
  businessInfo: BusinessInfo,
  activeSubTab: string,
  setActiveTab: (t: string) => void,
  currentUser: UserAccount | null
}) {
  const isAdmin = currentUser?.role === 'admin';
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
    if (!isAdmin) {
      alert('Chỉ quản trị viên mới có thể nhập danh sách học sinh.');
      return;
    }
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
          new TextRun({ text: sanitizeDocxText("CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM"), bold: true, size: 28 }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { line: 312 },
        children: [
          new TextRun({ text: sanitizeDocxText("Độc lập - Tự do - Hạnh phúc"), bold: true, size: 26 }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { line: 312 },
        children: [
          new TextRun({ text: sanitizeDocxText("----------***----------"), size: 24 }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 400, after: 400, line: 312 },
        children: [
          new TextRun({ text: sanitizeDocxText("ĐƠN ĐĂNG KÍ HỌC THÊM"), bold: true, size: 32 }),
        ],
      }),
      new Paragraph({
        indent: { left: 1134 },
        spacing: { line: 312 },
        children: [
          new TextRun({ text: sanitizeDocxText("Kính gửi: "), italics: true, size: 28 }),
          new TextRun({ text: sanitizeDocxText(businessInfo.name || "................................................................"), bold: true, size: 28 }),
        ],
      }),
      new Paragraph({ spacing: { before: 200, line: 312 } }),
      new Paragraph({
        indent: { firstLine: 567 },
        spacing: { line: 312 },
        children: [
          new TextRun({ text: sanitizeDocxText("Tôi tên là: "), size: 28 }),
          new TextRun({ text: sanitizeDocxText(student.parentName || "................................................................"), size: 28 }),
        ],
      }),
      new Paragraph({
        indent: { firstLine: 567 },
        spacing: { line: 312 },
        children: [
          new TextRun({ text: sanitizeDocxText("Số điện thoại: "), size: 28 }),
          new TextRun({ text: sanitizeDocxText(student.phone || "................................................................"), size: 28 }),
        ],
      }),
      new Paragraph({
        indent: { firstLine: 567 },
        spacing: { line: 312 },
        children: [
          new TextRun({ text: sanitizeDocxText("Là Phụ huynh của học sinh: "), size: 28 }),
          new TextRun({ text: sanitizeDocxText(student.name || "................................................................"), size: 28 }),
        ],
      }),
      new Paragraph({
        indent: { firstLine: 567 },
        spacing: { line: 312 },
        children: [
          new TextRun({ text: sanitizeDocxText("Lớp: "), size: 28 }),
          new TextRun({ text: sanitizeDocxText(student.grade || "................................................................"), size: 28 }),
        ],
      }),
      new Paragraph({
        indent: { firstLine: 567 },
        spacing: { line: 312 },
        children: [
          new TextRun({ text: sanitizeDocxText("Đang học tại trường: "), size: 28 }),
          new TextRun({ text: sanitizeDocxText(student.school || "................................................................"), size: 28 }),
        ],
      }),
      new Paragraph({
        indent: { firstLine: 567 },
        spacing: { line: 312 },
        children: [
          new TextRun({ text: sanitizeDocxText("Môn đăng kí học: "), size: 28 }),
          new TextRun({ text: sanitizeDocxText(student.subject || "................................................................"), size: 28 }),
        ],
      }),
      new Paragraph({
        indent: { firstLine: 567 },
        spacing: { before: 200, line: 312 },
        children: [
          new TextRun({ text: sanitizeDocxText(`Tôi viết đơn này đăng kí học thêm môn ${student.subject || '........'} trong năm 2026, do `), size: 28 }),
          new TextRun({ text: sanitizeDocxText(businessInfo.name || "................"), size: 28 }),
          new TextRun({ text: sanitizeDocxText(" tổ chức tại "), size: 28 }),
          new TextRun({ text: sanitizeDocxText(businessInfo.address || "................"), size: 28 }),
        ],
      }),
      new Paragraph({
        indent: { firstLine: 567 },
        spacing: { before: 200, line: 312 },
        children: [
          new TextRun({ text: sanitizeDocxText("Tôi xin cam kết đối với con tôi sẽ:"), size: 28 }),
        ],
      }),
      new Paragraph({
        indent: { firstLine: 567 },
        spacing: { line: 312 },
        children: [
          new TextRun({ text: sanitizeDocxText("+ Chấp hành nghiêm túc nội quy lớp học."), size: 28 }),
        ],
      }),
      new Paragraph({
        indent: { firstLine: 567 },
        spacing: { line: 312 },
        children: [
          new TextRun({ text: sanitizeDocxText("+ Tham gia học tập đầy đủ, đúng giờ."), size: 28 }),
        ],
      }),
      new Paragraph({
        indent: { firstLine: 567 },
        spacing: { line: 312 },
        children: [
          new TextRun({ text: sanitizeDocxText("+ Hoàn thành bài tập và chủ động trong học tập."), size: 28 }),
        ],
      }),
      new Paragraph({
        indent: { firstLine: 567 },
        spacing: { line: 312 },
        children: [
          new TextRun({ text: sanitizeDocxText("Rất mong cơ sở xem xét và chấp thuận."), size: 28 }),
        ],
      }),
      new Paragraph({
        indent: { firstLine: 567 },
        spacing: { before: 400, line: 312 },
        children: [
          new TextRun({ text: sanitizeDocxText("Tôi xin trân trọng cảm ơn!"), italics: true, size: 28 }),
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
                      new TextRun({ text: sanitizeDocxText(`Lai châu, ngày ${d} tháng ${m} năm ${y}`), italics: true, size: 26 }),
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
                    spacing: { before: 1400, line: 312 },
                    children: [
                      new TextRun({ text: sanitizeDocxText(student.parentName || ""), bold: true, size: 28 }),
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
                        {activeSubTab === 'students-list' && isAdmin && (
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
  const [showPassword, setShowPassword] = useState(false);
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
            className="w-24 h-24 bg-white dark:bg-slate-900 rounded-[24px] flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-primary/20 relative p-4"
          >
            <Logo className="w-full h-full" />
            <div className="absolute -top-2 -right-2 w-6 h-6 bg-amber-400 rounded-full border-4 border-white dark:border-slate-900 shadow-sm" />
          </motion.div>
          <h1 className="text-3xl font-black text-neutral-900 dark:text-white tracking-tight">Chào mừng trở lại</h1>
          <p className="text-neutral-500 dark:text-slate-400 mt-2 font-bold text-sm uppercase tracking-widest">Hệ thống quản lý Hoàng Gia</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <span className="px-2 py-1 bg-primary/10 text-primary text-[10px] font-bold rounded-lg">Quản lý học sinh</span>
            <span className="px-2 py-1 bg-emerald-500/10 text-emerald-600 text-[10px] font-bold rounded-lg">Chương trình dạy</span>
            <span className="px-2 py-1 bg-orange-500/10 text-orange-600 text-[10px] font-bold rounded-lg">Tài chính</span>
            <span className="px-2 py-1 bg-purple-500/10 text-purple-600 text-[10px] font-bold rounded-lg">Giáo án AI & NLS</span>
            <span className="px-2 py-1 bg-indigo-500/10 text-indigo-600 text-[10px] font-bold rounded-lg">Tạo KHBD Trung tâm</span>
          </div>
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
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-12 pr-12 py-4 bg-neutral-50 dark:bg-slate-900/50 border border-neutral-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-primary focus:border-transparent dark:text-white transition-all outline-none"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-neutral-400 hover:text-primary transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
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

function UserManagementSection({ users, setUsers, setActiveTab, onSync, onFetch }: { users: UserAccount[], setUsers: React.Dispatch<React.SetStateAction<UserAccount[]>>, setActiveTab: (t: string) => void, onSync?: (users: UserAccount[]) => void, onFetch?: () => void }) {
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'user'>('user');
  const [newExpiryDate, setNewExpiryDate] = useState('');
  const [newMaxDevices, setNewMaxDevices] = useState(1);
  const [newTaxCode, setNewTaxCode] = useState('');
  const [newBusinessName, setNewBusinessName] = useState('');
  const [newBusinessAddress, setNewBusinessAddress] = useState('');
  const [newBusinessLocation, setNewBusinessLocation] = useState('');
  const [newBusinessOwner, setNewBusinessOwner] = useState('');

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newPassword) return;
    
    const newUser: UserAccount = {
      id: Math.random().toString(36).substr(2, 9),
      email: newEmail,
      password: newPassword,
      role: newRole,
      expiryDate: newExpiryDate || undefined,
      maxDevices: newMaxDevices,
      taxCode: newTaxCode || undefined,
      businessName: newBusinessName || undefined,
      businessAddress: newBusinessAddress || undefined,
      businessLocation: newBusinessLocation || undefined,
      businessOwner: newBusinessOwner || undefined,
      createdAt: new Date().toISOString()
    };
    
    const updatedUsers = [...users, newUser];
    setUsers(updatedUsers);
    if (onSync) onSync(updatedUsers);

    setNewEmail('');
    setNewPassword('');
    setNewExpiryDate('');
    setNewMaxDevices(1);
    setNewTaxCode('');
    setNewBusinessName('');
    setNewBusinessAddress('');
    setNewBusinessLocation('');
    setNewBusinessOwner('');
  };

  const handleDeleteUser = (id: string) => {
    if (users.length <= 1) {
      alert('Không thể xóa tài khoản cuối cùng.');
      return;
    }
    const updatedUsers = users.filter(u => u.id !== id);
    setUsers(updatedUsers);
    if (onSync) onSync(updatedUsers);
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="bg-white dark:bg-slate-900 p-8 rounded-[32px] border border-neutral-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-neutral-900 dark:text-white tracking-tight">Quản lý Tài khoản</h2>
              <p className="text-sm text-neutral-500 dark:text-slate-400 mt-1 font-medium">Thêm, sửa hoặc xóa tài khoản truy cập hệ thống.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setActiveTab('menu_settings')}
              className="px-4 py-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-200 transition-all text-sm"
            >
              <Settings className="w-4 h-4" />
              Sắp xếp Menu
            </button>
            <button 
              onClick={() => {
                if (onSync) onSync(users);
                alert('Đã gửi yêu cầu đồng bộ toàn bộ tài khoản lên Google Sheet!');
              }}
              className="px-4 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-200 transition-all text-sm"
            >
              <Upload className="w-4 h-4" />
              Đẩy lên Google Sheet
            </button>
            <button 
              onClick={onFetch}
              className="px-4 py-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl font-bold flex items-center gap-2 hover:bg-emerald-200 transition-all text-sm"
            >
              <RefreshCw className="w-4 h-4" />
              Tải từ Google Sheet
            </button>
          </div>
        </div>

        <form onSubmit={handleAddUser} className="space-y-6 mb-12 p-8 bg-neutral-50 dark:bg-slate-800/50 rounded-[24px] border border-neutral-100 dark:border-slate-700">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-1">
              <label className="text-xs font-bold text-neutral-500 uppercase ml-1">Email/Tên đăng nhập</label>
              <input 
                type="text" 
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-neutral-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary outline-none dark:text-white"
                placeholder="admin@example.com"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-neutral-500 uppercase ml-1">Mật khẩu</label>
              <input 
                type="password" 
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-neutral-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary outline-none dark:text-white"
                placeholder="••••••••"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-neutral-500 uppercase ml-1">Vai trò</label>
              <select 
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as 'admin' | 'user')}
                className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-neutral-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary outline-none dark:text-white"
              >
                <option value="user">Người dùng</option>
                <option value="admin">Quản trị viên</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-neutral-500 uppercase ml-1">Mã số thuế</label>
              <input 
                type="text" 
                value={newTaxCode}
                onChange={(e) => setNewTaxCode(e.target.value)}
                className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-neutral-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary outline-none dark:text-white"
                placeholder="Mã số thuế"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-neutral-500 uppercase ml-1">Số máy tối đa</label>
              <input 
                type="number" 
                value={newMaxDevices}
                onChange={(e) => setNewMaxDevices(parseInt(e.target.value))}
                min="1"
                className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-neutral-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary outline-none dark:text-white"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-neutral-500 uppercase ml-1">Ngày hết hạn</label>
              <input 
                type="date" 
                value={newExpiryDate}
                onChange={(e) => setNewExpiryDate(e.target.value)}
                className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-neutral-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary outline-none dark:text-white"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-neutral-500 uppercase ml-1">Tên hộ kinh doanh</label>
              <input 
                type="text" 
                value={newBusinessName}
                onChange={(e) => setNewBusinessName(e.target.value)}
                className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-neutral-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary outline-none dark:text-white"
                placeholder="Tên hộ kinh doanh"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-neutral-500 uppercase ml-1">Chủ hộ</label>
              <input 
                type="text" 
                value={newBusinessOwner}
                onChange={(e) => setNewBusinessOwner(e.target.value)}
                className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-neutral-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary outline-none dark:text-white"
                placeholder="Họ tên chủ hộ"
              />
            </div>
            <div className="md:col-span-3 space-y-1">
              <label className="text-xs font-bold text-neutral-500 uppercase ml-1">Địa chỉ đăng ký</label>
              <input 
                type="text" 
                value={newBusinessAddress}
                onChange={(e) => setNewBusinessAddress(e.target.value)}
                className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-neutral-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary outline-none dark:text-white"
                placeholder="Địa chỉ trên giấy phép"
              />
            </div>
            <div className="md:col-span-3 space-y-1">
              <label className="text-xs font-bold text-neutral-500 uppercase ml-1">Nơi kinh doanh</label>
              <input 
                type="text" 
                value={newBusinessLocation}
                onChange={(e) => setNewBusinessLocation(e.target.value)}
                className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-neutral-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary outline-none dark:text-white"
                placeholder="Địa điểm kinh doanh thực tế"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button 
              type="submit"
              className="px-8 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary-hover transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
            >
              <Plus className="w-5 h-5" />
              Tạo tài khoản mới
            </button>
          </div>
        </form>

        <div className="overflow-hidden border border-neutral-100 dark:border-slate-800 rounded-2xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-neutral-50 dark:bg-slate-800/50 border-b border-neutral-100 dark:border-slate-800">
                <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">Tài khoản</th>
                <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">Vai trò</th>
                <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">MST</th>
                <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-slate-800">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-neutral-50/50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-neutral-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-neutral-500">
                        <User className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-medium text-neutral-900 dark:text-white">{user.email}</span>
                        {user.expiryDate && (
                          <span className="text-[10px] text-neutral-400">Hết hạn: {formatDate(user.expiryDate)}</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider",
                      user.role === 'admin' ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                    )}>
                      {user.role === 'admin' ? 'Quản trị' : 'Người dùng'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-medium text-neutral-600 dark:text-slate-400">{user.taxCode || '-'}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => handleDeleteUser(user.id)}
                      className="p-2 text-neutral-400 hover:text-red-500 transition-colors"
                      title="Xóa tài khoản"
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

  const isAdmin = currentUser?.role === 'admin';
  const effectiveBusinessInfo = businessInfo;

  const subNavItems = [
    { id: 'finance-config', label: 'Cấu hình & Tải dữ liệu', icon: Settings },
    { id: 'finance-ledger', label: 'Sổ chi tiết doanh thu', icon: BarChart3 },
    { id: 'finance-vouchers', label: 'Phiếu Thu - Phiếu Chi', icon: Receipt },
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
    if (!isAdmin) {
      alert('Chỉ quản trị viên mới có thể nhập dữ liệu doanh thu.');
      return;
    }
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
    if (!isAdmin) {
      alert('Chỉ quản trị viên mới có thể nhập dữ liệu chi phí.');
      return;
    }
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
                          new TextRun({ text: sanitizeDocxText("HỘ, CÁ NHÂN KINH DOANH: "), bold: true, size: 24 }),
                          new TextRun({ text: sanitizeDocxText(effectiveBusinessInfo.name?.toUpperCase() || ""), bold: true, size: 24 }),
                        ],
                      }),
                      new Paragraph({
                        children: [
                          new TextRun({ text: sanitizeDocxText("Địa chỉ: "), bold: true, size: 24 }),
                          new TextRun({ text: sanitizeDocxText(effectiveBusinessInfo.address || ""), size: 24 }),
                        ],
                      }),
                      new Paragraph({
                        children: [
                          new TextRun({ text: sanitizeDocxText("Mã số thuế: "), bold: true, size: 24 }),
                          new TextRun({ text: sanitizeDocxText(effectiveBusinessInfo.taxId) || "................", size: 24 }),
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
                              new TextRun({ text: sanitizeDocxText("Mẫu số S1a-HKD"), bold: true, size: 22 }),
                            ],
                          }),
                          new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [
                              new TextRun({ text: sanitizeDocxText("(Kèm theo Thông tư số 152/2025/TT-BTC"), italics: true, size: 20 }),
                            ],
                          }),
                          new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [
                              new TextRun({ text: sanitizeDocxText("ngày 31 tháng 12 năm 2025 của Bộ trưởng Bộ Tài chính)"), italics: true, size: 20 }),
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
              new TextRun({ text: sanitizeDocxText("SỔ CHI TIẾT DOANH THU BÁN HÀNG HÓA, DỊCH VỤ"), bold: true, size: 36 }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: sanitizeDocxText(`Địa điểm kinh doanh: ${effectiveBusinessInfo.businessLocation || effectiveBusinessInfo.address}`), size: 26 }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
            children: [
              new TextRun({ text: sanitizeDocxText(`Kỳ kê khai: ${config.reportPeriod}`), size: 26 }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { after: 200 },
            children: [
              new TextRun({ text: sanitizeDocxText("Đơn vị tính: VNĐ"), italics: true, size: 24 }),
            ],
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: sanitizeDocxText("Ngày tháng"), bold: true, size: 26 })] })], verticalAlign: VerticalAlign.CENTER }),
                  new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: sanitizeDocxText("Giao dịch"), bold: true, size: 26 })] })], verticalAlign: VerticalAlign.CENTER }),
                  new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: sanitizeDocxText("Số tiền"), bold: true, size: 26 })] })], verticalAlign: VerticalAlign.CENTER }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: sanitizeDocxText("A"), italics: true, size: 24 })] })] }),
                  new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: sanitizeDocxText("B"), italics: true, size: 24 })] })] }),
                  new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: sanitizeDocxText("1"), italics: true, size: 24 })] })] }),
                ],
              }),
              ...incomeData.map(item => new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: sanitizeDocxText(formatDate(item.date) || getLastDayOfMonth(config.reportPeriod)), size: 26 })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: sanitizeDocxText(`Thu tiền học phí - ${item.name} ${item.address}`), size: 26 })] })] }),
                  new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: sanitizeDocxText(item.amount.toLocaleString()), size: 26 })] })] }),
                ],
              })),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: sanitizeDocxText("Tổng cộng"), bold: true, size: 26 })] })], columnSpan: 2 }),
                  new TableCell({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: sanitizeDocxText(incomeData.reduce((sum, item) => sum + item.amount, 0).toLocaleString()), bold: true, size: 26 })] })] }),
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
                          new TextRun({ text: sanitizeDocxText("Ngày ...... tháng ...... năm ......"), italics: true, size: 24 }),
                        ],
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({ text: sanitizeDocxText("NGƯỜI ĐẠI DIỆN HỘ KINH DOANH/"), bold: true, size: 24 }),
                        ],
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({ text: sanitizeDocxText("CÁ NHÂN KINH DOANH"), bold: true, size: 24 }),
                        ],
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({ text: sanitizeDocxText("(Ký, ghi rõ họ tên, đóng dấu(nếu có))"), italics: true, size: 20 }),
                        ],
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 1200 },
                        children: [
                          new TextRun({ text: sanitizeDocxText(effectiveBusinessInfo.owner || "................"), bold: true, size: 24 }),
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
    const dateParts = (config.receiptDate || "").split('-');
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
                      new TextRun({ text: effectiveBusinessInfo.name || "................", size: 20 }),
                    ],
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({ text: "Địa chỉ: ", bold: true, size: 20 }),
                      new TextRun({ text: effectiveBusinessInfo.address || "................", size: 20 }),
                    ],
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({ text: "Mã số thuế: ", bold: true, size: 20 }),
                      new TextRun({ text: effectiveBusinessInfo.taxId || "................", size: 20 }),
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
                          new TextRun({ text: sanitizeDocxText("PHIẾU THU"), bold: true, size: 32 }),
                        ],
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({ text: sanitizeDocxText(`Ngày ${d} tháng ${m} năm ${y}`), italics: true, size: 20 }),
                        ],
                      }),
                    ],
                  }),
                  new TableCell({
                    width: { size: 25, type: WidthType.PERCENTAGE },
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({ text: sanitizeDocxText("Quyển số: "), size: 20 }),
                          new TextRun({ text: sanitizeDocxText("................"), size: 20 }),
                        ],
                      }),
                      new Paragraph({
                        children: [
                          new TextRun({ text: sanitizeDocxText("Số: "), size: 20 }),
                          new TextRun({ text: sanitizeDocxText(voucherNo), size: 20 }),
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
          new TextRun({ text: sanitizeDocxText("Họ và tên người nộp tiền: "), size: 26 }),
          new TextRun({ text: sanitizeDocxText(item.name || "................................................................"), bold: true, size: 26 }),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({ text: sanitizeDocxText("Địa chỉ: "), size: 26 }),
          new TextRun({ text: sanitizeDocxText(item.address || "................................................................"), size: 26 }),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({ text: sanitizeDocxText("Lý do nộp: "), size: 26 }),
          new TextRun({ text: sanitizeDocxText(`Nộp tiền học phí ${config.reportPeriod}`), size: 26 }),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({ text: sanitizeDocxText("Số tiền: "), size: 26 }),
          new TextRun({ text: sanitizeDocxText(`${item.amount.toLocaleString()} VNĐ`), bold: true, size: 26 }),
          new TextRun({ text: sanitizeDocxText(" (Viết bằng chữ): "), size: 26 }),
          new TextRun({ text: sanitizeDocxText(numberToVietnameseWords(item.amount)), italics: true, size: 26 }),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({ text: sanitizeDocxText("Kèm theo: "), size: 26 }),
          new TextRun({ text: sanitizeDocxText(`Bảng chấm công và thu tiền ${config.reportPeriod}`), size: 26 }),
          new TextRun({ text: sanitizeDocxText(" Chứng từ gốc: "), size: 26 }),
          new TextRun({ text: sanitizeDocxText("................"), size: 26 }),
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
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: effectiveBusinessInfo.owner || "", bold: true, size: 22 })] }),
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
          new TextRun({ text: sanitizeDocxText("Đã nhận đủ số tiền (viết bằng chữ): "), size: 20 }),
          new TextRun({ text: sanitizeDocxText("...................................................................................................."), size: 20 }),
        ],
      }),
    ];
  };

  const getPaymentVoucherChildren = (item: ExpenseItem, index: number = 0) => {
    const dateParts = (config.paymentDate || "").split('-');
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
                      new TextRun({ text: effectiveBusinessInfo.name || "................", size: 20 }),
                    ],
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({ text: "Địa chỉ: ", bold: true, size: 20 }),
                      new TextRun({ text: effectiveBusinessInfo.address || "................", size: 20 }),
                    ],
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({ text: "Mã số thuế: ", bold: true, size: 20 }),
                      new TextRun({ text: effectiveBusinessInfo.taxId || "................", size: 20 }),
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
                          new TextRun({ text: sanitizeDocxText("PHIẾU CHI"), bold: true, size: 32 }),
                        ],
                      }),
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({ text: sanitizeDocxText(`Ngày ${d} tháng ${m} năm ${y}`), italics: true, size: 20 }),
                        ],
                      }),
                    ],
                  }),
                  new TableCell({
                    width: { size: 25, type: WidthType.PERCENTAGE },
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({ text: sanitizeDocxText("Quyển số: "), size: 20 }),
                          new TextRun({ text: sanitizeDocxText("................"), size: 20 }),
                        ],
                      }),
                      new Paragraph({
                        children: [
                          new TextRun({ text: sanitizeDocxText("Số: "), size: 20 }),
                          new TextRun({ text: sanitizeDocxText(voucherNo), size: 20 }),
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
          new TextRun({ text: sanitizeDocxText("Họ và tên người nhận tiền: "), size: 26 }),
          new TextRun({ text: sanitizeDocxText(item.name || "................................................................"), bold: true, size: 26 }),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({ text: sanitizeDocxText("Địa chỉ: "), size: 26 }),
          new TextRun({ text: sanitizeDocxText(item.address || "................................................................"), size: 26 }),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({ text: sanitizeDocxText("Lý do chi: "), size: 26 }),
          new TextRun({ text: sanitizeDocxText(`Chi tiền học phí ${config.reportPeriod}`), size: 26 }),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({ text: sanitizeDocxText("Số tiền: "), size: 26 }),
          new TextRun({ text: sanitizeDocxText(`${item.amount.toLocaleString()} VNĐ`), bold: true, size: 26 }),
          new TextRun({ text: sanitizeDocxText(" (Viết bằng chữ): "), size: 26 }),
          new TextRun({ text: sanitizeDocxText(numberToVietnameseWords(item.amount)), italics: true, size: 26 }),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({ text: sanitizeDocxText("Kèm theo: "), size: 26 }),
          new TextRun({ text: sanitizeDocxText(`Bảng chấm công và thu tiền ${config.reportPeriod}`), size: 26 }),
          new TextRun({ text: sanitizeDocxText(" Chứng từ gốc: "), size: 26 }),
          new TextRun({ text: sanitizeDocxText("................"), size: 26 }),
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
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: effectiveBusinessInfo.owner || "", bold: true, size: 22 })] }),
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
                  onChange={(e) => isAdmin && setConfig({ ...config, reportPeriod: e.target.value })}
                  disabled={!isAdmin}
                  className="w-full px-4 py-3 bg-neutral-50 dark:bg-slate-800/50 border border-neutral-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white transition-all disabled:opacity-70"
                  placeholder="Tháng 01/2026"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-neutral-700 dark:text-slate-300 ml-1">Ngày xuất phiếu thu</label>
                <input 
                  type="date" 
                  value={config.receiptDate}
                  onChange={(e) => isAdmin && setConfig({ ...config, receiptDate: e.target.value })}
                  disabled={!isAdmin}
                  className="w-full px-4 py-3 bg-neutral-50 dark:bg-slate-800/50 border border-neutral-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white transition-all disabled:opacity-70"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-neutral-700 dark:text-slate-300 ml-1">Ngày xuất phiếu chi</label>
                <input 
                  type="date" 
                  value={config.paymentDate}
                  onChange={(e) => isAdmin && setConfig({ ...config, paymentDate: e.target.value })}
                  disabled={!isAdmin}
                  className="w-full px-4 py-3 bg-neutral-50 dark:bg-slate-800/50 border border-neutral-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white transition-all disabled:opacity-70"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-neutral-700 dark:text-slate-300 ml-1">Người lập biểu</label>
                <input 
                  type="text" 
                  value={config.preparer}
                  onChange={(e) => isAdmin && setConfig({ ...config, preparer: e.target.value })}
                  disabled={!isAdmin}
                  className="w-full px-4 py-3 bg-neutral-50 dark:bg-slate-800/50 border border-neutral-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white transition-all disabled:opacity-70"
                  placeholder="Họ và tên người lập biểu"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-neutral-700 dark:text-slate-300 ml-1">Thủ quỹ</label>
                <input 
                  type="text" 
                  value={config.treasurer}
                  onChange={(e) => isAdmin && setConfig({ ...config, treasurer: e.target.value })}
                  disabled={!isAdmin}
                  className="w-full px-4 py-3 bg-neutral-50 dark:bg-slate-800/50 border border-neutral-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white transition-all disabled:opacity-70"
                  placeholder="Họ và tên thủ quỹ"
                />
              </div>
            </div>
            {isAdmin && (
              <div className="mt-8 flex justify-end pt-6 border-t border-neutral-100 dark:border-slate-800">
                <button 
                  onClick={() => {
                    if (!config.reportPeriod || !config.receiptDate || !config.paymentDate || !config.preparer || !config.treasurer) {
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
            )}
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
              
              {isAdmin && (
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
              )}
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

              {isAdmin && (
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
              )}
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
