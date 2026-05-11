/**
 * Markdown parsing and utility constants.
 */

export function markdownToHtml(md: string): string {
  if (!md) return "";
  let headingCount = 0;

  // Step 1: Strip the first H1 (it becomes the editable title)
  let strippedFirstH1 = false;
  let processed = md.replace(/^#\s+(.+)$/gm, (_match, p1) => {
    if (!strippedFirstH1) {
      strippedFirstH1 = true;
      return ''; // Remove first H1 from body
    }
    return `\n\n<h1 id="heading-${headingCount++}">${p1.trim()}</h1>\n\n`;
  });

  // Step 2: Handle blockquotes BEFORE other replacements (process `> ` lines)
  processed = processed.replace(/(^>\s?.+(\n|$))+/gm, (match) => {
    const inner = match.replace(/^>\s?/gm, '').trim()
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>");
    return `\n\n<blockquote><p>${inner}</p></blockquote>\n\n`;
  });

  // Step 3: Standard markdown transformations
  let html = processed
    .replace(/^###\s+(.+)$/gm, (_, p1) => `\n\n<h3 id="heading-${headingCount++}">${p1.trim()}</h3>\n\n`)
    .replace(/^##\s+(.+)$/gm, (_, p1) => `\n\n<h2 id="heading-${headingCount++}">${p1.trim()}</h2>\n\n`)
    .replace(/^---$/gm, "\n\n<hr>\n\n")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/~~(.+?)~~/g, "<s>$1</s>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, (match) => `\n\n<ul>\n${match}\n</ul>\n\n`);

  html = html.replace(/\n{3,}/g, '\n\n').trim();
  return html.split(/\n\n+/).map(block => {
    block = block.trim();
    if (!block) return "";
    if (block.match(/^(<h[1-6] id=".*">|<ul>|<ol>|<hr>|<blockquote>)/)) return block;
    const pContent = block.replace(/\n/g, ' ').trim();
    if (!pContent || pContent === "<br>" || pContent === "&nbsp;") return "";
    return `<p>${pContent}</p>`;
  }).filter(Boolean).join('\n');
}

/** Extract the first H1 title from raw markdown */
export function extractH1Title(md: string): string | null {
  if (!md) return null;
  const match = md.match(/^#\s+(.+)$/m);
  return match ? match[1].replace(/\*\*/g, '').trim() : null;
}

// Human-friendly task type labels
export const TASK_LABELS: Record<string, string> = {
  daily_report: "Daily Intelligence Report",
  twitter_thread: "Twitter Thread",
  newsletter: "Newsletter Edition",
  deep_dive: "Deep Dive Analysis",
  summary: "Executive Summary",
  agent_task: "Intelligence Report",
};
