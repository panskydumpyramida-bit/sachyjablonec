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
            form.style.display = 'block';
            resizeCanvas();
        } catch (e) {
            showInvalid('Server je nedostupný, zkuste to prosím později.');
        }
    })();

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
