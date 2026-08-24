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
