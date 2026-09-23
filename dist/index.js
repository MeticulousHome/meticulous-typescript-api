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
exports.getReportErrorCode = getReportErrorCode;
const axios_1 = __importDefault(require("axios"));
const socket_io_client_1 = require("socket.io-client");
__exportStar(require("./types"), exports);
const REPORT_ERROR_CODES = new Set([
    'INVALID_BODY',
    'INVALID_LOCAL_ID',
    'UNKNOWN_LOCAL_ID',
    'FORBIDDEN_UPDATE',
    'COLLECTION_IN_PROGRESS',
    'INSUFFICIENT_DISK_SPACE',
    'INTERNAL'
]);
const REPORT_INFO_KEYS = [
    'description',
    'dateAndTime',
    'issueTime',
    'attachments',
    'multimedia',
    'machineID',
    'eventID',
    'baseEventID',
    'ticket',
    'localID'
];
function isObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isAPIError(value) {
    return isObject(value) && typeof value.error === 'string';
}
function getReportErrorCode(value) {
    if (!isAPIError(value))
        return undefined;
    const code = value.data?.code;
    return typeof code === 'string' && REPORT_ERROR_CODES.has(code)
        ? code
        : undefined;
}
function reportRequestConfig(options, extra = {}) {
    return {
        ...extra,
        signal: options?.signal,
        ...(options?.timeout ? { timeout: options.timeout } : {})
    };
}
function parseAPIError(value, description, data) {
    if (isAPIError(value)) {
        return value;
    }
    let error = {
        error: 'Request failed',
        description: description ? description : ''
    };
    if (typeof value === 'string' && value.length > 0) {
        error['error'] = value;
    }
    else {
        error['data'] = { value: value };
    }
    if (data) {
        error['data'] = error['data'] ? { ...error['data'], data: data } : data;
    }
    return error;
}
async function parseBinaryErrorBody(value) {
    if (value instanceof ArrayBuffer) {
        const body = new TextDecoder().decode(value);
        try {
            return parseAPIError(JSON.parse(body));
        }
        catch {
            return parseAPIError(body);
        }
    }
    if (value instanceof Blob) {
        return parseBinaryErrorBody(await value.arrayBuffer());
    }
    return parseAPIError(value);
}
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
    /**
     * POST /machine/unlock. Resolves for expected response statuses so callers
     * can switch on `response.status`; other statuses and transport errors reject.
     */
    async unlockMachine(code) {
        const body = { code };
        return this.axiosInstance.post(`/api/${this.version}/machine/unlock`, body, {
            validateStatus: (status) => [200, 400, 403, 429].includes(status)
        });
    }
    async setBrightness(brightness) {
        return this.axiosInstance.post('/api/v1/machine/backlight', brightness);
    }
    async createReport(request, options) {
        try {
            const response = await this.axiosInstance.post(`/api/${this.version}/reports/create`, request, reportRequestConfig(options, {
                headers: { Accept: 'application/json' }
            }));
            return response.data;
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error)) {
                return parseAPIError(error.response?.data);
            }
            return parseAPIError(error);
        }
    }
    async getReportPreflight(probes = [], options) {
        try {
            const params = new URLSearchParams();
            probes.slice(0, 4).forEach((url) => params.append('probe', url));
            const response = await this.axiosInstance.get(`/api/${this.version}/reports/preflight`, reportRequestConfig(options ?? { timeout: 15000 }, {
                headers: { Accept: 'application/json' },
                params
            }));
            return response.data;
        }
        catch (error) {
            return axios_1.default.isAxiosError(error)
                ? parseAPIError(error.response?.data)
                : parseAPIError(error);
        }
    }
    async getReports(pageParams, options) {
        try {
            const response = await this.axiosInstance.get(`/api/${this.version}/reports/list`, reportRequestConfig(options, {
                headers: { Accept: 'application/json' },
                params: pageParams
            }));
            return response.data;
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error)) {
                return parseAPIError(error.response?.data);
            }
            return parseAPIError(error);
        }
    }
    async getDraftReport(localID, options) {
        try {
            const response = await this.axiosInstance.get(`/api/${this.version}/reports/draft/${encodeURIComponent(localID)}`, reportRequestConfig(options, {
                headers: { Accept: 'application/octet-stream' },
                responseType: 'arraybuffer'
            }));
            return new Uint8Array(response.data);
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error)) {
                return parseBinaryErrorBody(error.response?.data);
            }
            return parseAPIError(error);
        }
    }
    async deleteDraftReport(localID, options) {
        try {
            const response = await this.axiosInstance.delete(`/api/${this.version}/reports/draft/${encodeURIComponent(localID)}`, reportRequestConfig(options, {
                headers: { Accept: 'application/json' }
            }));
            return isAPIError(response.data) ? response.data : undefined;
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error)) {
                return parseAPIError(error.response?.data);
            }
            return parseAPIError(error);
        }
    }
    async updateReport(id, patch, options) {
        try {
            const normalizedReport = {};
            REPORT_INFO_KEYS.forEach((key) => {
                if (key in patch) {
                    normalizedReport[key] = (patch[key] ?? null);
                }
            });
            const response = await this.axiosInstance.put(`/api/${this.version}/reports/draft/${encodeURIComponent(id)}`, normalizedReport, reportRequestConfig(options, {
                headers: { Accept: 'application/json' }
            }));
            return response.data;
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error)) {
                return parseAPIError(error.response?.data);
            }
            return parseAPIError(error);
        }
    }
    async markSubmittedReport(submitInfo, options) {
        try {
            const response = await this.axiosInstance.post(`/api/${this.version}/reports/submit`, submitInfo, reportRequestConfig(options, {
                headers: { Accept: 'application/json' }
            }));
            return isAPIError(response.data) ? response.data : undefined;
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error)) {
                return parseAPIError(error.response?.data);
            }
            return parseAPIError(error);
        }
    }
    async getMeticulousReportTracking(serviceUrl, payload, options) {
        try {
            const response = await axios_1.default.post(serviceUrl, payload, reportRequestConfig(options ?? { timeout: 15000 }, {
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json'
                }
            }));
            if (isAPIError(response.data)) {
                return response.data;
            }
            const ticket = response.data.ticket;
            if (typeof ticket !== 'number' || !Number.isSafeInteger(ticket)) {
                return parseAPIError('Ticket service returned no ticket', undefined, {
                    value: response.data
                });
            }
            return ticket;
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error)) {
                return parseAPIError(error.response?.data);
            }
            return parseAPIError(error);
        }
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