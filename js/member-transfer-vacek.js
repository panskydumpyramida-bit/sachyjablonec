const VACEK_BASE_URL = `${API_URL}/transfer-forms/vacek/base`;
const VACEK_PREVIEW_URL = `${API_URL}/transfer-forms/vacek/preview`;
const SIGNED_PDF_FILENAME = 'prestup_vacek_radomir_podepsano.pdf';

let vacekUser = null;
let signedPdfBlob = null;
let signedPdfObjectUrl = null;
let basePdfObjectUrl = null;
let hasSignature = false;
let isDrawing = false;
let lastPoint = null;

const guard = document.getElementById('transferGuard');
const app = document.getElementById('transferApp');
const preview = document.getElementById('vacekPreview');
const signatureCanvas = document.getElementById('signatureCanvas');
const signatureCtx = signatureCanvas.getContext('2d');
const scanInput = document.getElementById('signedScanInput');

function setMessage(text, type = 'info') {
    const el = document.getElementById('transferMessage');
    el.textContent = text;
    el.className = `transfer-message ${type}`;
    el.classList.remove('hidden');
}

function clearMessage() {
    document.getElementById('transferMessage')?.classList.add('hidden');
}

function isAdmin(user) {
    return user && ['ADMIN', 'SUPERADMIN'].includes(user.role);
}

async function fetchProtectedBlob(url) {
    const token = getAuthToken();
    const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok) {
        throw new Error(`Nepodařilo se načíst soubor (${res.status})`);
    }

    return res.blob();
}

async function loadPreview() {
    const blob = await fetchProtectedBlob(VACEK_PREVIEW_URL);
    preview.src = URL.createObjectURL(blob);
}

async function getBasePdfBlob() {
    return fetchProtectedBlob(VACEK_BASE_URL);
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
}

async function openBasePdf() {
    const blob = await getBasePdfBlob();
    if (basePdfObjectUrl) URL.revokeObjectURL(basePdfObjectUrl);
    basePdfObjectUrl = URL.createObjectURL(blob);
    window.open(basePdfObjectUrl, '_blank');
}

async function downloadBasePdf() {
    downloadBlob(await getBasePdfBlob(), 'prestup_vacek_radomir_predvyplneno.pdf');
}

function setupSignatureCanvas() {
    signatureCtx.lineCap = 'round';
    signatureCtx.lineJoin = 'round';
    signatureCtx.lineWidth = 5;
    signatureCtx.strokeStyle = '#0f172a';

    function pointFromEvent(e) {
        const rect = signatureCanvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) * (signatureCanvas.width / rect.width),
            y: (e.clientY - rect.top) * (signatureCanvas.height / rect.height)
        };
    }

    signatureCanvas.addEventListener('pointerdown', (e) => {
        isDrawing = true;
        hasSignature = true;
        lastPoint = pointFromEvent(e);
        signatureCanvas.setPointerCapture(e.pointerId);
        e.preventDefault();
    });

    signatureCanvas.addEventListener('pointermove', (e) => {
        if (!isDrawing) return;
        const point = pointFromEvent(e);
        signatureCtx.beginPath();
        signatureCtx.moveTo(lastPoint.x, lastPoint.y);
        signatureCtx.lineTo(point.x, point.y);
        signatureCtx.stroke();
        lastPoint = point;
        e.preventDefault();
    });

    signatureCanvas.addEventListener('pointerup', () => {
        isDrawing = false;
        lastPoint = null;
    });

    signatureCanvas.addEventListener('pointercancel', () => {
        isDrawing = false;
        lastPoint = null;
    });
}

function clearSignature() {
    signatureCtx.clearRect(0, 0, signatureCanvas.width, signatureCanvas.height);
    hasSignature = false;
    signedPdfBlob = null;
    if (signedPdfObjectUrl) URL.revokeObjectURL(signedPdfObjectUrl);
    signedPdfObjectUrl = null;
    document.getElementById('signedPdfActions').classList.add('hidden');
    clearMessage();
}

function getTrimmedSignatureDataUrl() {
    const { width, height } = signatureCanvas;
    const imageData = signatureCtx.getImageData(0, 0, width, height);
    const data = imageData.data;
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;

    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const alpha = data[(y * width + x) * 4 + 3];
            if (alpha > 0) {
                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                maxX = Math.max(maxX, x);
                maxY = Math.max(maxY, y);
            }
        }
    }

    if (minX > maxX || minY > maxY) return null;

    const margin = 18;
    minX = Math.max(0, minX - margin);
    minY = Math.max(0, minY - margin);
    maxX = Math.min(width, maxX + margin);
    maxY = Math.min(height, maxY + margin);

    const trimmed = document.createElement('canvas');
    trimmed.width = maxX - minX;
    trimmed.height = maxY - minY;
    trimmed.getContext('2d').drawImage(
        signatureCanvas,
        minX,
        minY,
        trimmed.width,
        trimmed.height,
        0,
        0,
        trimmed.width,
        trimmed.height
    );

    return trimmed.toDataURL('image/png');
}

async function generateSignedPdf() {
    clearMessage();

    if (!hasSignature) {
        setMessage('Nejdřív přidej podpis.', 'error');
        return;
    }

    if (!window.PDFLib) {
        setMessage('Knihovna pro úpravu PDF se nenačetla.', 'error');
        return;
    }

    const btn = document.getElementById('generateSignedPdfBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Vkládám podpis...';

    try {
        const basePdfBlob = await getBasePdfBlob();
        const basePdfBytes = await basePdfBlob.arrayBuffer();
        const pdfDoc = await window.PDFLib.PDFDocument.load(basePdfBytes);
        const page = pdfDoc.getPage(0);
        const signatureDataUrl = getTrimmedSignatureDataUrl();

        if (!signatureDataUrl) {
            throw new Error('Podpis je prázdný.');
        }

        const signatureImage = await pdfDoc.embedPng(signatureDataUrl);
        const box = { x: 345, y: 96, w: 225, h: 68 };
        const scale = Math.min(170 / signatureImage.width, 52 / signatureImage.height);
        const width = signatureImage.width * scale;
        const height = signatureImage.height * scale;

        page.drawImage(signatureImage, {
            x: box.x + (box.w - width) / 2,
            y: box.y + (box.h - height) / 2,
            width,
            height
        });

        const signedBytes = await pdfDoc.save();
        signedPdfBlob = new window.Blob([signedBytes], { type: 'application/pdf' });

        if (signedPdfObjectUrl) URL.revokeObjectURL(signedPdfObjectUrl);
        signedPdfObjectUrl = URL.createObjectURL(signedPdfBlob);

        document.getElementById('signedPdfActions').classList.remove('hidden');
        setMessage('Podepsané PDF je připravené.', 'success');
    } catch (error) {
        console.error(error);
        setMessage(error.message || 'Nepodařilo se vytvořit podepsané PDF.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-file-circle-check"></i> Vložit podpis do PDF';
    }
}

function openSignedPdf() {
    if (!signedPdfObjectUrl) return;
    window.open(signedPdfObjectUrl, '_blank');
}

function downloadSignedPdf() {
    if (!signedPdfBlob) return;
    downloadBlob(signedPdfBlob, SIGNED_PDF_FILENAME);
}

async function uploadDocumentFile(file, title) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title);
    formData.append('category', 'prestupy');
    formData.append('visibility', 'admin');

    const token = getAuthToken();
    const res = await fetch(`${API_URL}/documents`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
    });

    if (!res.ok) {
        throw new Error('Uložení do dokumentů selhalo.');
    }

    return res.json();
}

async function saveSignedPdf() {
    if (!signedPdfBlob) return;

    const btn = document.getElementById('saveSignedPdfBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Ukládám...';

    try {
        const file = new window.File([signedPdfBlob], SIGNED_PDF_FILENAME, { type: 'application/pdf' });
        await uploadDocumentFile(file, 'Podepsaný přestupní lístek - Radomír Vacek');
        setMessage('Podepsané PDF je uložené v dokumentech pro adminy.', 'success');
    } catch (error) {
        console.error(error);
        setMessage(error.message || 'Uložení selhalo.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Uložit do dokumentů';
    }
}

function setupScanUpload() {
    document.getElementById('pickScanBtn').addEventListener('click', () => scanInput.click());

    scanInput.addEventListener('change', () => {
        const file = scanInput.files[0];
        document.getElementById('scanFileName').textContent = file ? file.name : 'Zatím není vybraný žádný soubor.';
        document.getElementById('uploadScanBtn').disabled = !file;
    });

    document.getElementById('uploadScanBtn').addEventListener('click', async () => {
        const file = scanInput.files[0];
        if (!file) return;

        const btn = document.getElementById('uploadScanBtn');
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Ukládám...';

        try {
            await uploadDocumentFile(file, 'Podepsaný scan přestupu - Radomír Vacek');
            scanInput.value = '';
            document.getElementById('scanFileName').textContent = 'Scan je uložený v dokumentech pro adminy.';
            setMessage('Scan je uložený v dokumentech pro adminy.', 'success');
        } catch (error) {
            console.error(error);
            setMessage(error.message || 'Uložení scanu selhalo.', 'error');
        } finally {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Uložit scan';
        }
    });
}

function bindActions() {
    document.getElementById('openBasePdfBtn').addEventListener('click', openBasePdf);
    document.getElementById('downloadBasePdfBtn').addEventListener('click', downloadBasePdf);
    document.getElementById('clearSignatureBtn').addEventListener('click', clearSignature);
    document.getElementById('generateSignedPdfBtn').addEventListener('click', generateSignedPdf);
    document.getElementById('openSignedPdfBtn').addEventListener('click', openSignedPdf);
    document.getElementById('downloadSignedPdfBtn').addEventListener('click', downloadSignedPdf);
    document.getElementById('saveSignedPdfBtn').addEventListener('click', saveSignedPdf);
    setupScanUpload();
}

document.addEventListener('DOMContentLoaded', async () => {
    vacekUser = await checkAuth(true, true);

    if (!isAdmin(vacekUser)) {
        guard.innerHTML = '<i class="fa-solid fa-lock"></i> Tohle je dostupné jen adminům.';
        return;
    }

    guard.classList.add('hidden');
    app.classList.remove('hidden');
    setupSignatureCanvas();
    bindActions();

    try {
        await loadPreview();
    } catch (error) {
        console.error(error);
        setMessage('Nepodařilo se načíst náhled formuláře.', 'error');
    }
});
