"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const links = [
  { href: "/home", label: "Patrimonio" },
  { href: "/cuentas", label: "Cuentas" },
  { href: "/movimientos", label: "Movimientos" },
  { href: "/categorias", label: "Categorías" },
  { href: "/inversiones", label: "Inversión" },
  { href: "/deudas", label: "Deuda" },
  { href: "/prevision", label: "Previsión" },
  { href: "/planificador", label: "Planificador" },
  { href: "/informes", label: "Informes" },
  { href: "/configuracion", label: "Configuración" },
];

function Logo() {
  return (
    <div className="flex items-center gap-2.5 pb-[19px]">
      <div className="flex h-[26px] w-[26px] items-center justify-center rounded-[7px] bg-accent-soft">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <rect x="1" y="8" width="2.6" height="5" rx="1" fill="#2a78d6" />
          <rect x="5.7" y="4.5" width="2.6" height="8.5" rx="1" fill="#2a78d6" />
          <rect x="10.4" y="1" width="2.6" height="12" rx="1" fill="#2a78d6" />
        </svg>
      </div>
      <span className="text-[13px] font-semibold tracking-wide text-ink-tertiary">Seguimiento Financiero</span>
    </div>
  );
}

export function Nav() {
  const pathname = usePathname();
  const [abierto, setAbierto] = useState(false);

  return (
    <header className="bg-page">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between border-b border-border px-4">
        <Logo />
        <nav className="ml-9 hidden shrink-0 items-center gap-5 md:flex">
          {links.map((link) => {
            const activo = pathname?.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`whitespace-nowrap border-b-2 pb-[19px] text-sm font-medium ${
                  activo
                    ? "border-accent font-bold text-ink"
                    : "border-transparent text-ink-secondary hover:text-ink"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          aria-label={abierto ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={abierto}
          className="flex h-9 w-9 items-center justify-center rounded-btn text-ink hover:bg-chip md:hidden"
        >
          {abierto ? (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" className="h-5 w-5">
              <path d="M4.5 4.5l11 11M15.5 4.5l-11 11" stroke="#0b0b0b" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" className="h-5 w-5">
              <path d="M3 5.5H17M3 10H17M3 14.5H17" stroke="#0b0b0b" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          )}
        </button>
        <form action="/logout" method="post" className="ml-6 hidden shrink-0 pb-[19px] md:block">
          <button className="text-sm font-semibold text-ink-secondary hover:text-ink" type="submit">
            Salir
          </button>
        </form>
      </div>

      {abierto && (
        <nav className="flex flex-col border-b border-border bg-surface px-4 py-2 text-sm font-medium text-ink-secondary md:hidden">
          {links.map((link) => {
            const activo = pathname?.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setAbierto(false)}
                className={`rounded-btn px-2 py-2 ${activo ? "bg-chip font-semibold text-ink" : "hover:bg-chip"}`}
              >
                {link.label}
              </Link>
            );
          })}
          <form action="/logout" method="post" className="mt-1 border-t border-border pt-2">
            <button className="w-full rounded-btn px-2 py-2 text-left text-ink-secondary hover:bg-chip" type="submit">
              Salir
            </button>
          </form>
        </nav>
      )}
    </header>
  );
}
