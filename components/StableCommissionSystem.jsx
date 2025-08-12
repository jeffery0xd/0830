import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { stableCommissionService, debouncedRefresh } from '../data/stableCommissionService';
import { diagnosticService } from '../services/diagnosticService';

// 紧急修复版本：恢复月度提成汇总功能并修复数据显示问题
// 解决数据不稳定和计算不准确问题
const StableCommissionSystem = () => {
  // 核心状态管理（使用useState避免复杂性）
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState('2025-08');
  const [selectedDate, setSelectedDate] = useState('2025-08-11');
  
  // 数据状态
  const [dailyCommissionData, setDailyCommissionData] = useState([]);
  const [monthlyCommissionData, setMonthlyCommissionData] = useState([]);
  const [dataRangeInfo, setDataRangeInfo] = useState(null);
  const [availableDates, setAvailableDates] = useState([]);
  
  // UI状态
  const [lastRefreshTime, setLastRefreshTime] = useState(null);
  const [isCalculating, setIsCalculating] = useState(false);
  
  // 常量配置
  const availableMonths = useMemo(() => [
    { value: '2025-07', label: '2025年7月', defaultDate: '2025-07-31' },
    { value: '2025-08', label: '2025年8月', defaultDate: '2025-08-11' }
  ], []);
  
  const targetEmployees = useMemo(() => ['乔', '白', '妹'], []);

  // 加载单日提成数据（稳定版）
  const loadDailyCommission = useCallback(async (date) => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('加载单日提成数据:', date);
      const data = await stableCommissionService.getStableDailyCommission(date);
      
      setDailyCommissionData(data);
      setLastRefreshTime(new Date().toISOString());
      
      console.log('单日提成数据加载完成:', data);
    } catch (error) {
      console.error('加载单日提成失败:', error);
      setError(`加载 ${date} 提成数据失败: ${error.message}`);
      
      // 设置默认数据避免空白页面
      setDailyCommissionData(targetEmployees.map(emp => ({
        advertiser: emp,
        date: date,
        order_count: 0,
        roi: 0,
        commission_per_order: 0,
        total_commission: 0,
        commission_status: 'error',
        status_text: '数据加载失败'
      })));
    } finally {
      setLoading(false);
    }
  }, [targetEmployees]);

  // 紧急修复：数据诊断和强制修复
  const [diagnosticInfo, setDiagnosticInfo] = useState(null);
  const [isRunningDiagnostic, setIsRunningDiagnostic] = useState(false);
  const [forceDataRefresh, setForceDataRefresh] = useState(false);
  
  // 紧急数据诊断功能
  const runDataDiagnostic = useCallback(async () => {
    setIsRunningDiagnostic(true);
    try {
      console.log('🔍 开始紧急数据诊断...');
      
      // 清除所有缓存
      diagnosticService.clearAllCaches();
      
      // 直接查询数据库
      const diagnostic = await diagnosticService.directDatabaseQuery(selectedMonth);
      setDiagnosticInfo(diagnostic);
      
      console.log('📈 诊断结果:', diagnostic);
      
      // 如果发现数据不匹配，强制重新计算
      if (diagnostic.dateCount > 0) {
        console.log(`✅ 发现 ${diagnostic.dateCount} 天数据，重新加载所有组件数据...`);
        
        // 强制清除所有缓存并重新加载
        stableCommissionService.forceRefresh(null, selectedMonth);
        await initializeData();
        
        // 重新计算月度提成
        const freshMonthlyData = await diagnosticService.recalculateMonthlyCommission(selectedMonth);
        setMonthlyCommissionData(freshMonthlyData);
        
        console.log('✅ 数据诊断和修复完成');
      }
      
    } catch (error) {
      console.error('❌ 数据诊断失败:', error);
      setError(`数据诊断失败: ${error.message}`);
    } finally {
      setIsRunningDiagnostic(false);
    }
  }, [selectedMonth]);
  
  // 强化版数据初始化
  const initializeDataEnhanced = useCallback(async () => {
    const monthInfo = availableMonths.find(m => m.value === selectedMonth);
    const defaultDate = monthInfo?.defaultDate || selectedDate;
    
    setSelectedDate(defaultDate);
    
    try {
      // 并行加载日度和月度数据
      const [dailyData, monthlyData] = await Promise.all([
        loadDailyCommission(defaultDate),
        stableCommissionService.getStableMonthlyCommission(selectedMonth)
      ]);
      
      // 设置月度数据
      if (monthlyData && monthlyData.length > 0) {
        setMonthlyCommissionData(monthlyData);
        console.log('✅ 月度提成数据加载成功:', monthlyData);
      } else {
        console.log('⚠️ 月度提成数据为空，运行诊断...');
        // 如果月度数据为空，自动运行诊断
        await runDataDiagnostic();
      }
      
    } catch (error) {
      console.error('初始化数据增强版失败:', error);
      setError(`初始化失败: ${error.message}`);
    }
  }, [selectedMonth, selectedDate, availableMonths, loadDailyCommission, runDataDiagnostic]);

  // 加载月度提成数据（稳定版）
  const loadMonthlyCommission = useCallback(async (monthString) => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('加载月度提成数据:', monthString);
      const monthlyData = await stableCommissionService.getStableMonthlyCommission(monthString);
      const rangeInfo = await stableCommissionService.getDataRangeInfo(monthString);
      const dates = await stableCommissionService.getAvailableDatesForMonth(monthString);
      
      setMonthlyCommissionData(monthlyData);
      setDataRangeInfo(rangeInfo);
      setAvailableDates(dates);
      setLastRefreshTime(new Date().toISOString());
      
      console.log('月度提成数据加载完成:', monthlyData);
      console.log('数据范围信息:', rangeInfo);
      console.log('可用日期列表:', dates);
    } catch (error) {
      console.error('加载月度提成失败:', error);
      setError(`加载 ${monthString} 月度提成数据失败: ${error.message}`);
      
      // 设置默认数据避免空白
      setMonthlyCommissionData(targetEmployees.map(emp => ({
        advertiser: emp,
        totalCommission: 0,
        totalOrders: 0,
        workingDays: 0,
        avgROI: 0,
        monthString: monthString
      })));
    } finally {
      setLoading(false);
    }
  }, [targetEmployees]);

  // 初始化数据加载
  const initializeData = useCallback(async () => {
    const monthInfo = availableMonths.find(m => m.value === selectedMonth);
    const defaultDate = monthInfo?.defaultDate || selectedDate;
    
    setSelectedDate(defaultDate);
    
    // 并行加载日度和月度数据
    await Promise.all([
      loadDailyCommission(defaultDate),
      loadMonthlyCommission(selectedMonth)
    ]);
  }, [selectedMonth, selectedDate, availableMonths, loadDailyCommission, loadMonthlyCommission]);

  // 手动刷新数据
  const handleManualRefresh = useCallback(() => {
    debouncedRefresh(async () => {
      console.log('手动刷新数据开始');
      
      // 清除缓存并重新加载
      stableCommissionService.forceRefresh(selectedDate, selectedMonth);
      await initializeData();
      
      console.log('手动刷新完成');
    });
  }, [selectedDate, selectedMonth, initializeData]);

  // 切换查看日期
  const handleDateView = useCallback(async (date) => {
    if (date === selectedDate) return;
    
    setSelectedDate(date);
    await loadDailyCommission(date);
  }, [selectedDate, loadDailyCommission]);

  // 切换月份
  const handleMonthChange = useCallback((monthString) => {
    if (monthString === selectedMonth) return;
    
    setSelectedMonth(monthString);
    
    // 重置数据和选中日期
    setDailyCommissionData([]);
    setMonthlyCommissionData([]);
    setDataRangeInfo(null);
    setAvailableDates([]);
    
    const monthInfo = availableMonths.find(m => m.value === monthString);
    const newSelectedDate = monthInfo?.defaultDate || '2025-08-11';
    setSelectedDate(newSelectedDate);
  }, [selectedMonth, availableMonths]);

  // 计算提成（使用稳定算法）
  const handleCalculateCommission = useCallback(async () => {
    if (!selectedDate) {
      alert('请选择日期');
      return;
    }
    
    setIsCalculating(true);
    try {
      console.log('重新计算提成:', selectedDate);
      
      // 强制刷新该日期的数据
      stableCommissionService.forceRefresh(selectedDate, selectedMonth);
      
      // 重新加载数据
      await loadDailyCommission(selectedDate);
      await loadMonthlyCommission(selectedMonth);
      
      alert(`${selectedDate} 提成计算完成`);
    } catch (error) {
      console.error('计算提成失败:', error);
      alert(`计算失败: ${error.message}`);
    } finally {
      setIsCalculating(false);
    }
  }, [selectedDate, selectedMonth, loadDailyCommission, loadMonthlyCommission]);

  // 获取提成等级样式
  const getCommissionLevelStyle = useCallback((roi, commissionStatus) => {
    if (commissionStatus === 'error') {
      return {
        bgColor: 'bg-gray-100',
        textColor: 'text-gray-600', 
        borderColor: 'border-gray-300',
        statusText: '数据错误'
      };
    } else if (commissionStatus === 'no_data' || roi === 0) {
      return {
        bgColor: 'bg-gray-100',
        textColor: 'text-gray-600',
        borderColor: 'border-gray-300', 
        statusText: '暂无数据'
      };
    } else if (commissionStatus === 'no_commission' || roi < 0.8) {
      return {
        bgColor: 'bg-red-100',
        textColor: 'text-red-800',
        borderColor: 'border-red-300',
        statusText: '跑了个锤子'
      };
    } else if (roi >= 1.0) {
      return {
        bgColor: 'bg-green-100',
        textColor: 'text-green-800',
        borderColor: 'border-green-300',
        statusText: '高效投放'
      };
    } else {
      return {
        bgColor: 'bg-yellow-100',
        textColor: 'text-yellow-800',
        borderColor: 'border-yellow-300',
        statusText: '合格投放'
      };
    }
  }, []);

  // 组件首次加载时初始化
  useEffect(() => {
    initializeData();
  }, []);
  
  // 月份切换时重新加载
  useEffect(() => {
    if (selectedMonth) {
      initializeData();
    }
  }, [selectedMonth, initializeData]);

  // 主渲染函数
  if (loading && dailyCommissionData.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">正在加载提成数据</h3>
          <p className="text-gray-600">Data is loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 lg:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* 页面头部 */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h2 className="text-3xl font-bold text-gray-800 mb-2">💰 稳定提成系统</h2>
            <p className="text-gray-600">数据稳定、计算准确的员工提成系统</p>
          </div>
          
          <div className="flex items-center space-x-3">
            {/* 月份选择 */}
            <select
              value={selectedMonth}
              onChange={(e) => handleMonthChange(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
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
              disabled={loading}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors duration-200 text-sm flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? (
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
            
            {/* 紧急诊断按钮 */}
            <button
              onClick={runDataDiagnostic}
              disabled={isRunningDiagnostic}
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors duration-200 text-sm flex items-center gap-2 disabled:opacity-50"
            >
              {isRunningDiagnostic ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  诊断中
                </>
              ) : (
                <>
                  🔍 紧急诊断
                </>
              )}
            </button>
          </div>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center space-x-2 text-red-700">
              <span className="text-xl">⚠️</span>
              <span className="font-medium">Error: {error}</span>
            </div>
          </div>
        )}

        {/* 数据范围和更新信息 */}
        {dataRangeInfo && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="text-sm text-blue-700">
                📅 数据范围：{dataRangeInfo.startDate} 至 {dataRangeInfo.endDate} （共{dataRangeInfo.totalDays}天）
              </div>
              {lastRefreshTime && (
                <div className="text-sm text-green-700">
                  🔄 最后刷新：{new Date(lastRefreshTime).toLocaleString('zh-CN')}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 提成计算工具 */}
        <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">📈 提成计算工具</h3>
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                选择日期
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={handleCalculateCommission}
              disabled={isCalculating || !selectedDate}
              className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-2 rounded-lg hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-semibold flex items-center gap-2"
            >
              {isCalculating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  计算中...
                </>
              ) : (
                <>
                  💰 重新计算
                </>
              )}
            </button>
          </div>
        </div>

        {/* 快捷日期选择 */}
        {availableDates.length > 0 && (
          <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">📅 快捷查看</h3>
            <div className="flex flex-wrap gap-2">
              {availableDates.slice(0, 10).map(date => (
                <button
                  key={date}
                  onClick={() => handleDateView(date)}
                  disabled={loading}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedDate === date
                      ? 'bg-indigo-500 text-white shadow-md'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-50'
                  }`}
                >
                  {date}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 当日提成数据显示 */}
        <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-xl font-bold text-gray-800">📅 {selectedDate} 提成数据</h3>
              <p className="text-sm text-gray-500 mt-1">数据已稳定，计算准确</p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">
                数据条数：{dailyCommissionData.length}
              </div>
              {lastRefreshTime && (
                <div className="text-xs text-gray-400 mt-1">
                  更新：{new Date(lastRefreshTime).toLocaleString('zh-CN')}
                </div>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {targetEmployees.map(employee => {
              const record = dailyCommissionData.find(r => r.advertiser === employee) || {
                advertiser: employee,
                date: selectedDate,
                order_count: 0,
                roi: 0,
                commission_per_order: 0,
                total_commission: 0,
                commission_status: 'no_data',
                status_text: '暂无数据'
              };
              
              const style = getCommissionLevelStyle(record.roi, record.commission_status);
              
              return (
                <div 
                  key={employee} 
                  className={`${style.bgColor} ${style.borderColor} border-2 rounded-xl p-6 transition-all duration-300 hover:shadow-lg hover:scale-105`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h4 className={`text-xl font-bold ${style.textColor}`}>{employee}</h4>
                    <span className={`text-xs font-medium px-3 py-1 rounded-full ${style.bgColor} ${style.textColor} border ${style.borderColor}`}>
                      {style.statusText}
                    </span>
                  </div>
                  
                  <div className={`space-y-3 ${style.textColor}`}>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">订单数:</span>
                      <span className="font-bold text-lg">{record.order_count || 0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">ROI:</span>
                      <span className="font-bold text-lg">{parseFloat(record.roi || 0).toFixed(3)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">单价提成:</span>
                      <span className="font-bold">¥{parseFloat(record.commission_per_order || 0).toFixed(0)}</span>
                    </div>
                    <div className="border-t border-current opacity-20 my-3"></div>
                    <div className="flex justify-between items-center">
                      <span className="font-bold">当日提成:</span>
                      <span className="text-2xl font-bold">¥{parseFloat(record.total_commission || 0).toFixed(0)}</span>
                    </div>
                    
                    {/* 调试信息（仅开发环境） */}
                    {record._debug && process.env.NODE_ENV === 'development' && (
                      <details className="mt-3">
                        <summary className="text-xs cursor-pointer opacity-70">调试信息</summary>
                        <div className="text-xs opacity-70 mt-1 space-y-1">
                          <div>花费: ${record._debug.totalSpend}</div>
                          <div>收入: ${record._debug.totalRevenue}</div>
                          <div>记录数: {record._debug.recordCount}</div>
                        </div>
                      </details>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 月度提成汇总 */}
        <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-gray-800">
              📆 月度提成汇总 ({availableMonths.find(m => m.value === selectedMonth)?.label})
            </h3>
            {dataRangeInfo && (
              <div className="text-sm text-gray-500">
                数据范围：{dataRangeInfo.startDate} ~ {dataRangeInfo.endDate}
              </div>
            )}
          </div>
          
          {monthlyCommissionData.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-4">📉</div>
              <p className="text-gray-500 text-lg">暂无月度提成数据</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* 汇总统计 */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 border border-blue-200">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div>
                    <div className="text-3xl font-bold text-blue-600">
                      ¥{monthlyCommissionData.reduce((sum, emp) => sum + emp.totalCommission, 0).toFixed(0)}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">月总提成</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-green-600">
                      {monthlyCommissionData.reduce((sum, emp) => sum + emp.totalOrders, 0)}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">月总订单</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-purple-600">
                      {Math.max(...monthlyCommissionData.map(emp => emp.workingDays), 0)}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">最多工作日</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-orange-600">
                      {(monthlyCommissionData.reduce((sum, emp) => sum + emp.avgROI, 0) / Math.max(monthlyCommissionData.length, 1)).toFixed(2)}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">平均ROI</div>
                  </div>
                </div>
              </div>

              {/* 员工详细数据 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {targetEmployees.map(employee => {
                  const summary = monthlyCommissionData.find(s => s.advertiser === employee) || {
                    advertiser: employee,
                    totalCommission: 0,
                    totalOrders: 0,
                    workingDays: 0,
                    avgROI: 0
                  };
                  
                  return (
                    <div key={employee} className="bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-all duration-300">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-lg font-bold text-gray-800">{employee}</h4>
                        <span className="text-2xl">💼</span>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">月总提成:</span>
                          <span className="font-bold text-green-600">¥{summary.totalCommission.toFixed(0)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">总订单:</span>
                          <span className="font-semibold">{summary.totalOrders}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">工作日:</span>
                          <span className="font-semibold">{summary.workingDays}天</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">平均ROI:</span>
                          <span className="font-semibold">{summary.avgROI.toFixed(3)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StableCommissionSystem;