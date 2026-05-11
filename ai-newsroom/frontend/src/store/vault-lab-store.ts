import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface VaultLabState {
  selectedInspirationIds: number[];
  labDraft: string;
  activeAgent: string;
  isStreaming: boolean;
  toggleSelection: (id: number) => void;
  clearSelection: () => void;
  setLabDraft: (draft: string | ((prev: string) => string)) => void;
  setActiveAgent: (agent: string) => void;
  setIsStreaming: (status: boolean) => void;
}

export const useVaultLabStore = create<VaultLabState>()(
  persist(
    (set) => ({
      selectedInspirationIds: [],
      labDraft: '',
      activeAgent: 'general_writing',
      isStreaming: false,
      toggleSelection: (id) =>
        set((state) => {
          const isSelected = state.selectedInspirationIds.includes(id);
          let newIds;
          if (isSelected) {
            newIds = state.selectedInspirationIds.filter((i) => i !== id);
          } else {
            // Max 10 items
            if (state.selectedInspirationIds.length >= 10) {
              return state;
            }
            newIds = [...state.selectedInspirationIds, id];
          }
          // If selection drops below 2, clear the draft to avoid leftover context
          const shouldClearDraft = newIds.length < 2 && state.labDraft.length > 0;
          return { 
            selectedInspirationIds: newIds,
            ...(shouldClearDraft ? { labDraft: '' } : {})
          };
        }),
      clearSelection: () => set({ selectedInspirationIds: [], labDraft: '' }),
      setLabDraft: (draft) =>
        set((state) => ({
          labDraft: typeof draft === "function" ? draft(state.labDraft) : draft,
        })),
      setActiveAgent: (agent) => set({ activeAgent: agent }),
      setIsStreaming: (status) => set({ isStreaming: status }),
    }),
    {
      name: 'vault-lab-storage',
      // use sessionStorage so it clears when tab is closed, but survives reloads
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);
