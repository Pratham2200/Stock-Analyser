import { describe, it, expect } from 'vitest';
import { BaseService } from '../src/services/BaseService';

// Create a concrete implementation for testing
class TestService extends BaseService {
  constructor() {
    super('TestService');
  }

  // Expose protected methods for testing
  public testSanitizeInput(input: any) {
    return this.sanitizeInput(input);
  }

  public testValidateRequired(data: any, fields: string[]) {
    return this.validateRequired(data, fields as any);
  }
}

describe('BaseService', () => {
  const service = new TestService();

  describe('sanitizeInput', () => {
    it('should trim string inputs', () => {
      expect(service.testSanitizeInput('  hello world  ')).toBe('hello world');
    });

    it('should recursively sanitize object properties', () => {
      const input = {
        name: '  stock  ',
        nested: {
          symbol: ' AAPL ',
          price: 150
        }
      };
      
      const expected = {
        name: 'stock',
        nested: {
          symbol: 'AAPL',
          price: 150
        }
      };

      expect(service.testSanitizeInput(input)).toEqual(expected);
    });

    it('should return null/undefined as is', () => {
      expect(service.testSanitizeInput(null)).toBeNull();
      expect(service.testSanitizeInput(undefined)).toBeUndefined();
    });

    it('should return numbers as is', () => {
      expect(service.testSanitizeInput(100.5)).toBe(100.5);
    });
  });

  describe('validateRequired', () => {
    it('should throw if a required field is missing', () => {
      const data = { name: 'Test' };
      expect(() => service.testValidateRequired(data, ['name', 'symbol'])).toThrow(
        "Required field 'symbol' is missing or empty"
      );
    });

    it('should throw if a required field is an empty string', () => {
      const data = { name: 'Test', symbol: '' };
      expect(() => service.testValidateRequired(data, ['name', 'symbol'])).toThrow(
        "Required field 'symbol' is missing or empty"
      );
    });

    it('should pass if all required fields are present', () => {
      const data = { name: 'Test', symbol: 'AAPL' };
      expect(() => service.testValidateRequired(data, ['name', 'symbol'])).not.toThrow();
    });
  });
});
