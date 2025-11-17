import mongoose from "mongoose";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_REGEX =
  /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/[^\s]*)?$/i;
const INDIAN_PHONE_REGEX = /^\+?91[6-9]\d{9}$/;

export const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

export const isValidEmail = (value) => EMAIL_REGEX.test(String(value || "").trim().toLowerCase());

export const isValidPhone = (value) => INDIAN_PHONE_REGEX.test(String(value || "").replace(/\s+/g, ""));

export const isValidUrl = (value) => URL_REGEX.test(String(value || "").trim());

export const isISODateString = (value) => !Number.isNaN(Date.parse(value));

export const isPositiveNumber = (value) => typeof value === "number" && Number.isFinite(value) && value >= 0;

export const isEnumValue = (value, enumObject) => Object.values(enumObject || {}).includes(value);
