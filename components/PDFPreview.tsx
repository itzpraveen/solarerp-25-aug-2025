export default function PDFPreview({ url }: { url: string }) {
  return (
    <div className="rounded border bg-white">
      <iframe src={url} className="h-[600px] w-full" />
    </div>
  );
}
