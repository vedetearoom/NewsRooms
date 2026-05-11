import { create } from 'zustand';

interface TabsState {
  discoverContentTab: "article" | "video";
  setDiscoverContentTab: (tab: "article" | "video") => void;

  discoverTimeTab: "today" | "thisWeek" | "older";
  setDiscoverTimeTab: (tab: "today" | "thisWeek" | "older") => void;

  inboxTab: "text" | "video";
  setInboxTab: (tab: "text" | "video") => void;

  sourcesTab: "text" | "video";
  setSourcesTab: (tab: "text" | "video") => void;

  vaultDetailTab: "summary" | "structure" | "transcript" | "fulltext";
  setVaultDetailTab: (tab: "summary" | "structure" | "transcript" | "fulltext") => void;

  vaultInspirationId: number | null;
  setVaultInspirationId: (id: number | null) => void;

  discoverActiveId: number | null;
  setDiscoverActiveId: (id: number | null) => void;

  agentsActiveId: number | "new" | null;
  setAgentsActiveId: (id: number | "new" | null) => void;

  inboxTextCount: number | null;
  setInboxTextCount: (count: number) => void;

  inboxVideoCount: number | null;
  setInboxVideoCount: (count: number) => void;

  inboxTextSourceId: number | "all" | null;
  setInboxTextSourceId: (id: number | "all" | null) => void;

  inboxVideoSourceId: string | null;
  setInboxVideoSourceId: (id: string | null) => void;
}

export const useTabsStore = create<TabsState>((set) => ({
  discoverContentTab: "article",
  setDiscoverContentTab: (tab) => set({ discoverContentTab: tab }),

  discoverTimeTab: "today",
  setDiscoverTimeTab: (tab) => set({ discoverTimeTab: tab }),

  inboxTab: "text",
  setInboxTab: (tab) => set({ inboxTab: tab }),

  sourcesTab: "text",
  setSourcesTab: (tab) => set({ sourcesTab: tab }),

  vaultDetailTab: "summary",
  setVaultDetailTab: (tab) => set({ vaultDetailTab: tab }),

  vaultInspirationId: null,
  setVaultInspirationId: (id) => set({ vaultInspirationId: id }),

  discoverActiveId: null,
  setDiscoverActiveId: (id) => set({ discoverActiveId: id }),

  agentsActiveId: null,
  setAgentsActiveId: (id) => set({ agentsActiveId: id }),

  inboxTextCount: null,
  setInboxTextCount: (count) => set({ inboxTextCount: count }),

  inboxVideoCount: null,
  setInboxVideoCount: (count) => set({ inboxVideoCount: count }),

  inboxTextSourceId: null,
  setInboxTextSourceId: (id) => set({ inboxTextSourceId: id }),

  inboxVideoSourceId: null,
  setInboxVideoSourceId: (id) => set({ inboxVideoSourceId: id }),
}));
