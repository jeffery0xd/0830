import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../utils/supabase';
import { Plus, RefreshCw, AlertCircle, Users, CreditCard, History, Trash2 } from 'lucide-react';

// 极简版错误边界
class SimpleErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error('组件错误:', error);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
                    <div className="bg-white rounded-lg shadow-lg p-8 text-center max-w-md w-full">
                        <AlertCircle className="mx-auto mb-4 text-red-500" size={48} />
                        <h3 className="text-xl font-bold text-gray-800 mb-4">模块加载异常</h3>
                        <p className="text-gray-600 mb-6">请刷新页面重试</p>
                        <button
                            onClick={() => window.location.reload()}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
                        >
                            刷新页面
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

const AccountManagementSimple = () => {
    // 最简化的状态管理
    const [staffs, setStaffs] = useState([]);
    const [selectedStaff, setSelectedStaff] = useState(null);
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    // 使用ref追踪组件挂载状态
    const mountedRef = useRef(true);
    const loadingRef = useRef(false);
    
    const newTablePrefix = 'app_e87b41cfe355428b8146f8bae8184e10_';
    
    // 安全的状态更新函数
    const safeSetState = (setter, value) => {
        if (mountedRef.current && !loadingRef.current) {
            try {
                setter(value);
            } catch (err) {
                console.error('状态更新失败:', err);
            }
        }
    };
    
    // 最简化的人员加载函数
    const loadStaffs = async () => {
        if (loadingRef.current) return;
        
        loadingRef.current = true;
        safeSetState(setLoading, true);
        safeSetState(setError, null);
        
        try {
            console.log('开始加载投放人员...');
            
            const { data, error } = await supabase
                .from(`${newTablePrefix}personnel`)
                .select('*')
                .order('name');
            
            if (error) {
                throw new Error(`数据库查询失败: ${error.message}`);
            }
            
            console.log('查询结果:', data);
            
            // 简单的数据验证
            const validStaffs = Array.isArray(data) ? data.filter(item => item?.id && item?.name) : [];
            
            if (validStaffs.length === 0) {
                throw new Error('未找到有效的投放人员数据');
            }
            
            safeSetState(setStaffs, validStaffs);
            console.log('投放人员加载成功:', validStaffs.length, '人');
            
        } catch (err) {
            console.error('加载投放人员失败:', err);
            safeSetState(setError, err.message || '加载失败');
            
            // 简单的重试机制
            setTimeout(() => {
                if (mountedRef.current) {
                    loadingRef.current = false;
                    loadStaffs();
                }
            }, 3000);
        } finally {
            safeSetState(setLoading, false);
            loadingRef.current = false;
        }
    };
    
    // 简化的账户加载函数
    const loadAccounts = async (staff) => {
        if (!staff?.id) {
            safeSetState(setAccounts, []);
            return;
        }
        
        try {
            const { data, error } = await supabase
                .from(`${newTablePrefix}account_management_ads`)
                .select('*')
                .eq('personnel_id', staff.id)
                .order('created_at', { ascending: false });
            
            if (!error && Array.isArray(data)) {
                const safeAccounts = data.map(account => ({
                    ...account,
                    personnel_name: staff.name
                }));
                safeSetState(setAccounts, safeAccounts);
            } else {
                safeSetState(setAccounts, []);
            }
        } catch (err) {
            console.error('加载账户失败:', err);
            safeSetState(setAccounts, []);
        }
    };
    
    // 组件挂载
    useEffect(() => {
        mountedRef.current = true;
        
        // 延迟加载，确保组件完全挂载
        const timer = setTimeout(() => {
            if (mountedRef.current) {
                loadStaffs();
            }
        }, 100);
        
        return () => {
            mountedRef.current = false;
            loadingRef.current = false;
            clearTimeout(timer);
        };
    }, []);
    
    // 选择员工处理
    const handleSelectStaff = (staff) => {
        safeSetState(setSelectedStaff, staff);
        loadAccounts(staff);
    };
    
    // 渲染加载状态
    if (loading && staffs.length === 0) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">正在加载账户管理</h3>
                    <p className="text-gray-600">连接数据库中...</p>
                    {error && (
                        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md max-w-md mx-auto">
                            <p className="text-red-600 text-sm">{error}</p>
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
                <div className="bg-white rounded-lg shadow-lg p-8 text-center max-w-md w-full">
                    <AlertCircle className="mx-auto mb-4 text-red-500" size={48} />
                    <h3 className="text-xl font-bold text-gray-800 mb-2">加载失败</h3>
                    <p className="text-gray-600 mb-6">{error}</p>
                    <div className="space-y-2">
                        <button
                            onClick={() => {
                                loadingRef.current = false;
                                loadStaffs();
                            }}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors"
                        >
                            重新加载
                        </button>
                        <button
                            onClick={() => window.location.reload()}
                            className="w-full bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md transition-colors"
                        >
                            刷新页面
                        </button>
                    </div>
                </div>
            </div>
        );
    }
    
    return (
        <SimpleErrorBoundary>
            <div className="min-h-screen bg-gray-50">
                {/* Header */}
                <div className="bg-white shadow-sm border-b">
                    <div className="max-w-7xl mx-auto px-4 py-4">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center">
                                <Users className="mr-3 text-blue-600" size={24} />
                                <h1 className="text-2xl font-bold text-gray-900">账户管理</h1>
                                <span className="ml-3 text-sm text-gray-500">
                                    投放人员: {staffs.length}人
                                </span>
                            </div>
                            <button
                                onClick={() => {
                                    loadingRef.current = false;
                                    loadStaffs();
                                }}
                                disabled={loading}
                                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                            >
                                <RefreshCw className={`mr-2 ${loading ? 'animate-spin' : ''}`} size={16} />
                                刷新数据
                            </button>
                        </div>
                    </div>
                </div>

                <div className="max-w-7xl mx-auto px-4 py-6">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* 左侧：投放人员列表 */}
                        <div className="lg:col-span-1">
                            <div className="bg-white rounded-lg shadow-sm border">
                                <div className="p-4 border-b">
                                    <h2 className="text-lg font-semibold text-gray-900">投放人员</h2>
                                </div>
                                <div className="divide-y divide-gray-200">
                                    {staffs.length === 0 ? (
                                        <div className="p-4 text-center text-gray-500">
                                            暂无投放人员
                                        </div>
                                    ) : (
                                        staffs.map((staff) => {
                                            if (!staff?.id) return null;
                                            
                                            return (
                                                <div 
                                                    key={staff.id} 
                                                    className="p-4 hover:bg-gray-50 cursor-pointer"
                                                    onClick={() => handleSelectStaff(staff)}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center">
                                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold mr-3 ${
                                                                selectedStaff?.id === staff.id ? 'bg-blue-600' : 'bg-gray-500'
                                                            }`}>
                                                                {staff.name?.charAt(0) || '?'}
                                                            </div>
                                                            <div>
                                                                <h3 className="font-medium text-gray-900">
                                                                    {staff.name || '未知员工'}
                                                                </h3>
                                                                <p className="text-sm text-gray-500">
                                                                    {staff.name_en || ''}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                                                            selectedStaff?.id === staff.id ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                                                        }`}>
                                                            {selectedStaff?.id === staff.id ? '已选择' : '点击选择'}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* 右侧：账户详情 */}
                        <div className="lg:col-span-2">
                            {selectedStaff ? (
                                <div className="space-y-6">
                                    {/* 员工信息 */}
                                    <div className="bg-white rounded-lg shadow-sm border p-6">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center">
                                                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-lg mr-4">
                                                    {selectedStaff.name?.charAt(0) || '?'}
                                                </div>
                                                <div>
                                                    <h2 className="text-xl font-bold text-gray-900">
                                                        {selectedStaff.name || '未知员工'}
                                                    </h2>
                                                    <p className="text-gray-600">{selectedStaff.name_en || ''}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 账户列表 */}
                                    <div className="bg-white rounded-lg shadow-sm border">
                                        <div className="p-4 border-b">
                                            <h3 className="text-lg font-semibold text-gray-900">账户列表</h3>
                                        </div>
                                        <div className="divide-y divide-gray-200">
                                            {accounts.length === 0 ? (
                                                <div className="p-8 text-center text-gray-500">
                                                    <Users className="mx-auto mb-2 text-gray-400" size={32} />
                                                    <p>暂无账户数据</p>
                                                </div>
                                            ) : (
                                                accounts.map((account, index) => {
                                                    if (!account) return null;
                                                    
                                                    return (
                                                        <div key={account.id || index} className="p-4">
                                                            <div className="flex items-center justify-between">
                                                                <div>
                                                                    <h4 className="font-medium text-gray-900">
                                                                        {account.account_name || '未知账户'}
                                                                    </h4>
                                                                    <p className="text-sm text-gray-500">
                                                                        账户ID: {account.ad_account_id || 'N/A'}
                                                                    </p>
                                                                    <p className="text-sm font-medium text-green-600">
                                                                        余额: ¥{parseFloat(account.balance || 0).toFixed(2)}
                                                                    </p>
                                                                </div>
                                                                <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                                                                    account.status === 'Active' 
                                                                        ? 'bg-green-100 text-green-800' 
                                                                        : 'bg-red-100 text-red-800'
                                                                }`}>
                                                                    {account.status || 'Unknown'}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
                                    <Users className="mx-auto mb-4 text-gray-400" size={48} />
                                    <h3 className="text-lg font-medium text-gray-900 mb-2">选择投放人员</h3>
                                    <p className="text-gray-600">请从左侧列表选择一个投放人员来查看其账户信息</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </SimpleErrorBoundary>
    );
};

export default AccountManagementSimple;