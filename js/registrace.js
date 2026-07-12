// Veřejný formulář žádosti o členství v ŠSČR (odkaz s tokenem generuje členská sekce)
(() => {
    const API = window.API_URL || '/api';
    const token = new URLSearchParams(location.search).get('t');

    const form = document.getElementById('regForm');
    const invalidBox = document.getElementById('regInvalid');
    const doneBox = document.getElementById('regDone');
    const errBox = document.getElementById('regError');

    const showInvalid = (msg) => {
        invalidBox.style.display = 'block';
        form.style.display = 'none';
        if (msg) document.getElementById('regInvalidMsg').textContent = msg;
    };

    // ---- podpisový canvas ----
    const canvas = document.getElementById('sigCanvas');
    const ctx = canvas.getContext('2d');
    let drawing = false;
    let hasSignature = false;

    function resizeCanvas() {
        // zachovej kresbu při resize
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
    const start = (e) => { e.preventDefault(); drawing = true; const { x, y } = pos(e); ctx.beginPath(); ctx.moveTo(x, y); };
    const move = (e) => { if (!drawing) return; e.preventDefault(); const { x, y } = pos(e); ctx.lineTo(x, y); ctx.stroke(); hasSignature = true; };
    const end = () => { drawing = false; };

    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', move);
    window.addEventListener('mouseup', end);
    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove', move, { passive: false });
    canvas.addEventListener('touchend', end);

    document.getElementById('sigClear').addEventListener('click', () => {
        hasSignature = false;
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
    });

    window.addEventListener('resize', resizeCanvas);

    // ---- validace odkazu ----
    (async () => {
        if (!token) return showInvalid('V adrese chybí registrační kód.');
        try {
            const res = await fetch(`${API}/registrations/form/${encodeURIComponent(token)}`);
            if (res.status === 410) return showInvalid('Tato žádost už byla odeslána — odkaz je jednorázový.');
            if (!res.ok) return showInvalid();
            const info = await res.json().catch(() => ({}));
            if (info.prefill) {
                if (info.prefill.firstName) form.firstName.value = info.prefill.firstName;
                if (info.prefill.lastName) form.lastName.value = info.prefill.lastName;
            }
            form.style.display = 'block';
            document.getElementById('paperPreviewWrap').style.display = 'block';
            resizeCanvas();
            updatePaper();
        } catch (e) {
            showInvalid('Server je nedostupný, zkuste to prosím později.');
        }
    })();

    // ---- cizinec bez RČ ----
    const foreignerCheck = document.getElementById('foreignerCheck');
    foreignerCheck.addEventListener('change', () => {
        const isF = foreignerCheck.checked;
        document.getElementById('rcField').style.display = isF ? 'none' : '';
        if (isF) form.birthNumber.value = '';
        form.birthDate.required = isF;
        form.birthCountry.required = isF;
        form.citizenship.required = isF;
        document.getElementById('birthDateReq').textContent = isF ? '*' : '(povinné u cizinců)';
        updatePaper();
    });

    // ---- živý náhled „papíru" ----
    const czDate = (iso) => {
        if (!iso) return '';
        const [yy, mm, dd] = iso.split('-');
        return dd ? `${parseInt(dd)}. ${parseInt(mm)}. ${yy}` : iso;
    };
    function updatePaper() {
        const v = (n) => (form[n] ? form[n].value.trim() : '');
        document.querySelectorAll('#paperPreview [data-pp]').forEach(el => {
            const spec = el.getAttribute('data-pp');
            let out = '';
            if (spec === 'birthNumber|birthDateCz') out = v('birthNumber') || czDate(v('birthDate'));
            else out = v(spec);
            el.textContent = out || '\u00A0';
        });
        document.getElementById('ppRegYear').textContent = form.registerThisYear.checked ? '☒' : '☐';
        document.getElementById('ppDate').textContent = new Date().toLocaleDateString('cs-CZ');
    }
    form.addEventListener('input', updatePaper);
    form.addEventListener('change', updatePaper);

    // podpis do náhledu po dokreslení
    const syncSigPreview = () => {
        if (!hasSignature) return;
        const box = document.getElementById('ppSig');
        box.innerHTML = '';
        const img = new Image();
        img.src = canvas.toDataURL('image/png');
        img.style.cssText = 'max-height:44px; max-width:100%;';
        box.appendChild(img);
    };
    canvas.addEventListener('mouseup', syncSigPreview);
    canvas.addEventListener('touchend', syncSigPreview);
    document.getElementById('sigClear').addEventListener('click', () => {
        document.getElementById('ppSig').innerHTML = '<span style="color:#bbb; font-size:0.7rem;">— podpis se doplní z podpisového pole —</span>';
    });

    // ---- odeslání ----
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        errBox.style.display = 'none';

        const f = new FormData(form);
        const body = Object.fromEntries(f.entries());
        body.registerThisYear = form.registerThisYear.checked;
        body.agreeStatutes = form.agreeStatutes.checked;

        if (!body.birthNumber && !body.birthDate) {
            errBox.textContent = 'Vyplňte rodné číslo (u cizinců datum narození).';
            errBox.style.display = 'block';
            errBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }
        if (body.birthDate) {
            // ISO → česky pro PDF
            const [yy, mm, dd] = body.birthDate.split('-');
            if (dd) body.birthDate = `${parseInt(dd)}. ${parseInt(mm)}. ${yy}`;
        }
        if (hasSignature) body.signaturePng = canvas.toDataURL('image/png');

        const btn = document.getElementById('regSubmit');
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Odesílám…';

        try {
            const res = await fetch(`${API}/registrations/form/${encodeURIComponent(token)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || `Chyba ${res.status}`);
            form.style.display = 'none';
            doneBox.style.display = 'block';
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (err) {
            errBox.textContent = err.message;
            errBox.style.display = 'block';
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Odeslat žádost oddílu';
        }
    });
})();
