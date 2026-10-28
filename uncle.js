/* uncle.js — canteen owner screen. Data via Store (store.js). */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  var form = $('item-form');
  var editIdInput = $('edit-id');
  var nameInput = $('f-name');
  var emojiInput = $('f-emoji');
  var qtyInput = $('f-qty');
  var priceInput = $('f-price');
  var submitBtn = $('submit-btn');
  var cancelBtn = $('cancel-edit-btn');
  var formMsg = $('form-msg');
  var itemsList = $('items-list');
  var emptyItems = $('empty-items');
  var ordersList = $('orders-list');
  var prepList = $('prep-list');
  var impactLine = $('impact-line');
  var resetBtn = $('reset-btn');

  if (!Store.available) $('ls-warning').hidden = false;

  /* ---------- small helpers ---------- */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function todayKey() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function minsOfSlot(id) {
    var mm = /_(\d{2}):(\d{2})$/.exec(id || '');
    return mm ? Number(mm[1]) * 60 + Number(mm[2]) : 0;
  }
  function plural(name) { return /s$/i.test(name) ? name : name + 's'; }

  var toastTimer = null;
  function toast(text) {
    var el = $('toast');
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2600);
  }
  function showFormMsg(kind, text) {
    formMsg.hidden = false;
    formMsg.className = 'msg ' + (kind === 'ok' ? 'msg-ok' : 'msg-error');
    formMsg.textContent = text;
  }
  function hideFormMsg() { formMsg.hidden = true; }

  function badgeClass(qty, soldOut) {
    if (soldOut || qty === 0) return 'badge-red';
    if (qty <= 5) return 'badge-orange';
    return 'badge-green';
  }
  function stockLabel(item) {
    if (item.soldOut || item.qty === 0) return '❌ Sold out';
    return '📦 ' + item.qty + ' left';
  }
  function findItem(id) {
    var items = Store.getItems();
    for (var i = 0; i < items.length; i++) if (items[i].id === id) return items[i];
    return null;
  }

  /* =========================================================
   *  ITEMS
   * ======================================================= */
  function render() {
    var items = Store.getItems();
    emptyItems.hidden = items.length > 0;
    itemsList.innerHTML = '';

    items.forEach(function (item) {
      var card = document.createElement('article');
      card.className = 'card item' + (item.soldOut || item.qty === 0 ? ' soldout' : '');
      card.setAttribute('aria-label', item.name);

      card.innerHTML =
        '<div class="item-top">' +
          '<span class="item-emoji" aria-hidden="true">' + (esc(item.emoji) || '🍽️') + '</span>' +
          '<span class="item-name">' + esc(item.name) + '</span>' +
          '<span class="item-price">₹' + esc(item.price) + '</span>' +
          '<span class="badge ' + badgeClass(item.qty, item.soldOut) + '">' + stockLabel(item) + '</span>' +
        '</div>' +
        '<div class="stepper">' +
          '<button type="button" class="step-btn step-minus" data-act="dec" aria-label="Reduce ' + esc(item.name) + ' quantity by 1">−</button>' +
          '<button type="button" class="qty-readout" data-act="set" aria-label="Set exact quantity for ' + esc(item.name) + '">📦 ' + item.qty + '</button>' +
          '<button type="button" class="step-btn step-plus" data-act="inc" aria-label="Increase ' + esc(item.name) + ' quantity by 1">＋</button>' +
        '</div>' +
        '<div class="item-actions">' +
          '<button type="button" class="btn btn-ghost" data-act="edit">✏️ Edit</button>' +
          '<button type="button" class="btn btn-warn" data-act="soldout">' + (item.soldOut ? '🔄 Back in stock' : '🚫 Sold out') + '</button>' +
          '<button type="button" class="btn btn-danger" data-act="del">🗑️ Delete</button>' +
        '</div>';

      card.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-act]');
        if (!btn) return;
        handleAction(btn.dataset.act, item.id);
      });
      itemsList.appendChild(card);
    });
  }

  /* =========================================================
   *  ORDERS grouped by pickup slot + Given
   * ======================================================= */
  function renderOrders() {
    var orders = Store.getOrders().filter(function (o) { return o.date === todayKey(); });
    if (!orders.length) {
      ordersList.innerHTML = '<p class="empty-state">No orders yet 🕐<br><small>Students will appear here by pickup time.</small></p>';
      return;
    }
    var groups = {};
    orders.forEach(function (o) {
      var k = o.slotId || 'no-slot';
      if (!groups[k]) groups[k] = { label: o.slotLabel || 'No time', list: [] };
      groups[k].list.push(o);
    });
    var keys = Object.keys(groups).sort(function (a, b) { return minsOfSlot(a) - minsOfSlot(b); });

    ordersList.innerHTML = keys.map(function (k) {
      var g = groups[k];
      var count = g.list.length;
      var rush = count >= 9 ? 'red' : count >= 5 ? 'orange' : 'green';
      var rows = g.list.map(function (o) {
        return '<div class="order-row' + (o.given ? ' given' : '') + '">' +
          '<span class="otok">' + esc(o.token) + '</span>' +
          '<span class="ogrow">' + esc(o.qty) + ' × ' + esc(o.itemName) + ' · 🎒 ' + esc(o.buyer || '—') + '</span>' +
          (o.given
            ? '<span class="given-tag">✅ Given</span>'
            : '<button type="button" class="btn-given" data-act="given" data-token="' + esc(o.token) + '">🤝 Given</button>') +
          '</div>';
      }).join('');
      return '<div class="slot-group">' +
        '<div class="slot-group-head"><span class="dot dot-' + rush + '"></span>🕐 ' + esc(g.label) +
        ' <span class="count">· ' + count + ' ' + (count === 1 ? 'order' : 'orders') + '</span></div>' +
        rows + '</div>';
    }).join('');
  }

  ordersList.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-act="given"]');
    if (!btn) return;
    var r = Store.markGiven(btn.dataset.token);
    if (!r.ok) { toast('⚠️ ' + r.message); return; }
    renderOrders();
    renderPrep();
  });

  /* =========================================================
   *  TOMORROW'S PREP (prediction + 7-day CSS bar chart)
   * ======================================================= */
  function renderPrep() {
    var list = Store.getPrepList();
    var impact = Store.todayImpact();
    impactLine.textContent = 'Today\'s impact — Pre-orders: ' + impact.preOrders +
      ' · est. queue time saved: ' + impact.preOrders + ' × 5 = ' + impact.minutes + ' min (estimate)';

    if (!list.length) {
      prepList.innerHTML = '<p class="empty-state">Add items to see tomorrow\'s prep suggestion. 🍽️</p>';
      return;
    }
    prepList.innerHTML = list.map(function (p) {
      var bars = p.days.map(function (d, idx) {
        var hpx = d > 0 ? Math.max(6, Math.round((d / p.max) * 74)) : 3; // px within a 96px chart
        var isToday = idx === p.days.length - 1;
        return '<div class="bar-col"><div class="bar' + (isToday ? ' today' : '') + '" style="height:' + hpx + 'px" title="' +
          esc(p.labels[idx]) + ': ' + d + ' sold"></div><span class="bar-lbl">' + esc(p.labels[idx]) + '</span></div>';
      }).join('');
      var line = p.predicted > 0
        ? '<span class="prep-emoji" aria-hidden="true">' + esc(p.emoji) + '</span>Tomorrow make <b>' + p.predicted + ' ' + esc(plural(p.name.toLowerCase())) + '</b> 🍽️'
        : '<span class="prep-emoji" aria-hidden="true">' + esc(p.emoji) + '</span>' + esc(p.name) + ' — no sales history yet, start small';
      return '<div class="prep-item"><p class="prep-line">' + line + '</p>' +
        '<div class="bar-chart" role="img" aria-label="Last 7 days sales for ' + esc(p.name) + ': ' + p.days.join(', ') + '">' + bars + '</div></div>';
    }).join('');
  }

  /* =========================================================
   *  ITEM ACTIONS
   * ======================================================= */
  function handleAction(act, id) {
    var item = findItem(id);
    if (!item) { render(); return; }

    if (act === 'inc' || act === 'dec') {
      var next = Math.min(500, Math.max(0, item.qty + (act === 'inc' ? 1 : -1)));
      var r = Store.setQty(id, next);
      if (!r.ok) toast('⚠️ ' + r.message);
      render();
    } else if (act === 'set') {
      var v = prompt('Exact quantity for ' + item.name + ' (0–500):', String(item.qty));
      if (v === null) return;
      var res = Store.setQty(id, Number(v));
      if (!res.ok) toast('⚠️ ' + res.message);
      render();
    } else if (act === 'soldout') {
      var res2 = Store.toggleSoldOut(id);
      if (!res2.ok) toast('⚠️ ' + res2.message);
      render();
    } else if (act === 'edit') {
      startEdit(item);
    } else if (act === 'del') {
      if (!confirm('Delete ' + item.name + ' from today\u2019s menu?')) return;
      if (editIdInput.value === id) resetForm();
      var res3 = Store.deleteItem(id);
      if (!res3.ok) toast('⚠️ ' + res3.message);
      render();
      renderPrep();
    }
  }

  /* ---------- add / edit form ---------- */
  function startEdit(item) {
    editIdInput.value = item.id;
    nameInput.value = item.name;
    emojiInput.value = item.emoji || '';
    paintEmojiSelection();
    qtyInput.value = item.qty;
    priceInput.value = item.price;
    $('form-title-text').textContent = 'Edit item';
    submitBtn.textContent = '✅ Save changes';
    cancelBtn.hidden = false;
    hideFormMsg();
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    nameInput.focus();
  }

  function resetForm() {
    form.reset();
    editIdInput.value = '';
    emojiInput.value = '';
    $('form-title-text').textContent = "Add today's item";
    submitBtn.textContent = '➕ Add item';
    cancelBtn.hidden = true;
    hideFormMsg();
    paintEmojiSelection();
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    hideFormMsg();
    var emoji = emojiInput ? emojiInput.value.trim() : '';
    var r;
    if (editIdInput.value) {
      r = Store.updateItem(editIdInput.value, nameInput.value, qtyInput.value, priceInput.value, emoji);
    } else {
      r = Store.addItem(nameInput.value, qtyInput.value, priceInput.value, emoji);
    }
    if (!r.ok) { showFormMsg('error', '⚠️ ' + r.message); return; }
    var wasEdit = !!editIdInput.value;
    resetForm();
    showFormMsg('ok', wasEdit ? '✅ Saved!' : '✅ Added to menu!');
    render();
    renderPrep();
  });

  cancelBtn.addEventListener('click', resetForm);

  /* emoji quick-pick */
  var picker = $('emoji-picker');
  function paintEmojiSelection() {
    var current = emojiInput.value;
    picker.querySelectorAll('.emoji-pick').forEach(function (b) {
      var on = b.dataset.emoji === current && current !== '';
      b.style.outline = on ? '3px solid var(--brand)' : 'none';
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }
  picker.addEventListener('click', function (e) {
    var b = e.target.closest('.emoji-pick');
    if (!b) return;
    emojiInput.value = b.dataset.emoji === '❌' ? '' : b.dataset.emoji;
    paintEmojiSelection();
  });

  /* ---------- demo reset ---------- */
  resetBtn.addEventListener('click', function () {
    if (!confirm('Reset all demo data (items, orders, sales)?')) return;
    Store.clearAll();
    lastTokens = tokenSet();
    resetForm();
    render();
    renderOrders();
    renderPrep();
    toast('🧪 Demo data reset');
  });

  /* ---------- live sync (other tab) ---------- */
  function tokenSet() {
    var s = {};
    Store.getOrders().forEach(function (o) { s[o.token] = true; });
    return s;
  }
  var lastTokens = tokenSet();

  Store.onChange(function () {
    var orders = Store.getOrders();
    var fresh = orders.filter(function (o) { return !lastTokens[o.token]; });
    if (fresh.length) {
      // newest by token number
      var newest = fresh.reduce(function (a, b) { return a.token > b.token ? a : b; });
      toast('🔔 New: ' + newest.token + ' · ' + newest.qty + ' × ' + newest.itemName + ' · ' + newest.slotLabel);
    }
    lastTokens = tokenSet();
    renderOrders();
    render();
    renderPrep();
  });

  render();
  renderOrders();
  renderPrep();
})();
