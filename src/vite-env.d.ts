/// <reference types="vite/client" />
/// <reference types="google.maps" />

declare module '*.asset.json' {
  const asset: {
    url: string;
    asset_id: string;
    original_filename?: string;
    content_type?: string;
  };
  export default asset;
}
