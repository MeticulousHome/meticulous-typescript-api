"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiResponseError = void 0;
const _1 = require(".");
class ApiResponseError extends Error {
    constructor(message, cause) {
        super(message);
        this.cause = cause;
        this.name = 'ApiResponseError';
    }
}
exports.ApiResponseError = ApiResponseError;
class ApiWrapper {
    constructor(api = _1.defaultAPI) {
        this.api = api;
        this.executeAction = this.executeAction.bind(this);
        this.listProfiles = this.listProfiles.bind(this);
        this.fetchAllProfiles = this.fetchAllProfiles.bind(this);
        this.saveProfile = this.saveProfile.bind(this);
        this.loadProfileFromJSON = this.loadProfileFromJSON.bind(this);
        this.loadProfileById = this.loadProfileById.bind(this);
        this.getProfile = this.getProfile.bind(this);
        this.deleteProfile = this.deleteProfile.bind(this);
        this.getNotifications = this.getNotifications.bind(this);
        this.acknowledgeNotification = this.acknowledgeNotification.bind(this);
        this.getSettings = this.getSettings.bind(this);
        this.updateSetting = this.updateSetting.bind(this);
        this.updateFirmware = this.updateFirmware.bind(this);
        this.getWiFiConfig = this.getWiFiConfig.bind(this);
        this.setWiFiConfig = this.setWiFiConfig.bind(this);
        this.listAvailableWiFi = this.listAvailableWiFi.bind(this);
        this.connectToWiFi = this.connectToWiFi.bind(this);
        this.playSound = this.playSound.bind(this);
        this.listSounds = this.listSounds.bind(this);
        this.listSoundThemes = this.listSoundThemes.bind(this);
        this.getSoundTheme = this.getSoundTheme.bind(this);
        this.setSoundTheme = this.setSoundTheme.bind(this);
    }
    async executeAction(action) {
        try {
            const response = await this.api.executeAction(action);
            if (response.status !== 200) {
                throw new ApiResponseError(`Error calling machine action: ${response.statusText}`, response.data);
            }
            return;
        }
        catch (error) {
            throw new ApiResponseError('Failed to call machine action', {
                error: error
            });
        }
    }
    async listProfiles() {
        try {
            const response = await this.api.listProfiles();
            if (response.status !== 200) {
                throw new ApiResponseError(`Error listing profiles: ${response.statusText}`, response.data);
            }
            return response.data;
        }
        catch (error) {
            throw new ApiResponseError('Failed to list profiles', {
                error: error
            });
        }
    }
    async fetchAllProfiles() {
        try {
            const response = await this.api.fetchAllProfiles();
            if (response.status !== 200) {
                throw new ApiResponseError(`Error listing profiles: ${response.statusText}`, response.data);
            }
            return response.data;
        }
        catch (error) {
            throw new ApiResponseError('Failed to list profiles', {
                error: error
            });
        }
    }
    async saveProfile(data) {
        try {
            const response = await this.api.saveProfile(data);
            if (response.status !== 200) {
                throw new ApiResponseError(`Error saving profile: ${response.statusText}`, response.data);
            }
            return response.data;
        }
        catch (error) {
            throw new ApiResponseError('Failed to save profile', {
                error: error
            });
        }
    }
    async loadProfileFromJSON(data) {
        try {
            const response = await this.api.loadProfileFromJSON(data);
            if (response.status !== 200) {
                throw new ApiResponseError(`Error loading profile: ${response.statusText}`, response.data);
            }
            return response.data;
        }
        catch (error) {
            throw new ApiResponseError('Failed to load profile', {
                error: error
            });
        }
    }
    async loadProfileById(id) {
        try {
            const response = await this.api.loadProfileByID(id);
            if (response.status !== 200) {
                throw new ApiResponseError(`Error loading profile: ${response.statusText}`, response.data);
            }
            return response.data;
        }
        catch (error) {
            throw new ApiResponseError('Failed to load profile', {
                error: error
            });
        }
    }
    async getProfile(profileId) {
        try {
            const response = await this.api.getProfile(profileId);
            if (response.status !== 200) {
                throw new ApiResponseError(`Error fetching profile: ${response.statusText}`, response.data);
            }
            return response.data;
        }
        catch (error) {
            throw new ApiResponseError('Failed to fetch profile', {
                error: error
            });
        }
    }
    async deleteProfile(profileId) {
        try {
            const response = await this.api.deleteProfile(profileId);
            if (response.status !== 200) {
                throw new ApiResponseError(`Error deleting profile: ${response.statusText}`, response.data);
            }
            return response.data;
        }
        catch (error) {
            throw new ApiResponseError('Failed to delete profile', {
                error: error
            });
        }
    }
    async getNotifications(acknowledged) {
        try {
            const response = await this.api.getNotifications(acknowledged);
            if (response.status !== 200) {
                throw new ApiResponseError(`Error getting notifications: ${response.statusText}`, response.data);
            }
            return response.data;
        }
        catch (error) {
            throw new ApiResponseError('Failed to get notifications', {
                error: error
            });
        }
    }
    async acknowledgeNotification(data) {
        try {
            const response = await this.api.acknowledgeNotification(data);
            if (response.status !== 200) {
                throw new ApiResponseError(`Error acknowledging notification: ${response.statusText}`, response.data);
            }
            return;
        }
        catch (error) {
            throw new ApiResponseError('Failed to acknowledge notification', {
                error: error
            });
        }
    }
    async getSettings(settingName) {
        try {
            const response = await this.api.getSettings(settingName);
            if (response.status !== 200) {
                throw new ApiResponseError(`Error getting settings: ${response.statusText}`, response.data);
            }
            return response.data;
        }
        catch (error) {
            throw new ApiResponseError('Failed to get settings', {
                error: error
            });
        }
    }
    async updateSetting(setting) {
        try {
            const response = await this.api.updateSetting(setting);
            if (response.status !== 200) {
                throw new ApiResponseError(`Error updating setting: ${response.statusText}`, response.data);
            }
        }
        catch (error) {
            throw new ApiResponseError('Failed to update setting', {
                error: error
            });
        }
    }
    async updateFirmware(formData) {
        try {
            const response = await this.api.updateFirmware(formData);
            if (response.status !== 200) {
                throw new ApiResponseError(`Error updating machine firmware: ${response.statusText}`, response.data);
            }
            return;
        }
        catch (error) {
            throw new ApiResponseError('Failed to call machine firmware update', {
                error: error
            });
        }
    }
    async getWiFiConfig() {
        try {
            const response = await this.api.getWiFiConfig();
            if (response.status !== 200) {
                throw new ApiResponseError(`Error getting WiFi config: ${response.statusText}`, response.data);
            }
            return response.data;
        }
        catch (error) {
            throw new ApiResponseError('Failed to get WiFi config', {
                error: error
            });
        }
    }
    async setWiFiConfig(data) {
        try {
            const response = await this.api.setWiFiConfig(data);
            if (response.status !== 200) {
                throw new ApiResponseError(`Error setting WiFi config: ${response.statusText}`, response.data);
            }
            return;
        }
        catch (error) {
            throw new ApiResponseError('Failed to set WiFi config', {
                error: error
            });
        }
    }
    async listAvailableWiFi() {
        try {
            const response = await this.api.listAvailableWiFi();
            if (response.status !== 200) {
                throw new ApiResponseError(`Error listing available WiFi networks: ${response.statusText}`, response.data);
            }
            return response.data;
        }
        catch (error) {
            throw new ApiResponseError('Failed to list available WiFi networks', {
                error: error
            });
        }
    }
    async connectToWiFi(data) {
        try {
            const response = await this.api.connectToWiFi(data);
            if (response.status !== 200) {
                throw new ApiResponseError(`Error connecting to WiFi: ${response.statusText}`, response.data);
            }
        }
        catch (error) {
            throw new ApiResponseError('Failed to connect to WiFi', {
                error: error
            });
        }
    }
    async playSound(sound) {
        try {
            const response = await this.api.playSound(sound);
            if (response.status !== 200) {
                throw new ApiResponseError(`Error playing sound: ${response.statusText}`, response.data);
            }
        }
        catch (error) {
            throw new ApiResponseError('Failed to play sound', { error });
        }
    }
    async listSounds() {
        try {
            const response = await this.api.listSounds();
            if (response.status !== 200) {
                throw new ApiResponseError(`Error listing sounds: ${response.statusText}`, response.data);
            }
            return response.data;
        }
        catch (error) {
            throw new ApiResponseError('Failed to list sounds', { error });
        }
    }
    async listSoundThemes() {
        try {
            const response = await this.api.listSoundThemes();
            if (response.status !== 200) {
                throw new ApiResponseError(`Error listing themes: ${response.statusText}`, response.data);
            }
            return response.data;
        }
        catch (error) {
            throw new ApiResponseError('Failed to list themes', { error });
        }
    }
    async getSoundTheme() {
        try {
            const response = await this.api.getSoundTheme();
            if (response.status !== 200) {
                throw new ApiResponseError(`Error getting current theme: ${response.statusText}`, response.data);
            }
            return response.data;
        }
        catch (error) {
            throw new ApiResponseError('Failed to get current theme', { error });
        }
    }
    async setSoundTheme(theme) {
        try {
            const response = await this.api.setSoundTheme(theme);
            if (response.status !== 200) {
                throw new ApiResponseError(`Error setting theme: ${response.statusText}`, response.data);
            }
        }
        catch (error) {
            throw new ApiResponseError('Failed to set theme', { error });
        }
    }
}
exports.default = ApiWrapper;
//# sourceMappingURL=wrapper.js.map