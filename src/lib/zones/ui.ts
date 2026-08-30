import { writable } from 'svelte/store';

export const drawing = writable(false);
export const selectedZoneId = writable<string | null>(null);
export const editing = writable(false);
