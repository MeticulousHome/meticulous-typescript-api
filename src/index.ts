import axios, { AxiosInstance, AxiosResponse } from 'axios';
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
  CreateReportOptions,
  DraftInfo,
  MeticulousIDRequestType,
  PaginatedResponse,
  PageParams,
  ReportInfo,
  SubmitInfo
} from './types';

import { Profile } from '@meticulous-home/espresso-profile';

import {
  PinnedCredential,
  MachineIdentity,
  VerifyResult,
  canonicalOrigin,
  buildIdentityMessage,
  fingerprintOf,
  verifyIdentitySignature,
  randomNonce
} from './identity';

export * from './types';

// Freshness window for an identity verification (panel decision D2: 60 s, kept
// tight because a silent same-IP takeover fires none of the forced-clear
// triggers). A sub-millisecond verify makes this essentially free.
const IDENTITY_TTL_MS = 60_000;

// Thrown by a machine request when the origin has not proven possession of the
// pinned identity key. The credential is NOT sent.
export class MachineIdentityError extends Error {
  constructor(
    public readonly result: VerifyResult,
    public readonly origin: string
  ) {
    super(`machine identity ${result} for ${origin}`);
    this.name = 'MachineIdentityError';
  }
}

export interface MachineDataClientOptions {
  onStatus?: (data: StatusData) => void;
  onTemperatures?: (data: Temperatures) => void;
  onCommunication?: (data: Communication) => void;
  onActuators?: (data: Actuators) => void;
  onProfileUpdate?: (data: ProfileUpdate) => void;
  onNotification?: (data: NotificationItem) => void;
  // Invoked when the machine answers 401 (this device is not paired, or its
  // token was revoked). The app should start the re-pairing flow.
  onUnauthorized?: () => void;
  // Invoked when the origin's identity does not match the pinned credential
  // (a different machine, or an impostor at a reused address). The credential
  // stays stored; the app should show "identity changed" and offer re-pairing.
  onIdentityChanged?: (origin: string, result: VerifyResult) => void;
}

// --- Device pairing (per-device API access tokens) -------------------------

export interface PairingRequest {
  pairing_id: string;
  expires_in: number;
}

export interface PairingStatus {
  status: 'pending' | 'approved' | 'denied' | 'expired';
  token?: string;
}

export interface PairingVerifyResult {
  status: 'approved';
  token: string;
}

export interface PairedDevice {
  device_id: string;
  device_name: string;
  created_at: string | null;
  last_seen_at: string | null;
}

export type ReportResult<T> = T | APIError;

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
  // Per-device API token obtained through pairing. Attached to every HTTP
  // request and to the Socket.IO handshake. Undefined until the device is
  // paired; the pairing endpoints themselves are reachable without it.
  private token?: string;
  // The pinned machine identity (phase 1). When set, the client rule is
  // enforced: no credential is attached to an origin that has not just proven
  // possession of `credential.publicKey`. A legacy token with no credential
  // keeps the old behavior (for a backend that has no identity yet).
  private credential?: PinnedCredential;
  // Incremented whenever the credential reference is replaced. Identity
  // proofs are asynchronous; without a generation check, a proof for an old
  // key can finish after re-pairing and accidentally authorize the new token.
  private credentialRevision = 0;
  // Credential-less axios instance for the identity probes (GET /machine,
  // POST /identity/challenge). It carries NO interceptor, so verification never
  // recurses, and never follows a redirect (a 3xx is a failure, not a hop to
  // another origin).
  private probeAxios: AxiosInstance;
  private verifiedAt = 0;
  private verifiedFingerprint?: string;

  constructor(
    private options?: MachineDataClientOptions,
    base_url?: string,
    token?: string
  ) {
    const serverURL = base_url || 'http://localhost:8080/';
    this.serverURL = serverURL;
    this.token = token;

    // AXIOS
    this.axiosInstance = axios.create({
      baseURL: serverURL,
      maxRedirects: 0,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      }
    });

    this.probeAxios = axios.create({
      baseURL: serverURL,
      maxRedirects: 0,
      headers: { Accept: 'application/json' }
    });

    // maxRedirects is honored by Axios' Node adapter, but browsers use XHR,
    // which follows redirects automatically. XHR exposes the effective URL;
    // reject a changed one before any response can count as an identity proof
    // or physically-approved pairing response.
    const rejectEffectiveRedirect = (response: AxiosResponse) => {
      const responseURL = (response.request as { responseURL?: unknown })
        ?.responseURL;
      if (typeof responseURL === 'string' && responseURL) {
        const requestedURL = new URL(
          response.config.url ?? '',
          response.config.baseURL ?? this.serverURL
        ).toString();
        let effectiveURL: string;
        try {
          effectiveURL = new URL(responseURL).toString();
        } catch {
          throw new MachineIdentityError('redirect', this.origin());
        }
        if (effectiveURL !== requestedURL) {
          throw new MachineIdentityError('redirect', this.origin());
        }
      }
      return response;
    };
    this.probeAxios.interceptors.response.use(rejectEffectiveRedirect);

    // Before attaching the token, prove the origin holds the pinned identity
    // key. This is the whole guarantee: a substitute server at a reused address
    // cannot sign the challenge, so the token is never sent to it. The probe
    // uses probeAxios (no interceptor), so this does not recurse.
    this.axiosInstance.interceptors.request.use(async (config) => {
      const token = await this.getVerifiedToken();
      if (token) {
        config.headers = config.headers ?? {};
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Surface a 401 so the app can guide re-pairing, and reject redirects from
    // credentialed endpoints in both Node and browser transports. Clear the
    // verification cache so the next credentialed request re-verifies
    // (ADV-016: only the credential that made the rejected request is affected).
    const credentialedRedirectError = () => {
      this.verifiedAt = 0;
      if (this.credential) {
        this.credential.state = 'identity_changed';
        this.options?.onIdentityChanged?.(this.origin(), 'redirect');
      }
      return new MachineIdentityError('redirect', this.origin());
    };
    this.axiosInstance.interceptors.response.use(
      (response) => {
        try {
          return rejectEffectiveRedirect(response);
        } catch (error) {
          if (this.isRedirect(error)) throw credentialedRedirectError();
          throw error;
        }
      },
      (error) => {
        if (this.isRedirect(error)) {
          return Promise.reject(credentialedRedirectError());
        }
        if (error?.response?.status === 401) {
          this.verifiedAt = 0;
          this.options?.onUnauthorized?.();
        }
        return Promise.reject(error);
      }
    );
  }

  private origin(): string {
    return canonicalOrigin(this.serverURL);
  }

  // Update the token after a (re-)pairing. Reconnects the socket so the new
  // token is used in the handshake. Legacy: does not pin an identity.
  setToken(token: string | undefined) {
    this.token = token;
    this.verifiedAt = 0;
    if (this.socket !== undefined) {
      this.disconnectSocket();
      this.connectToSocket();
    }
  }

  getToken(): string | undefined {
    return this.credential?.token ?? this.token;
  }

  // Pin a machine credential (from completePairing / persisted storage). From
  // now on the identity rule is enforced for this origin.
  setCredential(credential: PinnedCredential | undefined) {
    this.credential = credential;
    this.credentialRevision++;
    this.verifiedAt = 0;
    if (this.socket !== undefined) {
      this.disconnectSocket();
      this.connectToSocket();
    }
  }

  getCredential(): PinnedCredential | undefined {
    return this.credential;
  }

  // Return the exact token whose credential remained current throughout its
  // proof. A caller can safely attach this captured value even if a later UI
  // action replaces the stored credential before the request is dispatched.
  // If a pin is removed while verification is in flight, never fall back to a
  // legacy token that was not part of the proof.
  async getVerifiedToken(): Promise<string | undefined> {
    const startedWithCredential = this.credential !== undefined;
    while (this.credential) {
      const credential = this.credential;
      const revision = this.credentialRevision;
      const result = await this.ensureVerified();

      if (
        this.credential !== credential ||
        this.credentialRevision !== revision
      ) {
        continue;
      }
      if (result !== 'ok') {
        if (result !== 'unreachable') {
          credential.state = 'identity_changed';
          this.options?.onIdentityChanged?.(this.origin(), result);
        }
        throw new MachineIdentityError(result, this.origin());
      }
      return credential.token;
    }
    return startedWithCredential ? undefined : this.token;
  }

  // The client rule, run before any credential leaves the device. Verifies that
  // the current origin has just signed a fresh nonce under the pinned key.
  async ensureVerified(): Promise<VerifyResult> {
    const cred = this.credential;
    if (!cred) return 'ok';
    const origin = this.origin();
    const fresh =
      Date.now() - this.verifiedAt < IDENTITY_TTL_MS &&
      this.verifiedFingerprint === cred.fingerprint;
    if (fresh) return 'ok';

    let machine;
    try {
      const r = await this.probeAxios.get(`/api/${this.version}/machine`, {
        validateStatus: (s) => s === 200
      });
      machine = r.data;
    } catch (e) {
      if (this.isRedirect(e)) return 'redirect';
      return 'unreachable';
    }
    const identity: MachineIdentity | undefined = machine?.identity;
    if (!identity || !identity.fingerprint) return 'no_identity';
    if (
      identity.fingerprint !== cred.fingerprint ||
      (machine.serial ?? '') !== cred.serial
    ) {
      return 'mismatch';
    }

    const nonce = randomNonce();
    let challenge;
    try {
      const r = await this.probeAxios.post(
        `/api/${this.version}/identity/challenge`,
        {
          nonce: this.toBase64(nonce),
          origin
        },
        { validateStatus: (s) => s === 200 }
      );
      challenge = r.data;
    } catch (e) {
      if (this.isRedirect(e)) return 'redirect';
      return 'mismatch';
    }
    if (challenge?.fingerprint !== cred.fingerprint) return 'mismatch';

    // Build the signed message from LOCAL values only (pinned serial, the origin
    // we are using, our nonce). A captured signature cannot match a new nonce.
    const message = buildIdentityMessage(cred.serial, origin, nonce);
    const ok = await verifyIdentitySignature(
      cred.publicKey,
      message,
      challenge.signature
    );
    if (!ok) return 'mismatch';

    this.verifiedAt = Date.now();
    this.verifiedFingerprint = cred.fingerprint;
    cred.state = 'ok';
    cred.lastOrigin = origin;
    return 'ok';
  }

  private isRedirect(e: unknown): boolean {
    if (e instanceof MachineIdentityError && e.result === 'redirect') {
      return true;
    }
    const status = (e as { response?: { status?: number } })?.response?.status;
    return typeof status === 'number' && status >= 300 && status < 400;
  }

  private toBase64(bytes: Uint8Array): string {
    if (typeof Buffer !== 'undefined')
      return Buffer.from(bytes).toString('base64');
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin);
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
    // Socket.io. The token travels in the handshake `auth` payload; the machine
    // refuses the connection for an unpaired LAN client. (The Dial itself talks
    // over loopback and is exempt server-side.)
    //
    // With a pinned credential the `auth` is the FUNCTION form: socket.io-client
    // calls it before every connection attempt (including automatic reconnects)
    // and waits for the callback, so no CONNECT packet ever carries a token that
    // has not just been verified for this origin. On mismatch we send {} (the
    // server refuses) and stop reconnecting until a later verification succeeds.
    const credential = this.credential;
    const credentialRevision = this.credentialRevision;
    const legacyToken = this.token;
    const authFn = (cb: (data: { token?: string }) => void): void => {
      if (!credential) {
        cb(legacyToken ? { token: legacyToken } : {});
        return;
      }
      // Every Socket.IO CONNECT/reconnect is a forced-clear trigger (D2), not
      // merely another consumer of an HTTP proof that may be 60 seconds old.
      this.verifiedAt = 0;
      this.ensureVerified()
        .then((result) => {
          if (
            this.credential !== credential ||
            this.credentialRevision !== credentialRevision
          ) {
            cb({});
            return;
          }
          if (result === 'ok') {
            cb({ token: credential.token });
          } else {
            if (result !== 'unreachable') {
              credential.state = 'identity_changed';
              this.options?.onIdentityChanged?.(this.origin(), result);
              this.socket?.io.reconnection(false);
            }
            cb({});
          }
        })
        .catch(() => cb({}));
    };

    this.socket = io(this.serverURL, {
      auth: credential ? authFn : legacyToken ? { token: legacyToken } : {}
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

  // --- Device pairing ------------------------------------------------------

  // Open a pairing session. The machine shows a 6-digit code on its Dial; this
  // call returns only the pairing_id (the code is never sent to the client, so
  // typing it back proves the user can see the machine).
  async requestPairing(
    deviceName: string
  ): Promise<AxiosResponse<PairingRequest | APIError>> {
    return this.probeAxios.post(`/api/${this.version}/pair/request`, {
      device_name: deviceName
    });
  }

  // Approve by typing back the code shown on the Dial. On success the response
  // carries the device token (plus the machine identity and serial). Prefer
  // completePairing(), which also pins the identity; use this only for the
  // legacy token flow.
  async verifyPairingCode(
    pairingId: string,
    code: string,
    clientPublicKey?: string
  ): Promise<AxiosResponse<PairingVerifyResult | APIError>> {
    return this.probeAxios.post(`/api/${this.version}/pair/verify`, {
      pairing_id: pairingId,
      code,
      ...(clientPublicKey
        ? { client_public_key: clientPublicKey, client_key_alg: 'ES256' }
        : {})
    });
  }

  // The full first-pairing step: type back the code, then TRUST ON FIRST USE
  // anchored on that code. The code proves the user saw the real Dial; the
  // challenge proves the origin that returned the token holds the key it
  // claims. The credential is pinned only if the challenge verifies.
  async completePairing(
    pairingId: string,
    code: string,
    clientPublicKey?: string
  ): Promise<PinnedCredential> {
    const res = await this.verifyPairingCode(pairingId, code, clientPublicKey);
    const data = res.data as PairingVerifyResult & {
      serial?: string;
      identity?: MachineIdentity;
    };
    if (isAPIError(data) || !data.token) {
      throw new Error('pairing failed');
    }
    if (
      !data.identity ||
      !data.identity.fingerprint ||
      !data.identity.public_key
    ) {
      // A backend without identity cannot be pinned. Do not fall back to a bare
      // token: that is the pre-identity behavior the rule exists to end.
      throw new MachineIdentityError('no_identity', this.origin());
    }
    const serial = data.serial ?? '';
    if (!serial) {
      // An empty serial cannot anchor a per-serial credential (D8).
      throw new Error(
        'machine reported an empty serial; cannot pin credential'
      );
    }
    // Sanity: the delivered fingerprint must match its own public key.
    if (fingerprintOf(data.identity.public_key) !== data.identity.fingerprint) {
      throw new MachineIdentityError('mismatch', this.origin());
    }
    const credential: PinnedCredential = {
      serial,
      fingerprint: data.identity.fingerprint,
      publicKey: data.identity.public_key,
      token: data.token,
      state: 'ok'
    };
    // Verify once before trusting it (challenge against the pairing origin).
    this.credential = credential;
    const credentialRevision = ++this.credentialRevision;
    this.verifiedAt = 0;
    const result = await this.ensureVerified();
    if (
      this.credential !== credential ||
      this.credentialRevision !== credentialRevision
    ) {
      throw new Error('pairing superseded by a newer credential');
    }
    if (result !== 'ok') {
      this.credential = undefined;
      this.credentialRevision++;
      throw new MachineIdentityError(result, this.origin());
    }
    return credential;
  }

  // Poll a pairing session (used when approval happens with the Dial knob
  // rather than by typing the code); returns the token once approved.
  async getPairingStatus(
    pairingId: string
  ): Promise<AxiosResponse<PairingStatus | APIError>> {
    return this.probeAxios.get(`/api/${this.version}/pair/status/${pairingId}`);
  }

  // List the devices currently paired with the machine (needs a valid token).
  async listPairedDevices(): Promise<
    AxiosResponse<{ devices: PairedDevice[] } | APIError>
  > {
    return this.axiosInstance.get(`/api/${this.version}/pair/devices`);
  }

  // Revoke a paired device by id (needs a valid token).
  async revokePairedDevice(
    deviceId: string
  ): Promise<AxiosResponse<{ status: string } | APIError>> {
    return this.axiosInstance.post(
      `/api/${this.version}/pair/devices/${deviceId}/revoke`,
      {}
    );
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

  async setBrightness(
    brightness: BrightnessRequest
  ): Promise<AxiosResponse<APIError | null>> {
    return this.axiosInstance.post('/api/v1/machine/backlight', brightness);
  }

  async createReport(
    request?: CreateReportRequest,
    options?: CreateReportOptions
  ): Promise<ReportResult<DraftInfo>> {
    try {
      const config = {
        headers: {
          Accept: 'application/json'
        },
        signal: options?.signal
      };
      const response = request
        ? await this.axiosInstance.post<DraftInfo | APIError>(
            `/api/${this.version}/reports/create`,
            request,
            config
          )
        : await this.axiosInstance.post<DraftInfo | APIError>(
            `/api/${this.version}/reports/create`,
            undefined,
            config
          );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        return parseAPIError(error.response?.data);
      }
      return parseAPIError(error);
    }
  }

  async getReports(
    pageParams: PageParams
  ): Promise<ReportResult<PaginatedResponse<ReportInfo>>> {
    try {
      const response = await this.axiosInstance.get<
        PaginatedResponse<ReportInfo> | APIError
      >(`/api/${this.version}/reports/list`, {
        headers: {
          Accept: 'application/json'
        },
        params: pageParams
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        return parseAPIError(error.response?.data);
      }
      return parseAPIError(error);
    }
  }

  async getDraftReport(localID: string): Promise<ReportResult<Uint8Array>> {
    try {
      const response = await this.axiosInstance.get<ArrayBuffer | APIError>(
        `/api/${this.version}/reports/draft/${localID}`,
        {
          headers: {
            Accept: 'application/octet-stream'
          },
          responseType: 'arraybuffer'
        }
      );

      return new Uint8Array(response.data as ArrayBuffer);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        return parseBinaryErrorBody(error.response?.data);
      }
      return parseAPIError(error);
    }
  }

  async deleteDraftReport(localID: string): Promise<ReportResult<void>> {
    try {
      const response = await this.axiosInstance.delete<void | APIError>(
        `/api/${this.version}/reports/draft/${localID}`,
        {
          headers: {
            Accept: 'application/json'
          }
        }
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
    patch: Partial<ReportInfo>
  ): Promise<ReportResult<ReportInfo>> {
    try {
      const normalizedReport: Partial<ReportInfo> = {};
      REPORT_INFO_KEYS.forEach((key) => {
        if (key in patch) {
          normalizedReport[key] = (patch[key] ?? null) as never;
        }
      });

      const response = await this.axiosInstance.put<ReportInfo | APIError>(
        `/api/${this.version}/reports/draft/${id}`,
        normalizedReport,
        {
          headers: {
            Accept: 'application/json'
          }
        }
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
    submitInfo: SubmitInfo
  ): Promise<ReportResult<void>> {
    try {
      const response = await this.axiosInstance.post<void | APIError>(
        `/api/${this.version}/reports/submit`,
        submitInfo,
        {
          headers: {
            Accept: 'application/json'
          }
        }
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
    payload: MeticulousIDRequestType
  ): Promise<ReportResult<number>> {
    try {
      const response = await axios.post<{ ticket: number } | APIError>(
        serviceUrl,
        payload,
        {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json'
          }
        }
      );

      if (isAPIError(response.data)) {
        return response.data;
      }

      return response.data.ticket;
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
export * from './identity';
