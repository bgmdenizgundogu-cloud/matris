(() => {
  const $ = id => document.getElementById(id);
  let lang = new URLSearchParams(location.search).get('lang') === 'en' ? 'en' : 'tr';
  let client, session, data, generation = 0, poll;
  const t = (tr,en) => lang === 'en' ? en : tr;
  const status = (tr,en) => $('status').textContent = t(tr,en);
  function translate() {
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-tr]').forEach(el => el.textContent = el.dataset[lang]);
    $('language').textContent = lang === 'tr' ? 'English' : 'Türkçe';
  }
  async function api(path, options={}) {
    const token = client ? (await client.auth.getSession()).data.session?.access_token : null;
    const response = await fetch(path,{...options,cache:'no-store',headers:{...options.headers,...(token?{Authorization:`Bearer ${token}`}:{})}});
    if (!response.ok) throw new Error(String(response.status));
    return response.json();
  }
  function clearVideo() { generation++; $('video').pause(); $('video').removeAttribute('src'); $('video').load(); $('player').hidden=true; }
  function render() {
    $('account').hidden=!!session || !client;
    $('logout').hidden=!session;
    $('buy').hidden=data.enrolled || !data.salesEnabled || !client;
    $('buy').textContent=session?t('Satın al','Buy course'):t('Giriş yap ve satın al','Sign in to purchase');
    $('lessons-title').textContent=data.enrolled?t('Eğitimim','My course'):t('Ders içeriği','Course curriculum');
    $('refresh').hidden=!session;
    $('lessons').replaceChildren();
    for (const lesson of data.lessons) {
      const li=document.createElement('li'), button=document.createElement('button');
      button.textContent=lesson[`title_${lang}`]; button.disabled=!data.enrolled;
      button.addEventListener('click',async()=>{
        const ticket=++generation; button.disabled=true;
        try {
          const playback=await api(`/api/training?lesson=${encodeURIComponent(lesson.id)}`);
          if(ticket!==generation)return;
          $('now-playing').textContent=lesson[`title_${lang}`];
          $('video').src=playback.url; $('player').hidden=false;
          $('player').scrollIntoView({behavior:'smooth',block:'start'});
        } catch {clearVideo();status('Videoya erişilemiyor. Girişinizi ve satın alma durumunuzu kontrol edin.','Unable to access video. Check your sign-in and purchase status.');}
        finally {button.disabled=!data.enrolled;}
      });li.append(button);$('lessons').append(li);
    }
    if(!data.lessons.length)status('Dersler hazırlanıyor. Henüz satışa açılmadı.','Lessons are being prepared. Sales have not opened yet.');
    else if(data.enrolled)status('Eğitiminize erişiminiz açık. İzlemek için bir ders seçin.','You have access. Select a lesson to watch.');
    else if(!data.salesEnabled)status('Eğitim henüz satışa açılmadı.','This course is not yet on sale.');
    else status('Dersleri izlemek için giriş yapıp eğitimi satın alın.','Sign in and purchase the course to watch the lessons.');
  }
  async function refresh(){data=await api('/api/training');if(!data.enrolled)clearVideo();render();return data;}
  async function authenticate(signup){
    if(!$('login').reportValidity())return;
    const credentials={email:$('email').value.trim(),password:$('password').value};
    const result=signup ? await client.auth.signUp(credentials) : await client.auth.signInWithPassword(credentials);
    $('password').value='';
    if(result.error){status('İşlem tamamlanamadı. Bilgilerinizi kontrol edin; gerekirse ana siteden hesabınızı kurtarın.','Could not complete sign-in. Check your details or recover your account on the main site.');return;}
    if(signup&&!result.data.session)status('Hesabınızı doğrulamak için e-postanızı kontrol edin.','Check your email to confirm your account.');
  }
  $('login').addEventListener('submit',e=>{e.preventDefault();authenticate(false).catch(()=>status('Bağlantı hatası. Tekrar deneyin.','Connection error. Try again.'));});
  $('signup').onclick=()=>authenticate(true).catch(()=>status('Bağlantı hatası.','Connection error.'));
  $('logout').onclick=async()=>{clearVideo();await client.auth.signOut();};
  $('refresh').onclick=()=>refresh().catch(()=>status('Kontrol yapılamadı. Tekrar deneyin.','Unable to check access. Try again.'));
  $('language').onclick=()=>{lang=lang==='tr'?'en':'tr';translate();if(data)render();};
  $('buy').onclick=async()=>{
    if(!session){$('account').scrollIntoView({behavior:'smooth',block:'start'});$('email').focus({preventScroll:true});return;}
    $('buy').disabled=true;
    try {const result=await api('/api/training-checkout',{method:'POST'});if(result.enrolled)await refresh();else location.assign(result.checkoutUrl);}
    catch{status('Ödeme sayfası açılamadı. Lütfen tekrar deneyin.','Could not open checkout. Please try again.');}
    finally{$('buy').disabled=false;}
  };
  async function start(){
    translate();data=await api('/api/training');
    if(data.supabaseAnonKey){
      client=supabase.createClient(data.supabaseUrl,data.supabaseAnonKey);
      session=(await client.auth.getSession()).data.session;
      client.auth.onAuthStateChange((_event,next)=>{
        if(session?.user?.id!==next?.user?.id)clearVideo();session=next;
        // Run outside Supabase's auth callback to avoid lock re-entry.
        setTimeout(()=>refresh().catch(()=>status('Erişim kontrolü yapılamadı.','Unable to check access.')),0);
      });
    }
    await refresh();
    if(new URLSearchParams(location.search).has('payment')&&session&&!data.enrolled){
      let attempts=0;poll=setInterval(async()=>{
        try{await refresh();if(data.enrolled||++attempts>=30){clearInterval(poll);if(!data.enrolled)status('Ödeme henüz doğrulanmadı. Bir süre sonra erişim durumunu tekrar kontrol edin.','Payment has not been verified yet. Check access again shortly.');}}
        catch{if(++attempts>=30)clearInterval(poll);}
      },4000);
    }
  }
  start().catch(()=>status('Eğitim alanı hazırlanıyor. Lütfen daha sonra tekrar deneyin.','The course area is being prepared. Please try again later.'));
})();
