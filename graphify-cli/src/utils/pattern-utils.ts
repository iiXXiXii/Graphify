/**
 * Represents the intensity levels for GitHub contribution graph patterns
 * 0: No contributions
 * 1-4: Light to maximum contribution levels
 */
export type ContributionIntensity = 0 | 1 | 2 | 3 | 4;

/**
 * Represents a 2D grid pattern for GitHub contributions
 */
export type ContributionPattern = ContributionIntensity[][];

/**
 * Shape options for simple patterns
 */
export type PatternShape = 'rectangle' | 'heart' | 'letter' | 'sine' | 'random';

/**
 * Options for creating simple patterns
 */
export interface SimplePatternOptions {
  /** Width of the pattern grid (default: 7) */
  width?: number;
  /** Height of the pattern grid (default: 7) */
  height?: number;
  /** Intensity level for active cells (default: 2) */
  intensity?: ContributionIntensity;
  /** Letter to use for letter patterns (default: 'G') */
  letter?: string;
  /** Amount of randomness to apply (0-1, default: 0) */
  randomness?: number;
}

/**
 * Validates a pattern grid for potential issues
 *
 * @param pattern - The contribution pattern to validate
 * @returns Array of validation issues (empty if valid)
 */
export function validatePattern(pattern: number[][]): string[] {
  const issues: string[] = [];

  // Check for empty pattern
  if (!pattern || pattern.length === 0) {
    issues.push('Pattern is empty');
    return issues;
  }

  // Check first row length
  if (!pattern[0]) {
    issues.push('Pattern has empty rows');
    return issues;
  }

  const firstRowLength = pattern[0].length;
  if (firstRowLength === 0) {
    issues.push('Pattern has empty rows');
    return issues;
  }

  // Check for rectangular shape (all rows have same length)
  for (let i = 1; i < pattern.length; i++) {
    const row = pattern[i];
    if (row && row.length !== firstRowLength) {
      issues.push(`Row ${i + 1} has different length (${row.length}) than first row (${firstRowLength})`);
    }
  }

  // Check for valid intensity values (0-4)
  for (let row = 0; row < pattern.length; row++) {
    const currentRow = pattern[row];
    if (currentRow) {
      for (let col = 0; col < currentRow.length; col++) {
        const value = currentRow[col];
        if (value !== undefined && (!Number.isInteger(value) || value < 0 || value > 4)) {
          issues.push(`Invalid intensity value ${value} at position [${row},${col}]. Values must be integers from 0-4.`);
        }
      }
    }
  }

  // Warning if pattern is too large
  if (pattern.length * firstRowLength > 365) {
    issues.push(`Pattern is very large (${pattern.length} × ${firstRowLength} = ${pattern.length * firstRowLength} cells). This may create a lot of commits.`);
  }

  return issues;
}

/**
 * Creates a simple pattern (rectangle, heart, letter etc)
 *
 * @param type - The shape of the pattern to create
 * @param options - Configuration options for the pattern
 * @returns A 2D array representing the contribution pattern
 */
export function createSimplePattern(
  type: PatternShape,
  options: SimplePatternOptions = {}
): ContributionPattern {
  const width = Math.max(1, options.width || 7);
  const height = Math.max(1, options.height || 7);
  // Ensure intensity is always a valid ContributionIntensity
  const intensity = (options.intensity !== undefined)
    ? options.intensity
    : 2 as ContributionIntensity;
  const randomness = Math.min(1, Math.max(0, options.randomness || 0));

  // Initialize empty pattern
  const pattern: ContributionPattern = Array(height)
    .fill(0)
    .map(() => Array(width).fill(0));

  let result: ContributionPattern;

  switch (type) {
    case 'rectangle':
      result = createRectanglePattern(pattern, width, height, intensity);
      break;

    case 'heart':
      result = createHeartPattern(pattern, width, height, intensity);
      break;

    case 'letter':
      result = createLetterPattern(pattern, width, height, intensity, options.letter);
      break;

    case 'sine':
      result = createSinePattern(pattern, width, height, intensity);
      break;

    case 'random':
      result = createRandomPattern(pattern, width, height);
      break;

    default:
      // Handle potential future PatternShape values
      result = pattern;
      break;
  }

  // Add randomness if specified
  if (randomness > 0) {
    applyRandomness(result, randomness);
  }

  return result;
}

/**
 * Creates a rectangle pattern with the specified intensity
 */
function createRectanglePattern(
  _unused: ContributionPattern,
  width: number,
  height: number,
  intensity: number
): ContributionPattern {
  // Initialize a brand new pattern with the proper dimensions to avoid undefined errors
  const newPattern: ContributionPattern = [];
  const safeIntensity = intensity as ContributionIntensity;

  // Create a new 2D array with defined values
  for (let i = 0; i < height; i++) {
    newPattern[i] = Array(width).fill(safeIntensity);
  }

  // Replace the input pattern with our new, properly initialized pattern
  return newPattern;
}

/**
 * Creates a heart-shaped pattern
 */
function createHeartPattern(
  _unused: ContributionPattern,
  width: number,
  height: number,
  intensity: number
): ContributionPattern {
  // Create new pattern to avoid undefined errors
  const newPattern: ContributionPattern = [];
  for (let i = 0; i < height; i++) {
    newPattern[i] = Array(width).fill(0);
  }

  const centerX = Math.floor(width / 2);
  const centerY = Math.floor(height / 2);
  // Prevent division by zero by ensuring minimum size of 1
  const size = Math.max(1, Math.min(centerX, centerY) - 1);
  const safeIntensity = intensity as ContributionIntensity;

  for (let y = 0; y < height; y++) {
    const row = newPattern[y];
    if (!row) continue; // Safety check

    for (let x = 0; x < width; x++) {
      const normalizedX = (x - centerX) / size;
      const normalizedY = (y - centerY) / size;

      // Heart curve formula
      const isInHeart = Math.pow(normalizedX, 2) + Math.pow(normalizedY - 0.4 * Math.sqrt(Math.abs(normalizedX)), 2) <= 0.5;

      if (isInHeart) {
        row[x] = safeIntensity;
      }
    }
  }
  return newPattern;
}

/**
 * Map of predefined 5x5 letter patterns
 */
const LETTER_PATTERNS: Record<string, number[][]> = {
  'A': [
    [0,1,1,0,0],
    [1,0,0,1,0],
    [1,1,1,1,0],
    [1,0,0,1,0],
    [1,0,0,1,0]
  ],
  'G': [
    [0,1,1,1,0],
    [1,0,0,0,0],
    [1,0,1,1,0],
    [1,0,0,1,0],
    [0,1,1,0,0]
  ],
  'H': [
    [1,0,0,1,0],
    [1,0,0,1,0],
    [1,1,1,1,0],
    [1,0,0,1,0],
    [1,0,0,1,0]
  ],
  // Add more letters as needed
};

/**
 * Default letter pattern for unsupported characters
 */
const DEFAULT_LETTER_PATTERN = [
  [1,1,1,0,0],
  [1,0,0,0,0],
  [1,1,1,0,0],
  [1,0,0,0,0],
  [1,1,1,0,0]
];

/**
 * Creates a letter-shaped pattern
 */
function createLetterPattern(
  pattern: ContributionPattern,
  width: number,
  height: number,
  intensity: number,
  letter?: string
): ContributionPattern {
  const letterChar = (letter || 'G').toUpperCase();

  // Use the letter pattern or default to a box
  const letterPattern = LETTER_PATTERNS[letterChar] || DEFAULT_LETTER_PATTERN;

  // Center the letter in the pattern
  const letterHeight = letterPattern.length;
  // Ensure first row exists before accessing its length
  const letterWidth = letterPattern[0] ? letterPattern[0].length : 0;

  const offsetY = Math.floor((height - letterHeight) / 2);
  const offsetX = Math.floor((width - letterWidth) / 2);

  // Ensure all rows in pattern are initialized
  for (let i = 0; i < height; i++) {
    if (!pattern[i]) {
      pattern[i] = Array(width).fill(0);
    }
  }

  for (let i = 0; i < letterHeight; i++) {
    const letterRow = letterPattern[i];
    if (letterRow) {
      for (let j = 0; j < letterWidth; j++) {
        const targetY = i + offsetY;
        const targetX = j + offsetX;

        if (targetY >= 0 && targetY < height && targetX >= 0 && targetX < width) {
          // Ensure the row exists and has the right length
          if (!pattern[targetY]) {
            pattern[targetY] = Array(width).fill(0);
          }
          const letterValue = letterRow[j];
          const safeIntensity = intensity as ContributionIntensity;
          pattern[targetY][targetX] = letterValue ? safeIntensity : 0;
        }
      }
    }
  }
  return pattern;
}

/**
 * Creates a sine wave pattern
 */
function createSinePattern(
  _pattern: ContributionPattern,
  width: number,
  height: number,
  intensity: number
): ContributionPattern {
  // Create a new pattern to avoid undefined errors
  const newPattern: ContributionPattern = [];
  for (let i = 0; i < height; i++) {
    newPattern[i] = Array(width).fill(0);
  }

  const safeIntensity = intensity as ContributionIntensity;

  for (let x = 0; x < width; x++) {
    // Calculate sine y position, centered and scaled
    const amplitude = height * 0.4;
    const frequency = 2 * Math.PI / width;
    const y = Math.floor(height / 2 + amplitude * Math.sin(frequency * x));

    if (y >= 0 && y < height) {
      // Access row directly and ensure it exists
      const row = newPattern[y];
      if (row) {
        row[x] = safeIntensity;
      }

      // Add some thickness to the line - upper line
      if (y + 1 < height) {
        const upperRow = newPattern[y + 1];
        if (upperRow) {
          upperRow[x] = safeIntensity;
        }
      }

      // Add some thickness to the line - lower line
      if (y - 1 >= 0) {
        const lowerRow = newPattern[y - 1];
        if (lowerRow) {
          lowerRow[x] = safeIntensity;
        }
      }
    }
  }
  return newPattern;
}

/**
 * Creates a random pattern with varied intensities
 */
function createRandomPattern(
  _pattern: ContributionPattern,
  width: number,
  height: number
): ContributionPattern {
  // Create a new pattern to avoid undefined errors
  const newPattern: ContributionPattern = [];

  for (let i = 0; i < height; i++) {
    // Initialize each row with random intensities
    newPattern[i] = Array(width).fill(0).map(() =>
      Math.floor(Math.random() * 5) as ContributionIntensity
    );
  }

  return newPattern;
}

/**
 * Applies randomness to an existing pattern
 */
function applyRandomness(
  pattern: ContributionPattern,
  randomness: number
): ContributionPattern {
  if (!pattern || pattern.length === 0) {
    return pattern;
  }

  const height = pattern.length;
  if (!pattern[0]) {
    return pattern;
  }
  const width = pattern[0].length;

  // Create a completely safe new pattern
  const result: ContributionIntensity[][] = [];

  // First, explicitly initialize every row and cell
  for (let i = 0; i < height; i++) {
    const newRow: ContributionIntensity[] = [];
    result.push(newRow);

    const sourceRow = pattern[i];
    for (let j = 0; j < width; j++) {
      // Safe fallback to 0 if source value is undefined
      let value: ContributionIntensity = 0;

      // Only use source value if it's defined and valid
      if (sourceRow && j < sourceRow.length) {
        const cellValue = sourceRow[j];
        if (cellValue !== undefined) {
          value = cellValue;
        }
      }

      // Push to the new row we just created
      newRow.push(value);
    }
  }

  // Apply randomness with type-safe approach using a for loop with explicit index checking
  for (let i = 0; i < result.length; i++) {
    // Explicitly check if row exists before using it
    const currentRow = result[i];
    if (currentRow) {
      for (let j = 0; j < currentRow.length; j++) {
        if (Math.random() < randomness) {
          // Either add or remove intensity randomly
          const change = Math.random() < 0.5 ? -1 : 1;

          // Check if the value exists at this position
          const currentValue = currentRow[j];

          // Only proceed if value is defined
          if (currentValue !== undefined) {
            const newValue = Math.min(4, Math.max(0, currentValue + change));
            currentRow[j] = newValue as ContributionIntensity;
          }
        }
      }
    }
  }

  return result;
}
