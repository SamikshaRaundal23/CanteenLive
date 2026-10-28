// temp smoke test for store.js (node). Run: node _smoke_test.js
const fs = require('fs');
const storeCode = fs.readFileSync('store.js', 'utf8');

const data = {};
const localStorage = {
  getItem: k => (k in data ? data[k] : null),
  setItem: (k, v) => { data[k] = String(v); },
  removeItem: k => { delete data[k]; }
};
const listeners = [];
const window = {
  localStorage,
  addEventListener: (t, fn) => { if (t === 'storage') listeners.push(fn); },
  removeEventListener: (t, fn) => { const i = listeners.indexOf(fn); if (i !== -1) listeners.splice(i, 1); }
};
eval(storeCode);
const S = window.Store;

let pass = 0, fail = 0, skip = 0;
function check(name, cond) {
  if (cond) { pass++; }
  else { fail++; console.log('FAIL ' + name); }
}
function info(s) { console.log('  - ' + s); }

/* ---------- 1. seed ---------- */
let items = S.getItems();
check('seeds 3 items', items.length === 3);
check('samosa has emoji (seed bug fixed)', items[0].emoji === '🥟');
items = S.getItems(); // idempotent
check('seed idempotent', items.length === 3);

/* ---------- 2. slot math (clock-independent) ---------- */
check('label 13:15', S.slotRangeLabel('2026-01-01_13:15') === '1:15-1:30 PM');
check('label 08:00', S.slotRangeLabel('2026-01-01_08:00') === '8:00-8:15 AM');
check('label crosses noon', S.slotRangeLabel('2026-01-01_11:45') === '11:45 AM-12:00 PM');
const slots = S.getSlots();
check('32 fifteen-min slots', slots.length === 32);
check('first slot 8:00', slots[0].label.startsWith('8:00'));
check('last slot 3:45-4:00 PM', slots[slots.length - 1].label === '3:45-4:00 PM');
check('all slots start empty/green', slots.every(s => s.count === 0 && s.rush === 'green'));
info('open-now=' + slots.filter(s => !s.past && !s.full).length +
     ' past=' + slots.filter(s => s.past).length);

/* ---------- 3. ordering requires/validates slot ---------- */
const samosa = S.getItems().find(i => i.name === 'Samosa');
const noSlot = S.placeOrder(samosa.id, 1, 'Bob', '');
check('slot required', !noSlot.ok && /pickup time slot/i.test(noSlot.message));

const bogus = S.placeOrder(samosa.id, 1, 'Bob', '2020-01-01_10:00');
check('unknown slot rejected', !bogus.ok && /no longer available/i.test(bogus.message));

const pastSlot = slots.find(s => s.past);
if (pastSlot) {
  const rp = S.placeOrder(samosa.id, 1, 'Bob', pastSlot.id);
  check('past slot rejected', !rp.ok && /already passed/i.test(rp.message));
} else { skip++; info('past-slot test skipped (clock before 8:00)'); }

const openSlot = slots.find(s => !s.past && !s.full);
if (openSlot) {
  const ok = S.placeOrder(samosa.id, 2, 'Bob', openSlot.id);
  check('open-slot order ok', ok.ok && ok.token === 'T-001' && ok.slotLabel === openSlot.label);
  check('stock reduced 30->28', S.getItems().find(i => i.id === samosa.id).qty === 28);
  check('slot count now 1', S.slotOrderCount(openSlot.id) === 1);
  check('slot label stored on order', S.getOrders()[0].slotLabel === openSlot.label);

  // fill the same slot to capacity (10 total)
  for (let i = 0; i < 9; i++) S.placeOrder(samosa.id, 1, 'B' + i, openSlot.id);
  const refreshed = S.getSlots().find(s => s.id === openSlot.id);
  check('slot full at 10', refreshed.count === 10 && refreshed.full === true && refreshed.rush === 'red');
  const over = S.placeOrder(samosa.id, 1, 'Late', openSlot.id);
  check('full slot blocks 11th order', !over.ok && /full/i.test(over.message));
  const hint = S.getSlotHint();
  check('hint picks a greener open slot (not the full one)', !!hint && hint.id !== openSlot.id);

  // given + today impact
  check('markGiven ok', S.markGiven('T-001').ok);
  check('order flagged given', S.getOrders().find(o => o.token === 'T-001').given === true);
  check('markGiven unknown fails', !S.markGiven('T-999').ok);
  const impact = S.todayImpact();
  check('todayImpact counts 10 orders', impact.preOrders === 10 && impact.minutes === 50);
} else { skip++; info('open-slot tests skipped (after 16:00)'); }

/* ---------- 4. over-quantity & sold-out ---------- */
const vp = S.getItems().find(i => i.name === 'Vada Pav');
const anyOpen = S.getSlots().find(s => !s.past && !s.full);
if (anyOpen) {
  const big = S.placeOrder(vp.id, 999, 'Greedy', anyOpen.id);
  check('qty>500 validation blocks', !big.ok && /0 to 500/.test(big.message));
  const over = S.placeOrder(vp.id, 500, 'Greedy', anyOpen.id);
  check('over-stock friendly msg', !over.ok && /Only 25 Vada Pav left/i.test(over.message));
} else { skip++; info('qty tests skipped (after 16:00)'); }

/* ---------- 5. prediction ---------- */
check('predict empty = 0', S.predictFromHistory([]) === 0);
check('predict [10,10,10] = 11', S.predictFromHistory([10, 10, 10]) === 11);
const prep = S.getPrepList();
const samosaPrep = prep.find(p => p.name === 'Samosa');
check('prep list has 3 items', prep.length === 3);
check('samosa predicted 28', samosaPrep.predicted === 28);
check('vada predicted 22', prep.find(p => p.name === 'Vada Pav').predicted === 22);
check('tea predicted 50', prep.find(p => p.name === 'Tea').predicted === 50);
check('prep series padded to 7', samosaPrep.days.length === 7);
S.addItem('Poha', 20, 25, '🍛');
const pohaPrep = S.getPrepList().find(p => p.name === 'Poha');
check('new item has no history -> predicted 0', pohaPrep.predicted === 0 && pohaPrep.days.every(d => d === 0));

/* ---------- 6. corrupted storage recovery ---------- */
data['canteenlive.items'] = '{not valid json!!';
check('corrupt items self-heal', S.getItems().length >= 3);
data['canteenlive.orders'] = 'garbage[';
check('corrupt orders -> []', S.getOrders().length === 0);
data['canteenlive.sales'] = '[[[bad';
check('corrupt sales -> reseed', Array.isArray(S.getSales()['Samosa']));

/* ---------- 7. live sync key filtering ---------- */
let fired = 0, ours = S.onChange(() => fired++);
listeners.forEach(fn => fn({ key: 'canteenlive.orders' }));
listeners.forEach(fn => fn({ key: 'canteenlive.sales' }));
listeners.forEach(fn => fn({ key: 'someone.else' }));
check('onChange fires for our keys only', fired === 2);
ours();
listeners.forEach(fn => fn({ key: 'canteenlive.orders' }));
check('unsubscribe works', fired === 2);

/* ---------- 8. clearAll reset ---------- */
S.clearAll();
check('clearAll empties orders', S.getOrders().length === 0);
check('clearAll reseeds items', S.getItems().length === 3);
check('clearAll reseeds sales', Array.isArray(S.getSales()['Samosa']));
const first = S.getSlots().find(s => !s.past && !s.full);
if (first) {
  const reToken = S.placeOrder(S.getItems()[0].id, 1, 'Zed', first.id);
  check('token counter reset after clear', reToken.ok && reToken.token === 'T-001');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed, ' + skip + ' skipped');
process.exit(fail ? 1 : 0);
