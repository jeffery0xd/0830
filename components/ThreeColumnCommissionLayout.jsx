import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { stableCommissionService } from '../data/stableCommissionService';

// 三列布局提成系统组件
const ThreeColumnCommissionLayout = () => {
  // 核心状态管理
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState('2025-08');
  
  // 数据状态
  const [tableData, setTableData] = useState([]);
  const [summaryData, setSummaryData] = useState(null);
  const [availableDates, setAvailableDates] = useState([]);
  
  // UI状态
  const [lastRefreshTime, setLastRefreshTime] = useState(null);
  
  // 常量配置
  const availableMonths = useMemo(() => [
    { value: '2025-07', label: '2025年7月' },
    { value: '2025-08', label: '2025年8月' }
  ], []);
  
  const targetEmployees = useMemo(() => ['乔', '白', '妹'], []);
  
  // 员工头像和颜色主题配置
  const employeeConfig = useMemo(() => ({
    '乔': {
      avatar: '👨‍💼',
      name: '乔',
      theme: 'blue',
      gradient: 'from-blue-400 to-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      textColor: 'text-blue-900',
      cardBg: 'bg-gradient-to-br from-blue-50 to-blue-100'
    },
    '白': {
      avatar: '👩‍💻',
      name: '白',
      theme: 'purple',
      gradient: 'from-purple-400 to-purple-600',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200',
      textColor: 'text-purple-900',
      cardBg: 'bg-gradient-to-br from-purple-50 to-purple-100'
    },
    '妹': {
      avatar: '👩‍🎨',
      name: '妹',
      theme: 'pink',
      gradient: 'from-pink-400 to-pink-600',
      bgColor: 'bg-pink-50',
      borderColor: 'border-pink-200',
      textColor: 'text-pink-900',
      cardBg: 'bg-gradient-to-br from-pink-50 to-pink-100'
    }
  }), []);

  // ROI截断函数（不四舍五入）
  const truncateROI = useCallback((roi) => {
    if (typeof roi !== 'number' || isNaN(roi)) return 0;
    // 直接截断到小数点后两位，不四舍五入
    return Math.floor(roi * 100) / 100;
  }, []);

  // 获取表格数据的核心函数
  const loadTableData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('🔄 加载三列布局数据:', selectedMonth);
      
      // 获取该月的所有可用日期
      const dates = await stableCommissionService.getAvailableDatesForMonth(selectedMonth);
      setAvailableDates(dates);
      
      console.log(`📅 发现 ${dates.length} 天的数据:`, dates);
      
      // 并行获取所有日期的提成数据
      const allDailyPromises = dates.map(date => 
        stableCommissionService.getStableDailyCommission(date)
      );
      
      const allDailyResults = await Promise.all(allDailyPromises);
      
      // 扁平化数据并添加行ID
      const flattenedData = [];
      allDailyResults.forEach((dayData, dayIndex) => {
        const date = dates[dayIndex];
        dayData.forEach((record, recordIndex) => {
          if (record && record.advertiser) {
            flattenedData.push({
              id: `${date}-${record.advertiser}`,
              date: date,
              employee: record.advertiser,
              commission: record.total_commission || 0,
              roi: truncateROI(record.roi || 0), // 使用截断函数处理ROI
              orders: record.order_count || 0,
              commissionPerOrder: record.commission_per_order || 0,
              status: record.commission_status || 'no_data',
              statusText: record.status_text || '暂无数据'
            });
          }
        });
      });
      
      // 按员工和日期排序（最新日期在上）
      flattenedData.sort((a, b) => {
        if (a.employee !== b.employee) {
          return targetEmployees.indexOf(a.employee) - targetEmployees.indexOf(b.employee);
        }
        return new Date(b.date) - new Date(a.date);
      });
      
      setTableData(flattenedData);
      
      // 计算汇总数据
      const summary = calculateSummaryData(flattenedData);
      setSummaryData(summary);
      
      setLastRefreshTime(new Date().toISOString());
      
      console.log(`✅ 三列布局数据加载完成: ${flattenedData.length} 条记录`);
      console.log('📊 汇总数据:', summary);
      
    } catch (error) {
      console.error('❌ 加载三列布局数据失败:', error);
      setError(`数据加载失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, truncateROI, targetEmployees]);

  // 计算汇总数据
  const calculateSummaryData = useCallback((data) => {
    if (!data || data.length === 0) {
      return {
        totalCommission: 0,
        totalOrders: 0,
        avgROI: 0,
        totalRecords: 0,
        uniqueDates: 0,
        employeeStats: targetEmployees.map(emp => ({
          employee: emp,
          totalCommission: 0,
          totalOrders: 0,
          avgROI: 0,
          workingDays: 0,
          dailyRecords: []
        }))
      };
    }
    
    const totalCommission = data.reduce((sum, record) => sum + record.commission, 0);
    const totalOrders = data.reduce((sum, record) => sum + record.orders, 0);
    const avgROI = data.length > 0 ? truncateROI(data.reduce((sum, record) => sum + record.roi, 0) / data.length) : 0;
    const uniqueDates = [...new Set(data.map(record => record.date))].length;
    
    // 按员工统计
    const employeeStats = targetEmployees.map(emp => {
      const empRecords = data.filter(record => record.employee === emp);
      const empTotalCommission = empRecords.reduce((sum, record) => sum + record.commission, 0);
      const empTotalOrders = empRecords.reduce((sum, record) => sum + record.orders, 0);
      const empAvgROI = empRecords.length > 0 ? truncateROI(empRecords.reduce((sum, record) => sum + record.roi, 0) / empRecords.length) : 0;
      const empWorkingDays = empRecords.filter(record => record.orders > 0 || record.commission > 0).length;
      
      return {
        employee: emp,
        totalCommission: empTotalCommission,
        totalOrders: empTotalOrders,
        avgROI: empAvgROI,
        workingDays: empWorkingDays,
        dailyRecords: empRecords
      };
    });
    
    return {
      totalCommission,
      totalOrders,
      avgROI,
      totalRecords: data.length,
      uniqueDates,
      employeeStats
    };
  }, [targetEmployees, truncateROI]);

  // 手动刷新
  const handleRefresh = useCallback(async () => {
    console.log('🔄 手动刷新三列布局数据');
    stableCommissionService.forceRefresh(null, selectedMonth);
    await loadTableData();
  }, [selectedMonth, loadTableData]);

  // 月份切换
  const handleMonthChange = useCallback((monthString) => {
    if (monthString === selectedMonth) return;
    
    setSelectedMonth(monthString);
    setTableData([]);
    setSummaryData(null);
    setAvailableDates([]);
  }, [selectedMonth]);

  // 获取ROI趋势指示器
  const getRoiTrend = useCallback((roi) => {
    if (roi >= 1.0) return { icon: '🔥', color: 'text-red-500', trend: '优秀', bgColor: 'bg-red-100' };
    if (roi >= 0.8) return { icon: '💪', color: 'text-yellow-500', trend: '良好', bgColor: 'bg-yellow-100' };
    if (roi > 0) return { icon: '📈', color: 'text-blue-500', trend: '正常', bgColor: 'bg-blue-100' };
    return { icon: '😴', color: 'text-gray-400', trend: '休息', bgColor: 'bg-gray-100' };
  }, []);

  // 获取状态样式
  const getStatusStyle = useCallback((status, roi) => {
    if (status === 'high_performance' || roi >= 1.0) {
      return {
        bgColor: 'bg-gradient-to-r from-green-100 to-green-200',
        textColor: 'text-green-800',
        borderColor: 'border-green-300'
      };
    } else if (status === 'qualified' || (roi >= 0.8 && roi < 1.0)) {
      return {
        bgColor: 'bg-gradient-to-r from-yellow-100 to-yellow-200',
        textColor: 'text-yellow-800',
        borderColor: 'border-yellow-300'
      };
    } else if (status === 'no_commission' && roi > 0) {
      return {
        bgColor: 'bg-gradient-to-r from-blue-100 to-blue-200',
        textColor: 'text-blue-800',
        borderColor: 'border-blue-300'
      };
    } else {
      return {
        bgColor: 'bg-gradient-to-r from-gray-100 to-gray-200',
        textColor: 'text-gray-600',
        borderColor: 'border-gray-300'
      };
    }
  }, []);

  // 导出数据功能
  const exportData = useCallback((format = 'csv') => {
    if (!tableData || tableData.length === 0) {
      alert('没有数据可导出');
      return;
    }
    
    const headers = ['日期', '员工', '提成金额', 'ROI', '单量', '单价提成', '状态'];
    const csvContent = [
      headers.join(','),
      ...tableData.map(record => [
        record.date,
        record.employee,
        record.commission.toFixed(2),
        record.roi.toFixed(2), // ROI以小数形式导出
        record.orders,
        record.commissionPerOrder,
        record.statusText
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `提成数据_三列布局_${selectedMonth}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  }, [tableData, selectedMonth]);

  // 格式化日期显示
  const formatDate = useCallback((dateStr) => {
    const date = new Date(dateStr);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
    const weekDay = weekDays[date.getDay()];
    return `${month}/${day} 周${weekDay}`;
  }, []);

  // 组件初始化
  useEffect(() => {
    loadTableData();
  }, [loadTableData]);

  // 主渲染函数
  if (loading && (!tableData || tableData.length === 0)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-20 w-20 border-4 border-blue-600 border-t-transparent mx-auto mb-6"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl">📊</span>
            </div>
          </div>
          <h3 className="text-2xl font-bold text-gray-800 mb-2">正在加载三列布局</h3>
          <p className="text-gray-600">Loading three-column commission layout...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* 页面头部 */}
      <div className="bg-white shadow-lg border-b border-gray-200">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex-1">
              <h1 className="text-4xl font-bold text-gray-900 flex items-center gap-4">
                <span className="text-5xl">👥</span>
                <div>
                  提成系统 - 三列对比视图
                  <div className="text-lg text-gray-600 font-normal mt-1">
                    投放人员业绩对比分析平台
                  </div>
                </div>
              </h1>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4">
              {/* 月份选择 */}
              <select
                value={selectedMonth}
                onChange={(e) => handleMonthChange(e.target.value)}
                className="px-6 py-3 border border-gray-300 rounded-xl bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium text-lg shadow-sm"
              >
                {availableMonths.map(month => (
                  <option key={month.value} value={month.value}>
                    {month.label}
                  </option>
                ))}
              </select>
              
              {/* 刷新按钮 */}
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-8 py-3 rounded-xl transition-all duration-200 font-medium flex items-center gap-3 disabled:opacity-50 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                    刷新中...
                  </>
                ) : (
                  <>
                    <span className="text-xl">🔄</span>
                    刷新数据
                  </>
                )}
              </button>
              
              {/* 导出按钮 */}
              <button
                onClick={() => exportData('csv')}
                className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white px-8 py-3 rounded-xl transition-all duration-200 font-medium flex items-center gap-3 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                <span className="text-xl">📁</span>
                导出数据
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 错误提示 */}
        {error && (
          <div className="mb-8 bg-red-50 border border-red-200 rounded-xl p-6">
            <div className="flex items-center space-x-3 text-red-700">
              <span className="text-2xl">⚠️</span>
              <span className="font-semibold text-lg">错误: {error}</span>
            </div>
          </div>
        )}

        {/* 总汇总统计 */}
        {summaryData && (
          <div className="mb-8 bg-white rounded-2xl shadow-xl border border-gray-200 p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
              <span className="text-3xl">📊</span>
              总体统计概览
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-gradient-to-br from-green-400 to-green-600 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-100 text-sm font-medium">月总提成</p>
                    <p className="text-3xl font-bold">
                      ¥{summaryData.totalCommission.toFixed(0)}
                    </p>
                  </div>
                  <div className="text-4xl opacity-80">💰</div>
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-100 text-sm font-medium">总订单数</p>
                    <p className="text-3xl font-bold">
                      {summaryData.totalOrders}
                    </p>
                  </div>
                  <div className="text-4xl opacity-80">📦</div>
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-purple-400 to-purple-600 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-100 text-sm font-medium">平均ROI</p>
                    <p className="text-3xl font-bold">
                      {summaryData.avgROI.toFixed(2)}
                    </p>
                  </div>
                  <div className="text-4xl opacity-80">📈</div>
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-orange-400 to-orange-600 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-orange-100 text-sm font-medium">工作天数</p>
                    <p className="text-3xl font-bold">
                      {summaryData.uniqueDates}
                    </p>
                  </div>
                  <div className="text-4xl opacity-80">📅</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 三列主要内容区域 */}
        {summaryData && summaryData.employeeStats && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {summaryData.employeeStats.map((empStat) => {
              const config = employeeConfig[empStat.employee];
              if (!config) return null;
              
              return (
                <div key={empStat.employee} className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
                  {/* 员工头部 */}
                  <div className={`bg-gradient-to-r ${config.gradient} p-8 text-white text-center`}>
                    <div className="mb-4">
                      <div className="w-20 h-20 mx-auto bg-white bg-opacity-20 rounded-full flex items-center justify-center mb-4">
                        <span className="text-4xl">{config.avatar}</span>
                      </div>
                      <h2 className="text-3xl font-bold mb-2">{config.name}</h2>
                      <p className="text-white text-opacity-90">投放专员</p>
                    </div>
                    
                    {/* 员工统计卡片 */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white bg-opacity-20 rounded-xl p-4">
                        <div className="text-2xl font-bold">¥{empStat.totalCommission.toFixed(0)}</div>
                        <div className="text-sm text-white text-opacity-80">月总提成</div>
                      </div>
                      <div className="bg-white bg-opacity-20 rounded-xl p-4">
                        <div className="text-2xl font-bold">{empStat.totalOrders}</div>
                        <div className="text-sm text-white text-opacity-80">总订单</div>
                      </div>
                      <div className="bg-white bg-opacity-20 rounded-xl p-4">
                        <div className="text-2xl font-bold">{empStat.avgROI.toFixed(2)}</div>
                        <div className="text-sm text-white text-opacity-80">平均ROI</div>
                      </div>
                      <div className="bg-white bg-opacity-20 rounded-xl p-4">
                        <div className="text-2xl font-bold">{empStat.workingDays}</div>
                        <div className="text-sm text-white text-opacity-80">工作日</div>
                      </div>
                    </div>
                  </div>
                  
                  {/* 每日数据列表 */}
                  <div className="p-6">
                    <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                      <span className="text-xl">📋</span>
                      每日业绩记录
                    </h3>
                    
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {empStat.dailyRecords.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          <div className="text-4xl mb-2">😴</div>
                          <p>暂无业绩记录</p>
                        </div>
                      ) : (
                        empStat.dailyRecords.map((record) => {
                          const statusStyle = getStatusStyle(record.status, record.roi);
                          const trend = getRoiTrend(record.roi);
                          
                          return (
                            <div 
                              key={record.id} 
                              className={`${statusStyle.bgColor} ${statusStyle.borderColor} border rounded-xl p-4 hover:shadow-md transition-all duration-200 transform hover:-translate-y-1`}
                            >
                              <div className="flex items-center justify-between mb-3">
                                <div className="text-lg font-bold text-gray-800">
                                  {formatDate(record.date)}
                                </div>
                                <div className={`${trend.bgColor} px-3 py-1 rounded-full flex items-center gap-2`}>
                                  <span>{trend.icon}</span>
                                  <span className={`text-xs font-medium ${trend.color}`}>
                                    {trend.trend}
                                  </span>
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-3 gap-3 text-center">
                                <div>
                                  <div className={`text-lg font-bold ${record.commission > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                                    ¥{record.commission.toFixed(0)}
                                  </div>
                                  <div className="text-xs text-gray-600">提成</div>
                                </div>
                                <div>
                                  <div className={`text-lg font-bold ${statusStyle.textColor}`}>
                                    {record.roi.toFixed(2)}
                                  </div>
                                  <div className="text-xs text-gray-600">ROI</div>
                                </div>
                                <div>
                                  <div className="text-lg font-bold text-gray-800">
                                    {record.orders}
                                  </div>
                                  <div className="text-xs text-gray-600">单量</div>
                                </div>
                              </div>
                              
                              {record.commission > 0 && (
                                <div className="mt-3 pt-3 border-t border-gray-200">
                                  <div className="text-xs text-gray-600 text-center">
                                    单价提成: ¥{record.commissionPerOrder.toFixed(2)}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 更新时间提示 */}
        {lastRefreshTime && (
          <div className="mt-8 text-center">
            <p className="text-gray-500 text-sm">
              最后更新于: {new Date(lastRefreshTime).toLocaleString('zh-CN')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ThreeColumnCommissionLayout;