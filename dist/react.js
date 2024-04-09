"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.useApi = void 0;
const _1 = require(".");
const wrapper_1 = __importDefault(require("./wrapper"));
function useApi(api = _1.defaultAPI) {
    const wrapper = new wrapper_1.default(api);
    const executeAction = wrapper.executeAction;
    // Profile Operations
    const profileOperations = () => ({
        listProfiles: wrapper.listProfiles,
        fetchProfiles: wrapper.fetchAllProfiles,
        saveProfile: wrapper.saveProfile,
        loadProfileById: wrapper.loadProfileById,
        loadProfileFromJSON: wrapper.loadProfileFromJSON,
        getProfile: wrapper.getProfile,
        deleteProfile: wrapper.deleteProfile
    });
    // Notifications Operations
    const notificationOperations = () => ({
        getNotifications: wrapper.getNotifications,
        acknowledgeNotification: wrapper.acknowledgeNotification
    });
    // Settings Operations
    const settingsOperations = () => ({
        getSettings: wrapper.getSettings,
        updateSetting: wrapper.updateSetting
    });
    // Firmware uperations
    const updateFirmware = wrapper.updateFirmware;
    // Wifi Operations
    const wifiOperations = () => ({
        getWiFiConfig: wrapper.getWiFiConfig,
        setWiFiConfig: wrapper.setWiFiConfig,
        listAvailableWiFi: wrapper.listAvailableWiFi,
        connectToWiFi: wrapper.connectToWiFi
    });
    const soundOperations = () => ({
        playSound: wrapper.playSound,
        listSounds: wrapper.listSounds,
        listSoundThemes: wrapper.listSoundThemes,
        setSoundTheme: wrapper.setSoundTheme,
        getSoundTheme: wrapper.getSoundTheme
    });
    return {
        executeAction,
        ...profileOperations(),
        ...notificationOperations(),
        ...settingsOperations(),
        ...soundOperations(),
        updateFirmware,
        ...wifiOperations()
    };
}
exports.useApi = useApi;
//# sourceMappingURL=react.js.map