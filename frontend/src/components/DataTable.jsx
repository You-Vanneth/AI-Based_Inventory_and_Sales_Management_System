import React from "react";
import { t } from "../lib/i18n";

export default function DataTable({ columns, rows, emptyText = "No data", wrapCells = false, className = "" }) {
  // Normalize all column values into displayable header labels.
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
                {/* Match each cell with its column label for layout and accessibility. */}
                {r.map((v, j) => (
                  <td key={j} data-label={labels[j] || ""}>
                    {v ?? "-"}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            // Show one full-width translated message when there is no row data.
            <tr><td colSpan={columns.length} className="empty-state-cell">{t(emptyText)}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
