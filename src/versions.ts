/**
 * Type definition for value in MrubyVersions
 */
export type MrubyVersion = "1.4.1" | "2.0.0";

/**
 * List of available mruby versions in this extension.
 */
export const MRUBY_VERSIONS: MrubyVersion[] = ["1.4.1", "2.0.0"];

/**
 * Latest version
 */
export const MRUBY_LATEST_VERSION: MrubyVersion = MRUBY_VERSIONS[MRUBY_VERSIONS.length - 1];
