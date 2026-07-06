import { supabaseAdmin } from './config/supabase';

async function check() {
  console.log('🔍 Checking database content...');
  try {
    const { data: consultoras } = await supabaseAdmin.from('consultoras').select('*');
    console.log('Consultoras:', consultoras);

    const { data: empresas } = await supabaseAdmin.from('empresas').select('*');
    console.log('Empresas:', empresas);

    const { data: perfiles } = await supabaseAdmin.from('perfiles').select('*');
    console.log('Perfiles:', perfiles);

    const { data: informes } = await supabaseAdmin.from('informes_visita').select('*');
    console.log('Informes:', informes);

    const { data: acciones } = await supabaseAdmin.from('acciones_mejora').select('*');
    console.log('Acciones de Mejora:', acciones);

  } catch (e: any) {
    console.error('Error:', e.message);
  }
}

check();
