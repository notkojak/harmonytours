export const contactSources = ['TAP', 'GMS', 'PHONE'] as const;

export type ContactSource = (typeof contactSources)[number];

const sourceColors: Record<ContactSource, string> = {
	TAP: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
	GMS: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
	PHONE: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
};

export function sourceClass(source: string | null | undefined): string {
	if (!source) return 'bg-glass-3 text-foreground';
	return sourceColors[source as ContactSource] ?? 'bg-glass-3 text-foreground';
}
