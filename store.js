/* store.js — all localStorage logic for CanteenLive, in one file.
 * Shared by uncle.html and student.html. No backend, no libraries.
 * Data shape:
 *   items   : [{ id, name, qty, price, soldOut, emoji }]
 *   counter : integer (running token sequence number, global)
 *   orders  : [{ token, itemId, itemName, qty, buyer, slotId, slotLabel,
 *                date, time, given }]
 *   sales   : { [itemName]: [7 numbers] }   (fictional last-7-days units sold)
 */
(function (global) {
  'use strict';

  var KEYS = {
    items: 'canteenlive.items',
    counter: 'canteenlive.tokenCounter',
    orders: 'canteenlive.orders',
    sales: 'canteenlive.sales'
  };

  /* ---- pickup slot settings (8:00 AM -> 4:00 PM, every 15 min) ---- */
  var SLOT_START_MIN = 8 * 60;   // 08:00
  var SLOT_END_MIN = 16 * 60;    // 16:00 (last slot starts 15:45)
  var SLOT_STEP_MIN = 15;
  var SLOT_CAPACITY = 10;        // max orders per slot
  var DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  var LS_AVAILABLE = (function () {
    try {
      var k = '__cl_test__';
      global.localStorage.setItem(k, '1');
      global.localStorage.removeItem(k);
      return true;
    } catch (e) {
      return false;
    }
  })();

  /* Read + safely parse one key. Never throws: corrupted JSON -> fallback. */
  function read(key, fallback) {
    if (!LS_AVAILABLE) return fallback;
    try {
      var raw = global.localStorage.getItem(key);
      if (raw === null) return fallback;
      var value = JSON.parse(raw);
      return value === null || value === undefined ? fallback : value;
    } catch (e) {
      // Corrupted data — drop it and use the fallback so the app keeps running.
      try { global.localStorage.removeItem(key); } catch (ignored) {}
      return fallback;
    }
  }

  function write(key, value) {
    if (!LS_AVAILABLE) return false;
    try {
      global.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }

  /* ---------- validation ---------- */

  function validateName(name) {
    if (typeof name !== 'string' || name.trim() === '') {
      return { ok: false, message: 'Name cannot be empty.' };
    }
    if (name.trim().length > 40) {
      return { ok: false, message: 'Name too long (max 40 characters).' };
    }
    return { ok: true, value: name.trim() };
  }

  function validateQty(qty) {
    var n = Number(qty);
    if (!isFinite(n) || !Number.isInteger(n) || n < 0 || n > 500) {
      return { ok: false, message: 'Quantity must be a whole number from 0 to 500.' };
    }
    return { ok: true, value: n };
  }

  function validatePrice(price) {
    var n = Number(price);
    if (!isFinite(n) || n < 1 || n > 500) {
      return { ok: false, message: 'Price must be between 1 and 500.' };
    }
    return { ok: true, value: Math.round(n * 100) / 100 };
  }

  /* ---------- items ---------- */

  var SEED = [
    { name: 'Samosa', qty: 30, price: 10, emoji: '🥟' },
    { name: 'Vada Pav', qty: 25, price: 12, emoji: '🍔' },
    { name: 'Tea', qty: 50, price: 8, emoji: '☕' }
  ];

  function sanitizeItem(item) {
    // Guard against malformed entries sneaking into storage.
    if (!item || typeof item !== 'object') return null;
    var name = validateName(item.name);
    var qty = validateQty(item.qty);
    var price = validatePrice(item.price);
    if (!name.ok || !qty.ok || !price.ok) return null;
    var emoji = typeof item.emoji === 'string' ? item.emoji.slice(0, 8) : '';
    return {
      id: typeof item.id === 'string' && item.id ? item.id : uid(),
      name: name.value,
      qty: qty.value,
      price: price.value,
      soldOut: !!item.soldOut,
      emoji: emoji
    };
  }

  function uid() {
    return 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function cleanEmoji(emoji) {
    return typeof emoji === 'string' ? emoji.trim().slice(0, 8) : '';
  }

  function getItems() {
    var items = read(KEYS.items, null);
    if (!Array.isArray(items)) {
      // First run (or corrupted) — pre-load the 3 fictional items.
      items = SEED.map(function (s) {
        return { id: uid(), name: s.name, qty: s.qty, price: s.price, soldOut: false, emoji: s.emoji };
      });
      write(KEYS.items, items);
    }
    return items.map(sanitizeItem).filter(Boolean);
  }

  function saveItems(items) {
    return write(KEYS.items, items.map(sanitizeItem).filter(Boolean));
  }

  function addItem(name, qty, price, emoji) {
    var v1 = validateName(name), v2 = validateQty(qty), v3 = validatePrice(price);
    if (!v1.ok) return { ok: false, message: v1.message };
    if (!v2.ok) return { ok: false, message: v2.message };
    if (!v3.ok) return { ok: false, message: v3.message };
    var items = getItems();
    var duplicate = items.some(function (it) {
      return it.name.toLowerCase() === v1.value.toLowerCase();
    });
    if (duplicate) return { ok: false, message: '"' + v1.value + '" already exists. Edit it instead.' };
    items.push({
      id: uid(), name: v1.value, qty: v2.value, price: v3.value,
      soldOut: v2.value === 0, emoji: cleanEmoji(emoji)
    });
    saveItems(items);
    return { ok: true };
  }

  function updateItem(id, name, qty, price, emoji) {
    var v1 = validateName(name), v2 = validateQty(qty), v3 = validatePrice(price);
    if (!v1.ok) return { ok: false, message: v1.message };
    if (!v2.ok) return { ok: false, message: v2.message };
    if (!v3.ok) return { ok: false, message: v3.message };
    var items = getItems();
    var found = false;
    items = items.map(function (it) {
      if (it.id !== id) return it;
      found = true;
      it.name = v1.value;
      it.qty = v2.value;
      it.price = v3.value;
      it.soldOut = v2.value === 0;
      if (emoji !== undefined) it.emoji = cleanEmoji(emoji);
      return it;
    });
    if (!found) return { ok: false, message: 'Item not found (maybe deleted in another tab).' };
    saveItems(items);
    return { ok: true };
  }

  function setQty(id, qty) {
    var v = validateQty(qty);
    if (!v.ok) return { ok: false, message: v.message };
    var items = getItems();
    var found = false;
    items = items.map(function (it) {
      if (it.id !== id) return it;
      found = true;
      it.qty = v.value;
      it.soldOut = v.value === 0;
      return it;
    });
    if (!found) return { ok: false, message: 'Item not found.' };
    saveItems(items);
    return { ok: true };
  }

  function toggleSoldOut(id) {
    var items = getItems();
    var found = false;
    items = items.map(function (it) {
      if (it.id !== id) return it;
      found = true;
      it.soldOut = !it.soldOut;
      return it;
    });
    if (!found) return { ok: false, message: 'Item not found.' };
    saveItems(items);
    return { ok: true };
  }

  function deleteItem(id) {
    var items = getItems();
    var before = items.length;
    items = items.filter(function (it) { return it.id !== id; });
    if (items.length === before) return { ok: false, message: 'Item not found.' };
    saveItems(items);
    return { ok: true };
  }

  /* ---------- date + pickup-slot helpers ---------- */

  function dateStrOf(d) {
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }
  function todayStr() { return dateStrOf(new Date()); }
  function nowMinutes() {
    var d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  }

  // "13:15" -> { h:13, m:15 }; invalid -> null
  function parseStart(id) {
    var mm = /_(\d{2}):(\d{2})$/.exec(id || '');
    if (!mm) return null;
    return { h: Number(mm[1]), m: Number(mm[2]) };
  }
  function slotStartMin(id) {
    var p = parseStart(id);
    return p ? p.h * 60 + p.m : NaN;
  }
  function slotDate(id) {
    var mm = /^(\d{4}-\d{2}-\d{2})_/.exec(id || '');
    return mm ? mm[1] : '';
  }

  function fmtClock(mins) {
    var h = Math.floor(mins / 60), m = mins % 60;
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  }
  // 12-hour pieces: { hm: "1:15", ap: "PM" }
  function fmt12(mins) {
    var h = Math.floor(mins / 60), m = mins % 60;
    var ap = h >= 12 ? 'PM' : 'AM';
    var h12 = h % 12; if (h12 === 0) h12 = 12;
    return { hm: h12 + ':' + String(m).padStart(2, '0'), ap: ap };
  }
  // Compact range like "1:15-1:30 PM" (matches the token-card example).
  function slotRangeLabel(id) {
    var s = slotStartMin(id);
    if (isNaN(s)) return '';
    var a = fmt12(s), b = fmt12(s + SLOT_STEP_MIN);
    if (a.ap === b.ap) return a.hm + '-' + b.hm + ' ' + a.ap;
    return a.hm + ' ' + a.ap + '-' + b.hm + ' ' + b.ap; // crosses noon/midnight
  }

  function rushLevel(count) {
    if (count >= 9) return 'red';
    if (count >= 5) return 'orange';
    return 'green';
  }

  /* Build today's slots, each with live order count, rush colour and
   * past/full/open state. Recomputed on demand (data may change in tabs). */
  function getSlots() {
    var today = todayStr();
    var orders = getOrders();
    var counts = {};
    orders.forEach(function (o) {
      if (o.slotId && slotDate(o.slotId) === today) {
        counts[o.slotId] = (counts[o.slotId] || 0) + 1;
      }
    });
    var nm = nowMinutes();
    var slots = [];
    for (var s = SLOT_START_MIN; s + SLOT_STEP_MIN <= SLOT_END_MIN; s += SLOT_STEP_MIN) {
      var id = today + '_' + fmtClock(s);
      var count = counts[id] || 0;
      slots.push({
        id: id,
        startMin: s,
        label: slotRangeLabel(id),
        count: count,
        rush: rushLevel(count),
        past: s <= nm,
        full: count >= SLOT_CAPACITY
      });
    }
    return slots;
  }

  function slotById(id) {
    var slots = getSlots();
    for (var i = 0; i < slots.length; i++) if (slots[i].id === id) return slots[i];
    return null;
  }

  function getSlotHint() {
    var open = getSlots().filter(function (s) { return !s.past && !s.full; });
    if (!open.length) return null;
    var best = open[0];
    for (var i = 1; i < open.length; i++) if (open[i].count < best.count) best = open[i];
    return { id: best.id, label: best.label, count: best.count };
  }

  /* ---------- orders & tokens ---------- */

  function nextToken() {
    var counter = read(KEYS.counter, 0);
    if (typeof counter !== 'number' || !isFinite(counter) || counter < 0) counter = 0;
    counter = Math.floor(counter) + 1;
    write(KEYS.counter, counter);
    return 'T-' + String(counter).padStart(3, '0');
  }

  function placeOrder(itemId, qty, buyer, slotId) {
    var vQty = validateQty(qty);
    if (!vQty.ok) return { ok: false, message: vQty.message };
    if (vQty.value < 1) return { ok: false, message: 'Please order at least 1 item.' };
    var buyerName = validateName(buyer);
    if (!buyerName.ok) return { ok: false, message: 'Please enter your nickname.' };

    var items = getItems();
    var item = null;
    for (var i = 0; i < items.length; i++) {
      if (items[i].id === itemId) { item = items[i]; break; }
    }
    if (!item) return { ok: false, message: 'This item is no longer available.' };
    if (item.soldOut) {
      return { ok: false, message: '😔 ' + item.name + ' is sold out today. Please try something else!' };
    }
    if (vQty.value > item.qty) {
      return {
        ok: false,
        message: 'Only ' + item.qty + ' ' + item.name + ' left right now. Please order ' +
          item.qty + ' or fewer 😊'
      };
    }

    // A pickup slot is required and must be a real, current, open slot.
    var slot = slotId ? slotById(slotId) : null;
    if (!slotId) return { ok: false, message: 'Please pick a pickup time slot first. 👆' };
    if (!slot) return { ok: false, message: 'That pickup slot is no longer available. Please choose another. 👆' };
    if (slot.past) return { ok: false, message: '⏰ ' + slot.label + ' has already passed. Please pick a later slot.' };
    if (slot.full) return { ok: false, message: '🚦 ' + slot.label + ' is full. Please pick a greener time slot.' };

    // Reduce stock immediately, then record the order + token.
    var token = nextToken();
    item.qty -= vQty.value;
    if (item.qty === 0) item.soldOut = true;
    saveItems(items);

    var orders = getOrders();
    orders.unshift({
      token: token,
      itemId: item.id,
      itemName: item.name,
      qty: vQty.value,
      buyer: buyerName.value,
      slotId: slot.id,
      slotLabel: slot.label,
      date: todayStr(),
      time: new Date().toISOString(),
      given: false
    });
    if (orders.length > 500) orders.length = 500; // keep storage bounded
    write(KEYS.orders, orders);

    return {
      ok: true, token: token, item: item.name,
      qty: vQty.value, slotLabel: slot.label, slotId: slot.id
    };
  }

  function sanitizeOrder(o) {
    if (!o || typeof o !== 'object') return null;
    if (typeof o.token !== 'string' || !o.token) return null;
    var qty = validateQty(o.qty);
    if (!qty.ok) return null;
    var slotId = typeof o.slotId === 'string' ? o.slotId : '';
    return {
      token: o.token,
      itemId: typeof o.itemId === 'string' ? o.itemId : '',
      itemName: typeof o.itemName === 'string' ? o.itemName : 'Item',
      qty: qty.value,
      buyer: typeof o.buyer === 'string' ? o.buyer.slice(0, 24) : '',
      slotId: slotId,
      slotLabel: typeof o.slotLabel === 'string' && o.slotLabel
        ? o.slotLabel : slotRangeLabel(slotId),
      date: typeof o.date === 'string' ? o.date : (slotDate(slotId) || todayStr()),
      time: typeof o.time === 'string' ? o.time : '',
      given: !!o.given
    };
  }

  function getOrders() {
    var orders = read(KEYS.orders, []);
    if (!Array.isArray(orders)) orders = [];
    return orders.map(sanitizeOrder).filter(Boolean)
      .sort(function (a, b) { return a.token < b.token ? -1 : a.token > b.token ? 1 : 0; });
  }

  function slotOrderCount(slotId) {
    return getOrders().filter(function (o) { return o.slotId === slotId; }).length;
  }

  /* Mark an order as handed over ("Given") by token. */
  function markGiven(token) {
    var orders = getOrders();
    var found = false;
    orders = orders.map(function (o) {
      if (o.token !== token) return o;
      found = true;
      o.given = true;
      return o;
    });
    if (!found) return { ok: false, message: 'Order ' + token + ' not found.' };
    write(KEYS.orders, orders);
    return { ok: true };
  }


  /* ---------- tomorrow's prep (prediction) ---------- */

  /* FICTIONAL last-7-days units sold, oldest -> today. */
  var SALES_SEED = {
    'Samosa':   [22, 25, 20, 30, 28, 26, 24],
    'Vada Pav': [18, 20, 15, 22, 25, 19, 17],
    'Tea':      [40, 45, 38, 50, 55, 48, 42]
  };

  function sanitizeSales(map) {
    var out = {};
    if (!map || typeof map !== 'object') return out;
    Object.keys(map).forEach(function (name) {
      var days = Array.isArray(map[name]) ? map[name] : [];
      out[name] = days.map(function (n) {
        n = Math.floor(Number(n));
        return isFinite(n) && n >= 0 ? n : 0;
      });
    });
    return out;
  }

  function getSales() {
    var sales = read(KEYS.sales, null);
    if (!sales || typeof sales !== 'object' || Array.isArray(sales)) {
      sales = sanitizeSales(SALES_SEED);
      write(KEYS.sales, sales);
    }
    return sanitizeSales(sales);
  }

  /* Suggested qty = average of last 7 days + 10%, rounded up. */
  function predictFromHistory(days) {
    var arr = (Array.isArray(days) ? days : []).map(Number).filter(function (n) {
      return isFinite(n) && n >= 0;
    });
    if (!arr.length) return 0;
    var sum = arr.reduce(function (a, b) { return a + b; }, 0);
    return Math.ceil((sum / arr.length) * 1.1);
  }

  // Day labels for the 7 columns, oldest -> today (e.g. ["Wed","Thu",...]).
  function recentDayLabels(n) {
    var labels = [];
    for (var i = n - 1; i >= 0; i--) {
      var d = new Date();
      d.setDate(d.getDate() - i);
      labels.push(DAY_LABELS[d.getDay()]);
    }
    return labels;
  }

  function getPrepList() {
    var sales = getSales();
    var labels = recentDayLabels(7);
    return getItems().map(function (item) {
      var days = Array.isArray(sales[item.name]) ? sales[item.name] : [];
      // pad/truncate to exactly 7 columns for a tidy chart
      var series = [];
      for (var i = 0; i < 7; i++) series.push(days[i] != null ? days[i] : 0);
      return {
        id: item.id,
        name: item.name,
        emoji: item.emoji || '🍽️',
        price: item.price,
        days: series,
        labels: labels,
        max: Math.max.apply(null, series.concat([1])),
        predicted: predictFromHistory(series)
      };
    });
  }

  function todayImpact() {
    var today = todayStr();
    var orders = getOrders().filter(function (o) { return o.date === today; });
    var units = orders.reduce(function (s, o) { return s + o.qty; }, 0);
    return {
      preOrders: orders.length,
      units: units,
      minutes: orders.length * 5
    };
  }

  /* Nuke all app data and re-seed (demo reset). */
  function clearAll() {
    if (!LS_AVAILABLE) return false;
    Object.keys(KEYS).forEach(function (k) {
      try { global.localStorage.removeItem(KEYS[k]); } catch (e) {}
    });
    getItems();  // re-seed items
    getSales();  // re-seed sales
    return true;
  }


  /* ---------- live sync ---------- */

  /* Subscribe to changes made in OTHER tabs (storage event).
   * Returns an unsubscribe function. */
  function onChange(callback) {
    function isOurKey(key) {
      // key === null means clear() was called somewhere in the app.
      if (key === null) return true;
      var values = [];
      Object.keys(KEYS).forEach(function (k) { values.push(KEYS[k]); });
      return values.indexOf(key) !== -1;
    }
    function handler(e) {
      if (isOurKey(e ? e.key : null)) {
        try { callback(e); } catch (ignored) {}
      }
    }
    global.addEventListener('storage', handler);
    return function () { global.removeEventListener('storage', handler); };
  }

  global.Store = {
    available: LS_AVAILABLE,
    validateName: validateName,
    validateQty: validateQty,
    validatePrice: validatePrice,
    getItems: getItems,
    saveItems: saveItems,
    addItem: addItem,
    updateItem: updateItem,
    setQty: setQty,
    toggleSoldOut: toggleSoldOut,
    deleteItem: deleteItem,
    placeOrder: placeOrder,
    getOrders: getOrders,
    getSlots: getSlots,
    slotById: slotById,
    slotOrderCount: slotOrderCount,
    getSlotHint: getSlotHint,
    slotRangeLabel: slotRangeLabel,
    markGiven: markGiven,
    getSales: getSales,
    getPrepList: getPrepList,
    predictFromHistory: predictFromHistory,
    todayImpact: todayImpact,
    clearAll: clearAll,
    onChange: onChange
  };
})(window);
