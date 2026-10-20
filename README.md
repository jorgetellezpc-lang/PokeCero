# Pokécero

Juego web Pokémon de supervivencia y acción 2D (roguelite), pensado para móvil en vertical. Prototipo jugable v0.1.

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

- **Móvil:** toca y arrastra en cualquier punto de la pantalla para mover el joystick. Los ataques son automáticos (estilo PokéSurvivor).
- **Escritorio:** WASD o flechas para moverse; Esc o P para pausar.

## Estructura

```
src/
  config/balance.ts     Todos los parámetros de balance (PROVISIONALES)
  data/                 Pokémon, ataques, enemigos, jefes, gimnasios/regiones, tabla de tipos
  game/                 Lógica de la partida, sin DOM (se prueba en Node)
    world.ts            Estado de la partida: salas, jugador, daño, XP, subidas de nivel, evolución
    enemyAI.ts          Arquetipos cuerpo a cuerpo y a distancia
    bossAI.ts           Patrones de minibosses y jefes
    weapons.ts          Ataques del jugador (proyectil, orbe, onda, zona)
    rooms.ts            Oleadas y curva de dificultad
    upgradeGenerator.ts Generador de las 3 cartas de mejora
  meta/                 Progreso permanente: guardado, tienda con oro, recompensas, gachapón
  render/               Dibujo en canvas y sprites pixel art provisionales
  input/                Joystick táctil y teclado
  ui/                   Menú principal (4 pestañas) y pantalla de partida
tests/                  Pruebas unitarias (Vitest)
e2e/                    Prueba de flujo completo (Playwright)
```

### Sustituir los gráficos provisionales

Todos los sprites son placeholders generados por código (`src/render/sprites.ts`). Para usar arte definitivo, coloca la imagen en `public/` y añade `image: 'sprites/charmander.png'` al `sprite` de la especie en `src/data/pokemon.ts` o `src/data/enemies.ts`.
