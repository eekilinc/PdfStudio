import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export function toWinAnsi(str: string): string {
  if (!str) return '';
  return str
    .replace(/ğ/g, 'g').replace(/Ğ/g, 'G')
    .replace(/ü/g, 'u').replace(/Ü/g, 'U')
    .replace(/ş/g, 's').replace(/Ş/g, 'S')
    .replace(/ı/g, 'i').replace(/İ/g, 'I')
    .replace(/ö/g, 'o').replace(/Ö/g, 'O')
    .replace(/ç/g, 'c').replace(/Ç/g, 'C')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '');
}

export async function createSamplePdf(): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  
  const fontHelvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontHelveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontCourier = await pdfDoc.embedFont(StandardFonts.Courier);

  // Page 1: Welcome & Executive Summary
  const page1 = pdfDoc.addPage([595.28, 841.89]); // A4 dimensions
  const { width: p1Width, height: p1Height } = page1.getSize();

  // Top banner accent
  page1.drawRectangle({
    x: 0,
    y: p1Height - 8,
    width: p1Width,
    height: 8,
    color: rgb(0.25, 0.45, 0.95),
  });

  // Header
  page1.drawText(toWinAnsi('PDF Studio Pro - Hos Geldiniz'), {
    x: 40,
    y: p1Height - 60,
    size: 24,
    font: fontHelveticaBold,
    color: rgb(0.1, 0.15, 0.25),
  });

  page1.drawText(toWinAnsi('Modern, Hizli ve Guclu Masaustu PDF Duzenleme Deneyimi'), {
    x: 40,
    y: p1Height - 85,
    size: 12,
    font: fontHelvetica,
    color: rgb(0.4, 0.45, 0.55),
  });

  // Feature cards mockup
  const cardY = p1Height - 240;
  page1.drawRectangle({
    x: 40,
    y: cardY,
    width: p1Width - 80,
    height: 125,
    color: rgb(0.96, 0.97, 0.99),
    borderColor: rgb(0.85, 0.88, 0.94),
    borderWidth: 1,
  });

  page1.drawText(toWinAnsi('One Cikan Duzenleme Yetenekleri'), {
    x: 60,
    y: cardY + 95,
    size: 14,
    font: fontHelveticaBold,
    color: rgb(0.15, 0.25, 0.6),
  });

  const features = [
    '- Sayfa Yonetimi: Sayfa siralama (surukle-birak), 90 derece dondurme, silme ve cogaltma',
    '- Zengin Aciklama Araclari: Serbest kalem, fosforlu vurgulayici, metin kutulari',
    '- Vektorel Sekiller: Dikdortgen, daire, cizgi ve ok cizimleri (renk ve kalinlik ayarli)',
    '- Imza & Damga: Cizerek veya gorsel yukleyerek imzalama, hazir/ozel damgalar',
    '- Karartma (Redaction): Hassas alanlari ve metinleri guvenle gizleme',
  ];

  features.forEach((feat, index) => {
    page1.drawText(toWinAnsi(feat), {
      x: 60,
      y: cardY + 70 - index * 16,
      size: 10,
      font: fontHelvetica,
      color: rgb(0.2, 0.25, 0.35),
    });
  });

  // Contract Sample Section
  page1.drawText(toWinAnsi('Sozlesme & Onay Ornegi'), {
    x: 40,
    y: p1Height - 280,
    size: 16,
    font: fontHelveticaBold,
    color: rgb(0.1, 0.15, 0.25),
  });

  const bodyText = [
    'Isbu belge, PDF Studio Pro uygulamasinin duzenleme, imzalama ve aciklama yeteneklerini test etmek amaciyla',
    'hazirlanmistir. Ust arac cubugundaki araclari kullanarak bu sayfa uzerine metin ekleyebilir, onemli yerleri',
    'fosforlu kalemle vurgulayabilir veya asagidaki imza alanina dijital imzanizi yerlestirebilirsiniz.',
  ];

  bodyText.forEach((line, index) => {
    page1.drawText(toWinAnsi(line), {
      x: 40,
      y: p1Height - 310 - index * 18,
      size: 11,
      font: fontHelvetica,
      color: rgb(0.3, 0.35, 0.4),
    });
  });

  // Signature box
  const sigY = p1Height - 480;
  page1.drawRectangle({
    x: 40,
    y: sigY,
    width: 230,
    height: 90,
    borderColor: rgb(0.7, 0.75, 0.85),
    borderWidth: 1,
    color: rgb(0.98, 0.99, 1.0),
  });

  page1.drawText(toWinAnsi('Yetkili Imza Alani (Imza Aracini Deneyiniz)'), {
    x: 50,
    y: sigY + 70,
    size: 9,
    font: fontHelveticaBold,
    color: rgb(0.4, 0.45, 0.55),
  });

  page1.drawLine({
    start: { x: 50, y: sigY + 25 },
    end: { x: 250, y: sigY + 25 },
    thickness: 1,
    color: rgb(0.8, 0.8, 0.8),
  });

  page1.drawText(toWinAnsi('Tarih / Imza'), {
    x: 50,
    y: sigY + 12,
    size: 8,
    font: fontHelvetica,
    color: rgb(0.6, 0.6, 0.6),
  });

  // Stamp Box
  page1.drawRectangle({
    x: 320,
    y: sigY,
    width: 230,
    height: 90,
    borderColor: rgb(0.7, 0.75, 0.85),
    borderWidth: 1,
    color: rgb(0.98, 0.99, 1.0),
  });

  page1.drawText(toWinAnsi('Damga / Kase Alani (Damga Aracini Deneyiniz)'), {
    x: 330,
    y: sigY + 70,
    size: 9,
    font: fontHelveticaBold,
    color: rgb(0.4, 0.45, 0.55),
  });

  page1.drawText(toWinAnsi('Hazir ONAYLANDI veya GIZLI damgasi ekleyin'), {
    x: 330,
    y: sigY + 40,
    size: 9,
    font: fontHelvetica,
    color: rgb(0.5, 0.55, 0.65),
  });

  // Footer
  page1.drawText(toWinAnsi('PDF Studio Pro - Sayfa 1 / 2'), {
    x: 40,
    y: 30,
    size: 9,
    font: fontHelvetica,
    color: rgb(0.6, 0.65, 0.7),
  });

  // Page 2: Project Specifications & Data Table
  const page2 = pdfDoc.addPage([595.28, 841.89]);
  const { width: p2Width, height: p2Height } = page2.getSize();

  page2.drawRectangle({
    x: 0,
    y: p2Height - 8,
    width: p2Width,
    height: 8,
    color: rgb(0.15, 0.75, 0.5),
  });

  page2.drawText(toWinAnsi('Teknik Ozellikler ve Modul Mimarisi'), {
    x: 40,
    y: p2Height - 60,
    size: 20,
    font: fontHelveticaBold,
    color: rgb(0.1, 0.15, 0.25),
  });

  page2.drawText(toWinAnsi('Performans, Guvenlik ve Uyumluluk Standartlari'), {
    x: 40,
    y: p2Height - 85,
    size: 11,
    font: fontHelvetica,
    color: rgb(0.4, 0.45, 0.55),
  });

  // Table header
  const tableTop = p2Height - 140;
  const col1 = 40;
  const col2 = 180;
  const col3 = 340;
  const col4 = 460;

  page2.drawRectangle({
    x: 40,
    y: tableTop - 25,
    width: p2Width - 80,
    height: 25,
    color: rgb(0.2, 0.25, 0.35),
  });

  page2.drawText('Modul', { x: col1 + 10, y: tableTop - 18, size: 10, font: fontHelveticaBold, color: rgb(1, 1, 1) });
  page2.drawText('Teknoloji', { x: col2 + 10, y: tableTop - 18, size: 10, font: fontHelveticaBold, color: rgb(1, 1, 1) });
  page2.drawText('Islev', { x: col3 + 10, y: tableTop - 18, size: 10, font: fontHelveticaBold, color: rgb(1, 1, 1) });
  page2.drawText('Durum', { x: col4 + 10, y: tableTop - 18, size: 10, font: fontHelveticaBold, color: rgb(1, 1, 1) });

  const tableRows = [
    { m: 'PDF Rendering', t: 'PDF.js (Mozilla)', f: 'Yuksek cozunurluklu sayfa isleme', s: 'Aktif' },
    { m: 'Vektor Katmani', t: 'Custom Canvas Engine', f: 'Cizim, sekil ve metin duzenleme', s: 'Aktif' },
    { m: 'PDF Disa Aktarma', t: 'pdf-lib Engine', f: 'Katmanlari gomme & sayfa islemleri', s: 'Aktif' },
    { m: 'Masaustu Catisi', t: 'Tauri v2 + Rust', f: 'Ultra hafif bellek & yerel dosya hizi', s: 'Aktif' },
    { m: 'Guvenlik & Karartma', t: 'Redaction Engine', f: 'Hassas veriyi sayfayi gorsellestirerek yok eder', s: 'Aktif' },
  ];

  tableRows.forEach((row, i) => {
    const rowY = tableTop - 55 - i * 28;
    page2.drawRectangle({
      x: 40,
      y: rowY,
      width: p2Width - 80,
      height: 28,
      color: i % 2 === 0 ? rgb(0.97, 0.98, 1) : rgb(1, 1, 1),
      borderColor: rgb(0.9, 0.92, 0.95),
      borderWidth: 1,
    });

    page2.drawText(toWinAnsi(row.m), { x: col1 + 10, y: rowY + 9, size: 9, font: fontHelveticaBold, color: rgb(0.2, 0.25, 0.35) });
    page2.drawText(toWinAnsi(row.t), { x: col2 + 10, y: rowY + 9, size: 9, font: fontCourier, color: rgb(0.3, 0.35, 0.45) });
    page2.drawText(toWinAnsi(row.f), { x: col3 + 10, y: rowY + 9, size: 9, font: fontHelvetica, color: rgb(0.3, 0.35, 0.45) });
    page2.drawText(toWinAnsi(row.s), { x: col4 + 10, y: rowY + 9, size: 9, font: fontHelveticaBold, color: rgb(0.1, 0.6, 0.3) });
  });

  page2.drawText(toWinAnsi('PDF Studio Pro - Sayfa 2 / 2'), {
    x: 40,
    y: 30,
    size: 9,
    font: fontHelvetica,
    color: rgb(0.6, 0.65, 0.7),
  });

  return await pdfDoc.save();
}
