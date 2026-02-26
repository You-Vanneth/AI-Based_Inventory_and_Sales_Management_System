import React from "react";
export default function DataTable({ columns, rows, emptyText = "No data" }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>{columns.map((c) => <th key={c}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j}>{v ?? "-"}</td>)}</tr>)
          ) : (
            <tr><td colSpan={columns.length} className="empty-state-cell">{emptyText}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
