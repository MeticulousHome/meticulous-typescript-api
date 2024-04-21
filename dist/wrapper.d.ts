import Api from '.';
import { ActionType, ProfileIdent, Notification, AcknowledgeNotificationRequest, Settings, WiFiConfig, WiFiConnectRequest, WiFiNetwork } from './types';
import { Profile } from 'meticulous-typescript-profile';
export declare class ApiResponseError extends Error {
    cause: object;
    constructor(message: string, cause: object);
}
export default class ApiWrapper {
    api: Api;
    executeAction(action: ActionType): Promise<void>;
    listProfiles(): Promise<ProfileIdent[]>;
    fetchAllProfiles(): Promise<Profile[]>;
    saveProfile(data: Profile): Promise<ProfileIdent>;
    loadProfileFromJSON(data: Profile): Promise<ProfileIdent>;
    loadProfileById(id: string): Promise<ProfileIdent>;
    getProfile(profileId: string): Promise<Profile>;
    deleteProfile(profileId: string): Promise<ProfileIdent>;
    getNotifications(acknowledged: boolean): Promise<Notification[]>;
    acknowledgeNotification(data: AcknowledgeNotificationRequest): Promise<void>;
    getSettings(settingName?: string): Promise<Settings>;
    updateSetting(setting: Settings): Promise<void>;
    updateFirmware(formData: FormData): Promise<void>;
    getWiFiConfig(): Promise<WiFiConfig>;
    setWiFiConfig(data: WiFiConfig): Promise<void>;
    listAvailableWiFi(): Promise<WiFiNetwork[]>;
    connectToWiFi(data: WiFiConnectRequest): Promise<void>;
    playSound(sound: string): Promise<void>;
    listSounds(): Promise<string[]>;
    listSoundThemes(): Promise<string[]>;
    getSoundTheme(): Promise<string>;
    setSoundTheme(theme: string): Promise<void>;
}
//# sourceMappingURL=wrapper.d.ts.map