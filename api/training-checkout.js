import { COURSE_ID, sb, user, course, owns, fail, responseError, dodoBase } from '../lib/training.js';
export default async function handler(req,res) {
  res.setHeader('Cache-Control','private, no-store');
  if (req.method !== 'POST') { res.setHeader('Allow','POST'); return res.status(405).end(); }
  try {
    const member = await user(req);
    const info = await course();
    if (!info.sales_enabled || !info.dodo_product_id || !process.env.DODO_PAYMENTS_API_KEY) fail(503,'sales_closed');
    if (await owns(member.id)) return res.json({enrolled:true});
    const orders = await sb('/rest/v1/training_orders',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({
      user_id:member.id,course_id:COURSE_ID,product_id:info.dodo_product_id,
    })});
    const response = await fetch(`${dodoBase()}/checkouts`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${process.env.DODO_PAYMENTS_API_KEY}`},body:JSON.stringify({
      product_cart:[{product_id:info.dodo_product_id,quantity:1}],
      customer:{email:member.email},
      return_url:new URL('/egitimler/kader-matrisi.html?payment=returned',process.env.SITE_URL || 'https://www.destinychartmatrix.com').href,
      metadata:{kind:'training',orderId:orders[0].id},
    })});
    if (!response.ok) fail(502,'checkout_failed');
    const session = await response.json();
    const url = new URL(session.checkout_url);
    if (url.protocol !== 'https:' || !(url.hostname === 'dodopayments.com' || url.hostname.endsWith('.dodopayments.com'))) fail(502,'checkout_failed');
    return res.json({checkoutUrl:url.href});
  } catch(e) { return responseError(res,e); }
}
