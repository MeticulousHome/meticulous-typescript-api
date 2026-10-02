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

export type TestType = 'speaker';

export type NotificationResponse = string;

export interface ActionResponse {
  action?: string;
  allowed_actions?: string[];
  status?: string;
}

export interface FileListing {
  name: string;
  url: string;
}

export interface NotificationItem {
  id: string;
  message: string;
  image?: string;
  responses?: NotificationResponse[];
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

export interface ProfileShortIdent {
  name: string;
  id: string;
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

export type TareBehavior = 'after_retraction' | 'before_retraction';

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
  last_boot_mode: string;
  skip_stage: boolean;
};

export type Settings = {
  heat_on_boot: boolean;
  hostname_override: string;
  profile_order: string[];
  allow_debug_sending: boolean | null;
  auto_preheat: number;
  auto_purge_after_shot: boolean;
  auto_start_shot: boolean;
  tare_behavior?: TareBehavior;
  partial_retraction: number;
  disallow_firmware_flashing: boolean;
  disable_ui_features: boolean;
  enable_sounds: boolean;
  debug_shot_data_retention_days: number;
  idle_screen: string;
  reverse_scrolling: ReverseScrolling;
  heating_timeout: number;
  timezone_sync: string;
  time_zone: string;
  update_channel: string;
  ssh_enabled: boolean;
  telemetry_service_enabled: boolean;
  /**
   * Opt-in anonymous upload of debug shot data. `null` means the user never
   * answered the prompt; older backends omit the key.
   */
  shot_data_sharing?: boolean | null;
  /**
   * Email support may reply to about bug reports. `null` or an empty string
   * means the user never provided one; older backends omit the key.
   */
  report_contact_mail?: string | null;
};

/** `Settings.update_channel` value that puts the machine in limited access. */
export const LIMITED_ACCESS_CHANNEL = 'factory';

export const isLimitedAccess = (
  settings?: Pick<Settings, 'update_channel'> | null
): boolean => settings?.update_channel === LIMITED_ACCESS_CHANNEL;

export interface UnlockMachineRequest {
  code: string;
}

export interface UnlockMachineResponse {
  status: 'ok';
  update_channel: string;
  limited_access: false;
}

/** `APIError.data.code` values returned by POST /machine/unlock. */
export type UnlockErrorCode =
  | 'INVALID_BODY'
  | 'INVALID_UNLOCK_CODE'
  | 'UNLOCK_THROTTLED';

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

// A semi-generic object  to avoid use of `any`
export type GenericValue = string | number | boolean | null | GenericDict;
export interface GenericDict {
  [key: string]: GenericValue;
}

export interface APIError {
  error: string;
  description: string;
  data?: object;
}

export interface MeticulousIDRequestType {
  eventID: string;
  baseEventID?: string;
}

export interface MachineAttachments {
  debugFiles: {
    user?: string[];
    automatic: string[];
  };
  machineLogs?: boolean;
  machineInfo?: boolean;
  machineStatus?: boolean;
}

/**
 * Body of POST /reports/create. Either `issueTime` for a report started on
 * the dial, or `localID` of a dispatched report (see `ReportDispatch`), whose
 * issue time was stored with the dispatch. Never both.
 */
export interface CreateReportRequest {
  issueTime?: number;
  localID?: string;
}

/** Body of POST /reports/dispatch: hands a mobile report over to the dial. */
export interface ReportDispatch {
  /** Minted by POST /reports/request. */
  localID: string;
  ticket: number;
  /** Seconds since epoch. Defaults to the dispatch time on the backend. */
  issueTime?: number;
  description?: string | null;
  name?: string | null;
  email?: string | null;
}

/**
 * Payload of the `upload_report` socket event and of each entry returned by
 * GET /reports/dispatch. The dial collects the report with `localID` and
 * uploads it with this ticket and contact.
 */
export interface UploadReportEvent {
  localID: string;
  machineID: string | null;
  ticket: number;
  issueTime: number;
  /** When the dispatch reached the backend, seconds since epoch. */
  requestTime: number;
  description: string | null;
  name: string | null;
  email: string | null;
}

export interface ReportRequestOptions {
  signal?: AbortSignal;
  /** Milliseconds. 0 or undefined means no timeout (axios default). */
  timeout?: number;
}

/** @deprecated use ReportRequestOptions */
export type CreateReportOptions = ReportRequestOptions;

export type ReportErrorCode =
  | 'INVALID_BODY'
  | 'INVALID_LOCAL_ID'
  | 'UNKNOWN_LOCAL_ID'
  | 'FORBIDDEN_UPDATE'
  | 'COLLECTION_IN_PROGRESS'
  | 'INSUFFICIENT_DISK_SPACE'
  | 'DUPLICATE_LOCAL_ID'
  | 'INTERNAL';

export type PreflightBlocker =
  | 'NO_SERIAL_NUMBER'
  | 'INSUFFICIENT_DISK_SPACE'
  | 'COLLECTION_IN_PROGRESS'
  | 'NETWORK_UNREACHABLE';

export interface ProbeResult {
  reachable: boolean;
  status: number | null;
  latencyMs: number | null;
  error: string | null;
}

export interface ReportPreflight {
  ok: boolean;
  blockers: PreflightBlocker[];
  machineID: string | null;
  disk: { freeBytes: number; requiredBytes: number; ok: boolean };
  collectionInProgress: boolean;
  network: Record<string, ProbeResult>;
}

/** Where a report stands on the machine: queued for the dial, collected but not sent, or sent. */
export type ReportStatus = 'queued' | 'draft' | 'submitted';

export interface ReportInfo {
  description?: string | null;
  dateAndTime: number | null;
  issueTime: number;
  attachments?: MachineAttachments | null;
  multimedia?: number | null;
  machineID: string | null;
  eventID?: string | null;
  baseEventID?: string | null;
  ticket?: number | null;
  localID: string | null;
  /** Set by GET /reports/list; backends that predate it omit it. */
  status?: ReportStatus | null;
}

export interface DraftInfo {
  localID: string;
  machineID: string;
}

export interface SubmitInfo {
  localID: string;
  eventID: string;
  ticket?: number | null;
  submissionTime?: number;
}

export interface PaginatedResponse<T> {
  content: T[];
  size: number;
  page: number;
  hasMore: boolean;
}

export interface PageParams {
  size: number;
  page: number;
  /** FIQL filter forwarded as the `filter` query parameter of GET /reports/list. */
  filter?: string;
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
  profile_time: number; // in ms
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

export type BrewType = 'espresso' | 'pour_over';

export interface ProfileUpdate {
  change: ProfileEvent;
  profile_id?: string;
  change_id?: string;
  /** Only present on pour-over profile events. */
  brew_type?: BrewType;
}

export type ProfileHoverSource = 'dial' | 'app' | 'backend';

export type ProfileHoverType = 'focus' | 'scroll';

/**
 * Payload of the `profileHover` socket event (both directions) and of
 * GET /profile/selected. The backend re-emits a client's hover to every other
 * client and sends its own with `from: 'backend'` on connect.
 */
export interface ProfileHoverEvent {
  id: string;
  from: ProfileHoverSource;
  type: ProfileHoverType;
}

/**
 * Payload of the `sensors` socket event: the full ESP32 sensor frame.
 * `Temperatures`, `Communication` and `Actuators` are legacy partial views
 * of it.
 */
export interface MachineSensors {
  t_ext_1: number;
  t_ext_2: number;
  t_bar_up: number;
  t_bar_mu: number;
  t_bar_md: number;
  t_bar_down: number;
  t_tube: number;
  t_motor_temp: number;
  lam_temp: number;
  p: number;
  a_0: number;
  a_1: number;
  a_2: number;
  a_3: number;
  m_pos: number;
  m_spd: number;
  m_pwr: number;
  m_cur: number;
  bh_pwr: number;
  bh_cur: number;
  w_stat: boolean;
  motor_temp: number;
  weight_pred: number;
}

export type ButtonEventType =
  | 'ENCODER_CLOCKWISE'
  | 'ENCODER_COUNTERCLOCKWISE'
  | 'ENCODER_PUSH'
  | 'ENCODER_DOUBLE'
  | 'ENCODER_LONG'
  | 'TARE'
  | 'TARE_DOUBLE'
  | 'TARE_LONG'
  | 'TARE_SUPER_LONG'
  | 'CONTEXT'
  | 'ENCODER_PRESSED'
  | 'ENCODER_RELEASED'
  | 'TARE_PRESSED'
  | 'TARE_RELEASED'
  | 'CONTEXT_PRESSED'
  | 'CONTEXT_RELEASED'
  | 'UNKNOWN';

/** Payload of the `button` socket event (physical dial and tare buttons). */
export interface ButtonEvent {
  type: ButtonEventType;
  time_since_last_event: number;
}

/** Payload of the `heater_status` socket event: preheat seconds remaining. */
export type HeaterStatus = number;

/** Values accepted by the `action` socket event. */
export type SocketActionType =
  | 'start'
  | 'stop'
  | 'tare'
  | 'scale_master_calibration'
  | 'preheat'
  | 'continue'
  | 'finish'
  | 'home'
  | 'purge'
  | 'abort';

/** Events emitted by the backend, keyed for `Socket<ServerToClientEvents, ClientToServerEvents>`. */
export interface ServerToClientEvents {
  status: (data: StatusData) => void;
  sensors: (data: MachineSensors) => void;
  profile: (data: ProfileUpdate) => void;
  profileHover: (data: ProfileHoverEvent) => void;
  heater_status: (data: HeaterStatus) => void;
  /** JSON-encoded `NotificationItem`. */
  notification: (data: string) => void;
  button: (data: ButtonEvent) => void;
  OSUpdate: (data: OSStatusResponse) => void;
  /** Settings changed on the machine; the payload is empty, re-fetch GET /settings. */
  settings: (data: Record<string, never>) => void;
  /** A mobile report was dispatched; the dial collects and uploads it. */
  upload_report: (data: UploadReportEvent) => void;
}

/** Events the backend listens for. */
export interface ClientToServerEvents {
  action: (action: SocketActionType) => void;
  profileHover: (data: ProfileHoverEvent) => void;
  /** JSON-encoded `AcknowledgeNotificationRequest`. */
  notification: (data: string) => void;
  calibrate: (data: string) => void;
}

export interface RepoInfo {
  branch: string;
  commit: string;
}

export interface DeviceInfo {
  name: string;
  hostname: string;
  firmware: string;
  tare_behavior_supported?: boolean;
  mainVoltage: number;
  color: string;
  serial: string;
  batch_number: string;
  build_date: string;
  software_version: string | null;
  image_build_channel: string;
  image_version: string;
  manufacturing: boolean;
  upgrade_first_boot: boolean;
  version_history: string[];
  repository_info: {
    [repo: string]: RepoInfo;
  };
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
  debug_file?: string | null;
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

export type BrightnessInterpolation = 'curve' | 'linear';

export interface BrightnessRequest {
  brightness: number;
  interpolation?: BrightnessInterpolation;
  animation_time?: number;
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
