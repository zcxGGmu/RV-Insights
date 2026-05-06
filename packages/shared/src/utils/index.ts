/**
 * Shared utility functions for rv-insights
 */

// Placeholder - will be expanded as needed
export function noop(): void {
  // no-op
}

export { diffCapabilities } from './capabilities-diff'
export type { CapabilityChange } from './capabilities-diff'
export {
  applyPipelineRecord,
  createInitialPipelineState,
  isPipelineTerminalStatus,
  serializePipelineState,
} from './pipeline-state'
