export function ContentLanguageFallbackNotice({
  usedFallback,
  message,
}: {
  usedFallback: boolean;
  message: string;
}) {
  return usedFallback ? <p className="content-language-fallback" role="status">{message}</p> : null;
}

export function MarketingErrorState({
  title,
  retryLabel,
  onRetry,
}: {
  title: string;
  retryLabel: string;
  onRetry: () => void;
}) {
  return (
    <div className="marketing-container" role="alert">
      <h2>{title}</h2>
      <button type="button" onClick={onRetry}>{retryLabel}</button>
    </div>
  );
}
