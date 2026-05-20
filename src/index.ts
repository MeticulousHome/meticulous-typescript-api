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
  NotificationItem,
  ProfileIdent,
  ProfileShortIdent,
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
  TestType,
  DefaultProfiles,
  DraftInfo,
  MeticulousIDRequestType,
  PaginatedResponse,
  PageParams,
  ReportInfo,
  SubmitInfo
} from './types';

import { Profile } from '@meticulous-home/espresso-profile';

export * from './types';

export interface MachineDataClientOptions {
  onStatus?: (data: StatusData) => void;
  onTemperatures?: (data: Temperatures) => void;
  onCommunication?: (data: Communication) => void;
  onActuators?: (data: Actuators) => void;
  onProfileUpdate?: (data: ProfileUpdate) => void;
  onNotification?: (data: NotificationItem) => void;
}

export type ReportResult<T> = T | APIError;

const REPORT_INFO_KEYS: (keyof ReportInfo)[] = [
  'description',
  'dateAndTime',
  'attachments',
  'multimedia',
  'machineID',
  'eventID',
  'baseEventID',
  'ticket',
  'localID'
];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAPIError(value: unknown): value is APIError {
  return isObject(value) && typeof value.error === 'string';
}

function parseAPIError(
  value: unknown,
  description?: string,
  data?: object
): APIError {
  if (isAPIError(value)) {
    return value;
  }

  let error: APIError = {
    error: 'Request failed',
    description: description ? description : ''
  };

  if (typeof value === 'string' && value.length > 0) {
    error['error'] = value;
  } else {
    error['data'] = { value: value };
  }

  if (data) {
    error['data'] = error['data'] ? { ...error['data'], data: data } : data;
  }

  return error;
}

async function parseBinaryErrorBody(value: unknown): Promise<APIError> {
  if (value instanceof ArrayBuffer) {
    const body = new TextDecoder().decode(value);
    try {
      return parseAPIError(JSON.parse(body));
    } catch {
      return parseAPIError(body);
    }
  }

  if (value instanceof Blob) {
    return parseBinaryErrorBody(await value.arrayBuffer());
  }

  return parseAPIError(value);
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

  async listProfiles(): Promise<
    AxiosResponse<Omit<Profile, 'stages'>[] | APIError>
  > {
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
  ): Promise<AxiosResponse<ProfileShortIdent | APIError>> {
    return this.axiosInstance.post(`/api/${this.version}/profile/load`, data);
  }

  async loadProfileByID(
    id: string
  ): Promise<AxiosResponse<ProfileShortIdent | APIError>> {
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
  ): Promise<AxiosResponse<NotificationItem[] | APIError>> {
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

  async requestTest(test: TestType): Promise<AxiosResponse<void | APIError>> {
    return this.axiosInstance.get(`/api/${this.version}/test/${test}`);
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

  async createReport(): Promise<ReportResult<DraftInfo>> {
    try {
      const response = await this.axiosInstance.post<DraftInfo | APIError>(
        `/api/${this.version}/reports/create`,
        undefined,
        {
          headers: {
            Accept: 'application/json'
          }
        }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        return parseAPIError(error.response?.data);
      }
      return parseAPIError(error);
    }
  }

  async getReports(
    pageParams: PageParams
  ): Promise<ReportResult<PaginatedResponse<ReportInfo>>> {
    try {
      const response = await this.axiosInstance.get<
        PaginatedResponse<ReportInfo> | APIError
      >(`/api/${this.version}/reports/list`, {
        headers: {
          Accept: 'application/json'
        },
        params: pageParams
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        return parseAPIError(error.response?.data);
      }
      return parseAPIError(error);
    }
  }

  async getDraftReport(localID: string): Promise<ReportResult<Uint8Array>> {
    try {
      const response = await this.axiosInstance.get<ArrayBuffer | APIError>(
        `/api/${this.version}/reports/draft/${localID}`,
        {
          headers: {
            Accept: 'application/octet-stream'
          },
          responseType: 'arraybuffer'
        }
      );

      return new Uint8Array(response.data as ArrayBuffer);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        return parseBinaryErrorBody(error.response?.data);
      }
      return parseAPIError(error);
    }
  }

  async updateReport(
    id: string,
    patch: Partial<ReportInfo>
  ): Promise<ReportResult<ReportInfo>> {
    try {
      const normalizedReport: Partial<ReportInfo> = {};
      REPORT_INFO_KEYS.forEach((key) => {
        if (key in patch) {
          normalizedReport[key] = (patch[key] ?? null) as never;
        }
      });

      const response = await this.axiosInstance.put<ReportInfo | APIError>(
        `/api/${this.version}/reports/draft/${id}`,
        normalizedReport,
        {
          headers: {
            Accept: 'application/json'
          }
        }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        return parseAPIError(error.response?.data);
      }
      return parseAPIError(error);
    }
  }

  async markSubmittedReport(
    submitInfo: SubmitInfo
  ): Promise<ReportResult<void>> {
    try {
      const response = await this.axiosInstance.post<void | APIError>(
        `/api/${this.version}/reports/submit`,
        submitInfo,
        {
          headers: {
            Accept: 'application/json'
          }
        }
      );
      return isAPIError(response.data) ? response.data : undefined;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        return parseAPIError(error.response?.data);
      }
      return parseAPIError(error);
    }
  }

  async getMeticulousReportTracking(
    serviceUrl: string,
    payload: MeticulousIDRequestType
  ): Promise<ReportResult<number>> {
    try {
      const response = await axios.post<{ ticket: number } | APIError>(
        serviceUrl,
        payload,
        {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json'
          }
        }
      );

      if (isAPIError(response.data)) {
        return response.data;
      }

      return response.data.ticket;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        return parseAPIError(error.response?.data);
      }
      return parseAPIError(error);
    }
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
