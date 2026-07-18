/** Stable frontend/native ABI IDs for real TPT simulation tools. */
export const SimulationTool = {
  Air: 1,
  Vacuum: 2,
  Wind: 3,
  Heat: 4,
  Cool: 5,
} as const;

export type SimulationToolId = typeof SimulationTool[keyof typeof SimulationTool];
