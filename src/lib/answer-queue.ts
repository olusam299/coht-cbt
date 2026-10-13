/**
 * Answers chosen on the exam page that the server has not yet confirmed.
 * An answer leaves the queue only after the server accepted it. A network failure keeps
 * everything queued; a refusal by the server (for example the deadline passed) drops only
 * that answer and reports it, so one bad answer never blocks the rest.
 */
export type AnswerEntry = [questionId: string, optionIds: string[]];

export interface AnswerQueueOptions {
  save: (questionId: string, optionIds: string[]) => Promise<void>;
  isNetworkError: (error: unknown) => boolean;
  /** The connection failed during a save. */
  onNetworkError: () => void;
  /** The server refused an answer; it has been dropped from the queue. */
  onRejected: (questionId: string, error: unknown) => void;
  /** The queue changed; receives a snapshot suitable for saving to local storage. */
  onChange: (entries: AnswerEntry[]) => void;
}

export class AnswerQueue {
  private pending = new Map<string, string[]>();
  private flushing = false;

  constructor(private readonly options: AnswerQueueOptions) {}

  get size() {
    return this.pending.size;
  }

  entries(): AnswerEntry[] {
    return [...this.pending];
  }

  /** Queues the latest choice for a question (replacing an earlier unsent one). */
  set(questionId: string, optionIds: string[]) {
    this.pending.set(questionId, optionIds);
    this.options.onChange(this.entries());
  }

  /** Puts back answers kept from an earlier page load. */
  restore(entries: AnswerEntry[]) {
    for (const [questionId, optionIds] of entries) this.pending.set(questionId, optionIds);
    this.options.onChange(this.entries());
  }

  /** Sends everything queued. Resolves true when nothing is left waiting. */
  async flush(): Promise<boolean> {
    if (this.flushing) return this.pending.size === 0;
    this.flushing = true;
    try {
      let rounds = 0;
      while (this.pending.size > 0 && rounds++ < 50) {
        let progressed = false;
        for (const [questionId, optionIds] of [...this.pending]) {
          try {
            await this.options.save(questionId, optionIds);
            // If the student changed their mind while this was in flight, keep the newer choice queued.
            if (this.pending.get(questionId) === optionIds) this.pending.delete(questionId);
            progressed = true;
          } catch (error) {
            if (this.options.isNetworkError(error)) {
              this.options.onNetworkError();
              return false;
            }
            this.pending.delete(questionId);
            this.options.onRejected(questionId, error);
            progressed = true;
          }
        }
        if (!progressed) break;
      }
      return this.pending.size === 0;
    } finally {
      this.flushing = false;
      this.options.onChange(this.entries());
    }
  }
}
