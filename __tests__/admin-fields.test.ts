import { describe, it, expect } from 'vitest';
import { applyAdminOnlyFields } from '../lib/admin-fields';
import type { UserRole } from '../types/api';

describe('applyAdminOnlyFields', () => {
  const baseData = {
    nameTh: 'Test Camp',
    isActive: true,
    isPublished: false,
  };

  describe('when caller is ADMIN', () => {
    it('passes isVerified through unchanged', () => {
      const data = { ...baseData, isVerified: true };
      const result = applyAdminOnlyFields(data, 'ADMIN');
      expect(result.isVerified).toBe(true);
    });

    it('passes isVerified=false through unchanged', () => {
      const data = { ...baseData, isVerified: false };
      const result = applyAdminOnlyFields(data, 'ADMIN');
      expect(result.isVerified).toBe(false);
    });

    it('passes verifiedDate through unchanged', () => {
      const date = new Date('2024-01-01');
      const data = { ...baseData, verifiedDate: date };
      const result = applyAdminOnlyFields(data, 'ADMIN');
      expect(result.verifiedDate).toBe(date);
    });

    it('preserves all non-admin fields', () => {
      const data = { ...baseData, isVerified: true };
      const result = applyAdminOnlyFields(data, 'ADMIN');
      expect(result.nameTh).toBe('Test Camp');
      expect(result.isActive).toBe(true);
      expect(result.isPublished).toBe(false);
    });
  });

  describe('when caller is OPERATOR', () => {
    it('strips isVerified', () => {
      const data = { ...baseData, isVerified: true };
      const result = applyAdminOnlyFields(data, 'OPERATOR');
      expect('isVerified' in result).toBe(false);
    });

    it('strips verifiedDate', () => {
      const date = new Date('2024-01-01');
      const data = { ...baseData, verifiedDate: date };
      const result = applyAdminOnlyFields(data, 'OPERATOR');
      expect('verifiedDate' in result).toBe(false);
    });

    it('preserves all non-admin fields', () => {
      const data = { ...baseData, isVerified: true };
      const result = applyAdminOnlyFields(data, 'OPERATOR');
      expect(result.nameTh).toBe('Test Camp');
      expect(result.isActive).toBe(true);
      expect(result.isPublished).toBe(false);
    });

    it('does not mutate the input object', () => {
      const data = { ...baseData, isVerified: true };
      applyAdminOnlyFields(data, 'OPERATOR');
      expect(data.isVerified).toBe(true);
    });
  });

  describe('when caller is CAMPER', () => {
    it('strips isVerified', () => {
      const data = { ...baseData, isVerified: false };
      const result = applyAdminOnlyFields(data, 'CAMPER');
      expect('isVerified' in result).toBe(false);
    });

    it('strips verifiedDate', () => {
      const date = new Date();
      const data = { ...baseData, verifiedDate: date };
      const result = applyAdminOnlyFields(data, 'CAMPER');
      expect('verifiedDate' in result).toBe(false);
    });
  });

  describe('when caller role is undefined (unauthenticated guard edge case)', () => {
    it('strips isVerified', () => {
      const data = { ...baseData, isVerified: true };
      const result = applyAdminOnlyFields(data, undefined);
      expect('isVerified' in result).toBe(false);
    });

    it('strips verifiedDate', () => {
      const data = { ...baseData, verifiedDate: new Date() };
      const result = applyAdminOnlyFields(data, undefined);
      expect('verifiedDate' in result).toBe(false);
    });
  });

  describe('when admin-only fields are absent', () => {
    it('returns data unchanged for ADMIN', () => {
      const result = applyAdminOnlyFields(baseData, 'ADMIN');
      expect(result).toEqual(baseData);
    });

    it('returns data unchanged for OPERATOR (nothing to strip)', () => {
      const result = applyAdminOnlyFields(baseData, 'OPERATOR');
      expect(result).toEqual(baseData);
    });
  });
});
