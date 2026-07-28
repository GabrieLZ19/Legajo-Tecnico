"use client";

import React, { useRef, useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import ResizeImage from "tiptap-extension-resize-image";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  ImageIcon,
  Heading2,
  Trash2,
} from "lucide-react";
import { useAlert } from "@/context/AlertContext";

interface RichTextEditorProps {
  value: string;
  onChange: (content: string) => void;
  placeholder?: string;
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder,
}: RichTextEditorProps) {
  const { showAlert } = useAlert();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processImageFile = (file: File, editorInstance: any) => {
    if (!file.type.startsWith("image/")) {
      showAlert(
        "error",
        "Archivo no válido",
        "Por favor, selecciona una imagen en formato PNG, JPG o WEBP.",
      );
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showAlert(
        "warning",
        "Imagen muy pesada",
        "La imagen no debe superar los 5MB.",
      );
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        editorInstance.chain().focus().setImage({ src: reader.result }).run();
      }
    };
    reader.onerror = () => {
      showAlert("error", "Error", "No se pudo procesar la imagen.");
    };
    reader.readAsDataURL(file);
  };

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      ResizeImage.configure({
        inline: false,
        allowBase64: true,
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none p-4 min-h-[220px] focus:outline-hidden bg-white rounded-b-xl border-t border-slate-100 text-slate-800 leading-relaxed",
      },
      handleDrop: (view, event, slice, moved) => {
        if (!moved && event.dataTransfer?.files?.length) {
          const file = event.dataTransfer.files[0];
          if (file.type.startsWith("image/")) {
            event.preventDefault();
            processImageFile(file, editor);
            return true;
          }
        }
        return false;
      },
      handlePaste: (view, event) => {
        const items = Array.from(event.clipboardData?.items || []);
        for (const item of items) {
          if (item.type.indexOf("image") === 0) {
            event.preventDefault();
            const file = item.getAsFile();
            if (file) processImageFile(file, editor);
            return true;
          }
        }
        return false;
      },
    },
  });

  // 🛠️ CLAVE: Sincronizar el contenido si cambia el prop 'value' desde afuera
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || "");
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
