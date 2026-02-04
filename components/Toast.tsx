import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

interface ToastProps {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed top-10 left-1/2 -translate-x-1/2 z-[200] animate-in fade-in slide-in-from-top-4 duration-300">
      <div className={`flex items-center space-x-3 px-6 py-4 rounded-2xl shadow-2xl border ${
        type === 'success' ? 'bg-black text-white border-black/10' : 'bg-red-50 text-red-600 border-red-100'
      }`}>
        {type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
        <span className="text-sm font-bold tracking-tight">{message}</span>
        <button onClick={onClose} className="opacity-50 hover:opacity-100 transition-opacity pl-2">
          <X size={14} />
        </button>
      </div>
    </div>
  );
};

export default Toast;