<script lang="ts">
	import { portal } from '$lib/actions/portal';
	import { printPage } from '$lib/actions/print-page';
	import { foyerLabel, stripQualificationBlock, type QualifAnswers } from '$lib/data/qualification';

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
		isClient?: boolean | null;
		_creationTime?: number;
		dateContact?: number | null;
		followUp?: {
			type: 'rappel' | 'rdv';
			date: string;
			time?: string | null;
			status?: string | null;
			motif?: string | null;
		} | null;
	};

	// Une fiche = un contact + ses réponses de qualification. Deux fiches
	// remplissent une A4 paysage (chacune sur une moitié A5 portrait).
	let {
		contact,
		answers,
		second = null,
		secondAnswers = null
	}: {
		contact: PrintContact;
		answers: QualifAnswers | null;
		second?: PrintContact | null;
		secondAnswers?: QualifAnswers | null;
	} = $props();

	function nameParts(name: string | null | undefined) {
		const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
		return {
			last: parts[0] ?? '',
			first: parts.length > 1 ? parts.slice(1).join(' ') : ''
		};
	}

	// Une seule lettre dans le rond bleu : la première du nom.
	function initialOf(name: string | null | undefined) {
		return (name ?? '').trim().charAt(0).toUpperCase() || '?';
	}

	function addressOf(address: string | null | undefined) {
		return (address ?? '')
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean)
			.join(' · ');
	}

	function dateOf(c: PrintContact) {
		const d = c.dateContact ?? c._creationTime ?? Date.now();
		return new Date(d).toLocaleDateString('fr-FR');
	}

	function followUpOf(c: PrintContact) {
		const isRappel = c.followUp?.type !== 'rdv';
		const date = c.followUp?.date
			? new Date(`${c.followUp.date}T12:00:00`).toLocaleDateString('fr-FR', {
					weekday: 'long',
					day: 'numeric',
					month: 'long'
				})
			: '';
		return { isRappel, date, time: c.followUp?.time ?? '', status: c.followUp?.status ?? '' };
	}

	function civilitesOf(c: PrintContact) {
		if (Array.isArray(c.civilites) && c.civilites.length > 0) return c.civilites;
		if (c.civilite) return [c.civilite];
		return [] as string[];
	}

	function noteOf(c: PrintContact) {
		return stripQualificationBlock(c.note ?? '').trim();
	}

	// Une puce par information collectée, avec les emojis de la note du contact.
	// Toutes les lignes sont toujours imprimées : une réponse absente s'affiche
	// « — », pour que la fiche reste un formulaire complet même incomplet.
	// Le chauffage a sa propre carte mise en avant : il n'est pas répété ici.
	type Ligne = { emoji: string; label: string; value: string };
	function lignesOf(a: QualifAnswers | null): Ligne[] {
		const valeur = (v: string | null | undefined) => (v && v.trim() ? v.trim() : '—');
		const achat = (() => {
			if (!a?.achat) return '—';
			const detail =
				(a.achat === 'Rénovation' || a.achat === 'Autre…') && a.achatDetail.trim()
					? ` (${a.achatDetail.trim()})`
					: '';
			return `${a.achat}${detail}`;
		})();
		return [
			{ emoji: '🛒', label: 'Dernier achat', value: achat },
			{ emoji: '💼', label: 'Métier M.', value: valeur(a?.metierM) },
			{ emoji: '💼', label: 'Métier Mme', value: valeur(a?.metierMme) },
			{
				emoji: '🧾',
				label: 'Imposable',
				value: a?.imposable === 'oui' ? 'Oui' : a?.imposable === 'non' ? 'Non' : '—'
			},
			{
				emoji: '🎯',
				label: 'Le produit',
				value:
					a?.connait === 'oui' ? 'Connu / concurrence vue' : a?.connait === 'non' ? 'Inconnu' : '—'
			},
			{ emoji: '💶', label: 'Concurrence', value: valeur(a?.concurrence) },
			{ emoji: '🧲', label: 'SONCAS', value: a?.soncas?.length ? a.soncas.join(', ') : '—' }
		];
	}

	function foyerResumeOf(a: QualifAnswers | null) {
		if (!a) return '';
		const morceaux: string[] = [];
		if (a.foyer) morceaux.push(foyerLabel(a.foyer));
		if (a.habite) morceaux.push(`ici depuis ${a.habite}`);
		return morceaux.join(' · ');
	}
</script>

{#snippet fiche(c: PrintContact, a: QualifAnswers | null)}
	{@const p = nameParts(c.name)}
	{@const suivi = followUpOf(c)}
	{@const lignes = lignesOf(a)}
	{@const foyer = foyerResumeOf(a)}
	{@const adresse = addressOf(c.address)}
	{@const date = dateOf(c)}
	{@const civilites = civilitesOf(c)}
	{@const note = noteOf(c)}

	<article class="cp-page">
		<!-- En-tête de marque -->
		<header class="cp-header">
			<img
				class="cp-logo"
				src="/bravaux-logo-print.png"
				alt="Bravaux"
				decoding="sync"
				loading="eager"
			/>
			<div class="cp-header-right">
				<p class="cp-title">Fiche contact</p>
				<p class="cp-meta">Contact du <b>{date}</b></p>
				{#if c.source}
					<p class="cp-meta">Source <b>{c.source}</b></p>
				{/if}
				{#if c.createdByName}
					<p class="cp-meta">Technicien <b>{c.createdByName}</b></p>
				{/if}
			</div>
		</header>

		<div class="cp-body">
			<!-- Colonne de gauche : identité, projet, infos, qualification -->
			<div class="cp-left">
				<section class="cp-identity">
					<div class="cp-avatar" aria-hidden="true">{initialOf(c.name)}</div>
					<div class="cp-identity-text">
						<p class="cp-civ">
							{civilites.length > 0 ? civilites.join(' / ') : 'Contact'}
							{#if a?.age}<span class="cp-age">· 🎂 {a.age}</span>{/if}
						</p>
						<h1 class="cp-name">
							{p.first}
							<span class="cp-name-last">{p.last}</span>
						</h1>
					</div>
					{#if c.isClient}
						<span class="cp-badge">★ Client</span>
					{/if}
				</section>

				<section class="cp-project">
					<p class="cp-project-label">🎯 Projet</p>
					<p class="cp-project-value">{c.projet?.trim() || 'Non renseigné'}</p>
				</section>

				<div class="cp-cards">
					<!-- Ordre terrain : le rendez-vous d'abord, le téléphone à côté,
					     puis l'adresse, la réalisation et le foyer. -->
					<section class="cp-card">
						<p class="cp-card-label">{suivi.isRappel ? '📅 Rappel prévu' : '📅 Rendez-vous'}</p>
						{#if suivi.date}
							<p class="cp-card-value">
								{suivi.date}{suivi.time ? ` · ${suivi.time}` : ''}
							</p>
							{#if suivi.status}
								<p class="cp-card-sub">{suivi.status}</p>
							{/if}
						{:else}
							<p class="cp-card-value cp-empty">Aucun suivi</p>
						{/if}
					</section>

					<section class="cp-card">
						<p class="cp-card-label">📞 Téléphone</p>
						<p class="cp-card-value" class:cp-empty={!c.phone}>{c.phone || 'Non renseigné'}</p>
					</section>

					<section class="cp-card cp-card-wide">
						<p class="cp-card-label">📍 Adresse</p>
						<p class="cp-card-value" class:cp-empty={!adresse}>
							{adresse || 'Non renseignée'}
						</p>
					</section>

					<section class="cp-card">
						<p class="cp-card-label">🗓️ Réalisation</p>
						<p class="cp-card-value" class:cp-empty={!a?.pourQuand}>
							{a?.pourQuand || 'Non renseigné'}
						</p>
					</section>

					<section class="cp-card">
						<p class="cp-card-label">👥 Foyer</p>
						{#if foyer}
							<p class="cp-card-value">{foyer}</p>
							{#if a?.plait}
								<p class="cp-card-sub">
									{a.plait === 'oui' ? '😊 Se plaisent chez eux' : "😕 N'aiment pas leur logement"}
								</p>
							{/if}
						{:else}
							<p class="cp-card-value cp-empty">Non renseigné</p>
						{/if}
					</section>

					<!-- Chauffage : mis en avant (système + coût) -->
					<section class="cp-card cp-card-wide cp-heat">
						<p class="cp-card-label">🔥 Chauffage actuel</p>
						{#if a?.chauffage}
							<div class="cp-heat-line">
								<span class="cp-heat-system">{a.chauffage}</span>
								{#if a.chauffageCout.trim()}
									<span class="cp-heat-cost">{a.chauffageCout.trim()} €/mois</span>
								{/if}
							</div>
						{:else}
							<span class="cp-card-value cp-empty">Non renseigné</span>
						{/if}
					</section>

					<!-- Réponses à cocher sur le terrain (non stockées en base) -->
					<section class="cp-card cp-card-wide cp-presentation">
						<p class="cp-card-label">🗣️ Présentation</p>
						<div class="cp-check-row">
							<span class="cp-check-label">Couple présent</span>
							<span class="cp-check"><span class="cp-box"></span> Oui</span>
							<span class="cp-check"><span class="cp-box"></span> Non</span>
						</div>
						<div class="cp-check-row">
							<span class="cp-check-label">1 h à consacrer</span>
							<span class="cp-check"><span class="cp-box"></span> Oui</span>
							<span class="cp-check"><span class="cp-box"></span> Non</span>
						</div>
					</section>
				</div>

				<!-- Qualification : remplit tout le bas de la colonne -->
				<section class="cp-qualif-section">
					<p class="cp-section-title">🧠 Qualification</p>
					<div class="cp-qualif">
						{#each lignes as ligne (ligne.label)}
							<div class="cp-qualif-row">
								<span class="cp-emoji" aria-hidden="true">{ligne.emoji}</span>
								<span class="cp-qualif-label">{ligne.label}</span>
								<span class="cp-qualif-value" class:cp-empty-value={ligne.value === '—'}>
									{ligne.value}
								</span>
							</div>
						{/each}
					</div>
				</section>
			</div>

			<!-- Colonne de droite : informations libres, sur toute la hauteur -->
			<aside class="cp-right">
				<p class="cp-side-title">📝 Informations sur le contact</p>
				<div class="cp-note-box">
					<p class="cp-note-text">{note || '—'}</p>
				</div>
			</aside>
		</div>

		<footer class="cp-footer">
			<span>Bravaux · fiche de contact interne</span>
			<span>{date}</span>
		</footer>
	</article>
{/snippet}

<div
	class="cp-sheet"
	class:cp-two={!!second}
	use:portal
	use:printPage={'landscape'}
	aria-hidden="true"
>
	{@render fiche(contact, answers)}
	{#if second}
		{@render fiche(second, secondAnswers)}
	{/if}
</div>

<style>
	/* La feuille n'existe pas à l'écran : elle n'apparaît qu'à l'impression. */
	.cp-sheet {
		display: none;
	}

	@media print {
		/* La page imprimée fait exactement une A4 paysage, sans marge. */
		:global(html),
		:global(body) {
			margin: 0 !important;
			padding: 0 !important;
			width: 297mm !important;
			height: 210mm !important;
			overflow: hidden !important;
			background: white !important;
		}

		:global(body *) {
			visibility: hidden !important;
		}

		.cp-sheet,
		.cp-sheet * {
			visibility: visible !important;
		}

		/* Deux fiches A5 portrait côte à côte = une A4 paysage. La feuille est
		   portée sous <body> (action `portal`) : elle repart du coin supérieur
		   gauche de la page, quel que soit l'écran d'où l'impression part. */
		.cp-sheet {
			display: flex;
			position: absolute;
			top: 0;
			left: 0;
			box-sizing: border-box;
			width: 297mm;
			height: 210mm;
			background: #ffffff;
			color: #0b0b0c;
			font-family: Arial, Helvetica, sans-serif;
			-webkit-print-color-adjust: exact;
			print-color-adjust: exact;
		}

		/* Trait de découpe entre les deux fiches */
		.cp-two::after {
			content: '';
			position: absolute;
			top: 0;
			bottom: 0;
			left: 50%;
			border-left: 0.2mm dashed #d2d2d8;
		}

		/* Chaque fiche prend la moitié de la largeur et toute la hauteur. */
		.cp-page {
			box-sizing: border-box;
			display: flex;
			flex: 0 0 50%;
			flex-direction: column;
			gap: 2.4mm;
			width: 50%;
			height: 100%;
			padding: 8mm 8mm 5.5mm;
			overflow: hidden;
		}

		/* ---------- En-tête ---------- */
		.cp-header {
			display: flex;
			align-items: flex-start;
			justify-content: space-between;
			gap: 4mm;
			padding-bottom: 2mm;
			border-bottom: 0.7mm solid #24a2b3;
		}

		.cp-logo {
			display: block;
			width: 36mm;
			height: 12.5mm;
			object-fit: contain;
			object-position: left center;
		}

		.cp-header-right {
			text-align: right;
			line-height: 1.3;
		}

		.cp-title {
			margin: 0 0 0.6mm;
			font-size: 11pt;
			font-weight: 900;
			letter-spacing: 0.9px;
			text-transform: uppercase;
			color: #0d0d0f;
		}

		.cp-meta {
			margin: 0;
			font-size: 6.6pt;
			color: #5f5f66;
		}

		.cp-meta b {
			color: #0b0b0c;
			font-weight: 700;
		}

		/* ---------- Corps : infos à gauche, notes à droite ---------- */
		.cp-body {
			display: grid;
			grid-template-columns: 1.15fr 1fr;
			gap: 3.4mm;
			flex: 1;
			min-height: 0;
		}

		.cp-left {
			display: flex;
			flex-direction: column;
			gap: 2mm;
			min-width: 0;
			min-height: 0;
		}

		.cp-right {
			display: flex;
			flex-direction: column;
			min-width: 0;
			min-height: 0;
		}

		.cp-side-title {
			margin: 0 0 1mm;
			font-size: 7.4pt;
			font-weight: 900;
			letter-spacing: 0.4px;
			text-transform: uppercase;
			color: #24a2b3;
		}

		.cp-note-box {
			flex: 1;
			min-height: 0;
			padding: 2.4mm 2.6mm;
			border: 0.25mm solid #dededf;
			border-radius: 1.6mm;
			background: #fcfcfd;
			overflow: hidden;
		}

		.cp-note-text {
			margin: 0;
			font-size: 7.6pt;
			line-height: 1.4;
			color: #0b0b0c;
			white-space: pre-wrap;
			overflow-wrap: anywhere;
		}

		/* ---------- Identité ---------- */
		.cp-identity {
			display: flex;
			align-items: center;
			gap: 2.6mm;
			padding: 2.6mm 2.8mm;
			border-left: 1.1mm solid #24a2b3;
			border-radius: 1.6mm;
			background: #f4f9fa;
		}

		.cp-avatar {
			display: grid;
			place-items: center;
			flex: none;
			width: 9.5mm;
			height: 9.5mm;
			border-radius: 50%;
			background: #24a2b3;
			color: #ffffff;
			font-size: 12pt;
			font-weight: 900;
			line-height: 1;
			text-align: center;
			letter-spacing: 0;
		}

		.cp-identity-text {
			min-width: 0;
			flex: 1;
		}

		.cp-civ {
			margin: 0;
			font-size: 6.4pt;
			font-weight: 700;
			letter-spacing: 0.5px;
			text-transform: uppercase;
			color: #5f5f66;
		}

		.cp-age {
			font-weight: 400;
			letter-spacing: 0;
			text-transform: none;
		}

		.cp-name {
			margin: 0.4mm 0 0;
			font-size: 13.5pt;
			font-weight: 400;
			line-height: 1.05;
			letter-spacing: -0.2px;
			color: #0b0b0c;
		}

		.cp-name-last {
			font-weight: 900;
			text-transform: uppercase;
		}

		.cp-badge {
			flex: none;
			align-self: flex-start;
			padding: 0.7mm 1.6mm;
			border-radius: 999px;
			background: #24a2b3;
			color: #ffffff;
			font-size: 6.4pt;
			font-weight: 800;
		}

		/* ---------- Projet ---------- */
		.cp-project {
			padding: 2.2mm 2.8mm;
			border: 0.35mm solid #24a2b3;
			border-radius: 1.6mm;
		}

		.cp-project-label {
			margin: 0;
			font-size: 6.5pt;
			font-weight: 800;
			letter-spacing: 0.7px;
			text-transform: uppercase;
			color: #24a2b3;
		}

		.cp-project-value {
			margin: 0.7mm 0 0;
			font-size: 12.5pt;
			font-weight: 900;
			line-height: 1.05;
			letter-spacing: -0.2px;
			text-transform: uppercase;
			color: #0b0b0c;
			overflow-wrap: anywhere;
		}

		/* ---------- Cartes d'informations ---------- */
		.cp-cards {
			display: grid;
			grid-template-columns: 1fr 1fr;
			gap: 1.8mm;
		}

		.cp-card {
			padding: 1.9mm 2.3mm;
			border-radius: 1.6mm;
			background: #f4f4f5;
		}

		.cp-card-wide {
			grid-column: 1 / -1;
		}

		.cp-card-label {
			margin: 0;
			font-size: 6.7pt;
			font-weight: 800;
			letter-spacing: 0.5px;
			text-transform: uppercase;
			color: #5f5f66;
		}

		.cp-card-value {
			margin: 0.7mm 0 0;
			font-size: 8.9pt;
			font-weight: 700;
			line-height: 1.2;
			color: #0b0b0c;
			overflow-wrap: anywhere;
		}

		.cp-card-sub {
			margin: 0.5mm 0 0;
			font-size: 6.9pt;
			line-height: 1.25;
			color: #5f5f66;
		}

		.cp-empty {
			font-weight: 400;
			color: #94949b;
		}

		/* ---------- Chauffage : carte mise en avant ---------- */
		.cp-heat {
			padding: 2.2mm 2.6mm;
			background: #e6f4f6;
			border-left: 1.4mm solid #24a2b3;
		}

		.cp-heat .cp-card-label {
			color: #1b7f8d;
		}

		.cp-heat-line {
			display: flex;
			align-items: baseline;
			justify-content: space-between;
			gap: 2mm;
			margin-top: 0.8mm;
		}

		.cp-heat-system {
			font-size: 11.5pt;
			font-weight: 900;
			line-height: 1.1;
			text-transform: uppercase;
			color: #0b0b0c;
			overflow-wrap: anywhere;
		}

		.cp-heat-cost {
			flex: none;
			font-size: 11.5pt;
			font-weight: 900;
			line-height: 1.1;
			white-space: nowrap;
			color: #24a2b3;
		}

		/* ---------- Présentation : cases à cocher ---------- */
		.cp-presentation {
			padding-bottom: 2.1mm;
		}

		.cp-check-row {
			display: flex;
			align-items: center;
			gap: 1.2mm 2.2mm;
			margin-top: 1mm;
			font-size: 7.3pt;
			line-height: 1.2;
			color: #0b0b0c;
		}

		.cp-check-label {
			font-weight: 700;
			min-width: 20mm;
		}

		.cp-check {
			display: inline-flex;
			align-items: center;
			gap: 0.9mm;
			color: #3c3c42;
		}

		.cp-box {
			display: inline-block;
			box-sizing: border-box;
			width: 2.7mm;
			height: 2.7mm;
			border: 0.3mm solid #0b0b0c;
			border-radius: 0.4mm;
		}

		/* ---------- Qualification : remplit le bas de la colonne ---------- */
		.cp-qualif-section {
			flex: 1;
			display: flex;
			flex-direction: column;
			min-height: 0;
		}

		.cp-section-title {
			margin: 0 0 1mm;
			font-size: 7.4pt;
			font-weight: 900;
			letter-spacing: 0.6px;
			text-transform: uppercase;
			color: #24a2b3;
		}

		.cp-qualif {
			flex: 1;
			min-height: 0;
			display: grid;
			grid-template-columns: 1fr;
			/* Les lignes se partagent toute la hauteur restante : la moitié de
			   feuille est ainsi entièrement remplie, prête à être découpée. */
			grid-auto-rows: 1fr;
			border-top: 0.25mm solid #e6e6e6;
		}

		.cp-qualif-row {
			display: flex;
			align-items: center;
			gap: 1.2mm;
			padding: 0 0.6mm;
			border-bottom: 0.2mm dotted #d6d6da;
			font-size: 7.3pt;
			line-height: 1.25;
		}

		.cp-empty-value {
			color: #a0a0a8;
			font-weight: 400;
		}

		.cp-emoji {
			flex: none;
			width: 3.2mm;
			font-family: 'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', Arial, sans-serif;
		}

		.cp-qualif-label {
			flex: none;
			font-weight: 700;
			color: #0b0b0c;
		}

		.cp-qualif-value {
			min-width: 0;
			color: #3c3c42;
			overflow-wrap: anywhere;
		}

		/* ---------- Pied de page ---------- */
		.cp-footer {
			display: flex;
			justify-content: space-between;
			padding-top: 1.4mm;
			border-top: 0.2mm solid #e6e6e6;
			font-size: 6pt;
			letter-spacing: 0.3px;
			text-transform: uppercase;
			color: #94949b;
		}
	}
</style>
