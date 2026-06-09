/**
 * Admin: Facebook dashboard — posty stránky + dosah, porovnání naše (přes web) vs nativní.
 * Data z GET /api/admin/facebook/posts.
 */
(function () {
    'use strict';

    const API = () => (window.API_URL || '/api');
    const token = () => localStorage.getItem('authToken') || window.authToken || localStorage.getItem('auth_token') || '';

    const state = { posts: [], sort: { key: 'date', dir: -1 } };

    const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString('cs-CZ'));
    const fmtDate = (d) => {
        if (!d) return '—';
        try { return new Date(d).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' }); }
        catch (e) { return String(d).slice(0, 10); }
    };

    async function load() {
        const content = document.getElementById('fbContent');
        if (!content) return;
        content.innerHTML = '<p style="color:#94a3b8;"><i class="fa-solid fa-spinner fa-spin"></i> Načítám příspěvky a dosah z Facebooku…</p>';
        try {
            const r = await fetch(`${API()}/admin/facebook/posts`, { headers: { 'Authorization': 'Bearer ' + token() } });
            if (!r.ok) {
                const e = await r.json().catch(() => ({}));
                content.innerHTML = `<div style="color:#f87171;padding:1rem;border:1px solid rgba(248,113,113,0.3);border-radius:8px;"><i class="fa-solid fa-triangle-exclamation"></i> Nepodařilo se načíst: ${esc(e.error || ('HTTP ' + r.status))}</div>`;
                return;
            }
            const data = await r.json();
            state.posts = data.posts || [];
            render(data);
        } catch (e) {
            content.innerHTML = `<div style="color:#f87171;">Chyba: ${esc(e.message)}</div>`;
        }
    }

    function render(data) {
        const content = document.getElementById('fbContent');
        const a = data.aggregate || {};
        const ours = a.ours || {}, native = a.native || {};
        const meta = data.meta || {};

        const warn = !meta.insightsAvailable
            ? `<div style="margin-bottom:1rem;color:#fbbf24;background:rgba(251,191,36,0.08);border:1px solid rgba(251,191,36,0.25);border-radius:8px;padding:0.7rem 1rem;"><i class="fa-solid fa-triangle-exclamation"></i> Dosah nelze načíst — tokenu chybí oprávnění <code>read_insights</code>, nebo stránka nemá dost dat.</div>`
            : (meta.postsWithoutReach ? `<p style="color:#94a3b8;font-size:0.8rem;margin:0 0 0.6rem;">U ${meta.postsWithoutReach} postů není dosah (čerstvé / nízký dosah).</p>` : '');

        const appWarn = !meta.appIdConfigured
            ? `<p style="color:#94a3b8;font-size:0.78rem;margin:0 0 0.6rem;">Tip: nastav <code>FB_APP_ID</code> na Railway pro přesnější rozlišení i u starších postů (teď se „naše" pozná podle uložených ID z webu).</p>` : '';

        const stat = (val, label, big) => `<div><div style="font-size:${big ? '1.5rem' : '1.05rem'};font-weight:${big ? '700' : '600'};color:${big ? '#f1f5f9' : '#cbd5e1'};">${val}</div><div style="font-size:0.7rem;color:#94a3b8;">${label}</div></div>`;
        const card = (title, g, color) => `
          <div style="flex:1;min-width:210px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-left:4px solid ${color};border-radius:8px;padding:1rem;">
            <div style="font-size:0.78rem;color:#94a3b8;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:0.6rem;">${title}</div>
            <div style="display:flex;gap:1.1rem;flex-wrap:wrap;">
              ${stat(fmt(g.reachAvg), '⌀ dosah', true)}${stat(fmt(g.reachMedian), 'medián')}${stat(fmt(g.engagedAvg), '⌀ engagement')}${stat(g.count || 0, 'postů')}
            </div>
          </div>`;

        const d = a.reachAvgDeltaPct;
        const delta = d != null
            ? `<div style="margin:0.8rem 0;padding:0.7rem 1rem;border-radius:8px;background:${d < 0 ? 'rgba(248,113,113,0.08)' : 'rgba(52,211,153,0.08)'};border:1px solid ${d < 0 ? 'rgba(248,113,113,0.25)' : 'rgba(52,211,153,0.25)'};color:${d < 0 ? '#fca5a5' : '#6ee7b7'};">Naše posty mají ⌀ dosah o <strong>${Math.abs(d)} %</strong> ${d < 0 ? 'nižší' : 'vyšší'} než nativní.</div>`
            : '';

        content.innerHTML = `
          ${warn}${appWarn}
          <div style="display:flex;gap:1rem;flex-wrap:wrap;margin-bottom:0.3rem;">
            ${card('Naše posty (přes web)', ours, '#60a5fa')}
            ${card('Nativní posty', native, '#9ca3af')}
          </div>
          ${delta}
          <div id="fbTableWrap"></div>`;
        renderTable();
    }

    function renderTable() {
        const wrap = document.getElementById('fbTableWrap');
        if (!wrap) return;
        const { key, dir } = state.sort;
        const sorted = [...state.posts].sort((x, y) => {
            let a = x[key], b = y[key];
            if (key === 'date') { a = a || ''; b = b || ''; return (a < b ? -1 : a > b ? 1 : 0) * dir; }
            a = a == null ? -1 : a; b = b == null ? -1 : b;
            return (a - b) * dir;
        });
        const arrow = (k) => (key === k ? (dir < 0 ? ' ▾' : ' ▴') : '');
        const th = (label, k) => `<th onclick="window.__fbSort('${k}')" style="cursor:pointer;padding:0.5rem;text-align:right;color:#94a3b8;font-size:0.76rem;border-bottom:1px solid rgba(255,255,255,0.1);white-space:nowrap;">${label}${arrow(k)}</th>`;
        const rows = sorted.map(p => `
          <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
            <td style="padding:0.4rem 0.5rem;">${p.image ? `<img src="${esc(p.image)}" loading="lazy" style="width:42px;height:42px;object-fit:cover;border-radius:4px;display:block;">` : ''}</td>
            <td style="padding:0.4rem 0.5rem;color:#cbd5e1;font-size:0.8rem;white-space:nowrap;">${fmtDate(p.date)}</td>
            <td style="padding:0.4rem 0.5rem;font-size:0.8rem;max-width:300px;">${p.permalink ? `<a href="${esc(p.permalink)}" target="_blank" rel="noopener" style="color:#cbd5e1;">` : ''}${esc(p.text) || '<span style="color:#64748b;">(bez textu)</span>'}${p.permalink ? '</a>' : ''}${p.articleId ? ` <a href="/article.html?id=${p.articleId}" target="_blank" title="Zdrojový článek" style="color:#60a5fa;"><i class="fa-regular fa-newspaper"></i></a>` : ''}</td>
            <td style="padding:0.4rem 0.5rem;">${p.source === 'ours' ? '<span style="background:rgba(96,165,250,0.15);color:#93c5fd;padding:2px 7px;border-radius:10px;font-size:0.7rem;white-space:nowrap;">App</span>' : '<span style="background:rgba(255,255,255,0.08);color:#9ca3af;padding:2px 7px;border-radius:10px;font-size:0.7rem;white-space:nowrap;">Nativně</span>'}</td>
            <td style="padding:0.4rem 0.5rem;text-align:right;font-weight:700;color:#f1f5f9;">${fmt(p.reach)}</td>
            <td style="padding:0.4rem 0.5rem;text-align:right;color:#cbd5e1;">${fmt(p.impressions)}</td>
            <td style="padding:0.4rem 0.5rem;text-align:right;color:#cbd5e1;">${fmt(p.engaged)}</td>
          </tr>`).join('');
        wrap.innerHTML = `
          <div style="overflow-x:auto;margin-top:0.5rem;">
            <table style="width:100%;border-collapse:collapse;">
              <thead><tr>
                <th style="padding:0.5rem;"></th>
                <th onclick="window.__fbSort('date')" style="cursor:pointer;padding:0.5rem;text-align:left;color:#94a3b8;font-size:0.76rem;border-bottom:1px solid rgba(255,255,255,0.1);white-space:nowrap;">Datum${arrow('date')}</th>
                <th style="padding:0.5rem;text-align:left;color:#94a3b8;font-size:0.76rem;border-bottom:1px solid rgba(255,255,255,0.1);">Text</th>
                <th style="padding:0.5rem;text-align:left;color:#94a3b8;font-size:0.76rem;border-bottom:1px solid rgba(255,255,255,0.1);">Zdroj</th>
                ${th('Dosah', 'reach')}${th('Imprese', 'impressions')}${th('Engag.', 'engaged')}
              </tr></thead>
              <tbody>${rows || '<tr><td colspan="7" style="padding:1rem;color:#94a3b8;">Žádné posty.</td></tr>'}</tbody>
            </table>
          </div>`;
    }

    window.__fbSort = (k) => {
        if (state.sort.key === k) state.sort.dir *= -1;
        else state.sort = { key: k, dir: -1 };
        renderTable();
    };

    window.loadFacebookDashboard = load;
})();
