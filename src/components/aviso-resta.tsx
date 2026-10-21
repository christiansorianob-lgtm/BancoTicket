"use client";
import { useEffect, useRef, useState } from "react";
import { kilosDesdeTexto } from "@/lib/numeros";
import { textoAvisoResta } from "@/lib/mensajes";
import { Mensaje } from "@/components/ui";

/**
 * Mientras el administrador corrige un tiquete: si bruto − tara no da el neto impreso, avisa
 * (solo informativo, no impide guardar; lo que se cobra es el neto impreso).
 */
export function AvisoResta() {
  const ancla = useRef<HTMLDivElement>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    const form = ancla.current?.closest("form");
    if (!form) return;
    const revisar = () => {
      const valor = (n: string) => kilosDesdeTexto(String((form.elements.namedItem(n) as HTMLInputElement | null)?.value ?? "").trim());
      const bruto = valor("peso_bruto_kg"), tara = valor("tara_kg"), neto = valor("neto_impreso_kg");
      setAviso(bruto !== null && tara !== null && neto !== null && bruto - tara !== neto ? textoAvisoResta(bruto, tara, neto) : null);
    };
    revisar();
    form.addEventListener("input", revisar);
    return () => form.removeEventListener("input", revisar);
  }, []);

  return <div ref={ancla} className="sm:col-span-2">{aviso && <Mensaje tono="alerta">{aviso}</Mensaje>}</div>;
}
