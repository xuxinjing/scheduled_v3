export type ChatRole = "user" | "assistant" | "system";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
};

export type WeekConfig = {
  week_start: string;
  service_levels: Record<string, string>;
  unavailable: Record<string, string[]>;
  forced_days: Record<string, string[]>;
  training_shadows?: Record<string, { days: string[]; station: string }>;
  weekly_capability_grants?: Record<string, { days: string[]; station: string; level: string }>;
  notes: string[];
};

export type ChatResponse = {
  reply: string;
  weekConfig: WeekConfig;
  confirmationReady: boolean;
};

export type ReasoningEvent = {
  type:
    | "phase"
    | "step"
    | "reasoning"
    | "thinking_delta"
    | "verdict"
    | "summary"
    | "integrity_result"
    | "status"
    | "error"
    | "done"
    | "message"
    | "code_fix"
    | "code_change"
    | "complete";
  content?: unknown;
  status?: "complete" | "warning" | "failed" | "pass" | "warn" | "fail";
  summary?: string;
  model?: string | null;
  error?: string;
  integrity_status?: "pass" | "warn" | "fail" | string;
  changes?: string[];
  details?: Record<string, unknown>;
};

export type ScheduleListItem = {
  id: string;
  created_at: string;
  week_start: string;
  restaurant_name: string;
  status: string;
  email_sent_at?: string | null;
  has_excel?: boolean;
  excel_url?: string | null;
};

export type ScheduleRun = {
  schedule_id: string;
  created_at: string;
  context: {
    week_start: string;
    open_days: string[];
    restaurant_name: string;
  };
  integrity: {
    status: string;
    summary: string;
    model: string | null;
    warnings: string[];
  } | null;
  preflight: {
    errors: string[];
    warnings: string[];
  };
  assignments: Array<{
    day: string;
    shift: string;
    station: string;
    employee: string;
    coverage_type: string;
    notes: string;
  }>;
  shift_counts: Record<string, Record<string, number>>;
  report: {
    status: string;
    errors: string[];
    warnings: string[];
    assumptions: string[];
  };
  report_markdown: string;
  email_sent_at?: string | null;
  email_recipient?: string | null;
  excel_url?: string | null;
  pivot_preview: {
    week_start: string;
    days: string[];
    rows: Array<{
      employee: string;
      role: string;
      cells: Record<string, { text: string; entries: Array<{ shift: string; label: string; coverage_type: string }> }>;
    }>;
  };
  artifacts: Record<string, string | number | boolean>;
};

export type ScheduleDetail = Omit<ScheduleRun, "schedule_id"> & {
  id: string;
};
