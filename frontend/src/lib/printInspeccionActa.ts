export interface PrintableInspeccionData {
  id: string;
  plantilla_titulo: string;
  fecha: string;
  resultado: string;
  inspector_nombre?: string | null;
  observaciones?: string | null;
  equipo?: {
    nombre: string;
    tipo_equipo?: string | null;
    codigo_interno?: string | null;
    ubicacion?: string | null;
  } | null;
  empresa_nombre?: string | null;
  items: Array<{
    id?: string;
    texto: string;
    criticidad: string;
    calificacion: string;
  }>;
  acciones?: Array<{
    id?: string;
    descripcion: string;
    responsable?: string | null;
    fecha_vencimiento?: string | null;
    estado?: string;
  }>;
}

export function printInspeccionActa(data: PrintableInspeccionData): boolean {
  if (typeof window === "undefined") return false;

  const printWindow = window.open("", "_blank");
  if (!printWindow) return false;

  const escapeHtml = (str: string) =>
    str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const fechaFormateada = new Date(data.fecha).toLocaleString("es-AR", {
    dateStyle: "long",
    timeStyle: "short",
  });

  const res = data.resultado.toLowerCase();
  let resultadoColor = "#16a34a"; // verde
  let resultadoBg = "#f0fdf4";
  let resultadoBorder = "#bbf7d0";
  let resultadoTexto = "APROBADA / APTO";
  let resultadoDesc = "El equipo cumple con los estándares de seguridad e higiene verificados en el checklist.";

  if (res === "observada") {
    resultadoColor = "#d97706"; // ambar
    resultadoBg = "#fffbeb";
    resultadoBorder = "#fde68a";
    resultadoTexto = "APROBADA CON OBSERVACIONES";
    resultadoDesc = "El equipo puede operar condicionalmente, requiriendo el cumplimiento de las acciones correctivas.";
  } else if (res === "rechazada") {
    resultadoColor = "#dc2626"; // rojo
    resultadoBg = "#fef2f2";
    resultadoBorder = "#fecaca";
    resultadoTexto = "RECHAZADA / NO APTO - FUERA DE SERVICIO";
    resultadoDesc = "PELIGRO CRÍTICO: Se han detectado desvíos de criticidad alta. Se prohíbe su uso hasta subsanación.";
  }

  const itemsHtml = (data.items || [])
    .map((item, idx) => {
      let califBadge = `<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:bold;background:#dcfce7;color:#15803d;">CONFORME (BIEN)</span>`;
      if (item.calificacion === "regular") {
        califBadge = `<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:bold;background:#fef3c7;color:#b45309;">REGULAR</span>`;
      } else if (item.calificacion === "mal") {
        califBadge = `<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:bold;background:#fee2e2;color:#b91c1c;">NO CONFORME (MAL)</span>`;
      }

      let critBadge = `<span style="font-size:10px;font-weight:bold;color:#64748b;text-transform:uppercase;">${item.criticidad}</span>`;
      if (item.criticidad === "alta") {
        critBadge = `<span style="font-size:10px;font-weight:bold;color:#b91c1c;text-transform:uppercase;">● ALTA</span>`;
      } else if (item.criticidad === "media") {
        critBadge = `<span style="font-size:10px;font-weight:bold;color:#d97706;text-transform:uppercase;">● MEDIA</span>`;
      }

      return `
        <tr style="border-bottom:1px solid #e2e8f0;">
          <td style="padding:8px 10px;font-size:11px;color:#64748b;text-align:center;">${idx + 1}</td>
          <td style="padding:8px 10px;font-size:12px;color:#1e293b;font-weight:500;">${escapeHtml(item.texto)}</td>
          <td style="padding:8px 10px;text-align:center;">${critBadge}</td>
          <td style="padding:8px 10px;text-align:right;">${califBadge}</td>
        </tr>
      `;
    })
    .join("");

  const accionesHtml = (data.acciones && data.acciones.length > 0)
    ? `
      <div style="margin-top:20px;">
        <h3 style="font-size:13px;font-weight:bold;color:#0f172a;text-transform:uppercase;letter-spacing:0.05em;border-bottom:2px solid #e2e8f0;padding-bottom:4px;margin-bottom:8px;">
          Plan de Acción Correctivo
        </h3>
        <table style="width:100%;border-collapse:collapse;font-size:11px;">
          <thead>
            <tr style="background:#f8fafc;border-bottom:1px solid #cbd5e1;text-align:left;">
              <th style="padding:6px 10px;">Acción Correctiva</th>
              <th style="padding:6px 10px;">Responsable</th>
              <th style="padding:6px 10px;">Vencimiento</th>
              <th style="padding:6px 10px;text-align:right;">Estado</th>
            </tr>
          </thead>
          <tbody>
            ${data.acciones.map((a) => `
              <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:6px 10px;color:#1e293b;font-weight:500;">${escapeHtml(a.descripcion)}</td>
                <td style="padding:6px 10px;color:#64748b;">${escapeHtml(a.responsable || "Sin asignar")}</td>
                <td style="padding:6px 10px;color:#64748b;">${a.fecha_vencimiento ? new Date(a.fecha_vencimiento + "T12:00:00").toLocaleDateString("es-AR") : "—"}</td>
                <td style="padding:6px 10px;text-align:right;font-weight:bold;text-transform:capitalize;color:${a.estado === "cumplida" ? "#16a34a" : "#d97706"};">${a.estado || "pendiente"}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `
    : "";

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Acta de Inspección - ${escapeHtml(data.plantilla_titulo)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 15mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      padding: 10px;
    }
  </style>
</head>
<body>
  <div style="border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-start;">
    <div>
      <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: #64748b; font-family: monospace;">
        LEGAJO TÉCNICO DIGITAL · HIGIENE Y SEGURIDAD LABORAL
      </div>
      <h1 style="font-size: 20px; font-weight: 900; color: #0f172a; margin-top: 4px;">
        Acta de Inspección Técnica de Equipo
      </h1>
      <p style="font-size: 13px; color: #475569; margin-top: 2px;">
        ${escapeHtml(data.plantilla_titulo)}
      </p>
    </div>
    <div style="text-align: right;">
      <div style="font-size: 11px; font-weight: 700; color: #0f172a;">ACTA N° ${data.id.slice(0, 8).toUpperCase()}</div>
      <div style="font-size: 10px; color: #64748b; margin-top: 2px;">${fechaFormateada}</div>
      ${data.empresa_nombre ? `<div style="font-size: 10px; font-weight: 600; color: #1e3a8a; margin-top: 2px;">${escapeHtml(data.empresa_nombre)}</div>` : ""}
    </div>
  </div>

  <!-- Dictamen Oficial Banner -->
  <div style="border: 2px solid ${resultadoBorder}; background: ${resultadoBg}; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between;">
    <div>
      <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: ${resultadoColor};">
        DICTAMEN OFICIAL DE HIGIENE Y SEGURIDAD
      </div>
      <div style="font-size: 16px; font-weight: 900; color: ${resultadoColor}; margin-top: 2px;">
        ${resultadoTexto}
      </div>
      <div style="font-size: 11px; color: #334155; margin-top: 2px;">
        ${resultadoDesc}
      </div>
    </div>
    <div style="text-align: right;">
      <div style="font-size: 11px; font-weight: 700; color: #64748b;">TOTAL ÍTEMS</div>
      <div style="font-size: 20px; font-weight: 900; color: #0f172a;">${data.items.length}</div>
    </div>
  </div>

  <!-- Datos del Equipo Inspeccionado -->
  <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; margin-bottom: 16px; background: #f8fafc;">
    <h3 style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: #475569; margin-bottom: 8px;">
      Especificaciones del Equipo Inspeccionado
    </h3>
    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; font-size: 11px;">
      <div>
        <span style="color: #64748b; display: block; font-size: 10px;">Equipo:</span>
        <strong style="color: #0f172a;">${escapeHtml(data.equipo?.nombre || "No especificado")}</strong>
      </div>
      <div>
        <span style="color: #64748b; display: block; font-size: 10px;">Tipo de Equipo:</span>
        <strong style="color: #0f172a;">${escapeHtml(data.equipo?.tipo_equipo || "—")}</strong>
      </div>
      <div>
        <span style="color: #64748b; display: block; font-size: 10px;">Código Interno / TAG:</span>
        <strong style="color: #0f172a; font-family: monospace;">${escapeHtml(data.equipo?.codigo_interno || "—")}</strong>
      </div>
      <div>
        <span style="color: #64748b; display: block; font-size: 10px;">Ubicación:</span>
        <strong style="color: #0f172a;">${escapeHtml(data.equipo?.ubicacion || "—")}</strong>
      </div>
    </div>
    ${data.inspector_nombre ? `
      <div style="margin-top: 8px; padding-top: 6px; border-top: 1px dashed #cbd5e1; font-size: 11px; color: #475569;">
        <strong>Inspector / Auditor actuante:</strong> ${escapeHtml(data.inspector_nombre)}
      </div>
    ` : ""}
  </div>

  <!-- Tabla de Verificación de Ítems -->
  <div>
    <h3 style="font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: #0f172a; border-bottom: 2px solid #0f172a; padding-bottom: 4px; margin-bottom: 6px;">
      Puntos de Control y Estado de Verificación
    </h3>
    <table style="width: 100%; border-collapse: collapse;">
      <thead>
        <tr style="background: #f1f5f9; border-bottom: 1px solid #cbd5e1; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #475569;">
          <th style="padding: 6px 10px; width: 30px; text-align: center;">#</th>
          <th style="padding: 6px 10px; text-align: left;">Punto de Inspección</th>
          <th style="padding: 6px 10px; width: 90px; text-align: center;">Criticidad</th>
          <th style="padding: 6px 10px; width: 150px; text-align: right;">Calificación</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>
  </div>

  <!-- Observaciones Generales -->
  ${data.observaciones ? `
    <div style="margin-top: 16px; padding: 10px 12px; border: 1px solid #e2e8f0; border-radius: 6px; background: #ffffff;">
      <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #64748b; margin-bottom: 4px;">
        Observaciones de Campo del Inspector
      </div>
      <div style="font-size: 11px; color: #1e293b; white-space: pre-wrap; line-height: 1.4;">
        ${escapeHtml(data.observaciones)}
      </div>
    </div>
  ` : ""}

  <!-- Plan de Acción -->
  ${accionesHtml}

  <!-- Firmas de Conformidad y Recepción -->
  <div style="margin-top: 40px; display: flex; justify-content: space-between; gap: 40px; page-break-inside: avoid;">
    <div style="flex: 1; text-align: center; border-top: 1px solid #0f172a; padding-top: 8px;">
      <div style="font-size: 11px; font-weight: 700; color: #0f172a;">${escapeHtml(data.inspector_nombre || "Inspector Responsable")}</div>
      <div style="font-size: 9px; color: #64748b; text-transform: uppercase; margin-top: 2px;">Firma y Sello - Auditor Higiene y Seguridad</div>
    </div>
    <div style="flex: 1; text-align: center; border-top: 1px solid #0f172a; padding-top: 8px;">
      <div style="font-size: 11px; font-weight: 700; color: #0f172a;">Responsable de Sector / Planta</div>
      <div style="font-size: 9px; color: #64748b; text-transform: uppercase; margin-top: 2px;">Firma y Aclaración - Recepción de Acta</div>
    </div>
  </div>

  <div style="margin-top: 24px; text-align: center; font-size: 9px; color: #94a3b8; font-family: monospace;">
    Documento emitido electrónicamente mediante Legajo Técnico Digital. Validez y trazabilidad conforme a regulaciones vigentes.
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 250);
    };
  </script>
</body>
</html>`;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  return true;
}
