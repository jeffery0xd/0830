import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../utils/supabase';
import { Copy, RefreshCw, Calendar, TrendingUp, TrendingDown } from 'lucide-react';

// 增强版公屏组件 - 更大显示区域、日期筛选、优化复制格式
const EnhancedPublicScreen = ({ refreshTrigger, dateFilter, customStartDate, customEndDate }) => {
  const [operations, setOperations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // 数据表前缀
  const tablePrefix = 'app_e87b41cfe355428b8146f8bae8184e10_';

  // 投放人员头像映射
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

  // 加载操作记录（支持日期筛选）
  const loadOperations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('开始加载操作记录...', { dateFilter, customStartDate, customEndDate });
      
      // 构建充值记录查询
      let rechargeQuery = supabase
        .from(`${tablePrefix}recharge_operations`)
        .select('*');
      
      // 构建清零记录查询
      let resetQuery = supabase
        .from(`${tablePrefix}reset_operations`)
        .select('*');
      
      // 应用日期筛选
      if (dateFilter === 'today') {
        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
        const startISO = startOfDay.toISOString();
        const endISO = endOfDay.toISOString();
        
        rechargeQuery = rechargeQuery.gte('created_at', startISO).lt('created_at', endISO);
        resetQuery = resetQuery.gte('created_at', startISO).lt('created_at', endISO);
      } else if (dateFilter === 'custom' && customStartDate && customEndDate) {
        const startDate = new Date(customStartDate + 'T00:00:00');
        const endDate = new Date(customEndDate + 'T23:59:59');
        const startISO = startDate.toISOString();
        const endISO = endDate.toISOString();
        
        rechargeQuery = rechargeQuery.gte('created_at', startISO).lte('created_at', endISO);
        resetQuery = resetQuery.gte('created_at', startISO).lte('created_at', endISO);
      }
      
      // 执行查询
      const [rechargeResult, resetResult] = await Promise.all([
        rechargeQuery.order('created_at', { ascending: false }).limit(50),
        resetQuery.order('created_at', { ascending: false }).limit(50)
      ]);
      
      const { data: rechargeOps, error: rechargeError } = rechargeResult;
      const { data: resetOps, error: resetError } = resetResult;
      
      if (rechargeError && rechargeError.code !== 'PGRST116') {
        console.error('获取充值记录失败:', rechargeError);
        throw rechargeError;
      }
      
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
      setOperations(allOps.slice(0, 100)); // 显示更多记录
      
    } catch (error) {
      console.error('加载操作记录失败:', error);
      setError('加载数据失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, [tablePrefix, dateFilter, customStartDate, customEndDate]);

  // 初始化加载和日期筛选变化时重新加载
  useEffect(() => {
    loadOperations();
  }, [loadOperations, refreshTrigger]);

  // 设置实时订阅（仅在非筛选模式下）
  useEffect(() => {
    if (dateFilter !== 'all') return; // 筛选模式下不设置实时订阅
    
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
            const newOp = { ...payload.new, type: 'recharge' };
            setOperations(prev => [newOp, ...prev.slice(0, 99)]);
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
            const newOp = { ...payload.new, type: 'reset' };
            setOperations(prev => [newOp, ...prev.slice(0, 99)]);
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
  }, [tablePrefix, dateFilter]);

  // 时间格式化
  const formatTime = useCallback((timeString) => {
    try {
      return new Date(timeString).toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
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
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2
      }).format(amount);
    } catch (error) {
      return `$${amount}`;
    }
  }, []);

  // 计算筛选统计
  const filteredStats = useMemo(() => {
    if (!operations || operations.length === 0) {
      return {
        recharge: { count: 0, total: 0 },
        reset: { count: 0, total: 0 }
      };
    }
    
    const rechargeOps = operations.filter(op => op.type === 'recharge');
    const resetOps = operations.filter(op => op.type === 'reset');
    
    return {
      recharge: {
        count: rechargeOps.length,
        total: rechargeOps.reduce((sum, op) => sum + Number(op.amount || 0), 0)
      },
      reset: {
        count: resetOps.length,
        total: resetOps.reduce((sum, op) => sum + Number(op.balance || 0), 0)
      }
    };
  }, [operations]);

  // 一键复制功能（优化格式）
  const handleCopyOperation = useCallback(async (operation) => {
    try {
      let copyText = '';
      
      if (operation.type === 'recharge') {
        // 充值记录格式：账户：AT-OY-39\nAd account ID: 1015236453465856\n充值 $500
        copyText = `账户：${operation.account_name || '未知账户'}\nAd account ID: ${operation.ad_account_id || 'N/A'}\n充值 ${formatAmount(operation.amount || 0)}`;
      } else {
        // 清零记录格式
        copyText = `账户：${operation.account_name || '未知账户'}\nAd account ID: ${operation.ad_account_id || 'N/A'}\n清零前余额 ${formatAmount(operation.balance || 0)}`;
      }
      
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
      
      console.log('已复制:', copyText);
    } catch (error) {
      console.error('复制失败:', error);
    }
  }, [formatAmount]);

  // 一键复制所有显示的记录
  const handleCopyAllOperations = useCallback(async () => {
    if (!operations || operations.length === 0) {
      alert('没有操作记录可复制');
      return;
    }
    
    try {
      const allOperationsText = operations.map(operation => {
        if (operation.type === 'recharge') {
          return `账户：${operation.account_name || '未知账户'}\nAd account ID: ${operation.ad_account_id || 'N/A'}\n充值 ${formatAmount(operation.amount || 0)}`;
        } else {
          return `账户：${operation.account_name || '未知账户'}\nAd account ID: ${operation.ad_account_id || 'N/A'}\n清零前余额 ${formatAmount(operation.balance || 0)}`;
        }
      }).join('\n\n');
      
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(allOperationsText);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = allOperationsText;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
      }
      
      alert(`成功复制${operations.length}条操作记录到剪贴板`);
      
    } catch (error) {
      console.error('批量复制失败:', error);
      alert('批量复制失败: ' + error.message);
    }
  }, [operations, formatAmount]);

  // 错误状态
  if (error) {
    return (
      <div className="bg-white rounded-lg shadow h-full p-6">
        <div className="text-center py-12">
          <div className="text-red-500 text-3xl mb-4">⚠️</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-3">加载失败</h3>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={loadOperations}
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg transition-colors"
          >
            重新加载
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow h-full flex flex-col">
      {/* 头部 - 增强显示 */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <h3 className="text-2xl font-bold text-gray-900 flex items-center">
              <span className="w-3 h-3 bg-green-500 rounded-full mr-3 animate-pulse"></span>
              实时操作公屏
            </h3>
            <div className="flex items-center space-x-2">
              {dateFilter === 'today' && (
                <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">
                  📅 今日记录
                </span>
              )}
              {dateFilter === 'custom' && (
                <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm font-medium">
                  📅 {customStartDate} 至 {customEndDate}
                </span>
              )}
              {dateFilter === 'all' && (
                <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm font-medium">
                  📅 全部记录
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-500">
              {currentTime.toLocaleTimeString('zh-CN')}
            </div>
            <button
              onClick={handleCopyAllOperations}
              disabled={!operations || operations.length === 0}
              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition-colors text-sm flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Copy size={16} />
              <span>复制全部</span>
            </button>
          </div>
        </div>
        
        {/* 统计数据 - 更丰富的显示 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-blue-600 text-sm font-medium">充值次数</div>
                <div className="text-blue-900 text-2xl font-bold">
                  {filteredStats.recharge.count}
                </div>
              </div>
              <div className="text-blue-500">
                <TrendingUp size={24} />
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-r from-green-50 to-green-100 border border-green-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-green-600 text-sm font-medium">充值总额</div>
                <div className="text-green-900 text-2xl font-bold">
                  {formatAmount(filteredStats.recharge.total)}
                </div>
              </div>
              <div className="text-green-500">
                💵
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-r from-red-50 to-red-100 border border-red-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-red-600 text-sm font-medium">清零次数</div>
                <div className="text-red-900 text-2xl font-bold">
                  {filteredStats.reset.count}
                </div>
              </div>
              <div className="text-red-500">
                <TrendingDown size={24} />
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-r from-orange-50 to-orange-100 border border-orange-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-orange-600 text-sm font-medium">清零总额</div>
                <div className="text-orange-900 text-2xl font-bold">
                  {formatAmount(filteredStats.reset.total)}
                </div>
              </div>
              <div className="text-orange-500">
                🚨
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 操作列表 - 修复移动端滚动问题 */}
      <div className="flex-1 p-4 sm:p-6 overflow-y-auto">
        <div className="w-full">
          {loading ? (
            <div className="text-center py-12">
              <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-500 text-lg">加载中...</p>
            </div>
          ) : operations.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-gray-400 text-4xl mb-4">📈</div>
              <p className="text-gray-500 text-xl mb-2">暂无操作记录</p>
              <p className="text-gray-400 text-sm">在所选时间范围内没有找到记录</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {operations.map((operation, index) => {
                const operatorName = operation.operator_name || '未知人员';
                const avatar = getAvatarForOperator(operatorName);
                
                return (
                  <div 
                    key={`${operation.type}-${operation.id}`}
                    className={`border rounded-xl p-5 transition-all duration-300 cursor-pointer hover:shadow-lg transform hover:-translate-y-1 ${
                      operation.type === 'recharge' 
                        ? 'border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200' 
                        : 'border-red-200 bg-gradient-to-br from-red-50 to-red-100 hover:from-red-100 hover:to-red-200'
                    } ${
                      index === 0 ? 'ring-2 ring-yellow-300 shadow-lg' : ''
                    }`}
                    onClick={() => handleCopyOperation(operation)}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className={`w-3 h-3 rounded-full animate-pulse ${
                          operation.type === 'recharge' ? 'bg-blue-500' : 'bg-red-500'
                        }`}></div>
                        <div className="flex items-center space-x-2">
                          <span className="text-2xl">{avatar}</span>
                          <div>
                            <div className="text-gray-900 font-bold text-base">
                              {operatorName}
                            </div>
                            <div className={`text-sm font-medium ${
                              operation.type === 'recharge' ? 'text-blue-600' : 'text-red-600'
                            }`}>
                              {operation.type === 'recharge' ? '充值操作' : '清零操作'}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-gray-400 text-sm">
                          {formatTime(operation.created_at)}
                        </div>
                        {index === 0 && (
                          <div className="text-yellow-600 text-xs font-medium mt-1">
                            ✨ 最新
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="bg-white/70 rounded-lg p-3">
                        <div className="text-gray-800 font-bold text-lg truncate">
                          {operation.account_name || '未知账户'}
                        </div>
                        <div className="text-gray-600 text-sm font-mono truncate mt-1">
                          ID: {operation.ad_account_id || 'N/A'}
                        </div>
                      </div>
                      
                      {operation.type === 'recharge' && operation.amount && (
                        <div className="flex items-center justify-between bg-green-100 rounded-lg p-3">
                          <span className="text-green-700 font-medium">充值金额:</span>
                          <span className="text-green-800 font-bold text-xl">
                            {formatAmount(operation.amount)}
                          </span>
                        </div>
                      )}
                      
                      {operation.type === 'reset' && operation.balance && (
                        <div className="flex items-center justify-between bg-orange-100 rounded-lg p-3">
                          <span className="text-orange-700 font-medium">清零前余额:</span>
                          <span className="text-orange-800 font-bold text-xl">
                            {formatAmount(operation.balance)}
                          </span>
                        </div>
                      )}
                      
                      {operation.description && (
                        <div className="bg-gray-100 rounded-lg p-3">
                          <div className="text-gray-600 text-sm">
                            📝 备注: {operation.description}
                          </div>
                        </div>
                      )}
                      
                      <div className="text-center pt-2 border-t border-white/50">
                        <div className="text-xs text-gray-500 flex items-center justify-center space-x-1">
                          <Copy size={12} />
                          <span>点击即可复制详细信息</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EnhancedPublicScreen;