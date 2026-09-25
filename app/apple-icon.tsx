import { ImageResponse } from "next/og";

// Apple touch icon: the grass voxel cube (matching app/icon.svg) centered on
// the default light sky gradient. Apple flattens transparency, so this paints
// a solid background rather than relying on an alpha channel.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const cube =
  "data:image/svg+xml," +
  encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 32 32'><g stroke='#4a3426' stroke-width='0.6' stroke-linejoin='miter'><polygon points='16,5 27,11 16,17 5,11' fill='#91b694'/><polygon points='5,11 16,17 16,26 5,20' fill='#956e56'/><polygon points='27,11 16,17 16,26 27,20' fill='#7a5a46'/></g></svg>",
  );

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(180deg, #aecadf 0%, #d6e1e6 52%, #f1e7d6 100%)",
        }}
      >
        <img src={cube} width={120} height={120} alt="" />
      </div>
    ),
    { ...size },
  );
}
