/**
 * Formatting utilities — date, file size, resource type, patient ID masking.
 */

/** Format ISO date string to human-readable. */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'Invalid date';
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Format bytes to human-readable string. */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/** Mask patient ID — show only last 4 characters. */
export function maskPatientId(id: string): string {
  if (id.length <= 4) return '****';
  return `****${id.slice(-4)}`;
}

/** Capitalise first letter of resource type. */
export function formatResourceType(type: string): string {
  if (!type) return '';
  return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
}

/** Format a count with label, e.g. "12 resources". */
export function formatCount(count: number, singular: string, plural?: string): string {
  const label = count === 1 ? singular : (plural ?? `${singular}s`);
  return `${count} ${label}`;
}

/** Convert snake_case status to Title Case for display. */
export function formatStatus(status: string): string {
  return status
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
