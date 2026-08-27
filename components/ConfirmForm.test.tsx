import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmForm } from "./ConfirmForm";

function renderConfirmForm(action: (formData: FormData) => void) {
  return render(
    <ConfirmForm action={action} mensaje="¿Seguro que quieres eliminar esto?">
      <button type="submit">Eliminar</button>
    </ConfirmForm>
  );
}

describe("ConfirmForm", () => {
  it("no ejecuta la acción al enviar el formulario directamente — pide confirmación primero", async () => {
    const action = vi.fn();
    const user = userEvent.setup();
    renderConfirmForm(action);

    await user.click(screen.getByRole("button", { name: "Eliminar" }));

    expect(action).not.toHaveBeenCalled();
    expect(screen.getByText("¿Seguro que quieres eliminar esto?")).toBeInTheDocument();
  });

  it("al cancelar, cierra el modal sin ejecutar la acción", async () => {
    const action = vi.fn();
    const user = userEvent.setup();
    renderConfirmForm(action);

    await user.click(screen.getByRole("button", { name: "Eliminar" }));
    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(action).not.toHaveBeenCalled();
    expect(screen.queryByText("¿Seguro que quieres eliminar esto?")).not.toBeInTheDocument();
  });

  it("al confirmar, reintenta el envío del formulario y cierra el modal", async () => {
    // No se puede comprobar aquí que la Server Action (prop `action`) llega a
    // ejecutarse: `<form action={fn}>` depende del fork de React que usa Next.js en su
    // build, que no está presente al renderizar con Vitest+jsdom fuera de ese
    // pipeline (react-dom vanilla avisa "Invalid value for prop `action`"). Ese tramo
    // final sí está verificado manualmente contra la app real (Playwright). Lo que sí
    // es responsabilidad propia de ConfirmForm, y lo que se prueba aquí, es que
    // "Confirmar" reintenta el envío nativo del formulario (vía requestSubmit) en vez
    // de quedarse bloqueado por el preventDefault del primer intento.
    const action = vi.fn();
    const user = userEvent.setup();
    const requestSubmitSpy = vi.spyOn(HTMLFormElement.prototype, "requestSubmit");
    renderConfirmForm(action);

    await user.click(screen.getByRole("button", { name: "Eliminar" }));
    await user.click(screen.getByRole("button", { name: "Confirmar" }));

    expect(requestSubmitSpy).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("¿Seguro que quieres eliminar esto?")).not.toBeInTheDocument();
  });

  it("la tecla Escape cierra el modal sin ejecutar la acción", async () => {
    const action = vi.fn();
    const user = userEvent.setup();
    renderConfirmForm(action);

    await user.click(screen.getByRole("button", { name: "Eliminar" }));
    await user.keyboard("{Escape}");

    expect(action).not.toHaveBeenCalled();
    expect(screen.queryByText("¿Seguro que quieres eliminar esto?")).not.toBeInTheDocument();
  });
});
