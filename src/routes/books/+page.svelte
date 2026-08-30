<script lang="ts">
	// Page « Books » : synthèse du Module 8 du book de formation
	// (TAP — Porte à porte) avec la trame complète à réciter sur le terrain.

	type LineType = 'V' | 'C' | 'Q' | 'R';
	type Line = { type: LineType; text: string };
	type Phase = {
		n: number;
		name: string;
		objectif: string;
		duration: string;
		lines: Line[];
	};

	const materiel = [{ label: '📄 Flyer Harmony Confort' }, { label: '🪪 Badge nominatif' }];

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
					text: 'C’est UNE PRISE D’ADRESSE — pas encore un RDV. Ne donnez pas encore le catalogue : il serre de prétexte pour revenir.'
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
					text: 'L’avantage avec Harmony Confort, c’est qu’on est spécialisé en rénovation énergétique et qu’on fait du sur-mesure adapté à votre maison, vos besoins et votre budget réel. L’inconvénient, c’est que les prix ne figurent pas dans le catalogue... chaque maison est différente. Ce serait une encyclopédie et ça ne passerait pas dans la BAL ! Donc ce que je vais faire : quand je repasserai voir mon client dans votre rue, je fais un crochet pour vous remettre le catalogue en main propre et vous donner une notion de prix. Par contre, j’ai été bien élevé, je ne passerai pas à l’improviste ! Pour vous joindre, c’est plus facile au 06 / 07 / 02 ?'
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

	// Module actif (tab) dans la page Books : 6 (qualification), 7 (découverte)
	// ou 8 (trame TAP) — Module 8 par défaut.
	type ModuleKey = 6 | 7 | 8;
	let activeModule = $state<ModuleKey>(8);
	const moduleTabs: ModuleKey[] = [6, 7, 8];

	const moduleInfo: Record<ModuleKey, { icon: string; title: string; subtitle: string; badge: string }> = {
		6: {
			icon: '✔️',
			title: 'Points de qualification',
			subtitle: 'Qualifier ses RDV pour optimiser chaque visite',
			badge: 'Module 6'
		},
		7: {
			icon: '🎯',
			title: 'Points de découverte',
			subtitle: 'Les 11 questions à poser à la prise de RDV TAP',
			badge: 'Module 7'
		},
		8: {
			icon: '🚪',
			title: 'Tram de prospection',
			subtitle: 'Porte à porte — script complet Harmony Confort',
			badge: 'Module 8'
		}
	};

	const module6 = {
		intro:
			'Optimiser son temps de travail est une des clés de votre réussite. Il est important de bien qualifier ses rendez-vous pour ne pas perdre du temps — donc de l’argent.',
		criteriaTitle: 'Un rendez-vous qualifié — les 6 critères obligatoires :',
		criteria: [
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
				q: 'Un produit inscrit dans la gamme Harmony Confort.',
				detail:
					'Connaître par cœur la gamme de produits pour ne pas proposer un produit non commercialisé.'
			},
			{
				q: 'Si le RDV est pris avec Madame, le confirmer le jour même avec Monsieur.',
				detail:
					'Si le RDV est pris avec Mme sans que Mr soit au courant, vous pouvez être certain qu’il ne l’acceptera pas.'
			}
		],
		closing:
			'Ces 6 critères sont OBLIGATOIRES. S’il en manque un seul, il est inutile de se déplacer. La qualification va dépendre de l’ambiance, de la découverte, de l’envie !'
	};

	const module7 = {
		intro:
			'Vous devez faire une bonne découverte pour savoir comment diriger votre RDV et ainsi éviter certaines objections.',
		warning:
			'Les 11 questions de la découverte doivent obligatoirement être posées à la prise de RDV TAP. Ne pas commencer le RDV s’il manque une réponse à l’une d’elles !',
		questions: [
			{
				q: 'Nombre de personnes dans le foyer ?',
				detail:
					'Savoir si tous les décisionnaires sont présents. Permet de connaître le pouvoir d’achat.'
			},
			{
				q: 'Depuis combien de temps habitent-ils ici ?',
				detail:
					'Crédit maison (en général 20 ans). Ciblage du parrainage.'
			},
			{
				q: 'S’ils se plaisent bien chez eux ?',
				detail:
					'Pour éviter l’objection : « je vais déménager / vendre ».'
			},
			{
				q: 'Le dernier investissement / gros achat.',
				detail:
					'Connaître quel type d’acheteur : comptant ou crédit.'
			},
			{
				q: 'Le métier / ancien métier.',
				detail:
					'Évaluer leurs revenus pour cibler votre vente.'
			},
			{
				q: 'Imposable ou pas ?',
				detail:
					'Permet d’apprécier la solidité financière du ménage.'
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
				detail:
					'(Uniquement si le client a répondu oui à la question 8.)'
			},
			{
				q: 'Âge ?',
				detail:
					'Un financement est accordé jusqu’à 80 ans + 11 mois au terme du crédit.'
			},
			{
				q: 'Que veulent-ils changer ?',
				detail:
					'Identifier les priorités. « Pour quand ? » évalue le degré de motivation.'
			}
		]
	};

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
</script>

<div class="mx-auto max-w-3xl space-y-4 p-4">
	<!-- Onglets : Module 6 · 7 · 8 (avant le titre) -->
	<div class="flex flex-wrap gap-1.5 rounded-xl border border-line bg-glass-3 p-1">
		{#each moduleTabs as m (m)}
			<button
				type="button"
				onclick={() => (activeModule = m)}
				class={[
					'flex-1 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-colors sm:flex-none',
					activeModule === m
						? 'bg-foreground text-background shadow-sm'
						: 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'
				].join(' ')}
			>
				{moduleInfo[m].icon} {moduleInfo[m].title}
			</button>
		{/each}
	</div>

	<!-- En-tête -->
	<div class="flex items-center gap-3">
		<span
			class="grid size-11 place-items-center rounded-xl border border-line bg-primary/15 text-primary"
		>
			{moduleInfo[activeModule].icon}
		</span>
		<div>
			<h1 class="text-[19px] font-bold text-foreground">
				{moduleInfo[activeModule].title}
			</h1>
			<p class="text-[12.5px] text-muted-foreground">
				{moduleInfo[activeModule].subtitle}
			</p>
		</div>
	</div>

	{#if activeModule === 6}
		<div class="rounded-2xl border border-line bg-card2 p-4">
			<p class="text-[12.5px] leading-relaxed text-muted-foreground">{module6.intro}</p>
			<p class="mt-3 text-[13px] font-semibold text-foreground">{module6.criteriaTitle}</p>
			<div class="mt-2 space-y-2.5">
				{#each module6.criteria as c, i}
					<div class="flex items-start gap-3">
						<span
							class="mt-0.5 grid size-6 shrink-0 place-items-center rounded-lg bg-emerald-500/15 text-[12px] font-bold text-emerald-400 light:text-emerald-600"
						>
							{i + 1}
						</span>
						<div class="min-w-0">
							<p class="text-[13px] font-semibold text-foreground">{c.q}</p>
							<p class="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">{c.detail}</p>
						</div>
					</div>
				{/each}
			</div>
			<div
				class="mt-4 rounded-xl border border-line bg-amber-500/10 p-3 text-[12.5px] font-medium text-amber-500 dark:text-amber-300"
			>
				{module6.closing}
			</div>
		</div>
	{:else if activeModule === 7}
		<div class="rounded-2xl border border-line bg-card2 p-4">
			<p class="text-[12.5px] leading-relaxed text-muted-foreground">{module7.intro}</p>
			<div
				class="mt-3 rounded-xl border border-line bg-red-500/10 p-3 text-[12.5px] font-medium text-red-500 dark:text-red-400"
			>
				⚠️ {module7.warning}
			</div>
			<div class="mt-3 space-y-2.5">
				{#each module7.questions as q, i}
					<div class="flex items-start gap-3">
						<span
							class="mt-0.5 grid size-6 shrink-0 place-items-center rounded-lg bg-violet-500/15 text-[12px] font-bold text-violet-400 light:text-violet-600"
						>
							{i + 1}
						</span>
						<div class="min-w-0">
							<p class="text-[13px] font-semibold text-foreground">{q.q}</p>
							<p class="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">{q.detail}</p>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	{#if activeModule === 8}
		<!-- Matériel -->
	<div class="rounded-2xl border border-line bg-card2 p-4">
		<p class="mb-3 text-[13px] font-semibold text-foreground">À avoir sur soi</p>
		<div class="flex flex-wrap gap-2">
			{#each materiel as m}
				<span
					class="rounded-lg border border-line bg-glass-3 px-3 py-1.5 text-[12.5px] font-medium text-foreground"
				>
					{m.label}
				</span>
			{/each}
		</div>
	</div>

	<!-- Les 8 phases -->
	{#each phases as p, i}
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

	<!-- La fiche contact -->
	<div class="rounded-2xl border border-line bg-card2 p-4">
		<h2 class="text-[13px] font-bold text-foreground">La Fiche Contact</h2>
		<p class="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
			C’est le seul lien qui reste entre la prospection et votre retour. Remplissez-la avec le
			maximum d’infos prises en porte (en lien avec les points de découverte).
		</p>
		<div class="mt-2 space-y-1 text-[12.5px] text-muted-foreground">
			<p>🕐 Quand ? — Directement après la prise de RDV, tant que tout est en tête.</p>
			<p>
				📁 Où ? — Saisie aussitôt sur le CRM pour la confirmation des RDV. Demandée à chaque brief
				le matin.
			</p>
		</div>
	</div>
	{/if}
</div>
