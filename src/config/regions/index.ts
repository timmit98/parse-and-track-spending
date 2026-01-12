import type { RegionConfig } from '../../types/index.js'
import { NZ_REGION_CONFIG } from './nz.js'

// NZ-only configuration - removed multi-region support
export function getRegionConfig(): RegionConfig {
  return NZ_REGION_CONFIG
}

export { NZ_REGION_CONFIG }