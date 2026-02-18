import { AxiosResponse } from 'axios';
import { Socket } from 'socket.io-client';
import { OSStatusResponse, APIError, AcknowledgeNotificationRequest, ActionResponse, ActionType, Actuators, BrightnessRequest, Communication, DeviceInfo, HistoryEntry, HistoryListingResponse, HistoryQueryParams, HistoryResponse, HistoryStats, LastProfileIdent, Notification, ProfileIdent, ProfileUpdate, Settings, StatusData, Temperatures, WiFiConfig, WiFiCredentials, WiFiNetwork, WifiStatus, Regions, regionType, ManufacturingMenuItems, ManufacturingSettings, ShotRating, ShotRatingResponse, RateShotResponse, TestType, DefaultProfiles } from './types';
import { Profile } from '@meticulous-home/espresso-profile';
export * from './types';
export interface MachineDataClientOptions {
    onStatus?: (data: StatusData) => void;
    onTemperatures?: (data: Temperatures) => void;
    onCommunication?: (data: Communication) => void;
    onActuators?: (data: Actuators) => void;
    onProfileUpdate?: (data: ProfileUpdate) => void;
    onNotification?: (data: Notification) => void;
}
export default class Api {
    private options?;
    private axiosInstance;
    private socket;
    private serverURL;
    private version;
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
    getLastProfile(): Promise<AxiosResponse<LastProfileIdent | APIError>>;
    getProfileDefaultImages(): Promise<AxiosResponse<string[] | APIError>>;
    getProfileImageUrl(image: string): string;
    getProfileImage(image: string): Promise<AxiosResponse<Blob>>;
    getNotifications(acknowledged: boolean): Promise<AxiosResponse<Notification[] | APIError>>;
    acknowledgeNotification(data: AcknowledgeNotificationRequest): Promise<AxiosResponse<void | APIError>>;
    getSettings(settingName?: string): Promise<AxiosResponse<Settings | APIError>>;
    updateSetting(setting: Partial<Settings>): Promise<AxiosResponse<Settings | APIError>>;
    getManufacturingMenuItems(): Promise<AxiosResponse<ManufacturingMenuItems | APIError>>;
    updateManufacturingSettings(setting: Partial<ManufacturingSettings>): Promise<AxiosResponse<ManufacturingSettings | APIError>>;
    updateFirmware(formData: FormData): Promise<AxiosResponse<void | APIError>>;
    getWiFiStatus(): Promise<AxiosResponse<WifiStatus | APIError>>;
    setWiFiConfig(data: Partial<WiFiConfig>): Promise<AxiosResponse<WiFiConfig | APIError>>;
    requestTest(test: TestType): Promise<AxiosResponse<void | APIError>>;
    getWiFiQR(): Promise<AxiosResponse<Blob>>;
    getWiFiQRURL(): string;
    listAvailableWiFi(): Promise<AxiosResponse<WiFiNetwork[] | APIError>>;
    connectToWiFi(data: WiFiCredentials): Promise<AxiosResponse<void | APIError>>;
    deleteWifi({ ssid }: {
        ssid: string;
    }): Promise<AxiosResponse<void | APIError>>;
    playSound(sound: string): Promise<AxiosResponse<void | APIError>>;
    listSounds(): Promise<AxiosResponse<string[] | APIError>>;
    listSoundThemes(): Promise<AxiosResponse<string[] | APIError>>;
    getSoundTheme(): Promise<AxiosResponse<string | APIError>>;
    setSoundTheme(theme: string): Promise<AxiosResponse<void | APIError>>;
    getDeviceInfo(): Promise<AxiosResponse<DeviceInfo | APIError>>;
    setBrightness(brightness: BrightnessRequest): Promise<AxiosResponse<APIError | null>>;
    getDefaultProfiles(): Promise<AxiosResponse<Profile[] | DefaultProfiles | APIError>>;
    getHistoryShortListing(): Promise<AxiosResponse<HistoryListingResponse>>;
    searchHistory(query: Partial<HistoryQueryParams>): Promise<AxiosResponse<HistoryResponse>>;
    searchHistoricalProfiles(query: string): Promise<AxiosResponse<HistoryListingResponse>>;
    getCurrentShot(): Promise<AxiosResponse<HistoryEntry | null>>;
    getLastShot(): Promise<AxiosResponse<HistoryEntry | null>>;
    getHistoryStatistics(): Promise<AxiosResponse<HistoryStats>>;
    getOSStatus(): Promise<AxiosResponse<OSStatusResponse>>;
    getTimezoneRegion(region_type: regionType, conditional: string): Promise<AxiosResponse<Regions | APIError>>;
    getRootPassword(): Promise<AxiosResponse<{
        status: string;
        root_password: string;
    } | APIError>>;
    setTime(dateTime: Date): Promise<AxiosResponse<Regions | APIError>>;
    rateShot(shotId: number, rating: ShotRating): Promise<AxiosResponse<RateShotResponse | APIError>>;
    getShotRating(shotId: number): Promise<AxiosResponse<ShotRatingResponse | APIError>>;
}
//# sourceMappingURL=index.d.ts.map