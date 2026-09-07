import {
  C, M,
  icon, avatar, badge, btn, tile, doc,
} from './lib.mjs'

// Cubic-bezier curve drawn as a small SVG for the spec strip.
function curve(x1, y1, x2, y2, label, name) {
  const s = 88
  const p = `M0,${s} C${x1 * s},${s - y1 * s} ${x2 * s},${s - y2 * s} ${s},0`
  return `<div style="display:grid;gap:10px;justify-items:start">
    <svg width="${s + 2}" height="${s + 2}" viewBox="-1 -1 ${s + 2} ${s + 2}" aria-hidden="true" style="overflow:visible"><rect x="0" y="0" width="${s}" height="${s}" fill="${C.paper}" stroke="${C.line}"></rect><path d="M0,${s} L${s},0" stroke="${C.line2}" stroke-dasharray="3 3" fill="none"></path><path d="${p}" stroke="${C.ever}" stroke-width="2" fill="none" stroke-linecap="round"></path><circle cx="${x1 * s}" cy="${s - y1 * s}" r="2.5" fill="${C.brass2}"></circle><circle cx="${x2 * s}" cy="${s - y2 * s}" r="2.5" fill="${C.brass2}"></circle></svg>
    <div style="display:grid;gap:2px"><span class="h3" style="font-size:13.5px">${label}</span><span class="mono tiny">${name}</span><span class="mono tiny">cubic-bezier(${x1}, ${y1}, ${x2}, ${y2})</span></div>
  </div>`
}

const demoCss = `
.demo{position:relative;display:grid;place-items:center;height:210px;margin:14px 18px 0;border-radius:8px;background:${C.paper};border:1px solid ${C.line};overflow:hidden}
.demo .mini{font-size:13px}
@property --d{syntax:'<integer>';inherits:false;initial-value:0}
@property --c{syntax:'<integer>';inherits:false;initial-value:0}
@property --pct{syntax:'<integer>';inherits:false;initial-value:0}

/* 01 complete a chore */
@keyframes d1-btn{0%,30%{opacity:1;transform:none}34%{transform:scale(.96)}38%{opacity:1;transform:none}44%,88%{opacity:0;transform:translateY(-4px)}92%,100%{opacity:1;transform:none}}
@keyframes d1-badge{0%,44%{opacity:0;transform:translateY(4px)}52%,88%{opacity:1;transform:none}92%,100%{opacity:0;transform:translateY(4px)}}
@keyframes d1-ring{0%,38%{fill:transparent;stroke:${C.ink}}44%,88%{fill:${C.moss};stroke:${C.moss}}92%,100%{fill:transparent;stroke:${C.ink}}}
@keyframes d1-check{0%,40%{stroke-dashoffset:24}50%,88%{stroke-dashoffset:0}92%,100%{stroke-dashoffset:24}}
@keyframes d1-tile{0%,40%{background:${C.brassSoft};color:${C.brass}}46%,88%{background:${C.moss};color:#fff}92%,100%{background:${C.brassSoft};color:${C.brass}}}
@keyframes d1-row{0%,40%{background:${C.sheet}}46%{background:${C.mossSoft}}70%,100%{background:${C.sheet}}}
@keyframes d1-title{0%,44%{color:${C.ink}}52%,88%{color:${C.muted}}92%,100%{color:${C.ink}}}
.d1-row{animation:d1-row 4s var(--ease-out) infinite}
.d1-btn{animation:d1-btn 4s var(--ease-out) infinite;grid-area:a}
.d1-badge{animation:d1-badge 4s var(--ease-spring) infinite;grid-area:a;justify-self:end}
.d1-ring{animation:d1-ring 4s var(--ease-out) infinite}
.d1-check{stroke-dasharray:24;animation:d1-check 4s var(--ease-out) infinite}
.d1-tile{animation:d1-tile 4s var(--ease-out) infinite}
.d1-title{animation:d1-title 4s var(--ease-out) infinite}

/* 02 count-up */
@keyframes count{0%,8%{--d:0;--c:0}30%,85%{--d:18;--c:27}100%{--d:0;--c:0}}
@keyframes bar{0%,10%{width:0}34%,85%{width:73%}100%{width:0}}
@keyframes pct{0%,10%{--pct:0}34%,85%{--pct:73}100%{--pct:0}}
.count{animation:count 4s var(--ease-out) infinite;counter-reset:d var(--d) c var(--c)}
.count::before{content:"+$" counter(d) "." counter(c,decimal-leading-zero)}
.bar{animation:bar 4s var(--ease-out) infinite}
.pct{animation:pct 4s var(--ease-out) infinite;counter-reset:p var(--pct)}
.pct::before{content:counter(p) "% paid"}

/* 03 hover & press */
@keyframes d3-btn{0%,18%{transform:none;box-shadow:inset 0 1px 0 rgba(255,255,255,.12);background:${C.ever}}26%,40%{transform:translateY(-1px);box-shadow:inset 0 1px 0 rgba(255,255,255,.12),0 8px 18px -10px rgba(59,107,255,.7);background:${C.ever2}}44%{transform:scale(.97)}50%,64%{transform:translateY(-1px);box-shadow:inset 0 1px 0 rgba(255,255,255,.12),0 8px 18px -10px rgba(59,107,255,.7);background:${C.ever2}}74%,100%{transform:none;box-shadow:inset 0 1px 0 rgba(255,255,255,.12);background:${C.ever}}}
@keyframes d3-cur{0%{transform:translate(70px,54px);opacity:0}8%{opacity:1}22%,66%{transform:translate(0,0);opacity:1}80%,100%{transform:translate(70px,54px);opacity:0}}
@keyframes d3-ripple{0%,42%{transform:scale(.4);opacity:0}44%{opacity:.35}62%,100%{transform:scale(1.4);opacity:0}}
.d3-btn{animation:d3-btn 4s var(--ease-out) infinite}
.d3-cur{position:absolute;left:50%;top:50%;margin:8px 0 0 22px;animation:d3-cur 4s var(--ease-out) infinite;pointer-events:none}
.d3-ripple{position:absolute;width:140px;height:60px;border-radius:12px;background:${C.ever};animation:d3-ripple 4s var(--ease-out) infinite}

/* 04 nav pill */
@keyframes navpill{0%,20%{transform:translateY(0)}25%,45%{transform:translateY(39px)}50%,70%{transform:translateY(78px)}75%,95%{transform:translateY(117px)}100%{transform:translateY(0)}}
@keyframes n1{0%,22%{color:${C.ever};font-weight:600}26%,96%{color:${C.ink2};font-weight:500}100%{color:${C.ever}}}
@keyframes n2{0%,22%{color:${C.ink2}}26%,47%{color:${C.ever};font-weight:600}51%,100%{color:${C.ink2}}}
@keyframes n3{0%,47%{color:${C.ink2}}51%,72%{color:${C.ever};font-weight:600}76%,100%{color:${C.ink2}}}
@keyframes n4{0%,72%{color:${C.ink2}}76%,97%{color:${C.ever};font-weight:600}100%{color:${C.ink2}}}
.navpill{position:absolute;left:0;right:0;top:0;height:36px;border-radius:8px;background:${C.raise};box-shadow:inset 0 1px 0 rgba(255,255,255,.06);animation:navpill 4s var(--ease-out) infinite}
.n1{animation:n1 4s linear infinite}.n2{animation:n2 4s linear infinite}.n3{animation:n3 4s linear infinite}.n4{animation:n4 4s linear infinite}

/* 05 toggle */
@keyframes tog-i{0%,36%{transform:translateX(0)}44%,86%{transform:translateX(18px)}94%,100%{transform:translateX(0)}}
@keyframes tog-bg{0%,38%{background:${C.line2}}44%,88%{background:${C.ever}}94%,100%{background:${C.line2}}}
.tog{animation:tog-bg 4s var(--ease-out) infinite}
.tog i{animation:tog-i 4s var(--ease-spring) infinite}
.tog.late{animation-delay:.6s}.tog.late i{animation-delay:.6s}

/* 06 load choreography */
@keyframes mini-rise{0%{opacity:0;transform:translateY(8px)}12%{opacity:1;transform:none}78%{opacity:1;transform:none}88%,100%{opacity:0;transform:translateY(-4px)}}
.mini-rise>*{animation:mini-rise 4s var(--ease-out) infinite}
.mini-rise>:nth-child(2){animation-delay:.06s}.mini-rise>:nth-child(3){animation-delay:.12s}.mini-rise>:nth-child(4){animation-delay:.18s}.mini-rise>:nth-child(5){animation-delay:.24s}

/* 07 toast */
@keyframes toast{0%,10%{transform:translateY(130%);opacity:0}18%,72%{transform:none;opacity:1}80%,100%{transform:translateY(130%);opacity:0}}
.toast{position:absolute;bottom:16px;left:16px;right:16px;animation:toast 4s var(--ease-out) infinite}

/* 08 modal */
@keyframes mback{0%,10%{opacity:0}18%,72%{opacity:1}80%,100%{opacity:0}}
@keyframes msheet{0%,10%{opacity:0;transform:scale(.96) translateY(8px)}20%,72%{opacity:1;transform:none}80%,100%{opacity:0;transform:scale(.98) translateY(4px)}}
.mback{position:absolute;inset:0;background:rgba(0,0,0,.45);animation:mback 4s var(--ease-out) infinite}
.msheet{position:relative;animation:msheet 4s var(--ease-out) infinite}

/* 09 date glide */
@keyframes glide{0%,22%{transform:translateX(0)}28%,52%{transform:translateX(76px)}58%,82%{transform:translateX(152px)}88%,100%{transform:translateX(0)}}
.glide{position:absolute;left:0;top:0;width:34px;height:52px;border-radius:8px;background:${C.sheet};border:1px solid ${C.line2};box-shadow:0 2px 6px rgba(0,0,0,.08);animation:glide 4s var(--ease-out) infinite}

/* 10 drag reorder */
@keyframes dragA{0%,12%{transform:none;box-shadow:none;z-index:1}18%{transform:scale(1.02);box-shadow:0 12px 28px -12px rgba(0,0,0,.35)}22%,42%{transform:translateY(0) scale(1.02);box-shadow:0 12px 28px -12px rgba(0,0,0,.35)}48%,60%{transform:translateY(52px) scale(1.02);box-shadow:0 12px 28px -12px rgba(0,0,0,.35)}66%,80%{transform:translateY(52px);box-shadow:none}86%,100%{transform:none;box-shadow:none}}
@keyframes dragB{0%,44%{transform:none}50%,80%{transform:translateY(-52px)}86%,100%{transform:none}}
@keyframes numA{0%,55%{content:"1"}56%,80%{content:"2"}81%,100%{content:"1"}}
.dragA{position:relative;z-index:1;animation:dragA 4s var(--ease-out) infinite}
.dragB{animation:dragB 4s var(--ease-out) infinite}

/* 11 confirm */
@keyframes c-label{0%,26%{opacity:1}32%,100%{opacity:0}}
@keyframes c-spin{0%,26%{opacity:0}32%,58%{opacity:1}64%,100%{opacity:0}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes c-done{0%,60%{opacity:0;transform:scale(.6)}68%,90%{opacity:1;transform:scale(1)}96%,100%{opacity:0}}
@keyframes c-bg{0%,60%{background:${C.ever};border-color:${C.ever};width:112px}68%,90%{background:${C.moss};border-color:${C.moss};width:132px}100%{background:${C.ever};border-color:${C.ever};width:112px}}
@keyframes c-badge{0%,66%{opacity:0;transform:translateY(3px)}74%,90%{opacity:1;transform:none}96%,100%{opacity:0}}
.c-btn{position:relative;display:grid;place-items:center;height:36px;width:112px;border-radius:8px;border:1px solid ${C.ever};background:${C.ever};color:${C.paper};font-weight:600;font-size:13.5px;animation:c-bg 4s var(--ease-out) infinite}
.c-btn>*{grid-area:1/1}
.c-label{animation:c-label 4s var(--ease-out) infinite}
.c-spin{width:16px;height:16px;border-radius:999px;border:2px solid rgba(245,242,235,.35);border-top-color:${C.paper};animation:c-spin 4s linear infinite, spin .7s linear infinite}
.c-done{display:inline-flex;align-items:center;gap:6px;animation:c-done 4s var(--ease-spring) infinite}
.c-badge{animation:c-badge 4s var(--ease-out) infinite}

/* 12 skeleton */
@keyframes shimmer{0%{background-position:-200px 0}100%{background-position:200px 0}}
@keyframes sk-out{0%,48%{opacity:1}56%,92%{opacity:0}100%{opacity:1}}
@keyframes sk-in{0%,50%{opacity:0;transform:translateY(4px)}60%,90%{opacity:1;transform:none}96%,100%{opacity:0}}
.sk{height:10px;border-radius:5px;background:linear-gradient(90deg,${C.sunk} 25%,rgba(255,255,255,.09) 50%,${C.sunk} 75%);background-size:400px 100%;animation:shimmer 1.4s linear infinite}
.sk-wrap{animation:sk-out 4s var(--ease-out) infinite;grid-area:1/1}
.sk-real{animation:sk-in 4s var(--ease-out) infinite;grid-area:1/1}
`

function card(n, title, demo, what, spec) {
  return `<article class="sheet" style="display:grid;grid-template-rows:auto auto 1fr;overflow:hidden">
  <div style="display:flex;align-items:baseline;justify-content:space-between;padding:16px 18px 0"><span class="h3" style="font-size:14.5px">${title}</span><span class="mono tiny">${n}</span></div>
  <div class="demo">${demo}</div>
  <div style="display:grid;gap:5px;padding:12px 18px 16px;align-content:start"><span class="small" style="color:${C.ink2}">${what}</span><span class="mono tiny">${spec}</span></div>
</article>`
}

export function motion() {
  const miniRow = (t, s, tone = 'brass', ic = 'clock') => `<div style="display:grid;grid-template-columns:32px 1fr;align-items:center;gap:10px;padding:8px 10px;border-bottom:1px solid ${C.line}">${tile(ic, tone, 30, 7)}<div style="display:grid"><span style="font-size:12.5px;font-weight:600">${t}</span><span class="tiny">${s}</span></div></div>`

  const d1 = `<div class="d1-row sheet" style="width:300px;display:grid;grid-template-columns:auto auto 1fr auto;grid-template-areas:'r t n a';align-items:center;gap:12px;padding:12px 14px">
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><circle class="d1-ring" cx="12" cy="12" r="9" stroke-width="1.75" fill="transparent"></circle><path class="d1-check" d="M8 12.5l2.7 2.7L16.5 9" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"></path></svg>
    <span class="tile d1-tile" style="width:34px;height:34px;border-radius:9px">${icon('clock', 16)}</span>
    <div style="display:grid;min-width:0"><span class="d1-title" style="font-size:13.5px;font-weight:600">Stove &amp; counters</span><span class="tiny">Kitchen · 11:59 PM</span></div>
    <div style="display:grid;grid-template-areas:'a';justify-items:end"><span class="d1-btn">${btn('Done', { size: 'sm', icon: 'check' })}</span><span class="d1-badge">${badge('Done', 'moss')}</span></div>
  </div>`

  const d2 = `<div style="display:grid;gap:10px;width:240px">
    <span class="tiny">Your house balance</span>
    <span class="count serif" style="font-size:44px;line-height:1;color:${C.moss}"></span>
    <div style="display:flex;height:8px;border-radius:999px;overflow:hidden;background:${C.sunk}"><span class="bar" style="background:${C.ever}"></span></div>
    <span class="pct mono tiny"></span>
  </div>`

  const d3 = `<span class="d3-ripple"></span><span class="d3-btn btn btn-primary" style="position:relative">${icon('plus', 16)}<span>New chore</span></span>
    <svg class="d3-cur" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3l14 8-6 1.5L9 20z" fill="${C.ink}" stroke="${C.paper}" stroke-width="1.5" stroke-linejoin="round"></path></svg>`

  const d4 = `<div style="position:relative;width:180px;display:grid;gap:3px">
    <span class="navpill"></span>
    ${[['home', 'Overview', 'n1'], ['chores', 'Chores', 'n2'], ['wallet', 'Money', 'n3'], ['calendar', 'Calendar', 'n4']].map(([ic, l, cls]) => `<span class="nav-item ${cls}" style="position:relative;background:transparent;box-shadow:none;justify-content:flex-start">${icon(ic, 17)}<span>${l}</span></span>`).join('')}
  </div>`

  const d5 = `<div style="display:grid;gap:14px;width:250px">
    <label style="display:flex;align-items:center;justify-content:space-between;font-size:13px"><span>Morning assignment · 9:00 AM</span><span class="toggle tog"><i></i></span></label>
    <label style="display:flex;align-items:center;justify-content:space-between;font-size:13px"><span>Evening check-in · 6:00 PM</span><span class="toggle tog late"><i></i></span></label>
  </div>`

  const d6 = `<div class="mini-rise sheet" style="width:280px;padding:14px;display:grid;gap:10px">
    <div style="display:flex;justify-content:space-between;align-items:center"><span class="display" style="font-size:18px">Welcome in, <span style="color:${C.text3}">Brandon</span></span>${avatar(M.brandon, 22)}</div>
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px">${[6, 7, 8, 9, 10, 11, 12].map((n, i) => `<span class="mono" style="text-align:center;font-size:11px;padding:5px 0;border-radius:5px;background:${i ? 'transparent' : C.paper};border:1px solid ${i ? 'transparent' : C.line2}">${n}</span>`).join('')}</div>
    <div style="height:8px;border-radius:4px;background:${C.sunk};width:70%"></div>
    <div style="height:8px;border-radius:4px;background:${C.sunk};width:55%"></div>
    <div style="height:8px;border-radius:4px;background:${C.sunk};width:62%"></div>
  </div>`

  const d7 = `<div style="width:100%;height:100%;position:relative;display:grid;align-content:start;gap:8px;padding:16px">
    <div style="height:8px;border-radius:4px;background:${C.sunk};width:60%"></div><div style="height:8px;border-radius:4px;background:${C.sunk};width:45%"></div>
    <div class="toast" style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:9px;background:${C.white};color:${C.bg};font-size:12.5px;box-shadow:0 14px 30px -12px rgba(0,0,0,.6)">${icon('checkCircle', 16, { color: '#1f9d63' })}<span style="flex:1">Marked complete · Stove &amp; counters</span><span style="font-weight:800;color:${C.blue}">Undo</span></div>
  </div>`

  const d8 = `<div style="position:absolute;inset:0;display:grid;align-content:start;gap:8px;padding:16px"><div style="height:8px;border-radius:4px;background:${C.sunk};width:60%"></div><div style="height:8px;border-radius:4px;background:${C.sunk};width:45%"></div></div>
    <span class="mback"></span>
    <div class="msheet sheet" style="width:250px;padding:16px;display:grid;gap:8px;box-shadow:0 30px 60px -20px rgba(0,0,0,.35)"><span class="display" style="font-size:18px">Record a direct payment</span><div class="input" style="height:32px;font-size:12.5px"><span class="ph">Amount (CAD)</span></div><div style="display:flex;justify-content:flex-end;gap:6px">${btn('Cancel', { variant: 'ghost', size: 'sm' })}${btn('Send', { size: 'sm' })}</div></div>`

  const d9 = `<div style="position:relative;display:grid;grid-template-columns:repeat(7,34px);gap:4px">
    <span class="glide"></span>
    ${[['Sun', 6], ['Mon', 7], ['Tue', 8], ['Wed', 9], ['Thu', 10], ['Fri', 11], ['Sat', 12]].map(([d, n]) => `<span style="position:relative;display:grid;gap:3px;justify-items:center;padding:8px 0;height:52px"><span class="mono" style="font-size:9px;letter-spacing:.08em;text-transform:uppercase;color:${C.muted}">${d}</span><span class="serif" style="font-size:18px;line-height:1">${n}</span></span>`).join('')}
  </div>`

  const carRow = (n, l, p, m, cls) => `<div class="${cls} sheet" style="display:grid;grid-template-columns:auto 14px auto 1fr auto;align-items:center;gap:10px;padding:8px 12px;height:44px;width:260px"><span style="color:${C.faint}">${icon('grip', 14, { stroke: 2.5 })}</span><span class="mono" style="font-size:11px;color:${C.muted}">${n}</span><span style="display:grid;place-items:center;width:30px;height:24px;border-radius:6px;background:${m.color};color:#fff">${icon('car', 14)}</span><span style="font-size:12.5px;font-weight:600">${l}</span>${avatar(m, 20)}</div>`
  const d10 = `<div style="display:grid;gap:8px">${carRow(1, 'Blue Civic', 'MAYA 04', M.maya, 'dragA')}${carRow(2, 'Green Corolla', 'NOAH 12', M.noah, 'dragB')}</div>`

  const d11 = `<div style="display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:12px;width:300px">
    ${avatar(M.noah, 30)}
    <div style="display:grid;min-width:0"><span style="font-size:13px;font-weight:600">Payment to you</span><span class="tiny">Noah · <span class="fig">+$12.00</span></span></div>
    <div style="display:grid;grid-template-areas:'a';justify-items:end;align-items:center"><span class="c-btn" style="grid-area:a"><span class="c-label">Confirm</span><span class="c-spin"></span><span class="c-done">${icon('check', 15, { stroke: 2.5 })}Confirmed</span></span></div>
  </div>`

  const d12 = `<div style="display:grid;width:280px">
    <div class="sk-wrap" style="display:grid;gap:14px">${[70, 55, 62].map((w) => `<div style="display:grid;grid-template-columns:30px 1fr;gap:10px;align-items:center"><span class="sk" style="width:30px;height:30px;border-radius:8px"></span><span style="display:grid;gap:6px"><span class="sk" style="width:${w}%"></span><span class="sk" style="width:${w - 25}%;height:8px"></span></span></div>`).join('')}</div>
    <div class="sk-real sheet" style="display:grid">${miniRow('Toilet paper &amp; paper towel', 'Brandon paid · $48.36', 'ever', 'home')}${miniRow('Kitchen spices', 'Maya &amp; Liam paid · $24.00', 'moss', 'cart')}${miniRow('Payment to Brandon', 'Noah · +$12.00', 'brass', 'arrowUpRight')}</div>
  </div>`

  const body = `<div style="width:1440px;min-height:1500px;background:${C.paper};padding:56px 64px;display:grid;gap:40px;align-content:start">
  <header style="display:grid;grid-template-columns:minmax(0,1fr) 420px;gap:48px;align-items:end;padding-bottom:22px;border-bottom:1px solid ${C.line2}">
    <div style="display:grid;gap:10px">
      <p class="eyebrow">Motion · micro-interactions</p>
      <h1 class="h1" style="font-size:52px">Every touch <span style="color:${C.text3}">answers back</span>.</h1>
      <p class="sub" style="max-width:640px;font-size:15px;line-height:1.6">Motion is a reply, never decoration. Something moves only when state changes, it travels short distances, and it settles fast. Below, every interaction in the app loops with the exact timing and easing it ships with.</p>
    </div>
    <div style="display:grid;gap:10px;padding:18px 20px;border:1px solid ${C.line};border-radius:20px;background:${C.card}">
      <span class="eyebrow">Duration scale</span>
      ${[['Hover', '120 ms'], ['Press', '80 ms'], ['State change', '180 ms'], ['Enter / leave', '260 ms'], ['Page reveal', '420 ms · 50 ms stagger'], ['Figures', '700 ms']].map(([k, v]) => `<div style="display:flex;justify-content:space-between;gap:12px;font-size:13px;border-top:1px solid ${C.line};padding-top:8px"><span>${k}</span><span class="mono" style="font-size:12px;color:${C.ink2}">${v}</span></div>`).join('')}
    </div>
  </header>

  <section style="display:grid;grid-template-columns:repeat(3,1fr);gap:24px;padding:22px 24px;border:1px solid ${C.line};border-radius:20px;background:${C.card}">
    ${curve(0.2, 0.8, 0.2, 1, 'Out', '--ease-out · everything that arrives or changes state')}
    ${curve(0.34, 1.56, 0.64, 1, 'Spring', '--ease-spring · toggles, checks, badges that pop in')}
    ${curve(0.65, 0, 0.35, 1, 'In-out', '--ease-in-out · anything that travels between two places')}
  </section>

  <section style="display:grid;grid-template-columns:repeat(3,1fr);gap:20px">
    ${card('01', 'Complete a chore', d1, 'Press Done. The ring fills, the check draws itself, the tile settles to moss and the row flashes once.', '80 ms press · 300 ms check · ease-out · row flash 400 ms')}
    ${card('02', 'Balances count up', d2, 'Figures never just appear. On load the balance counts to its value and the paid bar grows with it.', '700 ms · ease-out · starts 120 ms after reveal')}
    ${card('03', 'Hover and press', d3, 'Buttons lift one pixel on hover, gain a shadow, and compress on press. Same rule for every button.', 'hover 120 ms · press 80 ms · translateY(-1px) · scale(.98)')}
    ${card('04', 'Navigation state', d4, 'The active pill slides between items instead of jumping. The label weight follows it.', '200 ms · ease-out · shared layout transition')}
    ${card('05', 'Toggles', d5, 'The thumb overshoots slightly and settles. The track colour crossfades underneath it.', '220 ms · ease-spring · track 200 ms ease-out')}
    ${card('06', 'Page reveal', d6, 'Sections rise 10px into place in reading order. One choreography per page, never on scroll.', '420 ms · ease-out · 50 ms stagger · max 8 items')}
    ${card('07', 'Toast', d7, 'Confirmations slide up from the bottom edge, hold, and leave the same way. Undo lives inside it.', 'in 240 ms · hold 4.5 s · out 200 ms · ease-out')}
    ${card('08', 'Modals', d8, 'The backdrop fades while the sheet scales from 96% and rises 8px. Closing reverses at 80% speed.', 'backdrop 160 ms · sheet 200 ms · ease-out')}
    ${card('09', 'Date strip', d9, 'Selecting a day glides the highlight across the strip. The counts underneath stay put.', '200 ms · ease-out · translateX only')}
    ${card('10', 'Driveway reorder', d10, 'A car lifts and casts a shadow while dragging. Siblings slide out of the way and the numbers update on drop.', 'lift 120 ms · siblings 180 ms · drop 200 ms · ease-out')}
    ${card('11', 'Confirm a payment', d11, 'Confirm becomes a spinner, then a check. The button widens to fit the new word and turns moss.', 'spinner after 150 ms · morph 260 ms · ease-spring')}
    ${card('12', 'Loading', d12, 'Rows shimmer in the exact shape of the content they become, then crossfade into the real thing.', 'shimmer 1.4 s loop · crossfade 260 ms · ease-out')}
  </section>

  <section style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px">
    ${[['Only on change', 'Nothing animates on scroll, on hover of static text, or for its own sake. Motion marks a change in state.'], ['Short distances', 'Reveals travel 10px. Slides travel the distance between two real positions and no further.'], ['Settle fast', 'Everything lands under 300 ms except figures and the page reveal. Springs are for things you flip.'], ['Respect the switch', 'With reduced motion on, every animation and transition is removed. The design still reads without them.']].map(([t, d]) => `<div class="sheet" style="padding:20px 22px;display:grid;gap:8px"><span class="serif" style="font-size:22px;line-height:1.15">${t}</span><p class="small" style="line-height:1.55">${d}</p></div>`).join('')}
  </section>
</div>`
  return doc(body, { extraCss: demoCss })
}

export function commandPalette() {
  const row = (ic, label, keys, on = false, tone = 'sunk') => `<div style="display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:12px;padding:9px 12px;border-radius:8px;background:${on ? 'rgba(59,107,255,.09)' : 'transparent'};color:${on ? C.ever : C.ink}">${tile(ic, on ? 'ever' : tone, 26, 7)}<span style="font-size:13.5px;font-weight:${on ? 600 : 500}">${label}</span><span style="display:flex;gap:4px">${keys.map((k) => `<span class="kbd">${k}</span>`).join('')}</span></div>`
  const group = (t) => `<span class="mono" style="display:block;padding:10px 12px 4px;font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;color:${C.muted}">${t}</span>`
  const body = `<div style="position:relative;width:760px;height:600px;background:${C.paper};overflow:hidden">
  <div style="position:absolute;inset:0;display:grid;grid-template-columns:200px 1fr;filter:blur(2px);opacity:.7">
    <div style="border-right:1px solid ${C.line};padding:24px 16px;display:grid;gap:8px;align-content:start">${[60, 80, 50, 70, 65, 55].map((w) => `<span style="display:block;height:10px;width:${w}%;border-radius:5px;background:${C.sunk}"></span>`).join('')}</div>
    <div style="padding:32px 40px;display:grid;gap:14px;align-content:start"><span class="display" style="font-size:36px">Welcome in, <span style="color:${C.text3}">Brandon</span></span>${[70, 45, 60, 52, 66].map((w) => `<span style="display:block;height:10px;width:${w}%;border-radius:5px;background:${C.sunk}"></span>`).join('')}</div>
  </div>
  <div style="position:absolute;inset:0;background:rgba(0,0,0,.42)"></div>
  <section role="dialog" aria-modal="true" class="sheet" style="position:absolute;left:100px;top:64px;width:560px;border-radius:20px;box-shadow:0 40px 100px -20px rgba(0,0,0,.8);overflow:hidden;background:${C.card}">
    <div style="display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid ${C.line}">${icon('search', 18, { color: C.muted })}<span style="flex:1;font-size:15px;color:${C.ink}">new ch<span style="display:inline-block;width:1.5px;height:18px;background:${C.pink};vertical-align:-3px;margin-left:1px"></span></span><span class="kbd">esc</span></div>
    <div style="padding:6px 6px 8px;display:grid">
      ${group('Actions')}
      ${row('chores', 'New chore', ['C'], true)}
      ${row('cart', 'Add a shared purchase', ['P'])}
      ${row('calendarPlus', 'Add an event', ['E'])}
      ${row('car', 'Schedule an exit', ['X'])}
      ${row('cards', 'Settle up', ['S'])}
      ${group('Jump to')}
      ${row('home', 'Overview', ['G', 'O'])}
      ${row('wallet', 'Money', ['G', 'M'])}
      ${row('settings', 'Settings', ['G', 'S'])}
    </div>
    <div style="display:flex;align-items:center;gap:16px;padding:10px 16px;border-top:1px solid ${C.line};background:${C.inner};font-size:11.5px;color:${C.muted}">
      <span style="display:inline-flex;align-items:center;gap:6px"><span class="kbd">↑</span><span class="kbd">↓</span>navigate</span>
      <span style="display:inline-flex;align-items:center;gap:6px"><span class="kbd">↵</span>select</span>
      <span style="display:inline-flex;align-items:center;gap:6px;margin-left:auto"><span class="kbd">⌘</span><span class="kbd">K</span>from anywhere</span>
    </div>
  </section>
</div>`
  return doc(body)
}
