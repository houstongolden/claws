/**
 * Config client — wraps config.get / config.set with base-hash guard.
 *
 * The base-hash ensures that config.set operations don't race:
 * if the hash has changed since the last get, the set will fail.
 */

import type { GatewayClient } from "./gateway-client";
import type { ConfigValue, ConfigSchema } from "./types";
import { METHODS } from "./protocol";

export class ConfigClient {
  private client: GatewayClient;

  constructor(client: GatewayClient) {
    this.client = client;
  }

  /** Get a config value (includes baseHash for safe updates) */
  async get(key: string): Promise<ConfigValue> {
    const result = await this.client.send<ConfigValue>(METHODS.CONFIG_GET, { key });
    return result;
  }

  /** Set a config value with base-hash safety */
  async set(key: string, value: unknown, baseHash: string): Promise<void> {
    await this.client.send(METHODS.CONFIG_SET, { key, value, baseHash });
  }

  /**
   * Safe read-modify-write: get current value, apply transform, set with hash.
   * Returns the new value.
   */
  async update<T = unknown>(
    key: string,
    transform: (current: T | undefined) => T
  ): Promise<T> {
    const current = await this.get(key);
    const newValue = transform(current.value as T | undefined);
    await this.set(key, newValue, current.baseHash);
    return newValue;
  }

  /** Get the config schema for form generation */
  async getSchema(): Promise<ConfigSchema[]> {
    const result = await this.client.send<ConfigSchema[]>(METHODS.CONFIG_SCHEMA, {});
    return result;
  }
}
