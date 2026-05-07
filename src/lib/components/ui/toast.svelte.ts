/**
 * Toast notifications globais (Svelte 5 rune store).
 * Usa $state em módulo — instância única compartilhada.
 *
 * Uso:
 *   import { toast } from '$lib/components/ui/toast.svelte';
 *   toast.success('Aluno cadastrado.');
 *   toast.error('Falha ao salvar.');
 *   toast.info('5 violações detectadas.');
 */

export type ToastVariant = 'success' | 'error' | 'info' | 'warn';
export type Toast = {
	id: string;
	variant: ToastVariant;
	message: string;
	createdAt: number;
};

class ToastStore {
	items = $state<Toast[]>([]);

	push(variant: ToastVariant, message: string, durationMs = 4500) {
		const t: Toast = {
			id: crypto.randomUUID(),
			variant,
			message,
			createdAt: Date.now()
		};
		this.items.push(t);
		setTimeout(() => this.dismiss(t.id), durationMs);
	}

	dismiss(id: string) {
		this.items = this.items.filter((t) => t.id !== id);
	}

	success(msg: string) {
		this.push('success', msg);
	}
	error(msg: string) {
		this.push('error', msg, 7000);
	}
	info(msg: string) {
		this.push('info', msg);
	}
	warn(msg: string) {
		this.push('warn', msg, 6000);
	}
}

export const toast = new ToastStore();
