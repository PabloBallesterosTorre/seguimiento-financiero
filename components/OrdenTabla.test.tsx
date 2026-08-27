import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useOrdenTabla, ThOrdenable } from "./OrdenTabla";

const guardarOrdenTablaMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/actions/ordenTabla", () => ({
  guardarOrdenTabla: guardarOrdenTablaMock,
}));

// Tabla mínima que usa el hook igual que las tablas reales de la app (Movimientos,
// Cuentas, Deuda…), para probar el ciclo de clics y la persistencia sin depender de
// ninguna pantalla concreta.
function TablaDePrueba() {
  const { orden, toggle } = useOrdenTabla("tabla_prueba", null);
  return (
    <table>
      <thead>
        <tr>
          <ThOrdenable columna="nombre" orden={orden} onToggle={toggle}>
            Nombre
          </ThOrdenable>
        </tr>
      </thead>
    </table>
  );
}

describe("useOrdenTabla + ThOrdenable (orden de tabla persistente)", () => {
  it("primer clic en una columna ordena ascendente y lo persiste", async () => {
    const user = userEvent.setup();
    render(<TablaDePrueba />);

    await user.click(screen.getByRole("columnheader", { name: /Nombre/ }));

    expect(guardarOrdenTablaMock).toHaveBeenCalledWith("tabla_prueba", "nombre", "asc");
  });

  it("segundo clic en la misma columna cambia a descendente", async () => {
    const user = userEvent.setup();
    render(<TablaDePrueba />);

    const cabecera = screen.getByRole("columnheader", { name: /Nombre/ });
    await user.click(cabecera);
    await user.click(cabecera);

    expect(guardarOrdenTablaMock).toHaveBeenLastCalledWith("tabla_prueba", "nombre", "desc");
  });

  it("tercer clic vuelve a ascendente (alterna, no cicla a 'sin orden')", async () => {
    const user = userEvent.setup();
    render(<TablaDePrueba />);

    const cabecera = screen.getByRole("columnheader", { name: /Nombre/ });
    await user.click(cabecera);
    await user.click(cabecera);
    await user.click(cabecera);

    expect(guardarOrdenTablaMock).toHaveBeenLastCalledWith("tabla_prueba", "nombre", "asc");
  });
});
