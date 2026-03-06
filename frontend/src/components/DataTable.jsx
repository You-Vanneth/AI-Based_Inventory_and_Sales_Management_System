import React from "react";
import { t } from "../lib/i18n";
export default function DataTable({ columns, rows, emptyText = "No data", wrapCells = false, className = "" }) {
  const labels = columns.map((column) => (typeof column === "string" ? column : String(column)));
  return (
    <div className={`table-wrap ${wrapCells ? "table-wrap-wrap" : ""} ${className}`.trim()}>
      <table className="data-table">
        <thead>
          <tr>{labels.map((label, index) => <th key={`${index}-${label}`}>{label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((r, i) => (
              <tr key={i}>
                {r.map((v, j) => (
                  <td key={j} data-label={labels[j] || ""}>
                    {v ?? "-"}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr><td colSpan={columns.length} className="empty-state-cell">{t(emptyText)}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
