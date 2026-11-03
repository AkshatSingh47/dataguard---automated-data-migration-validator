import React from 'react';
import { ValidationCheckSelection } from '../types';
import { CheckSquare, Square, SlidersHorizontal } from 'lucide-react';

interface ValidationSelectorProps {
  options: ValidationCheckSelection;
  onChange: (options: ValidationCheckSelection) => void;
}

const CHECK_DEFINITIONS: { key: keyof ValidationCheckSelection; label: string; description: string }[] = [
  {
    key: 'schemaValidation',
    label: 'Schema Validation',
    description: 'Check table presence, column names, data types, precision, and constraints parity.',
  },
  {
    key: 'rowCountValidation',
    label: 'Row Count Validation',
    description: 'Compare total record counts between matching tables across databases.',
  },
  {
    key: 'recordValidation',
    label: 'Record Validation',
    description: 'Match rows by primary key to discover missing records, extra records, and column value discrepancies.',
  },
  {
    key: 'duplicateDetection',
    label: 'Duplicate Detection',
    description: 'Verify primary key uniqueness and detect duplicate records introduced during migration.',
  },
  {
    key: 'nullValidation',
    label: 'NULL Validation',
    description: 'Identify unintended NULL conversions or non-null values populated in target.',
  },
  {
    key: 'referentialIntegrity',
    label: 'Referential Integrity',
    description: 'Verify foreign-key relationships and flag orphan child records referencing missing parents.',
  },
  {
    key: 'aggregateValidation',
    label: 'Aggregate Validation',
    description: 'Compute and compare SUM, MIN, MAX, and DISTINCT counts on numeric fields with tolerance.',
  },
];

export const ValidationSelector: React.FC<ValidationSelectorProps> = ({ options, onChange }) => {
  const toggleCheck = (key: keyof ValidationCheckSelection) => {
    onChange({
      ...options,
      [key]: !options[key],
    });
  };

  const selectAll = () => {
    onChange({
      schemaValidation: true,
      rowCountValidation: true,
      recordValidation: true,
      duplicateDetection: true,
      nullValidation: true,
      referentialIntegrity: true,
      aggregateValidation: true,
    });
  };

  const selectFast = () => {
    onChange({
      schemaValidation: true,
      rowCountValidation: true,
      recordValidation: false,
      duplicateDetection: false,
      nullValidation: false,
      referentialIntegrity: false,
      aggregateValidation: true,
    });
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-indigo-400" />
          <h3 className="text-base font-semibold text-slate-100">Validation Checks</h3>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={selectAll}
            className="text-slate-400 hover:text-slate-200 font-medium px-2 py-1 rounded hover:bg-slate-800 transition-colors"
          >
            Select All
          </button>
          <span className="text-slate-700">|</span>
          <button
            type="button"
            onClick={selectFast}
            className="text-slate-400 hover:text-slate-200 font-medium px-2 py-1 rounded hover:bg-slate-800 transition-colors"
          >
            Fast Overview
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {CHECK_DEFINITIONS.map(({ key, label, description }) => {
          const isChecked = options[key];
          return (
            <div
              key={key}
              onClick={() => toggleCheck(key)}
              className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
                isChecked
                  ? 'bg-slate-950 border-slate-700 shadow-sm'
                  : 'bg-slate-900/50 border-slate-800 hover:bg-slate-800/30'
              }`}
            >
              <div className="mt-0.5">
                {isChecked ? (
                  <CheckSquare className="w-4 h-4 text-indigo-400" />
                ) : (
                  <Square className="w-4 h-4 text-slate-600" />
                )}
              </div>
              <div className="flex-1">
                <span className="text-xs font-semibold text-slate-200 block">{label}</span>
                <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
