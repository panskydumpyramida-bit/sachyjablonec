/**
 * Admin: konfigurace 4 dlaždic na homepage (hero) + připnutí Hádanky dne.
 * Ukládá do settings: home_hero_tiles (JSON), daily_puzzle_pinned (id nebo prázdné).
 */
(function () {
    'use strict';

    const API = () => (typeof apiBase === 'function' ? apiBase() : (window.API_URL || '/api'));
    const token = () => localStorage.getItem('authToken') || window.authToken || localStorage.getItem('auth_token') || '';

    const PRESETS = {
        aktuality: { type: 'link', label: 'Aktuality', icon: 'fa-newspaper', variant: 'light', href: '#news', iconColor: '#5d4037' },
        rozpis: { type: 'link', label: 'Rozpis zápasů', icon: 'fa-chess-king', variant: 'dark', href: '/calendar.html' },
        rapidy: { type: 'link', label: 'Rapid čtvrtky', icon: 'fa-stopwatch', variant: 'dark', href: '/rapidy', featured: true, badge: 'Nové' },
        mladez: { type: 'link', label: 'Mládež', icon: 'fa-child', variant: 'light', href: '/youth.html', iconColor: '#5d4037' },
        hadanka: { type: 'puzzle', label: 'Hádanka dne', icon: 'fa-puzzle-piece', variant: 'dark', featured: true, badge: 'Hádej!' },
        custom: { type: 'link', label: '', icon: 'fa-chess', variant: 'dark', href: '' },
    };
    const PRESET_OPTS = [
        ['aktuality', 'Aktuality'], ['rozpis', 'Rozpis zápasů'], ['rapidy', 'Rapid čtvrtky'],
        ['mladez', 'Mládež'], ['hadanka', '🧩 Hádanka dne'], ['custom', 'Vlastní odkaz…'],
    ];
    const DEFAULT = ['aktuality', 'rozpis', 'hadanka', 'mladez'];

    function matchPreset(tile) {
        if (!tile) return 'custom';
        if (tile.type === 'puzzle') return 'hadanka';
        for (const [k, p] of Object.entries(PRESETS)) {
            if (k === 'custom' || k === 'hadanka') continue;
            if (p.href === tile.href && p.label === tile.label) return k;
        }
        return 'custom';
    }

    let modal = null;

    async function open() {
        if (!modal) build();
        modal.style.display = 'flex';
        // načti aktuální config + kandidáty pro připnutí
        let tiles = null, pinned = '';
        try {
            const r = await fetch(`${API()}/settings/public/home_hero_tiles`);
            if (r.ok) { const d = await r.json(); if (d.value) tiles = JSON.parse(d.value); }
        } catch (e) {}
        try {
            const r2 = await fetch(`${API()}/settings/public/daily_puzzle_pinned`);
            if (r2.ok) { const d = await r2.json(); pinned = d.value || ''; }
        } catch (e) {}
        renderSlots(tiles);
        await loadCandidates(pinned);
    }
    function close() { if (modal) modal.style.display = 'none'; }

    function build() {
        modal = document.createElement('div');
        modal.id = 'homeTilesModal';
        modal.style.cssText = 'position:fixed; inset:0; z-index:12500; display:none; align-items:center; justify-content:center; background:rgba(0,0,0,0.8); padding:16px;';
        modal.innerHTML = `
          <div style="width:min(560px,100%); max-height:92vh; overflow:auto; background:#1a1a2e; border:1px solid rgba(255,255,255,0.12); border-radius:10px;">
            <div style="display:flex; align-items:center; gap:0.5rem; padding:0.85rem 1rem; border-bottom:1px solid rgba(255,255,255,0.1);">
              <i class="fa-solid fa-table-cells-large" style="color:#eab308;"></i>
              <strong style="color:#fff; flex:1;">Domovská stránka — 4 dlaždice</strong>
              <button id="htClose" style="background:none;border:none;color:#94a3b8;font-size:1.3rem;cursor:pointer;">&times;</button>
            </div>
            <div style="padding:1rem;">
              <p style="color:#94a3b8; font-size:0.82rem; margin:0 0 0.8rem;">Vyber, co bude v každé ze 4 dlaždic v hero sekci. „Hádanka dne" otevře řešící modal. Změny se projeví po uložení (na webu Cmd+Shift+R).</p>
              <div id="htSlots" style="display:grid; gap:0.6rem;"></div>
              <hr style="border:none; border-top:1px solid rgba(255,255,255,0.08); margin:1rem 0;">
              <label style="display:block; color:#cbd5e1; font-size:0.85rem; margin-bottom:0.3rem;">Hádanka dne — která:</label>
              <select id="htPinned" style="width:100%; padding:0.5rem; background:rgba(0,0,0,0.25); border:1px solid rgba(255,255,255,0.12); color:#fff; border-radius:6px;">
                <option value="">Auto — nejlíp hodnocená (rotace dle dne)</option>
              </select>
              <div id="htMsg" style="min-height:1.2rem; margin-top:0.6rem; font-size:0.85rem;"></div>
              <div style="display:flex; gap:0.5rem; justify-content:flex-end; margin-top:0.6rem;">
                <button id="htReset" style="background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); color:#cbd5e1; border-radius:6px; padding:0.5rem 1rem; cursor:pointer;">Výchozí</button>
                <button id="htSave" style="background:#eab308; border:none; color:#000; font-weight:700; border-radius:6px; padding:0.5rem 1.2rem; cursor:pointer;">Uložit</button>
              </div>
            </div>
          </div>`;
        document.body.appendChild(modal);
        modal.querySelector('#htClose').addEventListener('click', close);
        modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
        modal.querySelector('#htReset').addEventListener('click', () => renderSlots(null));
        modal.querySelector('#htSave').addEventListener('click', save);
    }

    function renderSlots(tiles) {
        const host = modal.querySelector('#htSlots');
        const cfg = (Array.isArray(tiles) && tiles.length) ? tiles : DEFAULT.map(k => ({ ...PRESETS[k] }));
        host.innerHTML = '';
        for (let i = 0; i < 4; i++) {
            const tile = cfg[i] || { ...PRESETS.custom };
            const sel = matchPreset(tile);
            const row = document.createElement('div');
            row.className = 'ht-row';
            row.dataset.idx = i;
            row.style.cssText = 'display:grid; grid-template-columns:90px 1fr; gap:0.5rem; align-items:center; background:rgba(255,255,255,0.03); padding:0.5rem 0.6rem; border-radius:8px;';
            row.innerHTML = `
              <span style="color:#64748b; font-size:0.8rem;">Dlaždice ${i + 1}</span>
              <div>
                <select class="ht-preset" style="width:100%; padding:0.4rem; background:rgba(0,0,0,0.25); border:1px solid rgba(255,255,255,0.12); color:#fff; border-radius:6px;">
                  ${PRESET_OPTS.map(([k, lbl]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${lbl}</option>`).join('')}
                </select>
                <div class="ht-custom" style="display:${sel === 'custom' ? 'grid' : 'none'}; grid-template-columns:1fr 1fr; gap:0.4rem; margin-top:0.4rem;">
                  <input class="ht-label" placeholder="Popisek" value="${esc(tile.label || '')}" style="padding:0.4rem; background:rgba(0,0,0,0.25); border:1px solid rgba(255,255,255,0.12); color:#fff; border-radius:6px;">
                  <input class="ht-href" placeholder="Odkaz (/...)" value="${esc(tile.href || '')}" style="padding:0.4rem; background:rgba(0,0,0,0.25); border:1px solid rgba(255,255,255,0.12); color:#fff; border-radius:6px;">
                </div>
              </div>`;
            host.appendChild(row);
            const presetSel = row.querySelector('.ht-preset');
            presetSel.addEventListener('change', () => {
                row.querySelector('.ht-custom').style.display = presetSel.value === 'custom' ? 'grid' : 'none';
            });
        }
    }

    async function loadCandidates(pinned) {
        const sel = modal.querySelector('#htPinned');
        try {
            const r = await fetch(`${API()}/weekly-puzzles/candidates?limit=30`, { headers: { 'Authorization': 'Bearer ' + token() } });
            if (!r.ok) return;
            const data = await r.json();
            (data.candidates || []).forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.id;
                opt.textContent = `#${c.id} ${c.toMove === 'w' ? 'Bílý' : 'Černý'} ${c.bestSan} (${c.white}–${c.black}) ★${c.rating}`;
                if (String(c.id) === String(pinned)) opt.selected = true;
                sel.appendChild(opt);
            });
        } catch (e) {}
    }

    function buildConfig() {
        const rows = modal.querySelectorAll('.ht-row');
        const tiles = [];
        rows.forEach(row => {
            const preset = row.querySelector('.ht-preset').value;
            if (preset === 'custom') {
                const label = row.querySelector('.ht-label').value.trim();
                const href = row.querySelector('.ht-href').value.trim();
                tiles.push({ ...PRESETS.custom, label: label || 'Odkaz', href: href || '#' });
            } else {
                tiles.push({ ...PRESETS[preset] });
            }
        });
        return tiles;
    }

    async function save() {
        const msg = modal.querySelector('#htMsg');
        const tiles = buildConfig();
        const pinned = modal.querySelector('#htPinned').value || '';
        msg.innerHTML = '<span style="color:#94a3b8;">Ukládám…</span>';
        try {
            const headers = { 'Authorization': 'Bearer ' + token(), 'Content-Type': 'application/json' };
            const r1 = await fetch(`${API()}/settings`, { method: 'POST', headers, body: JSON.stringify({ key: 'home_hero_tiles', value: JSON.stringify(tiles) }) });
            const r2 = await fetch(`${API()}/settings`, { method: 'POST', headers, body: JSON.stringify({ key: 'daily_puzzle_pinned', value: pinned }) });
            if (r1.ok && r2.ok) {
                msg.innerHTML = '<span style="color:#34d399;"><i class="fa-solid fa-check"></i> Uloženo. Na webu Cmd+Shift+R.</span>';
            } else {
                msg.innerHTML = '<span style="color:#f87171;">Uložení selhalo (jsi admin?).</span>';
            }
        } catch (e) {
            msg.innerHTML = '<span style="color:#f87171;">Chyba: ' + esc(e.message) + '</span>';
        }
    }

    function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }

    window.openHomeTilesConfig = open;
})();
