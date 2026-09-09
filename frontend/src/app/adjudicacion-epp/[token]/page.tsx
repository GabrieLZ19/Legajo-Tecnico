"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, Loader2, Mail, Phone, User } from "lucide-react";
import {
  eppLicitacionService,
  type AdjudicacionPublicaInfo,
} from "@/utils/services/eppLicitacion.service";

export default function AdjudicacionEppPublicaPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AdjudicacionPublicaInfo | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const info = await eppLicitacionService.obtenerAdjudicacionPublica(token);
        setData(info);
      } catch {
        setError("Este enlace de adjudicación no es válido o ya no está disponible.");
      } finally {
        setLoading(false);
      }
    };
    if (token) void load();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md text-center space-y-2">
          <h1 className="text-lg font-black text-slate-900">Enlace no disponible</h1>
          <p className="text-sm text-slate-500">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-slate-50 px-4 py-10">
      <div className="max-w-lg mx-auto space-y-6">
        <div className="text-center space-y-3">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <p className="text-[11px] font-black uppercase tracking-wider text-emerald-700">
            Adjudicación
          </p>
          <h1 className="text-2xl font-black text-slate-900 leading-tight">
            {data.titulo}
          </h1>
          <p className="text-sm text-slate-500 font-semibold">{data.empresa}</p>
        </div>

        <div className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm space-y-4">
          <p className="text-base font-semibold text-slate-800 leading-relaxed">
            {data.mensaje}
          </p>
          <p className="text-sm text-slate-500">
            Proveedor adjudicado:{" "}
            <span className="font-bold text-slate-800">{data.ganador_nombre}</span>
          </p>
        </div>

        <div className="rounded-3xl border border-slate-100 bg-white p-5 space-y-3">
          <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">
            Contacto del comprador
          </p>
          {data.comprador_nombre && (
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <User className="h-4 w-4 text-slate-400" />
              {data.comprador_nombre}
            </p>
          )}
          {data.comprador_email && (
            <a
              href={`mailto:${data.comprador_email}`}
              className="flex items-center gap-2 text-sm font-semibold text-blue-700"
            >
              <Mail className="h-4 w-4" />
              {data.comprador_email}
            </a>
          )}
          {data.comprador_telefono && (
            <a
              href={`tel:${data.comprador_telefono}`}
              className="flex items-center gap-2 text-sm font-semibold text-slate-800"
            >
              <Phone className="h-4 w-4 text-slate-400" />
              {data.comprador_telefono}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
