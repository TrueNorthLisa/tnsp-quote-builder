const { Resend } = require('resend');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  try {
    const { quote, submission } = JSON.parse(event.body);
    const resend = new Resend(process.env.RESEND_API_KEY);

    // Build quote email HTML
    const placementsHtml = (quote.placements || []).map(p => `
      <tr>
        <td style="padding:10px 16px;border-bottom:1px solid #2a2a2a;color:#d4d0c8;">${p.placement}</td>
        <td style="padding:10px 16px;border-bottom:1px solid #2a2a2a;color:#d4d0c8;">${p.type}</td>
        <td style="padding:10px 16px;border-bottom:1px solid #2a2a2a;color:#d4d0c8;">${p.detail || '—'}</td>
        <td style="padding:10px 16px;border-bottom:1px solid #2a2a2a;color:#e8c547;text-align:right;">$${p.price?.toFixed(2) || '—'}</td>
      </tr>`).join('');

    const acceptUrl = `${process.env.URL || 'https://tnspquote.netlify.app'}/accept?id=${quote.id}&token=${quote.accept_token}`;
    const changesUrl = `${process.env.URL || 'https://tnspquote.netlify.app'}/changes?id=${quote.id}&token=${quote.accept_token}`;

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0d0d0d;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0d0d;padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <!-- Header -->
  <tr><td style="background:#0d0d0d;padding:0 0 32px 0;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:28px;font-weight:900;letter-spacing:6px;color:#f0ede8;">TRUE <span style="color:#c8392b;">NORTH</span></td>
        <td align="right" style="font-size:11px;letter-spacing:2px;color:#555;text-transform:uppercase;">Quote #${quote.quote_num}</td>
      </tr>
    </table>
    <div style="height:3px;background:#c8392b;margin-top:16px;"></div>
  </td></tr>

  <!-- Greeting -->
  <tr><td style="background:#141414;border:1px solid #ffffff15;border-radius:6px;padding:32px;margin-bottom:20px;">
    <p style="font-size:22px;font-weight:700;color:#f0ede8;margin:0 0 8px 0;">Hi ${submission.customer_name?.split(' ')[0] || 'there'},</p>
    <p style="font-size:15px;color:#888;line-height:1.6;margin:0 0 24px 0;">Thanks for reaching out to True North! Here's your custom quote. Review the details below and let us know if you'd like to move forward or make any changes.</p>

    <!-- Order summary -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        <td style="padding:8px 0;font-size:11px;letter-spacing:2px;color:#555;text-transform:uppercase;border-bottom:1px solid #2a2a2a;">Garment</td>
        <td style="padding:8px 0;font-size:14px;color:#d4d0c8;text-align:right;border-bottom:1px solid #2a2a2a;">${quote.garment_brand || ''} ${quote.garment_style || ''} — ${quote.garment_colour || ''}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;font-size:11px;letter-spacing:2px;color:#555;text-transform:uppercase;border-bottom:1px solid #2a2a2a;">Quantity</td>
        <td style="padding:8px 0;font-size:14px;color:#d4d0c8;text-align:right;border-bottom:1px solid #2a2a2a;">${quote.quantity} units</td>
      </tr>
      <tr>
        <td style="padding:8px 0;font-size:11px;letter-spacing:2px;color:#555;text-transform:uppercase;border-bottom:1px solid #2a2a2a;">Decoration</td>
        <td style="padding:8px 0;font-size:14px;color:#d4d0c8;text-align:right;border-bottom:1px solid #2a2a2a;">${(quote.decoration_types || []).join(', ')}</td>
      </tr>
      ${quote.in_hand_date ? `<tr><td style="padding:8px 0;font-size:11px;letter-spacing:2px;color:#555;text-transform:uppercase;">In-Hands Date</td><td style="padding:8px 0;font-size:14px;color:#d4d0c8;text-align:right;">${quote.in_hand_date}</td></tr>` : ''}
    </table>

    <!-- Placements table -->
    ${placementsHtml ? `
    <p style="font-size:11px;letter-spacing:2px;color:#555;text-transform:uppercase;margin:0 0 12px 0;">Placement Breakdown</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #2a2a2a;border-radius:4px;overflow:hidden;margin-bottom:24px;">
      <tr style="background:#1a1a1a;">
        <th style="padding:10px 16px;text-align:left;font-size:11px;letter-spacing:1px;color:#555;text-transform:uppercase;font-weight:500;">Placement</th>
        <th style="padding:10px 16px;text-align:left;font-size:11px;letter-spacing:1px;color:#555;text-transform:uppercase;font-weight:500;">Type</th>
        <th style="padding:10px 16px;text-align:left;font-size:11px;letter-spacing:1px;color:#555;text-transform:uppercase;font-weight:500;">Detail</th>
        <th style="padding:10px 16px;text-align:right;font-size:11px;letter-spacing:1px;color:#555;text-transform:uppercase;font-weight:500;">Price/unit</th>
      </tr>
      ${placementsHtml}
    </table>` : ''}

    <!-- Totals -->
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #2a2a2a;border-radius:4px;overflow:hidden;margin-bottom:24px;">
      <tr style="background:#1a1a1a;">
        <td style="padding:12px 16px;font-size:13px;color:#888;">Garment Cost</td>
        <td style="padding:12px 16px;font-size:13px;color:#d4d0c8;text-align:right;">$${((quote.blank_cost || 0) * (quote.quantity || 0)).toFixed(2)}</td>
      </tr>
      <tr>
        <td style="padding:12px 16px;font-size:13px;color:#888;border-top:1px solid #2a2a2a;">Decoration Cost</td>
        <td style="padding:12px 16px;font-size:13px;color:#d4d0c8;text-align:right;border-top:1px solid #2a2a2a;">$${(quote.decoration_cost || 0).toFixed(2)}</td>
      </tr>
      ${quote.setup_fee ? `<tr><td style="padding:12px 16px;font-size:13px;color:#888;border-top:1px solid #2a2a2a;">Setup / Screens</td><td style="padding:12px 16px;font-size:13px;color:#d4d0c8;text-align:right;border-top:1px solid #2a2a2a;">$${quote.setup_fee.toFixed(2)}</td></tr>` : ''}
      ${quote.rush_fee ? `<tr><td style="padding:12px 16px;font-size:13px;color:#ff9f43;border-top:1px solid #2a2a2a;">Rush Fee</td><td style="padding:12px 16px;font-size:13px;color:#ff9f43;text-align:right;border-top:1px solid #2a2a2a;">$${quote.rush_fee.toFixed(2)}</td></tr>` : ''}
      <tr style="background:#1a1a1a;">
        <td style="padding:16px;font-size:16px;font-weight:700;color:#f0ede8;border-top:2px solid #c8392b;">TOTAL (before tax)</td>
        <td style="padding:16px;font-size:20px;font-weight:700;color:#e8c547;text-align:right;border-top:2px solid #c8392b;">$${(quote.total || 0).toFixed(2)} CAD</td>
      </tr>
      <tr>
        <td style="padding:8px 16px;font-size:12px;color:#555;border-top:1px solid #2a2a2a;">Per unit</td>
        <td style="padding:8px 16px;font-size:14px;color:#888;text-align:right;border-top:1px solid #2a2a2a;">$${quote.quantity ? ((quote.total || 0) / quote.quantity).toFixed(2) : '—'}/unit</td>
      </tr>
    </table>

    ${quote.notes ? `<div style="background:#1a1a1a;border-left:3px solid #e8c547;padding:14px 16px;border-radius:0 4px 4px 0;margin-bottom:24px;"><p style="font-size:11px;letter-spacing:2px;color:#e8c547;text-transform:uppercase;margin:0 0 6px 0;">Notes from our team</p><p style="font-size:14px;color:#888;line-height:1.6;margin:0;">${quote.notes}</p></div>` : ''}

    <!-- Payment options -->
    <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:6px;padding:20px;margin-bottom:24px;">
      <p style="font-size:11px;letter-spacing:2px;color:#555;text-transform:uppercase;margin:0 0 14px 0;">Payment Options</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #2a2a2a;">
            <span style="font-size:13px;color:#d4d0c8;font-weight:600;">E-Transfer</span>
            <p style="font-size:12px;color:#666;margin:4px 0 0 0;">Send to: sales@truenorthscreenprinting.ca · Include your name + order details</p>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #2a2a2a;">
            <span style="font-size:13px;color:#d4d0c8;font-weight:600;">EFT / Bank Transfer</span>
            <p style="font-size:12px;color:#666;margin:4px 0 0 0;">Contact us for banking details: sales@truenorthscreenprinting.ca</p>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 0;">
            <span style="font-size:13px;color:#d4d0c8;font-weight:600;">QuickBooks Payment Link</span>
            <span style="font-size:11px;color:#ff9f43;margin-left:8px;">+3% processing fee applies</span>
            <p style="font-size:12px;color:#666;margin:4px 0 0 0;">Credit card / online payment — link provided upon acceptance</p>
          </td>
        </tr>
      </table>
    </div>

    <!-- CTA Buttons -->
    <p style="font-size:13px;color:#666;margin:0 0 16px 0;">A 50% deposit is required to begin production.</p>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding-right:8px;">
          <a href="${acceptUrl}" style="display:block;background:#e8c547;color:#0d0d0d;text-decoration:none;text-align:center;padding:16px;font-size:14px;font-weight:700;letter-spacing:2px;text-transform:uppercase;border-radius:4px;">✓ Accept Quote</a>
        </td>
        <td style="padding-left:8px;">
          <a href="${changesUrl}" style="display:block;background:transparent;color:#d4d0c8;text-decoration:none;text-align:center;padding:16px;font-size:14px;font-weight:600;letter-spacing:1px;border:1px solid #333;border-radius:4px;">Request Changes</a>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- Footer -->
  <tr><td style="padding:24px 0;text-align:center;">
    <p style="font-size:12px;color:#444;margin:0 0 6px 0;">True North Screen Printing Ltd. · Vancouver, BC</p>
    <p style="font-size:12px;color:#444;margin:0;"><a href="mailto:sales@truenorthscreenprinting.ca" style="color:#c8392b;text-decoration:none;">sales@truenorthscreenprinting.ca</a></p>
    <p style="font-size:11px;color:#333;margin:12px 0 0 0;">This quote is valid for 14 days. Prices in CAD, subject to applicable taxes.</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;

    await resend.emails.send({
      from: 'True North Screen Printing <sales@truenorthscreenprinting.ca>',
      to: [submission.customer_email],
      cc: ['lisa@truenorthscreenprinting.ca'],
      subject: `Your Quote from True North — #${quote.quote_num}`,
      html,
    });

    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (err) {
    console.error('send-quote error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
