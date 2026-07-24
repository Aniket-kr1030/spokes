import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const CONFIG_FILENAME = 'spokes.config.json';
const DEFAULT_CONFIG = {
    $schema: './node_modules/spokes-ai-humanism/schema.json',
    include: ['src/**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs,py}'],
    exclude: ['**/*.test.*', '**/*.spec.*', '**/node_modules/**', '**/dist/**'],
    roles: [
        { glob: 'src/hubs/**', role: 'hub' },
        { glob: 'src/**', role: 'spoke' },
    ],
    defaultRole: 'unmarked',
    strictCycles: true,
    singleExport: 'warn',
    typeOnlyEdges: 'ignore',
    externalPackages: 'ignore',
};
/** Exports exactly one function, satisfying R4. */
export function run(repoRoot) {
    const configPath = join(repoRoot, CONFIG_FILENAME);
    if (existsSync(configPath)) {
        console.error(`error: ${CONFIG_FILENAME} already exists at "${repoRoot}" — refusing to overwrite.`);
        process.exit(2);
    }
    writeFileSync(configPath, `${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`, 'utf8');
    console.log(`Created ${CONFIG_FILENAME}.`);
    console.log('Next steps:');
    console.log('  spokes check    # run the checker');
    console.log('  spokes graph    # render the architecture diagram');
}
