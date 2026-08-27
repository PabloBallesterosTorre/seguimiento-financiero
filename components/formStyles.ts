// Clases Tailwind compartidas por los formularios "bajo demanda" de toda la app,
// para que el sistema visual (tokens del rediseño, tanda 8) se aplique de forma
// consistente sin repetir la misma cadena larga en cada pantalla.
export const inputClass =
  "w-full rounded-btn border border-border-strong bg-field px-3 py-2.5 text-sm text-ink placeholder:text-faint";
export const labelClass = "mb-1.5 block text-xs font-semibold text-ink-secondary";
export const btnPrimaryClass = "rounded-btn bg-ink px-[18px] py-2.5 text-sm font-semibold text-white hover:bg-ink/90";
export const btnSecondaryClass =
  "rounded-btn border border-border-strong bg-surface px-[18px] py-2.5 text-sm font-semibold text-ink-secondary hover:bg-chip";
export const cardClass = "rounded-card border border-border bg-surface p-7 shadow-card";
export const tableWrapClass = "overflow-x-auto rounded-card border border-border bg-surface shadow-card";
export const rowLinkClass = "text-[13px] font-semibold text-accent";
export const rowDelClass = "text-[13px] font-semibold text-faint hover:text-danger";
