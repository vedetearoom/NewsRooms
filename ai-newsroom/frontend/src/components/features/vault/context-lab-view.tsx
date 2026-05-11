import * as React from "react";
import { useRouter } from "next/navigation";
import { X, Wand2, Send, Rocket, Save, Bot, Newspaper, SearchCode } from "lucide-react";
import { useVaultLabStore } from "@/store/vault-lab-store";
import { api, type InspirationAsset } from "@/lib/api";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";
import { markdownToHtml } from "@/lib/markdown-utils";
import { useClickOutside } from "@/hooks/useClickOutside";
import { useAgents } from "@/hooks/useApi";
import { toast } from "@/components/ui/use-toast";

interface ContextLabViewProps {
  inspirations: InspirationAsset[];
  selectedIds: number[];
}

function getTaskTypeForContextLabMode(mode: string): string {
  return "multi_source_synthesis";
}

async function getResponseErrorMessage(response: Response): Promise<string> {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    try {
      const payload = await response.json() as { detail?: string | { message?: string }; message?: string };
      if (typeof payload.detail === "object" && payload.detail?.message) return payload.detail.message;
      if (typeof payload.detail === "string") return payload.detail;
      if (payload.message) return payload.message;
    } catch {
      // Fall through to a generic error message.
    }
  }

  try {
    const text = (await response.text()).trim();
    if (text) return text;
  } catch {
    // Ignore secondary parsing failures.
  }

  return `Request failed: ${response.status} ${response.statusText}`;
}

export function ContextLabView({ inspirations, selectedIds }: ContextLabViewProps) {
  const router = useRouter();
  const { language } = useTranslation();
  const { toggleSelection, clearSelection, labDraft, setLabDraft, activeAgent, setActiveAgent, isStreaming, setIsStreaming } = useVaultLabStore();
  
  const [prompt, setPrompt] = React.useState("");
  const abortControllerRef = React.useRef<AbortController | null>(null);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const [isAgentMenuOpen, setIsAgentMenuOpen] = React.useState(false);
  const agentMenuRef = React.useRef<HTMLDivElement>(null);
  useClickOutside({
    ref: agentMenuRef,
    enabled: isAgentMenuOpen,
    onClickOutside: () => setIsAgentMenuOpen(false),
  });

  const { agents: allAgents } = useAgents();

  const agents = React.useMemo(() => {
    return allAgents.filter(a => a.role === "writer").map(a => ({
      id: String(a.id),
      icon: <Bot className="w-[15px] h-[15px] text-zinc-500/80" />,
      name_zh: a.name,
      name_en: a.name,
    }));
  }, [allAgents]);

  const activeAgentData = agents.find(a => a.id === activeAgent) || agents[0] || { id: "default", icon: <Bot className="w-[15px] h-[15px] text-blue-500/80" />, name_zh: "未配置 Writer", name_en: "No Writer" };
  
  const selectedItems = React.useMemo(() => {
    return selectedIds.map(id => inspirations.find(i => i.id === id)).filter(Boolean) as InspirationAsset[];
  }, [selectedIds, inspirations]);

  const articleCount = selectedItems.filter(i => i.platform === "article").length;
  const videoCount = selectedItems.length - articleCount;

  // Auto scroll to bottom when draft updates
  React.useEffect(() => {
    if (isStreaming && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [labDraft, isStreaming]);

  const handleGenerate = async () => {
    if (!prompt.trim() || isStreaming) return;
    
    // Cancel previous stream if active
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    setIsStreaming(true);
    setLabDraft(""); // clear old draft
    
    try {
      const response = await api.streamLabChat(
        selectedIds, 
        prompt, 
        activeAgent, 
        abortControllerRef.current.signal
      );

      if (!response.ok) {
        throw new Error(await getResponseErrorMessage(response));
      }
      
      if (!response.body) throw new Error("No response body");
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulatedText = "";
      
      while (!abortControllerRef.current?.signal.aborted) {
        const { value, done: readerDone } = await reader.read();
        if (readerDone) break;
        
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          const rawEvents = buffer.split(/\r?\n\r?\n/);
          buffer = rawEvents.pop() ?? "";
          
          for (const rawEvent of rawEvents) {
            const lines = rawEvent.split(/\r?\n/);
            let event = "message";
            let data = "";
            for (const line of lines) {
              if (line.startsWith("event: ")) event = line.substring(7);
              else if (line.startsWith("data: ")) data = line.substring(6);
            }
            
            if (event === "chunk") {
              try {
                const parsed = JSON.parse(data);
                if (parsed.text) {
                  accumulatedText += parsed.text;
                  setLabDraft(accumulatedText);
                }
              } catch (e) {}
            } else if (event === "error") {
              try {
                const parsed = JSON.parse(data);
                accumulatedText += `\n\n[Error: ${parsed.message}]`;
                setLabDraft(accumulatedText);
              } catch (e) {}
            } else if (event === "done") {
              return; // Stream ended
            }
          }
        }
      }
    } catch (error: unknown) {
      if (!(error instanceof Error) || error.name !== 'AbortError') {
        console.error("Stream error:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        setLabDraft(prev => prev + `\n\n[Error: ${message}]`);
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  const handleConfirmAndEnter = async () => {
    try {
      const task = await api.createTask({
        task_type: getTaskTypeForContextLabMode(activeAgent),
        inspiration_ids: selectedIds,
        initial_draft: labDraft
      });
      clearSelection();
      router.push(`/editor/${task.id}`);
    } catch (e) {
      const message = e instanceof Error ? e.message : "任务创建失败";
      toast.error("任务创建失败", message);
      console.error("Failed to create task", e);
    }
  };

  const handleSaveOnly = async () => {
    try {
      await api.createTask({
        task_type: getTaskTypeForContextLabMode(activeAgent),
        inspiration_ids: selectedIds,
        initial_draft: labDraft
      });
      clearSelection();
      // Keep user in vault
    } catch (e) {
      const message = e instanceof Error ? e.message : "任务保存失败";
      toast.error("任务保存失败", message);
      console.error("Failed to save task", e);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto relative animate-in fade-in duration-300 flex flex-col items-center">
      <div className="max-w-3xl w-full px-6 lg:px-8 pt-16 flex flex-col min-h-full relative">
        
        {/* Top Layer: Source Pills */}
        <div className="flex flex-wrap gap-2 mb-8">
          {selectedItems.map(item => (
            <div key={item.id} className="flex items-center gap-1 bg-white dark:bg-[#15161a] text-zinc-700 dark:text-zinc-300 rounded-full px-3 py-1.5 text-xs font-medium border border-zinc-200 dark:border-white/5 shadow-sm">
              <span className="truncate max-w-[160px] leading-none pb-0.5">{item.title || item.hook_text || `Item #${item.id}`}</span>
              <button 
                onClick={() => toggleSelection(item.id)}
                className="hover:bg-zinc-100 dark:hover:bg-white/10 rounded-full p-0.5 ml-0.5 transition-colors text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>

        {/* Middle Layer: Auto-Brief */}
        <div className="bg-zinc-50/50 dark:bg-white/[0.01] border border-zinc-200/60 dark:border-white/[0.04] p-5 rounded-2xl mb-12 flex gap-4 items-start shadow-sm">
          <div className="pt-0.5 shrink-0">
            <Wand2 className="w-4 h-4 text-zinc-900 dark:text-zinc-100 opacity-80" />
          </div>
          <div>
            <h3 className="text-[14px] font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
              {language === 'zh' ? '上下文矩阵已就绪' : 'Context Matrix Ready'}
            </h3>
            <p className="text-[13px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
              {language === 'zh' 
                ? `您已选中 ${articleCount > 0 ? `${articleCount} 篇图文` : ''}${articleCount > 0 && videoCount > 0 ? ' 与 ' : ''}${videoCount > 0 ? `${videoCount} 个视频` : ''}素材。这些内容已被挂载至内存，您可以在下方发出指令，系统将以此为基础综合生成草稿。`
                : `You have selected ${articleCount} articles and ${videoCount} videos. These sources are staged in memory. Send an instruction below to generate a synthesized draft.`}
            </p>
          </div>
        </div>

        {/* Bottom Layer: Evolution Canvas */}
        <div className="prose prose-zinc dark:prose-invert max-w-none text-[15px] leading-loose">
          {labDraft ? (
            <div dangerouslySetInnerHTML={{ __html: markdownToHtml(labDraft) }} />
          ) : (
            <div className="text-zinc-300 dark:text-zinc-700 italic flex items-center justify-center py-20 font-medium">
              {language === 'zh' ? '等待指令中...' : 'Awaiting instructions...'}
            </div>
          )}
          
          {/* Action Buttons at the very bottom of the document */}
          {(labDraft && !isStreaming) && (
            <div className="mt-12 pt-8 border-t border-zinc-100 dark:border-white/5 flex items-center justify-end gap-3 animate-in fade-in duration-500">
              <button 
                onClick={handleSaveOnly}
                className="flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-[#15161a] border border-zinc-200 dark:border-white/5 text-zinc-600 dark:text-zinc-400 text-[13px] font-medium rounded-lg shadow-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              >
                <Save className="w-4 h-4" />
                {language === 'zh' ? '仅存入任务看板' : 'Save to Board Only'}
              </button>
              <button 
                onClick={handleConfirmAndEnter}
                className="flex items-center gap-1.5 px-6 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-[13px] font-medium rounded-lg shadow-md hover:bg-zinc-800 dark:hover:bg-white transition-all hover:scale-[1.02]"
              >
                <Rocket className="w-4 h-4" />
                {language === 'zh' ? '确认并进入编辑器' : 'Confirm & Enter Editor'}
              </button>
            </div>
          )}
          <div ref={bottomRef} className="h-24" />
        </div>

        {/* Sticky Command Bar */}
        <div className="sticky bottom-8 mt-auto pb-8 z-50 pointer-events-none w-full flex justify-center">
          <div className="w-full pointer-events-auto flex flex-col gap-3">
            
            {/* Input Area */}
          <div className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl shadow-[0_24px_64px_-12px_rgba(0,0,0,0.15)] dark:shadow-[0_24px_64px_-12px_rgba(0,0,0,0.5)] rounded-2xl border border-zinc-200 dark:border-white/10 p-2 flex items-end gap-2">
            
            {/* Custom Agent Selector */}
            <div className="shrink-0 mb-1 ml-1 flex items-center relative" ref={agentMenuRef}>
              <button 
                onClick={() => setIsAgentMenuOpen(!isAgentMenuOpen)}
                className="flex items-center gap-1.5 bg-transparent hover:bg-zinc-100 dark:hover:bg-white/5 text-zinc-700 dark:text-zinc-300 rounded-lg text-[13px] font-medium px-3 py-2 outline-none focus:ring-0 cursor-pointer transition-colors"
              >
                <span>{activeAgentData.icon}</span>
                <span>{language === 'zh' ? activeAgentData.name_zh : activeAgentData.name_en}</span>
                <svg className={cn("w-3.5 h-3.5 text-zinc-400 transition-transform", isAgentMenuOpen && "rotate-180")} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {isAgentMenuOpen && (
                <div className="absolute bottom-[calc(100%+12px)] left-0 w-40 bg-white dark:bg-zinc-800 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden animate-in fade-in slide-in-from-bottom-2 z-50">
                  {agents.map(agent => (
                    <button
                      key={agent.id}
                      onClick={() => {
                        setActiveAgent(agent.id);
                        setIsAgentMenuOpen(false);
                      }}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-2.5 text-[13px] font-medium transition-colors text-left",
                        activeAgent === agent.id 
                          ? "bg-zinc-100 dark:bg-zinc-700/50 text-zinc-900 dark:text-zinc-100" 
                          : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-700/30 hover:text-zinc-900 dark:hover:text-zinc-200"
                      )}
                    >
                      <span>{agent.icon}</span>
                      <span>{language === 'zh' ? agent.name_zh : agent.name_en}</span>
                    </button>
                  ))}
                </div>
              )}
              <div className="w-px h-5 bg-zinc-200 dark:bg-white/10 mx-2" />
            </div>

            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleGenerate();
                }
              }}
              placeholder={language === 'zh' ? '在此输入指令，例如：“将选中的内容综合成一篇科普文章”' : 'Enter instructions here...'}
              className="flex-1 bg-transparent border-none resize-none max-h-[150px] min-h-[40px] text-[14px] leading-relaxed p-2 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-0"
              rows={Math.min(5, prompt.split('\n').length || 1)}
            />

            <button 
              onClick={handleGenerate}
              disabled={!prompt.trim() || isStreaming}
              className={cn(
                "shrink-0 w-8 h-8 mb-1 mr-1 rounded-full flex items-center justify-center transition-all duration-200",
                prompt.trim() && !isStreaming
                  ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-md hover:scale-105"
                  : "bg-transparent text-zinc-400 dark:text-zinc-500"
              )}
            >
              {isStreaming ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send className="w-4 h-4 ml-[-1px]" />
              )}
            </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
