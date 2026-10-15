// Refund Desk: the speaking order (FORM GST RFD-06) for each refund category, built from the
// office's templates T1 to T8 with the facts the officer confirmed and the figures from compute.js.
// The result is a list of blocks that word.js turns into the letterhead .docx and the review screen
// previews. What all orders share is in order-kit.js; each category's paragraphs are in order-tN.js.
import { OFFICE } from './order-kit.js'
import { buildT1 } from './order-t1.js'

export { OFFICE }

const BUILDERS = { T1: buildT1 }

export function buildOrder(c, r, office = OFFICE) {
  const build = BUILDERS[c.cat || 'T1']
  if (!build) throw new Error(`No order template for ${c.cat} yet`)
  return build(c, r, office)
}

// Everything still to fill in, so the screen can list it before the Word file goes out
export const blanks = (blocks) => {
  const all = []
  const scan = (t) => { for (const m of String(t).matchAll(/⟦([^⟧]*)⟧/g)) all.push(m[1].trim() || 'a blank') }
  for (const b of blocks) {
    if (b.text) scan(b.text)
    b.lines?.forEach(scan)
    b.rows?.forEach(rw => rw.forEach(scan))
    b.head?.forEach(scan)
    b.items?.forEach(scan)
  }
  return [...new Set(all)]
}
