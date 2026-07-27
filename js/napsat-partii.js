// Jednoduchý průvodce „Napiš o své partii" — pro mladé autory (role AUTHOR)
(() => {
    const API = window.API_URL || '/api';
    const $ = (id) => document.getElementById(id);
    const esc = (s) => { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; };

    // PGN z editoru partií (game-recorder tam odkazuje s ?from=napsat-partii)
    const HANDOFF_KEY = 'napsat_partii_pgn';

    function parseHeaders(pgn) {
        const h = {};
        for (const m of String(pgn).matchAll(/\[(\w+)\s+"([^"]*)"\]/g)) h[m[1]] = m[2];
        return h;
    }

    function describePgn(pgn) {
        if (!pgn.trim()) return null;
        const h = parseHeaders(pgn);
        const moves = pgn.replace(/\[[^\]]*\]/g, '').replace(/\{[^}]*\}/g, '').trim().split(/\s+/).filter(t => /^[a-hKQRBNO0-9]/.test(t)).length;
        const comments = (pgn.match(/\{[^}]*\}/g) || []).length;
        return { white: h.White, black: h.Black, result: h.Result, moves, comments };
    }

    function refreshPgnInfo() {
        const pgn = $('npPgn').value;
        const info = describePgn(pgn);
        const box = $('npPgnInfo');
        if (!info) { box.style.display = 'none'; return; }
        box.style.display = 'block';
        box.innerHTML = `<span class="np-ok"><i class="fa-solid fa-circle-check"></i> Partie načtena</span> —
            ${esc(info.white || '?')} vs ${esc(info.black || '?')}${info.result ? ` (${esc(info.result)})` : ''},
            zhruba ${Math.round(info.moves / 2)} tahů${info.comments ? `, <strong>${info.comments} komentářů</strong>` : ', zatím bez komentářů'}.`;
        if (info.white && !$('npWhite').value) $('npWhite').value = info.white;
        if (info.black && !$('npBlack').value) $('npBlack').value = info.black;
    }

    // Sestaví HTML článku z odpovědí — autor nemusí umět formátovat
    function buildContent(v) {
        const p = (t) => t.trim() ? `<p>${esc(t.trim()).replace(/\n+/g, '</p><p>')}</p>` : '';
        return [
            p(v.intro),
            p(v.story),
            v.lesson.trim() ? `<h2>Co si z toho beru</h2>${p(v.lesson)}` : '',
        ].filter(Boolean).join('\n');
    }

    async function init() {
        const user = await checkAuth(true, true);
        if (!user) return;

        const canWrite = ['AUTHOR', 'ADMIN', 'SUPERADMIN'].includes(user.role);
        if (!canWrite) { $('npGuard').style.display = 'block'; return; }
        $('npForm').style.display = 'block';

        // PGN předaný z editoru partií
        const handoff = localStorage.getItem(HANDOFF_KEY);
        if (handoff) {
            localStorage.removeItem(HANDOFF_KEY);
            $('npPgn').value = handoff;
        }
        // rozepsaný koncept (kdyby zavřel kartu)
        const draft = localStorage.getItem('napsat_partii_draft');
        if (draft && !handoff) {
            try {
                const d = JSON.parse(draft);
                ['npTitle', 'npIntro', 'npStory', 'npLesson', 'npPgn', 'npWhite', 'npBlack'].forEach(id => { if (d[id]) $(id).value = d[id]; });
            } catch (e) { /* poškozený koncept ignorujeme */ }
        }
        refreshPgnInfo();

        $('npPgn').addEventListener('input', refreshPgnInfo);
        // průběžné ukládání rozepsaného textu
        $('npForm').addEventListener('input', () => {
            const d = {};
            ['npTitle', 'npIntro', 'npStory', 'npLesson', 'npPgn', 'npWhite', 'npBlack'].forEach(id => d[id] = $(id).value);
            localStorage.setItem('napsat_partii_draft', JSON.stringify(d));
        });

        $('npForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const err = $('npError');
            err.style.display = 'none';

            const v = {
                title: $('npTitle').value.trim(),
                intro: $('npIntro').value,
                story: $('npStory').value,
                lesson: $('npLesson').value,
                pgn: $('npPgn').value.trim(),
                white: $('npWhite').value.trim(),
                black: $('npBlack').value.trim(),
            };
            if (!v.title) { err.textContent = 'Vyplň prosím nadpis.'; err.style.display = 'block'; return; }
            if (!v.intro.trim() && !v.story.trim()) { err.textContent = 'Napiš aspoň pár vět o partii.'; err.style.display = 'block'; return; }

            const btn = $('npSubmit');
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Odesílám…';

            const games = v.pgn ? [{
                title: `${v.white || 'Bílý'} – ${v.black || 'Černý'}`,
                white: v.white, black: v.black, pgn: v.pgn,
                result: parseHeaders(v.pgn).Result || '*',
            }] : [];

            try {
                const res = await fetch(`${API}/news`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${getAuthToken()}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title: v.title,
                        category: 'Mládež',
                        excerpt: (v.intro || v.story).trim().slice(0, 200),
                        content: buildContent(v),
                        gamesJson: games.length ? JSON.stringify(games) : null,
                        isPublished: false,          // server to stejně vynutí
                        authorName: null,
                    }),
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.error || `Chyba ${res.status}`);
                localStorage.removeItem('napsat_partii_draft');
                $('npForm').style.display = 'none';
                $('npDone').style.display = 'block';
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } catch (e2) {
                err.textContent = e2.message;
                err.style.display = 'block';
                btn.disabled = false;
                btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Poslat trenérovi ke schválení';
            }
        });
    }

    document.addEventListener('DOMContentLoaded', init);
})();
