# Pokécero

Juego web Pokémon de supervivencia y acción 2D (roguelite), pensado para móvil en vertical. Prototipo jugable v0.2.

Integra **PokéSurvivor** (© 2026 JPTER78, PolyForm Noncommercial) adaptado a salas estilo Archero, con sprites de PMD SpriteCollab (CC BY-NC 4.0). Por eso Pokécero es un proyecto **sin ánimo de lucro**: no se puede vender, cobrar por él ni ponerle anuncios. Detalles en [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

La especificación de diseño está en el *Blueprint maestro*. En [`docs/DECISIONES.md`](docs/DECISIONES.md) se recogen las decisiones tomadas y los valores provisionales.

## Ejecutar

Requisitos: Node 20 o superior.

```bash
npm install
npm run dev        # servidor de desarrollo en http://localhost:5173 (también accesible en la red local)
```

**Probar en el móvil:** con el móvil en la misma red wifi que el ordenador, abre la URL de red que muestra `npm run dev` (por ejemplo `http://192.168.1.20:5173`).

Otros comandos:

```bash
npm run build      # comprueba tipos y genera la versión estática en dist/
npm run preview    # sirve dist/ (también en la red local)
npm test           # pruebas de lógica (combate, enemigos, mejoras, salas, guardado, recompensas)
npm run e2e        # prueba del flujo completo en un móvil simulado (Playwright + Chromium)
npm run sim        # simulador de balance: un bot juega partidas completas e imprime resultados
```

### Publicar (opcional)

`.github/workflows/deploy.yml` publica en GitHub Pages cada push a `main`. Hay que activarlo una vez en el repositorio: *Settings → Pages → Source: GitHub Actions*. El juego quedará en `https://<usuario>.github.io/PokeCero/`.

## Controles

- **Móvil:** toca y arrastra en cualquier punto de la pantalla para mover el joystick. Al soltar el dedo y quedarte **quieto**, atacas solo (estilo Archero); al moverte, esquivas.
- **Escritorio:** WASD o flechas para moverse; Esc o P para pausar.

## Estructura

```
src/
  config/balance.ts     Todos los parámetros de balance (PROVISIONALES)
  data/                 Pokédex de Kanto, movimientos, enemigos, objetos, cartas, tipos, gimnasios
    ps/                 Datos extraídos de PokéSurvivor (Pokédex y geometría de sprites)
  game/                 Lógica de la partida, sin DOM (se prueba en Node)
    world.ts            Salas, jugador, daño, recogibles, XP, niveles, evoluciones, objetos
    combat.ts           Los 23 comportamientos de movimiento, proyectiles y campos
    enemyAI.ts          13 personalidades de enemigo y estados alterados
    bossAI.ts           IA de minibosses y jefes
    rooms.ts            Oleadas, tramos y curva de dificultad
    upgradeGenerator.ts Las 3 cartas de subida de nivel
    abilities.ts        Pasiva + habilidades + sinergias → modificadores de combate
  meta/                 Progreso permanente: guardado, mejoras por Pokémon, recompensas, gachapón
  render/               Canvas, sprites animados (animator.ts) y efectos pixel art (vfx.ts)
  audio/                Sintetizador Web Audio y partituras
  input/                Joystick táctil y teclado
  ui/                   Menú principal (4 pestañas) y pantalla de partida
public/sprites/         Sprites PMD de los 151 de Kanto (+ Sudowoodo) y créditos de artistas
tests/                  Pruebas unitarias (Vitest) y simulador de balance
e2e/                    Prueba de flujo completo (Playwright)
```
