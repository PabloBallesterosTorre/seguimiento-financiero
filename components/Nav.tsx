"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

// Cinco secciones en vez de diez pestañas (auditoría de diseño, tanda 11). Se agrupan por
// la pregunta que responden, no por la tabla que enseñan:
//
//   Resumen     ¿voy bien?          Movimientos  ¿qué ha pasado?
//   Patrimonio  ¿cuánto tengo?      Futuro       ¿qué va a pasar?
//   Informes    ¿en qué se me va?
//
// Dos motivos. Uno de forma: los diez enlaces más el logo medían 1055 px dentro de un
// contenedor limitado a 1024, así que la barra nunca cupo y por debajo de ~1055 px de
// ventana la app entera sacaba scroll horizontal. Y otro de fondo, más importante:
// Previsión, Planificador e Informes competían entre sí —las tres enseñan dinero a lo
// largo del tiempo— y desde ninguna se entendía en qué se diferenciaban. Agrupadas, la
// diferencia la da la sección: Futuro proyecta, Informes mira atrás.
//
// Las rutas NO cambian: `/cuentas` sigue siendo `/cuentas`. Solo cambia cómo se agrupan en
// la barra, así que ningún enlace guardado se rompe.

type Seccion = {
  href: string;
  label: string;
  // Rutas que encienden esta sección, además de la propia. Permite que /categorias marque
  // "Movimientos" aunque cuelgue de otra URL.
  rutas: string[];
  hijos?: { href: string; label: string }[];
};

const secciones: Seccion[] = [
  { href: "/home", label: "Resumen", rutas: ["/home"] },
  {
    href: "/movimientos",
    label: "Movimientos",
    rutas: ["/movimientos", "/categorias"],
    hijos: [
      { href: "/movimientos", label: "Movimientos" },
      { href: "/categorias", label: "Categorías" },
      { href: "/movimientos/importar", label: "Importar" },
    ],
  },
  {
    href: "/cuentas",
    label: "Patrimonio",
    rutas: ["/cuentas", "/inversiones", "/deudas"],
    hijos: [
      { href: "/cuentas", label: "Cuentas" },
      { href: "/inversiones", label: "Inversión" },
      { href: "/deudas", label: "Deuda" },
    ],
  },
  {
    href: "/prevision",
    label: "Futuro",
    rutas: ["/prevision", "/planificador"],
    hijos: [
      { href: "/prevision", label: "Previsión" },
      { href: "/planificador", label: "Planificador" },
    ],
  },
  { href: "/informes", label: "Informes", rutas: ["/informes"] },
];

// Categorías y Configuración no son destinos, son ajustes: se tocan una vez y no se vuelve.
// Ocupaban en la barra el mismo sitio que Movimientos, que se abre a diario. Categorías se
// va con Movimientos, que es donde se usan; Configuración, al menú de usuario.
const ajustes = [{ href: "/configuracion", label: "Configuración" }];

function enSeccion(pathname: string | null, seccion: Seccion): boolean {
  if (!pathname) return false;
  return seccion.rutas.some((r) => pathname === r || pathname.startsWith(`${r}/`));
}

function Logo() {
  return (
    <Link href="/home" className="flex shrink-0 items-center gap-2.5" aria-label="Inicio">
      <div className="flex h-[26px] w-[26px] items-center justify-center rounded-[7px] bg-accent-soft">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <rect x="1" y="8" width="2.6" height="5" rx="1" fill="#2a78d6" />
          <rect x="5.7" y="4.5" width="2.6" height="8.5" rx="1" fill="#2a78d6" />
          <rect x="10.4" y="1" width="2.6" height="12" rx="1" fill="#2a78d6" />
        </svg>
      </div>
      <span className="hidden text-[13px] font-semibold tracking-wide text-ink-tertiary sm:inline">
        Seguimiento Financiero
      </span>
    </Link>
  );
}

function MenuUsuario() {
  const [abierto, setAbierto] = useState(false);
  const contenedor = useRef<HTMLDivElement>(null);

  // Cerrar al pulsar fuera o con Escape: sin esto el menú se queda abierto tapando
  // contenido en cuanto navegas con el teclado.
  useEffect(() => {
    if (!abierto) return;
    function fuera(e: MouseEvent) {
      if (contenedor.current && !contenedor.current.contains(e.target as Node)) setAbierto(false);
    }
    function escape(e: KeyboardEvent) {
      if (e.key === "Escape") setAbierto(false);
    }
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", escape);
    };
  }, [abierto]);

  return (
    <div className="relative shrink-0" ref={contenedor}>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-label="Menú de usuario"
        className="flex h-9 w-9 items-center justify-center rounded-full border border-border-strong text-ink-secondary hover:bg-chip"
      >
        <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
          <circle cx="10" cy="6.5" r="3.2" stroke="currentColor" strokeWidth="1.5" />
          <path d="M3.5 17c.8-3.2 3.4-5 6.5-5s5.7 1.8 6.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      {abierto && (
        <div
          role="menu"
          className="absolute right-0 top-11 z-20 w-52 overflow-hidden rounded-card border border-border bg-surface py-1 shadow-card"
        >
          {ajustes.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              role="menuitem"
              onClick={() => setAbierto(false)}
              className="block px-4 py-2.5 text-sm text-ink-secondary hover:bg-chip hover:text-ink"
            >
              {a.label}
            </Link>
          ))}
          <form action="/logout" method="post" className="border-t border-border">
            <button role="menuitem" type="submit" className="w-full px-4 py-2.5 text-left text-sm text-ink-secondary hover:bg-chip hover:text-ink">
              Salir
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export function Nav() {
  const pathname = usePathname();
  const [abierto, setAbierto] = useState(false);

  const seccionActiva = secciones.find((s) => enSeccion(pathname, s));
  const hijos = seccionActiva?.hijos;

  return (
    <header className="bg-page">
      <div className="mx-auto flex h-16 max-w-5xl items-center gap-4 border-b border-border px-4">
        <Logo />

        {/* `min-w-0` y sin `shrink-0`: con cinco secciones sobra sitio, pero si algún día
            se añade una más la barra cede en vez de sacar scroll horizontal a toda la app. */}
        <nav className="hidden min-w-0 flex-1 items-center gap-6 md:flex">
          {secciones.map((seccion) => {
            const activo = enSeccion(pathname, seccion);
            return (
              <Link
                key={seccion.href}
                href={seccion.href}
                aria-current={activo ? "page" : undefined}
                className={`h-16 whitespace-nowrap border-b-2 pt-[22px] text-sm font-medium ${
                  activo ? "border-accent font-bold text-ink" : "border-transparent text-ink-secondary hover:text-ink"
                }`}
              >
                {seccion.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <div className="hidden md:block">
            <MenuUsuario />
          </div>
          <button
            type="button"
            onClick={() => setAbierto((v) => !v)}
            aria-label={abierto ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={abierto}
            className="flex h-9 w-9 items-center justify-center rounded-btn text-ink hover:bg-chip md:hidden"
          >
            {abierto ? (
              <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
                <path d="M4.5 4.5l11 11M15.5 4.5l-11 11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
                <path d="M3 5.5H17M3 10H17M3 14.5H17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Segunda fila con las pantallas de la sección activa. Va siempre visible en vez de
          desplegarse al pasar el ratón: en una app de datos, saber dónde estás y qué hay al
          lado importa más que ahorrar 40 px de alto. */}
      {hijos && (
        <div className="hidden border-b border-border bg-surface md:block">
          <div className="mx-auto flex max-w-5xl items-center gap-5 px-4">
            {hijos.map((hijo) => {
              const activo = pathname === hijo.href || pathname?.startsWith(`${hijo.href}/`);
              return (
                <Link
                  key={hijo.href}
                  href={hijo.href}
                  aria-current={activo ? "page" : undefined}
                  className={`whitespace-nowrap border-b-2 py-3 text-[13px] ${
                    activo
                      ? "border-ink font-semibold text-ink"
                      : "border-transparent font-medium text-ink-tertiary hover:text-ink"
                  }`}
                >
                  {hijo.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {abierto && (
        <nav className="flex flex-col border-b border-border bg-surface px-4 py-2 text-sm md:hidden">
          {secciones.map((seccion) => {
            const activo = enSeccion(pathname, seccion);
            return (
              <div key={seccion.href}>
                <Link
                  href={seccion.href}
                  onClick={() => setAbierto(false)}
                  className={`block rounded-btn px-2 py-2 font-medium ${
                    activo ? "bg-chip font-semibold text-ink" : "text-ink-secondary hover:bg-chip"
                  }`}
                >
                  {seccion.label}
                </Link>
                {/* En móvil las sub-pantallas solo se despliegan dentro de su sección, para
                    no convertir el menú en la misma lista de diez de antes. */}
                {activo && seccion.hijos && (
                  <div className="mb-1 ml-3 flex flex-col border-l border-border pl-3">
                    {seccion.hijos.map((hijo) => (
                      <Link
                        key={hijo.href}
                        href={hijo.href}
                        onClick={() => setAbierto(false)}
                        className={`rounded-btn px-2 py-1.5 text-[13px] ${
                          pathname === hijo.href ? "font-semibold text-ink" : "text-ink-tertiary hover:text-ink"
                        }`}
                      >
                        {hijo.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          <div className="mt-1 border-t border-border pt-1">
            {ajustes.map((a) => (
              <Link
                key={a.href}
                href={a.href}
                onClick={() => setAbierto(false)}
                className="block rounded-btn px-2 py-2 text-ink-secondary hover:bg-chip"
              >
                {a.label}
              </Link>
            ))}
            <form action="/logout" method="post">
              <button className="w-full rounded-btn px-2 py-2 text-left text-ink-secondary hover:bg-chip" type="submit">
                Salir
              </button>
            </form>
          </div>
        </nav>
      )}
    </header>
  );
}
