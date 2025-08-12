import React, { useState } from 'react';
import { supabase } from '../utils/supabase';
import { X, DollarSign, Loader2 } from 'lucide-react';

// 修复版RechargeModal - 解决数据库null值约束问题
const RechargeModal = ({ isOpen, onClose, onSuccess, account }) => {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const tablePrefix = 'app_e87b41cfe355428b8146f8bae8184e10_';

  if (!isOpen || !account) return null;

    const handleRecharge = async (e) => {
        e.preventDefault();
        
        // 输入验证
        if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
            setError('请输入有效的充值金额');
            return;
        }

        try {
            setLoading(true);
            setError('');

            // 详细的调试信息
            console.log('=== 充值操作开始 ===');
            console.log('原始account对象:', JSON.stringify(account, null, 2));
            
            // 确保所有必需字段都有有效值（解决null值约束问题）
            const safeAccountName = account.account_name || 
                                   account.name || 
                                   `Account_${account.id}` || 
                                   'Unknown Account';
            
            const safeAdAccountId = account.ad_account_id || 
                                   account.account_id || 
                                   account.id || 
                                   'N/A';
            
            const safePersonnelId = account.personnel_id || null;
            
            const safeOperatorName = account.personnel_name || 
                                    account.operator_name || 
                                    '系统操作员';

            // 检查当天该账户的充值次数
            const today = new Date().toISOString().split('T')[0];
            const { data: todayOperations, error: historyError } = await supabase
                .from(`${tablePrefix}recharge_operations`)
                .select('id')
                .eq('account_id', account.id)
                .gte('created_at', today);
            
            if (historyError) {
                console.warn('获取历史记录失败，继续执行充值操作:', historyError);
            }
            
            const rechargeCount = (todayOperations?.length || 0) + 1;
            
            // 生成描述，包含充值次数信息
            let description;
            if (rechargeCount === 1) {
                description = `充值 $${parseFloat(amount).toFixed(2)} - ${safeAccountName} (${safeOperatorName})`;
            } else if (rechargeCount === 2) {
                description = `补充充值二次 $${parseFloat(amount).toFixed(2)} - ${safeAccountName} (${safeOperatorName})`;
            } else if (rechargeCount === 3) {
                description = `补充充值三次 $${parseFloat(amount).toFixed(2)} - ${safeAccountName} (${safeOperatorName})`;
            } else {
                description = `补充充值第${rechargeCount}次 $${parseFloat(amount).toFixed(2)} - ${safeAccountName} (${safeOperatorName})`;
            }
            
            // 准备要插入的数据 - 确保所有字段都有值
            const rechargeData = {
                account_id: account.id,
                personnel_id: safePersonnelId,
                account_name: safeAccountName, // 确保不为null
                ad_account_id: safeAdAccountId,
                amount: parseFloat(amount),
                operator_name: safeOperatorName,
                description: description
            };
            
            console.log('准备插入的充值数据:', JSON.stringify(rechargeData, null, 2));
            
            // 执行插入操作
            const { data: insertedData, error: insertError } = await supabase
                .from(`${tablePrefix}recharge_operations`)
                .insert(rechargeData)
                .select();
            
            if (insertError) {
                console.error('数据库插入错误:', insertError);
                throw insertError;
            }
            
            console.log('充值记录创建成功:', insertedData);
            
            // 重置表单
            setAmount('');
            
            // 先关闭模态框，再调用成功回调
            onClose();
            
            // 延迟调用成功回调，避免状态冲突
            setTimeout(() => {
                if (onSuccess) {
                    onSuccess();
                }
            }, 100); // 增加延迟时间确保状态更新
            
        } catch (error) {
            console.error('=== 充值操作失败 ===');
            console.error('错误详情:', error);
            console.error('错误代码:', error.code);
            console.error('错误消息:', error.message);
            
            let errorMessage = '充值失败，请重试';
            
            if (error.message) {
                if (error.code === '23502') {
                    // PostgreSQL NOT NULL约束违反
                    errorMessage = '数据不完整，请联系管理员检查账户信息';
                } else if (error.message.includes('personnel_id')) {
                    errorMessage = '员工信息不完整，请联系管理员';
                } else if (error.message.includes('account_name')) {
                    errorMessage = '账户名称信息缺失，请联系管理员';
                } else if (error.message.includes('duplicate')) {
                    errorMessage = '充值记录重复，请检查后重试';
                } else if (error.message.includes('network') || error.message.includes('connection')) {
                    errorMessage = '网络连接失败，请检查网络后重试';
                } else {
                    errorMessage = `充值失败: ${error.message}`;
                }
            }
            
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // 安全获取账户名称和ID用于显示
  const displayAccountName = account.account_name || account.name || '未知账户';
  const displayAdAccountId = account.ad_account_id || account.account_id || account.id || 'N/A';

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={handleOverlayClick}
    >
      <div className="bg-white border border-gray-200 rounded-xl p-4 lg:p-6 w-full max-w-md mx-auto shadow-lg transform transition-all max-h-screen overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"></div>
            <h3 className="text-2xl font-bold text-gray-800 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              账户充值
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors p-2 rounded-lg hover:bg-gray-100/50"
          >
            <X size={24} />
          </button>
        </div>

        {/* Account Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600 font-medium">账户名称：</span>
              <span className="text-gray-800 font-bold">{displayAccountName}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 font-medium">广告账户ID：</span>
              <span className="text-gray-800 font-mono bg-white/70 px-2 py-1 rounded text-sm">
                {displayAdAccountId}
              </span>
            </div>
            {account.personnel_name && (
              <div className="flex justify-between items-center">
                <span className="text-gray-600 font-medium">投放人员：</span>
                <span className="text-gray-800 font-medium">{account.personnel_name}</span>
              </div>
            )}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleRecharge} className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-3">
              充值金额 (美元)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-blue-600 font-bold">
                <DollarSign size={18} />
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setError('');
                }}
                placeholder="0.00"
                className="w-full bg-white text-gray-800 rounded-lg pl-12 pr-4 py-3 focus:ring-2 focus:ring-blue-500 focus:outline-none border border-gray-300 hover:border-blue-400 transition-colors font-mono text-lg"
                required
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border-l-4 border-red-400 rounded-xl p-4">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">充值错误</h3>
                  <div className="mt-1 text-sm text-red-700">
                    {error}
                  </div>
                  {error.includes('数据不完整') && (
                    <div className="mt-2">
                      <div className="text-xs text-red-600">
                        <strong>调试信息：</strong>
                        <ul className="list-disc list-inside mt-1 space-y-1">
                          <li>账户名称: {displayAccountName}</li>
                          <li>账户ID: {displayAdAccountId}</li>
                          <li>人员ID: {account.personnel_id || '未设置'}</li>
                          <li>操作员: {account.personnel_name || '未知'}</li>
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-white hover:bg-gray-50 text-gray-700 py-3 px-6 rounded-lg font-semibold transition-colors border border-gray-300 hover:border-gray-400"
              disabled={loading}
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 px-6 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <Loader2 className="animate-spin mr-2" size={18} />
                  提交中...
                </div>
              ) : (
                <div className="flex items-center justify-center">
                  <DollarSign className="mr-2" size={18} />
                  确认充值
                </div>
              )}
            </button>
          </div>
        </form>

        {/* Preview */}
        {amount && !isNaN(amount) && parseFloat(amount) > 0 && (
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-blue-700 font-bold mb-3 flex items-center">
              <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
              公屏显示预览
            </p>
            <p className="text-gray-700 font-mono bg-white px-3 py-2 rounded text-sm">
              账户：{displayAccountName}  Ad account ID: {displayAdAccountId} 充值 ${parseFloat(amount).toFixed(2)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RechargeModal;