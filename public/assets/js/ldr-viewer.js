/* eslint-disable */
/* Original Three.js LDR viewer + PDF build guide, ported with the icon
   text updated to use Lucide instead of emoji. Behavior unchanged. */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { LDrawLoader } from 'three/addons/loaders/LDrawLoader.js';

let scene, camera, renderer, controls, ldrawLoader, loadedModelGroup = null;
let viewerInitialized = false;

window.initLdrViewer = function (ldrUrl) {
  const viewerEl = document.getElementById('ldr-viewer');
  if (!viewerEl) return;

  if (viewerInitialized && loadedModelGroup) {
    scene.remove(loadedModelGroup);
    loadedModelGroup = null;
  }

  if (!viewerInitialized) {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f0f17);
    camera = new THREE.PerspectiveCamera(45, viewerEl.clientWidth / viewerEl.clientHeight, 1, 10000);
    renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(viewerEl.clientWidth, viewerEl.clientHeight);
    viewerEl.appendChild(renderer.domElement);
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dl = new THREE.DirectionalLight(0xffffff, 0.9);
    dl.position.set(1, 1, 1).normalize(); scene.add(dl);
    const dl2 = new THREE.DirectionalLight(0x8b5cf6, 0.35);
    dl2.position.set(-1, 0.4, -1).normalize(); scene.add(dl2);
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.05;
    ldrawLoader = new LDrawLoader();
    ldrawLoader.setPartsLibraryPath('/static/ldraw/');
    (function animate() { requestAnimationFrame(animate); controls.update(); renderer.render(scene, camera); })();
    window.addEventListener('resize', () => {
      if (!viewerEl.clientWidth) return;
      camera.aspect = viewerEl.clientWidth / viewerEl.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(viewerEl.clientWidth, viewerEl.clientHeight);
    });
    viewerInitialized = true;
  }

  function loadModel() {
    ldrawLoader.load(ldrUrl, group => {
      loadedModelGroup = group;
      const box = new THREE.Box3().setFromObject(group);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      // Shift model so its geometric center sits at world origin
      group.position.set(-center.x, -center.y, -center.z);
      group.rotation.x = Math.PI;
      scene.add(group);
      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = camera.fov * (Math.PI / 180);
      const cz = Math.abs((maxDim / 2) / Math.tan(fov / 2));
      // Camera looks at world origin (= model center after offset)
      camera.position.set(0, 0, cz * 1.5);
      camera.lookAt(0, 0, 0);
      controls.target.set(0, 0, 0);
      controls.update();
    });
  }
  ldrawLoader.preloadMaterials('/static/ldraw/LDConfig.ldr').then(() => loadModel()).catch(() => loadModel());

  // ===== PDF BUILD GUIDE ENGINE =====
  const pdfBtn = document.getElementById('btn-pdf');
  if (!pdfBtn) return;
  const newBtn = pdfBtn.cloneNode(true);
  pdfBtn.parentNode.replaceChild(newBtn, pdfBtn);

  newBtn.addEventListener('click', async () => {
    if (!loadedModelGroup) { alert('3D model is still loading. Please wait a moment.'); return; }
    newBtn.style.opacity = '0.7';
    newBtn.disabled = true;
    const originalLabel = newBtn.innerHTML;

    const delay = ms => new Promise(r => setTimeout(r, ms));

    newBtn.textContent = 'Fetching model data…';
    let ldrText;
    try { ldrText = await fetch(ldrUrl).then(r => r.text()); }
    catch (e) {
      alert('Could not load LDR file: ' + e.message);
      newBtn.style.opacity = '1'; newBtn.disabled = false; newBtn.innerHTML = originalLabel; return;
    }

    const colorMap = {
      "0": "#05131D", "1": "#0055BF", "2": "#237841", "4": "#C91A09", "14": "#F2CD37",
      "15": "#FFFFFF", "16": "#FFFFFF", "71": "#A0A5A9", "72": "#6C6E68", "25": "#EB6400", "22": "#81007B"
    };
    const colorNameMap = {
      "0": "Black", "1": "Blue", "2": "Green", "4": "Red", "14": "Yellow", "15": "White",
      "16": "White", "71": "Lt. Gray", "72": "Dk. Gray", "25": "Orange", "22": "Purple"
    };
    const partNameMap = {
      "3024": "1x1 Plate", "3023": "1x2 Plate", "3022": "2x2 Plate", "3623": "1x3 Plate",
      "3710": "1x4 Plate", "3021": "2x3 Plate", "3020": "2x4 Plate", "3666": "1x6 Plate",
      "3034": "1x8 Plate", "3070b": "1x1 Tile", "3069b": "1x2 Tile", "3001": "2x4 Brick",
      "3003": "2x2 Brick", "3004": "1x2 Brick", "3005": "1x1 Brick", "3010": "1x4 Brick",
      "6141": "1x1 Round Plate", "4073": "1x1 Round Plate"
    };

    const partLines = [];
    ldrText.split('\n').forEach(line => {
      const t = line.trim().split(/\s+/);
      if (t[0] !== '1' || t.length < 15) return;
      partLines.push({
        y: Math.round(parseFloat(t[3])),
        colorId: t[1],
        partFile: t[14].replace(/\.(dat|ldr)$/i, ''),
        childIndex: partLines.length
      });
    });
    if (partLines.length === 0) {
      alert('No brick data found in the LDR file.');
      newBtn.style.opacity = '1'; newBtn.disabled = false; newBtn.innerHTML = originalLabel; return;
    }

    const indicesByY = {};
    partLines.forEach(p => { (indicesByY[p.y] ||= []).push(p.childIndex); });
    const sortedYs = Object.keys(indicesByY).map(Number).sort((a, b) => b - a);
    const buildSteps = [];
    for (let i = 0; i < sortedYs.length; i += 2) buildSteps.push(sortedYs.slice(i, i + 2));

    const savedCamPos = camera.position.clone();
    const savedTarget = controls.target.clone();
    const pdfBox = new THREE.Box3().setFromObject(loadedModelGroup);
    const pdfSize = pdfBox.getSize(new THREE.Vector3());
    const pdfMaxDim = Math.max(pdfSize.x, pdfSize.y, pdfSize.z);
    const pdfFov = camera.fov * (Math.PI / 180);
    const pdfDist = Math.abs((pdfMaxDim / 2) / Math.tan(pdfFov / 2)) * 1.8;
    const pdfCamPos = new THREE.Vector3(-pdfDist * 0.7, pdfDist * 0.6, pdfDist);
    controls.target.set(0, 0, 0); camera.position.copy(pdfCamPos); camera.lookAt(0, 0, 0); controls.update();

    loadedModelGroup.traverse(obj => { obj.visible = false; });
    loadedModelGroup.visible = true;

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('landscape', 'mm', 'a4');
    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = pdf.internal.pageSize.getHeight();

    // ---- v2 theme palette (matches tokens-v2.css) ----
    const C = {
      bg: [255, 255, 255], // --bg
      bgAlt: [247, 247, 249], // --bg-alt
      panel: [252, 251, 255], // soft panel
      panelEdge: [232, 232, 238], // --hairline
      navBg: [14, 14, 16],    // --nav-bg
      fg: [17, 17, 20],    // --fg
      fgDim: [90, 90, 102],   // --fg-dim
      accent: [183, 166, 232], // --accent
      accentDeep: [110, 85, 194],  // --accent-deep
      accentSoft: [239, 234, 251], // --accent-soft
      white: [255, 255, 255],
    };
    const setFill = c => pdf.setFillColor(c[0], c[1], c[2]);
    const setText = c => pdf.setTextColor(c[0], c[1], c[2]);
    const setDraw = c => pdf.setDrawColor(c[0], c[1], c[2]);

    for (let stepIdx = 0; stepIdx < buildSteps.length; stepIdx++) {
      newBtn.textContent = `Step ${stepIdx + 1} / ${buildSteps.length}`;
      await delay(30);
      const stepYs = buildSteps[stepIdx];
      const newParts = {};
      stepYs.forEach(y => {
        indicesByY[y].forEach(ci => {
          const p = partLines[ci];
          const key = p.colorId + '_' + p.partFile;
          if (!newParts[key]) {
            newParts[key] = {
              colorHex: colorMap[p.colorId] || '#aaa',
              colorName: colorNameMap[p.colorId] || ('Color ' + p.colorId),
              partName: partNameMap[p.partFile] || p.partFile,
              count: 0
            };
          }
          newParts[key].count++;
          const child = loadedModelGroup.children[ci];
          if (child) child.traverse(o => { o.visible = true; });
        });
      });

      camera.position.copy(pdfCamPos); camera.lookAt(0, 0, 0);
      controls.target.set(0, 0, 0); controls.update();
      renderer.render(scene, camera);
      await delay(20);
      const imgData = renderer.domElement.toDataURL('image/jpeg', 0.85);

      if (stepIdx > 0) pdf.addPage();

      // ===== Page background =====
      setFill(C.bg); pdf.rect(0, 0, pdfW, pdfH, 'F');

      // Soft top accent strip
      setFill(C.accentSoft);
      pdf.rect(0, 0, pdfW, 28, 'F');

      // ===== Header =====
      // Brand wordmark
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(13);
      setText(C.accentDeep);
      pdf.text('Grids2Bricks', 12, 13);

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      setText(C.fgDim);
      pdf.text('Build Guide', 12, 18.5);

      // Step pill (top-right)
      const pillW = 44, pillH = 12, pillX = pdfW - pillW - 12, pillY = 8;
      setFill(C.accentDeep);
      pdf.roundedRect(pillX, pillY, pillW, pillH, 6, 6, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      setText(C.white);
      pdf.text(
        `STEP ${stepIdx + 1} / ${buildSteps.length}`,
        pillX + pillW / 2,
        pillY + 8,
        { align: 'center' }
      );

      // Progress bar (centered between brand and pill)
      const barX = 60, barY = 14, barW = pillX - barX - 8, barH = 3;
      setFill([220, 215, 235]);
      pdf.roundedRect(barX, barY, barW, barH, 1.5, 1.5, 'F');
      setFill(C.accentDeep);
      pdf.roundedRect(barX, barY, barW * ((stepIdx + 1) / buildSteps.length), barH, 1.5, 1.5, 'F');

      // Hairline under header
      setDraw(C.panelEdge); pdf.setLineWidth(0.2);
      pdf.line(10, 30, pdfW - 10, 30);

      // ===== Layout geometry =====
      const margin = 10;
      const gap = 8;
      const panelW = 70;
      const contentTop = 36;
      const contentBottom = pdfH - 14;
      const contentH = contentBottom - contentTop;

      const imgX = margin;
      const imgY = contentTop;
      const imgW = pdfW - margin * 2 - panelW - gap;
      const imgH = contentH;

      // Image card (white with soft border + shadow strip)
      setFill(C.bgAlt);
      pdf.roundedRect(imgX, imgY, imgW, imgH, 4, 4, 'F');
      setDraw(C.panelEdge); pdf.setLineWidth(0.3);
      pdf.roundedRect(imgX, imgY, imgW, imgH, 4, 4, 'S');
      // Inset image with padding
      const pad = 4;
      pdf.addImage(imgData, 'JPEG', imgX + pad, imgY + pad, imgW - pad * 2, imgH - pad * 2);

      // ===== Right panel =====
      const panelX = pdfW - margin - panelW;
      const panelY = contentTop;
      const panelH = contentH;

      setFill(C.panel);
      pdf.roundedRect(panelX, panelY, panelW, panelH, 4, 4, 'F');
      setDraw(C.panelEdge); pdf.setLineWidth(0.3);
      pdf.roundedRect(panelX, panelY, panelW, panelH, 4, 4, 'S');

      // Panel header band
      setFill(C.accentSoft);
      pdf.roundedRect(panelX, panelY, panelW, 11, 4, 4, 'F');
      // Mask the bottom corners of the band so it looks like a top strip
      setFill(C.accentSoft);
      pdf.rect(panelX, panelY + 6, panelW, 5, 'F');

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8.5);
      setText(C.accentDeep);
      pdf.text('PARTS FOR THIS STEP', panelX + panelW / 2, panelY + 7.2, { align: 'center' });

      // ===== Parts list =====
      const partEntries = Object.values(newParts);
      const rowH = 11;
      const listTop = panelY + 16;
      const listBottom = panelY + panelH - 14;
      let partY = listTop;

      partEntries.forEach((part, i) => {
        if (partY + rowH > listBottom) return;

        // Zebra row
        if (i % 2 === 0) {
          setFill(C.bgAlt);
          pdf.roundedRect(panelX + 3, partY - 1, panelW - 6, rowH - 1, 1.5, 1.5, 'F');
        }

        // Color swatch
        const hex = part.colorHex;
        const r = parseInt(hex.slice(1, 3), 16) || 0;
        const g = parseInt(hex.slice(3, 5), 16) || 0;
        const b = parseInt(hex.slice(5, 7), 16) || 0;
        pdf.setFillColor(r, g, b);
        pdf.roundedRect(panelX + 5, partY + 1, 6, 6, 1.2, 1.2, 'F');
        setDraw(C.panelEdge); pdf.setLineWidth(0.2);
        pdf.roundedRect(panelX + 5, partY + 1, 6, 6, 1.2, 1.2, 'S');

        // Part name
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(7.5);
        setText(C.fg);
        const pname = part.partName.length > 18 ? part.partName.slice(0, 17) + '…' : part.partName;
        pdf.text(pname, panelX + 14, partY + 4);

        // Color name
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(6.2);
        setText(C.fgDim);
        pdf.text(part.colorName, panelX + 14, partY + 8);

        // Quantity badge (right-aligned)
        const qtyText = '×' + part.count;
        const badgeW = 11, badgeH = 6.5;
        const badgeX = panelX + panelW - badgeW - 5;
        const badgeY = partY + 1.5;
        setFill(C.accentDeep);
        pdf.roundedRect(badgeX, badgeY, badgeW, badgeH, 2, 2, 'F');
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(7.5);
        setText(C.white);
        pdf.text(qtyText, badgeX + badgeW / 2, badgeY + 4.7, { align: 'center' });

        partY += rowH;
      });

      // ===== Panel footer total =====
      const totalNew = partEntries.reduce((s, p) => s + p.count, 0);
      const footY = panelY + panelH - 11;
      setFill(C.accentDeep);
      pdf.roundedRect(panelX + 4, footY, panelW - 8, 8, 2, 2, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      setText(C.white);
      pdf.text(
        `${totalNew} brick${totalNew !== 1 ? 's' : ''} added this step`,
        panelX + panelW / 2,
        footY + 5.4,
        { align: 'center' }
      );

      // ===== Page footer =====
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7);
      setText(C.fgDim);
      pdf.text('grids2bricks.com', margin, pdfH - 6);
      pdf.text(
        `Page ${stepIdx + 1} of ${buildSteps.length}`,
        pdfW - margin,
        pdfH - 6,
        { align: 'right' }
      );
    }

    pdf.save('Grids2Bricks_Build_Guide.pdf');
    loadedModelGroup.traverse(obj => { obj.visible = true; });
    camera.position.copy(savedCamPos); controls.target.copy(savedTarget);
    camera.lookAt(savedTarget); controls.update(); renderer.render(scene, camera);
    newBtn.innerHTML = originalLabel; newBtn.style.opacity = '1'; newBtn.disabled = false;
  });
};

// ===== VIEW CYCLE ENGINE =====
// Supports both #btn-view-cycle (action bar) and any [data-view-cycle] inside the viewer el
const viewCycleBtns = [
  document.getElementById('btn-view-cycle'),
  ...Array.from(viewerEl.querySelectorAll('[data-view-cycle]'))
].filter(Boolean);

viewCycleBtns.forEach(btn => {
  const freshBtn = btn.cloneNode(true);
  btn.parentNode.replaceChild(freshBtn, btn);

  let currentViewIndex = 0;

  freshBtn.addEventListener('click', () => {
    if (!loadedModelGroup) return;

    const box = new THREE.Box3().setFromObject(loadedModelGroup);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    const cz = Math.abs((maxDim / 2) / Math.tan(fov / 2));
    const d = cz * 1.5;

    // All views look at world origin (= model center)
    const views = [
      new THREE.Vector3(0, 0, d),              // Front (default)
      new THREE.Vector3(-d * 0.8, 0, d * 0.8), // Left corner
      new THREE.Vector3(d * 0.8, 0, d * 0.8),  // Right corner
      new THREE.Vector3(0, 0, -d),              // Back
      new THREE.Vector3(0, d * 1.3, 0),         // Top
    ];

    currentViewIndex = (currentViewIndex + 1) % views.length;
    controls.target.set(0, 0, 0);
    camera.position.copy(views[currentViewIndex]);
    camera.lookAt(0, 0, 0);
    controls.update();
  });
});

