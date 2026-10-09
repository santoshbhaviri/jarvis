// src/components/InsightsTab.jsx
// Productivity insights + weekly review, built from completed_at and routine_completions
import { useMemo, useState } from 'react'
import { format, parseISO, startOfWeek, addDays, subDays, getISOWeek } from 'date-fns'
import { todayStr, formatDisplay, getMonthDates } from '../lib/dateUtils'
import { QUADRANTS, quadrantOf } from '../lib/constants'
import { openTasks, byPriority } from '../lib/selectors'
import SectionHeader from './SectionHeader'
import styles        from './InsightsTab.module.css'

const ymd = (d) => format(d, 'yyyy-MM-dd')
const doneDay = (t) => ymd(new Date(t.completed_at))   // local calendar day it was finished

export default function InsightsTab({ catFilter, taskData }) {
  const { tasks, isRoutineDone } = taskData
  const [hover, setHover] = useState(null)
  const today = todayStr()

  const mine = useMemo(() =>
    tasks.filter(t => catFilter === 'all' || t.category === catFilter), [tasks, catFilter])
  const finished = mine.filter(t => t.status !== 'routine' && t.completed_at)

  // ── Finished per week, last 8 weeks (weeks start Monday) ──
  const thisWeek = startOfWeek(new Date(), { weekStartsOn: 1 })
  const weeks = Array.from({ length: 8 }, (_, i) => addDays(thisWeek, -7 * (7 - i)))
  const perWeek = weeks.map(w => {
    const from = ymd(w), to = ymd(addDays(w, 7))
    return finished.filter(t => { const d = doneDay(t); return d >= from && d < to }).length
  })
  const maxV  = Math.max(4, ...perWeek)
  const step  = maxV <= 8 ? 2 : maxV <= 20 ? 5 : 10
  const top   = Math.ceil(maxV / step) * step
  const W = 560, H = 190, L = 26, B = 24, T = 16
  const bw = (W - L - 8) / 8
  const y  = (v) => T + (H - T - B) * (1 - v / top)
  const ticks = []
  for (let v = 0; v <= top; v += step) ticks.push(v)

  // ── Where the effort went, last 30 days ──
  const since30 = ymd(subDays(new Date(), 29))
  const last30  = finished.filter(t => doneDay(t) >= since30)
  const qCounts = [1, 2, 3, 4].map(q => last30.filter(t => quadrantOf(t) === q).length)
  const qTotal  = qCounts.reduce((a, b) => a + b, 0)
  const pctImportant = qTotal ? Math.round((qCounts[0] + qCounts[1]) * 100 / qTotal) : 0

  // ── Routine consistency this month ──
  const monthDays = getMonthDates()
  const routines = mine.filter(t => t.status === 'routine').map(t => {
    const days = monthDays.filter(d => d >= (t.created_at || '').slice(0, 10))
    const done = days.filter(d => isRoutineDone(t.id, d)).length
    return { t, done, total: days.length, pct: days.length ? Math.round(done * 100 / days.length) : 0 }
  }).sort((a, b) => a.pct - b.pct)

  // ── Weekly review ──
  const weekFrom  = ymd(thisWeek)
  const doneWeek  = finished.filter(t => doneDay(t) >= weekFrom)
  const open      = openTasks(mine)
  const slipped   = open.filter(t => t.due_date && t.due_date < today || t.is_unfinished).sort(byPriority)
  const nextWeek  = open.filter(t => t.due_date && t.due_date >= today && t.due_date < ymd(addDays(thisWeek, 14))).sort((a, b) => a.due_date.localeCompare(b.due_date))
  const postponed = open.filter(t => (t.postponed || 0) >= 2).sort((a, b) => b.postponed - a.postponed).slice(0, 6)

  const diff = perWeek[7] - perWeek[6]

  return (
    <div>
      <SectionHeader label="Finished per week" accent="#6366f1" />
      <div className={styles.panel}>
        <svg className={styles.chart} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Scut-work and mission tasks finished per week, last 8 weeks">
          {ticks.map(v => (
            <g key={v}>
              <line className={styles.grid} x1={L} x2={W} y1={y(v)} y2={y(v)} />
              <text x={L - 6} y={y(v) + 4} textAnchor="end">{v}</text>
            </g>
          ))}
          {perWeek.map((v, i) => {
            const x = L + 8 + i * bw, w = bw - 14, h = y(0) - y(v), r = Math.min(4, h)
            const yy = y(v)
            return (
              <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => setHover(i)}>
                <rect x={x - 4} y={T} width={w + 8} height={H - T - B} fill="transparent" />
                {h > 0 && (
                  <path className={`${styles.bar} ${hover === i ? styles.barHover : ''}`}
                    d={`M${x},${y(0)} V${yy + r} Q${x},${yy} ${x + r},${yy} H${x + w - r} Q${x + w},${yy} ${x + w},${yy + r} V${y(0)} Z`} />
                )}
                {(hover === i || i === 7) && <text className={styles.val} x={x + w / 2} y={yy - 5} textAnchor="middle">{v}</text>}
                <text x={x + w / 2} y={H - 7} textAnchor="middle">{i === 7 ? 'This wk' : format(weeks[i], 'd MMM')}</text>
              </g>
            )
          })}
        </svg>
        <p className={styles.callout}>
          {hover !== null
            ? `Week of ${format(weeks[hover], 'd MMM')}: ${perWeek[hover]} finished.`
            : diff > 0
              ? `${perWeek[7]} finished this week, ${diff} more than last week.`
              : diff === 0
              ? `${perWeek[7]} finished this week, the same as last week.`
              : `${perWeek[7]} finished this week so far, against ${perWeek[6]} last week.`}
        </p>
      </div>

      <div className={styles.two}>
        <div>
          <SectionHeader label="Where the effort went" accent="#6366f1" />
          <div className={styles.panel}>
            {qTotal === 0 ? <p className={styles.callout}>Finish a few tasks and this shows where your time went (last 30 days).</p> : (
              <>
                <div className={styles.split} role="img" aria-label="Finished tasks by priority, last 30 days">
                  {qCounts.map((n, i) => n > 0 && (
                    <span key={i} style={{ width: `${n * 100 / qTotal}%`, background: QUADRANTS[i + 1].color }}
                      title={`${QUADRANTS[i + 1].label}: ${n}`} />
                  ))}
                </div>
                <div className={styles.legend}>
                  {[1, 2, 3, 4].map(q => (
                    <span key={q}><i style={{ background: QUADRANTS[q].color }} />{QUADRANTS[q].label} {qCounts[q - 1]}</span>
                  ))}
                </div>
                <p className={styles.callout}>
                  {pctImportant}% of what you finished in the last 30 days was important work.{' '}
                  {qCounts[1] < qCounts[0]
                    ? 'Most of it was firefighting. More time on Schedule tasks prevents tomorrow’s emergencies.'
                    : 'Good balance. Keep protecting time for Schedule tasks.'}
                </p>
              </>
            )}
          </div>
        </div>
        <div>
          <SectionHeader label="Routine consistency" accent="#06b6d4" />
          <div className={styles.panel}>
            {routines.length === 0 && <p className={styles.callout}>No routine tasks yet.</p>}
            {routines.map(({ t, done, total, pct }) => (
              <div key={t.id} className={styles.hbar}>
                <span className={styles.hName}>{t.title}</span>
                <span className={styles.track}><span className={styles.fill} style={{ width: `${pct}%` }} /></span>
                <span className={styles.hNum}>{done}/{total}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <SectionHeader label="Keeps getting postponed" count={postponed.length} accent="#ef4444" />
      <div className={styles.panel}>
        {postponed.length === 0 && <p className={styles.callout}>Nothing has been postponed twice. Well done.</p>}
        {postponed.length > 0 && <p className={styles.callout}>Break these into a smaller first step, delegate them, or drop them.</p>}
        <ul className={styles.rlist}>
          {postponed.map(t => <li key={t.id}><span>{t.title}</span><b>{t.postponed}×</b></li>)}
        </ul>
      </div>

      <h2 className={styles.reviewTitle}>Week {getISOWeek(new Date())} review <span>{format(thisWeek, 'd MMM')} – {format(addDays(thisWeek, 6), 'd MMM')}</span></h2>
      <p className={styles.reviewSub}>Ten minutes every Friday or Saturday. Go top to bottom.</p>

      <SectionHeader label="1. What got done" count={doneWeek.length} accent="#22c55e" />
      <ul className={styles.rlist}>
        {doneWeek.map(t => <li key={t.id}><span>✓ {t.title}</span><b>{format(new Date(t.completed_at), 'EEE')}</b></li>)}
        {doneWeek.length === 0 && <li className={styles.empty}>Nothing finished yet this week.</li>}
      </ul>

      <SectionHeader label="2. What slipped" count={slipped.length} accent="#f59e0b" />
      <ul className={styles.rlist}>
        {slipped.map(t => <li key={t.id}><span>{t.title}</span><b>{t.is_unfinished ? 'Unfinished' : formatDisplay(t.due_date)}</b></li>)}
        {slipped.length === 0 && <li className={styles.empty}>Nothing slipped. Excellent.</li>}
      </ul>
      {slipped.length > 0 && <p className={styles.reviewSub}>For each one, decide: finish it, extend it with 📅, or delete it in ⚙︎.</p>}

      <SectionHeader label="3. Coming up in the next two weeks" count={nextWeek.length} accent="#8b5cf6" />
      <ul className={styles.rlist}>
        {nextWeek.map(t => <li key={t.id}><span>{t.title}</span><b>{format(parseISO(t.due_date), 'EEE d MMM')}</b></li>)}
        {nextWeek.length === 0 && <li className={styles.empty}>Nothing dated yet.</li>}
      </ul>
    </div>
  )
}
