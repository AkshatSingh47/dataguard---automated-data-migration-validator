import React from 'react';
import { HealthScoreBreakdown } from '../types';
import { ShieldCheck, AlertCircle, XOctagon, Info } from 'lucide-react';

interface HealthScoreProps {
  health: HealthScoreBreakdown;
  compact?: boolean;
}

export const HealthScore: React.FC<HealthScoreProps> = ({ health, compact = false }) => {
  const getRatingBadge = (rating: HealthScoreBreakdown['rating']) => {
    switch (rating) {
      case 'HEALTHY':
        return {
          bg: 'bg-emerald-950 text-emerald-400 border border-emerald-900',
          icon: ShieldCheck,
          label: 'HEALTHY',
          barColor: 'bg-emerald-500',
          textColor: 'text-emerald-400',
        };
      case 'NEEDS REVIEW':
        return {
          bg: 'bg-amber-950 text-amber-400 border border-amber-900',
          icon: AlertCircle,
          label: 'NEEDS REVIEW',
          barColor: 'bg-amber-500',
          textColor: 'text-amber-400',
        };
      case 'CRITICAL':
      default:
        return {
          bg: 'bg-rose-950 text-rose-400 border border-rose-900',
          icon: XOctagon,
          label: 'CRITICAL',
          barColor: 'bg-rose-500',
          textColor: 'text-rose-400',
        };
    }
  };

  const badge = getRatingBadge(health.rating);
  const Icon = badge.icon;

  if (compact) {
    return (
      <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 shadow-md">
        <div>
          <span className="text-[11px] text-slate-400 block uppercase font-semibold tracking-wider">
            Health Score
          </span>
          <span className={`text-xl font-bold ${badge.textColor}`}>{health.overallScore}%</span>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-md border ${badge.bg} flex items-center gap-1`}>
          <Icon className="w-3.5 h-3.5" />
          {badge.label}
        </span>
      </div>
    );
  }

  const dimensions = [
    { label: 'Schema Integrity', score: health.schemaIntegrity, weight: '20%' },
    { label: 'Data Completeness', score: health.dataCompleteness, weight: '25%' },
    { label: 'Record Accuracy', score: health.recordAccuracy, weight: '25%' },
    { label: 'Relationship Integrity', score: health.relationshipIntegrity, weight: '15%' },
    { label: 'Aggregate Consistency', score: health.aggregateConsistency, weight: '15%' },
  ];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-100 uppercase tracking-wider">Migration Health</h3>
          <p className="text-xs text-slate-400 mt-0.5">Deterministic composite validation metric</p>
        </div>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-md border ${badge.bg} flex items-center gap-1.5`}>
          <Icon className="w-4 h-4" />
          {badge.label}
        </span>
      </div>

      {/* Main Score Display */}
      <div className="flex items-baseline gap-2 mb-5">
        <span className={`text-4xl font-extrabold tracking-tight ${badge.textColor}`}>
          {health.overallScore.toFixed(1)}%
        </span>
        <span className="text-xs text-slate-500">out of 100%</span>
      </div>

      {/* Dimension Progress Bars */}
      <div className="space-y-3 pt-2 border-t border-slate-800">
        {dimensions.map((dim) => {
          const dimColor =
            dim.score >= 90 ? 'bg-emerald-500' : dim.score >= 75 ? 'bg-amber-500' : 'bg-rose-500';
          return (
            <div key={dim.label} className="text-xs">
              <div className="flex justify-between items-center mb-1 text-slate-300">
                <span className="font-medium text-slate-200">
                  {dim.label} <span className="text-[10px] text-slate-500 font-normal">({dim.weight})</span>
                </span>
                <span className="font-mono font-semibold text-slate-200">{dim.score.toFixed(0)}%</span>
              </div>
              <div className="w-full bg-slate-950 border border-slate-800/80 h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${dimColor}`}
                  style={{ width: `${Math.max(4, Math.min(100, dim.score))}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Transparent formula note */}
      <div className="mt-5 p-3 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2">
        <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          {health.formulaDescription ||
            'Calculated deterministically using weighted validation categories without AI heuristics.'}
        </p>
      </div>
    </div>
  );
};
