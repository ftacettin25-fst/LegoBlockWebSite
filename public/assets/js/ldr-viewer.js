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
      // Rotate FIRST so bounding box is measured in final orientation
      group.rotation.x = Math.PI;
      const box = new THREE.Box3().setFromObject(group);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      // Shift so geometric center sits exactly at world origin
      group.position.set(-center.x, -center.y, -center.z);
      scene.add(group);
      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = camera.fov * (Math.PI / 180);
      const cz = Math.abs((maxDim / 2) / Math.tan(fov / 2));
      // Pull back enough to see full model; slight positive Y so head isn't clipped
      camera.position.set(0, maxDim * 0.08, cz * 2.0);
      camera.lookAt(0, 0, 0);
      controls.target.set(0, 0, 0);
      controls.update();
    });
  }
  ldrawLoader.preloadMaterials('/static/ldraw/LDConfig.ldr').then(() => loadModel()).catch(() => loadModel());

  // ===== PDF BUILD GUIDE ENGINE (create page only) =====
  const pdfBtn = document.getElementById('btn-pdf');
  if (pdfBtn) {
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

      // --- Helper: render from a camera pos, crop center strip, return dataURL ---
      const renderCropped = async (camPos, cropFrac = 0.55) => {
        camera.position.copy(camPos); camera.lookAt(0, 0, 0);
        controls.target.set(0, 0, 0); controls.update();
        renderer.render(scene, camera);
        await delay(20);
        const raw = renderer.domElement;
        const srcW = raw.width, srcH = raw.height;
        const cropW = Math.floor(srcW * cropFrac);
        const cropX = Math.floor((srcW - cropW) / 2);
        const cv = document.createElement('canvas');
        cv.width = cropW; cv.height = srcH;
        cv.getContext('2d').drawImage(raw, cropX, 0, cropW, srcH, 0, 0, cropW, srcH);
        return cv.toDataURL('image/jpeg', 0.88);
      };

      // Camera positions for the two PDF views
      const pdfBox = new THREE.Box3().setFromObject(loadedModelGroup);
      const pdfSize = pdfBox.getSize(new THREE.Vector3());
      const pdfMaxDim = Math.max(pdfSize.x, pdfSize.y, pdfSize.z);
      const pdfFov = camera.fov * (Math.PI / 180);
      const pdfD = Math.abs((pdfMaxDim / 2) / Math.tan(pdfFov / 2)) * 2.0;
      const camLeft = new THREE.Vector3(-pdfD * 0.7, pdfMaxDim * 0.4, pdfD * 0.7);
      const camRight = new THREE.Vector3(pdfD * 0.7, pdfMaxDim * 0.4, pdfD * 0.7);

      loadedModelGroup.traverse(obj => { obj.visible = false; });
      loadedModelGroup.visible = true;

      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF('landscape', 'mm', 'a4');
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = pdf.internal.pageSize.getHeight();

      // ---- v2 theme palette ----
      const C = {
        bg: [255, 255, 255], bgAlt: [247, 247, 249], panel: [252, 251, 255],
        panelEdge: [232, 232, 238], fg: [17, 17, 20], fgDim: [90, 90, 102],
        accentDeep: [110, 85, 194], accentSoft: [239, 234, 251], white: [255, 255, 255],
      };
      const setFill = c => pdf.setFillColor(c[0], c[1], c[2]);
      const setText = c => pdf.setTextColor(c[0], c[1], c[2]);
      const setDraw = c => pdf.setDrawColor(c[0], c[1], c[2]);

      // ===== START COVER =====
      setFill(C.accentDeep); pdf.rect(0, 0, pdfW, pdfH, 'F');
      // Decorative diagonal band
      setFill(C.accentSoft);
      pdf.triangle(0, pdfH * 0.45, pdfW * 0.6, pdfH, 0, pdfH, 'F');
      // Brand
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(36);
      setText(C.white);
      pdf.text('Grids2Bricks', pdfW / 2, pdfH * 0.35, { align: 'center' });
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(16);
      setText(C.accentSoft);
      pdf.text('BrickHeadz Build Guide', pdfW / 2, pdfH * 0.35 + 14, { align: 'center' });
      // Date
      pdf.setFontSize(9); setText(C.accentSoft);
      pdf.text(new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), pdfW / 2, pdfH * 0.35 + 26, { align: 'center' });
      // Steps count pill
      const totalBricks = partLines.length;
      setFill(C.white);
      pdf.roundedRect(pdfW / 2 - 50, pdfH * 0.65, 100, 14, 7, 7, 'F');
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10);
      setText(C.accentDeep);
      pdf.text(`${buildSteps.length} build steps  ·  ${totalBricks} bricks`, pdfW / 2, pdfH * 0.65 + 9.5, { align: 'center' });
      // Footer
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8);
      setText(C.accentSoft);
      pdf.text('grids2bricks.com', pdfW / 2, pdfH - 10, { align: 'center' });

      // ===== BUILD STEPS =====
      const margin = 10, gap = 6, panelW = 66;
      const contentTop = 33, contentH = pdfH - contentTop - 12;

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

        const imgLeft = await renderCropped(camLeft, 0.55);
        const imgRight = await renderCropped(camRight, 0.55);

        pdf.addPage();

        // Header strip
        setFill(C.accentSoft); pdf.rect(0, 0, pdfW, 28, 'F');
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(13);
        setText(C.accentDeep); pdf.text('Grids2Bricks', 12, 13);
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8);
        setText(C.fgDim); pdf.text('Build Guide', 12, 19);
        // Step pill
        const pillW = 44, pillH = 12, pillX = pdfW - pillW - 12, pillY = 8;
        setFill(C.accentDeep); pdf.roundedRect(pillX, pillY, pillW, pillH, 6, 6, 'F');
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10);
        setText(C.white);
        pdf.text(`STEP ${stepIdx + 1} / ${buildSteps.length}`, pillX + pillW / 2, pillY + 8, { align: 'center' });
        // Progress bar
        const barX = 58, barY = 14, barW = pillX - barX - 8, barH = 3;
        setFill([220, 215, 235]); pdf.roundedRect(barX, barY, barW, barH, 1.5, 1.5, 'F');
        setFill(C.accentDeep); pdf.roundedRect(barX, barY, barW * ((stepIdx + 1) / buildSteps.length), barH, 1.5, 1.5, 'F');
        setDraw(C.panelEdge); pdf.setLineWidth(0.2); pdf.line(10, 30, pdfW - 10, 30);

        // Two image cards side by side
        const imgAreaW = pdfW - margin * 2 - panelW - gap;
        const halfW = (imgAreaW - gap) / 2;
        const imgH2 = contentH;

        setFill(C.bgAlt);
        pdf.roundedRect(margin, contentTop, halfW, imgH2, 3, 3, 'F');
        pdf.roundedRect(margin + halfW + gap, contentTop, halfW, imgH2, 3, 3, 'F');
        const pad = 2;
        pdf.addImage(imgLeft, 'JPEG', margin + pad, contentTop + pad, halfW - pad * 2, imgH2 - pad * 2);
        pdf.addImage(imgRight, 'JPEG', margin + halfW + gap + pad, contentTop + pad, halfW - pad * 2, imgH2 - pad * 2);
        // View labels
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(6.5);
        setText(C.fgDim);
        pdf.text('Left corner', margin + halfW / 2, contentTop + imgH2 - 1, { align: 'center' });
        pdf.text('Right corner', margin + halfW + gap + halfW / 2, contentTop + imgH2 - 1, { align: 'center' });

        // Right panel
        const panelX = pdfW - margin - panelW;
        setFill(C.panel); pdf.roundedRect(panelX, contentTop, panelW, contentH, 4, 4, 'F');
        setDraw(C.panelEdge); pdf.setLineWidth(0.3); pdf.roundedRect(panelX, contentTop, panelW, contentH, 4, 4, 'S');
        setFill(C.accentSoft); pdf.roundedRect(panelX, contentTop, panelW, 11, 4, 4, 'F');
        setFill(C.accentSoft); pdf.rect(panelX, contentTop + 6, panelW, 5, 'F');
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7.5);
        setText(C.accentDeep);
        pdf.text('PARTS', panelX + panelW / 2, contentTop + 7.5, { align: 'center' });

        // Parts list
        const partEntries = Object.values(newParts);
        const rowH = 11, listTop = contentTop + 15, listBottom = contentTop + contentH - 13;
        let partY = listTop;
        partEntries.forEach((part, i) => {
          if (partY + rowH > listBottom) return;
          if (i % 2 === 0) { setFill(C.bgAlt); pdf.roundedRect(panelX + 3, partY - 1, panelW - 6, rowH - 1, 1.5, 1.5, 'F'); }
          const hex = part.colorHex;
          const r = parseInt(hex.slice(1, 3), 16) || 0, g = parseInt(hex.slice(3, 5), 16) || 0, b = parseInt(hex.slice(5, 7), 16) || 0;
          pdf.setFillColor(r, g, b); pdf.roundedRect(panelX + 5, partY + 1, 6, 6, 1.2, 1.2, 'F');
          setDraw(C.panelEdge); pdf.setLineWidth(0.2); pdf.roundedRect(panelX + 5, partY + 1, 6, 6, 1.2, 1.2, 'S');
          pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7); setText(C.fg);
          pdf.text(part.partName.length > 17 ? part.partName.slice(0, 16) + '…' : part.partName, panelX + 14, partY + 4);
          pdf.setFont('helvetica', 'normal'); pdf.setFontSize(6); setText(C.fgDim);
          pdf.text(part.colorName, panelX + 14, partY + 8);
          const bW = 10, bH = 6, bX = panelX + panelW - bW - 4, bY = partY + 2;
          setFill(C.accentDeep); pdf.roundedRect(bX, bY, bW, bH, 2, 2, 'F');
          pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7); setText(C.white);
          pdf.text('×' + part.count, bX + bW / 2, bY + 4.5, { align: 'center' });
          partY += rowH;
        });
        // Panel total
        const totalNew = partEntries.reduce((s, p) => s + p.count, 0);
        const footY = contentTop + contentH - 10;
        setFill(C.accentDeep); pdf.roundedRect(panelX + 4, footY, panelW - 8, 8, 2, 2, 'F');
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7.5); setText(C.white);
        pdf.text(`${totalNew} brick${totalNew !== 1 ? 's' : ''} added`, panelX + panelW / 2, footY + 5.2, { align: 'center' });

        // Footer
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(6.5); setText(C.fgDim);
        pdf.text('grids2bricks.com', margin, pdfH - 5);
        pdf.text(`Page ${stepIdx + 2} of ${buildSteps.length + 2}`, pdfW - margin, pdfH - 5, { align: 'right' });
      }

      // ===== END COVER =====
      pdf.addPage();
      setFill(C.accentDeep); pdf.rect(0, 0, pdfW, pdfH, 'F');
      setFill(C.accentSoft);
      pdf.triangle(pdfW, 0, pdfW, pdfH * 0.55, pdfW * 0.4, 0, 'F');
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(28);
      setText(C.white); pdf.text('Your build is ready!', pdfW / 2, pdfH * 0.38, { align: 'center' });
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(12);
      setText(C.accentSoft);
      pdf.text('Happy building — one brick at a time.', pdfW / 2, pdfH * 0.38 + 16, { align: 'center' });
      setFill(C.white); pdf.roundedRect(pdfW / 2 - 48, pdfH * 0.62, 96, 13, 6, 6, 'F');
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(11); setText(C.accentDeep);
      pdf.text('grids2bricks.com', pdfW / 2, pdfH * 0.62 + 9.3, { align: 'center' });
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); setText(C.accentSoft);
      pdf.text(`${buildSteps.length} steps  ·  ${partLines.length} bricks total`, pdfW / 2, pdfH * 0.80, { align: 'center' });

      pdf.save('Grids2Bricks_Build_Guide.pdf');
      loadedModelGroup.traverse(obj => { obj.visible = true; });
      camera.position.copy(savedCamPos); controls.target.copy(savedTarget);
      camera.lookAt(savedTarget); controls.update(); renderer.render(scene, camera);
      newBtn.innerHTML = originalLabel; newBtn.style.opacity = '1'; newBtn.disabled = false;
    });
  } // end if (pdfBtn)


  // ===== VIEW CYCLE ENGINE =====
  const viewCycleBtns = [
    document.getElementById('btn-view-cycle'),
    ...Array.from((viewerEl.parentElement || document).querySelectorAll('[data-view-cycle]'))
  ].filter(Boolean);

  viewCycleBtns.forEach(btn => {
    const freshBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(freshBtn, btn);
    // Start at 2 so first click wraps to 0 (Front)
    let currentViewIndex = 2;

    freshBtn.addEventListener('click', () => {
      if (!loadedModelGroup) return;
      const box = new THREE.Box3().setFromObject(loadedModelGroup);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = camera.fov * (Math.PI / 180);
      const d = Math.abs((maxDim / 2) / Math.tan(fov / 2)) * 2.0;
      const views = [
        new THREE.Vector3(0, maxDim * 0.08, d),              // Front
        new THREE.Vector3(-d * 0.7, maxDim * 0.4, d * 0.7), // Left-top corner
        new THREE.Vector3(d * 0.7, maxDim * 0.4, d * 0.7),  // Right-top corner
      ];
      currentViewIndex = (currentViewIndex + 1) % views.length;
      controls.target.set(0, 0, 0);
      camera.position.copy(views[currentViewIndex]);
      camera.lookAt(0, 0, 0);
      controls.update();
    });
  });
};
