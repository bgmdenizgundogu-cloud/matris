// /api/dodo-webhook.js
import { Webhook } from 'standardwebhooks';

export const config = {
  api: {
    bodyParser: false,
  },
};

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }

  if (!process.env.DODO_PAYMENTS_WEBHOOK_SECRET) {
    console.error('DODO_PAYMENTS_WEBHOOK_SECRET tanımlı değil (Vercel Environment Variables).');
    return res.status(500).json({ error: 'server_misconfigured' });
  }

  const rawBody = await readRawBody(req);

  const webhookHeaders = {
    'webhook-id': req.headers['webhook-id'],
    'webhook-signature': req.headers['webhook-signature'],
    'webhook-timestamp': req.headers['webhook-timestamp'],
  };

  let payload;
  try {
    const wh = new Webhook(process.env.DODO_PAYMENTS_WEBHOOK_SECRET);
    payload = wh.verify(rawBody, webhookHeaders);
  } catch (err) {
    console.error('Dodo webhook imza doğrulaması başarısız:', err.message);
    return res.status(400).json({ error: 'invalid_signature' });
  }

  try {
    const eventType = payload.type;
    const metadata = (payload.data && payload.data.metadata) || payload.metadata || {};
    const dodoProductId =
      (payload.data && payload.data.product_id) ||
      (payload.data && payload.data.product_cart && payload.data.product_cart[0] && payload.data.product_cart[0].product_id) ||
      null;

    const isPaymentSuccess = eventType === 'payment.succeeded';
    const isSubscriptionSuccess = eventType === 'subscription.active' || eventType === 'subscription.renewed';

    if (isPaymentSuccess || isSubscriptionSuccess) {
      if (metadata.userId) {
        await saveToSupabase({
          userId: metadata.userId,
          kind: metadata.kind || (isSubscriptionSuccess ? 'subscription' : 'single'),
          itemId: metadata.itemId || null,
          birthDateKey: metadata.birthDateKey || null,
          dodoProductId,
        });
      } else if (metadata.anonId) {
        await saveGuestPurchaseToSupabase({
          anonId: metadata.anonId,
          kind: metadata.kind || (isSubscriptionSuccess ? 'subscription' : 'single'),
          itemId: metadata.itemId || null,
          birthDateKey: metadata.birthDateKey || null,
          dodoProductId,
        });
      }
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('Dodo webhook işleme hatası:', err);
    return res.status(500).json({ error: 'processing_failed' });
  }
}

async function saveToSupabase({ userId, kind, itemId, birthDateKey, dodoProductId }) {
  const url = `${process.env.SUPABASE_URL}/rest/v1/purchases`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      user_id: userId,
      kind,
      item_id: itemId,
      price_id: dodoProductId,
      birth_date: birthDateKey,
    }),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Supabase insert failed: ${resp.status} ${text}`);
  }
}

async function saveGuestPurchaseToSupabase({ anonId, kind, itemId, birthDateKey, dodoProductId }) {
  const url = `${process.env.SUPABASE_URL}/rest/v1/guest_purchases`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      anon_id: anonId,
      kind,
      item_id: itemId,
      price_id: dodoProductId,
      birth_date: birthDateKey,
    }),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Supabase guest insert failed: ${resp.status} ${text}`);
  }
}
