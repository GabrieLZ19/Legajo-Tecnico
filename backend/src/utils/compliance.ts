import { supabaseAdmin } from "../config/supabase";

export async function recalcularCumplimientoEmpresa(empresaId: string) {
  try {
    const { data: acciones, error: errAcc } = await supabaseAdmin
      .from("acciones_mejora")
      .select("estado")
      .eq("empresa_id", empresaId);

    if (errAcc) throw errAcc;

    const total = acciones?.length || 0;
    let porcentaje = 100.0;

    if (total > 0) {
      const cumplidasOAtendidas = acciones.filter(
        (a) => a.estado === "cumplida" || a.estado === "atendida"
      ).length;
      porcentaje = parseFloat(((cumplidasOAtendidas / total) * 100).toFixed(1));
    }

    await supabaseAdmin
      .from("empresas")
      .update({ porcentaje_cumplimiento: porcentaje })
      .eq("id", empresaId);

    console.log(`[Compliance] Recalculado para empresa ${empresaId}: ${porcentaje}%`);
  } catch (err) {
    console.error(`[Compliance] Error al recalcular para empresa ${empresaId}:`, err);
  }
}
