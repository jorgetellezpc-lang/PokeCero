import type { SaveStore } from './save';

// Modo admin: acceso a todo para probar el juego (oro y tickets ilimitados,
// todos los pueblos y gimnasios jugables abiertos). Se activa en Ajustes con
// contraseña. Solo guarda su huella SHA-256; aun así, es una barrera de juego,
// no seguridad real: todo vive en el navegador.

const ADMIN_HASH = '775e21963a3d240c9a87ac0d70030a0cb5fb9d442313acee042903ead30fff4e';

/** Oro y tickets que mantiene el modo admin. */
export const ADMIN_FUNDS = 999_999;

export const isAdmin = (store: SaveStore) => !!store.data.admin;

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Comprueba la contraseña (se admite con o sin «:» delante). */
export async function checkAdminPassword(pw: string): Promise<boolean> {
  const clean = pw.trim().replace(/^:/, '');
  return (await sha256(clean)) === ADMIN_HASH;
}

/** Activa el modo admin guardando el oro y los tickets reales para devolverlos al desactivarlo. */
export function enableAdmin(store: SaveStore): void {
  if (isAdmin(store)) return;
  store.update((d) => {
    d.adminBackup = { gold: d.gold, tickets: d.tickets };
    d.admin = true;
  });
}

export function disableAdmin(store: SaveStore): void {
  if (!isAdmin(store)) return;
  store.update((d) => {
    d.admin = false;
    d.gold = d.adminBackup?.gold ?? d.gold;
    d.tickets = d.adminBackup?.tickets ?? d.tickets;
    delete d.adminBackup;
  });
}
