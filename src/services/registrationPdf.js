/**
 * Generátor PDF „Žádost o členství v ŠSČR" — VĚRNÁ replika oficiálního formuláře
 * (Registrace-clenu-2025.docx): logo ŠSČR vlevo, kontakt vpravo, zaoblené rámečky
 * s popisky vlevo, checkbox registrace, razítko a podpis oddílu, podpis hráče.
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

const BLACK = rgb(0.05, 0.05, 0.05);
const BOX = rgb(0.15, 0.15, 0.15);

export async function generateRegistrationPdf(d) {
    const pdf = await PDFDocument.create();
    pdf.registerFontkit(fontkit);
    const font = await pdf.embedFont(fs.readFileSync(path.join(ASSETS, 'fonts/DejaVuSans.ttf')), { subset: true });
    const bold = await pdf.embedFont(fs.readFileSync(path.join(ASSETS, 'fonts/DejaVuSans-Bold.ttf')), { subset: true });

    const page = pdf.addPage([595.28, 841.89]); // A4 na výšku, formulář v horní polovině (jako originál)
    const M = 40;                // levý okraj
    const W = 515;               // šířka obsahu
    const TOP = 780;             // horní hrana obsahu (y v PDF souřadnicích)

    // y-souřadnice zadávám "odshora" (jako v originále), tohle převádí do PDF
    const Y = (yTop) => TOP - yTop;

    const text = (str, x, yTop, opts = {}) => page.drawText(String(str ?? ''), {
        x: M + x, y: Y(yTop), size: opts.size || 9.5,
        font: opts.bold ? bold : font, color: opts.color || BLACK,
    });
    const textRight = (str, xRight, yTop, opts = {}) => {
        const f = opts.bold ? bold : font;
        const w = f.widthOfTextAtSize(String(str), opts.size || 9.5);
        text(str, xRight - w, yTop, opts);
    };

    // zaoblený rámeček (jako v DOCX) — SVG path, y roste dolů od kotvy
    const rrect = (x, yTop, w, h, r = 7) => {
        const p = `M ${r} 0 L ${w - r} 0 Q ${w} 0 ${w} ${r} L ${w} ${h - r} Q ${w} ${h} ${w - r} ${h} L ${r} ${h} Q 0 ${h} 0 ${h - r} L 0 ${r} Q 0 0 ${r} 0 Z`;
        page.drawSvgPath(p, { x: M + x, y: Y(yTop), borderColor: BOX, borderWidth: 1.1 });
    };
    // rámeček s vepsanou hodnotou
    const fbox = (x, yTop, w, val, h = 22) => {
        rrect(x, yTop, w, h);
        if (val) {
            let v = String(val);
            while (font.widthOfTextAtSize(v, 10) > w - 12 && v.length > 1) v = v.slice(0, -1);
            text(v, x + 6, yTop + h - 7, { size: 10 });
        }
    };

    // ---------- hlavička ----------
    const logo = await pdf.embedPng(fs.readFileSync(path.join(ASSETS, 'logo-sscr.png')));
    const logoW = 118;
    page.drawImage(logo, { x: M + 20, y: Y(52), width: logoW, height: logoW * (logo.height / logo.width) });

    textRight('Kontaktní osoba: Trang Křivánek Nguyenová', W, 6);
    textRight('Email: registrace@chess.cz', W, 20, { color: rgb(0.2, 0.45, 0.55) });
    textRight('Tel.:776 005 069', W, 34);
    textRight('ŽÁDOST O ČLENSTVÍ V ŠSČR', W, 66, { size: 16.5, bold: true });

    // ---------- pole ----------
    let y = 84;

    // Oddíl + kód
    text('šachový', 0, y + 8); text('Oddíl', 0, y + 20);
    fbox(48, y, 322, CLUB_NAME, 26);
    text('Kód', 385, y + 8); text('oddílu', 385, y + 20);
    fbox(425, y, 90, CLUB_CODE, 26);
    y += 38;

    // Příjmení / Jméno / Další jméno
    text('Příjmení', 0, y + 15);
    fbox(48, y, 145, d.lastName, 24);
    text('Jméno', 205, y + 15);
    fbox(243, y, 130, d.firstName, 24);
    text('Další', 385, y + 8); text('jméno*', 385, y + 20);
    fbox(425, y, 90, d.middleName || '', 24);
    y += 36;

    // Rodné číslo / pozn. / Titul
    text('Rodné', 0, y + 8); text('Číslo', 0, y + 20);
    fbox(48, y, 145, d.birthNumber || d.birthDate || '', 24);
    text('- u občanů jiného státu než ČR', 205, y + 9, { size: 8.5 });
    text('je povinné uvést datum narození', 208, y + 20, { size: 8.5 });
    text('Titul*', 385, y + 15);
    fbox(425, y, 90, d.title || '', 24);
    y += 36;

    // Adresa: ulice + čp/čo
    text('Adresa trvalého', 0, y + 8); text('Pobytu v ČR:', 0, y + 20);
    text('Ulice', 82, y + 15);
    fbox(112, y, 155, d.street, 24);
    text('číslo popisné/', 278, y + 8, { size: 8.5 }); text('číslo orientační', 278, y + 20, { size: 8.5 });
    const [cp, co] = String(d.houseNumber || '').split('/').map(s => s.trim());
    fbox(352, y, 55, cp || '', 24);
    text('/', 413, y + 17, { size: 13 });
    fbox(422, y, 55, co || '', 24);
    y += 36;

    // Město / Část obce / PSČ
    text('Město', 0, y + 15);
    fbox(48, y, 135, d.city, 24);
    text('Část obce', 195, y + 15);
    fbox(248, y, 145, d.cityPart || '', 24);
    text('PSČ', 405, y + 15);
    fbox(432, y, 83, d.zip, 24);
    y += 36;

    // Stát narození / občanství
    text('Stát', 0, y + 8); text('narození*', 0, y + 20);
    fbox(48, y, 145, d.birthCountry || '', 24);
    text('Státní občanství*', 205, y + 8);
    text('(povinné jen není-li ČR)', 205, y + 20, { size: 8.5 });
    fbox(315, y, 200, d.citizenship || '', 24);
    y += 36;

    // Telefon / E-mail
    text('Telefon*', 0, y + 15);
    fbox(48, y, 145, d.phone || '', 24);
    text('E-mail*', 205, y + 15);
    fbox(243, y, 272, d.email || '', 24);
    y += 38;

    // Registrace pro aktuální rok
    text('Registrovat pro aktuální rok?', 0, y + 8);
    text(`Registrace je spojena s povinností úhrady členských příspěvků dle ES. Pokud ano, zakřížkujte: ${d.registerThisYear ? '☒' : '☐'}`, 0, y + 22);
    y += 34;

    // Prohlášení + datum
    text('Žadatel o členství prohlašuje, že se seznámil se Stanovami ŠSČR,', 0, y + 8);
    text('Včetně ustanovení o nakládání s osobními údaji, a souhlasí s nimi.', 0, y + 21);
    text('Datum', 330, y + 15);
    fbox(370, y + 2, 100, d.date, 24);
    y += 40;

    // Razítko a podpis oddílu + podpis hráče
    text('Razítko', 0, y + 12); text('a podpis', 0, y + 24); text('oddílu', 0, y + 36);
    rrect(48, y, 215, 78, 10);
    const stamp = await pdf.embedPng(fs.readFileSync(path.join(ASSETS, 'razitko-oficialni.png')));
    const stW = 165;
    const stH = stW * (stamp.height / stamp.width);
    page.drawImage(stamp, { x: M + 48 + (215 - stW) / 2, y: Y(y + 8 + stH), width: stW, height: stH });
    text('Antonín Duda v. r.', 48 + 72, y + 90, { size: 8 });

    // podpis hráče (obrázek nad čarou)
    if (d.signaturePng) {
        try {
            const sig = await pdf.embedPng(Buffer.from(d.signaturePng.replace(/^data:image\/png;base64,/, ''), 'base64'));
            const sigW = 140;
            const sigH = Math.min(sigW * (sig.height / sig.width), 55);
            page.drawImage(sig, { x: M + 335, y: Y(y + 62), width: sigW, height: sigH });
        } catch (e) { /* podpis nevložen */ }
    }
    page.drawLine({ start: { x: M + 300, y: Y(y + 64) }, end: { x: M + W, y: Y(y + 64) }, thickness: 0.9, color: BLACK });
    text('Podpis hráče (u ml. 18 let zák. zástupce)', 318, y + 76, { size: 9 });

    return Buffer.from(await pdf.save());
}
