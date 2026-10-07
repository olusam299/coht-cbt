/** Client-side export helpers: CSV download and a printable (Save as PDF) view. */

export type ExportColumn<T> = {
  header: string;
  value: (row: T) => string | number | null | undefined;
};

export type ExportResult = { url: string; filename?: string };

function csvCell(value: string | number | null | undefined) {
  const text = value == null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function buildCsv<T>(columns: ExportColumn<T>[], rows: T[]): string {
  const lines = [
    columns.map((c) => csvCell(c.header)).join(","),
    ...rows.map((row) => columns.map((c) => csvCell(c.value(row))).join(",")),
  ];
  // The BOM makes Excel read the file as UTF-8.
  return `\uFEFF${lines.join("\r\n")}`;
}

export function csvExport<T>(filename: string, columns: ExportColumn<T>[], rows: T[]): ExportResult {
  const blob = new Blob([buildCsv(columns, rows)], { type: "text/csv;charset=utf-8" });
  return { url: URL.createObjectURL(blob), filename };
}

const escapeHtml = (text: string) =>
  text.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch] ?? ch);

export function printableExport<T>(title: string, columns: ExportColumn<T>[], rows: T[]): ExportResult {
  const head = columns.map((c) => `<th>${escapeHtml(c.header)}</th>`).join("");
  const body = rows
    .map(
      (row) =>
        `<tr>${columns.map((c) => `<td>${escapeHtml(String(c.value(row) ?? ""))}</td>`).join("")}</tr>`,
    )
    .join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  body{font:12px/1.4 system-ui,sans-serif;margin:24px;color:#111}
  h1{font-size:18px;margin:0 0 4px}
  p{margin:0 0 14px;color:#555}
  table{border-collapse:collapse;width:100%}
  th,td{border:1px solid #bbb;padding:5px 7px;text-align:left}
  th{background:#eee}
  tr{page-break-inside:avoid}
  thead{display:table-header-group}
</style></head><body>
<h1>${escapeHtml(title)}</h1>
<p>${rows.length.toLocaleString()} record(s) · generated ${escapeHtml(new Date().toLocaleString())}</p>
<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
<script>window.addEventListener("load",function(){setTimeout(function(){window.print()},300)})</script>
</body></html>`;
  return { url: URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" })) };
}

/** Starts a download for CSV results, or opens the print view for PDF. */
export function deliverExport(result: ExportResult) {
  if (result.filename) {
    const link = document.createElement("a");
    link.href = result.url;
    link.download = result.filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(result.url), 10_000);
    return;
  }
  window.open(result.url, "_blank");
}

export const todayStamp = () => new Date().toISOString().slice(0, 10);
