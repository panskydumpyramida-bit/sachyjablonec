/**
 * Import výsledků z chess-results.com do WYSIWYG editoru — dvoufázový průvodce.
 *
 * Krok 1  URL turnaje → server rozpozná, jestli jde o index festivalu.
 * Krok 2  výběr dílčích turnajů + pohledu (konečné pořadí / po kole / výsledky kola).
 * Krok 3  náhled nalezených hráčů (klub ze sloupce ∪ karta hráče ∪ watchlist) a vložení.
 *
 * Backend: GET  /api/scraping/chess-results/tournaments
 *          POST /api/scraping/chess-results/scan
 *          CRUD /api/tracked-players
 *
 * Tabulku renderuje sdílený buildResultsTableHtml() z admin-slash-commands.js —
 * zvýrazněné řádky se mu předávají explicitně (highlightRows), takže odpadá
 * fuzzy substring hledání, které dělalo false positives („Červeň" → „Cerveny").
 *
 * @requires js/admin/admin-slash-commands.js (buildResultsTableHtml, buildChessResultsLinkHtml)
 */

// ================================
// HELPERY
// ================================

// POZOR: nedeklarovat `function escapeHtml` — přepsalo by globální escapeHtml z js/utils.js.
function crEsc(str) {
    return String(str == null ? '' : str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function crEscAttr(str) {
    return crEsc(str).replace(/'/g, '&#39;');
}

async function crFetch(path, options = {}) {
    const res = await fetch(`${window.API_URL}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${window.authToken}`,
            ...(options.headers || {})
        }
    });
    if (res.status === 204) return null;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
}

const CR_INPUT_STYLE = 'width:100%;box-sizing:border-box;padding:0.6rem 0.8rem;background:rgba(0,0,0,0.35);border:1px solid rgba(255,255,255,0.12);border-radius:8px;color:#fff;font-size:0.92rem;';
const CR_CARD_STYLE = 'background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:0.9rem;';
const CR_LABEL_STYLE = 'display:block;margin-bottom:0.35rem;color:#cbd5e1;font-size:0.85rem;font-weight:500;';

// Sken 2 turnajů na požadavek — server je uvnitř zpracuje paralelně a klient
// přitom může hlásit reálný průběh (sken jednoho turnaje trvá jednotky sekund).
const CR_SCAN_BATCH = 2;

const CR_COMPACT_PATTERNS = [/^(rk|#|poradi|poradn[ií]|por|snr|no)/, /^(jmeno|name|hrac)/, /^(body|pts|pt\.|score)/];
const CR_STANDARD_PATTERNS = CR_COMPACT_PATTERNS.concat([
    /^(rtg|elo|rating)/, /^(klub|oddil|club|city|tym|team|druzstvo)/, /^(fed|zem|country)/
]);
// „rtg+/-" (změna ratingu) začíná na „rtg", ale do zúžené tabulky nepatří.
const CR_NEVER_PATTERN = /\+\/-|\+\/‑/;

function crNorm(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Maska sloupců podle presetu. Sloupce se liší turnaj od turnaje, počítá se proto
 * pro každý zvlášť z jeho vlastních hlaviček.
 * @returns {boolean[]|null} null = všechny sloupce
 */
function crColMask(headers, preset) {
    if (!Array.isArray(headers) || !headers.length) return null;
    if (preset === 'full') return null;
    const patterns = preset === 'compact' ? CR_COMPACT_PATTERNS : CR_STANDARD_PATTERNS;
    const mask = headers.map(h => !CR_NEVER_PATTERN.test(h) && patterns.some(p => p.test(crNorm(h))));
    mask[0] = true; // první sloupec (pořadí / šachovnice) je strukturálně esenciální
    if (mask.filter(Boolean).length < 2) return headers.map((_h, i) => i < 3);
    return mask;
}

function crRoundLabel(view, round) {
    if (view === 'round') return `${round}. kolo`;
    if (view === 'rankAfterRound') return `pořadí po ${round}. kole`;
    return 'konečné pořadí';
}

// ================================
// SLEDOVANÍ HRÁČI (watchlist)
// ================================

async function showTrackedPlayersModal() {
    const modal = document.createElement('div');
    modal.id = 'crWatchlistModal';
    modal.innerHTML = `
        <div style="position:fixed;inset:0;background:rgba(8,8,12,0.7);backdrop-filter:blur(3px);z-index:13000;"></div>
        <div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:13001;width:min(680px,calc(100vw - 20px));box-sizing:border-box;max-height:90vh;overflow-y:auto;background:#15151f;border:1px solid rgba(212,175,55,0.25);border-radius:14px;padding:clamp(1rem,3vw,1.5rem);box-shadow:0 24px 60px rgba(0,0,0,0.55);">
            <h3 style="margin:0 0 0.5rem;display:flex;align-items:center;gap:0.55rem;color:var(--primary-color,#d4af37);font-size:1.15rem;"><i class="fa-solid fa-user-tag"></i> Sledovaní hráči</h3>
            <p style="margin:0 0 1.1rem;color:#94a3b8;font-size:0.8rem;line-height:1.5;">Hráči, které chceme ve výsledcích i když jsou registrovaní jinde (typicky trenéři oddílu). Hledají se podle jména i podle ident-čísla ŠSČR z karty hráče.</p>

            <div id="crWlList" style="margin-bottom:1.1rem;">
                <div style="color:#94a3b8;font-size:0.85rem;">Načítám…</div>
            </div>

            <div style="${CR_CARD_STYLE}">
                <div style="color:#cbd5e1;font-size:0.88rem;font-weight:600;margin-bottom:0.7rem;">Přidat hráče</div>
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:0.6rem;margin-bottom:0.6rem;">
                    <div>
                        <label style="${CR_LABEL_STYLE}">Jméno <span style="color:var(--primary-color,#d4af37);">*</span></label>
                        <input type="text" id="crWlName" placeholder="Sykora, Marek" style="${CR_INPUT_STYLE}">
                    </div>
                    <div>
                        <label style="${CR_LABEL_STYLE}">Ident-číslo ŠSČR</label>
                        <input type="text" id="crWlIdent" inputmode="numeric" placeholder="35315" style="${CR_INPUT_STYLE}">
                    </div>
                    <div>
                        <label style="${CR_LABEL_STYLE}">Klub</label>
                        <input type="text" id="crWlClub" placeholder="SK ZIKUDA Turnov" style="${CR_INPUT_STYLE}">
                    </div>
                    <div>
                        <label style="${CR_LABEL_STYLE}">Poznámka</label>
                        <input type="text" id="crWlNote" placeholder="trenér mládeže" style="${CR_INPUT_STYLE}">
                    </div>
                </div>
                <p style="margin:0 0 0.7rem;color:#94a3b8;font-size:0.76rem;">Jméno piš bez diakritiky, tak jak ho uvádí chess-results: <code style="background:rgba(255,255,255,0.07);padding:0.05rem 0.3rem;border-radius:3px;">Příjmení, Jméno</code></p>
                <button type="button" id="crWlAdd" class="btn-primary btn-small"><i class="fa-solid fa-plus"></i> Přidat</button>
            </div>

            <div style="display:flex;justify-content:flex-end;margin-top:1.2rem;">
                <button type="button" id="crWlClose" class="btn-secondary">Zavřít</button>
            </div>
        </div>`;
    document.body.appendChild(modal);

    const $ = sel => modal.querySelector(sel);
    const close = () => modal.remove();
    $('#crWlClose').onclick = close;
    modal.firstElementChild.onclick = close;

    let players = [];

    const render = () => {
        const list = $('#crWlList');
        if (!players.length) {
            list.innerHTML = '<div style="color:#94a3b8;font-size:0.85rem;padding:0.6rem 0;">Zatím nikdo. Přidej třeba trenéry, kteří hrají za jiný klub.</div>';
            return;
        }
        list.innerHTML = players.map(p => `
            <div style="display:flex;align-items:center;gap:0.6rem;flex-wrap:wrap;padding:0.55rem 0.7rem;border:1px solid rgba(255,255,255,0.08);border-radius:8px;margin-bottom:0.45rem;background:rgba(0,0,0,0.2);${p.active ? '' : 'opacity:0.5;'}">
                <label style="display:flex;align-items:center;gap:0.45rem;cursor:pointer;flex:1;min-width:200px;">
                    <input type="checkbox" class="crWlActive" data-id="${p.id}" ${p.active ? 'checked' : ''} style="width:17px;height:17px;accent-color:var(--primary-color,#d4af37);cursor:pointer;">
                    <span style="color:#e2e8f0;font-size:0.9rem;font-weight:600;">${crEsc(p.fullName)}</span>
                </label>
                <span style="color:#94a3b8;font-size:0.78rem;flex:1;min-width:140px;">
                    ${p.sscrId ? `ident ${crEsc(p.sscrId)}` : '<em>bez ident-čísla</em>'}${p.club ? ` · ${crEsc(p.club)}` : ''}${p.note ? ` · ${crEsc(p.note)}` : ''}
                </span>
                <button type="button" class="crWlDel action-btn btn-delete" data-id="${p.id}" title="Smazat"><i class="fa-solid fa-trash"></i></button>
            </div>`).join('');

        list.querySelectorAll('.crWlActive').forEach(cb => {
            cb.onchange = async () => {
                const player = players.find(x => x.id === Number(cb.dataset.id));
                try {
                    await crFetch(`/tracked-players/${player.id}`, {
                        method: 'PUT',
                        body: JSON.stringify({ ...player, active: cb.checked })
                    });
                    player.active = cb.checked;
                    render();
                } catch (e) {
                    cb.checked = player.active;
                    window.showAlert('Změnu se nepodařilo uložit: ' + e.message, 'error');
                }
            };
        });
        list.querySelectorAll('.crWlDel').forEach(btn => {
            btn.onclick = async () => {
                const id = Number(btn.dataset.id);
                const player = players.find(x => x.id === id);
                if (!confirm(`Odebrat "${player.fullName}" ze sledovaných?`)) return;
                try {
                    await crFetch(`/tracked-players/${id}`, { method: 'DELETE' });
                    players = players.filter(x => x.id !== id);
                    render();
                } catch (e) {
                    window.showAlert('Smazání se nepodařilo: ' + e.message, 'error');
                }
            };
        });
    };

    $('#crWlAdd').onclick = async () => {
        const body = {
            fullName: $('#crWlName').value.trim(),
            sscrId: $('#crWlIdent').value.trim(),
            club: $('#crWlClub').value.trim(),
            note: $('#crWlNote').value.trim()
        };
        if (body.fullName.length < 3) {
            window.showAlert('Zadej jméno ve tvaru „Příjmení, Jméno".', 'error');
            return;
        }
        try {
            const created = await crFetch('/tracked-players', { method: 'POST', body: JSON.stringify(body) });
            players.push(created);
            players.sort((a, b) => Number(b.active) - Number(a.active) || a.fullName.localeCompare(b.fullName, 'cs'));
            ['#crWlName', '#crWlIdent', '#crWlClub', '#crWlNote'].forEach(sel => { $(sel).value = ''; });
            render();
        } catch (e) {
            window.showAlert('Hráče se nepodařilo uložit: ' + e.message, 'error');
        }
    };

    try {
        players = await crFetch('/tracked-players');
    } catch (e) {
        $('#crWlList').innerHTML = `<div style="color:#f87171;font-size:0.85rem;">Nepodařilo se načíst: ${crEsc(e.message)}</div>`;
        return;
    }
    render();
}

// ================================
// HLAVNÍ PRŮVODCE
// ================================

function showChessResultsModal() {
    // Kurzor v editoru — modal sebere fokus, bez uložení by tabulka spadla na konec článku.
    let savedRange = null;
    const selection = window.getSelection();
    const editorEl = document.getElementById('articleContent');
    if (selection.rangeCount > 0) savedRange = selection.getRangeAt(0).cloneRange();

    const state = {
        index: null,             // odpověď /chess-results/tournaments
        selected: new Set(),     // vybraná tnr
        view: 'standings',
        round: null,
        clubQuery: 'Bižuterie',
        useWatchlist: true,
        allFeds: false,          // true = bez předfiltru FED (pomalejší, i cizinci)
        scan: [],                // pole výsledků skenu (odpovědi serveru)
        excluded: new Set(),     // "tnr|klíč hráče" — hráči vyřazení z výběru
        skipped: new Set(),      // tnr turnajů, které se nemají vložit
        topN: 10,
        preset: 'standard',
        heading: true,
        sourceLink: false
    };

    const modal = document.createElement('div');
    modal.id = 'chessResultsModal';
    modal.innerHTML = `
        <div class="cr-overlay" style="position:fixed;inset:0;background:rgba(8,8,12,0.75);backdrop-filter:blur(3px);z-index:12000;"></div>
        <div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:12001;width:min(920px,calc(100vw - 20px));box-sizing:border-box;max-height:90vh;overflow-y:auto;background:#15151f;border:1px solid rgba(212,175,55,0.25);border-radius:14px;padding:clamp(1rem,3vw,1.5rem);box-shadow:0 24px 60px rgba(0,0,0,0.55);">
            <h3 style="margin:0 0 0.35rem;display:flex;align-items:center;gap:0.55rem;color:var(--primary-color,#d4af37);font-size:1.2rem;"><i class="fa-solid fa-trophy"></i> Výsledky z chess-results.com</h3>
            <div id="crSteps" style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:1.1rem;font-size:0.76rem;color:#64748b;"></div>

            <!-- KROK 1 -->
            <div id="crStep1">
                <label style="${CR_LABEL_STYLE}">Odkaz na turnaj nebo festival <span style="color:var(--primary-color,#d4af37);">*</span></label>
                <input type="text" id="crUrl" placeholder="https://chess-results.com/tnr1357472.aspx?lan=5" style="${CR_INPUT_STYLE}">
                <p style="margin:0.6rem 0 1.1rem;color:#94a3b8;font-size:0.78rem;line-height:1.5;display:flex;gap:0.45rem;">
                    <i class="fa-solid fa-circle-info" style="color:var(--primary-color,#d4af37);margin-top:0.15rem;"></i>
                    <span>Stačí odkaz na libovolnou stránku turnaje. U festivalů (Czech Open apod.) nabídnu všechny dílčí turnaje k výběru.</span>
                </p>
                <div id="crStep1Status" style="min-height:1.2rem;font-size:0.83rem;color:#94a3b8;margin-bottom:0.9rem;"></div>
                <div style="display:flex;gap:0.6rem;justify-content:flex-end;flex-wrap:wrap;">
                    <button type="button" class="btn-secondary crClose">Zrušit</button>
                    <button type="button" id="crLoad" class="btn-primary"><i class="fa-solid fa-download"></i> Načíst turnaje</button>
                </div>
            </div>

            <!-- KROK 2 -->
            <div id="crStep2" style="display:none;">
                <div id="crTitle" style="color:#e2e8f0;font-size:0.95rem;font-weight:600;margin-bottom:0.8rem;"></div>

                <div id="crTournamentBox" style="${CR_CARD_STYLE}margin-bottom:0.9rem;">
                    <div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.7rem;">
                        <span style="color:#cbd5e1;font-size:0.88rem;font-weight:600;">Které turnaje prohledat</span>
                        <span style="display:inline-flex;gap:0.4rem;">
                            <button type="button" id="crSelectAll" class="btn-secondary btn-small">Vybrat vše</button>
                            <button type="button" id="crSelectNone" class="btn-secondary btn-small">Zrušit výběr</button>
                        </span>
                    </div>
                    <div id="crTournamentList" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:0.35rem;max-height:34vh;overflow-y:auto;"></div>
                </div>

                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:0.9rem;margin-bottom:0.9rem;">
                    <div style="${CR_CARD_STYLE}">
                        <div style="color:#cbd5e1;font-size:0.88rem;font-weight:600;margin-bottom:0.6rem;">Co vložit</div>
                        <label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;color:#cbd5e1;font-size:0.87rem;margin-bottom:0.4rem;">
                            <input type="radio" name="crView" value="standings" checked style="accent-color:var(--primary-color,#d4af37);"> Konečné pořadí
                        </label>
                        <label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;color:#cbd5e1;font-size:0.87rem;margin-bottom:0.4rem;">
                            <input type="radio" name="crView" value="rankAfterRound" style="accent-color:var(--primary-color,#d4af37);"> Pořadí po kole
                        </label>
                        <label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;color:#cbd5e1;font-size:0.87rem;margin-bottom:0.7rem;">
                            <input type="radio" name="crView" value="round" style="accent-color:var(--primary-color,#d4af37);"> Výsledky kola (párování)
                        </label>
                        <div id="crRoundWrap" style="display:none;">
                            <label style="${CR_LABEL_STYLE}">Číslo kola <span id="crRoundHint" style="color:#64748b;font-weight:400;"></span></label>
                            <input type="number" id="crRound" min="1" max="30" step="1" style="${CR_INPUT_STYLE}">
                        </div>
                    </div>

                    <div style="${CR_CARD_STYLE}">
                        <div style="color:#cbd5e1;font-size:0.88rem;font-weight:600;margin-bottom:0.6rem;">Koho hledat</div>
                        <label style="${CR_LABEL_STYLE}">Klub</label>
                        <input type="text" id="crClub" value="Bižuterie" style="${CR_INPUT_STYLE}">
                        <label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;color:#cbd5e1;font-size:0.85rem;margin:0.7rem 0 0.4rem;">
                            <input type="checkbox" id="crUseWatchlist" checked style="width:17px;height:17px;accent-color:var(--primary-color,#d4af37);cursor:pointer;"> Hledat i sledované hráče
                        </label>
                        <label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;color:#cbd5e1;font-size:0.85rem;margin-bottom:0.7rem;">
                            <input type="checkbox" id="crAllFeds" style="width:17px;height:17px;accent-color:var(--primary-color,#d4af37);cursor:pointer;"> Projít i zahraniční hráče <span style="color:#64748b;">(pomalejší)</span>
                        </label>
                        <button type="button" id="crManageWatchlist" class="btn-secondary btn-small"><i class="fa-solid fa-user-tag"></i> Sledovaní hráči</button>
                    </div>
                </div>

                <div id="crScanNote" style="font-size:0.8rem;color:#94a3b8;margin-bottom:0.6rem;"></div>
                <div id="crProgress" style="display:none;margin-bottom:0.9rem;">
                    <div style="font-size:0.83rem;color:#cbd5e1;margin-bottom:0.4rem;" id="crProgressText"></div>
                    <div style="height:6px;background:rgba(255,255,255,0.08);border-radius:6px;overflow:hidden;">
                        <div id="crProgressBar" style="height:100%;width:0%;background:var(--primary-color,#d4af37);transition:width 0.3s;"></div>
                    </div>
                </div>

                <div style="display:flex;gap:0.6rem;justify-content:flex-end;flex-wrap:wrap;">
                    <button type="button" class="btn-secondary crClose">Zrušit</button>
                    <button type="button" id="crBackTo1" class="btn-secondary">Zpět</button>
                    <button type="button" id="crScan" class="btn-primary"><i class="fa-solid fa-magnifying-glass"></i> Najít naše hráče</button>
                </div>
            </div>

            <!-- KROK 3 -->
            <div id="crStep3" style="display:none;">
                <div id="crScanSummary" style="font-size:0.83rem;color:#94a3b8;margin-bottom:0.8rem;"></div>
                <div id="crResults" style="max-height:38vh;overflow-y:auto;margin-bottom:0.9rem;"></div>

                <div style="${CR_CARD_STYLE}margin-bottom:0.9rem;">
                    <div style="display:flex;gap:0.9rem;flex-wrap:wrap;align-items:center;">
                        <span style="color:#94a3b8;font-size:0.8rem;">Rozsah tabulky:</span>
                        <div style="display:inline-flex;background:rgba(0,0,0,0.3);border-radius:6px;padding:3px;gap:2px;">
                            <button type="button" class="crTopBtn" data-topn="1" style="padding:5px 9px;background:transparent;border:none;color:#cbd5e1;font-size:0.78rem;border-radius:6px;cursor:pointer;">🥇 Vítěz</button>
                            <button type="button" class="crTopBtn" data-topn="3" style="padding:5px 9px;background:transparent;border:none;color:#cbd5e1;font-size:0.78rem;border-radius:6px;cursor:pointer;">Top 3</button>
                            <button type="button" class="crTopBtn" data-topn="10" style="padding:5px 9px;background:transparent;border:none;color:#cbd5e1;font-size:0.78rem;border-radius:6px;cursor:pointer;">Top 10</button>
                            <button type="button" class="crTopBtn" data-topn="0" style="padding:5px 9px;background:transparent;border:none;color:#cbd5e1;font-size:0.78rem;border-radius:6px;cursor:pointer;">Všichni</button>
                        </div>
                        <span style="color:#94a3b8;font-size:0.8rem;">Sloupce:</span>
                        <div style="display:inline-flex;background:rgba(0,0,0,0.3);border-radius:6px;padding:3px;gap:2px;">
                            <button type="button" class="crPresetBtn" data-preset="compact" style="padding:5px 9px;background:transparent;border:none;color:#cbd5e1;font-size:0.78rem;border-radius:6px;cursor:pointer;">Kompaktní</button>
                            <button type="button" class="crPresetBtn" data-preset="standard" style="padding:5px 9px;background:transparent;border:none;color:#cbd5e1;font-size:0.78rem;border-radius:6px;cursor:pointer;">Standardní</button>
                            <button type="button" class="crPresetBtn" data-preset="full" style="padding:5px 9px;background:transparent;border:none;color:#cbd5e1;font-size:0.78rem;border-radius:6px;cursor:pointer;">Plná</button>
                        </div>
                    </div>
                    <div style="display:flex;gap:1.1rem;flex-wrap:wrap;margin-top:0.7rem;">
                        <label style="display:inline-flex;align-items:center;gap:0.45rem;cursor:pointer;color:#cbd5e1;font-size:0.83rem;">
                            <input type="checkbox" id="crHeading" checked style="accent-color:var(--primary-color,#d4af37);"> Nadpis turnaje nad tabulkou
                        </label>
                        <label style="display:inline-flex;align-items:center;gap:0.45rem;cursor:pointer;color:#cbd5e1;font-size:0.83rem;">
                            <input type="checkbox" id="crSourceLink" style="accent-color:var(--primary-color,#d4af37);"> Tlačítko „🔗 Kompletní výsledky"
                        </label>
                    </div>
                </div>

                <div style="color:#94a3b8;font-size:0.8rem;margin-bottom:0.4rem;">Náhled</div>
                <div id="crPreview" style="background:rgba(0,0,0,0.3);padding:0.8rem;border-radius:8px;min-height:100px;max-height:40vh;overflow:auto;border:1px solid rgba(255,255,255,0.06);"></div>

                <div style="display:flex;gap:0.6rem;justify-content:flex-end;flex-wrap:wrap;margin-top:1.1rem;">
                    <button type="button" class="btn-secondary crClose">Zrušit</button>
                    <button type="button" id="crBackTo2" class="btn-secondary">Zpět</button>
                    <button type="button" id="crInsert" class="btn-primary"><i class="fa-solid fa-check"></i> Vložit do článku</button>
                </div>
            </div>
        </div>`;
    document.body.appendChild(modal);

    const $ = sel => modal.querySelector(sel);
    const close = () => {
        if (savedRange) { selection.removeAllRanges(); selection.addRange(savedRange); }
        modal.remove();
    };
    modal.querySelectorAll('.crClose').forEach(b => { b.onclick = close; });
    modal.querySelector('.cr-overlay').onclick = close;

    // ---- krokovadlo -------------------------------------------------
    const setStep = (n) => {
        [1, 2, 3].forEach(i => { $(`#crStep${i}`).style.display = i === n ? 'block' : 'none'; });
        $('#crSteps').innerHTML = ['1 · Odkaz', '2 · Výběr turnajů', '3 · Náhled a vložení']
            .map((label, i) => {
                const active = i + 1 === n;
                return `<span style="padding:0.25rem 0.6rem;border-radius:6px;${active
                    ? 'background:rgba(212,175,55,0.16);color:#fbbf24;font-weight:600;'
                    : 'background:rgba(255,255,255,0.04);'}">${label}</span>`;
            }).join('<span style="align-self:center;">›</span>');
    };
    setStep(1);

    // ---- KROK 1: načtení indexu -------------------------------------
    $('#crLoad').onclick = async () => {
        const url = $('#crUrl').value.trim();
        if (!url) { $('#crStep1Status').textContent = 'Zadej odkaz na turnaj.'; return; }
        $('#crStep1Status').innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Načítám turnaj…';
        $('#crLoad').disabled = true;
        try {
            const index = await crFetch(`/scraping/chess-results/tournaments?url=${encodeURIComponent(url)}`);
            if (!index.tournaments || !index.tournaments.length) {
                $('#crStep1Status').innerHTML = '❌ Na této stránce nevidím žádný turnaj. Zkontroluj odkaz.';
                return;
            }
            state.index = index;
            state.selected = new Set(index.isIndex
                ? (index.tnr ? [index.tnr] : [])          // festival → předvybraný jen ten aktuální
                : index.tournaments.map(t => t.tnr));      // jeden turnaj → rovnou vybraný
            renderStep2();
            setStep(2);
        } catch (e) {
            $('#crStep1Status').innerHTML = `❌ ${crEsc(e.message)}`;
        } finally {
            $('#crLoad').disabled = false;
        }
    };
    $('#crUrl').addEventListener('keydown', e => { if (e.key === 'Enter') $('#crLoad').click(); });

    // ---- KROK 2 ------------------------------------------------------
    const renderStep2 = () => {
        const index = state.index;
        $('#crTitle').innerHTML = index.isIndex
            ? `<i class="fa-solid fa-layer-group" style="color:var(--primary-color,#d4af37);"></i> Festival <strong>${crEsc(index.title)}</strong> — ${index.tournaments.length} turnajů`
            : `<i class="fa-solid fa-chess-board" style="color:var(--primary-color,#d4af37);"></i> ${crEsc(index.title)}`;

        $('#crTournamentBox').style.display = index.isIndex ? 'block' : 'none';
        $('#crTournamentList').innerHTML = index.tournaments.map(t => `
            <label style="display:flex;align-items:center;gap:0.5rem;padding:0.35rem 0.5rem;border-radius:6px;cursor:pointer;background:rgba(0,0,0,0.2);">
                <input type="checkbox" class="crTnr" value="${crEscAttr(t.tnr)}" ${state.selected.has(t.tnr) ? 'checked' : ''} style="width:16px;height:16px;accent-color:var(--primary-color,#d4af37);cursor:pointer;">
                <span style="color:#e2e8f0;font-size:0.85rem;">
                    ${t.label ? `<strong style="color:#fbbf24;">${crEsc(t.label)}</strong> · ` : ''}${crEsc(t.name || t.label || `tnr${t.tnr}`)}
                </span>
            </label>`).join('');

        modal.querySelectorAll('.crTnr').forEach(cb => {
            cb.onchange = () => {
                if (cb.checked) state.selected.add(cb.value); else state.selected.delete(cb.value);
                updateScanNote();
            };
        });

        const rounds = state.view === 'round' ? index.pairingRounds : index.rankingRounds;
        const maxRound = rounds && rounds.length ? Math.max(...rounds) : null;
        if (maxRound && !$('#crRound').value) $('#crRound').value = maxRound;
        $('#crRoundHint').textContent = maxRound ? `(turnaj má ${maxRound} kol)` : '';
        updateScanNote();
    };

    const updateScanNote = () => {
        const n = state.selected.size;
        if (!n) { $('#crScanNote').innerHTML = '⚠️ Vyber alespoň jeden turnaj.'; return; }
        const estimate = state.allFeds ? '10–20 s' : '5–15 s';
        $('#crScanNote').innerHTML = `Prohledám <strong>${n}</strong> ${n === 1 ? 'turnaj' : (n < 5 ? 'turnaje' : 'turnajů')} · ${crEsc(crRoundLabel(state.view, $('#crRound').value || '?'))} · odhad ${estimate} na turnaj. U turnajů bez sloupce klubu se stahují karty hráčů, proto to chvíli trvá.`;
    };

    $('#crSelectAll').onclick = () => {
        modal.querySelectorAll('.crTnr').forEach(cb => { cb.checked = true; state.selected.add(cb.value); });
        updateScanNote();
    };
    $('#crSelectNone').onclick = () => {
        modal.querySelectorAll('.crTnr').forEach(cb => { cb.checked = false; });
        state.selected.clear();
        updateScanNote();
    };

    modal.querySelectorAll('input[name="crView"]').forEach(radio => {
        radio.onchange = () => {
            state.view = radio.value;
            $('#crRoundWrap').style.display = state.view === 'standings' ? 'none' : 'block';
            if (state.index) {
                const rounds = state.view === 'round' ? state.index.pairingRounds : state.index.rankingRounds;
                const maxRound = rounds && rounds.length ? Math.max(...rounds) : null;
                $('#crRoundHint').textContent = maxRound ? `(turnaj má ${maxRound} kol)` : '';
                if (maxRound && !$('#crRound').value) $('#crRound').value = maxRound;
            }
            // párování má vlastní sloupce (šachovnice, soupeř) — ořezávat je nemá smysl
            state.preset = state.view === 'round' ? 'full' : 'standard';
            updateScanNote();
        };
    });
    $('#crRound').oninput = updateScanNote;
    $('#crClub').oninput = () => { state.clubQuery = $('#crClub').value.trim(); };
    $('#crUseWatchlist').onchange = () => { state.useWatchlist = $('#crUseWatchlist').checked; };
    $('#crAllFeds').onchange = () => { state.allFeds = $('#crAllFeds').checked; updateScanNote(); };
    $('#crManageWatchlist').onclick = () => showTrackedPlayersModal();
    $('#crBackTo1').onclick = () => setStep(1);

    // ---- KROK 2 → sken ----------------------------------------------
    $('#crScan').onclick = async () => {
        const tnrs = [...state.selected];
        if (!tnrs.length) { window.showAlert('Vyber alespoň jeden turnaj.', 'error'); return; }

        state.round = state.view === 'standings' ? null : Number($('#crRound').value);
        if (state.view !== 'standings' && !(state.round > 0)) {
            window.showAlert('Zadej číslo kola.', 'error');
            return;
        }
        state.clubQuery = $('#crClub').value.trim() || 'Bižuterie';

        $('#crScan').disabled = true;
        $('#crProgress').style.display = 'block';
        const results = [];
        let watchlistCount = 0;

        const setProgress = (done, total, text) => {
            $('#crProgressBar').style.width = `${Math.round((done / total) * 100)}%`;
            $('#crProgressText').textContent = text;
        };

        try {
            for (let i = 0; i < tnrs.length; i += CR_SCAN_BATCH) {
                const chunk = tnrs.slice(i, i + CR_SCAN_BATCH);
                const from = i + 1;
                const to = Math.min(i + chunk.length, tnrs.length);
                setProgress(i, tnrs.length, tnrs.length === 1
                    ? 'Skenuji turnaj…'
                    : `Skenuji ${from === to ? `turnaj ${from}` : `turnaje ${from}–${to}`} z ${tnrs.length}…`);
                try {
                    const data = await crFetch('/scraping/chess-results/scan', {
                        method: 'POST',
                        body: JSON.stringify({
                            tnrs: chunk,
                            view: state.view,
                            round: state.round,
                            clubQuery: state.clubQuery,
                            fedFilter: state.allFeds ? [] : ['CZE'],
                            useWatchlist: state.useWatchlist
                        })
                    });
                    results.push(...(data.tournaments || []));
                    watchlistCount = data.watchlistCount || watchlistCount;
                } catch (e) {
                    // Chyba dávky nesmí shodit celý sken — ostatní turnaje pokračují.
                    chunk.forEach(tnr => results.push({ tnr, name: '', players: [], table: null, warnings: [], error: e.message }));
                }
                setProgress(to, tnrs.length, '');
            }
        } finally {
            $('#crScan').disabled = false;
            $('#crProgress').style.display = 'none';
        }

        state.scan = results;
        state.excluded = new Set();
        state.skipped = new Set(results.filter(t => !t.players || !t.players.length).map(t => t.tnr));
        state.watchlistCount = watchlistCount;
        renderStep3();
        setStep(3);
    };

    // ---- KROK 3 ------------------------------------------------------
    const playerKey = (tnr, player) => `${tnr}|${player.startNo ?? player.name}`;
    const usablePlayers = t => (t.players || []).filter(p => p.rowIndex !== null && p.rowIndex !== undefined);
    const includedPlayers = t => usablePlayers(t).filter(p => !state.excluded.has(playerKey(t.tnr, p)));

    const renderStep3 = () => {
        const found = state.scan.reduce((sum, t) => sum + (t.players ? t.players.length : 0), 0);
        const okCount = state.scan.filter(t => !t.error).length;
        $('#crScanSummary').innerHTML = `Prohledáno ${okCount} z ${state.scan.length} turnajů · nalezeno <strong style="color:#fbbf24;">${found}</strong> našich hráčů · sledovaných v evidenci: ${state.watchlistCount || 0}`;

        $('#crResults').innerHTML = state.scan.map(t => {
            if (t.error) {
                return `<div style="${CR_CARD_STYLE}border-color:rgba(248,113,113,0.35);margin-bottom:0.6rem;">
                    <strong style="color:#f87171;">tnr${crEsc(t.tnr)}</strong>
                    <div style="color:#fca5a5;font-size:0.82rem;margin-top:0.3rem;">${crEsc(t.error)}</div>
                </div>`;
            }
            const players = usablePlayers(t);
            const orphans = (t.players || []).length - players.length;
            const rows = t.table && t.table.rows ? t.table.rows.length : 0;
            const label = state.index && state.index.tournaments.find(x => x.tnr === t.tnr);
            return `<div style="${CR_CARD_STYLE}margin-bottom:0.6rem;">
                <label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;margin-bottom:0.5rem;">
                    <input type="checkbox" class="crUseT" data-tnr="${crEscAttr(t.tnr)}" ${state.skipped.has(t.tnr) ? '' : 'checked'} style="width:17px;height:17px;accent-color:var(--primary-color,#d4af37);cursor:pointer;">
                    <span style="color:#e2e8f0;font-size:0.9rem;font-weight:600;">${label && label.label ? `<span style="color:#fbbf24;">${crEsc(label.label)}</span> · ` : ''}${crEsc(t.name || `tnr${t.tnr}`)}</span>
                </label>
                <div style="color:#64748b;font-size:0.76rem;margin-bottom:0.5rem;">
                    ${rows} řádků · ${players.length} našich${orphans ? ` · ${orphans} hráčů v tomto pohledu nehrálo` : ''}${t.stats ? ` · ${t.stats.cardsFetched + (t.stats.cardsCached || 0)} karet · ${Math.round(t.stats.durationMs / 100) / 10} s` : ''}
                </div>
                ${players.length ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:0.3rem;">${players.map(p => `
                    <label style="display:flex;align-items:center;gap:0.45rem;padding:0.3rem 0.45rem;border-radius:6px;background:rgba(0,0,0,0.25);cursor:pointer;">
                        <input type="checkbox" class="crUseP" data-key="${crEscAttr(playerKey(t.tnr, p))}" ${state.excluded.has(playerKey(t.tnr, p)) ? '' : 'checked'} style="width:15px;height:15px;accent-color:var(--primary-color,#d4af37);cursor:pointer;">
                        <span style="color:#e2e8f0;font-size:0.82rem;flex:1;min-width:0;">
                            ${p.rank ? `${crEsc(p.rank)}. ` : ''}${crEsc(p.name)}${p.points ? ` <span style="color:#4ade80;">${crEsc(p.points)} b.</span>` : ''}
                            <span style="display:block;color:#64748b;font-size:0.72rem;">${crEsc(p.club || '—')}${p.sscrId ? ` · ident ${crEsc(p.sscrId)}` : ''}</span>
                        </span>
                        <span style="font-size:0.68rem;padding:0.12rem 0.4rem;border-radius:6px;white-space:nowrap;${p.reason === 'klub'
        ? 'background:rgba(212,175,55,0.18);color:#fbbf24;'
        : 'background:rgba(96,165,250,0.18);color:#93c5fd;'}">${crEsc(p.reason || '')}</span>
                    </label>`).join('')}</div>`
        : '<div style="color:#94a3b8;font-size:0.82rem;">Nikoho jsme tu nenašli. Tabulku můžeš vložit i tak (zaškrtnutím turnaje výše).</div>'}
                ${(t.warnings && t.warnings.length) ? `<div style="color:#fbbf24;font-size:0.74rem;margin-top:0.45rem;">⚠️ ${t.warnings.map(w => crEsc(w)).join('<br>⚠️ ')}</div>` : ''}
            </div>`;
        }).join('');

        modal.querySelectorAll('.crUseT').forEach(cb => {
            cb.onchange = () => {
                if (cb.checked) state.skipped.delete(cb.dataset.tnr); else state.skipped.add(cb.dataset.tnr);
                renderPreview();
            };
        });
        modal.querySelectorAll('.crUseP').forEach(cb => {
            cb.onchange = () => {
                if (cb.checked) state.excluded.delete(cb.dataset.key); else state.excluded.add(cb.dataset.key);
                renderPreview();
            };
        });

        syncToggleButtons();
        renderPreview();
    };

    const syncToggleButtons = () => {
        modal.querySelectorAll('.crTopBtn').forEach(b => {
            const active = Number(b.dataset.topn) === state.topN;
            b.style.background = active ? 'rgba(212,175,55,0.2)' : 'transparent';
            b.style.color = active ? '#fbbf24' : '#cbd5e1';
            b.style.fontWeight = active ? '600' : 'normal';
        });
        modal.querySelectorAll('.crPresetBtn').forEach(b => {
            const active = b.dataset.preset === state.preset;
            b.style.background = active ? 'rgba(212,175,55,0.2)' : 'transparent';
            b.style.color = active ? '#fbbf24' : '#cbd5e1';
            b.style.fontWeight = active ? '600' : 'normal';
        });
    };

    /** HTML jedné sekce = nadpis + tabulka (+ volitelné CTA). */
    const buildTournamentHtml = (t) => {
        if (!t.table || !t.table.headers || !t.table.rows || !t.table.rows.length) return '';
        const highlight = new Set(includedPlayers(t).map(p => p.rowIndex));
        const parts = [];
        if (state.heading) {
            // Kolo bereme z tabulky — server u dohraných turnajů vrátí konečný stav
            // i pro starší kolo a nadpis by pak lhal.
            const shownRound = (t.table && t.table.round) || state.round;
            const suffix = state.view === 'standings' ? '' : ` – ${crRoundLabel(state.view, shownRound)}`;
            parts.push(`<h3>${crEsc((t.name || '') + suffix)}</h3>`);
        }
        parts.push(buildResultsTableHtml({
            headers: t.table.headers,
            rows: t.table.rows.map(r => r.slice()),
            topN: state.topN,
            colMask: crColMask(t.table.headers, state.preset),
            highlightRows: highlight
        }));
        if (state.sourceLink && t.url) parts.push(buildChessResultsLinkHtml(t.url));
        return parts.join('\n');
    };

    const composeHtml = () => state.scan
        .filter(t => !t.error && !state.skipped.has(t.tnr))
        .map(buildTournamentHtml)
        .filter(Boolean)
        .join('\n');

    const renderPreview = () => {
        const html = composeHtml();
        $('#crPreview').innerHTML = html || '<div style="color:#94a3b8;font-size:0.85rem;">Není co vložit — zaškrtni alespoň jeden turnaj.</div>';
        $('#crInsert').disabled = !html;
        $('#crInsert').style.opacity = html ? '1' : '0.5';
    };

    modal.querySelectorAll('.crTopBtn').forEach(btn => {
        btn.onclick = () => { state.topN = Number(btn.dataset.topn); syncToggleButtons(); renderPreview(); };
    });
    modal.querySelectorAll('.crPresetBtn').forEach(btn => {
        btn.onclick = () => { state.preset = btn.dataset.preset; syncToggleButtons(); renderPreview(); };
    });
    $('#crHeading').onchange = () => { state.heading = $('#crHeading').checked; renderPreview(); };
    $('#crSourceLink').onchange = () => { state.sourceLink = $('#crSourceLink').checked; renderPreview(); };
    $('#crBackTo2').onclick = () => setStep(2);

    // ---- vložení do článku ------------------------------------------
    $('#crInsert').onclick = () => {
        const htmlToInsert = composeHtml();
        if (!htmlToInsert) return;
        if (savedRange) { selection.removeAllRanges(); selection.addRange(savedRange); }

        const editor = editorEl || document.getElementById('articleContent');
        if (editor) editor.focus();
        const range = savedRange || (selection.rangeCount ? selection.getRangeAt(0) : null);
        if (!range) { window.showAlert('Klikni nejdřív do textu článku, kam se má tabulka vložit.', 'error'); return; }

        const wrapper = document.createElement('div');
        wrapper.innerHTML = htmlToInsert + '<p><br></p>';
        const fragment = document.createDocumentFragment();
        let lastNode = null;
        while (wrapper.firstChild) { lastNode = wrapper.firstChild; fragment.appendChild(wrapper.firstChild); }
        range.deleteContents();
        range.insertNode(fragment);
        // kurzor ZA vloženou tabulku — další blok jde pod ni
        if (lastNode) {
            const r = document.createRange();
            r.setStartAfter(lastNode);
            r.collapse(true);
            selection.removeAllRanges();
            selection.addRange(r);
        }

        modal.remove();
        if (typeof updatePreview === 'function') updatePreview();
        window.isNewsDirty = true;
        window.showAlert('Tabulka vložena do článku.', 'success');
    };

    setTimeout(() => $('#crUrl').focus(), 50);
}

// ================================
// EXPORTS
// ================================
window.showChessResultsModal = showChessResultsModal;
window.showTrackedPlayersModal = showTrackedPlayersModal;
