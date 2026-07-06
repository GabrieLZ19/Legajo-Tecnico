import { supabaseAdmin } from './config/supabase';

async function run() {
  const tables = [
    'consultoras', 
    'empresas', 
    'perfiles', 
    'preventor_empresas', 
    'ente_regulador_empresas', 
    'informes_visita', 
    'peligros_detectados', 
    'puntos_mejora', 
    'acciones_mejora', 
    'firmas_informe', 
    'capacitaciones', 
    'capacitacion_preguntas', 
    'capacitacion_asistencias', 
    'epp_tipos', 
    'epp_entregas', 
    'epp_licitaciones'
  ];
  
  for (const table of tables) {
    const { data: tblData, error: tblErr, count } = await supabaseAdmin
      .from(table)
      .select('*', { count: 'exact', head: true });
    if (tblErr) {
      console.log(`❌ Table ${table} error: ${tblErr.message}`);
    } else {
      console.log(`✅ Table ${table} exists! Rows: ${count}`);
    }
  }
}

run();
