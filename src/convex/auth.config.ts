// Configuration du domaine du site pour Convex Auth.
// `CONVEX_SITE_URL` est défini dans .env.local (URL des actions HTTP).
export default {
	providers: [
		{
			domain: process.env.CONVEX_SITE_URL,
			applicationID: 'convex'
		}
	]
};
