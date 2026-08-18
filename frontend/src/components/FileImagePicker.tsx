"use client";

import { ImagePlus, X } from "lucide-react";
import { useEffect, useState } from "react";

type FileImagePickerProps = {
  file: File | null;
  onChange: (file: File | null) => void;
  label?: string;
  hint?: string;
  previewUrl?: string | null;
};

export function FileImagePicker({
  file,
  onChange,
  label = "Foto",
  hint = "PNG o JPG, hasta 5 MB",
  previewUrl,
}: FileImagePickerProps) {
  const [localPreview, setLocalPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setLocalPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setLocalPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const shown = localPreview || previewUrl || null;

  return (
    <div className="space-y-1.5">
      <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
        {label}
      </span>
      <label className="flex items-center gap-3 w-full cursor-pointer rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 hover:border-blue-400 hover:bg-blue-50/40 transition-colors p-3">
        <div className="h-14 w-14 rounded-xl bg-white border border-slate-100 overflow-hidden flex items-center justify-center shrink-0">
          {shown ? (
            <img src={shown} alt="Vista previa" className="h-full w-full object-cover" />
          ) : (
            <ImagePlus className="h-6 w-6 text-blue-500" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-800 truncate">
            {file ? file.name : shown ? "Cambiar foto" : "Elegir foto del EPP"}
          </p>
          <p className="text-[11px] text-slate-400 font-semibold">{hint}</p>
        </div>
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        />
      </label>
      {file && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-rose-600 cursor-pointer"
        >
          <X className="h-3 w-3" />
          Quitar archivo
        </button>
      )}
    </div>
  );
}
