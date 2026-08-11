const MINUTES_PER_HOUR = 60;

export function formatKm(km: number): string {
  return `${km.toFixed(1)} km`;
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatTripRange(startedAt: string, endedAt: string | null): string {
  const start = formatTime(startedAt);
  if (!endedAt) {
    return `${start} → ongoing`;
  }
  return `${start} → ${formatTime(endedAt)}`;
}

export function formatDuration(totalSeconds: number | null): string {
  if (!totalSeconds) {
    return '0m';
  }
  const minutes = Math.round(totalSeconds / MINUTES_PER_HOUR);
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  const remainingMinutes = minutes % MINUTES_PER_HOUR;
  return hours > 0 ? `${hours}h ${remainingMinutes}m` : `${remainingMinutes}m`;
}
