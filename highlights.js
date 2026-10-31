// Highlights tab: mahahalagang detalye mula sa lahat ng data sa Google Sheet
// (pinakamatagal na tenant, record na buwan, occupancy, at listahan ng lahat ng tenant).
//
// Sariling file ito: ito mismo ang gumagawa ng tab button at ng section. Naka-load pagkatapos ng
// dashboard.js, at gumagamit ng mga global mula sa index.html at dashboard.js:
//   workbook, parseSheet, isArchived, roomOf, formatCurrency, excelDateToFullMonthYear, shortMonthYear,
//   tenantSelect, monthlyTotals, occupancyByMonth, allRooms, roomsOpenIn, serialToDate, renderDataNote,
//   showView, VIEWS
//
// Nire-render kapag binuksan ang tab ('view-shown') o kapag may bagong data ('workbook-loaded').

// Kailangan ng ≥3 buwang data para makasali sa "pinakamatagal" at sa mga average ng konsumo
const HL_MIN_MONTHS = 3;

// ---------- Markup: tab button at section ----------
(function setupHighlightsTab() {
  const tab = document.createElement('button');
  tab.className = 'view-tab';
  tab.setAttribute('role', 'tab');
  tab.dataset.view = 'highlights';
  tab.innerText = 'Highlights';
  document.querySelector('.view-tabs').appendChild(tab);

  const section = document.createElement('section');
  section.id = 'viewHighlights';
  section.className = 'highlights-view';
  section.hidden = true;
  section.innerHTML = `
    <div class="card">
      <div class="card-head">
        <div>
          <h2 class="card-title" style="margin:0;">Highlights</h2>
          <p class="muted">Mahahalagang detalye mula sa lahat ng data sa Google Sheet</p>
        </div>
      </div>
      <p class="data-note" id="hlNote"></p>
    </div>
    <div class="hl-grid" id="hlCards"></div>
    <div class="hl-rank-grid" id="hlRanks"></div>
    <h2 class="section-title">Top 10 bawat buwan</h2>
    <div class="hl-rank-grid" id="hlTop10"></div>
    <div class="card">
      <div class="card-head">
        <div>
          <h3>Lahat ng tenant</h3>
          <p class="muted">Ayon sa unang buwan</p>
        </div>
      </div>
      <div class="hl-table-wrap">
        <table class="hl-table">
          <thead>
            <tr><th>Tenant</th><th>Kwarto</th><th>Mula</th><th>Hanggang</th><th>Ilang buwan</th><th>Kabuuang naibayad</th><th>Average na bill</th></tr>
          </thead>
          <tbody id="hlTenantBody"></tbody>
          <tfoot id="hlTenantFoot"></tfoot>
        </table>
      </div>
    </div>
    <div class="empty-state" id="hlEmpty" hidden>
      <strong>Wala pang data</strong>
      Hinihintay pa ang data mula sa Google Sheet.
    </div>`;
  document.getElementById('viewSummary').after(section);
  VIEWS.highlights = 'viewHighlights';
})();

// ---------- Kuwenta ----------

// Buod ng bawat tab (tenant): unang buwan, ilang buwang may singil, kabuuan, at konsumo
function tenantStats() {
  const latestOverall = Math.max(...monthlyTotals().map(m => m.serial));
  return workbook.SheetNames.map((name, i) => {
    const rows = parseSheet(name).data.filter(r => r && typeof r[0] === 'number');
    const billed = rows.filter(r => typeof r[18] === 'number');
    const kwh = billed.filter(r => typeof r[4] === 'number');
    const m3 = billed.filter(r => typeof r[11] === 'number');
    const sum = (list, col) => list.reduce((s, r) => s + r[col], 0);
    const maxKwh = kwh.reduce((best, r) => (!best || r[4] > best[4] ? r : best), null);
    const lastBilled = billed.reduce((a, r) => (!a || r[0] > a[0] ? r : a), null);
    const archived = isArchived(i);
    return {
      name, archived, room: roomOf(name),
      firstSerial: rows.length ? Math.min(...rows.map(r => r[0])) : null,
      // Huling buwan: ang huling may singil, o kung wala pa, ang huling row na may petsa
      lastSerial: lastBilled ? lastBilled[0] : (rows.length ? Math.max(...rows.map(r => r[0])) : null),
      latestLabel: excelDateToFullMonthYear((lastBilled || rows[rows.length - 1] || [latestOverall])[0]),
      months: billed.length,
      total: sum(billed, 18),
      avgBill: billed.length ? sum(billed, 18) / billed.length : null,
      kwhMonths: kwh.length,
      avgKwh: kwh.length ? sum(kwh, 4) / kwh.length : null,
      maxKwh: maxKwh ? { value: maxKwh[4], label: excelDateToFullMonthYear(maxKwh[0]) } : null,
      m3Months: m3.length,
      avgM3: m3.length ? sum(m3, 11) / m3.length : null
    };
  });
}

// Top N (karaniwang 5), may ranggo; magkapareho ang ranggo ng magkatabla (1, 1, 3…)
const HL_TOP = 5;
function rankTop(list, value, lowest = false, limit = HL_TOP) {
  const sorted = list.filter(x => value(x) != null)
    .sort((a, b) => (lowest ? value(a) - value(b) : value(b) - value(a)));
  let rank = 0, prev = null;
  return sorted.slice(0, limit).map((item, i) => {
    if (value(item) !== prev) { rank = i + 1; prev = value(item); }
    return { item, rank };
  });
}

// ---------- Render ----------

function renderHighlights() {
  const hasData = !!workbook;
  document.getElementById('hlEmpty').hidden = hasData;
  document.querySelectorAll('#viewHighlights > .card, #viewHighlights > .section-title, #hlCards, #hlRanks, #hlTop10').forEach(el => { el.hidden = !hasData; });
  if (!hasData) return;

  renderDataNote(true, document.getElementById('hlNote'));

  const stats = tenantStats();
  const months = monthlyTotals();
  const rooms = allRooms();
  const occ = occupancyByMonth();
  const latest = months[months.length - 1];
  const tenantLine = t => [t.room ? `Room ${t.room}` : null, t.archived ? 'archived' : 'active'].filter(Boolean).join(' · ');
  const num = (v, digits = 0) => v.toLocaleString('en-PH', { maximumFractionDigits: digits });

  // ---- Mga iisang halaga (stat cards) ----
  const cards = [];
  if (months.length) {
    const total = months.reduce((s, m) => s + m.total, 0);
    const span = `${shortMonthYear(months[0].serial)} – ${shortMonthYear(latest.serial)}`;
    cards.push({ label: 'Kabuuang koleksyon', value: formatCurrency(total), detail: `${months.length} buwan (${span})` });
    cards.push({ label: 'Average bawat buwan', value: formatCurrency(total / months.length), detail: span });
  }
  // Occupancy: ang mga kwartong bukas na lang sa bawat buwan ang binibilang (ROOM_OPENED sa dashboard.js)
  if (rooms.length && months.length) {
    const occupiedIn = m => roomsOpenIn(m.label).filter(r => (occ.get(m.label) || new Set()).has(r));
    const pct = m => occupiedIn(m).length / (roomsOpenIn(m.label).length || 1) * 100;
    const avgPct = months.reduce((s, m) => s + pct(m), 0) / months.length;
    const openNow = roomsOpenIn(latest.label);
    const now = occupiedIn(latest);
    const vacant = openNow.filter(r => !now.includes(r));
    cards.push({
      label: 'Occupancy', value: `${Math.round(avgPct)}% average`,
      detail: `Ngayong ${shortMonthYear(latest.serial)}: ${now.length}/${openNow.length} · ${vacant.length ? 'Bakante: ' + vacant.map(r => 'Room ' + r).join(', ') : 'walang bakante'}`
    });
  }
  const tenants = stats.filter(t => t.firstSerial != null);
  const activeCount = tenants.filter(t => !t.archived).length;
  cards.push({ label: 'Mga naging tenant', value: String(tenants.length), detail: `${activeCount} active · ${tenants.length - activeCount} archived` });

  const grid = document.getElementById('hlCards');
  grid.innerHTML = '';
  cards.forEach(c => {
    const card = document.createElement('div');
    card.className = 'hl-card';
    ['hl-label', 'hl-value', 'hl-detail'].forEach((cls, k) => {
      const el = document.createElement('span');
      el.className = cls;
      el.innerText = [c.label, c.value, c.detail][k];
      card.appendChild(el);
    });
    grid.appendChild(card);
  });

  // ---- Top 5 ----
  // bar: value / pinakamalaki sa listahan (null = walang bar, hal. petsa)
  const ranks = [];
  const withBars = (list, value) => {
    const max = Math.max(...list.map(r => value(r.item)), 0);
    return r => (max > 0 ? value(r.item) / max : null);
  };

  const longest = rankTop(stats.filter(t => t.months > 0), t => t.months);
  const longestBar = withBars(longest, t => t.months);
  ranks.push({
    title: 'Pinakamatagal na tenant', note: 'Ayon sa dami ng buwang may singil',
    rows: longest.map(r => ({ rank: r.rank, name: r.item.name, value: `${r.item.months} buwan`, bar: longestBar(r),
      sub: `${tenantLine(r.item)} · mula ${shortMonthYear(r.item.firstSerial)}` }))
  });

  const newest = rankTop(tenants, t => t.firstSerial);
  ranks.push({
    title: 'Pinakabagong tenant', note: 'Ayon sa unang buwan sa sheet',
    rows: newest.map(r => ({ rank: r.rank, name: r.item.name, value: shortMonthYear(r.item.firstSerial), bar: null, sub: tenantLine(r.item) }))
  });

  const high = rankTop(months, m => m.total);
  const highBar = withBars(high, m => m.total);
  ranks.push({
    title: 'Pinakamataas na koleksyon', note: 'Kabuuan ng lahat ng tenant sa isang buwan',
    rows: high.map(r => ({ rank: r.rank, name: shortMonthYear(r.item.serial), value: formatCurrency(r.item.total), bar: highBar(r),
      sub: `${r.item.tenantCount} ${r.item.tenantCount === 1 ? 'tenant' : 'tenants'}` }))
  });

  const low = rankTop(months, m => m.total, true);
  const lowBar = withBars(low, m => m.total);
  ranks.push({
    title: 'Pinakamababang koleksyon', note: 'Kabuuan ng lahat ng tenant sa isang buwan',
    rows: low.map(r => ({ rank: r.rank, name: shortMonthYear(r.item.serial), value: formatCurrency(r.item.total), bar: lowBar(r),
      sub: `${r.item.tenantCount} ${r.item.tenantCount === 1 ? 'tenant' : 'tenants'}` }))
  });

  const kwh = rankTop(stats.filter(t => t.kwhMonths >= HL_MIN_MONTHS), t => t.avgKwh);
  const kwhBar = withBars(kwh, t => t.avgKwh);
  ranks.push({
    title: 'Pinakamalakas sa kuryente', note: `Average na kWh bawat buwan (may ≥${HL_MIN_MONTHS} buwang data)`,
    rows: kwh.map(r => ({ rank: r.rank, name: r.item.name, value: `${num(r.item.avgKwh)} kWh`, bar: kwhBar(r),
      sub: `${tenantLine(r.item)}${r.item.maxKwh ? ` · record ${num(r.item.maxKwh.value)} kWh` : ''}` }))
  });

  const m3 = rankTop(stats.filter(t => t.m3Months >= HL_MIN_MONTHS), t => t.avgM3);
  const m3Bar = withBars(m3, t => t.avgM3);
  ranks.push({
    title: 'Pinakamalakas sa tubig', note: `Average na m³ bawat buwan (may ≥${HL_MIN_MONTHS} buwang data)`,
    rows: m3.map(r => ({ rank: r.rank, name: r.item.name, value: `${num(r.item.avgM3, 1)} m³`, bar: m3Bar(r), sub: tenantLine(r.item) }))
  });

  const rankGrid = document.getElementById('hlRanks');
  rankGrid.innerHTML = '';
  ranks.filter(r => r.rows.length).forEach(r => rankGrid.appendChild(rankCard(r)));

  // ---- Top 10 bawat buwan: isang tenant sa isang buwan (hal. Kevin Dales · Apr 2026) ----
  const records = [];
  workbook.SheetNames.forEach((name, i) => {
    const room = roomOf(name), archived = isArchived(i);
    parseSheet(name).data.forEach(r => {
      if (r && typeof r[0] === 'number' && typeof r[18] === 'number') {
        records.push({ name, room, archived, serial: r[0], kwh: r[4], m3: r[11], total: r[18],
          // Bill na walang renta: Total (S) bawas ang Rent (B) = kuryente + tubig + internet + others
          bills: r[18] - (typeof r[1] === 'number' ? r[1] : 0) });
      }
    });
  });
  const numOrNull = v => (typeof v === 'number' ? v : null);
  const recordRows = (value, format) => {
    const top = rankTop(records, value, false, 10);
    const bar = withBars(top, value);
    return top.map(r => ({
      rank: r.rank, name: r.item.name, value: format(value(r.item)), bar: bar(r),
      sub: [shortMonthYear(r.item.serial), r.item.room ? `Room ${r.item.room}` : null].filter(Boolean).join(' · ')
    }));
  };
  const top10 = [
    { title: 'Pinakamalaking konsumo ng kuryente', note: 'Isang tenant sa isang buwan (kWh)',
      rows: recordRows(x => numOrNull(x.kwh), v => `${num(v)} kWh`) },
    { title: 'Pinakamalaking konsumo ng tubig', note: 'Isang tenant sa isang buwan (m³)',
      rows: recordRows(x => numOrNull(x.m3), v => `${num(v, 1)} m³`) },
    { title: 'Pinakamalaking bill (walang renta)', note: 'Kuryente + tubig + internet + others ng isang tenant sa isang buwan',
      rows: recordRows(x => x.bills, v => formatCurrency(v)) }
  ];
  const top10Grid = document.getElementById('hlTop10');
  top10Grid.innerHTML = '';
  top10.filter(r => r.rows.length).forEach(r => top10Grid.appendChild(rankCard(r)));

  renderTenantTable(stats, latest);
}

// Isang Top 5 card: pamagat, maikling paliwanag, at listahang may ranggo, value at maliit na bar
function rankCard({ title, note, rows }) {
  const card = document.createElement('div');
  card.className = 'hl-rank';
  const head = document.createElement('div');
  head.className = 'hl-rank-head';
  const h = document.createElement('h3');
  h.innerText = `Top ${rows.length}: ${title}`;
  const p = document.createElement('p');
  p.className = 'muted';
  p.innerText = note;
  head.append(h, p);
  const list = document.createElement('ol');
  list.className = 'hl-rank-list';
  rows.forEach(row => {
    const li = document.createElement('li');
    if (row.rank === 1) li.className = 'first';
    li.innerHTML = '<span class="rank-no"></span><div class="rank-main"><span class="rank-name"></span><span class="rank-sub"></span></div><span class="rank-value"></span>';
    li.querySelector('.rank-no').innerText = row.rank;
    li.querySelector('.rank-name').innerText = row.name;
    li.querySelector('.rank-sub').innerText = row.sub;
    li.querySelector('.rank-value').innerText = row.value;
    if (row.bar != null) {
      const bar = document.createElement('span');
      bar.className = 'rank-bar';
      bar.innerHTML = '<i></i>';
      bar.firstChild.style.width = Math.max(2, row.bar * 100) + '%';
      li.querySelector('.rank-main').appendChild(bar);
    }
    list.appendChild(li);
  });
  card.append(head, list);
  return card;
}

// "Lahat ng tenant" table, ayon sa unang buwan
function renderTenantTable(stats, latest) {
  const body = document.getElementById('hlTenantBody');
  body.innerHTML = '';
  const list = stats.filter(t => t.firstSerial != null).sort((a, b) => a.firstSerial - b.firstSerial || a.name.localeCompare(b.name));
  list.forEach(t => {
    const tr = document.createElement('tr');
    const nameTd = document.createElement('td');
    nameTd.innerText = t.name;
    if (t.archived) {
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.innerText = 'archived';
      nameTd.appendChild(tag);
    }
    tr.appendChild(nameTd);
    [
      t.room || '-',
      shortMonthYear(t.firstSerial),
      t.archived ? (t.lastSerial ? shortMonthYear(t.lastSerial) : '-') : 'ngayon',
      String(t.months),
      formatCurrency(t.total),
      t.avgBill != null ? formatCurrency(t.avgBill) : '-'
    ].forEach((text, k) => {
      const td = document.createElement('td');
      if (k >= 3) td.className = 'num';
      td.innerText = text;
      tr.appendChild(td);
    });
    body.appendChild(tr);
  });

  const foot = document.getElementById('hlTenantFoot');
  foot.innerHTML = '';
  const tr = document.createElement('tr');
  const totalMonths = list.reduce((s, t) => s + t.months, 0);
  const totalPaid = list.reduce((s, t) => s + t.total, 0);
  [`Total (${list.length} tenants)`, '', '', '', String(totalMonths), formatCurrency(totalPaid), ''].forEach((text, k) => {
    const td = document.createElement('td');
    if (k >= 3) td.className = 'num';
    td.innerText = text;
    tr.appendChild(td);
  });
  foot.appendChild(tr);
}

// ---------- Kailan nire-render ----------
document.addEventListener('view-shown', e => { if (e.detail === 'highlights') renderHighlights(); });
document.addEventListener('workbook-loaded', () => {
  if (!document.getElementById('viewHighlights').hidden) renderHighlights();
});

// Bumalik sa Highlights tab kung doon ka huling nakatingin (#highlights sa URL)
if (location.hash === '#highlights') showView('highlights');
