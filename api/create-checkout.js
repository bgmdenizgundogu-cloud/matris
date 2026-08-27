// /api/create-checkout.js
const PRODUCT_IDS = {
  subscription_monthly: 'pdt_0NmJ3WjRciPjls7cVXGF4',
  subscription_yearly: 'pdt_0NmJ3xZMwaRwjZV6qOoVc',
  mt1: 'pdt_0NmJ0WAA92NNzqqkVqEtg',
  mt2: 'pdt_0NmIzw7Iy2bMyk7UKfjmV',
  mt3: 'pdt_0NmIzfr3pHK7gUXPXNw15',
  mt4: 'pdt_0NmJ0hkAGwDVi8UXxxdu0I',
  mt5: 'pdt_0NmIzUsZ1CUd5AozCAcsp',
  mt6: 'pdt_0NmJ08F1lna2mJt65kekM',
  mt7: 'pdt_0NmIz1xeHdJwxlnsGL95A',
  mt8: 'pdt_0NmIzEvCYmFYuMkQYsGZH',
  mt9: 'pdt_0NmJ1YKgf2URBvyFJD0C7',
  mt10: 'pdt_0NmJ1ODeOeaZY3Z3EpDvt',
  mt11: 'pdt_0NmImdLZYf2n9pVHmbDaW',
  mt12: 'pdt_0NmJ0Jwe28JMsOhRqgG4m',
  mt14: 'pdt_0NmJ2OdIII8IPpHmmDv8t',
  mt15: 'pdt_0NmJ2ZzcI8kzLWr8JIzsM',
  mt16: 'pdt_0NmJ2oB1sM9ECpxC6P1LG',
  mt17: 'pdt_0NmJ1vmdEaBGPNSzYxHJG',
  mt18: 'pdt_0NmJ27hCZprD0LZti8Uq0',
  mt19: 'pdt_0NmIyXaNIb7b18KahgMYg',
  mt20: 'pdt_0NmJ2yoZyMhWX9bXS3Osm',
  mt21: 'pdt_0NmJ3ACKqDA3qeORdAopJ',
  mt22: 'pdt_0NmJ0ucpauckV5ZadsIHN',
  mt23: 'pdt_0NmJ1jgTQM79fwglqCRQ9',
  DEFAULT_SINGLE: 'pdt_0NmJ1D1ndjApt5nFxmfMR',
};

const DODO_API_BASE =
  process.env.DODO_PAYMENTS_ENV === 'test_mode'
    ? 'https://test.dodopayments.com'
    : 'https://live.dodopayments.com';

function resolveProductId(kind, itemId) {
  let productId;
  if (kind === 'subscription_monthly' || kind === 'subscription_yearly') {
    productId = PRODUCT_IDS[kind];
  } else {
    productId = PRODUCT_IDS[itemId] || PRODUCT_IDS.DEFAULT_SINGLE;
  }
  if (!productId || productId.startsWith('REPLACE_WITH_')) {
    return null;
  }
  return productId;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  if (!process.env.DODO_PAYMENTS_API_KEY) {
    console.error('DODO_PAYMENTS_API_KEY tanımlı değil (Vercel Environment Variables).');
    return res.status(500).json({ error: 'server_misconfigured' });
  }

  const { kind, itemId, birthDateKey, userId, userEmail } = req.body || {};

  if (!['single', 'subscription_monthly', 'subscription_yearly'].includes(kind)) {
    return res.status(400).json({ error: 'invalid_kind' });
  }
  if (kind === 'single' && !itemId) {
    return res.status(400).json({ error: 'missing_item_id' });
  }

  const productId = resolveProductId(kind, itemId);
  if (!productId) {
    return res.status(503).json({
      error: 'product_not_configured',
      message:
        'Bu ürün için Dodo Payments product_id henüz tanımlanmadı (bkz. /api/create-checkout.js içindeki PRODUCT_IDS).',
    });
  }

  const metadata = {};
  if (kind) metadata.kind = kind;
  if (itemId) metadata.itemId = itemId;
  if (birthDateKey) metadata.birthDateKey = birthDateKey;
  if (userId) metadata.userId = userId;

  const payload = {
    product_cart: [{ product_id: productId, quantity: 1 }],
    return_url: process.env.SITE_URL || 'https://destinychartmatrix.com',
    metadata,
  };
  if (userEmail) {
    payload.customer = { email: userEmail };
  }

  try {
    const dodoRes = await fetch(`${DODO_API_BASE}/checkouts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.DODO_PAYMENTS_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!dodoRes.ok) {
      const errText = await dodoRes.text().catch(() => '');
      console.error('Dodo checkout session error:', dodoRes.status, errText);
      return res.status(502).json({ error: 'dodo_checkout_failed' });
    }

    const session = await dodoRes.json();
    return res.status(200).json({ checkoutUrl: session.checkout_url });
  } catch (err) {
    console.error('create-checkout internal error:', err);
    return res.status(500).json({ error: 'internal_error' });
  }
}
