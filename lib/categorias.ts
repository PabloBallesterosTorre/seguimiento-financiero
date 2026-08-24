export type CategoriaPlana = {
  id: string;
  nombre: string;
  categoria_padre_id: string | null;
};

export type CategoriaJerarquica = {
  id: string;
  nombre: string;
  label: string;
};

// Ordena las categorías como lista plana para un <select>: cada categoría padre
// seguida de sus subcategorías (con "— " para indicar el nivel).
export function ordenarCategoriasJerarquia(categorias: CategoriaPlana[]): CategoriaJerarquica[] {
  const padres = categorias.filter((c) => c.categoria_padre_id === null);
  const resultado: CategoriaJerarquica[] = [];

  for (const padre of padres) {
    resultado.push({ id: padre.id, nombre: padre.nombre, label: padre.nombre });
    const hijos = categorias.filter((c) => c.categoria_padre_id === padre.id);
    for (const hijo of hijos) {
      resultado.push({ id: hijo.id, nombre: hijo.nombre, label: `— ${hijo.nombre}` });
    }
  }

  return resultado;
}
