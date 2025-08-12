import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../utils/supabase';
import EnhancedPublicScreen from './EnhancedPublicScreen';
import AddAccountModal from './AddAccountModal';
import RechargeModal from './RechargeModal_Fixed';
import { Plus, RefreshCw, AlertCircle, History, Trash2, Users, CreditCard, ChevronDown, Copy, Calendar, Filter, Clock } from 'lucide-react';

// 改进版账户管理组件
// 高优先级修复：日期筛选优化、移除余额显示、移除清零功能、删除充值记录、移动端优化

const ImprovedAccountManagement = () => {
    // 基础状态
    const [staffs, setStaffs] = useState([]);
    const [selectedStaff, setSelectedStaff] = useState(null);
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [statusMessage, setStatusMessage] = useState('准备就绪');
    
    // 模态框状态（移除了清零模态框）
    const [isAddModalOpen, setAddModalOpen] = useState(false);
    const [isRechargeModalOpen, setRechargeModalOpen] = useState(false);
    const [selectedAccount, setSelectedAccount] = useState(null);
    
    // 充值历史记录状态
    const [isRechargeHistoryModalOpen, setRechargeHistoryModalOpen] = useState(false);
    const [rechargeHistory, setRechargeHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    
    // 改进的日期筛选状态
    const [dateFilter, setDateFilter] = useState('today'); // 默认为今日
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

    // 获取指定员工的账户数据（移除余额显示）
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

    // 处理模态框成功回调（移除清零回调）
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

    // 单个账户复制功能（移除余额信息）
    const handleCopyAccount = useCallback(async (account) => {
        try {
            // 修改格式：移除余额信息
            const copyText = `账户：${account.account_name}\nAd account ID: ${account.ad_account_id || account.id}`;
            
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

    // 一键复制所有账户信息（移除余额信息）
    const handleCopyAllAccounts = useCallback(async () => {
        if (!accounts || accounts.length === 0) {
            alert('没有账户信息可复制');
            return;
        }
        
        try {
            // 生成所有账户的复制文本（移除余额）
            const allAccountsText = accounts.map(account => 
                `账户：${account.account_name}\nAd account ID: ${account.ad_account_id || account.id}`
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

    // 改进的查看充值历史记录（优化日期筛选）
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
            
            // 改进的日期筛选逻辑
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

    // 删除充值记录（增强确认机制）
    const handleDeleteRechargeRecord = useCallback(async (recordId) => {
        if (!recordId) return;
        if (!confirm('确定要删除这条充值记录吗？此操作无法撤销。')) return;
        
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
            alert('充值记录已成功删除');
            
        } catch (error) {
            console.error('删除充值记录失败:', error);
            setStatusMessage('删除记录失败');
            alert('删除失败: ' + error.message);
        }
    }, [selectedAccount, handleViewRechargeHistory, tablePrefix]);

    // 充值记录复制功能（移除余额信息）
    const handleCopyRechargeRecord = useCallback(async (record, account) => {
        try {
            // 修改格式：移除余额信息，专注于充值金额
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

    // 改进的快速日期筛选
    const applyQuickDateFilter = useCallback((filterType) => {
        setDateFilter(filterType);
        if (filterType === 'today') {
            const today = new Date().toISOString().split('T')[0];
            setCustomStartDate(today);
            setCustomEndDate(today);
        }
        setShowDateFilter(false);
        setStatusMessage(`已切换到${filterType === 'today' ? '今日' : filterType === 'all' ? '全部' : '自定义'}筛选`);
    }, []);

    // 错误状态
    if (error && !loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="text-center p-6 bg-white rounded-lg shadow-lg max-w-md w-full">
                    <AlertCircle className="mx-auto mb-4 text-red-500" size={48} />
                    <h3 className="text-lg font-bold text-gray-800 mb-2">连接失败</h3>
                    <p className="text-gray-600 mb-4 text-sm">{error}</p>
                    <button 
                        onClick={fetchStaffs}
                        className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm"
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
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="text-center">
                    <RefreshCw className="mx-auto mb-4 animate-spin text-blue-500" size={48} />
                    <h3 className="text-lg font-bold text-gray-800 mb-2">正在连接...</h3>
                    <p className="text-gray-600 text-sm">{statusMessage}</p>
                </div>
            </div>
        );
    }

    // 主界面（修复移动端滚动问题）
    return (
        <div className="min-h-screen bg-gray-50">
            <div className="flex flex-col lg:flex-row min-h-screen">
                {/* 左侧面板 - 移动端优化 */}
                <div className="w-full lg:w-80 xl:w-96 bg-white shadow-lg border-r border-gray-200 flex flex-col lg:h-screen">
                    {/* 头部 */}
                    <div className="p-3 sm:p-4 border-b border-gray-100 flex-shrink-0">
                        <div className="flex items-center space-x-2 mb-3">
                            <Users className="text-blue-500" size={20} />
                            <h2 className="text-lg font-bold text-gray-900">投放团队</h2>
                            <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full">
                                {staffs.length}人
                            </span>
                        </div>
                        
                        {/* 状态栏 */}
                        <div className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded mb-3 break-words">
                            状态: {statusMessage}
                        </div>
                        
                        {/* 改进的日期筛选区域 - 移动端友好 */}
                        <div className="mb-3">
                            <div className="flex flex-wrap gap-2 mb-2">
                                <button
                                    onClick={() => applyQuickDateFilter('today')}
                                    className={`flex items-center space-x-1 px-3 py-2 rounded text-sm font-medium transition-colors ${
                                        dateFilter === 'today'
                                            ? 'bg-blue-500 text-white'
                                            : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                                    }`}
                                >
                                    <Clock size={14} />
                                    <span>今日</span>
                                </button>
                                <button
                                    onClick={() => applyQuickDateFilter('all')}
                                    className={`flex items-center space-x-1 px-3 py-2 rounded text-sm font-medium transition-colors ${
                                        dateFilter === 'all'
                                            ? 'bg-blue-500 text-white'
                                            : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                                    }`}
                                >
                                    <Calendar size={14} />
                                    <span>全部</span>
                                </button>
                                <button
                                    onClick={() => {
                                        setDateFilter('custom');
                                        setShowDateFilter(!showDateFilter);
                                    }}
                                    className={`flex items-center space-x-1 px-3 py-2 rounded text-sm font-medium transition-colors ${
                                        dateFilter === 'custom'
                                            ? 'bg-purple-500 text-white'
                                            : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                                    }`}
                                >
                                    <Filter size={14} />
                                    <span>自定义</span>
                                    <ChevronDown size={12} className={`transition-transform ${
                                        showDateFilter ? 'rotate-180' : ''
                                    }`} />
                                </button>
                            </div>
                            
                            {/* 自定义日期选择器 - 移动端优化 */}
                            {showDateFilter && dateFilter === 'custom' && (
                                <div className="bg-gray-50 p-3 rounded border space-y-3">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs text-gray-600 mb-1">开始日期</label>
                                            <input
                                                type="date"
                                                value={customStartDate}
                                                onChange={(e) => setCustomStartDate(e.target.value)}
                                                className="w-full px-2 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-600 mb-1">结束日期</label>
                                            <input
                                                type="date"
                                                value={customEndDate}
                                                onChange={(e) => setCustomEndDate(e.target.value)}
                                                className="w-full px-2 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                            />
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setShowDateFilter(false)}
                                        className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded text-sm transition-colors"
                                    >
                                        确定
                                    </button>
                                </div>
                            )}
                        </div>
                        
                        {/* 操作按钮组 - 移动端优化 */}
                        {selectedStaff && (
                            <div className="space-y-2">
                                <button
                                    onClick={() => setAddModalOpen(true)}
                                    className="w-full bg-blue-500 hover:bg-blue-600 text-white px-3 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center space-x-2 transition-colors"
                                >
                                    <Plus size={16} />
                                    <span>添加账户</span>
                                </button>
                                
                                <button
                                    onClick={handleCopyAllAccounts}
                                    disabled={!accounts || accounts.length === 0}
                                    className="w-full bg-green-500 hover:bg-green-600 text-white px-3 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center space-x-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Copy size={16} />
                                    <span>复制所有账户</span>
                                </button>
                            </div>
                        )}
                    </div>

                    {/* 员工列表 - 修复显示问题 */}
                    <div className="flex-1 overflow-y-auto p-3">
                        {staffs.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">暂无员工数据</div>
                        ) : (
                            <div className="space-y-3">
                                {staffs.map((staff) => (
                                    <div key={staff.id} className="border border-gray-200 rounded-lg overflow-hidden">
                                        {/* 员工头部 */}
                                        <button
                                            onClick={() => handleStaffToggle(staff)}
                                            className={`w-full text-left p-3 sm:p-4 transition-all ${
                                                expandedStaff?.id === staff.id
                                                    ? 'bg-blue-50 border-blue-200'
                                                    : 'hover:bg-gray-50'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center space-x-3">
                                                    <span className="text-xl">{getAvatarForOperator(staff.name)}</span>
                                                    <div className="flex flex-col">
                                                        <span className="font-medium text-gray-900 text-sm sm:text-base">{staff.name}</span>
                                                        {expandedStaff?.id === staff.id && (
                                                            <span className="text-xs text-gray-500">
                                                                {accounts.length}个账户
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <ChevronDown 
                                                    size={16} 
                                                    className={`text-gray-400 transition-transform ${
                                                        expandedStaff?.id === staff.id ? 'rotate-180' : ''
                                                    }`} 
                                                />
                                            </div>
                                        </button>

                                        {/* 账户列表 - 移动端优化 */}
                                        {expandedStaff?.id === staff.id && (
                                            <div className="border-t border-gray-100 bg-gray-50">
                                                {accounts.length === 0 ? (
                                                    <div className="p-4 text-center text-gray-500 text-sm">暂无账户</div>
                                                ) : (
                                                    <div className="p-3 space-y-3">
                                                        {accounts.map((account) => (
                                                            <div key={account.id} className="bg-white p-3 rounded border border-gray-200">
                                                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="font-medium text-gray-900 text-sm truncate">
                                                                            {account.account_name}
                                                                        </div>
                                                                        <div className="text-xs text-gray-500 break-all">
                                                                            ID: {account.ad_account_id || account.id}
                                                                        </div>
                                                                        {/* 移除了余额显示 */}
                                                                    </div>
                                                                    <div className="flex items-center justify-end space-x-1 flex-shrink-0">
                                                                        <button
                                                                            onClick={() => handleCopyAccount(account)}
                                                                            className="p-2 text-gray-500 hover:bg-gray-100 rounded transition-colors"
                                                                            title="复制账户信息"
                                                                        >
                                                                            <Copy size={14} />
                                                                        </button>
                                                                        <button
                                                                            onClick={() => {
                                                                                setSelectedAccount(account);
                                                                                setRechargeModalOpen(true);
                                                                            }}
                                                                            className="p-2 text-blue-500 hover:bg-blue-50 rounded transition-colors"
                                                                            title="充值"
                                                                        >
                                                                            <CreditCard size={14} />
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleViewRechargeHistory(account)}
                                                                            className="p-2 text-green-500 hover:bg-green-50 rounded transition-colors"
                                                                            title="充值记录"
                                                                        >
                                                                            <History size={14} />
                                                                        </button>
                                                                        {/* 移除了清零按钮 */}
                                                                        <button
                                                                            onClick={() => handleDeleteAccount(account)}
                                                                            className="p-2 text-red-500 hover:bg-red-50 rounded transition-colors"
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

                {/* 右侧公屏 - 修复移动端滚动问题 */}
                <div className="flex-1 lg:min-h-0 h-auto lg:h-screen overflow-y-auto">
                    <div className="p-2 sm:p-4 h-full">
                        <EnhancedPublicScreen 
                            refreshTrigger={publicScreenRefreshTrigger}
                            dateFilter={dateFilter}
                            customStartDate={customStartDate}
                            customEndDate={customEndDate}
                        />
                    </div>
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

            {/* 移除了清零模态框 */}

            {/* 充值历史记录模态框 - 移动端优化 */}
            {isRechargeHistoryModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4">
                    <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col">
                        <div className="flex justify-between items-center p-4 sm:p-6 border-b border-gray-200 flex-shrink-0">
                            <div className="min-w-0 flex-1 pr-4">
                                <h3 className="text-lg sm:text-xl font-bold text-gray-800 truncate">
                                    充值记录 - {selectedAccount?.account_name}
                                </h3>
                                <div className="text-xs sm:text-sm text-gray-500 mt-1">
                                    筛选: {
                                        dateFilter === 'all' ? '全部时间' : 
                                        dateFilter === 'today' ? '今日记录' : 
                                        `${customStartDate} 至 ${customEndDate}`
                                    }
                                </div>
                            </div>
                            <button
                                onClick={() => setRechargeHistoryModalOpen(false)}
                                className="text-gray-500 hover:text-gray-700 text-xl font-bold px-2 py-1 hover:bg-gray-100 rounded flex-shrink-0"
                            >
                                ✕
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
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
                                        <div key={record.id} className="border rounded-lg p-3 sm:p-4 bg-gray-50 hover:bg-gray-100 transition-colors">
                                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start space-y-2 sm:space-y-0">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                                                        <div className="text-lg font-bold text-green-600">
                                                            ${Number(record.amount).toFixed(2)}
                                                        </div>
                                                        <div className="text-xs sm:text-sm text-gray-600">
                                                            操作人: {record.operator_name}
                                                        </div>
                                                    </div>
                                                    <div className="text-xs sm:text-sm text-gray-500 break-words">
                                                        时间: {new Date(record.created_at).toLocaleString('zh-CN')}
                                                    </div>
                                                    {record.description && (
                                                        <div className="text-xs sm:text-sm text-gray-500 mt-1 break-words">
                                                            备注: {record.description}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex items-center space-x-2 flex-shrink-0">
                                                    <button
                                                        onClick={() => handleCopyRechargeRecord(record, selectedAccount)}
                                                        className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-lg text-xs font-medium flex items-center space-x-1 transition-colors"
                                                        title="复制充值信息"
                                                    >
                                                        <Copy size={14} />
                                                        <span className="hidden sm:inline">复制</span>
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteRechargeRecord(record.id)}
                                                        className="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-lg text-xs font-medium flex items-center space-x-1 transition-colors"
                                                        title="删除记录"
                                                    >
                                                        <Trash2 size={14} />
                                                        <span className="hidden sm:inline">删除</span>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ImprovedAccountManagement;