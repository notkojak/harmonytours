// Lanceur du contrôle du book : charge les modules TypeScript avec l'API Vite
// (mêmes résolutions d'imports que l'application), puis affiche le verdict.
//
//   npm run check:book
//
// Sort en code 1 dès qu'une valeur du book ne tombe plus juste.

import { createServer } from 'vite';

const server = await createServer({
	server: { middlewareMode: true },
	appType: 'custom',
	logLevel: 'error'
});

try {
	const { verifierBook } = await server.ssrLoadModule('/scripts/verifier-book.ts');
	const { ok, ko, messages } = verifierBook();
	for (const m of messages) console.log(m);
	console.log(`\n${ok} valeurs du book conformes, ${ko} en écart`);
	if (ko > 0) process.exitCode = 1;
} finally {
	await server.close();
}
