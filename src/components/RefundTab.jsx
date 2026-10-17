// Refunds: the office's eight refund categories (templates T1 to T8), in two simple steps.
//   1 Check  drop all the claim's documents (RFD-01, GSTR-2B, GSTR-3B, statements…). Claude only
//            reads them into the case; the refund working, the mistakes and the corrections are
//            plain code (src/lib/refund/compute.js, scrutiny.js) and update as you correct a figure.
//            The scrutiny sheet is a Word file for your own analysis.
//   2 Draft  from the checked claim, or from an earlier order or notice you upload: the RFD-06
//            order or the RFD-08 show cause notice on the office's templates, as a Word file with
//            anything still to fill in shown in yellow.
// You decide every figure and every ground; nothing is filed anywhere. The case lives only in this
// open window (not on the phone, not on the server) and is gone when Jarvis is closed.
import { useState, useEffect, useMemo, useRef } from 'react'
import toast from 'react-hot-toast'
import { FileUp, ScanSearch, FileText, RotateCcw, Plus, Trash2, Download, Wand2, CircleAlert, TriangleAlert, Info, Check, ChevronRight } from 'lucide-react'
import { GROUPS, HEAD_LABEL, HEADS, CATS, PROV_CATS, R89_4, emptyCase, fieldsFor, tablesFor, confirmsFor } from '../lib/refund/fields'
import { compute, inr, ddmmyyyy, monthName, num } from '../lib/refund/compute'
import { mergeRead } from '../lib/refund/merge'
import { buildOrder, blanks } from '../lib/refund/order'
import { buildNotice } from '../lib/refund/notice'
import { workingLines, points, buildScrutiny } from '../lib/refund/scrutiny'
import { readPages, ACCEPT } from '../lib/library'
import { refundReady, readRefundDoc, polishFinding } from '../lib/server'
import styles from './RefundTab.module.css'

let kept = null   // the case while you move between tabs (gone on reload, on purpose)

const STEPS = [
  { key: 'check', label: 'Check the claim', icon: ScanSearch },
  { key: 'draft', label: 'Draft order or notice', icon: FileText },
]
const blankState = () => ({ c: emptyCase(), docs: [], prior: [], step: 'check', manual: false })

export default function RefundTab() {
  const [state, setState] = useState(() => kept || blankState())
  useEffect(() => { kept = state }, [state])
  const { c, step } = state
  const set = (fn) => setState(s => ({ ...s, c: typeof fn === 'function' ? fn(s.c) : fn }))
  const go = (k) => { setState(s => ({ ...s, step: k })); window.scrollTo({ top: 0 }) }
  const r = useMemo(() => compute(c), [c])
  const [ready, setReady] = useState(null)
  useEffect(() => { refundReady().then(x => setReady(x.ready === true)) }, [])

  const fresh = () => {
    if (!confirm('Start a new case? Everything on this screen will be cleared.')) return
    setState(blankState())
  }

  return (
    <div className={styles.tab}>
      <div className={styles.head}>
        <div>
          <h2 className={styles.title}>Refunds</h2>
          <p className={styles.sub}>{CATS[c.cat].label} · {CATS[c.cat].law}</p>
        </div>
        <button className={`${styles.btn} ${styles.quiet}`} onClick={fresh}><RotateCcw size={14} />New case</button>
      </div>

      <nav className={styles.steps}>
        {STEPS.map((s, i) => (
          <button key={s.key} className={`${styles.step} ${step === s.key ? styles.on : ''}`} onClick={() => go(s.key)}>
            <s.icon size={15} /><span>{i + 1}. {s.label}</span>
          </button>
        ))}
      </nav>

      {ready === false && <p className={styles.error}>Claude isn't connected, so documents can't be read. Open Evolve, tap Check setup and add your Claude key. You can still type the figures in.</p>}
      {step === 'check' && <CheckStep state={state} setState={setState} set={set} r={r} ready={ready} next={() => go('draft')} />}
      {step === 'draft' && <DraftStep state={state} setState={setState} set={set} r={r} ready={ready} />}
    </div>
  )
}

// ── Reading documents into the case (both steps) ──
function useReader(setState, listKey, cat) {
  const [busy, setBusy] = useState(false)
  const catNow = useRef(cat)
  catNow.current = cat
  const setDoc = (name, patch) => setState(s => ({ ...s, [listKey]: s[listKey].map(d => d.name === name ? { ...d, ...patch } : d) }))
  const add = async (files) => {
    const list = [...files]
    if (!list.length) return
    setBusy(true)
    setState(s => ({ ...s, [listKey]: [...s[listKey].filter(d => !list.some(f => f.name === d.name)), ...list.map(f => ({ name: f.name, status: 'Waiting…' }))] }))
    for (const file of list) {
      try {
        const { pages, skipped } = await readPages(file, (msg) => setDoc(file.name, { status: msg }))
        setDoc(file.name, { status: 'Claude is reading it…' })
        const res = await readRefundDoc(file.name, pages, catNow.current)
        if (res.error) throw new Error(res.why || "Claude couldn't read it. Try again.")
        setState(s => ({ ...s, c: mergeRead(s.c, res, file.name).c }))
        setDoc(file.name, {
          status: 'done', kind: res.kind, found: (res.fields || []).length, grounds: (res.grounds || []).length,
          note: [res.cut && 'only the first part was read: add the rest as a separate file', skipped && `${skipped} scanned pages were left out`].filter(Boolean).join('; '),
        })
      } catch (e) {
        setDoc(file.name, { status: 'error', note: e.message })
      }
    }
    setBusy(false)
  }
  return { busy, add }
}

function DropZone({ busy, disabled, onFiles, title, hint }) {
  const input = useRef(null)
  const [over, setOver] = useState(false)
  const off = busy || disabled
  return (
    <div
      role="button" tabIndex={0}
      className={`${styles.drop} ${over ? styles.over : ''} ${off ? styles.off : ''}`}
      onClick={() => !off && input.current?.click()}
      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && !off && input.current?.click()}
      onDragOver={e => { e.preventDefault(); !off && setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={e => { e.preventDefault(); setOver(false); !off && onFiles(e.dataTransfer.files) }}
    >
      <FileUp size={26} strokeWidth={1.5} />
      <b>{busy ? 'Reading…' : title}</b>
      <small>{hint}</small>
      <input ref={input} type="file" accept={ACCEPT} multiple hidden onChange={e => { e.target.files?.length && onFiles(e.target.files); e.target.value = '' }} />
    </div>
  )
}

function DocList({ docs }) {
  if (!docs.length) return null
  return (
    <ul className={styles.docs}>
      {docs.map(d => (
        <li key={d.name}>
          <span className={styles.docName}>{d.status === 'done' ? <Check size={14} className={styles.okIcon} /> : d.status === 'error' ? <CircleAlert size={14} className={styles.stopIcon} /> : <span className={styles.spin} />}{d.name}</span>
          <small>{d.status === 'done' ? `${d.kind}: ${d.found} figures${d.grounds ? `, ${d.grounds} grounds` : ''}` : d.status === 'error' ? '' : d.status}{d.note ? ` · ${d.note}` : ''}</small>
        </li>
      ))}
    </ul>
  )
}

// Changing the category keeps the figures the new category also uses (the applicant, the
// application) and clears the rest, tables included
function switchCat(c, cat) {
  const keep = new Set(fieldsFor(cat).map(f => f.key))
  const pick = (o) => Object.fromEntries(Object.entries(o || {}).filter(([k]) => keep.has(k)))
  const e = emptyCase(cat)
  return { ...e, v: { ...e.v, ...pick(c.v) }, src: pick(c.src), alt: pick(c.alt), edited: pick(c.edited), notice: c.notice, grounds: c.grounds, order: { ...e.order, ...c.order } }
}

function CategoryPick({ c, busy, setState }) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>Refund category (as in RFD-01)</span>
      <select value={c.cat} disabled={busy} onChange={e => {
        const cat = e.target.value
        if (Object.keys(c.src).length && !confirm(`Change to ${CATS[cat].label}? Figures this category does not use are cleared; the applicant's details are kept.`)) return
        setState(s => ({ ...s, c: switchCat(s.c, cat) }))
      }}>
        {Object.entries(CATS).map(([k, x]) => <option key={k} value={k}>{k}: {x.label}</option>)}
      </select>
    </label>
  )
}

async function saveWord(blocks, name, title) {
  const { orderToWord } = await import('../lib/refund/word')
  const blob = await orderToWord(blocks, undefined, { title })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${name.replace(/[^\w .-]/g, '')}.docx`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 10000)
}

// ── 1. Check the claim ──
function CheckStep({ state, setState, set, r, ready, next }) {
  const { c, docs } = state
  const { busy, add } = useReader(setState, 'docs', c.cat)
  const [making, setMaking] = useState(false)
  const has = state.manual || Object.keys(c.src).length > 0 || !!r.total?.claimed
  const pts = has ? points(c, r) : []
  const sheet = async () => {
    setMaking(true)
    try { await saveWord(buildScrutiny(c, r), `Scrutiny ${c.v.arn || CATS[c.cat].short}`, 'Scrutiny sheet') }
    catch { toast.error("Couldn't make the Word file. Try again.") }
    setMaking(false)
  }

  return (
    <div className={styles.stack}>
      <section className={styles.panel}>
        <CategoryPick c={c} busy={busy} setState={setState} />
        <DropZone busy={busy} disabled={ready === false} onFiles={add}
          title="Drop all the documents here, or tap to choose"
          hint={`RFD-01 with its statements, GSTR-2B, GSTR-3B and the rest: ${CATS[c.cat].docs}. PDFs, scans or photos.`} />
        <DocList docs={docs} />
        <p className={styles.fine}><TriangleAlert size={12} /> Use redacted copies until the department confirms refund documents may be sent to Claude. Nothing is stored.</p>
      </section>

      {has && <>
        <section className={styles.panel}>
          <div className={styles.tiles}>
            <div><small>Claimed</small><b>{rs(r.total?.claimed)}</b></div>
            <div><small>Admissible</small><b className={styles.goldNum}>{rs(r.total?.admissible)}</b></div>
            <div><small>Difference</small><b className={r.total?.rejected ? styles.red : ''}>{rs(r.total?.rejected)}</b></div>
          </div>
          {!!r.total?.excess && <p className={styles.note}>Provisional refund paid in excess: <b className={styles.red}>₹{inr(r.total.excess)}</b></p>}
          {r.sixty && <p className={styles.note}>Sixty days end {ddmmyyyy(r.sixty)}{r.daysLeft >= 0 ? ` (${r.daysLeft} days left)` : ''}.</p>}
        </section>

        <section className={styles.panel}>
          <h3 className={styles.h3}>Mistakes and corrections</h3>
          {pts.length ? <Flags list={pts} /> : <p className={styles.note}>No mistakes found on the figures read.</p>}
        </section>

        <details className={styles.more}>
          <summary><ChevronRight size={15} />The working</summary>
          <Working c={c} r={r} />
        </details>

        <details className={styles.more}>
          <summary><ChevronRight size={15} />Correct a figure</summary>
          <Correct c={c} set={set} />
        </details>

        <div className={styles.actions}>
          <button className={styles.btn} disabled={making} onClick={sheet}><Download size={14} />{making ? 'Making…' : 'Scrutiny sheet (Word)'}</button>
          <button className={`${styles.btn} ${styles.primary}`} onClick={next}>Next: draft the order or notice<ChevronRight size={14} /></button>
        </div>
      </>}
      {!has && !busy && <button className={`${styles.btn} ${styles.quiet}`} onClick={() => setState(s => ({ ...s, manual: true }))}>Type the figures in instead</button>}
    </div>
  )
}

const rs = (x) => x === null || x === undefined ? '—' : `₹${inr(x)}`

function Flags({ list }) {
  const ICON = { stop: CircleAlert, warn: TriangleAlert, ok: Info }
  return (
    <ul className={styles.flags}>
      {list.map((f, i) => {
        const I = ICON[f.level]
        return <li key={i} className={styles[f.level]}><I size={15} /><span>{f.text}{f.law && <small> ({f.law})</small>}</span></li>
      })}
    </ul>
  )
}

const W = ({ label, value, cls }) => <div className={`${styles.wRow} ${cls || ''}`}><span>{label}</span><b>{value}</b></div>

function Working({ c, r }) {
  const lines = workingLines(c, r)
  const title = c.cat === 'T1' ? 'Rule 89(5)' : R89_4.includes(c.cat) ? 'Rule 89(4)' : ''
  return (
    <div className={styles.working}>
      {title && <p className={styles.note}>{title}</p>}
      {!lines.length && <p className={styles.note}>The working appears once the figures it needs are in.</p>}
      {lines.map(([l, x, red], i) => <W key={i} label={l} value={x} cls={red ? styles.red : ''} />)}
      {r.heads && (
        <table className={styles.heads}>
          <thead><tr><th />{['Claimed', 'Admissible', ...(PROV_CATS.includes(c.cat) ? ['Provisional'] : []), 'Rejected'].map(x => <th key={x}>{x}</th>)}</tr></thead>
          <tbody>{HEADS.filter(h => h !== 'cess' || r.heads.cess.claimed).map(h => (
            <tr key={h}><th>{HEAD_LABEL[h]}</th>{['claimed', 'admissible', ...(PROV_CATS.includes(c.cat) ? ['prov'] : []), 'rejected'].map(k => <td key={k}>{inr(r.heads[h][k])}</td>)}</tr>
          ))}</tbody>
        </table>
      )}
      {!!r.limitation?.length && <p className={styles.note}>Two years: {r.limitation.slice(0, 6).map(m => `${m.label} until ${m.ends ? ddmmyyyy(m.ends) : '?'}${m.inTime === false ? ' (late)' : ''}`).join('; ')}{r.limitation.length > 6 ? `; and ${r.limitation.length - 6} more` : ''}.</p>}
      {c.v.from && <p className={styles.note}>Period: {monthName(c.v.from)}{c.v.to && c.v.to !== c.v.from ? ` to ${monthName(c.v.to)}` : ''}</p>}
    </div>
  )
}

function Field({ f, c, set }) {
  const value = c.v[f.key] ?? ''
  // A figure you correct keeps its source, and the order says what it was corrected from
  const put = (x) => set(cc => {
    const read = cc.src[f.key] && !cc.edited?.[f.key] && cc.src[f.key] !== 'Entered by the officer' ? { [f.key]: { value: cc.v[f.key], src: cc.src[f.key] } } : {}
    return { ...cc, v: { ...cc.v, [f.key]: x }, src: cc.src[f.key] ? cc.src : { ...cc.src, [f.key]: 'Entered by the officer' }, edited: { ...cc.edited, ...read } }
  })
  const was = c.edited?.[f.key]
  const alt = c.alt?.[f.key] || []
  const input = f.type === 'choice'
    ? <select value={value} onChange={e => put(e.target.value)}><option value="">—</option>{f.options.map(o => <option key={o}>{o}</option>)}</select>
    : <input
        type={f.type === 'date' ? 'date' : f.type === 'month' ? 'month' : 'text'}
        inputMode={f.type === 'money' || f.type === 'rate' ? 'decimal' : undefined}
        value={value} onChange={e => put(f.type === 'money' || f.type === 'rate' ? e.target.value.replace(/[^\d.]/g, '') : e.target.value)} />
  return (
    <label className={styles.field}>
      <span className={styles.label}>{f.label}</span>
      {input}
      {(f.type === 'money' && num(value) !== null) && <span className={styles.shown}>₹{inr(num(value))}</span>}
      {c.src[f.key] && <span className={styles.src}>{was ? `Corrected: ${f.type === 'money' ? `₹${inr(num(was.value))}` : was.value} was read from ${was.src}` : c.src[f.key]}</span>}
      {alt.map((a, i) => (
        <span key={i} className={styles.alt}>
          Also found {f.type === 'money' ? `₹${inr(a.value)}` : String(a.value)} in {a.src}
          <button type="button" onClick={(e) => { e.preventDefault(); set(cc => ({ ...cc, v: { ...cc.v, [f.key]: a.value }, src: { ...cc.src, [f.key]: a.src }, edited: { ...cc.edited, [f.key]: undefined }, alt: { ...cc.alt, [f.key]: [...alt.filter(x => x !== a), { value: cc.v[f.key], src: cc.src[f.key] || 'earlier' }] } })) }}>Use</button>
        </span>
      ))}
    </label>
  )
}

function Rows({ title, cols, rows, onChange }) {
  const put = (i, k, x) => onChange(rows.map((r, j) => j === i ? { ...r, [k]: x } : r))
  return (
    <div className={styles.rowsBox}>
      <div className={styles.rowsHead}><b>{title}</b><button className={styles.small} onClick={() => onChange([...rows, {}])}><Plus size={13} />Row</button></div>
      {!rows.length && <p className={styles.note}>No rows yet. They come from the documents when they list them line by line, or add them here.</p>}
      {!!rows.length && (
        <div className={styles.scroll}>
          <table className={styles.grid}>
            <thead><tr>{cols.map(col => <th key={col.key}>{col.label}</th>)}<th /></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  {cols.map(col => (
                    <td key={col.key}>
                      {col.type === 'choice'
                        ? <select value={r[col.key] || ''} onChange={e => put(i, col.key, e.target.value)}><option value="">—</option>{col.options.map(o => <option key={o}>{o}</option>)}</select>
                        : col.type === 'date'
                          ? <input type="date" value={r[col.key] ?? ''} onChange={e => put(i, col.key, e.target.value)} />
                          : <input value={r[col.key] ?? ''} inputMode={col.type === 'text' ? undefined : 'decimal'} onChange={e => put(i, col.key, col.type === 'text' ? e.target.value : e.target.value.replace(/[^\d.]/g, ''))} />}
                    </td>
                  ))}
                  <td><button className={styles.icon} aria-label="Delete row" onClick={() => onChange(rows.filter((_, j) => j !== i))}><Trash2 size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Correct({ c, set }) {
  const cessClaimed = num(c.v.claimed_cess) > 0
  const fields = fieldsFor(c.cat)
  return (
    <div className={styles.stack}>
      {GROUPS.filter(g => (g.key !== 'cess' || cessClaimed) && fields.some(f => f.group === g.key)).map(g => (
        <section key={g.key} className={styles.sub2}>
          <h3 className={styles.h3}>{g.label}</h3>
          <div className={styles.fields}>{fields.filter(f => f.group === g.key).map(f => <Field key={f.key} f={f} c={c} set={set} />)}</div>
        </section>
      ))}
      {tablesFor(c.cat).map(t => (
        <section key={t.key} className={styles.sub2}>
          <Rows title={t.label} cols={t.cols} rows={c.rows[t.key] || []} onChange={rows => set(cc => ({ ...cc, rows: { ...cc.rows, [t.key]: rows } }))} />
        </section>
      ))}
      <section className={styles.sub2}>
        <h3 className={styles.h3}>Your checks</h3>
        <p className={styles.note}>Tick what you have verified. Anything not ticked stays as a yellow blank in the order.</p>
        <ul className={styles.confirms}>
          {confirmsFor(c.cat).map(x => (
            <li key={x.key}><label>
              <input type="checkbox" checked={!!c.confirm[x.key]} onChange={e => set(cc => ({ ...cc, confirm: { ...cc.confirm, [x.key]: e.target.checked } }))} />
              <span>{x.text} <small>({x.law})</small></span>
            </label></li>
          ))}
        </ul>
      </section>
    </div>
  )
}

// ── 2. Draft the order or the notice ──
// Grounds to start from: the rows the checks left out (where each row is an amount of the refund),
// or the gap between what was claimed and what the working allows. You edit every word.
function suggestGrounds(c, r) {
  const out = []
  if (!r.total) return out
  if (['T5', 'T6', 'T7'].includes(c.cat)) {
    for (const x of r.left || []) out.push({ title: x.label, text: `${x.label}: ${x.why.join('; ')}. ${blank('the facts found and the provision relied on')}`, amount: x.amount })
  }
  const covered = out.reduce((a, g) => a + (g.amount || 0), 0)
  if (r.total.rejected - covered > 1) {
    const law = c.cat === 'T1' ? 'rule 89(5)' : R89_4.includes(c.cat) ? 'rule 89(4)' : 'section 54'
    const why = R89_4.includes(c.cat) && r.left?.length ? ` The following were left out of the zero-rated turnover: ${r.left.map(x => `${x.label} (₹${inr(x.amount)}: ${x.why.join('; ')})`).join('; ')}.` : ''
    out.push({ title: 'Refund claimed exceeds the amount admissible', text: `The refund admissible under ${law} works out to ₹${inr(r.total.admissible)} against ₹${inr(r.total.claimed)} claimed.${why} ${blank('the working and the provision relied on')}`, amount: r.total.rejected - covered })
  }
  if (r.total.excess > 0) out.push({ title: 'Provisional refund paid in excess', text: `The provisional refund of ₹${inr(r.total.prov)} paid by RFD-05 exceeds the amount admissible, ₹${inr(r.total.admissible)}, by ₹${inr(r.total.excess)}, which is proposed for recovery with interest under section 50.`, amount: 0 })
  return out
}
const blank = (what) => `⟦${what}⟧`

function DraftStep({ state, setState, set, r, ready }) {
  const { c, prior } = state
  const { busy, add } = useReader(setState, 'prior', c.cat)
  const [kind, setKind] = useState(r.rejecting && !c.notice?.no ? 'notice' : 'order')
  const [making, setMaking] = useState(false)
  const [polishing, setPolishing] = useState(-1)
  const n = c.notice || {}, o = c.order || {}
  const putN = (k, x) => set(cc => ({ ...cc, notice: { ...cc.notice, [k]: x } }))
  const putO = (k, x) => set(cc => ({ ...cc, order: { ...cc.order, [k]: x } }))
  const putG = (i, k, x) => set(cc => ({ ...cc, grounds: cc.grounds.map((g, j) => j === i ? { ...g, [k]: x } : g) }))

  // Start the grounds from the checks the first time a part of the claim is to be rejected
  useEffect(() => {
    if (r.rejecting && !c.grounds?.length) set(cc => ({ ...cc, grounds: suggestGrounds(cc, r) }))
  }, [r.rejecting])   // eslint-disable-line react-hooks/exhaustive-deps

  const canOrder = !!r.heads
  const blocks = useMemo(() => {
    try { return kind === 'order' ? (canOrder ? buildOrder(c, r) : null) : buildNotice(c, r) } catch { return null }
  }, [c, r, kind, canOrder])
  const todo = blocks ? blanks(blocks) : []
  const before = r.flags.filter(f => f.level === 'stop')

  const download = async () => {
    setMaking(true)
    try {
      if (kind === 'order') await saveWord(blocks, `RFD-06 draft ${c.v.arn || CATS[c.cat].short}`, 'Refund order (RFD-06)')
      else await saveWord(blocks, `RFD-08 draft ${c.v.arn || CATS[c.cat].short}`, 'Notice (RFD-08)')
    } catch { toast.error("Couldn't make the Word file. Try again.") }
    setMaking(false)
  }

  const period = c.v.from ? `${monthName(c.v.from)}${c.v.to && c.v.to !== c.v.from ? ` to ${monthName(c.v.to)}` : ''}` : ''
  const polish = async (i) => {
    const g = c.grounds[i]
    setPolishing(i)
    const res = await polishFinding({
      facts: `${CATS[c.cat].label} refund${period ? ` for ${period}` : ''}; claimed ₹${inr(r.total?.claimed)}, admissible on the working ₹${inr(r.total?.admissible)}.`,
      ground: `${g.title ? `${g.title}. ` : ''}${g.text}`, reply: g.reply, verified: g.verified,
      finding: `${{ rejected: 'Not accepted', accepted: 'Accepted', partly: 'Partly accepted' }[g.outcome] || ''}. ${g.finding}`,
    })
    setPolishing(-1)
    if (res.error) return toast.error(res.why || "Claude couldn't write it. Try again.")
    putG(i, 'para', res.para)
  }

  // A plain function, not a component, so a box keeps its cursor while you type
  const F = ({ k, label, type = 'text', obj = 'n', ...extra }) => (
    <label key={`${obj}.${k}`} className={styles.field}><span className={styles.label}>{label}</span>
      <input type={type} value={(obj === 'n' ? n : o)[k] || ''} onChange={e => (obj === 'n' ? putN : putO)(k, e.target.value)} {...extra} />
    </label>
  )

  return (
    <div className={styles.stack}>
      <section className={styles.panel}>
        <p className={styles.note}>{Object.keys(c.src).length ? `Using the claim from step 1 (${CATS[c.cat].short}). ` : ''}You can also start from an earlier order or show cause notice: drop it here and its figures and grounds are filled in.</p>
        {!Object.keys(c.src).length && <CategoryPick c={c} busy={busy} setState={setState} />}
        <DropZone busy={busy} disabled={ready === false} onFiles={add} title="Drop an earlier order or notice" hint="RFD-06, RFD-08 or a scrutiny note on this claim" />
        <DocList docs={prior} />
      </section>

      <div className={styles.seg}>
        <button className={kind === 'order' ? styles.on : ''} onClick={() => setKind('order')}>RFD-06 order</button>
        <button className={kind === 'notice' ? styles.on : ''} onClick={() => setKind('notice')}>Show cause notice</button>
      </div>

      <section className={styles.panel}>
        <div className={styles.fields}>
          {kind === 'order' ? <>
            {F({ obj: 'o', k: 'no', label: 'Order No.' })}
            {F({ obj: 'o', k: 'date', label: 'Order date', type: 'date' })}
            {F({ obj: 'o', k: 'rfn', label: 'RFN from the portal' })}
          </> : <>
            {F({ k: 'no', label: 'Notice No.' })}
            {F({ k: 'date', label: 'Notice date', type: 'date' })}
            {F({ k: 'hearing', label: 'Personal hearing date', type: 'date' })}
            {F({ k: 'time', label: 'Hearing time', placeholder: '11:00 AM' })}
          </>}
        </div>
        <details className={styles.more2}>
          <summary><ChevronRight size={14} />More details</summary>
          <div className={styles.fields}>
            {kind === 'order' ? <>
              {F({ obj: 'o', k: 'range', label: 'Range' })}
              {F({ obj: 'o', k: 'dues', label: 'Dues under s.54(10) checked on', type: 'date' })}
              {F({ k: 'no', label: 'RFD-08 No. (if issued)' })}
              {F({ k: 'date', label: 'RFD-08 date', type: 'date' })}
              {F({ k: 'reply', label: 'Reply (RFD-09) date, if any', type: 'date' })}
              {F({ k: 'hearing', label: 'Hearing date', type: 'date' })}
              {F({ k: 'attended', label: 'Attended by (designation)', placeholder: 'the authorised representative' })}
              {F({ obj: 'o', k: 'adj_ref', label: 'Adjusted against demand (ID)' })}
              {HEADS.filter(h => r.heads?.[h]?.admissible > 0).map(h => F({ obj: 'o', k: `adj_${h}`, label: `${HEAD_LABEL[h]} adjusted (₹)`, inputMode: 'decimal' }))}
            </> : <>
              {F({ k: 'rfn', label: 'RFN from the portal' })}
              {F({ k: 'relied', label: 'Documents relied on' })}
              {!!r.total?.excess && F({ k: 'drc01', label: 'DRC-01 summary (No. and date)' })}
              {!!r.total?.excess && F({ k: 'recovery_sec', label: 'Recovery under section (73 / 74 / 74A)' })}
            </>}
          </div>
        </details>
      </section>

      {(r.rejecting || !!c.grounds?.length) && (
        <section className={styles.panel}>
          <div className={styles.rowsHead}>
            <h3 className={styles.h3}>Grounds</h3>
            <button className={styles.small} onClick={() => set(cc => ({ ...cc, grounds: [...(cc.grounds || []), {}] }))}><Plus size={13} />Ground</button>
          </div>
          {!c.grounds?.length && <p className={styles.note}>No grounds yet.</p>}
          {(c.grounds || []).map((g, i) => (
            <div key={i} className={styles.ground}>
              <div className={styles.rowsHead}>
                <b>Ground {i + 1}{g.from ? <small className={styles.src}> · from {g.from}</small> : null}</b>
                <button className={styles.icon} aria-label="Delete ground" onClick={() => set(cc => ({ ...cc, grounds: cc.grounds.filter((_, j) => j !== i) }))}><Trash2 size={14} /></button>
              </div>
              <div className={styles.fields}>
                <label className={styles.field}><span className={styles.label}>Title</span><input value={g.title || ''} onChange={e => putG(i, 'title', e.target.value)} /></label>
                <label className={styles.field}><span className={styles.label}>Amount (₹)</span><input inputMode="decimal" value={g.amount ?? ''} onChange={e => putG(i, 'amount', e.target.value.replace(/[^\d.]/g, ''))} /></label>
              </div>
              <label className={styles.field}><span className={styles.label}>The ground, with figures and the provision</span><textarea rows={3} value={g.text || ''} onChange={e => putG(i, 'text', e.target.value)} /></label>
              {kind === 'order' && <>
                <div className={styles.fields}>
                  <label className={styles.field}><span className={styles.label}>Your decision after the hearing</span>
                    <select value={g.outcome || ''} onChange={e => putG(i, 'outcome', e.target.value)}><option value="">—</option><option value="rejected">Not accepted (reject)</option><option value="partly">Partly accepted</option><option value="accepted">Accepted (drop the ground)</option></select>
                  </label>
                </div>
                <label className={styles.field}><span className={styles.label}>Applicant's reply</span><textarea rows={2} value={g.reply || ''} onChange={e => putG(i, 'reply', e.target.value)} /></label>
                <label className={styles.field}><span className={styles.label}>Your finding and the provision</span><textarea rows={2} value={g.finding || ''} onChange={e => putG(i, 'finding', e.target.value)} /></label>
                <div className={styles.actions}>
                  <button className={styles.btn} disabled={polishing === i || !g.finding?.trim()} onClick={() => polish(i)}><Wand2 size={14} />{polishing === i ? 'Writing…' : 'Write it up as an order paragraph'}</button>
                </div>
                {g.para !== undefined && <label className={styles.field}><span className={styles.label}>Order paragraph (edit freely)</span><textarea rows={5} value={g.para} onChange={e => putG(i, 'para', e.target.value)} /></label>}
              </>}
            </div>
          ))}
        </section>
      )}

      <section className={styles.panel}>
        {!blocks && <p className={styles.note}>{kind === 'order' ? 'Add the claim in step 1, or drop an earlier order above, to make the draft order.' : "Couldn't make the notice yet. Add the claim first."}</p>}
        {blocks && <>
          {todo.length
            ? <p className={styles.note}>Still to fill in (yellow in the Word file): {todo.slice(0, 12).join('; ')}{todo.length > 12 ? `; and ${todo.length - 12} more` : ''}.</p>
            : <p className={styles.note}>Nothing left blank. Read it through before you sign.</p>}
          {kind === 'order' && !!before.length && <Flags list={before.map(f => ({ ...f, text: `Before you sign: ${f.text}` }))} />}
          <div className={styles.actions}>
            <button className={`${styles.btn} ${styles.primary}`} disabled={making} onClick={download}><Download size={14} />{making ? 'Making…' : `Download the draft ${kind === 'order' ? 'order' : 'notice'} (Word)`}</button>
          </div>
          <Preview blocks={blocks} />
        </>}
      </section>
    </div>
  )
}

const rich = (t) => String(t).split(/(\*\*[^*]+\*\*|⟦[^⟧]*⟧)/).map((part, i) =>
  part.startsWith('**') ? <b key={i}>{part.slice(2, -2)}</b>
  : part.startsWith('⟦') ? <mark key={i}>[{part.slice(1, -1) || ' '}]</mark>
  : part)

function Preview({ blocks }) {
  return (
    <article className={styles.paper}>
      {blocks.map((b, i) => {
        if (b.t === 'letterhead') return <header key={i} className={styles.lh}><p>भारत सरकार | GOVERNMENT OF INDIA</p><p><b>OFFICE OF THE ASSISTANT COMMISSIONER OF CENTRAL TAX</b></p><p className={styles.band}>GST ★ ONE NATION, ONE TAX ★ जीएसटी: एक राष्ट्र, एक कर</p></header>
        if (b.t === 'title') return <div key={i} className={styles.formTitle}>{b.lines.map((l, j) => <p key={j}>{l}</p>)}</div>
        if (b.t === 'h') return <h4 key={i}>{b.text}</h4>
        if (b.t === 'p' || b.t === 'caption') return <p key={i} className={b.t === 'caption' ? styles.caption : ''}>{rich(b.text)}</p>
        if (b.t === 'quote') return <blockquote key={i}>{rich(b.text)}</blockquote>
        if (b.t === 'list') return <ul key={i}>{b.items.map((x, j) => <li key={j}>{rich(x)}</li>)}</ul>
        if (b.t === 'sign') return <p key={i} className={styles.sign}><b>(Signature)</b><br /><b>({b.officer})</b><br />{b.desig}<br />{b.office}</p>
        if (b.t === 'table') return (
          <div key={i} className={styles.scroll}><table className={styles.grid}>
            <thead><tr>{b.head.map((h, j) => <th key={j}>{h}</th>)}</tr></thead>
            <tbody>{b.rows.map((row, j) => <tr key={j}>{row.map((x, k) => <td key={k}>{rich(x ?? '')}</td>)}</tr>)}</tbody>
          </table></div>
        )
        return null
      })}
    </article>
  )
}
