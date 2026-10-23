// Simulador de la aventura con progreso permanente (no es una prueba): el bot
// juega Ruta 1 → Ruta 2 → gimnasio de Brock, repitiendo lo que pierde; solo se
// guarda lo ganado al superar. Ejecutar con: SIM=1 npx vitest run tests/progress.sim.test.ts
import { it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { ROUTES, placeGym } from '../src/data/adventure';
import { formAtLevel, START_LEVEL } from '../src/game/levels';
import { roomSequence } from '../src/game/rooms';
import { World, type Progress } from '../src/game/world';
import { bot } from './balance.sim.test';
import { brockArt as brock } from './helpers';

function play(w: World, seed: number): boolean {
  let t = 0;
  while (t < 60 * 60 * 30 && w.phase !== 'dead' && w.phase !== 'victory') {
    if (w.phase === 'levelup') { w.chooseUpgrade(seed % 3); continue; }
    if (w.phase === 'item') { w.chooseItem(true); continue; }
    w.update(1 / 60, bot(w));
    t++;
  }
  return w.phase === 'victory';
}

for (const sp of (import.meta.env.SIM_SPECIES ?? 'charmander,squirtle').split(',')) {
  it.runIf(import.meta.env.SIM)(`aventura ${sp}`, () => {
    let prog: Progress = { level: START_LEVEL, xp: 0, cards: [] };
    let species = formAtLevel(sp, START_LEVEL).id;
    const log: string[] = [];
    const stage = (name: string, make: (seed: number) => World, max = 12) => {
      for (let i = 1; i <= max; i++) {
        const w = make(i * 7);
        const ok = play(w, i);
        log.push(`${name} intento ${i}: ${ok ? 'GANA' : 'cae en sala ' + w.room} nv ${w.player.level} (guardado nv ${ok ? w.player.level : prog.level}) cartas ${w.player.cards.length}`);
        if (ok) { prog = { level: w.player.level, xp: w.player.xp, cards: [...w.player.cards] }; species = w.player.species.id; return true; }
      }
      return false;
    };
    for (const r of ['ruta1', 'ruta1', 'ruta2', 'ruta2']) {
      const R = ROUTES[r];
      stage(R.name, (seed) => new World({ speciesId: species, gym: placeGym(R), route: R, progress: prog, seed, rooms: [1, 2, 3, 4, 5] }));
    }
    stage('Brock', (seed) => new World({ speciesId: species, gym: brock, progress: prog, seed, rooms: roomSequence(true), scalingFactor: BALANCE.rooms.testModeScalingFactor }), 8);
    console.log(sp, '\n' + log.join('\n'));
  }, 600000);
}
