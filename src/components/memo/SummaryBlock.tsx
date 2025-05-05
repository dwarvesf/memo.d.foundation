interface SummaryBlockProps {
  summary?: string;
}
function SummaryBlock({ summary }: SummaryBlockProps) {
  if (!summary) {
    return null; // Don't render anything if summary is not provided
  }
  return (
    <div className="bg-background-secondary mb-element-margin rounded-lg p-4">
      <div className="mb-4 border-b-1">
        <h3 className="text-foreground border-foreground w-fit border-b-3 !pr-2 text-center text-[21px] leading-[140%] uppercase">
          tl;dr
        </h3>
      </div>
      <div
        className="[&>p]:text-sm [&>ul]:list-disc [&>ul]:pl-4 [&>ul>li]:not-last:mb-[var(--list-item-spacing)]"
        dangerouslySetInnerHTML={{
          __html: summary,
        }}
      />
    </div>
  );
}
export default SummaryBlock;
