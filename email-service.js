// Email service for sending weekly analytics reports
import nodemailer from 'nodemailer';

// Gmail configuration using App Password
// User will need to generate an App Password from Google Account settings
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

/**
 * Send weekly analytics email
 */
export async function sendWeeklyReport(stats) {
  const { startDate, endDate, totalSubscribers, newSubscriptions, uniqueVisitors, totalPageViews, avgViewsPerVisitor, dailyBreakdown } = stats;

  // Format dates
  const startFormatted = new Date(startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const endFormatted = new Date(endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const nextMonday = new Date(endDate);
  nextMonday.setDate(nextMonday.getDate() + 7);
  const nextMondayFormatted = nextMonday.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

  // Calculate percentage change (if we have historical data)
  const newSubsPercent = totalSubscribers > 0 ? Math.round((newSubscriptions / totalSubscribers) * 100) : 0;

  // Build daily breakdown table
  let dailyTable = '';
  if (dailyBreakdown && dailyBreakdown.length > 0) {
    dailyTable = dailyBreakdown.map(day => {
      const dateFormatted = new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      return `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${dateFormatted}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${day.uniqueVisitors}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${day.pageViews}</td>
        </tr>
      `;
    }).join('');
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">

      <!-- Header -->
      <div style="background: linear-gradient(135deg, #4a90e2 0%, #357abd 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center;">
        <h1 style="margin: 0; font-size: 24px;">📊 Local Weather Labs</h1>
        <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Weekly Analytics Report</p>
      </div>

      <!-- Date Range -->
      <div style="background: #f8f9fa; padding: 15px; border-left: 4px solid #4a90e2; margin: 20px 0;">
        <strong>📅 Reporting Period:</strong> ${startFormatted} – ${endFormatted}
      </div>

      <!-- Key Metrics -->
      <div style="background: white; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; margin-bottom: 20px;">
        <h2 style="margin-top: 0; color: #4a90e2; font-size: 18px; border-bottom: 2px solid #4a90e2; padding-bottom: 10px;">📧 Subscriber Metrics</h2>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 15px;">
          <div style="background: #f0f7ff; padding: 15px; border-radius: 6px; text-align: center;">
            <div style="font-size: 32px; font-weight: bold; color: #4a90e2;">${totalSubscribers}</div>
            <div style="color: #666; font-size: 14px; margin-top: 5px;">Total Active Subscribers</div>
          </div>

          <div style="background: #e8f5e9; padding: 15px; border-radius: 6px; text-align: center;">
            <div style="font-size: 32px; font-weight: bold; color: #2e7d32;">${newSubscriptions}</div>
            <div style="color: #666; font-size: 14px; margin-top: 5px;">New This Week</div>
            ${newSubsPercent > 0 ? `<div style="color: #2e7d32; font-size: 12px; margin-top: 3px;">+${newSubsPercent}%</div>` : ''}
          </div>
        </div>
      </div>

      <!-- Traffic Metrics -->
      <div style="background: white; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; margin-bottom: 20px;">
        <h2 style="margin-top: 0; color: #4a90e2; font-size: 18px; border-bottom: 2px solid #4a90e2; padding-bottom: 10px;">👥 Website Traffic</h2>

        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-top: 15px;">
          <div style="background: #fff3e0; padding: 15px; border-radius: 6px; text-align: center;">
            <div style="font-size: 32px; font-weight: bold; color: #e65100;">${uniqueVisitors}</div>
            <div style="color: #666; font-size: 14px; margin-top: 5px;">Unique Visitors</div>
          </div>

          <div style="background: #f3e5f5; padding: 15px; border-radius: 6px; text-align: center;">
            <div style="font-size: 32px; font-weight: bold; color: #6a1b9a;">${totalPageViews}</div>
            <div style="color: #666; font-size: 14px; margin-top: 5px;">Total Page Views</div>
          </div>

          <div style="background: #e0f2f1; padding: 15px; border-radius: 6px; text-align: center;">
            <div style="font-size: 32px; font-weight: bold; color: #00695c;">${avgViewsPerVisitor}</div>
            <div style="color: #666; font-size: 14px; margin-top: 5px;">Avg Views/Visitor</div>
          </div>
        </div>
      </div>

      ${dailyBreakdown && dailyBreakdown.length > 0 ? `
      <!-- Daily Breakdown -->
      <div style="background: white; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; margin-bottom: 20px;">
        <h2 style="margin-top: 0; color: #4a90e2; font-size: 18px; border-bottom: 2px solid #4a90e2; padding-bottom: 10px;">📈 Daily Breakdown</h2>

        <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
          <thead>
            <tr style="background: #f8f9fa;">
              <th style="padding: 10px; text-align: left; border-bottom: 2px solid #4a90e2;">Date</th>
              <th style="padding: 10px; text-align: center; border-bottom: 2px solid #4a90e2;">Visitors</th>
              <th style="padding: 10px; text-align: center; border-bottom: 2px solid #4a90e2;">Page Views</th>
            </tr>
          </thead>
          <tbody>
            ${dailyTable}
          </tbody>
        </table>
      </div>
      ` : ''}

      <!-- Footer -->
      <div style="background: #f8f9fa; padding: 20px; border-radius: 0 0 8px 8px; text-align: center; color: #666; font-size: 14px;">
        <p style="margin: 0;">Next report: <strong>${nextMondayFormatted} at 7:00 AM CST</strong></p>
        <p style="margin: 10px 0 0 0; font-size: 12px; color: #999;">Generated by Local Weather Labs Analytics System</p>
      </div>

    </body>
    </html>
  `;

  const textContent = `
LOCAL WEATHER LABS - WEEKLY REPORT
Week of ${startFormatted} - ${endFormatted}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📧 SUBSCRIBERS
   Total Active: ${totalSubscribers} subscribers
   New This Week: ${newSubscriptions} ${newSubsPercent > 0 ? `(+${newSubsPercent}%)` : ''}

👥 WEBSITE TRAFFIC
   Unique Visitors: ${uniqueVisitors} people
   Total Page Views: ${totalPageViews} views
   Avg Views/Visitor: ${avgViewsPerVisitor} pages

📅 REPORTING PERIOD
   ${startFormatted} - ${endFormatted}
   Next report: ${nextMondayFormatted} at 7:00 AM CST

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Generated by Local Weather Labs Analytics
  `;

  const mailOptions = {
    from: {
      name: 'Local Weather Labs Analytics',
      address: process.env.EMAIL_USER
    },
    to: 'localweatherlab@gmail.com',
    subject: `📊 Local Weather Labs - Weekly Report (${startFormatted} - ${endFormatted})`,
    text: textContent,
    html: htmlContent
  };

  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      console.warn('[email-service] Email credentials not configured - skipping email');
      console.log('[email-service] Stats summary:', stats);
      return false;
    }

    const info = await transporter.sendMail(mailOptions);
    console.log('[email-service] Weekly report sent successfully:', info.messageId);
    return true;
  } catch (err) {
    console.error('[email-service] Failed to send weekly report:', err.message);
    return false;
  }
}

/**
 * Test email configuration
 */
export async function sendTestEmail() {
  const mailOptions = {
    from: {
      name: 'Local Weather Labs Analytics',
      address: process.env.EMAIL_USER
    },
    to: 'localweatherlab@gmail.com',
    subject: '✅ Email Configuration Test - Local Weather Labs',
    text: 'Your weekly analytics email system is configured correctly! You will receive reports every Monday at 7:00 AM CST.',
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
        <h2 style="color: #4a90e2;">✅ Email Configuration Successful!</h2>
        <p>Your weekly analytics email system is configured correctly.</p>
        <p><strong>You will receive reports every Monday at 7:00 AM CST with:</strong></p>
        <ul>
          <li>Total active subscribers</li>
          <li>New subscriptions this week</li>
          <li>Unique visitors</li>
          <li>Total page views</li>
          <li>Daily breakdown</li>
        </ul>
        <p style="color: #666; font-size: 14px; margin-top: 30px;">- Local Weather Labs Analytics System</p>
      </div>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('[email-service] Test email sent successfully:', info.messageId);
    return true;
  } catch (err) {
    console.error('[email-service] Failed to send test email:', err.message);
    return false;
  }
}
