import { Profile } from '@meticulous-home/espresso-profile';

export type DefaultProfiles = {
  default: Profile[];
  community: Profile[];
};

export type ActionType =
  | 'start'
  | 'stop'
  | 'continue'
  | 'reset'
  | 'tare'
  | 'preheat'
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

export type ReverseScrolling = {
  home: boolean;
  keyboard: boolean;
  menus: boolean;
};

export type USB_MODE = 'client' | 'host' | 'dual_role';
export type SettingsType = boolean | number | string;

export type Option = {
  name: string;
  type: string;
  value: boolean;
};
export type Element = {
  key: string;
  label: string;
  options: Option[];
};
export type ManufacturingMenuItems = {
  Elements: Element[];
};

export type ManufacturingSettings = {
  enabled: boolean;
  first_normal_boot: boolean;
  skip_stage: boolean;
};

export type Settings = {
  allow_debug_sending: boolean | null;
  auto_preheat: number;
  auto_purge_after_shot: boolean;
  auto_start_shot: boolean;
  disallow_firmware_flashing: boolean;
  disable_ui_features: boolean;
  enable_sounds: boolean;
  save_debug_shot_data: boolean;
  idle_screen: string;
  reverse_scrolling: ReverseScrolling;
  heating_timeout: number;
  timezone_sync: string;
  time_zone: string;
  usb_mode: USB_MODE;
  update_channel: string;
  ssh_enabled: boolean;
};

export type SettingsKey = keyof Settings;

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
  g: number;
}

export type MachineState = 'idle' | 'purge' | 'home' | 'brewing' | 'error';

export interface SetpointData {
  active?: string;
  temperature?: number;
  flow?: number;
  pressure?: number;
  power?: number;
  piston?: number;
}

export interface StatusData {
  name: string;
  sensors: SensorData;
  time: number; // in ms
  profile: string;
  loaded_profile: string; // name of the profile
  id: string; // id of the loaded profile
  state: MachineState;
  extracting: boolean;
  setpoints: SetpointData;
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

export type ProfileEvent =
  | 'create'
  | 'update'
  | 'delete'
  | 'full_reload'
  | 'load';

export interface ProfileUpdate {
  change: ProfileEvent;
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
  software_version: string | null;
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
    gravimetric_flow: number;
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
  rating?: ShotRating;
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
  ids: (number | string)[];
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

export interface Timezone {
  [city: string]: string;
}
export interface Regions {
  countries?: string[];
  cities?: Timezone[];
}
export type regionType = 'countries' | 'cities';

export type ShotRating = 'like' | 'dislike' | null;

export type ShotRatingResponse = {
  shot_id: number;
  rating: ShotRating;
};

export type RateShotResponse = {
  status: string;
  shot_id: number;
  rating: ShotRating;
};
