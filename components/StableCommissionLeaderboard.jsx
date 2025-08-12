import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { stableLeaderboardService, debouncedRefresh } from '../data/stableCommissionService';

// 全新的稳定提成排行榜组件
// 解决数据不稳定、频繁变化和排序不稳定问题
const StableCommissionLeaderboard = () => {
  // 核心状态管理
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState('2025-08');
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [lastRefreshTime, setLastRefreshTime] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // 常量配置
  const availableMonths = useMemo(() => [
    { value: '2025-07', label: '2025年7月' },
    { value: '2025-08', label: '2025年8月' }
  ], []);
  
  // 加载排行榜数据（稳定版）
  const loadLeaderboardData = useCallback(async (monthString) => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('加载稳定排行榜数据:', monthString);
      const data = await stableLeaderboardService.getStableRankings(monthString);
      
      setLeaderboardData(data);
      setLastRefreshTime(new Date().toISOString());
      
      console.log('稳定排行榜数据加载完成:', data);
    } catch (error) {
      console.error('加载排行榜失败:', error);
      setError(`加载排行榜失败: ${error.message}`);
      
      // 设置默认数据避免空白页面
      setLeaderboardData([]);
    } finally {
      setLoading(false);
    }
  }, []);
  
  // 手动刷新数据（使用强制刷新）
  const handleManualRefresh = useCallback(() => {
    setIsRefreshing(true);
    debouncedRefresh(async () => {
      try {
        console.log('强制刷新排行榜数据开始');
        // 使用强制刷新方法清除缓存并重新加载
        const data = await stableLeaderboardService.forceRefreshLeaderboard(selectedMonth);
        setLeaderboardData(data);
        setLastRefreshTime(new Date().toISOString());
        setError(null);
        console.log('强制刷新完成');
      } catch (error) {
        console.error('强制刷新失败:', error);
        setError(`刷新失败: ${error.message}`);
      } finally {
        setIsRefreshing(false);
      }
    });
  }, [selectedMonth]);
  
  // 切换月份
  const handleMonthChange = useCallback((monthString) => {
    if (monthString === selectedMonth) return;
    
    setSelectedMonth(monthString);
    setLeaderboardData([]);
    setError(null);
  }, [selectedMonth]);
  
  // 获取排名样式
  const getRankStyles = useCallback((rank) => {
    const rankConfigs = {
      1: {
        gradient: 'from-yellow-400 via-yellow-500 to-yellow-600',
        bgGradient: 'from-yellow-50 to-orange-50',
        textColor: 'text-yellow-800',
        borderColor: 'border-yellow-300',
        glowColor: 'shadow-yellow-400/50'
      },
      2: {
        gradient: 'from-gray-300 via-gray-400 to-gray-500',
        bgGradient: 'from-gray-50 to-slate-50',
        textColor: 'text-gray-800',
        borderColor: 'border-gray-300',
        glowColor: 'shadow-gray-400/50'
      },
      3: {
        gradient: 'from-orange-400 via-amber-500 to-orange-600',
        bgGradient: 'from-orange-50 to-amber-50',
        textColor: 'text-orange-800',
        borderColor: 'border-orange-300',
        glowColor: 'shadow-orange-400/50'
      }
    };
    
    return rankConfigs[rank] || {
      gradient: 'from-blue-400 via-blue-500 to-blue-600',
      bgGradient: 'from-blue-50 to-indigo-50',
      textColor: 'text-blue-800',
      borderColor: 'border-blue-300',
      glowColor: 'shadow-blue-400/50'
    };
  }, []);
  
  // 统计摘要数据
  const summaryStats = useMemo(() => {
    if (leaderboardData.length === 0) {
      return {
        totalCommission: 0,
        totalOrders: 0,
        maxWorkingDays: 0,
        avgROI: 0
      };
    }
    
    return {
      totalCommission: leaderboardData.reduce((sum, item) => sum + (item.totalCommission || 0), 0),
      totalOrders: leaderboardData.reduce((sum, item) => sum + (item.totalOrders || 0), 0),
      maxWorkingDays: Math.max(...leaderboardData.map(item => item.workingDays || 0)),
      avgROI: leaderboardData.reduce((sum, item) => sum + (item.avgROI || 0), 0) / leaderboardData.length
    };
  }, [leaderboardData]);
  
  // 组件初始化
  useEffect(() => {
    loadLeaderboardData(selectedMonth);
  }, [selectedMonth, loadLeaderboardData]);
  
  // 加载状态
  if (loading && leaderboardData.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-purple-500 border-t-transparent mx-auto mb-4"></div>
          <h3 className="text-lg font-semibold text-purple-800 mb-2">正在加载稳定排行榜</h3>
          <p className="text-purple-600">数据加载中，请稍候...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 p-4 lg:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* 页面头部 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full mb-4">
            <span className="text-4xl">🏆</span>
          </div>
          <h1 className="text-4xl lg:text-5xl font-bold bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
            💰 稳定提成排行榜
          </h1>
          <p className="text-gray-600 text-lg">数据稳定、排序准确的员工提成排名系统</p>
        </div>
        
        {/* 控制面板 */}
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-white/30">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-4">
              {/* 月份选择 */}
              <select
                value={selectedMonth}
                onChange={(e) => handleMonthChange(e.target.value)}
                className="px-4 py-2 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all duration-200 text-sm"
              >
                {availableMonths.map(month => (
                  <option key={month.value} value={month.value}>
                    {month.label}
                  </option>
                ))}
              </select>
              
              {/* 手动刷新按钮 */}
              <button
                onClick={handleManualRefresh}
                disabled={loading || isRefreshing}
                className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white px-4 py-2 rounded-xl transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:transform-none flex items-center gap-2 text-sm"
              >
                {loading || isRefreshing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    刷新中
                  </>
                ) : (
                  <>
                    🔄 手动刷新
                  </>
                )}
              </button>
            </div>
            
            {/* 数据信息 */}
            <div className="text-sm text-gray-600 text-center sm:text-right">
              {lastRefreshTime && (
                <div>
                  🔄 最后更新：{new Date(lastRefreshTime).toLocaleString('zh-CN')}
                </div>
              )}
              <div className="text-xs text-gray-500 mt-1">
                数据已稳定，排序准确
              </div>
            </div>
          </div>
        </div>
        
        {/* 错误提示 */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
            <div className="flex items-center space-x-3 text-red-700">
              <span className="text-2xl">⚠️</span>
              <div>
                <h3 className="font-semibold">数据加载错误</h3>
                <p className="text-sm mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}
        
        {/* 排行榜主体 */}
        {leaderboardData.length === 0 ? (
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-12 shadow-xl border border-white/30 text-center">
            <div className="text-6xl mb-4">📊</div>
            <h3 className="text-2xl font-bold text-gray-700 mb-2">暂无排行数据</h3>
            <p className="text-gray-500">该月份暂无提成数据，请先完成提成计算</p>
            <button
              onClick={handleManualRefresh}
              className="mt-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white px-6 py-2 rounded-xl hover:from-blue-600 hover:to-purple-600 transition-all duration-200"
            >
              重新加载
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* 前三名特殊展示 */}
            {leaderboardData.slice(0, 3).length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                {leaderboardData.slice(0, 3).map((item, index) => {
                  const styles = getRankStyles(item.rank);
                  const { rankInfo } = item;
                  
                  return (
                    <div
                      key={item.advertiser}
                      className="group relative transform transition-all duration-500 hover:scale-105"
                    >
                      {/* 背景光晕 */}
                      <div className={`absolute inset-0 bg-gradient-to-r ${styles.gradient} opacity-20 blur-xl rounded-3xl group-hover:opacity-30 transition-opacity duration-300`}></div>
                      
                      {/* 主卡片 */}
                      <div className={`relative bg-gradient-to-br ${styles.bgGradient} border-2 ${styles.borderColor} rounded-3xl p-6 shadow-2xl ${styles.glowColor} hover:shadow-3xl transition-all duration-300`}>
                        {/* 排名徽章 */}
                        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                          <div className={`bg-gradient-to-r ${styles.gradient} text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2`}>
                            <span className="text-2xl">{rankInfo.emoji}</span>
                            <span className="font-bold">第{item.rank}名</span>
                          </div>
                        </div>
                        
                        {/* 员工信息 */}
                        <div className="text-center mt-6">
                          <div className="text-6xl mb-4">{rankInfo.emoji}</div>
                          <h3 className={`text-2xl font-bold ${styles.textColor} mb-2`}>
                            {item.advertiser}
                          </h3>
                          
                          {/* 称号 */}
                          <div className={`bg-gradient-to-r ${styles.gradient} text-white px-4 py-2 rounded-full text-sm font-medium mb-4 inline-block`}>
                            {rankInfo.title}
                          </div>
                          
                          {/* 核心数据 */}
                          <div className="space-y-3">
                            <div className="bg-white/60 rounded-xl p-4">
                              <div className="text-3xl font-bold text-gray-800">
                                ¥{(item.totalCommission || 0).toFixed(0)}
                              </div>
                              <div className="text-sm text-gray-600">月度总提成</div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-3">
                              <div className="bg-white/40 rounded-lg p-3 text-center">
                                <div className="text-xl font-bold text-gray-800">{item.totalOrders || 0}</div>
                                <div className="text-xs text-gray-600">总订单</div>
                              </div>
                              <div className="bg-white/40 rounded-lg p-3 text-center">
                                <div className="text-xl font-bold text-gray-800">{(item.avgROI || 0).toFixed(2)}</div>
                                <div className="text-xs text-gray-600">平均ROI</div>
                              </div>
                            </div>
                            
                            <div className="bg-white/40 rounded-lg p-3 text-center">
                              <div className="text-lg font-bold text-gray-800">{item.workingDays || 0}天</div>
                              <div className="text-xs text-gray-600">工作天数</div>
                            </div>
                          </div>
                          
                          {/* 特权说明 */}
                          <div className="mt-4 p-3 bg-white/50 rounded-xl">
                            <div className="text-sm font-medium text-gray-700">🎁 专属特权</div>
                            <div className="text-sm text-gray-600 mt-1">{rankInfo.privilege}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            
            {/* 完整排行榜表格 */}
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border border-white/30 overflow-hidden">
              <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-6">
                <h2 className="text-2xl font-bold flex items-center gap-3">
                  📊 完整排行榜
                  <span className="text-lg font-normal opacity-80">({availableMonths.find(m => m.value === selectedMonth)?.label})</span>
                </h2>
              </div>
              
              <div className="p-6">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">排名</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">员工</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">称号</th>
                        <th className="text-right py-3 px-4 font-semibold text-gray-700">月度提成</th>
                        <th className="text-right py-3 px-4 font-semibold text-gray-700">总订单</th>
                        <th className="text-right py-3 px-4 font-semibold text-gray-700">工作日</th>
                        <th className="text-right py-3 px-4 font-semibold text-gray-700">平均ROI</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaderboardData.map((item) => {
                        const styles = getRankStyles(item.rank);
                        const { rankInfo } = item;
                        
                        return (
                          <tr
                            key={item.advertiser}
                            className={`border-b border-gray-100 hover:bg-gradient-to-r hover:${styles.bgGradient} transition-all duration-300`}
                          >
                            <td className="py-4 px-4">
                              <div className="flex items-center gap-2">
                                <span className="text-2xl">{rankInfo.emoji}</span>
                                <span className={`font-bold text-lg ${styles.textColor}`}>
                                  #{item.rank}
                                </span>
                              </div>
                            </td>
                            <td className="py-4 px-4">
                              <div className="font-semibold text-gray-800 text-lg">{item.advertiser}</div>
                            </td>
                            <td className="py-4 px-4">
                              <span className={`bg-gradient-to-r ${styles.gradient} text-white px-3 py-1 rounded-full text-sm font-medium`}>
                                {rankInfo.title}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-right">
                              <div className="font-bold text-lg text-gray-800">¥{(item.totalCommission || 0).toFixed(0)}</div>
                            </td>
                            <td className="py-4 px-4 text-right">
                              <div className="font-semibold text-gray-700">{item.totalOrders || 0}</div>
                            </td>
                            <td className="py-4 px-4 text-right">
                              <div className="font-semibold text-gray-700">{item.workingDays || 0}天</div>
                            </td>
                            <td className="py-4 px-4 text-right">
                              <div className="font-semibold text-gray-700">{(item.avgROI || 0).toFixed(3)}</div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            
            {/* 统计摘要 */}
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-white/30">
              <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                📈 统计摘要
                <span className="text-sm font-normal text-gray-500">({availableMonths.find(m => m.value === selectedMonth)?.label})</span>
              </h3>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 text-center border border-blue-200">
                  <div className="text-2xl font-bold text-blue-600">
                    ¥{summaryStats.totalCommission.toFixed(0)}
                  </div>
                  <div className="text-sm text-blue-700 mt-1">总提成收入</div>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 text-center border border-green-200">
                  <div className="text-2xl font-bold text-green-600">
                    {summaryStats.totalOrders}
                  </div>
                  <div className="text-sm text-green-700 mt-1">总订单数</div>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 text-center border border-purple-200">
                  <div className="text-2xl font-bold text-purple-600">
                    {summaryStats.maxWorkingDays}
                  </div>
                  <div className="text-sm text-purple-700 mt-1">最多工作日</div>
                </div>
                <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-4 text-center border border-orange-200">
                  <div className="text-2xl font-bold text-orange-600">
                    {(summaryStats.avgROI || 0).toFixed(2)}
                  </div>
                  <div className="text-sm text-orange-700 mt-1">团队平均ROI</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StableCommissionLeaderboard;
