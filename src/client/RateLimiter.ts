export type Bucket = 'general' | 'creation';

export interface RateLimiterOpts {
    generalPerMin?: number;
    creationPerMin?: number;
    now?: () => number;
    sleep?: (ms: number) => Promise<void>;
}

const WINDOW_MS = 60_000;

export class RateLimiter {
    private history: Record<Bucket, number[]> = {general: [], creation: []};
    private limits: Record<Bucket, number>;
    private pausedUntil = 0;
    private now: () => number;
    private sleep: (ms: number) => Promise<void>;

    constructor(opts: RateLimiterOpts = {}) {
        this.limits = {
            general: opts.generalPerMin ?? 100,
            creation: opts.creationPerMin ?? 4,
        };
        this.now = opts.now ?? Date.now;
        this.sleep =
            opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    }

    async acquire(bucket: Bucket): Promise<void> {
        for (;;) {
            const t = this.now();
            const fresh = this.history[bucket].filter((x) => x > t - WINDOW_MS);
            this.history[bucket] = fresh;
            const pauseWait = this.pausedUntil - t;
            if (fresh.length < this.limits[bucket] && pauseWait <= 0) {
                fresh.push(t);
                return;
            }
            const oldest = fresh[0];
            const slotWait =
                fresh.length >= this.limits[bucket] && oldest !== undefined
                    ? oldest + WINDOW_MS - t
                    : 0;
            await this.sleep(Math.max(slotWait, pauseWait, 50));
        }
    }

    noteHeaders(headers: Headers): void {
        const remaining = Number(headers.get('RateLimit-Remaining'));
        const reset = Number(headers.get('RateLimit-Reset'));
        if (remaining === 0 && Number.isFinite(reset) && reset > 0) {
            this.pausedUntil = Math.max(
                this.pausedUntil,
                this.now() + reset * 1000,
            );
        }
    }
}
