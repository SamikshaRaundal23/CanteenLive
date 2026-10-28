# 🍛 CanteenLive

**Know before you queue. Order before it's gone.**

`Track: Entrepreneurship & Local Business` · `PromptWars x KickToTech 2026` · `28 October 2026` · `Built by: [Samiksha Raundal]`

![HTML](https://img.shields.io/badge/HTML5-e34f26) ![CSS](https://img.shields.io/badge/CSS3-1572b6) ![JS](https://img.shields.io/badge/Vanilla_JS-f7df1e?logo=javascript&logoColor=black) ![Storage](https://img.shields.io/badge/localStorage-no_backend-green)

---

## 1. Problem Statement

In our college food court, the canteen gets a heavy crowd at breakfast and lunch. A student stands in
line for **15–20 minutes**, and when their turn finally comes they ask for a samosa — the shopkeeper says
**"samosa is finished"**. Those minutes are completely wasted, and there was no way to know before joining.

- **Students** cannot see what is available before joining the long queue.
- **The shopkeeper** has to guess how many samosas and vada
  pavs to make each day — so some days items sell out early, and other days food is made and wasted.
- The **long queue itself** creates crowding in the food court.

> The real problem is not the food, it is the missing information on both sides.

## 2. Users

- **Canteen shopkeeper (uncle):** low tech comfort → big buttons, icons, very few steps, minimal English.
- **College students:** use phones, want speed and to save time.

## 3. Our Solution

CanteenLive gives the uncle one simple screen to set **live stock**, and students a phone view of it. A student
picks a **15-minute pickup slot**, taps **Pre-order**, and instantly gets a **token** (T-001...) while stock drops
in real time. The **Rush Meter** colours each slot so students choose quieter times and the crowd spreads out.
For the uncle, **Tomorrow's Prep** turns 7 days of sales into a plain "how much to make" suggestion.

| Before | With CanteenLive |
| --- | --- |
| Join the queue, discover "sold out" after 15–20 min | See live stock on your phone before joining |
| No idea when things will be ready | Pick a pickup slot and get a token number |
| Everyone arrives at once → long queue | Rush Meter spreads orders across time slots |
| Uncle guesses how much to cook | Tomorrow's Prep suggests quantities |
| Food wasted or sold out too early | Better estimate → less waste, fewer regrets |

## 4. Features (what is actually built)

**Uncle screen**
- Add / edit items (name, quantity, price) with big **+ / −** steppers, tap-to-set exact quantity, and an emoji icon picker — icon-first, large fonts.
- Per-item **Edit**, **Sold Out** and **Delete**; validation (name not empty, qty 0–500, price 1–500, no duplicate names).
- Orders grouped by pickup slot, each with a **🤝 Given** button; plus the **Tomorrow's Prep** card (CSS bar chart + "Today's impact" line).

**Student screen**
- Live stock with colour badges (🟢 more than 5, 🟠 1–5, 🔴 sold out); nickname + **pickup slot** + quantity → **Pre-order** gives a token instantly.
- Stock drops immediately; over-ordering is blocked with a friendly message; **Rush Meter** + **"Less crowded: ..."** hint; past and full slots can't be picked; token shows e.g. `Pickup: 1:15-1:30 PM`.

**Both**
- Live tab-to-tab sync via the `storage` event (no refresh); corrupted data never crashes (all JSON parsing in `try/catch`).
- Mobile-first and accessible (labels, `aria-live`, focus outlines); preloaded with Samosa, Vada Pav and Tea.

## 5. How the Innovation Works

**Rush Meter (crowd spreading).** The day is split into 15-minute slots from 8:00 AM to 4:00 PM (32 slots).
Each slot holds a maximum of 10 orders. A slot is coloured by its current order count and the student is nudged
to the quietest open slot:

```
rush = count >= 9 ? red : count >= 5 ? orange : green   // full & disabled at count >= 10; past slots disabled
```

**Tomorrow's Prep (prediction).** For each item, the average of the last 7 days of sales plus a 10% buffer,
rounded up — shown as "Tomorrow make 28 samosas":

```
suggested = Math.ceil( average(last 7 days) * 1.1 )
```

Sample sales are fictional. Today's impact line = `pre-orders today × 5 minutes (estimate)`.

## 6. Tech Stack

**HTML · CSS · vanilla JavaScript · localStorage** — no backend, no libraries, no cost. It runs offline in any
browser, so the canteen needs no server and no setup; all state lives in the browser.

## 7. Project Structure

```
canteenlive/
├── index.html      Landing page with the two big buttons (Uncle / Student)
├── uncle.html      Shopkeeper screen: items, orders by slot, Tomorrow's Prep
├── uncle.js        Shopkeeper UI logic (rendering, form, Given, prep chart)
├── student.html    Student screen: live stock, pickup slots, token
├── student.js      Student UI logic (slot picker, ordering, live sync)
├── store.js        All localStorage logic in one file: data, slots, prediction, try/catch
├── styles.css      Warm, mobile-first styling, rush colours, CSS bar chart
└── _smoke_test.js  Developer script (Node) that checks the data layer — not part of the UI
```

## 8. How to Run

```bash
python -m http.server 8000      # or:  npx serve
# open http://localhost:8000
```

Then open **two tabs** of the same browser (same device): Uncle page in one, Student page in the other.

**60-second walkthrough**
1. On the Uncle tab, press **🧪 Reset demo** for clean data. Note *Tomorrow make 28 samosas*.
2. On the Student tab, enter a nickname, tap a green slot, set quantity 2, tap **Pre-order** → you get `T-001` with the pickup time.
3. Look back at the Uncle tab → the order appears under that slot, and the Samosa stock dropped. (No refresh.)
4. Tap **🤝 Given** on the order to mark it handed over.

## 9. How AI Was Used

Tool: **Qoder**. I started from the real problem, built **one feature at a time**, **ran the app after every
change**, pasted exact error messages when debugging, and finished with a strict **QA prompt** pass (empty inputs,
over-ordering, full/past slots, corrupted storage, 360px layout, refresh). I reviewed and understood the generated code.

## 10. Testing

| Test | Expected | Result |
| --- | --- | --- |
| Data-layer unit tests (`node _smoke_test.js`) | 43 checks pass | ✅ 43 passed, 0 failed |
| Order more than stock | Blocked with a friendly message | ✅ Pass |
| Order a sold-out item | Blocked | ✅ Pass |
| Fill a slot to 10, try 11th | 11th blocked; slot turns red & disabled | ✅ Pass |
| Past time slots | Shown but disabled | ✅ Pass |
| Prediction value | `ceil(avg of 7 days × 1.1)` → Samosa = 28 | ✅ Pass |
| Invalid form input (name/qty/price) | Friendly validation, no crash | ✅ Pass |
| Corrupted localStorage | App self-heals, no crash, no console error | ✅ Pass |
| Page refresh | Stock, slots, tokens and Given state persist | ✅ Pass |
| Two-tab live sync | Other tab updates without refresh | ✅ Verified at data layer + injected `storage` event; confirm live with two tabs |
| 360px layout | No horizontal overflow, tap targets ≥ 44px | ✅ Pass |

## 11. Responsible Design & Data Safety

Only **fictional sample data** is used (items, prices and 7-day sales are made up). No passwords or API keys,
no backend and no network calls. The app stores **only a nickname** — no personal or sensitive data.

## 12. Honest Limitations

- Data lives in browser **localStorage**, so it works on **one device / browser** (tabs sync only within it).
- The prep suggestion uses **fictional** sample data, so it is an estimate, not a guarantee.
- "Queue time saved" is an **estimate** (`pre-orders × 5 minutes`).
- No real payments and no real notifications.

## 13. Future Scope

Firebase (real phones + cross-device sync) · WhatsApp/SMS pickup alerts · UPI payment ·
voice input in the local language for the uncle · real sales history for better predictions.

## 14. Originality Declaration

> This project was built by me during PromptWars x KickToTech 2026 using AI tools openly.
> I understand the code and can explain it.
> Live demo: coming soon
