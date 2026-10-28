/* student.js — live stock + pickup slots + pre-order flow. Data via Store. */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var NICK_KEY = 'canteenlive.nickname';
  var SLOT_PICK_KEY = 'canteenlive.slot';

  var itemsList = $('items-list');
  var emptyItems = $('empty-items');
  var nickInput = $('nickname');
  var tokenCard = $('token-card');
  var tokenNumber = $('token-number');
  var tokenDetail = $('token-detail');
  var tokenSlotEl = $('token-slot');
  var slotGrid = $('slot-grid');
  var slotHint = $('slot-hint');
  var slotStatus = $('slot-status');

  if (!Store.available) $('ls-warning').hidden = false;

  var openItemId = null;       // which item's order box is expanded
  var pendingError = null;     // { itemId, text } survives live re-render
  var selectedSlotId = null;

  /* ---------- nickname ---------- */
  try {
    var savedNick = localStorage.getItem(NICK_KEY);
    if (savedNick) nickInput.value = savedNick;
  } catch (e) { /* ignore */ }
  nickInput.addEventListener('input', function () {
    try { localStorage.setItem(NICK_KEY, nickInput.value.trim().slice(0, 24)); } catch (e) {}
  });

  /* ---------- selected slot (persisted so refresh keeps the choice) ---------- */
  function loadSlot() { try { return localStorage.getItem(SLOT_PICK_KEY) || null; } catch (e) { return null; } }
  function saveSlot(id) {
    try {
      if (id) localStorage.setItem(SLOT_PICK_KEY, id);
      else localStorage.removeItem(SLOT_PICK_KEY);
    } catch (e) {}
  }
  selectedSlotId = loadSlot();

  $('token-dismiss-btn').addEventListener('click', function () { tokenCard.hidden = true; });

  /* ---------- toast ---------- */
  var toastTimer = null;
  function toast(text) {
    var el = $('toast');
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2600);
  }

  /* ---------- helpers ---------- */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function badge(qty, soldOut) {
    if (soldOut || qty === 0) return { cls: 'badge-red', text: '❌ Sold out' };
    if (qty <= 5) return { cls: 'badge-orange', text: '⚠️ Only ' + qty + ' left!' };
    return { cls: 'badge-green', text: '✅ ' + qty + ' left' };
  }

  /* =========================================================
   *  PICKUP SLOTS
   * ======================================================= */
  function renderSlots() {
    var slots = Store.getSlots();

    // Drop a selection that is no longer usable (past / full / gone).
    if (selectedSlotId) {
      var cur = null;
      for (var i = 0; i < slots.length; i++) if (slots[i].id === selectedSlotId) cur = slots[i];
      if (!cur || cur.past || cur.full) { selectedSlotId = null; saveSlot(null); }
    }

    slotGrid.innerHTML = slots.map(function (s) {
      var off = s.past || s.full;
      var dash = s.label.indexOf('-');
      var startTxt = (dash > 0 ? s.label.slice(0, dash) : s.label).replace(/\s?(AM|PM)/, '');
      var apm = /(AM|PM)\s*$/.exec(s.label);
      var ap = apm ? apm[1] : '';
      var cTxt = off ? (s.full ? 'full' : 'past') : (s.count + (s.count === 1 ? ' order' : ' orders'));
      var cls = 'slot rush-' + s.rush + (off ? ' slot-off' : '') + (selectedSlotId === s.id ? ' slot-sel' : '');
      return '<button type="button" class="' + cls + '" data-slot="' + esc(s.id) + '"' +
        (off ? ' disabled aria-disabled="true"' : '') + ' aria-pressed="' + (selectedSlotId === s.id) + '"' +
        ' title="' + esc(s.label) + '">' +
        '<span class="t">' + esc(startTxt) + '</span>' +
        '<span class="c">' + esc(ap) + ' · ' + esc(cTxt) + '</span>' +
        '</button>';
    }).join('');

    // Hint line.
    var hint = Store.getSlotHint();
    var msg;
    if (selectedSlotId) {
      var sel = Store.slotById(selectedSlotId);
      msg = '✅ Pickup chosen: ' + (sel ? sel.label : '') + ' — tap another slot to change';
      slotHint.classList.remove('muted');
    } else if (hint) {
      msg = '💡 Less crowded: ' + hint.label + ' — tap it to choose';
      slotHint.classList.remove('muted');
    } else {
      msg = '⚠️ No open slots right now. Please check back a little later.';
      slotHint.classList.add('muted');
    }
    slotHint.textContent = msg;
    slotStatus.textContent = msg;
  }

  slotGrid.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-slot]');
    if (!btn || btn.disabled) return;
    selectedSlotId = btn.dataset.slot;
    saveSlot(selectedSlotId);
    renderSlots();
  });

  /* =========================================================
   *  MENU ITEMS
   * ======================================================= */
  function render(changedIds) {
    var items = Store.getItems();
    emptyItems.hidden = items.length > 0;
    itemsList.innerHTML = '';

    items.forEach(function (item) {
      var b = badge(item.qty, item.soldOut);
      var unavailable = item.soldOut || item.qty === 0;
      var card = document.createElement('article');
      card.className = 'card item' + (unavailable ? ' soldout' : '');
      card.setAttribute('data-id', item.id);
      var maxQty = Math.min(item.qty, 20);

      var box = unavailable ? '' :
        '<div class="order-box' + (openItemId === item.id ? ' open' : '') + '" data-box="1">' +
          '<label for="qty-' + esc(item.id) + '">How many? (max ' + maxQty + ')</label>' +
          '<div class="stepper">' +
            '<button type="button" class="step-btn step-minus" data-act="dec" aria-label="One fewer">−</button>' +
            '<input id="qty-' + esc(item.id) + '" class="qty-readout" type="number" inputmode="numeric" min="1" max="' + maxQty + '" step="1" value="1" style="text-align:center;" data-qty="1">' +
            '<button type="button" class="step-btn step-plus" data-act="inc" aria-label="One more">＋</button>' +
          '</div>' +
          '<p class="msg msg-live" style="margin:10px 0 0;">💰 Total: ₹<span data-total="1">' + item.price + '</span></p>' +
          '<button type="button" class="btn btn-primary" data-act="order" style="width:100%;margin-top:10px;">✅ Pre-order</button>' +
          '<p class="msg msg-error" data-err="1" hidden></p>' +
        '</div>';

      card.innerHTML =
        '<div class="item-top">' +
          '<span class="item-emoji" aria-hidden="true">' + (esc(item.emoji) || '🍽️') + '</span>' +
          '<span class="item-name">' + esc(item.name) + '</span>' +
          '<span class="item-price">₹' + esc(item.price) + '</span>' +
          '<span class="badge ' + b.cls + '">' + b.text + '</span>' +
        '</div>' +
        (unavailable
          ? '<p class="msg msg-error" style="margin:0;">😔 Finished for today. Pick something else!</p>'
          : '<button type="button" class="btn btn-primary" data-act="toggle" style="width:100%;">🛒 Pre-order ' + esc(item.name) + '</button>') +
        box;

      card.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-act]');
        if (!btn) return;
        handleCardClick(btn, item, card);
      });
      card.addEventListener('input', function (e) {
        if (e.target.matches('[data-qty]')) clampQty(card, item); // keeps total honest
      });

      itemsList.appendChild(card);

      // Re-show a pending error on the right card after a re-render.
      if (pendingError && pendingError.itemId === item.id && !unavailable) {
        var err = card.querySelector('[data-err]');
        if (err) { err.hidden = false; err.textContent = pendingError.text; }
      }
      // Subtle bump animation when stock changed via another tab.
      if (changedIds && changedIds.indexOf(item.id) !== -1) {
        var bg = card.querySelector('.badge');
        if (bg) { bg.classList.add('bump'); setTimeout(function () { bg.classList.remove('bump'); }, 450); }
      }
    });
  }

  function qtyField(card) { return card.querySelector('[data-qty]'); }

  function clampQty(card, item) {
    var input = qtyField(card);
    var max = Math.min(item.qty, 20);
    var v = Math.floor(Number(input.value));
    if (!isFinite(v) || v < 1) v = 1;
    if (v > max) v = max;
    input.value = v;
    input.max = max;
    updateTotal(card, item);
  }

  function updateTotal(card, item) {
    var v = Math.floor(Number(qtyField(card).value));
    if (!isFinite(v) || v < 1) v = 1;
    card.querySelector('[data-total]').textContent = (Math.round(v * item.price * 100) / 100);
  }

  function setCardError(itemId, text) {
    pendingError = { itemId: itemId, text: text };
    openItemId = itemId; // make sure the box is visible
    render();
  }

  /* ---------- interactions ---------- */
  function handleCardClick(btn, item, card) {
    var act = btn.dataset.act;

    if (act === 'toggle') {
      if (openItemId === item.id) { openItemId = null; pendingError = null; }
      else { openItemId = item.id; pendingError = null; }
      render();
      if (openItemId === item.id) {
        var f = qtyField($('items-list').querySelector('[data-id="' + item.id + '"]'));
        if (f) f.focus();
      }
    } else if (act === 'inc' || act === 'dec') {
      var input = qtyField(card);
      input.value = Number(input.value) + (act === 'inc' ? 1 : -1);
      clampQty(card, item);
    } else if (act === 'order') {
      placeOrder(card, item);
    }
  }

  function placeOrder(card, item) {
    var nickname = nickInput.value.trim();
    if (!nickname) {
      setCardError(item.id, '🙂 Please enter your nickname first (box at the top).');
      nickInput.focus();
      nickInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (!selectedSlotId) {
      setCardError(item.id, '🕐 Please pick a pickup time slot above first.');
      $('slot-title').scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    var qty = Math.floor(Number(qtyField(card).value));
    if (!isFinite(qty) || qty < 1) qty = 1;

    var r = Store.placeOrder(item.id, qty, nickname, selectedSlotId);
    if (!r.ok) {
      // stock / slot may have changed while they were tapping
      pendingError = null;
      render();
      renderSlots();
      setCardError(item.id, r.message);
      return;
    }

    // Success: show token + pickup slot, close box, clear error.
    pendingError = null;
    openItemId = null;
    tokenNumber.textContent = r.token;
    tokenSlotEl.textContent = 'Pickup: ' + r.slotLabel;
    tokenDetail.textContent = r.qty + ' × ' + r.item + ' — show this token at the counter';
    tokenCard.hidden = false;
    tokenCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    render();
    renderSlots();
  }

  /* ---------- live sync (other tab changed data) ---------- */
  var lastQty = {};
  function snapshot(items) { items.forEach(function (it) { lastQty[it.id] = it.qty; }); }
  snapshot(Store.getItems());

  Store.onChange(function () {
    var items = Store.getItems();
    var changed = [];
    var notices = [];
    items.forEach(function (it) {
      var prev = lastQty[it.id];
      if (prev !== undefined && prev !== it.qty) { changed.push(it.id); notices.push(it.name + ': ' + prev + ' → ' + it.qty); }
      else if (prev === undefined) { notices.push('New item: ' + it.name + '!'); }
    });
    snapshot(items);
    render(changed);
    renderSlots(); // another student may have booked a slot
    if (notices.length) toast('🔄 Live update — ' + notices.join(' · '));
  });

  render();
  renderSlots();
})();
