export interface PrintableEquipo {
  nombre: string;
  tipo_equipo?: string | null;
  codigo_interno?: string | null;
  ubicacion?: string | null;
  qr_url?: string | null;
}

/**
 * Abre una ventana de impresión con una réplica idéntica y de alta resolución
 * de la etiqueta física del equipo (estilo chapa industrial con QR).
 */
export function printEquipoQrLabel(equipo: PrintableEquipo): boolean {
  if (typeof window === "undefined") return false;

  const qrUrl = equipo.qr_url || "";
  const qrImg = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrUrl)}`;

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    return false;
  }

  const escapeHtml = (str: string) =>
    str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const safeNombre = escapeHtml(equipo.nombre || "Equipo");
  const safeTipo = equipo.tipo_equipo ? escapeHtml(equipo.tipo_equipo) : "";
  const safeCodigo = equipo.codigo_interno ? escapeHtml(equipo.codigo_interno) : "";
  const safeUbicacion = equipo.ubicacion ? escapeHtml(equipo.ubicacion) : "";

  const metaText =
    [
      safeCodigo ? `TAG: ${safeCodigo}` : null,
      safeUbicacion || null,
    ]
      .filter(Boolean)
      .join(" · ") || "Sin ubicación asignada";

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Etiqueta QR - ${safeNombre}</title>
  <style>
    @page {
      size: auto;
      margin: 10mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 16px;
    }
    .label-card {
      width: 320px;
      max-width: 100%;
      background: #ffffff;
      border: 2px solid #0f172a;
      border-radius: 16px;
      padding: 20px;
      text-align: center;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.08);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }
    .header-tag {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #94a3b8;
      font-weight: 700;
    }
    .title-group {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      width: 100%;
    }
    .title {
      font-size: 18px;
      font-weight: 900;
      color: #0f172a;
      line-height: 1.25;
      word-break: break-word;
    }
    .badge {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 6px;
      background-color: #dbeafe !important;
      color: #1e3a8a !important;
      font-size: 12px;
      font-weight: 700;
      line-height: 1.4;
    }
    .qr-container {
      display: inline-flex;
      padding: 12px;
      background: #ffffff;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.04);
      margin: 2px 0;
    }
    .qr-image {
      width: 180px;
      height: 180px;
      border-radius: 8px;
      display: block;
    }
    .footer-group {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      width: 100%;
    }
    .footer-action {
      font-size: 12px;
      font-weight: 700;
      color: #1e293b;
      letter-spacing: -0.01em;
    }
    .footer-meta {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
      font-size: 11px;
      color: #64748b;
      line-height: 1.3;
    }
  </style>
</head>
<body>
  <div class="label-card">
    <div class="header-tag">LEGAJO TÉCNICO DIGITAL · QR INSPECCIÓN</div>
    <div class="title-group">
      <div class="title">${safeNombre}</div>
      ${safeTipo ? `<div class="badge">${safeTipo}</div>` : ""}
    </div>
    <div class="qr-container">
      <img src="${qrImg}" class="qr-image" alt="Código QR de Inspección" />
    </div>
    <div class="footer-group">
      <div class="footer-action">ESCANEAR PARA AUDITORÍA / INSPECCIÓN</div>
      <div class="footer-meta">${metaText}</div>
    </div>
  </div>
  <script>
    const img = document.querySelector('.qr-image');
    function triggerPrint() {
      setTimeout(function() {
        window.print();
      }, 300);
    }
    if (img && img.complete) {
      triggerPrint();
    } else if (img) {
      img.onload = triggerPrint;
      img.onerror = triggerPrint;
    } else {
      triggerPrint();
    }
  </script>
</body>
</html>`;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  return true;
}
