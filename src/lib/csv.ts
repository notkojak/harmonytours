// Export CSV : séparateur « ; » et BOM UTF-8 pour qu'Excel FR ouvre
// correctement les accents et les colonnes.
export type CsvCell = string | number | boolean | null | undefined;

function cellule(value: CsvCell): string {
	if (value === null || value === undefined) return '';
	const text = String(value).replace(/"/g, '""');
	// Les retours ligne dans une cellule casseraient le fichier : on les aplatit.
	return `"${text.replace(/\r?\n/g, ' ')}"`;
}

export function toCsv(rows: CsvCell[][]): string {
	return rows.map((row) => row.map(cellule).join(';')).join('\r\n');
}

export function downloadCsv(filename: string, rows: CsvCell[][]): void {
	const blob = new Blob(['\ufeff' + toCsv(rows)], { type: 'text/csv;charset=utf-8' });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = filename;
	document.body.appendChild(link);
	link.click();
	link.remove();
	URL.revokeObjectURL(url);
}

/** Nom de fichier daté : harmony-clients-2026-10-30.csv */
export function datedName(prefix: string): string {
	const d = new Date();
	const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
		d.getDate()
	).padStart(2, '0')}`;
	return `${prefix}-${iso}.csv`;
}
