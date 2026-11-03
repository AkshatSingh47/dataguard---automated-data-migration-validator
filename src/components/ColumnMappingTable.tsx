import React from 'react';
import { ColumnMapping } from '../types';
import { ArrowRight } from 'lucide-react';

interface ColumnMappingTableProps {
  sourceHeaders: string[];
  targetHeaders: string[];
  mappings: ColumnMapping[];
  onChange: (mappings: ColumnMapping[]) => void;
  errors?: string[];
}

export const ColumnMappingTable: React.FC<ColumnMappingTableProps> = ({
  sourceHeaders,
  targetHeaders,
  mappings,
  onChange,
  errors,
}) => {
  const usedTargets = mappings.map((m) => m.targetColumn).filter(Boolean);

  const updateMapping = (sourceColumn: string, targetColumn: string) => {
    const next = sourceHeaders.map((header) => {
      const existing = mappings.find((m) => m.sourceColumn === header);
      if (header === sourceColumn) return { sourceColumn: header, targetColumn };
      return existing || { sourceColumn: header, targetColumn: '' };
    });
    onChange(next);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-100">Column Mapping</h3>
        <p className="text-xs text-slate-400 mt-0.5">
          Map each source column to the matching target column. Suggestions are filled in automatically — correct them if needed.
        </p>
      </div>

      <div className="overflow-x-auto border border-slate-800 rounded-xl">
        <table className="w-full text-xs text-slate-300">
          <thead className="bg-slate-950 text-slate-500 uppercase tracking-wider text-[10px]">
            <tr>
              <th className="px-3 py-2.5 text-left">Source Column</th>
              <th className="px-3 py-2.5 text-center w-16" />
              <th className="px-3 py-2.5 text-left">Target Column</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {sourceHeaders.map((header) => {
              const current = mappings.find((m) => m.sourceColumn === header)?.targetColumn || '';
              return (
                <tr key={header}>
                  <td className="px-3 py-2 font-mono text-slate-100">{header}</td>
                  <td className="px-3 py-2 text-center text-slate-600">
                    <ArrowRight className="w-3.5 h-3.5 inline" />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={current}
                      onChange={(e) => updateMapping(header, e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 font-mono"
                    >
                      <option value="">Select target column…</option>
                      {targetHeaders.map((target) => (
                        <option key={target} value={target} disabled={usedTargets.includes(target) && target !== current}>
                          {target}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {errors && errors.length > 0 && (
        <div className="space-y-1">
          {errors.map((err) => (
            <p key={err} className="text-xs text-rose-400">
              {err}
            </p>
          ))}
        </div>
      )}
    </div>
  );
};
