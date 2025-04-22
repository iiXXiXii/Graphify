/**
 * Random utilities for Graphify
 */

/**
 * Generates a random integer between min and max (inclusive)
 * @param min Minimum value (inclusive)
 * @param max Maximum value (inclusive)
 * @returns Random integer
 */
export function getRandomInt(min: number, max: number): number {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generates a random date between startDate and endDate
 * @param startDate Start date for the range
 * @param endDate End date for the range
 * @returns Random date between the range
 */
export function getRandomDate(startDate: Date, endDate: Date): Date {
  const startTimestamp = startDate.getTime();
  const endTimestamp = endDate.getTime();
  const randomTimestamp = getRandomInt(startTimestamp, endTimestamp);
  
  return new Date(randomTimestamp);
}

/**
 * Shuffles an array in place using Fisher-Yates algorithm
 * @param array Array to shuffle
 * @returns The shuffled array (same reference)
 */
export function shuffleArray<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = getRandomInt(0, i);
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
} 