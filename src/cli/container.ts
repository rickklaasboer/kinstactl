import {container, type DependencyContainer} from 'tsyringe';
import {IO, type Io} from './io';
import {PROMPTS} from './prompts';

/** A container for one run; its services never outlive that run. */
export function createContainer(io: Io): DependencyContainer {
    const child = container.createChildContainer();
    child.registerInstance(IO, io);
    child.registerInstance(PROMPTS, io.prompts);
    return child;
}
