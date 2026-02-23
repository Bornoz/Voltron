import { z } from 'zod';

export const SimulatorMessageType = z.enum([
  'INJECT_STYLES', 'UPDATE_PROPS', 'UPDATE_LAYOUT', 'REQUEST_SNAPSHOT',
  'STYLE_CHANGED', 'LAYOUT_CHANGED', 'DOM_MUTATED', 'STATE_SNAPSHOT',
]);
export type SimulatorMessageType = z.infer<typeof SimulatorMessageType>;

export const StyleChange = z.object({
  selector: z.string(),
  property: z.string(),
  value: z.string(),
  previousValue: z.string().optional(),
  format: z.enum(['hsl', 'hex', 'rgb', 'tailwind', 'raw']),
});
export type StyleChange = z.infer<typeof StyleChange>;

export const LayoutChange = z.object({
  elementId: z.string(),
  elementSelector: z.string(),
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  previousBounds: z.object({
    x: z.number(), y: z.number(), width: z.number(), height: z.number(),
  }).optional(),
});
export type LayoutChange = z.infer<typeof LayoutChange>;

export const ComponentPropChange = z.object({
  componentName: z.string(),
  propName: z.string(),
  propType: z.string(),
  oldValue: z.unknown(),
  newValue: z.unknown(),
});
export type ComponentPropChange = z.infer<typeof ComponentPropChange>;

export const SimulatorConflict = z.object({
  elementId: z.string(),
  humanChange: z.unknown(),
  aiChange: z.unknown(),
  timestamp: z.number(),
  resolved: z.boolean(),
  resolution: z.enum(['human_wins', 'ai_wins', 'merged', 'pending']).optional(),
});
export type SimulatorConflict = z.infer<typeof SimulatorConflict>;
