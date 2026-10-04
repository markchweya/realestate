type Job = (signal: AbortSignal) => Promise<void>;

interface ChatState {
  current: { controller: AbortController; startedAt: number } | null;
  pending: Job[];
}

/** Runs jobs one at a time per chat, so a chat never has two Claude runs racing on one session. */
export class ChatQueue {
  private chats = new Map<string, ChatState>();

  private state(key: string): ChatState {
    let s = this.chats.get(key);
    if (!s) this.chats.set(key, (s = { current: null, pending: [] }));
    return s;
  }

  /** Queue a job. Returns how many jobs are ahead of it (0 = starts now). */
  enqueue(key: string, job: Job): number {
    const s = this.state(key);
    const ahead = s.pending.length + (s.current ? 1 : 0);
    s.pending.push(job);
    if (!s.current) void this.drain(key);
    return ahead;
  }

  private async drain(key: string) {
    const s = this.state(key);
    let job: Job | undefined;
    while ((job = s.pending.shift())) {
      const controller = new AbortController();
      s.current = { controller, startedAt: Date.now() };
      try {
        await job(controller.signal);
      } catch (err) {
        console.error(`[queue] job for ${key} failed`, err);
      } finally {
        s.current = null;
      }
    }
  }

  /** Abort the running job and drop anything queued. Returns true if something was stopped. */
  stop(key: string): boolean {
    const s = this.chats.get(key);
    if (!s || (!s.current && !s.pending.length)) return false;
    s.pending.length = 0;
    s.current?.controller.abort();
    return true;
  }

  status(key: string) {
    const s = this.chats.get(key);
    return {
      running: Boolean(s?.current),
      runningForMs: s?.current ? Date.now() - s.current.startedAt : 0,
      queued: s?.pending.length ?? 0,
    };
  }

  /** Resolves once every chat is idle (used by tests and graceful shutdown). */
  async idle(pollMs = 10) {
    while ([...this.chats.values()].some((s) => s.current || s.pending.length)) {
      await new Promise((r) => setTimeout(r, pollMs));
    }
  }
}
