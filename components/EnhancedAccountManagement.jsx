import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../utils/supabase';
import EnhancedPublicScreen from './EnhancedPublicScreen';
import AddAccountModal from './AddAccountModal';
import RechargeModal from './RechargeModal_Fixed';
import SimpleZeroingModal from './SimpleZeroingModal';
import { Plus, RefreshCw, AlertCircle, History, Trash2, Users, CreditCard, ChevronDown, Copy, Calendar, Filter } from 'lucide-react';

// 增强版账户管理组件
// 新增功能：公屏扩大、批量复制、日期筛选、格式修复

const EnhancedAccountManagement = () => {
    // 基础状态
    const [staffs, setStaffs] = useState([]);
    const [selectedStaff, setSelectedStaff] = useState(null);
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [statusMessage, setStatusMessage] = useState('准备就绪');
    
    // 模态框状态
    const [isAddModalOpen, setAddModalOpen] = useState(false);
    const [isRechargeModalOpen, setRechargeModalOpen] = useState(false);
    const [isZeroingModalOpen, setZeroingModalOpen] = useState(false);
    const [selectedAccount, setSelectedAccount] = useState(null);
    
    // 充值历史记录状态
    const [isRechargeHistoryModalOpen, setRechargeHistoryModalOpen] = useState(false);
    const [rechargeHistory, setRechargeHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    
    // 新增：日期筛选状态
    const [dateFilter, setDateFilter] = useState('all'); // 'all', 'today', 'custom'
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');
    const [showDateFilter, setShowDateFilter] = useState(false);
    
    // UI状态
    const [expandedStaff, setExpandedStaff] = useState(null);
    const [publicScreenRefreshTrigger, setPublicScreenRefreshTrigger] = useState(0);

    // 数据表前缀
    const tablePrefix = 'app_e87b41cfe355428b8146f8bae8184e10_';

    // 获取员工数据
    const fetchStaffs = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            setStatusMessage('正在加载员工数据...');
            
            console.log('开始获取员工数据');
            
            const { data, error } = await supabase
                .from(`${tablePrefix}personnel`)
                .select('*')
                .order('name', { ascending: true });
            
            if (error) {
                console.error('Supabase查询错误:', error);
                throw error;
            }
            
            console.log('员工数据获取成功:', data);
            setStaffs(data || []);
            setStatusMessage(`已加载${data ? data.length : 0}个员工`);
            
        } catch (error) {
            console.error('获取员工数据失败:', error);
            setError('加载员工数据失败: ' + error.message);
            setStatusMessage('加载失败');
        } finally {
            setLoading(false);
        }
    }, [tablePrefix]);

    // 获取指定员工的账户数据
    const fetchAccounts = useCallback(async (staff) => {
        if (!staff || !staff.id) {
            setAccounts([]);
            return;
        }
        
        try {
            setStatusMessage(`正在加载${staff.name}的账户...`);
            console.log('获取账户数据 - 员工ID:', staff.id);
            
            const { data, error } = await supabase
                .from(`${tablePrefix}account_management_ads`)
                .select('*')
                .eq('personnel_id', staff.id)
                .order('created_at', { ascending: false });
            
            if (error) {
                console.error('获取账户数据错误:', error);
                throw error;
            }
            
            console.log('账户数据获取成功:', data);
            
            const accountsWithPersonnelName = (data || []).map(account => ({
                ...account,
                personnel_name: staff.name
            }));
            
            setAccounts(accountsWithPersonnelName);
            setStatusMessage(`${staff.name}: ${accountsWithPersonnelName.length}个账户`);
            
        } catch (error) {
            console.error('获取账户数据失败:', error);
            setAccounts([]);
            setStatusMessage(`获取${staff.name}账户失败`);
        }
    }, [tablePrefix]);

    // 初始化数据
    useEffect(() => {
        fetchStaffs();
        // 设置默认日期为今天
        const today = new Date().toISOString().split('T')[0];
        setCustomStartDate(today);
        setCustomEndDate(today);
    }, [fetchStaffs]);

    // 处理员工选择切换
    const handleStaffToggle = useCallback((staff) => {
        if (expandedStaff?.id === staff.id) {
            // 收起
            setExpandedStaff(null);
            setSelectedStaff(null);
            setAccounts([]);
            setStatusMessage('准备就绪');
        } else {
            // 展开
            setExpandedStaff(staff);
            setSelectedStaff(staff);
            fetchAccounts(staff);
        }
    }, [expandedStaff, fetchAccounts]);

    // 处理模态框成功回调
    const handleAccountAdded = useCallback(() => {
        setAddModalOpen(false);
        if (selectedStaff) {
            fetchAccounts(selectedStaff);
        }
        setPublicScreenRefreshTrigger(prev => prev + 1);
        setStatusMessage('账户添加成功');
    }, [selectedStaff, fetchAccounts]);

    const handleRecharge = useCallback(() => {
        setRechargeModalOpen(false);
        if (selectedStaff) {
            fetchAccounts(selectedStaff);
        }
        setPublicScreenRefreshTrigger(prev => prev + 1);
        setStatusMessage('充值操作完成');
    }, [selectedStaff, fetchAccounts]);

    const handleZeroing = useCallback(() => {
        setZeroingModalOpen(false);
        if (selectedStaff) {
            fetchAccounts(selectedStaff);
        }
        setPublicScreenRefreshTrigger(prev => prev + 1);
        setStatusMessage('清零操作完成');
    }, [selectedStaff, fetchAccounts]);

    // 处理账户删除
    const handleDeleteAccount = useCallback(async (account) => {
        if (!account || !account.id) return;
        
        const confirmText = `确定要删除账户 "${account.account_name}" 吗？`;
        if (!confirm(confirmText)) return;
        
        try {
            setStatusMessage('正在删除账户...');
            
            const { error } = await supabase
                .from(`${tablePrefix}account_management_ads`)
                .delete()
                .eq('id', account.id);
            
            if (error) throw error;
            
            if (selectedStaff) {
                fetchAccounts(selectedStaff);
            }
            
            setStatusMessage('账户删除成功');
            
        } catch (error) {
            console.error('删除账户失败:', error);
            setStatusMessage('删除账户失败');
            alert('删除失败: ' + error.message);
        }
    }, [selectedStaff, fetchAccounts, tablePrefix]);

    // 单个账户复制功能（修复格式）
    const handleCopyAccount = useCallback(async (account) => {
        try {
            // 按照要求的格式：账户：AT-OY-39\nAd account ID: 1015236453465856\n充值 $500
            const copyText = `账户：${account.account_name}\nAd account ID: ${account.ad_account_id || account.id}\n余额：$${account.balance || '0.00'}`;
            
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(copyText);
            } else {
                const textArea = document.createElement('textarea');
                textArea.value = copyText;
                textArea.style.position = 'fixed';
                textArea.style.left = '-999999px';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                document.execCommand('copy');
                textArea.remove();
            }
            setStatusMessage(`账户信息已复制: ${account.account_name}`);
        } catch (error) {
            console.error('复制失败:', error);
            setStatusMessage('复制失败');
        }
    }, []);

    // 新增：一键复制所有账户信息
    const handleCopyAllAccounts = useCallback(async () => {
        if (!accounts || accounts.length === 0) {
            alert('没有账户信息可复制');
            return;
        }
        
        try {
            // 生成所有账户的复制文本
            const allAccountsText = accounts.map(account => 
                `账户：${account.account_name}\nAd account ID: ${account.ad_account_id || account.id}\n余额：$${account.balance || '0.00'}`
            ).join('\n\n');
            
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(allAccountsText);
            } else {
                const textArea = document.createElement('textarea');
                textArea.value = allAccountsText;
                textArea.style.position = 'fixed';
                textArea.style.left = '-999999px';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                document.execCommand('copy');
                textArea.remove();
            }
            
            setStatusMessage(`已复制${accounts.length}个账户的信息`);
            alert(`成功复制${accounts.length}个账户的信息到剪贴板`);
            
        } catch (error) {
            console.error('批量复制失败:', error);
            setStatusMessage('批量复制失败');
            alert('批量复制失败: ' + error.message);
        }
    }, [accounts]);

    // 查看充值历史记录（带日期筛选）
    const handleViewRechargeHistory = useCallback(async (account) => {
        if (!account || !account.id) return;
        
        try {
            setSelectedAccount(account);
            setRechargeHistoryModalOpen(true);
            setLoadingHistory(true);
            setStatusMessage('正在加载充值记录...');
            
            // 构建查询条件
            let query = supabase
                .from(`${tablePrefix}recharge_operations`)
                .select('*')
                .eq('account_id', account.id);
            
            // 应用日期筛选
            if (dateFilter === 'today') {
                const today = new Date();
                const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
                query = query.gte('created_at', startOfDay.toISOString()).lt('created_at', endOfDay.toISOString());
            } else if (dateFilter === 'custom' && customStartDate && customEndDate) {
                const startDate = new Date(customStartDate + 'T00:00:00');
                const endDate = new Date(customEndDate + 'T23:59:59');
                query = query.gte('created_at', startDate.toISOString()).lte('created_at', endDate.toISOString());
            }
            
            const { data, error } = await query.order('created_at', { ascending: false });
            
            if (error) {
                console.error('获取充值记录错误:', error);
                throw error;
            }
            
            setRechargeHistory(data || []);
            setStatusMessage(`加载了${data ? data.length : 0}条充值记录`);
            
        } catch (error) {
            console.error('获取充值记录失败:', error);
            setRechargeHistory([]);
            setStatusMessage('获取充值记录失败');
        } finally {
            setLoadingHistory(false);
        }
    }, [tablePrefix, dateFilter, customStartDate, customEndDate]);

    // 删除充值记录
    const handleDeleteRechargeRecord = useCallback(async (recordId) => {
        if (!recordId) return;
        if (!confirm('确定要删除这条充值记录吗？')) return;
        
        try {
            setStatusMessage('正在删除记录...');
            
            const { error } = await supabase
                .from(`${tablePrefix}recharge_operations`)
                .delete()
                .eq('id', recordId);
            
            if (error) throw error;
            
            // 重新加载当前账户的充值记录
            if (selectedAccount) {
                handleViewRechargeHistory(selectedAccount);
            }
            
            setStatusMessage('充值记录删除成功');
            
        } catch (error) {
            console.error('删除充值记录失败:', error);
            setStatusMessage('删除记录失败');
            alert('删除失败: ' + error.message);
        }
    }, [selectedAccount, handleViewRechargeHistory, tablePrefix]);

    // 充值记录复制功能（修复格式）
    const handleCopyRechargeRecord = useCallback(async (record, account) => {
        try {
            // 按照要求的格式：账户：AT-OY-39\nAd account ID: 1015236453465856\n充值 $500
            const copyText = `账户：${account?.account_name || '未知账户'}\nAd account ID: ${account?.ad_account_id || account?.id || 'N/A'}\n充值 $${Number(record.amount).toFixed(2)}`;
            
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(copyText);
            } else {
                const textArea = document.createElement('textarea');
                textArea.value = copyText;
                textArea.style.position = 'fixed';
                textArea.style.left = '-999999px';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                document.execCommand('copy');
                textArea.remove();
            }
            setStatusMessage(`充值记录已复制: $${Number(record.amount).toFixed(2)}`);
        } catch (error) {
            console.error('复制失败:', error);
            setStatusMessage('复制失败');
        }
    }, []);

    // 获取头像
    const getAvatarForOperator = useCallback((operatorName) => {
        if (!operatorName) return '👤';
        const avatarMap = {
            '丁': '🐶', '青': '🦊', '妹': '🐱', '白': '🐨',
            '小丁': '🐶', '小青': '🦊', '小妹': '🐱', '小白': '🐨'
        };
        
        for (const [name, avatar] of Object.entries(avatarMap)) {
            if (operatorName.includes(name)) return avatar;
        }
        return '👤';
    }, []);

    // 快速日期筛选
    const applyQuickDateFilter = useCallback((filterType) => {
        setDateFilter(filterType);
        if (filterType === 'today') {
            const today = new Date().toISOString().split('T')[0];
            setCustomStartDate(today);
            setCustomEndDate(today);
        }
        setShowDateFilter(false);
    }, []);

    // 错误状态
    if (error && !loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center p-6 bg-white rounded-lg shadow-lg max-w-md">
                    <AlertCircle className="mx-auto mb-4 text-red-500" size={48} />
                    <h3 className="text-lg font-bold text-gray-800 mb-2">连接失败</h3>
                    <p className="text-gray-600 mb-4">{error}</p>
                    <button 
                        onClick={fetchStaffs}
                        className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
                    >
                        重新连接
                    </button>
                </div>
            </div>
        );
    }

    // 加载状态
    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <RefreshCw className="mx-auto mb-4 animate-spin text-blue-500" size={48} />
                    <h3 className="text-lg font-bold text-gray-800 mb-2">正在连接...</h3>
                    <p className="text-gray-600">{statusMessage}</p>
                </div>
            </div>
        );
    }

    // 主界面
    return (
        <div className="min-h-screen bg-gray-50">
            <div className="flex flex-col xl:flex-row h-screen">
                {/* 左侧面板 - 调整为更紧凑 */}
                <div className="w-full xl:w-72 bg-white shadow-lg border-r border-gray-200 flex flex-col">
                    {/* 头部 */}
                    <div className="p-4 border-b border-gray-100">
                        <div className="flex items-center space-x-2 mb-3">
                            <Users className="text-blue-500" size={20} />
                            <h2 className="text-lg font-bold text-gray-900">投放团队</h2>
                            <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full">
                                {staffs.length}人
                            </span>
                        </div>
                        
                        {/* 状态栏 */}
                        <div className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded mb-3">
                            状态: {statusMessage}
                        </div>
                        
                        {/* 操作按钮组 */}
                        {selectedStaff && (
                            <div className="space-y-2">
                                <button
                                    onClick={() => setAddModalOpen(true)}
                                    className="w-full bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-lg text-sm flex items-center justify-center space-x-1 transition-colors"
                                >
                                    <Plus size={16} />
                                    <span>添加账户</span>
                                </button>
                                
                                {/* 新增：一键复制所有账户按钮 */}
                                <button
                                    onClick={handleCopyAllAccounts}
                                    disabled={!accounts || accounts.length === 0}
                                    className="w-full bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded-lg text-sm flex items-center justify-center space-x-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Copy size={16} />
                                    <span>复制所有账户</span>
                                </button>
                                
                                {/* 新增：日期筛选按钮 */}
                                <div className="relative">
                                    <button
                                        onClick={() => setShowDateFilter(!showDateFilter)}
                                        className="w-full bg-purple-500 hover:bg-purple-600 text-white px-3 py-2 rounded-lg text-sm flex items-center justify-center space-x-1 transition-colors"
                                    >
                                        <Filter size={16} />
                                        <span>筛选记录</span>
                                        <ChevronDown size={14} className={`transition-transform ${showDateFilter ? 'rotate-180' : ''}`} />
                                    </button>
                                    
                                    {/* 日期筛选下拉框 */}
                                    {showDateFilter && (
                                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 p-3">
                                            <div className="space-y-3">
                                                <div className="flex flex-col space-y-2">
                                                    <label className="flex items-center space-x-2 text-sm">
                                                        <input
                                                            type="radio"
                                                            name="dateFilter"
                                                            value="all"
                                                            checked={dateFilter === 'all'}
                                                            onChange={(e) => setDateFilter(e.target.value)}
                                                            className="text-blue-500"
                                                        />
                                                        <span>全部时间</span>
                                                    </label>
                                                    <label className="flex items-center space-x-2 text-sm">
                                                        <input
                                                            type="radio"
                                                            name="dateFilter"
                                                            value="today"
                                                            checked={dateFilter === 'today'}
                                                            onChange={(e) => applyQuickDateFilter(e.target.value)}
                                                            className="text-blue-500"
                                                        />
                                                        <span>今日记录</span>
                                                    </label>
                                                    <label className="flex items-center space-x-2 text-sm">
                                                        <input
                                                            type="radio"
                                                            name="dateFilter"
                                                            value="custom"
                                                            checked={dateFilter === 'custom'}
                                                            onChange={(e) => setDateFilter(e.target.value)}
                                                            className="text-blue-500"
                                                        />
                                                        <span>自定义范围</span>
                                                    </label>
                                                </div>
                                                
                                                {dateFilter === 'custom' && (
                                                    <div className="space-y-2 pt-2 border-t border-gray-100">
                                                        <div>
                                                            <label className="block text-xs text-gray-600 mb-1">开始日期</label>
                                                            <input
                                                                type="date"
                                                                value={customStartDate}
                                                                onChange={(e) => setCustomStartDate(e.target.value)}
                                                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs text-gray-600 mb-1">结束日期</label>
                                                            <input
                                                                type="date"
                                                                value={customEndDate}
                                                                onChange={(e) => setCustomEndDate(e.target.value)}
                                                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                                
                                                <div className="pt-2 border-t border-gray-100">
                                                    <button
                                                        onClick={() => setShowDateFilter(false)}
                                                        className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded text-xs transition-colors"
                                                    >
                                                        关闭
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 员工列表 */}
                    <div className="flex-1 overflow-y-auto p-3">
                        {staffs.length === 0 ? (
                            <div className="text-center py-4 text-gray-500">暂无员工数据</div>
                        ) : (
                            <div className="space-y-2">
                                {staffs.map((staff) => (
                                    <div key={staff.id} className="border border-gray-200 rounded-lg">
                                        {/* 员工头部 */}
                                        <button
                                            onClick={() => handleStaffToggle(staff)}
                                            className={`w-full text-left p-3 rounded-lg transition-all ${
                                                expandedStaff?.id === staff.id
                                                    ? 'bg-blue-50 border-blue-200'
                                                    : 'hover:bg-gray-50'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center space-x-2">
                                                    <span className="text-lg">{getAvatarForOperator(staff.name)}</span>
                                                    <div className="flex flex-col">
                                                        <span className="font-medium text-gray-900">{staff.name}</span>
                                                        {expandedStaff?.id === staff.id && (
                                                            <span className="text-xs text-gray-500">
                                                                {accounts.length}个账户
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center space-x-1">
                                                    <ChevronDown 
                                                        size={16} 
                                                        className={`text-gray-400 transition-transform ${
                                                            expandedStaff?.id === staff.id ? 'rotate-180' : ''
                                                        }`} 
                                                    />
                                                </div>
                                            </div>
                                        </button>

                                        {/* 账户列表 */}
                                        {expandedStaff?.id === staff.id && (
                                            <div className="border-t border-gray-100 bg-gray-50">
                                                {accounts.length === 0 ? (
                                                    <div className="p-4 text-center text-gray-500 text-sm">暂无账户</div>
                                                ) : (
                                                    <div className="p-3 space-y-2">
                                                        {accounts.map((account) => (
                                                            <div key={account.id} className="bg-white p-3 rounded border border-gray-200">
                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="font-medium text-gray-900 text-sm truncate">
                                                                            {account.account_name}
                                                                        </div>
                                                                        <div className="text-xs text-gray-500">
                                                                            ID: {account.ad_account_id || account.id}
                                                                        </div>
                                                                        <div className="text-xs text-gray-500">
                                                                            余额: ${account.balance || '0.00'}
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-center space-x-1">
                                                                        <button
                                                                            onClick={() => handleCopyAccount(account)}
                                                                            className="p-1 text-gray-500 hover:bg-gray-100 rounded"
                                                                            title="复制账户信息"
                                                                        >
                                                                            <Copy size={14} />
                                                                        </button>
                                                                        <button
                                                                            onClick={() => {
                                                                                setSelectedAccount(account);
                                                                                setRechargeModalOpen(true);
                                                                            }}
                                                                            className="p-1 text-blue-500 hover:bg-blue-50 rounded"
                                                                            title="充值"
                                                                        >
                                                                            <CreditCard size={14} />
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleViewRechargeHistory(account)}
                                                                            className="p-1 text-green-500 hover:bg-green-50 rounded"
                                                                            title="充值记录"
                                                                        >
                                                                            <History size={14} />
                                                                        </button>
                                                                        <button
                                                                            onClick={() => {
                                                                                setSelectedAccount(account);
                                                                                setZeroingModalOpen(true);
                                                                            }}
                                                                            className="p-1 text-orange-500 hover:bg-orange-50 rounded"
                                                                            title="清零"
                                                                        >
                                                                            <RefreshCw size={14} />
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleDeleteAccount(account)}
                                                                            className="p-1 text-red-500 hover:bg-red-50 rounded"
                                                                            title="删除账户"
                                                                        >
                                                                            <Trash2 size={14} />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* 右侧公屏 - 扩大显示区域 */}
                <div className="flex-1 p-4 min-h-0">
                    <EnhancedPublicScreen 
                        refreshTrigger={publicScreenRefreshTrigger}
                        dateFilter={dateFilter}
                        customStartDate={customStartDate}
                        customEndDate={customEndDate}
                    />
                </div>
            </div>

            {/* 模态框 */}
            {/* 添加账户模态框 */}
            {isAddModalOpen && (
                <AddAccountModal
                    isOpen={isAddModalOpen}
                    onClose={() => setAddModalOpen(false)}
                    onSuccess={handleAccountAdded}
                    staffId={selectedStaff?.id}
                    staffName={selectedStaff?.name}
                />
            )}

            {/* 充值模态框 */}
            {isRechargeModalOpen && selectedAccount && (
                <RechargeModal
                    isOpen={isRechargeModalOpen}
                    onClose={() => setRechargeModalOpen(false)}
                    onSuccess={handleRecharge}
                    account={selectedAccount}
                />
            )}

            {/* 清零模态框 */}
            {isZeroingModalOpen && selectedAccount && (
                <SimpleZeroingModal
                    isOpen={isZeroingModalOpen}
                    onClose={() => setZeroingModalOpen(false)}
                    onSuccess={handleZeroing}
                    account={selectedAccount}
                />
            )}

            {/* 充值历史记录模态框 */}
            {isRechargeHistoryModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[85vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="text-xl font-bold text-gray-800">
                                    充值记录 - {selectedAccount?.account_name}
                                </h3>
                                <div className="text-sm text-gray-500 mt-1">
                                    筛选条件: {
                                        dateFilter === 'all' ? '全部时间' : 
                                        dateFilter === 'today' ? '今日记录' : 
                                        `${customStartDate} 至 ${customEndDate}`
                                    }
                                </div>
                            </div>
                            <button
                                onClick={() => setRechargeHistoryModalOpen(false)}
                                className="text-gray-500 hover:text-gray-700 text-xl font-bold px-2"
                            >
                                ✕
                            </button>
                        </div>
                        
                        {loadingHistory ? (
                            <div className="text-center py-8">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                                <p className="text-gray-500 mt-3 text-sm">加载中...</p>
                            </div>
                        ) : rechargeHistory.length === 0 ? (
                            <div className="text-center py-12">
                                <div className="text-gray-400 text-4xl mb-4">📝</div>
                                <p className="text-gray-500 text-lg">暂无充值记录</p>
                                <p className="text-gray-400 text-sm mt-2">在所选时间范围内没有找到充值记录</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {rechargeHistory.map((record) => (
                                    <div key={record.id} className="border rounded-lg p-4 bg-gray-50 hover:bg-gray-100 transition-colors">
                                        <div className="flex justify-between items-start">
                                            <div className="flex-1">
                                                <div className="flex items-center space-x-3 mb-2">
                                                    <div className="text-lg font-bold text-green-600">
                                                        ${Number(record.amount).toFixed(2)}
                                                    </div>
                                                    <div className="text-sm text-gray-600">
                                                        操作人: {record.operator_name}
                                                    </div>
                                                </div>
                                                <div className="text-sm text-gray-500">
                                                    时间: {new Date(record.created_at).toLocaleString('zh-CN')}
                                                </div>
                                                {record.description && (
                                                    <div className="text-sm text-gray-500 mt-1">
                                                        备注: {record.description}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <button
                                                    onClick={() => handleCopyRechargeRecord(record, selectedAccount)}
                                                    className="text-blue-500 hover:bg-blue-50 p-2 rounded transition-colors"
                                                    title="复制充值信息"
                                                >
                                                    <Copy size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteRechargeRecord(record.id)}
                                                    className="text-red-500 hover:bg-red-50 p-2 rounded transition-colors"
                                                    title="删除记录"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default EnhancedAccountManagement;