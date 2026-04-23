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
      group.position.set(-center.x, -center.y, -center.z);
      group.rotation.x = Math.PI;
      scene.add(group);
      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = camera.fov * (Math.PI / 180);
      const cz = Math.abs((maxDim / 2) / Math.tan(fov / 2));
      camera.position.set(0, maxDim / 2, cz * 1.5);
      camera.lookAt(0, 0, 0); controls.target.set(0, 0, 0); controls.update();
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
      "0":"#05131D","1":"#0055BF","2":"#237841","4":"#C91A09","14":"#F2CD37",
      "15":"#FFFFFF","16":"#FFFFFF","71":"#A0A5A9","72":"#6C6E68","25":"#EB6400","22":"#81007B"
    };
    const colorNameMap = {
      "0":"Black","1":"Blue","2":"Green","4":"Red","14":"Yellow","15":"White",
      "16":"White","71":"Lt. Gray","72":"Dk. Gray","25":"Orange","22":"Purple"
    };
    const partNameMap = {
      "3024":"1x1 Plate","3023":"1x2 Plate","3022":"2x2 Plate","3623":"1x3 Plate",
      "3710":"1x4 Plate","3021":"2x3 Plate","3020":"2x4 Plate","3666":"1x6 Plate",
      "3034":"1x8 Plate","3070b":"1x1 Tile","3069b":"1x2 Tile","3001":"2x4 Brick",
      "3003":"2x2 Brick","3004":"1x2 Brick","3005":"1x1 Brick","3010":"1x4 Brick",
      "6141":"1x1 Round Plate","4073":"1x1 Round Plate"
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
      pdf.setFillColor(10, 10, 15); pdf.rect(0, 0, pdfW, pdfH, 'F');
      pdf.setFillColor(139, 92, 246); pdf.roundedRect(10, 8, 38, 14, 3, 3, 'F');
      pdf.setFontSize(16); pdf.setTextColor(255, 255, 255); pdf.setFont('helvetica', 'bold');
      pdf.text('STEP ' + (stepIdx + 1), 29, 18, { align: 'center' });
      pdf.setFontSize(9); pdf.setTextColor(160, 160, 180); pdf.setFont('helvetica', 'normal');
      pdf.text('Grids2Bricks Build Guide', pdfW / 2, 18, { align: 'center' });

      const barX = 52, barY = 13, barW = pdfW - 62 - 68, barH = 4;
      pdf.setFillColor(40, 40, 60); pdf.roundedRect(barX, barY, barW, barH, 2, 2, 'F');
      pdf.setFillColor(139, 92, 246);
      pdf.roundedRect(barX, barY, barW * ((stepIdx + 1) / buildSteps.length), barH, 2, 2, 'F');

      const imgX = 10, imgY = 26, imgW = pdfW - 80, imgH = pdfH - 36;
      pdf.addImage(imgData, 'JPEG', imgX, imgY, imgW, imgH);

      const panelX = pdfW - 66, panelY = 26, panelW = 60, panelH = pdfH - 36;
      pdf.setFillColor(20, 20, 29); pdf.roundedRect(panelX, panelY, panelW, panelH, 3, 3, 'F');

      pdf.setFontSize(7.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(200, 160, 255);
      pdf.text('ADD THIS STEP', panelX + panelW / 2, panelY + 8, { align: 'center' });
      pdf.setDrawColor(139, 92, 246); pdf.setLineWidth(0.3);
      pdf.line(panelX + 4, panelY + 11, panelX + panelW - 4, panelY + 11);

      let partY = panelY + 17;
      const partEntries = Object.values(newParts);
      partEntries.forEach(part => {
        if (partY > panelY + panelH - 12) return;
        const hex = part.colorHex;
        const r = parseInt(hex.slice(1, 3), 16) || 0;
        const g = parseInt(hex.slice(3, 5), 16) || 0;
        const b = parseInt(hex.slice(5, 7), 16) || 0;
        pdf.setFillColor(r, g, b); pdf.roundedRect(panelX + 4, partY - 3.5, 6, 5, 1, 1, 'F');
        pdf.setDrawColor(100, 100, 120); pdf.setLineWidth(0.2);
        pdf.roundedRect(panelX + 4, partY - 3.5, 6, 5, 1, 1, 'S');
        pdf.setFillColor(139, 92, 246); pdf.roundedRect(panelX + 12, partY - 3.5, 8, 5, 1, 1, 'F');
        pdf.setFontSize(6.5); pdf.setTextColor(255, 255, 255); pdf.setFont('helvetica', 'bold');
        pdf.text('x' + part.count, panelX + 16, partY + 0.5, { align: 'center' });
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(6.5); pdf.setTextColor(210, 210, 230);
        const pname = part.partName.length > 14 ? part.partName.slice(0, 13) + '…' : part.partName;
        pdf.text(pname, panelX + 22, partY + 0.5);
        pdf.setFontSize(5.5); pdf.setTextColor(140, 140, 160);
        pdf.text(part.colorName, panelX + 22, partY + 5);
        partY += 13;
      });

      const totalNew = partEntries.reduce((s, p) => s + p.count, 0);
      pdf.setFillColor(40, 40, 60);
      pdf.roundedRect(panelX + 4, panelY + panelH - 10, panelW - 8, 8, 2, 2, 'F');
      pdf.setFontSize(7); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(200, 200, 220);
      pdf.text(totalNew + ' brick' + (totalNew !== 1 ? 's' : '') + ' added',
        panelX + panelW / 2, panelY + panelH - 5.5, { align: 'center' });
    }

    pdf.save('Grids2Bricks_Build_Guide.pdf');
    loadedModelGroup.traverse(obj => { obj.visible = true; });
    camera.position.copy(savedCamPos); controls.target.copy(savedTarget);
    camera.lookAt(savedTarget); controls.update(); renderer.render(scene, camera);
    newBtn.innerHTML = originalLabel; newBtn.style.opacity = '1'; newBtn.disabled = false;
  });

  // ===== VIEW CYCLE ENGINE =====
  const viewCycleBtn = document.getElementById('btn-view-cycle');
  if (viewCycleBtn) {
    const newViewBtn = viewCycleBtn.cloneNode(true);
    viewCycleBtn.parentNode.replaceChild(newViewBtn, viewCycleBtn);
    
    let currentViewIndex = 0;
    
    newViewBtn.addEventListener('click', () => {
      if (!loadedModelGroup) { alert('3D model is still loading. Please wait a moment.'); return; }
      
      const box = new THREE.Box3().setFromObject(loadedModelGroup);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = camera.fov * (Math.PI / 180);
      const cz = Math.abs((maxDim / 2) / Math.tan(fov / 2));
      const dist = cz * 1.5;
      
      const views = [
        new THREE.Vector3(-dist * 0.8, maxDim / 2, dist * 0.8), // Left Corner
        new THREE.Vector3(dist * 0.8, maxDim / 2, dist * 0.8), // Right Corner
        new THREE.Vector3(0, maxDim / 2, -dist), // Back
        new THREE.Vector3(0, dist * 1.2, 0), // Top
        new THREE.Vector3(0, maxDim / 2, dist) // Front (default)
      ];
      
      currentViewIndex = (currentViewIndex + 1) % views.length;
      
      controls.target.set(0, 0, 0);
      camera.position.copy(views[currentViewIndex]);
      camera.lookAt(0, 0, 0);
      controls.update();
    });
  }
};
