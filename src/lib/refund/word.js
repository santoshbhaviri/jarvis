// Refund Desk: the order as a Word file on the bilingual Government of India letterhead, in the
// same look as the office's templates (gst-orders/templates/source/style.py): saffron rule, navy
// "One Nation, One Tax" band with a green rule, boxed form title, navy headings, shaded table
// headers, Times New Roman 12, page numbers in the footer. Loaded only when a Word file is made.
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, Footer, PageNumber,
  AlignmentType, BorderStyle, ShadingType, WidthType, TableLayoutType,
} from 'docx'
import { OFFICE } from './order-kit.js'

const NAVY = '1F3864', GREY = '595959', SAFFRON = 'FF9933', GREEN = '138808'
const FONT = 'Times New Roman', HINDI = 'Nirmala UI'
const pt = (n) => Math.round(n * 2)            // docx sizes are half-points
const USABLE = 9638                              // A4 width less 2 cm margins, in twentieths of a point

// Text with **bold**, ⟦to fill⟧ (yellow) and Devanagari (Hindi font) → runs
function runs(text, { size = 12, bold = false, color, italics } = {}) {
  const out = []
  String(text).split('\n').forEach((line, li) => {
    for (const part of line.split(/(\*\*[^*]+\*\*|⟦[^⟧]*⟧)/)) {
      if (!part) continue
      const isBold = part.startsWith('**') && part.endsWith('**')
      const isBlank = part.startsWith('⟦')
      const body = isBold ? part.slice(2, -2) : isBlank ? `[${part.slice(1, -1).trim() || ' '}]` : part
      body.split(/([ऀ-ॿ][ऀ-ॿ\s,.:।-]*)/).forEach((seg, i) => {
        if (!seg) return
        out.push(new TextRun({
          text: seg, size: pt(size), bold: bold || isBold, italics, color,
          font: i % 2 ? { ascii: HINDI, hAnsi: HINDI, cs: HINDI } : FONT,
          ...(isBlank && { highlight: 'yellow' }),
        }))
      })
    }
    if (li < String(text).split('\n').length - 1) out.push(new TextRun({ text: '', break: 1 }))
  })
  return out
}

const para = (text, o = {}) => new Paragraph({
  children: runs(text, o), alignment: o.align ?? (String(text).length > 120 ? AlignmentType.JUSTIFIED : AlignmentType.LEFT),
  spacing: { before: o.before ?? 0, after: o.after ?? 120, line: o.line ?? 269 },
  ...(o.border && { border: o.border }), ...(o.shading && { shading: o.shading }),
  ...(o.keepNext && { keepNext: true }), ...(o.indent && { indent: o.indent }),
})

function letterhead(o) {
  const line = (text, size, bold, color, extra = {}) => para(text, { size, bold, color, align: AlignmentType.CENTER, after: 20, line: 252, ...extra })
  return [
    line('भारत सरकार  |  GOVERNMENT OF INDIA', 11, true, NAVY, { border: { top: { style: BorderStyle.SINGLE, size: 36, color: SAFFRON, space: 6 } } }),
    line('वित्त मंत्रालय, राजस्व विभाग  |  MINISTRY OF FINANCE, DEPARTMENT OF REVENUE', 9, false, GREY),
    line('केन्द्रीय कर सहायक आयुक्त का कार्यालय', 11, true),
    line('OFFICE OF THE ASSISTANT COMMISSIONER OF CENTRAL TAX', 11.5, true),
    line(o.division.toUpperCase(), 16, true, NAVY),
    line(o.commrte.toUpperCase(), 11, true, NAVY),
    line(o.address, 9, false, GREY),
    line(`Telephone: ${o.phone}   |   E-mail: ${o.email}`, 9, false, GREY, { after: 120 }),
    line('GST  ★  ONE NATION, ONE TAX  ★  जीएसटी: एक राष्ट्र, एक कर', 10.5, true, 'FFFFFF', {
      after: 280,
      shading: { type: ShadingType.CLEAR, color: 'auto', fill: NAVY },
      border: { bottom: { style: BorderStyle.SINGLE, size: 36, color: GREEN, space: 0 } },
    }),
  ]
}

function title(lines) {
  const box = { style: BorderStyle.SINGLE, size: 8, color: NAVY, space: 4 }
  return [para(lines.join('\n'), {
    size: 12, bold: true, color: NAVY, align: AlignmentType.CENTER, before: 80, after: 200, line: 264,
    border: { top: box, bottom: box, left: box, right: box },
    shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'EEF2F8' },
  })]
}

const heading = (text) => para(text, {
  size: 12.5, bold: true, color: NAVY, before: 240, after: 80, keepNext: true,
  align: /^(\d+\. )?ORDER$|^IMPORTANT NOTE/.test(text) ? AlignmentType.CENTER : AlignmentType.LEFT,
  border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'B4C6E7', space: 1 } },
})

// Column widths by how much text each column holds (as in the templates' build script)
function widths(head, rows) {
  const lens = head.map((hd, ci) => {
    const vals = rows.map(r => String(r[ci] ?? '').length)
    let avg = vals.reduce((a, b) => a + b, 0) / Math.max(1, vals.length)
    const longest = Math.max(3, ...hd.split(/\s+/).map(w => w.length))
    if (['No.', 'Ground', 'Ground No.', 'Head'].includes(hd)) avg = Math.min(avg, 6)
    if (hd === 'Step') avg = 8
    return Math.min(Math.max(avg, longest + 5, 12), 70)
  })
  const tot = lens.reduce((a, b) => a + b, 0)
  return lens.map(l => Math.round(USABLE * l / tot))
}

function table(head, rows) {
  const small = head.length >= 7 ? 9 : 10.5
  const cols = widths(head, rows)
  const edge = { style: BorderStyle.SINGLE, size: 4, color: '8EA9C1' }
  const particulars = head.length === 2 && head[0] === 'Particulars'
  const cell = (text, ci, { header, total } = {}) => new TableCell({
    width: { size: cols[ci], type: WidthType.DXA },
    margins: { top: 30, bottom: 30, left: 80, right: 80 },
    ...((header || total || (particulars && ci === 0)) && { shading: { type: ShadingType.CLEAR, color: 'auto', fill: header ? 'DCE6F1' : total ? 'F2F2F2' : 'F5F8FC' } }),
    children: [para(text, { size: small, bold: header || (particulars && ci === 0), color: header ? NAVY : undefined, after: 0, line: 240, align: AlignmentType.LEFT })],
  })
  return new Table({
    layout: TableLayoutType.FIXED,
    width: { size: USABLE, type: WidthType.DXA },
    columnWidths: cols,
    borders: { top: edge, bottom: edge, left: edge, right: edge, insideHorizontal: edge, insideVertical: edge },
    rows: [
      new TableRow({ tableHeader: true, children: head.map((t, i) => cell(t, i, { header: true })) }),
      ...rows.map(r => {
        const total = r.slice(0, 3).some(x => /^\*\*Total/.test(String(x)))
        return new TableRow({ children: r.map((t, i) => cell(t ?? '', i, { total })) })
      }),
    ],
  })
}

// opts.title: the Word file's document title (a notice passes { title: 'Notice (RFD-08)' })
export async function orderToWord(blocks, office = OFFICE, opts = {}) {
  const children = []
  for (const b of blocks) {
    if (b.t === 'letterhead') children.push(...letterhead(office))
    else if (b.t === 'title') children.push(...title(b.lines))
    else if (b.t === 'h') children.push(heading(b.text))
    else if (b.t === 'p') children.push(para(b.text))
    else if (b.t === 'caption') children.push(para(b.text, { italics: true, size: 11, before: 120, after: 60, keepNext: true }))
    else if (b.t === 'quote') children.push(para(b.text, { size: 11, indent: { left: 400, right: 400 }, shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'E7E6E6' }, align: AlignmentType.CENTER }))
    else if (b.t === 'table') { children.push(table(b.head, b.rows)); children.push(para('', { after: 80 })) }
    else if (b.t === 'list') b.items.forEach(t => children.push(new Paragraph({ children: runs(t), bullet: { level: 0 }, spacing: { after: 60 } })))
    else if (b.t === 'sign') children.push(para(`\n\n**(Signature)**\n**(${b.officer})**\n${b.desig}\n${b.office}`, { align: AlignmentType.RIGHT, before: 240, after: 240 }))
  }
  const doc = new Document({
    creator: 'Jarvis Refund Desk',
    title: opts?.title || 'Refund order (RFD-06)',
    styles: { default: { document: { run: { font: FONT, size: pt(12) } } } },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
      footers: {
        default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [
          new TextRun({ text: `${office.division}  ·  Page `, size: pt(9), color: GREY, font: FONT }),
          new TextRun({ children: [PageNumber.CURRENT], size: pt(9), color: GREY, font: FONT }),
          new TextRun({ text: ' of ', size: pt(9), color: GREY, font: FONT }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], size: pt(9), color: GREY, font: FONT }),
        ] })] }),
      },
      children,
    }],
  })
  return Packer.toBlob(doc)
}

// For tests and the command line: the same file as bytes
export async function orderToBuffer(blocks, office = OFFICE, opts = {}) {
  const blob = await orderToWord(blocks, office, opts)
  return Buffer.from(await blob.arrayBuffer())
}
