import dayjs from 'dayjs';

export function validateDateInput(date: string): string {
  if (!dayjs(date, 'YYYY-MM-DD', true).isValid()) {
    throw new Error('Invalid date format. Please use YYYY-MM-DD.');
  }
  return date;
}

export function parseDate(date: string): string {
  return dayjs(date).format('YYYY-MM-DDTHH:mm:ss');
}
