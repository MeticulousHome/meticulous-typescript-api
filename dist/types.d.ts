export type ActionType = 'start' | 'stop' | 'reset' | 'tare' | 'calibration';
export interface ActionResponse {
    action?: string;
    allowed_actions?: string[];
}
export interface FileListing {
    name: string;
    url: string;
}
export interface Notification {
    id: string;
    message: string;
    image?: string;
    response_options?: string[];
    timestamp: string;
}
export interface AcknowledgeNotificationRequest {
    id: string;
    response: string;
}
export interface ProfileIdent {
    name: string;
    id: string;
}
export type SettingsKey = 'auto_preheat' | 'auto_purge_after_shot' | 'auto_start_shot' | 'disallow_firmware_flashing' | 'enable_sounds' | 'save_debug_shot_data';
export type SettingsType = boolean | number;
export type Settings = Record<SettingsKey, SettingsType> & {
    auto_preheat: number;
    auto_purge_after_shot: boolean;
    auto_start_shot: boolean;
    disallow_firmware_flashing: boolean;
    enable_sounds: boolean;
    save_debug_shot_data: boolean;
};
export declare enum APMode {
    AP = "AP",
    CLIENT = "CLIENT"
}
export interface WiFiConfig {
    mode: APMode;
    apName: string;
    apPassword: string;
}
export interface WiFiConnectRequest {
    ssid: string;
    password: string;
}
export interface WifiSystemStatus {
    connected: boolean;
    connection_name: string;
    gateway: string;
    routes: string[];
    ips: string[];
    dns: string[];
    mac: string;
    hostname: string;
    domains: string[];
}
export interface WifiStatus {
    config: WiFiConfig;
    status: WifiSystemStatus;
}
export interface WiFiNetwork {
    ssid: string;
    signal: number;
    rate: number;
    in_use: boolean;
}
export interface APIError {
    error: string;
    description: string;
    data?: object;
}
export interface SensorData {
    p: number;
    f: number;
    w: number;
    t: number;
}
export interface StatusData {
    name: string;
    sensors: SensorData;
    time: number;
    profile: string;
}
export interface Temperatures {
    t_ext_1: number;
    t_ext_2: number;
    t_bar_up: number;
    t_bar_mu: number;
    t_bar_md: number;
    t_bar_down: number;
    t_tube: number;
    t_valv: number;
}
export interface Communication {
    p: number;
    a_0: number;
    a_1: number;
    a_2: number;
    a_3: number;
}
export interface Actuators {
    m_pos: number;
    m_spd: number;
    m_pwr: number;
    m_cur: number;
    bh_pwr: number;
}
export interface MachineInfo {
    software_info: Record<string, unknown>;
    esp_info: Record<string, unknown>;
}
//# sourceMappingURL=types.d.ts.map