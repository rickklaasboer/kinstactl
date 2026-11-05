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
            // Tasks 6 and 7 add the scripting-and-ci, library and for-agents
            // entries once those pages exist; an unknown slug fails the build.
            sidebar: [
                {
                    label: 'Getting started',
                    items: [{autogenerate: {directory: 'getting-started'}}],
                },
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
