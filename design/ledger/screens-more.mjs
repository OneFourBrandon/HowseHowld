import {
  C, M, MEMBERS, HOUSE,
  icon, brandMark, avatar, avatarStack, badge, pill, btn, iconBtn, tile, check, radio, toggle, field,
  progress, kpi, segmented, select, arrowBtn,
  mobileShell, mobileTop, doc,
} from './lib.mjs'

// ============================================================ SIGN IN
export function signIn() {
  const seg = (label, ic, on) => `<button type="button" class="nav-item${on ? ' on' : ''}" style="height:40px;flex:1;justify-content:center;border:0;font-family:inherit;cursor:pointer;background:${on ? C.raise : 'transparent'}">${icon(ic, 16)}${label}</button>`
  const body = `<div style="position:relative;display:grid;grid-template-columns:1.05fr .95fr;width:1440px;height:900px;background:${C.bg};overflow:hidden">
  <span aria-hidden="true" style="position:absolute;left:-180px;top:-220px;width:720px;height:720px;border-radius:999px;background:radial-gradient(closest-side,rgba(242,80,140,.42),rgba(242,80,140,0))"></span>
  <span aria-hidden="true" style="position:absolute;left:300px;bottom:-320px;width:760px;height:760px;border-radius:999px;background:radial-gradient(closest-side,rgba(59,107,255,.38),rgba(59,107,255,0))"></span>
  <section style="position:relative;display:flex;flex-direction:column;justify-content:space-between;padding:52px 64px">
    <div style="display:flex;align-items:center;gap:12px">${brandMark(38)}<span style="font-size:18px;font-weight:800;letter-spacing:-.02em">HowseHowld</span></div>
    <div style="display:grid;gap:22px;max-width:620px">
      <span class="pill" style="justify-self:start;background:rgba(255,255,255,.06)">${icon('sparkle', 14, { color: C.pink })}One app, every house</span>
      <h1 class="display" style="font-size:92px;line-height:.95;letter-spacing:-.04em">Less chasing.<br><span style="color:${C.text3}">More living.</span></h1>
      <p style="max-width:470px;font-size:16px;line-height:1.6;color:${C.text2}">Each house gets its own private space for chores, money, schedules, vehicles and the routines that keep everyone moving.</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap">${['Chores', 'Shared money', 'Calendar', 'Driveway'].map((t) => pill(t, '', 'background:rgba(255,255,255,.05)')).join('')}</div>
    </div>
    <div style="display:flex;align-items:center;gap:8px;font-size:13px;color:${C.text3}">${icon('shield', 18)}Every household is isolated and private</div>
  </section>
  <main style="position:relative;display:grid;align-items:center;padding:64px 80px">
    <div class="card" style="width:100%;max-width:520px;margin:0 auto;padding:28px;display:grid;gap:24px;border-radius:28px;background:rgba(21,22,26,.9);backdrop-filter:blur(20px)">
      <div class="nav-pill" style="display:flex;padding:4px">${seg('Join with code', 'users', true)}${seg('Admin sign in', 'home', false)}</div>
      <div style="display:grid;gap:10px">
        <h2 class="h1" style="font-size:32px">Use a house or recovery code</h2>
        <p class="sub" style="line-height:1.6">Join with your house share code, or use a one-time recovery code from your admin to restore your roommate account.</p>
      </div>
      <form style="display:grid;gap:16px">
        ${field('House share or recovery code', 'ABC-123-DEF-456', { placeholder: true })}
        ${field('Your name', 'Brandon', { placeholder: true, hint: 'Required for a new account' })}
        ${btn('Join the house', { size: 'lg', extra: 'width:100%;margin-top:4px' })}
      </form>
      <p class="tiny" style="text-align:center">Admins sign in with a magic link sent to their email.</p>
    </div>
  </main>
</div>`
  return doc(body)
}

// ============================================================ MOBILE OVERVIEW
function mobileTopRight() {
  return iconBtn('bell', { size: 36, dot: true }) + `<a href="#" style="display:inline-flex">${avatar(M.brandon, 36)}</a>`
}

export function mobileOverview() {
  const day = (d, n, on, has) => `<button type="button" style="position:relative;display:grid;gap:2px;justify-items:center;padding:9px 4px 8px;border:1px solid ${on ? 'transparent' : C.line};border-radius:14px;background:${on ? C.white : C.card};font-family:inherit;cursor:pointer;min-width:0"><span style="font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${on ? C.text4 : C.text3}">${d}</span><span class="display" style="font-size:20px;line-height:1;color:${on ? C.bg : C.text}">${n}</span>${has ? `<i style="position:absolute;bottom:6px;width:4px;height:4px;border-radius:999px;background:${C.pink}"></i>` : ''}</button>`
  const row = (time, ic, tone, title, sub, who, right) => `<div class="inner" style="display:grid;grid-template-columns:36px minmax(0,1fr) auto;align-items:center;gap:10px;padding:10px 12px"><span>${tile(ic, tone, 36, 11)}</span><div style="display:grid;min-width:0"><span style="font-size:13.5px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${title}</span><span class="tiny">${time} · ${sub}</span></div><div style="display:flex;align-items:center;gap:8px">${who ? avatar(who, 26) : ''}${right || ''}</div></div>`
  const body = `
<div style="display:grid;gap:4px;padding-top:2px">
  <h1 class="h1" style="font-size:30px">Welcome in, <span style="color:${C.text3}">Brandon</span></h1>
  <p class="tiny">Sunday, September 6 · 2 chores, 1 exit, 1 class</p>
</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">${progress('Chores done', 60, 'pink')}${progress('Rent collected', 50, 'white')}</div>
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px">${day('Sun', 6, true, true)}${day('Mon', 7, false, true)}${day('Tue', 8, false, true)}${day('Wed', 9, false, false)}</div>
<div class="card" style="padding:14px 12px;display:grid;gap:8px">
  <div style="display:flex;align-items:center;justify-content:space-between;padding:0 4px 4px"><span class="h2" style="font-size:17px">Today</span><a href="#" class="link" style="font-size:12px;color:${C.text2}">All chores ${icon('arrowRight', 13)}</a></div>
  ${row('1:00 PM', 'car', 'pink', 'Red Mazda needs out', 'PHY 132')}
  ${row('2:00 PM', 'calendar', 'violet', 'CSC 209 lecture', 'BA 1170')}
  ${row('10:00 PM', 'clock', 'amber', 'Garbage to the curb', 'Outside', M.noah)}
  ${row('11:59 PM', 'clock', 'amber', 'Stove &amp; counters', 'Kitchen', M.brandon, btn('Done', { size: 'sm', icon: 'check' }))}
</div>
<div class="blue-card" style="padding:16px 18px;display:grid;grid-template-columns:1fr auto;align-items:center;gap:4px 12px">
  <span class="eyebrow" style="color:rgba(255,255,255,.75)">Your house balance</span>${arrowBtn()}
  <span class="display" style="font-size:30px;line-height:1;color:#fff">+$18.27</span>
  <span style="grid-column:1/-1;font-size:12.5px;color:rgba(255,255,255,.85)">The house owes you · rent due Tuesday</span>
</div>`
  return doc(mobileShell({ active: 'overview', body, top: mobileTop({ title: HOUSE.name, right: mobileTopRight() }) }))
}

// ============================================================ MOBILE CHORES
export function mobileChores() {
  const stat = (n, label, color) => `<div style="display:grid;gap:2px;padding:12px 14px"><span class="display" style="font-size:24px;line-height:1;color:${color}">${n}</span><span class="tiny">${label}</span></div>`
  const occ = (status, tone, meta, title, who, action) => `<div class="inner" style="display:grid;gap:10px;padding:14px"><div style="display:flex;align-items:center;justify-content:space-between">${pill(status, tone, 'height:26px;font-size:11.5px')}<span class="tiny">${meta}</span></div><span class="h3">${title}</span><div style="display:flex;align-items:center;justify-content:space-between;padding-top:10px;border-top:1px solid ${C.line}"><span style="display:flex;align-items:center;gap:8px">${avatar(who, 24)}<span style="font-size:12.5px;font-weight:700">${who.name}</span></span>${action || ''}</div></div>`
  const body = `
<div style="display:flex;align-items:flex-end;justify-content:space-between;gap:12px;padding-top:2px">
  <div style="display:grid;gap:2px"><h1 class="h1" style="font-size:30px">Chores</h1><p class="tiny">Do your chores... or else.</p></div>
  ${btn('New', { icon: 'plus', size: 'sm' })}
</div>
<div class="card" style="display:grid;grid-template-columns:repeat(3,1fr)">
  ${stat(7, 'Done this month', C.green)}
  <div style="border-left:1px solid ${C.line}">${stat(3, 'Rotations', C.text)}</div>
  <div style="border-left:1px solid ${C.line}">${stat(1, 'Infraction', C.pink)}</div>
</div>
<div style="display:flex;align-items:center;justify-content:space-between"><span class="h2" style="font-size:17px">Coming up</span>${segmented(['Everyone', 'Mine'], 'Everyone')}</div>
<div style="display:grid;gap:8px">
  ${occ('Your turn', 'white', 'Kitchen · Today 11:59 PM', 'Stove &amp; counters', M.brandon, btn('Done', { size: 'sm', icon: 'check' }))}
  ${occ('Assigned', 'blue', 'Outside · Today 10:00 PM', 'Garbage to the curb', M.noah)}
  ${occ('Assigned', 'blue', 'Bathroom · Tue 11:59 PM', 'Clean the bathroom', M.maya)}
</div>`
  return doc(mobileShell({ active: 'chores', body, top: mobileTop({ title: HOUSE.name, right: mobileTopRight() }) }))
}

// ============================================================ MOBILE MONEY
export function mobileMoney() {
  const bal = (m, label, amount, tone) => `<div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-top:1px solid ${C.line}">${avatar(m, 28)}<div style="display:grid;line-height:1.25;min-width:0;flex:1"><span style="font-size:13px;font-weight:700">${m.name}</span><span class="tiny">${label}</span></div>${badge(amount, tone)}</div>`
  const act = (ic, tone, title, sub, amount, right = '') => `<div class="inner" style="display:grid;grid-template-columns:36px minmax(0,1fr) auto;align-items:center;gap:10px;padding:10px 12px">${tile(ic, tone, 36, 999)}<div style="display:grid;min-width:0"><span style="font-size:13.5px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${title}</span><span class="tiny" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${sub}</span></div><div style="display:grid;justify-items:end;gap:4px"><span class="fig" style="font-size:13.5px;font-weight:700">${amount}</span>${right}</div></div>`
  const body = `
<div style="display:flex;align-items:flex-end;justify-content:space-between;gap:12px;padding-top:2px">
  <div style="display:grid;gap:2px"><h1 class="h1" style="font-size:30px">Money</h1><p class="tiny">Balanced and traceable.</p></div>
  ${btn('Add', { icon: 'plus', size: 'sm' })}
</div>
<div class="blue-card" style="padding:18px;display:grid;gap:12px">
  <div style="display:flex;align-items:flex-start;justify-content:space-between"><span class="eyebrow" style="color:rgba(255,255,255,.75)">Your house balance</span>${arrowBtn()}</div>
  <span class="display" style="font-size:40px;line-height:1;color:#fff">+$18.27</span>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
    <div style="padding:10px 12px;border-radius:12px;background:#fff;color:${C.bg};display:grid;gap:1px"><span class="tiny" style="color:${C.text3}">Paid</span><span style="font-size:15px;font-weight:800">$48.36</span></div>
    <div style="padding:10px 12px;border-radius:12px;background:rgba(255,255,255,.16);color:#fff;display:grid;gap:1px;border:1px solid rgba(255,255,255,.2)"><span class="tiny" style="color:rgba(255,255,255,.75)">Used</span><span style="font-size:15px;font-weight:800">$18.09</span></div>
  </div>
</div>
<div class="card" style="padding:12px 16px 4px">
  <div style="display:flex;align-items:center;justify-content:space-between;padding-bottom:8px"><span class="h2" style="font-size:16px">Balances</span>${btn('Settle up', { variant: 'ghost', size: 'sm', icon: 'cards' })}</div>
  ${bal(M.maya, 'Owes you', '-$6.09', 'red')}${bal(M.liam, 'Owes you', '-$6.09', 'red')}${bal(M.noah, 'Payment pending', '-$6.09', 'red')}
</div>
<div style="display:flex;align-items:center;justify-content:space-between"><span class="h2" style="font-size:17px">Recent activity</span>${segmented(['All', 'Paid'], 'All')}</div>
<div style="display:grid;gap:8px">
  ${act('arrowUpRight', 'amber', 'Payment to Brandon', 'Sep 6 · Noah paid', '+$12.00', pill('Confirm', 'white', 'height:24px;font-size:11px;padding:0 9px'))}
  ${act('home', 'blue', 'Toilet paper &amp; paper towel', 'Sep 4 · Brandon paid · Receipt', '$48.36')}
</div>`
  return doc(mobileShell({ active: 'money', body, top: mobileTop({ title: HOUSE.name, right: mobileTopRight() }) }))
}

// ============================================================ ADD PURCHASE MODAL
export function addPurchase() {
  const label = (t) => `<span style="font-size:13.5px;font-weight:700;color:${C.text}">${t}</span>`
  const payer = (m, on, amount) => `<div style="display:grid;grid-template-columns:auto auto minmax(0,1fr) 140px;align-items:center;gap:12px;padding:10px 0;border-top:1px solid ${C.line}">${check(on)}${avatar(m, 30)}<span style="font-size:14px;font-weight:700;color:${on ? C.text : C.text3}">${m.name}</span><span class="input fig" style="height:36px;font-size:13.5px;color:${on ? C.text : C.text4}">${amount}</span></div>`
  const user = (m, on) => `<label class="inner" style="display:flex;align-items:center;gap:12px;padding:10px 12px;border-color:${on ? C.line2 : C.line}">${check(on)}${avatar(m, 26)}<span style="font-size:13.5px;font-weight:700">${m.name}</span></label>`
  const share = (m, amt) => `<div style="display:flex;align-items:center;gap:10px;min-height:44px;border-top:1px solid ${C.line}">${avatar(m, 24)}<span class="small">${m.name} pays</span><span class="fig" style="margin-left:auto;font-size:13.5px;font-weight:700">CA${amt}</span></div>`
  const body = `<div style="position:relative;width:760px;height:1300px;background:${C.bg};overflow:hidden">
  <div style="position:absolute;inset:0;background:rgba(5,6,8,.72)"></div>
  <section role="dialog" aria-modal="true" class="card" style="position:absolute;left:50px;top:40px;width:660px;border-radius:24px;box-shadow:0 40px 120px -20px rgba(0,0,0,.8);overflow:hidden;background:${C.card}">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:24px 28px 18px;border-bottom:1px solid ${C.line}">
      <div style="display:grid;gap:4px"><h2 class="h1" style="font-size:26px">Add a shared purchase</h2><p class="small">Amounts are stored in cents and posted as an immutable transaction.</p></div>
      ${iconBtn('x', { size: 36 })}
    </div>
    <div style="padding:20px 28px;display:grid;gap:22px">
      <label class="field" style="gap:8px">${label('What did you buy?')}<span class="input focus" style="height:46px">Costco run</span></label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <label class="field" style="gap:8px">${label('Amount')}<span style="display:grid;grid-template-columns:96px 1fr;height:46px;border:1px solid ${C.line2};border-radius:12px;overflow:hidden;background:${C.inner}"><span style="display:flex;align-items:center;justify-content:space-between;padding:0 12px;border-right:1px solid ${C.line};font-size:13px;font-weight:700">CAD${icon('chevronDown', 13, { color: C.text3 })}</span><span class="fig" style="display:flex;align-items:center;gap:6px;padding:0 14px;font-size:15px;font-weight:700"><span style="color:${C.text3}">$</span>86.40</span></span></label>
        ${field(label('Category'), 'Groceries', { type: 'select' })}
      </div>
      <div style="display:grid;gap:8px">${label('Receipt')}<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;border:1px dashed ${C.line2};border-radius:14px;background:${C.inner}"><span style="display:inline-flex;align-items:center;gap:8px;font-size:14px;font-weight:700">${icon('camera', 18)}Upload receipt</span><span class="tiny">JPG, PNG or PDF · optional</span></div></div>
      <fieldset style="margin:0;padding:0;border:0;display:grid">
        <legend style="padding:0;margin-bottom:8px">${label('Who paid?')}</legend>
        ${payer(M.brandon, true, '86.40')}${payer(M.maya, false, '0.00')}${payer(M.liam, false, '0.00')}${payer(M.noah, false, '0.00')}
      </fieldset>
      <fieldset style="margin:0;padding:0;border:0;display:grid;gap:10px">
        <legend style="padding:0;margin-bottom:2px">${label('Who used it?')}</legend>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${user(M.brandon, true)}${user(M.maya, true)}${user(M.liam, true)}${user(M.noah, true)}</div>
      </fieldset>
      <section style="display:grid;gap:10px">
        <h3 class="h3">Split summary</h3>
        <div class="inner" style="padding:0 16px">
          <div style="display:flex;align-items:center;gap:10px;min-height:44px">${avatar(M.brandon, 24)}<span class="small">Brandon pays</span><span class="fig" style="margin-left:auto;font-size:13.5px;font-weight:700">CA$21.60</span></div>
          ${share(M.maya, '$21.60')}${share(M.liam, '$21.60')}${share(M.noah, '$21.60')}
          <div style="display:flex;align-items:center;min-height:46px;border-top:1px solid ${C.line}"><strong>Total</strong><strong class="fig" style="margin-left:auto">CA$86.40</strong></div>
        </div>
      </section>
    </div>
    <div style="display:flex;align-items:center;justify-content:flex-end;gap:10px;padding:16px 28px;border-top:1px solid ${C.line};background:${C.inner}">${btn('Cancel', { variant: 'ghost' })}${btn('Post purchase', { extra: 'min-width:160px' })}</div>
  </section>
</div>`
  return doc(body)
}

// ============================================================ DESIGN SYSTEM SHEET
export function designSystem() {
  const swatch = (name, hex, role) => `<div style="display:grid;gap:8px"><span style="height:64px;border-radius:14px;background:${hex};border:1px solid rgba(255,255,255,.08)"></span><span style="display:grid;gap:1px"><span style="font-size:13px;font-weight:700">${name}</span><span class="tiny">${hex}</span><span class="tiny">${role}</span></span></div>`
  const type = (sample, spec, cls, style) => `<div style="display:grid;grid-template-columns:minmax(0,1fr) 250px;align-items:baseline;gap:24px;padding:14px 0;border-bottom:1px solid ${C.line}"><span class="${cls}" style="${style}">${sample}</span><span class="tiny">${spec}</span></div>`
  const body = `<div style="width:1440px;min-height:1200px;background:${C.bg};padding:56px 64px;display:grid;gap:44px;align-content:start">
  <header style="display:grid;gap:10px;padding-bottom:22px;border-bottom:1px solid ${C.line}">
    <p class="eyebrow">Design system · Night</p>
    <h1 class="h1" style="font-size:52px">HowseHowld, <span style="color:${C.text3}">after dark</span>.</h1>
    <p class="sub" style="max-width:720px;font-size:15px;line-height:1.6">Charcoal ground, stacked cards with generous radii, pill navigation and Manrope everywhere. Hot pink says “yours”, electric blue says “the house”, green and red only ever mean money and misses. Nothing is decorated; every colour carries a meaning.</p>
  </header>

  <section style="display:grid;gap:16px">
    <h2 class="h2">Palette</h2>
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:16px">
      ${swatch('Ground', C.bg, 'Page background')}
      ${swatch('Card', C.card, 'Cards')}
      ${swatch('Inner', C.inner, 'Nested cards, inputs')}
      ${swatch('Raise', C.raise, 'Active pills, hover')}
      ${swatch('Text', C.text, 'Primary text')}
      ${swatch('Text 2', C.text2, 'Secondary text')}
      ${swatch('Text 3', C.text3, 'Labels, meta')}
    </div>
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:16px">
      ${swatch('Pink', C.pink, 'Yours · chores · alerts')}
      ${swatch('Blue', C.blue, 'The house · features')}
      ${swatch('Green', C.green, 'Done · owed to you')}
      ${swatch('Red', C.red, 'Missed · you owe')}
      ${swatch('Amber', C.amber, 'Bills · reminders')}
      ${swatch('Violet', C.violet, 'Classes · events')}
      ${swatch('White', C.white, 'Primary action')}
    </div>
  </section>

  <div style="display:grid;grid-template-columns:1.1fr .9fr;gap:48px;align-items:start">
    <section style="display:grid;gap:8px">
      <h2 class="h2">Type · Manrope</h2>
      ${type('Welcome in, <span style="color:' + C.text3 + '">Brandon</span>', '800 · 40/1.05 · −3% tracking · greeting', 'display', 'font-size:40px;line-height:1.05')}
      ${type('$3,200.00', '800 · 52/1 · tabular · hero figure', 'display', 'font-size:52px;line-height:1')}
      ${type('Shared money', '800 · 36/1.05 · page title', 'display', 'font-size:36px;line-height:1.05')}
      ${type('Recent activity', '700 · 20/1.2 · card title', 'h2', '')}
      ${type('Stove &amp; counters', '700 · 14.5/1.3 · item title', 'h3', '')}
      ${type('Every purchase, share and payment stays balanced and traceable.', '500 · 14/1.5 · body', '', 'font-size:14px;font-weight:500')}
      ${type('OVERVIEW · 12 MONTHS · 30 DAYS', '600 · 12 · +6% tracking · labels', 'eyebrow', '')}
    </section>

    <section style="display:grid;gap:22px">
      <div style="display:grid;gap:12px">
        <h2 class="h2">Buttons and pills</h2>
        <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center">${btn('Add purchase', { icon: 'plus' })}${btn('Mark done', { variant: 'pink', icon: 'check' })}${btn('Open', { variant: 'blue' })}${btn('Import .ics', { variant: 'secondary', icon: 'fileUp' })}${btn('Settle up', { variant: 'ghost', icon: 'cards' })}${btn('Uphold', { variant: 'danger' })}${iconBtn('bell', { dot: true })}</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center">${segmented(['12 months', '30 days', '1 week'], '30 days')}${pill('Your turn', 'white')}${pill('Assigned', 'blue')}${pill('Disputed', 'pink')}${select('Newest')}</div>
      </div>
      <div style="display:grid;gap:12px">
        <h2 class="h2">Badges and progress</h2>
        <div style="display:flex;flex-wrap:wrap;gap:8px">${badge('+$18.27', 'green')}${badge('-$6.09', 'red')}${badge('Exam', 'red')}${badge('Class', 'violet')}${badge('Owner', 'amber')}${badge('Parked', '')}</div>
        <div style="display:grid;grid-template-columns:132px 148px 176px 118px;gap:12px">${progress('Chores done', 60, 'pink')}${progress('Rent collected', 50, 'white')}${progress('Bills paid', 50, 'gray')}${progress('Budget used', 15, 'hatch')}</div>
      </div>
      <div style="display:grid;gap:12px">
        <h2 class="h2">Figures</h2>
        <div style="display:flex;gap:36px">${kpi('2', 'Chores today', { tone: 'green', ic: 'check', delta: '+1' })}${kpi('2', 'Days to rent', { tone: 'pink', ic: 'calendar', delta: 'Tue' })}${kpi('$18', 'Owed to you', { tone: 'blue', ic: 'trendUp', delta: '+12%' })}</div>
      </div>
      <div style="display:grid;gap:12px">
        <h2 class="h2">People and tiles</h2>
        <div style="display:flex;align-items:center;gap:14px">${MEMBERS.map((m) => avatar(m, 40)).join('')}${avatarStack(MEMBERS, 28)}${tile('clock', 'amber')}${tile('check', 'solidGreen')}${tile('calendar', 'violet')}${tile('car', 'pink')}${tile('dollar', 'blue')}${tile('history', 'sunk')}</div>
      </div>
      <div style="display:grid;gap:12px">
        <h2 class="h2">Controls</h2>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">${field('Chore name', 'Clean the bathroom', { placeholder: true })}${field('Repeats', 'Selected weekdays', { type: 'select' })}</div>
        <div style="display:flex;align-items:center;gap:22px;font-size:13px">${toggle(true)}${toggle(false)}${check(true)}${check(false)}${radio(true)}${radio(false)}<span style="display:flex;gap:6px">${['Su', 'M', 'T', 'W', 'Th', 'F', 'Sa'].map((d, i) => `<span style="display:grid;place-items:center;width:34px;height:34px;border-radius:999px;border:1px solid ${i === 2 ? 'transparent' : C.line2};background:${i === 2 ? C.white : C.inner};color:${i === 2 ? C.bg : C.text2};font-size:12px;font-weight:700">${d}</span>`).join('')}</span></div>
      </div>
    </section>
  </div>

  <section style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px">
    ${[['Stack, don’t stripe', 'Depth comes from nested cards: ground, card, inner, raise. Never from lines or shadows alone.'], ['Pills for choices', 'Anything you can switch between is a pill group. Anything you can press is a pill. Corners are 20px or fully round.'], ['One colour per meaning', 'Pink is yours, blue is the house, green and red are money, amber is a bill, violet is a class. Nothing else gets colour.'], ['Big numbers, quiet labels', 'Figures are the loudest thing on a screen, set in 800. Their labels sit small and grey underneath.']].map(([t, d]) => `<div class="card" style="padding:20px 22px;display:grid;gap:8px"><span class="h2" style="font-size:19px">${t}</span><p class="small" style="line-height:1.55">${d}</p></div>`).join('')}
  </section>
</div>`
  return doc(body)
}
