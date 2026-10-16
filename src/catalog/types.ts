/**
 * Shape of a single entry in the remote skills catalog index
 * (`GET <base>/index.json`), per the verified OpenCode v2 contract.
 */
export interface CatalogSkill {
  name: string;
  version?: string;
  files: string[];
}

/**
 * Shape of a remote skills catalog index: the root object served at
 * `<base>/index.json`.
 */
export interface Catalog {
  skills: CatalogSkill[];
}

export interface CatalogVersion {
  version: string;
}
