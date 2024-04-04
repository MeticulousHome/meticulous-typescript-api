import axios, { AxiosInstance, AxiosResponse } from 'axios';
import {
  APIError,
  AcknowledgeNotificationRequest,
  ActionResponse,
  ActionType,
  Notification,
  ProfileIdent,
  Settings,
  WiFiConfig,
  WiFiConnectRequest,
  WiFiNetwork
} from './types';

import { Profile } from 'meticulous-typescript-profile';

export * from './react';
export * from './types';
export * from './wrapper';

export default class Api {
  private axiosInstance: AxiosInstance;
  constructor(base_url?: string) {
    this.axiosInstance = axios.create({
      baseURL: base_url || 'http://localhost:8080/',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      }
    });
  }

  async executeAction(
    action: ActionType
  ): Promise<AxiosResponse<ActionResponse | APIError>> {
    return this.axiosInstance.get(`/api/v1/action/${action}`);
  }

  async listProfiles(): Promise<AxiosResponse<ProfileIdent[] | APIError>> {
    return this.axiosInstance.get('/api/v1/profile/list');
  }

  async saveProfile(
    data: Profile
  ): Promise<AxiosResponse<ProfileIdent | APIError>> {
    return this.axiosInstance.post('/api/v1/profile/save', data);
  }

  async loadProfile(
    data: Profile
  ): Promise<AxiosResponse<ProfileIdent | APIError>> {
    return this.axiosInstance.post('/api/v1/profile/load', data);
  }

  async getProfile(
    profileId: string
  ): Promise<AxiosResponse<ProfileIdent | APIError>> {
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
    const response = await this.axiosInstance.get('/api/v1/wifi/qr.png', {
      responseType: 'blob'
    });
    return response;
  }

  async listAvailableWiFi(): Promise<AxiosResponse<WiFiNetwork[] | APIError>> {
    return this.axiosInstance.get('/api/v1/wifi/list');
  }

  async connectToWiFi(
    data: WiFiConnectRequest
  ): Promise<AxiosResponse<void | APIError>> {
    return this.axiosInstance.post('/api/v1/wifi/connect', data);
  }

  async playSound(sound: string): Promise<AxiosResponse<void | APIError>> {
    return this.axiosInstance.get(`/sounds/play/${sound}`);
  }

  async listSounds(): Promise<AxiosResponse<string[] | APIError>> {
    return this.axiosInstance.get('/sounds/list');
  }
  async listSoundThemes(): Promise<AxiosResponse<string[] | APIError>> {
    return this.axiosInstance.get('/sounds/theme/list');
  }
  async getSoundTheme(): Promise<AxiosResponse<string | APIError>> {
    return this.axiosInstance.get('/sounds/theme/get');
  }
  async setSoundTheme(theme: string): Promise<AxiosResponse<void | APIError>> {
    return this.axiosInstance.post(`/sounds/theme/set/${theme}`);
  }
}
