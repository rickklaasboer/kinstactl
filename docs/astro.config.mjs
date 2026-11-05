import starlight from '@astrojs/starlight';
import {defineConfig} from 'astro/config';
import starlightLlmsTxt from 'starlight-llms-txt';

export default defineConfig({
    site: 'https://kinstactl.rickklaasboer.nl',
    integrations: [
        starlight({
            title: 'kinstactl',
            description:
                'Command line client and typed TypeScript client for the Kinsta API',
            social: [
                {
                    icon: 'github',
                    label: 'GitHub',
                    href: 'https://github.com/rickklaasboer/kinstactl',
                },
            ],
            editLink: {
                baseUrl:
                    'https://github.com/rickklaasboer/kinstactl/edit/main/docs/',
            },
            sidebar: [
                {
                    label: 'Getting started',
                    items: [{autogenerate: {directory: 'getting-started'}}],
                },
                {label: 'Scripting and CI', slug: 'scripting-and-ci'},
                {label: 'Using the client as a library', slug: 'library'},
                {label: 'For agents', slug: 'for-agents'},
                {
                    label: 'Commands',
                    items: [{autogenerate: {directory: 'commands'}}],
                },
            ],
            plugins: [
                starlightLlmsTxt({
                    projectName: 'kinstactl',
                    description:
                        'Command line client and typed TypeScript client for the Kinsta API.',
                    promote: [
                        'index*',
                        'getting-started/**',
                        'for-agents*',
                        'scripting-and-ci*',
                    ],
                    customSets: [
                        {
                            label: 'Command reference',
                            description:
                                'every kinstactl command with its arguments, flags and the Kinsta API endpoints it calls',
                            paths: ['commands/**'],
                        },
                    ],
                }),
            ],
        }),
    ],
    vite: {server: {fs: {allow: ['..']}}},
});
