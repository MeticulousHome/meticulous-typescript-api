import { UUID } from 'meticulous-typescript-profile/dist/uuid';
import Api from '.';
import {
  APIError,
  ActionType,
  ProfileIdent,
  Notification,
  AcknowledgeNotificationRequest,
  Settings,
  WiFiConfig,
  WiFiConnectRequest,
  WiFiNetwork
} from './types';
import { Profile } from 'meticulous-typescript-profile';

export class ApiResponseError extends Error {
  constructor(
    message: string,
    public cause: object
  ) {
    super(message);
    this.name = 'ApiResponseError';
  }
}

export default class ApiWrapper {
  public api = new Api();

  public async executeAction(action: ActionType): Promise<void> {
    try {
      const response = await this.api.executeAction(action);
      if (response.status !== 200) {
        throw new ApiResponseError(
          `Error calling machine action: ${response.statusText}`,
          response.data as APIError
        );
      }
      return;
    } catch (error) {
      throw new ApiResponseError('Failed to call machine action', {
        error: error
      });
    }
  }

  public async listProfiles(): Promise<ProfileIdent[]> {
    try {
      const response = await this.api.listProfiles();
      if (response.status !== 200) {
        throw new ApiResponseError(
          `Error listing profiles: ${response.statusText}`,
          response.data as APIError
        );
      }
      return response.data as ProfileIdent[];
    } catch (error) {
      throw new ApiResponseError('Failed to list profiles', {
        error: error
      });
    }
  }

  public async fetchAllProfiles(): Promise<Profile[]> {
    try {
      const response = await this.api.fetchAllProfiles();
      if (response.status !== 200) {
        throw new ApiResponseError(
          `Error listing profiles: ${response.statusText}`,
          response.data as APIError
        );
      }
      return response.data as Profile[];
    } catch (error) {
      throw new ApiResponseError('Failed to list profiles', {
        error: error
      });
    }
  }

  public async saveProfile(data: Profile): Promise<ProfileIdent> {
    try {
      const response = await this.api.saveProfile(data);
      if (response.status !== 200) {
        throw new ApiResponseError(
          `Error saving profile: ${response.statusText}`,
          response.data as APIError
        );
      }
      return response.data as ProfileIdent;
    } catch (error) {
      throw new ApiResponseError('Failed to save profile', {
        error: error
      });
    }
  }

  public async loadProfileFromJSON(data: Profile): Promise<ProfileIdent> {
    try {
      const response = await this.api.loadProfileFromJSON(data);
      if (response.status !== 200) {
        throw new ApiResponseError(
          `Error loading profile: ${response.statusText}`,
          response.data as APIError
        );
      }
      return response.data as ProfileIdent;
    } catch (error) {
      throw new ApiResponseError('Failed to load profile', {
        error: error
      });
    }
  }

  public async loadProfileById(id: UUID): Promise<ProfileIdent> {
    try {
      const response = await this.api.loadProfileByID(id);
      if (response.status !== 200) {
        throw new ApiResponseError(
          `Error loading profile: ${response.statusText}`,
          response.data as APIError
        );
      }
      return response.data as ProfileIdent;
    } catch (error) {
      throw new ApiResponseError('Failed to load profile', {
        error: error
      });
    }
  }

  public async getProfile(profileId: string): Promise<Profile> {
    try {
      const response = await this.api.getProfile(profileId);
      if (response.status !== 200) {
        throw new ApiResponseError(
          `Error fetching profile: ${response.statusText}`,
          response.data as APIError
        );
      }
      return response.data as Profile;
    } catch (error) {
      throw new ApiResponseError('Failed to fetch profile', {
        error: error
      });
    }
  }

  public async deleteProfile(profileId: string): Promise<ProfileIdent> {
    try {
      const response = await this.api.deleteProfile(profileId);
      if (response.status !== 200) {
        throw new ApiResponseError(
          `Error deleting profile: ${response.statusText}`,
          response.data as APIError
        );
      }
      return response.data as ProfileIdent;
    } catch (error) {
      throw new ApiResponseError('Failed to delete profile', {
        error: error
      });
    }
  }

  public async getNotifications(
    acknowledged: boolean
  ): Promise<Notification[]> {
    try {
      const response = await this.api.getNotifications(acknowledged);
      if (response.status !== 200) {
        throw new ApiResponseError(
          `Error getting notifications: ${response.statusText}`,
          response.data as APIError
        );
      }
      return response.data as Notification[];
    } catch (error) {
      throw new ApiResponseError('Failed to get notifications', {
        error: error
      });
    }
  }

  public async acknowledgeNotification(
    data: AcknowledgeNotificationRequest
  ): Promise<void> {
    try {
      const response = await this.api.acknowledgeNotification(data);
      if (response.status !== 200) {
        throw new ApiResponseError(
          `Error acknowledging notification: ${response.statusText}`,
          response.data as APIError
        );
      }
      return;
    } catch (error) {
      throw new ApiResponseError('Failed to acknowledge notification', {
        error: error
      });
    }
  }

  public async getSettings(settingName?: string): Promise<Settings> {
    try {
      const response = await this.api.getSettings(settingName);
      if (response.status !== 200) {
        throw new ApiResponseError(
          `Error getting settings: ${response.statusText}`,
          response.data as APIError
        );
      }
      return response.data as Settings;
    } catch (error) {
      throw new ApiResponseError('Failed to get settings', {
        error: error
      });
    }
  }

  public async updateSetting(setting: Settings): Promise<void> {
    try {
      const response = await this.api.updateSetting(setting);
      if (response.status !== 200) {
        throw new ApiResponseError(
          `Error updating setting: ${response.statusText}`,
          response.data
        );
      }
    } catch (error) {
      throw new ApiResponseError('Failed to update setting', {
        error: error
      });
    }
  }

  public async updateFirmware(formData: FormData): Promise<void> {
    try {
      const response = await this.api.updateFirmware(formData);
      if (response.status !== 200) {
        throw new ApiResponseError(
          `Error updating machine firmware: ${response.statusText}`,
          response.data as APIError
        );
      }
      return;
    } catch (error) {
      throw new ApiResponseError('Failed to call machine firmware update', {
        error: error
      });
    }
  }

  public async getWiFiConfig(): Promise<WiFiConfig> {
    try {
      const response = await this.api.getWiFiConfig();
      if (response.status !== 200) {
        throw new ApiResponseError(
          `Error getting WiFi config: ${response.statusText}`,
          response.data as APIError
        );
      }
      return response.data as WiFiConfig;
    } catch (error) {
      throw new ApiResponseError('Failed to get WiFi config', {
        error: error
      });
    }
  }

  public async setWiFiConfig(data: WiFiConfig): Promise<void> {
    try {
      const response = await this.api.setWiFiConfig(data);
      if (response.status !== 200) {
        throw new ApiResponseError(
          `Error setting WiFi config: ${response.statusText}`,
          response.data as APIError
        );
      }
      return;
    } catch (error) {
      throw new ApiResponseError('Failed to set WiFi config', {
        error: error
      });
    }
  }

  public async listAvailableWiFi(): Promise<WiFiNetwork[]> {
    try {
      const response = await this.api.listAvailableWiFi();
      if (response.status !== 200) {
        throw new ApiResponseError(
          `Error listing available WiFi networks: ${response.statusText}`,
          response.data as APIError
        );
      }
      return response.data as WiFiNetwork[];
    } catch (error) {
      throw new ApiResponseError('Failed to list available WiFi networks', {
        error: error
      });
    }
  }

  public async connectToWiFi(data: WiFiConnectRequest): Promise<void> {
    try {
      const response = await this.api.connectToWiFi(data);
      if (response.status !== 200) {
        throw new ApiResponseError(
          `Error connecting to WiFi: ${response.statusText}`,
          response.data as APIError
        );
      }
    } catch (error) {
      throw new ApiResponseError('Failed to connect to WiFi', {
        error: error
      });
    }
  }

  public async playSound(sound: string): Promise<void> {
    try {
      const response = await this.api.playSound(sound);
      if (response.status !== 200) {
        throw new ApiResponseError(
          `Error playing sound: ${response.statusText}`,
          response.data as APIError
        );
      }
    } catch (error) {
      throw new ApiResponseError('Failed to play sound', { error });
    }
  }

  public async listSounds(): Promise<string[]> {
    try {
      const response = await this.api.listSounds();
      if (response.status !== 200) {
        throw new ApiResponseError(
          `Error listing sounds: ${response.statusText}`,
          response.data as APIError
        );
      }
      return response.data as string[];
    } catch (error) {
      throw new ApiResponseError('Failed to list sounds', { error });
    }
  }

  public async listSoundThemes(): Promise<string[]> {
    try {
      const response = await this.api.listSoundThemes();
      if (response.status !== 200) {
        throw new ApiResponseError(
          `Error listing themes: ${response.statusText}`,
          response.data as APIError
        );
      }
      return response.data as string[];
    } catch (error) {
      throw new ApiResponseError('Failed to list themes', { error });
    }
  }

  public async getSoundTheme(): Promise<string> {
    try {
      const response = await this.api.getSoundTheme();
      if (response.status !== 200) {
        throw new ApiResponseError(
          `Error getting current theme: ${response.statusText}`,
          response.data as APIError
        );
      }
      return response.data as string;
    } catch (error) {
      throw new ApiResponseError('Failed to get current theme', { error });
    }
  }

  public async setSoundTheme(theme: string): Promise<void> {
    try {
      const response = await this.api.setSoundTheme(theme);
      if (response.status !== 200) {
        throw new ApiResponseError(
          `Error setting theme: ${response.statusText}`,
          response.data as APIError
        );
      }
    } catch (error) {
      throw new ApiResponseError('Failed to set theme', { error });
    }
  }
}
