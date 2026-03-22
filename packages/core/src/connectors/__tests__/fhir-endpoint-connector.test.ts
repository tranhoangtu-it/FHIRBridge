/**
 * Tests for FhirEndpointConnector.
 * Does NOT test actual HTTP calls — only interface compliance and structural behavior.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FhirEndpointConnector } from '../fhir-endpoint-connector.js';
import type { FhirEndpointConfig } from '@fhirbridge/types';

// Stub fhir-kit-client to avoid real HTTP
vi.mock('fhir-kit-client', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      capabilityStatement: vi.fn().mockResolvedValue({ fhirVersion: '4.0.1' }),
      request: vi.fn().mockResolvedValue({
        resourceType: 'Bundle',
        entry: [],
        link: [],
      }),
    })),
  };
});

const BASE_CONFIG: FhirEndpointConfig = {
  type: 'fhir-endpoint',
  baseUrl: 'https://hapi.fhir.org/baseR4',
};

describe('FhirEndpointConnector', () => {
  let connector: FhirEndpointConnector;

  beforeEach(() => {
    connector = new FhirEndpointConnector();
  });

  describe('interface compliance', () => {
    it('has type "fhir-endpoint"', () => {
      expect(connector.type).toBe('fhir-endpoint');
    });

    it('has connect method', () => {
      expect(typeof connector.connect).toBe('function');
    });

    it('has testConnection method', () => {
      expect(typeof connector.testConnection).toBe('function');
    });

    it('has fetchPatientData method', () => {
      expect(typeof connector.fetchPatientData).toBe('function');
    });

    it('has disconnect method', () => {
      expect(typeof connector.disconnect).toBe('function');
    });
  });

  describe('connect()', () => {
    it('stores config and resolves without error for valid fhir-endpoint config', async () => {
      await expect(connector.connect(BASE_CONFIG)).resolves.toBeUndefined();
    });

    it('throws ConnectorError when config type is not fhir-endpoint', async () => {
      const wrongConfig = {
        type: 'csv',
        filePath: '/tmp/data.csv',
      } as unknown as FhirEndpointConfig;
      await expect(connector.connect(wrongConfig)).rejects.toThrow('Expected fhir-endpoint config');
    });
  });

  describe('testConnection()', () => {
    it('returns ConnectionStatus with connected:true after successful connect', async () => {
      await connector.connect(BASE_CONFIG);
      const status = await connector.testConnection();

      expect(status).toMatchObject({ connected: true });
      expect(typeof status.checkedAt).toBe('string');
    });

    it('returns ConnectionStatus object (may fail) when called without connect', async () => {
      // Without connect, client is null — connector creates a temporary client using empty baseUrl
      // testConnection should not throw but may return connected:false
      const status = await connector.testConnection();
      expect(typeof status.connected).toBe('boolean');
      expect(typeof status.checkedAt).toBe('string');
    });
  });

  describe('disconnect()', () => {
    it('resolves without error', async () => {
      await connector.connect(BASE_CONFIG);
      await expect(connector.disconnect()).resolves.toBeUndefined();
    });

    it('fetchPatientData throws ConnectorError after disconnect', async () => {
      await connector.connect(BASE_CONFIG);
      await connector.disconnect();

      const gen = connector.fetchPatientData('patient-123');
      await expect(gen[Symbol.asyncIterator]().next()).rejects.toThrow('connect()');
    });
  });
});
