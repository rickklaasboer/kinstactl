import {Lifecycle, scoped} from 'tsyringe';
import {ClientProvider} from '../../services/ClientProvider';
import type {WpItem, WpItemKind} from './WpItemKind';

/** Reads the plugins or themes of an environment. */
@scoped(Lifecycle.ContainerScoped)
export class WpItemService {
    constructor(private readonly clients: ClientProvider) {}

    async fetch(kind: WpItemKind, envId: string): Promise<WpItem[]> {
        const res = await this.clients.client().send<{
            environment: Record<WpItemKind['command'], {items: WpItem[]}>;
        }>(kind.list(envId));
        return res.environment[kind.command].items;
    }
}
