"use client";

import { useState, useEffect } from "react";
import {
  storeApiKey,
  getApiKeyInfo,
  removeApiKey,
  hasValidApiKey,
  validateApiKey,
} from "../../../lib/security/apiKeyStorage";

interface ApiKeyConfigProps {
  onApiKeyChange?: (hasValidKey: boolean) => void;
}

export default function ApiKeyConfig({ onApiKeyChange }: ApiKeyConfigProps) {
  const [apiKey, setApiKey] = useState("");
  const [isValid, setIsValid] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [keyInfo, setKeyInfo] = useState<{
    exists: boolean;
    expiresAt?: number;
    timestamp?: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Load existing key info
  useEffect(() => {
    const info = getApiKeyInfo();
    setKeyInfo(info);
    setIsValid(hasValidApiKey());

    if (onApiKeyChange) {
      onApiKeyChange(hasValidApiKey());
    }
  }, [onApiKeyChange]);

  // Validate API key as user types
  useEffect(() => {
    if (apiKey.trim()) {
      setIsValid(validateApiKey(apiKey.trim()));
      setError(null);
    } else {
      setIsValid(false);
    }
  }, [apiKey]);

  const handleSave = () => {
    try {
      setError(null);
      setSuccess(null);

      const trimmedKey = apiKey.trim();
      if (!validateApiKey(trimmedKey)) {
        setError(
          "Invalid API key format. Please check your key and try again.",
        );
        return;
      }

      // Store the API key (expires in 30 days)
      storeApiKey(trimmedKey, 24 * 30);

      setSuccess("API key saved successfully!");
      setApiKey("");

      // Update key info
      const info = getApiKeyInfo();
      setKeyInfo(info);
      setIsValid(true);

      if (onApiKeyChange) {
        onApiKeyChange(true);
      }
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Failed to save API key",
      );
    }
  };

  const handleRemove = () => {
    try {
      removeApiKey();
      setApiKey("");
      setError(null);
      setSuccess("API key removed successfully!");

      // Update key info
      const info = getApiKeyInfo();
      setKeyInfo(info);
      setIsValid(false);

      if (onApiKeyChange) {
        onApiKeyChange(false);
      }
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Failed to remove API key",
      );
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatExpiry = (expiresAt: number) => {
    const now = Date.now();
    const diff = expiresAt - now;

    if (diff <= 0) {
      return "Expired";
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) {
      return `${days} day${days > 1 ? "s" : ""} remaining`;
    } else {
      return `${hours} hour${hours > 1 ? "s" : ""} remaining`;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 max-w-md mx-auto">
      <h2 className="text-xl font-semibold mb-4 text-gray-800">
        API Key Configuration
      </h2>

      {/* Current Key Status */}
      {keyInfo?.exists && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-800">
                API Key Configured
              </p>
              <p className="text-xs text-green-600">
                Added:{" "}
                {keyInfo.timestamp ? formatDate(keyInfo.timestamp) : "Unknown"}
              </p>
              {keyInfo.expiresAt && (
                <p className="text-xs text-green-600">
                  Expires: {formatExpiry(keyInfo.expiresAt)}
                </p>
              )}
            </div>
            <button
              onClick={handleRemove}
              className="text-red-600 hover:text-red-800 text-sm font-medium"
            >
              Remove
            </button>
          </div>
        </div>
      )}

      {/* API Key Input */}
      <div className="mb-4">
        <label
          htmlFor="apiKey"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          API Key
        </label>
        <div className="relative">
          <input
            id="apiKey"
            type={showKey ? "text" : "password"}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Enter your API key"
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              apiKey && !isValid ? "border-red-300" : "border-gray-300"
            }`}
          />
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            className="absolute right-3 top-2 text-gray-500 hover:text-gray-700"
          >
            {showKey ? "👁️" : "👁️‍🗨️"}
          </button>
        </div>

        {/* Validation feedback */}
        {apiKey && (
          <div className="mt-1">
            {isValid ? (
              <p className="text-xs text-green-600">✓ Valid API key format</p>
            ) : (
              <p className="text-xs text-red-600">✗ Invalid API key format</p>
            )}
          </div>
        )}
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
          <p className="text-sm text-green-800">{success}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={!apiKey.trim() || !isValid}
          className={`flex-1 py-2 px-4 rounded-md font-medium ${
            !apiKey.trim() || !isValid
              ? "bg-gray-300 text-gray-500 cursor-not-allowed"
              : "bg-blue-600 text-white hover:bg-blue-700"
          }`}
        >
          Save API Key
        </button>
      </div>

      {/* Help Text */}
      <div className="mt-4 text-xs text-gray-500">
        <p>
          Your API key is stored securely in your browser and encrypted locally.
        </p>
        <p>Keys expire after 30 days for security purposes.</p>
      </div>
    </div>
  );
}
