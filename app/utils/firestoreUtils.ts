// Utility to safely extract a string from Firestore {stringValue: ...} or return fallback
export function getStringValue(val: any, fallback: string = ''): string {
  if (typeof val === 'string') return val;
  if (val && typeof val === 'object' && 'stringValue' in val) return val.stringValue;
  return fallback;
}
