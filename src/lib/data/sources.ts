export const contactSources = ['TAP', 'GMS', 'PHONE'] as const;

export type ContactSource = (typeof contactSources)[number];

const sourceColors: Record<ContactSource, string> = {
	TAP: 'bg-blue-500/15 text-blue-400',
	GMS: 'bg-violet-500/15 text-violet-400',
	PHONE: 'bg-emerald-500/15 text-emerald-400'
};

export function sourceClass(source: string | null | undefined): string {
	if (!source) return 'bg-glass-3 text-foreground';
	return sourceColors[source as ContactSource] ?? 'bg-glass-3 text-foreground';
}
