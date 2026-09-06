/// <reference types="vite/client" />
/// <reference types="google.maps" />

declare const __APP_VERSION__: string;

declare module '*.asset.json' {
  const asset: {
    url: string;
    asset_id: string;
    original_filename?: string;
    content_type?: string;
  };
  export default asset;
}
