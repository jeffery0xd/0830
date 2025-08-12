Deno.serve(async (req) => {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE, PATCH',
        'Access-Control-Max-Age': '86400',
        'Access-Control-Allow-Credentials': 'false'
    };

    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 200, headers: corsHeaders });
    }

    try {
        const { date, advertiser } = await req.json();

        if (!date) {
            throw new Error('date参数是必需的');
        }

        // 获取环境变量
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const supabaseUrl = Deno.env.get('SUPABASE_URL');

        if (!serviceRoleKey || !supabaseUrl) {
            throw new Error('Supabase 配置缺失');
        }

        // 构建查询条件 - 使用真实数据表
        let queryUrl = `${supabaseUrl}/rest/v1/app_e87b41cfe355428b8146f8bae8184e10_ad_data_entries?date=eq.${date}`;
        if (advertiser) {
            queryUrl += `&staff=eq.${encodeURIComponent(advertiser)}`;
        }
        // 只查询三位员工的数据（注意字段名是staff不是advertiser）
        queryUrl += `&staff=in.(乔,白,妹)`;

        // 获取广告数据
        const adDataResponse = await fetch(queryUrl, {
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json'
            }
        });

        if (!adDataResponse.ok) {
            const errorText = await adDataResponse.text();
            throw new Error(`获取广告数据失败: ${errorText}`);
        }

        const adData = await adDataResponse.json();
        console.log('获取到真实广告数据:', adData.length, '条');
        console.log('原始数据示例:', adData.length > 0 ? adData[0] : '无数据');

        // 按投放人员分组统计数据
        const groupedData = {};
        
        adData.forEach(record => {
            const advertiserName = record.staff; // 使用staff字段
            if (!groupedData[advertiserName]) {
                groupedData[advertiserName] = {
                    advertiser: advertiserName,
                    date: date,
                    totalSpend: 0,
                    totalRevenue: 0,
                    totalOrders: 0
                };
            }
            
            // 使用正确的字段名和汇率转换
            groupedData[advertiserName].totalSpend += parseFloat(record.ad_spend || 0); // USD
            
            // 将MX$转换为USD进行ROI计算
            const exchangeRate = 20.0; // 1 USD = 20 MX$
            const creditCardUSD = parseFloat(record.credit_card_amount || 0) / exchangeRate;
            groupedData[advertiserName].totalRevenue += creditCardUSD; // USD
            
            groupedData[advertiserName].totalOrders += parseInt(record.credit_card_orders || 0);
        });

        console.log('分组数据:', groupedData);

        // 计算每个投放人员的提成
        const commissionRecords = [];
        
        for (const [advertiserName, data] of Object.entries(groupedData)) {
            // 计算 ROI
            const roi = data.totalSpend > 0 ? data.totalRevenue / data.totalSpend : 0;
            
            // 根据 ROI 确定每单提成金额
            let commissionPerOrder = 0;
            let commissionStatus = 'calculated';
            
            // 使用更精确的浮点数比较
            const roiRounded = Math.round(roi * 10000) / 10000;
            
            if (roiRounded >= 1.0) {
                commissionPerOrder = 7; // 7元 RMB
            } else if (roiRounded >= 0.8) {
                commissionPerOrder = 5; // 5元 RMB
            } else {
                commissionPerOrder = 0; // 0元
                commissionStatus = 'no_commission'; // 跑了个锤子
            }
            
            // 计算总提成
            const totalCommission = data.totalOrders * commissionPerOrder;
            
            const commissionRecord = {
                advertiser: advertiserName,
                date: date,
                order_count: data.totalOrders,
                roi: Math.round(roi * 10000) / 10000, // 保留4位小数
                commission_per_order: commissionPerOrder,
                total_commission: totalCommission,
                commission_status: commissionStatus,
                calculated_at: new Date().toISOString(),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            
            commissionRecords.push(commissionRecord);
        }

        console.log('计算的提成记录:', commissionRecords);

        // 删除已存在的记录（如果有的话）
        let deleteQuery = `${supabaseUrl}/rest/v1/app_5c098b55fc88465db9b331c43b51ef43_commission_records?date=eq.${date}`;
        if (advertiser) {
            deleteQuery += `&advertiser=eq.${encodeURIComponent(advertiser)}`;
        }
        // 只删除三位员工的记录
        deleteQuery += `&advertiser=in.(乔,白,妹)`;

        const deleteResponse = await fetch(deleteQuery, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey
            }
        });

        // 插入新的提成记录
        if (commissionRecords.length > 0) {
            const insertResponse = await fetch(`${supabaseUrl}/rest/v1/app_5c098b55fc88465db9b331c43b51ef43_commission_records`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify(commissionRecords)
            });

            if (!insertResponse.ok) {
                const errorText = await insertResponse.text();
                throw new Error(`插入提成记录失败: ${errorText}`);
            }

            const insertedRecords = await insertResponse.json();
            console.log('插入成功的提成记录:', insertedRecords.length, '条');
        }

        return new Response(JSON.stringify({
            data: {
                success: true,
                date: date,
                recordsCalculated: commissionRecords.length,
                commissionRecords: commissionRecords
            }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('提成计算错误:', error);

        const errorResponse = {
            error: {
                code: 'COMMISSION_CALCULATION_FAILED',
                message: error.message
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
