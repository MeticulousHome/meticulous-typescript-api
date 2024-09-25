"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const socket_io_client_1 = require("socket.io-client");
__exportStar(require("./types"), exports);
class Api {
    constructor(options, base_url) {
        this.options = options;
        this.socket = undefined;
        const serverURL = base_url || 'http://localhost:8080/';
        this.serverURL = serverURL;
        // AXIOS
        this.axiosInstance = axios_1.default.create({
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
        this.socket = (0, socket_io_client_1.io)(this.serverURL);
        if (this.options && this.options.onStatus) {
            this.socket.on('status', this.options && this.options.onStatus);
        }
        if (this.options && this.options.onTemperatures) {
            this.socket.on('sensors', this.options && this.options.onTemperatures);
        }
        if (this.options && this.options.onCommunication) {
            this.socket.on('communication', this.options && this.options.onCommunication);
        }
        if (this.options && this.options.onActuators) {
            this.socket.on('actuators', this.options && this.options.onActuators);
        }
        if (this.options && this.options.onMachineInfo) {
            this.socket.on('info', this.options && this.options.onMachineInfo);
        }
    }
    async executeAction(action) {
        return this.axiosInstance.get(`/api/v1/action/${action}`);
    }
    async listProfiles() {
        return this.axiosInstance.get('/api/v1/profile/list');
    }
    async fetchAllProfiles() {
        return this.axiosInstance.get('/api/v1/profile/list?full=true');
    }
    async saveProfile(data) {
        return this.axiosInstance.post('/api/v1/profile/save', data);
    }
    async loadProfileFromJSON(data) {
        return this.axiosInstance.post('/api/v1/profile/load', data);
    }
    async loadProfileByID(id) {
        return this.axiosInstance.get(`/api/v1/profile/load/${id.toString()}`);
    }
    async getProfile(profileId) {
        return this.axiosInstance.get(`/api/v1/profile/get/${profileId}`);
    }
    async deleteProfile(profileId) {
        return this.axiosInstance.delete(`/api/v1/profile/delete/${profileId}`);
    }
    async getLastProfile() {
        return this.axiosInstance.get('/api/v1/profile/last');
    }
    async getProfileDefaultImages() {
        return this.axiosInstance.get('/api/v1/profile/image');
    }
    getProfileImageUrl(image) {
        if (image.startsWith('data:')) {
            return image;
        }
        const url = '/api/v1/profile/image/';
        if (!image.startsWith(url)) {
            image = url + image;
        }
        return image;
    }
    async getProfileImage(image) {
        const response = await this.axiosInstance.get(this.getProfileImageUrl(image), {
            responseType: 'blob'
        });
        return response;
    }
    async getNotifications(acknowledged) {
        return this.axiosInstance.get(`/api/v1/notifications?acknowledged=${acknowledged}`);
    }
    async acknowledgeNotification(data) {
        return this.axiosInstance.post('/api/v1/notifications/acknowledge', data);
    }
    async getSettings(settingName) {
        const url = '/api/v1/settings' + (settingName ? `/${settingName}` : '');
        return this.axiosInstance.get(url);
    }
    async updateSetting(setting) {
        return this.axiosInstance.post('/api/v1/settings', setting);
    }
    async updateFirmware(formData) {
        return this.axiosInstance.post('/api/v1/update/firmware', formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
    }
    async getWiFiStatus() {
        return this.axiosInstance.get('/api/v1/wifi/config');
    }
    async setWiFiConfig(data) {
        return this.axiosInstance.post('/api/v1/wifi/config', data);
    }
    async getWiFiQR() {
        const response = await this.axiosInstance.get('/api/v1/wifi/config/qr.png', {
            responseType: 'blob'
        });
        return response;
    }
    getWiFiQRURL() {
        return new URL('/api/v1/wifi/config/qr.png', this.axiosInstance.getUri()).toString();
    }
    async listAvailableWiFi() {
        return this.axiosInstance.get('/api/v1/wifi/list');
    }
    async connectToWiFi(data) {
        return this.axiosInstance.post('/api/v1/wifi/connect', data);
    }
    async deleteWifi({ ssid }) {
        return this.axiosInstance.post('/api/v1/wifi/delete', { ssid });
    }
    async playSound(sound) {
        return this.axiosInstance.get(`/api/v1/sounds/play/${sound}`);
    }
    async listSounds() {
        return this.axiosInstance.get('/api/v1/sounds/list');
    }
    async listSoundThemes() {
        return this.axiosInstance.get('/api/v1/sounds/theme/list');
    }
    async getSoundTheme() {
        return this.axiosInstance.get('/api/v1/sounds/theme/get');
    }
    async setSoundTheme(theme) {
        return this.axiosInstance.post(`/api/v1/sounds/theme/set/${theme}`);
    }
    async getDeviceInfo() {
        return this.axiosInstance.get('/api/v1/machine');
    }
    async getDefaultProfiles() {
        return this.axiosInstance.get('/api/v1/profile/defaults');
    }
    async getHistoryShortListing() {
        return this.axiosInstance.get('/api/v1/history');
    }
    async searchHistory(query) {
        return this.axiosInstance.post('/api/v1/history', {
            params: { query }
        });
    }
    async searchHistoricalProfiles(query) {
        return this.axiosInstance.get('/api/v1/history/search?query=' + query);
    }
    async getCurrentShot() {
        return this.axiosInstance.get('/api/v1/history/current');
    }
    async getLastShot() {
        return this.axiosInstance.get('/api/v1/history/last');
    }
    async getHistoryStatistics() {
        return this.axiosInstance.get('/api/v1/history/stats');
    }
}
exports.default = Api;
//# sourceMappingURL=index.js.map