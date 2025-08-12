import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../utils/supabase';
import PublicScreen from './PublicScreen';
import AddAccountModal from './AddAccountModal';
import RechargeModal from './RechargeModal';
import SimpleZeroingModal from './SimpleZeroingModal';
import { Plus, RefreshCw, AlertCircle, History, Trash2, Users, CreditCard, CheckCircle, XCircle, ChevronDown } from 'lucide-react';
import { rechargeOperationsService, accountService, personnelService } from '../services/accountManagementService';

// 强化版错误边界组件
class AccountManagementErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorId: Date.now() };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error, errorId: Date.now() };
    }

    componentDidCatch(error, errorInfo) {
        console.error('账户管理组件错误:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
                    <div className="max-w-md w-full">
                        <div className="bg-white rounded-lg shadow-lg p-6 text-center">
                            <AlertCircle className="mx-auto mb-4 text-red-500" size={48} />
                            <h3 className="text-xl font-bold text-gray-800 mb-2">账户管理模块异常</h3>
                            <p className="text-gray-600 mb-4">遇到了一些技术问题，请刷新页面重试</p>
                            <button
                                onClick={() => window.location.reload()}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors"
                            >
                                刷新页面
                            </button>
                            <div className="mt-4 text-xs text-gray-400">
                                错误ID: {this.state.errorId}
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

// 安全的列表渲染组件
const SafeList = ({ items = [], renderItem, emptyMessage = "暂无数据", className = "" }) => {
    const safeItems = Array.isArray(items) ? items.filter(item => item && typeof item === 'object') : [];
    
    if (safeItems.length === 0) {
        return (
            <div className={`text-center py-4 text-gray-500 ${className}`}>
                {emptyMessage}
            </div>
        );
    }
    
    return (
        <div className={className}>
            {safeItems.map((item, index) => {
                try {
                    return renderItem(item, index);
                } catch (error) {
                    console.error('列表项渲染错误:', error);
                    return (
                        <div key={`error-${index}`} className="p-2 bg-red-50 text-red-600 text-sm rounded">
                            项目渲染错误
                        </div>
                    );
                }
            })}
        </div>
    );
};

const AccountManagement = () => {
    // 状态管理 - 使用更安全的初始值
    const [staffs, setStaffs] = useState([]);
    const [selectedStaff, setSelectedStaff] = useState(null);
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(false); // 改为false，避免卡住
    const [loadingAccounts, setLoadingAccounts] = useState(false);
    const [error, setError] = useState(null);
    
    // 模态框状态
    const [isAddModalOpen, setAddModalOpen] = useState(false);
    const [isRechargeModalOpen, setRechargeModalOpen] = useState(false);
    const [isZeroingModalOpen, setZeroingModalOpen] = useState(false);
    const [selectedAccount, setSelectedAccount] = useState(null);
    const [isRechargeHistoryModalOpen, setRechargeHistoryModalOpen] = useState(false);
    const [rechargeHistory, setRechargeHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    
    // 其他状态
    const [publicScreenRefreshTrigger, setPublicScreenRefreshTrigger] = useState(0);
    const [expandedStaff, setExpandedStaff] = useState(null);
    const [todayRechargeOperations, setTodayRechargeOperations] = useState([]);
    const [allStaffAccounts, setAllStaffAccounts] = useState({});

    // 表前缀和引用
    const oldTablePrefix = 'app_5c098b55fc88465db9b331c43b51ef43_';
    const newTablePrefix = 'app_e87b41cfe355428b8146f8bae8184e10_';
    const mountedRef = useRef(true);
    const loadingRef = useRef(false); // 简化的加载状态管理

    // 简化版人员加载函数
    const fetchStaffs = useCallback(async () => {
        // 防止重复请求
        if (loadingRef.current) {
            console.log('已有请求进行中，跳过重复请求');
            return;
        }
        
        loadingRef.current = true;
        setLoading(true);
        setError(null);
        
        try {
            console.log('开始加载投放人员信息...');
            
            const { data, error } = await supabase
                .from(`${newTablePrefix}personnel`)
                .select('*')
                .order('name', { ascending: true });
            
            if (error) {
                console.error('Supabase 查询错误:', error);
                throw new Error(`数据库查询失败: ${error.message}`);
            }
            
            console.log('查询结果:', data);
            
            if (!data || !Array.isArray(data)) {
                throw new Error('获取到的数据格式不正确');
            }
            
            // 安全的数据处理
            const validStaffs = data.filter(item => item && item.id && item.name);
            
            if (validStaffs.length === 0) {
                throw new Error('未找到有效的投放人员数据');
            }
            
            console.log('处理后的人员数据:', validStaffs);
            
            if (mountedRef.current) {
                setStaffs(validStaffs);
                
                // 异步加载附加数据，不阻塞主要流程
                setTimeout(() => {
                    if (mountedRef.current) {
                        fetchTodayRechargeOperations().catch(err => {
                            console.warn('加载今日充值记录失败:', err);
                        });
                        fetchAllStaffAccounts(validStaffs).catch(err => {
                            console.warn('加载所有账户信息失败:', err);
                        });
                    }
                }, 500);
            }
            
        } catch (error) {
            console.error('加载投放人员失败:', error);
            if (mountedRef.current) {
                setError(`加载投放人员失败: ${error.message}`);
                // 提供重试机制
                setTimeout(() => {
                    if (mountedRef.current && !loadingRef.current) {
                        console.log('自动重试加载投放人员...');
                        fetchStaffs();
                    }
                }, 3000);
            }
        } finally {
            if (mountedRef.current) {
                setLoading(false);
            }
            loadingRef.current = false;
        }
    }, [newTablePrefix]);

    // 从旧表获取账户数据
    const fetchAccountsFromOldTable = useCallback(async (staffName) => {
        if (!staffName || typeof staffName !== 'string') {
            return [];
        }
        
        try {
            const { data, error } = await supabase
                .from(`${oldTablePrefix}advertising_accounts`)
                .select('*')
                .order('created_at', { ascending: false });
            
            if (error) {
                console.error('查询旧表错误:', error);
                return [];
            }
            
            if (!Array.isArray(data)) {
                return [];
            }
            
            // 安全的数据过滤
            const nameKeyword = staffName.charAt(0);
            const filteredAccounts = data.filter(account => 
                account && 
                account.account_name && 
                typeof account.account_name === 'string' &&
                account.account_name.includes(nameKeyword)
            );
            
            // 安全的数据转换
            return filteredAccounts.map(account => ({
                id: account.id || `old_${Math.random()}`,
                account_name: account.account_name || '未知账户',
                ad_account_id: account.account_id || '',
                status: 'Active',
                personnel_name: staffName,
                personnel_id: null,
                balance: account.balance || '0.00',
                created_at: account.created_at || new Date().toISOString(),
                updated_at: account.updated_at || new Date().toISOString()
            }));
        } catch (error) {
            console.error('获取旧账户数据失败:', error);
            return [];
        }
    }, [oldTablePrefix]);

    // 获取今日充值记录
    const fetchTodayRechargeOperations = useCallback(async () => {
        try {
            const todayOperations = await rechargeOperationsService.getTodayOperations();
            const safeOperations = Array.isArray(todayOperations) ? todayOperations : [];
            if (mountedRef.current) {
                setTodayRechargeOperations(safeOperations);
            }
        } catch (error) {
            console.error('获取今日充值记录失败:', error);
            if (mountedRef.current) {
                setTodayRechargeOperations([]);
            }
        }
    }, []);

    // 获取所有人员的账户信息
    const fetchAllStaffAccounts = useCallback(async (staffList) => {
        try {
            const safeStaffList = Array.isArray(staffList) ? staffList.filter(s => s && s.id) : [];
            
            if (safeStaffList.length === 0) {
                setAllStaffAccounts({});
                return;
            }

            const accountsMap = {};
            
            for (const staff of safeStaffList) {
                if (!mountedRef.current) break;
                
                try {
                    // 优先从新表获取数据
                    const { data: newData } = await supabase
                        .from(`${newTablePrefix}account_management_ads`)
                        .select('*')
                        .eq('personnel_id', staff.id)
                        .order('created_at', { ascending: false });
                    
                    let accounts = [];
                    
                    if (Array.isArray(newData) && newData.length > 0) {
                        accounts = newData.map(account => ({
                            ...account,
                            personnel_name: staff.name || '未知员工'
                        }));
                    } else if (staff.name) {
                        accounts = await fetchAccountsFromOldTable(staff.name);
                    }
                    
                    accountsMap[staff.id] = Array.isArray(accounts) ? accounts : [];
                } catch (error) {
                    console.error(`获取 ${staff.name || 'unknown'} 的账户失败:`, error);
                    accountsMap[staff.id] = [];
                }
            }
            
            if (mountedRef.current) {
                setAllStaffAccounts(accountsMap);
            }
        } catch (error) {
            console.error('获取所有人员账户信息失败:', error);
            if (mountedRef.current) {
                setAllStaffAccounts({});
            }
        }
    }, [newTablePrefix, fetchAccountsFromOldTable]);

    // 获取账户列表
    const fetchAccounts = useCallback(async (staff) => {
        if (!staff || !staff.id) {
            setAccounts([]);
            return;
        }
        
        try {
            setLoadingAccounts(true);
            
            // 优先从新表获取数据
            const { data: newData } = await supabase
                .from(`${newTablePrefix}account_management_ads`)
                .select('*')
                .eq('personnel_id', staff.id)
                .order('created_at', { ascending: false });
            
            let accounts = [];
            
            if (Array.isArray(newData) && newData.length > 0) {
                accounts = newData.map(account => ({
                    ...account,
                    personnel_name: staff.name || '未知员工'
                }));
            } else if (staff.name) {
                accounts = await fetchAccountsFromOldTable(staff.name);
            }
            
            if (mountedRef.current) {
                const safeAccounts = Array.isArray(accounts) ? accounts : [];
                setAccounts(safeAccounts);
            }
        } catch (error) {
            console.error('获取账户列表失败:', error);
            if (mountedRef.current) {
                setAccounts([]);
            }
        } finally {
            if (mountedRef.current) {
                setLoadingAccounts(false);
            }
        }
    }, [newTablePrefix, fetchAccountsFromOldTable]);

    // 组件挂载
    useEffect(() => {
        mountedRef.current = true;
        
        // 立即开始加载
        console.log('组件挂载，开始初始化数据');
        fetchStaffs();
        
        return () => {
            mountedRef.current = false;
            loadingRef.current = false;
        };
    }, []); // 移除 fetchStaffs 依赖，避免循环

    // 事件处理函数
    const handleAccountAdded = useCallback(() => {
        if (selectedStaff) {
            fetchAccounts(selectedStaff);
        }
        setAddModalOpen(false);
        setPublicScreenRefreshTrigger(prev => prev + 1);
        
        // 延迟刷新其他数据
        setTimeout(() => {
            if (mountedRef.current) {
                fetchTodayRechargeOperations();
                if (Array.isArray(staffs) && staffs.length > 0) {
                    fetchAllStaffAccounts(staffs);
                }
            }
        }, 500);
    }, [selectedStaff, staffs, fetchAccounts, fetchTodayRechargeOperations, fetchAllStaffAccounts]);

    const handleRecharge = useCallback(() => {
        setRechargeModalOpen(false);
        setPublicScreenRefreshTrigger(prev => prev + 1);
        
        setTimeout(() => {
            if (mountedRef.current) {
                fetchTodayRechargeOperations();
            }
        }, 500);
    }, [fetchTodayRechargeOperations]);

    const handleZeroing = useCallback(() => {
        setZeroingModalOpen(false);
        setPublicScreenRefreshTrigger(prev => prev + 1);
    }, []);

    const handleViewRechargeHistory = async (account) => {
        if (!account || !account.id) {
            return;
        }
        
        try {
            setSelectedAccount(account);
            setRechargeHistoryModalOpen(true);
            setLoadingHistory(true);
            
            const history = await rechargeOperationsService.getByAccount(account.id);
            const safeHistory = Array.isArray(history) ? history : [];
            setRechargeHistory(safeHistory);
        } catch (error) {
            console.error('获取充值记录失败:', error);
            setRechargeHistory([]);
        } finally {
            setLoadingHistory(false);
        }
    };

    const handleDeleteAccount = async (accountId) => {
        if (!accountId) return;
        
        try {
            const confirmed = window.confirm('确定要删除这个账户吗？');
            if (!confirmed) return;
            
            await accountService.delete(accountId);
            
            // 刷新当前选中员工的账户列表
            if (selectedStaff) {
                await fetchAccounts(selectedStaff);
            }
            
            setPublicScreenRefreshTrigger(prev => prev + 1);
            
            // 延迟刷新其他数据
            setTimeout(() => {
                if (mountedRef.current && Array.isArray(staffs) && staffs.length > 0) {
                    fetchAllStaffAccounts(staffs);
                }
            }, 500);
        } catch (error) {
            console.error('删除账户失败:', error);
            alert('删除账户失败，请重试');
        }
    };

    // 渲染加载状态
    if (loading && staffs.length === 0) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">正在连接数据库...</p>
                    <p className="text-sm text-gray-500 mt-2">正在加载投放人员信息</p>
                    {error && (
                        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                            <p className="text-red-600 text-sm">{error}</p>
                            <button 
                                onClick={fetchStaffs}
                                className="mt-2 text-sm text-blue-600 hover:text-blue-800 underline"
                            >
                                点击重试
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // 渲染错误状态
    if (error && staffs.length === 0) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
                <div className="max-w-md w-full">
                    <div className="bg-white rounded-lg shadow-lg p-6 text-center">
                        <AlertCircle className="mx-auto mb-4 text-red-500" size={48} />
                        <h3 className="text-xl font-bold text-gray-800 mb-2">加载失败</h3>
                        <p className="text-gray-600 mb-4">{error}</p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => window.location.reload()}
                                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors"
                            >
                                刷新页面
                            </button>
                            <button
                                onClick={fetchStaffs}
                                className="flex-1 bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md transition-colors"
                            >
                                重试
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <AccountManagementErrorBoundary>
            <div className="min-h-screen bg-gray-50">
                {/* Header */}
                <div className="bg-white shadow-sm border-b border-gray-200">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="flex justify-between items-center py-4">
                            <div className="flex items-center">
                                <Users className="mr-3 text-blue-600" size={24} />
                                <h1 className="text-2xl font-bold text-gray-900">账户管理</h1>
                                <span className="ml-3 text-sm text-gray-500">投放人员: {staffs.length}人</span>
                            </div>
                            <button
                                onClick={fetchStaffs}
                                disabled={loading}
                                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                            >
                                <RefreshCw className={`mr-2 ${loading ? 'animate-spin' : ''}`} size={16} />
                                刷新数据
                            </button>
                        </div>
                    </div>
                </div>

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* 左侧：投放人员列表 */}
                        <div className="lg:col-span-1">
                            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                                <div className="p-4 border-b border-gray-200">
                                    <h2 className="text-lg font-semibold text-gray-900">投放人员</h2>
                                </div>
                                <div className="divide-y divide-gray-200">
                                    <SafeList
                                        items={staffs}
                                        emptyMessage="暂无投放人员"
                                        renderItem={(staff, index) => {
                                            const staffAccounts = allStaffAccounts[staff.id] || [];
                                            const totalBalance = staffAccounts.reduce((sum, account) => {
                                                const balance = parseFloat(account.balance) || 0;
                                                return sum + balance;
                                            }, 0);
                                            
                                            return (
                                                <div key={staff.id || index} className="p-4 hover:bg-gray-50 cursor-pointer">
                                                    <div 
                                                        onClick={() => {
                                                            setSelectedStaff(staff);
                                                            fetchAccounts(staff);
                                                        }}
                                                        className="flex items-center justify-between"
                                                    >
                                                        <div className="flex items-center">
                                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold mr-3 ${
                                                                selectedStaff?.id === staff.id ? 'bg-blue-600' : 'bg-gray-500'
                                                            }`}>
                                                                {staff.name?.charAt(0) || '?'}
                                                            </div>
                                                            <div>
                                                                <h3 className="font-medium text-gray-900">{staff.name || '未知员工'}</h3>
                                                                <p className="text-sm text-gray-500">
                                                                    {staffAccounts.length} 个账户
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-sm font-medium text-gray-900">
                                                                ¥{totalBalance.toFixed(2)}
                                                            </div>
                                                            <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                                                                staffAccounts.length > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                                            }`}>
                                                                {staffAccounts.length > 0 ? 'Active' : 'Inactive'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* 右侧：账户详情和操作 */}
                        <div className="lg:col-span-2">
                            {selectedStaff ? (
                                <div className="space-y-6">
                                    {/* 员工信息和操作按钮 */}
                                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                                        <div className="flex items-center justify-between mb-6">
                                            <div className="flex items-center">
                                                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-lg mr-4">
                                                    {selectedStaff.name?.charAt(0) || '?'}
                                                </div>
                                                <div>
                                                    <h2 className="text-xl font-bold text-gray-900">{selectedStaff.name || '未知员工'}</h2>
                                                    <p className="text-gray-600">{selectedStaff.name_en || ''}</p>
                                                </div>
                                            </div>
                                            <div className="flex space-x-3">
                                                <button
                                                    onClick={() => setAddModalOpen(true)}
                                                    className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                                                >
                                                    <Plus className="mr-2" size={16} />
                                                    添加账户
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 账户列表 */}
                                    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                                        <div className="p-4 border-b border-gray-200">
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-lg font-semibold text-gray-900">账户列表</h3>
                                                {loadingAccounts && (
                                                    <div className="flex items-center text-sm text-gray-500">
                                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                                                        加载中...
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="divide-y divide-gray-200">
                                            <SafeList
                                                items={accounts}
                                                emptyMessage={loadingAccounts ? "正在加载账户..." : "暂无账户"}
                                                renderItem={(account, index) => (
                                                    <div key={account.id || index} className="p-4">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex-1">
                                                                <div className="flex items-center">
                                                                    <h4 className="font-medium text-gray-900">{account.account_name || '未知账户'}</h4>
                                                                    <span className={`ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs ${
                                                                        account.status === 'Active' 
                                                                            ? 'bg-green-100 text-green-800' 
                                                                            : 'bg-red-100 text-red-800'
                                                                    }`}>
                                                                        {account.status || 'Unknown'}
                                                                    </span>
                                                                </div>
                                                                <p className="text-sm text-gray-500 mt-1">
                                                                    账户ID: {account.ad_account_id || 'N/A'}
                                                                </p>
                                                                <p className="text-sm font-medium text-green-600 mt-1">
                                                                    余额: ¥{parseFloat(account.balance || 0).toFixed(2)}
                                                                </p>
                                                            </div>
                                                            <div className="flex items-center space-x-2">
                                                                <button
                                                                    onClick={() => {
                                                                        setSelectedAccount(account);
                                                                        setRechargeModalOpen(true);
                                                                    }}
                                                                    className="flex items-center px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors"
                                                                >
                                                                    <CreditCard className="mr-1" size={14} />
                                                                    充值
                                                                </button>
                                                                <button
                                                                    onClick={() => handleViewRechargeHistory(account)}
                                                                    className="flex items-center px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700 transition-colors"
                                                                >
                                                                    <History className="mr-1" size={14} />
                                                                    历史
                                                                </button>
                                                                <button
                                                                    onClick={() => {
                                                                        setSelectedAccount(account);
                                                                        setZeroingModalOpen(true);
                                                                    }}
                                                                    className="flex items-center px-3 py-1 bg-orange-600 text-white rounded text-sm hover:bg-orange-700 transition-colors"
                                                                >
                                                                    清零
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteAccount(account.id)}
                                                                    className="flex items-center px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition-colors"
                                                                >
                                                                    <Trash2 className="mr-1" size={14} />
                                                                    删除
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
                                    <Users className="mx-auto mb-4 text-gray-400" size={48} />
                                    <h3 className="text-lg font-medium text-gray-900 mb-2">选择投放人员</h3>
                                    <p className="text-gray-600">请从左侧列表选择一个投放人员来查看和管理其账户</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* 模态框组件 */}
                {isAddModalOpen && selectedStaff && (
                    <AddAccountModal
                        isOpen={isAddModalOpen}
                        onClose={() => setAddModalOpen(false)}
                        onAccountAdded={handleAccountAdded}
                        selectedStaff={selectedStaff}
                    />
                )}

                {isRechargeModalOpen && selectedAccount && (
                    <RechargeModal
                        isOpen={isRechargeModalOpen}
                        onClose={() => setRechargeModalOpen(false)}
                        onRecharge={handleRecharge}
                        account={selectedAccount}
                    />
                )}

                {isZeroingModalOpen && selectedAccount && (
                    <SimpleZeroingModal
                        isOpen={isZeroingModalOpen}
                        onClose={() => setZeroingModalOpen(false)}
                        onZeroing={handleZeroing}
                        account={selectedAccount}
                    />
                )}

                {/* 充值历史模态框 */}
                {isRechargeHistoryModalOpen && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
                            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                                <h3 className="text-lg font-semibold">充值历史 - {selectedAccount?.account_name}</h3>
                                <button
                                    onClick={() => setRechargeHistoryModalOpen(false)}
                                    className="text-gray-500 hover:text-gray-700"
                                >
                                    <XCircle size={24} />
                                </button>
                            </div>
                            <div className="p-4 max-h-96 overflow-y-auto">
                                {loadingHistory ? (
                                    <div className="text-center py-4">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                                        <p className="text-gray-600">加载充值历史...</p>
                                    </div>
                                ) : (
                                    <SafeList
                                        items={rechargeHistory}
                                        emptyMessage="暂无充值记录"
                                        renderItem={(record, index) => (
                                            <div key={record.id || index} className="border border-gray-200 rounded-lg p-4 mb-3">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <p className="font-medium text-gray-900">
                                                            充值金额: ¥{parseFloat(record.amount || 0).toFixed(2)}
                                                        </p>
                                                        <p className="text-sm text-gray-600">
                                                            时间: {record.created_at ? new Date(record.created_at).toLocaleString() : 'N/A'}
                                                        </p>
                                                        {record.description && (
                                                            <p className="text-sm text-gray-600">备注: {record.description}</p>
                                                        )}
                                                    </div>
                                                    <div className="text-right">
                                                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                                                            record.status === 'completed' 
                                                                ? 'bg-green-100 text-green-800' 
                                                                : 'bg-yellow-100 text-yellow-800'
                                                        }`}>
                                                            {record.status === 'completed' ? '已完成' : '处理中'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* 公屏组件 */}
                <PublicScreen key={publicScreenRefreshTrigger} />
            </div>
        </AccountManagementErrorBoundary>
    );
};

export default AccountManagement;