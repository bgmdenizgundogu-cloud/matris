// /api/check-guest-purchase.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const { anonId, userId, kind, itemId } = req.body || {};

  if ((!anonId || typeof anonId !== 'string') && (!userId || typeof userId !== 'string')) {
    return res.status(400).json({ error: 'missing_identifier' });
  }
  if (!['single', 'subscription_monthly', 'subscription_yearly'].includes(kind)) {
    return res.status(400).json({ error: 'invalid_kind' });
  }

  try {
    const isSubscription = kind === 'subscription_monthly' || kind === 'subscription_yearly';

    const params = new URLSearchParams();
    params.set('kind', `eq.${kind}`);
    if (!isSubscription && itemId) {
      params.set('item_id', `eq.${itemId}`);
    }
    params.set('select', 'id');
    params.set('limit', '1');

    let table;
    if (userId) {
      table = 'purchases';
      params.set('user_id', `eq.${userId}`);
    } else {
      table = 'guest_purchases';
      params.set('anon_id', `eq.${anonId}`);
    }

    const url = `${process.env.SUPABASE_URL}/rest/v1/${table}?${params.toString()}`;
    const resp = await fetch(url, {
      method: 'GET',
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });

    if (!resp.ok) {
      console.error('check-guest-purchase Supabase error:', resp.status, await resp.text().catch(() => ''));
      return res.status(502).json({ error: 'lookup_failed' });
    }

    const rows = await resp.json();
    return res.status(200).json({ purchased: Array.isArray(rows) && rows.length > 0 });
  } catch (err) {
    console.error('check-guest-purchase internal error:', err);
    return res.status(500).json({ error: 'internal_error' });
  }
}
