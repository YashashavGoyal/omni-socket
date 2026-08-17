import { ValidationError } from '../errors';

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const MAX_DEPTH = 10;
const MAX_STRING_LENGTH = 65536; // 64 KB limit per text field

export class SecuritySanitizer {
  /**
   * Recursively sanitizes any client payload (objects, strings, arrays).
   * Prevents prototype pollution, XSS tags, control characters, and stack exhaustion.
   */
  public sanitize<T>(input: T, currentDepth: number = 0): T {
    if (input === null || input === undefined) {
      return input;
    }

    if (currentDepth > MAX_DEPTH) {
      throw new ValidationError(`Payload nesting depth exceeds maximum allowed limit of ${MAX_DEPTH}`);
    }

    // 1. Handle Strings (Strip dangerous scripts & control chars)
    if (typeof input === 'string') {
      return this.sanitizeString(input) as unknown as T;
    }

    // 2. Handle Arrays
    if (Array.isArray(input)) {
      return input.map((item) => this.sanitize(item, currentDepth + 1)) as unknown as T;
    }

    // 3. Handle Objects (Check prototype pollution & sanitize keys/values)
    if (typeof input === 'object') {
      const sanitizedObj: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(input)) {
        if (DANGEROUS_KEYS.has(key)) {
          throw new ValidationError(`Security violation: Dangerous prototype key '${key}' detected`);
        }

        const cleanKey = this.sanitizeString(key);
        sanitizedObj[cleanKey] = this.sanitize(value, currentDepth + 1);
      }

      return sanitizedObj as T;
    }

    // 4. Return primitives (numbers, booleans) directly
    return input;
  }

  /**
   * Strips HTML tags, script injection tokens, and invisible control characters.
   */
  private sanitizeString(str: string): string {
    if (str.length > MAX_STRING_LENGTH) {
      throw new ValidationError(`String payload length exceeds maximum limit of ${MAX_STRING_LENGTH} characters`);
    }

    return str
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Strip ASCII control characters
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Strip <script> blocks
      .replace(/<[^>]*>/g, '') // Strip remaining HTML tags
      .replace(/javascript:/gi, ''); // Neutralize javascript: URIs
  }
}

export const securitySanitizer = new SecuritySanitizer();
