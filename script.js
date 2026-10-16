// Ye HTML Vercel par /api ke saath host ho to khali rehne dein.
  // Alag host par ho to apna Vercel URL daalein: "https://your-project.vercel.app"
  const API_BASE = "";

(function(){
  const $ = id => document.getElementById(id);
  const fileInput = $('iconInput'), iconBtn = $('iconStage'), iconPreview = $('iconPreview'), iconInfo = $('iconInfo');
  const buildBtn = $('buildBtn'), toast = $('toast');
  const siteInput = $('siteInput'), siteBtn = $('siteBtn'), siteBtnText = $('siteBtnText'), urlField = $('urlField'), htmlField = $('htmlField');
  const websiteUrl = $('websiteUrl'), appName = $('appName'), packageName = $('packageName'), versionEl = $('version');
  const statusBox = $('buildStatus'), bsMsg = $('bsMsg'), bsSub = $('bsSub'), dlBtn = $('dlBtn');
  const pvApp = $('pvApp'), pvIcon = $('pvIcon'), pvInitial = $('pvInitial'), pvName = $('pvName');
  const pvHost = $('pvHost'), pvPkg = $('pvPkg'), pvVer = $('pvVer'), pvClock = $('pvClock');

  let toastTimer, iconData = null, busy = false, mode = 'url', siteFile = null;
  const MAX_SITE = 3000000;
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function showToast(msg){
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
  }

  const JAVA_KW = new Set('abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for goto if implements import instanceof int interface long native new package private protected public return short static strictfp super switch synchronized this throw throws transient try void volatile while true false null'.split(' '));
  const PKG_PREFIX = 'com.amanullah.';
  function slugify(name){
    let s = name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 30) || 'app';
    if(/^\d/.test(s)) s = 'app' + s;
    if(JAVA_KW.has(s)) s += 'app';
    return s;
  }
  function resolvePkg(pkg, name){ return pkg || (PKG_PREFIX + slugify(name || 'app')); }
  window.W2A = { slug: slugify, resolvePkg: resolvePkg };

  // ---------- Live preview ----------
  function tick(){
    pvClock.textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: false });
  }
  tick(); setInterval(tick, 30000);

  function updatePreview(){
    const name = appName.value.trim();
    pvName.textContent = name || 'Your app';
    pvInitial.textContent = name ? name.charAt(0).toUpperCase() : '+';

    let host = 'yourwebsite.com';
    if(mode === 'html'){
      host = siteFile ? siteFile.name : 'your HTML file';
    }else{
      try{ host = new URL(websiteUrl.value.trim()).hostname || host; }catch(_){}
    }
    pvHost.textContent = host;

    const pkg = packageName.value.trim().toLowerCase();
    pvPkg.textContent = resolvePkg(pkg, name);
    pvVer.textContent = versionEl.value.trim() || '1.0.0';
  }
  [websiteUrl, appName, packageName, versionEl].forEach(el => el.addEventListener('input', updatePreview));
  updatePreview();

  // ---------- Source switch ----------
  document.querySelectorAll('.seg button').forEach(btn => btn.addEventListener('click', () => {
    mode = btn.dataset.mode;
    document.querySelectorAll('.seg button').forEach(b => b.setAttribute('aria-checked', String(b === btn)));
    urlField.hidden = mode !== 'url';
    htmlField.hidden = mode !== 'html';
    updatePreview();
  }));

  siteBtn.addEventListener('click', () => siteInput.click());
  siteInput.addEventListener('change', () => {
    const f = siteInput.files[0];
    if(!f) return;
    if(!/\.(html?|zip)$/i.test(f.name)){ showToast('Choose a .html or .zip file.'); siteInput.value = ''; return; }
    if(f.size > MAX_SITE){ showToast('That file is over 3MB. Compress images or remove unused files.'); siteInput.value = ''; return; }
    siteFile = f;
    siteBtn.classList.add('has-file');
    siteBtnText.textContent = f.name + '  ·  ' + (f.size < 1024 * 1024 ? Math.max(1, Math.round(f.size / 1024)) + ' KB' : (f.size / 1048576).toFixed(1) + ' MB');
    updatePreview();
  });

  function fileToBase64(file){
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result).split(',')[1] || '');
      fr.onerror = () => reject(new Error('The file could not be read. Choose it again.'));
      fr.readAsDataURL(file);
    });
  }

  function setState(state){ pvApp.dataset.state = state; }
  function setProgress(pct, msg){
    statusBox.classList.add('show');
    pvApp.style.setProperty('--p', pct);
    statusBox.dataset.step = pct >= 100 ? '3' : (pct >= 12 ? '2' : '1');
    if(msg) bsMsg.textContent = msg;
  }
  function fail(msg){
    statusBox.classList.add('show');
    statusBox.dataset.step = '0';
    bsMsg.textContent = msg;
    bsSub.textContent = '';
    setState('error');
  }

  // ---------- Icon (resized to 192x192 PNG in the browser) ----------
  iconBtn.addEventListener('click', () => fileInput.click());
  pvApp.addEventListener('click', () => fileInput.click());

  const ic = { img: null, url: '', zoom: 1, bg: 'transparent', shape: 'circle', name: '' };
  const icTools = $('iconTools'), icZoom = $('icZoom'), icZoomOut = $('icZoomOut');
  const SHAPE_R = { circle: 96, squircle: 44, square: 0 };
  const SHAPE_CSS = { circle: '50%', squircle: '28%', square: '8%' };

  function roundedPath(g, w, h, r){
    g.moveTo(r, 0); g.arcTo(w, 0, w, h, r); g.arcTo(w, h, 0, h, r); g.arcTo(0, h, 0, 0, r); g.arcTo(0, 0, w, 0, r); g.closePath();
  }

  function renderIcon(){
    if(!ic.img) return;
    const S = 192, c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d');
    const r = SHAPE_R[ic.shape];
    g.beginPath();
    if(r >= S / 2) g.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2);
    else if(r > 0) roundedPath(g, S, S, r);
    else g.rect(0, 0, S, S);
    g.clip();
    if(ic.bg !== 'transparent'){ g.fillStyle = ic.bg; g.fillRect(0, 0, S, S); }
    const m = Math.min(ic.img.width, ic.img.height), k = S * ic.zoom / m;
    const dw = ic.img.width * k, dh = ic.img.height * k;
    g.drawImage(ic.img, (S - dw) / 2, (S - dh) / 2, dw, dh);
    iconData = c.toDataURL('image/png');
    iconPreview.src = iconData;
    iconBtn.classList.add('has-img');
    pvIcon.src = iconData;
    pvApp.classList.add('has-icon');
    pvApp.style.setProperty('--ir', SHAPE_CSS[ic.shape]);
    iconInfo.textContent = ic.name;
    iconInfo.style.display = 'block';
    document.dispatchEvent(new Event('icon:changed'));
  }

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if(!file) return;
    if(!file.type.startsWith('image/')){ showToast('Choose an image file (PNG, JPG or WEBP).'); return; }
    if(file.size > 5 * 1024 * 1024){ showToast('That image is over 5MB. Choose a smaller one.'); return; }
    const objUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      if(ic.url) URL.revokeObjectURL(ic.url);
      ic.img = img; ic.url = objUrl; ic.name = file.name; ic.zoom = 1;
      icZoom.value = 100; icZoomOut.textContent = '100%';
      icTools.hidden = false;
      renderIcon();
    };
    img.onerror = () => { URL.revokeObjectURL(objUrl); showToast('This image could not be read. Try another one.'); };
    img.src = objUrl;
  });

  icZoom.addEventListener('input', () => {
    ic.zoom = icZoom.value / 100;
    icZoomOut.textContent = icZoom.value + '%';
    renderIcon();
  });

  const bgBtns = [...document.querySelectorAll('#icBg .sw[data-bg]')], pick = $('icPick'), pickIn = $('icBgCustom');
  function setBg(v, from){
    ic.bg = v;
    bgBtns.forEach(b => b.setAttribute('aria-checked', String(b === from)));
    pick.classList.toggle('on', from === pick);
    renderIcon();
  }
  bgBtns.forEach(b => b.addEventListener('click', () => setBg(b.dataset.bg, b)));
  pickIn.addEventListener('input', () => setBg(pickIn.value, pick));

  const shpBtns = [...document.querySelectorAll('#icShape .shp')];
  shpBtns.forEach(b => b.addEventListener('click', () => {
    ic.shape = b.dataset.shape;
    shpBtns.forEach(x => x.setAttribute('aria-checked', String(x === b)));
    renderIcon();
  }));

  // ---------- Build ----------
  async function startBuild(){
    if(busy) return;
    if(navigator.onLine === false){ showToast('You are offline. Connect to the internet to build.'); return; }
    const url = websiteUrl.value.trim();
    const name = appName.value.trim();
    const pkg = packageName.value.trim().toLowerCase();
    const version = versionEl.value.trim() || '1.0.0';

    if(mode === 'html'){
      if(!name || !siteFile){ showToast('Add an app name and choose your HTML file.'); return; }
    }else{
      if(!url || !name){ showToast('Add your website URL and an app name.'); return; }
      if(!/^https?:\/\/[^\s<>"']{3,}$/.test(url)){ showToast('The URL must start with http:// or https://'); return; }
    }
    if(name.length > 30){ showToast('App name can be up to 30 characters.'); return; }
    if(!iconData){ showToast('Add an app icon to continue.'); return; }
    if(pkg && !/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(pkg)){ showToast('Package name should look like com.example.app'); return; }
    if(!/^\d+(\.\d+){0,3}$/.test(version)){ showToast('Version should look like 1.0.0'); return; }

    const finalPkg = resolvePkg(pkg, name);
    busy = true;
    buildBtn.disabled = true;
    buildBtn.textContent = 'Building…';
    dlBtn.classList.remove('show');
    bsSub.textContent = 'Build me 3-5 minute lagte hain. Page band mat karein.';
    pvApp.style.setProperty('--p', 0);
    setState('building');
    setProgress(6, 'Request bhej rahe hain...');

    try{
      const payload = mode === 'html'
        ? { mode: 'html', fileName: siteFile.name, file: await fileToBase64(siteFile), name, package: finalPkg, version, icon: iconData }
        : { mode: 'url', url, name, package: finalPkg, version, icon: iconData };
      const r = await fetch(API_BASE + '/api/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      let d = {};
      try{ d = await r.json(); }catch(_){}
      if(!r.ok || !d.id) throw new Error(d.error || ('Server error ' + r.status));

      let pct = 12;
      setProgress(pct, 'Build start ho rahi hai...');
      const t0 = Date.now();
      let result = null;

      while(Date.now() - t0 < 15 * 60 * 1000){
        await sleep(6000);
        let s = null;
        try{
          const sr = await fetch(API_BASE + '/api/status?id=' + d.id, { cache: 'no-store' });
          s = await sr.json();
        }catch(_){ /* network blip, try again */ }

        if(s && s.state === 'done'){ result = s; break; }
        if(s && s.state === 'failed') throw new Error('Build fail ho gayi. Website URL aur icon check karke dobara try karein.');

        pct = Math.min(92, pct + 2.2);
        const secs = Math.round((Date.now() - t0) / 1000);
        setProgress(pct, 'APK ban rahi hai... (' + secs + 's)');
      }
      if(!result) throw new Error('Build me zyada time lag gaya. Thodi der baad dobara try karein.');

      setProgress(100, 'Your APK is ready.');
      setState('done');
      bsSub.textContent = '';
      dlBtn.href = result.url;
      dlBtn.classList.add('show');
      showToast('APK ready. Tap Download APK.');
    }catch(err){
      fail(err.message || 'Something went wrong. Try again.');
      showToast('Build did not finish.');
    }finally{
      busy = false;
      buildBtn.disabled = false;
      buildBtn.textContent = 'Build APK';
    }
  }

  buildBtn.addEventListener('click', startBuild);
})();

(function(){
  const $ = id => document.getElementById(id);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const urlIn = $('websiteUrl'), nameIn = $('appName'), pkgIn = $('packageName'), verIn = $('version');
  const iconInput = $('iconInput'), siteInput = $('siteInput'), buildBtn = $('buildBtn');
  const pvApp = $('pvApp'), pvIcon = $('pvIcon'), pvHost = $('pvHost'), dlBtn = $('dlBtn'), toastEl = $('toast');
  const segBtns = [...document.querySelectorAll('.seg button')];
  const baseTitle = document.title;
  const URL_RE = /^https?:\/\/[^\s<>"']{3,}$/;
  const getMode = () => (segBtns.find(b => b.getAttribute('aria-checked') === 'true') || segBtns[0]).dataset.mode;
  const fire = (el, type) => el.dispatchEvent(new Event(type, { bubbles: true }));

  let tt;
  function toast(msg){
    toastEl.textContent = msg; toastEl.classList.add('show');
    clearTimeout(tt); tt = setTimeout(() => toastEl.classList.remove('show'), 3000);
  }
  function setFile(input, file){
    try{
      const dt = new DataTransfer(); dt.items.add(file);
      input.files = dt.files; fire(input, 'change'); return true;
    }catch(_){ return false; }
  }
  function slug(name){
    let s = (name || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 30) || 'app';
    return /^\d/.test(s) ? 'app' + s : s;
  }

  /* ---------- URL field ---------- */
  function urlCheck(){
    const v = urlIn.value.trim(), wrap = urlIn.parentElement, hint = $('urlHint');
    let valid = false;
    if(URL_RE.test(v)){ try{ new URL(v); valid = true; }catch(_){} }
    wrap.classList.toggle('ok', valid);
    wrap.classList.toggle('bad', !!v && !valid);
    hint.textContent = !v ? 'Include http:// or https://' : valid ? 'The link looks good.' : 'The link must start with http:// or https://';
    hint.className = 'hint' + (valid ? ' good' : v ? ' warn' : '');
  }
  function normalizeUrl(){
    const v = urlIn.value.trim();
    if(v && !/^[a-z][a-z0-9+.-]*:\/\//i.test(v) && /^[^\s\/]+\.[^\s\/]+/.test(v)){
      urlIn.value = 'https://' + v; fire(urlIn, 'input');
    }
  }
  urlIn.addEventListener('input', urlCheck);
  urlIn.addEventListener('blur', normalizeUrl);
  $('pasteBtn').addEventListener('click', async () => {
    try{
      const t = (await navigator.clipboard.readText()).trim();
      if(!t){ toast('Your clipboard is empty.'); return; }
      urlIn.value = t; fire(urlIn, 'input'); normalizeUrl(); urlIn.focus();
    }catch(_){ toast('Paste with Ctrl+V, or press and hold in the field.'); }
  });

  /* ---------- Name + package ---------- */
  nameIn.addEventListener('input', () => {
    const n = nameIn.value.length, c = $('nameCount');
    c.textContent = n + '/30'; c.classList.toggle('max', n >= 28);
  });
  $('autoPkg').addEventListener('click', () => {
    pkgIn.value = W2A.resolvePkg('', nameIn.value.trim());
    fire(pkgIn, 'input'); pkgIn.focus();
  });

  /* ---------- Readiness chips ---------- */
  function readiness(){
    const html = getMode() === 'html';
    return {
      src: html ? !!(siteInput.files && siteInput.files[0]) : URL_RE.test(urlIn.value.trim()),
      name: !!nameIn.value.trim() && nameIn.value.trim().length <= 30,
      icon: pvApp.classList.contains('has-icon')
    };
  }
  let wasReady = false;
  function updateReady(){
    const r = readiness();
    document.querySelectorAll('#ready .chip').forEach(c => c.classList.toggle('done', !!r[c.dataset.k]));
    if(r.src){ urlIn.classList.remove('invalid'); $('siteBtn').classList.remove('invalid'); }
    if(r.icon) document.querySelector('.icon-row').classList.remove('invalid');
    const all = r.src && r.name && r.icon;
    buildBtn.classList.toggle('ready', all);
    if(all && !wasReady && !reduce){
      buildBtn.classList.remove('pulse'); void buildBtn.offsetWidth; buildBtn.classList.add('pulse');
    }
    wasReady = all;
    saveSoon();
  }
  buildBtn.addEventListener('animationend', e => { if(e.target === buildBtn) buildBtn.classList.remove('pulse'); });
  [urlIn, nameIn, pkgIn, verIn].forEach(el => el.addEventListener('input', updateReady));
  siteInput.addEventListener('change', () => setTimeout(updateReady, 0));
  document.addEventListener('icon:changed', () => updateReady());
  segBtns.forEach((b, i) => {
    b.addEventListener('click', () => setTimeout(updateReady, 0));
    b.addEventListener('keydown', e => {
      if(e.key === 'ArrowRight' || e.key === 'ArrowLeft'){
        e.preventDefault(); const n = segBtns[(i + 1) % segBtns.length]; n.click(); n.focus();
      }
    });
  });

  /* ---------- Show what is missing when Build is pressed ---------- */
  document.addEventListener('input', e => { if(e.target.classList) e.target.classList.remove('invalid'); });
  buildBtn.addEventListener('click', () => {
    document.querySelectorAll('.invalid').forEach(el => el.classList.remove('invalid'));
    const r = readiness(), bad = [];
    if(!r.src) bad.push(getMode() === 'html' ? $('siteBtn') : urlIn);
    if(!r.name) bad.push(nameIn);
    if(!r.icon) bad.push(document.querySelector('.icon-row'));
    const pk = pkgIn.value.trim().toLowerCase();
    if(pk && !/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(pk)) bad.push(pkgIn);
    const v = verIn.value.trim();
    if(v && !/^\d+(\.\d+){0,3}$/.test(v)) bad.push(verIn);
    bad.forEach(el => { void el.offsetWidth; el.classList.add('invalid'); });
    if(bad[0]) bad[0].scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
  });
  [urlIn, nameIn, pkgIn, verIn].forEach(el => el.addEventListener('keydown', e => {
    if(e.key === 'Enter' && !buildBtn.disabled){ e.preventDefault(); buildBtn.click(); }
  }));

  /* ---------- Drop or paste an icon / HTML file ---------- */
  const veil = $('dropveil');
  let depth = 0;
  const hasFiles = e => e.dataTransfer && [...e.dataTransfer.types].includes('Files');
  addEventListener('dragenter', e => { if(hasFiles(e)){ depth++; veil.classList.add('show'); } });
  addEventListener('dragleave', e => { if(hasFiles(e) && --depth <= 0){ depth = 0; veil.classList.remove('show'); } });
  addEventListener('dragover', e => { if(hasFiles(e)) e.preventDefault(); });
  addEventListener('drop', e => {
    if(!hasFiles(e)) return;
    e.preventDefault(); depth = 0; veil.classList.remove('show');
    const f = e.dataTransfer.files[0]; if(!f) return;
    if(f.type.startsWith('image/')){ setFile(iconInput, f); toast('Icon added.'); }
    else if(/\.(html?|zip)$/i.test(f.name)){
      if(getMode() !== 'html') segBtns.find(b => b.dataset.mode === 'html').click();
      setFile(siteInput, f);
    }else toast('Drop an image, a .html file or a .zip file.');
  });
  addEventListener('paste', e => {
    const f = e.clipboardData && [...e.clipboardData.files].find(x => x.type.startsWith('image/'));
    if(f){ e.preventDefault(); setFile(iconInput, f); toast('Icon pasted.'); }
  });

  /* ---------- Icon: size warning + dominant colour ---------- */
  const launch = $('launch');
  iconInput.addEventListener('change', () => {
    const f = iconInput.files[0], warn = $('iconWarn');
    warn.hidden = true;
    if(!f || !f.type.startsWith('image/')) return;
    const u = URL.createObjectURL(f), im = new Image();
    im.onload = () => { warn.hidden = Math.min(im.width, im.height) >= 192; URL.revokeObjectURL(u); };
    im.onerror = () => URL.revokeObjectURL(u);
    im.src = u;
  });
  pvIcon.addEventListener('load', () => {
    try{
      const c = document.createElement('canvas'); c.width = c.height = 16;
      const g = c.getContext('2d'); g.drawImage(pvIcon, 0, 0, 16, 16);
      const d = g.getImageData(0, 0, 16, 16).data;
      let r = 0, gr = 0, b = 0, n = 0;
      for(let i = 0; i < d.length; i += 4){ if(d[i + 3] < 128) continue; r += d[i]; gr += d[i + 1]; b += d[i + 2]; n++; }
      if(!n) return;
      r /= n; gr /= n; b /= n;
      const k = Math.min(1.8, 200 / Math.max(r, gr, b, 1));
      launch.style.setProperty('--glow', 'rgba(' + [r, gr, b].map(x => Math.min(255, Math.round(x * k))).join(',') + ',.42)');
    }catch(_){}
  });

  /* ---------- Launch preview ---------- */
  const screen = document.querySelector('.screen');
  function openLaunch(){
    const sr = screen.getBoundingClientRect(), ir = pvApp.querySelector('.app-icon').getBoundingClientRect();
    launch.style.setProperty('--cx', (ir.left + ir.width / 2 - sr.left) + 'px');
    launch.style.setProperty('--cy', (ir.top + ir.height / 2 - sr.top) + 'px');
    const has = pvApp.classList.contains('has-icon'), name = nameIn.value.trim();
    $('lName').textContent = name || 'Your app';
    $('lInitial').textContent = name ? name.charAt(0).toUpperCase() : '+';
    $('lHost').textContent = pvHost.textContent;
    $('lIcon').src = has ? pvIcon.src : '';
    launch.classList.toggle('has-icon', has);
    launch.classList.remove('open', 'play'); void launch.offsetWidth;
    launch.classList.add('open', 'play');
  }
  const closeLaunch = () => launch.classList.remove('open', 'play');
  $('launchBtn').addEventListener('click', openLaunch);
  launch.addEventListener('click', closeLaunch);
  addEventListener('keydown', e => { if(e.key === 'Escape') closeLaunch(); });

  /* ---------- Phone tilt (mouse only) ---------- */
  const phone = document.querySelector('.phone'), stage = document.querySelector('.stage');
  const fine = matchMedia('(min-width:860px) and (hover:hover) and (pointer:fine)');
  if(!reduce){
    stage.addEventListener('pointermove', e => {
      if(!fine.matches || e.pointerType !== 'mouse') return;
      const r = phone.getBoundingClientRect();
      const x = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width * 1.1)));
      const y = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (r.height * 0.7)));
      phone.style.transition = 'transform .12s ease-out';
      phone.style.transform = 'perspective(1200px) rotateY(' + (x * 7).toFixed(2) + 'deg) rotateX(' + (-y * 5).toFixed(2) + 'deg)';
    });
    stage.addEventListener('pointerleave', () => {
      phone.style.transition = 'transform .6s cubic-bezier(.2,.8,.2,1)'; phone.style.transform = '';
    });
  }

  /* ---------- Build progress extras ---------- */
  const bar = $('barFill'), pct = $('pct'), elapsed = $('elapsed'), log = $('log'), after = $('afterRow'), bsMsg = $('bsMsg');
  const fmt = s => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  let t0 = 0, tmr = null, wl = null, lastState = '';

  async function lock(){ try{ if('wakeLock' in navigator) wl = await navigator.wakeLock.request('screen'); }catch(_){} }
  function unlock(){ try{ if(wl) wl.release(); }catch(_){} wl = null; }
  document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'visible' && pvApp.dataset.state === 'building') lock(); });
  addEventListener('beforeunload', e => { if(pvApp.dataset.state === 'building'){ e.preventDefault(); e.returnValue = ''; } });

  function confetti(){
    if(reduce) return;
    const c = document.createElement('canvas'); c.className = 'confetti'; c.width = innerWidth; c.height = innerHeight;
    document.body.appendChild(c);
    const g = c.getContext('2d'), r = dlBtn.getBoundingClientRect(), ox = r.left + r.width / 2, oy = r.top + r.height / 2;
    const cols = ['#FF6F61', '#14B8A6', '#EEF4F3', '#FFBE5A', '#7894FF'];
    const ps = Array.from({ length: 90 }, () => ({
      x: ox, y: oy, vx: (Math.random() - .5) * 14, vy: -Math.random() * 14 - 4, s: 4 + Math.random() * 5,
      r: Math.random() * 6, vr: (Math.random() - .5) * .4, c: cols[(Math.random() * cols.length) | 0], round: Math.random() < .4
    }));
    const start = performance.now();
    (function f(t){
      const e = t - start; g.clearRect(0, 0, c.width, c.height);
      ps.forEach(p => {
        p.vy += .35; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        g.save(); g.globalAlpha = Math.max(0, 1 - e / 1900); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.c;
        if(p.round){ g.beginPath(); g.arc(0, 0, p.s / 2, 0, 7); g.fill(); } else g.fillRect(-p.s / 2, -p.s / 3, p.s, p.s * .6);
        g.restore();
      });
      if(e < 1900) requestAnimationFrame(f); else c.remove();
    })(start);
  }

  function onState(){
    const st = pvApp.dataset.state || '';
    if(st === lastState) return;
    lastState = st;
    if(st === 'building'){
      t0 = Date.now(); log.innerHTML = ''; after.hidden = true; elapsed.textContent = '0:00';
      clearInterval(tmr); tmr = setInterval(() => { elapsed.textContent = fmt(Math.round((Date.now() - t0) / 1000)); }, 1000);
      lock();
    }else if(st === 'done' || st === 'error'){
      clearInterval(tmr); unlock();
      document.title = st === 'done' ? 'APK ready · ' + baseTitle : baseTitle;
      if(st === 'done'){ if(navigator.vibrate) navigator.vibrate([40, 60, 40]); setTimeout(confetti, 60); }
    }
  }
  function onProgress(){
    const p = parseFloat(pvApp.style.getPropertyValue('--p')) || 0;
    bar.style.width = p + '%'; pct.textContent = Math.round(p) + '%';
    if(pvApp.dataset.state === 'building') document.title = '(' + Math.round(p) + '%) Building · ' + baseTitle;
  }
  new MutationObserver(() => { onState(); onProgress(); updateReady(); })
    .observe(pvApp, { attributes: true, attributeFilter: ['class', 'style', 'data-state'] });
  new MutationObserver(() => { after.hidden = !dlBtn.classList.contains('show'); })
    .observe(dlBtn, { attributes: true, attributeFilter: ['class'] });
  new MutationObserver(() => {
    const m = bsMsg.textContent.trim(); if(!m) return;
    const key = m.replace(/\s*\(.*$/, ''), secs = t0 ? Math.round((Date.now() - t0) / 1000) : 0, last = log.lastElementChild;
    if(last && last.dataset.k === key){
      last.querySelector('span').textContent = m; last.querySelector('time').textContent = fmt(secs);
    }else{
      const li = document.createElement('li'); li.dataset.k = key;
      const tm = document.createElement('time'), sp = document.createElement('span');
      tm.textContent = fmt(secs); sp.textContent = m; li.append(tm, sp); log.appendChild(li);
      while(log.children.length > 6) log.removeChild(log.firstElementChild);
    }
  }).observe(bsMsg, { childList: true, characterData: true, subtree: true });

  $('copyLink').addEventListener('click', async () => {
    try{ await navigator.clipboard.writeText(dlBtn.href); toast('Download link copied.'); }
    catch(_){ toast('Copy failed. Press and hold the Download button instead.'); }
  });

  /* ---------- Draft: keep the form if the page is refreshed ---------- */
  const KEY = 'w2apk.draft.v1';
  let st = 0;
  function save(){
    try{
      const d = { url: urlIn.value, name: nameIn.value, pkg: pkgIn.value, ver: verIn.value };
      if(pvApp.classList.contains('has-icon')) d.icon = pvIcon.src;
      localStorage.setItem(KEY, JSON.stringify(d));
    }catch(_){}
  }
  function saveSoon(){ clearTimeout(st); st = setTimeout(save, 350); }
  $('restart').addEventListener('click', () => {
    if(buildBtn.disabled) return;
    try{ localStorage.removeItem(KEY); }catch(_){}
    location.reload();
  });
  $('another').addEventListener('click', () => { try{ localStorage.removeItem(KEY); }catch(_){} location.reload(); });
  addEventListener('pagehide', save);

  (async function restore(){
    let d = null;
    try{ d = JSON.parse(localStorage.getItem(KEY) || 'null'); }catch(_){}
    if(d && (d.url || d.name || d.pkg || d.icon)){
      if(d.url) urlIn.value = d.url;
      if(d.name) nameIn.value = d.name;
      if(d.pkg) pkgIn.value = d.pkg;
      if(d.ver) verIn.value = d.ver;
      [urlIn, nameIn, pkgIn, verIn].forEach(el => fire(el, 'input'));
      if(d.icon){
        try{
          const b = await (await fetch(d.icon)).blob();
          setFile(iconInput, new File([b], 'icon.png', { type: 'image/png' }));
        }catch(_){}
      }
      toast('Your last draft is back.');
    }
    urlCheck(); updateReady();
  })();
})();

(function(){
  const $ = id => document.getElementById(id);
  const KEY = 'w2apk.history.v1', MAX = 10;
  const pvApp = $('pvApp'), pvIcon = $('pvIcon'), dlBtn = $('dlBtn');
  const nameIn = $('appName'), pkgIn = $('packageName'), verIn = $('version'), urlIn = $('websiteUrl');
  const iconInput = $('iconInput'), siteInput = $('siteInput'), toastEl = $('toast');
  const box = $('history'), list = $('hsList'), verHint = $('verHint'), shareBtn = $('shareBtn');
  const fire = (el, t) => el.dispatchEvent(new Event(t, { bubbles: true }));
  const okApk = u => /^https:\/\//.test(String(u || ''));
  const okIcon = u => /^data:image\/png;base64,[A-Za-z0-9+\/=]+$/.test(String(u || ''));

  let tt;
  function toast(m){
    toastEl.textContent = m; toastEl.classList.add('show');
    clearTimeout(tt); tt = setTimeout(() => toastEl.classList.remove('show'), 3000);
  }
  function load(){
    try{ const a = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(a) ? a : []; }catch(_){ return []; }
  }
  function store(a){
    for(let n = a.length; n >= 0; n--){
      try{ localStorage.setItem(KEY, JSON.stringify(a.slice(0, n))); return; }catch(_){ /* storage full: drop the oldest and retry */ }
    }
  }
  function bump(v){
    const p = String(v || '1.0.0').split('.');
    p[p.length - 1] = String((parseInt(p[p.length - 1], 10) || 0) + 1);
    return p.join('.');
  }
  function ago(ts){
    const s = (Date.now() - ts) / 1000;
    if(s < 60) return 'just now';
    if(s < 3600) return Math.floor(s / 60) + ' min ago';
    if(s < 86400) return Math.floor(s / 3600) + ' h ago';
    return Math.floor(s / 86400) + ' d ago';
  }
  const curMode = () => (document.querySelector('.seg button[aria-checked="true"]') || {}).dataset.mode || 'url';

  /* ---------- Next version suggestion ---------- */
  function updateVerHint(){
    verHint.replaceChildren();
    const name = nameIn.value.trim();
    if(!name){ verHint.hidden = true; return; }
    const pkg = W2A.resolvePkg(pkgIn.value.trim().toLowerCase(), name);
    const last = load().find(h => h.pkg === pkg);
    if(!last){ verHint.hidden = true; return; }
    const next = bump(last.ver);
    if(verIn.value.trim() === next){ verHint.hidden = true; return; }
    verHint.hidden = false;
    verHint.append('You built v' + last.ver + ' before. ');
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'linkbtn'; b.textContent = 'Use ' + next;
    b.addEventListener('click', () => { verIn.value = next; fire(verIn, 'input'); updateVerHint(); });
    verHint.append(b);
  }
  [nameIn, pkgIn, verIn].forEach(el => el.addEventListener('input', updateVerHint));

  /* ---------- History list ---------- */
  function el(tag, cls, text){
    const e = document.createElement(tag);
    if(cls) e.className = cls;
    if(text != null) e.textContent = text;
    return e;
  }
  async function reuse(h){
    const seg = document.querySelector('.seg button[data-mode="' + (h.mode === 'html' ? 'html' : 'url') + '"]');
    if(seg) seg.click();
    if(h.mode !== 'html' && h.src) urlIn.value = h.src;
    nameIn.value = h.name; pkgIn.value = h.pkg; verIn.value = bump(h.ver);
    [urlIn, nameIn, pkgIn, verIn].forEach(x => fire(x, 'input'));
    if(okIcon(h.icon)){
      try{
        const b = await (await fetch(h.icon)).blob();
        const dt = new DataTransfer(); dt.items.add(new File([b], 'icon.png', { type: 'image/png' }));
        iconInput.files = dt.files; fire(iconInput, 'change');
      }catch(_){}
    }
    window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    toast(h.mode === 'html' ? 'Settings loaded. Choose your HTML file again.' : 'Settings loaded with the next version.');
  }
  function row(h){
    const li = el('li', 'hs-item');
    const img = el('img', 'hs-thumb'); img.alt = '';
    if(okIcon(h.icon)) img.src = h.icon;
    const main = el('div', 'hs-main');
    main.append(el('div', 'hs-name', h.name), el('div', 'hs-pkg', h.pkg), el('div', 'hs-when', 'Version ' + h.ver + ', ' + ago(h.ts)));
    const act = el('div', 'hs-act');
    if(okApk(h.apk)){
      const a = el('a', 'dl', 'Download'); a.href = h.apk; a.rel = 'noopener';
      const c = el('button', '', 'Copy link'); c.type = 'button';
      c.addEventListener('click', async () => {
        try{ await navigator.clipboard.writeText(h.apk); toast('Download link copied.'); }catch(_){ toast('Copy failed. Press and hold Download instead.'); }
      });
      act.append(a, c);
    }
    const u = el('button', '', 'Use again'); u.type = 'button'; u.addEventListener('click', () => reuse(h));
    const d = el('button', '', 'Remove'); d.type = 'button';
    d.addEventListener('click', () => { store(load().filter(x => x.id !== h.id)); render(); toast('Removed from history.'); });
    act.append(u, d);
    li.append(img, main, act);
    return li;
  }
  function render(){
    const h = load();
    box.hidden = !h.length;
    list.replaceChildren(...h.map(row));
    updateVerHint();
  }
  $('hsClear').addEventListener('click', () => {
    if(!confirm('Remove all saved builds from this device?')) return;
    store([]); render();
  });

  /* ---------- Record a finished build ---------- */
  let snap = null, last = '';
  function take(){
    const name = nameIn.value.trim(), html = curMode() === 'html';
    return {
      name, mode: html ? 'html' : 'url',
      src: html ? ((siteInput.files[0] || {}).name || '') : urlIn.value.trim(),
      pkg: W2A.resolvePkg(pkgIn.value.trim().toLowerCase(), name),
      ver: verIn.value.trim() || '1.0.0',
      icon: okIcon(pvIcon.src) ? pvIcon.src : ''
    };
  }
  new MutationObserver(() => {
    const st = pvApp.dataset.state || '';
    if(st === last) return;
    last = st;
    if(st === 'building') snap = take();
    else if(st === 'done' && snap && okApk(dlBtn.href)){
      const a = load().filter(x => x.apk !== dlBtn.href);
      a.unshift(Object.assign({ id: Date.now().toString(36), ts: Date.now(), apk: dlBtn.href }, snap));
      store(a.slice(0, MAX)); render();
    }
  }).observe(pvApp, { attributes: true, attributeFilter: ['data-state'] });

  /* ---------- Share ---------- */
  if(navigator.share){
    shareBtn.addEventListener('click', async () => {
      try{ await navigator.share({ title: nameIn.value.trim() || 'My app', text: 'Download my Android app', url: dlBtn.href }); }catch(_){}
    });
  }else shareBtn.hidden = true;

  render();
})();

(function(){
  const nav = document.getElementById('nav'), tog = document.getElementById('navToggle');
  const links = [...document.querySelectorAll('.nav-links a[data-sec]')];
  const hist = document.getElementById('history'), navHist = document.getElementById('navHist');

  function setOpen(o){
    nav.classList.toggle('open', o);
    tog.setAttribute('aria-expanded', String(o));
    tog.setAttribute('aria-label', o ? 'Close menu' : 'Open menu');
  }
  tog.addEventListener('click', () => setOpen(!nav.classList.contains('open')));
  links.forEach(a => a.addEventListener('click', () => setOpen(false)));
  addEventListener('keydown', e => { if(e.key === 'Escape' && nav.classList.contains('open')){ setOpen(false); tog.focus(); } });
  document.addEventListener('click', e => { if(nav.classList.contains('open') && !nav.contains(e.target)) setOpen(false); });
  matchMedia('(min-width:720px)').addEventListener('change', e => { if(e.matches) setOpen(false); });

  // Show "Recent builds" only when there is history
  const syncHist = () => { navHist.hidden = hist.hidden; };
  syncHist();
  new MutationObserver(syncHist).observe(hist, { attributes: true, attributeFilter: ['hidden'] });

  // Shadow on scroll + highlight the section being read
  let ticking = false;
  function onScroll(){
    ticking = false;
    nav.classList.toggle('scrolled', scrollY > 8);
    let cur = null;
    if(scrollY > 80){
      links.forEach(a => {
        const el = document.getElementById(a.dataset.sec);
        if(el && !el.hidden && el.getBoundingClientRect().top <= 140) cur = a;
      });
      if(innerHeight + scrollY >= document.documentElement.scrollHeight - 4 && !navHist.hidden) cur = links.find(a => a.dataset.sec === 'history') || cur;
    }
    links.forEach(a => { a.classList.toggle('active', a === cur); if(a === cur) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current'); });
  }
  addEventListener('scroll', () => { if(!ticking){ ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();
})();

/* ---------- PWA: service worker, install button, update bar ---------- */
(function(){
  const $ = id => document.getElementById(id);
  const navInstall = $('navInstall'), installBtn = $('installBtn'), installMain = $('installMain'), iosHelp = $('iosHelp'), toastEl = $('toast');
  const helpIos = $('helpIos'), helpOther = $('helpOther');
  const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let deferred = null, tt;

  function toast(m){
    toastEl.textContent = m; toastEl.classList.add('show');
    clearTimeout(tt); tt = setTimeout(() => toastEl.classList.remove('show'), 3200);
  }
  function sync(){
    // show when the browser can install, or on iOS where Share > Add to Home Screen is the only way
    navInstall.hidden = standalone() || !(deferred || isIOS);
    installMain.hidden = standalone();   // the main button is always there until the app is installed
  }

  addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; sync(); });
  addEventListener('appinstalled', () => { deferred = null; sync(); toast('App installed. Open it from your home screen.'); });
  matchMedia('(display-mode: standalone)').addEventListener('change', sync);

  async function doInstall(){
    if(deferred){
      deferred.prompt();
      try{ await deferred.userChoice; }catch(_){}
      deferred = null; sync();
      return;
    }
    // No browser prompt available (iOS, or the browser is not ready yet): show the steps for this device
    helpIos.hidden = !isIOS; helpOther.hidden = isIOS;
    if(iosHelp.showModal) iosHelp.showModal();
  }
  installBtn.addEventListener('click', doInstall);
  installMain.addEventListener('click', doInstall);
  $('iosClose').addEventListener('click', () => iosHelp.close());
  iosHelp.addEventListener('click', e => { if(e.target === iosHelp) iosHelp.close(); });
  sync();

  addEventListener('offline', () => toast('You are offline. You can still edit, but building needs internet.'));
  addEventListener('online', () => toast('Back online.'));

  if(!('serviceWorker' in navigator)) return;

  function showUpdate(worker){
    if($('updateBar')) return;
    const bar = document.createElement('div');
    bar.className = 'update-bar'; bar.id = 'updateBar'; bar.setAttribute('role', 'status');
    const t = document.createElement('span'); t.textContent = 'A new version is ready.';
    const b = document.createElement('button'); b.type = 'button'; b.textContent = 'Reload';
    b.addEventListener('click', () => worker.postMessage('SKIP_WAITING'));
    bar.append(t, b); document.body.appendChild(bar);
  }

  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if(reloading || !window.__swHadController) return;
    reloading = true; location.reload();
  });
  window.__swHadController = !!navigator.serviceWorker.controller;

  addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(reg => {
      if(reg.waiting && navigator.serviceWorker.controller) showUpdate(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        if(!w) return;
        w.addEventListener('statechange', () => {
          if(w.state === 'installed' && navigator.serviceWorker.controller) showUpdate(w);
        });
      });
    }).catch(() => {});
  });
})();
