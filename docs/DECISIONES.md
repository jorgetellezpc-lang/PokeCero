# Decisiones y parámetros provisionales

Este documento recoge qué está **acordado** y qué es **provisional**, es decir, valores elegidos solo para que el prototipo se pueda jugar. Los valores provisionales están centralizados en `src/config/balance.ts` y en `src/data/`.

## Acordado

- **Personajes elegibles:**
  - Solo se puede jugar con Bulbasaur, Charmander, Squirtle y Pikachu, los 4 disponibles desde el principio (`PLAYABLE_POKEMON` en `src/data/pokemon.ts`).
  - Evolucionan durante la partida.
  - El resto de Pokémon de Kanto solo aparece como enemigo.
  - Al cargar un guardado antiguo, la selección pasa a estos 4. Las mejoras compradas para otros Pokémon se conservan en el guardado, sin uso.
- **Gachapón:**
  - Ya no reparte Pokémon. La pestaña sigue visible («Próximamente») con los tickets, y su aviso «!» está apagado.
  - El código del sorteo (`src/meta/gacha.ts`) se conserva sin uso, hasta decidir qué premia.

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

- **Motor de movimientos.** Hay ~100 movimientos con 23 comportamientos: proyectil, cuerpo a cuerpo, rayo, orbe, onda, aura, potenciador, bumerán, cadena, mina, meteoro, torreta, embestida, rastro, cono, teledirigido, rebote, carga, giro, terremoto, remolino, empujón y aturdimiento.
  - Desde la v0.4 el jugador ya no los aprende: tiene un único **ataque característico** (ver más abajo). El catálogo se conserva como biblioteca de comportamientos y lo siguen probando los tests.
- **Tabla de tipos** completa de 18 tipos, suavizada: ×1,6 si es eficaz, ×0,6 si es poco eficaz y ×0,3 en vez de inmunidad.
- **Estados alterados:** quemadura, veneno, ralentización, aturdimiento, empujón y escudo.
- **Enemigos:**
  - Puede salir cualquier Pokémon de Kanto que no sea legendario.
  - Se agrupan en 5 tramos por fuerza (total de estadísticas base) y cada partida sortea un elenco de 7 Pokémon por tramo.
  - Hay 13 personalidades: perseguidor, embestida, distancia, tanque, corredor, curandero, escudo, invocador, kamikaze, rayo con aviso, zonas, abanico y salto.
- **Jefes.** Cada uno tiene 4 ataques con aviso en el suelo (pisotón, embestida o salto, y dos de distancia según su tipo), alterna entre pelear de cerca y de lejos, y se enfurece al 50 % de vida.
- **Cartas de nivel:**
  - Tipos: mejora del ataque, evolución del ataque, estadística y habilidad.
  - Estadísticas: Vigor, Potencia, Carrera, Reflejos, Coraza, Síntesis, Imán, Aprendizaje y Baya Zidra.
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
- **Cartas:** las habilidades entran en el sorteo de las 3 cartas junto a las mejoras del ataque y las estadísticas. Su color indica la rareza, y la carta avisa si completa una sinergia.
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

## Ataque característico por tipos (v0.4)

Cada Pokémon tiene **un solo ataque**, generado a partir de sus tipos. Todas las cartas de ataque lo mejoran a él. El catálogo es declarativo y está en `src/data/signatures.ts`. Los valores provisionales están en `balance.attack`.

- **Cómo se genera:**
  - El primer tipo **lanza** el ataque: da el comportamiento, la forma del proyectil, el daño por tipo y los valores base, que salen de los movimientos iniciales de antes.
  - El segundo tipo **aporta su efecto**.
  - Excepción: Normal cede el lanzamiento al otro tipo. Por eso Pidgey lanza el ataque Volador con el efecto Normal.
  - El ataque es físico o especial según el lado fuerte del Pokémon.
  - Las 18 × 17 combinaciones salen solas, sin lista cerrada, y un test las recorre todas.

| Tipo | Comportamiento | Ataque puro → evolucionado | Efecto como segundo tipo |
|---|---|---|---|
| Normal | teledirigido | Rapidez → Meteoro | +10 % daño |
| Fuego | proyectil | Ascuas → Llamarada | quema |
| Agua | proyectil perforante | Pistola Agua → Hidrocañón | atraviesa y empuja |
| Planta | bumerán (2 hojas) | Hoja Afilada → Lluevehojas | te cura al golpear |
| Eléctrico | proyectil rapidísimo | Impactrueno → Trueno | puede paralizar |
| Psíquico | proyectil que persigue | Confusión → Psicocarga | busca al enemigo |
| Veneno | proyectil | Residuos → Bomba Lodo | envenena |
| Tierra | bumerán | Bumerán de Barro → Tierra Viva | estalla en un área pequeña |
| Volador | teledirigido (2 cuchillas) | Tajo Aéreo → Ataque Aéreo | más rápido y corrige el rumbo |
| Bicho | rebote | Rayo Señal → Zumbido | se divide al impactar |
| Roca | proyectil pesado | Lanzarrocas → Roca Afilada | más daño y empuje |
| Hielo | teledirigido rápido | Canto Helado → Ventisca | ralentiza |
| Lucha | esfera que persigue | Esfera Aural → Onda Certera | más críticos |
| Fantasma | proyectil perforante | Bola Sombra → Pesadilla | atraviesa y castiga los estados |
| Dragón | rayo | Furia Dragón → Cometa Draco | +15 % daño |
| Hada | teledirigido que cura | Beso Drenaje → Fuerza Lunar | encandila y cura |
| Acero | rebote | Disparo Espejo → Foco Resplandor | rebota a otro enemigo |
| Siniestro | teledirigido | Golpe Bajo → Tajo Umbrío | más críticos |

- **Nombres:**
  - En las combinaciones, el nombre se forma con el sustantivo del primer tipo y el adjetivo del segundo, concordando en género. Por ejemplo, Llama aérea, Chorro tóxico o Hoja psíquica.
  - Algunas combinaciones tienen nombre propio, por ejemplo Tornado de Plumas (Normal/Volador), Tormenta Glacial (Agua/Hielo), Enredadera Tóxica (Planta/Veneno), Tormenta Magnética (Eléctrico/Acero), Avalancha Sísmica (Roca/Tierra), Nova Astral (Psíquico/Hada), Ciclón Dracónico (Dragón/Volador) y Ala Ígnea (Fuego/Volador).
- **Excepciones por especie:**
  - Cubone y Marowak: Huesomerang.
  - Pikachu y Raichu: Rayo, que salta entre enemigos.
  - Farfetch'd: Puerro Cortante, que va y vuelve.
  - Voltorb y Electrode: las descargas estallan.
  - Exeggcute y Exeggutor: huevos que estallan.
  - Koffing y Weezing: dejan una nube tóxica.
  - Magikarp: Salpicadura, más débil.
- **Mejoras (17 cartas):**

  | Familia | Cartas |
  |---|---|
  | Daño | Potencia, Cadencia, Velocidad |
  | Forma | Tamaño, Alcance |
  | Cantidad y trayectoria | Proyectil extra, Perforación, Trayectoria ondulante |
  | Efecto | Rebote, Persecución, División, Explosión, Rastro elemental |
  | Estado | Punto débil, Impacto aturdidor, Intensidad elemental |
  | Tipos | Fusión (solo con dos tipos): duplica el efecto del segundo tipo |

  - Solo salen las cartas que **encajan** con el comportamiento: el rayo no recibe proyectiles extra y el bumerán no recibe Perforación. Tampoco salen las que ya están al máximo o en el tope de `balance.attack.caps`.
  - De las 3 cartas, al menos una es para el ataque mientras le queden mejoras.
- **Evolución del ataque:**
  - Requisitos: nivel 10, 5 mejoras y la **mejora clave** de su comportamiento. La clave es Perforación para el proyectil, Proyectil extra para el teledirigido, el bumerán y la cadena, Rebote para el rebote y Tamaño para el rayo. Esa carta avisa de que es la clave y sale con más frecuencia.
  - Cumplidos los requisitos, sale una carta dorada con el efecto.
  - Al evolucionar, el ataque recibe el refuerzo de su comportamiento (por ejemplo, ×1,8 de daño, +2 proyectiles y +2 de perforación en el proyectil) más el de su tipo (Fuego quema el doble y estalla, Veneno deja un charco…).
- **Si la especie evoluciona,** el ataque se transforma con sus tipos nuevos y **conserva las mejoras**. Por ejemplo, Charmeleon con Ascuas pasa a Charizard con Ala Ígnea.
- **Efectos nuevos del motor:**
  - Explosión en área (50 % del golpe).
  - Zona persistente: como mucho 6 a la vez, sin amontonarse.
  - División en fragmentos (45 %).
  - Parálisis (0,6 s; un 35 % de eso a los jefes).
  - Crítico extra.
  - Trayectoria ondulante.
  - Ni los fragmentos, ni las explosiones, ni las zonas repiten estos efectos, para evitar cadenas.
- **Lo que se ve:**
  - El proyectil tiene la forma de su tipo y deja una estela corta del color del segundo tipo.
  - La estela crece con las mejoras. Con 6 mejoras aparece un halo, y al evolucionar el halo es dorado.
  - La explosión usa el color del segundo tipo.
  - Todo es translúcido y corto, para no tapar enemigos ni avisos.
  - Respeta el tope de 360 proyectiles.
- **Ficha del Pokémon:** la pestaña *Ataque* muestra el ataque, sus valores, a qué evoluciona y con qué requisitos, en qué se convierte si la especie evoluciona y qué mejoras le encajan.
- **Pantalla de pausa:** muestra las mejoras cogidas.

## Menús v2: Pokémon y Mapa (diseños del usuario)

- **Pokémon (calcado del diseño):**
  - La captura del usuario (853 × 1844) es un lienzo que se escala al ancho, y cada elemento va en sus coordenadas exactas.
  - El fondo es su escenario, sin interfaz y sin Pikachu.
  - Contenido: selector, tu Pokémon sobre la roca, ficha, PS/Defensa/Velocidad, radar, Entrenamiento y Evolución. La barra de navegación queda encima del escenario, como en el diseño.
  - Lo que el diseño no muestra, pero sigue accesible:
    - **Entrenar** ya no abre las mejoras: avisa de que se compran en la tienda de los pueblos (ver *Aventura*).
    - **Al tocar tu Pokémon** se abre su ficha completa: habilidad, ataque característico, objetos e información.
  - El «Nv.» es el **nivel de entrenamiento** (las mejoras compradas). Los Pokémon no tienen nivel permanente.
  - **Ilustraciones 3D:** de momento solo hay la de Pikachu, recortada del diseño. Charmander, Bulbasaur y Squirtle usan su sprite animado hasta tener la suya: basta añadir `public/ui/pk-3d-<especie>.webp` y su id en `HERO_ART` (`pokemonTab.ts`).
- **Mapa (rediseño v3):**
  - La ilustración ocupa todo el ancho y se desliza en vertical; la tarjeta queda fija sobre la barra de navegación. Sin avisos flotantes encima de las etiquetas.
  - Debajo de cada nombre: candado si aún no lo has visitado, 6 puntos de medalla si tiene gimnasio, o «✓ Visitado» si no lo tiene. Los pueblos sin gimnasio **no muestran medallas**.
  - La tarjeta muestra el lugar elegido (al abrir, donde estás). **Entrar** lleva al pueblo; los no visitados dicen cómo llegar.
- **Barra superior nueva:** avatar, «Kanto», «Medallas x/8» con 8 puntos, oro, tickets y ajustes, sobre un cristal oscuro.
- **Adaptable:** tamaños relativos al ancho real del menú (unidades de contenedor). En móviles muy estrechos el selector pasa a una fila. El juego sigue siendo una columna de hasta 480 px centrada en pantallas grandes.

## Aventura por Kanto (versión jugable provisional)

Decidido con el usuario:

- **Recorrido:** Pueblo Paleta → Ruta 1 → Ciudad Verde → Ruta 2 → Ciudad Plateada. Los pueblos se desbloquean en orden, al llegar por su ruta.
- **Pueblos:** se recorren a pie con el joystick, sin combate, en el mismo escenario 3D. Edificios, carteles y Pokémon con los que hablar; al acercarse aparece un botón para interactuar. La salida norte lleva a la siguiente ruta.
  - Diseño **generado** (casas de colores, caminos, agua); se sustituirá por ilustraciones de cada pueblo.
  - El gimnasio es un edificio dentro de la ciudad (Plateada → Brock). El de Ciudad Verde está cerrado.
- **Rutas:** 5 salas de combate estilo Archero con los salvajes de la ruta; el más fuerte aparece en la última sala. Cada ruta empieza de cero (nivel y cartas). Si caes, vuelves al pueblo anterior; el oro ganado se queda.
- **Tienda:** las mejoras permanentes (el entrenamiento) se compran en la tienda de los pueblos (Verde y Plateada). En la pestaña Pokémon solo se ve el nivel.
- **Partidas guardadas:** todas empiezan en Pueblo Paleta, aunque ya tengan la medalla de Brock (la conservan).
- Datos en `src/data/adventure.ts`; progreso en `src/meta/adventure.ts`; pantalla del pueblo en `src/ui/screens/town.ts`.

## Menús (v0.3)

Estética de juego móvil a partir del ejemplo del usuario: paneles azules con brillo, botones amarillos gruesos y tipografías Lilita One y Nunito (con fuentes de respaldo si no cargan).

- **Mapa:** portada de la región con la isla ilustrada y el botón Entrar; mapa con la ruta entre gimnasios y candados; ficha del gimnasio con su jefe animado, el recorrido de jefes (salas 20, 40 y 50), las recompensas y el botón Comenzar.
- **Pokémon:** tu Pokémon animado sobre una plataforma, su línea evolutiva, sus estadísticas y las mejoras con iconos de color.
- **Gachapón:** máquina de cápsulas con los iniciales alrededor, probabilidades por rareza y tiradas ×1 y ×10.
- **Ajustes:** lista con iconos. Incluye la **calidad gráfica** (automática, alta, media o baja; controla el 3D de verdad), la guía del juego y los créditos.
- **Sin pixel art en los menús:** todos los iconos están dibujados en SVG (`src/ui/icons.ts`).
- **Ilustraciones (v0.4):** son recortes de las pantallas de diseño del usuario (`public/ui/`, ver su README). La interfaz real se coloca encima en el mismo sitio (gimnasios, letrero de medallas, Entrar, Comenzar, tiradas…), así se ve como el diseño pero con los datos reales.
  - Se borraron de las ilustraciones el botón «Eventos» (no existe) y el Pidgeotto del fondo de la ficha.
  - Brock es el único gimnasio con cabecera ilustrada; los demás usan una provisional hasta tener su dibujo.
  - En el mapa del diseño faltaba Ciudad Azulona: su pin se ha colocado sobre la ciudad central.
- **Ficha del Pokémon:** pestañas Mejoras, Movimientos, Objetos (información de los objetos de partida) e Información. «Equipamiento» y «Restablecer» del diseño no se incluyen porque no existen esos sistemas.
- **Avisos «!»** en la navegación: en Pokémon si puedes pagar alguna mejora. El de Gachapón está apagado mientras no reparte nada.
- **No integrado del ejemplo, a propósito:** la **energía** (rayo 30/30, "Comenzar ×5") y el **nivel de jugador**. Son sistemas nuevos de economía y progresión que el blueprint no tiene (y la energía es típica de juegos con pagos). En su lugar, la barra superior muestra tu Pokémon y tus medallas. El idioma no se incluye porque solo hay español.

## Arenas ilustradas (gimnasio de Brock)

- Las dos ilustraciones del usuario son el suelo de las salas: `public/arenas/arena-brock.webp` (salas normales) y `arena-brock-boss.webp` (salas 20, 40 y 50). Se borró el Pidgeotto que venía dibujado.
- Las colisiones están calcadas sobre las rocas, los muros y las antorchas (`src/data/arenas.ts`). Las rocas se recortaron en una segunda imagen (`*-occ.webp`) que tapa a los Pokémon cuando pasan por detrás.
- La cámara es cenital (la perspectiva ya viene en el dibujo) y te sigue sin salirse de la ilustración.
- **Colisión precisa (v0.5):** máscara generada desde la ilustración (`src/data/arenaCollision.ts`, 6 píxeles de detalle): borde del suelo trazado a mano y base real de cada roca. Rendijas y bolsas por las que no cabe un Pokémon se rellenan solas. En las arenas se choca con los pies (radio 7), no con todo el cuerpo.
- **Cámara de arena:** más cerca (ancho visible 215) y adelantada hacia donde te mueves o apuntas.
- **Partida más sobria:** letra Rajdhani, barras finas, paneles oscuros y cartas negras con franja de color (`src/ui/run.css`).
- **Tres arenas normales que se turnan:**
  - Las salas normales de Brock usan tres ilustraciones: la original, `arena-brock-2` (una explanada con seis rocas) y `arena-brock-3` (un camino estrecho entre cascadas y puentes).
  - Se turnan en orden, empezando por una al azar en cada partida. Dos salas normales seguidas nunca repiten arena, aunque haya una de jefe en medio.
  - Cada una tiene su escala, para que el suelo jugable ocupe el ancho de la sala. En la tercera todo se ve un poco más grande.
  - Los tests comprueban que en todas hay entrada y salida y que todo el suelo está conectado.
- Los demás gimnasios siguen con salas generadas hasta tener sus ilustraciones.
- Con las arenas, el bot moría mucho contra los minibosses: se rebajaron los jefes (miniboss vida ×20 y daño ×1,5; jefe ×55 y ×2). Ahora gana unas 14 de cada 32 partidas simuladas.

## Transformación a 3D estilizado (incremento 1)

Detalle en [`3D.md`](3D.md). En resumen:

- Las antorchas dibujadas dan luz y chispas, y los Pokémon tienen contorno de silueta.
- Al salir de la partida se liberan todos los recursos de la GPU.
- Hay una ruta para personajes glTF/GLB: si el modelo no está o no carga, se usa el sprite.
- Pidgeotto sigue bloqueado: no hay un modelo con licencia verificable.

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
| Ataque característico | Valores base, efectos por tipo, cartas, topes y requisitos de evolución (nivel 10, 5 mejoras + la clave) | `data/signatures.ts`, `balance.attack` |
| Tickets | 5 + 5 + 10 por gimnasio, una sola vez; 1/200 por enemigo; 10 de bienvenida | `balance.rewards`, `balance.enemies` |
| Oro de bienvenida | 500 (como en PokéSurvivor) | `balance.rewards` |
| Gachapón | 45 / 30 / 17 / 6,5 / 1,5 %; garantía a las 70 tiradas | `balance.gacha` |

## Equilibrio observado (bot sencillo, `npm run sim`)

- El tipo importa contra Brock, que es de Roca/Tierra: Squirtle y Bulbasaur lo superan con facilidad; Charmander y, sobre todo, Pikachu sufren contra los minibosses, porque lo eléctrico hace ×0,3 a Geodude.
- Una partida de 50 salas dura unos 8–15 minutos y una en modo prueba, unos 2 minutos.
- Con habilidades, el bot gana unas 13 de cada 16 partidas de 50 salas. Probablemente es demasiado fácil para una persona, pero hay que probarlo jugando antes de endurecerlo. Pikachu sigue cayendo a menudo ante Geodude en el modo prueba.

- **Ataque característico (v0.4).** Se midió con el mismo bot y las mismas semillas, con Charmander, Squirtle, Bulbasaur y Pikachu (4 partidas de cada uno):
  - Antes (hasta 4 movimientos): ganaba 5 de 16 partidas en modo prueba y 2 de 16 de 50 salas.
  - Ahora (un ataque, potencia ×1,8): gana 9 de 16 y 3 de 16.
  - Bulbasaur (Enredadera Tóxica) es el más fuerte. Pikachu sigue sufriendo contra Brock por la tabla de tipos.
  - El bot elige las cartas sin criterio; hay que probarlo jugando.
  - Con las tres arenas normales turnándose, el bot gana 13 de 16 en modo prueba y 5 de 16 de 50 salas. Las arenas nuevas son más abiertas. No se atascó en ninguna partida.

## Sin integrar todavía (de PokéSurvivor)

- Shinies: faltan sus sprites, que son otros ~8 MB.
- Mundo abierto, terreno, biomas, climas y grietas con legendarios: no encajan directamente con las salas.
- Cuentas, cooperativo, ranking, misiones, logros, test de personalidad e idiomas.
