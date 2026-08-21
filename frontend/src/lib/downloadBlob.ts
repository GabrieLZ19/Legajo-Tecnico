/** Utilidad para descargas binarias (PDF/CSV) vía axios blob. */

export async function assertDownloadBlob(
  data: Blob,
  expectedMimeHint?: "pdf" | "csv",
): Promise<Blob> {
  if (!(data instanceof Blob)) {
    throw new Error("Respuesta de descarga inválida");
  }

  const type = (data.type || "").toLowerCase();
  const looksJson =
    type.includes("application/json") || type.includes("text/plain");

  if (looksJson || data.size < 8) {
    const text = await data.text();
    try {
      const parsed = JSON.parse(text) as { error?: string };
      throw new Error(parsed.error || "No se pudo descargar el archivo");
    } catch (err) {
      if (err instanceof Error && !err.message.includes("JSON")) {
        throw err;
      }
      throw new Error("No se pudo descargar el archivo");
    }
  }

  if (expectedMimeHint === "pdf") {
    const header = await data.slice(0, 5).text();
    if (!header.startsWith("%PDF")) {
      const text = await data.text();
      try {
        const parsed = JSON.parse(text) as { error?: string };
        throw new Error(parsed.error || "El archivo PDF es inválido");
      } catch (err) {
        if (err instanceof Error && err.message.includes("PDF")) throw err;
        throw new Error("El archivo PDF es inválido");
      }
    }
  }

  return data;
}

export function triggerBrowserDownload(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  link.parentNode?.removeChild(link);
  window.URL.revokeObjectURL(url);
}
