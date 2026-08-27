import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NuevaDeuda } from "./NuevaDeuda";

// NuevaDeuda es representativa del patrón "formulario bajo demanda" repetido en toda
// la app (Cuentas, Categorías, Inversión, Movimientos previstos…): un botón revela el
// formulario, "Cancelar" lo oculta sin guardar nada, y enviar lo vuelve a ocultar tras
// llamar a la acción.
describe("NuevaDeuda (patrón formulario bajo demanda)", () => {
  it("arranca colapsado, mostrando solo el botón para abrir el formulario", () => {
    render(<NuevaDeuda action={vi.fn()} />);

    expect(screen.getByRole("button", { name: "+ Añadir deuda" })).toBeInTheDocument();
    expect(screen.queryByText("Añadir deuda")).not.toBeInTheDocument();
  });

  it("al pulsar el botón, despliega el formulario", async () => {
    const user = userEvent.setup();
    render(<NuevaDeuda action={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "+ Añadir deuda" }));

    expect(screen.getByRole("heading", { name: "Añadir deuda" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Hipoteca vivienda habitual")).toBeInTheDocument();
  });

  it("al cancelar, vuelve a colapsar el formulario sin llamar a la acción", async () => {
    const action = vi.fn();
    const user = userEvent.setup();
    render(<NuevaDeuda action={action} />);

    await user.click(screen.getByRole("button", { name: "+ Añadir deuda" }));
    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(action).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "+ Añadir deuda" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Añadir deuda" })).not.toBeInTheDocument();
  });

  it("con los campos obligatorios rellenos, el formulario pasa su propia validación nativa", async () => {
    // No se puede comprobar aquí que la Server Action (prop `action`) llega a
    // ejecutarse ni que el formulario se vuelve a colapsar tras enviarla: eso depende
    // de `<form action={fn}>`, que a su vez depende del fork de React que usa Next.js
    // en su build y no está presente al renderizar con Vitest+jsdom fuera de ese
    // pipeline (react-dom vanilla avisa "Invalid value for prop `action`"). Ese tramo
    // final sí está verificado manualmente contra la app real (Playwright). Lo que sí
    // se puede probar aquí es la parte que si falla rompe el envío en cualquier
    // entorno: que con los campos obligatorios (tipo, nombre, capital inicial, cuota,
    // fecha de inicio) rellenos, la validación nativa del formulario ya no lo bloquea.
    const user = userEvent.setup();
    const { container } = render(<NuevaDeuda action={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "+ Añadir deuda" }));
    const form = container.querySelector("form")!;
    expect(form.checkValidity()).toBe(false);

    await user.type(screen.getByPlaceholderText("Hipoteca, préstamo, coche…"), "Hipoteca");
    await user.type(screen.getByPlaceholderText("Hipoteca vivienda habitual"), "Vivienda habitual");
    // "Capital inicial", "Cuota" y "Fecha inicio" no tienen placeholder ni label
    // asociado por htmlFor/id en el markup actual, así que se seleccionan por nombre
    // de campo directamente (ver hallazgo de accesibilidad pendiente en la auditoría).
    await user.type(container.querySelector('input[name="capital_inicial"]')!, "150000");
    await user.type(container.querySelector('input[name="cuota"]')!, "650");
    // Los inputs type="date" no se rellenan de forma fiable con userEvent.type en
    // jsdom (edición por segmentos que jsdom no emula como un navegador real) — se
    // fija el valor directamente, como haría un date picker nativo.
    fireEvent.change(container.querySelector('input[name="fecha_inicio"]')!, {
      target: { value: "2023-01-01" },
    });

    expect(form.checkValidity()).toBe(true);
  });
});
