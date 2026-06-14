import { splitAiParagraphs } from "@/lib/ai/format-text";

type AiFormattedTextProps = {
  text: string;
  className?: string;
  paragraphClassName?: string;
};

export function AiFormattedText({
  text,
  className = "space-y-3",
  paragraphClassName = "text-sm leading-relaxed text-slate-700",
}: AiFormattedTextProps) {
  const paragraphs = splitAiParagraphs(text);

  if (paragraphs.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      {paragraphs.map((paragraph, index) => (
        <p key={`${index}-${paragraph.slice(0, 24)}`} className={paragraphClassName}>
          {paragraph}
        </p>
      ))}
    </div>
  );
}
