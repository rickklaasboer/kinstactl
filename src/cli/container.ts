import {
    container,
    type DependencyContainer,
    instanceCachingFactory,
} from 'tsyringe';
import {IO, type Io} from './io';
import {Output} from './output';
import {PROMPTS} from './prompts';
import {RunContext} from './services/RunContext';

/** A container for one run; its services never outlive that run. */
export function createContainer(io: Io): DependencyContainer {
    const child = container.createChildContainer();
    child.registerInstance(IO, io);
    child.registerInstance(PROMPTS, io.prompts);
    child.register(Output, {
        useFactory: instanceCachingFactory((c) => {
            const ctx = c.resolve(RunContext);
            return new Output({
                stdout: io.stdout,
                stderr: io.stderr,
                json: () => ctx.json,
                debug: io.env.KINSTACTL_DEBUG === '1',
                color: io.isTTY && !io.env.NO_COLOR && io.env.TERM !== 'dumb',
            });
        }),
    });
    return child;
}
