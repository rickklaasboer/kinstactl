import {CliError} from '../../errors';
import {redactKeys, type SecretInput} from '../../services/SecretInput';
import type {OptionDef} from '../BaseCommand';

export interface WpInstallFlags {
    adminUser?: string;
    adminEmail?: string;
    adminPassword?: string;
    title?: string;
    language: string;
    multisite?: boolean;
    subdomainMultisite?: boolean;
    woocommerce?: boolean;
    yoast?: boolean;
}

export const WP_INSTALL_OPTIONS: OptionDef[] = [
    {flags: '--admin-user <name>', description: 'WordPress admin user name'},
    {flags: '--admin-email <email>', description: 'WordPress admin email'},
    {
        flags: '--admin-password <password>',
        description: '"-" reads it from stdin; omitted on a TTY prompts for it',
    },
    {
        flags: '--title <title>',
        description: 'site title (default: the display name)',
    },
    {
        flags: '--language <code>',
        description: 'WordPress language',
        default: 'en_US',
    },
    {flags: '--multisite', description: 'install WordPress as a multisite'},
    {
        flags: '--subdomain-multisite',
        description: 'make the multisite use subdomains',
    },
    {flags: '--woocommerce', description: 'install WooCommerce'},
    {flags: '--yoast', description: 'install Yoast SEO'},
];

export const REDACT_WP_INSTALL = redactKeys('admin_password');

export interface WpInstallFields {
    admin_user: string;
    admin_email: string;
    admin_password: string;
    site_title: string;
    wp_language: string;
    is_multisite?: boolean;
    is_subdomain_multisite?: boolean;
    woocommerce?: boolean;
    wordpressseo?: boolean;
}

/** Validates the required admin fields (USAGE errors naming the flag) and reads the password through SecretInput. */
export async function wpInstallFields(
    flags: WpInstallFlags,
    displayName: string,
    secrets: SecretInput,
): Promise<WpInstallFields> {
    if (flags.adminUser === undefined || flags.adminUser === '')
        throw new CliError('USAGE', 'Missing --admin-user');
    if (flags.adminEmail === undefined || flags.adminEmail === '')
        throw new CliError('USAGE', 'Missing --admin-email');
    const password = await secrets.read(flags.adminPassword, {
        flag: '--admin-password',
        label: 'admin password',
    });
    if (password === '')
        throw new CliError('USAGE', '--admin-password must not be empty');
    return {
        admin_user: flags.adminUser,
        admin_email: flags.adminEmail,
        admin_password: password,
        site_title: flags.title ?? displayName,
        wp_language: flags.language,
        ...(flags.multisite && {is_multisite: true}),
        ...(flags.subdomainMultisite && {is_subdomain_multisite: true}),
        ...(flags.woocommerce && {woocommerce: true}),
        ...(flags.yoast && {wordpressseo: true}),
    };
}
