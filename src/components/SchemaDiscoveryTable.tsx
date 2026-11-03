import React from 'react';
import { DiscoveredTable } from '../types';
import { Check, X, Key, Columns, AlertTriangle } from 'lucide-react';

interface SchemaDiscoveryTableProps {
  tables: DiscoveredTable[];
  isLoading?: boolean;
}

export const SchemaDiscoveryTable: React.FC<SchemaDiscoveryTableProps> = ({ tables, isLoading }) => {
  if (isLoading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center shadow-xl">
        <p className="text-sm text-slate-400 animate-pulse">Inspecting and discovering schemas from both databases...</p>
      </div>
    );
  }

  if (!tables || tables.length === 0) {
    return null;
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
        <div>
          <h3 className="text-base font-semibold text-slate-100">Discovered Schema Parity</h3>
          <p className="text-xs text-slate-400">Auto-detected tables, keys, and column structures</p>
        </div>
        <span className="text-xs font-medium px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
          {tables.length} {tables.length === 1 ? 'Table' : 'Tables'} Discovered
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
            <tr>
              <th className="py-2.5 px-3">Table Name</th>
              <th className="py-2.5 px-3 text-center">Source</th>
              <th className="py-2.5 px-3 text-center">Target</th>
              <th className="py-2.5 px-3">Primary Key</th>
              <th className="py-2.5 px-3 text-center">Columns</th>
              <th className="py-2.5 px-3 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {tables.map((table) => {
              const isMatch = table.inSource && table.inTarget;
              return (
                <tr key={table.name} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-2.5 px-3 font-mono font-medium text-slate-100 flex items-center gap-1.5">
                    {table.name}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    {table.inSource ? (
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-900">
                        <Check className="w-3.5 h-3.5" />
                      </span>
                    ) : (
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-rose-950 text-rose-400 border border-rose-900">
                        <X className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    {table.inTarget ? (
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-900">
                        <Check className="w-3.5 h-3.5" />
                      </span>
                    ) : (
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-rose-950 text-rose-400 border border-rose-900">
                        <X className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-slate-300 font-mono text-[11px]">
                    {table.primaryKey ? (
                      <span className="inline-flex items-center gap-1 text-slate-200">
                        <Key className="w-3 h-3 text-slate-500" />
                        {table.primaryKey}
                      </span>
                    ) : (
                      <span className="text-amber-400 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> None
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono text-[11px] text-slate-400">
                    {table.sourceColumnsCount !== undefined ? table.sourceColumnsCount : '-'}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    {isMatch ? (
                      <span className="inline-block px-2 py-0.5 text-[10px] font-semibold tracking-wider rounded bg-emerald-950 text-emerald-400 border border-emerald-900">
                        MATCH
                      </span>
                    ) : table.inSource ? (
                      <span className="inline-block px-2 py-0.5 text-[10px] font-semibold tracking-wider rounded bg-rose-950 text-rose-400 border border-rose-900">
                        MISSING IN TARGET
                      </span>
                    ) : (
                      <span className="inline-block px-2 py-0.5 text-[10px] font-semibold tracking-wider rounded bg-amber-950 text-amber-400 border border-amber-900">
                        EXTRA IN TARGET
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
