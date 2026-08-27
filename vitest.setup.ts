import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});

// jsdom no implementa HTMLFormElement.requestSubmit() (github.com/jsdom/jsdom#3117):
// existe pero no hace nada, y además el propio envío nativo de un <button
// type="submit"> lo usa internamente — sin este polyfill, ningún test que envíe un
// formulario (clic en submit o requestSubmit() explícito, como usa ConfirmForm) llega
// a disparar el evento "submit" real.
if (typeof window !== "undefined") {
  window.HTMLFormElement.prototype.requestSubmit = function requestSubmit(
    this: HTMLFormElement,
    submitter?: HTMLElement
  ) {
    if (!this.checkValidity()) return;
    const event = new Event("submit", { bubbles: true, cancelable: true });
    if (submitter) Object.defineProperty(event, "submitter", { value: submitter });
    this.dispatchEvent(event);
  };
}
