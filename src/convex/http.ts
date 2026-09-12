import { httpRouter } from 'convex/server';
import { auth } from './auth';
import { signin, me } from './auth_mobile';
import { beastdoorSync, upsertPorteDirect } from './beastdoor';
import {
	agenda,
	createContact,
	createEvenement,
	deleteContact,
	deleteEvenement,
	getContact,
	listCommerciaux,
	markContactPrinted,
	setFollowUp,
	updateContact,
	updateEvenement
} from './mobile';

const http = httpRouter();

// Enregistre les routes HTTP de Convex Auth (connexion, callback OAuth, etc.).
auth.addHttpRoutes(http);

// Endpoints de connexion pour l'app mobile (mêmes comptes que le web).
http.route({ path: '/api/auth-mobile/signin', method: 'POST', handler: signin });
http.route({ path: '/api/auth-mobile/me', method: 'POST', handler: me });

// Endpoints métier mobiles : contacts écrits dans la BDD Harmony.
http.route({ path: '/api/mobile/contacts', method: 'POST', handler: createContact });
http.route({ path: '/api/mobile/contacts/get', method: 'POST', handler: getContact });
http.route({ path: '/api/mobile/contacts/update', method: 'POST', handler: updateContact });
http.route({ path: '/api/mobile/contacts/delete', method: 'POST', handler: deleteContact });
// Marque la fiche contact comme imprimée (bouton vert, état partagé web/mobile).
http.route({ path: '/api/mobile/contacts/printed', method: 'POST', handler: markContactPrinted });
http.route({ path: '/api/mobile/contacts/follow-up', method: 'POST', handler: setFollowUp });
http.route({ path: '/api/mobile/commerciaux', method: 'POST', handler: listCommerciaux });
http.route({ path: '/api/mobile/agenda', method: 'POST', handler: agenda });
http.route({ path: '/api/mobile/evenements', method: 'POST', handler: createEvenement });
http.route({ path: '/api/mobile/evenements/update', method: 'POST', handler: updateEvenement });
http.route({ path: '/api/mobile/evenements/delete', method: 'POST', handler: deleteEvenement });

// Sync unifié des portes/visites/stats de l'app → BDD Harmony (même base que
// le web). L'app pousse ses changements avec son token ; chaque ligne est
// liée à l'utilisateur connecté.
http.route({ path: '/api/mobile/beastdoor-sync', method: 'POST', handler: beastdoorSync });
// Écriture directe d'une porte (sans passer par la file de synchro de l'app).
http.route({ path: '/api/mobile/portes', method: 'POST', handler: upsertPorteDirect });

export default http;
