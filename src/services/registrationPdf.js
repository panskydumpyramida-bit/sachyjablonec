/**
 * Generátor PDF „Žádost o členství v ŠSČR" z online formuláře.
 * Layout replikuje oficiální žádost (Registrace-clenu-2025.docx):
 * oddíl + kód, osobní údaje, adresa, kontakty, registrace pro aktuální rok,
 * prohlášení, datum, razítko a podpis oddílu, podpis hráče.
 */

import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.join(__dirname, '../assets');

const CLUB_NAME = 'TJ Bižuterie Jablonec nad Nisou';
const CLUB_CODE = process.env.SSCR_CLUB_CODE || '17 052'; // kód oddílu ŠSČR

const GRAY = rgb(0.45, 0.45, 0.45);
const BLACK = rgb(0.05, 0.05, 0.05);
const BLUE = rgb(0.1, 0.1, 0.4);

export async function generateRegistrationPdf(d) {
    const pdf = await PDFDocument.create();
    pdf.registerFontkit(fontkit);
    const font = await pdf.embedFont(fs.readFileSync(path.join(ASSETS, 'fonts/DejaVuSans.ttf')), { subset: true });
    const bold = await pdf.embedFont(fs.readFileSync(path.join(ASSETS, 'fonts/DejaVuSans-Bold.ttf')), { subset: true });

    const page = pdf.addPage([595.28, 841.89]); // A4
    const { width } = page.getSize();
    const M = 50; // okraj
    let y = 790;

    const text = (str, x, yy, opts = {}) => page.drawText(String(str ?? ''), {
        x, y: yy, size: opts.size || 10, font: opts.bold ? bold : font, color: opts.color || BLACK,
    });
    const label = (str, x, yy) => text(str, x, yy, { size: 7.5, color: GRAY });
    const line = (x1, yy, x2) => page.drawLine({ start: { x: x1, y: yy }, end: { x: x2, y: yy }, thickness: 0.7, color: GRAY });

    // Hlavička ŠSČR
    text('Šachový svaz České republiky', M, y, { size: 9, color: GRAY });
    text('Kontaktní osoba: Trang Křivánek Nguyenová · registrace@chess.cz · 776 005 069', M, y - 12, { size: 8, color: GRAY });
    y -= 46;

    text('ŽÁDOST O ČLENSTVÍ V ŠSČR', M, y, { size: 18, bold: true, color: BLUE });
    y -= 34;

    // Oddíl
    label('Šachový oddíl', M, y + 11);
    text(CLUB_NAME, M, y, { size: 11, bold: true });
    line(M, y - 3, M + 330);
    label('Kód oddílu', M + 360, y + 11);
    text(CLUB_CODE || '', M + 360, y, { size: 11, bold: true });
    line(M + 360, y - 3, width - M);
    y -= 40;

    // Jméno
    const third = (width - 2 * M - 30) / 3;
    const cols3 = [M, M + third + 15, M + 2 * (third + 15)];
    label('Příjmení', cols3[0], y + 11); text(d.lastName, cols3[0], y, { size: 11 }); line(cols3[0], y - 3, cols3[0] + third);
    label('Jméno', cols3[1], y + 11); text(d.firstName, cols3[1], y, { size: 11 }); line(cols3[1], y - 3, cols3[1] + third);
    label('Další jméno*', cols3[2], y + 11); text(d.middleName || '', cols3[2], y, { size: 11 }); line(cols3[2], y - 3, cols3[2] + third);
    y -= 40;

    // RČ / datum narození / titul
    label('Rodné číslo (u cizinců datum narození)', cols3[0], y + 11);
    text(d.birthNumber || d.birthDate || '', cols3[0], y, { size: 11 }); line(cols3[0], y - 3, cols3[0] + third);
    label('Datum narození', cols3[1], y + 11); text(d.birthDate || '', cols3[1], y, { size: 11 }); line(cols3[1], y - 3, cols3[1] + third);
    label('Titul*', cols3[2], y + 11); text(d.title || '', cols3[2], y, { size: 11 }); line(cols3[2], y - 3, cols3[2] + third);
    y -= 40;

    // Adresa
    label('Adresa trvalého pobytu v ČR — ulice', cols3[0], y + 11);
    text(d.street, cols3[0], y, { size: 11 }); line(cols3[0], y - 3, cols3[1] + third);
    label('Č. popisné/orientační', cols3[2], y + 11); text(d.houseNumber, cols3[2], y, { size: 11 }); line(cols3[2], y - 3, cols3[2] + third);
    y -= 40;

    label('Město', cols3[0], y + 11); text(d.city, cols3[0], y, { size: 11 }); line(cols3[0], y - 3, cols3[0] + third);
    label('Část obce', cols3[1], y + 11); text(d.cityPart || '', cols3[1], y, { size: 11 }); line(cols3[1], y - 3, cols3[1] + third);
    label('PSČ', cols3[2], y + 11); text(d.zip, cols3[2], y, { size: 11 }); line(cols3[2], y - 3, cols3[2] + third);
    y -= 40;

    label('Stát narození* (povinné, není-li ČR)', cols3[0], y + 11);
    text(d.birthCountry || '', cols3[0], y, { size: 11 }); line(cols3[0], y - 3, cols3[0] + third);
    label('Státní občanství*', cols3[1], y + 11); text(d.citizenship || '', cols3[1], y, { size: 11 }); line(cols3[1], y - 3, cols3[1] + third);
    y -= 40;

    label('Telefon*', cols3[0], y + 11); text(d.phone || '', cols3[0], y, { size: 11 }); line(cols3[0], y - 3, cols3[0] + third);
    label('E-mail*', cols3[1], y + 11); text(d.email || '', cols3[1], y, { size: 11 }); line(cols3[1], y - 3, cols3[2] + third);
    y -= 44;

    // Registrace pro aktuální rok
    const box = d.registerThisYear ? '☒' : '☐';
    text(`${box}  Registrovat pro aktuální rok`, M, y, { size: 11, bold: true });
    text('Registrace je spojena s povinností úhrady členských příspěvků dle ES ŠSČR.', M + 16, y - 13, { size: 8, color: GRAY });
    y -= 44;

    // Prohlášení (word-wrap na šířku stránky)
    const decl = 'Žadatel o členství prohlašuje, že se seznámil se Stanovami ŠSČR, včetně ustanovení o nakládání s osobními údaji, a souhlasí s nimi.';
    const maxW = width - 2 * M;
    let lineBuf = '';
    let yy = y;
    for (const word of decl.split(' ')) {
        const cand = lineBuf ? `${lineBuf} ${word}` : word;
        if (font.widthOfTextAtSize(cand, 9) > maxW) {
            text(lineBuf, M, yy, { size: 9 });
            yy -= 12;
            lineBuf = word;
        } else {
            lineBuf = cand;
        }
    }
    if (lineBuf) text(lineBuf, M, yy, { size: 9 });
    y = yy - 28;

    label('Datum', M, y + 11);
    text(d.date, M, y, { size: 11 });
    line(M, y - 3, M + 120);

    // Razítko a podpis oddílu (oficiální hranaté razítko s IČO)
    const stampBytes = fs.readFileSync(path.join(ASSETS, 'razitko-oficialni.png'));
    const stamp = await pdf.embedPng(stampBytes);
    const stampW = 170;
    const stampH = stampW * (stamp.height / stamp.width);
    page.drawImage(stamp, { x: M + 170, y: y - 55, width: stampW, height: stampH });
    text('Antonín Duda v. r., předseda oddílu', M + 175, y - 70, { size: 8.5 });
    label('Razítko a podpis oddílu', M + 190, y - 84);

    // Podpis hráče (canvas PNG z formuláře)
    if (d.signaturePng) {
        try {
            const sigBytes = Buffer.from(d.signaturePng.replace(/^data:image\/png;base64,/, ''), 'base64');
            const sig = await pdf.embedPng(sigBytes);
            const sigW = 160;
            const sigH = sigW * (sig.height / sig.width);
            page.drawImage(sig, { x: width - M - sigW - 10, y: y - 75, width: sigW, height: Math.min(sigH, 80) });
        } catch (e) { /* podpis se nepodařilo vložit — pole zůstane prázdné */ }
    }
    line(width - M - 190, y - 80, width - M);
    label('Podpis hráče (u mladších 18 let zákonný zástupce)', width - M - 190, y - 92);

    // Patička
    text('* Pole označená hvězdičkou jsou nepovinná. Vygenerováno online formulářem sachyjablonec.cz', M, 40, { size: 7, color: GRAY });

    return Buffer.from(await pdf.save());
}
