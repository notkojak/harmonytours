export type StatsPeriodValue = 'mois' | 'semaine' | 'jour';

// Période et date sélectionnées pour les statistiques du tableau de bord.
export const statsPeriod = $state({
	period: 'mois' as StatsPeriodValue,
	date: new Date().toISOString().slice(0, 10)
});
