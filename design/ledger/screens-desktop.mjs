import {
  C, M, MEMBERS, HOUSE,
  icon, avatar, avatarStack, badge, pill, btn, iconBtn, tile, check, toggle, field, statusDot,
  progress, kpi, lineChart, segmented, select, arrowBtn,
  shell, pageHeader, cardHead, doc,
} from './lib.mjs'

const SPEND_PINK = [12, 18, 30, 26, 44, 38, 20, 14, 22, 48, 41, 24, 16, 28, 34]
const SPEND_BLUE = [6, 10, 14, 12, 20, 16, 9, 8, 12, 18, 22, 11, 8, 13, 15]

function spendChart(w = 560, h = 230) {
  return lineChart({
    w, h, pink: SPEND_PINK, blue: SPEND_BLUE,
    yLabels: ['$60', '$40', '$20', '$0'],
    xLabels: ['8 Aug', '15 Aug', '22 Aug', '29 Aug', '5 Sep'],
    tip: { index: 9, title: '4 September', value: '$48.36 · Household' },
  })
}

function legend() {
  return `<span style="display:flex;gap:14px;font-size:12px;font-weight:600;color:${C.text2}"><span style="display:inline-flex;align-items:center;gap:6px">${statusDot('chore')}House</span><span style="display:inline-flex;align-items:center;gap:6px"><span class="dot" style="background:#5b7cff"></span>Your share</span></span>`
}

function personRow(m, sub, size = 34) {
  return `<div style="display:flex;align-items:center;gap:10px;padding-top:12px;border-top:1px solid ${C.line}">${avatar(m, size)}<div style="display:grid;line-height:1.25;min-width:0"><span style="font-size:13px;font-weight:700">${m.name}</span><span class="tiny" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${sub}</span></div></div>`
}

// Chore card in the style of the reference's incident cards.
function choreCard({ status, tone, meta, title, body, who, action }) {
  return `<div class="inner" style="padding:16px;display:grid;gap:12px;align-content:start">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px">${pill(status, tone)}<span class="tiny" style="text-align:right;line-height:1.3">${meta}</span></div>
    <div style="display:grid;gap:4px"><span class="h3">${title}</span><p class="small" style="color:${C.text2}">${body}</p></div>
    ${personRow(who.m, who.sub)}
    ${action ? `<div style="display:flex;gap:8px">${action}</div>` : ''}
  </div>`
}

// ============================================================ OVERVIEW
export function overview() {
  const summaryRow = (color, label, count) => `<div class="inner" style="display:flex;align-items:center;gap:10px;padding:10px 12px 10px 14px">${'<span class="dot" style="background:' + color + '"></span>'}<span style="font-size:13.5px;font-weight:700;flex:1">${label}</span><span class="pill" style="height:26px;padding:0 10px;background:${C.raise};font-size:12px">${count}</span></div>`

  const bubble = (size, color, pct, label, fg, x, y, z) => `<div style="position:absolute;left:${x}px;top:${y}px;z-index:${z};display:grid;place-items:center;align-content:center;width:${size}px;height:${size}px;border-radius:999px;background:${color};color:${fg};box-shadow:0 18px 40px -20px rgba(0,0,0,.8)"><span class="display" style="font-size:${size > 120 ? 30 : size > 90 ? 20 : 14}px;line-height:1">${pct}</span><span style="font-size:${size > 120 ? 12 : 10.5}px;font-weight:600;opacity:.85">${label}</span></div>`

  const quick = (ic, label) => `<a href="#" class="inner" style="display:flex;align-items:center;gap:10px;padding:12px 14px;font-size:13px;font-weight:700;color:${C.text}">${tile(ic, 'sunk', 30, 9)}${label}</a>`

  const main = `
<section style="display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:end;gap:40px;padding:12px 4px 6px">
  <div style="display:grid;gap:26px;min-width:0">
    <div style="display:grid;gap:6px">
      <h1 class="h1" style="font-size:40px">Welcome in, <span style="color:${C.text3}">Brandon</span></h1>
      <p class="sub">Sunday, September 6 · Here’s what the house needs from you today.</p>
    </div>
    <div style="display:grid;grid-template-columns:132px 148px 176px 118px;gap:12px">
      ${progress('Chores done', 60, 'pink')}
      ${progress('Rent collected', 50, 'white')}
      ${progress('Bills paid', 50, 'gray')}
      ${progress('Budget used', 15, 'hatch')}
    </div>
  </div>
  <div style="display:flex;gap:44px;padding-bottom:2px">
    ${kpi('2', 'Chores today', { tone: 'green', ic: 'check', delta: '+1' })}
    ${kpi('2', 'Days to rent', { tone: 'pink', ic: 'calendar', delta: 'Tue' })}
    ${kpi('$18', 'Owed to you', { tone: 'blue', ic: 'trendUp', delta: '+12%' })}
  </div>
</section>

<section style="display:grid;grid-template-columns:300px minmax(0,1fr) 300px;gap:20px;align-items:stretch">
  <div class="card" style="display:grid;grid-template-rows:auto 1fr auto;gap:10px;padding:0 0 16px">
    ${cardHead('Summary')}
    <div style="display:grid;gap:8px;padding:0 16px;align-content:start">
      ${summaryRow(C.pink, 'Assigned', 2)}
      ${summaryRow(C.blue, 'Completed', 7)}
      ${summaryRow(C.text3, 'Missed', 1)}
    </div>
    <div style="display:flex;align-items:center;gap:10px;padding:0 18px"><span style="display:grid;place-items:center;width:22px;height:22px;border-radius:999px;background:${C.raise};color:${C.green}">${icon('trendUp', 12, { stroke: 2.6 })}</span><span class="tiny">Completions climbed in September, <span style="color:${C.text}">keep the streak alive</span>.</span></div>
  </div>

  <div class="card" style="display:grid;grid-template-rows:auto 1fr;padding:0 0 10px;min-width:0">
    ${cardHead('Spending', { right: legend() + segmented(['12 months', '30 days', '1 week'], '30 days') })}
    <div style="padding:0 12px 0 8px;display:grid;justify-items:center">${spendChart(660, 226)}</div>
  </div>

  <div class="blue-card" style="display:grid;grid-template-rows:auto auto 1fr;gap:12px;padding:20px 20px 18px">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px"><h2 class="h2" style="color:#fff">Rent is due Tuesday</h2>${arrowBtn()}</div>
    <p style="font-size:13px;line-height:1.5;color:rgba(255,255,255,.85)">Monthly rent is <strong>$3,200.00</strong>, split four ways. Two of your roommates have already paid.</p>
    <div style="display:grid;gap:8px;align-self:end">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-radius:12px;background:#fff;color:${C.bg};box-shadow:0 10px 24px -12px rgba(0,0,0,.5)"><span style="font-size:13px;font-weight:700">Your share</span><span class="pill pill-white" style="height:26px;background:${C.bg};color:#fff;border-color:transparent;font-size:12px">$800.00</span></div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin:0 0 0 14px;padding:12px 14px;border-radius:12px;background:#fff;color:${C.bg};box-shadow:0 10px 24px -12px rgba(0,0,0,.5)"><span style="font-size:13px;font-weight:700">Paid so far</span><span class="pill" style="height:26px;background:${C.bg};color:#fff;border-color:transparent;font-size:12px">2 of 4</span></div>
    </div>
  </div>
</section>

<section style="display:grid;grid-template-columns:minmax(0,1.3fr) 300px minmax(0,1fr);gap:20px;align-items:stretch">
  <div class="card" style="display:grid;grid-template-rows:auto 1fr;padding:0 0 16px">
    ${cardHead('Active chores', { right: select('Newest') + select('All') })}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:0 16px">
      ${choreCard({ status: 'Your turn', tone: 'white', meta: 'Kitchen<br>Today · 11:59 PM', title: 'Stove &amp; counters', body: 'Wipe the stove, the counters and the sink. Next reminder at 10:00 PM.', who: { m: M.brandon, sub: 'brandon@example.com' }, action: btn('Mark done', { size: 'sm', icon: 'check' }) })}
      ${choreCard({ status: 'Assigned', tone: 'blue', meta: 'Outside<br>Today · 10:00 PM', title: 'Garbage to the curb', body: 'Bins and recycling out by ten. Next reminder at 6:00 PM.', who: { m: M.noah, sub: 'noah@example.com' } })}
    </div>
  </div>

  <div class="card" style="display:grid;grid-template-rows:auto 1fr;padding:0 0 12px;overflow:hidden">
    ${cardHead('This month', { right: arrowBtn(`background:${C.raise};color:${C.text}`) })}
    <div style="position:relative;height:220px">
      ${bubble(150, C.pink, '70%', 'Completed', '#fff', 18, 22, 2)}
      ${bubble(76, C.raise, '10%', 'Missed', C.text, 168, 26, 1)}
      ${bubble(100, C.blue, '20%', 'Assigned', '#fff', 150, 112, 3)}
    </div>
  </div>

  <div class="card" style="display:grid;grid-template-rows:auto 1fr auto;gap:14px;padding:20px 18px 18px">
    <div style="display:grid;gap:4px">
      <span style="display:flex;align-items:center;gap:8px;font-size:15px;font-weight:700">Hi, Brandon <span style="color:${C.amber}">${icon('hand', 18)}</span></span>
      <h2 class="h2">What needs doing?</h2>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;align-content:start">
      ${quick('chores', 'Add a chore')}
      ${quick('cart', 'Add purchase')}
      ${quick('calendarPlus', 'Add an event')}
      ${quick('car', 'Schedule exit')}
    </div>
    <div class="input round" style="height:44px;padding-right:6px"><span class="ph" style="flex:1">Search or jump to…</span><span style="display:grid;place-items:center;width:32px;height:32px;border-radius:999px;background:${C.raise};color:${C.text2}">${icon('sparkle', 15)}</span></div>
  </div>
</section>`

  return doc(shell({ active: 'overview', main, height: 980 }))
}

// ============================================================ CHORES
export function chores() {
  const stat = (n, label, tone, ic, first) => `<div style="display:flex;align-items:center;gap:16px;padding:22px 26px;${first ? '' : `border-left:1px solid ${C.line}`}">${tile(ic, tone, 44, 14)}<div style="display:grid;gap:2px"><span class="display" style="font-size:34px;line-height:1">${n}</span><span class="small" style="font-weight:600">${label}</span></div></div>`

  const routine = ({ title, area, label, next, time, manual, first }) => `<div class="rowh" style="display:grid;grid-template-columns:auto minmax(0,1fr) auto auto auto;align-items:center;gap:16px;padding:14px 10px;${first ? '' : `border-top:1px solid ${C.line}`}">
    ${tile('rotate', 'blue', 40, 12)}
    <div style="display:grid;gap:2px;min-width:0"><span class="h3">${title}</span><span class="small">${area} · ${label}</span></div>
    <div style="display:flex;align-items:center;gap:8px">${avatar(next, 28)}<span style="display:grid;line-height:1.2"><span class="tiny">Next up</span><span style="font-size:13px;font-weight:700">${next.name}</span></span></div>
    ${pill(icon('clock', 13) + time, '', 'height:28px')}
    <div style="display:flex;gap:4px">${manual ? btn('Assign', { variant: 'ghost', size: 'sm' }) : ''}${btn('', { variant: 'ghost', size: 'sm', icon: 'pause', extra: 'width:32px;padding:0' })}${btn('', { variant: 'ghost', size: 'sm', icon: 'pencil', extra: 'width:32px;padding:0' })}</div>
  </div>`

  const main = `
${pageHeader({ title: 'Chores', sub: 'Do your chores... or else.', actions: btn('New chore', { icon: 'plus' }) })}

<section class="card" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr))">
  ${stat(7, 'Completed this month', 'green', 'checkCircle', true)}
  ${stat(3, 'Active rotations', 'blue', 'rotate')}
  ${stat(1, 'Open infraction', 'pink', 'alert')}
</section>

<section class="card" style="padding:0 0 16px">
  ${cardHead('Coming up', { sub: 'Server-confirmed deadlines in Toronto time.', right: segmented(['Everyone', 'Mine'], 'Everyone') })}
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;padding:0 16px">
    ${choreCard({ status: 'Your turn', tone: 'white', meta: 'Kitchen<br>Today · 11:59 PM', title: 'Stove &amp; counters', body: 'Wipe the stove, the counters and the sink. Next reminder at 10:00 PM.', who: { m: M.brandon, sub: 'brandon@example.com' }, action: btn('Mark done', { size: 'sm', icon: 'check' }) + btn('Not yet', { variant: 'ghost', size: 'sm' }) })}
    ${choreCard({ status: 'Assigned', tone: 'blue', meta: 'Outside<br>Today · 10:00 PM', title: 'Garbage to the curb', body: 'Bins and recycling out by ten. Next reminder at 6:00 PM.', who: { m: M.noah, sub: 'noah@example.com' } })}
    ${choreCard({ status: 'Assigned', tone: 'blue', meta: 'Bathroom<br>Tue, Sep 8 · 11:59 PM', title: 'Clean the bathroom', body: 'Mirror, sink, toilet, shower and floor. Next reminder at 9:00 AM.', who: { m: M.maya, sub: 'maya@example.com' } })}
  </div>
</section>

<section style="display:grid;grid-template-columns:minmax(0,1.35fr) minmax(320px,.65fr);gap:20px;align-items:start">
  <div class="card" style="padding:0 22px 8px">
    ${cardHead('House routines', { pad: '20px 0 8px', right: btn('Add routine', { variant: 'ghost', size: 'sm', icon: 'plus' }) })}
    ${routine({ freq: 'Weekly', title: 'Clean the bathroom', area: 'Bathroom', label: 'Every Tuesday', next: M.maya, time: '11:59 PM', first: true })}
    ${routine({ freq: 'Daily', title: 'Stove &amp; counters', area: 'Kitchen', label: 'Every 2 days', next: M.liam, time: '11:59 PM' })}
    ${routine({ freq: 'Weekly', title: 'Garbage to the curb', area: 'Outside', label: 'Thursday nights', next: M.noah, time: '10:00 PM' })}
  </div>

  <div class="card" style="padding:20px 22px;display:grid;gap:16px">
    <div style="display:flex;align-items:center;justify-content:space-between"><h2 class="h2">Infractions</h2>${pill('Peer review', '')}</div>
    <div class="inner" style="padding:16px;display:grid;gap:14px">
      <div style="display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:12px">
        ${avatar(M.liam, 36)}
        <div style="display:grid;gap:2px"><span class="h3">Liam · Vacuum the kitchen</span><span class="small"><span class="fig" style="color:${C.text}">$15.00</span> pending</span></div>
        ${pill('Disputed', 'pink')}
      </div>
      <blockquote class="quote" style="margin:0;padding:12px 14px;border-radius:10px;background:${C.card};border:1px solid ${C.line}">“The vacuum battery would not charge.”</blockquote>
      <div style="display:flex;align-items:center;gap:14px">
        <div style="display:grid;place-items:center;width:64px;height:64px;border-radius:999px;background:${C.greenSoft};color:${C.green}"><span class="display" style="font-size:20px;line-height:1">1</span><span style="font-size:10px;font-weight:700">excuse</span></div>
        <div style="display:grid;place-items:center;width:64px;height:64px;border-radius:999px;background:${C.pinkSoft};color:#ff7fae"><span class="display" style="font-size:20px;line-height:1">1</span><span style="font-size:10px;font-weight:700">uphold</span></div>
        <span class="small" style="margin-left:auto;display:inline-flex;align-items:center;gap:6px;text-align:right">${icon('scale', 14)}Review closes<br>Today · 8:00 PM</span>
      </div>
      <div style="display:flex;gap:8px">${btn('Excuse', { variant: 'secondary', extra: 'flex:1' })}${btn('Uphold', { variant: 'pink', extra: 'flex:1' })}</div>
    </div>
  </div>
</section>`

  return doc(shell({ active: 'chores', main, height: 1180 }))
}

// ============================================================ MONEY
export function money() {
  const bal = (m, label, amount, tone) => `<div style="display:flex;align-items:center;gap:12px;padding:12px 0;${last ? '' : `border-bottom:1px solid ${C.line}`}">${avatar(m, 36)}<div style="display:grid;line-height:1.25;min-width:0;flex:1"><span style="font-size:13.5px;font-weight:700">${m.name}</span><span class="tiny">${label}</span></div>${badge(amount, tone)}</div>`

  const dateLabel = (d) => `<p class="tiny" style="padding:14px 0 4px;font-weight:700;letter-spacing:.04em;text-transform:uppercase">${d}</p>`
  const act = ({ iconName, tone, title, sub, who, whoLabel, amount, cls = '', actions }) => `<div class="rowh" style="display:grid;grid-template-columns:40px minmax(0,1fr) 140px auto;align-items:center;gap:14px;padding:10px;border-bottom:1px solid ${C.line}">
    ${tile(iconName, tone, 40, 999)}
    <div style="display:grid;min-width:0"><span class="h3" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${title}</span><span class="small" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${sub}</span></div>
    <div style="display:flex;align-items:center;gap:8px;min-width:0">${avatar(who, 26)}<span class="small" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${whoLabel}</span></div>
    <div style="display:flex;align-items:center;gap:8px"><span class="fig ${cls}" style="min-width:76px;text-align:right;font-size:14px;font-weight:700">${amount}</span>${actions}</div>
  </div>`
  const ib = (n) => `<button type="button" class="btn btn-ghost" style="width:32px;height:32px;padding:0;border-radius:999px;color:${C.text3}">${icon(n, 16)}</button>`

  const bill = ({ iconName, tone, name, due, amount, paid }) => `<div class="rowh" style="display:grid;grid-template-columns:40px minmax(0,1fr) auto 28px;align-items:center;gap:14px;padding:11px 10px;border-bottom:1px solid ${C.line}">
    ${tile(iconName, tone, 40, 12)}
    <div style="display:grid;min-width:0"><span class="h3">${name}</span><span class="tiny">Due ${due}</span></div>
    <div style="text-align:right;display:grid"><span class="fig" style="font-size:14px;font-weight:700">${amount}</span><span class="tiny">Brandon</span></div>
    <span style="display:grid;place-items:center">${paid ? icon('checkCircle', 22, { color: C.green, stroke: 2 }) : icon('circle', 22, { color: C.text4 })}</span>
  </div>`

  const main = `
${pageHeader({ title: 'Shared money', sub: 'Every purchase, share and payment stays balanced and traceable.', actions: btn('Settle up', { variant: 'secondary', icon: 'cards' }) + btn('Add purchase', { icon: 'plus' }) })}

<section style="display:grid;grid-template-columns:320px minmax(0,1fr) 320px;gap:20px;align-items:stretch">
  <div class="blue-card" style="display:grid;grid-template-rows:auto 1fr auto;gap:14px;padding:22px 22px 20px">
    <div style="display:flex;align-items:flex-start;justify-content:space-between"><span class="eyebrow" style="color:rgba(255,255,255,.75)">Your house balance</span>${arrowBtn()}</div>
    <div style="display:grid;gap:4px;align-content:center"><span class="display" style="font-size:52px;line-height:1;color:#fff">+$18.27</span><span style="font-size:13px;font-weight:600;color:rgba(255,255,255,.85)">The house owes you · house spend <strong>$72.36</strong></span></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div style="padding:12px 14px;border-radius:12px;background:#fff;color:${C.bg};display:grid;gap:2px"><span class="tiny" style="color:${C.text3}">Paid</span><span class="fig" style="font-size:16px;font-weight:800">$48.36</span></div>
      <div style="padding:12px 14px;border-radius:12px;background:rgba(255,255,255,.16);color:#fff;display:grid;gap:2px;border:1px solid rgba(255,255,255,.2)"><span class="tiny" style="color:rgba(255,255,255,.75)">Used</span><span class="fig" style="font-size:16px;font-weight:800">$18.09</span></div>
    </div>
  </div>

  <div class="card" style="display:grid;grid-template-rows:auto 1fr;padding:0 0 10px;min-width:0">
    ${cardHead('Spending', { right: legend() + segmented(['12 months', '30 days', '1 week'], '30 days') })}
    <div style="padding:0 12px 0 8px;display:grid;justify-items:center">${spendChart(640, 226)}</div>
  </div>

  <div class="card" style="padding:0 22px 6px">
    ${cardHead('Balances', { pad: '20px 0 6px', right: `<span class="tiny">73% paid</span>` })}
    ${bal(M.brandon, 'You · settled with everyone', '+$18.27', 'green')}
    ${bal(M.maya, 'Owes you', '-$6.09', 'red')}
    ${bal(M.liam, 'Owes you · $15.00 penalty', '-$6.09', 'red')}
    ${bal(M.noah, 'Owes you · payment pending', '-$6.09', 'red', true)}
  </div>
</section>

<section style="display:grid;grid-template-columns:minmax(0,1.4fr) minmax(360px,.8fr);gap:20px;align-items:start">
  <div class="card" style="padding:0 22px 14px">
    ${cardHead('Recent activity', { pad: '20px 0 10px', right: segmented(['All', 'Purchases', 'Payments'], 'All') })}
    ${dateLabel('September 6, 2026')}
    ${act({ iconName: 'arrowUpRight', tone: 'amber', title: 'Payment to Brandon', sub: 'Settling up for shared supplies', who: M.noah, whoLabel: 'Noah paid', amount: '+$12.00', actions: btn('Reject', { variant: 'ghost', size: 'sm' }) + btn('Confirm', { size: 'sm', icon: 'check' }) })}
    ${dateLabel('September 4, 2026')}
    ${act({ iconName: 'home', tone: 'blue', title: 'Toilet paper &amp; paper towel', sub: 'Shared home essentials · Receipt attached', who: M.brandon, whoLabel: 'Brandon paid', amount: '$48.36', actions: ib('camera') + ib('rotate') })}
    ${dateLabel('September 1, 2026')}
    ${act({ iconName: 'cart', tone: 'green', title: 'Kitchen spices', sub: 'Food and grocery runs', who: M.maya, whoLabel: 'Maya &amp; Liam paid', amount: '$24.00', actions: `<span style="color:${C.text4};display:grid;place-items:center;width:32px">${icon('chevronRight', 17)}</span>` })}
    <a href="#" class="link" style="margin-top:14px;font-size:12.5px;color:${C.text2}">View all activity ${icon('arrowRight', 14)}</a>
  </div>

  <div style="display:grid;gap:20px">
    <div class="card" style="padding:0 22px 12px">
      <div style="display:grid;gap:12px;padding:20px 0 12px">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px"><div style="display:grid;gap:2px"><h2 class="h2">Utilities &amp; rent</h2><span class="tiny">Track your individual payment each month.</span></div>${btn('Add bill', { variant: 'ghost', size: 'sm', icon: 'plus' })}</div>
        <span class="nav-pill" style="justify-self:start;padding:3px;display:inline-flex;align-items:center"><span class="nav-item" style="height:30px;padding:0 10px">${icon('chevronLeft', 14)}</span><span class="nav-item on" style="height:30px;padding:0 16px;font-size:12.5px">September 2026</span><span class="nav-item" style="height:30px;padding:0 10px">${icon('chevronRight', 14)}</span></span>
      </div>
      ${bill({ iconName: 'building', tone: 'blue', name: 'Monthly rent', due: 'Sep 8, 2026', amount: '$3,200.00', paid: false })}
      ${bill({ iconName: 'wifi', tone: 'violet', name: 'Internet', due: 'Sep 14, 2026', amount: '$89.00', paid: true })}
    </div>

    <div class="card" style="padding:18px 22px;display:grid;gap:12px">
      <div style="display:flex;align-items:center;justify-content:space-between"><h2 class="h2">Penalty account</h2>${pill('Separate', '')}</div>
      <div class="inner" style="display:flex;align-items:center;gap:14px;padding:12px 14px">
        ${tile('arrowDownLeft', 'pink', 40, 12)}
        <div style="display:grid;gap:2px"><span class="h3"><span class="fig">$15.00</span> outstanding</span><span class="tiny">Kept separate from shared purchase balances</span></div>
        <span style="margin-left:auto;color:${C.text4}">${icon('chevronRight', 17)}</span>
      </div>
    </div>
  </div>
</section>`

  return doc(shell({ active: 'money', main, height: 1150 }))
}

// ============================================================ CALENDAR
export function calendar() {
  const cells = []
  for (let i = 0; i < 42; i++) {
    const day = i === 0 ? 31 : i <= 30 ? i : i - 30
    const outside = i === 0 || i > 30
    const events = new Set([6, 7, 8, 10]).has(day) && !outside
    const selected = day === 8 && !outside
    const today = day === 6 && !outside
    cells.push(`<button type="button" style="position:relative;display:grid;place-items:center;height:40px;border:0;border-radius:999px;background:${selected ? C.white : today ? C.raise : 'transparent'};color:${selected ? C.bg : outside ? C.text4 : C.text};font-family:inherit;font-size:13px;font-weight:${selected || today ? 800 : 600};padding:0;cursor:pointer">${day}${events ? `<i style="position:absolute;bottom:5px;width:4px;height:4px;border-radius:999px;background:${selected ? C.pink : C.pink}"></i>` : ''}</button>`)
  }
  const week = [['Mon', 7], ['Tue', 8], ['Wed', 9], ['Thu', 10], ['Fri', 11], ['Sat', 12], ['Sun', 13]]
  const weekCell = ([d, n]) => {
    const on = n === 8
    const has = n === 7 || n === 8 || n === 10
    return `<button type="button" style="position:relative;display:grid;gap:2px;justify-items:center;align-content:center;min-height:64px;padding:8px 4px;border:1px solid ${on ? 'transparent' : C.line};border-radius:16px;background:${on ? C.white : C.inner};color:${on ? C.text3 : C.text3};font-family:inherit;cursor:pointer"><span style="font-size:10.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${on ? C.text4 : C.text3}">${d}</span><span class="display" style="font-size:20px;line-height:1;color:${on ? C.bg : C.text}">${n}</span>${has ? `<i style="position:absolute;bottom:7px;width:4px;height:4px;border-radius:999px;background:${C.pink}"></i>` : ''}</button>`
  }

  const evt = ({ time, end, title, kind, tone, place, who, extra }) => `<div class="inner" style="display:grid;grid-template-columns:92px minmax(0,1fr) auto;align-items:center;gap:16px;padding:14px 16px;border-left:3px solid ${tone}">
    <div style="display:grid;gap:2px"><span class="fig" style="font-size:13.5px;font-weight:700">${time}</span><span class="tiny">to ${end}</span></div>
    <div style="display:grid;gap:8px;min-width:0">
      <div style="display:flex;align-items:center;gap:8px"><span class="h3">${title}</span>${badge(kind, kind === 'exam' ? 'red' : 'violet')}</div>
      <p class="small" style="display:flex;gap:12px"><span style="display:inline-flex;align-items:center;gap:4px">${icon('pin', 13)}${place}</span><span style="display:inline-flex;align-items:center;gap:4px">${icon('users', 13)}everyone</span></p>
      ${extra || ''}
    </div>
    ${avatar(who, 30)}
  </div>`

  const chip = (time, code, kind, mins, people, color) => `<div class="card" style="display:grid;gap:4px;padding:10px 10px 10px 12px;border-radius:12px;box-shadow:inset 3px 0 0 ${color}"><span style="font-size:12px;font-weight:800">${time} · ${code}</span><span class="tiny">${kind} · ${mins} min</span>${avatarStack(people, 22)}</div>`
  const dayCol = (d, content, on) => `<div style="min-height:200px;padding:12px;border-left:1px solid ${C.line};background:${on ? 'rgba(255,255,255,.03)' : 'transparent'}"><span style="display:block;margin-bottom:10px;font-size:10.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${C.text3}">${d}</span><div style="display:grid;gap:8px">${content}</div></div>`
  const course = (code, color, name, meet, place, who, mine) => `<div class="inner" style="display:grid;gap:8px;padding:16px;border-left:3px solid ${color}">
    <div style="display:flex;align-items:center;justify-content:space-between"><span style="font-size:12px;font-weight:800;letter-spacing:.04em;color:${C.violet}">${code}</span>${avatar(who, 26)}</div>
    <span class="h3">${name}</span>
    <span class="small" style="display:flex;align-items:center;gap:6px">${icon('clock', 13)}${meet}</span>
    <span class="small" style="display:flex;align-items:center;gap:6px">${icon('pin', 13)}${place}</span>
    ${mine ? `<a href="#" class="link" style="margin-top:2px;font-size:12.5px">${icon('pencil', 13)}Edit course</a>` : ''}
  </div>`

  const main = `
${pageHeader({ title: 'Calendar', sub: 'Visits, exams and class schedules, shared with the right people.', actions: btn('Import .ics', { variant: 'secondary', icon: 'fileUp' }) + btn('Add event', { icon: 'plus' }) })}

<section style="display:grid;grid-template-columns:400px minmax(0,1fr);gap:20px;align-items:stretch">
  <div class="card" style="padding:20px 22px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
      <div style="display:grid;gap:2px"><span class="tiny" style="font-weight:700">2026</span><h2 class="h2" style="font-size:24px">September</h2></div>
      <div style="display:flex;gap:6px">${iconBtn('chevronLeft', { size: 34 })}${iconBtn('chevronRight', { size: 34 })}</div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(7,1fr);margin-bottom:6px">${['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => `<span style="text-align:center;font-size:10.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${C.text3}">${d}</span>`).join('')}</div>
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px">${cells.join('')}</div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-top:16px;padding-top:14px;border-top:1px solid ${C.line}"><a href="#" class="link" style="font-size:12.5px">${icon('calendar', 15)}Jump to today</a><span style="display:flex;gap:10px;font-size:11.5px;color:${C.text3}"><span style="display:inline-flex;align-items:center;gap:5px">${statusDot('chore')}Has events</span></span></div>
  </div>
  <div class="card" style="padding:20px 22px;display:grid;gap:18px;align-content:start;min-width:0">
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:8px">${week.map(weekCell).join('')}</div>
    <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:12px">
      <div style="display:grid;gap:2px"><span class="small">September 8, 2026</span><h2 class="h1" style="font-size:32px">Tuesday</h2></div>
      ${pill('2 events', '')}
    </div>
    <div style="display:grid;gap:10px">
      ${evt({ time: '9:00 AM', end: '11:00 AM', title: 'PHY 132 final exam', kind: 'exam', tone: C.red, place: 'EX 100', who: M.brandon, extra: `<div style="display:flex;align-items:center;gap:10px">${select('Exam', 'height:30px;font-size:12px')}<a href="#" class="link" style="font-size:12.5px">${icon('car', 14)}Leave 30 min before</a></div>` })}
      ${evt({ time: '2:00 PM', end: '3:00 PM', title: 'CSC 209 lecture', kind: 'class', tone: C.violet, place: 'BA 1170', who: M.liam })}
    </div>
  </div>
</section>

<section style="display:grid;grid-template-columns:minmax(0,1.5fr) minmax(360px,.7fr);gap:20px;align-items:start">
  <div class="card" style="padding:0 0 16px">
    ${cardHead('Everyone’s classes', { sub: 'Filter roommates, then pick a weekday for the combined agenda.', right: btn('Add class', { variant: 'secondary', size: 'sm', icon: 'plus' }) })}
    <div style="display:flex;gap:16px;padding:4px 22px 14px">${MEMBERS.map((m) => `<label style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700">${check(true)}${avatar(m, 22)}${m.name}</label>`).join('')}</div>
    <div style="display:grid;grid-template-columns:repeat(5,1fr);border-top:1px solid ${C.line};border-bottom:1px solid ${C.line}">
      ${dayCol('Mon', `<span class="tiny" style="text-align:center;padding:26px 0">No classes</span>`)}
      ${dayCol('Tue', chip('2:00 PM', 'CSC 209', 'lecture', 60, [M.brandon, M.liam], '#7ac26a'), true)}
      ${dayCol('Wed', `<span class="tiny" style="text-align:center;padding:26px 0">No classes</span>`)}
      ${dayCol('Thu', chip('4:00 PM', 'CSC 209', 'lab', 120, [M.brandon], '#7ac26a'))}
      ${dayCol('Fri', `<span class="tiny" style="text-align:center;padding:26px 0">No classes</span>`)}
    </div>
    <div style="display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:16px;padding:14px 22px 0">
      <div class="inner" style="display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:12px;padding:10px 14px;grid-column:1/-1"><span class="stripe" style="background:#7ac26a;height:34px"></span><div style="display:grid;gap:2px"><div style="display:flex;align-items:center;gap:8px"><span class="h3">CSC 209 · Software Tools &amp; Systems</span>${badge('Your class', 'green')}</div><span class="small">Tuesday 2:00 PM lecture · Thursday 4:00 PM lab · BA 1170</span></div><div style="display:flex;align-items:center;gap:10px">${avatarStack([M.brandon, M.liam], 26)}${btn('Edit mine', { variant: 'ghost', size: 'sm', icon: 'pencil' })}</div></div>
    </div>
  </div>
  <div class="card" style="padding:0 22px 22px;display:grid;gap:12px">
    ${cardHead('Calendar imports', { pad: '20px 0 4px', right: `<span class="tiny">2 courses</span>` })}
    ${course('PHY 132', M.brandon.color, 'Introduction to Physics II', 'Mon, Wed · 9:00 AM', 'MP 103', M.brandon, true)}
    ${course('CSC 209', M.liam.color, 'Software Tools &amp; Systems', 'Tue, Thu · 2:00 PM', 'BA 1170', M.liam, false)}
    <div style="display:flex;gap:10px;padding:12px 14px;border-radius:12px;background:${C.violetSoft};color:${C.violet}">${icon('graduation', 18)}<div style="display:grid;gap:2px"><span style="font-size:12.5px;font-weight:700">Full schedules are shared</span><span style="font-size:12px;color:rgba(155,140,255,.85)">Everyone in this house can see imported course details.</span></div></div>
  </div>
</section>`

  return doc(shell({ active: 'calendar', main, height: 1300 }))
}

// ============================================================ DRIVEWAY
export function driveway() {
  const car = (n, label, plate, color, who, last) => `<div class="rowh" style="display:grid;grid-template-columns:auto 22px auto minmax(0,1fr) auto auto;align-items:center;gap:14px;padding:14px 12px;${last ? '' : `border-bottom:1px solid ${C.line}`}">
    <span style="color:${C.text4};cursor:grab">${icon('grip', 18, { stroke: 2.5 })}</span>
    <span class="fig" style="text-align:center;font-size:12.5px;color:${C.text3}">${n}</span>
    <span style="display:grid;place-items:center;width:46px;height:36px;border-radius:10px;background:${color};color:#fff;box-shadow:0 10px 20px -12px ${color}">${icon('car', 20)}</span>
    <div style="display:grid;gap:2px"><span class="h3">${label}</span><span class="tiny" style="letter-spacing:.06em;font-weight:700">${plate}</span></div>
    ${pill(avatar(who, 20) + who.name, '', 'height:30px;padding:0 10px 0 5px')}
    ${n === 3 ? badge('Needs out 1:00 PM', 'pink') : badge('Parked', '')}
  </div>`

  const main = `
${pageHeader({ title: 'Driveway', sub: 'The current lineup decides exactly who needs to move.', actions: btn('Manage vehicles', { variant: 'secondary', icon: 'car' }) + btn('Quick remove', { variant: 'secondary', icon: 'logout' }) + btn('Schedule exit', { icon: 'plus' }) })}

<section style="display:grid;grid-template-columns:minmax(0,1.45fr) minmax(320px,.65fr);gap:20px;align-items:start">
  <div class="card" style="padding:0 0 22px">
    ${cardHead('Street to back', { sub: 'Drag cars to update the lineup. Everyone sees the same order.', right: pill(icon('route', 14) + 'Live', 'green', `background:${C.greenSoft};color:${C.green};border-color:rgba(61,220,151,.25)`) })}
    <div style="padding:0 22px;display:grid;gap:12px">
      <div style="display:flex;align-items:center;gap:12px;font-size:10.5px;font-weight:800;letter-spacing:.14em;color:${C.text3}"><span style="flex:1;height:1px;background:${C.line2}"></span>STREET / EXIT<span style="flex:1;height:1px;background:${C.line2}"></span></div>
      <div class="inner" style="padding:6px 6px">
        ${car(1, 'Blue Civic', 'MAYA 04', M.maya.color, M.maya)}
        ${car(2, 'Green Corolla', 'NOAH 12', M.noah.color, M.noah)}
        ${car(3, 'Red Mazda', 'BRNDN 7', M.brandon.color, M.brandon, true)}
      </div>
      <div style="display:flex;align-items:center;justify-content:center;gap:8px;font-size:10.5px;font-weight:800;letter-spacing:.14em;color:${C.text4}">${icon('arrowDown', 14)}BACK OF DRIVEWAY</div>
    </div>
  </div>

  <div style="display:grid;gap:20px">
    <div class="pink-card" style="padding:20px 20px 18px;display:grid;gap:14px">
      <div style="display:flex;align-items:flex-start;justify-content:space-between"><div style="display:grid;gap:2px"><span class="eyebrow" style="color:rgba(255,255,255,.8)">Who needs out</span><h2 class="h2" style="color:#fff">Red Mazda · 1:00 PM</h2></div>${arrowBtn()}</div>
      <p style="font-size:13px;line-height:1.5;color:rgba(255,255,255,.88)">Brandon leaves for <strong>PHY 132</strong> in about 3 hours. Two cars are parked in front and both owners get a reminder 60 minutes before.</p>
      <div style="display:grid;gap:8px">
        <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;background:#fff;color:${C.bg}">${avatar(M.maya, 26)}<span style="font-size:13px;font-weight:700;flex:1">Maya moves Blue Civic</span>${icon('bell', 15)}</div>
        <div style="display:flex;align-items:center;gap:10px;margin-left:14px;padding:10px 12px;border-radius:12px;background:#fff;color:${C.bg}">${avatar(M.noah, 26)}<span style="font-size:13px;font-weight:700;flex:1">Noah moves Green Corolla</span>${icon('bell', 15)}</div>
      </div>
    </div>
    <div class="card" style="padding:18px 22px;display:grid;gap:12px">
      <div style="display:flex;align-items:center;justify-content:space-between"><h2 class="h2">Departure</h2>${pill('in 3 hours', 'white')}</div>
      <div class="inner" style="display:flex;align-items:center;gap:12px;padding:12px 14px">${tile('clock', 'pink', 40, 12)}<div style="display:grid;gap:2px"><span class="h3">Today · 1:00 PM</span><span class="tiny">Alert 60 minutes before · source: PHY 132</span></div></div>
    </div>
  </div>
</section>`

  return doc(shell({ active: 'driveway', main, height: 820 }))
}

// ============================================================ SETTINGS
export function settings() {
  const feature = (ic, label, desc, on = true) => `<label class="inner" style="display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:14px;padding:14px 16px">${tile(ic, on ? 'blue' : 'sunk', 38, 11)}<div style="display:grid;gap:1px"><span class="h3">${label}</span><span class="tiny">${desc}</span></div>${toggle(on)}</label>`
  const health = (label, ok, value) => `<div style="display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:10px;min-height:42px;font-size:13px;border-top:1px solid ${C.line}">${ok ? icon('checkCircle', 17, { color: C.green }) : icon('circleAlert', 17, { color: C.amber })}<span>${label}</span><span class="small" style="font-weight:600">${value}</span></div>`
  const audit = (summary, meta, who) => `<div style="display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:12px;padding:12px 0;border-top:1px solid ${C.line}">${tile('history', 'sunk', 34, 10)}<div style="display:grid;gap:2px"><span style="font-size:13.5px;font-weight:700">${summary}</span><span class="tiny">${meta}</span></div>${avatar(who, 26)}</div>`
  const member = (m) => `<div style="display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:12px;padding:12px 0;border-top:1px solid ${C.line}">${avatar(m, 36)}<div style="display:grid;gap:1px"><span class="h3">${m.name}</span><span class="tiny">${m.email || 'House-code account'}</span></div>${badge(m.role, m.role === 'owner' ? 'amber' : '')}</div>`
  const access = (m, code) => `<div class="inner" style="display:grid;gap:12px;padding:14px 16px">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px"><div style="display:flex;align-items:center;gap:10px">${avatar(m, 30)}<div style="display:grid;gap:1px"><span class="h3">${m.name}</span><span class="tiny">${m.email || 'Device-based account'}</span></div></div><span style="color:${C.text3}">${icon('userX', 17)}</span></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">${btn('Give recovery code', { variant: 'secondary', size: 'sm', icon: 'key' })}${btn('Remove access', { variant: 'danger', size: 'sm' })}</div>
    ${code ? `<div style="display:grid;grid-template-columns:1fr auto;align-items:center;gap:4px 10px;padding:10px 12px;border-radius:10px;background:${C.blueSoft};border:1px solid rgba(59,107,255,.3)"><code style="font-family:inherit;font-size:12.5px;font-weight:800;letter-spacing:.08em;color:#9db4ff">${code}</code><span class="link" style="font-size:12px">${icon('copy', 13)}Copy</span><span class="tiny" style="grid-column:1/-1">Single use · expires in 30 days</span></div>` : ''}
  </div>`
  const detail = (k, v) => `<dt class="small">${k}</dt><dd style="margin:0;text-align:right;font-size:12.5px;font-weight:700">${v}</dd>`

  const main = `
${pageHeader({ title: 'Settings', sub: 'Manage people, reminders and the health of this installation.', actions: btn('Sign out', { variant: 'ghost', icon: 'logout' }) })}

<section style="display:grid;grid-template-columns:minmax(0,1.3fr) minmax(340px,.7fr);gap:20px;align-items:start">
  <div style="display:grid;gap:20px">
    <div class="card" style="padding:22px;display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:18px 24px">
      ${avatar(M.brandon, 88)}
      <div style="display:grid;gap:10px;max-width:440px">
        <span class="h2">Profile</span>
        ${field('Username', 'Brandon')}
        <div style="display:flex;gap:8px;align-items:center">${btn('Add picture', { variant: 'secondary', size: 'sm', icon: 'imagePlus' })}<span class="tiny">JPG, PNG, or WebP up to 5 MB.</span></div>
      </div>
      <div style="grid-column:2">${btn('Save profile', { size: 'sm' })}</div>
    </div>

    <div class="card" style="padding:0 22px 22px">
      ${cardHead('Features', { pad: '20px 0 12px', sub: 'Choose which tools this household uses. Overview and Settings are always available.' })}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        ${feature('chores', 'Chores', 'Rotations, deadlines and accountability')}
        ${feature('wallet', 'Shared money', 'Expenses, balances and settlements')}
        ${feature('calendar', 'Calendar', 'House events and reminders')}
        ${feature('graduation', 'Courses', 'Class schedules and ICS imports')}
        ${feature('car', 'Driveway', 'Vehicle order and departure alerts')}
        ${feature('bell', 'Notifications', 'Push reminders and diagnostics')}
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
      <div class="card" style="padding:20px 22px;display:grid;gap:12px;align-content:start">
        <div style="display:flex;align-items:center;gap:14px">${tile('bell', 'amber', 44, 14)}<div style="display:grid;gap:2px"><span class="h2" style="font-size:17px">Notification health</span><span class="tiny">Web Push is best-effort and cannot bypass Focus or silent mode.</span></div></div>
        <div style="display:grid">
          ${health('Installed on Home Screen', false, 'Needs attention')}
          ${health('Notification permission', false, 'default')}
          ${health('Active push subscription', false, 'Needs attention')}
          ${health('Last successful delivery', false, 'Not tested')}
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">${btn('Enable reminders', { size: 'sm', icon: 'bell' })}${btn('Send a test', { variant: 'secondary', size: 'sm', icon: 'send' })}</div>
      </div>
      <div class="card" style="padding:20px 22px;display:grid;gap:4px;align-content:start">
        <span class="h2" style="font-size:17px;margin-bottom:8px">Chore reminders</span>
        ${[['Morning assignment · 9:00 AM', true], ['Evening check-in · 6:00 PM', true], ['Last calls · 10:00 &amp; 11:30 PM', true]].map(([l, on]) => `<label style="display:flex;align-items:center;justify-content:space-between;min-height:48px;font-size:13.5px;font-weight:600;border-top:1px solid ${C.line}"><span>${l}</span>${toggle(on)}</label>`).join('')}
        <p class="tiny" style="display:flex;align-items:center;gap:6px;padding-top:10px;border-top:1px solid ${C.line}">${icon('clock', 13)}Individual chores can replace these household defaults.</p>
        <div style="margin-top:12px">${btn('Save defaults', { variant: 'secondary', size: 'sm' })}</div>
      </div>
    </div>

    <div class="card" style="padding:0 22px 8px">
      ${cardHead('Recent audit history', { pad: '20px 0 6px', right: pill('Transparency', '') })}
      ${audit('Completed Stove &amp; counters', 'task.completed · Fri, Sep 4 · 10:01 PM', M.brandon)}
      ${audit('Added Kitchen spices for $24.00', 'expense.created · Tue, Sep 1 · 12:10 PM', M.maya)}
    </div>
  </div>

  <div style="display:grid;gap:20px">
    <div class="card" style="padding:0 22px 8px">
      ${cardHead(HOUSE.name, { pad: '20px 0 6px', sub: '4 members', right: pill('Owner: you', 'white') })}
      ${MEMBERS.map(member).join('')}
    </div>

    <div class="blue-card" style="padding:20px 20px 18px;display:grid;gap:12px">
      <div style="display:flex;align-items:flex-start;justify-content:space-between"><div style="display:grid;gap:2px"><span class="eyebrow" style="color:rgba(255,255,255,.75)">Invite roommates</span><h2 class="h2" style="color:#fff">House share code</h2></div>${arrowBtn()}</div>
      <p style="font-size:13px;line-height:1.5;color:rgba(255,255,255,.85)">Roommates create a device-based account with this code. Rotating it immediately disables the old one.</p>
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-radius:12px;background:#fff;color:${C.bg}"><span style="font-size:13px;font-weight:700">Current code ends in</span><span style="font-size:14px;font-weight:800;letter-spacing:.1em">••DEMO</span></div>
      <div>${btn('Rotate and reveal code', { variant: 'primary', size: 'sm', icon: 'rotate' })}</div>
    </div>

    <div class="card" style="padding:0 22px 16px;display:grid;gap:10px">
      ${cardHead('Roommate access', { pad: '20px 0 4px', sub: 'Owner controls' })}
      ${access(M.maya)}${access(M.liam, 'REC-4K7Q-9M2X-BB31-7ZD0')}${access(M.noah)}
    </div>

    <div class="card" style="padding:20px 22px;display:grid;gap:12px">
      <div style="display:flex;align-items:center;gap:8px;font-size:14px;font-weight:700">${icon('shield', 18)}Household security</div>
      <dl style="margin:0;display:grid;grid-template-columns:1fr auto;gap:8px 16px">${detail('Timezone', HOUSE.timezone)}${detail('Currency', HOUSE.currency)}${detail('Address', HOUSE.address)}${detail('Features', '6 enabled')}</dl>
      <a href="#" class="small" style="display:inline-flex;align-items:center;gap:6px;color:${C.text2}">${icon('copy', 13)}Copy household ID</a>
    </div>
  </div>
</section>`

  return doc(shell({ active: 'settings', main, height: 1560 }))
}
