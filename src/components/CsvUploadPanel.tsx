import React, { useRef, useState } from 'react';
import { CsvPreview } from '../types';
import { api } from '../services/api';
import { Upload, FileSpreadsheet, Loader2, AlertCircle } from 'lucide-react';

interface CsvUploadPanelProps {
  sessionId: string | null;
  sourcePreview?: CsvPreview;
  targetPreview?: CsvPreview;
  onUploaded: (side: 'source' | 'target', preview: CsvPreview) => void;
}

const CsvDrop: React.FC<{
  label: string;
  side: 'source' | 'target';
  preview?: CsvPreview;
  disabled: boolean;
  onFile: (file: File) => void;
  isUploading: boolean;
  error?: string;
}> = ({ label, side, preview, disabled, onFile, isUploading, error }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-slate-100">{label}</h3>
        <p className="text-[11px] text-slate-500 mt-0.5">CSV only. Preview shows the first 10 rows.</p>
      </div>

      <button
        type="button"
        disabled={disabled || isUploading}
        onClick={() => inputRef.current?.click()}
        className="w-full border border-dashed border-slate-700 hover:border-indigo-500/60 rounded-xl p-5 text-center transition-colors disabled:opacity-50"
      >
        {isUploading ? (
          <Loader2 className="w-6 h-6 text-indigo-400 animate-spin mx-auto" />
        ) : (
          <Upload className="w-6 h-6 text-indigo-400 mx-auto" />
        )}
        <p className="text-xs text-slate-300 mt-2 font-medium">
          {isUploading ? 'Uploading to server…' : `Upload ${side === 'source' ? 'Source' : 'Target'} CSV`}
        </p>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv,text/plain"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = '';
        }}
      />

      {error && (
        <p className="text-xs text-rose-400 flex items-start gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          {error}
        </p>
      )}

      {preview && (
        <div className="space-y-3">
          <div className="flex items-start gap-2 text-xs">
            <FileSpreadsheet className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
            <div>
              <p className="font-mono text-slate-200">{preview.fileName}</p>
              <p className="text-slate-400 mt-0.5">
                Rows: {preview.rowCount.toLocaleString()} · Columns: {preview.columnCount}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-800 rounded-lg">
            <table className="w-full text-[11px] text-slate-300">
              <thead className="bg-slate-950 text-slate-500 uppercase tracking-wider">
                <tr>
                  {preview.headers.map((h) => (
                    <th key={h} className="px-2 py-1.5 font-mono font-semibold text-left whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {preview.previewRows.map((row, idx) => (
                  <tr key={idx}>
                    {preview.headers.map((h) => (
                      <td key={h} className="px-2 py-1.5 font-mono whitespace-nowrap text-slate-300">
                        {row[h] === null || row[h] === undefined ? (
                          <span className="italic text-slate-600">NULL</span>
                        ) : (
                          String(row[h])
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export const CsvUploadPanel: React.FC<CsvUploadPanelProps> = ({
  sessionId,
  sourcePreview,
  targetPreview,
  onUploaded,
}) => {
  const [uploading, setUploading] = useState<'source' | 'target' | null>(null);
  const [errors, setErrors] = useState<{ source?: string; target?: string }>({});

  const handleFile = async (side: 'source' | 'target', file: File) => {
    if (!sessionId) return;
    if (!file.name.toLowerCase().endsWith('.csv') && file.type && !file.type.includes('csv') && file.type !== 'text/plain') {
      setErrors((e) => ({ ...e, [side]: 'Only CSV files are supported.' }));
      return;
    }
    setUploading(side);
    setErrors((e) => ({ ...e, [side]: undefined }));
    try {
      const preview = await api.uploadCsv(sessionId, side, file);
      onUploaded(side, preview);
    } catch (err: any) {
      setErrors((e) => ({ ...e, [side]: err.message || 'Upload failed' }));
    } finally {
      setUploading(null);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <CsvDrop
        label="SOURCE DATA"
        side="source"
        preview={sourcePreview}
        disabled={!sessionId}
        isUploading={uploading === 'source'}
        error={errors.source}
        onFile={(file) => handleFile('source', file)}
      />
      <CsvDrop
        label="TARGET DATA"
        side="target"
        preview={targetPreview}
        disabled={!sessionId}
        isUploading={uploading === 'target'}
        error={errors.target}
        onFile={(file) => handleFile('target', file)}
      />
    </div>
  );
};
