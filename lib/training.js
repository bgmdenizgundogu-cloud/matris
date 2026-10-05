export const COURSE_ID = 'kader-matrisi';
export function fail(status, message) { const e = new Error(message); e.status = status; throw e; }
export async function sb(path, options = {}) {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) fail(503, 'training_unavailable');
  const response = await fetch(`${base}${path}`, {
    ...options, headers: { apikey: key, Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json', ...options.headers },
  });
  if (!response.ok) fail(502, 'training_service_error');
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}
export async function user(req) {
  const token = req.headers.authorization;
  if (!/^Bearer \S+$/.test(token || '')) fail(401, 'login_required');
  const response = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: token },
  });
  if (!response.ok) fail(401, 'login_required');
  const result = await response.json();
  if (!result.id || !result.email_confirmed_at) fail(401, 'login_required');
  return result;
}
export async function course() {
  const rows = await sb(`/rest/v1/training_courses?id=eq.${COURSE_ID}&select=*`);
  if (!rows?.[0]) fail(503, 'training_unavailable');
  return rows[0];
}
export async function owns(userId) {
  const q = new URLSearchParams({user_id:`eq.${userId}`,course_id:`eq.${COURSE_ID}`,status:'eq.paid',select:'id',limit:'1'});
  return (await sb(`/rest/v1/training_orders?${q}`)).length > 0;
}
export function responseError(res, error) {
  // Never send service responses, credentials or personal data to the browser/logs.
  return res.status(error.status || 500).json({error:error.status ? error.message : 'training_service_error'});
}
export const dodoBase = () => process.env.DODO_PAYMENTS_ENV === 'test_mode'
  ? 'https://test.dodopayments.com' : 'https://live.dodopayments.com';

// Called ONLY after standardwebhooks signature verification in dodo-webhook.js.
export async function trainingWebhook(payload) {
  const data = payload.data || {};
  if (['refund.succeeded','dispute.opened','dispute.lost','dispute.accepted'].includes(payload.type)) {
    if (!data.payment_id) fail(400, 'missing_payment');
    await sb('/rest/v1/rpc/revoke_training_payment', {method:'POST',body:JSON.stringify({p_payment_id:data.payment_id})});
    return true;
  }
  if (data.metadata?.kind !== 'training') return false;
  if (payload.type !== 'payment.succeeded') return true;
  if (!data.payment_id || !data.metadata.orderId) fail(400, 'invalid_training_payment');
  const productIds = (data.product_cart || []).map(p => p.product_id);
  if (data.product_id) productIds.push(data.product_id);
  if (!productIds.length) fail(400, 'missing_training_product');
  await sb('/rest/v1/rpc/fulfill_training_order', {method:'POST',body:JSON.stringify({
    p_order_id:data.metadata.orderId,p_payment_id:data.payment_id,p_product_ids:productIds,
  })});
  return true;
}
