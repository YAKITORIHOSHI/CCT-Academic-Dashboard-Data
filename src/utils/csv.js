// Quoting alone does not stop spreadsheet applications from interpreting a cell as a formula.
export function csvCell(value) {
  let content = String(value ?? '');
  if (typeof value === 'string' && /^\s*[=+@-]/.test(content)) content = "'" + content;
  return '"' + content.replace(/"/g, '""') + '"';
}
