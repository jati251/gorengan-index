import type { SourceState } from "@/lib/server/publicData";
export function SourceStatus({ source, asOf }: { source: SourceState; asOf?: number | null }) {
  return <div className="text-xs text-zinc-400 mt-2" role="status">
    <a className="underline" href={source.url} target="_blank" rel="noopener noreferrer">{source.source}</a>
    {" · "}{source.status}{asOf ? ` · as of ${new Date(asOf).toLocaleString()}` : ""}
    {source.fetchedAt ? ` · fetched ${new Date(source.fetchedAt).toLocaleTimeString()}` : ""}
    {source.error ? ` · ${source.error}` : ""}
  </div>;
}
