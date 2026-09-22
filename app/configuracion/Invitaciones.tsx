"use client";

import { useState } from "react";
import { ConfirmForm } from "@/components/ConfirmForm";
import {
  enlaceInvitacion,
  estadoInvitacion,
  type EstadoInvitacion,
  type Invitacion,
} from "@/lib/invitaciones";
import {
  inputClass,
  labelClass,
  btnPrimaryClass,
  cardClass,
  rowDelClass,
  tableWrapClass,
} from "@/components/formStyles";

const ETIQUETA_ESTADO: Record<EstadoInvitacion, string> = {
  pendiente: "Pendiente",
  usada: "Usada",
  caducada: "Caducada",
};

const CLASE_ESTADO: Record<EstadoInvitacion, string> = {
  pendiente: "bg-chip text-ink-secondary",
  usada: "bg-success/10 text-success",
  caducada: "bg-chip text-faint",
};

function formatFecha(iso: string): string {
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", year: "numeric" }).format(
    new Date(iso)
  );
}

// El botón de copiar vive en el cliente porque el enlace se construye con el origen real
// del navegador (`window.location.origin`). Así sale correcto en local, en la URL de
// previsualización de Vercel y en el dominio de producción, sin una env var que
// mantener al día ni el riesgo de repartir enlaces que apunten al sitio equivocado.
function CopiarEnlace({ codigo }: { codigo: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    const enlace = enlaceInvitacion(window.location.origin, codigo);
    try {
      await navigator.clipboard.writeText(enlace);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sin permiso de portapapeles (o sin HTTPS): al menos que pueda copiarlo a mano.
      window.prompt("Copia el enlace de invitación:", enlace);
    }
  }

  return (
    <button type="button" onClick={copiar} className="text-[13px] font-semibold text-accent">
      {copiado ? "¡Copiado!" : "Copiar enlace"}
    </button>
  );
}

export function Invitaciones({
  invitaciones,
  crearInvitacion,
  revocarInvitacion,
}: {
  invitaciones: Invitacion[];
  crearInvitacion: (formData: FormData) => void;
  revocarInvitacion: (formData: FormData) => void;
}) {
  const ahora = new Date();

  return (
    <div className="space-y-6">
      <div className={cardClass}>
        <h2 className="font-sora text-base font-semibold text-ink">Invitar a alguien</h2>
        <p className="mt-1.5 max-w-3xl text-[13px] text-ink-secondary">
          El alta está cerrada: solo se puede crear una cuenta con una invitación. Escribe el email de
          la persona, cópiale el enlace y envíaselo. Solo ese email puede canjearla, una única vez, y
          caduca a los 30 días.
        </p>

        <form action={crearInvitacion} className="mt-5 flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <label htmlFor="inv-email" className={labelClass}>
              Email de quien invitas
            </label>
            <input id="inv-email" name="email" type="email" required className={inputClass} />
          </div>
          <div className="min-w-[180px] flex-1">
            <label htmlFor="inv-nota" className={labelClass}>
              Nota (opcional)
            </label>
            <input
              id="inv-nota"
              name="nota"
              placeholder="Para acordarte de quién es"
              className={inputClass}
            />
          </div>
          <button type="submit" className={btnPrimaryClass}>
            Crear invitación
          </button>
        </form>
      </div>

      {invitaciones.length === 0 ? (
        <p className="text-sm text-ink-tertiary">Todavía no has creado ninguna invitación.</p>
      ) : (
        <div className={tableWrapClass}>
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-border text-xs text-ink-secondary">
              <tr>
                <th className="px-3 py-2 font-medium">Código</th>
                <th className="px-3 py-2 font-medium">Para</th>
                <th className="px-3 py-2 font-medium">Estado</th>
                <th className="px-3 py-2 font-medium">Caduca</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {invitaciones.map((inv) => {
                const estado = estadoInvitacion(inv, ahora);
                return (
                  <tr key={inv.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2.5 font-mono text-[13px] text-ink">{inv.codigo}</td>
                    <td className="px-3 py-2.5">
                      <span className="text-ink">{inv.email}</span>
                      {inv.nota && <span className="block text-xs text-ink-tertiary">{inv.nota}</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${CLASE_ESTADO[estado]}`}
                      >
                        {ETIQUETA_ESTADO[estado]}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-[13px] text-ink-secondary">
                      {estado === "usada" && inv.usada_en ? `Usada el ${formatFecha(inv.usada_en)}` : formatFecha(inv.caduca_en)}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-3">
                        {estado === "pendiente" && <CopiarEnlace codigo={inv.codigo} />}
                        <ConfirmForm
                          action={revocarInvitacion}
                          mensaje={
                            estado === "usada"
                              ? `Se borrará el registro de la invitación de ${inv.email}. La cuenta que creó con ella no se toca.`
                              : `Se anulará la invitación de ${inv.email} y su enlace dejará de funcionar.`
                          }
                        >
                          <input type="hidden" name="id" value={inv.id} />
                          <button type="submit" className={rowDelClass}>
                            {estado === "usada" ? "Borrar" : "Revocar"}
                          </button>
                        </ConfirmForm>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
