import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, Camera, AlertCircle, Plus, Trash2, 
  Loader2, Check, X, Search, Image as ImageIcon,
  ArrowRight, FileSpreadsheet, RefreshCw, Key, HelpCircle, Globe
} from 'lucide-react';
import Modal from '../common/Modal';
import { parseOcrText, getTodayDateKey } from '../../domain/fundTrade';

export default function OcrSyncModal({
  isOpen,
  onClose,
  funds = [],
  onConfirmImport,
}) {
  const [dragActive, setDragActive] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [progress, setProgress] = useState(0);
  
  // Parsed transaction rows
  const [rows, setRows] = useState([]);
  
  // Autocomplete search states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [activeSearchIndex, setActiveSearchIndex] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  
  const fileInputRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  // Load Tesseract.js dynamically (Offline Engine)
  const loadTesseract = () => {
    return new Promise((resolve, reject) => {
      if (window.Tesseract) {
        resolve(window.Tesseract);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.0.5/dist/tesseract.min.js';
      script.async = true;
      script.onload = () => {
        if (window.Tesseract) {
          resolve(window.Tesseract);
        } else {
          reject(new Error('Tesseract.js 加载失败'));
        }
      };
      script.onerror = () => reject(new Error('OCR 引擎加载失败，请检查网络连接'));
      document.body.appendChild(script);
    });
  };

  // Resilient Dual-Channel Search (Backend API -> Client JSONP Fallback)
  const searchFundClientSide = (keyword) => {
    return new Promise((resolve, reject) => {
      const callbackName = `search_callback_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const script = document.createElement('script');
      script.src = `https://fundsuggest.eastmoney.com/FundSearch/api/FundSearchAPI.ashx?m=1&key=${encodeURIComponent(keyword)}&callback=${callbackName}`;
      script.async = true;
      
      let settled = false;
      
      const cleanup = () => {
        delete window[callbackName];
        script.remove();
      };
      
      window[callbackName] = (data) => {
        if (settled) return;
        settled = true;
        cleanup();
        
        const rawDatas = data?.Datas || [];
        const results = rawDatas.map(item => ({
          code: item.CODE || "",
          name: item.NAME || "",
          category: item.CATEGORY || "",
          spell: item.SPELL || ""
        }));
        resolve(results);
      };
      
      script.onerror = () => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error('JSONP search failed'));
      };
      
      // Timeout fallback
      setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error('JSONP search timeout'));
      }, 5000);
      
      document.body.appendChild(script);
    });
  };

  const performSearch = async (keyword) => {
    try {
      const res = await fetch(`/api/search?key=${encodeURIComponent(keyword)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.datas) return data.datas;
      }
    } catch (e) {
      console.warn('Backend API search failed, falling back to JSONP client-side suggests', e);
    }
    return await searchFundClientSide(keyword);
  };

  // Run Tesseract.js with 100% Offline Engine
  const performTesseractOcr = async (file) => {
    setIsProcessing(true);
    setStatusText('正在加载本地文字识别引擎...');
    setProgress(20);

    try {
      const Tesseract = await loadTesseract();
      
      setStatusText('正在识别交易记录...');
      setProgress(40);

      const result = await Tesseract.recognize(
        file,
        'chi_sim',
        {
          logger: m => {
            if (m.status === 'recognizing text') {
              setProgress(40 + Math.round(m.progress * 60));
              setStatusText(`正在识别交易记录... (${Math.round(m.progress * 100)}%)`);
            } else if (m.status === 'loading ocr engine') {
              setStatusText('正在加载文字识别引擎...');
            } else if (m.status === 'loading language traineddata') {
              setStatusText('正在加载中文 OCR 语言包 (首次可能稍慢)...');
            } else if (m.status === 'initializing api') {
              setStatusText('正在初始化识别接口...');
            }
          }
        }
      );

      const parsedEntries = parseOcrText(result.data.text);
      
      if (parsedEntries.length === 0) {
        alert('本地离线引擎未提取出交易明细，可能是由于图像文字过小或下载语言包受限。已为您默认创建一条空白记录，支持手动录入。');
        setRows([{
          id: Date.now(),
          code: '',
          name: '',
          type: '买入',
          amount: '',
          fee: '0',
          tradeDate: getTodayDateKey() + ' 10:00:00',
          status: 'unmapped',
          originalName: ''
        }]);
      } else {
        const calculateFuzzyScore = (str1, str2) => {
          if (!str1 || !str2) return 0;
          const s1 = str1.replace(/[^\u4e00-\u9fa5]/g, '');
          const s2 = str2.replace(/[^\u4e00-\u9fa5]/g, '');
          if (!s1 || !s2) return 0;
          
          const set1 = new Set(s1.split(''));
          const set2 = new Set(s2.split(''));
          let matchCount = 0;
          for (const char of set1) {
            if (set2.has(char)) matchCount++;
          }
          return matchCount / Math.max(set1.size, set2.size);
        };

        const loadedRows = parsedEntries.map((entry, index) => {
          // 1. Exact or substring match in funds
          let matchedFund = funds.find(f => 
            f.name.includes(entry.name) || entry.name.includes(f.name)
          );
          
          // 2. Fuzzy match in funds (character overlap > 0.5)
          if (!matchedFund) {
            let bestScore = 0;
            for (const f of funds) {
              const score = calculateFuzzyScore(entry.name, f.name);
              if (score > 0.5 && score > bestScore) {
                bestScore = score;
                matchedFund = f;
              }
            }
          }
          
          return {
            id: Date.now() + index,
            code: matchedFund ? matchedFund.code : '',
            name: matchedFund ? matchedFund.name : entry.name,
            type: entry.type,
            amount: String(entry.amount),
            fee: '0',
            tradeDate: entry.tradeDate,
            status: matchedFund ? 'existing' : 'unmapped',
            originalName: entry.name
          };
        });
        
        setRows(loadedRows);

        // Auto-lookup by unique row.id
        loadedRows.forEach((row) => {
          if (!row.code && row.name) {
            autoLookupFundCode(row.name, row.id);
          }
        });
      }

    } catch (err) {
      console.error(err);
      alert(`本地 OCR 识别出错: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Perform overall OCR with Canvas Auto-Cropper
  const performOcr = async (file) => {
    const imageUrl = URL.createObjectURL(file);
    setImagePreview(imageUrl);

    setIsProcessing(true);
    setStatusText('正在预处理图像（裁剪状态栏以提升精度）...');
    setProgress(10);
    
    const img = new Image();
    img.src = imageUrl;
    img.onload = async () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Crop top 20% (removes battery status bar + "明细 基金 全部" toolbar) 
        // Crop bottom 8% (removes system navigation indicator)
        const cropTop = 0.20;
        const cropBottom = 0.08;
        
        const sourceX = 0;
        const sourceY = img.naturalHeight * cropTop;
        const sourceWidth = img.naturalWidth;
        const sourceHeight = img.naturalHeight * (1 - cropTop - cropBottom);
        
        canvas.width = sourceWidth;
        canvas.height = sourceHeight;
        
        ctx.drawImage(
          img,
          sourceX, sourceY, sourceWidth, sourceHeight,
          0, 0, sourceWidth, sourceHeight
        );
        
        canvas.toBlob(async (blob) => {
          if (blob) {
            const croppedFile = new File([blob], file.name, { type: 'image/png' });
            await performTesseractOcr(croppedFile);
          } else {
            await performTesseractOcr(file);
          }
        }, 'image/png');
        
      } catch (err) {
        console.error('Image crop failed, falling back to original', err);
        await performTesseractOcr(file);
      }
    };
    img.onerror = async () => {
      await performTesseractOcr(file);
    };
  };

  // Automatically lookup code for a fund name with unique row.id matching
  const autoLookupFundCode = async (name, rowId) => {
    try {
      const cleanName = name.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, ''); // Keep Chinese characters, letters, and numbers
      if (cleanName.length < 2) return;
      
      let datas = [];
      try {
        datas = await performSearch(cleanName);
      } catch (searchErr) {
        console.warn('Search failed', searchErr);
      }
      
      // Fallback: If 0 results, try a clean substring search to bypass boundaries typos!
      if (datas.length === 0 && cleanName.length >= 4) {
        const subQuery = cleanName.substring(1, cleanName.length - 1);
        try {
          datas = await performSearch(subQuery);
        } catch (subSearchErr) {
          console.warn('Sub-query search failed', subSearchErr);
        }
      }

      if (datas.length > 0) {
        // Find best match using fuzzy character overlap
        const calculateFuzzyScore = (str1, str2) => {
          if (!str1 || !str2) return 0;
          const s1 = str1.replace(/[^\u4e00-\u9fa5]/g, '');
          const s2 = str2.replace(/[^\u4e00-\u9fa5]/g, '');
          if (!s1 || !s2) return 0;
          const set1 = new Set(s1.split(''));
          const set2 = new Set(s2.split(''));
          let matchCount = 0;
          for (const char of set1) {
            if (set2.has(char)) matchCount++;
          }
          return matchCount / Math.max(set1.size, set2.size);
        };

        let bestMatch = null;
        let bestScore = 0;
        
        for (const item of datas) {
          const score = calculateFuzzyScore(name, item.name);
          if (score > bestScore) {
            bestScore = score;
            bestMatch = item;
          }
        }
        
        // Require a minimum overlap score of 0.45 to prevent random bindings on garbled/insufficient text
        if (bestScore < 0.45) {
          bestMatch = null;
        }
        
        if (!bestMatch) {
          return;
        }
        
        setRows(current => current.map((row) => {
          if (row.id !== rowId) return row;
          const isExisting = funds.some(f => f.code === bestMatch.code);
          return {
            ...row,
            code: bestMatch.code,
            name: bestMatch.name, // Use official name
            status: isExisting ? 'existing' : 'new'
          };
        }));
      }
    } catch (e) {
      console.warn('Auto lookup failed', e);
    }
  };

  // Manual query for suggestions
  const querySuggestions = async (keyword) => {
    if (!keyword || keyword.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const datas = await performSearch(keyword);
      setSearchResults(datas || []);
    } catch (err) {
      console.warn(err);
    } finally {
      setIsSearching(false);
    }
  };

  // Input changes
  const handleRowChange = (id, field, value) => {
    setRows(current => current.map(row => {
      if (row.id !== id) return row;
      
      const updatedRow = { ...row, [field]: value };
      
      // Update status if code changes
      if (field === 'code') {
        const cleanCode = String(value).trim();
        if (cleanCode.length === 6 && /^\d{6}$/.test(cleanCode)) {
          const isExisting = funds.some(f => f.code === cleanCode);
          const matchedName = funds.find(f => f.code === cleanCode)?.name || row.name;
          updatedRow.status = isExisting ? 'existing' : 'new';
          if (matchedName) updatedRow.name = matchedName;
        } else {
          updatedRow.status = 'unmapped';
        }
      }
      
      return updatedRow;
    }));
  };

  // Drag and drop events
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      performOcr(e.dataTransfer.files[0]);
    }
  };

  // Paste handler
  useEffect(() => {
    const handlePaste = (e) => {
      if (!isOpen || isProcessing) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const file = items[i].getAsFile();
          if (file) performOcr(file);
          break;
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen, isProcessing]);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      performOcr(e.target.files[0]);
    }
  };

  const addRow = () => {
    setRows(current => [
      ...current,
      {
        id: Date.now(),
        code: '',
        name: '',
        type: '买入',
        amount: '',
        fee: '0',
        tradeDate: getTodayDateKey() + ' 10:00:00',
        status: 'unmapped',
        originalName: ''
      }
    ]);
  };

  const removeRow = (id) => {
    setRows(current => current.filter(r => r.id !== id));
  };

  const handleSearchCodeClick = (rowId, index) => {
    setActiveSearchIndex(index);
    const row = rows.find(r => r.id === rowId);
    setSearchQuery(row?.code || row?.name || '');
    setSearchResults([]);
  };

  const selectSearchResult = (rowId, selectedFund) => {
    const isExisting = funds.some(f => f.code === selectedFund.code);
    setRows(current => current.map(row => {
      if (row.id !== rowId) return row;
      return {
        ...row,
        code: selectedFund.code,
        name: selectedFund.name,
        status: isExisting ? 'existing' : 'new'
      };
    }));
    setActiveSearchIndex(null);
  };

  const handleSearchInputChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    
    searchTimeoutRef.current = setTimeout(() => {
      querySuggestions(val);
    }, 300);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Check if there are any unmapped codes
    const hasUnmapped = rows.some(r => r.status === 'unmapped' || !r.code || !/^\d{6}$/.test(r.code));
    if (hasUnmapped) {
      alert('请确保表格中所有交易均已绑定有效的 6 位基金代码！');
      return;
    }

    const validRows = rows.map(r => ({
      code: r.code.trim(),
      name: r.name.trim(),
      type: r.type,
      amount: parseFloat(r.amount) || 0,
      fee: parseFloat(r.fee) || 0,
      tradeDate: r.tradeDate
    })).filter(r => r.amount > 0);

    if (validRows.length === 0) {
      alert('没有有效的交易记录可以导入！金额必须大于 0。');
      return;
    }

    onConfirmImport(validRows);
    resetModal();
  };

  const resetModal = () => {
    setImagePreview(null);
    setRows([]);
    setProgress(0);
    setStatusText('');
    setActiveSearchIndex(null);
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={isProcessing ? undefined : () => { resetModal(); onClose(); }} title="📷 支付宝交易截图智能同步" maxWidth="max-w-5xl">
      <div className="space-y-6">
        
        {/* Step 1: Upload Dropzone Area */}
        {rows.length === 0 && !isProcessing && (
          <div 
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-3xl p-16 text-center transition-all cursor-pointer ${dragActive ? 'border-blue-500 bg-blue-50/50 scale-[1.01]' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'}`}
            onClick={() => fileInputRef.current?.click()}
          >
            <input 
              ref={fileInputRef}
              type="file" 
              accept="image/*"
              className="hidden" 
              onChange={handleFileChange}
            />
            <div className="max-w-md mx-auto space-y-4">
              <div className="p-4 bg-blue-50 rounded-2xl w-16 h-16 mx-auto flex items-center justify-center text-blue-600 shadow-inner">
                <Upload className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-800">拖拽、点击上传，或直接 Ctrl+V 粘贴交易截图</h4>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  仅需将支付宝的交易记录列表截图（支持多笔交易）上传到这里，系统将自动识别基金名、买入/卖出类型、金额与发生日期。
                </p>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 border border-indigo-200 text-indigo-800 text-[10px] font-bold rounded-full animate-pulse">
                <Camera className="w-3.5 h-3.5 text-indigo-600" />
                <span>100% 纯本地、离线物理文字识读与智能对齐</span>
              </div>
            </div>
          </div>
        )}

        {/* OCR Progress Loading State */}
        {isProcessing && (
          <div className="bg-slate-50 border border-slate-100 rounded-3xl p-10 flex flex-col items-center justify-center text-center space-y-4 shadow-sm animate-pulse">
            <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
            <div className="space-y-1.5">
              <h5 className="text-sm font-black text-slate-800">{statusText}</h5>
              <p className="text-xs text-slate-400">正在解析图像文字...</p>
            </div>
            
            {/* Real Progress Bar */}
            <div className="w-64 bg-slate-200 h-2.5 rounded-full overflow-hidden shadow-inner">
              <div 
                className="bg-blue-600 h-full rounded-full transition-all duration-300 shadow" 
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs font-black text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full">{progress}%</span>
          </div>
        )}

        {/* Step 2: Confirmation & Mapping Table */}
        {rows.length > 0 && !isProcessing && (
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Info Summary and Reset Option */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-4 bg-slate-50 rounded-2xl border border-slate-150 gap-4 text-xs font-bold shadow-sm">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-blue-500" />
                <span className="text-slate-700">识别成功！共解析出 {rows.length} 笔交易记录。请确认以下数据。</span>
              </div>
              <button 
                type="button" 
                onClick={resetModal}
                className="flex items-center gap-1 text-rose-600 hover:text-rose-700 bg-rose-50 border border-rose-200 px-3 py-1 rounded-xl transition-all"
              >
                <X className="w-3.5 h-3.5" /> 重新上传
              </button>
            </div>

            {/* Interactive Editable Table Container */}
            <div className="border border-slate-200 rounded-3xl overflow-hidden shadow-sm bg-white">
              <div className="overflow-x-auto overflow-y-auto max-h-[380px] custom-scrollbar relative">
                <table className="w-full text-left border-collapse table-fixed min-w-[850px]">
                  <thead className="sticky top-0 bg-slate-50/95 backdrop-blur-xs z-20 shadow-xs">
                    <tr className="border-b border-slate-200 text-[11px] font-black uppercase text-slate-500 tracking-wider">
                      <th className="py-3.5 px-4 w-12 text-center">#</th>
                      <th className="py-3.5 px-4 w-52">基金代码 / 代码搜索</th>
                      <th className="py-3.5 px-4 w-64">识别出的基金名称</th>
                      <th className="py-3.5 px-4 w-28 text-center">类型</th>
                      <th className="py-3.5 px-4 w-28">发生金额 (元)</th>
                      <th className="py-3.5 px-4 w-24">手续费</th>
                      <th className="py-3.5 px-4 w-48">交易日期 / 时间</th>
                      <th className="py-3.5 px-4 w-20 text-center">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {rows.map((row, index) => {
                      const isRowSearching = activeSearchIndex === index;
                      return (
                        <tr key={row.id} className="hover:bg-slate-50/40 transition-colors">
                          <td className="py-3 px-4 text-center font-bold text-slate-400">
                            {index + 1}
                          </td>
                          
                          {/* Code Search column */}
                          <td className="py-3 px-4 relative">
                            {activeSearchIndex === index ? (
                              <div className="absolute inset-x-2 top-2.5 z-30 bg-white border border-slate-300 rounded-xl shadow-xl p-2.5 max-w-sm">
                                <div className="flex items-center gap-1.5 border border-slate-200 rounded-lg px-2 py-1 bg-slate-50">
                                  <Search className="w-4 h-4 text-slate-400" />
                                  <input 
                                    type="text"
                                    value={searchQuery}
                                    onChange={handleSearchInputChange}
                                    placeholder="输入基金名称/拼音/代码搜索"
                                    className="w-full text-xs font-bold text-slate-700 bg-transparent outline-none"
                                    autoFocus
                                  />
                                  <button 
                                    type="button" 
                                    onClick={() => setActiveSearchIndex(null)}
                                    className="p-0.5 hover:bg-slate-200 rounded text-slate-400"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                                
                                {isSearching && (
                                  <div className="flex items-center justify-center py-4 text-[10px] text-slate-400 gap-1.5 font-semibold">
                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
                                    <span>云端搜索中...</span>
                                  </div>
                                )}
                                
                                {!isSearching && searchResults.length === 0 && searchQuery.length >= 2 && (
                                  <div className="py-4 text-center text-[10px] text-slate-400 font-semibold">
                                    未找到匹配基金，请重试
                                  </div>
                                )}
                                
                                {!isSearching && searchResults.length > 0 && (
                                  <div className="max-h-48 overflow-y-auto mt-2 divide-y divide-slate-100 rounded-lg border border-slate-100">
                                    {searchResults.map(result => (
                                      <button
                                        key={result.code}
                                        type="button"
                                        onClick={() => selectSearchResult(row.id, result)}
                                        className="w-full text-left px-2.5 py-2 hover:bg-blue-50 text-[11px] font-bold text-slate-700 flex justify-between items-center transition-colors"
                                      >
                                        <span className="truncate max-w-[180px]">{result.name}</span>
                                        <span className="font-mono text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{result.code}</span>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  required
                                  pattern="\d{6}"
                                  maxLength={6}
                                  value={row.code}
                                  placeholder="未匹配到代码"
                                  onChange={(e) => handleRowChange(row.id, 'code', e.target.value)}
                                  className="w-16 px-1.5 py-1 text-center border border-slate-200 rounded-lg font-mono font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSearchCodeClick(row.id, index)}
                                  className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 rounded-lg transition-colors border border-slate-200/50"
                                  title="搜索绑定基金代码"
                                >
                                  <Search className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </td>
                          
                          {/* Name Input & Status Badge */}
                          <td className="py-3 px-4">
                            <div className="space-y-1">
                              <input 
                                type="text"
                                required
                                value={row.name}
                                onChange={(e) => handleRowChange(row.id, 'name', e.target.value)}
                                className="w-full px-2 py-1 border border-slate-200 rounded-lg font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
                              />
                              <div className="flex items-center gap-2">
                                {/* Status badge */}
                                {row.status === 'existing' && (
                                  <span className="inline-flex items-center gap-0.5 text-[9px] font-black text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">
                                    已持有持仓
                                  </span>
                                )}
                                {row.status === 'new' && (
                                  <span className="inline-flex items-center gap-0.5 text-[9px] font-black text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">
                                    新设自选/持有
                                  </span>
                                )}
                                {row.status === 'unmapped' && (
                                  <span className="inline-flex items-center gap-0.5 text-[9px] font-black text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                                    待绑定代码
                                  </span>
                                )}
                                {row.originalName && row.originalName !== row.name && (
                                  <span className="text-[9px] text-slate-400 font-medium">原图: {row.originalName}</span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Buy/Sell Dropdown */}
                          <td className="py-3 px-4 text-center">
                            <select
                              value={row.type}
                              onChange={(e) => handleRowChange(row.id, 'type', e.target.value)}
                              className="px-2 py-1 border border-slate-200 rounded-lg font-extrabold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
                            >
                              <option value="买入" className="text-rose-600 font-bold">买入 / 加仓</option>
                              <option value="卖出" className="text-emerald-600 font-bold">卖出 / 减仓</option>
                            </select>
                          </td>

                          {/* Amount Input */}
                          <td className="py-3 px-4">
                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              required
                              value={row.amount}
                              placeholder="发生本金"
                              onChange={(e) => handleRowChange(row.id, 'amount', e.target.value)}
                              className="w-full px-2 py-1 border border-slate-200 rounded-lg font-mono font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                          </td>

                          {/* Fee Input */}
                          <td className="py-3 px-4">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={row.fee}
                              placeholder="0"
                              onChange={(e) => handleRowChange(row.id, 'fee', e.target.value)}
                              className="w-full px-1.5 py-1 border border-slate-200 rounded-lg font-mono font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                          </td>

                          {/* Date input */}
                          <td className="py-3 px-4">
                            <input
                              type="text"
                              required
                              placeholder="YYYY-MM-DD HH:mm:ss"
                              value={row.tradeDate}
                              onChange={(e) => handleRowChange(row.id, 'tradeDate', e.target.value)}
                              className="w-full px-2 py-1 border border-slate-200 rounded-lg font-mono text-[11px] font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                          </td>

                          {/* Remove button */}
                          <td className="py-3 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => removeRow(row.id)}
                              className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-all border border-transparent hover:border-rose-100"
                              title="删除此行"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

            </div>

            {/* Form Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button 
                type="button" 
                onClick={() => { resetModal(); onClose(); }} 
                className="px-4 py-2.5 text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl font-bold transition-all"
              >
                取消
              </button>
              <button
                type="submit"
                className="flex items-center gap-2 px-6 py-2.5 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-xl font-bold transition-all shadow-sm hover:shadow hover:scale-[1.01]"
              >
                <Check className="w-4 h-4" />
                <span>确认导入所选 {rows.length} 笔交易</span>
              </button>
            </div>

          </form>
        )}

      </div>
    </Modal>
  );
}
