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
