"use client";

import React, { useEffect, useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { exportSignaturePng, isSignatureEmpty } from "@/lib/signature";

interface SignaturePadProps {
  className?: string;
  heightClassName?: string;
}

/**
 * Pad de firma estable en mobile: tamaño explícito + sin clearOnResize.
 * Evita getTrimmedCanvas colgado midiendo el contenedor una sola vez al montar.
 */
export const SignaturePad = React.forwardRef<
  SignatureCanvas | null,
  SignaturePadProps
>(function SignaturePad({ className = "", heightClassName = "h-44" }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(
    null,
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const measure = () => {
      const rect = el.getBoundingClientRect();
      setSize({
        width: Math.max(1, Math.floor(rect.width)),
        height: Math.max(1, Math.floor(rect.height)),
      });
    };

    measure();
  }, []);

  const setRefs = (instance: SignatureCanvas | null) => {
    if (typeof ref === "function") ref(instance);
    else if (ref) ref.current = instance;
  };

  return (
    <div
      ref={containerRef}
      className={`border border-slate-200 rounded-2xl overflow-hidden bg-slate-50 ${heightClassName} ${className}`}
    >
      {size ? (
        <SignatureCanvas
          ref={setRefs}
          penColor="#1e293b"
          minWidth={0.6}
          maxWidth={2.2}
          clearOnResize={false}
          canvasProps={{
            width: size.width,
            height: size.height,
            className: "touch-none cursor-crosshair bg-slate-50",
            style: {
              width: `${size.width}px`,
              height: `${size.height}px`,
              touchAction: "none",
              display: "block",
            },
          }}
        />
      ) : null}
    </div>
  );
});

export function readSignatureOrThrow(sig: SignatureCanvas | null): string {
  if (!sig || isSignatureEmpty(sig)) {
    throw new Error(
      "Por favor, firmá en el recuadro para confirmar tu asistencia.",
    );
  }
  return exportSignaturePng(sig);
}

export default SignaturePad;
