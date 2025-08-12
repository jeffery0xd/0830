import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../utils/supabase';

const PublicScreen = ({ refreshTrigger }) => {
  const [operations, setOperations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // 数据表前缀
  const tablePrefix = 'app_e87b41cfe355428b8146f8bae8184e10_';

  // 投放人员头像映射（固定映射）
  const getAvatarForOperator = useCallback((operatorName) => {
    if (!operatorName) return '👤';
    
    const avatarMap = {
      '丁': '🐶', '青': '🦊', '妹': '🐱', '白': '🐨',
      '小丁': '🐶', '小青': '🦊', '小妹': '🐱', '小白': '🐨',
      '阿丁': '🐶', '阿青': '🦊', '阿妹': '🐱', '阿白': '🐨'
    };
    
    for (const [name, avatar] of Object.entries(avatarMap)) {
      if (operatorName.includes(name)) return avatar;
    }
    return '👤';
  }, []);

  // 时间更新
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 加载操作记录
  const loadOperations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('开始加载操作记录...');
      
      // 获取充值记录
      const { data: rechargeOps, error: rechargeError } = await supabase
        .from(`${tablePrefix}recharge_operations`)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(25);
      
      if (rechargeError && rechargeError.code !== 'PGRST116') {
        console.error('获取充值记录失败:', rechargeError);
        throw rechargeError;
      }
      
      // 获取清零记录
      const { data: resetOps, error: resetError } = await supabase
        .from(`${tablePrefix}reset_operations`)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(25);
      
      if (resetError && resetError.code !== 'PGRST116') {
        console.error('获取清零记录失败:', resetError);
        throw resetError;
      }
      
      // 合并和排序操作记录
      const allOps = [
        ...(rechargeOps || []).map(op => ({ ...op, type: 'recharge' })),
        ...(resetOps || []).map(op => ({ ...op, type: 'reset' }))
      ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      
      console.log('操作记录加载成功:', allOps.length);
      setOperations(allOps.slice(0, 50)); // 保持最多50条记录
      
    } catch (error) {
      console.error('加载操作记录失败:', error);
      setError('加载数据失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, [tablePrefix]);

  // 初始化加载
  useEffect(() => {
    loadOperations();
  }, [loadOperations, refreshTrigger]);

  // 设置实时订阅
  useEffect(() => {
    let rechargeChannel = null;
    let resetChannel = null;
    
    try {
      // 订阅充值操作
      rechargeChannel = supabase
        .channel('recharge_operations_realtime')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: `${tablePrefix}recharge_operations`
          },
          (payload) => {
            console.log('新充值操作:', payload);
            // 添加新操作到列表顶部
            const newOp = { ...payload.new, type: 'recharge' };
            setOperations(prev => [newOp, ...prev.slice(0, 49)]);
          }
        )
        .subscribe();

      // 订阅清零操作
      resetChannel = supabase
        .channel('reset_operations_realtime')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: `${tablePrefix}reset_operations`
          },
          (payload) => {
            console.log('新清零操作:', payload);
            // 添加新操作到列表顶部
            const newOp = { ...payload.new, type: 'reset' };
            setOperations(prev => [newOp, ...prev.slice(0, 49)]);
          }
        )
        .subscribe();
    } catch (error) {
      console.error('设置实时订阅失败:', error);
    }

    return () => {
      if (rechargeChannel) {
        rechargeChannel.unsubscribe();
      }
      if (resetChannel) {
        resetChannel.unsubscribe();
      }
    };
  }, [tablePrefix]);

  // 时间格式化
  const formatTime = useCallback((timeString) => {
    try {
      return new Date(timeString).toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch (error) {
      return '无效时间';
    }
  }, []);

  // 金额格式化
  const formatAmount = useCallback((amount) => {
    try {
      return new Intl.NumberFormat('zh-CN', {
        style: 'currency',
        currency: 'CNY',
        minimumFractionDigits: 0
      }).format(amount);
    } catch (error) {
      return `¥${amount}`;
    }
  }, []);

  // 计算今日统计
  const todayStats = useMemo(() => {
    const today = new Date().toDateString();
    const todayOps = operations.filter(op => {
      try {
        return new Date(op.created_at).toDateString() === today;
      } catch (error) {
        return false;
      }
    });
    
    return {
      recharge: todayOps.filter(op => op.type === 'recharge').length,
      reset: todayOps.filter(op => op.type === 'reset').length
    };
  }, [operations]);

  // 一键复制功能
  const handleCopy = useCallback(async (text) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback方法
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
      }
      console.log('已复制:', text);
    } catch (error) {
      console.error('复制失败:', error);
    }
  }, []);

  // 错误状态
  if (error) {
    return (
      <div className="bg-white rounded-lg shadow h-full p-4">
        <div className="text-center py-8">
          <div className="text-red-500 text-2xl mb-2">⚠️</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">加载失败</h3>
          <p className="text-gray-600 text-sm mb-4">{error}</p>
          <button
            onClick={loadOperations}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm"
          >
            重新加载
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow h-full">
      {/* 头部 */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
            实时操作公屏
          </h3>
          <div className="text-xs text-gray-500">
            {currentTime.toLocaleTimeString('zh-CN')}
          </div>
        </div>
        
        {/* 统计数据 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="text-blue-600 text-xs font-medium">今日充值</div>
            <div className="text-blue-900 text-lg font-bold">
              {todayStats.recharge}
            </div>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="text-red-600 text-xs font-medium">今日清零</div>
            <div className="text-red-900 text-lg font-bold">
              {todayStats.reset}
            </div>
          </div>
        </div>
      </div>

      {/* 操作列表 */}
      <div className="p-4">
        <div className="h-96 overflow-y-auto space-y-2">
          {loading ? (
            <div className="text-center py-8">
              <div className="w-6 h-6 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin mx-auto mb-2"></div>
              <p className="text-gray-500 text-sm">加载中...</p>
            </div>
          ) : operations.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-400 text-2xl mb-2">📈</div>
              <p className="text-gray-500 text-sm">暂无操作记录</p>
            </div>
          ) : (
            operations.map((operation, index) => {
              const operatorName = operation.operator_name || '未知人员';
              const avatar = getAvatarForOperator(operatorName);
              
              return (
                <div 
                  key={`${operation.type}-${operation.id}`}
                  className={`border rounded-lg p-3 transition-all duration-200 cursor-pointer hover:shadow-md ${
                    operation.type === 'recharge' 
                      ? 'border-blue-200 bg-blue-50/50 hover:bg-blue-50' 
                      : 'border-red-200 bg-red-50/50 hover:bg-red-50'
                  } ${
                    index === 0 ? 'ring-1 ring-yellow-300' : ''
                  }`}
                  onClick={() => handleCopy(
                    `${operation.account_name || '未知账户'} - ${operation.ad_account_id || 'N/A'}${operation.type === 'recharge' ? ` - $${operation.amount}` : ` - 余额$${operation.balance || '0'}`}`
                  )}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${
                        operation.type === 'recharge' ? 'bg-blue-500' : 'bg-red-500'
                      }`}></div>
                      <div className="flex items-center space-x-1">
                        <span className="text-base">{avatar}</span>
                        <div>
                          <div className="text-gray-900 font-medium text-sm">
                            {operatorName}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-xs font-medium ${
                        operation.type === 'recharge' ? 'text-blue-600' : 'text-red-600'
                      }`}>
                        {operation.type === 'recharge' ? '充值' : '清零'}
                      </div>
                      <div className="text-gray-400 text-xs">
                        {formatTime(operation.created_at)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="pl-4 space-y-1">
                    <div className="text-gray-700 text-xs font-medium">
                      账户: {operation.account_name || '未知账户'}
                    </div>
                    <div className="text-gray-500 text-xs font-mono">
                      ID: {operation.ad_account_id || 'N/A'}
                    </div>
                    {operation.type === 'recharge' && operation.amount && (
                      <div className="text-green-600 text-xs font-medium">
                        充值金额: ${Number(operation.amount).toFixed(2)}
                      </div>
                    )}
                    {operation.type === 'reset' && operation.balance && (
                      <div className="text-orange-600 text-xs font-medium">
                        清零前余额: ${Number(operation.balance).toFixed(2)}
                      </div>
                    )}
                    <div className="text-xs text-gray-400 mt-1">
                      💡 点击可复制账户信息
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default PublicScreen;