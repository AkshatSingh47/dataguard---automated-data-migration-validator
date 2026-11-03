import React from 'react';

const STEPS = [
  { id: 1, label: 'Data' },
  { id: 2, label: 'Mapping' },
  { id: 3, label: 'Validate' },
  { id: 4, label: 'Results' },
];

export const CustomDataStepper: React.FC<{ step: number }> = ({ step }) => {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {STEPS.map((item, idx) => (
        <React.Fragment key={item.id}>
          <div className="flex items-center gap-2">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold border ${
                step === item.id
                  ? 'bg-indigo-600 border-indigo-500 text-white'
                  : step > item.id
                  ? 'bg-emerald-950 border-emerald-800 text-emerald-400'
                  : 'bg-slate-900 border-slate-700 text-slate-500'
              }`}
            >
              {item.id}
            </span>
            <span className={step === item.id ? 'text-slate-100 font-semibold' : 'text-slate-500'}>
              {item.label}
            </span>
          </div>
          {idx < STEPS.length - 1 && <span className="text-slate-700 px-1">→</span>}
        </React.Fragment>
      ))}
    </div>
  );
};
