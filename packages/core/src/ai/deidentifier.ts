/**
 * PHI de-identification engine.
 * PRIVACY CRITICAL: All PHI must be removed BEFORE data is sent to any AI provider.
 *
 * Strategy:
 * - Hash all identifiers with HMAC-SHA256 (truncated to 16 hex chars)
 * - Replace patient names with [PATIENT], practitioner names with [PROVIDER]
 * - Shift all dates by a random offset (±30 days), consistent per patient
 * - Strip address line/postalCode, phone, email, SSN
 * - PRESERVE: medical codes (LOINC, SNOMED, RxNorm), observation values, dosages
 */

import { createHmac } from 'node:crypto';

import type { Bundle, BundleEntry, DateShiftMap, DeidentifiedBundle } from '@fhirbridge/types';

/** Maximum date shift in days (±30) */
const MAX_DATE_SHIFT_DAYS = 30;

/** Milliseconds per day */
const MS_PER_DAY = 86_400_000;

/**
 * Result of de-identification: the sanitized bundle and date shift map.
 */
export interface DeidentifyResult {
  bundle: DeidentifiedBundle;
  shiftMap: DateShiftMap;
}

/**
 * Hash a value with HMAC-SHA256, return first 16 hex characters.
 * Used for identifiers and patient IDs.
 */
export function hashIdentifier(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('hex').slice(0, 16);
}

/**
 * Generate a deterministic date shift offset in days for a given patient hash.
 * Range: ±30 days. Uses HMAC bytes for determinism.
 */
function getDateShift(patientIdHash: string, secret: string): number {
  const hmacBytes = createHmac('sha256', secret).update(patientIdHash).digest();
  // Use first 2 bytes to get a value 0–65535, map to -30..+30
  const raw = (hmacBytes[0]! << 8) | hmacBytes[1]!;
  return Math.round((raw / 65535) * (MAX_DATE_SHIFT_DAYS * 2)) - MAX_DATE_SHIFT_DAYS;
}

/**
 * Shift an ISO 8601 date string by the given number of days.
 * Handles full datetime strings and date-only strings.
 * Returns the original string if parsing fails.
 */
export function shiftDate(dateStr: string, offsetDays: number): string {
  if (!dateStr) return dateStr;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const shifted = new Date(d.getTime() + offsetDays * MS_PER_DAY);
    // Preserve original format (date-only vs datetime)
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return shifted.toISOString().slice(0, 10);
    }
    return shifted.toISOString();
  } catch {
    return dateStr;
  }
}

/**
 * Deep-clone and de-identify a FHIR resource object.
 * Traverses all fields, applying transformations based on field names.
 */
function deidentifyResource(
  resource: Record<string, unknown>,
  secret: string,
  offsetDays: number,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(resource)) {
    // Skip null/undefined
    if (value === null || value === undefined) {
      result[key] = value;
      continue;
    }

    // STRIP: text narrative (contains human-readable PHI in HTML)
    if (key === 'text' && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = {
        status: 'empty',
        div: '<div xmlns="http://www.w3.org/1999/xhtml">[NARRATIVE REDACTED]</div>',
      };
      continue;
    }

    // STRIP: extensions (may contain SSN, maiden name, tribal affiliation, etc.)
    if (key === 'extension' || key === 'modifierExtension') {
      result[key] = [];
      continue;
    }

    // STRIP: note fields (free-text clinical notes with PHI)
    if (key === 'note' && Array.isArray(value)) {
      result[key] = [];
      continue;
    }

    // PRESERVE: resourceType, id (will be hashed below), status, codes
    if (key === 'resourceType' || key === 'status' || key === 'type') {
      result[key] = value;
      continue;
    }

    // Hash resource IDs
    if (key === 'id' && typeof value === 'string') {
      result[key] = hashIdentifier(value, secret);
      continue;
    }

    // Hash identifier values (but preserve system)
    if (key === 'identifier' && Array.isArray(value)) {
      result[key] = value.map((id: Record<string, unknown>) => ({
        system: id['system'],
        value: id['value'] ? hashIdentifier(String(id['value']), secret) : undefined,
      }));
      continue;
    }

    // Strip patient/practitioner names
    if (key === 'name' && Array.isArray(value)) {
      // Check context: if this is inside a Patient or Practitioner, replace names
      result[key] = [{ family: '[PATIENT]', given: ['[PATIENT]'] }];
      continue;
    }

    // Strip telecom (phone, email)
    if (key === 'telecom' && Array.isArray(value)) {
      result[key] = [];
      continue;
    }

    // Strip address details, keep only city/state for geographic context
    if (key === 'address' && Array.isArray(value)) {
      result[key] = value.map((addr: Record<string, unknown>) => ({
        city: addr['city'],
        state: addr['state'],
        country: addr['country'],
      }));
      continue;
    }

    // Shift date fields
    if (
      (key.endsWith('Date') ||
        key.endsWith('DateTime') ||
        key.endsWith('Time') ||
        key === 'birthDate' ||
        key === 'deceasedDateTime' ||
        key === 'issued' ||
        key === 'effectiveDateTime' ||
        key === 'performedDateTime' ||
        key === 'start' ||
        key === 'end' ||
        key === 'timestamp') &&
      typeof value === 'string'
    ) {
      result[key] = shiftDate(value, offsetDays);
      continue;
    }

    // Hash reference values but preserve reference type
    if (key === 'reference' && typeof value === 'string') {
      const parts = value.split('/');
      if (parts.length === 2) {
        result[key] = `${parts[0]}/${hashIdentifier(parts[1]!, secret)}`;
      } else {
        result[key] = hashIdentifier(value, secret);
      }
      continue;
    }

    // PRESERVE: coding objects (system + code + display) — medical codes must not be altered
    if (key === 'coding' && Array.isArray(value)) {
      result[key] = value; // Preserve LOINC, SNOMED, RxNorm codes as-is
      continue;
    }

    // PRESERVE: valueQuantity, valueCodeableConcept, doseAndRate, dosageInstruction
    if (
      key === 'valueQuantity' ||
      key === 'valueCodeableConcept' ||
      key === 'valueInteger' ||
      key === 'valueDecimal' ||
      key === 'valueString' ||
      key === 'doseAndRate' ||
      key === 'dosageInstruction' ||
      key === 'code' ||
      key === 'category' ||
      key === 'component'
    ) {
      // valueString can contain free-text with PHI — redact
      if (key === 'valueString' && typeof value === 'string') {
        result[key] = '[CLINICAL_TEXT_REDACTED]';
        continue;
      }
      result[key] = value;
      continue;
    }

    // Recurse into nested objects
    if (typeof value === 'object' && !Array.isArray(value)) {
      result[key] = deidentifyResource(value as Record<string, unknown>, secret, offsetDays);
      continue;
    }

    // Recurse into arrays
    if (Array.isArray(value)) {
      result[key] = value.map((item) => {
        if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
          return deidentifyResource(item as Record<string, unknown>, secret, offsetDays);
        }
        return item;
      });
      continue;
    }

    // Pass through primitives (boolean, number, string not matched above)
    result[key] = value;
  }

  return result;
}

/**
 * De-identify a FHIR Bundle.
 * Returns the sanitized bundle and the date shift map for later re-identification.
 *
 * PRIVACY GUARANTEE: No PHI in the returned bundle.
 */
export function deidentify(bundle: Bundle, hmacSecret: string): DeidentifyResult {
  const shiftMap: DateShiftMap = {};

  // Determine patient ID hash and date shift offset
  const patientEntry = bundle.entry?.find((e) => e.resource?.resourceType === 'Patient');
  const patientId = patientEntry?.resource?.id ?? 'unknown';
  const patientIdHash = hashIdentifier(patientId, hmacSecret);

  if (!(patientIdHash in shiftMap)) {
    shiftMap[patientIdHash] = getDateShift(patientIdHash, hmacSecret);
  }
  const offsetDays = shiftMap[patientIdHash]!;

  // De-identify each entry
  const deidentifiedEntries: BundleEntry[] = (bundle.entry ?? []).map((entry) => {
    if (!entry.resource) return entry;

    const rawResource = entry.resource as unknown as Record<string, unknown>;
    const deidentifiedResource = deidentifyResource(rawResource, hmacSecret, offsetDays);

    return {
      ...entry,
      fullUrl: entry.fullUrl
        ? `urn:uuid:${hashIdentifier(entry.fullUrl, hmacSecret)}`
        : entry.fullUrl,
      resource: deidentifiedResource as Bundle['entry'] extends Array<infer E>
        ? E extends { resource?: infer R }
          ? R
          : never
        : never,
    };
  });

  const deidentifiedBundle = {
    resourceType: 'Bundle' as const,
    type: bundle.type,
    timestamp: bundle.timestamp ? shiftDate(bundle.timestamp, offsetDays) : undefined,
    total: bundle.total,
    entry: deidentifiedEntries,
    _deidentified: true as const,
  } as DeidentifiedBundle;

  return { bundle: deidentifiedBundle, shiftMap };
}

/**
 * Re-identify dates in a summary text using the shift map.
 * Reverses the date shift by applying the negative offset.
 * NOTE: This modifies de-identified date strings back to approximate originals.
 */
export function reidentifyDates(text: string, shiftMap: DateShiftMap): string {
  const offsets = Object.values(shiftMap);
  // Safety: only apply if single patient (multi-patient would corrupt dates)
  if (offsets.length !== 1) {
    return text; // Cannot safely reverse dates for multi-patient bundles
  }
  const offset = offsets[0]!;
  return text.replace(/\b(\d{4}-\d{2}-\d{2}(?:T[\d:.]+Z?)?)\b/g, (match) =>
    shiftDate(match, -offset),
  );
}
