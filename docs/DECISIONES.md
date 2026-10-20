# Decisiones y parámetros provisionales

Este documento recoge qué está **acordado** y qué es **provisional**: valores elegidos solo para que el prototipo se pueda jugar. Los valores provisionales están centralizados en `src/config/balance.ts` y en `src/data/`.

## Acordado

| Tema | Decisión |
|---|---|
| Tecnología | Vite + TypeScript, combate en Canvas 2D propio y menús en HTML/CSS. Se usa Canvas propio en lugar de Phaser (como se propuso al principio) para que la lógica del combate sea independiente de la pantalla y se pueda probar en Node. |
| Estilo de ataque | Automático y continuo mientras te mueves (estilo PokéSurvivor). |
| Completar una sala | Derrotar a todos los enemigos (incluidas las sub-oleadas) y cruzar la salida superior (estilo Archero). |
| Pokémon de prueba | Charmander → Charmeleon. Squirtle, Bulbasaur y Pikachu existen como datos y se consiguen en el gachapón. |
| Estructura del gimnasio | 50 salas: minibosses en las salas 20 y 40, jefe en la 50. |
| Modo prueba | En Ajustes; recorre las salas 1, 4, 8, 20, 24, 40, 44 y 50. **Está activado por defecto** en el prototipo para poder probar el ciclo completo en unos 3 minutos. |
| Siguiente región | Requiere las 8 medallas de Kanto (Johto aparece bloqueada). |
| Tickets y oro | Monedas separadas: los tickets solo sirven para el gachapón y el oro solo para las mejoras permanentes. |

## Provisional (pendiente de decisión de diseño)

| Tema | Valor actual | Dónde |
|---|---|---|
| Minibosses y jefe de Brock | Geodude (20), Sudowoodo (40), Onix (50), el ejemplo del blueprint | `data/regions.ts`, `data/enemies.ts` |
| Patrones de los jefes | Geodude: embestida y lanzamiento de rocas. Sudowoodo: anillo de rocas, desprendimiento e invocación. Onix: los cuatro patrones y una fase 2 al 50 % de vida | `data/enemies.ts` |
| Enemigos por sala | 3 en la sala 1 y hasta 12 en la sala 50, repartidos en 1–3 sub-oleadas, con un máximo de 10 vivos a la vez | `balance.difficulty`, `balance.rooms` |
| Curva de dificultad | d = 1 (sala 1) a 10 (sala 50). Vida +9 % por sala, daño +3 % por sala, velocidad +0,4 % por sala | `balance.difficulty` |
| Proporción de enemigos a distancia | Del 15 % al 45 %; garantizado al menos uno desde la sala 2 | `balance.difficulty` |
| Curva de experiencia | XP del nivel L al L+1: 5 + 2·L + L^1,35. La XP de los enemigos crece un 6 % por sala. Nivel máximo: 36 | `balance.experience` |
| Evoluciones | Nivel oficial de la especie (Charmander, Squirtle y Bulbasaur en el 16). La tercera forma, al nivel 36, queda fuera. Pikachu no evoluciona en partida | `data/pokemon.ts` |
| Ataques iniciales y aprendibles | 4–5 ataques por línea evolutiva | `data/pokemon.ts`, `data/attacks.ts` |
| Ataques simultáneos | Máximo 4 | `balance.upgrades.maxAttacks` |
| Familias de cartas | Pesos: nuevo ataque 3, mejora de ataque 4, estadística 3. Las tres cartas son siempre distintas. Si no hay suficientes opciones válidas, se completan con curación u oro | `balance.upgrades` |
| Valores de las mejoras | Niveles de ataque 1–5; estadísticas con un número máximo de mejoras propio para cada una | `data/attacks.ts`, `data/runUpgrades.ts` |
| Tabla de tipos | Subconjunto simplificado: ×1,25 si es eficaz y ×0,8 si es poco eficaz | `data/typeChart.ts` |
| Curación entre salas | 8 % al superar una sala y 30 % tras un jefe | `balance.rooms` |
| Mejoras permanentes | Vitalidad, Fuerza, Resistencia y Agilidad: 10 niveles, coste 50–70 × (n+1)^1,45. Se aplican a todos los Pokémon | `balance.ts` (`PERMANENT_UPGRADES`) |
| Oro | Se gana por enemigo, por sala y por jefe. Se conserva al ganar, perder o abandonar | `meta/rewards.ts` |
| Tickets | 5 en la sala 20, 5 en la 40 y 10 en la 50, una sola vez por gimnasio. 10 tickets de bienvenida para probar el gachapón | `balance.rewards` |
| Gachapón | 10 tickets por tirada; 75 % común y 25 % raro; un repetido da 150 de oro | `balance.gacha` |
| Modo prueba | La experiencia se multiplica por 2,5 y la sala N escala como la sala N/2 | `balance.rooms` |

## Sin implementar todavía

- Habilidades especiales al alcanzar ciertos hitos (sus hitos y reglas están pendientes).
- Gimnasios 2 a 8: aparecen en el mapa pero no tienen contenido.
- Arquetipos de enemigo adicionales (rápido, tanque, embestida, área, apoyo). La arquitectura está preparada: basta con añadir un `archetype` en `enemyAI.ts`.
- Sonido y música.
- Arte definitivo: todos los sprites son provisionales y se generan por código.
