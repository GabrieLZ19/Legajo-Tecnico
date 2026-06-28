'use client';

import React, { useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { RotateCcw, Check } from 'lucide-react';

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
    if (sigCanvas.current?.isEmpty()) {
      alert('Por favor, dibuja tu firma antes de guardar.');
      return;
    }
    const base64 = sigCanvas.current?.getTrimmedCanvas().toDataURL('image/png') || '';
    onSave(base64);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 max-w-lg w-full mx-auto space-y-6 shadow-md">
      <div className="text-center">
        <h3 className="text-lg font-bold text-slate-900">{title}</h3>
        <p className="text-xs text-slate-500 mt-1">Dibuja tu firma sobre el recuadro blanco utilizando tu dedo o un lápiz táctil.</p>
      </div>

      <div className="border-2 border-dashed border-slate-200 rounded-lg bg-slate-50 overflow-hidden h-48 relative">
        <SignatureCanvas
          ref={sigCanvas}
          penColor="black"
          canvasProps={{
            className: 'w-full h-full cursor-crosshair'
          }}
        />
      </div>

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
