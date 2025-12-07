export interface BoundingBox {
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
}

export enum Severity {
  High = 'High',
  Medium = 'Medium',
  Low = 'Low',
}

export type FixCategory = 'Encryption' | 'Network' | 'Authentication' | 'Device' | 'General';

export interface Threat {
  id: string;
  title: string;
  severity: Severity;
  description: string;
  boundingBox?: BoundingBox;
  fixCode: string;
  fixExplanation: string;
  riskProbability: number; // 0-100% probability of exploit
  mitigatedRiskProbability: number; // 0-100% probability after fix
  mitigationDetails: string; // Specific text describing the state after fix (e.g. "Port 1883 closed, 8883 open")
  fixCategory: FixCategory;
  cve?: string; // Example CVE reference
}

export interface AuditResult {
  overallRiskScore: number; // 0-100, where 100 is extremely risky
  threats: Threat[];
}

export interface AuditSession {
  imageUrl?: string;
  configText?: string;
  audioData?: string; // Base64 audio string
  result: AuditResult | null;
  appliedFixes: string[]; // List of applied fix IDs or Categories
}

export interface FixModule {
  id: string;
  category: FixCategory;
  label: string;
  icon: string; // Lucide icon name
  description: string;
}