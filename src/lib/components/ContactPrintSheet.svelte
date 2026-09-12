<script lang="ts">
	import {
		foyerLabel,
		stripQualificationBlock,
		type QualifAnswers
	} from '$lib/data/qualification';

	type PrintContact = {
		name: string;
		civilites?: string[] | null;
		civilite?: string | null;
		address?: string | null;
		phone?: string | null;
		projet?: string | null;
		source?: string | null;
		note?: string | null;
		createdByName?: string | null;
		_creationTime?: number;
		// Date du contact corrigée : elle remplace la date de création sur la fiche.
		dateContact?: number | null;
		followUp?: {
			type: 'rappel' | 'rdv';
			date: string;
			time?: string | null;
			status?: string | null;
			motif?: string | null;
		} | null;
	};

	let { contact, answers }: { contact: PrintContact; answers: QualifAnswers | null } = $props();

	const parts = $derived((contact.name ?? '').trim().split(/\s+/).filter(Boolean));
	const lastName = $derived(parts[0] ?? '');
	const firstName = $derived(parts.length > 1 ? parts.slice(1).join(' ') : '');
	const addressLines = $derived(
		(contact.address ?? '')
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean)
	);
	const street = $derived(addressLines[0] ?? '');
	const addressTail = $derived(addressLines.at(-1) ?? '');
	const postalCode = $derived(addressTail.match(/\b\d{5}\b/)?.[0] ?? '');
	const city = $derived(addressTail.replace(/\b\d{5}\b/, '').trim());
	const extraAddressLines = $derived(addressLines.slice(1, -1));
	// Date imprimée : la date du contact corrigée si elle existe, sinon la date
	// de création (non modifiable en base).
	const today = $derived(
		contact.dateContact
			? new Date(contact.dateContact).toLocaleDateString('fr-FR')
			: contact._creationTime
				? new Date(contact._creationTime).toLocaleDateString('fr-FR')
				: new Date().toLocaleDateString('fr-FR')
	);
	const rdvDate = $derived(
		contact.followUp?.date
			? new Date(`${contact.followUp.date}T12:00:00`).toLocaleDateString('fr-FR', {
					weekday: 'long',
					day: 'numeric',
					month: 'long',
					year: 'numeric'
				})
			: ''
	);
	// Contact sans RDV : le suivi est un rappel — le bloc de droite l'intitule
	// « DATE DE RAPPEL » au lieu de « DATE DU RENDEZ-VOUS ».
	const isRappel = $derived(contact.followUp?.type !== 'rdv');
	const project = $derived((contact.projet ?? '').trim().toLowerCase());
	// Note libre du contact (bloc « Questions découverte » retiré : il est
	// reconstitué plus bas à partir des réponses structurées).
	const noteText = $derived(stripQualificationBlock(contact.note ?? '').trim());
	// Chaque question est séparée en deux : l'intitulé (gras) et la réponse
	// (normal), comme sur la fiche de l'app mobile.
	const qualifLines = $derived.by(() => {
		const a = answers;
		if (!a) return [];
		const lines: { label: string; value: string }[] = [];
		if (a.foyer) lines.push({ label: 'Foyer', value: foyerLabel(a.foyer) });
		if (a.habite) lines.push({ label: 'Ici depuis', value: a.habite });
		if (a.plait)
			lines.push({ label: 'Se plaît chez eux', value: a.plait === 'oui' ? 'Oui' : 'Non' });
		if (a.achat)
			lines.push({
				label: 'Dernier achat',
				value: `${a.achat}${a.achatDetail.trim() ? ` (${a.achatDetail.trim()})` : ''}`
			});
		if (a.metierM.trim()) lines.push({ label: 'Métier M.', value: a.metierM.trim() });
		if (a.metierMme.trim()) lines.push({ label: 'Métier Mme', value: a.metierMme.trim() });
		if (a.imposable)
			lines.push({ label: 'Imposable', value: a.imposable === 'oui' ? 'Oui' : 'Non' });
		if (a.chauffage)
			lines.push({
				label: 'Chauffage',
				value: `${a.chauffage}${a.chauffageCout.trim() ? ` (${a.chauffageCout.trim()} €/mois)` : ''}`
			});
		if (a.connait)
			lines.push({
				label: 'Connaît le produit',
				value: a.connait === 'oui' ? 'Oui' : 'Non'
			});
		if (a.connait === 'oui' && a.concurrence)
			lines.push({ label: 'Concurrence', value: a.concurrence });
		if (a.age) lines.push({ label: 'Âge', value: a.age });
		if (a.changer)
			lines.push({
				label: 'Veut changer',
				value: `${a.changer}${a.pourQuand ? ` — ${a.pourQuand}` : ''}`
			});
		if (a.soncas.length > 0) lines.push({ label: 'SONCAS', value: a.soncas.join(', ') });
		return lines;
	});

	// Civilités cochées : choix multiple (un couple peut être « M. » et « Mme »).
	const civilites = $derived(
		Array.isArray(contact.civilites) && contact.civilites.length > 0
			? contact.civilites
			: contact.civilite
				? [contact.civilite]
				: []
	);
	const isCiv = (value: string): boolean => civilites.includes(value);

	function has(...values: string[]): boolean {
		return values.some((value) => project.includes(value));
	}


</script>

<div class="contact-print-sheet" aria-hidden="true">
	{#snippet cbox(active: boolean)}
		<span class="cbox">{#if active}<span class="cross">✕</span>{/if}</span>
	{/snippet}
	<div class="print-page">
		<div class="sheet-grid">
			<!-- Moitié gauche : la fiche contact papier -->
			<section class="fiche-col">
				<div class="top-grid">
				<section class="identity-block">						<div class="brand-row">
							<img class="brand-logo" src="/bravaux-logo-print.png" alt="Bravaux" />
						</div>
					<div class="title-band">FICHE DE CONTACT</div>
					<div class="line-row"><b>N°</b><span class="dotted"></span></div>
					<div class="line-row">
						<b>Source</b><span class="value">{contact.source ?? ''}</span><span class="dotted"></span>
					</div>
					<div class="line-row">
						<b>Date</b><span class="value">{today}</span><span class="dotted"></span>
					</div>
					<div class="line-row">
						<b>Technicien conseil</b><span class="value">{contact.createdByName ?? ''}</span><span
							class="dotted"
						></span>
					</div>
				</section>
				<section class="coordinates-block">
					<div class="section-heading">
						<span class="blocks">▪▪▪</span> COORDONNÉES <span class="blocks">▪▪▪</span>
					</div>
					<div class="check-row">
						<span>{@render cbox(isCiv('Melle'))} Melle</span><span>{@render cbox(isCiv('Mme'))} Mme</span><span>{@render cbox(isCiv('M.'))} M.</span><span>Âge : <strong>{answers?.age ?? ''}</strong></span>
					</div>
					<div class="line-row name-row">
						<b>Nom</b><span class="value">{lastName}</span><span class="dotted"></span>
					</div>
					<div class="line-row">
						<b>Prénom</b><span class="value">{firstName}</span><span class="dotted"></span>
					</div>
					<div class="line-row">
						<b>Adresse</b><span class="value">{street}</span><span class="dotted"></span>
					</div>						<div class="line-row">
							<b></b><span class="value">{extraAddressLines.join(', ')}</span><span
								class="dotted"
							></span>
						</div>
						<div class="line-row cp-row">
							<b>C.P.</b><span class="value">{postalCode}</span><span class="dotted"></span><b
								class="city-label">Ville</b
							><span class="value">{city}</span><span class="dotted"></span>
						</div>
					<div class="line-row">
						<b>Tel</b><span class="value">{contact.phone ?? ''}</span><span class="dotted"
						></span>
					</div>
				</section>
			</div>

			<div class="middle-grid">
					<section class="prequal block">
						<div class="section-heading">
							<span class="blocks">▪▪▪</span> PRÉQUALIFICATION <span class="blocks">▪▪▪</span>
						</div>
						<div class="check-row two">
							<span>{@render cbox(answers?.foyer === '1')} Propriétaire</span><span
								>Depuis : <strong>{answers?.habite ?? ''}</strong></span
							>
						</div>
						<div class="check-row two">
							<span>{@render cbox(true)} Maison individuelle</span>
						</div>
						<div class="line-row">
							<b>Profession M.</b><span class="value">{answers?.metierM ?? ''}</span><span
								class="dotted"
							></span>
						</div>
						<div class="line-row">
							<b>Profession Mme</b><span class="value">{answers?.metierMme ?? ''}</span><span
								class="dotted"
							></span>
						</div>
						<div class="line-row">
							<b>Réalisation du projet</b><span class="value">{answers?.pourQuand ?? ''}</span
							><span class="dotted"></span>
						</div>
						<div class="check-row deadline-row">
							<span>{@render cbox(answers?.pourQuand === '2 mois')} 2 mois</span><span
								>{@render cbox(answers?.pourQuand === '6 mois')} 6 mois</span
							><span>{@render cbox(answers?.pourQuand === '1 an')} 1 an</span><span
								>{@render cbox(answers?.pourQuand === '2 ans')} 2 ans</span
							>
						</div>
						<div class="line-row">
							<b>Pourquoi ?</b><span class="dotted"></span>
						</div>
					</section>					<section class="rdv block">
						<div class="section-heading">
							<span class="blocks">▪▪▪</span> {isRappel ? 'DATE DE RAPPEL' : 'DATE DU RENDEZ-VOUS'}
							<span class="blocks">▪▪▪</span>
						</div>
						<div class="line-row">
							<b>Date</b><span class="value">{rdvDate}</span><span class="dotted"></span>
						</div>
						<div class="line-row">
							<b>Heure</b><span class="value">{contact.followUp?.time ?? ''}</span><span class="dotted"
							></span>
						</div>
						<div class="line-row"><b>À confirmer</b><span class="dotted"></span></div>
						<div class="check-row">
							<span>Couple présent :</span><span>{@render cbox(true)} Oui</span><span>{@render cbox(false)} Non</span>
						</div>
						<div class="check-row"><span>Le client a-t-il 1 heure à nous consacrer</span></div>
						<div class="check-row"><span>pour la présentation ? : {@render cbox(true)} Oui</span><span>{@render cbox(false)} Non</span></div>
					</section>
				</div>

				<div class="study-title">
					<span class="blocks">▪▪▪</span> ÉLÉMENTS À ÉTUDIER <span class="blocks">▪▪▪</span>
				</div>
				<div class="study-band">BRAVAUX ISO / BRAVAUX RENO</div>
				<div class="study-grid">
					<section>
						<div class="subheading">HYDROFUGATION</div>
						<div class="item-line">
							<span>{@render cbox(has('toiture'))} Toiture</span>
							<span>M² <i class="m2"></i></span>
							<span>{@render cbox(has('hydro'))} Incolore</span>
							<span>M² <i class="m2"></i></span>
						</div>
						<div class="item-line">
							<span>{@render cbox(has('façade', 'facade'))} Façade</span>
							<span>M² <i class="m2"></i></span>
							<span>{@render cbox(false)} Coloré</span>
							<span>M² <i class="m2"></i></span>
						</div>
						<div class="subheading">ISOLATION DES COMBLES</div>
						<div class="item-line">
							<span>{@render cbox(has('combles'))} Laine de roche</span>
							<span>{@render cbox(false)}Laine de coton</span>
							<span>{@render cbox(false)}M² <i class="m2"></i></span>
						</div>
						<div class="item-line">
							<span>Isolation des murs extérieurs</span><span>M² <i></i></span>
						</div>
						<div class="item-line centered"><span>RIVES</span><b>ML</b><i></i></div>
						<div class="item-line centered"><span>FAÎTAGE</span><b>ML</b><i></i></div>
						<div class="item-line centered"><span>AUTRES</span><i></i></div>
					</section>
					<section>
						<div class="subheading">PRODUITS / PROJETS</div>
						<div class="item-line">
							<span>{@render cbox(has('charpente'))} Charpente</span>
							<span>{@render cbox(false)} Préventif</span>
							<span>{@render cbox(false)} Curatif</span>
						</div>
						<div class="item-line">
							<span>{@render cbox(has('pergola'))} Pergola</span>
							<span>{@render cbox(false)} Dimensions <i></i></span>
						</div>
						<div class="item-line">
							<span>{@render cbox(has('carport'))} Carport</span>
							<span>{@render cbox(false)} Classique</span>
							<span>{@render cbox(false)} Solaire</span>
						</div>
						<div class="item-line">
							<span>{@render cbox(has('fenêtre', 'menuiserie'))} Fenêtre</span>
							<span>Qté <i></i></span>
						</div>
						<div class="item-line">
							<span>{@render cbox(has('porte'))} Porte</span><span>Qté <i></i></span>
						</div>
						<div class="item-line">
							<span>{@render cbox(has('volet'))} Volet</span>
							<span>{@render cbox(false)} Battant</span>
							<span>{@render cbox(false)} Roulant</span>
						</div>
						<div class="item-line">
							<span>{@render cbox(has('pac'))} PAC</span>
							<span>{@render cbox(false)} AIR-AIR</span>
							<span>{@render cbox(false)} AIR-EAU</span>
						</div>
						<div class="item-line">
							<span>FACTURE EDF</span>
							<span
								>Montant <span class="thin">{answers?.chauffageCout ?? ''}</span>{answers?.chauffageCout
									? ' €/mois'
									: ''} <i></i></span
							>
						</div>
					</section>
				</div>
			</section>

			<!-- Moitié droite : informations sur le contact (la note) -->
			<aside class="note-col">
				<div class="project-card">
					<div class="project-label">PROJET DU CONTACT</div>
					<div class="project-value">{contact.projet?.trim() || 'Non renseigné'}</div>
				</div>
				<div class="section-heading">
					<span class="blocks">▪▪▪</span> INFORMATIONS SUR LE CONTACT <span class="blocks">▪▪▪</span>
				</div>
				<div class="note-box">
					<p class="note-text">{noteText || '—'}</p>
				</div>

				{#if qualifLines.length > 0}
					<div class="section-heading qualif-heading">
						<span class="blocks">▪▪▪</span> QUESTIONS DÉCOUVERTE <span class="blocks">▪▪▪</span>
					</div>
					<div class="qualif-box">
						{#each qualifLines as line}
							<div class="qualif-line"><b>{line.label} :</b> <span>{line.value}</span></div>
						{/each}
					</div>
				{/if}
			</aside>
		</div>
	</div>
</div>

<style>
	.contact-print-sheet {
		display: none;
	}
	@media print {
		@page {
			size: A4 landscape;
			margin: 0;
		}
		:global(body) {
			margin: 0 !important;
			background: white !important;
		}
		:global(body *) {
			visibility: hidden !important;
		}
		.contact-print-sheet,
		.contact-print-sheet * {
			visibility: visible !important;
		}
		.contact-print-sheet {
			display: block;
			position: absolute;
			inset: 0;
			width: 297mm;
			height: 210mm;
			background: white;
			color: #222;
			font-family: Arial, Helvetica, sans-serif;
			/* Les bandeaux gris (FICHE DE CONTACT, BRAVAUX ISO / BRAVAUX RENO)
			   doivent être imprimés même quand le navigateur n'imprime pas les
			   fonds par défaut : sans eux, leur texte blanc est invisible. */
			-webkit-print-color-adjust: exact;
			print-color-adjust: exact;
		}
		.print-page {
			box-sizing: border-box;
			width: 297mm;
			height: 210mm;
			padding: 8mm 10mm 6mm;
			overflow: hidden;
		}
		/* La fiche papier occupe la colonne gauche avec ses deux blocs supérieurs alignés. */
		.sheet-grid {
			display: grid;
			grid-template-columns: 1fr 1fr;
			gap: 8mm;
			height: 100%;
			min-height: 0;
		}
			.fiche-col,
			.note-col {
				min-width: 0;
				min-height: 0;
			}
			.fiche-col {
				overflow: hidden;
			}
			.top-grid {
			display: grid;
			grid-template-columns: 1fr 1fr;
			align-items: start;
			column-gap: 4mm;
			min-width: 0;
		}
		.top-grid > section {
			width: 100%;
			min-width: 0;
		}
		.identity-block,
		.coordinates-block {
			display: block;
			min-width: 0;
		}
		.identity-block .brand-row,
		.identity-block .title-band {
			width: 100%;
		}
		.coordinates-block .line-row b,
		.coordinates-block .line-row b:empty {
			min-width: 13mm;
		}			.project-card {
				margin-bottom: 4mm;
				border: 1px solid #222;
				border-radius: 1.5mm;
				background: #f1f1f1;
				padding: 2.5mm 3mm;
				text-align: center;
			}
			.project-label {
				font-size: 8pt;
				font-weight: 700;
				letter-spacing: 0.8px;
				color: #555;
			}
			.project-value {
				margin-top: 1mm;
				font-size: 16pt;
				font-weight: 900;
				letter-spacing: 0.3px;
				line-height: 1.15;
				color: #111;
				text-transform: uppercase;
				overflow-wrap: anywhere;
			}
			.note-col {

			display: flex;
			flex-direction: column;
		}			.brand-row {
				display: flex;
				align-items: center;
				height: 24mm;
			}
			.brand-logo {
				display: block;
				width: 100%;
				height: auto;
				max-height: 22mm;
				object-fit: contain;
				object-position: left center;
			}

			.title-band,
			.study-band {
				-webkit-print-color-adjust: exact;
				print-color-adjust: exact;
				background: #777;
				color: white;
				text-align: center;
				font-size: 10pt;
				font-weight: 700;
				letter-spacing: 0.5px;
				padding: 1.2mm 2mm;
			}

		.section-heading {
			display: flex;
			align-items: center;
			justify-content: space-between;
			font-size: 8.5pt;
			font-weight: 700;
			letter-spacing: 0.2px;
			white-space: nowrap;
			margin-bottom: 1.2mm;
		}
		.blocks {
			color: #777;
			letter-spacing: 1px;
			font-size: 8pt;
		}
		.line-row {
			display: flex;
			align-items: baseline;
			min-height: 5.2mm;
			font-size: 7.5pt;
			gap: 1.2mm;
		}
		.line-row b {
			flex: none;
			font-weight: 700;
			white-space: nowrap;
		}			.line-row .value {
				white-space: nowrap;
				overflow: hidden;
				text-overflow: ellipsis;
				max-width: 42mm;
			}
			/* Ligne C.P. / Ville : comme les autres lignes (pointillés sur la
			   ligne de base), mais sans limite de largeur sur les valeurs. */
			.cp-row {
				display: flex;
				flex-wrap: nowrap;
			}
			.cp-row .value {
				max-width: none;
				overflow: visible;
				text-overflow: clip;
				white-space: nowrap;
				flex: none;
			}
			.cp-row .city-label {
				margin-left: 3mm;
			}

		.dotted {
			flex: 1;
			min-width: 3mm;
			border-bottom: 1px dotted #777;
			height: 2.8mm;
		}
		.city-label {
			margin-left: 2mm;
		}
		.check-row {
			display: flex;
			align-items: baseline;
			flex-wrap: wrap;
			gap: 3mm;
			min-height: 5mm;
			font-size: 7.5pt;
			font-weight: 700;
		}
		.check-row.two {
			justify-content: space-between;
			gap: 1.5mm;
		}
		/* Ligne Nom : un peu d'air sous la ligne de civilité. */
		.name-row {
			margin-top: 2.5mm;
		}
		/* Échéances du projet : décalées pour aérer la préqualification. */
		.deadline-row {
			margin-top: 1.5mm;
			margin-bottom: 1.5mm;
		}			.check-row strong {
				font-weight: 400;
			}
			.cbox {
				display: inline-block;
				position: relative;
				box-sizing: border-box;
				width: 3.6mm;
				height: 3.6mm;
				border: 0.45mm solid #111;
				margin-right: 1mm;
				vertical-align: -0.9mm;
			}
			/* La croix dépasse volontairement de la case, comme cochée à la main. */
			.cross {
				position: absolute;
				left: 50%;
				top: 50%;
				transform: translate(-50%, -50%);
				font-size: 15pt;
				font-weight: 900;
				line-height: 1;
				color: #000;
			}
			.thin {
				font-weight: 400;
			}
		.item-line i {
			display: inline-block;
			min-width: 6mm;
			border-bottom: 1px dotted #777;
			height: 2.8mm;
		}
		/* Champ M² : plus court, comme sur la fiche de l'app. */
		.item-line i.m2 {
			min-width: 4mm;
		}
		.item-line.centered i {
			min-width: 12mm;
		}
		.middle-grid {
			display: grid;
			grid-template-columns: 1fr 1fr;
			gap: 4mm;
			border-top: 1px solid #aaa;
			padding-top: 1.5mm;
			margin-top: 1.5mm;
			min-height: 34mm;
		}
		.block {
			min-width: 0;
		}
		.study-title {
			display: flex;
			justify-content: space-between;
			align-items: center;
			border-top: 1px solid #777;
			padding-top: 1mm;
			margin-top: 1.5mm;
			font-size: 8.5pt;
			font-weight: 700;
		}
		.study-band {
			margin-top: 1mm;
			font-size: 8.5pt;
			padding: 0.8mm;
		}
		.study-grid {
			display: grid;
			grid-template-columns: 1fr 1fr;
			gap: 4mm;
			padding-top: 1.5mm;
		}
		.subheading {
			text-align: left;
			font-size: 7.5pt;
			font-weight: 700;
			margin: 0;
			padding: 0.8mm 0;
		}
		/* Lignes d'articles : mêmes métriques que la fiche de l'app
		   (libellés sur 20 mm, lignes d'une seule ligne, champs courts). */
		.item-line {
			display: flex;
			flex-wrap: nowrap;
			align-items: flex-end;
			gap: 1mm;
			padding: 0.3mm 0;
			font-size: 6.5pt;
			font-weight: 700;
			line-height: 1;
			white-space: nowrap;
		}
		.item-line > span,
		.item-line > b {
			flex: none;
			white-space: nowrap;
		}
		.item-line > span:first-child {
			min-width: 20mm;
		}
		.item-line.centered {
			justify-content: center;
			gap: 3mm;
		}
		.item-line.centered > span:first-child {
			min-width: 14mm;
			text-align: right;
		}
		.item-line b {
			font-weight: 700;
		}
		/* Colonne droite : la note du contact */
		.note-box {
			flex: 1;
			min-height: 0;
			border: 1px solid #bbb;
			border-radius: 1.5mm;
			padding: 2.5mm 3mm;
			overflow: hidden;
		}
		.note-text {
			margin: 0;
			font-size: 9pt;
			line-height: 1.4;
			white-space: pre-wrap;
			overflow-wrap: break-word;
		}
		.qualif-heading {
			margin-top: 3mm;
		}
		.qualif-box {
			border: 1px dotted #999;
			border-radius: 1.5mm;
			padding: 2mm 3mm;
			overflow: hidden;
		}
		.qualif-line {
			font-size: 8pt;
			line-height: 1.5;
			border-bottom: 1px dotted #ddd;
			padding-bottom: 0.6mm;
			font-weight: 400;
		}
		/* Seul l'intitulé de la question est en gras, la réponse reste normale. */
		.qualif-line b {
			font-weight: 700;
		}
		.qualif-line:last-child {
			border-bottom: none;
		}
	}
</style>
