/** Departments used for student/result organisation and reporting filters. */
export interface Department {
  id: string;
  name: string;
  code: string;
}

/** Static reference list — organisational taxonomy, not exam data. */
export const DEPARTMENTS: Department[] = [
  { id: "pharmacy", code: "PHT", name: "Pharmacy Technician" },
  { id: "nursing", code: "NUR", name: "Nursing" },
  { id: "community-health", code: "CHO", name: "Community Health" },
  { id: "health-information", code: "HIM", name: "Health Information Management" },
  { id: "medical-lab", code: "MLT", name: "Medical Laboratory Technology" },
  { id: "environmental-health", code: "EHT", name: "Environmental Health" },
];

export type ExportFormat = "xlsx" | "pdf";

export const EXPORT_FORMAT_LABELS: Record<ExportFormat, string> = {
  xlsx: "Excel (.xlsx)",
  pdf: "PDF / Print",
};