import { functionErrorMessage } from "@/lib/function-error";
import { supabase } from "@/lib/supabase";

export interface ResultMailRow {
  id: string;
  examId: string;
  examTitle: string;
  courseCode: string;
  courseTitle: string;
  recipients: string;
  status: "pending" | "sending" | "sent" | "failed";
  attempts: number;
  lastError: string | null;
  createdAt: string;
  sentAt: string | null;
}

export interface SendSummary {
  processed: number;
  sent: number;
  failed: number;
  failures: { course: string; error: string }[];
}

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("send-result-sheets", { body });
  if (error) throw new Error(await functionErrorMessage(error));
  if (data?.error) throw new Error(String(data.error));
  return data as T;
}

export const resultMailService = {
  async setExaminerEmail(examCourseId: string, email: string) {
    const { error } = await supabase.rpc("superadmin_set_paper_examiner_email", {
      p_exam_course_id: examCourseId,
      p_email: email.trim() || null,
    });
    if (error) throw new Error(error.message);
  },

  /** Puts a sheet for every paper with an examiner email in the queue (skips papers already waiting). */
  async queueForExam(examId: string): Promise<number> {
    const { data, error } = await supabase.rpc("superadmin_queue_result_mail", { p_exam_id: examId });
    if (error) throw new Error(error.message);
    return Number(data ?? 0);
  },

  async listQueue(limit = 30): Promise<ResultMailRow[]> {
    const { data, error } = await supabase.rpc("superadmin_list_result_mail_queue", { p_limit: limit });
    if (error) throw new Error(error.message);
    return ((data ?? []) as any[]).map((row) => ({
      id: row.id,
      examId: row.exam_id,
      examTitle: row.exam_title,
      courseCode: row.course_code,
      courseTitle: row.course_title,
      recipients: row.recipients,
      status: row.status,
      attempts: Number(row.attempts ?? 0),
      lastError: row.last_error ?? null,
      createdAt: row.created_at,
      sentAt: row.sent_at ?? null,
    }));
  },

  async retry(id: string) {
    const { error } = await supabase.rpc("superadmin_requeue_result_mail", { p_id: id });
    if (error) throw new Error(error.message);
  },

  /** Builds and sends every waiting sheet (optionally only one examination's). */
  sendPending(examId?: string): Promise<SendSummary> {
    return invoke<SendSummary>({ action: "send_pending", examId: examId ?? null });
  },

  async sendTest(to: string): Promise<void> {
    await invoke({ action: "send_test", to });
  },
};
