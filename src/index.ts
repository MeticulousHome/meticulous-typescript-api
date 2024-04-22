import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { Socket, io } from 'socket.io-client';

import {
  APIError,
  AcknowledgeNotificationRequest,
  ActionResponse,
  ActionType,
  Actuators,
  Communication,
  MachineInfo,
  Notification,
  ProfileIdent,
  Settings,
  StatusData,
  Temperatures,
  WiFiConfig,
  WiFiConnectRequest,
  WiFiNetwork
} from './types';

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
  private axiosInstance: AxiosInstance;
  private socket: Socket | undefined = undefined;

  private serverURL: string;

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
    if (this.options && this.options.onMachineInfo) {
      this.socket.on('info', this.options && this.options.onMachineInfo);
    }
  }

  async executeAction(
    action: ActionType
  ): Promise<AxiosResponse<ActionResponse | APIError>> {
    return this.axiosInstance.get(`/api/v1/action/${action}`);
  }

  async listProfiles(): Promise<AxiosResponse<ProfileIdent[] | APIError>> {
    return this.axiosInstance.get('/api/v1/profile/list');
  }

  async fetchAllProfiles(): Promise<AxiosResponse<Profile[] | APIError>> {
    return this.axiosInstance.get('/api/v1/profile/list?full=true');
  }

  async saveProfile(
    data: Profile
  ): Promise<AxiosResponse<ProfileIdent | APIError>> {
    return this.axiosInstance.post('/api/v1/profile/save', data);
  }

  async loadProfileFromJSON(
    data: Profile
  ): Promise<AxiosResponse<ProfileIdent | APIError>> {
    return this.axiosInstance.post('/api/v1/profile/load', data);
  }

  async loadProfileByID(
    id: string
  ): Promise<AxiosResponse<ProfileIdent | APIError>> {
    return this.axiosInstance.get(`/api/v1/profile/load/${id.toString()}`);
  }

  async getProfile(
    profileId: string
  ): Promise<AxiosResponse<Profile | APIError>> {
    return this.axiosInstance.get(`/api/v1/profile/get/${profileId}`);
  }

  async deleteProfile(
    profileId: string
  ): Promise<AxiosResponse<ProfileIdent | APIError>> {
    return this.axiosInstance.delete(`/api/v1/profile/delete/${profileId}`);
  }

  async getNotifications(
    acknowledged: boolean
  ): Promise<AxiosResponse<Notification[] | APIError>> {
    return this.axiosInstance.get(
      `/api/v1/notifications?acknowledged=${acknowledged}`
    );
  }

  async acknowledgeNotification(
    data: AcknowledgeNotificationRequest
  ): Promise<AxiosResponse<void | APIError>> {
    return this.axiosInstance.post('/api/v1/notifications/acknowledge', data);
  }

  async getSettings(
    settingName?: string
  ): Promise<AxiosResponse<Settings | APIError>> {
    const url = '/api/v1/settings' + (settingName ? `/${settingName}` : '');
    return this.axiosInstance.get(url);
  }

  async updateSetting(
    setting: Partial<Settings>
  ): Promise<AxiosResponse<Settings | APIError>> {
    return this.axiosInstance.post('/api/v1/settings', setting);
  }

  async updateFirmware(
    formData: FormData
  ): Promise<AxiosResponse<void | APIError>> {
    return this.axiosInstance.post('/api/v1/update/firmware', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
  }

  async getWiFiConfig(): Promise<AxiosResponse<WiFiConfig | APIError>> {
    return this.axiosInstance.get('/api/v1/wifi/config');
  }

  async setWiFiConfig(
    data: Partial<WiFiConfig>
  ): Promise<AxiosResponse<WiFiConfig | APIError>> {
    return this.axiosInstance.post('/api/v1/wifi/config', data);
  }

  async getWiFiQR(): Promise<AxiosResponse<Blob>> {
    const response = await this.axiosInstance.get(
      '/api/v1/wifi/config/qr.png',
      {
        responseType: 'blob'
      }
    );
    return response;
  }

  getWiFiQRURL(): string {
    return this.axiosInstance.getUri() + 'api/v1/wifi/config/qr.png';
  }

  async listAvailableWiFi(): Promise<AxiosResponse<WiFiNetwork[] | APIError>> {
    return this.axiosInstance.get('/api/v1/wifi/list');
  }

  async connectToWiFi(
    data: WiFiConnectRequest
  ): Promise<AxiosResponse<void | APIError>> {
    return this.axiosInstance.post('/api/v1/wifi/connect', data);
  }

  async deleteWifi({
    ssid
  }: {
    ssid: string;
  }): Promise<AxiosResponse<void | APIError>> {
    return this.axiosInstance.post('/api/v1/wifi/delete', { ssid });
  }

  async playSound(sound: string): Promise<AxiosResponse<void | APIError>> {
    return this.axiosInstance.get(`/api/v1/sounds/play/${sound}`);
  }

  async listSounds(): Promise<AxiosResponse<string[] | APIError>> {
    return this.axiosInstance.get('/api/v1/sounds/list');
  }

  async listSoundThemes(): Promise<AxiosResponse<string[] | APIError>> {
    return this.axiosInstance.get('/api/v1/sounds/theme/list');
  }

  async getSoundTheme(): Promise<AxiosResponse<string | APIError>> {
    return this.axiosInstance.get('/api/v1/sounds/theme/get');
  }

  async setSoundTheme(theme: string): Promise<AxiosResponse<void | APIError>> {
    return this.axiosInstance.post(`/api/v1/sounds/theme/set/${theme}`);
  }
}
