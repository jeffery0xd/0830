import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import { Plus, RefreshCw, AlertCircle, History, Trash2, Users, CreditCard, ChevronDown, Copy, DollarSign, CircleOff, X } from 'lucide-react';

const AccountManagement = () => {
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
    
    // 表单状态
    const [newAccount, setNewAccount] = useState({ name: '', id: '' });
    const [rechargeAmount, setRechargeAmount] = useState('');
    
    // UI状态
    const [expandedStaff, setExpandedStaff] = useState(null);

    // 数据表前缀
    const tablePrefix = 'app_e87b41cfe355428b8146f8bae8184e10_';

    // 获取员工数据
    const fetchStaffs = async () => {
        try {
            setLoading(true);
            setError(null);
            setStatusMessage('正在加载员工数据...');
            
            const { data, error } = await supabase
                .from(`${tablePrefix}personnel`)
                .select('*')
                .order('name', { ascending: true });
            
            if (error) {
                console.error('Supabase查询错误:', error);
                throw error;
            }
            
            setStaffs(data || []);
            setStatusMessage(`已加载${data ? data.length : 0}个员工`);
            
        } catch (error) {
            console.error('获取员工数据失败:', error);
            setError('加载员工数据失败: ' + error.message);
            setStatusMessage('加载失败');
        } finally {
            setLoading(false);
        }
    };

    // 获取指定员工的账户数据
    const fetchAccounts = async (staff) => {
        if (!staff || !staff.id) {
            setAccounts([]);
            return;
        }
        
        try {
            setStatusMessage(`正在加载${staff.name}的账户...`);
            
            const { data, error } = await supabase
                .from(`${tablePrefix}account_management_ads`)
                .select('*')
                .eq('personnel_id', staff.id)
                .order('created_at', { ascending: false });
            
            if (error) {
                console.error('获取账户数据错误:', error);
                throw error;
            }
            
            setAccounts(data || []);
            setStatusMessage(`${staff.name}: ${data ? data.length : 0}个账户`);
            
        } catch (error) {
            console.error('获取账户数据失败:', error);
            setAccounts([]);
            setStatusMessage(`获取${staff.name}账户失败`);
        }
    };

    // 初始化数据
    useEffect(() => {
        fetchStaffs();
    }, []);

    // 处理员工选择切换
    const handleStaffToggle = (staff) => {
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
    };

    // 复制账户ID功能
    const handleCopy = async (text, type = '账户ID') => {
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
    };

    // 添加账户
    const handleAddAccount = async (e) => {
        e.preventDefault();
        if (!newAccount.name || !newAccount.id || !selectedStaff) return;

        try {
            const { error } = await supabase
                .from(`${tablePrefix}account_management_ads`)
                .insert({
                    personnel_id: selectedStaff.id,
                    account_name: newAccount.name,
                    ad_account_id: newAccount.id,
                    status: 'Active',
                    balance: 0
                });

            if (error) throw error;

            setNewAccount({ name: '', id: '' });
            setAddModalOpen(false);
            fetchAccounts(selectedStaff);
            setStatusMessage('账户添加成功');
        } catch (error) {
            console.error('添加账户失败:', error);
            setStatusMessage('添加账户失败: ' + error.message);
        }
    };

    // 充值功能
    const handleRecharge = async (e) => {
        e.preventDefault();
        if (!rechargeAmount || !selectedAccount) return;

        try {
            // 记录充值操作
            const { error } = await supabase
                .from(`${tablePrefix}recharge_operations`)
                .insert({
                    account_id: selectedAccount.id,
                    personnel_id: selectedAccount.personnel_id,
                    amount: parseFloat(rechargeAmount),
                    description: `充值 $${rechargeAmount} - ${selectedAccount.account_name}`
                });

            if (error) throw error;

            setRechargeAmount('');
            setRechargeModalOpen(false);
            fetchAccounts(selectedStaff);
            setStatusMessage('充值成功');
        } catch (error) {
            console.error('充值失败:', error);
            setStatusMessage('充值失败: ' + error.message);
        }
    };

    // 清零功能
    const handleZeroing = async () => {
        if (!selectedAccount) return;

        try {
            // 记录清零操作
            const { error } = await supabase
                .from(`${tablePrefix}reset_operations`)
                .insert({
                    account_id: selectedAccount.id,
                    personnel_id: selectedAccount.personnel_id,
                    description: `清零操作 - ${selectedAccount.account_name}`
                });

            if (error) throw error;

            setZeroingModalOpen(false);
            fetchAccounts(selectedStaff);
            setStatusMessage('清零成功');
        } catch (error) {
            console.error('清零失败:', error);
            setStatusMessage('清零失败: ' + error.message);
        }
    };

    // 删除账户
    const handleDeleteAccount = async (account) => {
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
    };

    // 获取头像
    const getAvatarForOperator = (operatorName) => {
        if (!operatorName) return '👤';
        const avatarMap = {
            '丁': '🐶', '青': '🦊', '妹': '🐱', '白': '🐨',
            '小丁': '🐶', '小青': '🦊', '小妹': '🐱', '小白': '🐨'
        };
        
        for (const [name, avatar] of Object.entries(avatarMap)) {
            if (operatorName.includes(name)) return avatar;
        }
        return '👤';
    };

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
                                                                            title="删除"
                                                                        >
                                                                            <Trash2 size={14} />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                                
                                                {/* 添加账户按钮 */}
                                                <div className="p-3 border-t border-gray-200">
                                                    <button
                                                        onClick={() => setAddModalOpen(true)}
                                                        className="w-full text-xs bg-blue-500 text-white px-3 py-2 rounded hover:bg-blue-600 transition-colors flex items-center justify-center"
                                                    >
                                                        <Plus size={12} className="mr-1" />
                                                        添加账户
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* 右侧面板 */}
                <div className="flex-1 p-6">
                    <div className="bg-white rounded-lg shadow-sm h-full p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">账户管理概览</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-blue-50 p-4 rounded-lg">
                                <div className="text-2xl font-bold text-blue-600">{staffs.length}</div>
                                <div className="text-sm text-gray-600">投放人员</div>
                            </div>
                            <div className="bg-green-50 p-4 rounded-lg">
                                <div className="text-2xl font-bold text-green-600">{accounts.length}</div>
                                <div className="text-sm text-gray-600">当前账户</div>
                            </div>
                            <div className="bg-purple-50 p-4 rounded-lg">
                                <div className="text-2xl font-bold text-purple-600">{expandedStaff ? '已选择' : '未选择'}</div>
                                <div className="text-sm text-gray-600">员工状态</div>
                            </div>
                        </div>
                        
                        {expandedStaff && (
                            <div className="mt-6">
                                <h4 className="text-md font-semibold text-gray-800 mb-2">当前操作员工</h4>
                                <div className="bg-gray-50 p-4 rounded-lg">
                                    <div className="flex items-center space-x-3">
                                        <span className="text-2xl">{getAvatarForOperator(expandedStaff.name)}</span>
                                        <div>
                                            <div className="font-medium text-gray-900">{expandedStaff.name}</div>
                                            <div className="text-sm text-gray-500">{accounts.length} 个账户</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 添加账户模态框 */}
            {isAddModalOpen && selectedStaff && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-gray-900">添加新账户</h3>
                            <button
                                onClick={() => setAddModalOpen(false)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        
                        <form onSubmit={handleAddAccount}>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">账户名称</label>
                                    <input
                                        type="text"
                                        value={newAccount.name}
                                        onChange={(e) => setNewAccount({...newAccount, name: e.target.value})}
                                        className="w-full p-3 border border-gray-300 rounded-md"
                                        placeholder="输入账户名称"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">广告账户ID</label>
                                    <input
                                        type="text"
                                        value={newAccount.id}
                                        onChange={(e) => setNewAccount({...newAccount, id: e.target.value})}
                                        className="w-full p-3 border border-gray-300 rounded-md"
                                        placeholder="输入广告账户ID"
                                        required
                                    />
                                </div>
                            </div>
                            
                            <div className="flex space-x-3 mt-6">
                                <button
                                    type="submit"
                                    className="flex-1 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                                >
                                    添加账户
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setAddModalOpen(false)}
                                    className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
                                >
                                    取消
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* 充值模态框 */}
            {isRechargeModalOpen && selectedAccount && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-gray-900">充值账户</h3>
                            <button
                                onClick={() => setRechargeModalOpen(false)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="mb-4">
                            <p className="text-sm text-gray-600">账户: {selectedAccount.account_name}</p>
                            <p className="text-sm text-gray-600">ID: {selectedAccount.ad_account_id}</p>
                        </div>
                        
                        <form onSubmit={handleRecharge}>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">充值金额</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={rechargeAmount}
                                    onChange={(e) => setRechargeAmount(e.target.value)}
                                    className="w-full p-3 border border-gray-300 rounded-md"
                                    placeholder="输入充值金额"
                                    required
                                />
                            </div>
                            
                            <div className="flex space-x-3">
                                <button
                                    type="submit"
                                    className="flex-1 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                                >
                                    确认充值
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setRechargeModalOpen(false)}
                                    className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
                                >
                                    取消
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* 清零模态框 */}
            {isZeroingModalOpen && selectedAccount && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-gray-900">清零账户</h3>
                            <button
                                onClick={() => setZeroingModalOpen(false)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="mb-4">
                            <p className="text-sm text-gray-600">账户: {selectedAccount.account_name}</p>
                            <p className="text-sm text-gray-600">ID: {selectedAccount.ad_account_id}</p>
                        </div>
                        
                        <p className="text-sm text-yellow-600 mb-4">确定要清零此账户吗？此操作不可撤销。</p>
                        
                        <div className="flex space-x-3">
                            <button
                                onClick={handleZeroing}
                                className="flex-1 bg-orange-500 text-white px-4 py-2 rounded hover:bg-orange-600"
                            >
                                确认清零
                            </button>
                            <button
                                onClick={() => setZeroingModalOpen(false)}
                                className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
                            >
                                取消
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AccountManagement;