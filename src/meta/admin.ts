import type { SaveStore } from './save';

// Modo admin: acceso a todo para probar el juego (oro y tickets ilimitados,
// todos los pueblos y gimnasios jugables abiertos). Se activa en Ajustes con
// contraseña. Solo guarda su huella SHA-256; aun así, es una barrera de juego,
// no seguridad real: todo vive en el navegador.

const ADMIN_HASH = '775e21963a3d240c9a87ac0d70030a0cb5fb9d442313acee042903ead30fff4e';

/** Oro y tickets que mantiene el modo admin. */
export const ADMIN_FUNDS = 999_999;

export const isAdmin = (store: SaveStore) => !!store.data.admin;

/** SHA-256 en JS puro: funciona también sin HTTPS (crypto.subtle solo existe en contextos seguros). */
function sha256(text: string): string {
  const K: number[] = [];
  const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  for (let n = 2, c = 0; c < 64; n++) {
    let prime = true;
    for (let d = 2; d * d <= n; d++) if (n % d === 0) { prime = false; break; }
    if (prime) K[c++] = (Math.cbrt(n) % 1) * 2 ** 32 | 0;
  }
  const bytes = [...new TextEncoder().encode(text)];
  const bits = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  for (let i = 7; i >= 0; i--) bytes.push(i >= 4 ? 0 : (bits >>> (i * 8)) & 0xff);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  const w = new Array<number>(64);
  for (let o = 0; o < bytes.length; o += 64) {
    for (let i = 0; i < 16; i++) w[i] = (bytes[o + i * 4] << 24) | (bytes[o + i * 4 + 1] << 16) | (bytes[o + i * 4 + 2] << 8) | bytes[o + i * 4 + 3];
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    [a, b, c, d, e, f, g, h].forEach((v, i) => { H[i] = (H[i] + v) | 0; });
  }
  return H.map((v) => (v >>> 0).toString(16).padStart(8, '0')).join('');
}

/** Comprueba la contraseña: sin distinguir mayúsculas (el teclado del móvil pone la primera) y con o sin «:» delante. */
export function checkAdminPassword(pw: string): boolean {
  const clean = pw.trim().replace(/^:\s*/, '').toLowerCase();
  return sha256(clean) === ADMIN_HASH;
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
