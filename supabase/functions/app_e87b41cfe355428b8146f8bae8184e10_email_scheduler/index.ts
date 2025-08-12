import { createClient } from 'npm:@supabase/supabase-js@2';
import nodemailer from 'npm:nodemailer';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// 五名人员邮箱列表
const TEAM_EMAILS = [
  'qing@company.com',
  'qiao@company.com', 
  'bai@company.com',
  'ding@company.com',
  'mei@company.com'
];

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID();
  console.log(`[${requestId}] Email scheduler request:`, req.method, req.url);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      }
    });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'daily_reminder';

    // 配置邮件传输器
    const transporter = nodemailer.createTransporter({
      host: Deno.env.get('SMTP_HOST') || 'smtp.163.com',
      port: parseInt(Deno.env.get('SMTP_PORT') || '465'),
      secure: Deno.env.get('SMTP_SECURE') !== 'false',
      auth: {
        user: Deno.env.get('SMTP_USER'),
        pass: Deno.env.get('SMTP_PASSWORD')
      }
    });

    console.log(`[${requestId}] Processing action: ${action}`);

    if (action === 'daily_reminder') {
      // 每日数据填写提醒
      const subject = '📊 每日数据填写提醒 - 账户管理系统';
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">📊 每日数据填写提醒</h2>
          <p>亲爱的团队成员，</p>
          <p>这是您的每日数据填写提醒（北京时间下午4点）。</p>
          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">需要填写的数据：</h3>
            <ul>
              <li>广告账户数据统计</li>
              <li>充值记录更新</li>
              <li>账户申请处理</li>
              <li>其他相关业务数据</li>
            </ul>
          </div>
          <p>请及时登录系统完成数据填写：</p>
          <p><a href="http://localhost:5176" style="background: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">立即访问系统</a></p>
          <p style="margin-top: 30px; color: #6b7280; font-size: 14px;">
            此邮件为系统自动发送，请勿回复。<br>
            发送时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}
          </p>
        </div>
      `;

      await sendEmailToTeam(transporter, subject, html, requestId);
      
      return new Response(JSON.stringify({ 
        success: true, 
        message: '每日提醒邮件发送成功',
        sent_to: TEAM_EMAILS.length
      }), {
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });

    } else if (action === 'request_notification') {
      // 账户申请阶段通知
      let body = {};
      try {
        if (req.method === 'POST') {
          body = await req.json();
        }
      } catch (error) {
        console.error(`[${requestId}] Error parsing request body:`, error);
        return new Response(JSON.stringify({ error: 'Invalid request body' }), {
          status: 400,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }

      const { stage, requester, reason, requestId: reqId } = body;
      
      let subject = '';
      let html = '';
      
      switch (stage) {
        case 'new_request':
          subject = `🆕 新账户申请 - ${requester}`;
          html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #059669;">🆕 新账户申请提醒</h2>
              <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 20px; border-radius: 8px;">
                <p><strong>申请人：</strong> ${requester}</p>
                <p><strong>申请原因：</strong> ${reason}</p>
                <p><strong>申请时间：</strong> ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</p>
              </div>
              <p>请管理员及时处理此申请。</p>
              <p><a href="http://localhost:5176" style="background: #059669; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">查看申请详情</a></p>
            </div>
          `;
          break;
          
        case 'approved':
          subject = `✅ 账户申请已批准 - ${requester}`;
          html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #059669;">✅ 账户申请已批准</h2>
              <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 20px; border-radius: 8px;">
                <p><strong>申请人：</strong> ${requester}</p>
                <p><strong>处理时间：</strong> ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</p>
                <p><strong>状态：</strong> 已批准，等待分配账户信息</p>
              </div>
              <p>申请已通过审核，请尽快为用户分配账户信息。</p>
              <p><a href="http://localhost:5176" style="background: #059669; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">查看详情</a></p>
            </div>
          `;
          break;
          
        case 'rejected':
          subject = `❌ 账户申请被拒绝 - ${requester}`;
          html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #dc2626;">❌ 账户申请被拒绝</h2>
              <div style="background: #fef2f2; border: 1px solid #fecaca; padding: 20px; border-radius: 8px;">
                <p><strong>申请人：</strong> ${requester}</p>
                <p><strong>处理时间：</strong> ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</p>
                <p><strong>状态：</strong> 申请被拒绝</p>
              </div>
              <p>如有疑问，请联系申请人了解详情。</p>
            </div>
          `;
          break;
          
        case 'account_assigned':
          subject = `🎯 账户信息已分配 - ${requester}`;
          html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #7c3aed;">🎯 账户信息已分配</h2>
              <div style="background: #faf5ff; border: 1px solid #e9d5ff; padding: 20px; border-radius: 8px;">
                <p><strong>申请人：</strong> ${requester}</p>
                <p><strong>完成时间：</strong> ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</p>
                <p><strong>状态：</strong> 账户信息已成功分配</p>
              </div>
              <p>用户现在可以开始使用分配的账户了。</p>
            </div>
          `;
          break;

        case 'reset_requested':
          subject = `🔄 账户清零申请 - ${requester}`;
          html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #ea580c;">🔄 账户清零申请</h2>
              <div style="background: #fff7ed; border: 1px solid #fed7aa; padding: 20px; border-radius: 8px;">
                <p><strong>申请人：</strong> ${requester}</p>
                <p><strong>申请时间：</strong> ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</p>
                <p><strong>类型：</strong> Facebook广告账户清零</p>
              </div>
              <p>请管理员及时处理清零申请。</p>
              <p><a href="http://localhost:5176" style="background: #ea580c; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">处理申请</a></p>
            </div>
          `;
          break;
          
        default:
          throw new Error(`未知的通知阶段: ${stage}`);
      }

      await sendEmailToTeam(transporter, subject, html, requestId);
      
      return new Response(JSON.stringify({ 
        success: true, 
        message: `${stage} 通知邮件发送成功`,
        sent_to: TEAM_EMAILS.length
      }), {
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    return new Response(JSON.stringify({ error: '无效的操作类型' }), {
      status: 400,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    console.error(`[${requestId}] Error:`, error);
    return new Response(JSON.stringify({ 
      error: '邮件发送失败', 
      details: error.message 
    }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
});

async function sendEmailToTeam(transporter, subject, html, requestId) {
  console.log(`[${requestId}] Sending emails to team:`, TEAM_EMAILS);
  
  const emailPromises = TEAM_EMAILS.map(email => 
    transporter.sendMail({
      from: Deno.env.get('SMTP_FROM') || Deno.env.get('SMTP_USER'),
      to: email,
      subject: subject,
      html: html
    }).catch(error => {
      console.error(`[${requestId}] Failed to send email to ${email}:`, error);
      return { error: error.message, email };
    })
  );

  const results = await Promise.all(emailPromises);
  console.log(`[${requestId}] Email sending results:`, results);
  
  return results;
}