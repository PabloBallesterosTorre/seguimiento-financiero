export type ReglaCategorizacion = {
  patron_descripcion: string;
  categoria_id: string;
  veces_usada: number;
};

export function normalizarDescripcion(texto: string) {
  return texto.trim().toLowerCase();
}

// Sugiere la categoría de una regla cuyo patrón está contenido en la descripción
// (o viceversa), quedándose con la coincidencia más específica (patrón más largo)
// y, en caso de empate, la más usada.
export function sugerirCategoria(
  descripcion: string,
  reglas: ReglaCategorizacion[]
): string | null {
  const texto = normalizarDescripcion(descripcion);
  if (!texto) return null;

  let mejor: ReglaCategorizacion | null = null;

  for (const regla of reglas) {
    const patron = regla.patron_descripcion;
    if (!patron) continue;
    const coincide = texto.includes(patron) || patron.includes(texto);
    if (!coincide) continue;

    if (
      !mejor ||
      patron.length > mejor.patron_descripcion.length ||
      (patron.length === mejor.patron_descripcion.length && regla.veces_usada > mejor.veces_usada)
    ) {
      mejor = regla;
    }
  }

  return mejor?.categoria_id ?? null;
}
