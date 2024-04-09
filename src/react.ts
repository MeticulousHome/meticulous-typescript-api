import Api, { defaultAPI } from '.';
import {
  Notification,
  ProfileIdent,
  Settings,
  WiFiConfig,
  WiFiNetwork,
  AcknowledgeNotificationRequest,
  WiFiConnectRequest,
  ActionType
} from './types';
import ApiWrapper from './wrapper';

import { Profile } from 'meticulous-typescript-profile/';

interface ApiProps {
  // machine functions
  executeAction: (action: ActionType) => Promise<void>;
  updateFirmware: (formData: FormData) => Promise<void>;

  // profile functions
  listProfiles: () => Promise<ProfileIdent[]>;
  fetchProfiles: () => Promise<Profile[]>;
  saveProfile: (data: Profile) => Promise<ProfileIdent>;
  loadProfileById: (id: string) => Promise<ProfileIdent>;
  loadProfileFromJSON: (data: Profile) => Promise<ProfileIdent>;
  getProfile: (profileId: string) => Promise<Profile>;
  deleteProfile: (profileId: string) => Promise<ProfileIdent>;

  // notification functions
  getNotifications: (acknowledged: boolean) => Promise<Notification[]>;
  acknowledgeNotification: (
    data: AcknowledgeNotificationRequest
  ) => Promise<void>;

  // settings functions
  getSettings: (settingName?: string) => Promise<Settings>;
  updateSetting: (setting: Settings) => Promise<void>;

  // wifi functions
  getWiFiConfig: () => Promise<WiFiConfig>;
  setWiFiConfig: (data: WiFiConfig) => Promise<void>;
  listAvailableWiFi: () => Promise<WiFiNetwork[]>;
  connectToWiFi: (data: WiFiConnectRequest) => Promise<void>;

  // sound functions
  playSound: (sound: string) => Promise<void>;
  listSounds: () => Promise<string[]>;
  listSoundThemes: () => Promise<string[]>;
  getSoundTheme: () => Promise<string>;
  setSoundTheme: (theme: string) => Promise<void>;
}

export function useApi(api: Api = defaultAPI): ApiProps {
  const wrapper = new ApiWrapper(api);

  const executeAction = wrapper.executeAction;

  // Profile Operations
  const profileOperations = () => ({
    listProfiles: wrapper.listProfiles,
    fetchProfiles: wrapper.fetchAllProfiles,
    saveProfile: wrapper.saveProfile,
    loadProfileById: wrapper.loadProfileById,
    loadProfileFromJSON: wrapper.loadProfileFromJSON,
    getProfile: wrapper.getProfile,
    deleteProfile: wrapper.deleteProfile
  });

  // Notifications Operations
  const notificationOperations = () => ({
    getNotifications: wrapper.getNotifications,
    acknowledgeNotification: wrapper.acknowledgeNotification
  });

  // Settings Operations
  const settingsOperations = () => ({
    getSettings: wrapper.getSettings,
    updateSetting: wrapper.updateSetting
  });

  // Firmware uperations
  const updateFirmware = wrapper.updateFirmware;

  // Wifi Operations
  const wifiOperations = () => ({
    getWiFiConfig: wrapper.getWiFiConfig,
    setWiFiConfig: wrapper.setWiFiConfig,
    listAvailableWiFi: wrapper.listAvailableWiFi,
    connectToWiFi: wrapper.connectToWiFi
  });

  const soundOperations = () => ({
    playSound: wrapper.playSound,
    listSounds: wrapper.listSounds,
    listSoundThemes: wrapper.listSoundThemes,
    setSoundTheme: wrapper.setSoundTheme,
    getSoundTheme: wrapper.getSoundTheme
  });

  return {
    executeAction,
    ...profileOperations(),
    ...notificationOperations(),
    ...settingsOperations(),
    ...soundOperations(),
    updateFirmware,
    ...wifiOperations()
  };
}
