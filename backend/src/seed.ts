import { supabaseAdmin } from "./config/supabase";

async function seed() {
  console.log("🌱 Iniciando seeding...");

  try {
    // 1. Obtener o Crear Consultora
    let { data: consultora } = await supabaseAdmin
      .from("consultoras")
      .select("*")
      .eq("nombre", "Consultora Alpha S.H.")
      .maybeSingle();

    if (!consultora) {
      const { data, error: errCons } = await supabaseAdmin
        .from("consultoras")
        .insert({
          nombre: "Consultora Alpha S.H.",
          logo_url: null,
          config: {},
        })
        .select()
        .single();

      if (errCons)
        throw new Error(`Error al crear consultora: ${errCons.message}`);
      consultora = data;
      console.log(
        `✅ Consultora creada: ${consultora.nombre} (${consultora.id})`,
      );
    } else {
      console.log(
        `ℹ️ Consultora ya existe: ${consultora.nombre} (${consultora.id})`,
      );
    }

    // 2. Crear Admin en Auth si no existe (No toca preventores ni dueños existentes)
    const adminEmail = "admin@legajotecnico.com";
    const adminUsername = "admin";

    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const adminUser = existingUsers?.users.find((u) => u.email === adminEmail);

    if (!adminUser) {
      const { data: authAdmin, error: errAuthAdmin } =
        await supabaseAdmin.auth.admin.createUser({
          email: adminEmail,
          password: "admin123",
          email_confirm: true,
          user_metadata: {
            rol: "admin",
            nombre_completo: "Administrador General",
            username: adminUsername,
            consultora_id: consultora.id,
          },
        });

      if (errAuthAdmin) throw errAuthAdmin;
      console.log(`✅ Admin creado en Auth: ${adminEmail}`);
    } else {
      console.log(
        `ℹ️ El usuario administrador (${adminEmail}) ya existe en el sistema.`,
      );
    }

    // 3. Crear empresa de prueba para demos si no existe
    const demoCuit = "30123456789";
    const { data: existingEmpresa } = await supabaseAdmin
      .from("empresas")
      .select("*")
      .eq("cuit", demoCuit)
      .maybeSingle();

    const demoEmpresaPayload = {
      consultora_id: consultora.id,
      cuit: demoCuit,
      razon_social: "MOTORTECH S.A",
      actividad: "Industria y construcción",
      domicilio: "Av. San Martín 450",
      localidad: "Mendoza, Mendoza",
      codigo_postal: "M5500",
      telefono: "+54 261 555-0101",
      contacto: "Contacto Comercial",
      porcentaje_cumplimiento: 100,
    };

    if (!existingEmpresa) {
      const { data: demoEmpresa, error: errEmpresa } = await supabaseAdmin
        .from("empresas")
        .insert(demoEmpresaPayload)
        .select()
        .single();

      if (errEmpresa)
        throw new Error(`Error al crear empresa demo: ${errEmpresa.message}`);
      console.log(
        `✅ Empresa demo creada: ${demoEmpresa.razon_social} (${demoEmpresa.cuit})`,
      );
    } else if (
      existingEmpresa.razon_social !== demoEmpresaPayload.razon_social
    ) {
      const { data: updatedEmpresa, error: errUpdate } = await supabaseAdmin
        .from("empresas")
        .update(demoEmpresaPayload)
        .eq("id", existingEmpresa.id)
        .select()
        .single();

      if (errUpdate)
        throw new Error(
          `Error al actualizar empresa demo: ${errUpdate.message}`,
        );
      console.log(
        `✅ Empresa demo actualizada: ${updatedEmpresa.razon_social} (${updatedEmpresa.cuit})`,
      );
    } else {
      console.log(
        `ℹ️ La empresa demo ya existe: ${existingEmpresa.razon_social} (${existingEmpresa.cuit})`,
      );
    }

    console.log("🎉 Seeding completado con éxito!");
  } catch (error: any) {
    console.error("❌ Error en el seeding:", error.message);
  }
}

seed();
