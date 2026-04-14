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
        this.version = 'v1';
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
    }
    async executeAction(action) {
        return this.axiosInstance.get(`/api/${this.version}/action/${action}`);
    }
    async listProfiles() {
        return this.axiosInstance.get(`/api/${this.version}/profile/list`);
    }
    async fetchAllProfiles() {
        return this.axiosInstance.get(`/api/${this.version}/profile/list?full=true`);
    }
    async saveProfile(data) {
        return this.axiosInstance.post(`/api/${this.version}/profile/save`, data);
    }
    async loadProfileFromJSON(data) {
        return this.axiosInstance.post(`/api/${this.version}/profile/load`, data);
    }
    async loadProfileByID(id) {
        return this.axiosInstance.get(`/api/${this.version}/profile/load/${id.toString()}`);
    }
    async getProfile(profileId) {
        return this.axiosInstance.get(`/api/${this.version}/profile/get/${profileId}`);
    }
    async deleteProfile(profileId) {
        return this.axiosInstance.delete(`/api/${this.version}/profile/delete/${profileId}`);
    }
    async getLastProfile() {
        return this.axiosInstance.get(`/api/${this.version}/profile/last`);
    }
    async getProfileDefaultImages() {
        return this.axiosInstance.get(`/api/${this.version}/profile/image`);
    }
    getProfileImageUrl(image) {
        if (image.startsWith('data:')) {
            return image;
        }
        const url = `/api/${this.version}/profile/image/`;
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
        return this.axiosInstance.get(`/api/${this.version}/notifications?acknowledged=${acknowledged}`);
    }
    async acknowledgeNotification(data) {
        return this.axiosInstance.post(`/api/${this.version}/notifications/acknowledge`, data);
    }
    async getSettings(settingName) {
        const url = `/api/${this.version}/settings/` + (settingName ? `${settingName}` : '');
        return this.axiosInstance.get(url);
    }
    async updateSetting(setting) {
        return this.axiosInstance.post(`/api/${this.version}/settings/`, setting);
    }
    async getManufacturingMenuItems() {
        const url = `/api/${this.version}/manufacturing`;
        return this.axiosInstance.get(url);
    }
    async updateManufacturingSettings(setting) {
        return this.axiosInstance.post(`/api/${this.version}/manufacturing`, setting);
    }
    async updateFirmware(formData) {
        return this.axiosInstance.post(`/api/${this.version}/update/firmware`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
    }
    async getWiFiStatus() {
        return this.axiosInstance.get(`/api/${this.version}/wifi/config`);
    }
    async setWiFiConfig(data) {
        return this.axiosInstance.post(`/api/${this.version}/wifi/config`, data);
    }
    async requestTest(test) {
        return this.axiosInstance.get(`/api/${this.version}/test/${test}`);
    }
    async getWiFiQR() {
        const response = await this.axiosInstance.get(`/api/${this.version}/wifi/config/qr.png`, {
            responseType: 'blob'
        });
        return response;
    }
    getWiFiQRURL() {
        return new URL(`/api/${this.version}/wifi/config/qr.png`, this.axiosInstance.getUri()).toString();
    }
    async listAvailableWiFi() {
        return this.axiosInstance.get(`/api/${this.version}/wifi/list`);
    }
    async connectToWiFi(data) {
        return this.axiosInstance.post(`/api/${this.version}/wifi/connect`, data);
    }
    async deleteWifi({ ssid }) {
        return this.axiosInstance.post(`/api/${this.version}/wifi/delete`, {
            ssid
        });
    }
    async playSound(sound) {
        return this.axiosInstance.get(`/api/${this.version}/sounds/play/${sound}`);
    }
    async listSounds() {
        return this.axiosInstance.get(`/api/${this.version}/sounds/list`);
    }
    async listSoundThemes() {
        return this.axiosInstance.get(`/api/${this.version}/sounds/theme/list`);
    }
    async getSoundTheme() {
        return this.axiosInstance.get(`/api/${this.version}/sounds/theme/get`);
    }
    async setSoundTheme(theme) {
        return this.axiosInstance.post(`/api/${this.version}/sounds/theme/set/${theme}`);
    }
    async getDeviceInfo() {
        return this.axiosInstance.get(`/api/${this.version}/machine`);
    }
    async setBrightness(brightness) {
        return this.axiosInstance.post('/api/v1/machine/backlight', brightness);
    }
    async getDefaultProfiles() {
        return this.axiosInstance.get(`/api/${this.version}/profile/defaults`);
    }
    async getHistoryShortListing() {
        return this.axiosInstance.get(`/api/${this.version}/history`);
    }
    async searchHistory(query) {
        return this.axiosInstance.post(`/api/${this.version}/history`, query);
    }
    async searchHistoricalProfiles(query) {
        return this.axiosInstance.get(`/api/${this.version}/history/search?query=` + query);
    }
    async getCurrentShot() {
        return this.axiosInstance.get(`/api/${this.version}/history/current`);
    }
    async getLastShot() {
        return this.axiosInstance.get(`/api/${this.version}/history/last`);
    }
    async getHistoryStatistics() {
        return this.axiosInstance.get(`/api/${this.version}/history/stats`);
    }
    async getOSStatus() {
        return this.axiosInstance.get(`/api/${this.version}/machine/OS_update_status`);
    }
    async getTimezoneRegion(region_type, conditional) {
        return this.axiosInstance.get(`/api/${this.version}/timezones/${region_type}`, { params: { filter: conditional } });
    }
    async getRootPassword() {
        return this.axiosInstance.get(`/api/${this.version}/machine/root-password`);
    }
    async setTime(dateTime) {
        return this.axiosInstance.post(`/api/${this.version}/machine/time`, {
            date: dateTime.toISOString()
        });
    }
    async rateShot(shotId, rating) {
        return this.axiosInstance.post(`/api/${this.version}/history/rating/${shotId}`, { rating });
    }
    async getShotRating(shotId) {
        return this.axiosInstance.get(`/api/${this.version}/history/rating/${shotId}`);
    }
}
exports.default = Api;
//# sourceMappingURL=index.js.map