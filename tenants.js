// Tenants tab: profile ng bawat tenant (kailan pumasok, kabuuang naibayad, sariling bill at konsumo,
// at listahan ng lahat ng buwan niya).
//
// Sariling file ito: ito mismo ang gumagawa ng tab button at ng section. Naka-load pagkatapos ng
// dashboard.js at highlights.js, at gumagamit ng mga global mula sa index.html at dashboard.js:
//   workbook, currentTenant, tenantSelect, parseSheet, isArchived, roomOf, formatCurrency,
//   excelDateToFullMonthYear, shortMonthYear, renderColumnChart,
//   renderLineChart, compactPeso, CHART, showView, VIEWS (renderColumnChart: color/clickable options)
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
  const kwh = avgOf('kwh'), m3 = avgOf('m3');
  const tiles = [
    ['Kabuuang naibayad', formatCurrency(total), true],
    ['Ilang buwan', String(months.length)],
    ['Average na bill', months.length ? formatCurrency(total / months.length) : '-'],
    ['Pinakamataas na bill', highest ? `${formatCurrency(highest.total)}` : '-', false, highest ? shortMonthYear(highest.serial) : ''],
    ['Average kWh / buwan', kwh != null ? Math.round(kwh).toLocaleString('en-PH') + ' kWh' : '-'],
    ['Average m³ / buwan', m3 != null ? m3.toLocaleString('en-PH', { maximumFractionDigits: 1 }) + ' m³' : '-']
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

  // Walang singil: walang graphs at table
  const hasBills = months.length > 0;
  document.getElementById('tpNoBills').hidden = hasBills;
  document.getElementById('tpCharts').hidden = !hasBills;
  document.getElementById('tpTableCard').hidden = !hasBills;
  if (!hasBills) return;

  renderTenantCharts(months);
  renderTenantTableMonths(months);
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
