export function serializeCsv(rows) {
  const escapeCell = (value) => {
    const text = String(value ?? '');
    const safeText = /^[\t\r ]*[=+\-@]/.test(text) ? `'${text}` : text;
    return `"${safeText.replaceAll('"', '""')}"`;
  };

  return `\uFEFF${rows.map((row) => row.map(escapeCell).join(',')).join('\r\n')}`;
}

export function downloadCsv(rows, filename) {
  const blob = new Blob([serializeCsv(rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}