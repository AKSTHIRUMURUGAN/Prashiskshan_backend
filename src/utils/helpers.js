import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from "./constants.js";

export const noop = () => {};

export const pick = (object = {}, keys = []) =>
  keys.reduce((acc, key) => {
    if (Object.prototype.hasOwnProperty.call(object, key)) {
      acc[key] = object[key];
    }
    return acc;
  }, {});

export const omit = (object = {}, keys = []) =>
  Object.keys(object).reduce((acc, key) => {
    if (!keys.includes(key)) {
      acc[key] = object[key];
    }
    return acc;
  }, {});

export const maskEmail = (email = "") => {
  if (!email || !email.includes("@")) return email;
  const [name, domain] = email.split("@");
  const maskedName = name.length <= 2 ? `${name[0] || ""}*` : `${name[0]}***${name.slice(-1)}`;
  return `${maskedName}@${domain}`;
};

export const maskPhone = (phone = "") => {
  if (!phone) return phone;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "*".repeat(digits.length);
  return `${"*".repeat(digits.length - 4)}${digits.slice(-4)}`;
};

export const normalizePhone = (phone = "") => phone?.replace(/\s+/g, "") || "";

export const buildCacheKey = (...parts) =>
  parts
    .flat()
    .filter((part) => part !== undefined && part !== null && part !== "")
    .join(":");

export const parsePaginationParams = (query = {}, options = {}) => {
  const defaultLimit = options.defaultLimit || DEFAULT_PAGE_LIMIT;
  const maxLimit = options.maxLimit || MAX_PAGE_LIMIT;
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const rawLimit = parseInt(query.limit, 10) || defaultLimit;
  const limit = Math.min(Math.max(rawLimit, 1), maxLimit);
  const skip = (page - 1) * limit;
  const sort = query.sort || options.defaultSort || "-createdAt";
  return { page, limit, skip, sort };
};

export const secondsFromNow = (seconds = 0) => new Date(Date.now() + seconds * 1000);

export const toBoolean = (value, fallback = false) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value > 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "y"].includes(normalized)) return true;
    if (["false", "0", "no", "n"].includes(normalized)) return false;
  }
  return fallback;
};

export const toNumber = (value, fallback = undefined) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const safeJsonParse = (payload, fallback = null) => {
  try {
    return JSON.parse(payload);
  } catch (error) {
    return fallback;
  }
};

