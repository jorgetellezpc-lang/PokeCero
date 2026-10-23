import { describe, expect, it } from 'vitest';
import { REGIONS } from '../src/data/regions';
import { ADMIN_FUNDS, checkAdminPassword, disableAdmin, enableAdmin } from '../src/meta/admin';
import { canEnterTown } from '../src/meta/adventure';
import { gymStatus } from '../src/meta/rewards';
import { MemoryStorage, SaveStore } from '../src/meta/save';
import { buyUpgrade } from '../src/meta/shop';

describe('modo admin', () => {
  it('solo se activa con la contraseña correcta', async () => {
    expect(await checkAdminPassword('josejosejose')).toBe(true);
    expect(await checkAdminPassword(':josejosejose')).toBe(true);
    expect(await checkAdminPassword(' josejosejose ')).toBe(true);
    expect(await checkAdminPassword('jose')).toBe(false);
    expect(await checkAdminPassword('')).toBe(false);
  });

  it('da oro y tickets ilimitados, abre todo y al desactivarlo devuelve lo de antes', () => {
    const storage = new MemoryStorage();
    const s = new SaveStore(storage);
    const gold = s.data.gold;
    const kanto = REGIONS[0];
    const misty = kanto.gyms.find((g) => g.order === 2)!;
    expect(canEnterTown(s, 'plateada')).toBe(false);
    expect(gymStatus(s, kanto, misty)).not.toBe('available');

    enableAdmin(s);
    expect(s.data.gold).toBe(ADMIN_FUNDS);
    expect(s.data.tickets).toBe(ADMIN_FUNDS);
    expect(canEnterTown(s, 'plateada')).toBe(true);
    expect(gymStatus(s, kanto, misty)).not.toBe('locked');
    // Comprar no lo agota.
    for (let i = 0; i < 5; i++) buyUpgrade(s, s.data.selectedPokemon, 'atk');
    expect(s.data.gold).toBe(ADMIN_FUNDS);
    // Sobrevive a recargar.
    expect(new SaveStore(storage).data.admin).toBe(true);

    disableAdmin(s);
    expect(s.data.admin).toBe(false);
    expect(s.data.gold).toBe(gold);
    expect(canEnterTown(s, 'plateada')).toBe(false);
    // Las mejoras compradas se quedan.
    expect(s.data.upgrades[s.data.selectedPokemon]?.atk).toBe(5);
  });
});
