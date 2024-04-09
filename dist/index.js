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
exports.defaultAPI = void 0;
const axios_1 = __importDefault(require("axios"));
const socket_io_client_1 = require("socket.io-client");
__exportStar(require("./react"), exports);
__exportStar(require("./types"), exports);
__exportStar(require("./wrapper"), exports);
class Api {
    constructor(options, base_url) {
        this.options = options;
        const serverURL = base_url || 'http://localhost:8080/';
        // AXIOS
        const axiosInstance = axios_1.default.create({
            baseURL: serverURL,
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json'
            }
        });
        if (!axiosInstance) {
            console.log('Could not create AxiosInstance!');
            throw new Error('Failed to create AxisInstance');
        }
        this.axiosInstance = axiosInstance;
        // Socket.io
        this.socket = (0, socket_io_client_1.io)(serverURL);
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
    async getWiFiConfig() {
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
        return this.axiosInstance.getUri() + 'api/v1/wifi/config/qr.png';
    }
    async listAvailableWiFi() {
        return this.axiosInstance.get('/api/v1/wifi/list');
    }
    async connectToWiFi(data) {
        return this.axiosInstance.post('/api/v1/wifi/connect', data);
    }
    async playSound(sound) {
        return this.axiosInstance.get(`/sounds/play/${sound}`);
    }
    async listSounds() {
        return this.axiosInstance.get('/sounds/list');
    }
    async listSoundThemes() {
        return this.axiosInstance.get('/sounds/theme/list');
    }
    async getSoundTheme() {
        return this.axiosInstance.get('/sounds/theme/get');
    }
    async setSoundTheme(theme) {
        return this.axiosInstance.post(`/sounds/theme/set/${theme}`);
    }
}
exports.default = Api;
exports.defaultAPI = new Api();
//# sourceMappingURL=index.js.map