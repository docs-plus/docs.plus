import { immer } from "zustand/middleware/immer";

type WorkspaceSettings = {
  workspaceId?: string | null | undefined;
  channelId?: string | null | undefined;
  channelInfo?: any;
  isUserChannelMember?: boolean;
  isUserChannelOwner?: boolean;
  isUserChannelAdmin?: boolean;
  workspaceBroadcaster?: any;
  userPickingEmoji?: boolean;
};

export interface IWorkspaceSettingsStore {
  workspaceSettings: WorkspaceSettings;
  setWorkspaceSetting: (key: string, value: any) => void;
  setWorkspaceSettings: (settings: WorkspaceSettings) => void;
}

const useWorkspaceSettingsStore = immer<IWorkspaceSettingsStore>((set) => ({
  workspaceSettings: {
    workspaceId: null,
    channelId: null,
    channelInfo: {},
    isUserChannelMember: false,
    isUserChannelOwner: false,
    isUserChannelAdmin: false,
    userPickingEmoji: false,
  },

  // Update a single setting
  setWorkspaceSetting: (key, value) => {
    return set((state) => ({
      workspaceSettings: { ...state.workspaceSettings, [key]: value },
    }));
  },

  // Update multiple settings at once
  setWorkspaceSettings: (settings) => {
    return set((state) => ({
      workspaceSettings: { ...state.workspaceSettings, ...settings },
    }));
  },
}));

export default useWorkspaceSettingsStore;
