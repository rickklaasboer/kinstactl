import {describe, expect, it} from 'bun:test';
import {RateLimiter} from '@/client/RateLimiter';

function fakeClock() {
    let t = 0;
    const sleeps: number[] = [];
    return {
        now: () => t,
        sleep: async (ms: number) => {
            sleeps.push(ms);
            t += ms;
        },
        advance: (ms: number) => {
            t += ms;
        },
        sleeps,
    };
}

describe('RateLimiter', () => {
    it('lets requests through under the limit without sleeping', async () => {
        const clock = fakeClock();
        const rl = new RateLimiter({
            generalPerMin: 3,
            now: clock.now,
            sleep: clock.sleep,
        });
        await rl.acquire('general');
        await rl.acquire('general');
        await rl.acquire('general');
        expect(clock.sleeps.length).toBe(0);
    });

    it('waits when the bucket is full and frees up after the window', async () => {
        const clock = fakeClock();
        const rl = new RateLimiter({
            generalPerMin: 2,
            now: clock.now,
            sleep: clock.sleep,
        });
        await rl.acquire('general');
        clock.advance(1_000);
        await rl.acquire('general');
        await rl.acquire('general'); // must wait until first acquisition leaves the 60s window
        expect(clock.sleeps.length).toBeGreaterThan(0);
        expect(clock.now()).toBeGreaterThanOrEqual(60_000);
    });

    it('keeps creation and general buckets independent', async () => {
        const clock = fakeClock();
        const rl = new RateLimiter({
            generalPerMin: 100,
            creationPerMin: 1,
            now: clock.now,
            sleep: clock.sleep,
        });
        await rl.acquire('creation');
        await rl.acquire('general');
        expect(clock.sleeps.length).toBe(0);
        await rl.acquire('creation'); // second creation must wait ~60s
        expect(clock.now()).toBeGreaterThanOrEqual(60_000);
    });

    it('pauses when RateLimit headers report exhaustion', async () => {
        const clock = fakeClock();
        const rl = new RateLimiter({
            generalPerMin: 10,
            now: clock.now,
            sleep: clock.sleep,
        });
        rl.noteHeaders(
            new Headers({'RateLimit-Remaining': '0', 'RateLimit-Reset': '30'}),
        );
        await rl.acquire('general');
        expect(clock.now()).toBeGreaterThanOrEqual(30_000);
    });

    it('defaults to 100 general and 4 creation requests per minute', async () => {
        const clock = fakeClock();
        const rl = new RateLimiter({now: clock.now, sleep: clock.sleep});
        for (let i = 0; i < 100; i++) await rl.acquire('general');
        for (let i = 0; i < 4; i++) await rl.acquire('creation');
        expect(clock.sleeps.length).toBe(0);
        await rl.acquire('general');
        expect(clock.sleeps.length).toBeGreaterThan(0);
    });
});
