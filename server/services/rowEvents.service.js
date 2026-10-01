// Activated by the API process only; imports and offline scripts do not send alerts.
const listeners = new Set();
export function onRowSaved(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export async function emitRowSaved(model, before, after) {
  const change = { model, before, after };
  for (const listener of listeners) {
    Promise.resolve()
      .then(() => listener(change))
      .catch((error) => console.error(`[WhatsApp queue] ${model}: ${error.message}`));
  }
}
