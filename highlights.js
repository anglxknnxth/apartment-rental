// Highlights tab: mahahalagang detalye mula sa lahat ng data sa Google Sheet
// (pinakamatagal na tenant, record na buwan, occupancy, at listahan ng lahat ng tenant).
//
// Sariling file ito: ito mismo ang gumagawa ng tab button at ng section. Naka-load pagkatapos ng
// koleksyon.js, at gumagamit ng mga global mula sa index.html at koleksyon.js:
//   workbook, parseSheet, isArchived, roomOf, formatCurrency, excelDateToFullMonthYear, shortMonthYear,
//   tenantSelect, monthlyTotals, occupancyByMonth, allRooms, serialToDate, renderDataNote,
//   selectSummaryMonth, openTenantMonth, showView, VIEWS
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
    <div class="card">
      <div class="card-head">
        <div>
          <h3>Lahat ng tenant</h3>
          <p class="muted">Ayon sa unang buwan · i-click ang row para buksan ang pinakabagong resibo</p>
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

// Lahat ng may pinakamataas (o pinakamababa) na value; kasama ang mga tabla
function topBy(list, value, lowest = false) {
  const vals = list.map(value).filter(v => v != null);
  if (!vals.length) return [];
  const best = lowest ? Math.min(...vals) : Math.max(...vals);
  return list.filter(x => value(x) === best);
}

const joinNames = list => list.length > 1
  ? `${list.slice(0, -1).join(', ')} at ${list[list.length - 1]}`
  : (list[0] || '');

// ---------- Render ----------

function renderHighlights() {
  const hasData = !!workbook;
  document.getElementById('hlEmpty').hidden = hasData;
  document.querySelectorAll('#viewHighlights > .card, #hlCards').forEach(el => { el.hidden = !hasData; });
  if (!hasData) return;

  renderDataNote(true, document.getElementById('hlNote'));

  const stats = tenantStats();
  const months = monthlyTotals();
  const rooms = allRooms();
  const occ = occupancyByMonth();
  const latest = months[months.length - 1];
  const openTenant = t => () => { showView('receipt'); openTenantMonth(t.name, t.latestLabel); };
  const openMonth = label => () => { showView('summary'); selectSummaryMonth(label); };
  const tenantLine = t => [t.room ? `Room ${t.room}` : null, t.archived ? 'archived' : 'active'].filter(Boolean).join(' · ');

  const cards = [];

  // 1) Pinakamatagal na tenant (pinakamaraming buwang may singil)
  const longest = topBy(stats.filter(t => t.months >= HL_MIN_MONTHS), t => t.months);
  if (longest.length) {
    const t = longest[0];
    cards.push({
      label: 'Pinakamatagal na tenant', value: `${joinNames(longest.map(x => x.name))} · ${t.months} buwan`,
      detail: longest.length === 1
        ? `${tenantLine(t)} · mula ${shortMonthYear(t.firstSerial)}${t.archived ? ' hanggang ' + shortMonthYear(t.lastSerial) : ''}`
        : `${t.months} buwan bawat isa`,
      onClick: longest.length === 1 ? openTenant(t) : null
    });
  }

  // 2) Pinakabagong tenant (pinakahuling unang buwan, may singil man o wala pa)
  const newest = topBy(stats.filter(t => t.firstSerial != null), t => t.firstSerial);
  if (newest.length) {
    const t = newest[0];
    cards.push({
      label: 'Pinakabagong tenant', value: joinNames(newest.map(x => x.name)),
      detail: `${newest.length === 1 ? tenantLine(t) + ' · ' : ''}nagsimula noong ${shortMonthYear(t.firstSerial)}`,
      onClick: newest.length === 1 ? openTenant(t) : null
    });
  }

  // 3–5) Record, pinakamababa, at average na koleksyon bawat buwan
  if (months.length) {
    const high = topBy(months, m => m.total)[0];
    const low = topBy(months, m => m.total, true)[0];
    const avg = months.reduce((s, m) => s + m.total, 0) / months.length;
    cards.push({ label: 'Pinakamataas na koleksyon', value: formatCurrency(high.total), detail: high.label, onClick: openMonth(high.label) });
    cards.push({ label: 'Pinakamababang koleksyon', value: formatCurrency(low.total), detail: low.label, onClick: openMonth(low.label) });
    cards.push({
      label: 'Average bawat buwan', value: formatCurrency(avg),
      detail: `${months.length} buwan (${shortMonthYear(months[0].serial)} – ${shortMonthYear(latest.serial)})`
    });
  }

  // 6–7) Pinakamalakas sa kuryente at tubig (average bawat buwan)
  const topKwh = topBy(stats.filter(t => t.kwhMonths >= HL_MIN_MONTHS), t => t.avgKwh);
  if (topKwh.length) {
    const t = topKwh[0];
    const record = topBy(stats.filter(x => x.maxKwh), x => x.maxKwh.value)[0];
    cards.push({
      label: 'Pinakamalakas sa kuryente', value: joinNames(topKwh.map(x => x.name)),
      detail: `~${Math.round(t.avgKwh).toLocaleString('en-PH')} kWh/buwan · record: ${Math.round(record.maxKwh.value).toLocaleString('en-PH')} kWh (${record.name}, ${record.maxKwh.label})`,
      onClick: topKwh.length === 1 ? openTenant(t) : null
    });
  }
  const topM3 = topBy(stats.filter(t => t.m3Months >= HL_MIN_MONTHS), t => t.avgM3);
  if (topM3.length) {
    const t = topM3[0];
    cards.push({
      label: 'Pinakamalakas sa tubig', value: joinNames(topM3.map(x => x.name)),
      detail: `~${t.avgM3.toLocaleString('en-PH', { maximumFractionDigits: 1 })} m³/buwan · ${tenantLine(t)}`,
      onClick: topM3.length === 1 ? openTenant(t) : null
    });
  }

  // 8) Occupancy: average na % ng mga kwartong may nakatira, at ang kasalukuyan
  if (rooms.length && months.length) {
    const pct = m => (occ.get(m.label) || new Set()).size / rooms.length * 100;
    const avgPct = months.reduce((s, m) => s + pct(m), 0) / months.length;
    const now = occ.get(latest.label) || new Set();
    const vacant = rooms.filter(r => !now.has(r));
    cards.push({
      label: 'Occupancy', value: `${Math.round(avgPct)}% average`,
      detail: `Ngayong ${shortMonthYear(latest.serial)}: ${now.size}/${rooms.length} · ${vacant.length ? 'Bakante: ' + vacant.map(r => 'Room ' + r).join(', ') : 'walang bakante'}`
    });
  }

  const grid = document.getElementById('hlCards');
  grid.innerHTML = '';
  cards.forEach(c => {
    const card = document.createElement(c.onClick ? 'button' : 'div');
    card.className = 'hl-card' + (c.onClick ? ' clickable' : '');
    if (c.onClick) { card.type = 'button'; card.addEventListener('click', c.onClick); }
    ['hl-label', 'hl-value', 'hl-detail'].forEach((cls, k) => {
      const el = document.createElement('span');
      el.className = cls;
      el.innerText = [c.label, c.value, c.detail][k];
      card.appendChild(el);
    });
    grid.appendChild(card);
  });

  renderTenantTable(stats, latest);
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
    tr.addEventListener('click', () => { showView('receipt'); openTenantMonth(t.name, t.latestLabel); });
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
