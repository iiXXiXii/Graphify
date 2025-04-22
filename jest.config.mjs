export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  transform: {},
  globals: {
    'ts-jest': {
      useESM: true
    }
  },
  moduleNameMapper: {}
}
