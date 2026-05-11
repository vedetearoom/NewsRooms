import { create } from 'zustand';

interface SelectionState {
  selectedCardIds: Set<number>;
  selectedInspirationIds: Set<number>;
  
  toggleCard: (id: number) => void;
  toggleInspiration: (id: number) => void;
  setAllCards: (ids: number[]) => void;
  setAllInspirations: (ids: number[]) => void;
  clearSelection: () => void;
}

export const useSelectionStore = create<SelectionState>((set) => ({
  selectedCardIds: new Set<number>(),
  selectedInspirationIds: new Set<number>(),

  toggleCard: (id: number) => set((state) => {
    const newSet = new Set(state.selectedCardIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    return { selectedCardIds: newSet };
  }),

  toggleInspiration: (id: number) => set((state) => {
    const newSet = new Set(state.selectedInspirationIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    return { selectedInspirationIds: newSet };
  }),
  
  setAllCards: (ids: number[]) => set({ selectedCardIds: new Set(ids) }),
  
  setAllInspirations: (ids: number[]) => set({ selectedInspirationIds: new Set(ids) }),

  clearSelection: () => set({ 
    selectedCardIds: new Set<number>(), 
    selectedInspirationIds: new Set<number>() 
  }),
}));
