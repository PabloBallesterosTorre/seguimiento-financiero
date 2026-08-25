// Parser de CSV genérico: soporta campos entre comillas (con comas, delimitadores
// o saltos de línea dentro) y comillas escapadas ("").
export function parseCSV(texto: string, delimitador: string): string[][] {
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = "";
  let dentroComillas = false;

  const contenido = texto.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < contenido.length; i++) {
    const char = contenido[i];

    if (dentroComillas) {
      if (char === '"') {
        if (contenido[i + 1] === '"') {
          campo += '"';
          i++;
        } else {
          dentroComillas = false;
        }
      } else {
        campo += char;
      }
      continue;
    }

    if (char === '"') {
      dentroComillas = true;
    } else if (char === delimitador) {
      fila.push(campo);
      campo = "";
    } else if (char === "\n") {
      fila.push(campo);
      filas.push(fila);
      fila = [];
      campo = "";
    } else {
      campo += char;
    }
  }

  if (campo.length > 0 || fila.length > 0) {
    fila.push(campo);
    filas.push(fila);
  }

  return filas
    .map((f) => f.map((v) => v.trim()))
    .filter((f) => f.some((v) => v !== ""));
}

const PARECE_NUMERO_O_FECHA = /^-?\d+([.,]\d+)?$|^\d{1,4}[/\-.]\d{1,2}[/\-.]\d{1,4}/;

// Detecta en qué fila (1-indexada) está la cabecera real de la tabla, para saltar
// filas de metadatos que algunos bancos meten antes (título del informe, fecha de
// generación, IBAN enmascarado...). Busca la última fila "todo texto" (sin ninguna
// celda que parezca número o fecha) justo antes de que la fila siguiente ya tenga
// pinta de datos — esa fila de transición es la cabecera. Contar solo celdas no
// vacías no sirve: en archivos con columnas opcionales (ej. extractos con muchos
// campos en blanco según el tipo de movimiento) las filas de datos no comparten un
// recuento fijo de celdas.
export function detectarFilaCabecera(filas: string[][]): number {
  const muestra = filas.slice(0, 15);

  for (let i = 0; i < muestra.length - 1; i++) {
    const fila = muestra[i];
    const siguiente = muestra[i + 1];

    const filaConVariasCeldas = fila.filter((v) => v.trim() !== "").length >= 3;
    const filaSinDatos = !fila.some((v) => v.trim() !== "" && PARECE_NUMERO_O_FECHA.test(v.trim()));
    const siguienteConDatos = siguiente.some((v) => v.trim() !== "" && PARECE_NUMERO_O_FECHA.test(v.trim()));

    if (filaConVariasCeldas && filaSinDatos && siguienteConDatos) {
      return i + 1;
    }
  }

  return 1;
}

// Detecta el delimitador más probable contando ocurrencias en la línea de cabecera.
export function detectarDelimitador(lineaCabecera: string): string {
  const candidatos = [",", ";", "\t"];
  let mejor = ",";
  let mejorCount = -1;

  for (const candidato of candidatos) {
    const count = lineaCabecera.split(candidato).length - 1;
    if (count > mejorCount) {
      mejorCount = count;
      mejor = candidato;
    }
  }

  return mejor;
}
