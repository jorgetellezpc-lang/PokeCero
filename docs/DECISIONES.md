# Decisiones y parámetros provisionales

Este documento recoge qué está **acordado** y qué es **provisional**, es decir, valores elegidos solo para que el prototipo se pueda jugar. Los valores provisionales están centralizados en `src/config/balance.ts` y en `src/data/`.

## Acordado

| Tema | Decisión |
|---|---|
| Base | Pokécero integra PokéSurvivor (sistemas, datos, sprites, efectos y música) adaptado a salas verticales estilo Archero. Por eso el proyecto es **no comercial** para siempre: lo exigen las licencias PolyForm Noncommercial y CC BY-NC (ver `THIRD_PARTY_NOTICES.md`). |
| Tecnología | Vite + TypeScript. El combate se dibuja en Canvas 2D y los menús son HTML/CSS. La lógica de la partida no depende del navegador y se prueba en Node. |
| Estilo de ataque | **Archero (opción B):** atacas automáticamente solo cuando estás quieto; moverte es esquivar. Orbes, auras y rastros funcionan siempre. Se lanzan todos tus movimientos a la vez (máximo 4). Todos los iniciales son a distancia. |
| Sprites | Sprites animados de Mundo Misterioso (SpriteCollab) de los 151 de Kanto, más Sudowoodo. Tienen 8 direcciones y 7 animaciones. |
| Completar una sala | Derrotar a todos los enemigos y cruzar la salida superior (Archero). |
| Estructura del gimnasio | 50 salas, con minibosses en las salas 20 y 40 y jefe en la 50. |
| Modo prueba | En Ajustes. Recorre 8 salas (1, 4, 8, 20, 24, 40, 44 y 50) y está activado por defecto en el prototipo. |
| Siguiente región | Requiere las 8 medallas de Kanto. |
| Monedas | Los tickets solo sirven para el gachapón y el oro solo para las mejoras. |

## Integrado de PokéSurvivor

- **Movimientos.** Hay ~100, con 23 comportamientos: proyectil, cuerpo a cuerpo, rayo, orbe, onda, aura, potenciador, bumerán, cadena, mina, meteoro, torreta, embestida, rastro, cono, teledirigido, rebote, carga, giro, terremoto, remolino, empujón y aturdimiento.
  - Cada uno tiene 5 niveles, y los que hacen daño pueden evolucionar con una carta dorada.
  - Los movimientos que puede aprender cada Pokémon salen de sus tipos más los de tipo Normal.
  - Los ataques son físicos o especiales, según el Ataque o el Ataque Especial del Pokémon.
- **Tabla de tipos** completa de 18 tipos, suavizada: ×1,6 si es eficaz, ×0,6 si es poco eficaz y ×0,3 en vez de inmunidad.
- **Estados alterados:** quemadura, veneno, ralentización, aturdimiento, empujón y escudo.
- **Enemigos:**
  - Puede salir cualquier Pokémon de Kanto que no sea legendario.
  - Se agrupan en 5 tramos por fuerza (total de estadísticas base) y cada partida sortea un elenco de 7 Pokémon por tramo.
  - Hay 13 personalidades: perseguidor, embestida, distancia, tanque, corredor, curandero, escudo, invocador, kamikaze, rayo con aviso, zonas, abanico y salto.
- **Jefes.** Cada uno tiene 4 ataques con aviso en el suelo (pisotón, embestida o salto, y dos de distancia según su tipo), alterna entre pelear de cerca y de lejos, y se enfurece al 50 % de vida.
- **Cartas de nivel:**
  - Tipos: movimiento nuevo, mejora de movimiento, estadística y evolución de movimiento.
  - Estadísticas: Vigor, Potencia, Carrera, Reflejos, Coraza, Síntesis, Imán, Aprendizaje y Baya Zidra.
  - Como mucho se ofrecen 2 potenciadores.
- **Objetos equipables** (uno por partida): los sueltan los jefes y, al encontrar otro, eliges con cuál quedarte.
- **Mejoras permanentes por Pokémon:** Vitalidad, Fuerza, Zancada, Reflejos, Coraza, Síntesis, Imán, Sabiduría, Fortuna y Golpe Crítico.
- **Gachapón:**
  - Rarezas 1★–5★ y tiradas ×1 y ×10, a un ticket por tirada.
  - La ×10 garantiza una Épica y hay garantía de Legendaria a las 70 tiradas.
  - Los repetidos se convierten en oro.
- **Recogibles:** experiencia, oro, bayas, tickets y objetos.
- **Sonido:** sintetizador Web Audio con los temas de aldea (menú), bosque, cueva y volcán (según la sala) y jefe, más efectos de sonido.

## Combate roguelite estilo Archero (implementación original)

Archero2Clone no tiene licencia, así que solo se usó como referencia funcional; el código es propio.

- **Habilidades por datos** (`src/data/abilities.ts`): 19 habilidades con id, nombre, descripción, rareza (Común/Rara/Épica/Legendaria), límite de acumulación, efecto, condiciones de aparición (tipo de movimiento, tipo elemental, nivel) y exclusiones. Ejemplos: Doble Disparo, Abanico, Flancos, Retaguardia, Ráfaga, Perforación, Rebote, Rebote Muro, Cuerpo Llama, Punto Tóxico, Toque Gélido, Electricidad Estática, Francotirador, Golpe Certero, Detonación, Absorción, Pantalla Luz, Doble Equipo y Robustez.
- **Sinergias** (7): se activan solas al reunir sus piezas y se anuncian con un aviso. Por ejemplo, Infierno (Cuerpo Llama + movimiento de Fuego), Cobertura Total (Abanico + Flancos + Retaguardia) y Nube Tóxica (Punto Tóxico + Detonación).
- **Pasiva de cada Pokémon** según su tipo principal: Mar Llamas, Torrente, Espesura, Electricidad Estática, Levitación, Robustez, Intimidación… Además, los movimientos de su mismo tipo hacen +20 % (STAB).
- **Cartas:** las habilidades entran en el sorteo de las 3 cartas junto a movimientos y estadísticas. Su color indica la rareza, y la carta avisa si completa una sinergia.
- **Jefes con 3 fases** (al 66 % y al 33 % de vida). Cada fase añade ataques propios con aviso en el suelo:
  - Geodude: Rodada y Magnitud.
  - Sudowoodo: Avalancha y Tumba Rocas.
  - Onix: Avalancha, Excavar (bajo tierra no se le puede golpear) y Tormenta Arena.
  - En la última fase se enfurecen.
- **Obstáculos** (`src/data/layouts.ts`, `src/game/obstacles.ts`):
  - **Rocas:** bloquean el paso y paran todos los proyectiles; Rebote Muro rebota en ellas.
  - **Agua:** bloquea el paso, pero los proyectiles la cruzan. Los voladores y fantasmas (y tu Pokémon, si tiene Levitación) pasan por encima.
  - Hay 7 diseños que salen según la sala (con espejo al azar). La sala 1 y la primera de cada tramo (11, 21…) son abiertas, y las de jefe casi.
  - Los enemigos rodean los obstáculos con una cuadrícula de navegación. Los que disparan, si una roca les tapa, se recolocan.
  - Apuntas primero a los enemigos que ves.
  - Los tests comprueban que no hay zonas cerradas, que siempre hay camino a la salida y que nadie aparece dentro de un obstáculo.
- **Escenario 3D** (`src/render/scene3d.ts`, con Three.js):
  - La sala mide 360 × 840: más alta que la pantalla, y la cámara inclinada (52°) sigue al jugador.
  - Hay suelo, muros de piedra, puerta con barrotes (que se abren al limpiar la sala), rocas facetadas, agua con brillo, pinos fuera de los muros, luz, sombras y niebla.
  - Los Pokémon son sus sprites animados de pie, mirando a la cámara.
  - Los avisos, zonas y sombras se pintan en una capa sobre el suelo. Proyectiles, números y barras se dibujan encima, con las mismas piezas que el 2D (`src/render/draw2d.ts`).
  - **Calidad automática:** si el móvil no llega a ~40 fps, baja la resolución y después quita las sombras, y lo recuerda durante la sesión.
  - Sin WebGL 2 se usa el dibujo 2D clásico (`renderer.ts`).
  - Añade la dependencia `three` (MIT, ~140 KB comprimidos).
  - Los obstáculos frenan a los enemigos con un radio máximo de 13, para que los grandes quepan por los puentes.
- **Rendimiento:** como mucho hay 360 proyectiles a la vez; si se pasa, desaparecen antes los tuyos más viejos (`balance.perf`).

## Menús (v0.3)

Estética de juego móvil a partir del ejemplo del usuario: paneles azules con brillo, botones amarillos gruesos y tipografías Lilita One y Nunito (con fuentes de respaldo si no cargan).

- **Mapa:** portada de la región con la isla ilustrada y el botón Entrar; mapa con la ruta entre gimnasios y candados; ficha del gimnasio con su jefe animado, el recorrido de jefes (salas 20, 40 y 50), las recompensas y el botón Comenzar.
- **Pokémon:** tu Pokémon animado sobre una plataforma, su línea evolutiva, sus estadísticas y las mejoras con iconos de color.
- **Gachapón:** máquina de cápsulas con los iniciales alrededor, probabilidades por rareza y tiradas ×1 y ×10.
- **Ajustes:** lista con iconos. Incluye la **calidad gráfica** (automática, alta, media o baja; controla el 3D de verdad), la guía del juego y los créditos.
- **Sin pixel art en los menús:** todos los iconos están dibujados en SVG (`src/ui/icons.ts`).
- **Ilustraciones:** las pone el usuario en `public/ui/` (nombres y tamaños en `public/ui/README.md`) y aparecen solas. Mientras falten, se usan provisionales generadas en código (isla suavizada y cueva) o la máquina de CSS.
- **No integrado del ejemplo, a propósito:** la **energía** (rayo 30/30, "Comenzar ×5") y el **nivel de jugador**. Son sistemas nuevos de economía y progresión que el blueprint no tiene (y la energía es típica de juegos con pagos). En su lugar, la barra superior muestra tu Pokémon y tus medallas. El idioma no se incluye porque solo hay español.

## Provisional (pendiente de decisión de diseño)

| Tema | Valor actual | Dónde |
|---|---|---|
| Minibosses y jefe de Brock | Geodude (20), Sudowoodo (40) y Onix (50), con la IA de jefe de PokéSurvivor | `data/regions.ts`, `data/enemies.ts` |
| Escala de PokéSurvivor a la arena | Sprites ×1,4; alcances ×0,7; proyectiles ×0,8; daño de movimientos ×0,5 | `balance.ps` |
| Enemigos por sala | De 4 a 14, en 1–3 sub-oleadas, con un máximo de 12 vivos | `balance.difficulty`, `balance.rooms` |
| Tramos de enemigos | Uno cada 10 salas, con la vida y el daño base de PokéSurvivor; dentro de cada tramo, +10 % de vida y +3 % de daño por sala | `data/enemies.ts`, `balance.difficulty` |
| Jefes | Vida ×24 (miniboss) y ×60 (jefe) sobre el tramo de su sala; fases al 66 % y al 33 % | `balance.bosses`, `data/enemies.ts` |
| Habilidades y sinergias | Magnitudes, rarezas (pesos 7/4/2/1) y peso de carta 9 | `data/abilities.ts`, `balance.upgrades.weights.ability` |
| Cámara 3D | Ancho visible 300, inclinación 52°, campo de visión 46°, adelanto 60 | `balance.camera` |
| Tamaño de sala | 360 × 840 (los diseños se escriben a 600 de alto y se estiran) | `balance.arena` |
| Obstáculos en las salas | 7 diseños de Brock; la sala en la que empieza a salir cada uno | `data/layouts.ts` |
| Curva de experiencia | 5 + 2·L + L^1,35 por nivel, con un máximo de nivel 36 | `balance.experience` |
| Evoluciones de especie | Nivel oficial. Las de piedra o intercambio no evolucionan en partida (pendiente). | `data/pokemon.ts` |
| Movimiento inicial | Según el tipo principal (tabla de PokéSurvivor) | `data/moves.ts` |
| Ataques simultáneos | Máximo 4 | `balance.upgrades` |
| Tickets | 5 + 5 + 10 por gimnasio, una sola vez; 1/200 por enemigo; 10 de bienvenida | `balance.rewards`, `balance.enemies` |
| Oro de bienvenida | 500 (como en PokéSurvivor) | `balance.rewards` |
| Gachapón | 45 / 30 / 17 / 6,5 / 1,5 %; garantía a las 70 tiradas | `balance.gacha` |

## Equilibrio observado (bot sencillo, `npm run sim`)

- El tipo importa contra Brock, que es de Roca/Tierra: Squirtle y Bulbasaur lo superan con facilidad; Charmander y, sobre todo, Pikachu sufren contra los minibosses, porque lo eléctrico hace ×0,3 a Geodude.
- Una partida de 50 salas dura unos 8–15 minutos y una en modo prueba, unos 2 minutos.
- Con habilidades, el bot gana unas 13 de cada 16 partidas de 50 salas. Probablemente es demasiado fácil para una persona, pero hay que probarlo jugando antes de endurecerlo. Pikachu sigue cayendo a menudo ante Geodude en el modo prueba.

## Sin integrar todavía (de PokéSurvivor)

- Shinies: faltan sus sprites, que son otros ~8 MB.
- Mundo abierto, terreno, biomas, climas y grietas con legendarios: no encajan directamente con las salas.
- Cuentas, cooperativo, ranking, misiones, logros, test de personalidad e idiomas.
- Iconos pixel art propios de cada movimiento: las cartas usan el color del tipo.
