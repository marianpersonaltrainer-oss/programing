/** Deja pintar el paso actual antes de trabajo pesado en el hilo principal. */
export function yieldToUi(ms = 0) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}
