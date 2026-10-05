import { COURSE_ID, sb, user, course, owns, fail, responseError } from '../lib/training.js';
export default async function handler(req,res) {
  res.setHeader('Cache-Control','private, no-store');
  res.setHeader('Vary','Authorization');
  if (req.method !== 'GET') { res.setHeader('Allow','GET'); return res.status(405).end(); }
  try {
    const info = await course();
    if (!req.query.lesson) {
      const member = req.headers.authorization ? await user(req) : null;
      const enrolled = member ? await owns(member.id) : false;
      const lessons = await sb(`/rest/v1/training_lessons?course_id=eq.${COURSE_ID}&published=eq.true&select=id,title_tr,title_en,position,duration_seconds&order=position.asc,id.asc`);
      return res.json({id:info.id,title_tr:info.title_tr,title_en:info.title_en,
        salesEnabled:info.sales_enabled && !!info.dodo_product_id, enrolled, lessons,
        supabaseUrl:process.env.SUPABASE_URL, supabaseAnonKey:process.env.SUPABASE_ANON_KEY || null});
    }
    const member = await user(req);
    if (!await owns(member.id)) fail(403,'purchase_required');
    const q = new URLSearchParams({id:`eq.${req.query.lesson}`,course_id:`eq.${COURSE_ID}`,published:'eq.true',select:'storage_path',limit:'1'});
    const lessons = await sb(`/rest/v1/training_lessons?${q}`);
    if (!lessons[0]?.storage_path) fail(404,'lesson_not_found');
    const path = lessons[0].storage_path.split('/').map(encodeURIComponent).join('/');
    // Private bucket: this URL is issued only after verified identity + paid order.
    // Two hours covers the current ~87 minute lesson, including browser range requests.
    const signed = await sb(`/storage/v1/object/sign/training-videos/${path}`,{method:'POST',body:JSON.stringify({expiresIn:7200})});
    if (!signed?.signedURL) fail(502,'video_unavailable');
    return res.json({url:`${process.env.SUPABASE_URL}/storage/v1${signed.signedURL}`,expiresIn:7200});
  } catch(e) { return responseError(res,e); }
}
