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
        x: M + x, y: Y(yTop), size: opts.size || 8.9,
        font: opts.bold ? bold : font, color: opts.color || BLACK,
    });
    const textRight = (str, xRight, yTop, opts = {}) => {
        const f = opts.bold ? bold : font;
        const w = f.widthOfTextAtSize(String(str), opts.size || 8.9);
        text(str, xRight - w, yTop, opts);
    };

    // zaoblený rámeček (jako v DOCX) — SVG path, y roste dolů od kotvy
    const rrect = (x, yTop, w, h, r = 5) => {
        const p = `M ${r} 0 L ${w - r} 0 Q ${w} 0 ${w} ${r} L ${w} ${h - r} Q ${w} ${h} ${w - r} ${h} L ${r} ${h} Q 0 ${h} 0 ${h - r} L 0 ${r} Q 0 0 ${r} 0 Z`;
        page.drawSvgPath(p, { x: M + x, y: Y(yTop), borderColor: BOX, borderWidth: 0.85 });
    };
    // rámeček s vepsanou hodnotou
    const fbox = (x, yTop, w, val, h = 19) => {
        rrect(x, yTop, w, h);
        if (val) {
            let v = String(val);
            while (font.widthOfTextAtSize(v, 9) > w - 10 && v.length > 1) v = v.slice(0, -1);
            text(v, x + 6, yTop + h - 6, { size: 9 });
        }
    };

    // ---------- hlavička ----------
    const logo = await pdf.embedPng(fs.readFileSync(path.join(ASSETS, 'logo-sscr.png')));
    const logoW = 135;
    page.drawImage(logo, { x: M + 10, y: Y(52), width: logoW, height: logoW * (logo.height / logo.width) });

    textRight('Kontaktní osoba: Trang Křivánek Nguyenová', W, 4);
    {
        const linkColor = rgb(0.16, 0.42, 0.68);
        textRight('Email: registrace@chess.cz', W, 15, { color: linkColor });
        const lw = font.widthOfTextAtSize('registrace@chess.cz', 8.9);
        page.drawLine({ start: { x: M + W - lw, y: Y(16.5) }, end: { x: M + W, y: Y(16.5) }, thickness: 0.6, color: linkColor });
    }
    textRight('Tel.:776 005 069', W, 26);
    textRight('ŽÁDOST O ČLENSTVÍ V ŠSČR', W, 50, { size: 14.5, bold: true });

    // ---------- pole ----------
    let y = 62;

    // Oddíl + kód
    text('šachový', 0, y + 7); text('Oddíl', 0, y + 17);
    fbox(48, y, 322, CLUB_NAME, 21);
    text('Kód', 385, y + 7); text('oddílu', 385, y + 17);
    fbox(425, y, 90, CLUB_CODE, 21);
    y += 30;

    // Příjmení / Jméno / Další jméno
    text('Příjmení', 0, y + 13);
    fbox(48, y, 145, d.lastName);
    text('Jméno', 205, y + 13);
    fbox(243, y, 130, d.firstName);
    text('Další', 385, y + 7); text('jméno*', 385, y + 17);
    fbox(425, y, 90, d.middleName || '');
    y += 29;

    // Rodné číslo / pozn. / Titul
    text('Rodné', 0, y + 7); text('Číslo', 0, y + 17);
    fbox(48, y, 145, d.birthNumber || d.birthDate || '');
    text('- u občanů jiného státu než ČR', 205, y + 8, { size: 7.3 });
    text('je povinné uvést datum narození', 208, y + 17, { size: 7.3 });
    text('Titul*', 385, y + 13);
    fbox(425, y, 90, d.title || '');
    y += 29;

    // Adresa: ulice + čp/čo
    text('Adresa trvalého', 0, y + 7); text('Pobytu v ČR:', 0, y + 17);
    text('Ulice', 82, y + 13);
    fbox(112, y, 155, d.street);
    text('číslo popisné/', 278, y + 7, { size: 7.3 }); text('číslo orientační', 278, y + 17, { size: 7.3 });
    const [cp, co] = String(d.houseNumber || '').split('/').map(s => s.trim());
    fbox(352, y, 55, cp || '');
    text('/', 413, y + 15, { size: 11 });
    fbox(422, y, 55, co || '');
    y += 29;

    // Město / Část obce / PSČ
    text('Město', 0, y + 13);
    fbox(48, y, 135, d.city);
    text('Část obce', 195, y + 13);
    fbox(248, y, 145, d.cityPart || '');
    text('PSČ', 405, y + 13);
    fbox(432, y, 83, d.zip);
    y += 29;

    // Stát narození / občanství
    text('Stát', 0, y + 7); text('narození*', 0, y + 17);
    fbox(48, y, 145, d.birthCountry || '');
    text('Státní občanství*', 205, y + 7);
    text('(povinné jen není-li ČR)', 205, y + 17, { size: 7.3 });
    fbox(315, y, 200, d.citizenship || '');
    y += 29;

    // Telefon / E-mail
    text('Telefon*', 0, y + 13);
    fbox(48, y, 145, d.phone || '');
    text('E-mail*', 205, y + 13);
    fbox(243, y, 272, d.email || '');
    y += 27;

    // Registrace pro aktuální rok
    text('Registrovat pro aktuální rok?', 0, y + 6);
    text(`Registrace je spojena s povinností úhrady členských příspěvků dle ES. Pokud ano, zakřížkujte: ${d.registerThisYear ? '☒' : '☐'}`, 0, y + 16);
    y += 24;

    // Prohlášení + datum
    text('Žadatel o členství prohlašuje, že se seznámil se Stanovami ŠSČR,', 0, y + 6);
    text('Včetně ustanovení o nakládání s osobními údaji, a souhlasí s nimi.', 0, y + 16);
    text('Datum', 330, y + 11);
    fbox(370, y, 100, d.date);
    y += 28;

    // Razítko a podpis oddílu + podpis hráče
    text('Razítko', 0, y + 10); text('a podpis', 0, y + 20); text('oddílu', 0, y + 30);
    rrect(48, y, 200, 66, 10);
    const stamp = await pdf.embedPng(fs.readFileSync(path.join(ASSETS, 'razitko-oficialni.png')));
    const stW = 180; // 60×20 mm razítko přes celý rámeček
    const stH = stW * (stamp.height / stamp.width);
    page.drawImage(stamp, { x: M + 48 + (200 - stW) / 2, y: Y(y + 3 + stH), width: stW, height: stH });
    // podpisový klikyhák (stylizované „D") přes střed razítka, modrý inkoust
    const INK = rgb(0.13, 0.19, 0.52);
    const squiggle = 'M 6 30 C 10 12, 16 2, 22 6 C 30 11, 30 30, 20 34 C 12 37, 8 30, 14 26 C 26 18, 44 22, 56 20 C 66 18, 72 21, 80 16';
    page.drawSvgPath(squiggle, {
        x: M + 48 + 100 - 28, y: Y(y + 12), scale: 1.1,
        borderColor: INK, borderWidth: 1.7, rotate: { type: 'degrees', angle: -6 },
    });

    // podpis hráče (obrázek nad čarou)
    if (d.signaturePng) {
        try {
            const sig = await pdf.embedPng(Buffer.from(d.signaturePng.replace(/^data:image\/png;base64,/, ''), 'base64'));
            const sigW = 125;
            const sigH = Math.min(sigW * (sig.height / sig.width), 44);
            page.drawImage(sig, { x: M + 345, y: Y(y + 50), width: sigW, height: sigH });
        } catch (e) { /* podpis nevložen */ }
    }
    page.drawLine({ start: { x: M + 310, y: Y(y + 52) }, end: { x: M + W, y: Y(y + 52) }, thickness: 0.9, color: BLACK });
    text('Podpis hráče (u ml. 18 let zák. zástupce)', 330, y + 62, { size: 7.8 });

    return Buffer.from(await pdf.save());
}
