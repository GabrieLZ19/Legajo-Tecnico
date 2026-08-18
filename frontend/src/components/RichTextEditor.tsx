"use client";

import React, { useRef, useEffect } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import ResizeImage from "tiptap-extension-resize-image";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import { TextStyle, Color } from "@tiptap/extension-text-style";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  ImageIcon,
  Heading2,
  Trash2,
  Undo2,
} from "lucide-react";
import { useAlert } from "@/context/AlertContext";
import { sanitizeRichHtml } from "@/lib/sanitizeHtml";

/** Conserva fondo y alineación al pegar tablas desde Word. */
const CapTableCell = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      backgroundColor: {
        default: null,
        parseHTML: (element) =>
          element.style.backgroundColor ||
          element.getAttribute("bgcolor") ||
          null,
        renderHTML: (attributes) => {
          if (!attributes.backgroundColor) return {};
          return {
            style: `background-color: ${attributes.backgroundColor}`,
          };
        },
      },
      textAlign: {
        default: null,
        parseHTML: (element) =>
          element.style.textAlign || element.getAttribute("align") || null,
        renderHTML: (attributes) => {
          if (!attributes.textAlign) return {};
          return { style: `text-align: ${attributes.textAlign}` };
        },
      },
    };
  },
});

const CapTableHeader = TableHeader.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      backgroundColor: {
        default: null,
        parseHTML: (element) =>
          element.style.backgroundColor ||
          element.getAttribute("bgcolor") ||
          null,
        renderHTML: (attributes) => {
          if (!attributes.backgroundColor) return {};
          return {
            style: `background-color: ${attributes.backgroundColor}`,
          };
        },
      },
      textAlign: {
        default: null,
        parseHTML: (element) =>
          element.style.textAlign || element.getAttribute("align") || null,
        renderHTML: (attributes) => {
          if (!attributes.textAlign) return {};
          return { style: `text-align: ${attributes.textAlign}` };
        },
      },
    };
  },
});

interface RichTextEditorProps {
  value: string;
  onChange: (content: string) => void;
  placeholder?: string;
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("No se pudo leer la imagen"));
    };
    reader.onerror = () => reject(new Error("No se pudo leer la imagen"));
    reader.readAsDataURL(file);
  });
}

async function sourceToDataUrl(src: string): Promise<string | null> {
  if (src.startsWith("data:image/")) return src;

  if (src.startsWith("blob:") || /^https?:\/\//i.test(src)) {
    try {
      const response = await fetch(src);
      if (!response.ok) return null;
      const blob = await response.blob();
      if (!blob.type.startsWith("image/")) return null;
      if (blob.size > MAX_IMAGE_BYTES) return null;
      return await fileToDataUrl(
        new File([blob], "pasted-image", { type: blob.type || "image/png" }),
      );
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Convierte imgs del HTML pegado a data URLs embebidas.
 * Para src rotos (file://, cid:, etc.) usa las imágenes del portapapeles en orden.
 */
async function embedClipboardImagesInHtml(
  html: string,
  clipboardImages: File[],
): Promise<{ html: string; recovered: number; dropped: number }> {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const imgs = Array.from(doc.querySelectorAll("img"));
  let fileIndex = 0;
  let recovered = 0;
  let dropped = 0;

  for (const img of imgs) {
    const src = img.getAttribute("src")?.trim() || "";
    let dataUrl = await sourceToDataUrl(src);

    if (!dataUrl && fileIndex < clipboardImages.length) {
      const file = clipboardImages[fileIndex++];
      if (file.size <= MAX_IMAGE_BYTES) {
        try {
          dataUrl = await fileToDataUrl(file);
        } catch {
          dataUrl = null;
        }
      }
    }

    if (dataUrl) {
      img.setAttribute("src", dataUrl);
      img.removeAttribute("srcset");
      recovered += 1;
    } else {
      img.remove();
      dropped += 1;
    }
  }

  return { html: doc.body.innerHTML, recovered, dropped };
}

/** Limpia HTML de Word/Office para que TipTap conserve tablas y formato útil. */
function sanitizePastedHtml(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  doc
    .querySelectorAll("style, meta, link, script, xml, noscript")
    .forEach((el) => el.remove());

  doc.querySelectorAll("*").forEach((el) => {
    // Atributos propietarios de Word que no aportan al editor
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (
        name.startsWith("o:") ||
        name.startsWith("v:") ||
        name.startsWith("w:") ||
        name === "class" ||
        name === "lang" ||
        name.startsWith("data-")
      ) {
        el.removeAttribute(attr.name);
      }
    }
  });

  // Word a veces deja párrafos vacíos con &nbsp; dentro de celdas; TipTap los tolera.
  return doc.body.innerHTML;
}

function collectClipboardImages(clipboardData: DataTransfer): File[] {
  const fromItems = Array.from(clipboardData.items || [])
    .filter((item) => item.type.startsWith("image/"))
    .map((item) => item.getAsFile())
    .filter((file): file is File => !!file);

  if (fromItems.length > 0) return fromItems;

  return Array.from(clipboardData.files || []).filter((file) =>
    file.type.startsWith("image/"),
  );
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder,
}: RichTextEditorProps) {
  const { showAlert } = useAlert();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<Editor | null>(null);
  const showAlertRef = useRef(showAlert);
  showAlertRef.current = showAlert;

  const processImageFile = (file: File, editorInstance: Editor) => {
    if (!file.type.startsWith("image/")) {
      showAlertRef.current(
        "error",
        "Archivo no válido",
        "Por favor, selecciona una imagen en formato PNG, JPG o WEBP.",
      );
      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      showAlertRef.current(
        "warning",
        "Imagen muy pesada",
        "La imagen no debe superar los 5MB.",
      );
      return;
    }

    void fileToDataUrl(file)
      .then((dataUrl) => {
        editorInstance.chain().focus().setImage({ src: dataUrl }).run();
      })
      .catch(() => {
        showAlertRef.current("error", "Error", "No se pudo procesar la imagen.");
      });
  };

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      TextStyle,
      Color,
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          class: "cap-table",
        },
      }),
      TableRow,
      CapTableHeader,
      CapTableCell,
      ResizeImage.configure({
        inline: false,
        allowBase64: true,
      }),
    ],
    content: sanitizeRichHtml(value),
    onCreate: ({ editor: created }) => {
      editorRef.current = created;
    },
    onDestroy: () => {
      editorRef.current = null;
    },
    onUpdate: ({ editor: updated }) => {
      onChange(updated.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none p-4 min-h-[220px] focus:outline-hidden bg-white rounded-b-xl border-t border-slate-100 text-slate-800 leading-relaxed",
      },
      transformPastedHTML: (html) => sanitizePastedHtml(html),
      handleDrop: (view, event, _slice, moved) => {
        if (!moved && event.dataTransfer?.files?.length) {
          const ed = editorRef.current;
          if (!ed) return false;
          const file = event.dataTransfer.files[0];
          if (file.type.startsWith("image/")) {
            event.preventDefault();
            processImageFile(file, ed);
            return true;
          }
        }
        return false;
      },
      handlePaste: (_view, event) => {
        const clipboardData = event.clipboardData;
        const ed = editorRef.current;
        if (!clipboardData || !ed) return false;

        const clipboardImages = collectClipboardImages(clipboardData);
        const html = clipboardData.getData("text/html");
        const hasHtmlImages = /<img[\s>]/i.test(html);
        const hasHtmlTable = /<table[\s>]/i.test(html);

        // Pegado con HTML rico (tablas y/o imágenes desde Word, Excel, etc.)
        if (html && (hasHtmlImages || hasHtmlTable)) {
          event.preventDefault();
          void (async () => {
            let processed = sanitizePastedHtml(html);
            let dropped = 0;

            if (hasHtmlImages) {
              const result = await embedClipboardImagesInHtml(
                processed,
                clipboardImages,
              );
              processed = result.html;
              dropped = result.dropped;
            }

            if (processed.trim()) {
              ed.chain().focus().insertContent(processed).run();
            }

            if (dropped > 0 && clipboardImages.length === 0) {
              showAlertRef.current(
                "warning",
                "Algunas imágenes no se pudieron pegar",
                "Usá el botón «Insertar Imagen» o copiá la imagen sola (no desde Word/PowerPoint) y pegala con Ctrl+V.",
              );
            }
          })();
          return true;
        }

        // Pegado directo de imagen / captura de pantalla
        if (clipboardImages.length > 0) {
          event.preventDefault();
          clipboardImages.forEach((file) => processImageFile(file, ed));
          return true;
        }

        return false;
      },
    },
  });

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  // Sincronizar el contenido si cambia el prop 'value' desde afuera
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(sanitizeRichHtml(value || ""));
    }
  }, [value, editor]);

  if (!editor) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processImageFile(file, editor);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const isImageSelected = editor.isActive("image");

  const deleteSelectedImage = () => {
    if (isImageSelected) {
      editor.chain().focus().deleteSelection().run();
    }
  };

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs focus-within:ring-2 focus-within:ring-blue-500/25 focus-within:border-blue-500 transition-all">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />

      <div className="flex flex-wrap items-center justify-between gap-1 p-2 bg-slate-50 border-b border-slate-200 select-none">
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`p-1.5 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer ${
              editor.isActive("bold")
                ? "bg-slate-200 text-blue-600 font-bold"
                : "text-slate-600"
            }`}
            title="Negrita"
          >
            <Bold className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`p-1.5 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer ${
              editor.isActive("italic")
                ? "bg-slate-200 text-blue-600"
                : "text-slate-600"
            }`}
            title="Cursiva"
          >
            <Italic className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 2 }).run()
            }
            className={`p-1.5 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer ${
              editor.isActive("heading", { level: 2 })
                ? "bg-slate-200 text-blue-600"
                : "text-slate-600"
            }`}
            title="Subtítulo"
          >
            <Heading2 className="h-4 w-4" />
          </button>

          <div className="h-4 w-px bg-slate-300 mx-1" />

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`p-1.5 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer ${
              editor.isActive("bulletList")
                ? "bg-slate-200 text-blue-600"
                : "text-slate-600"
            }`}
            title="Lista con viñetas"
          >
            <List className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`p-1.5 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer ${
              editor.isActive("orderedList")
                ? "bg-slate-200 text-blue-600"
                : "text-slate-600"
            }`}
            title="Lista numerada"
          >
            <ListOrdered className="h-4 w-4" />
          </button>

          <div className="h-4 w-px bg-slate-300 mx-1" />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-700 transition-colors flex items-center gap-1.5 text-xs font-bold cursor-pointer bg-white border border-slate-200 shadow-2xs"
            title="Cargar imagen desde equipo"
          >
            <ImageIcon className="h-4 w-4 text-blue-600" />
            <span>Insertar Imagen</span>
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-700 transition-colors flex items-center gap-1.5 text-xs font-bold cursor-pointer bg-white border border-slate-200 shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white"
            title="Deshacer (Ctrl+Z)"
          >
            <Undo2 className="h-4 w-4 text-slate-600" />
            <span>Deshacer</span>
          </button>
        </div>

        {isImageSelected && (
          <button
            type="button"
            onClick={deleteSelectedImage}
            className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg transition-all cursor-pointer flex items-center gap-1 text-xs font-bold animate-in fade-in duration-200"
            title="Eliminar imagen seleccionada"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Eliminar Imagen</span>
          </button>
        )}
      </div>

      <div className="relative">
        <EditorContent editor={editor} placeholder={placeholder} />
      </div>
    </div>
  );
}
