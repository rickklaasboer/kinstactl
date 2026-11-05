import {injectable} from 'tsyringe';
import {Output} from '../../output';
import {ClientProvider} from '../../services/ClientProvider';
import {OperationRunner, parseMinutes} from '../../services/OperationRunner';
import type {
    ArgumentDef,
    BaseCommand,
    CommandArgs,
    OptionDef,
} from '../BaseCommand';

@injectable()
export class OperationsWaitCommand implements BaseCommand {
    readonly name = 'operations wait';
    readonly description = 'Wait until an operation has finished';
    readonly arguments: ArgumentDef[] = [
        {name: 'id', required: true, description: 'operation ID'},
    ];
    readonly options: OptionDef[] = [
        {
            flags: '--timeout <minutes>',
            description: 'give up waiting after this many minutes (default 30)',
            parse: parseMinutes,
        },
    ];
    readonly examples = [
        'kinstactl operations wait 0e7b2d61-example',
        'kinstactl operations wait 0e7b2d61-example --timeout 10',
    ];
    readonly endpoints = ['GET /operations/{operation_id}' as const];

    constructor(
        private readonly clients: ClientProvider,
        private readonly operations: OperationRunner,
        private readonly output: Output,
    ) {}

    async execute(
        args: CommandArgs,
        options: Record<string, unknown>,
    ): Promise<void> {
        const id = args.id as string;
        await this.operations.wait(
            this.clients.client().operation(id),
            `Operation ${id}`,
            options.timeout as number | undefined,
        );
        this.output.success(`Operation ${id} completed`, {
            operation_id: id,
            status: 'completed',
        });
    }
}
