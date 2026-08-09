export type PresignUploadInput = {
  key: string;
  contentType: string;
  contentLength: number;
};

export type PresignedUpload = {
  url: string;
  method: "PUT";
  headers: Record<string, string>;
};

export type ObjectMetadata = {
  contentType: string | undefined;
  contentLength: number | undefined;
  etag: string | undefined;
};

export interface ObjectStorage {
  presignUpload(input: PresignUploadInput): Promise<PresignedUpload>;
  headObject(key: string): Promise<ObjectMetadata>;
  deleteObject(key: string): Promise<void>;
}

export interface PrivateFinalizationStorage {
  readPrivateObject(key: string, maxBytes: number): Promise<Uint8Array>;
  putImmutableObject(input: { key: string; body: Uint8Array; contentType: string; sha256: string }): Promise<void>;
  deleteObject(key: string): Promise<void>;
}

export interface PrivateDownloadStorage {
  headObject(key: string): Promise<ObjectMetadata>;
  presignDownload(input: {
    key: string;
    filename: string;
    expiresIn: number;
    disposition?: "attachment" | "inline";
  }): Promise<{ url: string; expiresAt: Date }>;
}
