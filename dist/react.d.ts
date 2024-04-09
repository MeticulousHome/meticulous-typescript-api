import Api from '.';
import { Notification, ProfileIdent, Settings, WiFiConfig, WiFiNetwork, AcknowledgeNotificationRequest, WiFiConnectRequest, ActionType } from './types';
import { Profile } from 'meticulous-typescript-profile/';
interface ApiProps {
    executeAction: (action: ActionType) => Promise<void>;
    updateFirmware: (formData: FormData) => Promise<void>;
    listProfiles: () => Promise<ProfileIdent[]>;
    fetchProfiles: () => Promise<Profile[]>;
    saveProfile: (data: Profile) => Promise<ProfileIdent>;
    loadProfileById: (id: string) => Promise<ProfileIdent>;
    loadProfileFromJSON: (data: Profile) => Promise<ProfileIdent>;
    getProfile: (profileId: string) => Promise<Profile>;
    deleteProfile: (profileId: string) => Promise<ProfileIdent>;
    getNotifications: (acknowledged: boolean) => Promise<Notification[]>;
    acknowledgeNotification: (data: AcknowledgeNotificationRequest) => Promise<void>;
    getSettings: (settingName?: string) => Promise<Settings>;
    updateSetting: (setting: Settings) => Promise<void>;
    getWiFiConfig: () => Promise<WiFiConfig>;
    setWiFiConfig: (data: WiFiConfig) => Promise<void>;
    listAvailableWiFi: () => Promise<WiFiNetwork[]>;
    connectToWiFi: (data: WiFiConnectRequest) => Promise<void>;
    playSound: (sound: string) => Promise<void>;
    listSounds: () => Promise<string[]>;
    listSoundThemes: () => Promise<string[]>;
    getSoundTheme: () => Promise<string>;
    setSoundTheme: (theme: string) => Promise<void>;
}
export declare function useApi(api?: Api): ApiProps;
export {};
//# sourceMappingURL=react.d.ts.map