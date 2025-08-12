import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  // Generate unique request ID for logging
  const requestId = crypto.randomUUID();
  console.log(`[${requestId}] Request received:`, {
    method: req.method,
    url: req.url,
    headers: Object.fromEntries(req.headers.entries())
  });

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      }
    });
  }

  if (req.method !== 'POST') {
    console.log(`[${requestId}] Method not allowed: ${req.method}`);
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  try {
    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    console.log(`[${requestId}] Supabase client initialized`);

    // Parse request body
    let orderData;
    try {
      orderData = await req.json();
      console.log(`[${requestId}] Order data received:`, orderData);
    } catch (error) {
      console.log(`[${requestId}] Invalid JSON:`, error);
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // Validate required fields
    if (!orderData.order_id || !orderData.site_type || !orderData.amount) {
      console.log(`[${requestId}] Missing required fields:`, orderData);
      return new Response(JSON.stringify({ 
        error: 'Missing required fields: order_id, site_type, amount' 
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // Validate site_type
    const validSiteTypes = ['mercado', 'merca02', 'uoostore'];
    if (!validSiteTypes.includes(orderData.site_type)) {
      console.log(`[${requestId}] Invalid site_type:`, orderData.site_type);
      return new Response(JSON.stringify({ 
        error: `Invalid site_type. Must be one of: ${validSiteTypes.join(', ')}` 
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // Calculate current reset date based on Beijing time (UTC+8) at 4 PM
    const now = new Date();
    const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const resetHour = 16; // 4 PM
    let resetDate = new Date(beijingTime);
    if (beijingTime.getHours() < resetHour) {
      resetDate.setDate(resetDate.getDate() - 1);
    }
    const dailyResetTime = resetDate.toISOString().split('T')[0];

    console.log(`[${requestId}] Reset date calculated:`, dailyResetTime);

    // Prepare order data for database
    const dbOrderData = {
      order_id: orderData.order_id,
      site_type: orderData.site_type,
      amount: parseFloat(orderData.amount),
      currency: orderData.currency || 'MX$',
      order_time: orderData.order_time || new Date().toISOString(),
      customer_info: orderData.customer_info || {},
      daily_reset_time: dailyResetTime
    };

    console.log(`[${requestId}] Inserting order data:`, dbOrderData);

    // Insert order into database
    const { data, error } = await supabase
      .from('app_5c098b55fc88465db9b331c43b51ef43_live_orders')
      .insert([dbOrderData])
      .select();

    if (error) {
      console.error(`[${requestId}] Database error:`, error);
      return new Response(JSON.stringify({ 
        error: 'Database insertion failed',
        details: error.message 
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    console.log(`[${requestId}] Order inserted successfully:`, data);

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Order received and stored',
      order: data[0],
      request_id: requestId
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    console.error(`[${requestId}] Unexpected error:`, error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      request_id: requestId 
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
});