// Tenants tab: profile ng bawat tenant (kailan pumasok, kabuuang naibayad, sariling bill at konsumo,
// at listahan ng lahat ng buwan niya).
//
// Sariling file ito: ito mismo ang gumagawa ng tab button at ng section. Naka-load pagkatapos ng
// dashboard.js at highlights.js, at gumagamit ng mga global mula sa index.html at dashboard.js:
//   workbook, currentTenant, tenantSelect, parseSheet, isArchived, roomOf, formatCurrency,
//   excelDateToFullMonthYear, shortMonthYear, serialToDate, renderColumnChart, renderLineChart,
//   renderStackedColumnChart, renderGroupedColumnChart, renderBreakdownChart, monthlyTotals, rampColor,
//   BLUE_RAMP, BREAKDOWN, OTHER_COLOR, compactPeso, CHART, showView, VIEWS (renderColumnChart: color/clickable options)
//   at mula sa highlights.js: highlightRankLists, tenantStats, monthChanges, HL_MIN_MONTHS
//
// Nire-render kapag binuksan ang tab ('view-shown') o kapag may bagong data ('workbook-loaded').

let profileTenant = null; // tenant na ipinapakita sa tab na ito

// ---------- Markup: tab button at section ----------
(function setupTenantsTab() {
  const tab = document.createElement('button');
  tab.className = 'view-tab';
  tab.setAttribute('role', 'tab');
  tab.dataset.view = 'tenants';
  tab.innerText = 'Tenants';
  document.querySelector('.view-tabs').appendChild(tab);

  const section = document.createElement('section');
  section.id = 'viewTenants';
  section.className = 'tenants-view';
  section.hidden = true;
  section.innerHTML = `
    <div class="card" id="tpHeader">
      <div class="card-head">
        <div>
          <h2 class="card-title" style="margin:0;">Tenants</h2>
          <p class="muted">Profile ng bawat tenant mula sa Google Sheet</p>
        </div>
        <label class="field tp-select">Tenant
          <select id="tpSelect"></select>
        </label>
      </div>
      <div class="tp-profile">
        <div class="tp-name">
          <span id="tpName"></span>
          <span class="room-badge" id="tpRoom"></span>
          <span class="tp-status" id="tpStatus"></span>
        </div>
        <p class="muted" id="tpPeriod"></p>
        <a href="#" class="link-more" id="tpOpenReceipts" role="button">Tingnan ang mga resibo →</a>
      </div>
      <div class="summary-tiles" id="tpTiles"></div>
      <div class="tp-insights" id="tpInsights"></div>
    </div>

    <div class="empty-state" id="tpNoBills" hidden>
      <strong>Wala pang singil</strong>
      Wala pang singil (Total Amount) sa sheet para sa tenant na ito.
    </div>

    <div class="chart-grid" id="tpCharts">
      <div class="card span-2">
        <h3>Bill bawat buwan</h3>
        <p class="muted">Total Amount · naka-highlight ang pinakabagong buwan</p>
        <div class="chart" id="tpChartBill"></div>
      </div>
      <div class="card span-2">
        <h3>Hati ng bill bawat buwan</h3>
        <p class="muted">Rent, Tubig, Kuryente at Internet/Others · naka-highlight ang pinakabagong buwan</p>
        <div class="chart-legend" id="tpChartSplitLegend"></div>
        <div class="chart" id="tpChartSplit"></div>
      </div>
      <div class="card">
        <h3>Kabuuang hati ng naibayad</h3>
        <p class="muted">Lahat ng buwan niya</p>
        <div class="chart chart-breakdown" id="tpChartBreakdown"></div>
      </div>
      <div class="card">
        <h3>Bill niya vs average</h3>
        <p class="muted">Kumpara sa average na bill ng lahat ng tenant sa parehong buwan</p>
        <div class="chart-legend" id="tpChartVsAvgLegend"></div>
        <div class="chart" id="tpChartVsAvg"></div>
      </div>
      <div class="card span-2">
        <h3>Bill bawat taon</h3>
        <p class="muted">Jan–Dec, isang column bawat taon na may singil siya</p>
        <div class="chart-legend" id="tpChartYearsLegend"></div>
        <div class="chart" id="tpChartYears"></div>
      </div>
      <!-- Hiwalay ang kuryente at tubig: malaki ang agwat ng halaga nila, kaya may sariling axis ang bawat isa.
           Isang row bawat isa: singil (₱) sa kaliwa, konsumo sa kanan. -->
      <div class="card">
        <h3>Singil sa kuryente</h3>
        <p class="muted">Bawat buwan (₱)</p>
        <div class="chart" id="tpChartElec"></div>
      </div>
      <div class="card">
        <h3>Konsumo ng kuryente (kWh)</h3>
        <p class="muted">Bawat buwan</p>
        <div class="chart" id="tpChartKwh"></div>
      </div>
      <div class="card">
        <h3>Singil sa tubig</h3>
        <p class="muted">Bawat buwan (₱)</p>
        <div class="chart" id="tpChartWater"></div>
      </div>
      <div class="card">
        <h3>Konsumo ng tubig (m³)</h3>
        <p class="muted">Bawat buwan</p>
        <div class="chart" id="tpChartM3"></div>
      </div>
    </div>

    <div class="card" id="tpTableCard">
      <div class="card-head">
        <div>
          <h3>Lahat ng buwan</h3>
          <p class="muted">Pinakabago muna</p>
        </div>
      </div>
      <div class="tp-table-wrap">
        <table class="tp-table">
          <thead>
            <tr><th>Buwan</th><th>Rent</th><th>Kuryente</th><th>Tubig</th><th>Internet</th><th>Others</th><th>Total</th><th>Remarks</th></tr>
          </thead>
          <tbody id="tpTableBody"></tbody>
          <tfoot id="tpTableFoot"></tfoot>
        </table>
      </div>
    </div>

    <div class="empty-state" id="tpEmpty" hidden>
      <strong>Wala pang data</strong>
      Hinihintay pa ang data mula sa Google Sheet.
    </div>`;
  (document.getElementById('viewHighlights') || document.getElementById('viewSummary')).after(section);
  VIEWS.tenants = 'viewTenants';

  document.getElementById('tpSelect').addEventListener('change', e => {
    profileTenant = e.target.value;
    renderTenantProfile();
  });
  document.getElementById('tpOpenReceipts').addEventListener('click', e => {
    e.preventDefault();
    showView('receipt');
    tenantSelect.value = profileTenant;
    tenantSelect.dispatchEvent(new Event('change'));
  });
})();

// ---------- Kuwenta ----------

// Mga buwan ng tenant na may Total Amount, mula pinakaluma
function tenantMonths(name) {
  const num = v => (typeof v === 'number' ? v : 0);
  return parseSheet(name).data
    .filter(r => r && typeof r[0] === 'number' && typeof r[18] === 'number')
    .sort((a, b) => a[0] - b[0])
    .map(r => ({
      label: excelDateToFullMonthYear(r[0]), serial: r[0],
      rent: num(r[1]), elec: num(r[8]), water: num(r[15]), internet: num(r[16]), others: num(r[17]), total: r[18],
      kwh: typeof r[4] === 'number' ? r[4] : null,
      m3: typeof r[11] === 'number' ? r[11] : null,
      remarks: r[19] == null || String(r[19]).trim() === '-' ? '' : String(r[19]).trim()
    }));
}

// ---------- Render ----------

// Punuin ang dropdown (Active / Archived, alphabetical) at piliin ang tenant na ipapakita
function fillTenantPicker() {
  const select = document.getElementById('tpSelect');
  const names = [...workbook.SheetNames].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
  const archived = name => isArchived(workbook.SheetNames.indexOf(name));
  select.innerHTML = '';
  [['Active', names.filter(n => !archived(n))], ['Archived', names.filter(archived)]].forEach(([label, list]) => {
    if (!list.length) return;
    const group = document.createElement('optgroup');
    group.label = label;
    list.forEach(n => {
      const option = document.createElement('option');
      option.value = n;
      option.textContent = archived(n) ? `${n} (archived)` : n;
      group.appendChild(option);
    });
    select.appendChild(group);
  });
  // Default: ang tenant sa Receipt tab, o ang unang active
  if (!profileTenant || !workbook.SheetNames.includes(profileTenant)) {
    profileTenant = (currentTenant && workbook.SheetNames.includes(currentTenant)) ? currentTenant
      : (names.find(n => !archived(n)) || names[0]);
  }
  select.value = profileTenant;
}

function renderTenantProfile() {
  const hasData = !!workbook;
  document.getElementById('tpEmpty').hidden = hasData;
  ['tpHeader', 'tpCharts', 'tpTableCard', 'tpNoBills'].forEach(id => { document.getElementById(id).hidden = !hasData; });
  if (!hasData) return;

  fillTenantPicker();
  const name = profileTenant;
  const index = workbook.SheetNames.indexOf(name);
  const archived = isArchived(index);
  const room = roomOf(name);
  const months = tenantMonths(name);
  const allRows = parseSheet(name).data.filter(r => r && typeof r[0] === 'number');

  // Header
  document.getElementById('tpName').innerText = name;
  const roomBadge = document.getElementById('tpRoom');
  roomBadge.innerText = room ? `Room ${room}` : '';
  roomBadge.hidden = !room;
  const status = document.getElementById('tpStatus');
  status.innerText = archived ? 'archived' : 'active';
  status.classList.toggle('archived', archived);
  const first = allRows.length ? Math.min(...allRows.map(r => r[0])) : null;
  const last = months.length ? months[months.length - 1].serial : (allRows.length ? Math.max(...allRows.map(r => r[0])) : null);
  document.getElementById('tpPeriod').innerText = first == null ? 'Walang buwan sa sheet'
    : `Mula ${shortMonthYear(first)} – ${archived ? shortMonthYear(last) : 'ngayon'} · ${months.length} ${months.length === 1 ? 'buwang' : 'na buwang'} may singil`;

  // Tiles
  const total = months.reduce((s, m) => s + m.total, 0);
  const avgOf = key => {
    const vals = months.map(m => m[key]).filter(v => v != null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };
  const highest = months.reduce((a, m) => (!a || m.total > a.total ? m : a), null);
  const lowest = months.reduce((a, m) => (!a || m.total < a.total ? m : a), null);
  const kwh = avgOf('kwh'), m3 = avgOf('m3');
  const sumOf = key => months.reduce((s, m) => s + (m[key] || 0), 0);
  const kwhText = v => Math.round(v).toLocaleString('en-PH') + ' kWh';
  const m3Text = v => v.toLocaleString('en-PH', { maximumFractionDigits: 1 }) + ' m³';
  // Upa: ang huling rent, at ilang beses itong tumaas
  const rents = months.filter(m => m.rent > 0);
  const raises = rents.filter((m, i) => i > 0 && m.rent > rents[i - 1].rent).length;
  // Ngayong taon (YTD): Jan hanggang sa pinakabagong buwan niya, kumpara sa parehong panahon noong nakaraang taon
  let ytd = null;
  if (months.length) {
    const lastDate = serialToDate(months[months.length - 1].serial);
    const year = lastDate.getFullYear(), upTo = lastDate.getMonth();
    const inYear = y => months.filter(m => { const d = serialToDate(m.serial); return d.getFullYear() === y && d.getMonth() <= upTo; });
    const cur = inYear(year).reduce((s, m) => s + m.total, 0);
    const prevList = inYear(year - 1), prev = prevList.reduce((s, m) => s + m.total, 0);
    const pct = prev ? (cur - prev) / prev * 100 : null;
    ytd = { year, cur, sub: !prevList.length ? `unang taon niya ang ${year}`
      : `${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct).toFixed(1)}% kumpara sa ${year - 1}` };
  }
  const tiles = [
    ['Kabuuang naibayad', formatCurrency(total), true],
    ['Ilang buwan', String(months.length)],
    ['Average na bill', months.length ? formatCurrency(total / months.length) : '-'],
    ['Pinakamataas na bill', highest ? `${formatCurrency(highest.total)}` : '-', false, highest ? shortMonthYear(highest.serial) : ''],
    ['Average kWh / buwan', kwh != null ? kwhText(kwh) : '-'],
    ['Average m³ / buwan', m3 != null ? m3Text(m3) : '-'],
    ['Pinakamababang bill', lowest ? formatCurrency(lowest.total) : '-', false, lowest ? shortMonthYear(lowest.serial) : ''],
    ['Kasalukuyang upa', rents.length ? formatCurrency(rents[rents.length - 1].rent) : '-', false,
      rents.length ? (raises ? `tumaas nang ${raises} beses` : 'hindi nagbago') : ''],
    ['Kabuuang kuryente', formatCurrency(sumOf('elec')), false, kwhText(sumOf('kwh'))],
    ['Kabuuang tubig', formatCurrency(sumOf('water')), false, m3Text(sumOf('m3'))],
    ['Kabuuang internet/others', formatCurrency(sumOf('internet') + sumOf('others'))],
    [ytd ? `Ngayong taon (${ytd.year})` : 'Ngayong taon', ytd ? formatCurrency(ytd.cur) : '-', false, ytd ? ytd.sub : '']
  ];
  const tilesBox = document.getElementById('tpTiles');
  tilesBox.innerHTML = '';
  tiles.forEach(([label, value, accent, sub]) => {
    const tile = document.createElement('div');
    tile.className = 'summary-tile' + (accent ? ' total' : '');
    tile.innerHTML = '<span></span><strong></strong>';
    tile.children[0].innerText = label;
    tile.children[1].innerText = value;
    if (sub) {
      const s = document.createElement('em');
      s.className = 'tp-tile-sub';
      s.innerText = sub;
      tile.appendChild(s);
    }
    tilesBox.appendChild(tile);
  });

  renderTenantInsights(name, months);

  // Walang singil: walang graphs at table
  const hasBills = months.length > 0;
  document.getElementById('tpNoBills').hidden = hasBills;
  document.getElementById('tpCharts').hidden = !hasBills;
  document.getElementById('tpTableCard').hidden = !hasBills;
  if (!hasBills) return;

  renderTenantCharts(months);
  renderTenantTableMonths(months);
}

// Ranggo sa Highlights, paghahambing sa ibang tenant, at pinakamalaking pagtaas ng bill niya.
// Gumagamit ng highlightRankLists, tenantStats, monthChanges at HL_MIN_MONTHS mula sa highlights.js.
function renderTenantInsights(name, months) {
  const box = document.getElementById('tpInsights');
  box.innerHTML = '';
  box.hidden = !months.length;
  if (!months.length) return;

  const stats = tenantStats();
  const me = stats.find(t => t.name === name);

  // A) Ranggo: bawat Top 5 na kasama ang tenant sa #1–#3 (kapag kaunti ang tenant, kasama ang lahat
  //    sa "pinakamalakas" at "pinakamatipid", kaya hindi makabuluhan ang #4–#5)
  const chips = [];
  highlightRankLists(stats).forEach(group => group.lists.forEach(list => {
    const hit = list.rows.find(r => r.tenant === name);
    if (hit && hit.rank <= 3) chips.push({ rank: hit.rank, title: list.title });
  }));
  chips.sort((a, b) => a.rank - b.rank);
  const rankRow = document.createElement('div');
  rankRow.className = 'tp-ranks';
  const rankLabel = document.createElement('span');
  rankLabel.className = 'tp-insight-label';
  rankLabel.innerText = 'Ranggo sa Highlights (Top 3)';
  rankRow.appendChild(rankLabel);
  if (chips.length) {
    chips.forEach(c => {
      const chip = document.createElement('span');
      chip.className = 'tp-chip' + (c.rank === 1 ? ' first' : '');
      chip.innerText = `#${c.rank} ${c.title}`;
      rankRow.appendChild(chip);
    });
  } else {
    const none = document.createElement('span');
    none.className = 'muted';
    none.innerText = 'Wala sa Top 3 ng mga listahan';
    rankRow.appendChild(none);
  }
  box.appendChild(rankRow);

  // B) Kumpara sa average ng mga tenant na may ≥HL_MIN_MONTHS buwang data
  const peerAvg = (key, countKey) => {
    const peers = stats.filter(t => t[countKey] >= HL_MIN_MONTHS && t[key] != null);
    return peers.length ? peers.reduce((s, t) => s + t[key], 0) / peers.length : null;
  };
  const compare = [
    ['Average na bill', me.avgBill, peerAvg('avgBill', 'months'), formatCurrency],
    ['Average kWh', me.avgKwh, peerAvg('avgKwh', 'kwhMonths'), v => `${Math.round(v).toLocaleString('en-PH')} kWh`],
    ['Average m³', me.avgM3, peerAvg('avgM3', 'm3Months'), v => `${v.toLocaleString('en-PH', { maximumFractionDigits: 1 })} m³`]
  ];
  const list = document.createElement('div');
  list.className = 'tp-compare';
  const listLabel = document.createElement('span');
  listLabel.className = 'tp-insight-label';
  listLabel.innerText = 'Kumpara sa ibang tenant';
  list.appendChild(listLabel);
  compare.forEach(([label, mine, avg, fmt]) => {
    if (mine == null || avg == null || !avg) return;
    const pct = (mine - avg) / avg * 100;
    const line = document.createElement('div');
    const strong = document.createElement('strong');
    strong.innerText = `${label}: ${fmt(mine)}`;
    const rest = Math.abs(pct) < 0.5 ? ' · halos kapareho ng average'
      : ` · ${pct > 0 ? '▲' : '▼'} ${Math.abs(pct).toFixed(0)}% ${pct > 0 ? 'mas mataas' : 'mas mababa'} kaysa average (${fmt(avg)})`;
    line.append(strong, rest);
    list.appendChild(line);
  });

  // C) Pinakamalaking pagtaas ng bill niya (kumpara sa nakaraang buwan)
  const jump = monthChanges().filter(c => c.name === name && c.diff > 0).sort((a, b) => b.diff - a.diff)[0];
  if (jump) {
    const line = document.createElement('div');
    const strong = document.createElement('strong');
    strong.innerText = `Pinakamalaking pagtaas: ${shortMonthYear(jump.serial)}`;
    line.append(strong, ` · ${formatCurrency(jump.prevTotal)} → ${formatCurrency(jump.total)} (+${formatCurrency(jump.diff)}${jump.pct != null ? `, +${jump.pct.toFixed(1)}%` : ''})`);
    list.appendChild(line);
  }
  // D) Pinakamalaking pagbaba ng bill niya
  const drop = monthChanges().filter(c => c.name === name && c.diff < 0).sort((a, b) => a.diff - b.diff)[0];
  if (drop) {
    const line = document.createElement('div');
    const strong = document.createElement('strong');
    strong.innerText = `Pinakamalaking pagbaba: ${shortMonthYear(drop.serial)}`;
    line.append(strong, ` · ${formatCurrency(drop.prevTotal)} → ${formatCurrency(drop.total)} (−${formatCurrency(-drop.diff)}${drop.pct != null ? `, −${Math.abs(drop.pct).toFixed(1)}%` : ''})`);
    list.appendChild(line);
  }
  // E) Ranggo sa kwarto: ayon sa kabuuang naibayad, sa mga naging tenant ng parehong kwarto
  const roommates = me.room ? stats.filter(t => t.room === me.room && t.months > 0).sort((a, b) => b.total - a.total) : [];
  if (roommates.length >= 2) {
    const line = document.createElement('div');
    const strong = document.createElement('strong');
    strong.innerText = `#${roommates.findIndex(t => t.name === name) + 1} sa ${roommates.length} naging tenant ng Room ${me.room}`;
    line.append(strong, ' · ayon sa kabuuang naibayad');
    list.appendChild(line);
  }
  box.appendChild(list);
}

function renderTenantCharts(months) {
  const latest = months[months.length - 1].label;
  renderColumnChart(document.getElementById('tpChartBill'), months, {
    value: m => m.total,
    selectedLabel: latest,
    label: m => compactPeso(m.total),
    tooltip: m => [[m.label], [formatCurrency(m.total), null, true]],
    ariaLabel: 'Bill bawat buwan',
    clickable: false
  });
  // Hati ng bill bawat buwan (stacked) at kabuuang hati (donut)
  const partOf = (m, key) => (key === 'otherAll' ? m.internet + m.others : m[key]);
  renderStackedColumnChart(document.getElementById('tpChartSplit'), months,
    BREAKDOWN.map(b => ({ name: b.name, color: b.color, value: m => partOf(m, b.key) })), {
      selectedLabel: latest,
      clickable: false,
      ariaLabel: 'Hati ng bill bawat buwan',
      legendEl: document.getElementById('tpChartSplitLegend')
    });
  const sum = key => months.reduce((s, m) => s + m[key], 0);
  renderBreakdownChart(document.getElementById('tpChartBreakdown'),
    { rent: sum('rent'), water: sum('water'), elec: sum('elec'), internet: sum('internet'), others: sum('others') });

  // Bill niya vs average na bill bawat tenant ng lahat sa parehong buwan
  const avgByLabel = new Map(monthlyTotals().map(m => [m.label, m.tenantCount ? m.total / m.tenantCount : null]));
  renderLineChart(document.getElementById('tpChartVsAvg'), months, [
    { name: 'Bill niya', color: CHART.accent, value: m => m.total },
    { name: 'Average ng lahat', color: OTHER_COLOR, value: m => (avgByLabel.has(m.label) ? avgByLabel.get(m.label) : null) }
  ], {
    zeroBased: true,
    format: v => formatCurrency(v),
    ariaLabel: 'Bill niya kumpara sa average ng lahat ng tenant',
    legendEl: document.getElementById('tpChartVsAvgLegend')
  });

  // Bill bawat taon, Jan–Dec: maputla ang mga lumang taon, accent ang pinakabago (kapareho ng YoY sa Dashboard)
  const yearOf = m => serialToDate(m.serial).getFullYear();
  const years = [...new Set(months.map(yearOf))].sort((a, b) => a - b);
  const byYearMonth = new Map(months.map(m => [`${yearOf(m)}-${serialToDate(m.serial).getMonth()}`, m.total]));
  const calendar = [...Array(12).keys()].map(i => {
    const d = new Date(2000, i, 1);
    return { label: d.toLocaleString('en-US', { month: 'long' }).toUpperCase(), short: d.toLocaleString('en-US', { month: 'short' }), serial: months[0].serial, i };
  });
  const older = years.length - 1;
  renderGroupedColumnChart(document.getElementById('tpChartYears'), calendar, years.map((y, k) => ({
    name: String(y),
    color: k === older ? CHART.accent : rampColor(BLUE_RAMP, older > 1 ? 0.1 + 0.25 * k / (older - 1) : 0.3),
    value: c => (byYearMonth.has(`${y}-${c.i}`) ? byYearMonth.get(`${y}-${c.i}`) : null)
  })), {
    format: v => formatCurrency(v),
    ariaLabel: 'Bill bawat taon',
    legendEl: document.getElementById('tpChartYearsLegend'),
    clickable: false
  });

  renderColumnChart(document.getElementById('tpChartElec'), months, {
    value: m => m.elec,
    label: m => compactPeso(m.elec),
    tooltip: m => [[m.label], [formatCurrency(m.elec), CHART.accent, true]],
    ariaLabel: 'Singil sa kuryente bawat buwan',
    clickable: false
  });
  renderColumnChart(document.getElementById('tpChartWater'), months, {
    value: m => m.water,
    label: m => compactPeso(m.water),
    tooltip: m => [[m.label], [formatCurrency(m.water), CHART.water, true]],
    ariaLabel: 'Singil sa tubig bawat buwan',
    color: CHART.water,
    clickable: false
  });
  renderLineChart(document.getElementById('tpChartKwh'), months, [
    { name: 'kWh', color: CHART.accent, value: m => m.kwh }
  ], {
    zeroBased: true,
    format: v => Math.round(v).toLocaleString('en-PH') + ' kWh',
    tick: v => String(v),
    ariaLabel: 'Konsumo ng kuryente bawat buwan'
  });
  renderLineChart(document.getElementById('tpChartM3'), months, [
    { name: 'm³', color: CHART.water, value: m => m.m3 }
  ], {
    zeroBased: true,
    format: v => v.toLocaleString('en-PH', { maximumFractionDigits: 1 }) + ' m³',
    tick: v => String(v),
    ariaLabel: 'Konsumo ng tubig bawat buwan'
  });
}

// "Lahat ng buwan" table, pinakabago muna (para sa pagtingin lang)
function renderTenantTableMonths(months) {
  const body = document.getElementById('tpTableBody');
  body.innerHTML = '';
  const money = ['rent', 'elec', 'water', 'internet', 'others', 'total'];
  [...months].reverse().forEach(m => {
    const tr = document.createElement('tr');
    const cells = [shortMonthYear(m.serial), ...money.map(k => formatCurrency(m[k])), m.remarks || '-'];
    cells.forEach((text, k) => {
      const td = document.createElement('td');
      if (k >= 1 && k <= 6) td.className = 'num';
      if (k === 7) td.className = 'tp-remarks';
      td.innerText = text;
      tr.appendChild(td);
    });
    body.appendChild(tr);
  });

  const foot = document.getElementById('tpTableFoot');
  foot.innerHTML = '';
  const tr = document.createElement('tr');
  const sums = money.map(k => months.reduce((s, m) => s + m[k], 0));
  [`Total (${months.length})`, ...sums.map(formatCurrency), ''].forEach((text, k) => {
    const td = document.createElement('td');
    if (k >= 1 && k <= 6) td.className = 'num';
    td.innerText = text;
    tr.appendChild(td);
  });
  foot.appendChild(tr);
}

// ---------- Kailan nire-render ----------
const tenantsVisible = () => !document.getElementById('viewTenants').hidden;
document.addEventListener('view-shown', e => { if (e.detail === 'tenants') renderTenantProfile(); });
document.addEventListener('workbook-loaded', () => { if (tenantsVisible()) renderTenantProfile(); });

// I-redraw ang graphs kapag nagbago ang lapad ng window
let tenantsResizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(tenantsResizeTimer);
  tenantsResizeTimer = setTimeout(() => { if (tenantsVisible() && workbook) renderTenantProfile(); }, 150);
});

// Bumalik sa Tenants tab kung doon ka huling nakatingin (#tenants sa URL)
if (location.hash === '#tenants') showView('tenants');
