"use client";

import { Camera, X } from "lucide-react";
import { PhotoSourcePicker } from "@/components/PhotoSourcePicker";

export type ImagenVisitaLocal = {
  id_temp: string;
  url?: string;
  imagenFile?: File;
  previewUrl?: string;
};

export function imagenesFromUrls(urls: string[]): ImagenVisitaLocal[] {
  return urls.map((url) => ({ id_temp: url, url }));
}

type Props = {
  imagenes: ImagenVisitaLocal[];
  onChange: (imagenes: ImagenVisitaLocal[]) => void;
  disabled?: boolean;
};

export function ImagenesVisitaSection({
  imagenes,
  onChange,
  disabled = false,
}: Props) {
  const addImagen = (file: File) => {
    const id_temp = Math.random().toString(36).slice(2);
    onChange([
      ...imagenes,
      {
        id_temp,
        imagenFile: file,
        previewUrl: URL.createObjectURL(file),
      },
    ]);
  };

  const removeImagen = (id_temp: string) => {
    const target = imagenes.find((img) => img.id_temp === id_temp);
    if (target?.previewUrl && target.imagenFile) {
      URL.revokeObjectURL(target.previewUrl);
    }
    onChange(imagenes.filter((img) => img.id_temp !== id_temp));
  };

  const displayUrl = (img: ImagenVisitaLocal) =>
    img.previewUrl || img.url || null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 gap-3">
        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          Imágenes de la visita
        </label>
        <PhotoSourcePicker
          disabled={disabled}
          onSelect={addImagen}
          triggerClassName="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer border border-slate-200 disabled:opacity-50"
        >
          <Camera className="h-3.5 w-3.5" />
          Insertar imagen
        </PhotoSourcePicker>
      </div>

      {imagenes.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {imagenes.map((img, idx) => {
            const src = displayUrl(img);
            return (
              <div
                key={img.id_temp}
                className="relative group border border-slate-200 rounded-xl overflow-hidden bg-slate-50 aspect-square"
              >
                {src ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={src}
                    alt={`Imagen visita ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400">
                    <Camera className="h-6 w-6" />
                  </div>
                )}
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => removeImagen(img.id_temp)}
                    className="absolute top-1.5 right-1.5 p-1 bg-slate-900/60 hover:bg-red-600 text-white rounded-full transition-colors cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100"
                    aria-label={`Eliminar imagen ${idx + 1}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center text-xs font-bold text-slate-400 bg-slate-50/10">
          Podés agregar fotos generales de la visita.
        </div>
      )}
    </div>
  );
}
