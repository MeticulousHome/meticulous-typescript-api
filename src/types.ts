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

export interface Settings {
  auto_preheat: number
  auto_purge_after_shot: boolean
  auto_start_shot: boolean
  disallow_firmware_flashing: boolean
  enable_sounds: boolean
  save_debug_shot_data: boolean
}

export type APMode = 'AP' | 'CLIENT';

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
