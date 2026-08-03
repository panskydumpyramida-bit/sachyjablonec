// ============================================================
// Form Scanner – client-side přihlášky ŠSČR
// ============================================================

let cvReady = false;
let mode = 1;
let srcImage = null;
let points = [];

const canvas = document.getElementById('imageCanvas');
const ctx = canvas ? canvas.getContext('2d') : null;
const outputCanvas = document.getElementById('outputCanvas');
const fileInput = document.getElementById('fileInput');
const loadingSpinner = document.getElementById('loadingOpencv');
const appControls = document.getElementById('appControls');
const step2 = document.getElementById('step2');
const step3 = document.getElementById('step3');
const actionArea = document.getElementById('actionArea');
const resetBtn = document.getElementById('resetPointsBtn');
const processBtn = document.getElementById('processBtn');
const downloadBtn = document.getElementById('downloadBtn');
const statusText = document.getElementById('statusText');
const spinner = document.getElementById('spinner');
const overlaysDiv = document.getElementById('overlays');
const interactiveContainer = document.getElementById('interactiveContainer');

// Rozměry posledního výstupu (pro createOverlays)
let lastDstW = 1190;
let lastDstH = 842;

// Stejné oficiální razítko používá generátor členských přihlášek.
const STAMP_DATA_URL = "/src/assets/razitko-oficialni-transparent.png?v=transparent-1";

// ============================================================
// OpenCV – script se načte dřív než jeho WASM runtime (hlavně v Safari).
// ============================================================
let cvInitTimer = null;
let cvInitStartedAt = 0;
let observedCvPromise = null;

function isOpenCvUsable(api) {
    return !!api
        && typeof api.Mat === 'function'
        && typeof api.imread === 'function'
        && typeof api.warpPerspective === 'function';
}

function markOpenCvReady(api) {
    if (!isOpenCvUsable(api)) return false;
    window.cv = api;
    cvReady = true;
    clearTimeout(cvInitTimer);
    console.log('OpenCV.js runtime ready');
    if (loadingSpinner) loadingSpinner.style.display = 'none';
    if (appControls) appControls.style.display = 'flex';
    if (processBtn) processBtn.disabled = false;
    return true;
}

function showOpenCvError() {
    if (cvReady) return;
    clearTimeout(cvInitTimer);
    if (loadingSpinner) {
        loadingSpinner.innerHTML =
            '<div style="color:#fca5a5;margin-bottom:.75rem;">Analýzu obrazu se nepodařilo načíst.</div>' +
            '<button type="button" id="reloadOpenCvBtn" class="btn-secondary">Zkusit znovu</button>';
        const reloadBtn = document.getElementById('reloadOpenCvBtn');
        if (reloadBtn) reloadBtn.addEventListener('click', () => window.location.reload());
    }
    if (statusText) statusText.innerText = 'OpenCV se nepodařilo načíst. Obnovte stránku a zkuste to znovu.';
}

function checkOpenCvRuntime() {
    if (cvReady) return;
    if (!cvInitStartedAt) cvInitStartedAt = Date.now();

    const api = window.cv;
    if (markOpenCvReady(api)) return;

    // Některé buildy OpenCV 4.x vracejí místo hotového API Promise.
    if (api && typeof api.then === 'function' && observedCvPromise !== api) {
        observedCvPromise = api;
        try {
            api.then((resolvedApi) => {
                if (!markOpenCvReady(resolvedApi)) checkOpenCvRuntime();
            });
        } catch (err) {
            console.error('OpenCV initialization error:', err);
            showOpenCvError();
        }
    }

    if (Date.now() - cvInitStartedAt > 30000) {
        showOpenCvError();
        return;
    }
    clearTimeout(cvInitTimer);
    cvInitTimer = setTimeout(checkOpenCvRuntime, 100);
}

// OpenCV používá tento callback po skutečném dokončení inicializace WASM.
window.Module = window.Module || {};
const previousRuntimeCallback = window.Module.onRuntimeInitialized;
window.Module.onRuntimeInitialized = function () {
    if (typeof previousRuntimeCallback === 'function') previousRuntimeCallback();
    checkOpenCvRuntime();
};

window.onOpenCvScriptLoaded = function () {
    checkOpenCvRuntime();
};

window.onOpenCvScriptError = function () {
    showOpenCvError();
};

if (processBtn) processBtn.disabled = true;

// ============================================================
// Mode
// ============================================================
window.setMode = function (m) {
    mode = m;
    document.getElementById('mode1').classList.toggle('active', m === 1);
    document.getElementById('mode2').classList.toggle('active', m === 2);
};

// ============================================================
// Image upload
// ============================================================
if (fileInput) {
    fileInput.addEventListener('change', (e) => {
        if (!e.target.files.length) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            srcImage = new Image();
            srcImage.onload = () => {
                canvas.width = srcImage.width;
                canvas.height = srcImage.height;
                points = [];
                resetBtn.style.display = 'none';
                actionArea.style.display = 'none';
                downloadBtn.classList.add('hidden');
                if (interactiveContainer) interactiveContainer.style.display = 'none';
                canvas.style.display = 'block';
                step2.style.opacity = '1';
                step2.style.pointerEvents = 'auto';
                step3.style.opacity = '1';
                drawState();
                statusText.innerText = 'Obrázek načten. Vyberte 4 rohy papíru.';
            };
            srcImage.src = ev.target.result;
        };
        reader.readAsDataURL(e.target.files[0]);
    });
}

// ============================================================
// Canvas – kreslení
// ============================================================
function drawState() {
    if (!srcImage) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(srcImage, 0, 0);

    const lw = Math.max(4, canvas.width * 0.004);
    ctx.lineWidth = lw;
    ctx.strokeStyle = '#00ff00';
    const r = Math.max(12, canvas.width * 0.008);

    for (let i = 0; i < points.length; i++) {
        if (i > 0) {
            ctx.beginPath();
            ctx.moveTo(points[i - 1].x, points[i - 1].y);
            ctx.lineTo(points[i].x, points[i].y);
            ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(points[i].x, points[i].y, r, 0, 2 * Math.PI);
        ctx.fillStyle = 'red';
        ctx.fill();
        ctx.stroke();
        ctx.font = `bold ${r * 2.5}px Arial`;
        ctx.fillStyle = '#fff';
        ctx.fillText(String(i + 1), points[i].x + r * 1.2, points[i].y - r * 0.8);
    }
    if (points.length === 4) {
        ctx.beginPath();
        ctx.moveTo(points[3].x, points[3].y);
        ctx.lineTo(points[0].x, points[0].y);
        ctx.stroke();
    }

    const labels = ['Levý horní roh', 'Pravý horní roh', 'Pravý dolní roh', 'Levý dolní roh'];
    for (let i = 0; i < 4; i++) {
        const li = document.getElementById('ptr' + i);
        if (!li) continue;
        if (points[i]) {
            li.innerHTML = '<i class="fa-solid fa-check-circle" style="color:#10b981;"></i> Bod ' + (i + 1) + ' zaznamenán';
            li.style.color = '#10b981';
        } else {
            li.innerHTML = '<i class="fa-regular fa-circle"></i> ' + labels[i];
            li.style.color = '#a0a0a0';
        }
    }
    if (points.length > 0) resetBtn.style.display = 'flex';
    if (points.length === 4) actionArea.style.display = 'block';
}

// ============================================================
// Canvas – klikání bodů
// ============================================================
if (canvas) {
    canvas.addEventListener('click', (e) => {
        if (!srcImage || points.length >= 4) return;
        const rect = canvas.getBoundingClientRect();
        points.push({
            x: (e.clientX - rect.left) * (canvas.width / rect.width),
            y: (e.clientY - rect.top) * (canvas.height / rect.height),
        });
        drawState();
        if (points.length === 4)
            statusText.innerText = 'Všechny rohy vybrány! Stiskněte Vygenerovat.';
    });
}

window.resetPoints = function () {
    points = [];
    actionArea.style.display = 'none';
    downloadBtn.classList.add('hidden');
    drawState();
    statusText.innerText = 'Body smazány. Vyberte znovu 4 rohy.';
};

// ============================================================
// Tlačítko Vygenerovat
// ============================================================
if (processBtn) {
    processBtn.addEventListener('click', () => {
        console.log('Process clicked, cvReady=' + cvReady + ', points=' + points.length);
        if (!cvReady || !isOpenCvUsable(window.cv)) {
            checkOpenCvRuntime();
            statusText.innerText = 'OpenCV se ještě načítá, počkejte…';
            return;
        }
        if (points.length !== 4) {
            statusText.innerText = 'Vyberte nejdřív 4 rohy!';
            return;
        }
        spinner.style.display = 'block';
        statusText.innerText = 'Zpracovávám…';
        setTimeout(doWarp, 100);
    });
}

// ============================================================
// orderPoints – replika Pythonu (sum / diff)
// ============================================================
function orderPoints(pts) {
    const arr = pts.map((p) => [p.x, p.y]);
    const sums = arr.map((p) => p[0] + p[1]);
    const diffs = arr.map((p) => p[0] - p[1]);

    const tl = arr[sums.indexOf(Math.min(...sums))];
    const br = arr[sums.indexOf(Math.max(...sums))];
    const tr = arr[diffs.indexOf(Math.max(...diffs))];
    const bl = arr[diffs.indexOf(Math.min(...diffs))];

    return [
        { x: tl[0], y: tl[1] },
        { x: tr[0], y: tr[1] },
        { x: br[0], y: br[1] },
        { x: bl[0], y: bl[1] },
    ];
}

// ============================================================
// Perspektivní transformace
// ============================================================
async function doWarp() {
    try {
        const cvApi = window.cv;
        if (!isOpenCvUsable(cvApi)) {
            throw new Error('Analýza obrazu ještě není připravená. Zkuste to za chvíli znovu.');
        }
        const ordered = orderPoints(points);

        // Čistý canvas bez nakreslených bodů
        const tmpCanvas = document.createElement('canvas');
        tmpCanvas.width = srcImage.width;
        tmpCanvas.height = srcImage.height;
        tmpCanvas.getContext('2d').drawImage(srcImage, 0, 0);

        const src = cvApi.imread(tmpCanvas);

        const dstW = 1190;
        const dstH = mode === 1 ? 842 : 1684;
        lastDstW = dstW;
        lastDstH = dstH;

        const dst = new cvApi.Mat();

        const srcCoords = cvApi.matFromArray(4, 1, cvApi.CV_32FC2, [
            ordered[0].x, ordered[0].y,
            ordered[1].x, ordered[1].y,
            ordered[2].x, ordered[2].y,
            ordered[3].x, ordered[3].y,
        ]);
        const dstCoords = cvApi.matFromArray(4, 1, cvApi.CV_32FC2, [
            0, 0,  dstW - 1, 0,  dstW - 1, dstH - 1,  0, dstH - 1,
        ]);

        const M = cvApi.getPerspectiveTransform(srcCoords, dstCoords);
        cvApi.warpPerspective(src, dst, M, new cvApi.Size(dstW, dstH),
            cvApi.INTER_LINEAR, cvApi.BORDER_CONSTANT, new cvApi.Scalar());

        // Zviditelnit kontejner a vykreslit
        canvas.style.display = 'none';
        interactiveContainer.style.display = 'block';
        outputCanvas.width = dstW;
        outputCanvas.height = dstH;
        cvApi.imshow('outputCanvas', dst);

        src.delete(); dst.delete(); M.delete();
        srcCoords.delete(); dstCoords.delete();

        createOverlays();
        await waitForStampImages();

        spinner.style.display = 'none';
        statusText.innerText = 'Hotovo! Posuňte prvky myší, smažte křížkem ×, pak stáhněte.';

        downloadBtn.onclick = function () { bakeAndDownload(); };
        downloadBtn.classList.remove('hidden');

    } catch (err) {
        console.error('Chyba warp:', err);
        statusText.innerText = 'Chyba: ' + err.message;
        spinner.style.display = 'none';
    }
}

function waitForStampImages() {
    const stampImages = Array.from(overlaysDiv.querySelectorAll('.stamp-img'));
    return Promise.all(stampImages.map((img) => {
        if (img.complete) {
            return img.naturalWidth > 0
                ? Promise.resolve()
                : Promise.reject(new Error('Oficiální razítko se nepodařilo načíst.'));
        }
        return new Promise((resolve, reject) => {
            img.addEventListener('load', resolve, { once: true });
            img.addEventListener('error', () => reject(new Error('Oficiální razítko se nepodařilo načíst.')), { once: true });
        });
    }));
}

// ============================================================
// Tvorba overlay prvků
// ============================================================
function createOverlays() {
    overlaysDiv.innerHTML = '';

    const offsets = mode === 1 ? [0] : [0, 714];

    offsets.forEach((offset) => {
        addOverlay('text', 'TJ Bižuterie Jablonec n.Nisou', 360, 268 + offset, { fontScale: 32 });
        addOverlay('text', '17052', 1020, 250 + offset, { fontScale: 38 });
        if (STAMP_DATA_URL) addOverlay('stamp', STAMP_DATA_URL, lastDstW / 2, lastDstH / 2 + offset, { w: 360, h: 120 });
        addOverlay('signature', 'Duda', lastDstW / 2, lastDstH / 2 + 82 + offset, { fontScale: 62 });
        addOverlay('cross', '✕', lastDstW / 2, lastDstH * 0.72 + offset, { fontScale: 28 });
    });

    updateScales();
}

// Univerzální funkce pro přidání overlay prvku
function addOverlay(type, content, cx, cy, opts) {
    const el = document.createElement('div');
    el.className = 'draggable-item';
    el.dataset.type = type;
    el.style.left = (cx / outputCanvas.width * 100) + '%';
    el.style.top = (cy / outputCanvas.height * 100) + '%';

    if (type === 'text' || type === 'cross' || type === 'signature') {
        el.dataset.text = content;
        el.dataset.fontScale = opts.fontScale || 32;
        if (type === 'signature') {
            el.innerHTML =
                '<span class="signature-text">' + content + '</span>' +
                '<span class="delete-btn" title="Odstranit"><i class="fa-solid fa-xmark"></i></span>';
            overlaysDiv.appendChild(el);
            return;
        }
        const isBold = type === 'cross';
        el.innerHTML =
            '<span class="draggable-text" style="' +
            'font-family:' + (type === 'cross' ? 'Arial,sans-serif' : "'Arial Narrow',Arial,sans-serif") + ';' +
            'font-weight:' + (isBold ? '700' : '500') + ';' +
            'color:#001450;white-space:nowrap;">' +
            content + '</span>' +
            '<span class="delete-btn" title="Odstranit"><i class="fa-solid fa-xmark"></i></span>';
    } else if (type === 'stamp') {
        el.dataset.w = opts.w;
        el.dataset.h = opts.h;
        // Vypočítat aktuální zobrazovací rozměry - musí být nastaveny hned,
        // jinak se 1024x1024 obrázek vykreslí v plné velikosti a přeteče z overflow:hidden
        const containerW = interactiveContainer.clientWidth || outputCanvas.width;
        const displayScale = containerW / outputCanvas.width;
        const dispW = Math.max(40, opts.w * displayScale);
        const dispH = Math.max(20, opts.h * displayScale);
        el.innerHTML =
            '<img src="' + content + '" class="stamp-img" style="width:' + dispW + 'px;height:' + dispH + 'px;">' +
            '<span class="delete-btn" title="Odstranit"><i class="fa-solid fa-xmark"></i></span>';
    }

    overlaysDiv.appendChild(el);
}

// ============================================================
// Škálování prvků podle velikosti canvasu na obrazovce
// ============================================================
function updateScales() {
    if (!outputCanvas || outputCanvas.width === 0) return;
    const containerW = interactiveContainer.clientWidth;
    if (containerW === 0) return;
    const scale = containerW / outputCanvas.width;

    document.querySelectorAll('.draggable-item').forEach((el) => {
        const type = el.dataset.type;
        if (type === 'text' || type === 'cross' || type === 'signature') {
            const fs = parseFloat(el.dataset.fontScale);
            const txt = el.querySelector(type === 'signature' ? '.signature-text' : '.draggable-text');
            if (txt) txt.style.fontSize = Math.max(10, fs * scale) + 'px';
        } else if (type === 'stamp') {
            const w = parseFloat(el.dataset.w);
            const h = parseFloat(el.dataset.h);
            const img = el.querySelector('.stamp-img');
            if (img) {
                img.style.width = Math.max(40, w * scale) + 'px';
                img.style.height = Math.max(20, h * scale) + 'px';
            }
        }
    });
}
window.addEventListener('resize', updateScales);

// ============================================================
// Drag & Drop (pointer events – funguje i na mobilu)
// ============================================================
let dragging = null;
let dragOx = 0, dragOy = 0;
let dragScrollY = 0;

function lockPageScroll() {
    dragScrollY = window.scrollY;
    document.documentElement.classList.add('scanner-drag-active');
    document.body.classList.add('scanner-drag-active');
    document.body.style.top = '-' + dragScrollY + 'px';
}

function finishDragging() {
    if (!dragging) return;
    if (dragging) dragging.classList.remove('dragging');
    dragging = null;
    document.documentElement.classList.remove('scanner-drag-active');
    document.body.classList.remove('scanner-drag-active');
    document.body.style.top = '';
    window.scrollTo(0, dragScrollY);
}

if (overlaysDiv) {
    overlaysDiv.addEventListener('pointerdown', (e) => {
        const item = e.target.closest('.draggable-item');
        if (!item || e.target.closest('.delete-btn')) return;
        dragging = item;
        item.classList.add('dragging');
        const r = item.getBoundingClientRect();
        dragOx = e.clientX - (r.left + r.width / 2);
        dragOy = e.clientY - (r.top + r.height / 2);
        if (typeof item.setPointerCapture === 'function') item.setPointerCapture(e.pointerId);
        lockPageScroll();
        e.preventDefault();
    });

    overlaysDiv.addEventListener('click', (e) => {
        if (e.target.closest('.delete-btn')) {
            e.target.closest('.draggable-item').remove();
        }
    });
}

// Pointermove/up na document – funguje i když kurzor opustí prvek
document.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    if (e.cancelable) e.preventDefault();
    const pr = interactiveContainer.getBoundingClientRect();
    const nx = e.clientX - pr.left - dragOx;
    const ny = e.clientY - pr.top - dragOy;
    dragging.style.left = (nx / pr.width * 100) + '%';
    dragging.style.top = (ny / pr.height * 100) + '%';
}, { passive: false });

document.addEventListener('pointerup', finishDragging);
document.addEventListener('pointercancel', finishDragging);

// ============================================================
// Zapečení + stažení
// ============================================================
async function bakeAndDownload() {
    statusText.innerText = 'Zapékám a stahuji…';
    if (document.fonts && document.fonts.load) {
        try {
            await document.fonts.load('600 62px Caveat');
        } catch (err) {
            console.warn('Podpisový font se nepodařilo načíst, používám náhradní.', err);
        }
    }
    const dctx = outputCanvas.getContext('2d');

    document.querySelectorAll('#overlays .draggable-item').forEach((el) => {
        const prcX = parseFloat(el.style.left) / 100;
        const prcY = parseFloat(el.style.top) / 100;
        const cx = prcX * outputCanvas.width;
        const cy = prcY * outputCanvas.height;
        const type = el.dataset.type;

        if (type === 'text') {
            dctx.font = '500 ' + el.dataset.fontScale + 'px "Arial Narrow", Arial, sans-serif';
            dctx.fillStyle = '#001450';
            dctx.textAlign = 'center';
            dctx.textBaseline = 'middle';
            dctx.fillText(el.dataset.text, cx, cy);
        } else if (type === 'cross') {
            dctx.font = 'bold ' + el.dataset.fontScale + 'px Arial, sans-serif';
            dctx.fillStyle = '#001450';
            dctx.textAlign = 'center';
            dctx.textBaseline = 'middle';
            dctx.fillText('✕', cx, cy);
        } else if (type === 'signature') {
            dctx.save();
            dctx.translate(cx, cy);
            dctx.rotate(-7 * Math.PI / 180);
            dctx.font = '600 ' + el.dataset.fontScale + 'px Caveat, "Segoe Script", cursive';
            dctx.fillStyle = '#1d3278';
            dctx.textAlign = 'center';
            dctx.textBaseline = 'middle';
            dctx.fillText(el.dataset.text, 0, 0);
            dctx.restore();
        } else if (type === 'stamp') {
            const img = el.querySelector('.stamp-img');
            if (img) {
                const w = parseFloat(el.dataset.w);
                const h = parseFloat(el.dataset.h);
                dctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
            }
        }
    });

    // Smazat overlays (jsou zapečené v canvasu)
    overlaysDiv.innerHTML = '';

    // Stáhnout přes Blob
    try {
        outputCanvas.toBlob(function (blob) {
            if (!blob) {
                statusText.innerText = 'Chyba při vytváření obrázku.';
                return;
            }
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'prihlaska_' + Date.now() + '.jpg';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
            statusText.innerText = 'Staženo do složky Stažené soubory! Nahrajte další fotku.';
        }, 'image/jpeg', 0.92);
    } catch (err) {
        console.error('Download error:', err);
        statusText.innerText = 'Chyba stahování: ' + err.message;
    }
}

// ============================================================
// Custom text field – přidání vlastního textu na formulář
// ============================================================
(function initCustomField() {
    const input = document.getElementById('customTextField');
    const btn = document.getElementById('addCustomFieldBtn');
    if (!input || !btn) return;

    function addCustomText() {
        const text = input.value.trim();
        if (!text) return;
        if (!outputCanvas || outputCanvas.width === 0) {
            statusText.innerText = 'Nejdříve vygenerujte formulář!';
            return;
        }
        // Přidat doprostřed
        addOverlay('text', text, lastDstW / 2, lastDstH / 2, { fontScale: 32 });
        updateScales();
        input.value = '';
        statusText.innerText = 'Text „' + text + '" přidán – přetáhněte ho na správné místo.';
    }

    btn.addEventListener('click', addCustomText);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') addCustomText();
    });
})();
