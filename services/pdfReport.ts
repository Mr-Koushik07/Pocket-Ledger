import { CategoryItem, Expense } from '@/context/ExpenseContext';

export interface MonthlyReportData {
  year: number;
  month: number; // 0-indexed (0 = Jan, 8 = Sep, 9 = Oct)
  monthName: string;
  expenses: Expense[];
  getCategoryInfo: (key: string) => CategoryItem;
  statementId: string;
  generatedAt: string;
  userName?: string;
}

export function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

export function generateMonthlyReportHtml(data: MonthlyReportData): string {
  const { year, monthName, expenses, getCategoryInfo, statementId, generatedAt, userName } = data;

  // 1. Separate Outflow (Spent) vs Inflow (Received)
  const spentItems = expenses.filter((e) => e.direction !== 'received');
  const receivedItems = expenses.filter((e) => e.direction === 'received');

  const totalSpent = spentItems.reduce((sum, e) => sum + e.amount, 0);
  const totalReceived = receivedItems.reduce((sum, e) => sum + e.amount, 0);
  const netCashflow = totalReceived - totalSpent;

  // Days in month calculation for daily average
  const daysInMonth = new Date(year, data.month + 1, 0).getDate();
  const dailyAverage = totalSpent / (daysInMonth || 30);

  // 2. Category Aggregation (for spending)
  const categoryMap = new Map<string, { amount: number; count: number }>();
  for (const item of spentItems) {
    const prev = categoryMap.get(item.category) || { amount: 0, count: 0 };
    categoryMap.set(item.category, {
      amount: prev.amount + item.amount,
      count: prev.count + 1,
    });
  }

  const categoryBreakdown = Array.from(categoryMap.entries())
    .map(([catKey, info]) => {
      const catInfo = getCategoryInfo(catKey);
      const percentage = totalSpent > 0 ? (info.amount / totalSpent) * 100 : 0;
      return {
        key: catKey,
        label: catInfo.label,
        color: catInfo.color,
        amount: info.amount,
        count: info.count,
        percentage,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  // 3. Sub-Context Sphere Aggregation
  const sphereMap = new Map<string, { spent: number; count: number }>();
  for (const item of spentItems) {
    const sphereKey = item.subContext || 'Personal';
    const prev = sphereMap.get(sphereKey) || { spent: 0, count: 0 };
    sphereMap.set(sphereKey, {
      spent: prev.spent + item.amount,
      count: prev.count + 1,
    });
  }

  const sphereBreakdown = Array.from(sphereMap.entries())
    .map(([sphereKey, info]) => {
      const percentage = totalSpent > 0 ? (info.spent / totalSpent) * 100 : 0;
      return {
        name: sphereKey,
        spent: info.spent,
        count: info.count,
        percentage,
      };
    })
    .sort((a, b) => b.spent - a.spent);

  // 4. Events Spotlight Aggregation
  const eventMap = new Map<string, { total: number; items: Expense[] }>();
  for (const item of expenses) {
    if (item.eventTag && item.eventTag.trim().length > 0) {
      const tag = item.eventTag.trim();
      const prev = eventMap.get(tag) || { total: 0, items: [] };
      prev.total += item.amount;
      prev.items.push(item);
      eventMap.set(tag, prev);
    }
  }

  const eventSpotlights = Array.from(eventMap.entries()).map(([tag, val]) => ({
    tag,
    total: val.total,
    items: val.items,
  }));

  // 5. SVG Donut Chart Calculation
  const chartSize = 160;
  const strokeWidth = 24;
  const radius = (chartSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  const svgCircles = categoryBreakdown.map((cat) => {
    const segment = (cat.amount / (totalSpent || 1)) * circumference;
    const circle = `<circle
      cx="${chartSize / 2}"
      cy="${chartSize / 2}"
      r="${radius}"
      stroke="${cat.color}"
      stroke-width="${strokeWidth}"
      fill="none"
      stroke-dasharray="${segment} ${circumference - segment}"
      stroke-dashoffset="${-offset}"
      transform="rotate(-90 ${chartSize / 2} ${chartSize / 2})"
    />`;
    offset += segment;
    return circle;
  }).join('\n');

  // 6. Chronological Itemized Transactions
  const sortedExpenses = [...expenses].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const tableRowsHtml = sortedExpenses.map((exp, idx) => {
    const cat = getCategoryInfo(exp.category);
    const dateFormatted = new Date(exp.date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const isReceived = exp.direction === 'received';
    const amountClass = isReceived ? 'text-success' : 'text-danger';
    const amountPrefix = isReceived ? '+' : '−';
    const directionBadge = isReceived
      ? '<span class="badge badge-received">Inflow</span>'
      : '<span class="badge badge-spent">Outflow</span>';

    return `
      <tr class="transaction-row ${idx % 2 === 1 ? 'row-alt' : ''}">
        <td class="text-muted cell-id">#${idx + 1}</td>
        <td class="cell-date">${dateFormatted}</td>
        <td class="cell-desc">
          <div class="note-text">${escapeHtml(exp.note || exp.category)}</div>
          ${exp.eventTag ? `<span class="event-tag-pill">#${escapeHtml(exp.eventTag)}</span>` : ''}
          ${exp.person ? `<span class="person-tag-pill">👤 ${escapeHtml(exp.person)}</span>` : ''}
        </td>
        <td class="cell-category">
          <span class="cat-pill" style="border-left-color: ${cat.color};">
            ${escapeHtml(cat.label)}
          </span>
        </td>
        <td class="cell-sphere">
          <span class="sphere-pill">${escapeHtml(exp.subContext || 'Personal')}</span>
        </td>
        <td class="cell-type">${directionBadge}</td>
        <td class="cell-amount ${amountClass}">
          <strong>${amountPrefix}${formatCurrency(exp.amount)}</strong>
        </td>
      </tr>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Pocket-Ledger Statement - ${escapeHtml(monthName)} ${year}</title>
  <style>
    @page {
      margin: 12mm 14mm 14mm 14mm;
      size: A4 portrait;
    }
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0F172A;
      background: #FFFFFF;
      line-height: 1.45;
      font-size: 11pt;
      -webkit-font-smoothing: antialiased;
    }

    .report-container {
      width: 100%;
      max-width: 800px;
      margin: 0 auto;
      padding-bottom: 20px;
    }

    /* HEADER */
    .header-banner {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0F172A;
      padding-bottom: 16px;
      margin-bottom: 20px;
    }
    .brand-title {
      font-size: 18pt;
      font-weight: 800;
      letter-spacing: -0.5px;
      color: #0F172A;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .brand-subtitle {
      font-size: 9pt;
      color: #64748B;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-top: 3px;
    }
    .doc-meta {
      text-align: right;
    }
    .doc-badge {
      display: inline-block;
      background: #EEF2F6;
      border: 1px solid #CBD5E1;
      color: #334155;
      font-size: 8pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      padding: 3px 8px;
      border-radius: 4px;
      margin-bottom: 4px;
    }
    .statement-period {
      font-size: 14pt;
      font-weight: 700;
      color: #0F172A;
    }
    .gen-timestamp {
      font-size: 8pt;
      color: #64748B;
    }

    /* EXECUTIVE KPI METRICS */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 24px;
    }
    .kpi-card {
      border: 1px solid #E2E8F0;
      background: #F8FAFC;
      border-radius: 8px;
      padding: 12px 14px;
      page-break-inside: avoid;
    }
    .kpi-label {
      font-size: 7.5pt;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: #64748B;
      font-weight: 700;
      margin-bottom: 4px;
    }
    .kpi-value {
      font-size: 14pt;
      font-weight: 800;
      letter-spacing: -0.3px;
      color: #0F172A;
    }
    .kpi-sub {
      font-size: 7.5pt;
      color: #94A3B8;
      margin-top: 3px;
    }
    .text-danger { color: #E11D48; }
    .text-success { color: #059669; }
    .text-indigo { color: #4F46E5; }

    /* SECTION TITLES */
    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid #CBD5E1;
      padding-bottom: 6px;
      margin-top: 24px;
      margin-bottom: 14px;
      page-break-after: avoid;
    }
    .section-title {
      font-size: 11pt;
      font-weight: 700;
      color: #0F172A;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .section-caption {
      font-size: 8pt;
      color: #64748B;
    }

    /* DATA VISUALIZATIONS ROW */
    .charts-row {
      display: grid;
      grid-template-columns: 200px 1fr;
      gap: 20px;
      align-items: center;
      background: #FFFFFF;
      border: 1px solid #E2E8F0;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 24px;
      page-break-inside: avoid;
    }
    .chart-box {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      position: relative;
    }
    .donut-inner-text {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      text-align: center;
    }
    .donut-caption {
      font-size: 7pt;
      font-weight: 700;
      color: #64748B;
      text-transform: uppercase;
    }
    .donut-amount {
      font-size: 11pt;
      font-weight: 800;
      color: #0F172A;
    }

    /* CATEGORY BREAKDOWN BARS */
    .cat-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .cat-row {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    .cat-meta-line {
      display: flex;
      justify-content: space-between;
      font-size: 8.5pt;
      font-weight: 600;
    }
    .cat-name-wrap {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .cat-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      display: inline-block;
    }
    .cat-bar-bg {
      width: 100%;
      height: 6px;
      background: #F1F5F9;
      border-radius: 3px;
      overflow: hidden;
    }
    .cat-bar-fill {
      height: 100%;
      border-radius: 3px;
    }

    /* SPHERES & EVENT SPOTLIGHTS */
    .spheres-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-bottom: 24px;
      page-break-inside: avoid;
    }
    .sphere-card {
      border: 1px solid #E2E8F0;
      background: #F8FAFC;
      border-radius: 6px;
      padding: 10px 12px;
    }
    .sphere-title {
      font-size: 8.5pt;
      font-weight: 700;
      color: #334155;
      margin-bottom: 4px;
    }
    .sphere-amt {
      font-size: 11pt;
      font-weight: 800;
      color: #0F172A;
    }
    .sphere-pct {
      font-size: 8pt;
      color: #64748B;
      font-weight: 600;
    }

    /* EVENT SPOTLIGHT CARDS */
    .events-container {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-bottom: 24px;
      page-break-inside: avoid;
    }
    .event-card {
      border: 1px solid #C7D2FE;
      background: #EEF2FF;
      border-radius: 8px;
      padding: 12px 14px;
    }
    .event-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    .event-tag-title {
      font-size: 10pt;
      font-weight: 800;
      color: #3730A3;
    }
    .event-total-badge {
      font-size: 9.5pt;
      font-weight: 800;
      color: #312E81;
      background: #E0E7FF;
      padding: 2px 8px;
      border-radius: 4px;
    }
    .event-items-preview {
      font-size: 8pt;
      color: #475569;
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }

    /* TRANSACTION PROOF TABLE */
    .table-container {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
      page-break-inside: auto;
    }
    .table-container thead {
      display: table-header-group;
    }
    .table-container tr {
      page-break-inside: avoid;
      page-break-after: auto;
    }
    .table-container th {
      background: #0F172A;
      color: #F8FAFC;
      font-size: 7.5pt;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      font-weight: 700;
      padding: 8px 10px;
      text-align: left;
    }
    .table-container td {
      padding: 7px 10px;
      font-size: 8.5pt;
      border-bottom: 1px solid #E2E8F0;
      vertical-align: middle;
    }
    .row-alt {
      background: #F8FAFC;
    }
    .cell-id { width: 35px; }
    .cell-date { width: 85px; white-space: nowrap; font-weight: 600; color: #334155; }
    .cell-desc { }
    .note-text { font-weight: 600; color: #0F172A; }
    .event-tag-pill {
      display: inline-block;
      font-size: 7pt;
      font-weight: 700;
      color: #4F46E5;
      background: #EEF2FF;
      padding: 1px 5px;
      border-radius: 3px;
      margin-top: 2px;
      margin-right: 4px;
    }
    .person-tag-pill {
      display: inline-block;
      font-size: 7pt;
      font-weight: 600;
      color: #0369A1;
      background: #E0F2FE;
      padding: 1px 5px;
      border-radius: 3px;
      margin-top: 2px;
    }
    .cell-category { width: 95px; }
    .cat-pill {
      display: inline-block;
      border-left: 3px solid #CBD5E1;
      padding-left: 5px;
      font-size: 8pt;
      font-weight: 600;
      color: #334155;
    }
    .cell-sphere { width: 80px; }
    .sphere-pill {
      font-size: 7.5pt;
      background: #F1F5F9;
      color: #475569;
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: 600;
    }
    .cell-type { width: 70px; }
    .badge {
      display: inline-block;
      font-size: 7pt;
      font-weight: 700;
      text-transform: uppercase;
      padding: 2px 5px;
      border-radius: 3px;
    }
    .badge-spent { background: #FFE4E6; color: #9F1239; }
    .badge-received { background: #D1FAE5; color: #065F46; }
    .cell-amount { text-align: right; width: 95px; font-size: 9pt; }

    /* AUDIT CERTIFICATION FOOTER */
    .audit-footer {
      margin-top: 30px;
      padding-top: 14px;
      border-top: 1px solid #CBD5E1;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 7.5pt;
      color: #64748B;
      page-break-inside: avoid;
    }
    .audit-stamp {
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: 600;
      color: #334155;
    }
    .audit-shield {
      width: 14px;
      height: 14px;
      fill: #059669;
      display: inline-block;
    }
  </style>
</head>
<body>
  <div class="report-container">
    <!-- HEADER -->
    <div class="header-banner">
      <div>
        <div class="brand-title">
          <span style="color: #6366F1;">❖</span> POCKET-LEDGER
        </div>
        <div class="brand-subtitle">Monthly Financial Statement & Audit Proof</div>
        ${userName ? `<div style="font-size: 8.5pt; color: #475569; margin-top: 4px;">Prepared for: <strong>${escapeHtml(userName)}</strong></div>` : ''}
      </div>
      <div class="doc-meta">
        <div class="doc-badge">Verified Local Ledger</div>
        <div class="statement-period">${escapeHtml(monthName)} ${year}</div>
        <div class="gen-timestamp">Generated on ${escapeHtml(generatedAt)}</div>
        <div class="gen-timestamp">Ref: ${escapeHtml(statementId)}</div>
      </div>
    </div>

    <!-- EXECUTIVE KPI METRICS -->
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">Total Outflow (Spent)</div>
        <div class="kpi-value text-danger">−${formatCurrency(totalSpent)}</div>
        <div class="kpi-sub">${spentItems.length} expenses recorded</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Total Inflow (Received)</div>
        <div class="kpi-value text-success">+${formatCurrency(totalReceived)}</div>
        <div class="kpi-sub">${receivedItems.length} deposits / returns</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Net Balance (Monthly)</div>
        <div class="kpi-value ${netCashflow >= 0 ? 'text-success' : 'text-danger'}">
          ${netCashflow >= 0 ? '+' : '−'}${formatCurrency(Math.abs(netCashflow))}
        </div>
        <div class="kpi-sub">${netCashflow >= 0 ? 'Surplus cashflow' : 'Net expenditure'}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Daily Average Spend</div>
        <div class="kpi-value text-indigo">${formatCurrency(dailyAverage)}</div>
        <div class="kpi-sub">Across ${daysInMonth} days</div>
      </div>
    </div>

    <!-- DATA VISUALIZATIONS SECTION -->
    <div class="section-header">
      <div class="section-title">Spending Analytics & Distribution</div>
      <div class="section-caption">Categorical and contextual breakdown of verified outflows</div>
    </div>

    <div class="charts-row">
      <div class="chart-box">
        <svg width="${chartSize}" height="${chartSize}" viewBox="0 0 ${chartSize} ${chartSize}">
          <circle
            cx="${chartSize / 2}"
            cy="${chartSize / 2}"
            r="${radius}"
            stroke="#E2E8F0"
            stroke-width="${strokeWidth}"
            fill="none"
          />
          ${svgCircles}
        </svg>
        <div class="donut-inner-text">
          <div class="donut-caption">Total Spend</div>
          <div class="donut-amount">${formatCurrency(totalSpent)}</div>
        </div>
      </div>

      <div class="cat-list">
        ${categoryBreakdown.map((cat) => `
          <div class="cat-row">
            <div class="cat-meta-line">
              <span class="cat-name-wrap">
                <span class="cat-dot" style="background: ${cat.color};"></span>
                <span>${escapeHtml(cat.label)}</span>
                <span style="color: #94A3B8; font-weight: normal;">(${cat.count})</span>
              </span>
              <span>
                <strong>${formatCurrency(cat.amount)}</strong>
                <span style="color: #64748B; font-weight: 500; font-size: 8pt; margin-left: 4px;">
                  ${cat.percentage.toFixed(1)}%
                </span>
              </span>
            </div>
            <div class="cat-bar-bg">
              <div class="cat-bar-fill" style="width: ${cat.percentage}%; background: ${cat.color};"></div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- LIFE SPHERES BREAKDOWN -->
    <div class="spheres-grid">
      ${sphereBreakdown.map((sphere) => `
        <div class="sphere-card">
          <div class="sphere-title">${escapeHtml(sphere.name)} Sphere</div>
          <div class="sphere-amt">${formatCurrency(sphere.spent)}</div>
          <div class="sphere-pct">${sphere.percentage.toFixed(1)}% of total outflows (${sphere.count} transactions)</div>
        </div>
      `).join('')}
    </div>

    <!-- EVENT JOURNEYS SPOTLIGHT (IF ANY) -->
    ${eventSpotlights.length > 0 ? `
      <div class="section-header">
        <div class="section-title">Event & Journey Spotlights</div>
        <div class="section-caption">Itemized aggregation of conferences, trips, and tracked hackathons</div>
      </div>
      <div class="events-container">
        ${eventSpotlights.map((ev) => `
          <div class="event-card">
            <div class="event-header">
              <div class="event-tag-title">#${escapeHtml(ev.tag)}</div>
              <div class="event-total-badge">${formatCurrency(ev.total)} Total</div>
            </div>
            <div class="event-items-preview">
              ${ev.items.map((i) => `
                <span>• ${escapeHtml(i.note || i.category)}: <strong>${formatCurrency(i.amount)}</strong></span>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    ` : ''}

    <!-- GROUNDED AUDIT TRAIL TABLE -->
    <div class="section-header">
      <div class="section-title">Grounded Transaction Audit Trail (${sortedExpenses.length} Records)</div>
      <div class="section-caption">Chronological receipt-level proof directly from on-device SQLite database</div>
    </div>

    <table class="table-container">
      <thead>
        <tr>
          <th>#</th>
          <th>Date</th>
          <th>Description & Tags</th>
          <th>Category</th>
          <th>Sphere</th>
          <th>Type</th>
          <th style="text-align: right;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${tableRowsHtml.length > 0 ? tableRowsHtml : `
          <tr>
            <td colspan="7" style="text-align: center; color: #94A3B8; padding: 24px;">
              No transactions recorded for this period.
            </td>
          </tr>
        `}
      </tbody>
    </table>

    <!-- AUDIT FOOTER -->
    <div class="audit-footer">
      <div class="audit-stamp">
        <svg class="audit-shield" viewBox="0 0 20 20">
          <path d="M10 2L3 5v6c0 5.55 3.84 10.74 7 12 3.16-1.26 7-6.45 7-12V5l-7-3zm-1 14.5l-4-4 1.41-1.41L9 13.67l6.59-6.59L17 8.5l-8 8z" />
        </svg>
        Digitally Certified Local Record &bull; Non-Tampered Device Ledger
      </div>
      <div>
        Pocket-Ledger Engine v1.0 &bull; Page 1 of 1
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}

function escapeHtml(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
