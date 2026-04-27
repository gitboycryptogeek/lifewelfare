const BRAND_NAVY = '#1e3a5f';

export function printTable({ title, subtitle, headers, rows }) {
  const headerCells = headers.map((h) => `<th>${h}</th>`).join('');
  const tableRows = rows
    .map((r) => `<tr>${r.map((c) => `<td>${c ?? '—'}</td>`).join('')}</tr>`)
    .join('');

  const date = new Date().toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

  const html = `<!DOCTYPE html>
<html>
<head>
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; padding: 28px; color: #111; font-size: 13px; }
    .header { margin-bottom: 18px; border-bottom: 2px solid ${BRAND_NAVY}; padding-bottom: 10px; }
    h1 { color: ${BRAND_NAVY}; font-size: 17px; margin-bottom: 3px; }
    .sub { color: #555; font-size: 12px; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th { background: ${BRAND_NAVY}; color: #fff; padding: 8px 10px; text-align: left; font-size: 12px; }
    td { padding: 7px 10px; border-bottom: 1px solid #e5e7eb; }
    tr:nth-child(even) td { background: #f9fafb; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>My Life Companion Welfare — ${title}</h1>
    ${subtitle ? `<p class="sub">${subtitle}</p>` : ''}
    <p class="sub">Printed: ${date}</p>
  </div>
  <table>
    <thead><tr>${headerCells}</tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
  <script>window.onload = function() { window.print(); window.onafterprint = function() { window.close(); }; }</script>
</body>
</html>`;

  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
}
