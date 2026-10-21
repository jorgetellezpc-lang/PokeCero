import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { makeWorld, spawnAt } from './helpers';

// Carga extrema: todas las habilidades de proyectil al máximo y muchos
// enemigos a la vez. Mide el coste de la simulación (sin dibujo).
describe('rendimiento', () => {
  it('aguanta muchos proyectiles y enemigos sin dispararse el coste por fotograma', () => {
    const w = makeWorld({ seed: 3 });
    const p = w.player;
    p.abilities = { 'doble-disparo': 3, abanico: 2, flancos: 2, retaguardia: 2, rafaga: 1, perforacion: 3, rebote: 3, 'rebote-muro': 2, detonacion: 2, guardianes: 2 };
    w.refreshMods();
    p.cdMul = 0.3;
    p.hp = p.maxHp = 1e9;
    w.addMove('fire-spin');
    w.addMove('thunder-shock');
    w.addMove('water-gun');
    w.markers = [];
    w.pendingWaves = [];
    w.enemies = [];
    // 60 enemigos que no caen (un tercio dispara), para mantener la carga.
    for (let i = 0; i < 60; i++) {
      const e = spawnAt(w, [19, 13, 74, 66][i % 4], i % 3 ? 'chase' : 'ranged', 30 + (i * 53) % 300, 40 + (i * 97) % 300);
      e.hp = e.maxHp = 1e9;
    }
    let peakProj = 0;
    let peakEnemies = 0;
    const frames = 60 * 10;
    const t0 = performance.now();
    for (let i = 0; i < frames; i++) {
      if (w.phase === 'levelup') w.chooseUpgrade(0);
      w.update(1 / 60, { x: 0, y: 0 });
      peakProj = Math.max(peakProj, w.projectiles.length);
      peakEnemies = Math.max(peakEnemies, w.enemies.length);
    }
    const ms = (performance.now() - t0) / frames;
    console.log(`rendimiento: ${ms.toFixed(2)} ms/fotograma · pico ${peakProj} proyectiles · ${peakEnemies} enemigos`);
    expect(peakProj).toBeGreaterThan(100);
    expect(peakProj).toBeLessThanOrEqual(BALANCE.perf.maxProjectiles + 200);
    // Presupuesto holgado (16,7 ms por fotograma a 60 fps, y el dibujo va aparte).
    expect(ms).toBeLessThan(8);
  });
});
