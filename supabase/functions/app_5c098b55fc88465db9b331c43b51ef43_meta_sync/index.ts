import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID();
  console.log(`[${requestId}] Request: ${req.method} ${req.url}`);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'sync';

    if (req.method === 'GET' && action === 'config') {
      // Get current Meta API configuration
      const { data: config, error } = await supabase
        .from('app_5c098b55fc88465db9b331c43b51ef43_meta_config')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return new Response(JSON.stringify({ 
        success: true, 
        config: config || null,
        requestId 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (req.method === 'POST' && action === 'config') {
      // Save Meta API configuration
      let body;
      try {
        body = await req.json();
      } catch (e) {
        console.log(`[${requestId}] Invalid JSON body:`, e);
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Invalid JSON body',
          requestId 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { app_id, access_token, ad_account_id } = body;

      if (!access_token || !ad_account_id) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'access_token and ad_account_id are required',
          requestId 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Test the API credentials first
      try {
        const testUrl = `https://graph.facebook.com/v18.0/act_${ad_account_id}?fields=name,account_status&access_token=${access_token}`;
        const testResponse = await fetch(testUrl);
        const testData = await testResponse.json();

        if (testData.error) {
          console.log(`[${requestId}] Meta API test failed:`, testData.error);
          return new Response(JSON.stringify({ 
            success: false, 
            error: `Meta API Error: ${testData.error.message}`,
            requestId 
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      } catch (error) {
        console.log(`[${requestId}] Meta API connection test failed:`, error);
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Failed to connect to Meta API',
          requestId 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Save configuration
      const { data, error } = await supabase
        .from('app_5c098b55fc88465db9b331c43b51ef43_meta_config')
        .upsert({
          app_id,
          access_token,
          ad_account_id,
          sync_status: 'active',
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' })
        .select()
        .single();

      if (error) {
        console.log(`[${requestId}] Database error:`, error);
        throw error;
      }

      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Meta API configuration saved successfully',
        data,
        requestId 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (req.method === 'POST' && action === 'sync') {
      // Sync Meta ads data
      console.log(`[${requestId}] Starting Meta ads data sync`);

      // Get current configuration
      const { data: config, error: configError } = await supabase
        .from('app_5c098b55fc88465db9b331c43b51ef43_meta_config')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (configError || !config) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Meta API not configured',
          requestId 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { access_token, ad_account_id } = config;
      
      // Get date range (last 30 days)
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      
      const dateStart = startDate.toISOString().split('T')[0];
      const dateEnd = endDate.toISOString().split('T')[0];

      try {
        // Fetch insights from Meta API
        const insightsUrl = `https://graph.facebook.com/v18.0/act_${ad_account_id}/insights?fields=campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,spend,impressions,clicks,reach,cpm,cpc,ctr,frequency&time_range={'since':'${dateStart}','until':'${dateEnd}'}&level=ad&access_token=${access_token}`;
        
        console.log(`[${requestId}] Fetching insights from Meta API`);
        const response = await fetch(insightsUrl);
        const result = await response.json();

        if (result.error) {
          console.log(`[${requestId}] Meta API error:`, result.error);
          throw new Error(`Meta API Error: ${result.error.message}`);
        }

        const insights = result.data || [];
        console.log(`[${requestId}] Retrieved ${insights.length} ad insights`);

        // Transform and save data
        const adsData = insights.map(insight => ({
          account_id: ad_account_id,
          campaign_id: insight.campaign_id,
          campaign_name: insight.campaign_name,
          adset_id: insight.adset_id,
          adset_name: insight.adset_name,
          ad_id: insight.ad_id,
          ad_name: insight.ad_name,
          date_start: dateStart,
          date_stop: dateEnd,
          spend: parseFloat(insight.spend || 0),
          impressions: parseInt(insight.impressions || 0),
          clicks: parseInt(insight.clicks || 0),
          reach: parseInt(insight.reach || 0),
          cpm: parseFloat(insight.cpm || 0),
          cpc: parseFloat(insight.cpc || 0),
          ctr: parseFloat(insight.ctr || 0),
          frequency: parseFloat(insight.frequency || 0)
        }));

        if (adsData.length > 0) {
          // Clear old data for this date range
          await supabase
            .from('app_5c098b55fc88465db9b331c43b51ef43_meta_ads')
            .delete()
            .gte('date_start', dateStart)
            .lte('date_stop', dateEnd);

          // Insert new data
          const { error: insertError } = await supabase
            .from('app_5c098b55fc88465db9b331c43b51ef43_meta_ads')
            .insert(adsData);

          if (insertError) {
            console.log(`[${requestId}] Insert error:`, insertError);
            throw insertError;
          }
        }

        // Update sync status
        await supabase
          .from('app_5c098b55fc88465db9b331c43b51ef43_meta_config')
          .update({
            last_sync_at: new Date().toISOString(),
            sync_status: 'active'
          })
          .eq('id', config.id);

        console.log(`[${requestId}] Sync completed successfully`);

        return new Response(JSON.stringify({ 
          success: true, 
          message: `Synced ${adsData.length} ad records`,
          data: {
            recordCount: adsData.length,
            dateRange: { start: dateStart, end: dateEnd }
          },
          requestId 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      } catch (error) {
        console.log(`[${requestId}] Sync error:`, error);
        
        // Update sync status to error
        await supabase
          .from('app_5c098b55fc88465db9b331c43b51ef43_meta_config')
          .update({
            sync_status: 'error'
          })
          .eq('id', config.id);

        return new Response(JSON.stringify({ 
          success: false, 
          error: error.message,
          requestId 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Invalid action',
      requestId 
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error(`[${requestId}] Function error:`, error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message,
      requestId 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});