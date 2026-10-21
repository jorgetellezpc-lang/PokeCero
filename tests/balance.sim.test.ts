// Simulador de balance (no es una prueba): un bot sencillo juega partidas
// completas e imprime hasta dónde llega. Ejecutar con: npm run sim
import { it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { roomSequence } from '../src/game/rooms';
import { World } from '../src/game/world';
import { brock } from './helpers';

function bot(w: World) {
  const p = w.player;
  if (w.exitOpen && w.pickups.length === 0) {
    const dx = w.exit.x - p.x;
    const dy = w.exit.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    return { x: dx / d, y: dy / d };
  }
  let fx = 0;
  let fy = 0;
  // Estilo Archero: quieto para atacar; solo se mueve si hay peligro cerca.
  let danger = false;
  for (const e of w.enemies) {
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    const k = e.boss ? 3 : 1;
    if (d < (e.boss ? 110 : 65)) danger = true;
    if (d < 150) { fx += (dx / d / d) * 100 * k; fy += (dy / d / d) * 100 * k; }
  }
  for (const pr of w.projectiles) if (!pr.friendly && Math.hypot(pr.x - p.x, pr.y - p.y) < 60) danger = true;
  for (const h of w.hazards) if (h.kind === 'beam' || Math.hypot(h.x - p.x, h.y - p.y) < h.r + 20) danger = true;
  if (!danger && w.pickups.every((g) => Math.hypot(g.x - p.x, g.y - p.y) > 80 || w.enemies.length > 2)) return { x: 0, y: 0 };
  for (const pr of w.projectiles) {
    if (pr.friendly) continue;
    const dx = p.x - pr.x;
    const dy = p.y - pr.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < 70) {
      const s = dx * pr.vy - dy * pr.vx > 0 ? -1 : 1;
      fx += (-pr.vy / 100) * s;
      fy += (pr.vx / 100) * s;
    }
  }
  for (const h of w.hazards) {
    const dx = p.x - h.x;
    const dy = p.y - h.y;
    const d = Math.hypot(dx, dy) || 1;
    if (h.kind === 'zone' && d < h.r + 20) { fx += (dx / d) * 3; fy += (dy / d) * 3; }
    if (h.kind === 'beam') { fx += -Math.sin(h.angle) * 1.5; fy += Math.cos(h.angle) * 1.5; }
  }
  fx += (w.W / 2 - p.x) / 400;
  fy += (w.H / 2 - p.y) / 400;
  for (const g of w.pickups) {
    const dx = g.x - p.x;
    const dy = g.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < 120 && w.enemies.length < 3) { fx += (dx / d) * 0.3; fy += (dy / d) * 0.3; }
  }
  const l = Math.hypot(fx, fy);
  return l > 0.05 ? { x: fx / l, y: fy / l } : { x: 0, y: 0 };
}

for (const test of [true, false]) for (const sp of ['charmander', 'squirtle', 'bulbasaur', 'pikachu']) {
  it.runIf(import.meta.env.SIM)(`sim ${sp} test=${test}`, () => {
    const res: string[] = [];
    for (let seed = 1; seed <= 4; seed++) {
      const w = new World({ speciesId: sp, gym: brock, rooms: roomSequence(test), seed, xpMult: test ? BALANCE.rooms.testModeXpMult : 1, scalingFactor: test ? BALANCE.rooms.testModeScalingFactor : 1 });
      let t = 0;
      let deathRoom = 0;
      while (t < 60 * 60 * 40 && w.phase !== 'dead' && w.phase !== 'victory') {
        if (w.phase === 'levelup') { w.chooseUpgrade(seed % 2 ? 0 : Math.max(0, w.choices.findIndex((c) => c.family !== 'stat'))); continue; }
        if (w.phase === 'item') { w.chooseItem(true); continue; }
        w.update(1 / 60, bot(w));
        t++;
        deathRoom = w.room;
      }
      const p = w.player;
      res.push(`seed${seed}: ${w.phase} sala ${deathRoom} nv ${p.level} ${p.species.id} ${p.moves.map((m) => `${m.def.id}${m.evolved ? '★' : m.level}`).join(',')} ${(t / 3600).toFixed(1)}min kills ${w.kills}`);
    }
    console.log(sp, test ? '(modo prueba)' : '(50 salas)', '\n' + res.join('\n'));
  }, 300000);
}
