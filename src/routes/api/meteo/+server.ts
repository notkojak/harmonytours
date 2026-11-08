import { json } from '@sveltejs/kit';
import { chargerMeteoTours } from '$lib/data/meteo';

// Proxy same-origin de la météo : évite les blocages CORS / réseau côté
// navigateur et garde la clé (aucune ici) hors du client.
export async function GET() {
	const meteo = await chargerMeteoTours();
	if (!meteo) {
		return json({ error: 'Météo indisponible' }, { status: 502 });
	}
	return json(meteo, { headers: { 'cache-control': 'no-store' } });
}
