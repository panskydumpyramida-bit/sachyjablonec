// Veřejný formulář žádosti o členství v ŠSČR (odkaz s tokenem generuje členská sekce)
(() => {
    const API = window.API_URL || '/api';

    // ---------- vícejazyčnost (CS / EN / UA) ----------
    const I18N = {
        cs: {
            title: 'Žádost o členství v ŠSČR',
            intro: 'Šachový oddíl <strong>TJ Bižuterie Jablonec nad Nisou</strong>. Vyplňte prosím údaje přesně podle dokladů — z formuláře se generuje oficiální registrační žádost Šachového svazu ČR.',
            invalidMsg: 'Tento odkaz není platný.',
            invalidHint: 'Požádejte prosím oddíl o nový registrační odkaz (info@sachyjablonec.cz).',
            invalidUsed: 'Tato žádost už byla odeslána — odkaz je jednorázový.',
            invalidMissing: 'V adrese chybí registrační kód.',
            invalidServer: 'Server je nedostupný, zkuste to prosím později.',
            doneTitle: 'Odesláno!',
            doneText: 'Žádost jsme předali oddílu. Předseda ji potvrdí razítkem a odešle na Šachový svaz ČR. O dalším postupu vás budeme informovat.',
            secPersonal: 'Osobní údaje', lastName: 'Příjmení *', firstName: 'Jméno *', middleName: 'Další jméno', titleAcad: 'Titul',
            foreigner: 'Nemám české rodné číslo (cizinec) — vyplním stát narození a občanství.',
            birthNumber: 'Rodné číslo * (občané ČR)', birthDate: 'Datum narození *',
            birthCountry: 'Stát narození (není-li ČR)', citizenship: 'Státní občanství (není-li ČR)',
            secAddress: 'Trvalý pobyt v ČR', street: 'Ulice *', houseNumber: 'Číslo popisné/orientační *', city: 'Město *', cityPart: 'Část obce', zip: 'PSČ *',
            secContacts: 'Kontakty', phone: 'Telefon', email: 'E-mail',
            secConsents: 'Souhlasy a podpis',
            regYear: '<strong>Registrovat pro aktuální rok.</strong> Registrace je spojena s povinností úhrady členských příspěvků dle ekonomické směrnice ŠSČR.',
            statutes: 'Prohlašuji, že jsem se seznámil/a se <a href="https://www.chess.cz/wp-content/uploads/2026/03/Stanovy_SSCR_2026.pdf" target="_blank" rel="noopener" style="color:#93c5fd;">Stanovami ŠSČR</a>, včetně ustanovení o nakládání s osobními údaji, a souhlasím s nimi. *',
            signLabel: 'Podpis hráče (u mladších 18 let podepisuje zákonný zástupce) — podepište se prstem nebo myší:',
            clearSig: 'Smazat podpis', submit: 'Odeslat žádost oddílu', submitting: 'Odesílám…',
            footNote: 'Žádost zkontroluje předseda oddílu a s razítkem ji odešle na Šachový svaz ČR.',
            previewNote: 'Náhled žádosti — takhle bude vypadat dokument, který odejde na svaz (razítko připojí oddíl až ve finální verzi):',
            errBirthDate: 'Vyplňte datum narození.',
            errBirthNumber: 'Vyplňte rodné číslo (nebo zaškrtněte, že jste cizinec bez českého RČ).',
        },
        en: {
            title: 'Application for Membership in the Czech Chess Federation',
            intro: 'Chess club <strong>TJ Bižuterie Jablonec nad Nisou</strong>. Please fill in your details exactly as in your documents — the form generates the official registration application of the Czech Chess Federation (ŠSČR).',
            invalidMsg: 'This link is not valid.',
            invalidHint: 'Please ask the club for a new registration link (info@sachyjablonec.cz).',
            invalidUsed: 'This application has already been submitted — the link is single-use.',
            invalidMissing: 'The registration code is missing from the address.',
            invalidServer: 'Server unavailable, please try again later.',
            doneTitle: 'Submitted!',
            doneText: 'Your application has been passed to the club. The chairman will confirm it with a stamp and send it to the Czech Chess Federation. We will keep you informed.',
            secPersonal: 'Personal details', lastName: 'Surname *', firstName: 'First name *', middleName: 'Middle name', titleAcad: 'Academic title',
            foreigner: 'I do not have a Czech birth number (foreigner) — I will fill in country of birth and citizenship.',
            birthNumber: 'Czech birth number * (Czech citizens)', birthDate: 'Date of birth *',
            birthCountry: 'Country of birth (if not Czechia)', citizenship: 'Citizenship (if not Czech)',
            secAddress: 'Permanent residence in Czechia', street: 'Street *', houseNumber: 'House number *', city: 'City *', cityPart: 'City district', zip: 'Postal code *',
            secContacts: 'Contacts', phone: 'Phone', email: 'E-mail',
            secConsents: 'Consents and signature',
            regYear: '<strong>Register for the current year.</strong> Registration entails the obligation to pay membership fees under the ŠSČR economic directive.',
            statutes: 'I declare that I have read the <a href="https://www.chess.cz/wp-content/uploads/2026/03/Stanovy_SSCR_2026.pdf" target="_blank" rel="noopener" style="color:#93c5fd;">Statutes of the ŠSČR</a>, including the provisions on personal data, and agree with them. *',
            signLabel: 'Player signature (for players under 18, a legal guardian signs) — sign with your finger or mouse:',
            clearSig: 'Clear signature', submit: 'Submit application', submitting: 'Submitting…',
            footNote: 'The application will be checked by the club chairman and sent with a stamp to the Czech Chess Federation.',
            previewNote: 'Application preview — this is what the document sent to the federation will look like (the club adds the stamp in the final version):',
            errBirthDate: 'Please fill in your date of birth.',
            errBirthNumber: 'Fill in the Czech birth number (or tick that you are a foreigner without one).',
        },
        uk: {
            title: 'Заява про членство в Шаховій федерації Чехії',
            intro: 'Шаховий клуб <strong>TJ Bižuterie Jablonec nad Nisou</strong>. Заповніть, будь ласка, дані точно за документами — з форми створюється офіційна реєстраційна заява Шахової федерації Чехії (ŠSČR).',
            invalidMsg: 'Це посилання недійсне.',
            invalidHint: 'Попросіть, будь ласка, у клубу нове реєстраційне посилання (info@sachyjablonec.cz).',
            invalidUsed: 'Цю заяву вже надіслано — посилання одноразове.',
            invalidMissing: 'В адресі відсутній реєстраційний код.',
            invalidServer: 'Сервер недоступний, спробуйте пізніше.',
            doneTitle: 'Надіслано!',
            doneText: 'Заяву передано клубу. Голова підтвердить її печаткою та надішле до Шахової федерації Чехії. Про подальші кроки вас повідомимо.',
            secPersonal: 'Особисті дані', lastName: 'Прізвище *', firstName: 'Імʼя *', middleName: 'По батькові / друге імʼя', titleAcad: 'Науковий ступінь',
            foreigner: 'Не маю чеського rodné číslo (іноземець) — заповню країну народження та громадянство.',
            birthNumber: 'Rodné číslo * (громадяни Чехії)', birthDate: 'Дата народження *',
            birthCountry: 'Країна народження (якщо не Чехія)', citizenship: 'Громадянство (якщо не чеське)',
            secAddress: 'Постійне проживання в Чехії', street: 'Вулиця *', houseNumber: 'Номер будинку *', city: 'Місто *', cityPart: 'Район міста', zip: 'Поштовий індекс *',
            secContacts: 'Контакти', phone: 'Телефон', email: 'E-mail',
            secConsents: 'Згоди та підпис',
            regYear: '<strong>Зареєструвати на поточний рік.</strong> Реєстрація повʼязана з обовʼязком сплати членських внесків згідно з економічною директивою ŠSČR.',
            statutes: 'Заявляю, що ознайомився/лася зі <a href="https://www.chess.cz/wp-content/uploads/2026/03/Stanovy_SSCR_2026.pdf" target="_blank" rel="noopener" style="color:#93c5fd;">Статутом ŠSČR</a>, включно з положеннями про персональні дані, і погоджуюся з ними. *',
            signLabel: 'Підпис гравця (за осіб до 18 років підписує законний представник) — підпишіться пальцем або мишею:',
            clearSig: 'Стерти підпис', submit: 'Надіслати заяву клубу', submitting: 'Надсилаю…',
            footNote: 'Заяву перевірить голова клубу та з печаткою надішле до Шахової федерації Чехії.',
            previewNote: 'Попередній перегляд — так виглядатиме документ для федерації (печатку додасть клуб у фінальній версії):',
            errBirthDate: 'Заповніть дату народження.',
            errBirthNumber: 'Заповніть rodné číslo (або позначте, що ви іноземець без нього).',
        },
    };
    let lang = localStorage.getItem('regLang') || new URLSearchParams(location.search).get('lang') || 'cs';
    if (!I18N[lang]) lang = 'cs';
    const t = (k) => (I18N[lang] && I18N[lang][k]) || I18N.cs[k] || k;

    function applyLang(l) {
        lang = I18N[l] ? l : 'cs';
        localStorage.setItem('regLang', lang);
        document.documentElement.lang = lang;
        document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.getAttribute('data-i18n')); });
        document.querySelectorAll('[data-i18n-html]').forEach(el => { el.innerHTML = t(el.getAttribute('data-i18n-html')); });
        const sel = document.getElementById('langSelect');
        if (sel) sel.value = lang;
    }
    document.getElementById('langSelect')?.addEventListener('change', (e) => applyLang(e.target.value));
    applyLang(lang);

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
    const start = (e) => {
        e.preventDefault();
        // canvas inicializovaný ve skrytém tabu má 0×0 — před kresbou dorovnej rozměry
        if (canvas.width === 0 || canvas.height === 0) resizeCanvas();
        drawing = true; const { x, y } = pos(e); ctx.beginPath(); ctx.moveTo(x, y);
    };
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
    document.addEventListener('visibilitychange', () => { if (!document.hidden && canvas.width === 0) resizeCanvas(); });

    // ---- validace odkazu ----
    (async () => {
        if (!token) return showInvalid(t('invalidMissing'));
        try {
            const res = await fetch(`${API}/registrations/form/${encodeURIComponent(token)}`);
            if (res.status === 410) return showInvalid(t('invalidUsed'));
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
            showInvalid(t('invalidServer'));
        }
    })();

    // ---- cizinec bez RČ ----
    const foreignerCheck = document.getElementById('foreignerCheck');
    foreignerCheck.addEventListener('change', () => {
        const isF = foreignerCheck.checked;
        document.getElementById('rcField').style.display = isF ? 'none' : '';
        if (isF) form.birthNumber.value = '';
        form.birthCountry.required = isF;
        form.citizenship.required = isF;
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

        const showErr = (msg) => {
            errBox.textContent = msg;
            errBox.style.display = 'block';
            errBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
        };
        if (!body.birthDate) return showErr(t('errBirthDate'));
        if (!foreignerCheck.checked && !body.birthNumber) return showErr(t('errBirthNumber'));
        if (body.birthDate) {
            // ISO → česky pro PDF
            const [yy, mm, dd] = body.birthDate.split('-');
            if (dd) body.birthDate = `${parseInt(dd)}. ${parseInt(mm)}. ${yy}`;
        }
        if (hasSignature) body.signaturePng = canvas.toDataURL('image/png');

        const btn = document.getElementById('regSubmit');
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ' + t('submitting');

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
            btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> ' + t('submit');
        }
    });
})();
