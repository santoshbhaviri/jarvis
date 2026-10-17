// Refund Desk: the office's eight refund categories (templates T1 to T8), from the claim's
// documents to the order.
//   1 Documents  pick the category; Claude reads each document into the case's fields and tables,
//                noting the page
//   2 Review     you check every figure against its source; the arithmetic and the checks are
//                plain code (src/lib/refund/compute.js) and update as you type
//   3 Notice     only when part of the claim is to be rejected (or excess provisional refund
//                recovered): the RFD-08 notice as a Word file (template N1), then your findings
//   4 Order      the RFD-06 speaking order as a Word file on the letterhead, for you to sign
// You decide every figure and every ground; nothing is filed anywhere. The case lives only in this
// open window (not on the phone, not on the server) and is gone when Jarvis is closed.
import { useState, useEffect, useMemo, useRef } from 'react'
import toast from 'react-hot-toast'
import { FileUp, Calculator, Gavel, FileText, RotateCcw, Plus, Trash2, Download, Wand2, CircleAlert, TriangleAlert, Info, Check } from 'lucide-react'
import { GROUPS, HEAD_LABEL, HEADS, CATS, PROV_CATS, R89_4, emptyCase, fieldsFor, tablesFor, confirmsFor } from '../lib/refund/fields'
import { compute, inr, ddmmyyyy, monthName, num } from '../lib/refund/compute'
import { mergeRead } from '../lib/refund/merge'
import { buildOrder, blanks } from '../lib/refund/order'
import { buildNotice, noticeReady } from '../lib/refund/notice'
import { readPages, ACCEPT } from '../lib/library'
import { refundReady, readRefundDoc, polishFinding } from '../lib/server'
import styles from './RefundTab.module.css'

let kept = null   // the case while you move between tabs (gone on reload, on purpose)

const STEPS = [
  { key: 'docs',   label: 'Documents', icon: FileUp },
  { key: 'review', label: 'Review',    icon: Calculator },
  { key: 'notice', label: 'Notice',    icon: Gavel },
  { key: 'order',  label: 'Order',     icon: FileText },
]

export default function RefundTab() {
  const [state, setState] = useState(() => kept || { c: emptyCase(), docs: [], step: 'docs' })
  useEffect(() => { kept = state }, [state])
  const { c, docs, step } = state
  const set = (fn) => setState(s => ({ ...s, c: typeof fn === 'function' ? fn(s.c) : fn }))
  const go = (k) => { setState(s => ({ ...s, step: k })); window.scrollTo({ top: 0 }) }
  const r = useMemo(() => compute(c), [c])

  const fresh = () => {
    if (!confirm('Start a new case? The figures on this screen will be cleared.')) return
    setState({ c: emptyCase(), docs: [], step: 'docs' })
  }

  return (
    <div className={styles.tab}>
      <div className={styles.head}>
        <div>
          <h2 className={styles.title}>Refund Desk</h2>
          <p className={styles.sub}>{CATS[c.cat].label} · {CATS[c.cat].law} · order on template {c.cat}</p>
        </div>
        <button className={`${styles.btn} ${styles.quiet}`} onClick={fresh}><RotateCcw size={14} />New case</button>
      </div>

      <nav className={styles.steps}>
        {STEPS.map((s, i) => (
          <button key={s.key} className={`${styles.step} ${step === s.key ? styles.on : ''}`} onClick={() => go(s.key)}>
            <s.icon size={15} /><span>{i + 1}. {s.label}</span>
            {s.key === 'notice' && r.rejecting && <em className={styles.dot} aria-label="needed" />}
          </button>
        ))}
      </nav>

      {step === 'docs'   && <Documents c={c} docs={docs} setState={setState} next={() => go('review')} />}
      {step === 'review' && <Review c={c} r={r} set={set} next={() => go(r.rejecting ? 'notice' : 'order')} />}
      {step === 'notice' && <Notice c={c} r={r} set={set} next={() => go('order')} />}
      {step === 'order'  && <Order c={c} r={r} set={set} />}
    </div>
  )
}

// ── 1. Documents ──
// Changing the category keeps the figures the new category also uses (the applicant, the
// application) and clears the rest, tables included
function switchCat(c, cat) {
  const keep = new Set(fieldsFor(cat).map(f => f.key))
  const pick = (o) => Object.fromEntries(Object.entries(o || {}).filter(([k]) => keep.has(k)))
  const e = emptyCase(cat)
  return { ...e, v: { ...e.v, ...pick(c.v) }, src: pick(c.src), alt: pick(c.alt), edited: pick(c.edited), notice: c.notice, order: { ...e.order, ...c.order } }
}

function Documents({ c, docs, setState, next }) {
  const input = useRef(null)
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(null)
  useEffect(() => { refundReady().then(x => setReady(x.ready === true)) }, [])

  const setDoc = (name, patch) => setState(s => ({ ...s, docs: s.docs.map(d => d.name === name ? { ...d, ...patch } : d) }))
  const add = async (files) => {
    setBusy(true)
    const list = [...files]
    setState(s => ({ ...s, docs: [...s.docs.filter(d => !list.some(f => f.name === d.name)), ...list.map(f => ({ name: f.name, status: 'Waiting…' }))] }))
    for (const file of list) {
      try {
        const { pages, skipped } = await readPages(file, (msg) => setDoc(file.name, { status: msg }))
        setDoc(file.name, { status: 'Claude is reading it…' })
        const res = await readRefundDoc(file.name, pages, c.cat)
        if (res.error) throw new Error(res.why || "Claude couldn't read it. Try again.")
        setState(s => ({ ...s, c: mergeRead(s.c, res, file.name).c }))
        setDoc(file.name, {
          status: 'done', kind: res.kind, found: (res.fields || []).length, rows: Object.values(res.rows || {}).reduce((a, x) => a + (x?.length || 0), 0),
          note: [res.cut && 'only the first part was read: add the rest as a separate file', skipped && `${skipped} scanned pages were left out`].filter(Boolean).join('; '),
        })
      } catch (e) {
        setDoc(file.name, { status: 'error', note: e.message })
      }
    }
    setBusy(false)
  }

  return (
    <section className={styles.panel}>
      <div className={styles.warn}>
        <TriangleAlert size={16} />
        <p>Until the department confirms that refund documents may be sent to Claude, use <b>redacted</b> copies (GSTIN and name blanked). Documents are read and forgotten: nothing is stored on the server or the phone.</p>
      </div>
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
      <p className={styles.note}>Add the claim's documents: {CATS[c.cat].docs}. PDFs (scanned pages too), photos or text.</p>
      {ready === false && <p className={styles.error}>Claude isn't connected. Open Evolve, tap Check setup and add your Claude key. You can still enter the figures by hand.</p>}
      <div className={styles.actions}>
        <button className={`${styles.btn} ${styles.primary}`} disabled={busy || ready === false} onClick={() => input.current?.click()}><FileUp size={14} />Add documents</button>
        <button className={styles.btn} onClick={next}>{docs.length ? 'Review the figures' : 'Enter figures by hand'}</button>
        <input ref={input} type="file" accept={ACCEPT} multiple hidden onChange={e => { e.target.files?.length && add(e.target.files); e.target.value = '' }} />
      </div>
      {!!docs.length && (
        <ul className={styles.docs}>
          {docs.map(d => (
            <li key={d.name}>
              <span className={styles.docName}>{d.status === 'done' ? <Check size={14} className={styles.okIcon} /> : d.status === 'error' ? <CircleAlert size={14} className={styles.stopIcon} /> : <span className={styles.spin} />}{d.name}</span>
              <small>{d.status === 'done' ? `${d.kind}: ${d.found} figures${d.rows ? `, ${d.rows} table rows` : ''}` : d.status === 'error' ? '' : d.status}{d.note ? ` · ${d.note}` : ''}</small>
            </li>
          ))}
        </ul>
      )}
      {Object.keys(c.v).length > 1 && <p className={styles.note}>{Object.keys(c.src).length} figures read so far. Check each one in Review.</p>}
    </section>
  )
}

// ── 2. Review ──
function Field({ f, c, set }) {
  const value = c.v[f.key] ?? ''
  // A figure you correct keeps its source, and the order says what it was corrected from
  const put = (x) => set(cc => {
    const read = cc.src[f.key] && !cc.edited?.[f.key] ? { [f.key]: { value: cc.v[f.key], src: cc.src[f.key] } } : {}
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
          <button type="button" onClick={() => set(cc => ({ ...cc, v: { ...cc.v, [f.key]: a.value }, src: { ...cc.src, [f.key]: a.src }, edited: { ...cc.edited, [f.key]: undefined }, alt: { ...cc.alt, [f.key]: [...alt.filter(x => x !== a), { value: cc.v[f.key], src: cc.src[f.key] || 'earlier' }] } }))}>Use</button>
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
      {!rows.length && <p className={styles.note}>No rows yet. They come from the documents when Claude finds them listed line by line, or add them here.</p>}
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

function Flags({ r }) {
  const ICON = { stop: CircleAlert, warn: TriangleAlert, ok: Info }
  return (
    <ul className={styles.flags}>
      {r.flags.map((f, i) => {
        const I = ICON[f.level]
        return <li key={i} className={styles[f.level]}><I size={15} /><span>{f.text}{f.law && <small> ({f.law})</small>}</span></li>
      })}
    </ul>
  )
}

const W = ({ label, value, cls }) => <div className={`${styles.wRow} ${cls || ''}`}><span>{label}</span><b>{value}</b></div>
const money = (x) => x === null || x === undefined ? '—' : inr(x)

// The working of the formula, one line per step, for each kind of category
function Steps({ c, r }) {
  const s = r.steps
  if (c.cat === 'T1') return !s ? <p className={styles.note}>The working appears here once A to E are filled in.</p> : <>
    <W label="(i) A × C ÷ B" value={inr(s.i, 2)} />
    <W label="(ii) C ÷ D (not rounded)" value={s.ratio.toFixed(6)} />
    <W label="(iii) E × C ÷ D" value={inr(s.iii, 2)} />
    <W label="(iv) Maximum refund" value={inr(s.maxRefund)} />
    <W label="(v) Ledger at end of period" value={money(s.end)} />
    <W label="(vi) Ledger at filing" value={money(s.atFiling)} />
  </>
  if (R89_4.includes(c.cat)) return !s ? <p className={styles.note}>The working appears here once the zero-rated turnover, the Adjusted Total Turnover and Net ITC are in.</p> : <>
    {c.cat === 'T3' || c.cat === 'T4' ? s.fromD !== null && <W label="Services: (a) + (b) − (c)" value={inr(s.fromD)} /> : null}
    {!!s.excluded && <W label="Left out of the numerator (stays in the turnover)" value={inr(s.excluded)} />}
    <W label="Zero-rated turnover adopted" value={inr(s.numerator)} />
    <W label="Adjusted Total Turnover" value={inr(s.ato)} />
    <W label="Net ITC" value={inr(s.net)} />
    <W label="Formula (not rounded)" value={inr(s.formula, 2)} />
    {s.asClaimed !== null && <W label="The formula on the turnover as claimed" value={inr(s.asClaimed, 2)} />}
    <W label="Ledger at end of period" value={money(s.end)} />
    <W label="Ledger at filing" value={money(s.atFiling)} />
  </>
  if (c.cat === 'T5' || c.cat === 'T6') return <>
    <W label="Tax on the invoices in Table 1" value={inr(s.rowsTotal)} />
    {r.left.map(x => <W key={x.i} label={`${x.label}: ${x.why.join('; ')}`} value={`− ${inr(x.amount)}`} cls={styles.red} />)}
  </>
  if (c.cat === 'T7') return <>
    {HEADS.filter(h => r.heads[h].claimed || s.fromRows[h]).map(h => <W key={h} label={`${HEAD_LABEL[h]}: entries in Table 1 / cash balance`} value={`${inr(s.fromRows[h])} / ${money(s.cash[h])}`} />)}
    {r.left.map(x => <W key={x.i} label={`${x.label}: not refundable`} value={`− ${inr(x.amount)}`} cls={styles.red} />)}
  </>
  if (c.cat === 'T8') return <>
    <W label="(a) Pre-deposit + (b) other amounts" value={inr(HEADS.reduce((a, h) => a + r.heads[h].pd + r.heads[h].op, 0))} />
    <W label="(c) Not refundable" value={inr(HEADS.reduce((a, h) => a + r.heads[h].nr, 0))} />
    <W label="Of the refund: pre-deposit / other amounts" value={`${inr(r.total.pdRef)} / ${inr(r.total.opRef)}`} />
    <W label="Paid in cash (RFD-05) / re-credit (PMT-03)" value={`${inr(r.total.cash)} / ${inr(r.total.credit)}`} />
    <W label={`s.115 interest on the pre-deposit, ${s.days ?? '?'} days at ${s.rate}%`} value={`₹${inr(r.total.interest)}`} />
  </>
  return null
}

function Working({ c, r }) {
  if (!r.heads) return <div className={styles.working}><Steps c={c} r={r} /></div>
  const v = c.v
  const shown = HEADS.filter(h => h !== 'cess' || r.heads.cess.claimed)
  const cols = [['claimed', 'Claimed'], ['admissible', 'Admissible'], ...(PROV_CATS.includes(c.cat) ? [['prov', 'Provisional']] : []),
    ...(r.total.adj ? [['adj', 'Adjusted']] : []), ['net', c.cat === 'T8' ? 'Cash now' : 'Net now'], ...(c.cat === 'T8' ? [['credit', 'PMT-03'], ['interest', 's.115']] : []), ['rejected', 'Rejected']]
  return (
    <div className={styles.working}>
      <Steps c={c} r={r} />
      <W label="Admissible" value={`₹${inr(r.total.admissible)}`} cls={styles.total} />
      <W label="Claimed" value={`₹${inr(r.total.claimed)}`} />
      <div className={styles.wRow}><span>To be rejected</span><b className={r.total.rejected ? styles.red : ''}>₹{inr(r.total.rejected)}</b></div>
      {!!r.total.excess && <div className={styles.wRow}><span>Provisional refund paid in excess</span><b className={styles.red}>₹{inr(r.total.excess)}</b></div>}
      <table className={styles.heads}>
        <thead><tr><th />{cols.map(([k, l]) => <th key={k}>{l}</th>)}</tr></thead>
        <tbody>{shown.map(h => (
          <tr key={h}><th>{HEAD_LABEL[h]}</th>{cols.map(([k]) => <td key={k}>{inr(r.heads[h][k])}</td>)}</tr>
        ))}</tbody>
      </table>
      {!!r.limitation.length && (
        <p className={styles.note}>Two years: {r.limitation.slice(0, 6).map(m => `${m.label} until ${m.ends ? ddmmyyyy(m.ends) : '?'}${m.inTime === false ? ' (late)' : ''}`).join('; ')}{r.limitation.length > 6 ? `; and ${r.limitation.length - 6} more` : ''}.</p>
      )}
      {r.sixty && <p className={styles.note}>Sixty days end {ddmmyyyy(r.sixty)}{r.daysLeft >= 0 ? ` (${r.daysLeft} days left)` : ''}.</p>}
      {v.from && <p className={styles.note}>Period: {monthName(v.from)}{v.to && v.to !== v.from ? ` to ${monthName(v.to)}` : ''}</p>}
    </div>
  )
}

function Review({ c, r, set, next }) {
  const cessClaimed = num(c.v.claimed_cess) > 0
  const fields = fieldsFor(c.cat)
  const title = c.cat === 'T1' ? 'Rule 89(5) working' : R89_4.includes(c.cat) ? 'Rule 89(4) working' : 'Working'
  return (
    <div className={styles.split}>
      <div className={styles.left}>
        {GROUPS.filter(g => (g.key !== 'cess' || cessClaimed) && fields.some(f => f.group === g.key)).map(g => (
          <section key={g.key} className={styles.panel}>
            <h3 className={styles.h3}>{g.label}</h3>
            <div className={styles.fields}>{fields.filter(f => f.group === g.key).map(f => <Field key={f.key} f={f} c={c} set={set} />)}</div>
          </section>
        ))}
        {!!tablesFor(c.cat).length && (
          <section className={styles.panel}>
            <h3 className={styles.h3}>Tables of the order</h3>
            {tablesFor(c.cat).map(t => (
              <Rows key={t.key} title={t.label} cols={t.cols} rows={c.rows[t.key] || []} onChange={rows => set(cc => ({ ...cc, rows: { ...cc.rows, [t.key]: rows } }))} />
            ))}
          </section>
        )}
        <section className={styles.panel}>
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
      <aside className={styles.right}>
        <section className={`${styles.panel} ${styles.sticky}`}>
          <h3 className={styles.h3}>{title}</h3>
          <Working c={c} r={r} />
          <h3 className={styles.h3}>Checks</h3>
          <Flags r={r} />
          <button className={`${styles.btn} ${styles.primary}`} onClick={next}>{r.rejecting ? 'Next: notice and findings' : 'Next: the order'}</button>
        </section>
      </aside>
    </div>
  )
}

// Grounds to start the notice from: the rows the checks left out (where each row is an amount
// of the refund), or the gap between what was claimed and what the working allows. The officer
// edits every word before the notice goes.
function suggestGrounds(c, r) {
  const out = []
  if (['T5', 'T6', 'T7'].includes(c.cat)) {
    for (const x of r.left) out.push({ title: x.label, text: `${x.label}: ${x.why.join('; ')}. ${blank('the facts found and the provision relied on')}`, amount: x.amount })
  }
  const covered = out.reduce((a, g) => a + (g.amount || 0), 0)
  if (r.total.rejected - covered > 1) {
    const law = c.cat === 'T1' ? 'rule 89(5)' : R89_4.includes(c.cat) ? 'rule 89(4)' : 'section 54'
    const why = R89_4.includes(c.cat) && r.left.length ? ` The following were left out of the zero-rated turnover: ${r.left.map(x => `${x.label} (₹${inr(x.amount)}: ${x.why.join('; ')})`).join('; ')}.` : ''
    out.push({ title: 'Refund claimed exceeds the amount admissible', text: `The refund admissible under ${law} works out to ₹${inr(r.total.admissible)} against ₹${inr(r.total.claimed)} claimed.${why} ${blank('the working and the provision relied on')}`, amount: r.total.rejected - covered })
  }
  if (r.total.excess > 0) out.push({ title: 'Provisional refund paid in excess', text: `The provisional refund of ₹${inr(r.total.prov)} paid by RFD-05 exceeds the amount admissible, ₹${inr(r.total.admissible)}, by ₹${inr(r.total.excess)}, which is proposed for recovery with interest under section 50.`, amount: 0 })
  return out
}
const blank = (what) => `⟦${what}⟧`

async function saveWord(blocks, name, title) {
  const { orderToWord } = await import('../lib/refund/word')
  const blob = await orderToWord(blocks, undefined, { title })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${name.replace(/[^\w .-]/g, '')}.docx`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 10000)
}

// ── 3. Notice ──
function Notice({ c, r, set, next }) {
  const n = c.notice
  const putN = (k, x) => set(cc => ({ ...cc, notice: { ...cc.notice, [k]: x } }))
  const putG = (i, k, x) => set(cc => ({ ...cc, grounds: cc.grounds.map((g, j) => j === i ? { ...g, [k]: x } : g) }))
  const [busy, setBusy] = useState(-1)
  const [making, setMaking] = useState(false)
  const [preview, setPreview] = useState(false)
  const period = c.v.from ? `${monthName(c.v.from)}${c.v.to && c.v.to !== c.v.from ? ` to ${monthName(c.v.to)}` : ''}` : ''
  const facts = `${CATS[c.cat].label} refund${period ? ` for ${period}` : ''}; claimed ₹${inr(r.total?.claimed)}, admissible on the working ₹${inr(r.total?.admissible)}.`
  const polish = async (i) => {
    const g = c.grounds[i]
    setBusy(i)
    const res = await polishFinding({ facts, ground: `${g.title ? `${g.title}. ` : ''}${g.text}`, reply: g.reply, verified: g.verified, finding: `${{ rejected: 'Not accepted', accepted: 'Accepted', partly: 'Partly accepted' }[g.outcome] || ''}. ${g.finding}` })
    setBusy(-1)
    if (res.error) return toast.error(res.why || "Claude couldn't write it. Try again.")
    putG(i, 'para', res.para)
  }
  const missing = r.rejecting ? noticeReady(c, r) : []
  const blocks = useMemo(() => r.rejecting && preview ? buildNotice(c, r) : null, [c, r, preview])
  const download = async () => {
    setMaking(true)
    try { await saveWord(buildNotice(c, r), `RFD-08 ${c.v.arn || CATS[c.cat].short}`, 'Notice (RFD-08)') }
    catch { toast.error("Couldn't make the Word file. Try again.") }
    setMaking(false)
  }

  if (!r.rejecting) return (
    <section className={styles.panel}>
      <p className={styles.note}>The whole claim is admissible on the figures in Review, so no RFD-08 notice is needed. The order will say so.</p>
      <button className={`${styles.btn} ${styles.primary}`} onClick={next}>Next: the order</button>
    </section>
  )
  const field = (k, label, type = 'text', extra = {}) => <label className={styles.field}><span className={styles.label}>{label}</span><input type={type} value={n[k] || ''} onChange={e => putN(k, e.target.value)} {...extra} /></label>
  return (
    <div className={styles.stack}>
      <section className={styles.panel}>
        <div className={styles.warn}><Gavel size={16} /><p>{r.total.rejected ? `₹${inr(r.total.rejected)} would be rejected` : ''}{r.total.rejected && r.total.excess ? ' and ' : ''}{r.total.excess ? `₹${inr(r.total.excess)} of provisional refund recovered` : ''}. Rule 92(3) allows that only on grounds put to the applicant in an RFD-08 notice, after a reply and a hearing. Write the grounds below and download the notice. When the reply and hearing are over, come back and record your finding on each ground.</p></div>
        <h3 className={styles.h3}>The notice</h3>
        <div className={styles.fields}>
          {field('no', 'RFD-08 No.')}
          {field('date', 'RFD-08 date', 'date')}
          {field('rfn', 'RFN from the portal')}
          {field('hearing', 'Personal hearing date', 'date')}
          {field('time', 'Hearing time', 'text', { placeholder: '11:00 AM' })}
          {!!r.total.excess && field('drc01', 'DRC-01 summary (No. and date)')}
          {!!r.total.excess && (
            <label className={styles.field}><span className={styles.label}>Recovery under section</span>
              <select value={n.recovery_sec || ''} onChange={e => putN('recovery_sec', e.target.value)}><option value="">—</option><option>73</option><option>74</option><option>74A</option></select>
            </label>
          )}
        </div>
        <label className={styles.field}><span className={styles.label}>Documents relied on in the notice</span><textarea rows={2} value={n.relied || ''} onChange={e => putN('relied', e.target.value)} /></label>
        {!c.grounds.length && (
          <div className={styles.actions}>
            <button className={styles.btn} onClick={() => set(cc => ({ ...cc, grounds: suggestGrounds(cc, r) }))}><Wand2 size={14} />Start from the checks</button>
            <button className={styles.btn} onClick={() => set(cc => ({ ...cc, grounds: [{}] }))}><Plus size={14} />Write a ground</button>
          </div>
        )}
      </section>
      {c.grounds.map((g, i) => (
        <section key={i} className={styles.panel}>
          <div className={styles.rowsHead}><h3 className={styles.h3}>Ground {i + 1}</h3><button className={styles.icon} aria-label="Delete ground" onClick={() => set(cc => ({ ...cc, grounds: cc.grounds.filter((_, j) => j !== i) }))}><Trash2 size={15} /></button></div>
          <label className={styles.field}><span className={styles.label}>Title</span><input value={g.title || ''} onChange={e => putG(i, 'title', e.target.value)} /></label>
          <label className={styles.field}><span className={styles.label}>Ground as stated in the notice, with figures and the provision</span><textarea rows={3} value={g.text || ''} onChange={e => putG(i, 'text', e.target.value)} /></label>
          <div className={styles.fields}>
            <label className={styles.field}><span className={styles.label}>Amount proposed for rejection (₹)</span><input inputMode="decimal" value={g.amount ?? ''} onChange={e => putG(i, 'amount', e.target.value.replace(/[^\d.]/g, ''))} /></label>
          </div>
          <h3 className={styles.h3}>After the reply and the hearing</h3>
          <div className={styles.fields}>
            <label className={styles.field}><span className={styles.label}>Your decision</span>
              <select value={g.outcome || ''} onChange={e => putG(i, 'outcome', e.target.value)}><option value="">—</option><option value="rejected">Not accepted (reject)</option><option value="partly">Partly accepted</option><option value="accepted">Accepted (drop the ground)</option></select>
            </label>
            <label className={styles.field}><span className={styles.label}>Effect on refund (₹)</span><input value={g.effect ?? ''} onChange={e => putG(i, 'effect', e.target.value)} /></label>
          </div>
          <label className={styles.field}><span className={styles.label}>Applicant's reply / submission at hearing</span><textarea rows={2} value={g.reply || ''} onChange={e => putG(i, 'reply', e.target.value)} /></label>
          <label className={styles.field}><span className={styles.label}>What you verified, against which record</span><textarea rows={2} value={g.verified || ''} onChange={e => putG(i, 'verified', e.target.value)} /></label>
          <label className={styles.field}><span className={styles.label}>Your finding and the provision relied on</span><textarea rows={3} value={g.finding || ''} onChange={e => putG(i, 'finding', e.target.value)} /></label>
          <div className={styles.actions}>
            <button className={styles.btn} disabled={busy === i || !g.finding?.trim()} onClick={() => polish(i)}><Wand2 size={14} />{busy === i ? 'Writing…' : g.para ? 'Write it up again' : 'Write it up with Claude'}</button>
          </div>
          {g.para !== undefined && (
            <label className={styles.field}><span className={styles.label}>Paragraph for the order (edit freely; Claude keeps your decision and figures)</span><textarea rows={6} value={g.para} onChange={e => putG(i, 'para', e.target.value)} /></label>
          )}
        </section>
      ))}
      <section className={styles.panel}>
        <h3 className={styles.h3}>Reply and hearing</h3>
        <div className={styles.fields}>
          {field('reply', 'Reply (RFD-09) date, if any', 'date')}
          {field('attended', 'Attended by (designation, not name)', 'text', { placeholder: 'the authorised representative' })}
          {field('docs', 'Documents filed with the reply')}
        </div>
      </section>
      <div className={styles.actions}>
        {!!c.grounds.length && <button className={styles.btn} onClick={() => set(cc => ({ ...cc, grounds: [...cc.grounds, {}] }))}><Plus size={14} />Add a ground</button>}
        <button className={styles.btn} disabled={making || missing.length > 0} onClick={download}><Download size={14} />{making ? 'Making…' : 'Download the RFD-08 notice'}</button>
        <button className={styles.btn} disabled={missing.length > 0} onClick={() => setPreview(x => !x)}><FileText size={14} />{preview ? 'Hide the notice' : 'Show the notice'}</button>
        <button className={`${styles.btn} ${styles.primary}`} onClick={next}>Next: the order</button>
      </div>
      {!!missing.length && <p className={styles.note}>Before the notice can be made: {missing.join('; ')}.</p>}
      {blocks && <section className={styles.panel}><Preview blocks={blocks} /></section>}
      <Flags r={{ flags: r.flags.filter(f => f.law === 'rule 92(3)' || /DRC-01/.test(f.text)) }} />
    </div>
  )
}

// ── 4. Order ──
function Order({ c, r, set }) {
  const o = c.order
  const putO = (k, x) => set(cc => ({ ...cc, order: { ...cc.order, [k]: x } }))
  const [making, setMaking] = useState(false)
  const blocks = useMemo(() => r.ready ? buildOrder(c, r) : null, [c, r])
  const todo = blocks ? blanks(blocks) : []
  const stops = r.flags.filter(f => f.level === 'stop')
  const shown = HEADS.filter(h => r.heads?.[h]?.admissible > 0)

  const download = async () => {
    setMaking(true)
    try { await saveWord(blocks, `RFD-06 ${c.v.arn || CATS[c.cat].short}`, 'Refund order (RFD-06)') }
    catch { toast.error("Couldn't make the Word file. Try again.") }
    setMaking(false)
  }

  return (
    <div className={styles.stack}>
      <section className={styles.panel}>
        <div className={styles.fields}>
          <label className={styles.field}><span className={styles.label}>Order No.</span><input value={o.no} onChange={e => putO('no', e.target.value)} /></label>
          <label className={styles.field}><span className={styles.label}>Order date</span><input type="date" value={o.date} onChange={e => putO('date', e.target.value)} /></label>
          <label className={styles.field}><span className={styles.label}>RFN from the portal</span><input value={o.rfn} onChange={e => putO('rfn', e.target.value)} /></label>
          <label className={styles.field}><span className={styles.label}>Range</span><input value={o.range} onChange={e => putO('range', e.target.value)} /></label>
          <label className={styles.field}><span className={styles.label}>Dues under s.54(10) checked on</span><input type="date" value={o.dues} onChange={e => putO('dues', e.target.value)} /></label>
        </div>
        {!!shown.length && <>
          <h3 className={styles.h3}>Adjusted against confirmed dues (s.54(10)(b)), if any</h3>
          <div className={styles.fields}>
            <label className={styles.field}><span className={styles.label}>Demand ID or order</span><input value={o.adj_ref || ''} onChange={e => putO('adj_ref', e.target.value)} /></label>
            {shown.map(h => (
              <label key={h} className={styles.field}><span className={styles.label}>{HEAD_LABEL[h]} adjusted (₹)</span><input inputMode="decimal" value={o[`adj_${h}`] ?? ''} onChange={e => putO(`adj_${h}`, e.target.value.replace(/[^\d.]/g, ''))} /></label>
            ))}
          </div>
        </>}
      </section>
      {!r.ready && (
        <section className={styles.panel}>
          <h3 className={styles.h3}>Settle these before the order can be made</h3>
          <Flags r={{ flags: stops }} />
        </section>
      )}
      {blocks && (
        <section className={styles.panel}>
          {todo.length
            ? <p className={styles.note}>Still to fill in (yellow in the Word file): {todo.join('; ')}.</p>
            : <p className={styles.note}>Nothing left blank. Read it through before you sign.</p>}
          <div className={styles.actions}>
            <button className={`${styles.btn} ${styles.primary}`} disabled={making} onClick={download}><Download size={14} />{making ? 'Making…' : 'Download Word file'}</button>
          </div>
          <Preview blocks={blocks} />
        </section>
      )}
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
