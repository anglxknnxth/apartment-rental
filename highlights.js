// Highlights tab: mahahalagang detalye mula sa lahat ng data sa Google Sheet
// (pinakamatagal na tenant, record na buwan, occupancy, at listahan ng lahat ng tenant).
//
// Sariling file ito: ito mismo ang gumagawa ng tab button at ng section. Naka-load pagkatapos ng
// dashboard.js, at gumagamit ng mga global mula sa index.html at dashboard.js:
//   workbook, parseSheet, isArchived, roomOf, formatCurrency, excelDateToFullMonthYear, shortMonthYear,
//   tenantSelect, monthlyTotals, occupancyByMonth, allRooms, roomsOpenIn, serialToDate,
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
    </div>
    <div class="hl-grid" id="hlCards"></div>
    <div class="hl-rank-sections" id="hlRanks"></div>
    <h2 class="section-title">Top 10 bawat buwan</h2>
    <div class="hl-rank-grid cols-3" id="hlTop10"></div>
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
    const maxBill = billed.reduce((best, r) => (!best || r[18] > best[18] ? r : best), null);
    const avg = billed.length ? sum(billed, 18) / billed.length : null;
    const num = v => (typeof v === 'number' ? v : 0);
    const colSum = col => billed.reduce((s, r) => s + num(r[col]), 0);
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
      avgBill: avg,
      // Standard deviation ng Total: mas maliit = mas pare-pareho ang bill
      stdBill: billed.length ? Math.sqrt(billed.reduce((s, r) => s + (r[18] - avg) ** 2, 0) / billed.length) : null,
      maxBill: maxBill ? { value: maxBill[18], serial: maxBill[0] } : null,
      elecTotal: colSum(8),
      waterTotal: colSum(15),
      otherTotal: colSum(16) + colSum(17),
      kwhMonths: kwh.length,
      avgKwh: kwh.length ? sum(kwh, 4) / kwh.length : null,
      maxKwh: maxKwh ? { value: maxKwh[4], label: excelDateToFullMonthYear(maxKwh[0]) } : null,
      m3Months: m3.length,
      avgM3: m3.length ? sum(m3, 11) / m3.length : null
    };
  });
}

// Kulay ng bawat seksyon ng ranggo (mula sa CHART ng dashboard.js)
const HL_SECTION_COLORS = {
  'Mga tenant': CHART.magenta,
  'Mga buwan': CHART.violet,
  'Kuryente at tubig': CHART.elec,
  'Mga kwarto': CHART.accent
};

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

// ---------- Mga helper na ginagamit din ng tenants.js ----------

const hlNum = (v, digits = 0) => v.toLocaleString('en-PH', { maximumFractionDigits: digits });
const hlTenantLine = t => [t.room ? `Room ${t.room}` : null, t.archived ? 'archived' : 'active'].filter(Boolean).join(' · ');
// bar: value / pinakamalaki sa listahan (null = walang bar, hal. petsa)
function hlBars(list, value) {
  const max = Math.max(...list.map(r => value(r.item)), 0);
  return r => (max > 0 ? value(r.item) / max : null);
}

// Pagbabago ng bill ng isang tenant kumpara sa mismong nakaraang buwan niya (magkasunod lang)
function monthChanges() {
  const out = [];
  workbook.SheetNames.forEach(name => {
    const room = roomOf(name);
    const bills = parseSheet(name).data
      .filter(r => r && typeof r[0] === 'number' && typeof r[18] === 'number')
      .sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < bills.length; i++) {
      const prev = bills[i - 1], cur = bills[i];
      const d0 = serialToDate(prev[0]), d1 = serialToDate(cur[0]);
      if ((d1.getFullYear() * 12 + d1.getMonth()) - (d0.getFullYear() * 12 + d0.getMonth()) !== 1) continue;
      out.push({
        name, room, serial: cur[0], prevTotal: prev[18], total: cur[18],
        diff: cur[18] - prev[18], pct: prev[18] ? (cur[18] - prev[18]) / prev[18] * 100 : null
      });
    }
  });
  return out;
}

// Buod bawat kwarto (Y1): mga naging tenant, kabuuang kita, bakanteng buwan, average na kWh at m³,
// huling upa, pinakamahabang sunod-sunod na bakante, at average na tagal ng tenant
function roomStats() {
  const months = monthlyTotals();
  const occ = occupancyByMonth();
  return allRooms().map(room => {
    const names = workbook.SheetNames.filter(n => roomOf(n) === room);
    let total = 0, lastRent = null;
    const kwh = [], m3 = [], tenure = [], billedMonths = new Set();
    names.forEach(n => {
      const billed = new Set();
      parseSheet(n).data.forEach(r => {
        if (!r || typeof r[0] !== 'number') return;
        if (typeof r[1] === 'number' && r[1] > 0 && (!lastRent || r[0] > lastRent.serial)) lastRent = { value: r[1], serial: r[0], name: n };
        if (typeof r[18] !== 'number') return;
        total += r[18];
        billed.add(excelDateToFullMonthYear(r[0]));
        billedMonths.add(excelDateToFullMonthYear(r[0]));
        if (typeof r[4] === 'number') kwh.push(r[4]);
        if (typeof r[11] === 'number') m3.push(r[11]);
      });
      if (billed.size) tenure.push(billed.size);
    });
    // Bakante: bukas na ang kwarto (ROOM_OPENED) pero walang tenant na may row sa buwang iyon
    const isVacant = m => roomOpenIn(room, m.label) && !(occ.get(m.label) || new Set()).has(room);
    const vacant = months.filter(isVacant);
    // Pinakamahabang sunod-sunod na bakante (magkakasunod sa listahan ng mga buwan)
    let longest = null, run = null;
    months.forEach(m => {
      if (isVacant(m)) {
        run = run ? { ...run, to: m, length: run.length + 1 } : { from: m, to: m, length: 1 };
        if (!longest || run.length > longest.length) longest = run;
      } else run = null;
    });
    const avgOf = list => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : null);
    return {
      room, tenants: names, total,
      vacantMonths: vacant.length, lastVacant: vacant.length ? vacant[vacant.length - 1] : null, longestVacant: longest,
      kwhMonths: kwh.length, avgKwh: avgOf(kwh),
      m3Months: m3.length, avgM3: avgOf(m3),
      lastRent, tenantCount: tenure.length, avgTenure: avgOf(tenure), billedMonths: billedMonths.size
    };
  });
}

// Pagbabago ng kabuuang koleksyon kumpara sa mismong nakaraang buwan (magkasunod lang)
function monthlyChanges(months) {
  const out = [];
  for (let i = 1; i < months.length; i++) {
    const prev = months[i - 1], cur = months[i];
    const d0 = serialToDate(prev.serial), d1 = serialToDate(cur.serial);
    if ((d1.getFullYear() * 12 + d1.getMonth()) - (d0.getFullYear() * 12 + d0.getMonth()) !== 1) continue;
    out.push({ serial: cur.serial, prevTotal: prev.total, total: cur.total, diff: cur.total - prev.total,
      pct: prev.total ? (cur.total - prev.total) / prev.total * 100 : null });
  }
  return out;
}

// Lahat ng Top 5, nakagrupo ayon sa seksyon. Ginagamit ng Highlights at ng Tenants (ranggo ng tenant).
// Bawat row: { rank, name, value, bar, sub, tenant } — ang `tenant` ay ang pangalan kapag tenant ang niraranggo.
function highlightRankLists(stats = tenantStats(), months = monthlyTotals()) {
  const tenants = stats.filter(t => t.firstSerial != null);
  const enough = key => stats.filter(t => t[key] >= HL_MIN_MONTHS);
  const tenantRows = (top, value, format, sub) => {
    const bar = hlBars(top, value);
    return top.map(r => ({ rank: r.rank, name: r.item.name, tenant: r.item.name, value: format(value(r.item)), bar: bar(r), sub: sub(r.item) }));
  };
  const monthRows = top => {
    const bar = hlBars(top, m => m.total);
    return top.map(r => ({ rank: r.rank, name: shortMonthYear(r.item.serial), tenant: null, value: formatCurrency(r.item.total), bar: bar(r),
      sub: `${r.item.tenantCount} ${r.item.tenantCount === 1 ? 'tenant' : 'tenants'}` }));
  };
  const changeRows = (top, sign) => {
    const bar = hlBars(top, c => Math.abs(c.diff));
    return top.map(r => ({
      rank: r.rank, name: r.item.name, tenant: r.item.name, bar: bar(r),
      value: `${sign}${formatCurrency(Math.abs(r.item.diff))}`,
      sub: `${shortMonthYear(r.item.serial)} · ${compactPeso(r.item.prevTotal)} → ${compactPeso(r.item.total)}`
        + (r.item.pct != null ? ` (${sign}${Math.abs(r.item.pct).toFixed(1)}%)` : '')
    }));
  };
  const roomRows = (top, value, format, sub) => {
    const bar = hlBars(top, value);
    return top.map(r => ({ rank: r.rank, name: `Room ${r.item.room}`, tenant: null, value: format(value(r.item)), bar: bar(r), sub: sub(r.item) }));
  };

  // Pagbabago ng kabuuang koleksyon (lahat ng tenant), kumpara sa nakaraang buwan
  const totalChangeRows = (top, sign) => {
    const bar = hlBars(top, c => Math.abs(c.diff));
    return top.map(r => ({
      rank: r.rank, name: shortMonthYear(r.item.serial), tenant: null, bar: bar(r),
      value: `${sign}${formatCurrency(Math.abs(r.item.diff))}`,
      sub: `${compactPeso(r.item.prevTotal)} → ${compactPeso(r.item.total)}`
        + (r.item.pct != null ? ` (${sign}${Math.abs(r.item.pct).toFixed(1)}%)` : '')
    }));
  };
  const totalChanges = monthlyChanges(months);
  // Kabuuan bawat taon
  const years = [];
  months.forEach(m => {
    const y = serialToDate(m.serial).getFullYear();
    let e = years.find(x => x.year === y);
    if (!e) years.push(e = { year: y, total: 0, count: 0 });
    e.total += m.total;
    e.count++;
  });
  const yearTop = rankTop(years, y => y.total, false, Infinity);
  const yearBar = hlBars(yearTop, y => y.total);
  const tenantPaid = t => `${hlTenantLine(t)} · ${t.months} buwan`;

  const changes = monthChanges();
  // Bar ng Pinakabagong tenant: mas bago = mas mahaba (pinakaluma ≈ maikli, pinakabago = buo)
  const firsts = tenants.map(t => t.firstSerial);
  const oldest = Math.min(...firsts), newestSerial = Math.max(...firsts);
  const recency = s => (newestSerial > oldest ? 0.08 + 0.92 * (s - oldest) / (newestSerial - oldest) : 1);
  const rooms = roomStats();
  const minNote = `may ≥${HL_MIN_MONTHS} buwang data`;

  return [
    { section: 'Mga tenant', lists: [
      // all: true = ipinapakita ang lahat ng tenant (hindi Top 5), kasama ang wala pang singil
      { title: 'Pinakamatagal na tenant', note: 'Lahat ng tenant, ayon sa dami ng buwang may singil', all: true,
        rows: tenantRows(rankTop(stats, t => t.months, false, Infinity), t => t.months, v => `${v} buwan`,
          t => `${hlTenantLine(t)} · ${t.firstSerial != null ? 'mula ' + shortMonthYear(t.firstSerial) : 'wala pang buwan sa sheet'}`) },
      { title: 'Pinakabagong tenant', note: 'Lahat ng tenant, ayon sa unang buwan sa sheet', all: true,
        rows: [
          ...rankTop(tenants, t => t.firstSerial, false, Infinity).map(r => ({ rank: r.rank, name: r.item.name, tenant: r.item.name,
            value: shortMonthYear(r.item.firstSerial), bar: recency(r.item.firstSerial), sub: hlTenantLine(r.item) })),
          // Mga tab na wala pang buwang may petsa: sa dulo
          ...stats.filter(t => t.firstSerial == null).map(t => ({ rank: tenants.length + 1, name: t.name, tenant: t.name,
            value: '–', bar: 0, sub: `${hlTenantLine(t)} · wala pang buwan sa sheet` }))
        ] },
      { title: 'Pinakamalaking naibayad', note: 'Lahat ng tenant, kabuuan mula nang pumasok', all: true,
        rows: tenantRows(rankTop(stats, t => t.total, false, Infinity), t => t.total, formatCurrency,
          t => `${hlTenantLine(t)} · ${t.months} buwan`) },
      { title: 'Pinakamataas na average na bill', note: 'Lahat ng tenant, average bawat buwan', all: true,
        rows: [
          ...tenantRows(rankTop(stats.filter(t => t.avgBill != null), t => t.avgBill, false, Infinity), t => t.avgBill, formatCurrency,
            t => `${hlTenantLine(t)} · ${t.months} buwan`),
          // Wala pang singil: sa dulo, walang average
          ...stats.filter(t => t.avgBill == null).map(t => ({ rank: stats.filter(x => x.avgBill != null).length + 1, name: t.name,
            tenant: t.name, value: '–', bar: 0, sub: `${hlTenantLine(t)} · wala pang singil` }))
        ] },
      // Coefficient of variation: std ÷ average ng Total (mas mababa = mas pare-pareho)
      { title: 'Pinaka-consistent na bill', note: `Pinakamaliit ang galaw ng bill buwan-buwan (${minNote})`,
        rows: tenantRows(rankTop(enough('months').filter(t => t.avgBill > 0), t => t.stdBill / t.avgBill, true), t => t.stdBill / t.avgBill,
          v => `±${(v * 100).toFixed(1)}%`, t => `${hlTenantLine(t)} · ${compactPeso(t.avgBill)} ± ${compactPeso(t.stdBill)}`) },
      { title: 'Pinakamalaking bill sa isang buwan', note: 'Pinakamataas na Total ng bawat tenant',
        rows: tenantRows(rankTop(stats.filter(t => t.maxBill), t => t.maxBill.value), t => t.maxBill.value, formatCurrency,
          t => `${hlTenantLine(t)} · ${shortMonthYear(t.maxBill.serial)}`) },
      { title: 'Pinakamalaking naibayad sa internet/others', note: 'Kabuuan ng Internet at Others mula nang pumasok',
        rows: tenantRows(rankTop(stats.filter(t => t.otherTotal > 0), t => t.otherTotal), t => t.otherTotal, formatCurrency, tenantPaid) },
      { title: 'Pinakamababang average na bill', note: `Average bawat buwan (${minNote})`,
        rows: tenantRows(rankTop(enough('months'), t => t.avgBill, true), t => t.avgBill, formatCurrency, tenantPaid) }
    ] },
    { section: 'Mga buwan', lists: [
      { title: 'Pinakamataas na koleksyon', note: 'Kabuuan ng lahat ng tenant sa isang buwan', rows: monthRows(rankTop(months, m => m.total)) },
      { title: 'Pinakamababang koleksyon', note: 'Kabuuan ng lahat ng tenant sa isang buwan', rows: monthRows(rankTop(months, m => m.total, true)) },
      { title: 'Pinakamalaking pagtaas ng bill', note: 'Isang tenant, kumpara sa nakaraang buwan niya',
        rows: changeRows(rankTop(changes.filter(c => c.diff > 0), c => c.diff), '+') },
      { title: 'Pinakamalaking pagbaba ng bill', note: 'Isang tenant, kumpara sa nakaraang buwan niya',
        rows: changeRows(rankTop(changes.filter(c => c.diff < 0), c => c.diff, true), '−') },
      { title: 'Mga taon, ayon sa koleksyon', note: 'Kabuuang koleksyon bawat taon', all: true,
        rows: yearTop.map(r => ({ rank: r.rank, name: String(r.item.year), tenant: null, value: formatCurrency(r.item.total), bar: yearBar(r),
          sub: `${r.item.count} buwan${r.item.count < 12 ? ' (hindi buong taon)' : ''}` })) },
      { title: 'Pinakamalaking pagtaas ng koleksyon', note: 'Kabuuan ng lahat ng tenant, kumpara sa nakaraang buwan',
        rows: totalChangeRows(rankTop(totalChanges.filter(c => c.diff > 0), c => c.diff), '+') },
      { title: 'Pinakamalaking pagbaba ng koleksyon', note: 'Kabuuan ng lahat ng tenant, kumpara sa nakaraang buwan',
        rows: totalChangeRows(rankTop(totalChanges.filter(c => c.diff < 0), c => c.diff, true), '−') },
      { title: 'Pinakamataas na average bawat tenant', note: 'Koleksyon ng buwan ÷ bilang ng tenant na may singil',
        rows: (() => {
          const avg = m => m.total / m.tenantCount;
          const top = rankTop(months.filter(m => m.tenantCount > 0), avg);
          const bar = hlBars(top, avg);
          return top.map(r => ({ rank: r.rank, name: shortMonthYear(r.item.serial), tenant: null, value: formatCurrency(avg(r.item)), bar: bar(r),
            sub: `${compactPeso(r.item.total)} ÷ ${r.item.tenantCount} ${r.item.tenantCount === 1 ? 'tenant' : 'tenants'}` }));
        })() }
    ] },
    { section: 'Kuryente at tubig', lists: [
      { title: 'Pinakamalakas sa kuryente', note: `Average na kWh bawat buwan (${minNote})`,
        rows: tenantRows(rankTop(enough('kwhMonths'), t => t.avgKwh), t => t.avgKwh, v => `${hlNum(v)} kWh`,
          t => `${hlTenantLine(t)}${t.maxKwh ? ` · record ${hlNum(t.maxKwh.value)} kWh` : ''}`) },
      { title: 'Pinakamatipid sa kuryente', note: `Pinakamababang average na kWh (${minNote})`,
        rows: tenantRows(rankTop(enough('kwhMonths'), t => t.avgKwh, true), t => t.avgKwh, v => `${hlNum(v)} kWh`, hlTenantLine) },
      { title: 'Pinakamalakas sa tubig', note: `Average na m³ bawat buwan (${minNote})`,
        rows: tenantRows(rankTop(enough('m3Months'), t => t.avgM3), t => t.avgM3, v => `${hlNum(v, 1)} m³`, hlTenantLine) },
      { title: 'Pinakamatipid sa tubig', note: `Pinakamababang average na m³ (${minNote})`,
        rows: tenantRows(rankTop(enough('m3Months'), t => t.avgM3, true), t => t.avgM3, v => `${hlNum(v, 1)} m³`, hlTenantLine) },
      { title: 'Pinakamalaking naibayad sa kuryente', note: 'Kabuuang singil sa kuryente mula nang pumasok',
        rows: tenantRows(rankTop(stats.filter(t => t.elecTotal > 0), t => t.elecTotal), t => t.elecTotal, formatCurrency, tenantPaid) },
      { title: 'Pinakamalaking naibayad sa tubig', note: 'Kabuuang singil sa tubig mula nang pumasok',
        rows: tenantRows(rankTop(stats.filter(t => t.waterTotal > 0), t => t.waterTotal), t => t.waterTotal, formatCurrency, tenantPaid) },
      { title: 'Pinakamalakas sa tubig (kwarto)', note: 'Average na m³ bawat buwan ng kwarto',
        rows: roomRows(rankTop(rooms.filter(r => r.m3Months > 0), r => r.avgM3), r => r.avgM3, v => `${hlNum(v, 1)} m³`,
          r => `${r.m3Months} buwang may m³`) },
      { title: 'Mga buwang pinakamalakas sa kuryente', note: 'Kabuuang kWh ng lahat ng kwarto sa isang buwan',
        rows: (() => {
          const top = rankTop(months.filter(m => m.kwh > 0), m => m.kwh);
          const bar = hlBars(top, m => m.kwh);
          return top.map(r => ({ rank: r.rank, name: shortMonthYear(r.item.serial), tenant: null, value: `${hlNum(r.item.kwh)} kWh`, bar: bar(r),
            sub: `${hlNum(r.item.m3, 1)} m³ · ${r.item.tenantCount} ${r.item.tenantCount === 1 ? 'tenant' : 'tenants'}` }));
        })() }
    ] },
    { section: 'Mga kwarto', lists: [
      { title: 'Pinakamalaking kita', note: 'Kabuuan ng lahat ng naging tenant ng kwarto',
        rows: roomRows(rankTop(rooms.filter(r => r.total > 0), r => r.total), r => r.total, formatCurrency,
          r => r.tenants.join(', ')) },
      { title: 'Pinakamatagal na bakante', note: 'Bilang ng buwang bukas ang kwarto pero walang tenant',
        rows: roomRows(rankTop(rooms.filter(r => r.vacantMonths > 0), r => r.vacantMonths), r => r.vacantMonths, v => `${v} buwan`,
          r => (r.lastVacant ? `Huling bakante: ${shortMonthYear(r.lastVacant.serial)}` : '')) },
      { title: 'Pinakamaraming naging tenant', note: 'Bilang ng tab na may parehong kwarto (Y1)',
        rows: roomRows(rankTop(rooms, r => r.tenants.length), r => r.tenants.length, v => `${v} tenant${v === 1 ? '' : 's'}`,
          r => r.tenants.join(', ')) },
      { title: 'Pinakamalakas sa kuryente (kwarto)', note: 'Average na kWh bawat buwan ng kwarto',
        rows: roomRows(rankTop(rooms.filter(r => r.kwhMonths > 0), r => r.avgKwh), r => r.avgKwh, v => `${hlNum(v)} kWh`,
          r => `${r.kwhMonths} buwang may kWh`) },
      { title: 'Pinakamataas na upa ngayon', note: 'Huling rent (col B) ng bawat kwarto',
        rows: roomRows(rankTop(rooms.filter(r => r.lastRent), r => r.lastRent.value), r => r.lastRent.value, formatCurrency,
          r => `${r.lastRent.name} · ${shortMonthYear(r.lastRent.serial)}`) },
      { title: 'Pinakamahabang sunod-sunod na bakante', note: 'Pinakamaraming magkakasunod na buwang walang tenant',
        rows: roomRows(rankTop(rooms.filter(r => r.longestVacant), r => r.longestVacant.length), r => r.longestVacant.length,
          v => `${v} buwan`, r => `${shortMonthYear(r.longestVacant.from.serial)} – ${shortMonthYear(r.longestVacant.to.serial)}`) },
      { title: 'Pinakamatagal mag-stay ang tenant', note: 'Average na buwang may singil ng mga naging tenant ng kwarto',
        rows: roomRows(rankTop(rooms.filter(r => r.avgTenure != null), r => r.avgTenure), r => r.avgTenure, v => `${hlNum(v, 1)} buwan`,
          r => `${r.tenantCount} tenant${r.tenantCount === 1 ? '' : 's'}`) },
      { title: 'Pinakamataas na kita bawat buwan', note: 'Kabuuang kita ng kwarto ÷ ilang buwang may singil',
        rows: roomRows(rankTop(rooms.filter(r => r.billedMonths > 0), r => r.total / r.billedMonths), r => r.total / r.billedMonths,
          formatCurrency, r => `${r.billedMonths} buwang may singil`) }
    ] }
  ];
}

// ---------- Render ----------

function renderHighlights() {
  const hasData = !!workbook;
  document.getElementById('hlEmpty').hidden = hasData;
  document.querySelectorAll('#viewHighlights > .card, #viewHighlights > .section-title, #hlCards, #hlRanks, #hlTop10').forEach(el => { el.hidden = !hasData; });
  if (!hasData) return;

  const stats = tenantStats();
  const months = monthlyTotals();
  const rooms = allRooms();
  const occ = occupancyByMonth();
  const latest = months[months.length - 1];
  const num = hlNum;

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
      detail: `${shortMonthYear(latest.serial)}: ${now.length}/${openNow.length} · ${vacant.length ? 'Bakante: ' + vacant.map(r => 'Rm ' + r).join(', ') : 'walang bakante'}`
    });
  }
  const tenants = stats.filter(t => t.firstSerial != null);
  const activeCount = tenants.filter(t => !t.archived).length;
  cards.push({ label: 'Mga naging tenant', value: String(tenants.length), detail: `${activeCount} active · ${tenants.length - activeCount} archived` });

  if (months.length) {
    const yearOf = s => serialToDate(s).getFullYear();
    const monthOf = s => serialToDate(s).getMonth();
    const best = months.reduce((a, m) => (m.total > a.total ? m : a));
    cards.push({ label: 'Record na buwan', value: formatCurrency(best.total), detail: `${shortMonthYear(best.serial)} · ${best.tenantCount} tenants` });

    // YTD: Jan hanggang sa pinakabagong buwan, kumpara sa parehong panahon noong nakaraang taon
    const year = yearOf(latest.serial), upTo = monthOf(latest.serial);
    const ytd = y => months.filter(m => yearOf(m.serial) === y && monthOf(m.serial) <= upTo).reduce((s, m) => s + m.total, 0);
    const cur = ytd(year), prev = ytd(year - 1);
    const span = `${shortMonth(months.find(m => yearOf(m.serial) === year).serial)}–${shortMonth(latest.serial)}`;
    const pct = prev ? (cur - prev) / prev * 100 : null;
    cards.push({ label: `Ngayong taon (${year})`, value: formatCurrency(cur),
      detail: pct == null ? `${span} · walang data noong ${year - 1}` : `${span} · ${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct).toFixed(1)}% kumpara sa ${year - 1}` });

    const avgMonths = list => list.reduce((s, t) => s + t.months, 0) / list.length;
    const done = tenants.filter(t => t.archived && t.months > 0), withBills = tenants.filter(t => t.months > 0);
    if (withBills.length) {
      cards.push({ label: 'Average na tagal ng tenant', value: `${num(done.length ? avgMonths(done) : avgMonths(withBills), 1)} buwan`,
        detail: done.length ? `${done.length} umalis na · ${num(avgMonths(withBills), 1)} kasama ang active` : 'kasama ang active (wala pang umalis)' });
    }

    const kwh = months.reduce((s, m) => s + m.kwh, 0), m3 = months.reduce((s, m) => s + m.m3, 0);
    cards.push({ label: 'Kabuuang konsumo', value: `${num(kwh)} kWh`, detail: `${num(m3, 1)} m³ · ${months.length} buwan` });

    // Bakanteng buwan ng lahat ng kwarto, at ang tantyang nawalang kita (kapareho ng graph sa Dashboard)
    const lost = [...lostRentByMonth(months).values()];
    const vacantCount = lost.reduce((s, l) => s + l.items.length, 0);
    cards.push({ label: 'Bakanteng buwan', value: `${vacantCount} buwan`,
      detail: `Tantyang nawalang kita: ${formatCurrency(lost.reduce((s, l) => s + l.sum, 0))}` });

    const longest = tenants.filter(t => !t.archived && t.months > 0).sort((a, b) => b.months - a.months)[0];
    if (longest) {
      cards.push({ label: 'Pinakamatagal na active', value: longest.name,
        detail: `${longest.months} buwan${longest.room ? ' · Room ' + longest.room : ''} · mula ${shortMonthYear(longest.firstSerial)}` });
    }

    // Paglago: average ng huling 12 buwan kumpara sa unang 12 buwan (kapag may ≥24 buwan)
    if (months.length >= 24) {
      const avg = list => list.reduce((s, m) => s + m.total, 0) / list.length;
      const first = avg(months.slice(0, 12)), last = avg(months.slice(-12));
      const g = (last - first) / first * 100;
      cards.push({ label: 'Paglago', value: `${g >= 0 ? '▲' : '▼'} ${Math.abs(g).toFixed(1)}%`,
        detail: `${compactPeso(first)} → ${compactPeso(last)} bawat buwan (unang vs huling 12 buwan)` });
    }

    const moveIn = tenants.filter(t => yearOf(t.firstSerial) === year).length;
    const moveOut = tenants.filter(t => t.archived && t.lastSerial != null && yearOf(t.lastSerial) === year).length;
    cards.push({ label: `Lipatan (${year})`, value: `${moveIn} pumasok`, detail: `${moveOut} umalis` });
  }

  const grid = document.getElementById('hlCards');
  grid.innerHTML = '';
  cards.forEach(c => {
    const card = document.createElement('div');
    card.className = 'hl-card';
    ['hl-label', 'hl-value', 'hl-detail'].forEach((cls, k) => {
      const el = document.createElement('span');
      el.className = cls;
      el.innerText = [c.label, c.value, c.detail][k];
      if (cls === 'hl-detail') el.title = c.detail; // buong text kapag naputol
      card.appendChild(el);
    });
    grid.appendChild(card);
  });

  // ---- Top 5, nakagrupo sa mga seksyon (highlightRankLists) ----
  const withBars = hlBars;
  const rankBox = document.getElementById('hlRanks');
  rankBox.innerHTML = '';
  highlightRankLists(stats, months).forEach(group => {
    const cards = group.lists.filter(l => l.rows.length);
    if (!cards.length) return;
    const heading = document.createElement('h2');
    heading.className = 'section-title';
    heading.innerText = group.section;
    const grid = document.createElement('div');
    grid.className = 'hl-rank-grid';
    // Kulay ng seksyon (CSS --sec): ginagamit ng guhit sa title, #1, at mga bar
    const sec = HL_SECTION_COLORS[group.section] || CHART.accent;
    heading.style.setProperty('--sec', sec);
    grid.style.setProperty('--sec', sec);
    cards.forEach(l => grid.appendChild(rankCard(l)));
    rankBox.append(heading, grid);
  });

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
    { title: 'Pinakamalaking konsumo ng kuryente', note: 'Isang tenant sa isang buwan (kWh)', color: CHART.elec,
      rows: recordRows(x => numOrNull(x.kwh), v => `${num(v)} kWh`) },
    { title: 'Pinakamalaking konsumo ng tubig', note: 'Isang tenant sa isang buwan (m³)', color: CHART.water,
      rows: recordRows(x => numOrNull(x.m3), v => `${num(v, 1)} m³`) },
    { title: 'Pinakamalaking bill (walang renta)', note: 'Kuryente + tubig + internet + others ng isang tenant sa isang buwan', color: CHART.violet,
      rows: recordRows(x => x.bills, v => formatCurrency(v)) }
  ];
  const top10Grid = document.getElementById('hlTop10');
  top10Grid.innerHTML = '';
  top10.filter(r => r.rows.length).forEach(r => top10Grid.appendChild(rankCard(r)));

  renderTenantTable(stats, latest);
}

// Isang Top 5 card: pamagat, maikling paliwanag, at listahang may ranggo, value at maliit na bar
function rankCard({ title, note, rows, all, color }) {
  const card = document.createElement('div');
  card.className = 'hl-rank';
  if (color) card.style.setProperty('--sec', color); // kung wala, kulay ng seksyon (--sec ng grid)
  const head = document.createElement('div');
  head.className = 'hl-rank-head';
  const h = document.createElement('h3');
  h.innerText = all ? title : `Top ${rows.length}: ${title}`;
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
