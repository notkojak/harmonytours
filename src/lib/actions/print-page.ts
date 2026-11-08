// Format de page imprimée (A4 portrait / paysage) appliqué à la volée.
//
// Les deux fiches (Bravaux et ancien modèle papier) sont importées ensemble
// dans l'application ; si chacune déclarait son `@page` dans sa feuille de
// style, les deux règles seraient présentes et la dernière l'emporterait
// (l'ancien modèle paysage cassait l'impression de la nouvelle fiche).
// Le format est donc injecté par la fiche réellement montée.

export type PrintPageSize = 'portrait' | 'landscape';

const STYLE_ID = 'harmony-print-page';
let token = 0;

function getStyle(): HTMLStyleElement {
	let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
	if (!el) {
		el = document.createElement('style');
		el.id = STYLE_ID;
		document.head.appendChild(el);
	}
	return el;
}

function apply(owner: number, size: PrintPageSize) {
	const el = getStyle();
	el.dataset.owner = String(owner);
	el.textContent = `@page { size: A4 ${size}; margin: 0; }`;
}

// Attends que les images des fiches (logo Bravaux) soient chargées et
// décodées avant d'ouvrir l'aperçu d'impression. Sans cela, au premier
// lancement ou après un rechargement, le logo peut ne pas encore être prêt
// et manquer sur la feuille imprimée.
export async function waitForPrintAssets(timeoutMs = 1500) {
	if (typeof document === 'undefined') return;
	// Les DEUX modèles de fiche sont ciblés : moderne (.cp-sheet) et ancien
	// modèle papier (.contact-print-sheet).
	const images = Array.from(
		document.querySelectorAll<HTMLImageElement>('.cp-sheet img, .contact-print-sheet img')
	);
	if (images.length === 0) return;

	const loaded = Promise.all(
		images.map(
			(img) =>
				new Promise<void>((resolve) => {
					if (img.complete && img.naturalWidth > 0) return resolve();
					const done = () => {
						img.removeEventListener('load', done);
						img.removeEventListener('error', done);
						resolve();
					};
					img.addEventListener('load', done, { once: true });
					img.addEventListener('error', done, { once: true });
					// Force le chargement même si la feuille est masquée à l'écran.
					img.loading = 'eager';
				})
		)
	);

	// Garde-fou : on n'attend pas indéfiniment une image qui ne vient pas.
	let timer: ReturnType<typeof setTimeout> | undefined;
	const timeout = new Promise<void>((resolve) => {
		timer = setTimeout(resolve, timeoutMs);
	});
	await Promise.race([loaded, timeout]);
	clearTimeout(timer);

	// Décodage explicite : garantit que le bitmap est prêt au moment du rendu
	// d'impression, pas seulement le téléchargement terminé.
	await Promise.all(
		images.map(async (img) => {
			try {
				await img.decode?.();
			} catch {
				// Image indisponible : on imprime sans elle plutôt que de bloquer.
			}
		})
	);
}

export function printPage(_node: HTMLElement, size: PrintPageSize) {
	const owner = ++token;
	apply(owner, size);

	return {
		update(next: PrintPageSize) {
			apply(owner, next);
		},
		destroy() {
			const el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
			// Ne retire la règle que si elle appartient encore à cette fiche : lors
			// d'un changement de modèle, la nouvelle feuille peut être montée avant
			// que l'ancienne ne soit détruite.
			if (el && el.dataset.owner === String(owner)) el.remove();
		}
	};
}
