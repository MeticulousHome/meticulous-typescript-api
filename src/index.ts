import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { Socket, io } from 'socket.io-client';

import {
  OSStatusResponse,
  APIError,
  AcknowledgeNotificationRequest,
  ActionResponse,
  ActionType,
  Actuators,
  BrightnessRequest,
  Communication,
  DeviceInfo,
  HistoryEntry,
  HistoryListingResponse,
  HistoryQueryParams,
  HistoryResponse,
  HistoryStats,
  LastProfileIdent,
  NotificationItem,
  ProfileIdent,
  ProfileShortIdent,
  ProfileUpdate,
  Settings,
  StatusData,
  Temperatures,
  WiFiConfig,
  WiFiCredentials,
  WiFiNetwork,
  WifiStatus,
  Regions,
  regionType,
  ManufacturingMenuItems,
  ManufacturingSettings,
  ShotRating,
  ShotRatingResponse,
  RateShotResponse,
  TestType,
  DefaultProfiles,
  CreateReportRequest,
  ReportRequestOptions,
  ReportErrorCode,
  DraftInfo,
  MeticulousIDRequestType,
  PaginatedResponse,
  PageParams,
  ReportPreflight,
  ReportInfo,
  ReportDispatch,
  UploadReportEvent,
  ReportProgress,
  ReportProgressUpdate,
  SubmitInfo,
  UnlockMachineRequest,
  UnlockMachineResponse,
  AuthPairingMode,
  PairingCodeResponse,
  TokenExchangeRequest,
  TokenResponse,
  TokenValidation,
  AccessRequestResponse,
  AccessRequestStatus
} from './types';

import { Profile } from '@meticulous-home/espresso-profile';

export * from './types';

export interface MachineDataClientOptions {
  onStatus?: (data: StatusData) => void;
  onTemperatures?: (data: Temperatures) => void;
  onCommunication?: (data: Communication) => void;
  onActuators?: (data: Actuators) => void;
  onProfileUpdate?: (data: ProfileUpdate) => void;
  onNotification?: (data: NotificationItem) => void;
  /**
   * Called when the machine answers 401 with `data.code === 'UNAUTHORIZED'`,
   * meaning this device has to pair (again). Not called for the /auth calls,
   * whose 401s are answers about a code or token rather than that signal.
   */
  onUnauthorized?: () => void;
}

export type ReportResult<T> = T | APIError;

const REPORT_ERROR_CODES: ReadonlySet<string> = new Set([
  'INVALID_BODY',
  'INVALID_LOCAL_ID',
  'UNKNOWN_LOCAL_ID',
  'FORBIDDEN_UPDATE',
  'COLLECTION_IN_PROGRESS',
  'INSUFFICIENT_DISK_SPACE',
  'DUPLICATE_LOCAL_ID',
  'REPORT_CANCELLED',
  'TOO_LATE_TO_CANCEL',
  'INTERNAL'
]);

const REPORT_INFO_KEYS: (keyof ReportInfo)[] = [
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

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAPIError(value: unknown): value is APIError {
  return isObject(value) && typeof value.error === 'string';
}

export function getReportErrorCode(
  value: unknown
): ReportErrorCode | undefined {
  if (!isAPIError(value)) return undefined;
  const code = (value.data as { code?: unknown } | undefined)?.code;
  return typeof code === 'string' && REPORT_ERROR_CODES.has(code)
    ? (code as ReportErrorCode)
    : undefined;
}

function reportRequestConfig(
  options: ReportRequestOptions | undefined,
  extra: AxiosRequestConfig = {}
): AxiosRequestConfig {
  return {
    ...extra,
    signal: options?.signal,
    ...(options?.timeout ? { timeout: options.timeout } : {})
  };
}

function parseAPIError(
  value: unknown,
  description?: string,
  data?: object
): APIError {
  if (isAPIError(value)) {
    return value;
  }

  let error: APIError = {
    error: 'Request failed',
    description: description ? description : ''
  };

  if (typeof value === 'string' && value.length > 0) {
    error['error'] = value;
  } else {
    error['data'] = { value: value };
  }

  if (data) {
    error['data'] = error['data'] ? { ...error['data'], data: data } : data;
  }

  return error;
}

// Reads `data.code` from an error body, which may still be binary when the
// request asked for a blob or an array buffer.
async function errorCodeOf(value: unknown): Promise<unknown> {
  const body =
    value instanceof ArrayBuffer ||
    (typeof Blob !== 'undefined' && value instanceof Blob)
      ? await parseBinaryErrorBody(value)
      : value;
  return isObject(body) && isObject(body.data) ? body.data.code : undefined;
}

async function parseBinaryErrorBody(value: unknown): Promise<APIError> {
  if (value instanceof ArrayBuffer) {
    const body = new TextDecoder().decode(value);
    try {
      return parseAPIError(JSON.parse(body));
    } catch {
      return parseAPIError(body);
    }
  }

  if (value instanceof Blob) {
    return parseBinaryErrorBody(await value.arrayBuffer());
  }

  return parseAPIError(value);
}

export default class Api {
  private axiosInstance: AxiosInstance;
  private socket: Socket | undefined = undefined;

  private serverURL: string;
  private version: string = 'v1';
  private token: string | undefined;

  constructor(
    private options?: MachineDataClientOptions,
    base_url?: string,
    token?: string
  ) {
    const serverURL = base_url || 'http://localhost:8080/';
    this.serverURL = serverURL;
    this.token = token || undefined;

    // AXIOS
    this.axiosInstance = axios.create({
      baseURL: serverURL,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      }
    });

    // Read the token on every request so setToken applies to this instance
    // right away. A header set by the call itself (validateToken with an
    // explicit token) wins.
    this.axiosInstance.interceptors.request.use((config) => {
      if (this.token && !config.headers.has('Authorization')) {
        config.headers.set('Authorization', `Bearer ${this.token}`);
      }
      return config;
    });

    this.axiosInstance.interceptors.response.use(
      async (response) => {
        await this.checkUnauthorized(response);
        return response;
      },
      async (error) => {
        if (axios.isAxiosError(error) && error.response) {
          await this.checkUnauthorized(error.response);
        }
        return Promise.reject(error);
      }
    );
  }

  private async checkUnauthorized(response: AxiosResponse): Promise<void> {
    const onUnauthorized = this.options?.onUnauthorized;
    if (!onUnauthorized || response.status !== 401) return;

    // A 401 from /auth is about the code or token the call carried, not a
    // sign that the device lost access. The path is cut out by hand because
    // React Native's URL does not implement `pathname`.
    const authPath = `/api/${this.version}/auth`;
    const path = (response.config.url ?? '')
      .split(/[?#]/)[0]
      .replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]*/i, '');
    if (path === authPath || path.startsWith(`${authPath}/`)) return;

    try {
      if ((await errorCodeOf(response.data)) !== 'UNAUTHORIZED') return;
      onUnauthorized();
    } catch {
      // An unreadable body or a failing handler must not change the
      // request's outcome.
    }
  }

  /**
   * Sets or clears (`undefined` or empty) the token sent as
   * `Authorization: Bearer`. A socket that is already open is reconnected,
   * because the machine checks the token only during the handshake.
   */
  setToken(token?: string) {
    const next = token || undefined;
    const changed = next !== this.token;
    this.token = next;

    const socket = this.socket;
    if (socket && (changed || !socket.connected)) {
      socket.disconnect();
      socket.connect();
    }
  }

  getToken(): string | undefined {
    return this.token;
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
    // A function so every (re)connect sends the current token.
    this.socket = io(this.serverURL, {
      auth: (cb) => cb(this.token ? { token: this.token } : {})
    });

    if (this.options && this.options.onStatus) {
      this.socket.on('status', this.options && this.options.onStatus);
    }
    if (this.options && this.options.onTemperatures) {
      this.socket.on('sensors', this.options && this.options.onTemperatures);
    }
    if (this.options && this.options.onCommunication) {
      this.socket.on(
        'communication',
        this.options && this.options.onCommunication
      );
    }
    if (this.options && this.options.onActuators) {
      this.socket.on('actuators', this.options && this.options.onActuators);
    }
  }

  async executeAction(
    action: ActionType
  ): Promise<AxiosResponse<ActionResponse | APIError>> {
    return this.axiosInstance.get(`/api/${this.version}/action/${action}`);
  }

  async listProfiles(): Promise<
    AxiosResponse<Omit<Profile, 'stages'>[] | APIError>
  > {
    return this.axiosInstance.get(`/api/${this.version}/profile/list`);
  }

  async fetchAllProfiles(): Promise<AxiosResponse<Profile[] | APIError>> {
    return this.axiosInstance.get(
      `/api/${this.version}/profile/list?full=true`
    );
  }

  async saveProfile(
    data: Profile
  ): Promise<AxiosResponse<ProfileIdent | APIError>> {
    return this.axiosInstance.post(`/api/${this.version}/profile/save`, data);
  }

  async loadProfileFromJSON(
    data: Profile
  ): Promise<AxiosResponse<ProfileShortIdent | APIError>> {
    return this.axiosInstance.post(`/api/${this.version}/profile/load`, data);
  }

  async loadProfileByID(
    id: string
  ): Promise<AxiosResponse<ProfileShortIdent | APIError>> {
    return this.axiosInstance.get(
      `/api/${this.version}/profile/load/${id.toString()}`
    );
  }

  async getProfile(
    profileId: string
  ): Promise<AxiosResponse<Profile | APIError>> {
    return this.axiosInstance.get(
      `/api/${this.version}/profile/get/${profileId}`
    );
  }

  async deleteProfile(
    profileId: string
  ): Promise<AxiosResponse<ProfileIdent | APIError>> {
    return this.axiosInstance.delete(
      `/api/${this.version}/profile/delete/${profileId}`
    );
  }

  async getLastProfile(): Promise<AxiosResponse<LastProfileIdent | APIError>> {
    return this.axiosInstance.get(`/api/${this.version}/profile/last`);
  }

  async getProfileDefaultImages(): Promise<AxiosResponse<string[] | APIError>> {
    return this.axiosInstance.get(`/api/${this.version}/profile/image`);
  }

  getProfileImageUrl(image: string): string {
    if (image.startsWith('data:')) {
      return image;
    }
    const url = `/api/${this.version}/profile/image/`;
    if (!image.startsWith(url)) {
      image = url + image;
    }
    return image;
  }

  async getProfileImage(image: string): Promise<AxiosResponse<Blob>> {
    const response = await this.axiosInstance.get(
      this.getProfileImageUrl(image),
      {
        responseType: 'blob'
      }
    );
    return response;
  }

  async getNotifications(
    acknowledged: boolean
  ): Promise<AxiosResponse<NotificationItem[] | APIError>> {
    return this.axiosInstance.get(
      `/api/${this.version}/notifications?acknowledged=${acknowledged}`
    );
  }

  async acknowledgeNotification(
    data: AcknowledgeNotificationRequest
  ): Promise<AxiosResponse<void | APIError>> {
    return this.axiosInstance.post(
      `/api/${this.version}/notifications/acknowledge`,
      data
    );
  }

  async getSettings(
    settingName?: string
  ): Promise<AxiosResponse<Settings | APIError>> {
    const url =
      `/api/${this.version}/settings/` + (settingName ? `${settingName}` : '');
    return this.axiosInstance.get(url);
  }

  async updateSetting(
    setting: Partial<Settings>
  ): Promise<AxiosResponse<Settings | APIError>> {
    return this.axiosInstance.post(`/api/${this.version}/settings/`, setting);
  }
  async getManufacturingMenuItems(): Promise<
    AxiosResponse<ManufacturingMenuItems | APIError>
  > {
    const url = `/api/${this.version}/manufacturing`;
    return this.axiosInstance.get(url);
  }

  async updateManufacturingSettings(
    setting: Partial<ManufacturingSettings>
  ): Promise<AxiosResponse<ManufacturingSettings | APIError>> {
    return this.axiosInstance.post(
      `/api/${this.version}/manufacturing`,
      setting
    );
  }

  async updateFirmware(
    formData: FormData
  ): Promise<AxiosResponse<void | APIError>> {
    return this.axiosInstance.post(
      `/api/${this.version}/update/firmware`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      }
    );
  }

  async getWiFiStatus(): Promise<AxiosResponse<WifiStatus | APIError>> {
    return this.axiosInstance.get(`/api/${this.version}/wifi/config`);
  }

  async setWiFiConfig(
    data: Partial<WiFiConfig>
  ): Promise<AxiosResponse<WiFiConfig | APIError>> {
    return this.axiosInstance.post(`/api/${this.version}/wifi/config`, data);
  }

  async requestTest(test: TestType): Promise<AxiosResponse<void | APIError>> {
    return this.axiosInstance.get(`/api/${this.version}/test/${test}`);
  }

  async getWiFiQR(): Promise<AxiosResponse<Blob>> {
    const response = await this.axiosInstance.get(
      `/api/${this.version}/wifi/config/qr.png`,
      {
        responseType: 'blob'
      }
    );
    return response;
  }

  getWiFiQRURL(): string {
    return new URL(
      `/api/${this.version}/wifi/config/qr.png`,
      this.axiosInstance.getUri()
    ).toString();
  }

  async listAvailableWiFi(): Promise<AxiosResponse<WiFiNetwork[] | APIError>> {
    return this.axiosInstance.get(`/api/${this.version}/wifi/list`);
  }

  async connectToWiFi(
    data: WiFiCredentials
  ): Promise<AxiosResponse<void | APIError>> {
    return this.axiosInstance.post(`/api/${this.version}/wifi/connect`, data);
  }

  async deleteWifi({
    ssid
  }: {
    ssid: string;
  }): Promise<AxiosResponse<void | APIError>> {
    return this.axiosInstance.post(`/api/${this.version}/wifi/delete`, {
      ssid
    });
  }

  async playSound(sound: string): Promise<AxiosResponse<void | APIError>> {
    return this.axiosInstance.get(`/api/${this.version}/sounds/play/${sound}`);
  }

  async listSounds(): Promise<AxiosResponse<string[] | APIError>> {
    return this.axiosInstance.get(`/api/${this.version}/sounds/list`);
  }

  async listSoundThemes(): Promise<AxiosResponse<string[] | APIError>> {
    return this.axiosInstance.get(`/api/${this.version}/sounds/theme/list`);
  }

  async getSoundTheme(): Promise<AxiosResponse<string | APIError>> {
    return this.axiosInstance.get(`/api/${this.version}/sounds/theme/get`);
  }

  async setSoundTheme(theme: string): Promise<AxiosResponse<void | APIError>> {
    return this.axiosInstance.post(
      `/api/${this.version}/sounds/theme/set/${theme}`
    );
  }

  async getDeviceInfo(): Promise<AxiosResponse<DeviceInfo | APIError>> {
    return this.axiosInstance.get(`/api/${this.version}/machine`);
  }

  /**
   * POST /machine/unlock. Resolves for expected response statuses so callers
   * can switch on `response.status`; other statuses and transport errors reject.
   */
  async unlockMachine(
    code: string
  ): Promise<AxiosResponse<UnlockMachineResponse | APIError>> {
    const body: UnlockMachineRequest = { code };
    return this.axiosInstance.post(
      `/api/${this.version}/machine/unlock`,
      body,
      {
        validateStatus: (status) => [200, 400, 403, 429].includes(status)
      }
    );
  }

  /**
   * POST /auth/pairing. `new` works only on the machine itself, `grant` needs a
   * paired device. Resolves on 200, 400 (INVALID_MODE), 401 (UNAUTHORIZED),
   * 403 (LOCAL_ONLY) and 404 (a backend without device authorization).
   */
  async requestPairingCode(
    mode: AuthPairingMode
  ): Promise<AxiosResponse<PairingCodeResponse | APIError>> {
    return this.axiosInstance.post(
      `/api/${this.version}/auth/pairing`,
      undefined,
      {
        params: { mode },
        validateStatus: (status) => [200, 400, 401, 403, 404].includes(status)
      }
    );
  }

  /**
   * POST /auth/token. Trades a pairing code for a token; it does not store the
   * token, call setToken with it. Resolves on 200, 400 (INVALID_REQUEST),
   * 401 (INVALID_CODE), 404 (a backend without device authorization) and
   * 429 (TOO_MANY_ATTEMPTS, see the `Retry-After` header).
   */
  async exchangePairingCode(
    code: string,
    name?: string
  ): Promise<AxiosResponse<TokenResponse | APIError>> {
    const body: TokenExchangeRequest =
      name === undefined ? { code } : { code, name };
    return this.axiosInstance.post(`/api/${this.version}/auth/token`, body, {
      validateStatus: (status) => [200, 400, 401, 404, 429].includes(status)
    });
  }

  /**
   * GET /auth/validate. 200 when this device may use the API, 401
   * (UNAUTHORIZED) when it has to pair, 404 on a backend without device
   * authorization. A given `token` is checked instead of the stored one.
   */
  async validateToken(
    token?: string
  ): Promise<AxiosResponse<TokenValidation | APIError>> {
    return this.axiosInstance.get(`/api/${this.version}/auth/validate`, {
      ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
      validateStatus: (status) => [200, 401, 404].includes(status)
    });
  }

  /**
   * POST /auth/request. Asks the person at the machine to let this device in;
   * poll the result with getAccessRequest. Resolves on 202, 400
   * (INVALID_REQUEST), 404 (a backend without device authorization), 409
   * (REQUEST_PENDING) and 429 (TOO_MANY_ATTEMPTS, see `Retry-After`).
   */
  async requestAccess(
    name: string
  ): Promise<AxiosResponse<AccessRequestResponse | APIError>> {
    return this.axiosInstance.post(
      `/api/${this.version}/auth/request`,
      { name },
      {
        validateStatus: (status) => [202, 400, 404, 409, 429].includes(status)
      }
    );
  }

  /**
   * GET /auth/request/<id>. Resolves on 200 and on 404 (NOT_FOUND, or a
   * backend without device authorization).
   */
  async getAccessRequest(
    id: string
  ): Promise<AxiosResponse<AccessRequestStatus | APIError>> {
    return this.axiosInstance.get(
      `/api/${this.version}/auth/request/${encodeURIComponent(id)}`,
      {
        validateStatus: (status) => [200, 404].includes(status)
      }
    );
  }

  /**
   * POST /auth/sign_out_all. Invalidates every issued token; works only on the
   * machine itself. Resolves on 200, 403 (LOCAL_ONLY) and 404 (a backend
   * without device authorization).
   */
  async signOutAllDevices(): Promise<
    AxiosResponse<{ status: 'ok' } | APIError>
  > {
    return this.axiosInstance.post(
      `/api/${this.version}/auth/sign_out_all`,
      undefined,
      {
        validateStatus: (status) => [200, 403, 404].includes(status)
      }
    );
  }

  async setBrightness(
    brightness: BrightnessRequest
  ): Promise<AxiosResponse<APIError | null>> {
    return this.axiosInstance.post('/api/v1/machine/backlight', brightness);
  }

  async createReport(
    request?: CreateReportRequest,
    options?: ReportRequestOptions
  ): Promise<ReportResult<DraftInfo>> {
    try {
      const response = await this.axiosInstance.post<DraftInfo | APIError>(
        `/api/${this.version}/reports/create`,
        request,
        reportRequestConfig(options, {
          headers: { Accept: 'application/json' }
        })
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        return parseAPIError(error.response?.data);
      }
      return parseAPIError(error);
    }
  }

  /**
   * Mint a localID without collecting anything. Pair with `dispatchReport`
   * to let the dial do the collection and upload.
   */
  async requestReport(
    options?: ReportRequestOptions
  ): Promise<ReportResult<DraftInfo>> {
    try {
      const response = await this.axiosInstance.post<DraftInfo | APIError>(
        `/api/${this.version}/reports/request`,
        undefined,
        reportRequestConfig(options ?? { timeout: 15_000 }, {
          headers: { Accept: 'application/json' }
        })
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        return parseAPIError(error.response?.data);
      }
      return parseAPIError(error);
    }
  }

  /** Hand a report over to the dial; resolves once the backend queued it. */
  async dispatchReport(
    dispatch: ReportDispatch,
    options?: ReportRequestOptions
  ): Promise<ReportResult<UploadReportEvent>> {
    try {
      const response = await this.axiosInstance.post<
        UploadReportEvent | APIError
      >(
        `/api/${this.version}/reports/dispatch`,
        dispatch,
        reportRequestConfig(options ?? { timeout: 15_000 }, {
          headers: { Accept: 'application/json' }
        })
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        return parseAPIError(error.response?.data);
      }
      return parseAPIError(error);
    }
  }

  /** Dispatched reports the dial has not collected yet, oldest first. */
  async getPendingReportDispatches(
    options?: ReportRequestOptions
  ): Promise<ReportResult<UploadReportEvent[]>> {
    try {
      const response = await this.axiosInstance.get<
        { content: UploadReportEvent[] } | APIError
      >(
        `/api/${this.version}/reports/dispatch`,
        reportRequestConfig(options ?? { timeout: 15_000 }, {
          headers: { Accept: 'application/json' }
        })
      );
      return isAPIError(response.data) ? response.data : response.data.content;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        return parseAPIError(error.response?.data);
      }
      return parseAPIError(error);
    }
  }

  /**
   * Reports in flight and the ones that ended in the last minute. `null`
   * means the backend predates report progress (it answers 404): keep the
   * behaviour from before it.
   */
  async getReportProgress(
    options?: ReportRequestOptions
  ): Promise<ReportResult<ReportProgress[] | null>> {
    try {
      const response = await this.axiosInstance.get<
        { content: ReportProgress[] } | APIError
      >(
        `/api/${this.version}/reports/progress`,
        reportRequestConfig(options ?? { timeout: 15_000 }, {
          headers: { Accept: 'application/json' }
        })
      );
      return isAPIError(response.data) ? response.data : response.data.content;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) return null;
        return parseAPIError(error.response?.data);
      }
      return parseAPIError(error);
    }
  }

  /** Report the uploader's own stage, or that it gave up on the report. */
  async updateReportProgress(
    localID: string,
    update: ReportProgressUpdate,
    options?: ReportRequestOptions
  ): Promise<ReportResult<ReportProgress>> {
    try {
      const response = await this.axiosInstance.post<ReportProgress | APIError>(
        `/api/${this.version}/reports/${encodeURIComponent(localID)}/progress`,
        update,
        reportRequestConfig(options ?? { timeout: 15_000 }, {
          headers: { Accept: 'application/json' }
        })
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        return parseAPIError(error.response?.data);
      }
      return parseAPIError(error);
    }
  }

  /**
   * Cancel a report until it is being uploaded; then the answer is
   * TOO_LATE_TO_CANCEL. Cancelling a cancelled report returns it again.
   */
  async cancelReport(
    localID: string,
    options?: ReportRequestOptions
  ): Promise<ReportResult<ReportProgress>> {
    try {
      const response = await this.axiosInstance.post<ReportProgress | APIError>(
        `/api/${this.version}/reports/${encodeURIComponent(localID)}/cancel`,
        undefined,
        reportRequestConfig(options ?? { timeout: 15_000 }, {
          headers: { Accept: 'application/json' }
        })
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        return parseAPIError(error.response?.data);
      }
      return parseAPIError(error);
    }
  }

  async getReportPreflight(
    probes: string[] = [],
    options?: ReportRequestOptions
  ): Promise<ReportResult<ReportPreflight>> {
    try {
      const params = new URLSearchParams();
      probes.slice(0, 4).forEach((url) => params.append('probe', url));
      const response = await this.axiosInstance.get<ReportPreflight | APIError>(
        `/api/${this.version}/reports/preflight`,
        reportRequestConfig(options ?? { timeout: 15_000 }, {
          headers: { Accept: 'application/json' },
          params
        })
      );
      return response.data;
    } catch (error) {
      return axios.isAxiosError(error)
        ? parseAPIError(error.response?.data)
        : parseAPIError(error);
    }
  }

  async getReports(
    pageParams: PageParams,
    options?: ReportRequestOptions
  ): Promise<ReportResult<PaginatedResponse<ReportInfo>>> {
    try {
      const response = await this.axiosInstance.get<
        PaginatedResponse<ReportInfo> | APIError
      >(
        `/api/${this.version}/reports/list`,
        reportRequestConfig(options, {
          headers: { Accept: 'application/json' },
          params: pageParams
        })
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        return parseAPIError(error.response?.data);
      }
      return parseAPIError(error);
    }
  }

  async getDraftReport(
    localID: string,
    options?: ReportRequestOptions
  ): Promise<ReportResult<Uint8Array>> {
    try {
      const response = await this.axiosInstance.get<ArrayBuffer | APIError>(
        `/api/${this.version}/reports/draft/${encodeURIComponent(localID)}`,
        reportRequestConfig(options, {
          headers: { Accept: 'application/octet-stream' },
          responseType: 'arraybuffer'
        })
      );

      return new Uint8Array(response.data as ArrayBuffer);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        return parseBinaryErrorBody(error.response?.data);
      }
      return parseAPIError(error);
    }
  }

  async deleteDraftReport(
    localID: string,
    options?: ReportRequestOptions
  ): Promise<ReportResult<void>> {
    try {
      const response = await this.axiosInstance.delete<void | APIError>(
        `/api/${this.version}/reports/draft/${encodeURIComponent(localID)}`,
        reportRequestConfig(options, {
          headers: { Accept: 'application/json' }
        })
      );
      return isAPIError(response.data) ? response.data : undefined;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        return parseAPIError(error.response?.data);
      }
      return parseAPIError(error);
    }
  }

  async updateReport(
    id: string,
    patch: Partial<ReportInfo>,
    options?: ReportRequestOptions
  ): Promise<ReportResult<ReportInfo>> {
    try {
      const normalizedReport: Partial<ReportInfo> = {};
      REPORT_INFO_KEYS.forEach((key) => {
        if (key in patch) {
          normalizedReport[key] = (patch[key] ?? null) as never;
        }
      });

      const response = await this.axiosInstance.put<ReportInfo | APIError>(
        `/api/${this.version}/reports/draft/${encodeURIComponent(id)}`,
        normalizedReport,
        reportRequestConfig(options, {
          headers: { Accept: 'application/json' }
        })
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        return parseAPIError(error.response?.data);
      }
      return parseAPIError(error);
    }
  }

  async markSubmittedReport(
    submitInfo: SubmitInfo,
    options?: ReportRequestOptions
  ): Promise<ReportResult<void>> {
    try {
      const response = await this.axiosInstance.post<void | APIError>(
        `/api/${this.version}/reports/submit`,
        submitInfo,
        reportRequestConfig(options, {
          headers: { Accept: 'application/json' }
        })
      );
      return isAPIError(response.data) ? response.data : undefined;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        return parseAPIError(error.response?.data);
      }
      return parseAPIError(error);
    }
  }

  async getMeticulousReportTracking(
    serviceUrl: string,
    payload: MeticulousIDRequestType,
    options?: ReportRequestOptions
  ): Promise<ReportResult<number>> {
    try {
      const response = await axios.post<{ ticket: number } | APIError>(
        serviceUrl,
        payload,
        reportRequestConfig(options ?? { timeout: 15_000 }, {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json'
          }
        })
      );

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
    } catch (error) {
      if (axios.isAxiosError(error)) {
        return parseAPIError(error.response?.data);
      }
      return parseAPIError(error);
    }
  }

  async getDefaultProfiles(): Promise<
    AxiosResponse<Profile[] | DefaultProfiles | APIError>
  > {
    return this.axiosInstance.get(`/api/${this.version}/profile/defaults`);
  }

  async getHistoryShortListing(): Promise<
    AxiosResponse<HistoryListingResponse>
  > {
    return this.axiosInstance.get(`/api/${this.version}/history`);
  }

  async searchHistory(
    query: Partial<HistoryQueryParams>
  ): Promise<AxiosResponse<HistoryResponse>> {
    return this.axiosInstance.post(`/api/${this.version}/history`, query);
  }

  async searchHistoricalProfiles(
    query: string
  ): Promise<AxiosResponse<HistoryListingResponse>> {
    return this.axiosInstance.get(
      `/api/${this.version}/history/search?query=` + query
    );
  }

  async getCurrentShot(): Promise<AxiosResponse<HistoryEntry | null>> {
    return this.axiosInstance.get(`/api/${this.version}/history/current`);
  }

  async getLastShot(): Promise<AxiosResponse<HistoryEntry | null>> {
    return this.axiosInstance.get(`/api/${this.version}/history/last`);
  }

  async getHistoryStatistics(): Promise<AxiosResponse<HistoryStats>> {
    return this.axiosInstance.get(`/api/${this.version}/history/stats`);
  }

  async getOSStatus(): Promise<AxiosResponse<OSStatusResponse>> {
    return this.axiosInstance.get(
      `/api/${this.version}/machine/OS_update_status`
    );
  }

  async getTimezoneRegion(
    region_type: regionType,
    conditional: string
  ): Promise<AxiosResponse<Regions | APIError>> {
    return this.axiosInstance.get(
      `/api/${this.version}/timezones/${region_type}`,
      { params: { filter: conditional } }
    );
  }

  async getRootPassword(): Promise<
    AxiosResponse<{ status: string; root_password: string } | APIError>
  > {
    return this.axiosInstance.get(`/api/${this.version}/machine/root-password`);
  }

  async setTime(dateTime: Date): Promise<AxiosResponse<Regions | APIError>> {
    return this.axiosInstance.post(`/api/${this.version}/machine/time`, {
      date: dateTime.toISOString()
    });
  }

  async rateShot(
    shotId: number,
    rating: ShotRating
  ): Promise<AxiosResponse<RateShotResponse | APIError>> {
    return this.axiosInstance.post(
      `/api/${this.version}/history/rating/${shotId}`,
      { rating }
    );
  }

  async getShotRating(
    shotId: number
  ): Promise<AxiosResponse<ShotRatingResponse | APIError>> {
    return this.axiosInstance.get(
      `/api/${this.version}/history/rating/${shotId}`
    );
  }
}
