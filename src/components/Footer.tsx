import React, { useState } from 'react';
import { X, Info, ShieldCheck, Zap, HelpCircle, CreditCard, Layers, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const Footer: React.FC = () => {
  const [activeModal, setActiveModal] = useState<{ title: string; content: React.ReactNode } | null>(null);

  const handleLinkClick = (e: React.MouseEvent, link: string) => {
    e.preventDefault();
    let content: React.ReactNode = null;
    let title = link;

    switch (link) {
      case 'Về chúng tôi':
        content = (
          <div className="space-y-4">
            <p className="text-neutral-600 dark:text-slate-300 leading-relaxed">
              Chào mừng Quý Thầy Cô đến với <span className="font-bold text-primary">HOÀNG GIA</span>. 
              Hệ thống được thiết kế tối ưu dành riêng cho các thầy cô và trung tâm dạy thêm.
            </p>
            <p className="text-neutral-600 dark:text-slate-300 leading-relaxed">
              Bao gồm các chương trình: 
              <span className="text-blue-600 font-bold"> Quản lý học sinh</span>, 
              <span className="text-emerald-600 font-bold"> Quản lý chương trình dạy</span>, 
              <span className="text-amber-600 font-bold"> Quản lý tài chính</span>.
            </p>
            <p className="text-neutral-600 dark:text-slate-300 leading-relaxed">
              Chúng tôi cung cấp các công cụ mạnh mẽ để quản lý học sinh, chương trình giảng dạy và tài chính, 
              giúp Quý Thầy Cô tập trung hoàn toàn vào sứ mệnh truyền đạt tri thức.
            </p>
          </div>
        );
        break;
      case 'Tính năng hệ thống':
        content = (
          <ul className="space-y-3">
            {[
              { label: 'Cấu hình hộ kinh doanh', icon: RotateCcw, color: 'text-blue-500' },
              { label: 'Quản lý học sinh', icon: Layers, color: 'text-emerald-500' },
              { label: 'Quản lý tài chính', icon: CreditCard, color: 'text-amber-500' },
              { label: 'Quản lý chương trình dạy', icon: Zap, color: 'text-purple-500' }
            ].map((item, idx) => (
              <li key={idx} className="flex items-center gap-3 p-3 rounded-xl bg-neutral-50 dark:bg-slate-800/50 border border-neutral-100 dark:border-slate-700">
                <item.icon className={`w-5 h-5 ${item.color}`} />
                <span className="font-medium text-neutral-700 dark:text-slate-200">{item.label}</span>
              </li>
            ))}
          </ul>
        );
        break;
      case 'Bảng giá dịch vụ':
      case 'Điều khoản sử dụng':
      case 'Quy định vận hành':
        content = (
          <div className="p-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30 rounded-2xl text-center">
            <p className="text-amber-800 dark:text-amber-400 font-bold text-lg">
              Liên hệ admin - zalo 0366000555 để nắm được chi tiết
            </p>
          </div>
        );
        break;
      case 'Trung tâm hỗ trợ':
        content = (
          <div className="p-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 rounded-2xl text-center">
            <p className="text-blue-800 dark:text-blue-400 font-bold text-lg">
              Liên hệ admin - zalo 0366000555
            </p>
          </div>
        );
        break;
      case 'Chính sách bảo mật':
        content = (
          <div className="p-6 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl text-center">
            <p className="text-emerald-800 dark:text-emerald-400 font-bold text-lg">
              Mỗi tài khoản được cấu hình riêng để sử dụng.
            </p>
          </div>
        );
        break;
      default:
        content = <p>Thông tin đang được cập nhật...</p>;
    }

    setActiveModal({ title, content });
  };

  return (
    <footer className="bg-[#f5f6f8] dark:bg-slate-900/50 py-16 px-4 lg:px-8 mt-12 border-t border-neutral-200 dark:border-slate-800 rounded-t-[3rem]">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 lg:gap-24">
          {/* Column 1: Brand & Info */}
          <div className="space-y-6">
            <div>
              <h2 className="text-3xl font-black text-neutral-900 dark:text-white tracking-tighter mb-2">HOÀNG GIA</h2>
              <p className="text-[#0078D4] font-bold text-sm tracking-wide uppercase">Trao cơ hội - Nhận niềm tin</p>
            </div>
            <p className="text-neutral-500 dark:text-slate-400 text-sm leading-relaxed max-w-md">
              Giải pháp quản lý giáo dục chuyên biệt dành cho giáo viên và các trung tâm dạy thêm, giúp tối ưu hóa việc quản lý học sinh, chương trình giảng dạy và tài chính một cách hiệu quả.
            </p>
            <div className="space-y-3 text-sm text-neutral-600 dark:text-slate-400">
              <div className="flex items-start gap-3">
                <span className="font-bold text-neutral-900 dark:text-white shrink-0">Địa chỉ:</span>
                <span>267 Lê Duẩn, P. Tân Phong, TP. Lai Châu</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-bold text-neutral-900 dark:text-white shrink-0">Zalo:</span>
                <span className="text-[#0078D4] font-bold">0366.000.555</span>
              </div>
            </div>
            
            {/* Social Icons */}
            <div className="flex gap-3 pt-4">
              {['FB', 'IN', 'TW', 'YT'].map((social) => (
                <a 
                  key={social}
                  href="#" 
                  className="w-10 h-10 bg-white dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 rounded-xl flex items-center justify-center text-xs font-black text-neutral-400 hover:text-[#0078D4] hover:border-[#0078D4] hover:shadow-lg hover:shadow-[#0078D4]/10 transition-all duration-300"
                >
                  {social}
                </a>
              ))}
            </div>
          </div>

          {/* Column 2: Discover */}
          <div className="space-y-8">
            <h3 className="text-sm font-black text-neutral-900 dark:text-white uppercase tracking-[0.2em]">KHÁM PHÁ</h3>
            <ul className="space-y-4">
              {['Về chúng tôi', 'Tính năng hệ thống', 'Bảng giá dịch vụ', 'Trung tâm hỗ trợ'].map((link) => (
                <li key={link}>
                  <a 
                    href="#" 
                    onClick={(e) => handleLinkClick(e, link)}
                    className="text-neutral-500 dark:text-slate-400 hover:text-[#0078D4] dark:hover:text-[#0078D4] text-sm font-medium transition-colors duration-200 flex items-center group"
                  >
                    <span className="w-0 group-hover:w-2 h-[2px] bg-[#0078D4] mr-0 group-hover:mr-2 transition-all duration-300"></span>
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3: Legal */}
          <div className="space-y-8">
            <h3 className="text-sm font-black text-neutral-900 dark:text-white uppercase tracking-[0.2em]">PHÁP LÝ</h3>
            <ul className="space-y-4">
              {['Điều khoản sử dụng', 'Chính sách bảo mật', 'Quy định vận hành'].map((link) => (
                <li key={link}>
                  <a 
                    href="#" 
                    onClick={(e) => handleLinkClick(e, link)}
                    className="text-neutral-500 dark:text-slate-400 hover:text-[#0078D4] dark:hover:text-[#0078D4] text-sm font-medium transition-colors duration-200 flex items-center group"
                  >
                    <span className="w-0 group-hover:w-2 h-[2px] bg-[#0078D4] mr-0 group-hover:mr-2 transition-all duration-300"></span>
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-16 pt-8 border-t border-neutral-200/50 dark:border-slate-800/50 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-neutral-400 dark:text-slate-500 font-medium uppercase tracking-widest">
            © {new Date().getFullYear()} HOÀNG GIA EDUCATION. ALL RIGHTS RESERVED.
          </p>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] font-bold text-neutral-400 dark:text-slate-500 uppercase tracking-widest">System Status: Operational</span>
          </div>
        </div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {activeModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden border border-neutral-100 dark:border-slate-800"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                      <Info className="w-5 h-5" />
                    </div>
                    <h3 className="text-xl font-black text-neutral-900 dark:text-white tracking-tight">{activeModal.title}</h3>
                  </div>
                  <button 
                    onClick={() => setActiveModal(null)}
                    className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-slate-800 flex items-center justify-center text-neutral-500 hover:bg-red-500 hover:text-white transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="py-2">
                  {activeModal.content}
                </div>
                <div className="mt-8 pt-6 border-t border-neutral-100 dark:border-slate-800 flex justify-end">
                  <button 
                    onClick={() => setActiveModal(null)}
                    className="px-6 py-3 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity"
                  >
                    Đóng
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </footer>
  );
};

export default Footer;
