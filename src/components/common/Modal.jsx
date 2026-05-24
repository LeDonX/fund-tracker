import React from 'react';
import { X } from 'lucide-react';

export default function Modal({ isOpen, onClose, title, children, maxWidth = 'max-w-md' }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-4 transition-opacity duration-300 ease-out" onClick={onClose}>
      <div 
        className={`bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full ${maxWidth} flex flex-col max-h-[85vh] sm:max-h-[90vh] animate-in slide-in-from-bottom duration-300 ease-out sm:zoom-in-95`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* iOS style Bottom Sheet Drag Handle */}
        <div className="w-10 h-1 bg-slate-300 rounded-full mx-auto mt-3 sm:hidden shrink-0" />
        
        <div className="flex justify-between items-center px-5 py-4 sm:p-5 border-b border-slate-100 flex-shrink-0">
          <h3 className="text-base sm:text-lg font-bold text-slate-800">{title}</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 sm:p-6 overflow-y-auto custom-scrollbar">
          {children}
        </div>
      </div>
    </div>
  );
}
