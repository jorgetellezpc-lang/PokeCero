import { describe, expect, it } from 'vitest';
import { BOSSES } from '../src/data/enemies';
import { makeWorld, run } from './helpers';

/** Combate de prueba contra el jefe de una sala, bajándole la vida por tramos. */
function fight(room: number) {
  const w = makeWorld({ rooms: [room] });
  run(w, 2);
  const boss = w.boss!;
  const seen = new Set<string>();
  w.player.hp = w.player.maxHp = 1e9;
  w.player.moves = [];
  for (let i = 0; i < 60 * 50; i++) {
    w.update(1 / 60, { x: Math.sin(i / 50), y: Math.cos(i / 70) * 0.5 });
    if (boss.ai?.cast) seen.add(boss.ai.cast.id);
    if (w.phase === 'levelup') w.chooseUpgrade(0);
    if (i === 60 * 15) boss.hp = boss.maxHp * 0.6;
    if (i === 60 * 30) boss.hp = boss.maxHp * 0.3;
  }
  return { w, boss, seen };
}

describe('jefes', () => {
  it('todos los jefes tienen 3 fases ordenadas con ataques propios', () => {
    for (const b of Object.values(BOSSES)) {
      expect(b.phases.length).toBe(3);
      expect(b.phases[1].at).toBeGreaterThan(b.phases[2].at);
      expect(b.phases[2].moves.length).toBeGreaterThan(0);
    }
  });

  it('Geodude (sala 20) usa Rodada y Magnitud en sus fases', () => {
    const { seen, boss } = fight(20);
    expect(boss.def.dex).toBe(74);
    expect(seen.has('rollout')).toBe(true);
    expect(seen.has('quake')).toBe(true);
  });

  it('Sudowoodo (sala 40) usa Avalancha y Tumba Rocas', () => {
    const { seen, boss } = fight(40);
    expect(boss.def.dex).toBe(185);
    expect(seen.has('slide')).toBe(true);
    expect(seen.has('tomb')).toBe(true);
  });

  it('Onix bajo tierra (Excavar) no recibe daño y vuelve a salir', () => {
    const w = makeWorld({ rooms: [50] });
    run(w, 2);
    const boss = w.boss!;
    w.player.hp = w.player.maxHp = 1e9;
    let checked = false;
    for (let i = 0; i < 60 * 40 && !checked; i++) {
      w.update(1 / 60, { x: 0, y: 0 });
      if (i === 60 * 2) boss.hp = boss.maxHp * 0.6;
      if (boss.hidden) {
        const hp = boss.hp;
        w.hitEnemy(boss, 500, 'water', 'special');
        w.hurtEnemyRaw(boss, 500, '#fff');
        expect(boss.hp).toBe(hp);
        w.update(1 / 60, { x: 0, y: 0 });
        expect(w.target).not.toBe(boss);
        checked = true;
      }
    }
    expect(checked).toBe(true);
    run(w, 2);
    expect(boss.hidden).toBe(false);
  });
});
