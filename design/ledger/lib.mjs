// Shared design system for the HowseHowld redesign canvas — "Night" direction.
// Deep charcoal ground, stacked cards with generous radii, pill navigation,
// Manrope throughout, hot pink + electric blue accents on top of the house's
// own member colours. Every artboard is generated from these tokens and
// components; run build.mjs to regenerate.

export const C = {
  // ground
  bg: '#0b0c0f',
  card: '#15161a',
  inner: '#1d1e23',
  raise: '#24252b',
  line: 'rgba(255,255,255,.07)',
  line2: 'rgba(255,255,255,.13)',
  // text
  text: '#f4f5f7',
  text2: '#b4b7bf',
  text3: '#80838c',
  text4: '#5b5e67',
  // accents
  pink: '#f2508c',
  pinkSoft: 'rgba(242,80,140,.16)',
  blue: '#3b6bff',
  blue2: '#2f62ff',
  blueSoft: 'rgba(59,107,255,.16)',
  green: '#3ddc97',
  greenSoft: 'rgba(61,220,151,.16)',
  red: '#ff5d5d',
  redSoft: 'rgba(255,93,93,.16)',
  amber: '#ffb454',
  amberSoft: 'rgba(255,180,84,.16)',
  violet: '#9b8cff',
  violetSoft: 'rgba(155,140,255,.16)',
  white: '#f4f5f7',
}
// Legacy aliases so the motion sheet keeps working with semantic names.
Object.assign(C, {
  paper: C.bg, sheet: C.card, sunk: C.inner,
  ink: C.text, ink2: C.text2, muted: C.text3, faint: C.text4,
  ever: C.blue, ever2: '#5a82ff', everSoft: C.blueSoft,
  brass: C.amber, brass2: C.amber, brassSoft: C.amberSoft,
  rust: C.red, rustSoft: C.redSoft,
  slate: C.violet, slateSoft: C.violetSoft,
  moss: C.green, mossSoft: C.greenSoft,
})

export const SANS = "'Manrope', 'Segoe UI', Helvetica, Arial, sans-serif"
export const SERIF = SANS
export const MONO = SANS

export const FONT_LINK =
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&amp;display=swap">'

export const CSS = `
:root{--ease-out:cubic-bezier(.2,.8,.2,1);--ease-spring:cubic-bezier(.34,1.56,.64,1);--ease-in-out:cubic-bezier(.65,0,.35,1)}
*{box-sizing:border-box}
body{margin:0;background:${C.bg};color:${C.text};font-family:${SANS};font-size:14px;line-height:1.5;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;font-feature-settings:"tnum" 1,"cv11" 1}
a{color:${C.text};text-decoration:none}
a:hover{color:#fff}
h1,h2,h3,h4,p,ul,ol{margin:0}
ul,ol{padding:0;list-style:none}
.serif,.display{font-family:${SANS};font-weight:800;letter-spacing:-.025em}
.mono,.fig{font-family:${SANS};font-variant-numeric:tabular-nums;font-weight:600}
.eyebrow{font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:${C.text3}}
.h1{font-weight:800;font-size:40px;line-height:1.05;letter-spacing:-.03em;color:${C.text}}
.h2{font-weight:700;font-size:20px;line-height:1.2;letter-spacing:-.015em;color:${C.text}}
.h3{font-size:14.5px;font-weight:700;line-height:1.3;color:${C.text};letter-spacing:-.005em}
.sub{color:${C.text3};font-size:14px}
.small{font-size:12.5px;color:${C.text3};line-height:1.45}
.tiny{font-size:11.5px;color:${C.text3};line-height:1.4}
.strong{font-weight:700;color:${C.text}}
.card,.sheet{background:${C.card};border:1px solid ${C.line};border-radius:20px;box-shadow:inset 0 1px 0 rgba(255,255,255,.035),0 20px 50px -30px rgba(0,0,0,.6);transition:border-color .2s var(--ease-out),transform .2s var(--ease-out)}
a.card:hover,a.sheet:hover{border-color:${C.line2};transform:translateY(-1px)}
.inner{background:${C.inner};border:1px solid ${C.line};border-radius:14px}
.blue-card{background:radial-gradient(120% 120% at 100% 0%,#4f7dff 0%,${C.blue2} 55%,#2653e6 100%);border:1px solid rgba(255,255,255,.18);border-radius:20px;color:#fff;box-shadow:inset 0 1px 0 rgba(255,255,255,.25),0 24px 60px -24px rgba(59,107,255,.55)}
.pink-card{background:radial-gradient(120% 120% at 100% 0%,#ff6aa0 0%,${C.pink} 55%,#d63b75 100%);border:1px solid rgba(255,255,255,.18);border-radius:20px;color:#fff;box-shadow:inset 0 1px 0 rgba(255,255,255,.25),0 24px 60px -24px rgba(242,80,140,.5)}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:38px;padding:0 16px;border-radius:999px;border:1px solid transparent;font-family:${SANS};font-weight:700;font-size:13.5px;line-height:1;color:${C.text};background:${C.inner};white-space:nowrap;cursor:pointer;transition:background-color .12s var(--ease-out),border-color .12s var(--ease-out),color .12s var(--ease-out),transform .12s var(--ease-out),box-shadow .12s var(--ease-out)}
.btn:hover{transform:translateY(-1px)}
.btn:active{transform:translateY(0) scale(.98);transition-duration:.08s}
.btn:focus-visible{outline:2px solid rgba(59,107,255,.6);outline-offset:2px}
.btn-primary{background:${C.white};color:${C.bg};border-color:${C.white}}
.btn-primary:hover{background:#fff;box-shadow:0 10px 24px -12px rgba(255,255,255,.35)}
.btn-pink{background:${C.pink};color:#fff;border-color:${C.pink}}
.btn-pink:hover{background:#ff5f98;box-shadow:0 10px 24px -12px rgba(242,80,140,.7)}
.btn-blue{background:${C.blue};color:#fff;border-color:${C.blue}}
.btn-blue:hover{background:#4f7bff;box-shadow:0 10px 24px -12px rgba(59,107,255,.7)}
.btn-secondary{background:${C.inner};border-color:${C.line2};color:${C.text}}
.btn-secondary:hover{background:${C.raise};border-color:rgba(255,255,255,.2)}
.btn-ghost{background:transparent;color:${C.text2}}
.btn-ghost:hover{background:rgba(255,255,255,.06);color:${C.text}}
.btn-danger{background:${C.redSoft};color:#ff8080;border-color:rgba(255,93,93,.3)}
.btn-danger:hover{background:rgba(255,93,93,.26)}
.btn-sm{height:32px;padding:0 12px;font-size:12.5px}
.btn-lg{height:46px;padding:0 22px;font-size:14.5px}
.btn-icon{width:40px;height:40px;padding:0;border-radius:999px;border:1px solid ${C.line2};background:${C.card};color:${C.text2}}
.btn-icon:hover{border-color:rgba(255,255,255,.22);color:${C.text}}
.pill{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 12px;border-radius:999px;background:${C.inner};border:1px solid ${C.line};color:${C.text};font-weight:600;font-size:12.5px;white-space:nowrap}
.pill-white{background:${C.white};color:${C.bg};border-color:${C.white}}
.pill-pink{background:${C.pink};color:#fff;border-color:transparent}
.pill-blue{background:${C.blue};color:#fff;border-color:transparent}
.pill-ghost{background:transparent;color:${C.text2}}
.badge{display:inline-flex;align-items:center;gap:5px;height:24px;padding:0 9px;border-radius:999px;background:${C.inner};border:1px solid ${C.line};color:${C.text2};font-weight:700;font-size:11.5px;letter-spacing:.01em;white-space:nowrap}
.badge-moss,.badge-green{background:${C.greenSoft};color:${C.green};border-color:rgba(61,220,151,.25)}
.badge-brass,.badge-amber{background:${C.amberSoft};color:${C.amber};border-color:rgba(255,180,84,.25)}
.badge-rust,.badge-red{background:${C.redSoft};color:#ff8080;border-color:rgba(255,93,93,.25)}
.badge-slate,.badge-violet{background:${C.violetSoft};color:${C.violet};border-color:rgba(155,140,255,.25)}
.badge-ever,.badge-blue{background:${C.blue};color:#fff;border-color:transparent}
.badge-pink{background:${C.pink};color:#fff;border-color:transparent}
.badge-white{background:${C.white};color:${C.bg};border-color:transparent}
.chip{display:inline-flex;align-items:center;gap:3px;height:20px;padding:0 6px;border-radius:999px;font-size:10.5px;font-weight:800;color:#fff}
.avatar{display:inline-flex;align-items:center;justify-content:center;border-radius:999px;font-family:${SANS};font-weight:800;letter-spacing:-.01em;box-shadow:0 0 0 2px ${C.card};flex:0 0 auto;user-select:none;line-height:1}
.tile{display:grid;place-items:center;width:40px;height:40px;border-radius:12px;flex:0 0 auto}
.field{display:grid;gap:7px;font-size:12.5px;font-weight:600;color:${C.text2};min-width:0}
.input{height:42px;padding:0 14px;border:1px solid ${C.line2};border-radius:12px;background:${C.inner};color:${C.text};font-family:${SANS};font-weight:500;font-size:14px;display:flex;align-items:center;gap:8px;min-width:0;transition:border-color .12s var(--ease-out),box-shadow .12s var(--ease-out)}
.input .ph{color:${C.text4}}
.input:hover{border-color:rgba(255,255,255,.2)}
.input.focus{border-color:${C.blue};box-shadow:0 0 0 3px ${C.blueSoft}}
.input.textarea{height:auto;min-height:96px;align-items:flex-start;padding:10px 14px}
.input.round{border-radius:999px}
.check{display:grid;place-items:center;width:18px;height:18px;border-radius:6px;border:1px solid ${C.line2};background:${C.inner};flex:0 0 auto;transition:background-color .15s var(--ease-out),border-color .15s var(--ease-out)}
.check.on{background:${C.white};border-color:${C.white};color:${C.bg}}
.radio{width:18px;height:18px;border-radius:999px;border:1.5px solid ${C.line2};background:${C.inner};flex:0 0 auto;display:grid;place-items:center}
.radio.on{border-color:${C.white}}
.radio.on i{display:block;width:9px;height:9px;border-radius:999px;background:${C.white}}
.toggle{width:42px;height:24px;border-radius:999px;background:${C.raise};border:1px solid ${C.line};padding:3px;display:flex;flex:0 0 auto;transition:background-color .2s var(--ease-out)}
.toggle i{display:block;width:16px;height:16px;border-radius:999px;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.4);transition:transform .22s var(--ease-spring)}
.toggle.on{background:${C.green};border-color:transparent}
.toggle.on i{transform:translateX(18px)}
.hr{height:1px;background:${C.line}}
.dot{display:inline-block;width:8px;height:8px;border-radius:999px;flex:0 0 auto}
.link{font-weight:700;font-size:13px;color:${C.text};display:inline-flex;align-items:center;gap:6px}
.link:hover{color:#fff}
.pos{color:${C.green}}
.neg{color:#ff7a7a}
.progress{position:relative;display:flex;align-items:center;height:32px;border-radius:999px;background:${C.inner};border:1px solid ${C.line};overflow:hidden;font-weight:700;font-size:12.5px}
.progress>i{position:absolute;left:0;top:0;bottom:0;border-radius:999px}
.progress>span{position:relative;padding:0 14px}
.hatch{background-image:repeating-linear-gradient(135deg,rgba(255,255,255,.16) 0 3px,transparent 3px 9px)}
.nav-pill{display:inline-flex;align-items:center;gap:2px;padding:4px;border-radius:999px;background:${C.card};border:1px solid ${C.line}}
.nav-item{display:inline-flex;align-items:center;gap:8px;height:36px;padding:0 18px;border-radius:999px;color:${C.text2};font-weight:600;font-size:13.5px;transition:background-color .15s var(--ease-out),color .15s var(--ease-out)}
.nav-item:hover{color:${C.text};background:rgba(255,255,255,.04)}
.nav-item.on{background:${C.raise};color:${C.text};box-shadow:inset 0 1px 0 rgba(255,255,255,.06),0 1px 2px rgba(0,0,0,.4)}
.rowh{border-radius:12px;margin-left:-10px;margin-right:-10px;padding-left:10px;padding-right:10px;transition:background-color .12s var(--ease-out)}
.rowh:hover{background:rgba(255,255,255,.035)}
.kbd{display:inline-flex;align-items:center;justify-content:center;min-width:20px;height:20px;padding:0 6px;border:1px solid ${C.line2};border-bottom-width:2px;border-radius:6px;background:${C.raise};color:${C.text2};font-size:10.5px;font-weight:700;line-height:1}
.tab{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;flex:1;height:52px;border-radius:999px;color:${C.text3};font-size:10px;font-weight:700;transition:color .15s var(--ease-out),transform .15s var(--ease-out),background-color .15s var(--ease-out)}
.tab.on{color:${C.text};background:${C.raise}}
.tab:active{transform:scale(.94)}
.quote{font-size:15px;line-height:1.45;color:${C.text2};font-weight:500}
.stripe{width:3px;border-radius:999px;align-self:stretch;flex:0 0 auto}
@keyframes rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
main>*{animation:rise .42s var(--ease-out) both}
main>:nth-child(1){animation-delay:.03s}
main>:nth-child(2){animation-delay:.08s}
main>:nth-child(3){animation-delay:.13s}
main>:nth-child(4){animation-delay:.18s}
main>:nth-child(5){animation-delay:.23s}
main>:nth-child(6){animation-delay:.28s}
main>:nth-child(7){animation-delay:.33s}
main>:nth-child(8){animation-delay:.38s}
.nav-pill>a{animation:rise .36s var(--ease-out) both}
.nav-pill>a:nth-child(2){animation-delay:.04s}.nav-pill>a:nth-child(3){animation-delay:.08s}.nav-pill>a:nth-child(4){animation-delay:.12s}.nav-pill>a:nth-child(5){animation-delay:.16s}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
`

// ---------- Icons (24 grid, stroke based) ----------
const PATHS = {
  home: 'M3 10.5 12 3l9 7.5M5 9.5V20h14V9.5M10 20v-6h4v6',
  chores: 'M9 4h6v3H9zM7 5.5H5V21h14V5.5h-2M9 13.5l2 2 4-4.5',
  wallet: 'M3 8h15a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V8zM3 8a3 3 0 0 1 3-3h11M16 14h5',
  calendar: 'M4 6h16v14H4zM4 10.5h16M8 3v4M16 3v4',
  car: 'M5 15.5l1.6-5.2A2 2 0 0 1 8.5 9h7a2 2 0 0 1 1.9 1.3L19 15.5M3 15.5h18V19H3zM7 19v2M17 19v2M7 15.5h.01M17 15.5h.01',
  settings: 'M4 6h8M16 6h4M4 12h3M11 12h9M4 18h11M19 18h1',
  plus: 'M12 5v14M5 12h14',
  check: 'M5 12.5l4.5 4.5L19 7',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  bell: 'M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15zM10 21h4',
  chevronRight: 'M9 6l6 6-6 6',
  chevronLeft: 'M15 6l-6 6 6 6',
  chevronDown: 'M6 9l6 6 6-6',
  arrowRight: 'M5 12h14M13 6l6 6-6 6',
  arrowUpRight: 'M7 17 17 7M8 7h9v9',
  arrowDownLeft: 'M17 7 7 17M16 17H7V8',
  arrowDown: 'M12 5v14M6 13l6 6 6-6',
  arrowUp: 'M12 19V5M6 11l6-6 6 6',
  alert: 'M12 3 2 20h20zM12 9.5v4.5M12 17.2h.01',
  rotate: 'M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5',
  scale: 'M12 3v18M6 21h12M3 7h18M7 7l-3 7a3 3 0 0 0 6 0zM17 7l-3 7a3 3 0 0 0 6 0z',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4zM12 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  wifi: 'M2 9a15 15 0 0 1 20 0M5.5 12.5a10 10 0 0 1 13 0M9 16a5 5 0 0 1 6 0M12 19.5h.01',
  zap: 'M13 2 4 14h7l-1 8 9-12h-7z',
  droplet: 'M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z',
  flame: 'M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-6 1-9z',
  building: 'M4 21V4h10v17M14 9h6v12M8 8h2M8 12h2M8 16h2M17 13h.01M17 17h.01',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4',
  key: 'M8 18a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM11 11l9-9M17 5l2 2M14 8l2 2',
  copy: 'M9 9h11v11H9zM5 15V4h11',
  logout: 'M10 17l5-5-5-5M15 12H3M13 4h6v16h-6',
  pin: 'M12 21s7-6 7-11a7 7 0 0 0-14 0c0 5 7 11 7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  users: 'M9 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3 20a6 6 0 0 1 12 0M16 4.5a3.5 3.5 0 0 1 0 7M17 14a6 6 0 0 1 5 6',
  graduation: 'M2 9l10-5 10 5-10 5zM6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5M22 9v6',
  fileUp: 'M14 3H6v18h12V7zM14 3v4h4M12 17v-6M9 14l3-3 3 3',
  grip: 'M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01',
  route: 'M6 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM8 19h6a3 3 0 0 0 0-6h-4a3 3 0 0 1 0-6h6',
  dollar: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 6v12M15 9.5c0-1-1.3-1.5-3-1.5s-3 .6-3 1.8c0 2.4 6 1.4 6 4 0 1.2-1.5 1.7-3 1.7s-3-.6-3-1.5',
  filter: 'M3 6h18M6 12h12M10 18h4',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  x: 'M6 6l12 12M18 6 6 18',
  pencil: 'M4 20l4-1L19 8l-3-3L5 16zM14 7l3 3',
  pause: 'M8 5v14M16 5v14',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6',
  imagePlus: 'M4 5h11M20 10v9H4V5M4 16l5-4 4 3 3-2 4 3M19 2v6M16 5h6',
  send: 'M21 3 3 10l8 3 3 8zM11 13l10-10',
  history: 'M3 12a9 9 0 1 0 3-6.7M3 4v5h5M12 8v4l3 2',
  userX: 'M10 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3 20a7 7 0 0 1 14 0M17 8l4 4M21 8l-4 4',
  download: 'M12 4v11M7 10l5 5 5-5M4 19h16',
  book: 'M12 6c-2-1.5-5-2-9-2v14c4 0 7 .5 9 2 2-1.5 5-2 9-2V4c-4 0-7 .5-9 2zM12 6v14',
  circle: 'M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17z',
  checkCircle: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8.5 12.5l2.5 2.5 5-5',
  cart: 'M3 4h2l2.5 11h11L21 7H6.5M9 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM17 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  utensils: 'M7 3v18M4 3v5a3 3 0 0 0 6 0V3M17 3c-2 0-3 3-3 6v3h3v9',
  package: 'M12 3 3 7.5v9L12 21l9-4.5v-9zM3 7.5l9 4.5 9-4.5M12 12v9',
  cards: 'M3 6h18v12H3zM3 10h18M7 15h3',
  calendarPlus: 'M4 6h16v14H4zM4 10.5h16M8 3v4M16 3v4M12 13v5M9.5 15.5h5',
  circleAlert: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 8v4.5M12 16h.01',
  film: 'M4 4h16v16H4zM4 9h16M4 15h16M9 4v16M15 4v16',
  heart: 'M3 12h4l2-4 3 8 2-5 1.5 1H21M12 20c-4-3-8-6-8-10a4 4 0 0 1 8-2 4 4 0 0 1 8 2c0 4-4 7-8 10z',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  minus: 'M5 12h14',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
  trendUp: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  trendDown: 'M3 7l6 6 4-4 8 8M15 17h6v-6',
  hand: 'M8 13V5.5a1.5 1.5 0 0 1 3 0V11M11 10.5V4.5a1.5 1.5 0 0 1 3 0V11M14 11V6a1.5 1.5 0 0 1 3 0v8a6 6 0 0 1-12 0v-3a1.5 1.5 0 0 1 3 0',
}

export function icon(name, size = 18, opts = {}) {
  const d = PATHS[name]
  if (!d) throw new Error(`Unknown icon ${name}`)
  const stroke = opts.stroke ?? 1.9
  const style = opts.style ? ` style="${opts.style}"` : ''
  const color = opts.color ?? 'currentColor'
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${style}><path d="${d}"></path></svg>`
}

// ---------- Brand mark (the app's house glyph, on the new palette) ----------
export function brandMark(size = 34) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 192 192" aria-hidden="true" style="flex:0 0 auto;display:block"><defs><linearGradient id="bm" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff6aa0"></stop><stop offset="1" stop-color="${C.pink}"></stop></linearGradient></defs><rect width="192" height="192" rx="52" fill="url(#bm)"></rect><path d="M42 75 96 34l54 41v72a12 12 0 0 1-12 12H54a12 12 0 0 1-12-12V75Z" fill="#0b0c0f"></path><path d="M71 71h17v20h16V71h17v55h-17v-21H88v21H71V71Z" fill="#ffffff"></path><circle cx="132" cy="132" r="11" fill="${C.blue}"></circle></svg>`
}

// ---------- Data (mirrors src/data/demo.ts) ----------
const luminance = (hex) => {
  const h = hex.replace('#', '')
  const [r, g, b] = [0, 2, 4].map((o) => parseInt(h.slice(o, o + 2), 16))
  return (r * 299 + g * 587 + b * 114) / 1000
}

export const M = {
  brandon: { name: 'Brandon', initials: 'BR', color: '#e26d4f', role: 'owner', email: 'brandon@example.com' },
  maya: { name: 'Maya', initials: 'MA', color: '#6d7fbd', role: 'member', email: 'maya@example.com' },
  liam: { name: 'Liam', initials: 'LI', color: '#ca9d3d', role: 'member', email: '' },
  noah: { name: 'Noah', initials: 'NO', color: '#4c927e', role: 'member', email: 'noah@example.com' },
}
for (const m of Object.values(M)) m.fg = luminance(m.color) > 150 ? '#17221e' : '#ffffff'
export const MEMBERS = [M.brandon, M.maya, M.liam, M.noah]

export const HOUSE = {
  name: 'The Maple House',
  address: '42 Maple Street, Toronto, ON',
  timezone: 'America/Toronto',
  currency: 'CAD',
}

// ---------- Components ----------
export function avatar(m, size = 36, extra = '') {
  const fs = size >= 80 ? 26 : size >= 44 ? 14 : size >= 36 ? 12 : 10.5
  return `<span class="avatar" role="img" aria-label="${m.initials}" style="width:${size}px;height:${size}px;font-size:${fs}px;background:${m.color};color:${m.fg};${extra}">${m.initials}</span>`
}

export function avatarStack(list, size = 28) {
  return `<span style="display:flex;align-items:center">${list
    .map((m, i) => avatar(m, size, i ? 'margin-left:-6px' : ''))
    .join('')}</span>`
}

export function badge(text, tone = '') {
  return `<span class="badge${tone ? ` badge-${tone}` : ''}">${text}</span>`
}

export function pill(text, tone = '', extra = '') {
  return `<span class="pill${tone ? ` pill-${tone}` : ''}"${extra ? ` style="${extra}"` : ''}>${text}</span>`
}

export function btn(label, { variant = 'primary', size = '', icon: ic, right, extra = '' } = {}) {
  const cls = ['btn', `btn-${variant}`, size ? `btn-${size}` : ''].filter(Boolean).join(' ')
  const isz = size === 'sm' ? 15 : size === 'lg' ? 18 : 16
  return `<button type="button" class="${cls}"${extra ? ` style="${extra}"` : ''}>${ic ? icon(ic, isz) : ''}${label ? `<span>${label}</span>` : ''}${right ? icon(right, 14) : ''}</button>`
}

export function iconBtn(name, { size = 40, extra = '', dot = false } = {}) {
  return `<button type="button" class="btn btn-icon" style="width:${size}px;height:${size}px;position:relative;${extra}">${icon(name, Math.round(size * 0.45))}${dot ? `<i style="position:absolute;top:9px;right:10px;width:7px;height:7px;border-radius:999px;background:${C.pink};box-shadow:0 0 0 2px ${C.card}"></i>` : ''}</button>`
}

const TONES = {
  sunk: [C.inner, C.text2],
  ever: [C.blueSoft, '#7d9cff'],
  blue: [C.blueSoft, '#7d9cff'],
  moss: [C.greenSoft, C.green],
  green: [C.greenSoft, C.green],
  brass: [C.amberSoft, C.amber],
  amber: [C.amberSoft, C.amber],
  rust: [C.redSoft, '#ff8080'],
  red: [C.redSoft, '#ff8080'],
  slate: [C.violetSoft, C.violet],
  violet: [C.violetSoft, C.violet],
  pink: [C.pinkSoft, '#ff7fae'],
  solidMoss: [C.green, '#0b0c0f'],
  solidGreen: [C.green, '#0b0c0f'],
  solidEver: [C.blue, '#fff'],
  solidBlue: [C.blue, '#fff'],
  solidPink: [C.pink, '#fff'],
  solidWhite: [C.white, C.bg],
  solidRust: [C.red, '#fff'],
}

export function tile(name, tone = 'ever', size = 40, radius = 12) {
  const [bg, fg] = TONES[tone] ?? TONES.sunk
  return `<span class="tile" style="width:${size}px;height:${size}px;border-radius:${radius}px;background:${bg};color:${fg}">${icon(name, Math.round(size * 0.47))}</span>`
}

export function check(on = false) {
  return `<span class="check${on ? ' on' : ''}">${on ? icon('check', 12, { stroke: 3 }) : ''}</span>`
}

export function radio(on = false) {
  return `<span class="radio${on ? ' on' : ''}">${on ? '<i></i>' : ''}</span>`
}

export function toggle(on = false) {
  return `<span class="toggle${on ? ' on' : ''}" role="switch" aria-checked="${on}"><i></i></span>`
}

export function field(label, value, { placeholder = false, span = '', hint = '', type = 'input', trailing = '', round = false } = {}) {
  const inner = type === 'select'
    ? `<span style="flex:1">${value}</span>${icon('chevronDown', 15, { color: C.text3 })}`
    : `<span class="${placeholder ? 'ph' : ''}" style="flex:1">${value}</span>${trailing}`
  return `<label class="field" style="${span}"><span style="display:flex;align-items:baseline;gap:8px">${label}${hint ? `<span class="tiny" style="font-weight:500">${hint}</span>` : ''}</span><span class="input${type === 'textarea' ? ' textarea' : ''}${round ? ' round' : ''}">${inner}</span></label>`
}

export function statusDot(kind) {
  const color = kind === 'chore' ? C.pink : kind === 'bill' ? C.amber : kind === 'event' ? C.blue : C.text3
  return `<span class="dot" style="background:${color}"></span>`
}

export function progress(label, pct, tone = 'pink') {
  const fill = tone === 'pink' ? C.pink : tone === 'white' ? C.white : tone === 'blue' ? C.blue : tone === 'hatch' ? C.raise : C.raise
  const text = tone === 'white' ? C.bg : C.text
  const hatch = tone === 'hatch' ? ' hatch' : ''
  return `<div style="display:grid;gap:8px;min-width:0"><span class="small" style="font-weight:600;color:${C.text2}">${label}</span><div class="progress"><i class="${hatch.trim()}" style="width:${pct}%;background:${fill}"></i><span style="color:${text}">${pct}%</span></div></div>`
}

export function kpi(value, label, { tone = 'green', ic = 'trendUp', delta = '' } = {}) {
  const [bg] = { green: [C.green], pink: [C.pink], blue: [C.blue], amber: [C.amber], red: [C.red] }[tone]
  return `<div style="display:grid;gap:4px;justify-items:start">
    <div style="display:flex;align-items:center;gap:12px">
      <span style="position:relative;display:grid;place-items:center;width:32px;height:32px;border-radius:999px;background:${bg};color:${tone === 'green' || tone === 'amber' ? C.bg : '#fff'}">${icon(ic, 16, { stroke: 2.4 })}${delta ? `<span style="position:absolute;top:-8px;left:-6px;display:inline-flex;align-items:center;height:16px;padding:0 5px;border-radius:999px;background:${C.card};border:1px solid ${C.line2};color:${C.text};font-size:9.5px;font-weight:800;white-space:nowrap">${delta}</span>` : ''}</span>
      <span class="display" style="font-size:42px;line-height:1;color:${C.text}">${value}</span>
    </div>
    <span class="small" style="padding-left:44px;font-weight:600">${label}</span>
  </div>`
}

// Smooth line through points (Catmull-Rom → cubic Bézier), for the charts.
export function smoothPath(points) {
  if (points.length < 2) return ''
  const p = points
  let d = `M${p[0][0]},${p[0][1]}`
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] || p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] || p2
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0]},${p2[1]}`
  }
  return d
}

export function lineChart({ w = 560, h = 230, pink, blue, yLabels, xLabels, tip }) {
  const padL = 34, padR = 12, padT = 16, padB = 28
  const iw = w - padL - padR, ih = h - padT - padB
  const toPts = (arr, max) => arr.map((v, i) => [Math.round(padL + (i / (arr.length - 1)) * iw), Math.round(padT + ih - (v / max) * ih)])
  const max = Math.max(...pink, ...blue) * 1.08
  const pp = toPts(pink, max), bp = toPts(blue, max)
  const grid = yLabels.map((l, i) => {
    const y = Math.round(padT + (i / (yLabels.length - 1)) * ih)
    return `<line x1="${padL}" x2="${w - padR}" y1="${y}" y2="${y}" stroke="rgba(255,255,255,.07)" stroke-dasharray="3 5"></line><text x="${padL - 10}" y="${y + 4}" text-anchor="end" font-size="11" fill="${C.text3}" font-family="Manrope, sans-serif" font-weight="600">${l}</text>`
  }).join('')
  const xs = xLabels.map((l, i) => `<text x="${Math.round(padL + (i / (xLabels.length - 1)) * iw)}" y="${h - 8}" text-anchor="middle" font-size="11" fill="${C.text3}" font-family="Manrope, sans-serif" font-weight="600">${l}</text>`).join('')
  const tipIdx = tip?.index ?? Math.floor(pink.length / 2)
  const [tx, ty] = pp[tipIdx]
  const tipEl = tip ? `<line x1="${tx}" x2="${tx}" y1="${padT}" y2="${padT + ih}" stroke="rgba(255,255,255,.2)" stroke-dasharray="3 4"></line><circle cx="${tx}" cy="${ty}" r="6" fill="${C.card}" stroke="${C.pink}" stroke-width="2.5"></circle><circle cx="${tx}" cy="${ty}" r="12" fill="none" stroke="${C.pink}" stroke-opacity=".25" stroke-width="1.5"></circle>` : ''
  const tipBox = tip ? `<div class="inner" style="position:absolute;left:${tx + 14}px;top:${Math.max(4, ty - 44)}px;padding:8px 12px;display:grid;gap:2px;background:${C.raise};border-color:${C.line2};box-shadow:0 12px 30px -10px rgba(0,0,0,.7);white-space:nowrap"><span class="tiny" style="color:${C.text2}">${tip.title}</span><span style="font-size:13px;font-weight:800">${tip.value}</span></div>` : ''
  return `<div style="position:relative;width:${w}px;height:${h}px">
  <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true" style="display:block">
    <defs><linearGradient id="gp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.pink}" stop-opacity=".22"></stop><stop offset="1" stop-color="${C.pink}" stop-opacity="0"></stop></linearGradient></defs>
    ${grid}${xs}
    <path d="${smoothPath(pp)} L${pp[pp.length - 1][0]},${padT + ih} L${pp[0][0]},${padT + ih} Z" fill="url(#gp)"></path>
    <path d="${smoothPath(bp)}" fill="none" stroke="#5b7cff" stroke-width="2.4" stroke-linecap="round"></path>
    <path d="${smoothPath(pp)}" fill="none" stroke="${C.pink}" stroke-width="2.6" stroke-linecap="round"></path>
    ${tipEl}
  </svg>
  ${tipBox}
</div>`
}

export function segmented(items, active) {
  return `<span class="nav-pill" style="padding:3px">${items.map((t) => `<span class="nav-item${t === active ? ' on' : ''}" style="height:30px;padding:0 14px;font-size:12.5px">${t}</span>`).join('')}</span>`
}

export function select(label, extra = '') {
  return `<span class="pill" style="height:34px;padding:0 12px 0 14px;${extra}">${label}${icon('chevronDown', 14, { color: C.text3 })}</span>`
}

// ---------- Desktop shell ----------
export const NAV = [
  { key: 'overview', label: 'Overview', icon: 'home' },
  { key: 'chores', label: 'Chores', icon: 'chores' },
  { key: 'money', label: 'Money', icon: 'wallet' },
  { key: 'calendar', label: 'Calendar', icon: 'calendar' },
  { key: 'driveway', label: 'Driveway', icon: 'car' },
]

export function topbar(active) {
  return `<header style="display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:24px;height:64px">
  <div style="display:flex;align-items:center;gap:12px">${brandMark(36)}<div style="display:grid;line-height:1.1"><span style="font-size:17px;font-weight:800;letter-spacing:-.02em">HowseHowld</span><span class="tiny" style="font-weight:600">${HOUSE.name}</span></div></div>
  <nav class="nav-pill" aria-label="Primary">${NAV.map((n) => `<a href="#" class="nav-item${n.key === active ? ' on' : ''}">${n.label}</a>`).join('')}</nav>
  <div style="display:flex;align-items:center;justify-content:flex-end;gap:10px">
    ${iconBtn('search')}
    ${iconBtn('bell', { dot: true })}
    ${iconBtn('settings', { extra: active === 'settings' ? `background:${C.raise};color:${C.text}` : '' })}
    <a href="#" aria-label="Your profile" style="display:inline-flex;margin-left:4px">${avatar(M.brandon, 40, `box-shadow:0 0 0 2px ${C.bg},0 0 0 4px ${C.line2}`)}</a>
  </div>
</header>`
}

export function shell({ active, main, height }) {
  return `<div style="width:1440px;min-height:${height}px;background:${C.bg};padding:16px 32px 56px;display:grid;gap:22px;align-content:start">
${topbar(active)}
<main style="display:grid;gap:20px;align-content:start;min-width:0">
${main}
</main>
</div>`
}

export function pageHeader({ title, sub, actions = '', titleSize = 36, eyebrow = '' }) {
  return `<div style="display:flex;align-items:flex-end;justify-content:space-between;gap:32px;padding:6px 4px 4px">
  <div style="display:grid;gap:6px;min-width:0">
    ${eyebrow ? `<p class="eyebrow">${eyebrow}</p>` : ''}
    <h1 class="h1" style="font-size:${titleSize}px">${title}</h1>
    ${sub ? `<p class="sub">${sub}</p>` : ''}
  </div>
  ${actions ? `<div style="display:flex;align-items:center;gap:10px;flex:0 0 auto">${actions}</div>` : ''}
</div>`
}

export function cardHead(title, { right = '', sub = '', pad = '20px 22px 12px' } = {}) {
  return `<div style="display:flex;align-items:center;justify-content:space-between;gap:16px;padding:${pad}">
  <div style="display:grid;gap:3px;min-width:0"><h2 class="h2">${title}</h2>${sub ? `<p class="small">${sub}</p>` : ''}</div>
  ${right ? `<div style="display:flex;align-items:center;gap:8px;flex:0 0 auto">${right}</div>` : ''}
</div>`
}

export function arrowBtn(extra = '') {
  return `<span style="display:grid;place-items:center;width:34px;height:34px;border-radius:999px;background:rgba(255,255,255,.14);color:#fff;${extra}">${icon('arrowUpRight', 16, { stroke: 2.4 })}</span>`
}

// ---------- Mobile shell ----------
export function mobileShell({ active, body, top = '' }) {
  return `<div style="position:relative;width:390px;height:844px;overflow:hidden;background:${C.bg};display:flex;flex-direction:column">
${top}
<div style="flex:1;min-height:0;overflow:hidden;padding:0 16px;display:grid;gap:14px;align-content:start">
${body}
</div>
<nav aria-label="Primary" class="nav-pill" style="position:absolute;left:14px;right:14px;bottom:18px;display:flex;padding:5px;background:rgba(29,30,35,.92);backdrop-filter:blur(14px);box-shadow:0 18px 40px -16px rgba(0,0,0,.8)">
  ${NAV.map((n) => `<a href="#" class="tab${n.key === active ? ' on' : ''}">${icon(n.icon, 20)}<span>${n.label}</span></a>`).join('\n  ')}
</nav>
</div>`
}

export function mobileTop({ title, right = '' }) {
  return `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px 16px 12px">
  <div style="display:flex;align-items:center;gap:10px">${brandMark(30)}<span style="font-size:15px;font-weight:800;letter-spacing:-.02em">${title}</span></div>
  <div style="display:flex;gap:8px">${right}</div>
</div>`
}

// ---------- Document wrapper ----------
export function doc(body, { extraCss = '' } = {}) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  ${FONT_LINK}
  <style>${CSS}${extraCss}</style>
</helmet>
${body}
</x-dc>
</body>
</html>
`
}
