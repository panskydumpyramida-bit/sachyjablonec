// Veřejné ohlášení přestupu (token) — fáze 1: vyplnění a podpis; fáze 2: sken od mateřského oddílu
(() => {
    const API = window.API_URL || '/api';
    const token = new URLSearchParams(location.search).get('t');

    const form = document.getElementById('trForm');
    const phase2 = document.getElementById('trPhase2');
    const doneBox = document.getElementById('trDone');
    const invalidBox = document.getElementById('trInvalid');
    const errBox = document.getElementById('trError');

    const showInvalid = (msg) => {
        invalidBox.style.display = 'block';
        form.style.display = phase2.style.display = 'none';
        if (msg) document.getElementById('trInvalidMsg').textContent = msg;
    };

    const showPhase2 = (applicant) => {
        form.style.display = 'none';
        phase2.style.display = 'block';
        document.getElementById('trPhase2Who').textContent = applicant
            ? `Ohlášení hráče ${applicant} je vyplněné a potvrzené naším oddílem.`
            : 'Ohlášení je vyplněné a potvrzené naším oddílem.';
        document.getElementById('trPdfLink').href = `${API}/transfers/form/${encodeURIComponent(token)}/pdf`;
    };

    // ---- podpisový canvas (shodné s registrací) ----
    const canvas = document.getElementById('sigCanvas');
    const ctx = canvas.getContext('2d');
    let drawing = false;
    let hasSignature = false;

    function resizeCanvas() {
        const prev = hasSignature ? canvas.toDataURL() : null;
        const ratio = window.devicePixelRatio || 1;
        canvas.width = canvas.offsetWidth * ratio;
        canvas.height = canvas.offsetHeight * ratio;
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
        ctx.strokeStyle = '#1a2a6b';
        ctx.lineWidth = 2.2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (prev) {
            const img = new Image();
            img.onload = () => ctx.drawImage(img, 0, 0, canvas.offsetWidth, canvas.offsetHeight);
            img.src = prev;
        }
    }
    const pos = (e) => {
        const r = canvas.getBoundingClientRect();
        const p = e.touches ? e.touches[0] : e;
        return { x: p.clientX - r.left, y: p.clientY - r.top };
    };
    canvas.addEventListener('mousedown', (e) => { e.preventDefault(); if (canvas.width === 0 || canvas.height === 0) resizeCanvas(); drawing = true; const { x, y } = pos(e); ctx.beginPath(); ctx.moveTo(x, y); });
    canvas.addEventListener('mousemove', (e) => { if (!drawing) return; e.preventDefault(); const { x, y } = pos(e); ctx.lineTo(x, y); ctx.stroke(); hasSignature = true; });
    window.addEventListener('mouseup', () => { drawing = false; });
    canvas.addEventListener('touchstart', (e) => { e.preventDefault(); if (canvas.width === 0 || canvas.height === 0) resizeCanvas(); drawing = true; const { x, y } = pos(e); ctx.beginPath(); ctx.moveTo(x, y); }, { passive: false });
    canvas.addEventListener('touchmove', (e) => { if (!drawing) return; e.preventDefault(); const { x, y } = pos(e); ctx.lineTo(x, y); ctx.stroke(); hasSignature = true; }, { passive: false });
    canvas.addEventListener('touchend', () => { drawing = false; });
    document.getElementById('sigClear').addEventListener('click', () => {
        hasSignature = false;
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
    });
    window.addEventListener('resize', resizeCanvas);
    document.addEventListener('visibilitychange', () => { if (!document.hidden && canvas.width === 0) resizeCanvas(); });

    // ---- inicializace dle stavu ----
    (async () => {
        if (!token) return showInvalid('V adrese chybí kód přestupu.');
        try {
            const res = await fetch(`${API}/transfers/form/${encodeURIComponent(token)}`);
            if (!res.ok) return showInvalid();
            const st = await res.json();
            if (st.status === 'pending') { form.style.display = 'block'; resizeCanvas(); }
            else if (st.status === 'filled') showPhase2(st.applicant);
            else doneBox.style.display = 'block';
        } catch (e) {
            showInvalid('Server je nedostupný, zkuste to prosím později.');
        }
    })();

    // ---- fáze 1: submit ----
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        errBox.style.display = 'none';

        const body = Object.fromEntries(new FormData(form).entries());
        if (!body.birthNumber && !body.birthDate) {
            errBox.textContent = 'Vyplňte rodné číslo (u cizinců datum narození).';
            errBox.style.display = 'block';
            return;
        }
        if (body.birthDate) {
            const [yy, mm, dd] = body.birthDate.split('-');
            if (dd) body.birthDate = `${parseInt(dd)}. ${parseInt(mm)}. ${yy}`;
        }
        if (hasSignature) body.signaturePng = canvas.toDataURL('image/png');

        const btn = document.getElementById('trSubmit');
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generuji ohlášení…';

        try {
            const res = await fetch(`${API}/transfers/form/${encodeURIComponent(token)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || `Chyba ${res.status}`);
            showPhase2(`${body.firstName} ${body.lastName}`);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (err) {
            errBox.textContent = err.message;
            errBox.style.display = 'block';
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Odeslat a vygenerovat ohlášení';
        }
    });

    // ---- fáze 2: upload skenu ----
    const scanInput = document.getElementById('scanInput');
    const uploadBtn = document.getElementById('scanUploadBtn');
    const err2 = document.getElementById('trError2');
    let scanFile = null;

    document.getElementById('scanPickBtn').addEventListener('click', () => scanInput.click());
    scanInput.addEventListener('change', () => {
        scanFile = scanInput.files[0] || null;
        document.getElementById('scanFileName').textContent = scanFile ? `${scanFile.name} (${(scanFile.size / 1048576).toFixed(1)} MB)` : 'Žádný soubor';
        uploadBtn.disabled = !scanFile;
    });

    uploadBtn.addEventListener('click', async () => {
        if (!scanFile) return;
        err2.style.display = 'none';
        if (scanFile.size > 12 * 1024 * 1024) {
            err2.textContent = 'Soubor je větší než 12 MB — zmenšete fotku nebo použijte PDF.';
            err2.style.display = 'block';
            return;
        }
        uploadBtn.disabled = true;
        uploadBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Nahrávám…';

        try {
            const dataUrl = await new Promise((resolve, reject) => {
                const r = new FileReader();
                r.onload = () => resolve(r.result);
                r.onerror = reject;
                r.readAsDataURL(scanFile);
            });
            const res = await fetch(`${API}/transfers/form/${encodeURIComponent(token)}/scan`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ file: dataUrl }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || `Chyba ${res.status}`);
            phase2.style.display = 'none';
            doneBox.style.display = 'block';
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (e2) {
            err2.textContent = e2.message;
            err2.style.display = 'block';
            uploadBtn.disabled = false;
            uploadBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Odeslat potvrzené ohlášení oddílu';
        }
    });
})();
