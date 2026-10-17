// Adds a document to your Library. The phone reads it first: a PDF's text with pdf.js (loaded
// only when needed), a text file as it is, and photos and scanned pages through the AI (Claude,
// or Gemini until Claude is connected), one page at a time. The text then goes to Jarvis's server
// in batches, page by page.
import { startDoc, appendDoc, finishDoc, deleteDoc, readPage } from './server'

export const ACCEPT = 'application/pdf,image/*,text/plain,.txt,.md,.csv'
const MAX_SCANNED = 30        // scanned pages read in one document (each takes a few seconds)
const BATCH = 300000          // characters sent in one go
const MAX_PHOTO = 4 * 1024 * 1024

const wait = (ms) => new Promise(r => setTimeout(r, ms))
const dataUrl = (blob) => new Promise((resolve, reject) => {
  const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(blob)
})

// The AI copies out one page; when it is busy or at its per-minute limit, try again shortly
async function ocr(type, data) {
  for (const pause of [0, 10000, 25000]) {
    if (pause) await wait(pause)
    const res = await readPage(type, data)
    if (!res.error) return res.text || ''
    if (res.error !== 'busy' && res.error !== 'offline') throw new Error(res.why || "Couldn't read this page.")
  }
  throw new Error('The AI is busy just now. Try again in a minute.')
}

const canvasJpeg = (canvas) => canvas.toDataURL('image/jpeg', 0.82).split(',')[1]

// A phone photo made smaller (to 2000 px), as a JPEG
async function photo(file) {
  try {
    const img = await createImageBitmap(file)
    const scale = Math.min(1, 2000 / Math.max(img.width, img.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale)
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
    return { type: 'image/jpeg', data: canvasJpeg(canvas) }
  } catch {
    if (file.size > MAX_PHOTO) throw new Error('This photo is too big (over 4 MB).')
    return { type: file.type, data: (await dataUrl(file)).split(',')[1] }
  }
}

// The text of one PDF page, with line breaks where the lines end
function pageText(items) {
  let t = '', last = null
  for (const it of items) {
    if (!('str' in it)) continue
    if (last) {
      const sameLine = Math.abs(it.transform[5] - last.transform[5]) < 2
      if (last.hasEOL || !sameLine) t += '\n'
      else if (it.transform[4] - (last.transform[4] + last.width) > 1 && !/\s$/.test(t) && !/^\s/.test(it.str)) t += ' '
    }
    t += it.str
    last = it
  }
  return t.replace(/\n{3,}/g, '\n\n').trim()
}

async function pdfPages(file, progress) {
  progress('Opening the PDF…')
  const [pdfjs, { default: PdfWorker }] = await Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?worker'),   // built as a plain .js file
  ])
  pdfjs.GlobalWorkerOptions.workerPort ??= new PdfWorker()
  const task = pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    isEvalSupported: false, useWasm: false, wasmUrl: '/pdfjs/',
  })
  const pdf = await task.promise
  const pages = [], scanned = []
  for (let p = 1; p <= pdf.numPages; p++) {
    if (p % 5 === 1) progress(`Reading page ${p} of ${pdf.numPages}…`)
    const page = await pdf.getPage(p)
    const t = pageText((await page.getTextContent()).items)
    if (t.replace(/\s/g, '').length >= 20) pages.push({ p, t })
    else scanned.push(p)
    page.cleanup()
  }
  // Pages with (almost) no text are scans: draw each one and let the AI read it
  const reading = scanned.slice(0, MAX_SCANNED)
  for (const [i, p] of reading.entries()) {
    progress(`Reading scanned page ${i + 1} of ${reading.length}…`)
    const page = await pdf.getPage(p)
    const one = page.getViewport({ scale: 1 })
    const viewport = page.getViewport({ scale: Math.min(2.5, 1600 / one.width) })
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(viewport.width); canvas.height = Math.round(viewport.height)
    await page.render({ canvas, canvasContext: canvas.getContext('2d'), viewport }).promise
    const t = await ocr('image/jpeg', canvasJpeg(canvas))
    if (t.trim()) pages.push({ p, t })
    page.cleanup()
  }
  await task.destroy()
  return { pages: pages.sort((a, b) => a.p - b.p), skipped: scanned.length - reading.length }
}

// The text of a PDF, photo or text file, page by page → { pages: [{ p, t }], skipped }
// (skipped: scanned pages not read). Also used by the Refund Desk, which keeps nothing.
export async function readPages(file, progress = () => {}) {
  let pages, skipped = 0
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
    ({ pages, skipped } = await pdfPages(file, progress))
  } else if (file.type.startsWith('image/')) {
    progress('Reading the photo…')
    const { type, data } = await photo(file)
    pages = [{ p: 1, t: await ocr(type, data) }]
  } else if (file.type.startsWith('text/') || /\.(txt|md|csv)$/i.test(file.name)) {
    const all = await file.text()
    pages = (all.match(/[\s\S]{1,4000}(?=\s|$)|[\s\S]{1,4000}/g) || []).map((t, i) => ({ p: i + 1, t }))
  } else {
    throw new Error('Jarvis reads PDFs, photos and text files. Save a Word file as PDF first.')
  }
  pages = pages.filter(pg => pg.t.trim())
  if (!pages.length) throw new Error('Jarvis found no text in this document.')
  return { pages, skipped }
}

// Reads a file and saves it to the Library → { doc, skipped } (skipped: scanned pages not read)
export async function addToLibrary(file, progress = () => {}) {
  const name = (file.name || 'Document').replace(/\.[a-z0-9]+$/i, '') || 'Document'
  const { pages, skipped } = await readPages(file, progress)

  progress('Saving to your Library…')
  const started = await startDoc(name)
  if (started.error) throw new Error(started.why || 'Could not save. Try again.')
  try {
    for (let i = 0; i < pages.length;) {
      const batch = []
      let size = 0
      while (i < pages.length && (size === 0 || size + pages[i].t.length <= BATCH)) { batch.push(pages[i]); size += pages[i].t.length; i++ }
      const res = await appendDoc(started.id, batch)
      if (res.error) throw new Error(res.why || 'Could not save. Try again.')
      if (pages.length > 40) progress(`Saving page ${batch.at(-1).p} of ${pages.at(-1).p}…`)
    }
    const done = await finishDoc(started.id)
    if (done.error) throw new Error(done.why || 'Could not save. Try again.')
    return { doc: done.doc, skipped }
  } catch (err) {
    deleteDoc(started.id)   // no half-saved documents
    throw err
  }
}
