/**
 * FHIR R4 Bundle resource type.
 * A container for a collection of resources.
 */

import type { Resource, Meta } from './base-resource.js';

/** Bundle type values (FHIR R4) */
export type BundleType =
  | 'document'
  | 'message'
  | 'transaction'
  | 'transaction-response'
  | 'batch'
  | 'batch-response'
  | 'history'
  | 'searchset'
  | 'collection';

/** Search mode for a bundle entry result */
export type BundleEntrySearchMode = 'match' | 'include' | 'outcome';

/** Search metadata for a bundle entry */
export interface BundleEntrySearch {
  mode?: BundleEntrySearchMode;
  score?: number;
}

/** HTTP request details for transaction/batch bundles */
export interface BundleEntryRequest {
  method: 'GET' | 'HEAD' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  ifNoneMatch?: string;
  ifModifiedSince?: string;
  ifMatch?: string;
  ifNoneExist?: string;
}

/** HTTP response details for transaction/batch response bundles */
export interface BundleEntryResponse {
  status: string;
  location?: string;
  etag?: string;
  lastModified?: string;
  outcome?: Resource;
}

/** A single entry in a Bundle */
export interface BundleEntry {
  /** Absolute URL for the resource — typically urn:uuid:{uuid} */
  fullUrl?: string;
  resource?: Resource;
  search?: BundleEntrySearch;
  request?: BundleEntryRequest;
  response?: BundleEntryResponse;
}

/** Bundle link element */
export interface BundleLink {
  relation: string;
  url: string;
}

/**
 * FHIR R4 Bundle resource.
 * Required: type.
 */
export interface Bundle {
  readonly resourceType: 'Bundle';
  id?: string;
  meta?: Meta;
  implicitRules?: string;
  language?: string;
  identifier?: { system?: string; value?: string };
  /** Required: type of the bundle */
  type: BundleType;
  timestamp?: string;
  total?: number;
  link?: BundleLink[];
  entry?: BundleEntry[];
  signature?: unknown;
}
