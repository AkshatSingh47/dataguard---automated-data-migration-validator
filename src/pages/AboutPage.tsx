import React from 'react';
import {
  Database,
  ArrowDown,
  Layers,
  Search,
  CheckCircle2,
  FileSpreadsheet,
  AlertOctagon,
  Users,
  ShieldAlert,
} from 'lucide-react';

export const AboutPage: React.FC = () => {
  const steps = [
    {
      num: 'STEP 1',
      title: 'Connect Source Database',
      description: 'The original database containing the correct data.',
      icon: Database,
    },
    {
      num: 'STEP 2',
      title: 'Connect Target Database',
      description: 'The database where the data was migrated.',
      icon: Database,
    },
    {
      num: 'STEP 3',
      title: 'Analyze',
      description: 'DataGuard automatically inspects tables, columns, keys and records.',
      icon: Search,
    },
    {
      num: 'STEP 4',
      title: 'Compare',
      description: 'The system compares source and target data using multiple validation checks.',
      icon: Layers,
    },
    {
      num: 'STEP 5',
      title: 'Report',
      description: 'The system identifies mismatches and generates a migration health report.',
      icon: FileSpreadsheet,
    },
  ];

  const detectedProblems = [
    { label: 'Missing records', desc: 'Records present in source that failed to transfer to target.' },
    { label: 'Extra records', desc: 'Unexpected rows or phantom records found only in target.' },
    { label: 'Duplicate records', desc: 'Primary-key duplicates created by non-idempotent migration scripts.' },
    { label: 'Incorrect values', desc: 'Corrupted values, truncation, or transformation bugs across columns.' },
    { label: 'Schema differences', desc: 'Mismatched column names, incompatible data types, and missing constraints.' },
    { label: 'NULL differences', desc: 'Non-null source values unintentionally converted to NULL in target.' },
    { label: 'Broken relationships', desc: 'Orphan foreign keys referencing non-existent parent rows.' },
    { label: 'Aggregate differences', desc: 'Discrepancies in SUM, MIN, MAX, and DISTINCT calculations on key fields.' },
  ];

  const targetUsers = [
    { role: 'Data Engineers', desc: 'Verifying data pipeline correctness and transformation accuracy.' },
    { role: 'QA Engineers', desc: 'Conducting regression and integrity testing after database upgrades.' },
    { role: 'Database Administrators', desc: 'Ensuring referential constraints and parity before cutting over traffic.' },
    { role: 'Cloud Migration Teams', desc: 'Migrating legacy on-premise databases to cloud relational databases.' },
    { role: 'IT Teams', desc: 'Auditing compliance and data reliability during vendor or software migrations.' },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 sm:py-16 space-y-12 text-slate-100">
      {/* Title & Core Purpose */}
      <div className="border-b border-slate-800 pb-8">
        <h1 className="text-3xl font-extrabold text-slate-100 tracking-tight">How DataGuard Works</h1>
        <p className="text-base text-slate-300 font-medium mt-3 leading-relaxed">
          DataGuard does not migrate your data. It validates data after migration.
        </p>

        {/* Section 38 Conceptual Explanation */}
        <div className="mt-5 p-4 rounded-2xl bg-slate-900 border border-slate-800 text-sm text-slate-300 space-y-3 leading-relaxed shadow-xl">
          <p>
            <strong className="text-slate-100">DataGuard</strong> is a database migration validation platform.
          </p>
          <p>
            When organizations move data from an old database to a new database, the migration process may
            complete successfully while the migrated data still contains missing records, incorrect values,
            duplicates or structural differences.
          </p>
          <p>
            DataGuard connects to both the original and migrated databases, automatically compares them using
            multiple validation checks, identifies discrepancies and presents the results in an easy-to-understand
            report.
          </p>
          <p className="font-semibold text-slate-100">
            DataGuard does not perform the migration. It verifies whether the migration was successful and whether
            the target data can be trusted.
          </p>
          <p>
            DataGuard can validate data supplied as CSV files or data stored in supported databases (PostgreSQL and MySQL).
          </p>
        </div>
      </div>

      {/* Two workflows */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-2">
          <h3 className="text-sm font-bold text-slate-100">A. Demo Mode</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Uses sample migration data from an embedded banking dataset so you can see every check without connecting a database.
          </p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-2">
          <h3 className="text-sm font-bold text-slate-100">B. Custom Data Mode</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Users provide their own source and target data. DataGuard can validate data supplied as CSV files or data stored in supported databases.
          </p>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Custom data flow</h3>
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-200">
          {['YOUR SOURCE DATA', 'YOUR TARGET DATA', 'DATA GUARD', 'COMPARE', 'DETECT', 'REPORT'].map((label, idx, arr) => (
            <React.Fragment key={label}>
              <span className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800">{label}</span>
              {idx < arr.length - 1 && <ArrowDown className="w-3.5 h-3.5 text-slate-600 rotate-[-90deg]" />}
            </React.Fragment>
          ))}
        </div>
      </div>
      <div className="space-y-4">
        <h2 className="font-bold text-slate-400 uppercase tracking-wider text-xs">
          The 5-Step Validation Process
        </h2>

        <div className="space-y-3">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            return (
              <React.Fragment key={step.num}>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-start gap-4 shadow-xl">
                  <div className="w-10 h-10 rounded-lg bg-slate-950 text-indigo-400 border border-slate-800 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block">
                      {step.num}
                    </span>
                    <h3 className="text-sm font-bold text-slate-100">{step.title}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">{step.description}</p>
                  </div>
                </div>

                {idx < steps.length - 1 && (
                  <div className="flex justify-center py-1 text-slate-700">
                    <ArrowDown className="w-4 h-4" />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Concrete Example Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <h2 className="text-base font-bold text-slate-100">Concrete Example of a Detected Problem</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Source Database
            </span>
            <p className="text-slate-100">Customer 101 → Balance = ₹50,000</p>
          </div>

          <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-900/60 font-mono">
            <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider block mb-1">
              Target Database
            </span>
            <p className="text-rose-300 font-semibold">Customer 101 → Balance = ₹5,000</p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs space-y-1 font-mono">
          <span className="text-emerald-400 font-bold block">✓ DataGuard detects:</span>
          <p className="text-slate-200">"Value mismatch detected."</p>
          <div className="pt-2 flex items-center gap-6 text-slate-400 text-[11px]">
            <span>Source: customer_id = 101, balance = 50000</span>
            <span>Target: id = 101, account_balance = 5000</span>
          </div>
        </div>
      </div>

      {/* What Problems Can DataGuard Detect? */}
      <div className="space-y-4">
        <h2 className="text-base font-bold text-slate-100">What Problems Can DataGuard Detect?</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {detectedProblems.map((prob) => (
            <div key={prob.label} className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl shadow-md">
              <span className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                {prob.label}
              </span>
              <p className="text-xs text-slate-400 mt-1 leading-snug">{prob.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Who is this useful for? */}
      <div className="space-y-4">
        <h2 className="text-base font-bold text-slate-100">Who is this useful for?</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {targetUsers.map((user) => (
            <div key={user.role} className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl shadow-md">
              <span className="text-xs font-bold text-slate-100 block">{user.role}</span>
              <p className="text-xs text-slate-400 mt-1 leading-snug">{user.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Project Limitations */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 space-y-2">
        <h3 className="font-bold text-slate-100">Supported Databases & Current Scope</h3>
        <p>
          The current working version of DataGuard supports <strong>PostgreSQL</strong> and <strong>MySQL</strong>, CSV file uploads, and an embedded <strong>In-Memory Relational Engine</strong> for local demonstration.
        </p>
        <p className="text-slate-500">
          Planned future releases may include Microsoft SQL Server, Oracle, Snowflake, and continuous delta replication listeners.
        </p>
      </div>

      {/* Short Disclaimer */}
      <div className="p-4 rounded-xl border border-dashed border-slate-800 text-xs text-slate-500 flex items-center gap-3">
        <ShieldAlert className="w-5 h-5 text-slate-500 shrink-0" />
        <p>
          <strong>Disclaimer:</strong> DataGuard is a project prototype designed for database migration validation and quality assurance.
        </p>
      </div>
    </div>
  );
};
