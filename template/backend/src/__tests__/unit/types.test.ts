import { describe, it, expect } from 'vitest';
import { toPublicUser } from '../../types';
import { makeAppUser, FIXED_DATE } from '../../../test/factories';

/**
 * `toPublicUser()` ist die Grenze zwischen DB-Zeile (snake_case, Date) und
 * API-Antwort (camelCase, ISO-String). Die Vorlage für jede weitere
 * Serialisierungs-Funktion einer App — deshalb hier voll abgedeckt.
 */

describe('toPublicUser – DB-Zeile zu API-Antwort', () => {
  it('bildet snake_case-Spalten auf camelCase-Felder ab', () => {
    // Arrange
    const user = makeAppUser({ converge_id: 'converge-42', name: 'Anna', email: 'anna@example.com' });

    // Act
    const result = toPublicUser(user);

    // Assert
    expect(result).toMatchObject({
      id: user.id,
      convergeId: 'converge-42',
      name: 'Anna',
      email: 'anna@example.com',
    });
  });

  it('serialisiert created_at als ISO-8601-String', () => {
    // Arrange
    const user = makeAppUser({ created_at: FIXED_DATE });

    // Act
    const result = toPublicUser(user);

    // Assert
    expect(result.createdAt).toBe('2026-01-15T08:30:00.000Z');
  });

  it('serialisiert ein gesetztes last_seen_at als ISO-8601-String', () => {
    // Arrange
    const user = makeAppUser({ last_seen_at: new Date('2026-02-01T12:00:00.000Z') });

    // Act
    const result = toPublicUser(user);

    // Assert
    expect(result.lastSeenAt).toBe('2026-02-01T12:00:00.000Z');
  });

  it('liefert null, wenn last_seen_at nicht gesetzt ist (Benutzer war noch nie da)', () => {
    // Arrange
    const user = makeAppUser({ last_seen_at: null });

    // Act
    const result = toPublicUser(user);

    // Assert
    expect(result.lastSeenAt).toBeNull();
  });

  it('reicht eine fehlende E-Mail als null durch', () => {
    // Arrange
    const user = makeAppUser({ email: null });

    // Act
    const result = toPublicUser(user);

    // Assert
    expect(result.email).toBeNull();
  });
});
