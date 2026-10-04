export function toObjectIdString(value: unknown): string {
  return String(value);
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
