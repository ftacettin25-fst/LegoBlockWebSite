// =========================================================
// Create flow: drag/drop upload, validation, staged overlay,
// real call to POST /api/create on the Flask backend.
// =========================================================
import { initNav, initReveal, getCart, setCart, toast } from './nav.js';

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ACCEPT = ['image/jpeg', 'image/png', 'image/webp'];

const STAGES = [
  { id: 's1', label: 'Uploading photo',         icon: 'upload-cloud' },
  { id: 's2', label: 'AI appearance analysis',  icon: 'scan-face' },
  { id: 's3', label: 'Generating views',        icon: 'images' },
  { id: 's4', label: 'Analyzing features',      icon: 'search' },
  { id: 's5', label: 'Building 3D model',       icon: 'box' },
  { id: 's6', label: 'Merging bricks',          icon: 'blocks' },
  { id: 's7', label: 'Finalizing',              icon: 'sparkles' },
];

let uploadedFile = null;
let lastResult   = null;

function $(s, root = document) { return root.querySelector(s); }

function renderStages() {
  const host = $('#stages');
  host.innerHTML = STAGES.map((s) => `
    <div class="stage" id="${s.id}">
      <span class="stage__dot"></span>
      <i data-lucide="${s.icon}"></i>
      <span>${s.label}</span>
    </div>
  `).join('');
  if (window.lucide) window.lucide.createIcons();
}
function setStage(idx, state) {
  STAGES.forEach((s, i) => {
    const el = $('#' + s.id);
    if (!el) return;
    el.classList.remove('active', 'done');
    if (i < idx)  el.classList.add('done');
    if (i === idx && state !== 'done') el.classList.add('active');
    if (i === idx && state === 'done') el.classList.add('done');
  });
  const pct = Math.round(((idx + (state === 'done' ? 1 : 0)) / STAGES.length) * 100);
  $('#progress-bar').style.width = pct + '%';
}

function validate(file) {
  if (!ACCEPT.includes(file.type)) return 'Please upload a JPG, PNG, or WEBP image.';
  if (file.size > MAX_BYTES)       return 'Image must be smaller than 10 MB.';
  return null;
}

function setFile(file) {
  const err = validate(file);
  const errBox = $('#err');
  if (err) {
    errBox.textContent = err;
    errBox.style.display = 'block';
    return;
  }
  errBox.style.display = 'none';
  uploadedFile = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    const dz = $('#dropzone');
    dz.classList.add('has-file');
    $('#dz-preview').style.backgroundImage = `url("${e.target.result}")`;
    $('#dz-filename').textContent = file.name;
    $('#build-btn').disabled = false;
    $('#upload-status').innerHTML = `<i data-lucide="check-circle-2" style="color:var(--success);width:14px;height:14px"></i> <strong>${file.name}</strong> ready to build`;
    if (window.lucide) window.lucide.createIcons();
  };
  reader.readAsDataURL(file);
}

function clearFile() {
  uploadedFile = null;
  $('#dropzone').classList.remove('has-file');
  $('#dz-preview').style.backgroundImage = '';
  $('#file-input').value = '';
  $('#build-btn').disabled = true;
  $('#upload-status').textContent = 'No photo uploaded yet';
}

async function build() {
  if (!uploadedFile) return;
  $('#err').style.display = 'none';
  $('#result').classList.remove('visible');

  const overlay = $('#overlay');
  overlay.classList.add('active');
  renderStages();
  setStage(0, 'active');

  // Cosmetic stage pacing — the FINAL stage only completes when the request resolves
  let stageIdx = 0;
  const timer = setInterval(() => {
    if (stageIdx < STAGES.length - 2) {
      stageIdx += 1;
      setStage(stageIdx, 'active');
    }
  }, 3000);

  const fd = new FormData();
  fd.append('photo', uploadedFile);
  fd.append('person_number', '1');

  try {
    const resp = await fetch('/api/create', { method: 'POST', body: fd });
    clearInterval(timer);

    // Advance to final stage and complete it after response arrives
    setStage(STAGES.length - 1, 'active');
    await new Promise((r) => setTimeout(r, 600));
    for (let i = 0; i < STAGES.length; i++) setStage(i, 'done');
    await new Promise((r) => setTimeout(r, 500));
    overlay.classList.remove('active');

    const data = await resp.json();
    if (!resp.ok || !data.success) {
      throw new Error(data.error || 'Unknown error');
    }
    lastResult = data;
    showResult(data);
  } catch (e) {
    clearInterval(timer);
    overlay.classList.remove('active');
    const errBox = $('#err');
    errBox.innerHTML = `<i data-lucide="alert-circle"></i> ${e.message || 'Failed to reach the server. Please try again.'}`;
    errBox.style.display = 'flex';
    if (window.lucide) window.lucide.createIcons();
  }
}

function showResult(data) {
  $('#result').classList.add('visible');
  // Chips from person_data
  const chipHost = $('#chips');
  chipHost.innerHTML = '';
  const pd = data.person_data || {};
  const rows = [
    ['Hair',   `${pd.hair_color || '—'} ${pd.hair_type || ''}`.trim()],
    ['Top',    pd.top_clothing_color || '—'],
    ['Bottom', pd.bottom_clothing_color || '—'],
    ['Skin',   pd.skin_color_desc || '—'],
  ];
  rows.forEach(([k, v]) => {
    const chip = document.createElement('div');
    chip.className = 'chip';
    chip.innerHTML = `<strong>${k}</strong> ${v}`;
    chipHost.appendChild(chip);
  });

  $('#download-link').href     = data.download_url;
  $('#download-link').download = 'brickheadz.ldr';

  if (window.initLdrViewer) window.initLdrViewer(data.ldr_url);
  $('#result').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function addToCart() {
  if (!lastResult) return;
  const cart = getCart();
  cart.push({
    id: lastResult.job_id,
    title: 'Custom BrickHeadz',
    sub: 'Personalized brick figurine',
    qty: 1,
    price: 49,
    download_url: lastResult.download_url,
    ldr_url: lastResult.ldr_url,
  });
  setCart(cart);
  toast('Added to cart', 'ok');
}

function reset() {
  clearFile();
  $('#result').classList.remove('visible');
  $('#err').style.display = 'none';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.addEventListener('DOMContentLoaded', () => {
  initNav();
  initReveal();

  const dz = $('#dropzone');
  const input = $('#file-input');

  dz.addEventListener('click', (e) => {
    if (dz.classList.contains('has-file')) return;
    input.click();
  });
  input.addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) setFile(f);
  });
  ['dragover', 'dragenter'].forEach((ev) =>
    dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('dragover'); }),
  );
  ['dragleave', 'drop'].forEach((ev) =>
    dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove('dragover'); }),
  );
  dz.addEventListener('drop', (e) => {
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) setFile(f);
  });

  $('#dz-remove').addEventListener('click', (e) => { e.stopPropagation(); clearFile(); });
  $('#build-btn').addEventListener('click', build);
  $('#reset-btn').addEventListener('click', reset);
  $('#cart-btn').addEventListener('click', addToCart);
});
