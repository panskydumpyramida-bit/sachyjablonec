/**
 * Generátor PDF „Ohlášení přestupu v šachu" (ŠSČR).
 * Layout replikuje oficiální lístek (viz private/transfer-forms/prestup_vacek_*):
 * hráč + LOK/ELO, Z oddílu (vyjádření/razítko/odstupné nechává prázdné pro mateřský
 * oddíl), Do oddílu = TJ Bižuterie s kódem, souhlasem a oficiálním razítkem,
 * podpis hráče z canvasu.
 */

import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.join(__dirname, '../assets');

const CLUB_NAME = 'TJ Bižuterie Jablonec nad Nisou';
const CLUB_CODE = process.env.SSCR_CLUB_CODE || '17 052';

const GRAY = rgb(0.45, 0.45, 0.45);
const BLACK = rgb(0.05, 0.05, 0.05);

export async function generateTransferPdf(d) {
    const pdf = await PDFDocument.create();
    pdf.registerFontkit(fontkit);
    const font = await pdf.embedFont(fs.readFileSync(path.join(ASSETS, 'fonts/DejaVuSans.ttf')), { subset: true });
    const bold = await pdf.embedFont(fs.readFileSync(path.join(ASSETS, 'fonts/DejaVuSans-Bold.ttf')), { subset: true });

    const page = pdf.addPage([595.28, 841.89]); // A4
    const { width } = page.getSize();
    const M = 48;

    const text = (str, x, yy, opts = {}) => page.drawText(String(str ?? ''), {
        x, y: yy, size: opts.size || 10, font: opts.bold ? bold : font, color: opts.color || BLACK,
    });
    const label = (str, x, yy, b = false) => text(str, x, yy, { size: 8, color: b ? BLACK : GRAY, bold: b });
    const boxRect = (x, yy, w, h) => page.drawRectangle({
        x, y: yy, width: w, height: h, borderColor: rgb(0.35, 0.35, 0.35), borderWidth: 0.8,
        color: undefined, opacity: 0, borderOpacity: 1,
    });
    const fieldBox = (lbl, x, yy, w, val, opts = {}) => {
        label(lbl, x, yy + 21, opts.boldLabel);
        boxRect(x, yy - 6, w, 22);
        if (val) text(val, x + 7, yy, { size: 10.5 });
    };

    let y = 795;

    // hlavička ŠSČR
    text('Šachový svaz České republiky', M, y, { size: 9, bold: true });
    text('Kontaktní osoba: Trang Křivánek Nguyenová · registrace@chess.cz · 776 005 069', M, y - 12, { size: 8, color: GRAY });
    y -= 44;

    const title = 'OHLÁŠENÍ PŘESTUPU V ŠACHU';
    const tw = bold.widthOfTextAtSize(title, 17);
    text(title, (width - tw) / 2, y, { size: 17, bold: true });
    y -= 40;

    // Příjmení | Jméno | Titul
    fieldBox('Příjmení', M, y, 210, d.lastName);
    fieldBox('Jméno', M + 225, y, 165, d.firstName);
    fieldBox('Titul', M + 405, y, 94, d.title || '');
    y -= 48;

    // RČ | LOK | ELO
    fieldBox('Rodné číslo', M, y, 155, d.birthNumber || d.birthDate || '');
    fieldBox('Evid. č. LOK', M + 172, y, 155, d.lokId || '');
    fieldBox('ELO ČR ke dni přestupu', M + 344, y, 155, d.elo || '');
    y -= 48;

    // Z oddílu
    fieldBox('Z oddílu', M, y, 330, d.fromClub, { boldLabel: true });
    fieldBox('Kód oddílu', M + 355, y, 144, d.fromClubCode || '');
    y -= 50;

    // Vyjádření mateřského oddílu + razítko (prázdné pro ruční doplnění)
    label('Vyjádření k přestupu (případně zdůvodnění souhlasu)', M, y + 8);
    boxRect(M, y - 62, 300, 64);
    label('Razítko a podpis oddílu', M + 355, y + 8);
    boxRect(M + 355, y - 100, 144, 102);
    y -= 78;

    label('Mateřský oddíl požaduje odstupné', M, y + 4);
    text('Ano ☐          Ne ☐', M, y - 12, { size: 10 });
    label('Datum', M + 200, y + 4);
    boxRect(M + 200, y - 18, 100, 22);
    y -= 56;

    // Do oddílu (naše sekce — předvyplněná)
    fieldBox('Do oddílu', M, y, 330, CLUB_NAME, { boldLabel: true });
    fieldBox('Kód oddílu', M + 355, y, 144, CLUB_CODE);
    y -= 50;

    label('Vyjádření k přestupu (případně zdůvodnění souhlasu)', M, y + 8);
    boxRect(M, y - 62, 300, 64);
    text('Souhlasíme s přestupem.', M + 10, y - 20, { size: 10.5 });
    page.drawLine({ start: { x: M + 10, y: y - 24 }, end: { x: M + 240, y: y - 24 }, thickness: 0.5, color: GRAY });

    label('Razítko a podpis oddílu', M + 355, y + 8);
    boxRect(M + 355, y - 100, 144, 102);
    const stamp = await pdf.embedPng(fs.readFileSync(path.join(ASSETS, 'razitko-oficialni.png')));
    const stW = 136;
    const stH = stW * (stamp.height / stamp.width);
    page.drawImage(stamp, { x: M + 359, y: y - 50 - stH / 2, width: stW, height: stH });
    y -= 80;

    label('Datum', M, y + 4);
    boxRect(M, y - 18, 100, 22);
    text(d.date, M + 8, y - 11, { size: 10.5 });
    y -= 60;

    // Podpis hráče
    label('Podpis hráče (u ml. 18 let zák. zástupce)', M + 300, y + 8);
    boxRect(M + 300, y - 70, 199, 74);
    if (d.signaturePng) {
        try {
            const sig = await pdf.embedPng(Buffer.from(d.signaturePng.replace(/^data:image\/png;base64,/, ''), 'base64'));
            const sigW = 170;
            const sigH = Math.min(sigW * (sig.height / sig.width), 62);
            page.drawImage(sig, { x: M + 314, y: y - 66, width: sigW, height: sigH });
        } catch (e) { /* podpis nevložen */ }
    }
    label('Datum', M, y + 8);
    boxRect(M, y - 18, 100, 22);
    text(d.date, M + 8, y - 11, { size: 10.5 });
    y -= 100;

    // poznámky pod čarou (z oficiálního lístku)
    const notes = [
        'Přestupní termín je stanoven od 5.5. do 5.9. každého roku. Přestupní poplatek ve výši dle ES platí obvykle nový oddíl.',
        'Mateřský oddíl ho platí tehdy, když ve lhůtě 15 dní k přestoupení novému oddílu nevyjádří.',
        'Poplatek bude započítán na nejbližší faktuře, u individuálních členů je jeho zaplacení podmínkou schválení přestupu.',
        'U členů do 25 let musí být z ohlášení jasné, jak bylo vyřešeno odstupné, potvrzení o jeho úhradě se přikládá.',
    ];
    let ny = Math.min(y, 96);
    for (const n of notes) { text(n, M, ny, { size: 7.5, color: GRAY }); ny -= 10; }
    text('Vygenerováno online formulářem sachyjablonec.cz', M, ny - 4, { size: 7, color: GRAY });

    return Buffer.from(await pdf.save());
}
