import { toast } from "@/components/ui/use-toast";

type Translator = (key: string, fallback?: string) => string;

const API_ERROR_PATTERNS = [
  /API[_ ]?[Kk]ey/i,
  /INVALID_ARGUMENT/,
  /UNAUTHENTICATED/,
  /PERMISSION_DENIED/,
  /quota/i,
  /rate.?limit/i,
  /invalid_api_key/i,
  /API_KEY_INVALID/,
];

export function sanitizeErrorForUser(rawError: string): string {
  if (!rawError) return "";
  for (const pattern of API_ERROR_PATTERNS) {
    if (pattern.test(rawError)) {
      return "智能体 API 配置异常，请检查 API Key 是否正确配置。";
    }
  }
  if (rawError.includes("未配置") || rawError.includes("未找到")) {
    return "智能体 API 配置异常，请检查 API Key 是否正确配置。";
  }
  return rawError;
}

export function showMonitorAnalysisErrorToast(errorDetail: string, t: Translator) {
  const isKeyError =
    errorDetail.includes("API Key") ||
    errorDetail.includes("未配置") ||
    errorDetail.includes("未找到");

  toast.error(
    isKeyError ? t("monitors.apiKeyMissingTitle") : t("monitors.videoAnalysisFailedTitle"),
    isKeyError
      ? t("monitors.apiKeyMissingDesc")
      : sanitizeErrorForUser(errorDetail) || t("monitors.videoAnalysisFailedDesc"),
  );
}

export function showMonitorSkippedToast(reason: string, t: Translator) {
  toast.error(t("monitors.videoSkippedTitle"), reason || t("monitors.videoSkippedDesc"));
}

function getImageGenerationFailureDesc(elapsedSeconds: number, errorCode: string | undefined, t: Translator) {
  if (errorCode === "IMAGE_API_KEY_MISSING") {
    return t("editor.imageGenerationApiKeyMissingDesc");
  }
  if (errorCode === "IMAGE_API_AUTH_FAILED") {
    return t("editor.imageGenerationAuthFailedDesc");
  }
  if (errorCode === "IMAGE_API_RATE_LIMITED") {
    return t("editor.imageGenerationRateLimitedDesc");
  }
  if (errorCode === "IMAGE_PROVIDER_NO_IMAGE" || errorCode === "IMAGE_PROVIDER_UNAVAILABLE") {
    return t("editor.imageGenerationProviderFailedDesc");
  }
  return t("editor.imageGenerationFailedDesc").replace("{seconds}", String(elapsedSeconds));
}

export function showEditorImageGenerationErrorToast(elapsedSeconds: number, t: Translator, errorCode?: string) {
  toast.error(
    t("editor.imageGenerationFailedTitle"),
    getImageGenerationFailureDesc(elapsedSeconds, errorCode, t),
  );
}

export function showEditorImageGenerationSuccessToast(elapsedSeconds: number, t: Translator) {
  toast.success(
    t("editor.imageGenerationSuccessTitle"),
    t("editor.imageGenerationSuccessDesc").replace("{seconds}", String(elapsedSeconds)),
  );
}

export function showEditorWriteStreamErrorToast(message: string, t: Translator) {
  toast.error(t("editor.writeStreamFailedTitle"), sanitizeErrorForUser(message) || t("editor.writeStreamFailedDesc"));
}

export function showEditorReviewTimeoutToast(t: Translator) {
  toast.error(t("editor.reviewTimeoutTitle"), t("editor.reviewTimeoutDesc"));
}

export function showEditorReviewConnectionToast(t: Translator) {
  toast.error(t("editor.reviewConnectionFailedTitle"), t("editor.reviewConnectionFailedDesc"));
}

export function showEditorTranslationStartFailedToast(t: Translator) {
  toast.error(t("editor.translationStartFailedTitle"), t("editor.translationStartFailedDesc"));
}
