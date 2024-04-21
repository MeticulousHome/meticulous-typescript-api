import { AxiosResponse } from 'axios';
import { Socket } from 'socket.io-client';
import { APIError, AcknowledgeNotificationRequest, ActionResponse, ActionType, Actuators, Communication, MachineInfo, Notification, ProfileIdent, Settings, StatusData, Temperatures, WiFiConfig, WiFiConnectRequest, WiFiNetwork } from './types';
import { Profile } from 'meticulous-typescript-profile';
export * from './react';
export * from './types';
export * from './wrapper';
export interface MachineDataClientOptions {
    onStatus?: (data: StatusData) => void;
    onTemperatures?: (data: Temperatures) => void;
    onCommunication?: (data: Communication) => void;
    onActuators?: (data: Actuators) => void;
    onMachineInfo?: (data: MachineInfo) => void;
}
export default class Api {
    private options?;
    private axiosInstance;
    private socket;
    private serverURL;
    constructor(options?: MachineDataClientOptions | undefined, base_url?: string);
    disconnectSocket(): void;
    getSocket(): Socket<import("@socket.io/component-emitter").DefaultEventsMap, import("@socket.io/component-emitter").DefaultEventsMap> | undefined;
    connectToSocket(): void;
    executeAction(action: ActionType): Promise<AxiosResponse<ActionResponse | APIError>>;
    listProfiles(): Promise<AxiosResponse<ProfileIdent[] | APIError>>;
    fetchAllProfiles(): Promise<AxiosResponse<Profile[] | APIError>>;
    saveProfile(data: Profile): Promise<AxiosResponse<ProfileIdent | APIError>>;
    loadProfileFromJSON(data: Profile): Promise<AxiosResponse<ProfileIdent | APIError>>;
    loadProfileByID(id: string): Promise<AxiosResponse<ProfileIdent | APIError>>;
    getProfile(profileId: string): Promise<AxiosResponse<Profile | APIError>>;
    deleteProfile(profileId: string): Promise<AxiosResponse<ProfileIdent | APIError>>;
    getNotifications(acknowledged: boolean): Promise<AxiosResponse<Notification[] | APIError>>;
    acknowledgeNotification(data: AcknowledgeNotificationRequest): Promise<AxiosResponse<void | APIError>>;
    getSettings(settingName?: string): Promise<AxiosResponse<Settings | APIError>>;
    updateSetting(setting: Partial<Settings>): Promise<AxiosResponse<Settings | APIError>>;
    updateFirmware(formData: FormData): Promise<AxiosResponse<void | APIError>>;
    getWiFiConfig(): Promise<AxiosResponse<WiFiConfig | APIError>>;
    setWiFiConfig(data: Partial<WiFiConfig>): Promise<AxiosResponse<WiFiConfig | APIError>>;
    getWiFiQR(): Promise<AxiosResponse<Blob>>;
    getWiFiQRURL(): string;
    listAvailableWiFi(): Promise<AxiosResponse<WiFiNetwork[] | APIError>>;
    connectToWiFi(data: WiFiConnectRequest): Promise<AxiosResponse<void | APIError>>;
    playSound(sound: string): Promise<AxiosResponse<void | APIError>>;
    listSounds(): Promise<AxiosResponse<string[] | APIError>>;
    listSoundThemes(): Promise<AxiosResponse<string[] | APIError>>;
    getSoundTheme(): Promise<AxiosResponse<string | APIError>>;
    setSoundTheme(theme: string): Promise<AxiosResponse<void | APIError>>;
}
//# sourceMappingURL=index.d.ts.map