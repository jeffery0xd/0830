import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../utils/supabase';
import PublicScreen from './PublicScreen_Safe';
import AddAccountModal from './AddAccountModal';
import RechargeModal from './RechargeModal_Fixed';
import SimpleZeroingModal from './SimpleZeroingModal';
import { Plus, RefreshCw, AlertCircle, History, Trash2, Users, CreditCard, ChevronDown, Copy } from 'lucide-react';

// 完全修复版本的AccountManagement组件
// 解决React Error #301和所有功能问题

const AccountManagement = () => {
    // 基础状态 - 所有Hook必须在组件顶层
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
    
    // UI状态
    const [expandedStaff, setExpandedStaff] = useState(null);
    const [publicScreenRefreshTrigger, setPublicScreenRefreshTrigger] = useState(0);

    // 数据表前缀 - 使用常量避免重复计算
    const tablePrefix = 'app_e87b41cfe355428b8146f8bae8184e10_';

    // 获取员工数据 - 使用useCallback避免无限重渲染
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

    // 获取指定员工的账户数据 - 使用useCallback避免无限重渲染
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
            
            // 为每个账户添加personnel_name字段，修复充值时的数据完整性问题
            const accountsWithPersonnelName = (data || []).map(account => ({
                ...account,
                personnel_name: staff.name // 确保personnel_name字段存在
            }));
            
            setAccounts(accountsWithPersonnelName);
            setStatusMessage(`${staff.name}: ${accountsWithPersonnelName.length}个账户`);
            
        } catch (error) {
            console.error('获取账户数据失败:', error);
            setAccounts([]);
            setStatusMessage(`获取${staff.name}账户失败`);
        }
    }, [tablePrefix]);

    // 初始化数据 - 只运行一次
    useEffect(() => {
        fetchStaffs();
    }, []); // 空依赖数组确保只运行一次

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
            
            // 刷新当前员工的账户列表
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

    // 一键复制功能
    const handleCopy = useCallback(async (text, type = '账户ID') => {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
            } else {
                // Fallback 方法
                const textArea = document.createElement('textarea');
                textArea.value = text;
                textArea.style.position = 'fixed';
                textArea.style.left = '-999999px';
                textArea.style.top = '-999999px';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                document.execCommand('copy');
                textArea.remove();
            }
            setStatusMessage(`${type}已复制: ${text}`);
        } catch (error) {
            console.error('复制失败:', error);
            setStatusMessage('复制失败');
        }
    }, []);

    // 查看充值历史记录
    const handleViewRechargeHistory = useCallback(async (account) => {
        if (!account || !account.id) return;
        
        try {
            setSelectedAccount(account);
            setRechargeHistoryModalOpen(true);
            setLoadingHistory(true);
            setStatusMessage('正在加载充值记录...');
            
            // 查询充值记录
            const { data, error } = await supabase
                .from(`${tablePrefix}recharge_operations`)
                .select('*')
                .eq('account_id', account.id)
                .order('created_at', { ascending: false });
            
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
    }, [tablePrefix]);

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

    // 如果出错
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

    // 如果加载中
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
            <div className="flex flex-col lg:flex-row h-screen">
                {/* 左侧面板 */}
                <div className="w-full lg:w-80 bg-white shadow-lg border-r border-gray-200 flex flex-col">
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
                        <div className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded">
                            状态: {statusMessage}
                        </div>
                        
                        {/* 添加账户按钮 */}
                        {selectedStaff && (
                            <button
                                onClick={() => setAddModalOpen(true)}
                                className="mt-3 w-full bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-lg text-sm flex items-center justify-center space-x-1 transition-colors"
                            >
                                <Plus size={16} />
                                <span>添加账户</span>
                            </button>
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
                                                                            余额: ¥{account.balance || '0.00'}
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-center space-x-1">
                                                                        <button
                                                                            onClick={() => handleCopy(account.ad_account_id || account.id, '账户ID')}
                                                                            className="p-1 text-gray-500 hover:bg-gray-100 rounded"
                                                                            title="复制账户ID"
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

                {/* 右侧公屏 */}
                <div className="flex-1 p-4">
                    <PublicScreen refreshTrigger={publicScreenRefreshTrigger} />
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
                    <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-gray-800">
                                充值记录 - {selectedAccount?.account_name}
                            </h3>
                            <button
                                onClick={() => setRechargeHistoryModalOpen(false)}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                ✕
                            </button>
                        </div>
                        
                        {loadingHistory ? (
                            <div className="text-center py-4">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto"></div>
                                <p className="text-gray-500 mt-2 text-sm">加载中...</p>
                            </div>
                        ) : rechargeHistory.length === 0 ? (
                            <div className="text-center py-8">
                                <p className="text-gray-500">暂无充值记录</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {rechargeHistory.map((record) => (
                                    <div key={record.id} className="border rounded-lg p-3 bg-gray-50">
                                        <div className="flex justify-between items-start">
                                            <div className="flex-1">
                                                <div className="text-sm font-medium text-gray-900">
                                                    充值金额: ${Number(record.amount).toFixed(2)}
                                                </div>
                                                <div className="text-xs text-gray-600">
                                                    操作人: {record.operator_name}
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                    时间: {new Date(record.created_at).toLocaleString('zh-CN')}
                                                </div>
                                                {record.description && (
                                                    <div className="text-xs text-gray-500 mt-1">
                                                        备注: {record.description}
                                                    </div>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => handleDeleteRechargeRecord(record.id)}
                                                className="text-red-500 hover:bg-red-50 p-1 rounded"
                                                title="删除记录"
                                            >
                                                <Trash2 size={14} />
                                            </button>
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

export default AccountManagement;