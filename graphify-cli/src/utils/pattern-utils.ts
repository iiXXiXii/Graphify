import { DateTime } from 'luxon';

/**
 * Validates a pattern grid for potential issues
 */
export function validatePattern(pattern: number[][]): string[] {
  const issues: string[] = [];

  // Check for empty pattern
  if (!pattern || pattern.length === 0) {
    issues.push('Pattern is empty');
    return issues;
  }

  // Check first row length
  const firstRowLength = pattern[0].length;
  if (firstRowLength === 0) {
    issues.push('Pattern has empty rows');
    return issues;
  }

  // Check for rectangular shape (all rows have same length)
  for (let i = 1; i < pattern.length; i++) {
    if (pattern[i].length !== firstRowLength) {
      issues.push(`Row ${i + 1} has different length (${pattern[i].length}) than first row (${firstRowLength})`);
    }
  }

  // Check for valid intensity values (0-4)
  for (let row = 0; row < pattern.length; row++) {
    for (let col = 0; col < pattern[row].length; col++) {
      const value = pattern[row][col];
      if (!Number.isInteger(value) || value < 0 || value > 4) {
        issues.push(`Invalid intensity value ${value} at position [${row},${col}]. Values must be integers from 0-4.`);
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
 */
export function createSimplePattern(
  type: 'rectangle' | 'heart' | 'letter' | 'sine' | 'random',
  options: {
    width?: number;
    height?: number;
    intensity?: number;
    letter?: string;
    randomness?: number;
  } = {}
): number[][] {
  const width = options.width || 7;
  const height = options.height || 7;
  const intensity = options.intensity || 2;
  const randomness = options.randomness || 0;

  // Initialize empty pattern
  const pattern: number[][] = Array(height).fill(0).map(() => Array(width).fill(0));

  switch (type) {
    case 'rectangle':
      // Fill the entire rectangle with the specified intensity
      for (let i = 0; i < height; i++) {
        for (let j = 0; j < width; j++) {
          pattern[i][j] = intensity;
        }
      }
      break;

    case 'heart':
      // Create a heart shape (basic algorithm)
      const centerX = Math.floor(width / 2);
      const centerY = Math.floor(height / 2);
      const size = Math.min(centerX, centerY) - 1;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const normalizedX = (x - centerX) / size;
          const normalizedY = (y - centerY) / size;

          // Heart curve formula
          const isInHeart = Math.pow(normalizedX, 2) + Math.pow(normalizedY - 0.4 * Math.sqrt(Math.abs(normalizedX)), 2) <= 0.5;

          if (isInHeart) {
            pattern[y][x] = intensity;
          }
        }
      }
      break;

    case 'letter':
      // Create a simple representation of a letter
      const letter = (options.letter || 'G').toUpperCase();

      // Define a simple 5x5 grid for each letter
      const letterPatterns: Record<string, number[][]> = {
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

      // Use the letter pattern or default to a box
      const letterPattern = letterPatterns[letter] || [
        [1,1,1,0,0],
        [1,0,0,0,0],
        [1,1,1,0,0],
        [1,0,0,0,0],
        [1,1,1,0,0]
      ];

      // Center the letter in the pattern
      const letterHeight = letterPattern.length;
      const letterWidth = letterPattern[0].length;

      const offsetY = Math.floor((height - letterHeight) / 2);
      const offsetX = Math.floor((width - letterWidth) / 2);

      for (let i = 0; i < letterHeight; i++) {
        for (let j = 0; j < letterWidth; j++) {
          if (i + offsetY >= 0 && i + offsetY < height && j + offsetX >= 0 && j + offsetX < width) {
            pattern[i + offsetY][j + offsetX] = letterPattern[i][j] ? intensity : 0;
          }
        }
      }
      break;

    case 'sine':
      // Create a sine wave pattern
      for (let x = 0; x < width; x++) {
        // Calculate sine y position, centered and scaled
        const amplitude = height * 0.4;
        const frequency = 2 * Math.PI / width;
        const y = Math.floor(height / 2 + amplitude * Math.sin(frequency * x));

        if (y >= 0 && y < height) {
          pattern[y][x] = intensity;

          // Add some thickness to the line
          if (y + 1 < height) pattern[y + 1][x] = intensity;
          if (y - 1 >= 0) pattern[y - 1][x] = intensity;
        }
      }
      break;

    case 'random':
      // Create a random pattern with varied intensities
      for (let i = 0; i < height; i++) {
        for (let j = 0; j < width; j++) {
          // Random value between 0-4
          pattern[i][j] = Math.floor(Math.random() * 5);
        }
      }
      break;
  }

  // Add randomness if specified
  if (randomness > 0) {
    for (let i = 0; i < height; i++) {
      for (let j = 0; j < width; j++) {
        if (Math.random() < randomness) {
          // Either add or remove intensity randomly
          pattern[i][j] = Math.min(4, Math.max(0, pattern[i][j] + (Math.random() < 0.5 ? -1 : 1)));
        }
      }
    }
  }

  return pattern;
}
