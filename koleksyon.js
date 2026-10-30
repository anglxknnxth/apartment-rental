// Koleksyon tab: kabuuan ng lahat ng tenant bawat buwan, at ang paglipat ng tab (Resibo / Koleksyon).
//
// Naka-load pagkatapos ng main script sa index.html, at gumagamit ng mga global mula doon:
//   workbook, sheetData, tenantSelect, monthSelect, parseSheet, isArchived, roomOf, selectMonth,
//   excelDateToFullMonthYear, formatCurrency, fitLeftColumn, fitReceipt
//
// Nire-render ulit kapag may bagong data mula sa Google Sheet (event na 'workbook-loaded').


// Lahat ng buwan (sa lahat ng tab) na may Total Amount, pinakabago muna
function collectionMonths() {
  const months = new Map(); // label -> date serial
  workbook.SheetNames.forEach(name => {
    parseSheet(name).data.forEach(r => {
      if (r && typeof r[0] === 'number' && typeof r[18] === 'number') {
        const label = excelDateToFullMonthYear(r[0]);
        months.set(label, Math.max(months.get(label) || 0, r[0]));
      }
    });
  });
  return [...months.entries()].sort((a, b) => b[1] - a[1]).map(([label]) => label);
}

// Punuin ang Buwan dropdown ng Koleksyon tab, tapos i-render ang napiling buwan.
// Default: ang buwang nasa Resibo tab, o kung wala, ang pinakabago.
function renderSummary() {
  const select = document.getElementById('summaryMonthSelect');
  const hasData = !!workbook;
  document.getElementById('summaryEmpty').hidden = hasData;
  document.querySelectorAll('#viewSummary > .card').forEach(card => { card.hidden = !hasData; });
  if (!hasData) return;

  const months = collectionMonths();
  const receiptRow = document.getElementById('receipt').style.display === 'block'
    && sheetData.data && sheetData.data[parseInt(monthSelect.value)];
  const receiptMonth = receiptRow ? excelDateToFullMonthYear(receiptRow[0]) : null;
  const wanted = (months.includes(select.value) || select.value === ALL_MONTHS) ? select.value
    : (months.includes(receiptMonth) ? receiptMonth : months[0]);

  select.innerHTML = '';
  // ALL: kabuuan ng lahat ng buwan (hindi default; kasalukuyang buwan pa rin ang default)
  const allOption = document.createElement('option');
  allOption.value = ALL_MONTHS;
  allOption.textContent = 'ALL (lahat ng buwan)';
  select.appendChild(allOption);
  months.forEach(label => {
    const option = document.createElement('option');
    option.value = option.textContent = label;
    select.appendChild(option);
  });
  if (wanted) select.value = wanted;
  renderSummaryMonth(select.value);
}

// Kabuuan ng lahat ng tenant (active at archived) para sa isang buwan, o sa lahat ng buwan (ALL)
function renderSummaryMonth(monthLabel) {
  const isAll = monthLabel === ALL_MONTHS;
  const num = v => typeof v === 'number' ? v : 0;
  const sums = { rent: 0, water: 0, elec: 0, internet: 0, others: 0, total: 0 };
  const tenants = [];
  workbook.SheetNames.forEach((name, i) => {
    const rows = parseSheet(name).data.filter(r =>
      r && typeof r[0] === 'number' && typeof r[18] === 'number' && (isAll || excelDateToFullMonthYear(r[0]) === monthLabel));
    if (!rows.length) return;
    const sum = col => rows.reduce((s, r) => s + num(r[col]), 0);
    const latest = rows.reduce((a, b) => (b[0] > a[0] ? b : a));
    const t = {
      name, archived: isArchived(i), room: roomOf(name),
      rent: sum(1), water: sum(15), elec: sum(8), internet: sum(16), others: sum(17), total: sum(18),
      // ALL: ilang buwan, at ang pinakabagong buwan (bubuksan kapag kinlik ang row)
      monthCount: rows.length, latestLabel: excelDateToFullMonthYear(latest[0]),
      remarks: isAll ? `${rows.length} buwan` :
        (rows[0][19] == null || String(rows[0][19]).trim() === '-' ? '' : String(rows[0][19]).trim())
    };
    Object.keys(sums).forEach(k => { sums[k] += t[k]; });
    tenants.push(t);
  });
  tenants.sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));

  let heading = monthLabel || '';
  if (isAll) {
    const months = collectionMonths();
    heading = `LAHAT NG BUWAN (${months[months.length - 1]} – ${months[0]})`;
  }
  document.getElementById('summaryMonth').innerText = heading;
  document.getElementById('summaryCount').innerText = `${tenants.length} ${tenants.length === 1 ? 'tenant' : 'tenants'}`;
  document.getElementById('summaryLastCol').innerText = isAll ? 'Ilang buwan' : 'Remarks';

  const tiles = [
    ['Rent', sums.rent], ['Tubig', sums.water], ['Kuryente', sums.elec],
    ['Internet / Others', sums.internet + sums.others], ['Total', sums.total]
  ];
  const tilesBox = document.getElementById('summaryTiles');
  tilesBox.innerHTML = '';
  tiles.forEach(([label, value], i) => {
    const tile = document.createElement('div');
    tile.className = 'summary-tile' + (i === tiles.length - 1 ? ' total' : '');
    tile.innerHTML = '<span></span><strong></strong>';
    tile.children[0].innerText = label;
    tile.children[1].innerText = formatCurrency(value);
    tilesBox.appendChild(tile);
  });

  const cells = t => [t.rent, t.water, t.elec, t.internet, t.others, t.total].map(formatCurrency);
  const body = document.getElementById('summaryBody');
  body.innerHTML = '';
  tenants.forEach(t => {
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
    const roomTd = document.createElement('td');
    roomTd.innerText = t.room || '-';
    tr.appendChild(roomTd);
    cells(t).forEach(text => {
      const td = document.createElement('td');
      td.className = 'num';
      td.innerText = text;
      tr.appendChild(td);
    });
    const remarksTd = document.createElement('td');
    remarksTd.className = 'remarks-cell';
    remarksTd.innerText = t.remarks || '-';
    tr.appendChild(remarksTd);
    tr.addEventListener('click', () => {
      showView('receipt');
      openTenantMonth(t.name, isAll ? t.latestLabel : monthLabel); // ALL: pinakabagong buwan ng tenant
    });
    body.appendChild(tr);
  });

  const foot = document.getElementById('summaryFoot');
  foot.innerHTML = '';
  const totalRow = document.createElement('tr');
  ['Total', '', ...cells(sums), ''].forEach((text, i) => {
    const td = document.createElement('td');
    if (i > 1 && i < 8) td.className = 'num';
    td.innerText = text;
    totalRow.appendChild(td);
  });
  foot.appendChild(totalRow);

  renderCharts(monthLabel, sums);
}

// ---------- Graphs ----------
// Mga kulay: validated (dataviz validate_palette.js, sa puting card) — blue at orange, colorblind-safe.
const CHART = {
  accent: '#2a78d6',   // napiling buwan / Kuryente
  soft: '#86b6ef',     // ibang buwan (de-emphasis, parehong blue)
  water: '#eb6834',    // Tubig
  grid: '#e8ecf2',
  axis: '#c9d2df',
  ink: '#1c2533',
  muted: '#6b7686',
  height: 230
};
// Categorical slots para sa mga kwarto (sa ganitong ayos). Validated: pumapasa ang magkakatabing pares;
// mababa ang contrast ng aqua at yellow sa puti, kaya laging may legend + end labels + tooltip.
const SLOTS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100'];
const OTHER_COLOR = '#9aa3af'; // "Iba pa" kapag higit sa 4 ang kwarto
// Breakdown bar, sa ganitong ayos: Rent, Tubig, Kuryente, Others. Hindi puwedeng magkatabi ang
// orange at yellow (magkamukha kahit sa normal na paningin), kaya nasa magkabilang dulo sila.
const BREAKDOWN = [
  { key: 'rent', name: 'Rent', color: '#1baf7a' },
  { key: 'water', name: 'Tubig', color: '#eb6834' },
  { key: 'elec', name: 'Kuryente', color: '#2a78d6' },
  { key: 'otherAll', name: 'Internet / Others', color: '#eda100' }
];
const SVG_NS = 'http://www.w3.org/2000/svg';
let lastChartMonth = null;
let lastChartSums = null;
// Value ng "ALL" sa Buwan dropdown: kabuuan ng lahat ng buwan
const ALL_MONTHS = '__ALL__';

function svgEl(tag, attrs, parent) {
  const node = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs || {}).forEach(([k, v]) => node.setAttribute(k, v));
  if (parent) parent.appendChild(node);
  return node;
}

function serialToDate(serial) {
  return new Date(new Date(1899, 11, 30).getTime() + serial * 86400000);
}

// "Nov", at may taon kapag Enero o unang column: "Jan '26"
function shortMonth(serial, withYear) {
  const d = serialToDate(serial);
  const m = d.toLocaleString('en-US', { month: 'short' });
  return withYear ? `${m} '${String(d.getFullYear()).slice(2)}` : m;
}

// ₱0 / ₱10K / ₱25K
function compactPeso(v) {
  if (v >= 1000) return '₱' + (v / 1000).toLocaleString('en-PH', { maximumFractionDigits: 1 }) + 'K';
  return '₱' + Math.round(v);
}

// Malinis na y-axis: 4–5 ticks na bilog na numero
function niceScale(maxValue) {
  if (maxValue <= 0) return { max: 1000, step: 250 };
  const rough = maxValue / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const step = [1, 2, 2.5, 5, 10].map(s => s * mag).find(s => s >= rough);
  return { max: Math.ceil(maxValue / step) * step, step };
}

// Para sa rate: hindi nagsisimula sa 0, bilog na numero sa magkabilang dulo
function niceRange(minValue, maxValue) {
  const { step } = niceScale(Math.max(maxValue - minValue, maxValue * 0.1, 1));
  const min = Math.floor(minValue / step) * step;
  let max = Math.ceil(maxValue / step) * step;
  if (max === min) max += step;
  return { min, max, step };
}

// Kabuuan bawat buwan ng lahat ng tenant, luma -> bago.
// Kasama ang kWh bawat kwarto (Y1) at ang data para sa average na rate ng kuryente.
function monthlyTotals() {
  const num = v => typeof v === 'number' ? v : 0;
  const map = new Map();
  workbook.SheetNames.forEach(name => {
    const room = roomOf(name);
    parseSheet(name).data.forEach(r => {
      if (!r || typeof r[0] !== 'number' || typeof r[18] !== 'number') return;
      const label = excelDateToFullMonthYear(r[0]);
      const m = map.get(label) || {
        label, serial: r[0], water: 0, elec: 0, total: 0, tenantCount: 0,
        rateElec: 0, rateKwh: 0, rateWater: 0, rateM3: 0, roomKwh: {}, roomM3: {}, roomTotal: {}, roomRateElec: {}, roomRateKwh: {}
      };
      m.serial = Math.max(m.serial, r[0]);
      m.water += num(r[15]);
      m.elec += num(r[8]);
      m.total += r[18];
      m.tenantCount++;
      // Rate = Σ singil ÷ Σ konsumo, kapag number ang dalawa
      // Kuryente: col I ÷ col E (kWh) · Tubig: col P ÷ col L (m³)
      if (typeof r[8] === 'number' && typeof r[4] === 'number' && r[4] > 0) {
        m.rateElec += r[8];
        m.rateKwh += r[4];
      }
      if (typeof r[15] === 'number' && typeof r[11] === 'number' && r[11] > 0) {
        m.rateWater += r[15];
        m.rateM3 += r[11];
      }
      if (room) {
        if (typeof r[4] === 'number') m.roomKwh[room] = (m.roomKwh[room] || 0) + r[4];
        if (typeof r[11] === 'number') m.roomM3[room] = (m.roomM3[room] || 0) + r[11];
        // Rate bawat kwarto: Σ col I ÷ Σ col E ng mga tenant ng kwartong iyon
        if (typeof r[8] === 'number' && typeof r[4] === 'number' && r[4] > 0) {
          m.roomRateElec[room] = (m.roomRateElec[room] || 0) + r[8];
          m.roomRateKwh[room] = (m.roomRateKwh[room] || 0) + r[4];
        }
        m.roomTotal[room] = (m.roomTotal[room] || 0) + r[18];
      }
      map.set(label, m);
    });
  });
  return [...map.values()].sort((a, b) => a.serial - b.serial);
}

// Lahat ng kwarto (Y1), naka-sort: 2A, 2B, 3A, 4…
function allRooms() {
  return [...new Set(workbook.SheetNames.map(roomOf).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
}

// Occupancy: bawat buwan, ang mga kwartong may tenant na may row sa buwang iyon (kahit wala pang Total)
function occupancyByMonth() {
  const occ = new Map(); // label -> Set(room)
  workbook.SheetNames.forEach(name => {
    const room = roomOf(name);
    if (!room) return;
    parseSheet(name).data.forEach(r => {
      if (!r || typeof r[0] !== 'number') return;
      const label = excelDateToFullMonthYear(r[0]);
      if (!occ.has(label)) occ.set(label, new Set());
      occ.get(label).add(room);
    });
  });
  return occ;
}

// Isang series bawat kwarto (unang 4 may sariling kulay; ang sobra ay "Iba pa").
// field: 'roomKwh' | 'roomM3' | 'roomTotal'
function roomSeries(field) {
  const rooms = allRooms();
  const shown = rooms.slice(0, SLOTS.length), extra = rooms.slice(SLOTS.length);
  const sumOf = (m, list) => {
    const vals = list.map(r => m[field][r]).filter(v => v != null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) : null;
  };
  const series = shown.map((room, i) => ({ name: `Room ${room}`, color: SLOTS[i], value: m => sumOf(m, [room]) }));
  if (extra.length) series.push({ name: 'Iba pa', color: OTHER_COLOR, value: m => sumOf(m, extra) });
  return series;
}

function selectSummaryMonth(label) {
  document.getElementById('summaryMonthSelect').value = label;
  renderSummaryMonth(label);
}

function renderCharts(monthLabel, sums) {
  lastChartMonth = monthLabel;
  if (sums) lastChartSums = sums;
  const all = monthlyTotals();
  const isAll = monthLabel === ALL_MONTHS;
  const end = isAll ? all.length - 1 : all.findIndex(m => m.label === monthLabel);
  if (end < 0) return;
  // ALL: lahat ng buwan, walang naka-highlight. Isang buwan: 2 taon (24 buwan) hanggang doon.
  const months = isAll ? all : all.slice(Math.max(0, end - 23), end + 1);
  const selected = isAll ? null : monthLabel;
  document.querySelectorAll('.range-text').forEach(el => {
    el.innerText = isAll ? `lahat ng buwan (${months.length})` : '2 taon';
  });
  const byId = id => document.getElementById(id);
  // Koleksyon
  renderTotalsChart(byId('chartTotals'), months, selected);
  renderBreakdownChart(byId('chartBreakdown'), lastChartSums);
  renderYoyChart(byId('chartYoy'), all, all[end]);
  renderAvgBillChart(byId('chartAvgBill'), months, selected);
  // Mga kwarto
  renderRoomsChart(byId('chartRooms'), monthLabel);
  renderOccupancyChart(byId('chartOccupancy'), months, selected);
  renderRoomStackChart(byId('chartRoomStack'), months, selected);
  // Kuryente at tubig
  renderUtilitiesChart(byId('chartUtilities'), months);
  renderRateChart(byId('chartRate'), months);
  renderWaterRateChart(byId('chartWaterRate'), months);
  renderRoomKwhChart(byId('chartRoomKwh'), months);
  renderRoomM3Chart(byId('chartRoomM3'), months);
}

// ---- Ngayong taon vs nakaraang taon: Jan–Dec, may YTD sa subtitle ----
function renderYoyChart(container, all, selected) {
  const sel = serialToDate(selected.serial);
  const year = sel.getFullYear(), upTo = sel.getMonth();
  const totalOf = (y, mIdx) => {
    const label = new Date(y, mIdx, 1).toLocaleString('en-US', { month: 'long' }).toUpperCase() + ', ' + y;
    const found = all.find(m => m.label === label);
    return found ? found.total : null;
  };
  const months = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(year, i, 1);
    months.push({
      label: d.toLocaleString('en-US', { month: 'long' }).toUpperCase(),
      short: d.toLocaleString('en-US', { month: 'short' }),
      serial: selected.serial,
      cur: i <= upTo ? totalOf(year, i) : null,
      prev: totalOf(year - 1, i)
    });
  }

  // YTD: Jan hanggang sa napiling buwan
  const span = `${months[0].short}–${months[upTo].short}`;
  const ytd = list => list.slice(0, upTo + 1).reduce((s, v) => s + (v || 0), 0);
  const curYtd = ytd(months.map(m => m.cur)), prevYtd = ytd(months.map(m => m.prev));
  let text = `${span} ${year}: ${formatCurrency(curYtd)}`;
  if (prevYtd > 0) {
    const pct = (curYtd - prevYtd) / prevYtd * 100;
    text += ` · ${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct).toFixed(1)}% ${pct >= 0 ? 'mas mataas' : 'mas mababa'} kaysa ${span} ${year - 1} (${formatCurrency(prevYtd)})`;
  } else {
    text += ` · walang data noong ${year - 1}`;
  }
  document.getElementById('yoySummary').innerText = text;

  // Grouped columns: nakaraang taon (gray) sa kaliwa, ngayong taon (blue) sa kanan
  renderGroupedColumnChart(container, months, [
    { name: String(year - 1), color: OTHER_COLOR, value: m => m.prev },
    { name: String(year), color: CHART.accent, value: m => m.cur }
  ], {
    format: v => formatCurrency(v),
    ariaLabel: 'Koleksyon ngayong taon kumpara sa nakaraang taon',
    legendEl: document.getElementById('chartYoyLegend'),
    clickable: false // Jan–Dec ito, hindi totoong buwan sa dropdown
  });
}

// ---- Average na bill bawat tenant: columns ----
function renderAvgBillChart(container, months, selectedLabel) {
  const avg = m => (m.tenantCount ? m.total / m.tenantCount : 0);
  renderColumnChart(container, months, {
    value: avg,
    selectedLabel,
    label: m => compactPeso(avg(m)),
    tooltip: m => [[m.label], [formatCurrency(avg(m)), null, true],
      [`${formatCurrency(m.total)} ÷ ${m.tenantCount} ${m.tenantCount === 1 ? 'tenant' : 'tenants'}`]],
    ariaLabel: 'Average na bill bawat tenant'
  });
}

// ---- Generic na grouped columns: 2+ series na magkatabi bawat buwan ----
// series: [{ name, color, value: month => number|null }]; opts: { format, tick?, ariaLabel, legendEl, clickable }
function renderGroupedColumnChart(container, months, series, opts) {
  container.querySelectorAll('svg').forEach(s => s.remove());
  if (opts.legendEl) {
    opts.legendEl.innerHTML = '';
    series.forEach(s => {
      const item = document.createElement('span');
      item.innerHTML = '<i class="square"></i>';
      item.firstChild.style.background = s.color;
      item.append(s.name);
      opts.legendEl.appendChild(item);
    });
  }

  const width = container.clientWidth, height = CHART.height;
  const margin = { top: 14, right: 8, bottom: 26, left: 48 };
  const svg = svgEl('svg', { width, height, role: 'img', 'aria-label': opts.ariaLabel });
  container.prepend(svg);

  const vals = months.flatMap(m => series.map(s => s.value(m))).filter(v => v != null);
  const scale = niceScale(Math.max(...vals, 0));
  const y = drawAxes(svg, { width, height, margin, scale, tick: opts.tick });
  const band = (width - margin.left - margin.right) / months.length;
  const xCenter = i => margin.left + band * (i + 0.5);
  const gap = 2;
  const barW = Math.min(24, (band * 0.7 - gap * (series.length - 1)) / series.length);
  const groupW = barW * series.length + gap * (series.length - 1);
  const base = y(0);
  const tip = chartTip(container);

  months.forEach((m, i) => {
    const x0 = xCenter(i) - groupW / 2;
    series.forEach((s, k) => {
      const v = s.value(m);
      if (v == null || v <= 0) return;
      const x = x0 + k * (barW + gap), top = y(v), h = base - top;
      const r = Math.min(4, h, barW / 2);
      svgEl('path', {
        d: `M${x},${base} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${base} Z`,
        fill: s.color
      }, svg);
    });
    const tops = series.map(s => s.value(m)).filter(v => v != null).map(y);
    const hit = svgEl('rect', { x: margin.left + band * i, y: margin.top, width: band, height: base - margin.top,
      fill: 'transparent', style: opts.clickable === false ? '' : 'cursor:pointer' }, svg);
    hit.addEventListener('mouseenter', () => tip.show([[m.label],
      ...series.map(s => [`${s.name}: ${s.value(m) == null ? 'walang data' : opts.format(s.value(m))}`, s.color])],
      xCenter(i), tops.length ? Math.min(...tops) : base));
    hit.addEventListener('mouseleave', () => tip.hide());
    if (opts.clickable !== false) hit.addEventListener('click', () => selectSummaryMonth(m.label));
  });
  xLabels(svg, months, xCenter, height, band);
}

// ---- Generic na heatmap: kwarto × buwan, isang hue mula maputla hanggang madilim ----
// ramp: listahan ng hex mula mababa hanggang mataas; walang kulay ang bakante (null)
const BLUE_RAMP = ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b'];
const ORANGE_RAMP = ['#fde4d8', '#f9c3a8', '#f39a74', '#eb6834', '#c94f1f', '#9c3b15', '#6e2a0f'];

function rampColor(ramp, t) {
  const pos = Math.max(0, Math.min(1, t)) * (ramp.length - 1);
  const i = Math.min(ramp.length - 2, Math.floor(pos)), f = pos - i;
  const hex = h => [1, 3, 5].map(k => parseInt(h.slice(k, k + 2), 16));
  const a = hex(ramp[i]), b = hex(ramp[i + 1]);
  return '#' + a.map((v, k) => Math.round(v + (b[k] - v) * f).toString(16).padStart(2, '0')).join('');
}

function renderHeatmap(container, months, field, opts) {
  container.querySelectorAll('svg').forEach(s => s.remove());
  const rooms = allRooms();
  const rowH = 34, gap = 2;
  const margin = { top: 4, right: 8, bottom: 26, left: 72 };
  const width = container.clientWidth;
  const height = margin.top + rooms.length * rowH + margin.bottom;
  container.style.height = height + 'px';
  const svg = svgEl('svg', { width, height, role: 'img', 'aria-label': opts.ariaLabel });
  container.prepend(svg);

  const value = (m, room) => (m[field][room] != null ? m[field][room] : null);
  const vals = months.flatMap(m => rooms.map(r => value(m, r))).filter(v => v != null);
  const max = Math.max(...vals, 0), min = Math.min(...vals, max);
  const t = v => (max > min ? (v - min) / (max - min) : 1);
  const band = (width - margin.left - margin.right) / months.length;
  const xCenter = i => margin.left + band * (i + 0.5);
  const last = months.length - 1;
  const tip = chartTip(container);

  rooms.forEach((room, r) => {
    const yTop = margin.top + r * rowH;
    const label = svgEl('text', { x: 0, y: yTop + rowH / 2 + 4, 'font-size': 12, 'font-weight': 600, fill: CHART.ink }, svg);
    label.textContent = `Room ${room}`;
    months.forEach((m, i) => {
      const v = value(m, room);
      const x = margin.left + band * i + gap / 2, w = band - gap, h = rowH - gap;
      // 2px na puwang sa pagitan ng mga cell; ang bakante ay manipis na outline lang
      svgEl('rect', v == null
        ? { x: x + 0.5, y: yTop + 0.5, width: w - 1, height: h - 1, rx: 3, fill: '#fff', stroke: CHART.grid }
        : { x, y: yTop, width: w, height: h, rx: 3, fill: rampColor(opts.ramp, t(v)) }, svg);
      // Value lang sa column ng napiling buwan (ang iba ay nasa tooltip)
      if (i === last && v != null && w >= 20) {
        const txt = svgEl('text', { x: x + w / 2, y: yTop + h / 2 + 4, 'text-anchor': 'middle', 'font-size': 10.5, 'font-weight': 600,
          fill: t(v) > 0.45 ? '#fff' : CHART.ink }, svg);
        txt.textContent = opts.short(v);
      }
      const hit = svgEl('rect', { x: margin.left + band * i, y: yTop, width: band, height: rowH, fill: 'transparent' }, svg);
      hit.addEventListener('mouseenter', () => tip.show([[`Room ${room} · ${m.label}`],
        [v == null ? 'Bakante / walang data' : opts.format(v), null, true]], xCenter(i), yTop));
      hit.addEventListener('mouseleave', () => tip.hide());
    });
  });
  xLabels(svg, months, xCenter, height, band);

  // Scale: maputla = mababa, madilim = mataas
  if (opts.legendEl) {
    opts.legendEl.innerHTML = '';
    if (vals.length) {
      const scaleEl = document.createElement('span');
      scaleEl.className = 'heat-scale';
      scaleEl.innerHTML = '<em></em><b></b><em></em><i></i><em>Bakante</em>';
      scaleEl.children[0].innerText = opts.short(min);
      scaleEl.children[1].style.background = `linear-gradient(90deg, ${opts.ramp.join(', ')})`;
      scaleEl.children[2].innerText = opts.short(max) + ' ' + opts.unit;
      opts.legendEl.appendChild(scaleEl);
    }
  }
}

// ---- Occupancy: ilang kwarto ang may nakatira bawat buwan ----
function renderOccupancyChart(container, months, selectedLabel) {
  const rooms = allRooms();
  const total = rooms.length;
  if (!total) return;
  const occ = occupancyByMonth();
  const count = m => (occ.get(m.label) || new Set()).size;
  const pct = m => Math.round(count(m) / total * 100);
  renderColumnChart(container, months, {
    value: count,
    scale: total <= 8 ? { max: total, step: 1 } : niceScale(total),
    tick: v => String(v),
    selectedLabel,
    label: m => `${count(m)}/${total} · ${pct(m)}%`,
    tooltip: m => {
      const vacant = rooms.filter(r => !(occ.get(m.label) || new Set()).has(r));
      return [[m.label], [`${count(m)} sa ${total} kwarto may nakatira (${pct(m)}%)`, null, true],
        [vacant.length ? `Bakante: ${vacant.map(r => 'Room ' + r).join(', ')}` : 'Walang bakante']];
    },
    ariaLabel: 'Occupancy bawat buwan'
  });
}

// ---- Koleksyon bawat kwarto: stacked columns, 12 buwan ----
function renderRoomStackChart(container, months, selectedLabel) {
  container.querySelectorAll('svg').forEach(s => s.remove());
  const series = roomSeries('roomTotal');
  const legend = document.getElementById('chartRoomStackLegend');
  legend.innerHTML = '';
  series.forEach(s => {
    const item = document.createElement('span');
    item.innerHTML = '<i class="square"></i>';
    item.firstChild.style.background = s.color;
    item.append(s.name);
    legend.appendChild(item);
  });

  const width = container.clientWidth, height = CHART.height;
  const margin = { top: 22, right: 8, bottom: 26, left: 48 };
  const svg = svgEl('svg', { width, height, role: 'img', 'aria-label': 'Koleksyon bawat kwarto, 12 buwan' });
  container.prepend(svg);

  const totals = months.map(m => series.reduce((s, x) => s + (x.value(m) || 0), 0));
  const scale = niceScale(Math.max(...totals));
  const y = drawAxes(svg, { width, height, margin, scale });
  const band = (width - margin.left - margin.right) / months.length;
  const xCenter = i => margin.left + band * (i + 0.5);
  const barW = Math.min(32, band * 0.6);
  const base = y(0), gap = 2;
  const tip = chartTip(container);

  months.forEach((m, i) => {
    const selected = m.label === selectedLabel;
    const x = xCenter(i) - barW / 2;
    const parts = series.map(s => ({ s, v: s.value(m) || 0 })).filter(p => p.v > 0);
    let cum = 0;
    parts.forEach((p, k) => {
      const yBottom = y(cum), yTop = y(cum + p.v);
      cum += p.v;
      const isTop = k === parts.length - 1;
      // 2px na puwang sa pagitan ng mga segment; bilog lang ang pinakaitaas
      const bottom = k === 0 ? yBottom : yBottom - gap;
      const h = bottom - yTop;
      if (h <= 0) return;
      const r = isTop ? Math.min(4, h, barW / 2) : 0;
      svgEl('path', {
        d: `M${x},${bottom} V${yTop + r} Q${x},${yTop} ${x + r},${yTop} H${x + barW - r} Q${x + barW},${yTop} ${x + barW},${yTop + r} V${bottom} Z`,
        fill: p.s.color, opacity: selected || !selectedLabel ? 1 : 0.55
      }, svg);
    });
    if (selected) {
      const t = svgEl('text', { x: xCenter(i), y: y(totals[i]) - 7, 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 600, fill: CHART.ink }, svg);
      t.textContent = compactPeso(totals[i]);
    }
    const hit = svgEl('rect', { x: margin.left + band * i, y: margin.top, width: band, height: base - margin.top,
      fill: 'transparent', style: 'cursor:pointer' }, svg);
    hit.addEventListener('mouseenter', () => tip.show([
      [m.label],
      ...series.map(s => [`${s.name}: ${s.value(m) ? formatCurrency(s.value(m)) : 'wala'}`, s.color]),
      [`Total: ${formatCurrency(totals[i])}`, null, true]
    ], xCenter(i), y(totals[i])));
    hit.addEventListener('mouseleave', () => tip.hide());
    hit.addEventListener('click', () => selectSummaryMonth(m.label));
  });
  xLabels(svg, months, xCenter, height, band);
}

// ---- Rate ng tubig (₱/m³) ----
function renderWaterRateChart(container, months) {
  renderLineChart(container, months, [
    { name: 'Rate', color: CHART.water, value: m => (m.rateM3 > 0 ? m.rateWater / m.rateM3 : null) }
  ], {
    zeroBased: false,
    format: v => '₱' + v.toFixed(2),
    tick: v => '₱' + v.toLocaleString('en-PH', { maximumFractionDigits: 1 }),
    ariaLabel: 'Rate ng tubig bawat m³'
  });
}

// ---- Konsumo ng tubig bawat kwarto (m³) ----
function renderRoomM3Chart(container, months) {
  renderHeatmap(container, months, 'roomM3', {
    ramp: ORANGE_RAMP, // pangalawang sequential context: orange (kapareho ng Tubig)
    unit: 'm³',
    format: v => v.toLocaleString('en-PH', { maximumFractionDigits: 1 }) + ' m³',
    short: v => v.toLocaleString('en-PH', { maximumFractionDigits: 1 }),
    ariaLabel: 'Konsumo ng tubig bawat kwarto',
    legendEl: document.getElementById('chartRoomM3Legend')
  });
}

// ---- Breakdown ng singil: donut chart + listahan (pangalan, halaga, %) ----
// Magkatabi sa bilog ang Others (yellow) at Rent (aqua): validated na pares; hindi magkatabi ang orange at yellow.
function renderBreakdownChart(container, sums) {
  container.innerHTML = '';
  if (!sums) return;
  const values = { rent: sums.rent, water: sums.water, elec: sums.elec, otherAll: sums.internet + sums.others };
  const parts = BREAKDOWN.map(p => ({ ...p, value: values[p.key] })).filter(p => p.value > 0);
  const total = parts.reduce((s, p) => s + p.value, 0);
  if (!total) return;

  const size = 210, cx = size / 2, cy = size / 2, outer = size / 2 - 2, inner = outer * 0.62;
  const wrap = document.createElement('div');
  wrap.className = 'donut-wrap';
  container.appendChild(wrap);
  const svg = svgEl('svg', { width: size, height: size, role: 'img', 'aria-label': 'Breakdown ng singil' });
  wrap.appendChild(svg);
  const tip = chartTip(container);

  const point = (r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  let angle = -Math.PI / 2; // simula sa itaas, pakanan
  parts.forEach(p => {
    const sweep = (p.value / total) * Math.PI * 2;
    const a0 = angle, a1 = angle + sweep;
    angle = a1;
    let d;
    if (parts.length === 1) {
      // Buong bilog: dalawang kalahating arc (hindi kaya ng iisang arc ang 360°)
      d = `M${cx},${cy - outer} A${outer},${outer} 0 1 1 ${cx},${cy + outer} A${outer},${outer} 0 1 1 ${cx},${cy - outer} Z`
        + ` M${cx},${cy - inner} A${inner},${inner} 0 1 0 ${cx},${cy + inner} A${inner},${inner} 0 1 0 ${cx},${cy - inner} Z`;
    } else {
      const large = sweep > Math.PI ? 1 : 0;
      const [x0, y0] = point(outer, a0), [x1, y1] = point(outer, a1);
      const [x2, y2] = point(inner, a1), [x3, y3] = point(inner, a0);
      d = `M${x0},${y0} A${outer},${outer} 0 ${large} 1 ${x1},${y1} L${x2},${y2} A${inner},${inner} 0 ${large} 0 ${x3},${y3} Z`;
    }
    // Puting 2px na guhit = puwang sa pagitan ng mga hiwa (kulay ng surface, hindi border)
    const slice = svgEl('path', { d, fill: p.color, stroke: '#fff', 'stroke-width': 2, 'stroke-linejoin': 'round', 'fill-rule': 'evenodd' }, svg);
    const [tx, ty] = point((outer + inner) / 2, a0 + sweep / 2);
    slice.addEventListener('mouseenter', () => tip.show([[p.name, p.color],
      [`${formatCurrency(p.value)} (${(p.value / total * 100).toFixed(1)}%)`, null, true]],
      wrap.offsetLeft + tx, wrap.offsetTop + ty - 6));
    slice.addEventListener('mouseleave', () => tip.hide());
  });

  // Kabuuan sa gitna ng donut
  const label = svgEl('text', { x: cx, y: cy - 4, 'text-anchor': 'middle', 'font-size': 11, fill: CHART.muted }, svg);
  label.textContent = 'Total';
  const value = svgEl('text', { x: cx, y: cy + 16, 'text-anchor': 'middle', 'font-size': 17, 'font-weight': 700, fill: CHART.ink }, svg);
  value.textContent = compactPeso(total);

  const list = document.createElement('div');
  list.className = 'breakdown-list';
  parts.forEach(p => {
    const row = document.createElement('div');
    row.innerHTML = '<i></i><span></span><strong></strong><em></em>';
    row.children[0].style.background = p.color;
    row.children[1].innerText = p.name;
    row.children[2].innerText = formatCurrency(p.value);
    row.children[3].innerText = (p.value / total * 100).toFixed(1) + '%';
    list.appendChild(row);
  });
  container.appendChild(list);
}

// ---- Reusable na line chart: may putol kapag null, legend, end labels, crosshair + tooltip ----
// series: [{ name, color, value: month => number|null }]
// opts: { zeroBased, format (tooltip/end label), tick (y-axis label), ariaLabel, legendEl }
function renderLineChart(container, months, series, opts) {
  container.querySelectorAll('svg').forEach(s => s.remove());
  if (opts.legendEl) {
    opts.legendEl.innerHTML = '';
    if (series.length > 1) {
      series.forEach(s => {
        const item = document.createElement('span');
        item.innerHTML = '<i></i>';
        item.firstChild.style.background = s.color;
        item.append(s.name);
        opts.legendEl.appendChild(item);
      });
    }
  }

  const width = container.clientWidth, height = CHART.height;
  const margin = { top: 14, right: 100, bottom: 26, left: 48 };
  const svg = svgEl('svg', { width, height, role: 'img', 'aria-label': opts.ariaLabel });
  container.prepend(svg);

  const vals = months.flatMap(m => series.map(s => s.value(m))).filter(v => v != null);
  if (!vals.length) return;
  const scale = opts.zeroBased ? niceScale(Math.max(...vals)) : niceRange(Math.min(...vals), Math.max(...vals));
  const y = drawAxes(svg, { width, height, margin, scale, tick: opts.tick });
  const plotW = width - margin.left - margin.right;
  const step = months.length > 1 ? plotW / (months.length - 1) : 0;
  const xAt = i => margin.left + (months.length > 1 ? step * i : plotW / 2);
  const bottom = y(scale.min || 0);

  const crosshair = svgEl('line', { y1: margin.top, y2: bottom, stroke: CHART.axis, 'stroke-width': 1, visibility: 'hidden' }, svg);
  const ends = [];
  series.forEach(s => {
    let d = '', pen = false, lastI = -1;
    months.forEach((m, i) => {
      const v = s.value(m);
      if (v == null) { pen = false; return; }
      d += `${pen ? 'L' : 'M'}${xAt(i)},${y(v)} `;
      pen = true;
      lastI = i;
    });
    if (lastI < 0) return;
    svgEl('path', { d, fill: 'none', stroke: s.color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);
    // Tuldok din sa mga nag-iisang punto (walang katabi), para makita pa rin
    months.forEach((m, i) => {
      const v = s.value(m);
      const alone = v != null && (i === 0 || s.value(months[i - 1]) == null) && (i === months.length - 1 || s.value(months[i + 1]) == null);
      if (alone && i !== lastI) svgEl('circle', { cx: xAt(i), cy: y(v), r: 3, fill: s.color }, svg);
    });
    const endY = y(s.value(months[lastI]));
    svgEl('circle', { cx: xAt(lastI), cy: endY, r: 4, fill: s.color, stroke: '#fff', 'stroke-width': 2 }, svg);
    ends.push({ s, x: xAt(lastI), y: endY, v: s.value(months[lastI]) });
  });
  // End labels: ilagay lang ang hindi tatama sa ibang label (ang iba, nasa legend at tooltip)
  const placed = [];
  ends.sort((a, b) => a.y - b.y).forEach(e => {
    if (placed.some(p => Math.abs(p - e.y) < 14)) return;
    placed.push(e.y);
    const t = svgEl('text', { x: e.x + 10, y: e.y + 4, 'font-size': 11, fill: CHART.ink }, svg);
    t.textContent = series.length > 1 ? `${e.s.name} ${opts.format(e.v)}` : opts.format(e.v);
  });
  xLabels(svg, months, xAt, height, step || plotW);

  const hoverDots = series.map(s => svgEl('circle', { r: 4, fill: s.color, stroke: '#fff', 'stroke-width': 2, visibility: 'hidden' }, svg));
  const tip = chartTip(container);
  const last = months.length - 1;
  const overlay = svgEl('rect', { x: margin.left - step / 2, y: margin.top, width: plotW + step, height: bottom - margin.top, fill: 'transparent' }, svg);
  overlay.addEventListener('mousemove', e => {
    const px = e.clientX - svg.getBoundingClientRect().left;
    const i = Math.max(0, Math.min(last, Math.round((px - margin.left) / (step || 1))));
    const m = months[i];
    crosshair.setAttribute('x1', xAt(i));
    crosshair.setAttribute('x2', xAt(i));
    crosshair.setAttribute('visibility', 'visible');
    const ys = [];
    series.forEach((s, k) => {
      const v = s.value(m);
      hoverDots[k].setAttribute('visibility', v == null ? 'hidden' : 'visible');
      if (v != null) {
        hoverDots[k].setAttribute('cx', xAt(i));
        hoverDots[k].setAttribute('cy', y(v));
        ys.push(y(v));
      }
    });
    tip.show([[m.label], ...series.map(s => {
      const v = s.value(m);
      return [`${s.name}: ${v == null ? 'walang data' : opts.format(v)}`, s.color];
    })], xAt(i), ys.length ? Math.min(...ys) : margin.top);
  });
  overlay.addEventListener('mouseleave', () => {
    crosshair.setAttribute('visibility', 'hidden');
    hoverDots.forEach(d => d.setAttribute('visibility', 'hidden'));
    tip.hide();
  });
}

// ---- Rate ng kuryente (₱/kWh): isang linya, hindi nagsisimula sa 0 ----
// ---- Rate ng kuryente bawat kwarto (₱/kWh): isang linya bawat kwarto, parehong kulay ng ibang graph ----
function renderRateChart(container, months) {
  const rooms = allRooms();
  const shown = rooms.slice(0, SLOTS.length), extra = rooms.slice(SLOTS.length);
  // Weighted: Σ singil ÷ Σ kWh ng mga kwarto sa listahan
  const rateOf = (m, list) => {
    const kwh = list.reduce((s, r) => s + (m.roomRateKwh[r] || 0), 0);
    return kwh > 0 ? list.reduce((s, r) => s + (m.roomRateElec[r] || 0), 0) / kwh : null;
  };
  const series = shown.map((room, i) => ({ name: `Room ${room}`, color: SLOTS[i], value: m => rateOf(m, [room]) }));
  if (extra.length) series.push({ name: 'Iba pa', color: OTHER_COLOR, value: m => rateOf(m, extra) });

  renderLineChart(container, months, series, {
    zeroBased: false,
    format: v => '₱' + v.toFixed(2),
    tick: v => '₱' + v.toLocaleString('en-PH', { maximumFractionDigits: 1 }),
    ariaLabel: 'Rate ng kuryente bawat kwarto',
    legendEl: document.getElementById('chartRateLegend')
  });
}

// ---- Konsumo ng kuryente bawat kwarto (kWh) ----
function renderRoomKwhChart(container, months) {
  renderHeatmap(container, months, 'roomKwh', {
    ramp: BLUE_RAMP,
    unit: 'kWh',
    format: v => Math.round(v).toLocaleString('en-PH') + ' kWh',
    short: v => Math.round(v).toLocaleString('en-PH'),
    ariaLabel: 'Konsumo ng kuryente bawat kwarto',
    legendEl: document.getElementById('chartRoomKwhLegend')
  });
}

// Horizontal bars: koleksyon ng bawat kwarto (Y1) sa isang buwan; "Bakante" kung walang singil
function renderRoomsChart(container, monthLabel) {
  container.querySelectorAll('svg').forEach(s => s.remove());
  const rooms = new Map(); // room -> { room, tenants: [], total }
  workbook.SheetNames.forEach(name => {
    const room = roomOf(name);
    if (!room) return;
    if (!rooms.has(room)) rooms.set(room, { room, tenants: [], total: 0, pending: false });
    const entry = rooms.get(room);
    if (monthLabel === ALL_MONTHS) {
      // ALL: kabuuan ng lahat ng buwan, at lahat ng naging tenant ng kwarto
      const rows = parseSheet(name).data.filter(r => r && typeof r[0] === 'number' && typeof r[18] === 'number');
      if (rows.length) {
        entry.tenants.push(name);
        entry.total += rows.reduce((s, r) => s + r[18], 0);
      }
      return;
    }
    // May row sa buwang ito = nakatira; kung wala pang Total Amount, "Wala pang singil" (hindi bakante)
    const row = parseSheet(name).data.find(r =>
      r && typeof r[0] === 'number' && excelDateToFullMonthYear(r[0]) === monthLabel);
    if (row) {
      entry.tenants.push(name);
      if (typeof row[18] === 'number') entry.total += row[18];
      else entry.pending = true;
    }
  });
  const list = [...rooms.values()].sort((a, b) => a.room.localeCompare(b.room, 'en', { numeric: true }));
  if (!list.length) return;

  const rowH = 44, labelW = 150;
  const width = container.clientWidth;
  const height = Math.max(list.length * rowH, rowH);
  container.style.height = height + 'px';
  const svg = svgEl('svg', { width, height, role: 'img', 'aria-label': 'Koleksyon bawat kwarto' });
  container.prepend(svg);

  const maxBarW = width - labelW - 80; // espasyo para sa value sa dulo
  const max = Math.max(...list.map(r => r.total), 1);
  const tip = chartTip(container);

  list.forEach((r, i) => {
    const cy = i * rowH + rowH / 2;
    const name = svgEl('text', { x: 0, y: cy - 3, 'font-size': 13, 'font-weight': 600, fill: CHART.ink }, svg);
    name.textContent = `Room ${r.room}`;
    const who = svgEl('text', { x: 0, y: cy + 13, 'font-size': 11, fill: CHART.muted }, svg);
    who.textContent = r.tenants.length ? r.tenants.join(', ') : 'Bakante';
    // Putulin ang mahabang pangalan para hindi tumama sa bar
    while (who.getComputedTextLength() > labelW - 12 && who.textContent.length > 4) {
      who.textContent = who.textContent.slice(0, -2) + '…';
    }

    const barH = 20, x = labelW, top = cy - barH / 2;
    const w = r.total > 0 ? Math.max(4, (r.total / max) * maxBarW) : 0;
    if (w > 0) {
      const rr = Math.min(4, w);
      // 4px na bilog na dulo sa kanan, kuwadrado sa baseline (kaliwa)
      svgEl('path', {
        d: `M${x},${top} H${x + w - rr} Q${x + w},${top} ${x + w},${top + rr} V${top + barH - rr} Q${x + w},${top + barH} ${x + w - rr},${top + barH} H${x} Z`,
        fill: CHART.accent
      }, svg);
    }
    const value = svgEl('text', { x: x + w + 8, y: cy + 4, 'font-size': 12, 'font-weight': r.total > 0 ? 600 : 400,
      fill: r.total > 0 ? CHART.ink : CHART.muted }, svg);
    // Bakante: nasa ilalim na ng "Room X" ang salita, kaya walang value sa tabi
    value.textContent = r.total > 0 ? compactPeso(r.total) : (r.pending ? 'Wala pang singil' : '');

    const hit = svgEl('rect', { x: 0, y: i * rowH, width, height: rowH, fill: 'transparent' }, svg);
    hit.addEventListener('mouseenter', () => tip.show([
      [`Room ${r.room}`],
      [r.tenants.length ? r.tenants.join(', ') : 'Bakante'],
      [r.total > 0 || !r.tenants.length ? formatCurrency(r.total) : 'Wala pang singil', null, true]
    ], x + w / 2, top));
    hit.addEventListener('mouseleave', () => tip.hide());
  });

  // Manipis na baseline sa kaliwa ng mga bar
  svgEl('line', { x1: labelW, x2: labelW, y1: 4, y2: height - 4, stroke: CHART.axis, 'stroke-width': 1, 'shape-rendering': 'crispEdges' }, svg);
}

// Gridlines + y labels; ibinabalik ang y() scale
// scale: { min (default 0), max, step }; tick: format ng y label (default ₱ compact)
function drawAxes(svg, { width, height, margin, scale, tick = compactPeso }) {
  const min = scale.min || 0;
  const y = v => margin.top + (1 - (v - min) / (scale.max - min)) * (height - margin.top - margin.bottom);
  for (let i = 0, v = min; v <= scale.max + 1e-6; i++, v = min + i * scale.step) {
    svgEl('line', { x1: margin.left, x2: width - margin.right, y1: y(v), y2: y(v),
      stroke: i === 0 ? CHART.axis : CHART.grid, 'stroke-width': 1, 'shape-rendering': 'crispEdges' }, svg);
    const t = svgEl('text', { x: margin.left - 8, y: y(v) + 4, 'text-anchor': 'end', 'font-size': 11, fill: CHART.muted }, svg);
    t.textContent = tick(v);
  }
  return y;
}

function xLabels(svg, months, xCenter, height, band) {
  const every = Math.max(1, Math.ceil(44 / band)); // ~44px bawat label para hindi magsiksikan
  let lastYear = null;
  months.forEach((m, i) => {
    if ((months.length - 1 - i) % every !== 0) return;
    // May taon ang unang label na ipinakita, at ang unang label ng bawat bagong taon
    const year = serialToDate(m.serial).getFullYear();
    const withYear = year !== lastYear;
    lastYear = year;
    const t = svgEl('text', { x: xCenter(i), y: height - 6, 'text-anchor': 'middle', 'font-size': 11, fill: CHART.muted }, svg);
    t.textContent = m.short || shortMonth(m.serial, withYear); // m.short: para sa Jan–Dec na walang taon
  });
}

function chartTip(container) {
  let tip = container.querySelector('.chart-tip');
  if (!tip) {
    tip = document.createElement('div');
    tip.className = 'chart-tip';
    tip.hidden = true;
    container.appendChild(tip);
  }
  return {
    show(lines, x, y) {
      tip.innerHTML = '';
      lines.forEach(([text, color, strong]) => {
        const row = document.createElement('div');
        if (color) {
          const key = document.createElement('i');
          key.style.background = color;
          row.appendChild(key);
        }
        const span = document.createElement(strong ? 'strong' : 'span');
        span.innerText = text;
        row.appendChild(span);
        tip.appendChild(row);
      });
      tip.hidden = false;
      const maxX = container.clientWidth - tip.offsetWidth - 4;
      tip.style.left = Math.max(4, Math.min(maxX, x - tip.offsetWidth / 2)) + 'px';
      tip.style.top = Math.max(0, y - tip.offsetHeight - 10) + 'px';
    },
    hide() { tip.hidden = true; }
  };
}

// Column chart: kabuuang koleksyon bawat buwan; naka-highlight ang napiling buwan
function renderTotalsChart(container, months, selectedLabel) {
  renderColumnChart(container, months, {
    value: m => m.total,
    selectedLabel,
    label: m => compactPeso(m.total),
    tooltip: m => [[m.label], [formatCurrency(m.total), null, true]],
    ariaLabel: 'Kabuuang koleksyon bawat buwan'
  });
}

// Generic na column chart, isang series; naka-highlight ang napiling buwan, i-click para piliin ang buwan.
// o: { value, scale?, tick?, selectedLabel, label (sa ibabaw ng napili), tooltip (lines), ariaLabel }
function renderColumnChart(container, months, o) {
  container.querySelectorAll('svg').forEach(s => s.remove());
  const width = container.clientWidth, height = CHART.height;
  const margin = { top: 22, right: 8, bottom: 26, left: 48 };
  const svg = svgEl('svg', { width, height, role: 'img', 'aria-label': o.ariaLabel });
  container.prepend(svg);

  const scale = o.scale || niceScale(Math.max(...months.map(o.value)));
  const y = drawAxes(svg, { width, height, margin, scale, tick: o.tick });
  const band = (width - margin.left - margin.right) / months.length;
  const xCenter = i => margin.left + band * (i + 0.5);
  const barW = Math.min(24, band * 0.6);
  const base = y(0);
  const tip = chartTip(container);

  months.forEach((m, i) => {
    const selected = m.label === o.selectedLabel;
    const x = xCenter(i) - barW / 2, top = y(o.value(m)), h = base - top;
    const r = Math.min(4, h, barW / 2);
    // 4px na bilog na dulo sa itaas, kuwadrado sa baseline
    if (h > 0) {
      svgEl('path', {
        d: `M${x},${base} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${base} Z`,
        fill: selected || !o.selectedLabel ? CHART.accent : CHART.soft // walang napili (ALL): lahat naka-accent
      }, svg);
    }
    if (selected) {
      const t = svgEl('text', { x: xCenter(i), y: top - 7, 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 600, fill: CHART.ink }, svg);
      t.textContent = o.label(m);
    }
    // Mas malaking hit target kaysa sa column
    const hit = svgEl('rect', { x: margin.left + band * i, y: margin.top, width: band, height: base - margin.top,
      fill: 'transparent', style: 'cursor:pointer' }, svg);
    hit.addEventListener('mouseenter', () => tip.show(o.tooltip(m), xCenter(i), top));
    hit.addEventListener('mouseleave', () => tip.hide());
    hit.addEventListener('click', () => selectSummaryMonth(m.label));
  });
  xLabels(svg, months, xCenter, height, band);
}

// Grouped columns: Kuryente at Tubig bawat buwan (iisang ₱ axis)
function renderUtilitiesChart(container, months) {
  renderGroupedColumnChart(container, months, [
    { name: 'Kuryente', color: CHART.accent, value: m => m.elec },
    { name: 'Tubig', color: CHART.water, value: m => m.water }
  ], {
    format: v => formatCurrency(v),
    ariaLabel: 'Kuryente at tubig bawat buwan',
    legendEl: document.getElementById('chartUtilitiesLegend')
  });
}

// I-redraw ang graphs kapag nagbago ang lapad ng window
let chartResizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(chartResizeTimer);
  chartResizeTimer = setTimeout(() => {
    if (lastChartMonth && !document.getElementById('viewSummary').hidden) renderCharts(lastChartMonth);
  }, 150);
});

document.getElementById('summaryMonthSelect').addEventListener('change', function () {
  renderSummaryMonth(this.value);
});

// Paglipat ng tab (naaalala sa URL: #koleksyon)
function showView(view) {
  const isSummary = view === 'summary';
  document.getElementById('viewReceipt').hidden = isSummary;
  document.getElementById('viewSummary').hidden = !isSummary;
  document.querySelectorAll('.view-tab').forEach(tab => {
    const active = tab.dataset.view === view;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', active);
  });
  history.replaceState(null, '', isSummary ? '#koleksyon' : location.pathname + location.search);
  if (isSummary) {
    renderSummary();
  } else {
    fitLeftColumn();
    fitReceipt();
  }
}

document.querySelectorAll('.view-tab').forEach(tab => {
  tab.addEventListener('click', () => showView(tab.dataset.view));
});

// Lumipat sa ibang tenant pero manatili sa parehong buwan
function openTenantMonth(name, monthLabel) {
  tenantSelect.value = name;
  tenantSelect.dispatchEvent(new Event('change'));
  const index = sheetData.data.findIndex(r => r && typeof r[0] === 'number' && excelDateToFullMonthYear(r[0]) === monthLabel);
  if (index >= 0) selectMonth(index);
}

// I-render ulit kapag na-load o na-Refresh ang data, kung nakabukas ang tab na ito
document.addEventListener('workbook-loaded', () => {
  if (!document.getElementById('viewSummary').hidden) renderSummary();
});

// Bumalik sa Koleksyon tab kung doon ka huling nakatingin (#koleksyon sa URL)
if (location.hash === '#koleksyon') showView('summary');
