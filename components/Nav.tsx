import Link from "next/link";

const links = [
  { href: "/dashboard", label: "Patrimonio" },
  { href: "/cuentas", label: "Cuentas" },
  { href: "/movimientos", label: "Movimientos" },
];

export function Nav() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
        <nav className="flex gap-4 text-sm font-medium text-slate-600">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-slate-900">
              {link.label}
            </Link>
          ))}
        </nav>
        <form action="/logout" method="post">
          <button className="text-sm text-slate-500 hover:text-slate-900" type="submit">
            Salir
          </button>
        </form>
      </div>
    </header>
  );
}
