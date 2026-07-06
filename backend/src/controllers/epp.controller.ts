import { Request, Response, NextFunction } from "express";
import { supabaseAdmin } from "../config/supabase";
import { eppPdfService } from "../services/eppPdf.service";

// Helper para mapear las columnas de la base de datos a las propiedades esperadas por el frontend
const mapEntrega = (e: any) => ({
  id: e.id,
  empresa_id: e.empresa_id,
  preventor_id: e.preventor_id,
  epp_tipo_id: e.epp_tipo_id,
  nombre_empleado: e.empleado_nombre,
  dni_empleado: e.empleado_documento,
  cantidad: e.cantidad,
  marca: e.marca,
  modelo: e.modelo,
  certificacion: e.certificacion,
  fecha_entrega: e.entregado_at,
  firma_url: e.firma_empleado_url,
  estado: e.estado,
  pdf_url: e.url_registro_oficial,
  epp_tipos: e.epp_tipos,
});

export const eppController = {
  /**
   * GET /tipos - Catálogo de EPPs disponibles
   */
  async listarTipos(req: Request, res: Response, next: NextFunction) {
    try {
      const { data, error } = await supabaseAdmin
        .from("epp_tipos")
        .select("*")
        .eq("activo", true)
        .order("nombre");

      if (error) throw error;

      res.json({ tipos: data || [] });
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /tipos - Crear un nuevo tipo de EPP en el catálogo
   */
  async crearTipo(req: Request, res: Response, next: NextFunction) {
    try {
      const { nombre, descripcion } = req.body;
      const consultoraId = req.user!.consultora_id || "8188e718-4653-44cd-98d2-7b43a9ddb671";

      if (!nombre) {
        return res.status(400).json({ error: "El nombre del EPP es requerido" });
      }

      const { data, error } = await supabaseAdmin
        .from("epp_tipos")
        .insert({
          consultora_id: consultoraId,
          nombre,
          descripcion: descripcion || null,
          activo: true,
        })
        .select()
        .single();

      if (error) throw error;

      res.status(201).json(data);
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /entregas - Listar entregas de EPP por empresa
   * Query param: empresa_id
   */
  async listarEntregas(req: Request, res: Response, next: NextFunction) {
    try {
      const empresaId = req.query.empresa_id as string;
      if (!empresaId) {
        return res.status(400).json({ error: "empresa_id es requerido" });
      }

      const { data, error } = await supabaseAdmin
        .from("epp_entregas")
        .select(
          `
          *,
          epp_tipos(id, nombre, descripcion)
        `,
        )
        .eq("empresa_id", empresaId)
        .order("entregado_at", { ascending: false });

      if (error) throw error;

      const list = (data || []).map(mapEntrega);
      res.json({ entregas: list });
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /entregas - Registrar una entrega de EPP
   * Body: empresa_id, nombre_empleado, dni_empleado, items, fecha_entrega, firma (base64)
   */
  async registrarEntrega(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        empresa_id,
        nombre_empleado,
        dni_empleado,
        items, // Array de { epp_tipo_id, cantidad, marca, modelo, certificacion }
        fecha_entrega,
        firma, // base64
      } = req.body;

      const preventorId = req.user!.id;

      if (
        !empresa_id ||
        !nombre_empleado ||
        !dni_empleado ||
        !items ||
        !items.length
      ) {
        return res.status(400).json({ error: "Faltan campos requeridos" });
      }

      // Subir firma si la hay
      let firmaUrl: string | null = null;
      if (firma) {
        const base64Data = firma.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");
        const firmaPath = `epp/${empresa_id}/${dni_empleado}_${Date.now()}.png`;

        const { error: storageError } = await supabaseAdmin.storage
          .from("firmas_digitales")
          .upload(firmaPath, buffer, {
            contentType: "image/png",
            upsert: true,
          });

        if (!storageError) {
          const { data: urlData } = supabaseAdmin.storage
            .from("firmas_digitales")
            .getPublicUrl(firmaPath);
          firmaUrl = urlData.publicUrl;
        }
      }

      // Insertar cada item de entrega utilizando las columnas correctas de la base de datos
      const entregasData = items.map((item: any) => ({
        empresa_id,
        preventor_id: preventorId,
        epp_tipo_id: item.epp_tipo_id,
        empleado_nombre: nombre_empleado,
        empleado_documento: dni_empleado,
        cantidad: item.cantidad || 1,
        marca: item.marca || null,
        modelo: item.modelo || null,
        certificacion: item.certificacion || null,
        entregado_at: fecha_entrega || new Date().toISOString(),
        firma_empleado_url: firmaUrl,
        estado: "firmada",
      }));

      const { data: entregas, error: entregaError } = await supabaseAdmin
        .from("epp_entregas")
        .insert(entregasData)
        .select(`
          *,
          epp_tipos(id, nombre, descripcion)
        `);

      if (entregaError) throw entregaError;

      // Obtener empresa para el PDF
      const { data: empresa } = await supabaseAdmin
        .from("empresas")
        .select("razon_social, cuit, actividad, logo_url")
        .eq("id", empresa_id)
        .single();

      // Generar PDF SRT 299/11
      const pdfBuffer = await eppPdfService.generarConstanciaSRT299({
        empresa: empresa || { razon_social: "", cuit: "", actividad: "" },
        empleado: { nombre: nombre_empleado, dni: dni_empleado },
        items: entregas.map((e: any) => ({
          ...e,
          fecha_entrega: e.entregado_at,
        })) || [],
        fecha: fecha_entrega || new Date().toISOString(),
        firmaUrl,
      });

      // Subir PDF a storage
      const pdfPath = `epp/pdf/${empresa_id}/${dni_empleado}_${Date.now()}.pdf`;
      const { error: pdfUploadError } = await supabaseAdmin.storage
        .from("informes_pdf")
        .upload(pdfPath, pdfBuffer, {
          contentType: "application/pdf",
          upsert: true,
        });

      let pdfUrl: string | null = null;
      if (!pdfUploadError) {
        const { data: pdfUrlData } = supabaseAdmin.storage
          .from("informes_pdf")
          .getPublicUrl(pdfPath);
        pdfUrl = pdfUrlData.publicUrl;

        // Actualizar base de datos con la URL del registro oficial del PDF
        const ids = entregas.map((e: any) => e.id);
        await supabaseAdmin
          .from("epp_entregas")
          .update({ url_registro_oficial: pdfUrl })
          .in("id", ids);

        // Actualizar la referencia local para la respuesta
        entregas.forEach((e: any) => {
          e.url_registro_oficial = pdfUrl;
        });
      }

      const mappedList = entregas.map(mapEntrega);

      res.status(201).json({
        success: true,
        entregas: mappedList,
        pdf_url: pdfUrl,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /licitaciones - Listar licitaciones de EPP (stub básico)
   */
  async listarLicitaciones(req: Request, res: Response, next: NextFunction) {
    try {
      const empresaId = req.query.empresa_id as string;

      // Por ahora devolvemos un array vacío ya que la tabla puede no existir
      // En una siguiente iteración se crearía la tabla epp_licitaciones
      res.json({ licitaciones: [] });
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /licitaciones - Crear licitación de EPP (stub básico)
   */
  async crearLicitacion(req: Request, res: Response, next: NextFunction) {
    try {
      // Stub: en producción se insertaría en la tabla epp_licitaciones
      res.status(201).json({
        success: true,
        message: "Licitación registrada (stub)",
        data: req.body,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /entregas/:id/pdf - Descargar el PDF de entrega oficial de EPP
   */
  async descargarPdf(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

      // 1. Obtener la entrega y verificar que exista
      const { data: entrega, error } = await supabaseAdmin
        .from("epp_entregas")
        .select("*, empresas(*)")
        .eq("id", id)
        .single();

      if (error || !entrega) {
        return res.status(404).json({ error: "Entrega de EPP no encontrada" });
      }

      // Validar que tenga el PDF generado
      if (!entrega.url_registro_oficial) {
        return res.status(404).json({ error: "El PDF de esta entrega aún no ha sido generado" });
      }

      // 2. Extraer el path del archivo desde la URL del storage
      const bucketName = "informes_pdf";
      const parts = entrega.url_registro_oficial.split(`/public/${bucketName}/`);
      if (parts.length < 2) {
        return res.status(400).json({ error: "Ruta del archivo PDF inválida" });
      }
      const filePath = parts[1];

      // 3. Descargar el archivo desde Supabase storage
      const { data: fileData, error: downloadError } = await supabaseAdmin.storage
        .from(bucketName)
        .download(filePath);

      if (downloadError || !fileData) {
        throw downloadError || new Error("No se pudo obtener el archivo del storage");
      }

      // 4. Convertir a Buffer y enviarlo para descarga automática
      const arrayBuffer = await fileData.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="Constancia_SRT_299_${entrega.empleado_documento}.pdf"`
      );
      res.send(buffer);
    } catch (error) {
      next(error);
    }
  },
};
