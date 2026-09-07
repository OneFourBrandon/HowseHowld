// Generates every artboard for the HowseHowld redesign canvas ("Night" direction).
//   node design/ledger/build.mjs
// Writes *.dc.html and canvas.json to ./artboards, then seed them with the
// design canvas helper (see README.md).
import { writeFileSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { overview, chores, money, calendar, driveway, settings } from './screens-desktop.mjs'
import { signIn, mobileOverview, mobileChores, mobileMoney, addPurchase, designSystem } from './screens-more.mjs'
import { motion, commandPalette } from './screens-motion.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, 'artboards')
mkdirSync(out, { recursive: true })
for (const f of readdirSync(out)) if (f.endsWith('.dc.html')) unlinkSync(join(out, f))

// Row origins (canvas px). Rows are spaced by the tallest frame in the row + 160.
const R2 = 1220, R3 = 2980, R4 = 4440
const boards = [
  { file: 'Main.dc.html', title: 'Overview', html: overview(), x: 0, y: 0, w: 1440, h: 1000 },
  { file: 'Chores.dc.html', html: chores(), x: 1540, y: 0, w: 1440, h: 1060 },
  { file: 'Money.dc.html', html: money(), x: 3080, y: 0, w: 1440, h: 1010 },
  { file: 'Calendar.dc.html', html: calendar(), x: 0, y: R2, w: 1440, h: 1190 },
  { file: 'Driveway.dc.html', html: driveway(), x: 1540, y: R2, w: 1440, h: 690 },
  { file: 'Settings.dc.html', html: settings(), x: 3080, y: R2, w: 1440, h: 1600 },
  { file: 'SignIn.dc.html', title: 'Sign in', html: signIn(), x: 0, y: R3, w: 1440, h: 900 },
  { file: 'MobileOverview.dc.html', title: 'Overview · phone', html: mobileOverview(), x: 1540, y: R3, w: 390, h: 844 },
  { file: 'MobileChores.dc.html', title: 'Chores · phone', html: mobileChores(), x: 2010, y: R3, w: 390, h: 844 },
  { file: 'MobileMoney.dc.html', title: 'Money · phone', html: mobileMoney(), x: 2480, y: R3, w: 390, h: 844 },
  { file: 'AddPurchase.dc.html', title: 'Add purchase', html: addPurchase(), x: 2950, y: R3, w: 760, h: 1300 },
  { file: 'CommandPalette.dc.html', title: 'Command palette · proposed', html: commandPalette(), x: 3790, y: R3, w: 760, h: 600 },
  { file: 'DesignSystem.dc.html', title: 'Design system', html: designSystem(), x: 0, y: R4, w: 1440, h: 1700 },
  { file: 'Motion.dc.html', title: 'Motion · micro-interactions', html: motion(), x: 1540, y: R4, w: 1440, h: 2380 },
]

for (const b of boards) writeFileSync(join(out, b.file), b.html)

const canvas = {
  artboards: boards.map(({ file, title, x, y, w, h }) => ({ file, ...(title ? { title } : {}), x, y, w, h })),
  annotations: [
    {
      id: 'night-brief',
      x: 0, y: -200, w: 600,
      text: 'NIGHT · the direction from your reference, built for HowseHowld\nCharcoal ground, stacked cards with 20px radii, pill navigation top-centre, Manrope everywhere. Hot pink means “yours”, electric blue means “the house”, green and red are money, amber is a bill, violet is a class.\n\nThe Overview mirrors the reference’s anatomy with real house data: greeting, progress pills, three big figures, Summary, the Spending chart with a tooltip, the blue “Rent is due Tuesday” card with stacked white rows, Active chores cards, the bubble stats and a “What needs doing?” panel with search.\n\nRow 1: Overview, Chores, Money. Row 2: Calendar, Driveway, Settings. Row 3: Sign in, three phone screens, Add purchase, a proposed ⌘K palette. Row 4: the design system sheet and the Motion sheet, where twelve micro-interactions loop live. Every screen reveals in sequence when opened.',
    },
  ],
  launch: { view: 'canvas' },
}

writeFileSync(join(out, 'canvas.json'), JSON.stringify(canvas, null, 2))
console.log(`wrote ${boards.length} artboards + canvas.json to ${out}`)
