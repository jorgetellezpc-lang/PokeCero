import { getSpecies, PLAYABLE_BLURB, PLAYABLE_POKEMON } from '../../data/pokemon';
import { START_LEVEL } from '../../game/levels';
import { chooseStarter } from '../../meta/team';
import { animatedPokemon } from '../anim';
import type { App, Screen } from '../app';
import { h } from '../dom';
import { uiImg } from './menu';

// ============================================================================
// Test de compatibilidad (como en Pokémon Mundo Misterioso): 8 preguntas de
// personalidad; cada respuesta suma puntos a uno o varios iniciales. Al final
// te dice cuál te toca y por qué, y puedes aceptarlo o elegir otro.
// ============================================================================

type Line = 'bulbasaur' | 'charmander' | 'squirtle' | 'pikachu';
type Score = Partial<Record<Line, number>>;

interface Question { q: string; a: [string, Score][] }

export const QUESTIONS: Question[] = [
  { q: 'Un amigo está triste. ¿Qué haces?', a: [
    ['Le hago reír con alguna tontería.', { squirtle: 2, pikachu: 1 }],
    ['Me siento a su lado y le escucho.', { bulbasaur: 2 }],
    ['Le propongo hacer algo emocionante para que se olvide.', { charmander: 2, pikachu: 1 }],
  ] },
  { q: 'Mañana tienes un examen importante.', a: [
    ['Lo llevo preparado desde hace días.', { bulbasaur: 2 }],
    ['Estudio a última hora… y algo saldrá.', { squirtle: 2 }],
    ['¡Es un reto! Voy a por la mejor nota.', { charmander: 2 }],
    ['Quedo con amigos para estudiar juntos.', { pikachu: 2 }],
  ] },
  { q: 'Encuentras una cueva que no conoces.', a: [
    ['¡Entro ya, a ver qué hay!', { charmander: 2, pikachu: 1 }],
    ['Miro primero desde la entrada, con cuidado.', { bulbasaur: 2 }],
    ['Aviso a alguien para entrar juntos.', { pikachu: 2, squirtle: 1 }],
  ] },
  { q: 'Tu día libre perfecto es…', a: [
    ['Una siesta al sol en el jardín.', { bulbasaur: 2 }],
    ['Un día de playa con amigos.', { squirtle: 2, pikachu: 1 }],
    ['Salir a correr y explorar sin rumbo.', { pikachu: 2, charmander: 1 }],
  ] },
  { q: 'Alguien se cuela en la fila delante de ti.', a: [
    ['Le digo algo: ¡no hay derecho!', { charmander: 2 }],
    ['Lo dejo pasar, no merece la pena.', { bulbasaur: 2 }],
    ['Suelto un comentario con gracia para que se dé cuenta.', { squirtle: 2 }],
  ] },
  { q: '¿Qué tiempo te gusta más?', a: [
    ['Una buena tormenta con rayos.', { pikachu: 2 }],
    ['Lluvia suave para quedarse en casa.', { squirtle: 2 }],
    ['Un sol radiante de verano.', { charmander: 2 }],
    ['Una mañana tranquila de primavera.', { bulbasaur: 2 }],
  ] },
  { q: 'Te dicen que algo es imposible.', a: [
    ['Lo intento igualmente, ¡ya veremos!', { charmander: 2, pikachu: 1 }],
    ['Busco otra forma más lista de hacerlo.', { squirtle: 2, bulbasaur: 1 }],
    ['Lo pienso con calma antes de rendirme.', { bulbasaur: 2 }],
  ] },
  { q: '¿Cómo te describirían tus amigos?', a: [
    ['Leal y tranquilo.', { bulbasaur: 2 }],
    ['Divertido y despreocupado.', { squirtle: 2 }],
    ['Apasionado y valiente.', { charmander: 2 }],
    ['Lleno de energía y muy sociable.', { pikachu: 2 }],
  ] },
];

/** Naturaleza y por qué te toca cada uno. */
const NATURE: Record<Line, { name: string; why: string }> = {
  charmander: { name: 'Valiente', why: 'Te lanzas de cabeza a los retos y no te rindes nunca. Tu fuego interior es contagioso.' },
  squirtle: { name: 'Alegre', why: 'Te tomas la vida con humor y sales de los líos con ingenio. Contigo nadie se aburre.' },
  bulbasaur: { name: 'Tranquilo', why: 'Eres paciente y de fiar; los demás se sienten a gusto a tu lado. No te rindes, pero sin prisa.' },
  pikachu: { name: 'Activo', why: 'Tienes energía para dar y regalar y te encanta estar con gente. ¡Siempre en movimiento!' },
};

/** Resultado del test: el que más puntos suma; en empate, el de la última respuesta que lo favoreció. */
export function testResult(answers: Score[]): Line {
  const total: Record<Line, number> = { bulbasaur: 0, charmander: 0, squirtle: 0, pikachu: 0 };
  const last: Record<Line, number> = { bulbasaur: -1, charmander: -1, squirtle: -1, pikachu: -1 };
  answers.forEach((a, i) => {
    for (const [k, v] of Object.entries(a) as [Line, number][]) { total[k] += v; last[k] = i; }
  });
  return (Object.keys(total) as Line[]).sort((x, y) => total[y] - total[x] || last[y] - last[x])[0];
}

export class StarterScreen implements Screen {
  el: HTMLElement;
  private box: HTMLElement;
  private answers: Score[] = [];

  constructor(private app: App) {
    this.box = h('div', { class: 'starter-box' });
    this.el = h('div', { class: 'screen starter', 'data-testid': 'starter-test', style: 'background-image:url(ui/map-blur.webp)' }, this.box);
    this.intro();
  }

  destroy(): void {}

  private intro(): void {
    this.box.replaceChildren(
      h('h1', { class: 'starter-title' }, '¡Bienvenido!'),
      h('p', {}, 'Antes de empezar tu aventura, responde a unas preguntas con sinceridad.'),
      h('p', {}, 'Según cómo seas, te tocará un Pokémon compañero. Si no te convence, podrás elegir otro.'),
      h('button', { class: 'starter-btn go', 'data-testid': 'starter-start', onclick: () => this.ask(0) }, 'Empezar el test'),
    );
  }

  private ask(i: number): void {
    const q = QUESTIONS[i];
    this.box.replaceChildren(
      h('div', { class: 'starter-step' }, `Pregunta ${i + 1} de ${QUESTIONS.length}`),
      h('div', { class: 'starter-dots' }, ...QUESTIONS.map((_, k) => h('i', { class: k < i ? 'done' : k === i ? 'on' : '' }))),
      h('p', { class: 'starter-q', 'data-testid': 'starter-q' }, q.q),
      h('div', { class: 'starter-answers' }, ...q.a.map(([text, score], k) => h('button', {
        class: 'starter-btn', 'data-testid': `answer-${k}`,
        onclick: () => {
          this.app.audio.sfx('click');
          this.answers[i] = score;
          if (i + 1 < QUESTIONS.length) this.ask(i + 1);
          else this.result(testResult(this.answers));
        },
      }, text))),
      ...(i > 0 ? [h('button', { class: 'starter-back', onclick: () => this.ask(i - 1) }, '‹ Atrás')] : []),
    );
  }

  private result(line: Line): void {
    const sp = getSpecies(line);
    const n = NATURE[line];
    this.app.audio.sfx('legend');
    this.box.replaceChildren(
      h('p', { class: 'starter-step' }, 'Tu naturaleza es…'),
      h('h1', { class: 'starter-title' }, n.name),
      h('p', {}, n.why),
      h('div', { class: 'starter-mon', 'data-testid': 'starter-result', 'data-line': line }, animatedPokemon(sp.dex, 150, {})),
      h('p', { class: 'starter-pick' }, '¡Tu compañero ideal es ', h('b', {}, sp.name), '!'),
      h('button', { class: 'starter-btn go', 'data-testid': 'starter-accept', onclick: () => this.confirm(line) }, `¡Vamos, ${sp.name}!`),
      h('button', { class: 'starter-btn', 'data-testid': 'starter-other', onclick: () => this.choose() }, 'Prefiero elegir otro'),
    );
  }

  private choose(): void {
    this.box.replaceChildren(
      h('h1', { class: 'starter-title small' }, 'Elige a tu compañero'),
      h('p', {}, 'Solo puedes tener uno al empezar. A los demás tendrás que ganarles en el laboratorio de Pueblo Paleta para que se unan a ti.'),
      h('div', { class: 'starter-grid' }, ...PLAYABLE_POKEMON.map((line) => {
        const sp = getSpecies(line);
        return h('button', { class: 'starter-card', 'data-testid': `starter-pick-${line}`, onclick: () => this.confirm(line as Line) },
          uiImg(`pk-face-${line}`, 'starter-face'), h('b', {}, sp.name), h('small', {}, PLAYABLE_BLURB[line] ?? ''));
      })),
    );
  }

  private confirm(line: Line): void {
    chooseStarter(this.app.store, line);
    this.app.audio.sfx('confirm');
    const sp = getSpecies(line);
    this.box.replaceChildren(
      h('div', { class: 'starter-mon' }, animatedPokemon(sp.dex, 150, {})),
      h('h1', { class: 'starter-title small' }, `¡${sp.name} se une a ti!`),
      h('p', {}, `Empieza en el nivel ${START_LEVEL}. Ganará experiencia en las rutas y los gimnasios, y cada nivel le dará una mejora para siempre.`),
      h('button', { class: 'starter-btn go', 'data-testid': 'starter-done', onclick: () => this.app.showTown('paleta') }, 'Empezar en Pueblo Paleta'),
    );
  }
}
