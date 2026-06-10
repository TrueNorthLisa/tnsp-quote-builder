const { Resend } = require('resend');

const DECOR_LABELS = {
  'sp': 'Screen Printing', 'Screen Printing': 'Screen Printing',
  'emb': 'Embroidery', 'Embroidery': 'Embroidery',
  'dtf': 'DTF Transfer', 'DTF Transfer': 'DTF Transfer',
  'vinyl': 'Vinyl Heat Press', 'Vinyl Heat Press': 'Vinyl Heat Press',
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  try {
    const { quote, submission } = JSON.parse(event.body);
    const resend = new Resend(process.env.RESEND_API_KEY);

    const baseUrl = 'https://tnspquote.netlify.app';
    const acceptUrl = `${baseUrl}/accept?id=${quote.id}&token=${quote.accept_token}`;
    const changesUrl = `${baseUrl}/changes?id=${quote.id}&token=${quote.accept_token}`;

    const decorLabel = (quote.decoration_types || []).map(d => DECOR_LABELS[d] || d).join(', ');
    const perUnit = quote.quantity ? (quote.total / quote.quantity).toFixed(2) : '—';
    const firstName = submission.customer_name?.split(' ')[0] || 'there';

    // Build placement rows with per-unit price
    const placementsHtml = (quote.placements || []).map(p => {
      const pricePerUnit = quote.quantity ? ((p.price || 0) / quote.quantity) : 0;
      return `
      <tr>
        <td style="padding:10px 14px;border-bottom:1px solid #e8e2d8;font-size:13px;color:#333;">${p.placement}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e8e2d8;font-size:13px;color:#555;">${DECOR_LABELS[p.type] || p.type}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e8e2d8;font-size:13px;color:#555;">${p.detail || '—'}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e8e2d8;font-size:13px;color:#333;text-align:right;">${pricePerUnit > 0 ? '$' + pricePerUnit.toFixed(2) + '/unit' : '—'}</td>
      </tr>`;
    }).join('');

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f2eb;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f2eb;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:6px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

  <!-- Header -->
  <tr><td style="background:#0d0d0d;padding:28px 32px;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td>
          <div style="font-size:26px;font-weight:900;letter-spacing:5px;color:#f5f2eb;line-height:1;">TRUE <span style="color:#c8392b;">NORTH</span></div>
          <div style="font-size:10px;letter-spacing:3px;color:#555;text-transform:uppercase;margin-top:4px;">Screen Printing &amp; Embroidery</div>
        </td>
        <td align="right" valign="top">
          <div style="font-size:11px;color:#555;letter-spacing:1px;line-height:1.7;">
            Vancouver, BC<br>
            604-874-4488<br>
            <a href="mailto:sales@truenorthscreenprinting.ca" style="color:#c8392b;text-decoration:none;">sales@truenorthscreenprinting.ca</a><br>
            truenorthscreenprinting.ca
          </div>
        </td>
      </tr>
    </table>
    <div style="height:3px;background:#c8392b;margin-top:20px;"></div>
  </td></tr>

  <!-- Quote title bar -->
  <tr><td style="background:#1a1a1a;padding:14px 32px;display:flex;justify-content:space-between;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="font-size:11px;letter-spacing:2px;color:#888;text-transform:uppercase;">Custom Quote</td>
        <td align="right" style="font-size:13px;font-weight:700;color:#e8c547;letter-spacing:1px;">#${quote.quote_num}</td>
      </tr>
    </table>
  </td></tr>

  <!-- Body -->
  <tr><td style="padding:32px;">

    <p style="font-size:20px;font-weight:700;color:#0d0d0d;margin:0 0 6px 0;">Hi ${firstName},</p>
    <p style="font-size:14px;color:#666;line-height:1.7;margin:0 0 28px 0;">Thanks for reaching out to True North! We've put together a custom quote based on your request. Review the details below and let us know how you'd like to proceed.</p>

    <!-- Order summary box -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f2eb;border-radius:4px;margin-bottom:24px;">
      <tr><td style="padding:14px 18px 0;">
        <div style="font-size:10px;letter-spacing:2px;color:#c8392b;text-transform:uppercase;font-weight:700;margin-bottom:12px;">Order Summary</div>
      </td></tr>
      <tr><td style="padding:0 18px 14px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:6px 0;font-size:11px;letter-spacing:1px;color:#888;text-transform:uppercase;border-bottom:1px solid #ddd;width:40%;">Garment</td>
            <td style="padding:6px 0;font-size:13px;color:#333;text-align:right;border-bottom:1px solid #ddd;">${quote.garment_brand || ''} ${quote.garment_style || ''} — ${quote.garment_colour || ''}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:11px;letter-spacing:1px;color:#888;text-transform:uppercase;border-bottom:1px solid #ddd;">Quantity</td>
            <td style="padding:6px 0;font-size:13px;color:#333;text-align:right;border-bottom:1px solid #ddd;">${quote.quantity} units</td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:11px;letter-spacing:1px;color:#888;text-transform:uppercase;border-bottom:1px solid #ddd;">Decoration</td>
            <td style="padding:6px 0;font-size:13px;color:#333;text-align:right;border-bottom:1px solid #ddd;">${decorLabel}</td>
          </tr>
          ${quote.in_hand_date ? `<tr><td style="padding:6px 0;font-size:11px;letter-spacing:1px;color:#888;text-transform:uppercase;">In-Hands Date</td><td style="padding:6px 0;font-size:13px;color:#333;text-align:right;">${quote.in_hand_date}</td></tr>` : ''}
        </table>
      </td></tr>
    </table>

    <!-- Placements -->
    ${placementsHtml ? `
    <div style="font-size:10px;letter-spacing:2px;color:#c8392b;text-transform:uppercase;font-weight:700;margin-bottom:10px;">Placement Details</div>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8e2d8;border-radius:4px;overflow:hidden;margin-bottom:24px;">
      <thead>
        <tr style="background:#f5f2eb;">
          <th style="padding:9px 14px;text-align:left;font-size:10px;letter-spacing:1px;color:#888;text-transform:uppercase;font-weight:600;">Placement</th>
          <th style="padding:9px 14px;text-align:left;font-size:10px;letter-spacing:1px;color:#888;text-transform:uppercase;font-weight:600;">Type</th>
          <th style="padding:9px 14px;text-align:left;font-size:10px;letter-spacing:1px;color:#888;text-transform:uppercase;font-weight:600;">Detail</th>
          <th style="padding:9px 14px;text-align:right;font-size:10px;letter-spacing:1px;color:#888;text-transform:uppercase;font-weight:600;">$/Unit</th>
        </tr>
      </thead>
      <tbody>${placementsHtml}</tbody>
    </table>` : ''}

    <!-- Pricing — combined per unit -->
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8e2d8;border-radius:4px;overflow:hidden;margin-bottom:24px;">
      <tr style="background:#f5f2eb;">
        <td style="padding:12px 16px;font-size:13px;color:#555;border-bottom:1px solid #e8e2d8;">Price per unit (garment + decoration)</td>
        <td style="padding:12px 16px;font-size:15px;font-weight:700;color:#0d0d0d;text-align:right;border-bottom:1px solid #e8e2d8;">$${perUnit}/unit</td>
      </tr>
      <tr>
        <td style="padding:16px;font-size:16px;font-weight:700;color:#0d0d0d;border-top:2px solid #c8392b;">TOTAL (before tax)</td>
        <td style="padding:16px;font-size:22px;font-weight:900;color:#c8392b;text-align:right;border-top:2px solid #c8392b;">$${(quote.total || 0).toFixed(2)} CAD</td>
      </tr>
    </table>

    <!-- Terms -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff8ec;border:1px solid #e8c96a;border-radius:4px;margin-bottom:24px;">
      <tr><td style="padding:14px 16px;">
        <div style="font-size:10px;letter-spacing:2px;color:#7a5c00;text-transform:uppercase;font-weight:700;margin-bottom:8px;">Payment Terms</div>
        <div style="font-size:13px;color:#555;line-height:1.6;">
          <strong style="color:#333;">80% deposit required to begin production.</strong> Remaining 20% due upon completion, prior to shipment or pickup.
        </div>
      </td></tr>
    </table>

    <!-- Payment options -->
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8e2d8;border-radius:4px;margin-bottom:28px;">
      <tr><td style="padding:12px 16px;border-bottom:1px solid #e8e2d8;background:#f5f2eb;">
        <div style="font-size:10px;letter-spacing:2px;color:#888;text-transform:uppercase;font-weight:600;">Payment Options</div>
      </td></tr>
      <tr><td style="padding:12px 16px;border-bottom:1px solid #e8e2d8;">
        <div style="font-size:13px;font-weight:600;color:#333;">E-Transfer</div>
        <div style="font-size:12px;color:#888;margin-top:3px;">Send to sales@truenorthscreenprinting.ca · Include your name and order number</div>
      </td></tr>
      <tr><td style="padding:12px 16px;border-bottom:1px solid #e8e2d8;">
        <div style="font-size:13px;font-weight:600;color:#333;">EFT / Bank Transfer</div>
        <div style="font-size:12px;color:#888;margin-top:3px;">Contact us for banking details: sales@truenorthscreenprinting.ca</div>
      </td></tr>
      <tr><td style="padding:12px 16px;">
        <div style="font-size:13px;font-weight:600;color:#333;">QuickBooks Payment Link <span style="font-size:11px;color:#c8392b;font-weight:400;">+3% processing fee</span></div>
        <div style="font-size:12px;color:#888;margin-top:3px;">Credit card / online payment — link provided upon acceptance</div>
      </td></tr>
    </table>

    ${quote.notes ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f2eb;border-left:3px solid #e8c547;border-radius:0 4px 4px 0;margin-bottom:24px;">
      <tr><td style="padding:14px 16px;">
        <div style="font-size:10px;letter-spacing:2px;color:#7a5c00;text-transform:uppercase;font-weight:700;margin-bottom:6px;">Notes from our team</div>
        <div style="font-size:13px;color:#555;line-height:1.6;">${quote.notes}</div>
      </td></tr>
    </table>` : ''}

    <!-- CTA Buttons -->
    <p style="font-size:13px;color:#888;margin:0 0 14px 0;text-align:center;">This quote is valid for 14 days. Ready to move forward?</p>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding-right:6px;">
          <a href="${acceptUrl}" style="display:block;background:#c8392b;color:#ffffff;text-decoration:none;text-align:center;padding:16px;font-size:14px;font-weight:700;letter-spacing:2px;text-transform:uppercase;border-radius:4px;">✓ Accept Quote</a>
        </td>
        <td style="padding-left:6px;">
          <a href="${changesUrl}" style="display:block;background:transparent;color:#333;text-decoration:none;text-align:center;padding:16px;font-size:13px;font-weight:600;letter-spacing:1px;border:1px solid #ccc;border-radius:4px;">Request Changes</a>
        </td>
      </tr>
    </table>

  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#0d0d0d;padding:20px 32px;text-align:center;">
    <p style="font-size:12px;color:#555;margin:0 0 4px 0;letter-spacing:1px;">TRUE NORTH SCREEN PRINTING LTD.</p>
    <p style="font-size:11px;color:#444;margin:0 0 4px 0;">Vancouver, BC · 604-874-4488 · <a href="mailto:sales@truenorthscreenprinting.ca" style="color:#c8392b;text-decoration:none;">sales@truenorthscreenprinting.ca</a></p>
    <p style="font-size:10px;color:#333;margin:10px 0 0 0;">Quote #${quote.quote_num} · Valid for 14 days · Prices in CAD · Subject to applicable taxes</p>
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
