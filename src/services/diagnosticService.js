// 紧急数据诊断和修复服务
import { supabase, adDataService } from '../utils/supabase';

class DiagnosticService {
  
  // 数据库直接查询（绕过所有缓存）
  async directDatabaseQuery(monthString = '2025-08') {
    try {
      console.log('🔍 开始直接数据库查询诊断...');
      
      // 直接查询数据库，获取所有原始数据
      const { data: allRawData, error } = await supabase
        .from('app_e87b41cfe355428b8146f8bae8184e10_ad_data_entries')
        .select('*')
        .order('date', { ascending: false });
      
      if (error) {
        console.error('数据库查询错误:', error);
        throw error;
      }
      
      console.log('📊 数据库原始数据总条数:', allRawData.length);
      
      // 分析数据分布
      const [year, month] = monthString.split('-').map(Number);
      const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${year}-${month.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
      
      // 筛选目标月份数据
      const monthData = allRawData.filter(record => 
        record.date >= startDate && record.date <= endDate
      );
      
      console.log(`📅 ${monthString} 月份数据条数:`, monthData.length);
      
      // 分析员工数据
      const targetEmployees = ['乔', '白', '妹'];
      const employeeData = monthData.filter(record => 
        targetEmployees.includes(record.staff)
      );
      
      console.log('👥 目标员工数据条数:', employeeData.length);
      
      // 分析日期分布
      const uniqueDates = [...new Set(employeeData.map(item => item.date))]
        .sort((a, b) => new Date(a) - new Date(b));
      
      console.log('📆 实际数据日期列表:', uniqueDates);
      console.log('📈 实际数据天数:', uniqueDates.length);
      
      // 分析每个员工的数据分布
      const employeeStats = targetEmployees.map(emp => {
        const empData = employeeData.filter(record => record.staff === emp);
        const empDates = [...new Set(empData.map(item => item.date))].sort();
        return {
          employee: emp,
          records: empData.length,
          dates: empDates,
          dateCount: empDates.length
        };
      });
      
      console.log('👤 员工数据分析:', employeeStats);
      
      return {
        totalRecords: allRawData.length,
        monthRecords: monthData.length,
        targetEmployeeRecords: employeeData.length,
        uniqueDates: uniqueDates,
        dateCount: uniqueDates.length,
        employeeStats: employeeStats,
        rawData: employeeData // 返回原始数据供进一步分析
      };
      
    } catch (error) {
      console.error('❌ 数据库诊断查询失败:', error);
      throw error;
    }
  }
  
  // 清除所有相关缓存
  clearAllCaches() {
    console.log('🗑️ 清除所有缓存...');
    
    // 清除所有可能的缓存键
    const cacheKeys = [
      'ad_data_2025-08-01', 'ad_data_2025-08-02', 'ad_data_2025-08-03', 'ad_data_2025-08-04', 'ad_data_2025-08-05',
      'ad_data_2025-08-06', 'ad_data_2025-08-07', 'ad_data_2025-08-08', 'ad_data_2025-08-09', 'ad_data_2025-08-10', 'ad_data_2025-08-11',
      'daily_commission_2025-08-01', 'daily_commission_2025-08-02', 'daily_commission_2025-08-03', 'daily_commission_2025-08-04', 'daily_commission_2025-08-05',
      'daily_commission_2025-08-06', 'daily_commission_2025-08-07', 'daily_commission_2025-08-08', 'daily_commission_2025-08-09', 'daily_commission_2025-08-10', 'daily_commission_2025-08-11',
      'monthly_commission_2025-08',
      'available_dates_2025-08',
      'stable_leaderboard_2025-08'
    ];
    
    // 强制清除缓存
    if (typeof localStorage !== 'undefined') {
      cacheKeys.forEach(key => {
        localStorage.removeItem(key);
      });
    }
    
    console.log('✅ 缓存清除完成');
  }
  
  // 重新计算月度提成（无缓存版本）
  async recalculateMonthlyCommission(monthString = '2025-08') {
    try {
      console.log('🔄 开始重新计算月度提成...');
      
      // 先做数据诊断
      const diagnostic = await this.directDatabaseQuery(monthString);
      
      if (diagnostic.dateCount === 0) {
        console.log('⚠️ 该月份没有数据');
        return [];
      }
      
      console.log(`✅ 发现 ${diagnostic.dateCount} 天的数据，开始计算提成...`);
      
      // 重新计算提成
      const targetEmployees = ['乔', '白', '妹'];
      const monthlyStats = targetEmployees.map(emp => {
        const empStats = diagnostic.employeeStats.find(s => s.employee === emp);
        if (!empStats) {
          return {
            advertiser: emp,
            totalCommission: 0,
            totalOrders: 0,
            workingDays: 0,
            avgROI: 0
          };
        }
        
        // 计算该员工的总体统计
        const empData = diagnostic.rawData.filter(record => record.staff === emp);
        
        let totalSpend = 0;
        let totalRevenue = 0;
        let totalOrders = 0;
        let totalCommission = 0;
        let validDays = 0;
        let totalROI = 0;
        
        // 按日期分组计算
        empStats.dates.forEach(date => {
          const dayRecords = empData.filter(record => record.date === date);
          
          const daySpend = dayRecords.reduce((sum, record) => sum + parseFloat(record.ad_spend || 0), 0);
          const dayRevenue = dayRecords.reduce((sum, record) => sum + parseFloat(record.credit_card_amount || 0) / 20.0, 0); // 转换为USD
          const dayOrders = dayRecords.reduce((sum, record) => sum + parseInt(record.credit_card_orders || 0), 0);
          
          totalSpend += daySpend;
          totalRevenue += dayRevenue;
          totalOrders += dayOrders;
          
          // 计算当日ROI和提成
          const dayROI = daySpend > 0 ? dayRevenue / daySpend : 0;
          totalROI += dayROI;
          
          let dayCommissionPerOrder = 0;
          if (dayOrders > 0) {
            if (dayROI >= 1.0) {
              dayCommissionPerOrder = 7;
            } else if (dayROI >= 0.8) {
              dayCommissionPerOrder = 5;
            }
          }
          
          totalCommission += dayOrders * dayCommissionPerOrder;
          
          if (dayOrders > 0 || daySpend > 0) {
            validDays++;
          }
        });
        
        const avgROI = validDays > 0 ? totalROI / validDays : 0;
        
        return {
          advertiser: emp,
          totalCommission: Math.round(totalCommission * 100) / 100,
          totalOrders: totalOrders,
          workingDays: validDays,
          avgROI: Math.round(avgROI * 10000) / 10000
        };
      });
      
      console.log('💰 月度提成重新计算完成:', monthlyStats);
      return monthlyStats;
      
    } catch (error) {
      console.error('❌ 月度提成重新计算失败:', error);
      throw error;
    }
  }
}

export const diagnosticService = new DiagnosticService();
export default diagnosticService;
