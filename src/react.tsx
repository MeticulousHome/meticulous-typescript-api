import {
  Notification,
  ProfileIdent,
  Settings,
  WiFiConfig,
  WiFiNetwork,
  AcknowledgeNotificationRequest,
  WiFiConnectRequest,
  ActionType,
  APIError
} from './types';
import ApiWrapper from './wrapper';

import { Profile } from 'meticulous-typescript-profile/';

interface ApiProps {
  // machine functions
  executeAction: (action: ActionType) => Promise<void>;
  updateFirmware: (formData: FormData) => Promise<void>;

  // profile functions
  listProfiles: () => Promise<ProfileIdent[]>;
  saveProfile: (data: Profile) => Promise<ProfileIdent>;
  loadProfile: (data: Profile) => Promise<ProfileIdent>;
  getProfile: (profileId: string) => Promise<ProfileIdent>;
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
}

export function useApi(): ApiProps {
  const wrapper = new ApiWrapper();

  const executeAction = wrapper.executeAction;

  // Profile Operations
  const profileOperations = () => ({
    listProfiles: wrapper.listProfiles,
    saveProfile: wrapper.saveProfile,
    loadProfile: wrapper.loadProfile,
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

  return {
    executeAction,
    ...profileOperations(),
    ...notificationOperations(),
    ...settingsOperations(),
    updateFirmware,
    ...wifiOperations()
  };
}
