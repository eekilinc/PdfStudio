import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  PageBreak,
  Packer,
  Header,
  Footer,
  ShadingType
} from 'docx';
import writeXlsxFile from 'write-excel-file/browser';
import JSZip from 'jszip';

export interface ExcelCell {
  value: string | number | boolean | Date | null | undefined;
  type?: StringConstructor | NumberConstructor | BooleanConstructor;
  fontWeight?: 'bold';
  backgroundColor?: string;
  color?: string;
  align?: 'left' | 'center' | 'right';
  borderColor?: string;
  borderStyle?: 'thin';
}

export type ExcelRow = ExcelCell[];
export type ExcelSheetData = ExcelRow[];

export interface ExcelSheet {
  data: ExcelSheetData;
  sheet?: string;
  columns?: Array<{ width?: number }>;
}

// ==========================================
// 1. DATA MODELS & STRUCTURES
// ==========================================

export interface RawTextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontName: string;
  isBold: boolean;
}

export type BlockType = 'heading' | 'paragraph' | 'bullet' | 'table';

export interface HeadingBlock {
  type: 'heading';
  level: 1 | 2 | 3;
  text: string;
}

export interface ParagraphBlock {
  type: 'paragraph';
  text: string;
}

export interface BulletBlock {
  type: 'bullet';
  text: string;
  level: number;
}

export interface TableBlock {
  type: 'table';
  headers?: string[];
  rows: string[][];
}

export type PageBlock = HeadingBlock | ParagraphBlock | BulletBlock | TableBlock;

export interface StructuredPage {
  pageNum: number;
  width: number;
  height: number;
  blocks: PageBlock[];
  tableMatrix: string[][]; // 2D table matrix for entire page for Excel
  plainTextLines: string[];
}

export interface OfficeExportOptions {
  includePageNumbers?: boolean;
  docTitle?: string;
  multiSheetExcel?: boolean;
  smartTables?: boolean;
  csvDelimiter?: ',' | ';';
}

// ==========================================
// 2. SMART EXTRACTION & LAYOUT PARSER
// ==========================================

// Helper: Escape XML characters
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Helper: Escape HTML characters
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function extractStructuredPage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pdfPage: any,
  pageNum: number
): Promise<StructuredPage> {
  const viewport = pdfPage.getViewport({ scale: 1.0 });
  const textContent = await pdfPage.getTextContent();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = textContent.items as Array<any>;

  if (!items || items.length === 0) {
    return {
      pageNum,
      width: viewport.width,
      height: viewport.height,
      blocks: [],
      tableMatrix: [],
      plainTextLines: [],
    };
  }

  // 1. Normalize items
  const rawItems: RawTextItem[] = [];
  let totalHeight = 0;

  for (const it of items) {
    if (!it.str || it.str.trim().length === 0) continue;
    const x = it.transform[4];
    const y = it.transform[5];
    const height = Math.abs(it.transform[0]) || Math.abs(it.transform[3]) || it.height || 10;
    const width = it.width || 10;
    const fontName = it.fontName || '';
    const isBold = /bold|black|heavy|demi/i.test(fontName);

    rawItems.push({
      str: it.str,
      x,
      y,
      width,
      height,
      fontName,
      isBold,
    });
    totalHeight += height;
  }

  const medianHeight = rawItems.length > 0 ? totalHeight / rawItems.length : 12;

  // 2. Group into lines/rows based on Y-coordinate (top to bottom)
  // PDF Y=0 is bottom, so higher Y is higher on the page.
  rawItems.sort((a, b) => {
    const yDiff = b.y - a.y;
    if (Math.abs(yDiff) > 4) return yDiff;
    return a.x - b.x;
  });

  interface LineGroup {
    y: number;
    items: RawTextItem[];
  }

  const lineGroups: LineGroup[] = [];
  let currentLine: LineGroup | null = null;

  for (const item of rawItems) {
    if (!currentLine) {
      currentLine = { y: item.y, items: [item] };
    } else {
      const diff = Math.abs(currentLine.y - item.y);
      const tolerance = Math.max(4, Math.min(item.height * 0.45, 8));
      if (diff <= tolerance) {
        currentLine.items.push(item);
      } else {
        lineGroups.push(currentLine);
        currentLine = { y: item.y, items: [item] };
      }
    }
  }
  if (currentLine) {
    lineGroups.push(currentLine);
  }

  // 3. Process each line into column cells & plain text
  interface ProcessedLine {
    y: number;
    cells: string[];
    fullText: string;
    isMultiColumn: boolean;
    maxHeight: number;
    isBold: boolean;
  }

  const processedLines: ProcessedLine[] = [];

  for (const group of lineGroups) {
    // Sort items left-to-right
    group.items.sort((a, b) => a.x - b.x);

    const cells: string[] = [];
    let currentCell = '';
    let lastRight = -1;
    let maxHeight = 0;
    let isBold = false;

    for (const it of group.items) {
      if (it.height > maxHeight) maxHeight = it.height;
      if (it.isBold) isBold = true;

      if (lastRight < 0) {
        currentCell = it.str;
        lastRight = it.x + it.width;
      } else {
        const gap = it.x - lastRight;
        // If gap is substantial (> 18pt or > 1.4x font size), it's a new table column
        if (gap > Math.max(18, it.height * 1.4)) {
          if (currentCell.trim().length > 0) {
            cells.push(currentCell.trim());
          }
          currentCell = it.str;
        } else {
          // Small gap or contiguous word
          if (gap > 2) {
            currentCell += ' ' + it.str;
          } else {
            currentCell += it.str;
          }
        }
        lastRight = it.x + it.width;
      }
    }

    if (currentCell.trim().length > 0) {
      cells.push(currentCell.trim());
    }

    const fullText = cells.join(' ');
    processedLines.push({
      y: group.y,
      cells,
      fullText,
      isMultiColumn: cells.length >= 2,
      maxHeight,
      isBold,
    });
  }

  // 4. Construct Blocks (Headings, Tables, Bullets, Paragraphs)
  const blocks: PageBlock[] = [];
  const tableMatrix: string[][] = [];
  const plainTextLines: string[] = [];

  let pendingParagraph: string[] = [];
  let pendingTableRows: string[][] = [];

  const flushParagraph = () => {
    if (pendingParagraph.length > 0) {
      blocks.push({
        type: 'paragraph',
        text: pendingParagraph.join(' '),
      });
      pendingParagraph = [];
    }
  };

  const flushTable = () => {
    if (pendingTableRows.length > 0) {
      const headers = pendingTableRows.length > 1 ? pendingTableRows[0] : undefined;
      const rows = pendingTableRows.length > 1 ? pendingTableRows.slice(1) : pendingTableRows;
      blocks.push({
        type: 'table',
        headers,
        rows,
      });
      pendingTableRows = [];
    }
  };

  for (let i = 0; i < processedLines.length; i++) {
    const pline = processedLines[i];
    plainTextLines.push(pline.fullText);
    tableMatrix.push(pline.cells);

    // Multi-column table detection
    if (pline.isMultiColumn) {
      flushParagraph();
      pendingTableRows.push(pline.cells);
      continue;
    }

    // If we were collecting table rows and now hit a single column, flush table
    if (pendingTableRows.length > 0) {
      flushTable();
    }

    const text = pline.fullText.trim();
    if (!text) continue;

    // Heading Detection
    const isBig = pline.maxHeight >= medianHeight * 1.35;
    const isShort = text.length < 80;
    const isAllCaps = text === text.toUpperCase() && text.length < 60 && /[A-ZÇĞİÖŞÜ]/.test(text);

    if ((isBig || (pline.isBold && isShort) || isAllCaps) && !text.endsWith('.')) {
      flushParagraph();
      let level: 1 | 2 | 3 = 3;
      if (pline.maxHeight >= medianHeight * 1.6 || pline.maxHeight >= 18) {
        level = 1;
      } else if (pline.maxHeight >= medianHeight * 1.3 || pline.maxHeight >= 14) {
        level = 2;
      }
      blocks.push({
        type: 'heading',
        level,
        text,
      });
      continue;
    }

    // Bullet List Detection
    const bulletMatch = text.match(/^([•\-*▪▫–]|\d+[.)]|[a-zA-Z][.)])\s+(.*)/);
    if (bulletMatch) {
      flushParagraph();
      blocks.push({
        type: 'bullet',
        text: bulletMatch[2] || text,
        level: 0,
      });
      continue;
    }

    // Normal paragraph line
    // Check vertical gap to decide if it continues or starts new paragraph
    if (i > 0) {
      const prevLine = processedLines[i - 1];
      const gap = prevLine.y - pline.y;
      if (gap > Math.max(pline.maxHeight * 1.8, 16)) {
        flushParagraph();
      }
    }
    pendingParagraph.push(text);
  }

  flushParagraph();
  flushTable();

  return {
    pageNum,
    width: viewport.width,
    height: viewport.height,
    blocks,
    tableMatrix,
    plainTextLines,
  };
}

// ==========================================
// 3. WORD (.docx) GENERATOR
// ==========================================

export async function generateDocx(
  pages: StructuredPage[],
  options: OfficeExportOptions = {}
): Promise<Uint8Array> {
  const docTitle = options.docTitle || 'Belge';
  const children: (Paragraph | Table)[] = [];

  // Document Title Header
  children.push(
    new Paragraph({
      text: docTitle,
      heading: HeadingLevel.TITLE,
      spacing: { before: 200, after: 300 },
    })
  );

  pages.forEach((page, pageIdx) => {
    // Optional Page Header indicator
    if (options.includePageNumbers && pages.length > 1) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `--- Sayfa ${page.pageNum} ---`,
              color: '64748B',
              size: 18, // 9pt
              italics: true,
            }),
          ],
          spacing: { before: 200, after: 150 },
        })
      );
    }

    for (const block of page.blocks) {
      if (block.type === 'heading') {
        const hLevel =
          block.level === 1
            ? HeadingLevel.HEADING_1
            : block.level === 2
            ? HeadingLevel.HEADING_2
            : HeadingLevel.HEADING_3;

        children.push(
          new Paragraph({
            text: block.text,
            heading: hLevel,
            spacing: { before: 240, after: 120 },
          })
        );
      } else if (block.type === 'bullet') {
        children.push(
          new Paragraph({
            text: block.text,
            bullet: { level: block.level },
            spacing: { before: 40, after: 60 },
          })
        );
      } else if (block.type === 'paragraph') {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: block.text,
                size: 22, // 11pt
              }),
            ],
            spacing: { before: 60, after: 120, line: 276 },
          })
        );
      } else if (block.type === 'table') {
        const tableRows: TableRow[] = [];

        // Header row
        if (block.headers && block.headers.length > 0) {
          const headerCells = block.headers.map(
            h =>
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: h,
                        bold: true,
                        color: '0F172A',
                        size: 20,
                      }),
                    ],
                  }),
                ],
                shading: { fill: 'F1F5F9', type: ShadingType.CLEAR },
                margins: { top: 120, bottom: 120, left: 140, right: 140 },
              })
          );
          tableRows.push(new TableRow({ children: headerCells, tableHeader: true }));
        }

        // Data rows
        block.rows.forEach((row) => {
          const cells = row.map(
            cellText =>
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: cellText,
                        size: 19,
                      }),
                    ],
                  }),
                ],
                margins: { top: 100, bottom: 100, left: 140, right: 140 },
              })
          );
          tableRows.push(new TableRow({ children: cells }));
        });

        if (tableRows.length > 0) {
          children.push(
            new Table({
              rows: tableRows,
              width: { size: 100, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
                bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
                left: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
                right: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
                insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: 'E2E8F0' },
                insideVertical: { style: BorderStyle.SINGLE, size: 2, color: 'E2E8F0' },
              },
            })
          );
          children.push(new Paragraph({ text: '', spacing: { after: 120 } }));
        }
      }
    }

    // Page Break between pages
    if (pageIdx < pages.length - 1) {
      children.push(
        new Paragraph({
          children: [new PageBreak()],
        })
      );
    }
  });

  const doc = new Document({
    title: docTitle,
    creator: 'PDF Studio Pro',
    description: 'PDF Studio Pro tarafından yüksek sadakatle dışa aktarıldı.',
    styles: {
      default: {
        document: {
          run: {
            font: 'Calibri',
            size: 22,
            color: '0F172A',
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440, // 1 inch
              bottom: 1440,
              left: 1440,
              right: 1440,
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                text: `${docTitle} • PDF Studio Pro`,
                alignment: AlignmentType.RIGHT,
                style: 'Header',
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                text: 'PDF Studio Pro ile Dönüştürüldü',
                alignment: AlignmentType.CENTER,
                style: 'Footer',
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  const arrayBuffer = await Packer.toArrayBuffer(doc);
  return new Uint8Array(arrayBuffer);
}

// ==========================================
// 4. EXCEL (.xlsx) GENERATOR
// ==========================================

export async function generateXlsx(
  pages: StructuredPage[],
  options: OfficeExportOptions = {}
): Promise<Uint8Array> {
  const multiSheet = options.multiSheetExcel ?? false;

  // Helper to convert table rows into typed write-excel-file Cell rows
  const formatRowsToExcelCells = (rows: string[][]): ExcelSheetData => {
    return rows.map((r, rowIdx) => {
      const isHeader = rowIdx === 0;
      return r.map((val) => {
        const trimmed = val.trim();
        // Check if pure numeric value
        const cleanNum = trimmed.replace(/\s/g, '').replace(',', '.');
        const numVal = Number(cleanNum);
        const isNumeric = !isNaN(numVal) && trimmed.length > 0 && !/^0\d+/.test(trimmed);

        const cell: ExcelCell = {
          value: isNumeric ? numVal : trimmed,
          type: isNumeric ? Number : String,
          fontWeight: isHeader ? 'bold' : undefined,
          backgroundColor: isHeader ? '#1E3A8A' : rowIdx % 2 === 1 ? '#F8FAFC' : '#FFFFFF',
          color: isHeader ? '#FFFFFF' : '#0F172A',
          align: isNumeric ? 'right' : 'left',
          borderColor: '#CBD5E1',
          borderStyle: 'thin',
        };
        return cell;
      });
    });
  };

  // Helper to compute max column widths
  const computeColumnWidths = (data: ExcelSheetData) => {
    const colMaxLens: number[] = [];
    for (const row of data) {
      row.forEach((cell: ExcelCell, colIdx: number) => {
        const len = String(cell.value || '').length;
        if (!colMaxLens[colIdx] || len > colMaxLens[colIdx]) {
          colMaxLens[colIdx] = len;
        }
      });
    }
    return colMaxLens.map(len => ({ width: Math.max(12, Math.min(len + 4, 45)) }));
  };

  if (multiSheet && pages.length > 1) {
    // Multi-sheet mode: One sheet per page
    const sheets: ExcelSheet[] = [];

    pages.forEach((p) => {
      const matrix = p.tableMatrix.length > 0 ? p.tableMatrix : p.plainTextLines.map(l => [l]);
      const data = formatRowsToExcelCells(matrix);
      sheets.push({
        data,
        sheet: `Sayfa ${p.pageNum}`,
        columns: computeColumnWidths(data),
      });
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (writeXlsxFile as any)(sheets);
    const blob = await result.toBlob();
    const ab = await blob.arrayBuffer();
    return new Uint8Array(ab);
  } else {
    // Single sheet mode: Combine all pages into one sheet
    const combinedMatrix: string[][] = [];

    pages.forEach((p, idx) => {
      if (options.includePageNumbers && pages.length > 1) {
        combinedMatrix.push([`=== SAYFA ${p.pageNum} ===`]);
      }
      const matrix = p.tableMatrix.length > 0 ? p.tableMatrix : p.plainTextLines.map(l => [l]);
      matrix.forEach(row => combinedMatrix.push(row));
      if (idx < pages.length - 1) {
        combinedMatrix.push([]); // blank separator
      }
    });

    const data = formatRowsToExcelCells(combinedMatrix);
    const columns = computeColumnWidths(data);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (writeXlsxFile as any)(data, {
      sheet: options.docTitle ? options.docTitle.slice(0, 30) : 'Veriler',
      columns,
    });
    const blob = await result.toBlob();
    const ab = await blob.arrayBuffer();
    return new Uint8Array(ab);
  }
}

// ==========================================
// 5. POWERPOINT (.pptx) GENERATOR
// ==========================================

export async function generatePptx(
  pages: StructuredPage[],
  options: OfficeExportOptions = {}
): Promise<Uint8Array> {
  const zip = new JSZip();
  const docTitle = options.docTitle || 'PDF Studio Pro Sunumu';

  // 1. [Content_Types].xml
  let contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
`;

  pages.forEach((_, i) => {
    contentTypesXml += `  <Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>\n`;
  });
  contentTypesXml += `</Types>`;
  zip.file('[Content_Types].xml', contentTypesXml);

  // 2. _rels/.rels
  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`
  );

  // 3. ppt/presentation.xml
  let sldIdLstXml = '';
  let presRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
`;

  pages.forEach((_, i) => {
    const rId = `rId${i + 2}`;
    sldIdLstXml += `    <p:sldId id="${256 + i}" r:id="${rId}"/>\n`;
    presRelsXml += `  <Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>\n`;
  });
  presRelsXml += `</Relationships>`;

  zip.file(
    'ppt/presentation.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldMasterIdLst>
    <p:sldMasterId id="2147483648" r:id="rId1"/>
  </p:sldMasterIdLst>
  <p:sldIdLst>
${sldIdLstXml}  </p:sldIdLst>
  <p:sldSz cx="12192000" cy="6858000" type="screen16x9"/>
  <p:notesSz cx="6858000" cy="9144000"/>
</p:presentation>`
  );

  zip.file('ppt/_rels/presentation.xml.rels', presRelsXml);

  // 4. Slide Master & Layout
  zip.file(
    'ppt/slideMasters/slideMaster1.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
    </p:spTree>
  </p:cSld>
  <p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
  <p:sldLayoutIdLst>
    <p:sldLayoutId id="2147483649" r:id="rId1"/>
  </p:sldLayoutIdLst>
</p:sldMaster>`
  );

  zip.file(
    'ppt/slideMasters/_rels/slideMaster1.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`
  );

  zip.file(
    'ppt/slideLayouts/slideLayout1.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sldLayout>`
  );

  zip.file(
    'ppt/slideLayouts/_rels/slideLayout1.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>`
  );

  // 5. Individual Slides
  pages.forEach((p, idx) => {
    const slideNum = idx + 1;

    // Detect slide title: First heading or first plain line
    let titleText = `Slayt ${p.pageNum}`;
    const firstHeading = p.blocks.find(b => b.type === 'heading');
    if (firstHeading && firstHeading.type === 'heading') {
      titleText = firstHeading.text;
    } else if (p.plainTextLines.length > 0) {
      titleText = p.plainTextLines[0];
    }

    // Body items: Bullet points and text blocks
    const bodyItems: string[] = [];
    p.blocks.forEach((b) => {
      if (b.type === 'bullet') {
        bodyItems.push(b.text);
      } else if (b.type === 'paragraph' && b.text !== titleText) {
        bodyItems.push(b.text);
      } else if (b.type === 'table') {
        b.rows.forEach(r => bodyItems.push(r.join('  |  ')));
      }
    });

    if (bodyItems.length === 0) {
      p.plainTextLines.slice(1, 10).forEach(l => bodyItems.push(l));
    }

    let bodyParasXml = '';
    bodyItems.slice(0, 8).forEach((itemText) => {
      bodyParasXml += `
          <a:p>
            <a:pPr lvl="0"/>
            <a:r>
              <a:rPr lang="tr-TR" sz="1600">
                <a:solidFill><a:srgbClr val="1E293B"/></a:solidFill>
              </a:rPr>
              <a:t>• ${escapeXml(itemText)}</a:t>
            </a:r>
          </a:p>`;
    });

    if (!bodyParasXml) {
      bodyParasXml = `
          <a:p>
            <a:r><a:rPr lang="tr-TR" sz="1600"/><a:t>• (Bu sayfada metin içeriği bulunamadı)</a:t></a:r>
          </a:p>`;
    }

    const slideXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
      
      <!-- Top Decorative Accent Bar -->
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="Accent"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="800000" y="500000"/><a:ext cx="10592000" cy="60000"/></a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
          <a:solidFill><a:srgbClr val="2563EB"/></a:solidFill>
        </p:spPr>
      </p:sp>

      <!-- Slide Title Box -->
      <p:sp>
        <p:nvSpPr><p:cNvPr id="3" name="Title"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="800000" y="700000"/><a:ext cx="10592000" cy="800000"/></a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
        </p:spPr>
        <p:txBody>
          <a:bodyPr/><a:lstStyle/>
          <a:p>
            <a:r>
              <a:rPr lang="tr-TR" sz="2800" b="1">
                <a:solidFill><a:srgbClr val="0F172A"/></a:solidFill>
              </a:rPr>
              <a:t>${escapeXml(titleText)}</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>

      <!-- Content Box -->
      <p:sp>
        <p:nvSpPr><p:cNvPr id="4" name="Content"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="800000" y="1700000"/><a:ext cx="10592000" cy="4400000"/></a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
        </p:spPr>
        <p:txBody>
          <a:bodyPr/><a:lstStyle/>
          ${bodyParasXml}
        </p:txBody>
      </p:sp>

      <!-- Footer Info -->
      <p:sp>
        <p:nvSpPr><p:cNvPr id="5" name="Footer"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="800000" y="6300000"/><a:ext cx="10592000" cy="300000"/></a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
        </p:spPr>
        <p:txBody>
          <a:bodyPr/><a:lstStyle/>
          <a:p>
            <a:r>
              <a:rPr lang="tr-TR" sz="1000">
                <a:solidFill><a:srgbClr val="94A3B8"/></a:solidFill>
              </a:rPr>
              <a:t>${escapeXml(docTitle)} • Sayfa ${p.pageNum} / ${pages.length}</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>`;

    zip.file(`ppt/slides/slide${slideNum}.xml`, slideXml);
    zip.file(
      `ppt/slides/_rels/slide${slideNum}.xml.rels`,
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`
    );
  });

  const arrayBuffer = await zip.generateAsync({ type: 'arraybuffer' });
  return new Uint8Array(arrayBuffer);
}

// ==========================================
// 6. MULTI-COLUMN CSV GENERATOR
// ==========================================

export function generateCsv(
  pages: StructuredPage[],
  options: OfficeExportOptions = {}
): string {
  const delim = options.csvDelimiter || ';';
  let csv = '\uFEFF'; // UTF-8 BOM for Excel compatibility

  pages.forEach((p) => {
    if (options.includePageNumbers && pages.length > 1) {
      csv += `\n# --- SAYFA ${p.pageNum} ---\n`;
    }

    const matrix = p.tableMatrix.length > 0 ? p.tableMatrix : p.plainTextLines.map(l => [l]);

    matrix.forEach((row) => {
      const line = row
        .map((cell) => {
          const sanitized = cell.replace(/"/g, '""');
          if (sanitized.includes(delim) || sanitized.includes('\n') || sanitized.includes('"')) {
            return `"${sanitized}"`;
          }
          return `"${sanitized}"`;
        })
        .join(delim);
      csv += line + '\n';
    });
  });

  return csv;
}

// ==========================================
// 7. MARKDOWN (.md) GENERATOR
// ==========================================

export function generateMarkdown(
  pages: StructuredPage[],
  options: OfficeExportOptions = {}
): string {
  const docTitle = options.docTitle || 'Belge';
  let md = `# ${docTitle}\n\n`;

  pages.forEach((p, idx) => {
    if (options.includePageNumbers) {
      md += `\n## Sayfa ${p.pageNum}\n\n`;
    }

    for (const b of p.blocks) {
      if (b.type === 'heading') {
        const hashes = b.level === 1 ? '##' : b.level === 2 ? '###' : '####';
        md += `${hashes} ${b.text}\n\n`;
      } else if (b.type === 'bullet') {
        md += `- ${b.text}\n`;
      } else if (b.type === 'paragraph') {
        md += `${b.text}\n\n`;
      } else if (b.type === 'table') {
        if (b.headers && b.headers.length > 0) {
          md += `| ${b.headers.join(' | ')} |\n`;
          md += `| ${b.headers.map(() => '---').join(' | ')} |\n`;
        }
        b.rows.forEach((r) => {
          md += `| ${r.join(' | ')} |\n`;
        });
        md += '\n';
      }
    }

    if (idx < pages.length - 1) {
      md += `\n---\n`;
    }
  });

  return md;
}

// ==========================================
// 8. HTML WEB PAGE GENERATOR
// ==========================================

export function generateHtml(
  pages: StructuredPage[],
  options: OfficeExportOptions = {}
): string {
  const docTitle = options.docTitle || 'Belge';
  let pagesHtml = '';

  pages.forEach((p) => {
    let bodyHtml = '';

    for (const b of p.blocks) {
      if (b.type === 'heading') {
        const tag = b.level === 1 ? 'h2' : b.level === 2 ? 'h3' : 'h4';
        bodyHtml += `<${tag}>${escapeHtml(b.text)}</${tag}>\n`;
      } else if (b.type === 'bullet') {
        bodyHtml += `<li>${escapeHtml(b.text)}</li>\n`;
      } else if (b.type === 'paragraph') {
        bodyHtml += `<p>${escapeHtml(b.text)}</p>\n`;
      } else if (b.type === 'table') {
        let tableHtml = '<table class="table-preview">';
        if (b.headers && b.headers.length > 0) {
          tableHtml += '<thead><tr>' + b.headers.map(h => `<th>${escapeHtml(h)}</th>`).join('') + '</tr></thead>';
        }
        tableHtml += '<tbody>';
        b.rows.forEach((r) => {
          tableHtml += '<tr>' + r.map(c => `<td>${escapeHtml(c)}</td>`).join('') + '</tr>';
        });
        tableHtml += '</tbody></table>\n';
        bodyHtml += tableHtml;
      }
    }

    pagesHtml += `
      <section class="page-card">
        <div class="page-header">
          <span class="page-badge">Sayfa ${p.pageNum}</span>
        </div>
        ${bodyHtml}
      </section>
    `;
  });

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(docTitle)}</title>
  <style>
    body { font-family: 'Inter', -apple-system, system-ui, sans-serif; background: #0f172a; color: #f8fafc; max-width: 900px; margin: 0 auto; padding: 40px 20px; line-height: 1.6; }
    h1 { font-size: 28px; color: #38bdf8; border-bottom: 2px solid #334155; padding-bottom: 12px; margin-bottom: 30px; }
    h2 { font-size: 22px; color: #60a5fa; margin-top: 20px; }
    h3 { font-size: 18px; color: #93c5fd; }
    p { margin: 0 0 12px 0; color: #e2e8f0; text-align: justify; }
    li { color: #cbd5e1; margin-bottom: 6px; }
    .page-card { background: #1e293b; border-radius: 12px; padding: 32px; margin-bottom: 30px; box-shadow: 0 10px 25px rgba(0,0,0,0.3); border: 1px solid #334155; }
    .page-header { display: flex; justify-content: flex-end; margin-bottom: 16px; border-bottom: 1px solid #334155; padding-bottom: 8px; }
    .page-badge { background: rgba(56, 189, 248, 0.2); color: #38bdf8; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 6px; }
    .table-preview { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px; }
    .table-preview th { background: #0f172a; color: #38bdf8; padding: 10px; text-align: left; border: 1px solid #334155; }
    .table-preview td { padding: 8px 10px; border: 1px solid #334155; color: #e2e8f0; }
    .table-preview tr:nth-child(even) { background: rgba(255,255,255,0.02); }
  </style>
</head>
<body>
  <h1>${escapeHtml(docTitle)}</h1>
  ${pagesHtml}
</body>
</html>`;
}

// ==========================================
// 9. PLAIN TEXT (.txt) GENERATOR
// ==========================================

export function generateTxt(
  pages: StructuredPage[],
  options: OfficeExportOptions = {}
): string {
  const docTitle = options.docTitle || 'Belge';
  let txt = `============================================================\n`;
  txt += `PDF STUDIO PRO - METİN DIŞA AKTARIMI\n`;
  txt += `Belge: ${docTitle} | Toplam Sayfa: ${pages.length}\n`;
  txt += `Tarih: ${new Date().toLocaleString('tr-TR')}\n`;
  txt += `============================================================\n\n`;

  pages.forEach((p) => {
    if (options.includePageNumbers) {
      txt += `\n--- SAYFA ${p.pageNum} ---\n\n`;
    }
    txt += p.plainTextLines.join('\n') + '\n';
  });

  return '\uFEFF' + txt;
}
