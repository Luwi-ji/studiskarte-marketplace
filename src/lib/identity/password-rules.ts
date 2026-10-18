// Pure, so forms and the server read the same limits.
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;
export const PASSWORD_RULE = `Use ${PASSWORD_MIN} to ${PASSWORD_MAX} characters.`;

export function passwordAcceptable(password: string): boolean {
  return password.length >= PASSWORD_MIN && password.length <= PASSWORD_MAX;
}
