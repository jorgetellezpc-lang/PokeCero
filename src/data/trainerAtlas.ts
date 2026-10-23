// Recortes del entrenador y de la Poké Ball (public/ui/trainer.webp): [x, y, ancho, alto].
// Sacados de las hojas de concepto que pasó el usuario (scripts de recorte fuera del repo).
//   w*: de pie y andando (de frente, de espaldas, de lado)
//   r*: corriendo (de lado y de espaldas)
//   t0..t12: lanzamiento de la Poké Ball (mirando a la derecha)
export const TRAINER_ATLAS = {
  w0: [0, 0, 47, 85],
  w1: [49, 0, 47, 85],
  w2: [98, 0, 45, 85],
  w3: [145, 0, 45, 85],
  w7: [192, 0, 49, 84],
  w10: [243, 0, 49, 84],
  w11: [294, 0, 49, 83],
  w12: [345, 0, 44, 84],
  r0: [391, 0, 59, 85],
  r1: [452, 0, 62, 85],
  r2: [516, 0, 59, 80],
  r5: [577, 0, 54, 85],
  r6: [633, 0, 52, 85],
  r7: [687, 0, 47, 86],
  t0: [736, 0, 61, 89],
  t1: [799, 0, 60, 89],
  t2: [861, 0, 61, 89],
  t3: [924, 0, 73, 89],
  t4: [0, 91, 75, 87],
  t5: [77, 91, 77, 89],
  t6: [156, 91, 70, 90],
  t7: [228, 91, 80, 90],
  t8: [310, 91, 80, 89],
  t9: [392, 91, 73, 90],
  t10: [467, 91, 74, 90],
  t11: [543, 91, 71, 89],
  t12: [616, 91, 89, 81],
  ball: [707, 91, 35, 34],
} as const;

export type TrainerFrame = keyof typeof TRAINER_ATLAS;
