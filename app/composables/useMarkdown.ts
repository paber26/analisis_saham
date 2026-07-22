// Minimal Markdown → HTML renderer shared by the education & learning pages.
// Supports headings (#..####), bold/italic, inline+block code, blockquotes,
// bullet/numbered lists, and task checkboxes — styled for the dark slate theme.
// Kept dependency-free (no marked/DOMPurify) since content is author-controlled.
export function useMarkdown() {
  function renderMarkdown(text: string): string {
    if (!text) return '';
    return text
      .replace(/```([\s\S]*?)```/g, '<pre class="bg-slate-950 p-4 rounded-xl border border-slate-800 overflow-x-auto text-emerald-400 font-mono text-xs my-3"><code>$1</code></pre>')
      .replace(/^#### (.*$)/gim, '<h4 class="text-sm font-bold text-slate-200 mt-4 mb-2">$1</h4>')
      .replace(/^### (.*$)/gim, '<h3 class="text-base font-bold text-emerald-400 mt-5 mb-2 flex items-center gap-2"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="text-lg font-bold text-slate-100 mt-6 mb-3 border-b border-slate-800 pb-1.5">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="text-xl font-extrabold text-slate-50 mt-6 mb-4">$1</h1>')
      .replace(/^> (.*$)/gim, '<blockquote class="border-l-4 border-emerald-500 bg-slate-950/80 p-3 rounded-r-xl my-3 text-slate-300 italic">$1</blockquote>')
      .replace(/^- \[ \] (.*$)/gim, '<li class="ml-4 list-none text-slate-300 py-0.5 flex items-center gap-2"><span class="w-3.5 h-3.5 inline-block border border-slate-700 rounded bg-slate-950"></span> $1</li>')
      .replace(/^- \[x\] (.*$)/gim, '<li class="ml-4 list-none text-slate-200 py-0.5 flex items-center gap-2"><span class="w-3.5 h-3.5 inline-flex items-center justify-center border border-emerald-500 rounded bg-emerald-500 text-slate-950 text-[10px] font-bold">✓</span> $1</li>')
      .replace(/^- (.*$)/gim, '<li class="ml-4 list-disc text-slate-300 py-0.5">$1</li>')
      .replace(/^([0-9]+)\. (.*$)/gim, '<li class="ml-4 list-decimal text-slate-300 py-0.5">$2</li>')
      .replace(/\*\*(.*?)\*\*/g, '<strong class="text-slate-100 font-bold">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em class="text-emerald-300 font-medium">$1</em>')
      .replace(/`(.*?)`/g, '<code class="bg-slate-950 px-1.5 py-0.5 rounded text-emerald-300 font-mono text-xs border border-slate-800">$1</code>')
      .replace(/\n/g, '<br/>');
  }

  return { renderMarkdown };
}
