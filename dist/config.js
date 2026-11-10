// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 EnWithAI Technologies
/**
 * Configuration (.outcome-check.json): defaults and strict validation. Data only: no JavaScript, no regular
 * expressions, unknown keys rejected.
 */
import { readFileSync } from "node:fs";
import { usageError } from "./errors.js";
/** Defaults: no attribution rules (everything unknown unless an attribution file says otherwise). */
export const DEFAULT_CONFIG = {
    attributionLabels: {},
    commitTrailers: [],
    excludeLabels: [],
    includeBots: false,
    minSample: 20,
};
const KEYS = ["$schema", "attribution", "exclude_labels", "include_bots", "min_sample"];
/** Throws a usage error naming the offending key. */
function bad(key, message) {
    throw usageError(`Invalid config: ${key} ${message}`, "See docs/CONFIG.md.");
}
/** Validates a list of short plain strings. */
function strings(value, key) {
    if (!Array.isArray(value) ||
        value.length > 200 ||
        value.some((s) => typeof s !== "string" || s.length === 0 || s.length > 200))
        bad(key, "must be an array of 1–200 character strings (max 200 entries)");
    return value;
}
/** Validates a parsed JSON value and applies defaults. Exported for tests. */
export function validateConfig(raw) {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw))
        bad("root", "must be a JSON object");
    const obj = raw;
    for (const key of Object.keys(obj))
        if (!KEYS.includes(key))
            bad(key, "is not a known key");
    const config = { ...DEFAULT_CONFIG, attributionLabels: {}, commitTrailers: [], excludeLabels: [] };
    if (obj.attribution !== undefined) {
        const a = obj.attribution;
        if (a === null || typeof a !== "object" || Array.isArray(a))
            bad("attribution", "must be an object");
        for (const key of Object.keys(a))
            if (key !== "labels" && key !== "commit_trailers")
                bad(`attribution.${key}`, "is not a known key");
        if (a.labels !== undefined) {
            const labels = a.labels;
            if (labels === null || typeof labels !== "object" || Array.isArray(labels))
                bad("attribution.labels", "must be an object");
            for (const [label, flag] of Object.entries(labels)) {
                if (typeof flag !== "boolean")
                    bad(`attribution.labels.${label}`, "must be true or false");
                if (label.length === 0 || label.length > 200)
                    bad("attribution.labels", "names must be 1–200 characters");
                config.attributionLabels[label] = flag;
            }
        }
        if (a.commit_trailers !== undefined)
            config.commitTrailers = strings(a.commit_trailers, "attribution.commit_trailers");
    }
    if (obj.exclude_labels !== undefined)
        config.excludeLabels = strings(obj.exclude_labels, "exclude_labels");
    if (obj.include_bots !== undefined) {
        if (typeof obj.include_bots !== "boolean")
            bad("include_bots", "must be a boolean");
        config.includeBots = obj.include_bots;
    }
    if (obj.min_sample !== undefined) {
        if (!Number.isInteger(obj.min_sample) ||
            obj.min_sample < 1 ||
            obj.min_sample > 10_000)
            bad("min_sample", "must be an integer from 1 to 10000");
        config.minSample = obj.min_sample;
    }
    return config;
}
/** Reads and validates a config file. */
export function loadConfigFile(path) {
    let text;
    try {
        text = readFileSync(path, "utf8");
    }
    catch {
        throw usageError(`Cannot read config file: ${path}`);
    }
    if (text.length > 1024 * 1024)
        throw usageError("Config file is too large (max 1 MiB)");
    let raw;
    try {
        raw = JSON.parse(text);
    }
    catch (error) {
        throw usageError(`Config file is not valid JSON: ${error.message}`);
    }
    return validateConfig(raw);
}
