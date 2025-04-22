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

/**
 * Generates a random element from an array
 * @param array Array to select from
 * @returns Random element from the array
 */
export function getRandomElement<T>(array: T[]): T {
  return array[getRandomInt(0, array.length - 1)];
}

/**
 * Generates a random boolean with specified probability
 * @param probability Probability of returning true (0-1)
 * @returns Random boolean
 */
export function getRandomBoolean(probability: number = 0.5): boolean {
  return Math.random() < probability;
}

/**
 * Generates a random string of specified length
 * @param length Length of the string
 * @param charset Character set to use (defaults to alphanumeric)
 * @returns Random string
 */
export function getRandomString(length: number, charset: string = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'): string {
  let result = '';
  const charactersLength = charset.length;

  for (let i = 0; i < length; i++) {
    result += charset.charAt(Math.floor(Math.random() * charactersLength));
  }

  return result;
}
