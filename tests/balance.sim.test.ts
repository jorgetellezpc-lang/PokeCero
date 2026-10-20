// Simulador de balance (no es una prueba): un bot sencillo juega partidas
// completas e imprime hasta dónde llega. Ejecutar con: npm run sim
import { it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { roomSequence } from '../src/game/rooms';
import { World } from '../src/game/world';
import { brock } from './helpers';

function bot(w: World) {
  const p = w.player;
  if (w.exitOpen && w.gems.length === 0) {
    const dx = w.exit.x - p.x, dy = w.exit.y - p.y; const d = Math.hypot(dx, dy) || 1; return { x: dx / d, y: dy / d };
  }
  let fx = 0, fy = 0;
  for (const e of w.enemies) { const dx = p.x - e.x, dy = p.y - e.y; const d = Math.hypot(dx, dy) || 1; const wgt = e.boss ? 3 : 1; if (d < 160) { fx += dx / d / d * 100 * wgt; fy += dy / d / d * 100 * wgt; } }
  for (const pr of w.projectiles) { if (pr.owner !== 'enemy') continue; const dx = p.x - pr.x, dy = p.y - pr.y; const d = Math.hypot(dx, dy) || 1; if (d < 70) { fx += -pr.vy / 100 * (dx * pr.vy - dy * pr.vx > 0 ? -1 : 1) ; fy += pr.vx / 100 * (dx * pr.vy - dy * pr.vx > 0 ? -1 : 1); } }
  for (const z of w.zones) if (z.owner==='enemy') { const dx = p.x - z.x, dy = p.y - z.y; const d = Math.hypot(dx, dy) || 1; if (d < z.r + 20) { fx += dx/d*3; fy += dy/d*3; } }
  // centro
  fx += (w.W / 2 - p.x) / 400; fy += (w.H / 2 - p.y) / 400;
  for (const g of w.gems) { const dx = g.x - p.x, dy = g.y - p.y; const d = Math.hypot(dx, dy) || 1; if (d < 120 && w.enemies.length < 3) { fx += dx/d*0.3; fy += dy/d*0.3; } }
  const l = Math.hypot(fx, fy); return l > 0.05 ? { x: fx / l, y: fy / l } : { x: 0, y: 0 };
}

for (const test of [true, false]) for (const sp of ['charmander', 'squirtle', 'pikachu']) {
  it.runIf(import.meta.env.SIM)(`sim ${sp} test=${test}`, () => {
    const res: string[] = [];
    for (let seed = 1; seed <= 4; seed++) {
      const w = new World({ speciesId: sp, gym: brock, rooms: roomSequence(test), seed, xpMult: test ? BALANCE.rooms.testModeXpMult : 1, scalingFactor: test ? BALANCE.rooms.testModeScalingFactor : 1 });
      let t = 0;
      while (t < 60 * 60 * 40 && w.phase !== 'dead' && w.phase !== 'victory') {
        if (w.phase === 'levelup') { const c = w.choices.findIndex(c => c.family !== 'stat'); w.chooseUpgrade(seed % 2 ? 0 : Math.max(0, c)); continue; }
        w.update(1 / 60, bot(w)); t++;
      }
      res.push(`seed${seed}: ${w.phase} room ${w.room} lvl ${p(w)} t=${(t/60/60).toFixed(1)}min kills ${w.kills} gold ${w.runGold}`);
    }
    console.log(sp, test ? '(modo prueba)' : '(50 salas)', '\n' + res.join('\n'));
  }, 120000);
}
function p(w: World) { return `${w.player.level} ${w.player.species.id} ${w.player.attacks.map(a=>a.def.id+a.level).join(',')}`; }
