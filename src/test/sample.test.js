import { describe, it, expect } from 'vitest'
import {
  AlgorithmStyle,
  Language,
  Theme,
} from '../src/utils/preferences'

describe('utils/preferences enums', () => {
  it('mantém valores de enum congelados (Object.freeze)', () => {
    expect(Object.isFrozen(Theme)).toBe(true)
    expect(Object.isFrozen(Language)).toBe(true)
    expect(Object.isFrozen(AlgorithmStyle)).toBe(true)
  })
})
