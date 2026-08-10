'use client';

import React, { useRef } from 'react';
import type SignatureCanvas from 'react-signature-canvas';
import { RotateCcw, Check } from 'lucide-react';
import SignaturePad, { readSignatureOrThrow } from '@/components/SignaturePad';

interface FirmaCanvasProps {
  onSave: (base64: string) => void;
  onCancel?: () => void;
  title?: string;
}

export const FirmaCanvas: React.FC<FirmaCanvasProps> = ({ onSave, onCancel, title = 'Registrar Firma Digital' }) => {
  const sigCanvas = useRef<SignatureCanvas>(null);

  const handleClear = () => {
    sigCanvas.current?.clear();
  };

  const handleSave = () => {
    try {
      const base64 = readSignatureOrThrow(sigCanvas.current);
      onSave(base64);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Por favor, dibujá tu firma antes de guardar.';
      alert(message);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 max-w-lg w-full mx-auto space-y-6 shadow-md">
      <div className="text-center">
        <h3 className="text-lg font-bold text-slate-900">{title}</h3>
        <p className="text-xs text-slate-500 mt-1">Dibuja tu firma sobre el recuadro blanco utilizando tu dedo o un lápiz táctil.</p>
      </div>

      <SignaturePad ref={sigCanvas} heightClassName="h-48" className="border-2 border-dashed rounded-lg" />

      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
        <div className="flex justify-between items-center gap-2 w-full sm:w-auto">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
          )}
          <button
            type="button"
            onClick={handleClear}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Limpiar
          </button>
        </div>
        <button
          type="button"
          onClick={handleSave}
          className="inline-flex items-center justify-center gap-1.5 px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow-md transition-all cursor-pointer w-full sm:w-auto"
        >
          <Check className="h-4 w-4 stroke-3" />
          Confirmar Firma
        </button>
      </div>
    </div>
  );
};
export default FirmaCanvas;
