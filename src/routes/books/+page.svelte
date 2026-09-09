<script lang="ts">
	// Page « Books » : synthèse des 16 modules du book de formation commercial
	// Bravaux 2026. Le Module 8 (TAP) contient la trame complète à
	// réciter sur le terrain.

	type LineType = 'V' | 'C' | 'Q' | 'R';
	type Line = { type: LineType; text: string };
	type Phase = {
		n: number;
		name: string;
		objectif: string;
		duration: string;
		lines: Line[];
	};

	type Tone = 'amber' | 'red' | 'emerald' | 'violet' | 'line';
	type ListItem = string | { q: string; detail?: string };
	type Block =
		| { kind: 'p'; text: string }
		| { kind: 'callout'; text: string; tone?: Tone }
		| { kind: 'list'; title?: string; items: ListItem[]; numbered?: boolean; check?: boolean }
		| { kind: 'table'; title?: string; headers: string[]; rows: string[][] }
		| { kind: 'script'; lines: Line[] }
		| { kind: 'steps'; title?: string; items: { n: string; label: string; detail?: string }[] }
		| { kind: 'phases'; phases: Phase[] };

	type ModuleDef = { icon: string; title: string; subtitle: string; blocks: Block[] };

	const materiel = [{ label: '📄 Flyer Bravaux' }, { label: '🪪 Badge nominatif' }];

	const phases: Phase[] = [
		{
			n: 1,
			name: 'AMBIANCE',
			objectif: 'Briser la glace, créer la confiance',
			duration: '30s → 2 min',
			lines: [
				{
					type: 'V',
					text: 'Bonjour Madame/Monsieur, il est sympa votre jardin, c’est vous qui l’entretenez ?'
				},
				{
					type: 'V',
					text: 'Je vois que vous avez déjà des panneaux sur le toit, vous êtes content de votre installation ?'
				},
				{ type: 'V', text: 'C’est une belle façade, vous venez de faire des travaux ?' },
				{
					type: 'R',
					text: 'La règle d’or : parlez de LUI, pas de vous. Ces 30 secondes déterminent la suite de l’échange.'
				},
				{
					type: 'C',
					text: 'Conseil débutant : prenez 5 secondes avant de sonner pour repérer un élément visuel à commenter — c’est du temps investi.'
				}
			]
		},
		{
			n: 2,
			name: 'PRÉSENTATION',
			objectif: 'Vous positionner légitimement dans le quartier',
			duration: '1 → 2 min',
			lines: [
				{
					type: 'V',
					text: 'Je me permets de vous déranger car nous intervenons actuellement dans votre rue chez [NOM/N°] pour [audit énergétique / étude / installation...], et je voulais savoir si vous avez bien reçu la documentation que nous avons distribuée aux propriétaires du secteur cette semaine ?'
				},
				{ type: 'C', text: 'Non, je ne l’ai pas reçue.' },
				{
					type: 'V',
					text: 'C’est bizarre, vous n’êtes pas le premier à me le dire ! Vous êtes bien propriétaire ici ?'
				},
				{ type: 'C', text: 'Oui.' },
				{
					type: 'V',
					text: 'C’est dommage, le facteur se permet de vous oublier ! (ton de l’humour) Cela fait longtemps que vous êtes dans le quartier ?'
				},
				{
					type: 'C',
					text: 'Conseil débutant : vous n’avez pas de client dans la rue ? Dites « dans votre secteur » — c’est vrai et suffisant.'
				}
			]
		},
		{
			n: 3,
			name: 'DÉCOUVERTE',
			objectif: 'Comprendre la situation du prospect et identifier un projet',
			duration: '3 → 5 min',
			lines: [
				{
					type: 'R',
					text: 'Ce n’est pas un interrogatoire — intégrez les questions dans la conversation naturellement.'
				},
				{
					type: 'V',
					text: 'Comme vous ne l’avez pas reçu, ce que je vais faire c’est vous la remettre en main propre. Et dans cette documentation il y avait une question, que nous posons à tous les propriétaires, je vais vous la poser comme ça, ce sera fait : Ni aujourd’hui ni demain, mais à l’avenir — si vous étiez amené à améliorer quelque chose chez vous, par quoi est-ce que vous commenceriez ?'
				},
				{ type: 'C', text: 'Si blocage (« rien pour l’instant ») — Reformulation :' },
				{
					type: 'V',
					text: 'Je me doute bien que vous ne vous êtes pas levé ce matin en vous disant « je refais tout ! » (sourire) — mais ni aujourd’hui ni demain, à l’avenir, dans 1 an, 2 ans ou plus même, si vous aviez quelque chose à améliorer chez vous, par quoi est-ce que vous commenceriez ? Si vous aviez une baguette magique, qu’est-ce que vous changeriez ?'
				},
				{ type: 'C', text: 'Plutôt l’isolation, mais ce n’est pas pour tout de suite.' },
				{
					type: 'V',
					text: 'D’accord, cela fait longtemps que vous y pensez ? Qu’est-ce qui vous fait penser à refaire votre isolation ? Pour quand souhaiteriez-vous réaliser ce projet ?'
				},
				{ type: 'C', text: 'L’année prochaine.' },
				{ type: 'V', text: 'Plutôt avant ou après l’hiver ? (Alternative)' },
				{
					type: 'Q',
					text: 'Mode de chauffage + coût : « Vous êtes chauffé comment — gaz, fioul, électrique ? Vous devez payer dans les combien par an ? »'
				},
				{
					type: 'Q',
					text: 'État toiture / isolation : « Vous avez déjà fait quelque chose sur la toiture ou l’isolation ? »'
				},
				{
					type: 'Q',
					text: 'Imposable ? : « Vous savez que vous pouvez bénéficier d’aides de l’État selon votre projet ? Vous êtes imposable ? »'
				},
				{ type: 'Q', text: 'Décisionnaires : « Vous êtes avec Madame/Monsieur ? »' }
			]
		},
		{
			n: 4,
			name: 'PRISE D’ADRESSE',
			objectif: 'Créer un premier lien concret — pas encore un RDV',
			duration: '—',
			lines: [
				{
					type: 'R',
					text: 'C’est UNE PRISE D’ADRESSE — pas encore un RDV. Ne donnez pas encore le catalogue : il sert de prétexte pour revenir.'
				},
				{
					type: 'V',
					text: 'Vous savez quoi — comme vous avez été sympa avec moi et que vous avez pris le temps de me répondre, ce que je vais faire c’est vous envoyer un catalogue dans lequel vous aurez toutes les informations qui concernent votre projet. C’est totalement gratuit, et le jour où vous serez prêt à aller plus loin dans votre projet vous penserez peut-être à nous pour vous accompagner ! Donc vous êtes bien au [N° + Rue] ?'
				},
				{
					type: 'C',
					text: 'Conseil débutant : à cette étape, vous ne notez QUE l’adresse. Pas de numéro de téléphone — il viendra en Phase 6.'
				}
			]
		},
		{
			n: 5,
			name: 'NOTION DE PRIX',
			objectif: 'Ouvrir le sujet budget, sans le traiter directement',
			duration: '—',
			lines: [
				{
					type: 'V',
					text: 'Ah ! Par contre, une question me brûle les lèvres. J’imagine que pour vous, comme pour tout le monde d’ailleurs, la notion de prix est importante ?'
				},
				{ type: 'C', text: 'Oui bien sûr.' },
				{ type: 'V', text: 'Je vous comprends, c’est le nerf de la guerre.' }
			]
		},
		{
			n: 6,
			name: 'PRISE DE RDV',
			objectif: 'Obtenir le RDV avec TOUS les décisionnaires. Phase clé !',
			duration: 'Phase clé',
			lines: [
				{
					type: 'V',
					text: 'L’avantage avec Bravaux, c’est qu’on est spécialisé en rénovation énergétique et qu’on fait du sur-mesure adapté à votre maison, vos besoins et votre budget réel. L’inconvénient, c’est que les prix ne figurent pas dans le catalogue... chaque maison est différente. Ce serait une encyclopédie et ça ne passerait pas dans la BAL ! Donc ce que je vais faire : quand je repasserai voir mon client dans votre rue, je fais un crochet pour vous remettre le catalogue en main propre et vous donner une notion de prix. Par contre, j’ai été bien élevé, je ne passerai pas à l’improviste ! Pour vous joindre, c’est plus facile au 06 / 07 / 02 ?'
				},
				{
					type: 'R',
					text: 'Après le numéro : refaire une mini-ambiance (compliment, conversation légère), PUIS enchaîner sur le RDV.'
				},
				{
					type: 'V',
					text: 'Je repasse dans votre secteur en Début/Milieu/Fin de semaine, pour vous voir avec Mme c’est plus facile en début, milieu ou fin de semaine ? Plutôt le matin ou l’après-midi ? 15h ou 18h ? Pour le café ou pour l’apéro ?'
				},
				{ type: 'C', text: 'Plutôt 18h, ma femme sera là.' },
				{ type: 'R', text: 'L’ascenseur émotionnel (obligatoire) :' },
				{ type: 'V', text: 'Par contre Mr/Mme, il en aura pour 4 à 5 heures...' },
				{ type: 'C', text: 'Ah non, c’est beaucoup trop long !' },
				{
					type: 'V',
					text: 'Je plaisante ! Seulement 1h à 1h30 grand maximum si vous avez des questions, le temps de faire l’étude, vous expliquer qui on est et vous donner une notion de prix. Comme ça, vous aurez tous les éléments quand vous voudrez avancer.'
				},
				{ type: 'C', text: 'Ouf, vous me rassurez !' },
				{ type: 'V', text: 'Et ça vous coûtera quand même un café ! (ton de l’humour)' }
			]
		},
		{
			n: 7,
			name: 'CONFIRMATION DU RDV',
			objectif: 'Sécuriser le RDV en le reformulant clairement',
			duration: '—',
			lines: [
				{
					type: 'V',
					text: 'Parfait ! On se voit donc [JOUR] à [HEURE] avec Madame/Monsieur. Je vous envoie un rappel SMS ce soir.'
				},
				{
					type: 'C',
					text: 'Conseil débutant : le SMS de confirmation le soir même est SYSTÉMATIQUE. Il divise le taux d’annulation de façon significative.'
				},
				{
					type: 'Q',
					text: 'Simple rappel : « Bonjour [Prénom], je vous confirme notre rendez-vous [JOUR] à [HEURE]. À très bientôt ! »'
				}
			]
		},
		{
			n: 8,
			name: 'CONFORTATION',
			objectif: 'Partir en laissant une impression chaleureuse',
			duration: '1 → 2 min',
			lines: [
				{
					type: 'R',
					text: 'Ne partez JAMAIS immédiatement après la prise de RDV. Accordez encore 1 à 2 minutes de conversation. Donnez-lui envie de vous revoir.'
				},
				{
					type: 'V',
					text: 'Si vous connaissez des personnes dans votre entourage qui cherchent à réduire leurs factures d’énergie, n’hésitez pas à leur parler de nous — nos études sont gratuites.'
				},
				{
					type: 'Q',
					text: 'Sujets de confortation : ses passions et loisirs · ses projets du week-end · ses animaux / enfants / voyages · trouvez des points communs.'
				},
				{
					type: 'C',
					text: 'Conseil débutant : SI VOUS N’ÊTES PAS À 2 RDV PAR JOUR C’EST QUE CETTE MÉTHODE N’EST PAS MAÎTRISÉE.'
				}
			]
		}
	];

	const lineChip = {
		V: {
			label: 'Vendeur',
			cls: 'bg-emerald-500/15 text-emerald-300 light:bg-emerald-500/15 light:text-emerald-600'
		},
		C: {
			label: 'Client',
			cls: 'bg-sky-500/15 text-sky-300 light:bg-sky-500/15 light:text-sky-600'
		},
		Q: {
			label: 'Question',
			cls: 'bg-violet-500/15 text-violet-300 light:bg-violet-500/15 light:text-violet-600'
		},
		R: {
			label: 'Règle',
			cls: 'bg-amber-500/15 text-amber-300 light:bg-amber-500/15 light:text-amber-600'
		}
	};

	const toneCls: Record<Tone, string> = {
		amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-300',
		red: 'bg-red-500/10 text-red-600 dark:text-red-400',
		emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
		violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
		line: 'bg-card2 text-muted-foreground'
	};

	const modules: Record<number, ModuleDef> = {
		1: {
			icon: '🏢',
			title: 'Présentation de la société',
			subtitle: 'Qui est Bravaux, règles et contrat de l’apprenant',
			blocks: [
				{
					kind: 'p',
					text: 'Bravaux est une entreprise spécialisée dans la transition énergétique et la rénovation de l’habitat. Née de la volonté de proposer des solutions durables et accessibles à tous les propriétaires, elle s’est rapidement développée pour devenir un acteur incontournable de la rénovation énergétique sur les régions PACA, Centre Val de Loire et Pays de la Loire.'
				},
				{
					kind: 'p',
					text: 'Forte de son expertise dans les domaines du solaire, des pompes à chaleur, de l’isolation et de la menuiserie, Bravaux accompagne ses clients de A à Z : du premier contact jusqu’au service après-vente, en passant par les démarches administratives et l’installation.'
				},
				{
					kind: 'list',
					title: 'En quelques chiffres',
					items: [
						'Des solutions de rénovation énergétique pour les propriétaires',
						'Des équipes techniques, administratives et commerciales intégrées',
						'Des produits garantis jusqu’à 30 ans',
						'Un service client accessible via le 0805 299 363 (numéro vert gratuit)',
						'Un accompagnement complet : étude, démarches, pose, SAV'
					]
				},
				{
					kind: 'list',
					title: 'Règles de la société',
					items: [
						'Tenue et équipement exigés : chemise ou polo / pantalon de ville / chaussures de ville / sacoche / agenda, stylo et mètre.',
						'Être à l’heure à l’agence ainsi qu’au RDV.',
						'Maintenir la propreté et le respect des locaux et du matériel mis à disposition.',
						'Un contact appartient à la personne qui a tapé ou sonné en premier.',
						'La personne qui prend le contact en a la jouissance tant qu’elle est dans la société.',
						'Une fois qu’un commercial quitte la société, ses contacts reviennent à la société.',
						'Un bon de commande ne peut avoir que deux vendeurs.',
						'Tout dossier doit être constitué le lendemain de la vente au plus tard.'
					]
				},
				{
					kind: 'callout',
					tone: 'emerald',
					text: '🤝 CONTRAT DE L’APPRENANT — Je m’engage ce jour à mettre tout en œuvre pour réaliser mes objectifs, que ce soit sur un plan personnel ou professionnel. Aujourd’hui je prends conscience que ma réussite ne dépend que de mes actions et de mon état d’esprit. Aujourd’hui je m’engage à réaliser les objectifs qui me sont demandés et à trouver toutes les solutions envisageables pour y arriver. Je n’ai qu’une seule option : RÉUSSIR !'
				}
			]
		},
		2: {
			icon: '🎯',
			title: 'Objectif individuel',
			subtitle: 'Ratios, objectif journalier et mensuel du commercial',
			blocks: [
				{
					kind: 'p',
					text: 'Notre métier n’est que chiffres. Nous nous basons sur les ratios de la vente directe pour définir les objectifs individuels de chacun.'
				},
				{
					kind: 'list',
					title: 'Les ratios de base',
					items: ['Contact / Assise = 1 / 3', 'Assise / Ventes = 1 / 3', 'Taux d’annulation entre 15 % et 20 %']
				},
				{
					kind: 'list',
					title: 'Objectif commercial journalier — 3 actions par jour minimum',
					items: ['2 contacts + 1 assise', '1 contact + 2 assises', '3 contacts']
				},
				{
					kind: 'callout',
					text: 'Gardez en tête : « tout part de la prise de contact. » Votre RDV commence dès votre premier échange avec le client !'
				},
				{
					kind: 'table',
					title: 'Objectif commercial mensuel',
					headers: ['Indicateur', 'Objectif'],
					rows: [
						['Nombre d’actions', '60'],
						['Nombre de contacts', '35'],
						['Nombre d’assises', '13'],
						['Nombre de ventes', '4'],
						['Panier moyen', '14 000 €'],
						['Chiffre d’affaires', '56 000 €']
					]
				},
				{
					kind: 'callout',
					tone: 'emerald',
					text: 'Assurez-vous d’avoir une déballe confirmée tous les jours et votre CA va littéralement s’envoler !'
				}
			]
		},
		3: {
			icon: '🏆',
			title: 'Objectif Agence',
			subtitle: 'Objectifs journalier et mensuel d’une agence',
			blocks: [
				{
					kind: 'p',
					text: 'L’objectif pour toute agence est a minima d’avoir 3 déballes par jour confirmées en respectant les points de qualification d’un RDV.'
				},
				{
					kind: 'list',
					title: 'Objectif journalier d’une agence (équipe de 3 commerciaux + DA)',
					items: [
						'9 contacts sur la journée',
						'3 déballes confirmées pour le jour en cours',
						'1 vente'
					]
				},
				{
					kind: 'callout',
					text: '« Seul on va plus vite, ensemble on va plus loin. »'
				},
				{
					kind: 'callout',
					tone: 'emerald',
					text: 'Objectif mensuel : 150 000 € net validés minimum'
				}
			]
		},
		4: {
			icon: '🗓️',
			title: 'Planning et journée type',
			subtitle: 'Organisation d’une journée et d’une semaine type',
			blocks: [
				{
					kind: 'table',
					title: 'Organisation d’une journée',
					headers: ['Heure', 'Activité'],
					rows: [
						['8h30 – 8h45', 'Arrivée à l’agence'],
						['9h00', 'Briefing avec l’équipe commerciale'],
						['9h45', 'Arrivée sur secteur TAP'],
						['12h30', 'Retour à l’agence'],
						['13h30', 'Formation (TAP, Produits, Présentation Financière…)'],
						['14h30', 'Départ agence'],
						['15h00', '1er RDV — si pas de RDV : prospection'],
						['18h00', '2ème RDV — Fin de prospection (si objectif non atteint, on continue)']
					]
				},
				{
					kind: 'table',
					title: 'Organisation d’une semaine type',
					headers: ['', 'LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI', 'SAMEDI'],
					rows: [
						['MATIN', 'TAP', 'TAP', 'TAP', 'TAP', 'TAP', '/'],
						['MIDI', 'Formation', 'Défini DA', 'Défini DA', 'Défini DA', 'Formation ou GMS', ''],
						[
							'APRÈS-MIDI',
							'Déballe +/- TAP',
							'Déballe +/- TAP',
							'Déballe +/- TAP',
							'Déballe +/- TAP',
							'Déballe',
							'Déballe ou Repos'
						]
					]
				}
			]
		},
		5: {
			icon: '📋',
			title: 'Brief dans le détail',
			subtitle: 'Définir la vision et les objectifs du jour',
			blocks: [
				{
					kind: 'p',
					text: 'L’objectif du brief est de définir la vision et les objectifs du jour, tant sur un plan contacts que chiffres. Un brief doit être vivant et participatif !'
				},
				{
					kind: 'list',
					title: 'Vous devez vous présenter au brief avec',
					items: [
						'Les fiches contacts du jour et du lendemain dûment remplies',
						'Les études personnalisées de la veille (s’il y a eu des RDV)',
						'Dès le début du brief : posez vos téléphones.'
					]
				},
				{
					kind: 'steps',
					title: 'Les étapes du brief',
					items: [
						{ n: '1', label: 'Analyse du cahier contacts' },
						{
							n: '2',
							label: 'Analyse de la journée de la veille',
							detail: 'fiche contact, étude et bilan général'
						},
						{ n: '3', label: 'Brief des déballes confirmées du jour' },
						{ n: '4', label: 'Mise en place des objectifs et de la stratégie du jour' }
					]
				},
				{
					kind: 'callout',
					tone: 'amber',
					text: 'À l’issue du brief, vous devez démarrer la journée remontés comme des coucous prêts à réaliser vos objectifs !'
				}
			]
		},
		6: {
			icon: '✔️',
			title: 'Points de qualification',
			subtitle: 'Qualifier ses RDV pour optimiser chaque visite',
			blocks: [
				{
					kind: 'p',
					text: 'Optimiser son temps de travail est une des clés de votre réussite. Il est important de bien qualifier ses rendez-vous pour ne pas perdre du temps — donc de l’argent.'
				},
				{
					kind: 'list',
					title: 'Un rendez-vous qualifié — les 6 critères obligatoires',
					numbered: true,
					items: [
						{
							q: 'Le ou les prospects doivent être propriétaires.',
							detail:
								'Les locataires, usufruitiers, acheteurs sous compromis, personnes sous tutelle ou curatelle ne sont pas décisionnaires.'
						},
						{
							q: 'Le RDV doit être positionné sous 48 heures maximum.',
							detail:
								'Avec le temps tout s’oublie. La concurrence peut passer entre-temps. Plus le délai est long, plus la motivation baisse.'
						},
						{
							q: 'Tous les décisionnaires doivent être présents.',
							detail:
								'Ex : couple présent, ou personnes âgées avec leurs enfants si nécessaire. Évite l’objection « je dois en parler à mon mari ».'
						},
						{
							q: 'Au moins 1h30 à vous accorder.',
							detail:
								'Une étude complète et personnalisée dure au minimum 1h30. Notre métier est d’apporter un ensemble de renseignements qui ne peut pas être fait en moins d’1 heure.'
						},
						{
							q: 'Un produit inscrit dans la gamme Bravaux.',
							detail: 'Connaître par cœur la gamme de produits pour ne pas proposer un produit non commercialisé.'
						},
						{
							q: 'Si le RDV est pris avec Madame, le confirmer le jour même avec Monsieur.',
							detail:
								'Si le RDV est pris avec Mme sans que Mr soit au courant, vous pouvez être certain qu’il ne l’acceptera pas.'
						}
					]
				},
				{
					kind: 'callout',
					tone: 'amber',
					text: 'Ces 6 critères sont OBLIGATOIRES. S’il en manque un seul, il est inutile de se déplacer. La qualification va dépendre de l’ambiance, de la découverte, de l’envie !'
				}
			]
		},
		7: {
			icon: '🎯',
			title: 'Points de découverte',
			subtitle: 'Les 11 questions à poser à la prise de RDV TAP',
			blocks: [
				{
					kind: 'p',
					text: 'Vous devez faire une bonne découverte pour savoir comment diriger votre RDV et ainsi éviter certaines objections.'
				},
				{
					kind: 'callout',
					tone: 'red',
					text: '⚠️ Les 11 questions de la découverte doivent obligatoirement être posées à la prise de RDV TAP. Ne pas commencer le RDV s’il manque une réponse à l’une d’elles !'
				},
				{
					kind: 'list',
					numbered: true,
					items: [
						{
							q: 'Nombre de personnes dans le foyer ?',
							detail: 'Savoir si tous les décisionnaires sont présents. Permet de connaître le pouvoir d’achat.'
						},
						{
							q: 'Depuis combien de temps habitent-ils ici ?',
							detail: 'Crédit maison (en général 20 ans). Ciblage du parrainage.'
						},
						{
							q: 'S’ils se plaisent bien chez eux ?',
							detail: 'Pour éviter l’objection : « je vais déménager / vendre ».'
						},
						{
							q: 'Le dernier investissement / gros achat.',
							detail: 'Connaître quel type d’acheteur : comptant ou crédit.'
						},
						{
							q: 'Le métier / ancien métier.',
							detail: 'Évaluer leurs revenus pour cibler votre vente.'
						},
						{
							q: 'Imposable ou pas ?',
							detail: 'Permet d’apprécier la solidité financière du ménage.'
						},
						{
							q: 'Mode de chauffage et coût.',
							detail:
								'Calculer les économies d’énergie potentielles. « Avez-vous déjà réalisé un bilan thermique ? »'
						},
						{
							q: 'Vous connaissez le produit, vous vous êtes déjà renseigné ?',
							detail:
								'Ont-ils vu la concurrence ? Cela permettra d’adapter l’argumentation.'
						},
						{
							q: 'Pour un projet comme le vôtre, dans quelle fourchette tarifaire se situe la concurrence ?',
							detail: '(Uniquement si le client a répondu oui à la question 8.)'
						},
						{
							q: 'Âge ?',
							detail: 'Un financement est accordé jusqu’à 80 ans + 11 mois au terme du crédit.'
						},
						{
							q: 'Que veulent-ils changer ?',
							detail: 'Identifier les priorités. « Pour quand ? » évalue le degré de motivation.'
						}
					]
				}
			]
		},
		8: {
			icon: '🚪',
			title: 'Tram de prospection',
			subtitle: 'Porte à porte — script complet Bravaux',
			blocks: [
				{
					kind: 'list',
					title: 'À avoir sur soi',
					items: materiel.map((m) => m.label)
				},
				{ kind: 'phases', phases },
				{
					kind: 'p',
					text: 'La fiche contact est le seul lien qui restera entre la prospection et une fois rentré chez vous. Elle doit être remplie minutieusement avec le maximum d’informations prises en porte (en lien avec les 11 points de découverte). Elle vous sera demandée systématiquement à chaque brief le matin.'
				},
				{
					kind: 'list',
					title: 'La Fiche Contact',
					items: [
						'🕐 Quand ? — Directement après votre prise de RDV pour que toutes les informations soient encore en tête — rien ne s’oublie plus vite qu’une conversation de porte.',
						'📁 Où ? — Saisie aussitôt sur le CRM afin de faciliter l’organisation lors de la confirmation des RDV. Une fois à l’agence, rangez-la dans votre bannette ou le classeur dédié.'
					]
				}
			]
		},
		9: {
			icon: '🧠',
			title: 'Les fondamentaux du RDV',
			subtitle: 'Les règles d’or et la règle des 3 fois 20',
			blocks: [
				{
					kind: 'list',
					title: 'À vous qui me rendez visite',
					numbered: true,
					items: [
						{
							q: 'Essayez d’obtenir un maximum d’informations sur ma personnalité, mes besoins, mon mode de vie',
							detail: 'c’est ce que vous appelez LA DÉCOUVERTE.'
						},
						{
							q: 'Lors de notre entrevue, ne me parlez pas de VOUS, mais de MOI, de MES BESOINS, de MON INTÉRÊT, de MON PROFIT.'
						},
						{
							q: 'N’oubliez surtout pas que mon désir d’acheter m’est dicté autant par une réflexion logique que par mes émotions.'
						},
						{
							q: 'Parlez-moi de VOS PRODUITS dans le cadre de MES BESOINS.',
							detail: 'Soyez naturel, n’ayez pas l’air de professer.'
						},
						{
							q: 'Écoutez-moi avec la plus grande attention',
							detail: 'car chacune de mes réactions est une perche que je vous tends.'
						},
						{
							q: 'Apprenez à connaître mes besoins',
							detail: 'et vous constaterez que je peux vous confier des commandes plus importantes.'
						},
						{
							q: 'Ne me considérez pas comme un client définitivement acquis.',
							detail:
								'Dépensez autant d’énergie pour me conserver que pour me conquérir.'
						},
						{
							q: 'Adaptez votre comportement à mon état d’esprit (SONCAS)',
							detail: '= levier, motivation d’achat.'
						}
					]
				},
				{
					kind: 'list',
					title: 'La règle des 3 fois 20 — tout le monde se fait un avis de l’interlocuteur qu’il rencontre pour la première fois',
					items: [
						{
							q: '20 premières secondes',
							detail: 'Tenue, présentation, allure générale'
						},
						{
							q: '20 premières paroles',
							detail: 'Langage, vocabulaire, ton'
						},
						{
							q: '20 premiers gestes',
							detail: 'Arrivée, attitudes, posture'
						}
					]
				},
				{
					kind: 'callout',
					tone: 'violet',
					text: 'L’AMBIANCE = CONFIANCE = SÉDUCTION + DÉCOUVERTE — Vous devez séduire votre client (le faire rêver) avant d’argumenter. NE DÉBUTEZ PAS VOTRE VENTE AVANT QUE LA CONFIANCE SOIT INSTALLÉE.'
				},
				{
					kind: 'list',
					title: 'Sujets à aborder',
					items: [
						'Son environnement, sa décoration, son jardin, ses loisirs, ses animaux, sa vie.'
					]
				},
				{
					kind: 'list',
					title: 'Sujets à ÉVITER',
					items: ['Le négatif, la religion, la politique, tout sujet polémique.']
				},
				{
					kind: 'callout',
					tone: 'red',
					text: 'LES MOTS « DEVIS » ET « TRAVAUX » SONT À BANNIR EN PROSPECTION.'
				}
			]
		},
		10: {
			icon: '🗺️',
			title: 'Déroulé d’un RDV',
			subtitle: 'De la prise de rendez-vous à la confortation',
			blocks: [
				{
					kind: 'p',
					text: '1.A — La prise de rendez-vous : en porte à porte, GMS, Phoning ou autre... Voir « Les 8 étapes de la prise de RDV » / « Les 11 questions de la découverte » / « Les 6 critères d’un RDV qualifié ». Remplir la fiche contact, classer sur le CRM, annoncer le contact.'
				},
				{
					kind: 'steps',
					title: '1.B — Les étapes du RDV et de la vente',
					items: [
						{
							n: '1',
							label: 'Ambiance et découverte (10 min minimum)',
							detail:
								'Créer un climat de confiance. S’intéresser à la vie, le travail, les loisirs. Refaire le tour des 11 questions si nécessaire. Anticiper les objections. Demander « un coin de table » pour sortir vos affaires.'
						},
						{
							n: '2',
							label: 'Prise de cotes (Variable)',
							detail:
								'Étape primordiale pour tout projet hors solaire. Bien chiffrer commence par un bon métré. Pour une toiture : monter sur le toit, faire un diagnostic. Nous sommes des professionnels.'
						},
						{
							n: '3',
							label: 'Étude Personnalisée',
							detail:
								'Remplir la première partie de l’étude avec les clients (tous décisionnaires à table). Éviter le canapé — les clients doivent vous faire face.'
						},
						{
							n: '4',
							label: 'Présentation société / Déballe Catalogue (15 min environ)',
							detail:
								'Rassurer le client sur Bravaux. Montrer que nous nous occupons de tout de A à Z. Verrou : « J’imagine que le jour où vous allez [projet], vous ferez appel à une société comme la nôtre... »'
						},
						{
							n: '5',
							label: 'Rédaction Déballe (10 min environ)',
							detail:
								'Faire un chiffrage détaillé sans que les clients en prennent connaissance. Maintenir l’ambiance durant cette phase.'
						},
						{
							n: '6',
							label: 'Présentation Déballe',
							detail:
								'Doit bouger, être vivant et faire participer les clients. Pour être convaincant, soyez convaincu.'
						},
						{
							n: '7',
							label: 'Bon de Commande et dossier',
							detail: 'Voir book BDC et dossier.'
						},
						{
							n: '8',
							label: 'Confortation (15 min minimum)',
							detail:
								'Prendre le temps de conforter la vente. Ne pas partir une fois le contrat signé. Laisser ses coordonnées. Programmer un RDV de confort sous 48h.'
						}
					]
				},
				{
					kind: 'callout',
					tone: 'amber',
					text: 'Pourquoi arrêter un R1 ? Un R2 doit être positionné chez le prospect sous 48h si : décisionnaire absent ou pressé (pas 1h30 à nous accorder) · visite impromptue.'
				}
			]
		},
		11: {
			icon: '📖',
			title: 'Le catalogue',
			subtitle: 'La présentation de la société page par page',
			blocks: [
				{
					kind: 'p',
					text: '« Messieurs Dames, je vais vous présenter la société car j’imagine que c’est important de savoir à qui vous avez à faire, n’est-ce pas ? »'
				},
				{
					kind: 'table',
					title: 'Structure de présentation',
					headers: ['Repère', 'Contenu'],
					rows: [
						[
							'P1',
							'Structure de la société — Bravaux, c’est nous-mêmes : nous nous occupons des particuliers. Notre équipe technique et administrative assure le suivi complet de votre projet.'
						],
						[
							'P2/3',
							'Sommaire — Éco-énergie et solutions de transition : panneaux photovoltaïques, pompes à chaleur, isolation thermique, menuiserie.'
						],
						[
							'P4/5',
							'Histoire de la société — spécialisée dans la rénovation énergétique, implantée sur la région PACA. « Vous voyez, Bravaux est une société sérieuse, n’est-ce pas ? »'
						],
						[
							'P6/7',
							'Le concept — UN SEUL INTERLOCUTEUR POUR UN SERVICE GLOBAL. On s’occupe de tout de A à Z : le conseil, les démarches administratives, la logistique, l’installation, l’entretien, le service client.'
						],
						[
							'P8/9',
							'La gamme de produits — « Je vous rassure, je ne vais pas vous faire tout le catalogue, sinon je mange là ce soir ! » (humour)'
						],
						[
							'P10/11',
							'Les services Bravaux — 5 étapes : conseiller → démarches administratives → métrage technique → pose (8 à 12 semaines) → contrôle qualité → service satisfaction client.'
						],
						[
							'Photos & avis',
							'Montrer les différents types d’installation. Présenter les avis clients et les certifications (RGE, CSTB...).'
						],
						[
							'Parrainage',
							'Si vous êtes contents de nous, parlez-en à votre entourage. Si ces personnes travaillent avec nous grâce à vous, nous vous récompensons.'
						]
					]
				},
				{
					kind: 'callout',
					tone: 'violet',
					text: 'Phrase finale de verrou : « De ce que je vous ai présenté, Bravaux est une société avec laquelle vous seriez susceptible de travailler, n’est-ce pas ? » — VOUS NE PASSEZ PAS À LA SUITE TANT QUE VOUS N’AVEZ PAS UN OUI FRANC !'
				},
				{
					kind: 'callout',
					tone: 'emerald',
					text: 'UNE BONNE PRÉSENTATION CATALOGUE, C’EST L’ASSURANCE D’ÉLIMINER EN 15 MINUTES DES OBJECTIONS !'
				}
			]
		},
		12: {
			icon: '💶',
			title: 'Déballe FI',
			subtitle: 'Paiement comptant, Facilité de Paiement, méthode ARRIS',
			blocks: [
				{
					kind: 'script',
					lines: [
						{
							type: 'V',
							text: 'Monsieur/Madame, je vais maintenant vous expliquer les différents modes de paiement chez Bravaux. Nous vous proposons deux solutions : le Paiement Comptant et la Facilité de Paiement.'
						}
					]
				},
				{
					kind: 'list',
					title: '1/ Le Paiement Comptant',
					items: [
						'30 % d’acompte à la date du métrage — 70 % à la pose.',
						'Uniquement 10 % de notre clientèle le choisit.'
					]
				},
				{
					kind: 'list',
					title: '2/ Éligibilité à la Facilité de Paiement — 3 critères',
					check: true,
					items: [
						'Être propriétaire (c’est bien le cas sinon je ne serais pas là)',
						'Avoir moins de 84 ans',
						'Avoir un revenu minimal de 1 000 € / mois dans le foyer'
					]
				},
				{
					kind: 'callout',
					tone: 'emerald',
					text: 'Bonne nouvelle : vous êtes éligible à la Facilité de Paiement !'
				},
				{
					kind: 'p',
					text: '3/ Les avantages — Frais intermédiaires : les inconvénients classiques d’un crédit sont les frais de dossier, de gestion et de solde. Chez Bravaux, notre métier n’est pas de nous enrichir sur notre clientèle — nous avons négocié :'
				},
				{
					kind: 'list',
					check: true,
					items: ['Frais de dossier = 0 €', 'Frais de gestion = 0 €', 'Frais de solde = 0 €']
				},
				{
					kind: 'table',
					title: '4/ La méthode ARRIS — Souplesse de gestion',
					headers: ['Lettre', 'Action', 'Conditions', 'Coût'],
					rows: [
						['A', 'AUGMENTER', 'votre mensualité à tout moment', '0 €'],
						['R', 'RÉDUIRE', 'votre mensualité à tout moment', '0 €'],
						['R', 'REPORTER', 'une mensualité (2 fois/an max)', '0 €'],
						['I', 'INJECTER', 'une somme (min. 3x la mensualité)', '0 €'],
						['S', 'SOLDER', 'votre financement à tout moment', '0 €']
					]
				},
				{
					kind: 'list',
					title: '5/ Le Versement Confort et la Flèche du temps',
					items: [
						'À la commande : 0 €',
						'Au métrage : 0 €',
						'Pendant la fabrication : 0 €',
						'À la pose : 0 €',
						'1 mois après la pose : départ sur la mensualité validée, modulable à volonté'
					]
				}
			]
		},
		13: {
			icon: '☀️',
			title: 'Déballe Solaire',
			subtitle: 'Autoconsommation, fournisseur d’énergie, transfert de charge',
			blocks: [
				{
					kind: 'list',
					numbered: true,
					items: [
						'Étude 1ère page (faire sortir les premières objections)',
						'Présentation du catalogue Bravaux',
						'Présentation solaire'
					]
				},
				{
					kind: 'script',
					lines: [
						{
							type: 'V',
							text: 'Avant de vous expliquer la centrale d’autoconsommation, je vais vous expliquer les avantages et les inconvénients à avoir un fournisseur d’énergie.'
						}
					]
				},
				{
					kind: 'table',
					title: 'Fournisseur d’énergie — Avantages / Inconvénients',
					headers: ['AVANTAGES', 'INCONVÉNIENTS'],
					rows: [
						['Avoir du courant', 'Tarifs non contrôlés'],
						['Confort', 'Augmentation du tarif EDF de 5,5% / 10 ans'],
						['Pas de gestion', 'Taxe ~63% (TURPE + taxes diverses)'],
						['', 'Régularisation non contrôlée'],
						['', 'Crédit à vie']
					]
				},
				{
					kind: 'callout',
					tone: 'violet',
					text: 'Verrou : « Vous comprenez maintenant l’intérêt de réfléchir à l’autoconsommation, n’est-ce pas ? »'
				},
				{
					kind: 'table',
					title: 'Calcul de l’autoconsommation',
					headers: ['CONSOMMATION', 'ÉCONOMIE'],
					rows: [
						['Chauffage = 40% de la facture', 'Autoconsommation (utilisation de PVGIS)'],
						['Eau chaude sanitaire = 30%', 'Ballon thermodynamique : éco. de 70% sur l’ECS'],
						['Domestique (équipements) = 20%', 'Domotique : 20% de la consommation globale'],
						['Piscine = 10%', '—']
					]
				},
				{
					kind: 'p',
					text: 'Financement du projet — Transfert de charge : le transfert de charge permet de financer votre installation grâce aux économies réalisées. Le client ne sort pas d’argent supplémentaire de sa poche — il réoriente ce qu’il payait déjà à son fournisseur d’énergie.'
				},
				{
					kind: 'callout',
					tone: 'emerald',
					text: 'Verrou final : « Donc on est bien d’accord qu’en additionnant votre transfert de charge plus votre capital disponible, cela passe bien dans votre budget, n’est-ce pas ? »'
				}
			]
		},
		14: {
			icon: '🛡️',
			title: 'Objections',
			subtitle: 'La méthodologie de traitement des objections',
			blocks: [
				{
					kind: 'p',
					text: 'Savoir vendre signifie aussi savoir négocier, et la négociation n’existe qu’à partir du moment où le client dit « non ».'
				},
				{
					kind: 'steps',
					title: 'Méthodologie du traitement des objections',
					items: [
						{ n: '1', label: 'ÉCOUTER ACTIVEMENT', detail: 'Se taire et ne jamais interrompre son client.' },
						{
							n: '2',
							label: 'ACQUIESCER L’OBJECTION',
							detail: 'Aller dans le sens du client positivement sans jamais lui dire « non mais... ».'
						},
						{
							n: '3',
							label: 'ISOLER L’OBJECTION',
							detail: 'Poser une question pour être sûr que l’objection est unique.'
						},
						{
							n: '4',
							label: 'REFORMULER L’OBJECTION',
							detail: 'Répéter l’objection avec les mêmes mots pour inciter le client à préciser.'
						},
						{
							n: '5',
							label: 'TRAITER L’OBJECTION',
							detail: 'Convaincre le client de s’allier à nos propos de sa propre volonté.'
						},
						{
							n: '6',
							label: 'REFORMULER AVEC OUI DE VERROU',
							detail: 'Vérifier et faire affirmer que l’objection n’a plus lieu d’être.'
						}
					]
				},
				{
					kind: 'callout',
					tone: 'red',
					text: 'NE JAMAIS INTERROMPRE UN CLIENT'
				},
				{
					kind: 'list',
					title: '« IL FAUT QUE JE RÉFLÉCHISSE »',
					items: [
						{ q: 'Écouter / Acquiescer', detail: '« d’accord, j’ai compris... » + hocher la tête' },
						{
							q: 'Isoler',
							detail: '« Si je comprends bien, vous souhaitez réfléchir à ma proposition ? »'
						},
						{
							q: 'Reformuler',
							detail:
								'« Si vous souhaitez réfléchir, c’est que ma proposition vous intéresse, et je suppose qu’il y a quelque chose qui vous fait hésiter ? »'
						},
						{
							q: 'Traiter',
							detail:
								'« Pendant que je suis là, je vais essayer d’éclaircir le ou les points qui vous font hésiter. »'
						}
					]
				},
				{
					kind: 'list',
					title: '« JE DOIS EN PARLER À... »',
					items: [
						{ q: 'Écouter / Acquiescer', detail: '« d’accord, j’ai compris... »' },
						{
							q: 'Isoler',
							detail: '« Vous devez donc en parler avec [X], et ce sont eux qui prennent la décision ? »'
						},
						{ q: 'Reformuler', detail: '« Vous souhaitez donc parler de votre projet à [X]. »' },
						{
							q: 'Traiter',
							detail: '« Est-ce que [X] intervient aussi pour vos achats quotidiens ? »'
						}
					]
				},
				{
					kind: 'list',
					title: '« ON VEUT VOIR LA CONCURRENCE »',
					items: [
						{ q: 'Écouter / Acquiescer', detail: '« Votre souhait est légitime, je le comprends. »' },
						{
							q: 'Isoler',
							detail: '« Pouvez-vous me dire ce qui vous semble perfectible dans ma proposition ? »'
						},
						{
							q: 'Traiter',
							detail: '« Pourquoi aller chercher ailleurs ce que vous avez sous la main ? »'
						}
					]
				},
				{
					kind: 'list',
					title: '« C’EST CHER »',
					items: [
						{ q: 'Écouter / Acquiescer', detail: '« d’accord, j’ai compris... »' },
						{
							q: 'Isoler',
							detail:
								'« C’est cher par rapport à l’idée que vous vous faisiez, ou cela dépasse votre budget ? »'
						},
						{ q: 'Reformuler', detail: '« Vous pensiez donc que le prix serait moins de X€. »' },
						{
							q: 'Traiter',
							detail:
								'« Que représente cette différence sur les 15 années pendant lesquelles vous allez profiter de votre installation ? »'
						}
					]
				},
				{
					kind: 'list',
					title: '« CE N’EST PAS POUR TOUT DE SUITE »',
					items: [
						{ q: 'Écouter / Acquiescer', detail: '« d’accord, j’ai compris... »' },
						{ q: 'Isoler', detail: '« Vous vous êtes fixé une date pour la réalisation ? »' },
						{
							q: 'Traiter',
							detail:
								'« Avez-vous tenu compte de ce que cette attente va vous coûter ? Économies perdues + augmentation des prix matières... »'
						}
					]
				},
				{
					kind: 'list',
					title: '« JE NE SIGNE JAMAIS DANS LA PRÉCIPITATION »',
					items: [
						{ q: 'Écouter / Acquiescer', detail: '« d’accord, j’ai compris... »' },
						{
							q: 'Isoler',
							detail:
								'« Vous souhaitez donc un temps de réflexion, ou par principe vous ne souhaitez pas vous engager ce soir ? »'
						},
						{ q: 'Traiter', detail: 'Vérifier si l’objection réelle n’est pas le prix.' }
					]
				},
				{
					kind: 'p',
					text: '→ LUI FAIRE DIRE LE PRIX dans tous les cas.'
				},
				{
					kind: 'callout',
					tone: 'violet',
					text: 'Rappel des OUI de verrou — Stratégie des micro-accords : habituer l’interlocuteur à dire « Oui » tout au long de l’échange. La décision finale devient une conséquence naturelle des « oui » formulés pendant la rencontre.'
				},
				{
					kind: 'list',
					items: [
						'« Serez-vous d’accord pour dire que... ? »',
						'« Avez-vous remarqué que... ? »',
						'« Vous arrive-t-il de penser que... ? »',
						'« Cela vous rappelle quelque chose... ? »',
						'Affirmation terminée par : « d’accord ? / entendu ? »',
						'Énoncer une évidence + « non ? / n’est-ce pas ? »'
					]
				}
			]
		},
		15: {
			icon: '🤝',
			title: 'DO — Demande d’Opportunité',
			subtitle: 'Le coup de téléphone qui fait pencher la balance',
			blocks: [
				{
					kind: 'p',
					text: 'La DO est obligatoire. Elle permet d’avoir un excellent moyen de pression et de verrou lors du RDV avec son client pour signer en R1.'
				},
				{
					kind: 'table',
					title: 'Déroulement d’une DO',
					headers: ['Côté client', 'Côté responsable'],
					rows: [
						['Nom client + ville', 'Répondre de façon positive'],
						['Ambiance positive', 'Répéter mot pour mot'],
						['Projet identifié', 'Se lever à l’annonce du prix'],
						['Solution de financement présentée', 'Attaque de vente + tendre la main'],
						['Bagarre pour avoir un geste', 'Rappeler pour la décision'],
						['Répéter que les clients veulent travailler avec nous', '—']
					]
				},
				{
					kind: 'list',
					title: 'Entre les 2 appels',
					items: [
						'Dire que vous espérez avoir 400-500€ — « ce serait génial ! »',
						'Demander un verre d’eau',
						'Stresser légèrement et espérer avec le client',
						'Vivre la situation avec le client — DYNAMISME, THÉÂTRE, PERSUASIF, ÉMOTION'
					]
				},
				{
					kind: 'script',
					lines: [
						{
							type: 'V',
							text: 'Bonjour [Responsable], je ne vous dérange pas ? Je vous appelle car je suis chez M. X à [VILLE], on est sur un projet [TYPE] avec un transfert de charge à hauteur de X€/mois. Les clients sont prêts à nous faire travailler, mais la seule chose qui les fait hésiter c’est le prix. Je voulais voir avec vous s’il est possible de faire quelque chose pour eux ?'
						}
					]
				},
				{
					kind: 'callout',
					tone: 'red',
					text: 'AUCUNE DO NE DOIT ÊTRE FAITE TANT QUE VOUS N’AVEZ PAS TRAITÉ TOUTES LES OBJECTIONS PENDANT AU MOINS 1/4 D’HEURE. SINON LA DO N’A PAS D’IMPACT.'
				},
				{
					kind: 'list',
					title: 'Thèmes de DO',
					items: [
						'Le rachat / reprise',
						'La prise de vue (photo avant/après)',
						'Le client ou chantier référence',
						'L’offre de parrainage',
						'L’opération déstockage',
						'La maison témoin'
					]
				},
				{
					kind: 'callout',
					tone: 'amber',
					text: 'RAPPEL : aucune remise ou offre de prix ne peut être décidée par le technicien conseil. Elle doit être validée par un responsable hiérarchique.'
				}
			]
		},
		16: {
			icon: '😌',
			title: 'Conforte',
			subtitle: 'Rassurer les clients après la signature',
			blocks: [
				{
					kind: 'p',
					text: 'On doit rassurer les clients !!! Vous avez passé 2h à convaincre votre client — restez au minimum 30 minutes pour asseoir sa décision.'
				},
				{
					kind: 'steps',
					items: [
						{
							n: '1',
							label: 'Après avoir bien relu les documents avec vos clients, les remercier de leur confiance.'
						},
						{ n: '2', label: 'Ne pas oublier de prendre un RDV métré.' },
						{ n: '3', label: 'Continuer le climat de confiance — ambiance.' },
						{
							n: '4',
							label: 'Aborder et demander les noms de connaissances pour le parrainage.'
						},
						{ n: '5', label: 'Rappeler la procédure qui va suivre.' },
						{ n: '6', label: 'Reprendre l’ambiance.' },
						{ n: '7', label: 'Positionner un RDV de conforte pendant le R1, à J+1 ou J+2.' }
					]
				},
				{
					kind: 'steps',
					title: 'La procédure post-signature',
					items: [
						{ n: '1', label: 'Le service vérification commande vous appellera' },
						{ n: '2', label: 'Le passage du métreur' },
						{ n: '3', label: 'La secrétaire prend RDV pour la pose' },
						{ n: '4', label: 'On pose' },
						{ n: '5', label: 'Visite du responsable des poses' },
						{ n: '6', label: 'Satisfaction client à leur disposition' }
					]
				},
				{
					kind: 'callout',
					tone: 'emerald',
					text: 'FÉLICITATIONS ! Vous avez terminé le book de formation commercial Bravaux. Maîtrisez chaque module, entraînez-vous quotidiennement, et vos résultats suivront. 🏆'
				}
			]
		}
	};

	// Ordre des onglets : les 16 modules du book de formation.
	const moduleOrder = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];

	// Module actif (tab) dans la page Books — Module 8 (trame TAP) par défaut.
	let activeModule = $state<number>(8);
</script>

<div class="mx-auto max-w-3xl space-y-4 p-4">
	<!-- Onglets : les 16 modules du book de formation -->
	<div class="flex flex-wrap gap-1.5 rounded-xl border border-line bg-glass-3 p-1">
		{#each moduleOrder as m (m)}
			<button
				type="button"
				onclick={() => (activeModule = m)}
				class={[
					'rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-colors',
					activeModule === m
						? 'bg-foreground text-background shadow-sm'
						: 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'
				].join(' ')}
			>
				{modules[m].icon} {modules[m].title}
			</button>
		{/each}
	</div>

	<!-- En-tête -->
	<div class="flex items-center gap-3">
		<span
			class="grid size-11 place-items-center rounded-xl border border-line bg-primary/15 text-primary"
		>
			{modules[activeModule].icon}
		</span>
		<div>
			<h1 class="text-[19px] font-bold text-foreground">
				{modules[activeModule].title}
			</h1>
			<p class="text-[12.5px] text-muted-foreground">
				{modules[activeModule].subtitle}
			</p>
		</div>
	</div>

	{#each modules[activeModule].blocks as block}
		{#if block.kind === 'p'}
			<div class="rounded-2xl border border-line bg-card2 p-4">
				<p class="text-[12.5px] leading-relaxed text-muted-foreground">{block.text}</p>
			</div>
		{:else if block.kind === 'callout'}
			<div
				class={[
					'rounded-xl border border-line p-3 text-[12.5px] leading-relaxed font-medium',
					toneCls[block.tone ?? 'line']
				].join(' ')}
			>
				{block.text}
			</div>
		{:else if block.kind === 'list'}
			<div class="rounded-2xl border border-line bg-card2 p-4">
				{#if block.title}
					<p class="mb-3 text-[13px] font-semibold text-foreground">{block.title}</p>
				{/if}
				<div class="space-y-2.5">
					{#each block.items as item}
						{@const text = typeof item === 'string' ? item : item.q}
						{@const detail = typeof item === 'string' ? undefined : item.detail}
						{@const i = block.items.indexOf(item)}
						<div class="flex items-start gap-3">
							{#if block.numbered}
								<span
									class="mt-0.5 grid size-6 shrink-0 place-items-center rounded-lg bg-emerald-500/15 text-[12px] font-bold text-emerald-400 light:text-emerald-600"
								>
									{i + 1}
								</span>
							{:else if block.check}
								<span
									class="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-emerald-500/15 text-[11px] text-emerald-400 light:text-emerald-600"
								>
									✓
								</span>
							{:else}
								<span
									class="mt-[7px] size-1.5 shrink-0 rounded-full bg-muted-foreground/50"
								></span>
							{/if}
							<div class="min-w-0">
								<p class="text-[13px] font-semibold text-foreground">{text}</p>
								{#if detail}
									<p class="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">{detail}</p>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			</div>
		{:else if block.kind === 'table'}
			<div class="rounded-2xl border border-line bg-card2 p-4">
				{#if block.title}
					<p class="mb-3 text-[13px] font-semibold text-foreground">{block.title}</p>
				{/if}
				<div class="overflow-x-auto">
					<table class="w-full border-collapse text-left">
						<thead>
							<tr>
								{#each block.headers as h}
									<th
										class="border-b border-line px-2.5 py-2 text-[11px] font-bold tracking-wider text-muted-foreground uppercase"
									>
										{h}
									</th>
								{/each}
							</tr>
						</thead>
						<tbody>
							{#each block.rows as row}
								<tr class="border-b border-line/60 last:border-0">
									{#each row as cell, ci}
										<td
											class={[
												'px-2.5 py-2 text-[12px] leading-relaxed align-top',
												ci === 0
													? 'font-semibold text-foreground'
													: 'text-muted-foreground'
											].join(' ')}
										>
											{cell}
										</td>
									{/each}
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{:else if block.kind === 'script'}
			<div class="rounded-2xl border border-line bg-card2 p-4">
				{#if block.lines.length > 1}
					<p class="mb-3 text-[13px] font-semibold text-foreground">Le script</p>
				{/if}
				<div class="space-y-2">
					{#each block.lines as line}
						<div class="flex items-start gap-2.5">
							<span
								class={[
									'mt-0.5 shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold',
									lineChip[line.type].cls
								].join(' ')}
							>
								{lineChip[line.type].label}
							</span>
							<p class="text-[12.5px] leading-relaxed text-foreground">
								{#if line.type === 'V' || line.type === 'C'}
									« {line.text} »
								{:else}
									{line.text}
								{/if}
							</p>
						</div>
					{/each}
				</div>
			</div>
		{:else if block.kind === 'steps'}
			<div class="rounded-2xl border border-line bg-card2 p-4">
				{#if block.title}
					<p class="mb-3 text-[13px] font-semibold text-foreground">{block.title}</p>
				{/if}
				<div class="space-y-2.5">
					{#each block.items as s}
						<div class="flex items-start gap-3">
							<span
								class="grid size-8 shrink-0 place-items-center rounded-xl bg-emerald-500/15 text-[15px] font-bold text-emerald-400 light:text-emerald-600"
							>
								{s.n}
							</span>
							<div class="min-w-0 pt-0.5">
								<p class="text-[13px] font-semibold text-foreground">{s.label}</p>
								{#if s.detail}
									<p class="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">{s.detail}</p>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			</div>
		{:else if block.kind === 'phases'}
			<!-- Les 8 phases de la trame TAP -->
			{#each block.phases as p}
				<div class="rounded-2xl border border-line bg-card2 p-4">
					<div class="flex items-start gap-3">
						<span
							class="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-500/15 text-[18px] font-bold text-emerald-400 light:text-emerald-600"
						>
							{p.n}
						</span>
						<div class="min-w-0 flex-1">
							<div class="flex flex-wrap items-center gap-2">
								<h2 class="text-[14px] font-bold text-foreground">{p.name}</h2>
								{#if p.duration !== '—'}
									<span
										class="rounded-full border border-line bg-glass-3 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground"
									>
										{p.duration}
									</span>
								{/if}
							</div>
							<p class="mt-0.5 text-[12px] text-muted-foreground italic">{p.objectif}</p>
						</div>
					</div>

					<div class="mt-3 space-y-2">
						{#each p.lines as line}
							<div class="flex items-start gap-2.5">
								<span
									class={[
										'mt-0.5 shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold',
										lineChip[line.type].cls
									].join(' ')}
								>
									{lineChip[line.type].label}
								</span>
								<p class="text-[12.5px] leading-relaxed text-foreground">
									{#if line.type === 'V' || line.type === 'C'}
										« {line.text} »
									{:else}
										{line.text}
									{/if}
								</p>
							</div>
						{/each}
					</div>
				</div>
			{/each}
		{/if}
	{/each}
</div>
