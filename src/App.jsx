import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  RefreshCw, 
  Download, 
  Upload, 
  ArrowRightLeft, 
  TrendingUp, 
  Wallet,
  Settings,
  History,
  ChevronDown,
  ChevronRight,
  FolderPlus,
  X,
  FileText,
  AlertCircle,
  Trash2
} from 'lucide-react';

// --- 模拟初始数据 ---
const INITIAL_SECTORS = ['大消费', '科技半导体', '医疗医药', '均衡宽基'];

const MOCK_DATA = [
  { id: 1, name: '招商中证白酒指数', code: '161725', sector: '大消费', amount: 50000, dailyRate: 2.34, dailyProfit: 1170, totalProfit: 12500, totalRate: 25.00, weeklyProfit: -300, monthlyProfit: 2100 },
  { id: 2, name: '易方达消费行业', code: '110022', sector: '大消费', amount: 30000, dailyRate: 1.20, dailyProfit: 360, totalProfit: -1500, totalRate: -5.00, weeklyProfit: 150, monthlyProfit: 400 },
  { id: 3, name: '诺安成长混合', code: '320007', sector: '科技半导体', amount: 45000, dailyRate: -3.50, dailyProfit: -1575, totalProfit: -8000, totalRate: -17.78, weeklyProfit: -2500, monthlyProfit: -4000 },
  { id: 4, name: '银河创新成长', code: '519674', sector: '科技半导体', amount: 20000, dailyRate: -2.10, dailyProfit: -420, totalProfit: 4000, totalRate: 20.00, weeklyProfit: -800, monthlyProfit: 1200 },
  { id: 5, name: '中欧医疗健康', code: '003095', sector: '医疗医药', amount: 60000, dailyRate: 0.50, dailyProfit: 300, totalProfit: -12000, totalRate: -20.00, weeklyProfit: 600, monthlyProfit: -1000 },
  { id: 6, name: '工银前沿医疗', code: '001717', sector: '医疗医药', amount: 25000, dailyRate: 0.80, dailyProfit: 200, totalProfit: 1500, totalRate: 6.00, weeklyProfit: 400, monthlyProfit: 800 },
  { id: 7, name: '易方达蓝筹精选', code: '005827', sector: '均衡宽基', amount: 100000, dailyRate: 1.05, dailyProfit: 1050, totalProfit: -5000, totalRate: -5.00, weeklyProfit: 1200, monthlyProfit: 3500 },
  { id: 8, name: '富国天惠成长', code: '161005', sector: '均衡宽基', amount: 80000, dailyRate: 0.90, dailyProfit: 720, totalProfit: 18000, totalRate: 22.50, weeklyProfit: 900, monthlyProfit: 2500 },
  { id: 9, name: '景顺长城鼎益', code: '162605', sector: '均衡宽基', amount: 40000, dailyRate: 1.15, dailyProfit: 460, totalProfit: 3000, totalRate: 7.50, weeklyProfit: 500, monthlyProfit: 1100 },
  { id: 10, name: '万家行业优选', code: '161903', sector: '科技半导体', amount: 35000, dailyRate: -1.80, dailyProfit: -630, totalProfit: -2000, totalRate: -5.71, weeklyProfit: -1200, monthlyProfit: -800 },
];

// --- 模拟交易记录数据生成器 ---
const generateMockHistory = () => {
  return [
    { id: 101, date: '2026-03-15', type: '买入', amount: 10000, status: '确认成功' },
    { id: 102, date: '2026-02-20', type: '买入', amount: 20000, status: '确认成功' },
    { id: 103, date: '2025-12-10', type: '分红', amount: 500, status: '已发放' },
    { id: 104, date: '2025-08-05', type: '买入', amount: 30000, status: '确认成功' },
  ];
};

// --- 辅助组件：涨跌颜色格式化 ---
const FormatNumber = ({ value, isPercent = false, isCurrency = false, showSign = true }) => {
  if (value === 0 || value === undefined) return <span className="text-slate-500">0.00</span>;
  
  const colorClass = value > 0 ? 'text-red-500' : 'text-green-500';
  const sign = value > 0 && showSign ? '+' : '';
  
  let formattedValue = Math.abs(value).toFixed(2);
  if (isCurrency) {
    formattedValue = Math.abs(value).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  return (
    <span className={`font-medium ${colorClass}`}>
      {sign}{value < 0 ? '-' : ''}{formattedValue}{isPercent ? '%' : ''}
    </span>
  );
};

// --- 辅助组件：弹窗 Modal ---
const Modal = ({ isOpen, onClose, title, children, maxWidth = "max-w-md" }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className={`bg-white rounded-2xl shadow-xl w-full ${maxWidth} flex flex-col max-h-[90vh]`}>
        <div className="flex justify-between items-center p-5 border-b border-slate-100 flex-shrink-0">
          <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
};

export default function FundTrackerApp() {
  const [funds, setFunds] = useState(MOCK_DATA);
  const [sectors, setSectors] = useState(INITIAL_SECTORS);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // 折叠状态控制
  const [collapsedGroups, setCollapsedGroups] = useState(new Set());

  // 记录当前操作的基金（用于查看历史和设置）
  const [selectedFund, setSelectedFund] = useState(null);

  // 各类弹窗状态
  const [modals, setModals] = useState({
    group: false,
    fund: false,
    sync: false,
    import: false,
    export: false,
    history: false,
    settings: false
  });

  const openModal = (type) => setModals(prev => ({ ...prev, [type]: true }));
  const closeModal = (type) => setModals(prev => ({ ...prev, [type]: false }));

  // 表单状态
  const [newGroupName, setNewGroupName] = useState('');
  const [fundForm, setFundForm] = useState({ name: '', code: '', sector: INITIAL_SECTORS[0], amount: '' });
  const [syncForm, setSyncForm] = useState({ code: '', type: '买入', amount: '', date: new Date().toISOString().split('T')[0] });
  // 编辑表单状态
  const [editForm, setEditForm] = useState({ id: null, name: '', code: '', sector: '', amount: '' });

  // --- 数据计算与分组 ---
  const { groupedFunds, totalDailyProfit, totalAmount, totalProfit } = useMemo(() => {
    let tDaily = 0;
    let tAmount = 0;
    let tProfit = 0;
    
    const groups = sectors.reduce((acc, sector) => {
      acc[sector] = { funds: [], sectorDailyProfit: 0, sectorAmount: 0 };
      return acc;
    }, {});

    funds.forEach((fund) => {
      const targetSector = groups[fund.sector] ? fund.sector : (groups['其他'] ? '其他' : sectors[0]);
      
      if (!groups[targetSector]) {
         groups[targetSector] = { funds: [], sectorDailyProfit: 0, sectorAmount: 0 };
      }

      groups[targetSector].funds.push(fund);
      groups[targetSector].sectorDailyProfit += fund.dailyProfit;
      groups[targetSector].sectorAmount += fund.amount;
      
      tDaily += fund.dailyProfit;
      tAmount += fund.amount;
      tProfit += fund.totalProfit;
    });

    return { groupedFunds: groups, totalDailyProfit: tDaily, totalAmount: tAmount, totalProfit: tProfit };
  }, [funds, sectors]);

  // --- 交互处理 ---
  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const toggleGroup = (sector) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(sector)) next.delete(sector);
      else next.add(sector);
      return next;
    });
  };

  const handleCreateGroup = (e) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    if (!sectors.includes(newGroupName.trim())) {
      setSectors([...sectors, newGroupName.trim()]);
      if (!fundForm.sector) setFundForm({...fundForm, sector: newGroupName.trim()});
    }
    setNewGroupName('');
    closeModal('group');
  };

  const handleAddFund = (e) => {
    e.preventDefault();
    if (!fundForm.name || !fundForm.code || !fundForm.sector) return;

    const newFund = {
      id: Date.now(),
      name: fundForm.name,
      code: fundForm.code,
      sector: fundForm.sector,
      amount: Number(fundForm.amount) || 0,
      dailyRate: 0, dailyProfit: 0, totalProfit: 0, totalRate: 0, weeklyProfit: 0, monthlyProfit: 0
    };

    setFunds([...funds, newFund]);
    closeModal('fund');
    setFundForm({ name: '', code: '', sector: sectors[0] || '', amount: '' });
    
    if (collapsedGroups.has(newFund.sector)) {
      toggleGroup(newFund.sector);
    }
  };

  const handleSyncTrade = (e) => {
    e.preventDefault();
    const existingFundIndex = funds.findIndex(f => f.code === syncForm.code);
    if (existingFundIndex !== -1) {
       const updatedFunds = [...funds];
       const amountChange = syncForm.type === '买入' ? Number(syncForm.amount) : -Number(syncForm.amount);
       updatedFunds[existingFundIndex].amount = Math.max(0, updatedFunds[existingFundIndex].amount + amountChange);
       setFunds(updatedFunds);
    }
    closeModal('sync');
    setSyncForm({ code: '', type: '买入', amount: '', date: new Date().toISOString().split('T')[0] });
  };

  // --- 操作列交互处理 ---
  const handleOpenHistory = (fund) => {
    setSelectedFund(fund);
    openModal('history');
  };

  const handleOpenSettings = (fund) => {
    setEditForm({ ...fund });
    openModal('settings');
  };

  const handleUpdateFund = (e) => {
    e.preventDefault();
    setFunds(funds.map(f => 
      f.id === editForm.id 
        ? { ...f, name: editForm.name, code: editForm.code, sector: editForm.sector, amount: Number(editForm.amount) } 
        : f
    ));
    closeModal('settings');
  };

  const handleDeleteFund = () => {
    // iframe环境不使用window.confirm，直接执行删除逻辑
    setFunds(funds.filter(f => f.id !== editForm.id));
    closeModal('settings');
  };


  return (
    <div className="h-screen bg-slate-50 flex flex-col font-sans text-slate-800 overflow-hidden">
      <div className="flex-1 flex flex-col max-w-7xl mx-auto w-full p-4 md:p-6 gap-6 h-full">
        
        {/* --- 顶部 Header 与 核心指标 --- */}
        <header className="flex-shrink-0 flex flex-col lg:flex-row justify-between items-start lg:items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="text-red-500 w-7 h-7" />
              养基宝 <span className="text-sm font-normal text-slate-500 ml-2 bg-slate-100 px-2 py-1 rounded-md">V1.3.0</span>
            </h1>
            <p className="text-slate-500 text-sm mt-1">全天候追踪您的基金投资组合表现</p>
          </div>
          
          <div className="flex flex-wrap gap-6 lg:gap-8 mt-4 lg:mt-0">
            <div className="flex flex-col items-end">
              <span className="text-slate-500 text-sm mb-1">总持仓金额 (元)</span>
              <span className="text-xl lg:text-2xl font-bold text-slate-900">
                ¥ {totalAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="hidden lg:block w-px bg-slate-200 h-12 self-center"></div>
            <div className="flex flex-col items-end">
              <span className="text-slate-500 text-sm mb-1">累计总收益</span>
              <span className="text-lg lg:text-xl font-bold">
                <FormatNumber value={totalProfit} isCurrency={true} />
              </span>
            </div>
            <div className="hidden lg:block w-px bg-slate-200 h-12 self-center"></div>
            <div className="flex flex-col items-end">
              <span className="text-slate-500 text-sm mb-1">当日估算盈亏 (元)</span>
              <span className="text-2xl lg:text-3xl font-black">
                <FormatNumber value={totalDailyProfit} isCurrency={true} />
              </span>
            </div>
          </div>
        </header>

        {/* --- 工具栏 --- */}
        <div className="flex-shrink-0 flex flex-wrap justify-between items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-100">
          <div className="flex flex-wrap gap-2">
            <button onClick={() => openModal('fund')} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm shadow-sm">
              <Plus className="w-4 h-4" /> 新增持仓
            </button>
            <button onClick={() => openModal('group')} className="flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-4 py-2 rounded-lg font-medium transition-colors text-sm border border-indigo-200">
              <FolderPlus className="w-4 h-4" /> 创建分组
            </button>
            <button onClick={() => openModal('sync')} className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg font-medium transition-colors text-sm border border-slate-200">
              <ArrowRightLeft className="w-4 h-4" /> 同步交易
            </button>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <button onClick={() => openModal('import')} className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-600 px-3 py-2 rounded-lg font-medium transition-colors text-sm border border-slate-200">
              <Upload className="w-4 h-4" /> 导入
            </button>
            <button onClick={() => openModal('export')} className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-600 px-3 py-2 rounded-lg font-medium transition-colors text-sm border border-slate-200">
              <Download className="w-4 h-4" /> 导出
            </button>
            <button onClick={handleRefresh} className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-600 px-3 py-2 rounded-lg font-medium transition-colors text-sm border border-slate-200 ml-0 lg:ml-2">
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-500' : ''}`} />
              刷新估值
            </button>
          </div>
        </div>

        {/* --- 主体表格区 (带内部滚动，表头固定) --- */}
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col min-h-[300px] overflow-hidden">
          <div className="flex-1 overflow-auto relative custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider shadow-[0_1px_0_0_#e2e8f0]">
                  <th className="p-4 font-medium bg-slate-50">基金名称 (代码)</th>
                  <th className="p-4 font-medium text-right bg-slate-50">持仓金额</th>
                  <th className="p-4 font-medium text-right bg-slate-50">当日估算涨幅</th>
                  <th className="p-4 font-medium text-right bg-blue-50/80">当日估算收益</th>
                  <th className="p-4 font-medium text-right bg-slate-50">持有收益率</th>
                  <th className="p-4 font-medium text-right bg-slate-50">持有总收益</th>
                  <th className="p-4 font-medium text-right bg-slate-50">本周收益</th>
                  <th className="p-4 font-medium text-right bg-slate-50">本月收益</th>
                  <th className="p-4 font-medium text-center bg-slate-50">操作</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(groupedFunds).map(([sector, data]) => {
                  const isCollapsed = collapsedGroups.has(sector);
                  return (
                    <React.Fragment key={sector}>
                      <tr className="bg-slate-100/70 border-b border-slate-200 group hover:bg-slate-100 transition-colors">
                        <td colSpan={9} className="p-0">
                          <div 
                            className="flex items-center justify-between px-4 py-2.5 border-l-4 border-blue-500 cursor-pointer select-none"
                            onClick={() => toggleGroup(sector)}
                          >
                            <span className="font-semibold text-slate-700 text-sm flex items-center gap-2">
                              {isCollapsed ? <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600" /> : <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />}
                              <Wallet className="w-4 h-4 text-slate-500" />
                              {sector}
                              <span className="text-xs font-normal text-slate-500 ml-2 bg-white px-2 py-0.5 rounded border border-slate-200">
                                {data.funds.length} 支
                              </span>
                            </span>
                            <div className="flex items-center gap-6 text-sm pr-4">
                              <span className="text-slate-500">板块持仓: <span className="font-medium text-slate-800">¥{data.sectorAmount.toLocaleString()}</span></span>
                              <span className="text-slate-500">当日盈亏: </span>
                              <span className="text-base">
                                <FormatNumber value={data.sectorDailyProfit} isCurrency={true} />
                              </span>
                            </div>
                          </div>
                        </td>
                      </tr>
                      
                      {!isCollapsed && data.funds.length === 0 && (
                        <tr className="border-b border-slate-100">
                          <td colSpan={9} className="p-6 text-center text-sm text-slate-400 bg-white">
                            该分组下暂无持仓
                          </td>
                        </tr>
                      )}

                      {!isCollapsed && data.funds.map((fund) => (
                        <tr key={fund.id} className="border-b border-slate-100 hover:bg-blue-50/30 transition-colors bg-white">
                          <td className="p-4">
                            <div className="font-medium text-slate-800">{fund.name}</div>
                            <div className="text-xs text-slate-400 mt-0.5">{fund.code}</div>
                          </td>
                          <td className="p-4 text-right font-medium text-slate-700">
                            ¥{fund.amount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-4 text-right">
                            <FormatNumber value={fund.dailyRate} isPercent={true} />
                          </td>
                          <td className="p-4 text-right bg-blue-50/10 font-bold text-base">
                            <FormatNumber value={fund.dailyProfit} isCurrency={true} />
                          </td>
                          <td className="p-4 text-right">
                            <FormatNumber value={fund.totalRate} isPercent={true} />
                          </td>
                          <td className="p-4 text-right">
                            <FormatNumber value={fund.totalProfit} isCurrency={true} />
                          </td>
                          <td className="p-4 text-right">
                            <FormatNumber value={fund.weeklyProfit} />
                          </td>
                          <td className="p-4 text-right">
                            <FormatNumber value={fund.monthlyProfit} />
                          </td>
                          <td className="p-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button 
                                onClick={() => handleOpenHistory(fund)}
                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-100 rounded transition-colors" 
                                title="交易记录"
                              >
                                <History className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleOpenSettings(fund)}
                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-100 rounded transition-colors" 
                                title="设置"
                              >
                                <Settings className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
          {funds.length === 0 && (
             <div className="p-12 text-center text-slate-500 absolute inset-0 flex items-center justify-center pointer-events-none">
               暂无基金持仓数据，请点击上方“新增持仓”添加
             </div>
          )}
        </div>
      </div>

      {/* --- 样式注入：用于美化滚动条 --- */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}} />

      {/* ======================= 所有弹窗组件 ======================= */}

      {/* 1. 创建分组 Modal */}
      <Modal isOpen={modals.group} onClose={() => closeModal('group')} title="创建新分组">
        {/* ... (原有逻辑保持不变) */}
        <form onSubmit={handleCreateGroup} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">分组名称</label>
            <input 
              type="text" required autoFocus value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="如：海外QDII、固收+" 
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => closeModal('group')} className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium transition-colors">取消</button>
            <button type="submit" className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors">确认创建</button>
          </div>
        </form>
      </Modal>

      {/* 2. 新增持仓 Modal */}
      <Modal isOpen={modals.fund} onClose={() => closeModal('fund')} title="新增基金持仓" maxWidth="max-w-lg">
        {/* ... (原有逻辑保持不变) */}
        <form onSubmit={handleAddFund} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">基金名称</label>
            <input 
              type="text" required value={fundForm.name} onChange={(e) => setFundForm({...fundForm, name: e.target.value})}
              placeholder="如：易方达蓝筹精选" 
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">基金代码</label>
              <input 
                type="text" required value={fundForm.code} onChange={(e) => setFundForm({...fundForm, code: e.target.value})}
                placeholder="如：005827" 
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">所属分组</label>
              <select 
                value={fundForm.sector} onChange={(e) => setFundForm({...fundForm, sector: e.target.value})}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              >
                {sectors.map(sector => <option key={sector} value={sector}>{sector}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">初始持仓金额 (元)</label>
            <input 
              type="number" min="0" step="0.01" required value={fundForm.amount} onChange={(e) => setFundForm({...fundForm, amount: e.target.value})}
              placeholder="请输入金额" 
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-6">
            <button type="button" onClick={() => closeModal('fund')} className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium transition-colors">取消</button>
            <button type="submit" className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors">保存持仓</button>
          </div>
        </form>
      </Modal>

      {/* 3. 同步交易 Modal */}
      <Modal isOpen={modals.sync} onClose={() => closeModal('sync')} title="同步交易记录" maxWidth="max-w-md">
        {/* ... (原有逻辑保持不变) */}
        <div className="bg-blue-50 text-blue-800 p-3 rounded-lg flex items-start gap-2 mb-4 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p>录入交易记录将自动更新您的持仓金额与成本计算。</p>
        </div>
        <form onSubmit={handleSyncTrade} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">基金代码/拼音简写</label>
            <input 
              type="text" required value={syncForm.code} onChange={(e) => setSyncForm({...syncForm, code: e.target.value})}
              placeholder="输入代码选择现有基金" 
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">交易类型</label>
              <select 
                value={syncForm.type} onChange={(e) => setSyncForm({...syncForm, type: e.target.value})}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              >
                <option value="买入">买入 / 申购</option>
                <option value="卖出">卖出 / 赎回</option>
                <option value="分红">分红</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">交易日期</label>
              <input 
                type="date" required value={syncForm.date} onChange={(e) => setSyncForm({...syncForm, date: e.target.value})}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">确认金额 (元)</label>
            <input 
              type="number" min="0" step="0.01" required value={syncForm.amount} onChange={(e) => setSyncForm({...syncForm, amount: e.target.value})}
              placeholder="请输入发生金额" 
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-6">
            <button type="button" onClick={() => closeModal('sync')} className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium transition-colors">取消</button>
            <button type="submit" className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors">确认同步</button>
          </div>
        </form>
      </Modal>

      {/* 4. 导入/导出 Modals (折叠省略展示，保持原有功能) */}
      <Modal isOpen={modals.import} onClose={() => closeModal('import')} title="导入基金数据">
        <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:bg-slate-50 transition-colors cursor-pointer">
          <Upload className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <p className="text-slate-700 font-medium">点击或拖拽文件到此处</p>
          <p className="text-slate-400 text-sm mt-1">支持 Excel (.xlsx, .xls) 或 CSV 格式</p>
        </div>
        <div className="flex justify-end gap-3 pt-6">
          <button type="button" onClick={() => closeModal('import')} className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium">取消</button>
          <button type="button" className="px-4 py-2 text-white bg-slate-300 rounded-lg font-medium cursor-not-allowed">开始导入</button>
        </div>
      </Modal>

      <Modal isOpen={modals.export} onClose={() => closeModal('export')} title="导出基金数据">
        <div className="space-y-4">
          <p className="text-slate-600 text-sm">选择您要导出的数据内容，系统将生成 Excel 文件供您下载分析。</p>
          <div className="space-y-2">
            <label className="flex items-center gap-2 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
              <input type="radio" name="exportType" defaultChecked className="w-4 h-4 text-blue-600 focus:ring-blue-500" />
              <span className="text-slate-700">当前持仓快照</span>
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-6 border-t border-slate-100 mt-6">
          <button type="button" onClick={() => closeModal('export')} className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium">取消</button>
          <button type="button" onClick={() => closeModal('export')} className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium flex items-center gap-2"><Download className="w-4 h-4" /> 立即导出</button>
        </div>
      </Modal>

      {/* 6. 查看交易记录 Modal (新增) */}
      <Modal isOpen={modals.history} onClose={() => closeModal('history')} title={`${selectedFund?.name || '基金'} - 交易记录`} maxWidth="max-w-lg">
        <div className="space-y-4">
          <div className="flex justify-between items-center text-sm mb-2">
            <span className="text-slate-500">基金代码: {selectedFund?.code}</span>
            <span className="text-slate-500">当前持仓: <span className="font-medium text-slate-800">¥{selectedFund?.amount.toLocaleString()}</span></span>
          </div>
          
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="p-3 font-medium">日期</th>
                  <th className="p-3 font-medium">类型</th>
                  <th className="p-3 font-medium text-right">金额(元)</th>
                  <th className="p-3 font-medium text-center">状态</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {generateMockHistory().map((record) => (
                  <tr key={record.id} className="hover:bg-slate-50">
                    <td className="p-3 text-slate-600">{record.date}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        record.type === '买入' ? 'bg-blue-100 text-blue-700' :
                        record.type === '卖出' ? 'bg-slate-100 text-slate-700' : 'bg-green-100 text-green-700'
                      }`}>
                        {record.type}
                      </span>
                    </td>
                    <td className="p-3 text-right font-medium text-slate-800">
                      {record.amount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-center">
                      <span className="text-xs text-slate-500 flex items-center justify-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> {record.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>

      {/* 7. 编辑/设置持仓 Modal (新增) */}
      <Modal isOpen={modals.settings} onClose={() => closeModal('settings')} title="编辑持仓信息" maxWidth="max-w-lg">
        <form onSubmit={handleUpdateFund} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">基金名称</label>
            <input 
              type="text" required value={editForm.name} onChange={(e) => setEditForm({...editForm, name: e.target.value})}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">基金代码</label>
              <input 
                type="text" required value={editForm.code} onChange={(e) => setEditForm({...editForm, code: e.target.value})}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50"
                readOnly // 基金代码一般不可改，这里做成只读
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">所属分组</label>
              <select 
                value={editForm.sector} onChange={(e) => setEditForm({...editForm, sector: e.target.value})}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              >
                {sectors.map(sector => <option key={sector} value={sector}>{sector}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">持仓金额校准 (元)</label>
            <input 
              type="number" min="0" step="0.01" required value={editForm.amount} onChange={(e) => setEditForm({...editForm, amount: e.target.value})}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <p className="text-xs text-slate-400 mt-1">如数据不准，可在此处直接覆盖修改持仓金额。</p>
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-slate-100 mt-6">
            <button 
              type="button" 
              onClick={handleDeleteFund}
              className="flex items-center gap-1.5 px-3 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg font-medium transition-colors text-sm"
            >
              <Trash2 className="w-4 h-4" /> 删除该持仓
            </button>
            <div className="flex gap-3">
              <button type="button" onClick={() => closeModal('settings')} className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium transition-colors">取消</button>
              <button type="submit" className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors">保存更改</button>
            </div>
          </div>
        </form>
      </Modal>

    </div>
  );
}