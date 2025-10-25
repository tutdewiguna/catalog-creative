"use client";

import React from "react";

interface TableProps {
  headers: string[];
  data: (React.ReactNode | string | number)[][];
}

export default function Table({ headers, data }: TableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-accent/15 bg-white shadow-sm">
      <table className="min-w-full border-collapse">
        <thead>
          <tr className="bg-light text-muted">
            {headers.map((header, i) => (
              <th
                key={i}
                className="px-6 py-3 text-left text-sm font-semibold uppercase tracking-wide border-b border-accent/15"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={headers.length}
                className="text-center py-6 text-muted"
              >
                No data available.
              </td>
            </tr>
          ) : (
            data.map((row, i) => (
              <tr
                key={i}
                className={`${
                  i % 2 === 0 ? "bg-white" : "bg-light"
                } hover:bg-primary/10 transition-colors`}
              >
                {row.map((cell, j) => (
                  <td
                    key={j}
                    className="px-6 py-4 text-sm text-dark border-t border-accent/10"
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

