import { supabaseAdmin } from './config/supabase';

async function fix() {
  console.log('🔧 Fixing admin consultora_id and cleaning up duplicates...');
  try {
    // 1. Obtener la primera consultora (la que tiene la empresa y preventor)
    const targetConsultoraId = '8188e718-4653-44cd-98d2-7b43a9ddb671';

    // 2. Actualizar el perfil del admin para usar esta consultora
    const { data: updatedAdmin, error: errAdmin } = await supabaseAdmin
      .from('perfiles')
      .update({ consultora_id: targetConsultoraId })
      .eq('username', 'admin')
      .select()
      .single();

    if (errAdmin) throw errAdmin;
    console.log('✅ Admin updated successfully:', updatedAdmin);

    // 3. Eliminar las consultoras duplicadas
    const { data: allConsultoras } = await supabaseAdmin.from('consultoras').select('id');
    if (allConsultoras) {
      for (const cons of allConsultoras) {
        if (cons.id !== targetConsultoraId) {
          const { error: deleteErr } = await supabaseAdmin
            .from('consultoras')
            .delete()
            .eq('id', cons.id);
          
          if (deleteErr) {
            console.log(`⚠️ Could not delete duplicate consultora ${cons.id}: ${deleteErr.message}`);
          } else {
            console.log(`🗑️ Deleted duplicate consultora ${cons.id}`);
          }
        }
      }
    }

    console.log('🎉 Fix completed successfully!');
  } catch (e: any) {
    console.error('❌ Error during fix:', e.message);
  }
}

fix();
