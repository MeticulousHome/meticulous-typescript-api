"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.APMode = exports.isLimitedAccess = exports.LIMITED_ACCESS_CHANNEL = void 0;
/** `Settings.update_channel` value that puts the machine in limited access. */
exports.LIMITED_ACCESS_CHANNEL = 'factory';
const isLimitedAccess = (settings) => settings?.update_channel === exports.LIMITED_ACCESS_CHANNEL;
exports.isLimitedAccess = isLimitedAccess;
var APMode;
(function (APMode) {
    APMode["AP"] = "AP";
    APMode["CLIENT"] = "CLIENT";
})(APMode || (exports.APMode = APMode = {}));
//# sourceMappingURL=types.js.map