import { supabaseAdmin } from './config/supabase';

async function seed() {
  console.log('🌱 Iniciando seeding...');

  try {
    // 1. Crear Consultora
    const { data: consultora, error: errCons } = await supabaseAdmin
      .from('consultoras')
      .insert({
        nombre: 'Consultora Alpha S.H.',
        logo_url: null,
        config: {}
      })
      .select()
      .single();

    if (errCons) throw new Error(`Error al crear consultora: ${errCons.message}`);
    console.log(`✅ Consultora creada: ${consultora.nombre} (${consultora.id})`);

    // 2. Crear Empresa
    const cuitTest = '30123456789';
    const { data: empresa, error: errEmp } = await supabaseAdmin
      .from('empresas')
      .insert({
        consultora_id: consultora.id,
        cuit: cuitTest,
        razon_social: 'Empresa Test S.A.',
        actividad: 'Metalúrgica',
        logo_url: null,
        porcentaje_cumplimiento: 0.00
      })
      .select()
      .single();

    if (errEmp) throw new Error(`Error al crear empresa: ${errEmp.message}`);
    console.log(`✅ Empresa creada: ${empresa.razon_social} (CUIT: ${empresa.cuit})`);

    // 3. Crear Preventor en Auth (se disparará el trigger a perfiles)
    const preventorEmail = `preventor1@${cuitTest}.legajo.local`;
    const preventorUsername = 'preventor1';
    const passwordComun = 'password123';

    // Eliminar si ya existe en auth
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const prevUser = existingUsers?.users.find(u => u.email === preventorEmail);
    if (prevUser) {
      await supabaseAdmin.auth.admin.deleteUser(prevUser.id);
      console.log('🗑️ Preventor antiguo eliminado para re-seed');
    }

    const { data: authPreventor, error: errAuthPrev } = await supabaseAdmin.auth.admin.createUser({
      email: preventorEmail,
      password: passwordComun,
      email_confirm: true,
      user_metadata: {
        rol: 'preventor',
        nombre_completo: 'Juan Preventor',
        username: preventorUsername,
        consultora_id: consultora.id
      }
    });

    if (errAuthPrev || !authPreventor.user) {
      throw new Error(`Error al crear preventor auth: ${errAuthPrev?.message}`);
    }
    console.log(`✅ Preventor creado en Auth: ${preventorEmail}`);

    // 4. Crear Dueño en Auth
    const duenoEmail = `dueno1@${cuitTest}.legajo.local`;
    const duenoUsername = 'dueno1';

    const duenUser = existingUsers?.users.find(u => u.email === duenoEmail);
    if (duenUser) {
      await supabaseAdmin.auth.admin.deleteUser(duenUser.id);
      console.log('🗑️ Dueño antiguo eliminado para re-seed');
    }

    const { data: authDueno, error: errAuthDuen } = await supabaseAdmin.auth.admin.createUser({
      email: duenoEmail,
      password: passwordComun,
      email_confirm: true,
      user_metadata: {
        rol: 'dueno',
        nombre_completo: 'Carlos Dueño',
        username: duenoUsername,
        consultora_id: consultora.id,
        empresa_id: empresa.id
      }
    });

    if (errAuthDuen || !authDueno.user) {
      throw new Error(`Error al crear dueño auth: ${errAuthDuen?.message}`);
    }
    console.log(`✅ Dueño creado en Auth: ${duenoEmail}`);

    // 5. Asociar Preventor a Empresa (preventor_empresas)
    const { error: errAsoc } = await supabaseAdmin
      .from('preventor_empresas')
      .insert({
        preventor_id: authPreventor.user.id,
        empresa_id: empresa.id
      });

    if (errAsoc) throw new Error(`Error al asociar preventor a empresa: ${errAsoc.message}`);
    console.log('✅ Preventor asociado a la empresa en preventor_empresas');

    console.log('🎉 Seeding completado con éxito!');
  } catch (error: any) {
    console.error('❌ Error en el seeding:', error.message);
  }
}

seed();
