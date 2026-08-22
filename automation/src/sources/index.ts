export interface SourceCapability {
  source: string;
  discoveryImplemented: boolean;
  nativeApplicationDetectionImplemented: boolean;
  nativeApplicationExecutionImplemented: boolean;
  notes: string;
}

/**
 * Capability registry is intentionally explicit. A platform is not reported
 * as an automated collector merely because an ATS adapter exists.
 */
export const SOURCE_CAPABILITIES: SourceCapability[] = [
  {
    source: "linkedin",
    discoveryImplemented: false,
    nativeApplicationDetectionImplemented: true,
    nativeApplicationExecutionImplemented: true,
    notes: "Browser/session discovery can feed the coordinator; no local collector is bundled.",
  },
  {
    source: "naukri",
    discoveryImplemented: false,
    nativeApplicationDetectionImplemented: true,
    nativeApplicationExecutionImplemented: false,
    notes: "Classification contract is ready; native execution requires a separately tested flow.",
  },
  {
    source: "indeed",
    discoveryImplemented: false,
    nativeApplicationDetectionImplemented: true,
    nativeApplicationExecutionImplemented: false,
    notes: "Classification contract is ready; native execution is not enabled.",
  },
  {
    source: "wellfound",
    discoveryImplemented: false,
    nativeApplicationDetectionImplemented: true,
    nativeApplicationExecutionImplemented: false,
    notes: "Classification contract is ready; native execution is not enabled.",
  },
  {
    source: "company-careers",
    discoveryImplemented: false,
    nativeApplicationDetectionImplemented: false,
    nativeApplicationExecutionImplemented: false,
    notes: "External destinations are manual-first; no collector is bundled.",
  },
  {
    source: "greenhouse",
    discoveryImplemented: false,
    nativeApplicationDetectionImplemented: false,
    nativeApplicationExecutionImplemented: false,
    notes: "Existing ATS adapter is execution-only and disabled for external automation by default.",
  },
  {
    source: "lever",
    discoveryImplemented: false,
    nativeApplicationDetectionImplemented: false,
    nativeApplicationExecutionImplemented: false,
    notes: "Existing ATS adapter is execution-only and disabled for external automation by default.",
  },
  {
    source: "ashby",
    discoveryImplemented: false,
    nativeApplicationDetectionImplemented: false,
    nativeApplicationExecutionImplemented: false,
    notes: "Existing ATS adapter is execution-only and disabled for external automation by default.",
  },
  {
    source: "workday",
    discoveryImplemented: false,
    nativeApplicationDetectionImplemented: false,
    nativeApplicationExecutionImplemented: false,
    notes: "Existing ATS adapter is execution-only and disabled for external automation by default.",
  },
];

export function sourceCapability(source: string): SourceCapability | undefined {
  return SOURCE_CAPABILITIES.find((item) => item.source.toLowerCase() === source.toLowerCase());
}

