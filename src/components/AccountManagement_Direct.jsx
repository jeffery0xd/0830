import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import { Users, AlertCircle, RefreshCw } from 'lucide-react';

const AccountManagementDirect = () => {
    const [staffs, setStaffs] = useState([]);
    const [selectedStaff, setSelectedStaff] = useState(null);
    const [accounts, setAccounts] = useState([]);
    const [isLoading, setIsLoading] = useState(false); // 明确的loading状态
    const [error, setError] = useState(null);
    const [loadStatus, setLoadStatus] = useState('idle'); // 添加详细状态跟踪
    
    const newTablePrefix = 'app_e87b41cfe355428b8146f8bae8184e10_';
    
    // 直接的数据加载函数，无复杂逻辑
    const loadData = async () => {
        console.log('=== 开始加载投放人员数据 ===');
        setIsLoading(true);
        setLoadStatus('loading');
        setError(null);
        
        try {
            console.log('发送数据库查询请求...');
            
            const { data, error } = await supabase
                .from(`${newTablePrefix}personnel`)
                .select('*')
                .order('name');
            
            console.log('数据库查询完成');
            console.log('查询结果:', data);
            console.log('查询错误:', error);
            
            if (error) {
                console.error('数据库查询错误:', error);
                setError(`查询失败: ${error.message}`);
                setLoadStatus('error');
                return;
            }
            
            if (!data) {
                console.warn('查询结果为空');
                setError('未获取到数据');
                setLoadStatus('error');
                return;
            }
            
            console.log('处理查询结果...');
            const validStaffs = data.filter(item => item && item.id && item.name);
            console.log('有效员工数据:', validStaffs);
            
            if (validStaffs.length === 0) {
                console.warn('没有有效的员工数据');
                setError('未找到有效的投放人员');
                setLoadStatus('error');
                return;
            }
            
            console.log('更新状态...');
            setStaffs(validStaffs);
            setLoadStatus('success');
            console.log('=== 数据加载完成 ===');
            
        } catch (err) {
            console.error('加载过程出错:', err);
            setError(`加载失败: ${err.message}`);
            setLoadStatus('error');
        } finally {
            console.log('设置loading为false');
            setIsLoading(false);
        }
    };
    
    // 加载选中员工的账户
    const loadStaffAccounts = async (staff) => {
        if (!staff || !staff.id) {
            setAccounts([]);
            return;
        }
        
        console.log(`加载${staff.name}的账户信息...`);
        
        try {
            const { data, error } = await supabase
                .from(`${newTablePrefix}account_management_ads`)
                .select('*')
                .eq('personnel_id', staff.id)
                .order('created_at', { ascending: false });
            
            if (error) {
                console.error('账户查询错误:', error);
                setAccounts([]);
                return;
            }
            
            const safeAccounts = Array.isArray(data) ? data.map(account => ({
                ...account,
                personnel_name: staff.name
            })) : [];
            
            console.log(`${staff.name}的账户:`, safeAccounts.length, '个');
            setAccounts(safeAccounts);
            
        } catch (err) {
            console.error('加载账户失败:', err);
            setAccounts([]);
        }
    };
    
    // 初始化加载
    useEffect(() => {
        console.log('组件挂载，开始初始化');
        loadData();
    }, []);
    
    // 选择员工处理
    const handleSelectStaff = (staff) => {
        console.log('选择员工:', staff.name);
        setSelectedStaff(staff);
        loadStaffAccounts(staff);
    };
    
    // 渲染加载状态
    if (isLoading && staffs.length === 0) {
        console.log('渲染加载状态, loadStatus:', loadStatus);
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center bg-white p-8 rounded-lg shadow-lg">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">正在加载账户管理</h3>
                    <p className="text-gray-600 mb-2">状态: {loadStatus}</p>
                    <p className="text-sm text-gray-500">连接数据库中...</p>
                    <div className="mt-4 text-xs text-gray-400">
                        调试信息: 员工数量 {staffs.length}, loading: {isLoading.toString()}
                    </div>
                </div>
            </div>
        );
    }
    
    // 渲染错误状态
    if (error) {
        console.log('渲染错误状态:', error);
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
                <div className="bg-white rounded-lg shadow-lg p-8 text-center max-w-md w-full">
                    <AlertCircle className="mx-auto mb-4 text-red-500" size={48} />
                    <h3 className="text-xl font-bold text-gray-800 mb-2">加载失败</h3>
                    <p className="text-gray-600 mb-4">{error}</p>
                    <p className="text-sm text-gray-500 mb-6">状态: {loadStatus}</p>
                    <button
                        onClick={loadData}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors"
                    >
                        重新加载
                    </button>
                </div>
            </div>
        );
    }
    
    // 主界面
    console.log('渲染主界面, 员工数量:', staffs.length);
    
    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white shadow-sm border-b">
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center">
                            <Users className="mr-3 text-blue-600" size={24} />
                            <h1 className="text-2xl font-bold text-gray-900">账户管理</h1>
                            <span className="ml-3 text-sm text-gray-500">
                                投放人员: {staffs.length}人 | 状态: {loadStatus}
                            </span>
                        </div>
                        <button
                            onClick={loadData}
                            disabled={isLoading}
                            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                        >
                            <RefreshCw className={`mr-2 ${isLoading ? 'animate-spin' : ''}`} size={16} />
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
                                <h2 className="text-lg font-semibold text-gray-900">投放人员列表</h2>
                                <p className="text-sm text-gray-500 mt-1">
                                    共 {staffs.length} 人 | 加载状态: {loadStatus}
                                </p>
                            </div>
                            <div className="divide-y divide-gray-200">
                                {staffs.length === 0 ? (
                                    <div className="p-6 text-center text-gray-500">
                                        <Users className="mx-auto mb-2 text-gray-400" size={32} />
                                        <p>暂无投放人员数据</p>
                                        <p className="text-xs mt-1">调试: loading={isLoading.toString()}, status={loadStatus}</p>
                                    </div>
                                ) : (
                                    staffs.map((staff, index) => {
                                        if (!staff || !staff.id) {
                                            console.warn(`无效的员工数据, index: ${index}`, staff);
                                            return null;
                                        }
                                        
                                        return (
                                            <div 
                                                key={staff.id} 
                                                className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
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
                                                                {staff.name_en || `ID: ${staff.id.slice(0, 8)}...`}
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
                                    <div className="flex items-center">
                                        <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-lg mr-4">
                                            {selectedStaff.name?.charAt(0) || '?'}
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-bold text-gray-900">
                                                {selectedStaff.name || '未知员工'}
                                            </h2>
                                            <p className="text-gray-600">{selectedStaff.name_en || '暂无英文名'}</p>
                                            <p className="text-sm text-gray-500 mt-1">
                                                账户数量: {accounts.length} 个
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* 账户列表 */}
                                <div className="bg-white rounded-lg shadow-sm border">
                                    <div className="p-4 border-b">
                                        <h3 className="text-lg font-semibold text-gray-900">
                                            {selectedStaff.name}的账户列表
                                        </h3>
                                        <p className="text-sm text-gray-500 mt-1">
                                            共 {accounts.length} 个账户
                                        </p>
                                    </div>
                                    <div className="divide-y divide-gray-200">
                                        {accounts.length === 0 ? (
                                            <div className="p-8 text-center text-gray-500">
                                                <Users className="mx-auto mb-2 text-gray-400" size={32} />
                                                <p>暂无账户数据</p>
                                                <p className="text-sm mt-1">此员工还没有关联的广告账户</p>
                                            </div>
                                        ) : (
                                            accounts.map((account, index) => {
                                                if (!account) {
                                                    console.warn(`无效的账户数据, index: ${index}`, account);
                                                    return null;
                                                }
                                                
                                                return (
                                                    <div key={account.id || `account-${index}`} className="p-4">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex-1">
                                                                <h4 className="font-medium text-gray-900 mb-1">
                                                                    {account.account_name || '未知账户'}
                                                                </h4>
                                                                <div className="space-y-1">
                                                                    <p className="text-sm text-gray-500">
                                                                        账户ID: {account.ad_account_id || 'N/A'}
                                                                    </p>
                                                                    <p className="text-sm font-medium text-green-600">
                                                                        余额: ¥{parseFloat(account.balance || 0).toFixed(2)}
                                                                    </p>
                                                                    <p className="text-xs text-gray-400">
                                                                        创建时间: {account.created_at ? new Date(account.created_at).toLocaleDateString() : 'N/A'}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <div className="ml-4">
                                                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                                                                    account.status === 'Active' 
                                                                        ? 'bg-green-100 text-green-800' 
                                                                        : 'bg-red-100 text-red-800'
                                                                }`}>
                                                                    {account.status || 'Unknown'}
                                                                </span>
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
                                <p className="text-gray-600 mb-4">
                                    请从左侧列表选择一个投放人员来查看其账户信息
                                </p>
                                <div className="text-sm text-gray-500">
                                    调试信息:
                                    <br />员工总数: {staffs.length}
                                    <br />加载状态: {loadStatus}
                                    <br />是否加载中: {isLoading.toString()}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AccountManagementDirect;