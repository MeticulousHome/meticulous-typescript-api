import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { Socket, io } from 'socket.io-client';

import {
  OSStatusResponse,
  APIError,
  AcknowledgeNotificationRequest,
  ActionResponse,
  ActionType,
  Actuators,
  BrightnessRequest,
  Communication,
  DeviceInfo,
  HistoryEntry,
  HistoryListingResponse,
  HistoryQueryParams,
  HistoryResponse,
  HistoryStats,
  LastProfileIdent,
  Notification,
  ProfileIdent,
  ProfileUpdate,
  Settings,
  StatusData,
  Temperatures,
  WiFiConfig,
  WiFiCredentials,
  WiFiNetwork,
  WifiStatus,
  Regions,
  regionType,
  ManufacturingMenuItems,
  ManufacturingSettings,
  ShotRating,
  ShotRatingResponse,
  RateShotResponse,
  DefaultProfiles
} from './types';

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
  private axiosInstance: AxiosInstance;
  private socket: Socket | undefined = undefined;

  private serverURL: string;
  private version: string = 'v1';

  constructor(
    private options?: MachineDataClientOptions,
    base_url?: string
  ) {
    const serverURL = base_url || 'http://localhost:8080/';
    this.serverURL = serverURL;

    // AXIOS
    this.axiosInstance = axios.create({
      baseURL: serverURL,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      }
    });
  }

  disconnectSocket() {
    if (this.socket !== undefined) {
      this.socket.disconnect();
      this.socket = undefined;
    }
  }

  getSocket() {
    return this.socket;
  }

  connectToSocket() {
    // Socket.io
    this.socket = io(this.serverURL);

    if (this.options && this.options.onStatus) {
      this.socket.on('status', this.options && this.options.onStatus);
    }
    if (this.options && this.options.onTemperatures) {
      this.socket.on('sensors', this.options && this.options.onTemperatures);
    }
    if (this.options && this.options.onCommunication) {
      this.socket.on(
        'communication',
        this.options && this.options.onCommunication
      );
    }
    if (this.options && this.options.onActuators) {
      this.socket.on('actuators', this.options && this.options.onActuators);
    }
  }

  async executeAction(
    action: ActionType
  ): Promise<AxiosResponse<ActionResponse | APIError>> {
    return this.axiosInstance.get(`/api/${this.version}/action/${action}`);
  }

  async listProfiles(): Promise<AxiosResponse<ProfileIdent[] | APIError>> {
    return this.axiosInstance.get(`/api/${this.version}/profile/list`);
  }

  async fetchAllProfiles(): Promise<AxiosResponse<Profile[] | APIError>> {
    return this.axiosInstance.get(
      `/api/${this.version}/profile/list?full=true`
    );
  }

  async saveProfile(
    data: Profile
  ): Promise<AxiosResponse<ProfileIdent | APIError>> {
    return this.axiosInstance.post(`/api/${this.version}/profile/save`, data);
  }

  async loadProfileFromJSON(
    data: Profile
  ): Promise<AxiosResponse<ProfileIdent | APIError>> {
    return this.axiosInstance.post(`/api/${this.version}/profile/load`, data);
  }

  async loadProfileByID(
    id: string
  ): Promise<AxiosResponse<ProfileIdent | APIError>> {
    return this.axiosInstance.get(
      `/api/${this.version}/profile/load/${id.toString()}`
    );
  }

  async getProfile(
    profileId: string
  ): Promise<AxiosResponse<Profile | APIError>> {
    return this.axiosInstance.get(
      `/api/${this.version}/profile/get/${profileId}`
    );
  }

  async deleteProfile(
    profileId: string
  ): Promise<AxiosResponse<ProfileIdent | APIError>> {
    return this.axiosInstance.delete(
      `/api/${this.version}/profile/delete/${profileId}`
    );
  }

  async getLastProfile(): Promise<AxiosResponse<LastProfileIdent | APIError>> {
    return this.axiosInstance.get(`/api/${this.version}/profile/last`);
  }

  async getProfileDefaultImages(): Promise<AxiosResponse<string[] | APIError>> {
    return this.axiosInstance.get(`/api/${this.version}/profile/image`);
  }

  getProfileImageUrl(image: string): string {
    if (image.startsWith('data:')) {
      return image;
    }
    const url = `/api/${this.version}/profile/image/`;
    if (!image.startsWith(url)) {
      image = url + image;
    }
    return image;
  }

  async getProfileImage(image: string): Promise<AxiosResponse<Blob>> {
    const response = await this.axiosInstance.get(
      this.getProfileImageUrl(image),
      {
        responseType: 'blob'
      }
    );
    return response;
  }

  async getNotifications(
    acknowledged: boolean
  ): Promise<AxiosResponse<Notification[] | APIError>> {
    return this.axiosInstance.get(
      `/api/${this.version}/notifications?acknowledged=${acknowledged}`
    );
  }

  async acknowledgeNotification(
    data: AcknowledgeNotificationRequest
  ): Promise<AxiosResponse<void | APIError>> {
    return this.axiosInstance.post(
      `/api/${this.version}/notifications/acknowledge`,
      data
    );
  }

  async getSettings(
    settingName?: string
  ): Promise<AxiosResponse<Settings | APIError>> {
    const url =
      `/api/${this.version}/settings/` + (settingName ? `${settingName}` : '');
    return this.axiosInstance.get(url);
  }

  async updateSetting(
    setting: Partial<Settings>
  ): Promise<AxiosResponse<Settings | APIError>> {
    return this.axiosInstance.post(`/api/${this.version}/settings/`, setting);
  }
  async getManufacturingMenuItems(): Promise<
    AxiosResponse<ManufacturingMenuItems | APIError>
  > {
    const url = `/api/${this.version}/manufacturing`;
    return this.axiosInstance.get(url);
  }

  async updateManufacturingSettings(
    setting: Partial<ManufacturingSettings>
  ): Promise<AxiosResponse<ManufacturingSettings | APIError>> {
    return this.axiosInstance.post(
      `/api/${this.version}/manufacturing`,
      setting
    );
  }

  async updateFirmware(
    formData: FormData
  ): Promise<AxiosResponse<void | APIError>> {
    return this.axiosInstance.post(
      `/api/${this.version}/update/firmware`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      }
    );
  }

  async getWiFiStatus(): Promise<AxiosResponse<WifiStatus | APIError>> {
    return this.axiosInstance.get(`/api/${this.version}/wifi/config`);
  }

  async setWiFiConfig(
    data: Partial<WiFiConfig>
  ): Promise<AxiosResponse<WiFiConfig | APIError>> {
    return this.axiosInstance.post(`/api/${this.version}/wifi/config`, data);
  }

  async getWiFiQR(): Promise<AxiosResponse<Blob>> {
    const response = await this.axiosInstance.get(
      `/api/${this.version}/wifi/config/qr.png`,
      {
        responseType: 'blob'
      }
    );
    return response;
  }

  getWiFiQRURL(): string {
    return new URL(
      `/api/${this.version}/wifi/config/qr.png`,
      this.axiosInstance.getUri()
    ).toString();
  }

  async listAvailableWiFi(): Promise<AxiosResponse<WiFiNetwork[] | APIError>> {
    return this.axiosInstance.get(`/api/${this.version}/wifi/list`);
  }

  async connectToWiFi(
    data: WiFiCredentials
  ): Promise<AxiosResponse<void | APIError>> {
    return this.axiosInstance.post(`/api/${this.version}/wifi/connect`, data);
  }

  async deleteWifi({
    ssid
  }: {
    ssid: string;
  }): Promise<AxiosResponse<void | APIError>> {
    return this.axiosInstance.post(`/api/${this.version}/wifi/delete`, {
      ssid
    });
  }

  async playSound(sound: string): Promise<AxiosResponse<void | APIError>> {
    return this.axiosInstance.get(`/api/${this.version}/sounds/play/${sound}`);
  }

  async listSounds(): Promise<AxiosResponse<string[] | APIError>> {
    return this.axiosInstance.get(`/api/${this.version}/sounds/list`);
  }

  async listSoundThemes(): Promise<AxiosResponse<string[] | APIError>> {
    return this.axiosInstance.get(`/api/${this.version}/sounds/theme/list`);
  }

  async getSoundTheme(): Promise<AxiosResponse<string | APIError>> {
    return this.axiosInstance.get(`/api/${this.version}/sounds/theme/get`);
  }

  async setSoundTheme(theme: string): Promise<AxiosResponse<void | APIError>> {
    return this.axiosInstance.post(
      `/api/${this.version}/sounds/theme/set/${theme}`
    );
  }

  async getDeviceInfo(): Promise<AxiosResponse<DeviceInfo | APIError>> {
    return this.axiosInstance.get(`/api/${this.version}/machine`);
  }

  async setBrightness(
    brightness: BrightnessRequest
  ): Promise<AxiosResponse<APIError | null>> {
    return this.axiosInstance.post('/api/v1/machine/backlight', brightness);
  }

  async getDefaultProfiles(): Promise<
    AxiosResponse<Profile[] | DefaultProfiles | APIError>
  > {
    return this.axiosInstance.get(`/api/${this.version}/profile/defaults`);
  }

  async getHistoryShortListing(): Promise<
    AxiosResponse<HistoryListingResponse>
  > {
    return this.axiosInstance.get(`/api/${this.version}/history`);
  }

  async searchHistory(
    query: Partial<HistoryQueryParams>
  ): Promise<AxiosResponse<HistoryResponse>> {
    return this.axiosInstance.post(`/api/${this.version}/history`, query);
  }

  async searchHistoricalProfiles(
    query: string
  ): Promise<AxiosResponse<HistoryListingResponse>> {
    return this.axiosInstance.get(
      `/api/${this.version}/history/search?query=` + query
    );
  }

  async getCurrentShot(): Promise<AxiosResponse<HistoryEntry | null>> {
    return this.axiosInstance.get(`/api/${this.version}/history/current`);
  }

  async getLastShot(): Promise<AxiosResponse<HistoryEntry | null>> {
    return this.axiosInstance.get(`/api/${this.version}/history/last`);
  }

  async getHistoryStatistics(): Promise<AxiosResponse<HistoryStats>> {
    return this.axiosInstance.get(`/api/${this.version}/history/stats`);
  }

  async getOSStatus(): Promise<AxiosResponse<OSStatusResponse>> {
    return this.axiosInstance.get(
      `/api/${this.version}/machine/OS_update_status`
    );
  }

  async getTimezoneRegion(
    region_type: regionType,
    conditional: string
  ): Promise<AxiosResponse<Regions | APIError>> {
    return this.axiosInstance.get(
      `/api/${this.version}/timezones/${region_type}`,
      { params: { filter: conditional } }
    );
  }

  async getRootPassword(): Promise<
    AxiosResponse<{ status: string; root_password: string } | APIError>
  > {
    return this.axiosInstance.get(`/api/${this.version}/machine/root-password`);
  }

  async setTime(dateTime: Date): Promise<AxiosResponse<Regions | APIError>> {
    return this.axiosInstance.post(`/api/${this.version}/machine/time`, {
      date: dateTime.toISOString()
    });
  }

  async rateShot(
    shotId: number,
    rating: ShotRating
  ): Promise<AxiosResponse<RateShotResponse | APIError>> {
    return this.axiosInstance.post(
      `/api/${this.version}/history/rating/${shotId}`,
      { rating }
    );
  }

  async getShotRating(
    shotId: number
  ): Promise<AxiosResponse<ShotRatingResponse | APIError>> {
    return this.axiosInstance.get(
      `/api/${this.version}/history/rating/${shotId}`
    );
  }
}
