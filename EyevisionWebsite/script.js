// Eyevision Optical Clinic — interactions (no frameworks)

function $(sel, root = document) {
  return root.querySelector(sel);
}
function $all(sel, root = document) {
  return Array.from(root.querySelectorAll(sel));
}

// Navbar: mobile toggle + active link highlight
(function initNavbar() {
  const toggle = document.querySelector('[data-nav-toggle]');
  const menu = document.querySelector('[data-nav-menu]');
  if (toggle && menu) {
    toggle.addEventListener('click', () => {
      const isOpen = menu.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(isOpen));
    });

    // close on link click (mobile)
    $all('a.nav-link', menu).forEach((a) => {
      a.addEventListener('click', () => {
        menu.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  const path = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  $all('[data-nav]').forEach((a) => {
    const href = (a.getAttribute('href') || '').toLowerCase();
    const isHome = (path === '' || path === 'index.html') && (href === 'index.html' || href === './' || href === '/');
    const isMatch = href.endsWith(path);
    if (isHome || isMatch) a.classList.add('active');
  });
})();

// Vision Simulator page: blur slider
(function initSimulator() {
  const img = $('[data-sim-image]');
  const slider = $('[data-sim-slider]');
  const out = $('[data-sim-output]');
  if (!img || !slider || !out) return;

  function render() {
    const val = Number(slider.value || 0);
    const px = (val / 10).toFixed(1);
    img.style.setProperty('--blur', `${px}px`);
    out.textContent = `${px}px`;
  }
  slider.addEventListener('input', render);
  render();
})();

// Virtual Try-On: webcam or upload + frame overlay (canvas)
(function initTryOn() {
  const stage = $('[data-tryon-stage]');
  if (!stage) return;

  const video = $('[data-tryon-video]', stage);
  const img = $('[data-tryon-img]', stage);
  const canvas = $('[data-tryon-canvas]', stage);
  const empty = $('[data-tryon-empty]', stage);
  const btnWebcam = $('[data-tryon-webcam]');
  const btnStop = $('[data-tryon-stop]');
  const file = $('[data-tryon-file]');
  const size = $('[data-tryon-size]');
  const posY = $('[data-tryon-posy]');
  const outSize = $('[data-tryon-size-out]');
  const outPosY = $('[data-tryon-posy-out]');

  let stream = null;
  let activeFrame = null;
  const ctx = canvas.getContext('2d');

  const frames = [
    { id: 'classic', name: 'Classic', desc: 'Everyday rectangular', svg: frameSvgClassic() },
    { id: 'round', name: 'Round', desc: 'Soft & modern', svg: frameSvgRound() },
    { id: 'cat', name: 'Cat-eye', desc: 'Bold statement', svg: frameSvgCateye() },
    { id: 'sport', name: 'Sport', desc: 'Light wrap style', svg: frameSvgSport() },
    { id: 'rimless', name: 'Rimless', desc: 'Minimalist look', svg: frameSvgRimless() },
    { id: 'aviator', name: 'Aviator', desc: 'Iconic silhouette', svg: frameSvgAviator() },
  ];

  // Build thumbnails
  const thumbs = $('[data-tryon-thumbs]');
  if (thumbs) {
    thumbs.innerHTML = frames.map((f, idx) => {
      const active = idx === 0 ? 'active' : '';
      const preview = encodeURIComponent(f.svg);
      return `
        <button class="thumb ${active}" type="button" data-frame="${f.id}">
          <div class="preview">
            <img alt="${f.name} frame preview" src="data:image/svg+xml;utf8,${preview}">
          </div>
          <p class="label">${f.name}</p>
          <p class="desc">${f.desc}</p>
        </button>
      `;
    }).join('');
    activeFrame = frames[0];

    $all('.thumb', thumbs).forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-frame');
        activeFrame = frames.find((f) => f.id === id) || frames[0];
        $all('.thumb', thumbs).forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        draw();
      });
    });
  }

  function setMode(mode) {
    // mode: 'empty' | 'video' | 'image'
    if (empty) empty.style.display = mode === 'empty' ? 'grid' : 'none';
    if (video) video.style.display = mode === 'video' ? 'block' : 'none';
    if (img) img.style.display = mode === 'image' ? 'block' : 'none';
    if (canvas) canvas.style.display = mode === 'empty' ? 'none' : 'block';
  }

  function syncCanvasToStage() {
    const rect = stage.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(rect.width));
    canvas.height = Math.max(1, Math.round(rect.height));
  }

  function draw() {
    if (!canvas || !ctx) return;
    syncCanvasToStage();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!activeFrame) return;

    const frameImg = new Image();
    frameImg.onload = () => {
      const s = Number(size?.value || 78) / 100; // % of width
      const y = Number(posY?.value || 44) / 100; // % of height

      const w = canvas.width * s;
      const h = (w * frameImg.height) / frameImg.width;
      const x = (canvas.width - w) / 2;
      const top = canvas.height * y - h / 2;
      ctx.drawImage(frameImg, x, top, w, h);
    };
    frameImg.src = `data:image/svg+xml;utf8,${encodeURIComponent(activeFrame.svg)}`;
  }

  function updateControls() {
    if (outSize && size) outSize.textContent = `${size.value}%`;
    if (outPosY && posY) outPosY.textContent = `${posY.value}%`;
  }

  async function startWebcam() {
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Webcam not supported in this browser.');
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      video.srcObject = stream;
      await video.play();
      setMode('video');
      draw();
    } catch (e) {
      alert(`Couldn’t start webcam.\n\n${e?.message || e}`);
      setMode('empty');
    }
  }

  function stopWebcam() {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
    if (video) {
      video.pause();
      video.srcObject = null;
    }
  }

  btnWebcam?.addEventListener('click', async () => {
    stopWebcam();
    if (img) img.src = '';
    await startWebcam();
  });

  btnStop?.addEventListener('click', () => {
    stopWebcam();
    setMode('empty');
    draw();
  });

  file?.addEventListener('change', () => {
    const f = file.files?.[0];
    if (!f) return;
    stopWebcam();
    const url = URL.createObjectURL(f);
    img.onload = () => {
      setMode('image');
      draw();
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });

  size?.addEventListener('input', () => { updateControls(); draw(); });
  posY?.addEventListener('input', () => { updateControls(); draw(); });
  window.addEventListener('resize', () => draw());

  updateControls();
  setMode('empty');
  draw();

  // SVG generators (simple, transparent overlays)
  function frameSvgClassic() {
    return svgWrap(`
      <g fill="none" stroke="rgba(255,255,255,.92)" stroke-width="14" stroke-linecap="round">
        <rect x="70" y="110" width="260" height="160" rx="46"/>
        <rect x="370" y="110" width="260" height="160" rx="46"/>
        <path d="M330 185 C350 170 370 170 390 185"/>
        <path d="M70 170 C40 170 25 160 12 140"/>
        <path d="M630 170 C660 170 675 160 688 140"/>
      </g>
      <g opacity=".55" stroke="rgba(249,115,22,.95)" stroke-width="6" fill="none">
        <rect x="70" y="110" width="260" height="160" rx="46"/>
        <rect x="370" y="110" width="260" height="160" rx="46"/>
      </g>
    `);
  }
  function frameSvgRound() {
    return svgWrap(`
      <g fill="none" stroke="rgba(255,255,255,.92)" stroke-width="14" stroke-linecap="round">
        <circle cx="200" cy="190" r="95"/>
        <circle cx="500" cy="190" r="95"/>
        <path d="M295 190 C345 160 355 160 405 190"/>
        <path d="M98 150 C60 150 35 145 18 130"/>
        <path d="M602 150 C640 150 665 145 682 130"/>
      </g>
      <g opacity=".55" stroke="rgba(249,115,22,.95)" stroke-width="6" fill="none">
        <circle cx="200" cy="190" r="95"/>
        <circle cx="500" cy="190" r="95"/>
      </g>
    `);
  }
  function frameSvgCateye() {
    return svgWrap(`
      <g fill="none" stroke="rgba(255,255,255,.92)" stroke-width="14" stroke-linejoin="round" stroke-linecap="round">
        <path d="M95 200 C110 120 175 95 270 120 C305 130 315 165 305 220 C285 285 115 290 95 200 Z"/>
        <path d="M625 200 C610 120 545 95 450 120 C415 130 405 165 415 220 C435 285 605 290 625 200 Z"/>
        <path d="M310 190 C350 165 370 165 410 190"/>
      </g>
      <g opacity=".55" stroke="rgba(249,115,22,.95)" stroke-width="6" fill="none">
        <path d="M95 200 C110 120 175 95 270 120 C305 130 315 165 305 220 C285 285 115 290 95 200 Z"/>
        <path d="M625 200 C610 120 545 95 450 120 C415 130 405 165 415 220 C435 285 605 290 625 200 Z"/>
      </g>
    `);
  }
  function frameSvgSport() {
    return svgWrap(`
      <g fill="none" stroke="rgba(255,255,255,.92)" stroke-width="14" stroke-linejoin="round" stroke-linecap="round">
        <path d="M70 205 C95 120 210 115 310 155 C335 165 330 240 300 265 C230 320 105 300 70 205 Z"/>
        <path d="M630 205 C605 120 490 115 390 155 C365 165 370 240 400 265 C470 320 595 300 630 205 Z"/>
        <path d="M312 196 C350 185 350 185 388 196"/>
        <path d="M65 185 C35 195 20 185 10 165"/>
        <path d="M635 185 C665 195 680 185 690 165"/>
      </g>
      <g opacity=".55" stroke="rgba(249,115,22,.95)" stroke-width="6" fill="none">
        <path d="M70 205 C95 120 210 115 310 155 C335 165 330 240 300 265 C230 320 105 300 70 205 Z"/>
        <path d="M630 205 C605 120 490 115 390 155 C365 165 370 240 400 265 C470 320 595 300 630 205 Z"/>
      </g>
    `);
  }
  function frameSvgRimless() {
    return svgWrap(`
      <g fill="none" stroke="rgba(255,255,255,.65)" stroke-width="6" stroke-linecap="round">
        <rect x="80" y="125" width="240" height="140" rx="50" stroke-dasharray="8 10"/>
        <rect x="380" y="125" width="240" height="140" rx="50" stroke-dasharray="8 10"/>
        <path d="M320 190 C350 176 350 176 380 190"/>
      </g>
      <g fill="rgba(249,115,22,.85)">
        <circle cx="80" cy="195" r="7"/>
        <circle cx="620" cy="195" r="7"/>
      </g>
    `);
  }
  function frameSvgAviator() {
    return svgWrap(`
      <g fill="none" stroke="rgba(255,255,255,.92)" stroke-width="14" stroke-linecap="round" stroke-linejoin="round">
        <path d="M120 145 C170 85 290 95 300 190 C308 265 250 305 170 285 C115 270 85 205 120 145 Z"/>
        <path d="M580 145 C530 85 410 95 400 190 C392 265 450 305 530 285 C585 270 615 205 580 145 Z"/>
        <path d="M300 190 C345 165 355 165 400 190"/>
        <path d="M120 170 C70 165 40 160 18 140"/>
        <path d="M580 170 C630 165 660 160 682 140"/>
      </g>
      <g opacity=".55" stroke="rgba(249,115,22,.95)" stroke-width="6" fill="none">
        <path d="M120 145 C170 85 290 95 300 190 C308 265 250 305 170 285 C115 270 85 205 120 145 Z"/>
        <path d="M580 145 C530 85 410 95 400 190 C392 265 450 305 530 285 C585 270 615 205 580 145 Z"/>
      </g>
    `);
  }
  function svgWrap(inner) {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 380">
        <defs>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="10" stdDeviation="10" flood-color="rgba(0,0,0,.25)"/>
          </filter>
        </defs>
        <g filter="url(#shadow)">
          ${inner}
        </g>
      </svg>
    `.trim();
  }
})();