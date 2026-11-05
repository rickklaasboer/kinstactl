import {injectable} from 'tsyringe';
import {getOperation} from '@/client/endpoints/operations';
import type {EndpointKey} from '@/client/request';
import {CliError} from '../../errors';
import {Output} from '../../output';
import {ClientProvider} from '../../services/ClientProvider';
import type {
    ArgumentDef,
    BaseCommand,
    CommandArgs,
    OptionDef,
} from '../BaseCommand';

@injectable()
export class OperationsGetCommand implements BaseCommand {
    readonly name = 'operations get';
    readonly description = 'Show the current status of an operation';
    readonly arguments: ArgumentDef[] = [
        {name: 'id', required: true, description: 'operation ID'},
    ];
    readonly options: OptionDef[] = [];
    readonly examples = [
        'kinstactl operations get 0e7b2d61-example',
        'kinstactl operations get 0e7b2d61-example --json',
    ];
    readonly endpoints: EndpointKey[] = ['GET /operations/{operation_id}'];

    constructor(
        private readonly clients: ClientProvider,
        private readonly output: Output,
    ) {}

    async execute(args: CommandArgs): Promise<void> {
        const id = args.id as string;
        const res = await this.clients.client().raw(getOperation(id));
        const message = (res.body as {message?: unknown} | null)?.message;
        const text = typeof message === 'string' ? message : undefined;
        if (res.status === 200 || res.status === 202) {
            const status = res.status === 200 ? 'completed' : 'pending';
            this.output.data(
                {operation_id: id, status, message: text},
                () => `${id}: ${status}${text ? ` (${text})` : ''}`,
            );
            return;
        }
        if (res.status === 404)
            throw new CliError('USAGE', `operation not found: ${id}`);
        if (res.status === 500)
            throw new CliError('OPERATION_FAILED', text ?? 'Operation failed', [
                `Operation: ${id}`,
            ]);
        throw new CliError(
            'API_ERROR',
            text ?? `Unexpected operation status HTTP ${res.status}`,
        );
    }
}
