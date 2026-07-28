/**
 * Form submit configuration (from backend form schema).
 */
export interface SubmitConfig {
  mode?: "redirect" | "popup" | "toast";
  redirectUrl?: string;
  popupTitle?: string;
  popupContent?: string;
  toastMessage?: string;
}

export interface LeadSubmitPayload {
  formId: string;
  contact: Record<string, unknown>;
  pageId?: string;
  channelId?: string;
  utm?: Record<string, string>;
  captchaToken?: string;
}

export interface LeadSubmitResult {
  leadId: string;
  status: string;
  dedup: boolean;
}

export interface UseLeadSubmitOptions {
  /** BFF base URL (default from runtimeConfig) */
  bffBase?: string;
  /** Form submit config for success UI handling */
  submitConfig?: SubmitConfig;
  /** Called on successful submission */
  onSuccess?: (result: LeadSubmitResult) => void;
  /** Called on error */
  onError?: (error: Error) => void;
}

/**
 * Composable for submitting lead capture forms.
 * Posts visitor contact data to the BFF public submit endpoint.
 */
export function useLeadSubmit(options: UseLeadSubmitOptions = {}) {
  const config = useRuntimeConfig().public;
  const bffBase =
    options.bffBase ??
    ((config.bffBaseUrl as string)?.replace(/\/$/, "") ?? "");

  const submitting = ref(false);
  const success = ref(false);
  const result = ref<LeadSubmitResult | null>(null);
  const error = ref<string | null>(null);

  /** Submit lead form data */
  async function submit(formId: string, contact: Record<string, unknown>, extra?: {
    pageId?: string;
    channelId?: string;
    utm?: Record<string, string>;
  }) {
    submitting.value = true;
    success.value = false;
    error.value = null;
    result.value = null;

    try {
      const payload: LeadSubmitPayload = {
        formId,
        contact,
        ...extra,
      };

      const res = await fetch(
        `${bffBase}/api/forms/${encodeURIComponent(formId)}/submit`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const msg = body?.message || body?.code || `HTTP ${res.status}`;
        throw new Error(msg);
      }

      const data: LeadSubmitResult = await res.json();
      result.value = data;
      success.value = true;
      submitting.value = false;
      options.onSuccess?.(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Submission failed";
      error.value = msg;
      options.onError?.(e instanceof Error ? e : new Error(msg));
    } finally {
      submitting.value = false;
    }
  }

  /** Reset state (e.g. after dismissing popup) */
  function reset() {
    submitting.value = false;
    success.value = false;
    error.value = null;
    result.value = null;
  }

  return {
    submitting: readonly(submitting),
    success: readonly(success),
    result: readonly(result),
    error: readonly(error),
    submit,
    reset,
  };
}
