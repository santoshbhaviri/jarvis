// Refund Desk: inverted-duty refunds (template T1), from the claim's documents to the order.
//   1 Documents  Claude reads each document into the case's fields, noting the page
//   2 Review     you check every figure against its source; the rule 89(5) arithmetic and the
//                checks are plain code (src/lib/refund/compute.js) and update as you type
//   3 Notice     only when part of the claim is to be rejected: the RFD-08 grounds and your findings
//   4 Order      the RFD-06 speaking order as a Word file on the letterhead, for you to sign
// You decide every figure and every ground; nothing is filed anywhere. The case lives only in this
// open window (not on the phone, not on the server) and is gone when Jarvis is closed.
import { useState, useEffect, useMemo, useRef } from 'react'
import toast from 'react-hot-toast'
import { FileUp, Calculator, Gavel, FileText, RotateCcw, Plus, Trash2, Download, Wand2, CircleAlert, TriangleAlert, Info, Check } from 'lucide-react'
import { FIELDS, GROUPS, FIELD, HEAD_LABEL, HEADS, CONFIRMS, INPUT_COLS, OUTPUT_COLS, emptyCase } from '../lib/refund/fields'
import { compute, inr, ddmmyyyy, monthName, num } from '../lib/refund/compute'
import { mergeRead } from '../lib/refund/merge'
import { buildOrder, blanks } from '../lib/refund/order'
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
          <p className={styles.sub}>Inverted duty structure · s.54(3)(ii), rule 89(5) · order on template T1</p>
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
        const res = await readRefundDoc(file.name, pages)
        if (res.error) throw new Error(res.why || "Claude couldn't read it. Try again.")
        setState(s => ({ ...s, c: mergeRead(s.c, res, file.name).c }))
        setDoc(file.name, {
          status: 'done', kind: res.kind, found: (res.fields || []).length,
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
      <p className={styles.note}>Add the claim's documents: RFD-01 with Statement 1 and Annexure-B, GSTR-1, GSTR-3B and GSTR-2B of the period, the credit ledger, RFD-02 and RFD-04. PDFs (scanned pages too), photos or text.</p>
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
              <small>{d.status === 'done' ? `${d.kind}: ${d.found} figures` : d.status === 'error' ? '' : d.status}{d.note ? ` · ${d.note}` : ''}</small>
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
      {!rows.length && <p className={styles.note}>No rows yet. They come from Annexure-B or GSTR-1 when Claude finds rate-wise totals.</p>}
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

function Working({ c, r }) {
  const s = r.steps
  if (!s) return <p className={styles.note}>The working appears here once A to E are filled in.</p>
  const v = c.v
  return (
    <div className={styles.working}>
      <div className={styles.wRow}><span>(i) A × C ÷ B</span><b>{inr(s.i, 2)}</b></div>
      <div className={styles.wRow}><span>(ii) C ÷ D (not rounded)</span><b>{s.ratio.toFixed(6)}</b></div>
      <div className={styles.wRow}><span>(iii) E × C ÷ D</span><b>{inr(s.iii, 2)}</b></div>
      <div className={styles.wRow}><span>(iv) Maximum refund</span><b>{inr(s.maxRefund)}</b></div>
      <div className={styles.wRow}><span>(v) Ledger at end of period</span><b>{s.end === null ? '—' : inr(s.end)}</b></div>
      <div className={styles.wRow}><span>(vi) Ledger at filing</span><b>{s.atFiling === null ? '—' : inr(s.atFiling)}</b></div>
      <div className={`${styles.wRow} ${styles.total}`}><span>Admissible</span><b>₹{inr(r.total.admissible)}</b></div>
      <div className={styles.wRow}><span>Claimed</span><b>₹{inr(r.total.claimed)}</b></div>
      <div className={styles.wRow}><span>To be rejected</span><b className={r.total.rejected ? styles.red : ''}>₹{inr(r.total.rejected)}</b></div>
      <table className={styles.heads}>
        <thead><tr><th /><th>Claimed</th><th>Admissible</th><th>Provisional</th><th>Net now</th><th>Rejected</th></tr></thead>
        <tbody>{HEADS.filter(h => h !== 'cess' || r.heads.cess.claimed).map(h => (
          <tr key={h}><th>{HEAD_LABEL[h]}</th>{['claimed', 'admissible', 'prov', 'net', 'rejected'].map(k => <td key={k}>{inr(r.heads[h][k])}</td>)}</tr>
        ))}</tbody>
      </table>
      {!!r.limitation.length && (
        <p className={styles.note}>Two years: {r.limitation.map(m => `${monthName(m.month)} until ${ddmmyyyy(m.ends)}${m.inTime === false ? ' (late)' : ''}`).join('; ')}.
          {r.sixty && ` Sixty days end ${ddmmyyyy(r.sixty)}${r.daysLeft >= 0 ? ` (${r.daysLeft} days left)` : ''}.`}</p>
      )}
      {v.from && <p className={styles.note}>Period: {monthName(v.from)}{v.to && v.to !== v.from ? ` to ${monthName(v.to)}` : ''}</p>}
    </div>
  )
}

function Review({ c, r, set, next }) {
  const cessClaimed = num(c.v.claimed_cess) > 0
  return (
    <div className={styles.split}>
      <div className={styles.left}>
        {GROUPS.filter(g => g.key !== 'cess' || cessClaimed).map(g => (
          <section key={g.key} className={styles.panel}>
            <h3 className={styles.h3}>{g.label}</h3>
            <div className={styles.fields}>{FIELDS.filter(f => f.group === g.key).map(f => <Field key={f.key} f={f} c={c} set={set} />)}</div>
          </section>
        ))}
        <section className={styles.panel}>
          <h3 className={styles.h3}>Rate-wise tables (Tables 1 and 2 of the order)</h3>
          <Rows title="Table 1: inputs" cols={INPUT_COLS} rows={c.inputs} onChange={rows => set(cc => ({ ...cc, inputs: rows }))} />
          <Rows title="Table 2: outward supplies" cols={OUTPUT_COLS} rows={c.outputs} onChange={rows => set(cc => ({ ...cc, outputs: rows }))} />
        </section>
        <section className={styles.panel}>
          <h3 className={styles.h3}>Your checks</h3>
          <p className={styles.note}>Tick what you have verified. Anything not ticked stays as a yellow blank in the order.</p>
          <ul className={styles.confirms}>
            {CONFIRMS.map(x => (
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
          <h3 className={styles.h3}>Rule 89(5) working</h3>
          <Working c={c} r={r} />
          <h3 className={styles.h3}>Checks</h3>
          <Flags r={r} />
          <button className={`${styles.btn} ${styles.primary}`} onClick={next}>{r.rejecting ? 'Next: notice and findings' : 'Next: the order'}</button>
        </section>
      </aside>
    </div>
  )
}

// ── 3. Notice ──
function Notice({ c, r, set, next }) {
  const n = c.notice
  const putN = (k, x) => set(cc => ({ ...cc, notice: { ...cc.notice, [k]: x } }))
  const putG = (i, k, x) => set(cc => ({ ...cc, grounds: cc.grounds.map((g, j) => j === i ? { ...g, [k]: x } : g) }))
  const [busy, setBusy] = useState(-1)
  const facts = `Inverted duty refund for ${monthName(c.v.from)}${c.v.to && c.v.to !== c.v.from ? ` to ${monthName(c.v.to)}` : ''}; outputs ${c.v.outward || ''} at ${c.v.output_rate ?? '?'}%, inputs ${c.v.inputs || ''} at ${c.v.input_rate ?? '?'}%; claimed ₹${inr(r.total?.claimed)}, admissible ₹${inr(r.total?.admissible)}.`
  const polish = async (i) => {
    const g = c.grounds[i]
    setBusy(i)
    const res = await polishFinding({ facts, ground: g.text, reply: g.reply, verified: g.verified, finding: `${{ rejected: 'Not accepted', accepted: 'Accepted', partly: 'Partly accepted' }[g.outcome] || ''}. ${g.finding}` })
    setBusy(-1)
    if (res.error) return toast.error(res.why || "Claude couldn't write it. Try again.")
    putG(i, 'para', res.para)
  }

  if (!r.rejecting) return (
    <section className={styles.panel}>
      <p className={styles.note}>The whole claim is admissible on the figures in Review, so no RFD-08 notice is needed. The order will say so.</p>
      <button className={`${styles.btn} ${styles.primary}`} onClick={next}>Next: the order</button>
    </section>
  )
  return (
    <div className={styles.stack}>
      <section className={styles.panel}>
        <div className={styles.warn}><Gavel size={16} /><p>₹{inr(r.total.rejected)} would be rejected. Rule 92(3) allows that only on grounds put to the applicant in an RFD-08 notice, after a reply and a hearing. If the notice has not gone yet, issue it first (template N1; the Refund Desk will draft it in the next stage) and come back.</p></div>
        <div className={styles.fields}>
          <label className={styles.field}><span className={styles.label}>RFD-08 No.</span><input value={n.no} onChange={e => putN('no', e.target.value)} /></label>
          <label className={styles.field}><span className={styles.label}>RFD-08 date</span><input type="date" value={n.date} onChange={e => putN('date', e.target.value)} /></label>
          <label className={styles.field}><span className={styles.label}>Reply (RFD-09) date, if any</span><input type="date" value={n.reply} onChange={e => putN('reply', e.target.value)} /></label>
          <label className={styles.field}><span className={styles.label}>Personal hearing date</span><input type="date" value={n.hearing} onChange={e => putN('hearing', e.target.value)} /></label>
          <label className={styles.field}><span className={styles.label}>Attended by (designation, not name)</span><input value={n.attended} placeholder="the authorised representative" onChange={e => putN('attended', e.target.value)} /></label>
        </div>
      </section>
      {c.grounds.map((g, i) => (
        <section key={i} className={styles.panel}>
          <div className={styles.rowsHead}><h3 className={styles.h3}>Ground {i + 1}</h3><button className={styles.icon} aria-label="Delete ground" onClick={() => set(cc => ({ ...cc, grounds: cc.grounds.filter((_, j) => j !== i) }))}><Trash2 size={15} /></button></div>
          <label className={styles.field}><span className={styles.label}>Ground as stated in the notice, with figures and the provision</span><textarea rows={3} value={g.text || ''} onChange={e => putG(i, 'text', e.target.value)} /></label>
          <div className={styles.fields}>
            <label className={styles.field}><span className={styles.label}>Amount proposed for rejection (₹)</span><input inputMode="decimal" value={g.amount ?? ''} onChange={e => putG(i, 'amount', e.target.value.replace(/[^\d.]/g, ''))} /></label>
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
      <div className={styles.actions}>
        <button className={styles.btn} onClick={() => set(cc => ({ ...cc, grounds: [...cc.grounds, {}] }))}><Plus size={14} />Add a ground</button>
        <button className={`${styles.btn} ${styles.primary}`} onClick={next}>Next: the order</button>
      </div>
      <Flags r={{ flags: r.flags.filter(f => f.law === 'rule 92(3)') }} />
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

  const download = async () => {
    setMaking(true)
    try {
      const { orderToWord } = await import('../lib/refund/word')
      const blob = await orderToWord(blocks)
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `RFD-06 ${(c.v.arn || 'inverted duty').replace(/[^\w -]/g, '')}.docx`
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 10000)
    } catch {
      toast.error("Couldn't make the Word file. Try again.")
    }
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
