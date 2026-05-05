import type { StoryPanel } from '@/context/AppContext';

interface DraftState {
  panels:           StoryPanel[];
  activePanelIndex: number;
  onSave:           (panels: StoryPanel[]) => void;
}

let _state: DraftState | null = null;

export const DraftStore = {
  set(state: DraftState) {
    _state = {
      panels:           [...state.panels],
      activePanelIndex: state.activePanelIndex,
      onSave:           state.onSave,
    };
  },

  get(): DraftState | null {
    return _state;
  },

  getActiveIndex(): number {
    return _state?.activePanelIndex ?? 0;
  },

  setActiveIndex(idx: number) {
    if (_state) _state.activePanelIndex = idx;
  },

  updatePanel(idx: number, updates: Partial<StoryPanel>) {
    if (!_state) return;
    _state.panels = _state.panels.map((p, i) =>
      i === idx ? { ...p, ...updates } : p,
    );
  },

  save() {
    if (_state) {
      _state.onSave([..._state.panels]);
      _state = null;
    }
  },

  discard() {
    _state = null;
  },
};
