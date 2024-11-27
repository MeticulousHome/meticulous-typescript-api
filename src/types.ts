import { Profile } from '@meticulous-home/espresso-profile';

export type ActionType =
  | 'start'
  | 'stop'
  | 'reset'
  | 'tare'
  | 'calibration'
  | 'scale_master_calibration';

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
  change_id: string;
  profile: Profile;
}

export interface LastProfileIdent {
  load_time: number;
  profile: Profile;
}

export type SettingsKey =
  | 'auto_purge_after_shot'
  | 'auto_start_shot'
  | 'disallow_firmware_flashing'
  | 'enable_sounds'
  | 'heating_timeout'
  | 'save_debug_shot_data'
  | 'update_channel';

export type SettingsType = boolean | number | string;

export type Settings = Record<SettingsKey, SettingsType> & {
  auto_preheat: number;
  auto_purge_after_shot: boolean;
  auto_start_shot: boolean;
  disallow_firmware_flashing: boolean;
  enable_sounds: boolean;
  save_debug_shot_data: boolean;
  heating_timeout: number;
};

export enum APMode {
  AP = 'AP',
  CLIENT = 'CLIENT'
}

export interface WiFiConfig {
  mode: APMode;
  apName: string;
  apPassword: string;
}

// WEP is not supported, we only log it for now
export type WIFI_TYPE = 'PSK' | '802.1X' | 'OPEN' | 'WEP';

export interface BaseWiFiCredentials {
  type?: WIFI_TYPE;
  security?: string;
  ssid: string;
}

export interface WifiWpaEnterpriseCredentials extends BaseWiFiCredentials {
  type: '802.1X';
  //TODO add more fields after implementation
}

export interface WifiOpenCredentials extends BaseWiFiCredentials {
  type: 'OPEN';
}

export interface WifiWpaPskCredentials extends BaseWiFiCredentials {
  type: 'PSK';
  password: string;
}

export type WiFiCredentials =
  | WifiWpaEnterpriseCredentials
  | WifiOpenCredentials
  | WifiWpaPskCredentials;

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
  known_wifis: { [key: string]: WiFiCredentials | string };
}

export interface WiFiNetwork {
  type?: WIFI_TYPE;
  security?: string;
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

// Socket.io Message types

export interface SensorData {
  p: number;
  f: number;
  w: number;
  t: number;
}

export type MachineState = 'idle' | 'purge' | 'home' | 'brewing' | 'error';

export interface StatusData {
  name: string;
  sensors: SensorData;
  time: number; // in ms
  profile: string;
  loaded_profile: string; // name of the profile
  id: string; // id of the loaded profile
  state: MachineState;
  extracting: boolean;
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

export interface SoftwareInfo {
  name: string;
  lcdV: number;
}

export interface ESPInfo {
  firmwareV: string;
  espPinout: number;
  mainVoltage: number;
}

export interface MachineInfoEvent {
  software_info: SoftwareInfo;
  esp_info: ESPInfo;
}

export type ProfileEvent =
  | 'create'
  | 'update'
  | 'delete'
  | 'full_reload'
  | 'load';

export interface ProfileUpdate {
  type: ProfileEvent;
  profile_id?: string;
  change_id?: string;
}

export interface DeviceInfo {
  name: string;
  hostname: string;
  firmware: string;
  color: string;
  model_version: string;
  serial: string;
}

export interface HistoryProfile extends Profile {
  db_key: number;
}

export interface HistoryDataPoint {
  shot: {
    pressure: number;
    flow: number;
    weight: number;
    temperature: number;
  };
  time: number;
  status: string;
  sensors: {
    external_1: number;
    external_2: number;
    bar_up: number;
    bar_mid_up: number;
    bar_mid_down: number;
    bar_down: number;
    tube: number;
    valve: number;
    motor_position: number;
    motor_speed: number;
    motor_power: number;
    motor_current: number;
    bandheater_power: number;
    preassure_sensor: number;
    adc_0: number;
    adc_1: number;
    adc_2: number;
    adc_3: number;
    water_status: boolean;
  };
}

export interface HistoryBaseEntry {
  id: string;
  db_key: number | null;
  time: number;
  file: string | null;
  name: string;
  profile: HistoryProfile;
}

export interface HistoryEntry extends HistoryBaseEntry {
  data: HistoryDataPoint[];
}

export interface HistoryResponse {
  history: HistoryEntry[];
}

export interface HistoryListingEntry extends HistoryBaseEntry {
  data: null;
}

export interface HistoryListingResponse {
  history: HistoryListingEntry[];
}

export interface HistoryQueryParams {
  query: string;
  ids: number[];
  start_date: string;
  end_date: string;
  order_by: ('profile' | 'date')[];
  sort: 'asc' | 'desc';
  max_results: number;
  dump_data: boolean;
}

export interface HistoryStats {
  totalSavedShots: number;
  byProfile: {
    name: string;
    count: number;
    profileVersions: number;
  }[];
}

export interface OSStatusResponse {
  progress?: number;
  status?: string;
  info?: string;
}

export interface BrightnessRequest {
  brightness: 0 | 1;
}

export interface Timezones {
  [country: string]: {
    [city: string]: string;
  };
}
export interface CurrentTimezone {
  country: string;
  city: string;
  timezone: string;
}
