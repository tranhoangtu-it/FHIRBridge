/**
 * FHIR R4 Bundle builder.
 * Constructs a collection Bundle from individual resources using urn:uuid fullUrls.
 */

import { v4 as uuidv4 } from 'uuid';
import type { Resource, Bundle, BundleEntry } from '@fhirbridge/types';

/**
 * Incrementally builds a FHIR R4 Bundle.
 * Each resource gets a urn:uuid fullUrl for cross-referencing.
 */
export class BundleBuilder {
  private readonly entries: BundleEntry[] = [];
  private readonly timestamp: string;

  constructor() {
    this.timestamp = new Date().toISOString();
  }

  /**
   * Add a resource to the bundle.
   * @returns The generated urn:uuid URI (for use in cross-references)
   */
  addResource(resource: Resource): string {
    const uuid = uuidv4();
    const fullUrl = `urn:uuid:${uuid}`;

    this.entries.push({ fullUrl, resource });
    return fullUrl;
  }

  /**
   * Add a resource with an explicit fullUrl.
   * Use this when the fullUrl must match an external reference.
   */
  addResourceWithUrl(resource: Resource, fullUrl: string): void {
    this.entries.push({ fullUrl, resource });
  }

  /**
   * Build the final Bundle resource.
   * Returns a FHIR R4 collection Bundle.
   */
  build(): Bundle {
    return {
      resourceType: 'Bundle',
      type: 'collection',
      timestamp: this.timestamp,
      total: this.entries.length,
      entry: [...this.entries],
    };
  }

  /** Number of resources currently in the builder */
  getResourceCount(): number {
    return this.entries.length;
  }

  /** Remove all entries — allows reuse of the builder instance */
  reset(): void {
    this.entries.length = 0;
  }
}
