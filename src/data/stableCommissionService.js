import { supabase, adDataService } from '../utils/supabase';

// 数据缓存系统
class DataCache {
  constructor() {
    this.cache = new Map();
    this.cacheExpiry = new Map();
    this.defaultTTL = 5 * 60 * 1000; // 5分钟缓存
  }

  set(key, data, ttl = this.defaultTTL) {
    this.cache.set(key, data);
    this.cacheExpiry.set(key, Date.now() + ttl);
  }

  get(key) {
    const expiry = this.cacheExpiry.get(key);
    if (expiry && Date.now() > expiry) {
      this.cache.delete(key);
      this.cacheExpiry.delete(key);
      return null;
    }
    return this.cache.get(key);
  }

  clear() {
    this.cache.clear();
    this.cacheExpiry.clear();
  }
}

// 防抖函数
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// 全局缓存实例
const dataCache = new DataCache();

// 重写的稳定提成服务
export const stableCommissionService = {
  // 目标员工列表
  TARGET_EMPLOYEES: ['乔', '白', '妹'],
  
  // 汇率常量
  EXCHANGE_RATE: 20.0, // 1 USD = 20 MX$

  // 获取稳定的广告数据（带缓存）
  async getStableAdData(date) {
    const cacheKey = `ad_data_${date}`;
    let cachedData = dataCache.get(cacheKey);
    
    if (cachedData) {
      console.log('使用缓存的广告数据:', date);
      return cachedData;
    }

    try {
      console.log('获取新鲜广告数据:', date);
      const allData = await adDataService.getAll();
      
      // 筛选指定日期的目标员工数据（更宽松的筛选条件）
      const filteredData = allData.filter(record => {
        // 确保日期匹配
        const dateMatch = record.date === date;
        // 确保员工匹配（包括可能的空格和大小写问题）
        const staffMatch = this.TARGET_EMPLOYEES.some(emp => {
          const recordStaff = (record.staff || '').trim();
          return recordStaff === emp || recordStaff.includes(emp) || emp.includes(recordStaff);
        });
        
        console.log(`检查记录: 日期=${record.date} 员工=${record.staff} 日期匹配=${dateMatch} 员工匹配=${staffMatch}`);
        
        return dateMatch && staffMatch;
      });
      
      console.log(`${date} 原始数据数量: ${allData.length}, 筛选后: ${filteredData.length}`);
      
      // 数据转换和标准化
      const processedData = filteredData.map(record => {
        const creditCardUSD = parseFloat(record.credit_card_amount || 0) / this.EXCHANGE_RATE;
        const adSpend = parseFloat(record.ad_spend || 0);
        const roi = adSpend > 0 ? (creditCardUSD / adSpend) : 0;
        
        return {
          advertiser: (record.staff || '').trim(),
          date: record.date,
          spend_amount: adSpend,
          credit_card_amount: creditCardUSD,
          credit_card_orders: parseInt(record.credit_card_orders || 0),
          roi: Math.round(roi * 10000) / 10000, // 4位小数精度
          created_at: record.created_at,
          updated_at: record.updated_at
        };
      });
      
      // 缓存数据（更短的缓存时间，避免数据过时）
      dataCache.set(cacheKey, processedData, 2 * 60 * 1000); // 2分钟缓存
      
      console.log(`处理完成 ${date} 的广告数据:`, processedData);
      return processedData;
    } catch (error) {
      console.error('获取广告数据失败:', error);
      throw new Error(`获取 ${date} 广告数据失败: ${error.message}`);
    }
  },

  // 稳定的提成计算（纯函数，无副作用）
  calculateCommissionStable(adData) {
    console.log('开始稳定提成计算:', adData);
    
    // 按员工分组汇总
    const groupedData = {};
    
    // 初始化每个目标员工的数据
    this.TARGET_EMPLOYEES.forEach(emp => {
      groupedData[emp] = {
        advertiser: emp,
        totalSpend: 0,
        totalRevenue: 0,
        totalOrders: 0,
        records: []
      };
    });
    
    // 汇总数据
    adData.forEach(record => {
      const advertiser = record.advertiser;
      if (groupedData[advertiser]) {
        groupedData[advertiser].totalSpend += parseFloat(record.spend_amount || 0);
        groupedData[advertiser].totalRevenue += parseFloat(record.credit_card_amount || 0);
        groupedData[advertiser].totalOrders += parseInt(record.credit_card_orders || 0);
        groupedData[advertiser].records.push(record);
      }
    });
    
    // 计算每个员工的提成（稳定算法）
    const commissionResults = this.TARGET_EMPLOYEES.map(emp => {
      const data = groupedData[emp];
      const roi = data.totalSpend > 0 ? data.totalRevenue / data.totalSpend : 0;
      
      let commissionPerOrder = 0;
      let commissionStatus = 'no_data';
      let statusText = '暂无数据';
      
      if (data.totalOrders > 0) {
        if (roi >= 1.0) {
          commissionPerOrder = 7;
          commissionStatus = 'high_performance';
          statusText = '高效投放';
        } else if (roi >= 0.8) {
          commissionPerOrder = 5;
          commissionStatus = 'qualified';
          statusText = '合格投放';
        } else {
          commissionPerOrder = 0;
          commissionStatus = 'no_commission';
          statusText = '跑了个锤子';
        }
      }
      
      const totalCommission = data.totalOrders * commissionPerOrder;
      
      return {
        advertiser: emp,
        date: adData.length > 0 ? adData[0].date : null,
        order_count: data.totalOrders,
        roi: Math.round(roi * 10000) / 10000, // 确保精度一致
        commission_per_order: commissionPerOrder,
        total_commission: Math.round(totalCommission * 100) / 100, // 2位小数
        commission_status: commissionStatus,
        status_text: statusText,
        // 额外数据用于调试
        _debug: {
          totalSpend: Math.round(data.totalSpend * 100) / 100,
          totalRevenue: Math.round(data.totalRevenue * 100) / 100,
          recordCount: data.records.length
        }
      };
    });
    
    console.log('稳定提成计算结果:', commissionResults);
    return commissionResults;
  },

  // 获取稳定的单日提成数据
  async getStableDailyCommission(date) {
    const cacheKey = `daily_commission_${date}`;
    let cachedData = dataCache.get(cacheKey);
    
    if (cachedData) {
      console.log('使用缓存的提成数据:', date);
      return cachedData;
    }

    try {
      // 获取广告数据
      const adData = await this.getStableAdData(date);
      
      // 计算提成
      const commissionData = this.calculateCommissionStable(adData);
      
      // 缓存计算结果（较短的缓存时间，因为可能需要更新）
      dataCache.set(cacheKey, commissionData, 2 * 60 * 1000); // 2分钟缓存
      
      return commissionData;
    } catch (error) {
      console.error('获取单日提成数据失败:', error);
      // 返回默认数据而不是抛出错误
      return this.TARGET_EMPLOYEES.map(emp => ({
        advertiser: emp,
        date: date,
        order_count: 0,
        roi: 0,
        commission_per_order: 0,
        total_commission: 0,
        commission_status: 'error',
        status_text: '数据获取失败',
        _debug: { error: error.message }
      }));
    }
  },

  // 获取稳定的月度提成汇总
  async getStableMonthlyCommission(monthString = '2025-08') {
    const cacheKey = `monthly_commission_${monthString}`;
    let cachedData = dataCache.get(cacheKey);
    
    if (cachedData) {
      console.log('使用缓存的月度提成数据:', monthString);
      return cachedData;
    }

    try {
      console.log('计算月度提成数据:', monthString);
      const [year, month] = monthString.split('-').map(Number);
      
      // 获取该月的所有日期
      const dates = await this.getAvailableDatesForMonth(monthString);
      
      if (dates.length === 0) {
        console.log('该月份没有数据');
        return this.TARGET_EMPLOYEES.map(emp => ({
          advertiser: emp,
          totalCommission: 0,
          totalOrders: 0,
          workingDays: 0,
          avgROI: 0,
          monthString: monthString
        }));
      }
      
      // 获取所有日期的提成数据
      const allDailyData = [];
      for (const date of dates) {
        try {
          const dailyData = await this.getStableDailyCommission(date);
          allDailyData.push(...dailyData);
        } catch (error) {
          console.warn(`跳过 ${date} 的数据:`, error.message);
        }
      }
      
      // 按员工汇总月度数据
      const monthlySummary = this.TARGET_EMPLOYEES.map(emp => {
        const empRecords = allDailyData.filter(record => 
          record.advertiser === emp && record.commission_status !== 'error'
        );
        
        const totalCommission = empRecords.reduce((sum, record) => 
          sum + (record.total_commission || 0), 0
        );
        
        const totalOrders = empRecords.reduce((sum, record) => 
          sum + (record.order_count || 0), 0
        );
        
        const workingDays = empRecords.filter(record => 
          record.order_count > 0 || record.total_commission > 0
        ).length;
        
        const avgROI = empRecords.length > 0 
          ? empRecords.reduce((sum, record) => sum + (record.roi || 0), 0) / empRecords.length 
          : 0;
        
        return {
          advertiser: emp,
          totalCommission: Math.round(totalCommission * 100) / 100,
          totalOrders: totalOrders,
          workingDays: workingDays,
          avgROI: Math.round(avgROI * 10000) / 10000,
          monthString: monthString,
          recordCount: empRecords.length
        };
      });
      
      // 缓存月度数据（较长缓存时间）
      dataCache.set(cacheKey, monthlySummary, 10 * 60 * 1000); // 10分钟缓存
      
      console.log('月度提成汇总完成:', monthlySummary);
      return monthlySummary;
    } catch (error) {
      console.error('获取月度提成失败:', error);
      // 返回默认数据
      return this.TARGET_EMPLOYEES.map(emp => ({
        advertiser: emp,
        totalCommission: 0,
        totalOrders: 0,
        workingDays: 0,
        avgROI: 0,
        monthString: monthString,
        error: error.message
      }));
    }
  },

  // 获取可用日期（带缓存） - 修复版：确保获取所有数据
  async getAvailableDatesForMonth(monthString = '2025-08') {
    const cacheKey = `available_dates_${monthString}`;
    let cachedData = dataCache.get(cacheKey);
    
    if (cachedData) {
      console.log(`使用缓存的日期数据 ${monthString}:`, cachedData);
      return cachedData;
    }

    try {
      console.log(`获取 ${monthString} 月份的可用日期...`);
      const [year, month] = monthString.split('-').map(Number);
      const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${year}-${month.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
      
      console.log(`日期范围: ${startDate} 到 ${endDate}`);
      
      const allData = await adDataService.getAll();
      console.log(`总数据数量: ${allData.length}`);
      
      // 更宽松的筛选条件
      const filteredData = allData.filter(record => {
        const dateInRange = record.date >= startDate && record.date <= endDate;
        const isTargetEmployee = this.TARGET_EMPLOYEES.some(emp => {
          const recordStaff = (record.staff || '').trim();
          return recordStaff === emp || recordStaff.includes(emp) || emp.includes(recordStaff);
        });
        
        return dateInRange && isTargetEmployee;
      });
      
      console.log(`${monthString} 月份筛选后数据数量: ${filteredData.length}`);
      
      // 获取全部唯一日期并排序
      const uniqueDates = [...new Set(filteredData.map(item => item.date))]
        .filter(date => date && date.length >= 10) // 确保日期格式正确
        .sort((a, b) => new Date(b) - new Date(a)); // 降序排列
      
      console.log(`${monthString} 月份的唯一日期列表:`, uniqueDates);
      console.log(`实际可用日期数量: ${uniqueDates.length}`);
      
      // 缓存日期列表（更短的缓存时间）
      dataCache.set(cacheKey, uniqueDates, 3 * 60 * 1000); // 3分钟缓存
      
      return uniqueDates;
    } catch (error) {
      console.error('获取可用日期失败:', error);
      return [];
    }
  },

  // 获取数据范围信息
  async getDataRangeInfo(monthString = '2025-08') {
    try {
      const dates = await this.getAvailableDatesForMonth(monthString);
      
      if (dates.length === 0) {
        return {
          startDate: null,
          endDate: null,
          totalDays: 0,
          monthString: monthString
        };
      }
      
      return {
        startDate: dates[dates.length - 1], // 最早日期
        endDate: dates[0], // 最新日期
        totalDays: dates.length,
        monthString: monthString,
        availableDates: dates
      };
    } catch (error) {
      console.error('获取数据范围信息失败:', error);
      return {
        startDate: null,
        endDate: null,
        totalDays: 0,
        monthString: monthString,
        error: error.message
      };
    }
  },

  // 清除缓存
  clearCache() {
    console.log('清除提成数据缓存');
    dataCache.clear();
  },

  // 强制刷新数据 - 增强版
  async forceRefresh(date = null, monthString = null) {
    console.log('强制刷新数据:', { date, monthString });
    
    // 清除相关缓存
    if (date) {
      dataCache.cache.delete(`ad_data_${date}`);
      dataCache.cache.delete(`daily_commission_${date}`);
      dataCache.cacheExpiry.delete(`ad_data_${date}`);
      dataCache.cacheExpiry.delete(`daily_commission_${date}`);
    }
    
    if (monthString) {
      dataCache.cache.delete(`monthly_commission_${monthString}`);
      dataCache.cache.delete(`available_dates_${monthString}`);
      dataCache.cacheExpiry.delete(`monthly_commission_${monthString}`);
      dataCache.cacheExpiry.delete(`available_dates_${monthString}`);
      
      // 清除该月份所有日期的缓存
      for (let day = 1; day <= 31; day++) {
        const dateStr = `${monthString}-${day.toString().padStart(2, '0')}`;
        dataCache.cache.delete(`ad_data_${dateStr}`);
        dataCache.cache.delete(`daily_commission_${dateStr}`);
        dataCache.cacheExpiry.delete(`ad_data_${dateStr}`);
        dataCache.cacheExpiry.delete(`daily_commission_${dateStr}`);
      }
    }
    
    // 如果都没有指定，清除所有缓存
    if (!date && !monthString) {
      this.clearCache();
    }
    
    console.log('缓存清除完成');
  }
};

// 稳定排行榜服务
export const stableLeaderboardService = {
  // 获取稳定排行榜数据
  async getStableRankings(monthString = '2025-08') {
    const cacheKey = `stable_leaderboard_${monthString}`;
    let cachedData = dataCache.get(cacheKey);
    
    if (cachedData) {
      console.log('使用缓存的稳定排行榜数据:', monthString);
      return cachedData;
    }
    
    try {
      console.log('计算稳定排行榜数据:', monthString);
      
      // 获取月度提成数据
      const monthlyData = await stableCommissionService.getStableMonthlyCommission(monthString);
      
      if (monthlyData.length === 0) {
        console.log('该月份没有提成数据');
        return stableCommissionService.TARGET_EMPLOYEES.map((emp, index) => ({
          advertiser: emp,
          totalCommission: 0,
          totalOrders: 0,
          workingDays: 0,
          avgROI: 0,
          rank: index + 1,
          rankInfo: this.getRankInfo(index + 1),
          monthString: monthString
        }));
      }
      
      // 稳定排序算法（多重排序条件确保稳定性）
      const sortedData = [...monthlyData].sort((a, b) => {
        // 主要排序：总提成（降序）
        const commissionDiff = (b.totalCommission || 0) - (a.totalCommission || 0);
        if (Math.abs(commissionDiff) >= 0.01) { // 避免浮点数精度问题
          return commissionDiff;
        }
        
        // 次要排序：总订单数（降序）
        const ordersDiff = (b.totalOrders || 0) - (a.totalOrders || 0);
        if (ordersDiff !== 0) {
          return ordersDiff;
        }
        
        // 第三排序：平均ROI（降序）
        const roiDiff = (b.avgROI || 0) - (a.avgROI || 0);
        if (Math.abs(roiDiff) >= 0.0001) {
          return roiDiff;
        }
        
        // 第四排序：工作日数（降序）
        const workingDaysDiff = (b.workingDays || 0) - (a.workingDays || 0);
        if (workingDaysDiff !== 0) {
          return workingDaysDiff;
        }
        
        // 最后排序：员工名称（字典序，确保完全稳定）
        return (a.advertiser || '').localeCompare((b.advertiser || ''), 'zh-CN');
      });
      
      // 添加排名和排名信息
      const rankedData = sortedData.map((item, index) => ({
        ...item,
        rank: index + 1,
        rankInfo: this.getRankInfo(index + 1)
      }));
      
      // 确保所有目标员工都在排行榜中
      const rankedEmployees = rankedData.map(item => item.advertiser);
      const missingEmployees = stableCommissionService.TARGET_EMPLOYEES.filter(
        emp => !rankedEmployees.includes(emp)
      );
      
      if (missingEmployees.length > 0) {
        console.log('补充缺失的员工数据:', missingEmployees);
        missingEmployees.forEach(emp => {
          rankedData.push({
            advertiser: emp,
            totalCommission: 0,
            totalOrders: 0,
            workingDays: 0,
            avgROI: 0,
            rank: rankedData.length + 1,
            rankInfo: this.getRankInfo(rankedData.length + 1),
            monthString: monthString
          });
        });
      }
      
      // 缓存排行榜数据（较长缓存时间）
      dataCache.set(cacheKey, rankedData, 8 * 60 * 1000); // 8分钟缓存
      
      console.log('稳定排行榜数据生成完成:', rankedData);
      return rankedData;
    } catch (error) {
      console.error('获取排行榜失败:', error);
      
      // 返回默认的安全数据
      return stableCommissionService.TARGET_EMPLOYEES.map((emp, index) => ({
        advertiser: emp,
        totalCommission: 0,
        totalOrders: 0,
        workingDays: 0,
        avgROI: 0,
        rank: index + 1,
        rankInfo: this.getRankInfo(index + 1),
        monthString: monthString,
        error: error.message
      }));
    }
  },

  // 获取排名信息（称号和特权）
  getRankInfo(rank) {
    const rankConfigs = {
      1: {
        title: '游艇会黑金卡',
        privilege: '顶级会员待遇',
        emoji: '🥇',
        gradient: 'from-yellow-400 via-yellow-500 to-yellow-600',
        textGradient: 'from-yellow-600 to-orange-600',
        bgGradient: 'from-yellow-50 to-orange-50',
        borderColor: 'border-yellow-300',
        shadowColor: 'shadow-yellow-200',
        glowColor: 'shadow-yellow-400/30'
      },
      2: {
        title: '阳光国会黑金卡',
        privilege: '高级会员待遇',
        emoji: '🥈',
        gradient: 'from-gray-300 via-gray-400 to-gray-500',
        textGradient: 'from-gray-600 to-slate-600',
        bgGradient: 'from-gray-50 to-slate-50',
        borderColor: 'border-gray-300',
        shadowColor: 'shadow-gray-200',
        glowColor: 'shadow-gray-400/30'
      },
      3: {
        title: '黑灯舞黑金卡',
        privilege: '公司提供免费体检一次',
        emoji: '🥉',
        gradient: 'from-orange-400 via-amber-500 to-orange-600',
        textGradient: 'from-orange-600 to-amber-600',
        bgGradient: 'from-orange-50 to-amber-50',
        borderColor: 'border-orange-300',
        shadowColor: 'shadow-orange-200',
        glowColor: 'shadow-orange-400/30'
      }
    };
    
    return rankConfigs[rank] || {
      title: '努力拼搏',
      privilege: '继续加油💪',
      emoji: '💪',
      gradient: 'from-blue-400 via-blue-500 to-blue-600',
      textGradient: 'from-blue-600 to-indigo-600',
      bgGradient: 'from-blue-50 to-indigo-50',
      borderColor: 'border-blue-300',
      shadowColor: 'shadow-blue-200',
      glowColor: 'shadow-blue-400/30'
    };
  },

  // 清除排行榜缓存
  clearLeaderboardCache(monthString = null) {
    console.log('清除排行榜缓存:', monthString);
    
    if (monthString) {
      const cacheKey = `stable_leaderboard_${monthString}`;
      dataCache.cache.delete(cacheKey);
      dataCache.cacheExpiry.delete(cacheKey);
    } else {
      // 清除所有排行榜缓存
      for (const key of dataCache.cache.keys()) {
        if (key.startsWith('stable_leaderboard_')) {
          dataCache.cache.delete(key);
          dataCache.cacheExpiry.delete(key);
        }
      }
    }
  },

  // 强制刷新排行榜数据
  async forceRefreshLeaderboard(monthString) {
    console.log('强制刷新排行榜数据:', monthString);
    
    // 清除相关缓存
    this.clearLeaderboardCache(monthString);
    stableCommissionService.forceRefresh(null, monthString);
    
    // 重新获取数据
    return await this.getStableRankings(monthString);
  }
};

// 防抖的数据刷新函数
export const debouncedRefresh = debounce(async (callback) => {
  try {
    await callback();
  } catch (error) {
    console.error('防抖刷新失败:', error);
  }
}, 1000); // 1秒防抖

// 导出主要服务
export { stableCommissionService as commissionService };
export default stableCommissionService;