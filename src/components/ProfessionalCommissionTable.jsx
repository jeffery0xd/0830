import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { stableCommissionService } from '../data/stableCommissionService';

// 专业表格式提成系统组件
const ProfessionalCommissionTable = () => {
  // 核心状态管理
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState('2025-08');
  
  // 数据状态
  const [tableData, setTableData] = useState([]);
  const [summaryData, setSummaryData] = useState(null);
  const [availableDates, setAvailableDates] = useState([]);
  
  // UI状态
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
  const [filterConfig, setFilterConfig] = useState({ employee: 'all', dateRange: 'all' });
  const [lastRefreshTime, setLastRefreshTime] = useState(null);
  
  // 常量配置
  const availableMonths = useMemo(() => [
    { value: '2025-07', label: '2025年7月' },
    { value: '2025-08', label: '2025年8月' }
  ], []);
  
  const targetEmployees = useMemo(() => ['乔', '白', '妹'], []);

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
      console.log('🔄 加载表格数据:', selectedMonth);
      
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
      
      setTableData(flattenedData);
      
      // 计算汇总数据
      const summary = calculateSummaryData(flattenedData);
      setSummaryData(summary);
      
      setLastRefreshTime(new Date().toISOString());
      
      console.log(`✅ 表格数据加载完成: ${flattenedData.length} 条记录`);
      console.log('📊 汇总数据:', summary);
      
    } catch (error) {
      console.error('❌ 加载表格数据失败:', error);
      setError(`数据加载失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

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
          workingDays: 0
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
        workingDays: empWorkingDays
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
  }, [targetEmployees]);

  // 数据排序
  const sortedData = useMemo(() => {
    if (!tableData || tableData.length === 0) return [];
    
    let filteredData = [...tableData];
    
    // 应用筛选
    if (filterConfig.employee !== 'all') {
      filteredData = filteredData.filter(record => record.employee === filterConfig.employee);
    }
    
    if (filterConfig.dateRange !== 'all') {
      const today = new Date().toISOString().split('T')[0];
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      if (filterConfig.dateRange === 'recent7') {
        filteredData = filteredData.filter(record => record.date >= sevenDaysAgo && record.date <= today);
      }
    }
    
    // 应用排序
    return filteredData.sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];
      
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
      }
      
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortConfig.direction === 'asc' 
          ? aVal.localeCompare(bVal, 'zh-CN') 
          : bVal.localeCompare(aVal, 'zh-CN');
      }
      
      return 0;
    });
  }, [tableData, sortConfig, filterConfig]);

  // 处理排序
  const handleSort = useCallback((key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  }, []);

  // 处理筛选
  const handleFilter = useCallback((type, value) => {
    setFilterConfig(prev => ({ ...prev, [type]: value }));
  }, []);

  // 手动刷新
  const handleRefresh = useCallback(async () => {
    console.log('🔄 手动刷新数据');
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
  const getRoiTrend = useCallback((roi, employee, date) => {
    // 这里可以实现更复杂的趋势分析逻辑
    // 暂时基于ROI值显示趋势
    if (roi >= 1.0) return { icon: '↑', color: 'text-green-600', trend: 'up' };
    if (roi >= 0.8) return { icon: '→', color: 'text-yellow-600', trend: 'stable' };
    if (roi > 0) return { icon: '↓', color: 'text-red-600', trend: 'down' };
    return { icon: '—', color: 'text-gray-400', trend: 'none' };
  }, []);

  // 获取状态样式
  const getStatusStyle = useCallback((status, roi) => {
    if (status === 'high_performance' || roi >= 1.0) {
      return {
        bgColor: 'bg-green-50',
        textColor: 'text-green-800',
        badgeColor: 'bg-green-100 text-green-800',
        borderColor: 'border-green-200'
      };
    } else if (status === 'qualified' || (roi >= 0.8 && roi < 1.0)) {
      return {
        bgColor: 'bg-yellow-50',
        textColor: 'text-yellow-800',
        badgeColor: 'bg-yellow-100 text-yellow-800',
        borderColor: 'border-yellow-200'
      };
    } else if (status === 'no_commission' && roi > 0) {
      return {
        bgColor: 'bg-red-50',
        textColor: 'text-red-800',
        badgeColor: 'bg-red-100 text-red-800',
        borderColor: 'border-red-200'
      };
    } else {
      return {
        bgColor: 'bg-gray-50',
        textColor: 'text-gray-600',
        badgeColor: 'bg-gray-100 text-gray-600',
        borderColor: 'border-gray-200'
      };
    }
  }, []);

  // 导出数据功能
  const exportData = useCallback((format = 'csv') => {
    if (!sortedData || sortedData.length === 0) {
      alert('没有数据可导出');
      return;
    }
    
    const headers = ['日期', '员工', '提成金额', 'ROI', '单量', '单价提成', '状态'];
    const csvContent = [
      headers.join(','),
      ...sortedData.map(record => [
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
    link.download = `提成数据_${selectedMonth}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  }, [sortedData, selectedMonth]);

  // 组件初始化
  useEffect(() => {
    loadTableData();
  }, [loadTableData]);

  // 主渲染函数
  if (loading && (!tableData || tableData.length === 0)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent mx-auto mb-6"></div>
          <h3 className="text-xl font-semibold text-gray-800 mb-2">正在加载数据表格</h3>
          <p className="text-gray-600">Loading professional data table...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 页面头部 */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <span className="text-4xl">📊</span>
                提成数据报表
              </h1>
              <p className="mt-2 text-gray-600">专业的员工提成数据分析与管理系统</p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3">
              {/* 月份选择 */}
              <select
                value={selectedMonth}
                onChange={(e) => handleMonthChange(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium"
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
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors duration-200 font-medium flex items-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    刷新中
                  </>
                ) : (
                  <>
                    🔄 刷新数据
                  </>
                )}
              </button>
              
              {/* 导出按钮 */}
              <button
                onClick={() => exportData('csv')}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg transition-colors duration-200 font-medium flex items-center gap-2"
              >
                📁 导出数据
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* 错误提示 */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center space-x-2 text-red-700">
              <span className="text-xl">⚠️</span>
              <span className="font-medium">错误: {error}</span>
            </div>
          </div>
        )}

        {/* 汇总统计卡片 */}
        {summaryData && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">月总提成</p>
                  <p className="text-3xl font-bold text-green-600">
                    ¥{summaryData.totalCommission.toFixed(0)}
                  </p>
                </div>
                <div className="text-green-600 bg-green-100 p-3 rounded-lg">
                  💰
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">总订单数</p>
                  <p className="text-3xl font-bold text-blue-600">
                    {summaryData.totalOrders}
                  </p>
                </div>
                <div className="text-blue-600 bg-blue-100 p-3 rounded-lg">
                  📦
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">平均ROI</p>
                  <p className="text-3xl font-bold text-purple-600">
                    {summaryData.avgROI.toFixed(2)}
                  </p>
                </div>
                <div className="text-purple-600 bg-purple-100 p-3 rounded-lg">
                  📈
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">工作天数</p>
                  <p className="text-3xl font-bold text-orange-600">
                    {summaryData.uniqueDates}
                  </p>
                </div>
                <div className="text-orange-600 bg-orange-100 p-3 rounded-lg">
                  📅
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 筛选控制栏 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* 员工筛选 */}
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">员工筛选:</label>
                <select
                  value={filterConfig.employee}
                  onChange={(e) => handleFilter('employee', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">全部员工</option>
                  {targetEmployees.map(emp => (
                    <option key={emp} value={emp}>{emp}</option>
                  ))}
                </select>
              </div>
              
              {/* 日期范围筛选 */}
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">日期范围:</label>
                <select
                  value={filterConfig.dateRange}
                  onChange={(e) => handleFilter('dateRange', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">全部日期</option>
                  <option value="recent7">最近7天</option>
                </select>
              </div>
            </div>
            
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <span>显示 {sortedData.length} 条记录</span>
              {lastRefreshTime && (
                <span>更新于 {new Date(lastRefreshTime).toLocaleString('zh-CN')}</span>
              )}
            </div>
          </div>
        </div>

        {/* 专业数据表格 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              {/* 表头 */}
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {[
                    { key: 'date', label: '日期', sortable: true },
                    { key: 'employee', label: '员工', sortable: true },
                    { key: 'commission', label: '提成金额', sortable: true },
                    { key: 'roi', label: 'ROI', sortable: true },
                    { key: 'orders', label: '单量', sortable: true },
                    { key: 'status', label: '状态', sortable: false }
                  ].map((column, index) => (
                    <th
                      key={column.key}
                      className={`px-6 py-4 text-left text-sm font-semibold text-gray-900 ${
                        column.sortable ? 'cursor-pointer hover:bg-gray-100' : ''
                      }`}
                      onClick={() => column.sortable && handleSort(column.key)}
                    >
                      <div className="flex items-center gap-2">
                        {column.label}
                        {column.sortable && sortConfig.key === column.key && (
                          <span className="text-blue-600">
                            {sortConfig.direction === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              
              {/* 表格主体 */}
              <tbody className="divide-y divide-gray-200">
                {sortedData.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center">
                      <div className="text-gray-500">
                        <div className="text-4xl mb-4">📊</div>
                        <p className="text-lg">暂无数据记录</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  sortedData.map((record, index) => {
                    const style = getStatusStyle(record.status, record.roi);
                    const trend = getRoiTrend(record.roi, record.employee, record.date);
                    
                    return (
                      <tr 
                        key={record.id} 
                        className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${style.bgColor} hover:bg-blue-50 transition-colors duration-150`}
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {record.date}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                          <div className="flex items-center gap-2">
                            <span className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-xs">
                              {record.employee}
                            </span>
                            {record.employee}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold">
                          <span className={record.commission > 0 ? 'text-green-600' : 'text-gray-400'}>
                            ¥{record.commission.toFixed(0)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center gap-2">
                            <span className={style.textColor}>
                              {record.roi.toFixed(2)}
                            </span>
                            <span className={`${trend.color} font-bold`}>
                              {trend.icon}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                          {record.orders}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${style.badgeColor}`}>
                            {record.statusText}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              
              {/* 汇总行 */}
              {summaryData && sortedData.length > 0 && (
                <tfoot className="bg-blue-50 border-t-2 border-blue-200">
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-blue-900">
                      月度汇总
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-700">
                      {targetEmployees.length} 人
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-blue-900">
                      ¥{summaryData.totalCommission.toFixed(0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-blue-900">
                      {summaryData.avgROI.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-blue-900">
                      {summaryData.totalOrders}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-700">
                      {summaryData.uniqueDates} 天数据
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* 员工统计详情 */}
        {summaryData && summaryData.employeeStats && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              👥 员工统计详情
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {summaryData.employeeStats.map(empStat => (
                <div key={empStat.employee} className="bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-lg font-bold text-gray-800">{empStat.employee}</h4>
                    <span className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">
                      {empStat.employee}
                    </span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">月总提成:</span>
                      <span className="font-bold text-green-600">¥{empStat.totalCommission.toFixed(0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">总订单:</span>
                      <span className="font-semibold">{empStat.totalOrders}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">平均ROI:</span>
                      <span className="font-semibold">{empStat.avgROI.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">工作日:</span>
                      <span className="font-semibold">{empStat.workingDays}天</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfessionalCommissionTable;